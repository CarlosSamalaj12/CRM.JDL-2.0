import pool from '../config/db.js';
import { enviarNotificacionWebPush } from '../helpers/webPushHelper.js';
import { emitChange } from '../helpers/socketEvents.js';

// ─── Estado derivado (NO manual) ────────────────────────────────────────────
// El campo `estado` de posibles_ventas se calcula a partir del calendario.
// Reglas (acordadas 2026-08-16):
//   - evento_id ligado y existe en tbl_seguimientocotizaciones:
//       * Estatuscotizacion = 4 (Confirmado)   → 'ganada'
//       * Estatuscotizacion = 7 (Pre-reserva)  → 'en_proceso'
//       * Estatuscotizacion = 8 (Mantenimiento)→ 'en_proceso'
//       * otro estatus (0, cancelado, etc.)    → 'en_proceso' (en flujo)
//   - evento_id ligado pero el evento ya no existe (borrado) → 'ganada'
//   - sin evento_id:
//       * fecha_evento < hoy (en la zona horaria del servidor) → 'perdida'
//       * fecha_evento >= hoy o NULL                          → 'pendiente'

const ESTADOS_VALIDOS = new Set(['pendiente', 'en_proceso', 'ganada', 'perdida']);

const ESTATUS_CONFIRMADO = 4;
const ESTATUS_PRE_RESERVA = 7;
const ESTATUS_MANTENIMIENTO = 8;

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

/** Devuelve solo la parte "base" del id (sin sufijo _s<n>_<ts>) para matching robusto. */
function baseIdOcupacion(id) {
  const s = String(id || '').trim();
  if (!s) return '';
  return s.replace(/_(s|slot)\d+_\d{6,}$/, '');
}

/** Compara solo la parte de fecha (YYYY-MM-DD) ignorando hora. */
function esFechaPasada(fecha) {
  if (!fecha) return false;
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return false;
  const f = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const hoy = new Date();
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return f.getTime() < h.getTime();
}

/**
 * Determina el estado derivado de un lead.
 * @param {{ fecha_evento: Date|string|null, evento_id: string|null }} lead
 * @param {{ Estatuscotizacion: number|string|null }|null} linkedEvent
 */
function computeEstado(lead, linkedEvent) {
  const eventoId = String(lead?.evento_id || '').trim();
  if (eventoId) {
    if (linkedEvent && linkedEvent.linked_estatus !== null && linkedEvent.linked_estatus !== undefined) {
      const rawStatus = String(linkedEvent.linked_estatus).trim().toLowerCase();
      const numStatus = Number(linkedEvent.linked_estatus);

      // Cancelado / Perdido (por texto o código 0)
      if (
        rawStatus.includes('cancel') ||
        rawStatus.includes('perdid') ||
        rawStatus === '0'
      ) {
        return 'perdida';
      }

      // Confirmado (4) -> ganada
      if (numStatus === ESTATUS_CONFIRMADO || rawStatus.includes('confirm')) {
        return 'ganada';
      }

      // Pre-reserva (7), Mantenimiento (8), o flujo activo -> en_proceso
      if (
        numStatus === ESTATUS_PRE_RESERVA ||
        numStatus === ESTATUS_MANTENIMIENTO ||
        rawStatus.includes('pre') ||
        rawStatus.includes('manten') ||
        rawStatus.includes('cotiz') ||
        rawStatus.includes('reserva') ||
        rawStatus.includes('seguim') ||
        rawStatus.includes('espera')
      ) {
        return 'en_proceso';
      }

      // Si la fecha del evento ya pasó
      if (esFechaPasada(lead?.fecha_evento || linkedEvent?.linked_fecha)) {
        return 'perdida';
      }

      return 'en_proceso';
    } else {
      // Si evento_id está seteado pero el evento fue cancelado o no existe en eventos/tbl_seguimientocotizaciones -> 'perdida'
      return 'perdida';
    }
  }
  return esFechaPasada(lead?.fecha_evento) ? 'perdida' : 'pendiente';
}

