import pool from '../config/db.js';
import { emitChange } from '../helpers/socketEvents.js';

function toSafeString(val) {
  return val === undefined || val === null ? '' : String(val).trim();
}

function calculateNoches(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 1;
  const inDate = new Date(checkIn + 'T00:00:00');
  const outDate = new Date(checkOut + 'T00:00:00');
  const diffTime = outDate.getTime() - inDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, Number.isNaN(diffDays) ? 1 : diffDays);
}

/**
 * Resuelve o crea una empresa al vuelo solo con el nombre en la tabla `empresas`.
 */
async function resolveOrCreateCompany(conn, companyName, existingCompanyId = null) {
  const name = toSafeString(companyName);
  if (!name) return { id: null, name: null };

  if (existingCompanyId) {
    const [foundById] = await conn.query('SELECT id, nombre FROM empresas WHERE id = ?', [existingCompanyId]);
    if (foundById && foundById.length > 0) {
      return { id: foundById[0].id, name: foundById[0].nombre || name };
    }
  }

  // Buscar por nombre exacto (case-insensitive)
  const [foundByName] = await conn.query('SELECT id, nombre FROM empresas WHERE LOWER(nombre) = LOWER(?) LIMIT 1', [name]);
  if (foundByName && foundByName.length > 0) {
    return { id: foundByName[0].id, name: foundByName[0].nombre };
  }

  // Crear empresa al vuelo
  const newId = `emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await conn.query(
    'INSERT INTO empresas (id, nombre, creado_en) VALUES (?, ?, CURRENT_TIMESTAMP)',
    [newId, name]
  );
  return { id: newId, name };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLADOR DE RESERVAS DE HABITACIONES
// ─────────────────────────────────────────────────────────────────────────────

export async function getHabitaciones(req, res) {
  let conn;
  try {
    conn = await pool.getConnection();
    const { mes, desde, hasta, vendedor, estado, tipo_habitacion, search } = req.query;

    const conditions = [];
    const params = [];

    if (mes) {
      conditions.push('(DATE_FORMAT(fecha_check_in, "%Y-%m") = ? OR DATE_FORMAT(fecha_check_out, "%Y-%m") = ?)');
      params.push(mes, mes);
    }

    if (desde && hasta) {
      conditions.push('(fecha_check_in <= ? AND fecha_check_out >= ?)');
      params.push(hasta, desde);
    } else if (desde) {
      conditions.push('fecha_check_out >= ?');
      params.push(desde);
    } else if (hasta) {
      conditions.push('fecha_check_in <= ?');
      params.push(hasta);
    }

    if (vendedor) {
      conditions.push('id_vendedor = ?');
      params.push(vendedor);
    }

    if (estado) {
      conditions.push('LOWER(estado) = LOWER(?)');
      params.push(estado);
    }

    if (tipo_habitacion) {
      conditions.push('id_tipo_habitacion = ?');
      params.push(tipo_habitacion);
    }

    if (search) {
      const q = `%${search.trim()}%`;
      conditions.push('(nombre_huesped LIKE ? OR telefono LIKE ? OR correo LIKE ? OR no_folio LIKE ? OR empresa_nombre LIKE ?)');
      params.push(q, q, q, q, q);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        id,
        nombre_huesped,
        telefono,
        correo,
        id_vendedor,
        vendedor_nombre,
        id_medio_contacto,
        medio_contacto_nombre,
        DATE_FORMAT(fecha_check_in, '%Y-%m-%d') as fecha_check_in,
        DATE_FORMAT(fecha_check_out, '%Y-%m-%d') as fecha_check_out,
        noches,
        cantidad_habitaciones,
        no_folio,
        id_tipo_cliente,
        tipo_cliente_nombre,
        id_tipo_habitacion,
        tipo_habitacion_nombre,
        modulo,
        tarifa_diaria,
        monto_total,
        id_empresa,
        empresa_nombre,
        id_forma_pago,
        forma_pago_nombre,
        estado,
        observaciones,
        ultimo_contacto,
        ultimo_contacto_tipo,
        creado_por,
        creado_en,
        actualizado_en
      FROM habitacion_reservas
      ${whereClause}
      ORDER BY fecha_check_in DESC, creado_en DESC
    `;

    const [rows] = await conn.query(query, params);

    // Totales calculados
    let totalNoches = 0;
    let totalHabitaciones = 0;
    let totalMonto = 0;
    for (const r of rows) {
      totalNoches += Number(r.noches || 0);
      totalHabitaciones += Number(r.cantidad_habitaciones || 0);
      if (String(r.estado || '').toLowerCase() !== 'cancelada') {
        totalMonto += Number(r.monto_total || 0);
      }
    }

    return res.json({
      reservas: rows,
      totalCount: rows.length,
      metricas: {
        totalReservas: rows.length,
        totalNoches,
        totalHabitaciones,
        totalMonto
      }
    });
  } catch (error) {
    console.error('[habitacionesController.getHabitaciones] Error:', error);
    return res.status(500).json({ message: 'Error al consultar reservas de habitaciones', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}

export async function getHabitacion(req, res) {
  let conn;
  try {
    const { id } = req.params;
    conn = await pool.getConnection();

    const [rows] = await conn.query(
      `SELECT 
        id,
        nombre_huesped,
        telefono,
        correo,
        id_vendedor,
        vendedor_nombre,
        id_medio_contacto,
        medio_contacto_nombre,
        DATE_FORMAT(fecha_check_in, '%Y-%m-%d') as fecha_check_in,
        DATE_FORMAT(fecha_check_out, '%Y-%m-%d') as fecha_check_out,
        noches,
        cantidad_habitaciones,
        no_folio,
        id_tipo_cliente,
        tipo_cliente_nombre,
        id_tipo_habitacion,
        tipo_habitacion_nombre,
        modulo,
        tarifa_diaria,
        monto_total,
        id_empresa,
        empresa_nombre,
        id_forma_pago,
        forma_pago_nombre,
        estado,
        observaciones,
        ultimo_contacto,
        ultimo_contacto_tipo,
        creado_por,
        creado_en,
        actualizado_en
      FROM habitacion_reservas WHERE id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Reserva de habitación no encontrada' });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error('[habitacionesController.getHabitacion] Error:', error);
    return res.status(500).json({ message: 'Error al consultar reserva', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}

export async function createHabitacion(req, res) {
  let conn;
  try {
    const b = req.body || {};
    const nombreHuesped = toSafeString(b.nombre_huesped);
    const checkIn = toSafeString(b.fecha_check_in);
    const checkOut = toSafeString(b.fecha_check_out);

    if (!nombreHuesped) {
      return res.status(400).json({ message: 'El nombre del huésped es obligatorio' });
    }
    if (!checkIn || !checkOut) {
      return res.status(400).json({ message: 'Las fechas de check-in y check-out son obligatorias' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Manejo de empresa al vuelo
    const { id: finalEmpresaId, name: finalEmpresaNombre } = await resolveOrCreateCompany(
      conn,
      b.empresa_nombre,
      b.id_empresa
    );

    // 2. Cálculo de noches
    const calculatedNoches = calculateNoches(checkIn, checkOut);
    const noches = Number(b.noches) > 0 ? Number(b.noches) : calculatedNoches;
    const cantidadHabitaciones = Math.max(1, Number(b.cantidad_habitaciones || 1));
    const tarifaDiaria = Number(b.tarifa_diaria || 0);

    // 3. Monto total (fórmula automática o sobreescritura manual)
    let montoTotal = 0;
    if (b.monto_total !== undefined && b.monto_total !== null && b.monto_total !== '') {
      montoTotal = Math.max(0, Number(b.monto_total));
    } else {
      montoTotal = noches * cantidadHabitaciones * tarifaDiaria;
    }

    const id = b.id || `hab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const creadoPor = req.user?.id || req.user?.name || 'sistema';

    await conn.query(
      `INSERT INTO habitacion_reservas (
        id, nombre_huesped, telefono, correo, id_vendedor, vendedor_nombre,
        id_medio_contacto, medio_contacto_nombre, fecha_check_in, fecha_check_out,
        noches, cantidad_habitaciones, no_folio, id_tipo_cliente,
        tipo_cliente_nombre, id_tipo_habitacion, tipo_habitacion_nombre,
        modulo, tarifa_diaria, monto_total, id_empresa, empresa_nombre,
        id_forma_pago, forma_pago_nombre, estado, observaciones,
        ultimo_contacto, ultimo_contacto_tipo, creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        nombreHuesped,
        toSafeString(b.telefono) || null,
        toSafeString(b.correo) || null,
        toSafeString(b.id_vendedor) || null,
        toSafeString(b.vendedor_nombre) || null,
        toSafeString(b.id_medio_contacto) || null,
        toSafeString(b.medio_contacto_nombre) || null,
        checkIn,
        checkOut,
        noches,
        cantidadHabitaciones,
        toSafeString(b.no_folio) || null,
        toSafeString(b.id_tipo_cliente) || null,
        toSafeString(b.tipo_cliente_nombre) || null,
        toSafeString(b.id_tipo_habitacion) || null,
        toSafeString(b.tipo_habitacion_nombre) || null,
        toSafeString(b.modulo) || null,
        tarifaDiaria,
        montoTotal,
        finalEmpresaId,
        finalEmpresaNombre,
        toSafeString(b.id_forma_pago) || null,
        toSafeString(b.forma_pago_nombre) || null,
        toSafeString(b.estado) || 'Confirmada',
        toSafeString(b.observaciones) || null,
        b.ultimo_contacto || null,
        toSafeString(b.ultimo_contacto_tipo) || null,
        creadoPor
      ]
    );

    await conn.commit();

    emitChange(req, 'habitaciones', 'created', { id, nombre_huesped: nombreHuesped });

    return res.status(201).json({
      message: 'Reserva de habitación registrada exitosamente',
      id,
      reserva: {
        id,
        nombre_huesped: nombreHuesped,
        fecha_check_in: checkIn,
        fecha_check_out: checkOut,
        noches,
        cantidad_habitaciones: cantidadHabitaciones,
        tarifa_diaria: tarifaDiaria,
        monto_total: montoTotal,
        id_empresa: finalEmpresaId,
        empresa_nombre: finalEmpresaNombre
      }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('[habitacionesController.createHabitacion] Error:', error);
    return res.status(500).json({ message: 'Error al registrar reserva de habitación', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}

export async function updateHabitacion(req, res) {
  let conn;
  try {
    const { id } = req.params;
    const b = req.body || {};

    conn = await pool.getConnection();

    const [existing] = await conn.query('SELECT * FROM habitacion_reservas WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ message: 'Reserva de habitación no encontrada' });
    }
    const current = existing[0];

    await conn.beginTransaction();

    const checkIn = b.fecha_check_in !== undefined ? toSafeString(b.fecha_check_in) : current.fecha_check_in;
    const checkOut = b.fecha_check_out !== undefined ? toSafeString(b.fecha_check_out) : current.fecha_check_out;
    const calculatedNoches = calculateNoches(checkIn, checkOut);
    const noches = b.noches !== undefined ? Number(b.noches) : calculatedNoches;
    const cantidadHabitaciones = b.cantidad_habitaciones !== undefined ? Math.max(1, Number(b.cantidad_habitaciones)) : current.cantidad_habitaciones;
    const tarifaDiaria = b.tarifa_diaria !== undefined ? Number(b.tarifa_diaria) : current.tarifa_diaria;

    let montoTotal = current.monto_total;
    if (b.monto_total !== undefined && b.monto_total !== null && b.monto_total !== '') {
      montoTotal = Math.max(0, Number(b.monto_total));
    } else if (b.noches !== undefined || b.cantidad_habitaciones !== undefined || b.tarifa_diaria !== undefined) {
      montoTotal = noches * cantidadHabitaciones * tarifaDiaria;
    }

    let finalEmpresaId = current.id_empresa;
    let finalEmpresaNombre = current.empresa_nombre;
    if (b.empresa_nombre !== undefined || b.id_empresa !== undefined) {
      const resolved = await resolveOrCreateCompany(
        conn,
        b.empresa_nombre !== undefined ? b.empresa_nombre : current.empresa_nombre,
        b.id_empresa !== undefined ? b.id_empresa : current.id_empresa
      );
      finalEmpresaId = resolved.id;
      finalEmpresaNombre = resolved.name;
    }

    await conn.query(
      `UPDATE habitacion_reservas SET
        nombre_huesped = ?,
        telefono = ?,
        correo = ?,
        id_vendedor = ?,
        vendedor_nombre = ?,
        id_medio_contacto = ?,
        medio_contacto_nombre = ?,
        fecha_check_in = ?,
        fecha_check_out = ?,
        noches = ?,
        cantidad_habitaciones = ?,
        no_folio = ?,
        id_tipo_cliente = ?,
        tipo_cliente_nombre = ?,
        id_tipo_habitacion = ?,
        tipo_habitacion_nombre = ?,
        modulo = ?,
        tarifa_diaria = ?,
        monto_total = ?,
        id_empresa = ?,
        empresa_nombre = ?,
        id_forma_pago = ?,
        forma_pago_nombre = ?,
        estado = ?,
        observaciones = ?,
        ultimo_contacto = COALESCE(?, ultimo_contacto),
        ultimo_contacto_tipo = COALESCE(?, ultimo_contacto_tipo),
        actualizado_en = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        b.nombre_huesped !== undefined ? toSafeString(b.nombre_huesped) : current.nombre_huesped,
        b.telefono !== undefined ? toSafeString(b.telefono) || null : current.telefono,
        b.correo !== undefined ? toSafeString(b.correo) || null : current.correo,
        b.id_vendedor !== undefined ? toSafeString(b.id_vendedor) || null : current.id_vendedor,
        b.vendedor_nombre !== undefined ? toSafeString(b.vendedor_nombre) || null : current.vendedor_nombre,
        b.id_medio_contacto !== undefined ? toSafeString(b.id_medio_contacto) || null : current.id_medio_contacto,
        b.medio_contacto_nombre !== undefined ? toSafeString(b.medio_contacto_nombre) || null : current.medio_contacto_nombre,
        checkIn,
        checkOut,
        noches,
        cantidadHabitaciones,
        b.no_folio !== undefined ? toSafeString(b.no_folio) || null : current.no_folio,
        b.id_tipo_cliente !== undefined ? toSafeString(b.id_tipo_cliente) || null : current.id_tipo_cliente,
        b.tipo_cliente_nombre !== undefined ? toSafeString(b.tipo_cliente_nombre) || null : current.tipo_cliente_nombre,
        b.id_tipo_habitacion !== undefined ? toSafeString(b.id_tipo_habitacion) || null : current.id_tipo_habitacion,
        b.tipo_habitacion_nombre !== undefined ? toSafeString(b.tipo_habitacion_nombre) || null : current.tipo_habitacion_nombre,
        b.modulo !== undefined ? toSafeString(b.modulo) || null : current.modulo,
        tarifaDiaria,
        montoTotal,
        finalEmpresaId,
        finalEmpresaNombre,
        b.id_forma_pago !== undefined ? toSafeString(b.id_forma_pago) || null : current.id_forma_pago,
        b.forma_pago_nombre !== undefined ? toSafeString(b.forma_pago_nombre) || null : current.forma_pago_nombre,
        b.estado !== undefined ? toSafeString(b.estado) || 'Confirmada' : current.estado,
        b.observaciones !== undefined ? toSafeString(b.observaciones) || null : current.observaciones,
        b.ultimo_contacto !== undefined ? b.ultimo_contacto : null,
        b.ultimo_contacto_tipo !== undefined ? toSafeString(b.ultimo_contacto_tipo) || null : null,
        id
      ]
    );

    await conn.commit();

    emitChange(req, 'habitaciones', 'updated', { id });

    return res.json({ message: 'Reserva actualizada exitosamente', id });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('[habitacionesController.updateHabitacion] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar reserva', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}

export async function deleteHabitacion(req, res) {
  let conn;
  try {
    const { id } = req.params;
    const isHard = req.query.hard === 'true' || req.query.force === 'true';

    conn = await pool.getConnection();

    if (isHard) {
      await conn.query('DELETE FROM habitacion_reservas WHERE id = ?', [id]);
    } else {
      await conn.query('UPDATE habitacion_reservas SET estado = "Cancelada" WHERE id = ?', [id]);
    }

    emitChange(req, 'habitaciones', isHard ? 'deleted' : 'cancelled', { id });

    return res.json({ message: isHard ? 'Reserva eliminada permanentemente' : 'Reserva cancelada exitosamente', id });
  } catch (error) {
    console.error('[habitacionesController.deleteHabitacion] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar reserva', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}

export async function registrarContacto(req, res) {
  let conn;
  try {
    const { id } = req.params;
    const { tipo } = req.body;
    const medio = toSafeString(tipo) || 'WhatsApp';

    conn = await pool.getConnection();

    await conn.query(
      `UPDATE habitacion_reservas 
       SET ultimo_contacto = CURRENT_TIMESTAMP, ultimo_contacto_tipo = ?
       WHERE id = ?`,
      [medio, id]
    );

    emitChange(req, 'habitaciones', 'contacted', { id, medio });

    return res.json({ message: 'Interacción de contacto registrada exitosamente', id, medio, timestamp: new Date() });
  } catch (error) {
    console.error('[habitacionesController.registrarContacto] Error:', error);
    return res.status(500).json({ message: 'Error al registrar contacto', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTORIO INTELIGENTE DE HUÉSPEDES Y BÚSQUEDA DE HISTORIAL
// ─────────────────────────────────────────────────────────────────────────────

export async function getHuespedHistorial(req, res) {
  let conn;
  try {
    const query = toSafeString(req.query.query || req.query.telefono || req.query.correo || req.query.q);
    if (!query) {
      return res.json({ totalEstancias: 0, esFrecuente: false, estancias: [] });
    }

    conn = await pool.getConnection();

    const [rows] = await conn.query(
      `SELECT 
        id,
        nombre_huesped,
        telefono,
        correo,
        id_empresa,
        empresa_nombre,
        DATE_FORMAT(fecha_check_in, '%Y-%m-%d') as fecha_check_in,
        DATE_FORMAT(fecha_check_out, '%Y-%m-%d') as fecha_check_out,
        noches,
        cantidad_habitaciones,
        tipo_habitacion_nombre,
        monto_total,
        no_folio,
        estado
       FROM habitacion_reservas
       WHERE (telefono = ? OR correo = ? OR nombre_huesped = ? OR telefono LIKE ? OR correo LIKE ?)
         AND estado != 'Cancelada'
       ORDER BY fecha_check_in DESC`,
      [query, query, query, `%${query}%`, `%${query}%`]
    );

    const totalEstancias = rows.length;
    let totalNoches = 0;
    let totalGastado = 0;

    for (const r of rows) {
      totalNoches += Number(r.noches || 0);
      totalGastado += Number(r.monto_total || 0);
    }

    const firstRow = rows[0] || {};

    return res.json({
      huesped: {
        nombre: firstRow.nombre_huesped || null,
        telefono: firstRow.telefono || null,
        correo: firstRow.correo || null,
        id_empresa: firstRow.id_empresa || null,
        empresa_nombre: firstRow.empresa_nombre || null
      },
      totalEstancias,
      totalNoches,
      totalGastado,
      esFrecuente: totalEstancias > 1,
      estancias: rows
    });
  } catch (error) {
    console.error('[habitacionesController.getHuespedHistorial] Error:', error);
    return res.status(500).json({ message: 'Error al consultar historial del huésped', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGOS DINÁMICOS DE HABITACIONES
// ─────────────────────────────────────────────────────────────────────────────

export async function getCatalogos(req, res) {
  let conn;
  try {
    const { categoria } = req.params;
    conn = await pool.getConnection();

    let usageSubquery = '0';
    if (categoria === 'tipos_habitacion') {
      usageSubquery = '(SELECT COUNT(*) FROM habitacion_reservas r WHERE r.id_tipo_habitacion = c.id OR r.tipo_habitacion_nombre = c.nombre)';
    } else if (categoria === 'medios_contacto') {
      usageSubquery = '(SELECT COUNT(*) FROM habitacion_reservas r WHERE r.id_medio_contacto = c.id OR r.medio_contacto_nombre = c.nombre)';
    } else if (categoria === 'tipos_cliente') {
      usageSubquery = '(SELECT COUNT(*) FROM habitacion_reservas r WHERE r.id_tipo_cliente = c.id OR r.tipo_cliente_nombre = c.nombre)';
    } else if (categoria === 'formas_pago') {
      usageSubquery = '(SELECT COUNT(*) FROM habitacion_reservas r WHERE r.id_forma_pago = c.id OR r.forma_pago_nombre = c.nombre)';
    } else if (categoria === 'modulos') {
      usageSubquery = '(SELECT COUNT(*) FROM habitacion_reservas r WHERE r.modulo = c.nombre OR r.modulo = c.id)';
    }

    const [rows] = await conn.query(
      `SELECT c.*, ${usageSubquery} AS usage_count
       FROM habitacion_catalogos c
       WHERE c.categoria = ? AND c.activo = 1 
       ORDER BY c.orden ASC, c.nombre ASC`,
      [categoria]
    );

    return res.json(rows);
  } catch (error) {
    console.error('[habitacionesController.getCatalogos] Error:', error);
    return res.status(500).json({ message: 'Error al consultar catálogo', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}


export async function createCatalogoItem(req, res) {
  let conn;
  try {
    const { categoria } = req.params;
    if (categoria === 'upload-imagen') {
      return uploadPromocionImagen(req, res);
    }
    const b = req.body || {};
    const nombre = toSafeString(b.nombre);

    if (!nombre) {
      return res.status(400).json({ message: 'El nombre del elemento es requerido' });
    }

    conn = await pool.getConnection();
    const id = b.id || `cat_${categoria.substring(0, 3)}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    await conn.query(
      `INSERT INTO habitacion_catalogos (
        id, categoria, nombre, descripcion, tipo_plantilla, tarifa_base,
        plantilla_whatsapp, plantilla_correo_asunto, plantilla_correo_cuerpo,
        imagen_url, activo, orden
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        categoria,
        nombre,
        toSafeString(b.descripcion) || null,
        toSafeString(b.tipo_plantilla) || 'confirmacion',
        Number(b.tarifa_base || 0),
        toSafeString(b.plantilla_whatsapp) || null,
        toSafeString(b.plantilla_correo_asunto) || null,
        toSafeString(b.plantilla_correo_cuerpo) || null,
        toSafeString(b.imagen_url) || null,
        b.activo === false || b.activo === 0 ? 0 : 1,
        Number(b.orden || 0)
      ]
    );

    emitChange(req, 'habitaciones', 'catalog_created', { id, categoria, nombre });

    return res.status(201).json({ message: 'Elemento agregado al catálogo', id, categoria });
  } catch (error) {
    console.error('[habitacionesController.createCatalogoItem] Error:', error);
    return res.status(500).json({ message: 'Error al crear elemento de catálogo', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}

export async function updateCatalogoItem(req, res) {
  let conn;
  try {
    const { categoria, id } = req.params;
    const b = req.body || {};

    conn = await pool.getConnection();

    await conn.query(
      `UPDATE habitacion_catalogos SET
        nombre = COALESCE(?, nombre),
        descripcion = ?,
        tipo_plantilla = COALESCE(?, tipo_plantilla),
        tarifa_base = COALESCE(?, tarifa_base),
        plantilla_whatsapp = ?,
        plantilla_correo_asunto = ?,
        plantilla_correo_cuerpo = ?,
        imagen_url = ?,
        activo = COALESCE(?, activo),
        orden = COALESCE(?, orden),
        actualizado_en = CURRENT_TIMESTAMP
       WHERE id = ? AND categoria = ?`,
      [
        b.nombre !== undefined ? toSafeString(b.nombre) : null,
        b.descripcion !== undefined ? toSafeString(b.descripcion) || null : null,
        b.tipo_plantilla !== undefined ? toSafeString(b.tipo_plantilla) || 'confirmacion' : null,
        b.tarifa_base !== undefined ? Number(b.tarifa_base) : null,
        b.plantilla_whatsapp !== undefined ? toSafeString(b.plantilla_whatsapp) || null : null,
        b.plantilla_correo_asunto !== undefined ? toSafeString(b.plantilla_correo_asunto) || null : null,
        b.plantilla_correo_cuerpo !== undefined ? toSafeString(b.plantilla_correo_cuerpo) || null : null,
        b.imagen_url !== undefined ? toSafeString(b.imagen_url) || null : null,
        b.activo !== undefined ? (b.activo ? 1 : 0) : null,
        b.orden !== undefined ? Number(b.orden) : null,
        id,
        categoria
      ]
    );

    emitChange(req, 'habitaciones', 'catalog_updated', { id, categoria });

    return res.json({ message: 'Elemento de catálogo actualizado', id });
  } catch (error) {
    console.error('[habitacionesController.updateCatalogoItem] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar elemento de catálogo', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}

export async function getCatalogoItemUsage(req, res) {
  let conn;
  try {
    const { categoria, id } = req.params;
    conn = await pool.getConnection();

    const [itemRows] = await conn.query('SELECT * FROM habitacion_catalogos WHERE id = ? AND categoria = ?', [id, categoria]);
    if (!itemRows || itemRows.length === 0) {
      return res.status(404).json({ message: 'Elemento no encontrado' });
    }
    const item = itemRows[0];

    let usageCount = 0;
    if (categoria === 'tipos_habitacion') {
      const [u] = await conn.query(
        'SELECT COUNT(*) as count FROM habitacion_reservas WHERE id_tipo_habitacion = ? OR tipo_habitacion_nombre = ?',
        [id, item.nombre]
      );
      usageCount = Number(u[0]?.count || 0);
    } else if (categoria === 'medios_contacto') {
      const [u] = await conn.query(
        'SELECT COUNT(*) as count FROM habitacion_reservas WHERE id_medio_contacto = ? OR medio_contacto_nombre = ?',
        [id, item.nombre]
      );
      usageCount = Number(u[0]?.count || 0);
    } else if (categoria === 'tipos_cliente') {
      const [u] = await conn.query(
        'SELECT COUNT(*) as count FROM habitacion_reservas WHERE id_tipo_cliente = ? OR tipo_cliente_nombre = ?',
        [id, item.nombre]
      );
      usageCount = Number(u[0]?.count || 0);
    } else if (categoria === 'formas_pago') {
      const [u] = await conn.query(
        'SELECT COUNT(*) as count FROM habitacion_reservas WHERE id_forma_pago = ? OR forma_pago_nombre = ?',
        [id, item.nombre]
      );
      usageCount = Number(u[0]?.count || 0);
    } else if (categoria === 'modulos') {
      const [u] = await conn.query(
        'SELECT COUNT(*) as count FROM habitacion_reservas WHERE modulo = ? OR modulo = ?',
        [id, item.nombre]
      );
      usageCount = Number(u[0]?.count || 0);
    }

    return res.json({
      id: item.id,
      nombre: item.nombre,
      categoria,
      usageCount,
      canDelete: usageCount === 0
    });
  } catch (error) {
    console.error('[habitacionesController.getCatalogoItemUsage] Error:', error);
    return res.status(500).json({ message: 'Error consultando uso del elemento', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}

export async function deleteCatalogoItem(req, res) {
  let conn;
  try {
    const { categoria, id } = req.params;
    conn = await pool.getConnection();

    const [itemRows] = await conn.query('SELECT * FROM habitacion_catalogos WHERE id = ? AND categoria = ?', [id, categoria]);
    if (!itemRows || itemRows.length === 0) {
      return res.status(404).json({ message: 'Elemento de catálogo no encontrado' });
    }
    const item = itemRows[0];

    // Verificar si está en uso en habitacion_reservas para proteger la integridad de datos
    let usageCount = 0;
    if (categoria === 'tipos_habitacion') {
      const [u] = await conn.query('SELECT COUNT(*) as count FROM habitacion_reservas WHERE id_tipo_habitacion = ? OR tipo_habitacion_nombre = ?', [id, item.nombre]);
      usageCount = Number(u[0]?.count || 0);
    } else if (categoria === 'medios_contacto') {
      const [u] = await conn.query('SELECT COUNT(*) as count FROM habitacion_reservas WHERE id_medio_contacto = ? OR medio_contacto_nombre = ?', [id, item.nombre]);
      usageCount = Number(u[0]?.count || 0);
    } else if (categoria === 'tipos_cliente') {
      const [u] = await conn.query('SELECT COUNT(*) as count FROM habitacion_reservas WHERE id_tipo_cliente = ? OR tipo_cliente_nombre = ?', [id, item.nombre]);
      usageCount = Number(u[0]?.count || 0);
    } else if (categoria === 'formas_pago') {
      const [u] = await conn.query('SELECT COUNT(*) as count FROM habitacion_reservas WHERE id_forma_pago = ? OR forma_pago_nombre = ?', [id, item.nombre]);
      usageCount = Number(u[0]?.count || 0);
    } else if (categoria === 'modulos') {
      const [u] = await conn.query('SELECT COUNT(*) as count FROM habitacion_reservas WHERE modulo = ? OR modulo = ?', [id, item.nombre]);
      usageCount = Number(u[0]?.count || 0);
    }

    if (usageCount > 0) {
      return res.status(409).json({
        message: `No es posible eliminar "${item.nombre}" porque está vinculado a ${usageCount} reserva(s) de habitación. Para proteger la integridad de los datos, los registros en uso no pueden ser eliminados.`,
        usageCount,
        id,
        nombre: item.nombre
      });
    }

    // Si no está en uso en reservas, desactivar
    await conn.query(
      'UPDATE habitacion_catalogos SET activo = 0 WHERE id = ? AND categoria = ?',
      [id, categoria]
    );

    emitChange(req, 'habitaciones', 'catalog_deleted', { id, categoria, nombre: item.nombre });

    return res.json({ message: `Elemento "${item.nombre}" eliminado exitosamente`, id, usageCount: 0 });
  } catch (error) {
    console.error('[habitacionesController.deleteCatalogoItem] Error:', error);
    return res.status(500).json({ message: 'Error al desactivar elemento de catálogo', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// METAS COMERCIALES DE HABITACIONES
// ─────────────────────────────────────────────────────────────────────────────

export async function getMetas(req, res) {
  let conn;
  try {
    const mes = toSafeString(req.query.mes);
    conn = await pool.getConnection();

    let query = 'SELECT * FROM habitacion_metas';
    const params = [];
    if (mes) {
      query += ' WHERE mes = ?';
      params.push(mes);
    }

    const [rows] = await conn.query(query, params);

    const globalMeta = rows.find(r => !r.id_usuario);
    const vendedoresMetas = rows.filter(r => Boolean(r.id_usuario));

    return res.json({
      mes: mes || null,
      globalMonto: globalMeta ? Number(globalMeta.monto) : 0,
      vendedores: vendedoresMetas.map(v => ({
        id_usuario: v.id_usuario,
        monto: Number(v.monto)
      })),
      todas: rows
    });
  } catch (error) {
    console.error('[habitacionesController.getMetas] Error:', error);
    return res.status(500).json({ message: 'Error al obtener metas de habitaciones', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}

export async function updateMetas(req, res) {
  let conn;
  try {
    const { mes, globalMonto, vendedoresMetas } = req.body;
    if (!mes) {
      return res.status(400).json({ message: 'El mes (YYYY-MM) es requerido' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Meta Global de habitaciones (id_usuario = NULL)
    if (globalMonto !== undefined) {
      const globalId = `meta_hab_glob_${mes}`;
      await conn.query(
        `INSERT INTO habitacion_metas (id, mes, id_usuario, monto)
         VALUES (?, ?, NULL, ?)
         ON DUPLICATE KEY UPDATE monto = VALUES(monto), actualizado_en = CURRENT_TIMESTAMP`,
        [globalId, mes, Number(globalMonto || 0)]
      );
    }

    // 2. Metas por vendedor
    if (Array.isArray(vendedoresMetas)) {
      for (const vm of vendedoresMetas) {
        if (!vm.id_usuario) continue;
        const metaId = `meta_hab_${mes}_${vm.id_usuario}`;
        await conn.query(
          `INSERT INTO habitacion_metas (id, mes, id_usuario, monto)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE monto = VALUES(monto), actualizado_en = CURRENT_TIMESTAMP`,
          [metaId, mes, vm.id_usuario, Number(vm.monto || 0)]
        );
      }
    }

    await conn.commit();
    emitChange(req, 'habitaciones', 'metas_updated', { mes });

    return res.json({ message: 'Metas de habitaciones actualizadas exitosamente', mes });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('[habitacionesController.updateMetas] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar metas de habitaciones', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAÑAS DE MARKETING Y PROMOCIONES POR SEGMENTO
// ─────────────────────────────────────────────────────────────────────────────

export async function getCampanaClientesPorSegmento(req, res) {
  let conn;
  try {
    const { idSegmento } = req.params;
    if (!idSegmento) {
      return res.status(400).json({ message: 'ID o nombre del segmento es requerido' });
    }

    conn = await pool.getConnection();

    // Obtener los clientes de reservas que pertenecen al segmento dado
    const [rows] = await conn.query(
      `SELECT 
        r.telefono,
        r.nombre_huesped,
        r.correo,
        r.empresa_nombre,
        r.id_tipo_cliente,
        r.tipo_cliente_nombre,
        MAX(r.fecha_check_in) as ultima_estancia,
        COUNT(r.id) as total_estancias,
        MAX(r.ultimo_contacto) as ultimo_contacto,
        MAX(r.ultimo_contacto_tipo) as ultimo_contacto_tipo
       FROM habitacion_reservas r
       WHERE (r.id_tipo_cliente = ? OR r.tipo_cliente_nombre = ?)
         AND r.telefono IS NOT NULL 
         AND TRIM(r.telefono) != ''
         AND r.estado != 'Cancelada'
       GROUP BY r.telefono, r.nombre_huesped, r.correo, r.empresa_nombre, r.id_tipo_cliente, r.tipo_cliente_nombre
       ORDER BY ultima_estancia DESC`,
      [idSegmento, idSegmento]
    );

    return res.json(rows);
  } catch (error) {
    console.error('[habitacionesController.getCampanaClientesPorSegmento] Error:', error);
    return res.status(500).json({ message: 'Error al consultar clientes por segmento', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}

export async function uploadPromocionImagen(req, res) {
  try {
    if (req.file) {
      // Convertir el buffer en memoria a Base64 / Data URL
      const base64 = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype || 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return res.json({
        url: dataUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimeType
      });
    }

    const b = req.body || {};
    const fallbackUrl = b.dataUrl || b.imagen || b.url;
    if (fallbackUrl) {
      return res.json({
        url: fallbackUrl,
        filename: b.filename || 'flyer.jpg',
        size: b.size || fallbackUrl.length,
        mimeType: b.mimeType || 'image/jpeg'
      });
    }

    return res.status(400).json({ message: 'No se envió ningún archivo de imagen' });
  } catch (error) {
    console.error('[habitacionesController.uploadPromocionImagen] Error:', error);
    return res.status(500).json({ message: 'Error al procesar archivo de imagen', error: error.message });
  }
}

