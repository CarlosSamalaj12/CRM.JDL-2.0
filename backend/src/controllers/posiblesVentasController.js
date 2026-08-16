import pool from '../config/db.js';
import { enviarNotificacionWebPush } from '../helpers/webPushHelper.js';

// Estados permitidos de una posible venta
const ESTADOS_VALIDOS = new Set(['pendiente', 'en_proceso', 'ganada', 'perdida']);

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

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
    estado: row.estado || 'pendiente',
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

// Envía notificación (BD + socket + web push) al vendedor asignado
async function notificarVendedor(req, leadId, vendedorId, clienteNombre, detalle) {
  if (!vendedorId) return;

  const titulo = 'Nueva posible venta asignada';
  const mensaje = `${clienteNombre}${detalle ? ` · ${detalle}` : ''} — te fue asignada una posible venta.`;

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
      `${clienteNombre}${detalle ? ` · ${detalle}` : ''} — posible venta asignada.`,
      { url: '/posibles-ventas' }
    ).catch((err) => console.error('[WebPush] Error enviando push posible venta:', err));
  } catch (err) {
    console.error('[PosiblesVentas] Error al notificar vendedor:', err.message || err);
  }
}

// ─── GET /api/posibles-ventas ───
// Admin ve todas; recepcionista ve las que registró; vendedor ve las asignadas a él.
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
      `SELECT pv.*,
              v.nombre AS vendedor_nombre,
              c.nombre AS creado_por_nombre
       FROM posibles_ventas pv
       LEFT JOIN usuarios v ON v.id = pv.vendedor_id
       LEFT JOIN usuarios c ON c.id = pv.creado_por_id
       ${where}
       ORDER BY pv.creado_en DESC, pv.id DESC`,
      params
    );

    res.json(rows.map(buildLead));
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/posibles-ventas/:id ───
// Usado para prellenar el formulario de reserva al convertir una posible venta.
export async function getPosibleVenta(req, res, next) {
  try {
    const { id } = req.params;
    const userId = String(req.user?.id || '');
    const rol = normalizeRole(req.user?.rol);

    const [rows] = await pool.query(
      `SELECT pv.*,
              v.nombre AS vendedor_nombre,
              c.nombre AS creado_por_nombre
       FROM posibles_ventas pv
       LEFT JOIN usuarios v ON v.id = pv.vendedor_id
       LEFT JOIN usuarios c ON c.id = pv.creado_por_id
       WHERE pv.id = ? AND pv.deleted_at IS NULL`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Posible venta no encontrada' });
    }
    const lead = rows[0];

    // Mismas reglas de visibilidad que el listado
    if (rol === 'vendedor' && String(lead.vendedor_id || '') !== userId) {
      return res.status(403).json({ message: 'No tienes permiso para ver esta posible venta' });
    }
    if ((rol === 'frontoffice' || rol === 'recepcionista') && String(lead.creado_por_id || '') !== userId) {
      return res.status(403).json({ message: 'No tienes permiso para ver esta posible venta' });
    }

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
export async function updatePosibleVenta(req, res, next) {
  try {
    const { id } = req.params;
    const userId = String(req.user?.id || '');
    const rol = normalizeRole(req.user?.rol);

    const [rows] = await pool.query('SELECT * FROM posibles_ventas WHERE id = ? AND deleted_at IS NULL', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Posible venta no encontrada' });
    }
    const lead = rows[0];

    // Permisos:
    // - Admin: todo
    // - Recepcionista: solo las que registró
    // - Vendedor: solo el estado de las asignadas a él
    const isAdmin = rol === 'admin';
    const isReception = rol === 'frontoffice' || rol === 'recepcionista';
    const isVendedor = rol === 'vendedor';
    const isOwner = String(lead.creado_por_id || '') === userId;
    const isAssigned = String(lead.vendedor_id || '') === userId;

    if (isAdmin) {
      // puede todo
    } else if (isReception) {
      if (!isOwner) {
        return res.status(403).json({ message: 'No tienes permiso para modificar esta posible venta' });
      }
    } else if (isVendedor) {
      if (!isAssigned) {
        return res.status(403).json({ message: 'No tienes permiso para modificar esta posible venta' });
      }
    } else {
      return res.status(403).json({ message: 'No tienes permiso para modificar esta posible venta' });
    }

    const body = req.body || {};
    const updates = [];
    const params = [];
    let vendedorIdAnterior = String(lead.vendedor_id || '');

    // El vendedor solo puede cambiar el estado; recepción/admin pueden editar el resto.
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
      // Cambio de vendedor: admin o recepción dueña pueden reasignar
      if (body.vendedorId !== undefined) {
        const nuevoVendedor = String(body.vendedorId || '').trim() || null;
        updates.push('vendedor_id = ?');
        params.push(nuevoVendedor);
      }
    }

    const estadoNuevo = body.estado !== undefined ? String(body.estado || '').trim().toLowerCase() : null;
    if (estadoNuevo && !ESTADOS_VALIDOS.has(estadoNuevo)) {
      return res.status(400).json({ message: `Estado inválido: ${body.estado}` });
    }
    if (estadoNuevo) {
      updates.push('estado = ?');
      params.push(estadoNuevo);
      // ultima actividad del vendedor (se actualiza en cada cambio)
      updates.push('ultimo_seguimiento_en = NOW()');
      // primer seguimiento: solo se setea si estaba NULL (no se sobreescribe)
      // Sirve para medir "tiempo de respuesta" real: creadoEn → primerSeg
      updates.push('primer_seguimiento_en = COALESCE(primer_seguimiento_en, NOW())');
    }

    // Enlace a la reserva creada: lo setea el flujo de conversión (cualquier rol autorizado)
    if (body.eventoId !== undefined) {
      updates.push('evento_id = ?');
      params.push(String(body.eventoId || '').trim() || null);
    }

    if (updates.length === 0) {
      return res.json({ ok: true });
    }

    params.push(id);
    await pool.query(
      `UPDATE posibles_ventas SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

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
// Soft delete: marca deleted_at y guarda snapshot en la bitácora para poder restaurar.
export async function deletePosibleVenta(req, res, next) {
  try {
    const { id } = req.params;
    const userId = String(req.user?.id || '');
    const rol = normalizeRole(req.user?.rol);

    const [rows] = await pool.query('SELECT * FROM posibles_ventas WHERE id = ? AND deleted_at IS NULL', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Posible venta no encontrada' });
    }
    const lead = rows[0];

    const isAdmin = rol === 'admin';
    const isOwner = String(lead.creado_por_id || '') === userId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar esta posible venta' });
    }

    const actor = { id: req.user?.id, nombre: req.user?.nombre || req.user?.fullName || req.user?.name };
    const actorId = String(actor.id || userId || '');
    const actorNombre = actor.nombre || null;

    // 1) Marcar como eliminado
    await pool.query(
      `UPDATE posibles_ventas
         SET deleted_at = CURRENT_TIMESTAMP,
             deleted_por_id = ?,
             deleted_por_nombre = ?
       WHERE id = ?`,
      [actorId, actorNombre, id]
    );

    // 2) Bitácora con snapshot completo
    await logHistorial({
      idPosibleVenta: id,
      accion: 'deleted',
      actor: { id: actorId, nombre: actorNombre },
      snapshot: lead,
      detalle: `Eliminada por ${actorNombre || actorId}`,
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/posibles-ventas/eliminadas ───
// Solo admin: lista las posibles ventas eliminadas (soft delete), más recientes primero.
export async function getEliminadas(req, res, next) {
  try {
    if (!requireAdmin(req, res)) return;

    const [rows] = await pool.query(
      `SELECT pv.*,
              v.nombre AS vendedor_nombre,
              c.nombre AS creado_por_nombre
       FROM posibles_ventas pv
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
// Solo admin: revierte el soft delete y deja registro en la bitácora.
export async function restorePosibleVenta(req, res, next) {
  try {
    if (!requireAdmin(req, res)) return;

    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM posibles_ventas WHERE id = ? AND deleted_at IS NOT NULL', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Posible venta eliminada no encontrada' });
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
      detalle: `Restaurada por ${actor.nombre || actor.id}`,
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