/** Construye la subconsulta que trae el evento ligado (con matching robusto por baseId). */
const LINKED_EVENT_SELECT = `
  COALESCE(e_direct.estado, ev.Estatuscotizacion) AS linked_estatus,
  COALESCE(e_direct.fecha_evento, ev.FechaEvento) AS linked_fecha,
  COALESCE(e_direct.id_usuario, u_legacy.id) AS linked_usuario_id,
  COALESCE(u_direct.nombre, ev.Vendedor) AS atendido_por_nombre
`;

/** Para el listado principal: une con la tabla eventos y tbl_seguimientocotizaciones si existe. */
const LINKED_EVENT_JOIN = `
  LEFT JOIN eventos e_direct
    ON e_direct.id = pv.evento_id
    OR e_direct.id = SUBSTRING_INDEX(pv.evento_id, '_s', 1)
  LEFT JOIN usuarios u_direct
    ON u_direct.id = e_direct.id_usuario
  LEFT JOIN tbl_seguimientocotizaciones ev
    ON ev.Idocupacion = pv.evento_id
    OR ev.Idocupacion = SUBSTRING_INDEX(pv.evento_id, '_s', 1)
  LEFT JOIN usuarios u_legacy
    ON TRIM(u_legacy.nombre) = TRIM(ev.Vendedor)
`;

// Inserta una entrada en la bitácora de posibles ventas (no falla la operación principal si el log falla)
async function logHistorial({ idPosibleVenta, accion, actor, snapshot, detalle }) {
  try {
    const id = `hpv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await pool.query(
      `INSERT INTO historial_posibles_ventas
         (id, id_posible_venta, accion, id_usuario_actor, nombre_usuario_actor, snapshot_json, detalle)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        idPosibleVenta,
        accion,
        actor?.id ? String(actor.id) : null,
        actor?.nombre || actor?.fullName || actor?.name || null,
        snapshot ? JSON.stringify(snapshot) : null,
        detalle || null,
      ]
    );
  } catch (err) {
    console.error('[PosiblesVentas] No se pudo escribir en historial:', err.message || err);
  }
}

function requireAdmin(req, res) {
  const rol = normalizeRole(req.user?.rol);
  if (rol !== 'admin') {
    res.status(403).json({ message: 'Solo administradores pueden realizar esta acción' });
    return false;
  }
  return true;
}

