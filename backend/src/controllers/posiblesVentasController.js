import pool from '../config/db.js';
import { enviarNotificacionWebPush } from '../helpers/webPushHelper.js';

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
    if (linkedEvent) {
      const status = Number(linkedEvent.Estatuscotizacion);
      if (status === ESTATUS_CONFIRMADO) return 'ganada';
      if (status === ESTATUS_PRE_RESERVA) return 'en_proceso';
      if (status === ESTATUS_MANTENIMIENTO) return 'en_proceso';
      return 'en_proceso';
    }
    // evento_id seteado pero el evento fue borrado del calendario
    return 'ganada';
  }
  return esFechaPasada(lead?.fecha_evento) ? 'perdida' : 'pendiente';
}

/** Construye la subconsulta que trae el evento ligado (con matching robusto por baseId). */
const LINKED_EVENT_SELECT = `
  ev.Estatuscotizacion AS linked_estatus,
  ev.FechaEvento       AS linked_fecha
`;

/** Para el listado principal: une con el evento ligado si existe. */
const LINKED_EVENT_JOIN = `
  LEFT JOIN tbl_seguimientocotizaciones ev
    ON ev.Idocupacion = pv.evento_id
    OR ev.Idocupacion = CONCAT(SUBSTRING_INDEX(pv.evento_id, '_s', 1), '')
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
        row.linked_estatus === null ? null : { Estatuscotizacion: row.linked_estatus }
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
    estadoEsManual: false, // el estado siempre es derivado
    ultimoSeguimientoEn: row.ultimo_seguimiento_en || null,
    primerSeguimientoEn: row.primer_seguimiento_en || null,
    eventoId: row.evento_id || null,
    creadoEn: row.creado_en,
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
              ev.Estatuscotizacion AS linked_estatus
         FROM posibles_ventas pv
         LEFT JOIN tbl_seguimientocotizaciones ev
           ON ev.Idocupacion = pv.evento_id
           OR ev.Idocupacion = CONCAT(SUBSTRING_INDEX(pv.evento_id, '_s', 1), '')
         ${where}`,
      onlyIds && onlyIds.length ? onlyIds : []
    );

    const updates = [];
    const params = [];
    for (const row of rows) {
      const derived = computeEstado(
        { fecha_evento: row.fecha_evento, evento_id: row.evento_id },
        row.linked_estatus === null || row.linked_estatus === undefined
          ? null
          : { Estatuscotizacion: row.linked_estatus }
      );
      if (derived !== row.estado) {
        updates.push('WHEN ? THEN ?');
        params.push(row.id, derived);
      }
    }
    if (updates.length === 0) return { changed: 0 };

    // CASE WHEN sobre una lista de IDs.
    const ids = [];
    for (let i = 0; i < updates.length; i += 2) {
      // extraemos el id de params (posiciones pares antes del THEN)
      ids.push(params[i]);
    }
    const caseExpr = updates.join(' ');
    await pool.query(
      `UPDATE posibles_ventas
          SET estado = CASE id ${caseExpr} END
        WHERE id IN (${ids.map(() => '?').join(',')})`,
      [...params, ...ids]
    );
    return { changed: updates.length / 2 };
  } catch (err) {
    console.error('[PosiblesVentas] syncAllEstados error:', err.message || err);
    return { changed: 0, error: err.message || String(err) };
  }
}

// Envía notificación (BD + socket + web push) al vendedor asignado
async function notificarVendedor(req, leadId, vendedorId, clienteNombre, detalle) {
  if (!vendedorId) return;

  const titulo = 'Nuevo evento asignado';
  const mensaje = `${clienteNombre}${detalle ? ` · ${detalle}` : ''} — te fue asignado un nuevo evento.`;

  try {
    const [notifResult] = await pool.query(
      'INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje) VALUES (?, ?, ?, ?)',
      [String(vendedorId), 'posible_venta', titulo, mensaje]
    );

    if (req.io) {
      req.io.to(`usuario:${vendedorId}`).emit('notificacion:created', {
        id: notifResult.insertId,
        usuario_id: vendedorId,
        tipo: 'posible_venta',
        titulo,
        mensaje,
        informe_id: null,
        idocupacion: null,
        comentario_id: null,
        posibleVentaId: leadId,
        leido: 0,
        fecha_creacion: new Date(),
      });
    }

    enviarNotificacionWebPush(
      vendedorId,
      titulo,
      `${clienteNombre}${detalle ? ` · ${detalle}` : ''} — evento asignado.`,
      { url: '/posibles-ventas' }
    ).catch((err) => console.error('[WebPush] Error enviando push posible venta:', err));
  } catch (err) {
    console.error('[PosiblesVentas] Error al notificar vendedor:', err.message || err);
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
    if (rol === 'vendedor') {
      where += ' AND pv.vendedor_id = ?';
      params.push(userId);
    } else if (rol === 'frontoffice' || rol === 'recepcionista') {
      where += ' AND pv.creado_por_id = ?';
      params.push(userId);
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

    const creadoPorId = String(req.user?.id || '');

    const [result] = await pool.query(
      `INSERT INTO posibles_ventas
         (nombre_cliente, telefono, correo, fecha_evento, salones_json, pax, servicios_json, notas, vendedor_id, creado_por_id, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      [
        nombre,
        String(telefono || '').trim() || null,
        String(correo || '').trim() || null,
        toDateStr(fechaEvento),
        JSON.stringify(Array.isArray(salones) ? salones : []),
        pax !== null && pax !== undefined && pax !== '' ? Number(pax) : null,
        JSON.stringify(Array.isArray(servicios) ? servicios : []),
        String(notas || '').trim() || null,
        String(vendedorId || '').trim() || null,
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
      }
    }

    // Enlace a la reserva creada: lo setea el flujo de conversión (cualquier rol autorizado).
    if (body.eventoId !== undefined) {
      const evId = String(body.eventoId || '').trim() || null;
      updates.push('evento_id = ?');
      params.push(evId);
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

    await logHistorial({
      idPosibleVenta: id,
      accion: 'deleted',
      actor: { id: actorId, nombre: actorNombre },
      snapshot: lead,
      detalle: `Eliminado por ${actorNombre || actorId}`,
    });

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