function parseJsonList(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function toDateStr(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return null;
}

function buildLead(row) {
  // Si la query ya trajo linked_estatus / linked_fecha, recalculamos el estado derivado
  // y, si difiere, lo persistimos después en bulk. Aquí devolvemos el derivado para la respuesta.
  const derived = row.linked_estatus !== undefined
    ? computeEstado(
        { fecha_evento: row.fecha_evento, evento_id: row.evento_id },
        row.linked_estatus === null ? null : { linked_estatus: row.linked_estatus, linked_fecha: row.linked_fecha }
      )
    : (row.estado || 'pendiente');

  return {
    id: row.id,
    nombreCliente: row.nombre_cliente,
    telefono: row.telefono,
    correo: row.correo,
    fechaEvento: toDateStr(row.fecha_evento),
    salones: parseJsonList(row.salones_json),
    pax: row.pax === null || row.pax === undefined ? null : Number(row.pax),
    servicios: parseJsonList(row.servicios_json),
    notas: row.notas,
    vendedorId: row.vendedor_id,
    vendedorNombre: row.vendedor_nombre || null,
    creadoPorId: row.creado_por_id,
    creadoPorNombre: row.creado_por_nombre || null,
    estado: derived,
    ultimoSeguimientoEn: row.ultimo_seguimiento_en || (row.evento_id ? (row.actualizado_en || row.creado_en) : null),
    primerSeguimientoEn: row.primer_seguimiento_en || (row.evento_id ? (row.actualizado_en || row.creado_en) : null),
    eventoId: row.evento_id || null,
    atendidoPorId: row.linked_usuario_id || null,
    atendidoPorNombre: row.atendido_por_nombre || null,
    tomadoPorOtro: Boolean(
      row.evento_id &&
      row.vendedor_id &&
      row.linked_usuario_id &&
      String(row.vendedor_id).trim() !== String(row.linked_usuario_id).trim()
    ),
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en || null,
    // Fecha en que el lead recibió un vendedor por primera vez (o reasignación).
    // NULL en leads creados antes del 2026-08-28: el reporte usa creadoEn como fallback.
    asignadoEn: row.asignado_en || null,
    // Solo poblado en /eliminadas
    deletedAt: row.deleted_at || null,
    deletedPorId: row.deleted_por_id || null,
    deletedPorNombre: row.deleted_por_nombre || null,
  };
}

/**
 * Sincroniza el estado de todos los leads a su valor derivado.
 * Se usa:
 *   - Después de un GET (en background) para mantener la BD coherente.
 *   - Por el cron diario.
 *   - Tras un cambio en el calendario (futuro).
 *
 * Es seguro: solo escribe si el estado almacenado difiere del derivado.
 */
export async function syncAllEstados({ onlyIds = null } = {}) {
  try {
    // Traemos los leads (filtrados si nos pasan IDs) y los datos del evento ligado.
    const where = onlyIds && onlyIds.length
      ? `WHERE pv.deleted_at IS NULL AND pv.id IN (${onlyIds.map(() => '?').join(',')})`
      : `WHERE pv.deleted_at IS NULL`;

    const [rows] = await pool.query(
      `SELECT pv.id, pv.fecha_evento, pv.evento_id, pv.estado,
              COALESCE(e_direct.estado, ev.Estatuscotizacion) AS linked_estatus,
              COALESCE(e_direct.fecha_evento, ev.FechaEvento) AS linked_fecha
         FROM posibles_ventas pv
         LEFT JOIN eventos e_direct
           ON e_direct.id = pv.evento_id
           OR e_direct.id = SUBSTRING_INDEX(pv.evento_id, '_s', 1)
         LEFT JOIN tbl_seguimientocotizaciones ev
           ON ev.Idocupacion = pv.evento_id
           OR ev.Idocupacion = SUBSTRING_INDEX(pv.evento_id, '_s', 1)
         ${where}`,
      onlyIds && onlyIds.length ? onlyIds : []
    );

    const updates = [];
    for (const row of rows) {
      const derived = computeEstado(
        { fecha_evento: row.fecha_evento, evento_id: row.evento_id },
        row.linked_estatus === null || row.linked_estatus === undefined
          ? null
          : { linked_estatus: row.linked_estatus, linked_fecha: row.linked_fecha }
      );
      if (derived !== row.estado) {
        updates.push({ id: row.id, estado: derived });
      }
    }
    if (updates.length === 0) return { changed: 0 };

    for (const u of updates) {
      await pool.query('UPDATE posibles_ventas SET estado = ? WHERE id = ?', [u.estado, u.id]);
    }
    return { changed: updates.length };
  } catch (err) {
    console.error('[PosiblesVentas] syncAllEstados error:', err.message || err);
    return { changed: 0, error: err.message || String(err) };
  }
}

// Envía notificación (BD + socket + web push) al vendedor asignado
async function notificarVendedor(req, leadId, vendedorId, clienteNombre, detalle) {
  if (!vendedorId) return;

  const esReasignacion = String(detalle || '').trim().toLowerCase() === 'reasignada';
  const titulo = esReasignacion ? 'Evento reasignado' : 'Nuevo evento asignado';
  const mensaje = esReasignacion
    ? `${clienteNombre} — te fue reasignado.`
    : `${clienteNombre}${detalle ? ` · ${detalle}` : ''} — te fue asignado un nuevo evento.`;

  try {
    const [notifResult] = await pool.query(
      'INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, idocupacion) VALUES (?, ?, ?, ?, ?)',
      [String(vendedorId), 'posible_venta', titulo, mensaje, String(leadId)]
    );

    if (req.io) {
      req.io.to(`usuario:${vendedorId}`).emit('notificacion:created', {
        id: notifResult.insertId,
        usuario_id: vendedorId,
        tipo: 'posible_venta',
        titulo,
        mensaje,
        informe_id: null,
        idocupacion: String(leadId),
        comentario_id: null,
        posibleVentaId: leadId,
        leido: 0,
        fecha_creacion: new Date(),
      });
    }

    enviarNotificacionWebPush(
      vendedorId,
      titulo,
      mensaje,
      { url: `/posibles-ventas?focus=${leadId}` }
    ).catch((err) => console.error('[WebPush] Error enviando push posible venta:', err));
  } catch (err) {
    console.error('[PosiblesVentas] Error al notificar vendedor:', err.message || err);
  }
}

// Envía un mensaje recordatorio (BD + socket + web push) al vendedor.
// A diferencia de `notificarVendedor`, este tipo NO se borra al pasar a
// Seguimiento — el vendedor lo lee y desaparece (marcar como leído).
async function notificarVendedorMensaje(req, leadId, vendedorId, clienteNombre, mensajeCustom) {
  if (!vendedorId) return null;
  const titulo = 'Recordatorio de seguimiento';
  const mensaje = `${clienteNombre} — ${mensajeCustom}`;

  try {
    const [notifResult] = await pool.query(
      'INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, idocupacion) VALUES (?, ?, ?, ?, ?)',
      [String(vendedorId), 'recordatorio_seguimiento', titulo, mensaje, String(leadId)]
    );

    if (req.io) {
      req.io.to(`usuario:${vendedorId}`).emit('notificacion:created', {
        id: notifResult.insertId,
        usuario_id: vendedorId,
        tipo: 'recordatorio_seguimiento',
        titulo,
        mensaje,
        informe_id: null,
        idocupacion: String(leadId),
        comentario_id: null,
        posibleVentaId: leadId,
        leido: 0,
        fecha_creacion: new Date(),
      });
    }

    enviarNotificacionWebPush(
      vendedorId,
      titulo,
      mensaje,
      { url: `/posibles-ventas?focus=${leadId}` }
    ).catch((err) => console.error('[WebPush] Error enviando push recordatorio seguimiento:', err));

    return notifResult.insertId;
  } catch (err) {
    console.error('[PosiblesVentas] Error al notificar vendedor (recordatorio):', err.message || err);
    return null;
  }
}

// Registra una entrada en `historial_posibles_ventas` cuando se envía un
// mensaje manual al vendedor (auditoría).
async function logMensajeVendedor({ idPosibleVenta, actor, mensaje }) {
  try {
    const id = `hpv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await pool.query(
      `INSERT INTO historial_posibles_ventas
         (id, id_posible_venta, accion, id_usuario_actor, nombre_usuario_actor, detalle)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        String(idPosibleVenta),
        'mensaje_vendedor',
        String(actor?.id || ''),
        String(actor?.nombre || ''),
        `Mensaje enviado al vendedor: ${String(mensaje).slice(0, 240)}`,
      ]
    );
  } catch (err) {
    console.error('[PosiblesVentas] No se pudo registrar historial de mensaje:', err.message || err);
  }
}

// ─── POST /api/posibles-ventas/:id/mensaje-vendedor ───
// Admin o recepcionista (creador del lead) envía un mensaje recordatorio
// al vendedor asignado. Se persiste como notificación tipo
// `recordatorio_seguimiento` y se emite por socket/web push.
export async function enviarMensajeVendedor(req, res, next) {
  try {
    const { id } = req.params;
    const { mensaje } = req.body || {};
    const userId = String(req.user?.id || '');
    const userName = String(req.user?.nombre || req.user?.fullName || req.user?.name || '');
    const rol = normalizeRole(req.user?.rol);

    // Coordinadores NO tienen permiso (consistente con createPosibleVenta).
    if (rol.includes('coordinad') || rol === 'eventos') {
      return res.status(403).json({
        message: 'Los coordinadores no tienen permiso para enviar mensajes al vendedor',
      });
    }

    const isAdmin = rol === 'admin';
    const isReception = rol === 'frontoffice' || rol === 'recepcionista';

    if (!isAdmin && !isReception) {
      return res.status(403).json({
        message: 'Solo administradores o recepcionistas pueden enviar mensajes al vendedor',
      });
    }

    // Validar mensaje.
    const mensajeTrim = String(mensaje || '').trim();
    if (!mensajeTrim) {
      return res.status(400).json({ message: 'El mensaje no puede estar vacío' });
    }
    if (mensajeTrim.length > 500) {
      return res.status(400).json({
        message: 'El mensaje no puede exceder 500 caracteres',
      });
    }

    // Cargar el lead.
    const [rows] = await pool.query(
      'SELECT * FROM posibles_ventas WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Evento asignado no encontrado' });
    }
    const lead = rows[0];

    // Recepcionista sólo puede actuar sobre leads que él creó.
    if (!isAdmin) {
      if (String(lead.creado_por_id || '') !== userId) {
        return res.status(403).json({
          message: 'Solo puedes enviar mensajes a leads que tú creaste',
        });
      }
    }

    const vendedorId = String(lead.vendedor_id || '').trim();
    if (!vendedorId) {
      return res.status(400).json({
        message: 'El lead no tiene vendedor asignado, no se puede enviar mensaje',
      });
    }

    // Insertar notificación + emitir socket + web push.
    const notifId = await notificarVendedorMensaje(
      req,
      lead.id,
      vendedorId,
      lead.nombre_cliente,
      mensajeTrim
    );

    // Auditoría: registrar en historial_posibles_ventas.
    await logMensajeVendedor({
      idPosibleVenta: lead.id,
      actor: { id: userId, nombre: userName },
      mensaje: mensajeTrim,
    });

    if (!notifId) {
      return res.status(500).json({ message: 'No se pudo registrar la notificación' });
    }

    return res.status(201).json({ id: notifId, ok: true });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/posibles-ventas ───
// Admin ve todas; recepcionista ve las que registró; vendedor ve las asignadas a él.
// El `estado` de cada lead se calcula derivado del calendario + fecha_evento.
export async function getPosiblesVentas(req, res, next) {
  try {
    const userId = String(req.user?.id || '');
    const rol = normalizeRole(req.user?.rol);

    let where = "WHERE pv.deleted_at IS NULL";
    const params = [];
    if (rol.includes('coordinad') || rol === 'eventos') {
      where += ' AND (pv.vendedor_id = ? OR pv.creado_por_id = ?)';
      params.push(userId, userId);
    }

    const [rows] = await pool.query(
      `SELECT pv.*, ${LINKED_EVENT_SELECT},
              v.nombre AS vendedor_nombre,
              c.nombre AS creado_por_nombre
       FROM posibles_ventas pv
       ${LINKED_EVENT_JOIN}
       LEFT JOIN usuarios v ON v.id = pv.vendedor_id
       LEFT JOIN usuarios c ON c.id = pv.creado_por_id
       ${where}
       ORDER BY pv.creado_en DESC, pv.id DESC`,
      params
    );

    // Persistir cambios derivados en background (no bloquea la respuesta).
    setImmediate(() => {
      const ids = rows.map((r) => r.id);
      if (ids.length) syncAllEstados({ onlyIds: ids }).catch(() => {});
    });

    res.json(rows.map(buildLead));
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/posibles-ventas/:id ───
export async function getPosibleVenta(req, res, next) {
  try {
    const { id } = req.params;
    const userId = String(req.user?.id || '');
    const rol = normalizeRole(req.user?.rol);

    const [rows] = await pool.query(
      `SELECT pv.*, ${LINKED_EVENT_SELECT},
              v.nombre AS vendedor_nombre,
              c.nombre AS creado_por_nombre
       FROM posibles_ventas pv
       ${LINKED_EVENT_JOIN}
       LEFT JOIN usuarios v ON v.id = pv.vendedor_id
       LEFT JOIN usuarios c ON c.id = pv.creado_por_id
       WHERE pv.id = ? AND pv.deleted_at IS NULL`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Evento asignado no encontrado' });
    }
    const lead = rows[0];

    if (rol === 'vendedor' && String(lead.vendedor_id || '') !== userId) {
      return res.status(403).json({ message: 'No tienes permiso para ver este evento asignado' });
    }
    if ((rol === 'frontoffice' || rol === 'recepcionista') && String(lead.creado_por_id || '') !== userId) {
      return res.status(403).json({ message: 'No tienes permiso para ver este evento asignado' });
    }

    setImmediate(() => {
      syncAllEstados({ onlyIds: [lead.id] }).catch(() => {});
    });

    res.json(buildLead(lead));
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/posibles-ventas ───
export async function createPosibleVenta(req, res, next) {
  try {
    const {
      nombreCliente,
      telefono,
      correo,
      fechaEvento,
      salones,
      pax,
      servicios,
      notas,
      vendedorId,
    } = req.body || {};

    const nombre = String(nombreCliente || '').trim();
    if (!nombre) {
      return res.status(400).json({ message: 'El nombre del cliente es requerido' });
    }

    const rol = normalizeRole(req.user?.rol);
    if (rol.includes('coordinad') || rol === 'eventos') {
      return res.status(403).json({ message: 'Los coordinadores no tienen permiso para registrar eventos asignados' });
    }

    const creadoPorId = String(req.user?.id || '');

    // Si viene con vendedor desde el inicio, se considera "asignado" en el mismo INSERT.
    const vendedorTrim = String(vendedorId || '').trim() || null;

    const [result] = await pool.query(
      `INSERT INTO posibles_ventas
         (nombre_cliente, telefono, correo, fecha_evento, salones_json, pax, servicios_json, notas, vendedor_id, creado_por_id, estado, asignado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ${vendedorTrim ? 'NOW()' : 'NULL'})`,
      [
        nombre,
        String(telefono || '').trim() || null,
        String(correo || '').trim() || null,
        toDateStr(fechaEvento),
        JSON.stringify(Array.isArray(salones) ? salones : []),
        pax !== null && pax !== undefined && pax !== '' ? Number(pax) : null,
        JSON.stringify(Array.isArray(servicios) ? servicios : []),
        String(notas || '').trim() || null,
        vendedorTrim,
        creadoPorId,
      ]
    );

    const leadId = result.insertId;

    // Re-derivar el estado inmediatamente (por si fecha_evento es en el pasado).
    setImmediate(() => {
      syncAllEstados({ onlyIds: [leadId] }).catch(() => {});
    });

    if (vendedorId) {
      const fechaTexto = toDateStr(fechaEvento) || '';
      const paxTexto = pax ? `${pax} pax` : '';
      const detalle = [fechaTexto, paxTexto].filter(Boolean).join(' · ');
      await notificarVendedor(req, leadId, vendedorId, nombre, detalle);
    }

    emitChange(req, 'posible_venta', 'created', { id: leadId });
    if (req.io) req.io.emit('notificacion:updated');

    res.status(201).json({ id: leadId, ok: true });
  } catch (error) {
    next(error);
  }
}

// ─── PATCH /api/posibles-ventas/:id ───
// NOTA: el campo `estado` ya no se acepta del cliente (es derivado).
// Solo se permite setear `eventoId` (flujo de conversión lead → reserva).
export async function updatePosibleVenta(req, res, next) {
  try {
    const { id } = req.params;
    const userId = String(req.user?.id || '');
    const rol = normalizeRole(req.user?.rol);

    const [rows] = await pool.query('SELECT * FROM posibles_ventas WHERE id = ? AND deleted_at IS NULL', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Evento asignado no encontrado' });
    }
    const lead = rows[0];

    // Permisos
    const isAdmin = rol === 'admin';
    const isReception = rol === 'frontoffice' || rol === 'recepcionista';
    const isVendedor = rol === 'vendedor';
    const isOwner = String(lead.creado_por_id || '') === userId;
    const isAssigned = String(lead.vendedor_id || '') === userId;

    if (isAdmin) {
      // puede todo
    } else if (isReception) {
      if (!isOwner) {
        return res.status(403).json({ message: 'No tienes permiso para modificar este evento asignado' });
      }
    } else if (isVendedor) {
      if (!isAssigned) {
        return res.status(403).json({ message: 'No tienes permiso para modificar este evento asignado' });
      }
    } else {
      return res.status(403).json({ message: 'No tienes permiso para modificar este evento asignado' });
    }

    const body = req.body || {};
    const updates = [];
    const params = [];
    let vendedorIdAnterior = String(lead.vendedor_id || '');

    // No permitir editar ni reasignar si ya no está en estado 'pendiente' (a menos que se esté asociando un eventoId)
    if (lead.estado !== 'pendiente' && body.eventoId === undefined) {
      return res.status(400).json({
        message: 'No se puede editar ni reasignar un evento al que ya se le está dando seguimiento o ya está confirmado. Solo se permite editar o reasignar eventos en estado pendiente.',
      });
    }

    // El vendedor solo puede registrar seguimiento (sin tocar otros campos);
    // pero como el estado ahora es derivado, este endpoint ya no hace nada para vendedor.
    if (!isVendedor) {
      if (body.nombreCliente !== undefined) {
        const nombre = String(body.nombreCliente || '').trim();
        if (!nombre) return res.status(400).json({ message: 'El nombre del cliente es requerido' });
        updates.push('nombre_cliente = ?');
        params.push(nombre);
      }
      if (body.telefono !== undefined) {
        updates.push('telefono = ?');
        params.push(String(body.telefono || '').trim() || null);
      }
      if (body.correo !== undefined) {
        updates.push('correo = ?');
        params.push(String(body.correo || '').trim() || null);
      }
      if (body.fechaEvento !== undefined) {
        updates.push('fecha_evento = ?');
        params.push(toDateStr(body.fechaEvento));
      }
      if (body.salones !== undefined) {
        updates.push('salones_json = ?');
        params.push(JSON.stringify(Array.isArray(body.salones) ? body.salones : []));
      }
      if (body.pax !== undefined) {
        updates.push('pax = ?');
        params.push(body.pax !== null && body.pax !== '' ? Number(body.pax) : null);
      }
      if (body.servicios !== undefined) {
        updates.push('servicios_json = ?');
        params.push(JSON.stringify(Array.isArray(body.servicios) ? body.servicios : []));
      }
      if (body.notas !== undefined) {
        updates.push('notas = ?');
        params.push(String(body.notas || '').trim() || null);
      }
      if (body.vendedorId !== undefined) {
        const nuevoVendedor = String(body.vendedorId || '').trim() || null;
        updates.push('vendedor_id = ?');
        params.push(nuevoVendedor);
        // Si se está pasando de "sin vendedor" a "con vendedor", o reasignando,
        // actualizamos asignado_en. Si se está pasando de "con vendedor" a "sin vendedor",
        // mantenemos la fecha original (auditoría: sabemos cuándo se asignó por última vez).
        if (nuevoVendedor && nuevoVendedor !== vendedorIdAnterior) {
          updates.push('asignado_en = CURRENT_TIMESTAMP');
        }
      }
    }

    // Enlace a la reserva creada: lo setea el flujo de conversión (cualquier rol autorizado).
    if (body.eventoId !== undefined) {
      const evId = String(body.eventoId || '').trim() || null;
      updates.push('evento_id = ?');
      params.push(evId);
      if (evId) {
        updates.push('ultimo_seguimiento_en = CURRENT_TIMESTAMP');
        updates.push('primer_seguimiento_en = COALESCE(primer_seguimiento_en, CURRENT_TIMESTAMP)');
        await pool.query("UPDATE notificaciones SET leido = 1 WHERE tipo = 'posible_venta' AND idocupacion = ?", [id]);
      }
    }

    // Rechazo explícito de override manual (acordado 2026-08-16: estado 100% derivado).
    if (body.estado !== undefined) {
      return res.status(400).json({
        message: 'El estado es automático: se calcula a partir del calendario. No se permite asignarlo manualmente.',
      });
    }

    if (updates.length === 0) {
      return res.json({ ok: true });
    }

    params.push(id);
    await pool.query(
      `UPDATE posibles_ventas SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Re-derivar estado (puede haber cambiado por el nuevo evento_id o fecha_evento).
    setImmediate(() => {
      syncAllEstados({ onlyIds: [Number(id)] }).catch(() => {});
    });

    // Notificar al nuevo vendedor si cambió la asignación
    if (!isVendedor && body.vendedorId !== undefined) {
      const nuevoVendedor = String(body.vendedorId || '').trim() || null;
      if (nuevoVendedor && nuevoVendedor !== vendedorIdAnterior) {
        await notificarVendedor(req, id, nuevoVendedor, lead.nombre_cliente, 'reasignada');
      }
    }

    emitChange(req, 'posible_venta', 'updated', { id: Number(id) });
    if (req.io) req.io.emit('notificacion:updated');

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

// ─── DELETE /api/posibles-ventas/:id ───
export async function deletePosibleVenta(req, res, next) {
  try {
    const { id } = req.params;
    const userId = String(req.user?.id || '');
    const rol = normalizeRole(req.user?.rol);

    const [rows] = await pool.query('SELECT * FROM posibles_ventas WHERE id = ? AND deleted_at IS NULL', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Evento asignado no encontrado' });
    }
    const lead = rows[0];

    const isAdmin = rol === 'admin';
    const isOwner = String(lead.creado_por_id || '') === userId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar este evento asignado' });
    }

    if (lead.estado !== 'pendiente') {
      return res.status(400).json({
        message: 'No se puede eliminar un evento al que ya se le está dando seguimiento o ya está confirmado. Solo se permite eliminar eventos en estado pendiente.',
      });
    }

    const actor = { id: req.user?.id, nombre: req.user?.nombre || req.user?.fullName || req.user?.name };
    const actorId = String(actor.id || userId || '');
    const actorNombre = actor.nombre || null;

    await pool.query(
      `UPDATE posibles_ventas
         SET deleted_at = CURRENT_TIMESTAMP,
             deleted_por_id = ?,
             deleted_por_nombre = ?
       WHERE id = ?`,
      [actorId, actorNombre, id]
    );

    // Limpiar las notificaciones de la campana asociadas a este lead.
    // - 'posible_venta'             → "Evento asignado" (campana, label "Evento asignado")
    // - 'recordatorio_seguimiento'  → "Recordatorio de seguimiento"
    // Replica el patrón de cleanupNotificacionesPorSeguimiento (server.cjs:1995):
    // hard-delete (no marcar como leída) porque el lead ya no existe.
    // `idocupacion` se guarda como string al crear las notifs (ver
    // notificarVendedor / notificarVendedorMensaje), por eso se coercea a String.
    try {
      const [notifResult] = await pool.query(
        `DELETE FROM notificaciones
          WHERE idocupacion = ?
            AND tipo IN ('posible_venta', 'recordatorio_seguimiento')`,
        [String(id)]
      );
      const notifsDeleted = notifResult?.affectedRows || 0;
      if (notifsDeleted > 0) {
        console.log(
          `[PosiblesVentas] 🧹 ${notifsDeleted} notificación(es) eliminada(s) por soft-delete del lead ${id}.`
        );
      }
    } catch (notifErr) {
      // No fallamos la operación principal: el lead ya está soft-deleted
      // y el filtro defensivo del GET (notificacionesController.js) ocultará
      // las notifs restantes. Sólo logueamos para diagnóstico.
      console.error(
        `[PosiblesVentas] ⚠️ No se pudieron limpiar notificaciones del lead ${id}:`,
        notifErr?.message || notifErr
      );
    }

    await logHistorial({
      idPosibleVenta: id,
      accion: 'deleted',
      actor: { id: actorId, nombre: actorNombre },
      snapshot: lead,
      detalle: `Eliminado por ${actorNombre || actorId}`,
    });

    emitChange(req, 'posible_venta', 'deleted', { id: Number(id) });
    if (req.io) req.io.emit('notificacion:updated');

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/posibles-ventas/eliminadas ───
export async function getEliminadas(req, res, next) {
  try {
    if (!requireAdmin(req, res)) return;

    const [rows] = await pool.query(
      `SELECT pv.*, ${LINKED_EVENT_SELECT},
              v.nombre AS vendedor_nombre,
              c.nombre AS creado_por_nombre
       FROM posibles_ventas pv
       ${LINKED_EVENT_JOIN}
       LEFT JOIN usuarios v ON v.id = pv.vendedor_id
       LEFT JOIN usuarios c ON c.id = pv.creado_por_id
       WHERE pv.deleted_at IS NOT NULL
       ORDER BY pv.deleted_at DESC, pv.id DESC`
    );
    res.json(rows.map(buildLead));
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/posibles-ventas/:id/restore ───
export async function restorePosibleVenta(req, res, next) {
  try {
    if (!requireAdmin(req, res)) return;

    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM posibles_ventas WHERE id = ? AND deleted_at IS NOT NULL', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Evento asignado eliminado no encontrado' });
    }

    await pool.query(
      `UPDATE posibles_ventas
         SET deleted_at = NULL,
             deleted_por_id = NULL,
             deleted_por_nombre = NULL
       WHERE id = ?`,
      [id]
    );

    const actor = { id: req.user?.id, nombre: req.user?.nombre || req.user?.fullName || req.user?.name };
    await logHistorial({
      idPosibleVenta: id,
      accion: 'restored',
      actor,
      snapshot: rows[0],
      detalle: `Restaurado por ${actor.nombre || actor.id}`,
    });

    // Re-derivar estado tras restaurar
    setImmediate(() => {
      syncAllEstados({ onlyIds: [Number(id)] }).catch(() => {});
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
