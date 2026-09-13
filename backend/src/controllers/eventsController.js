import pool from '../config/db.js';
import { emitChange } from '../helpers/socketEvents.js';

const EVENTO_USER_JOIN = `
  LEFT JOIN eventos ev ON e.Idocupacion = ev.id
  LEFT JOIN usuarios u ON ev.id_usuario = u.id
`;

export async function getWeeklyServices(req, res, next) {
  try {
    const { date } = req.query;
    let weekCondition = '';
    let params = [];
    const dateCol = 'COALESCE(ice.fecha_servicio, e.FechaEvento)';

    if (date) {
      weekCondition = ` AND YEARWEEK(${dateCol}, 1) = YEARWEEK(?, 1)`;
      params.push(date);
    } else {
      weekCondition = ` AND YEARWEEK(${dateCol}, 1) = YEARWEEK(CURDATE(), 1)`;
    }

    const query = `
      SELECT
        DATE_FORMAT(${dateCol}, '%Y-%m-%d') AS FechaServicio,
        SUBSTRING_INDEX(ice.id_evento, '_s', 1) AS Idocupacion,
        e.Institucion,
        e.Salon,
        COALESCE(u.nombre_completo, u.nombre, e.Vendedor) AS Vendedor,
        COALESCE(sc.nombre, ice.nombre) AS Subcategoria,
        CASE
          WHEN LOWER(COALESCE(ice.nombre, '')) LIKE '%desayuno%' THEN 'desayunos'
          WHEN LOWER(COALESCE(ice.nombre, '')) LIKE '%refa%am%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%refa%a.m.%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%refacci%am%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%coffee%break%am%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%coffee%break%a.m.%' THEN 'refacciones_am'
          WHEN LOWER(COALESCE(ice.nombre, '')) LIKE '%almuerzo%' THEN 'almuerzos'
          WHEN LOWER(COALESCE(ice.nombre, '')) LIKE '%cena%' THEN 'cenas'
          WHEN LOWER(COALESCE(ice.nombre, '')) LIKE '%refa%pm%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%refa%p.m.%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%refacci%pm%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%coffee%break%pm%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%coffee%break%p.m.%' THEN 'refacciones_pm'
          WHEN LOWER(COALESCE(sc.nombre, '')) LIKE '%desayuno%' THEN 'desayunos'
          WHEN LOWER(COALESCE(sc.nombre, '')) LIKE '%refa%am%' OR LOWER(COALESCE(sc.nombre, '')) LIKE '%refa%a.m.%' OR LOWER(COALESCE(sc.nombre, '')) LIKE '%refacci%am%' THEN 'refacciones_am'
          WHEN LOWER(COALESCE(sc.nombre, '')) LIKE '%almuerzo%' THEN 'almuerzos'
          WHEN LOWER(COALESCE(sc.nombre, '')) LIKE '%cena%' THEN 'cenas'
          WHEN LOWER(COALESCE(sc.nombre, '')) LIKE '%refa%pm%' OR LOWER(COALESCE(sc.nombre, '')) LIKE '%refa%p.m.%' OR LOWER(COALESCE(sc.nombre, '')) LIKE '%refacci%pm%' THEN 'refacciones_pm'
          ELSE 'otros'
        END AS TipoServicio,
        SUM(ice.cantidad) AS cantidad
      FROM items_cotizacion_evento ice
      LEFT JOIN servicios s ON ice.id_servicio = s.id
      LEFT JOIN subcategorias_servicio sc ON s.id_subcategoria = sc.id
      LEFT JOIN (
        SELECT SUBSTRING_INDEX(Idocupacion, '_s', 1) AS base_id, MIN(FechaEvento) AS FechaEvento,
               MAX(Institucion) AS Institucion, MAX(Salon) AS Salon, MAX(Vendedor) AS Vendedor
        FROM tbl_seguimientocotizaciones
        WHERE Estatuscotizacion IN (4, 7, 8)
        GROUP BY SUBSTRING_INDEX(Idocupacion, '_s', 1)
      ) e ON SUBSTRING_INDEX(ice.id_evento, '_s', 1) = e.base_id
      LEFT JOIN eventos ev ON SUBSTRING_INDEX(ice.id_evento, '_s', 1) = ev.id
      LEFT JOIN usuarios u ON ev.id_usuario = u.id
      WHERE 1=1
        ${weekCondition}
      GROUP BY DATE_FORMAT(${dateCol}, '%Y-%m-%d'), SUBSTRING_INDEX(ice.id_evento, '_s', 1), TipoServicio
      ORDER BY DATE_FORMAT(${dateCol}, '%Y-%m-%d') ASC, TipoServicio ASC
    `;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

export async function getEvents(req, res, next) {
  try {
    const { date } = req.query;

    // El conteo de notas es el mismo para todos (sin filtro por menciones).
    const noteFilterClause = '';

    let query = `SELECT
        e.Idocupacion,
        e.Institucion,
        e.Pax,
        e.PaxCompartido,
        e.Estatuscotizacion,
        COALESCE(u.nombre_completo, u.nombre, e.Vendedor) AS Vendedor,
        e.FechaEvento,
        e.FechaSalida,
        e.HoraI,
        e.HoraF,
        e.TipoEvento,
        e.Telefono,
        e.Salon,
        e.SalonPrincipal,
        (SELECT COUNT(*) FROM event_notas n WHERE n.idocupacion = e.Idocupacion ${noteFilterClause}) AS cant_notas,
        CASE
          WHEN COALESCE(m.tiene_alertas, 0) = 1 THEN 1
          WHEN EXISTS (
            SELECT 1 FROM informe_dias_detalle dd
            JOIN informes_eventos ie ON dd.informe_id = ie.id
            WHERE ie.id_ocupacion = e.Idocupacion
            AND dd.descripcion_montaje IS NOT NULL
            AND dd.descripcion_montaje LIKE '%"alertas":%'
            AND dd.descripcion_montaje NOT LIKE '%"alertas":[]%'
            LIMIT 1
          ) THEN 1
          ELSE 0
        END AS tiene_alertas,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM informes_eventos ie
            WHERE ie.id_ocupacion = e.Idocupacion 
               OR SUBSTRING_INDEX(ie.id_ocupacion, '_s', 1) = SUBSTRING_INDEX(e.Idocupacion, '_s', 1)
               OR ie.id_ocupacion LIKE CONCAT(SUBSTRING_INDEX(e.Idocupacion, '_s', 1), '_%')
          ) THEN 1
          ELSE 0
        END AS tiene_informe,
        m.alertas_text,
        CASE
          WHEN e.Idocupacion = (
            SELECT t.Idocupacion 
            FROM tbl_seguimientocotizaciones t 
            WHERE SUBSTRING_INDEX(t.Idocupacion, '_s', 1) = SUBSTRING_INDEX(e.Idocupacion, '_s', 1) 
              AND DATE(t.FechaEvento) = DATE(e.FechaEvento) 
            ORDER BY t.Pax DESC, t.Idocupacion ASC 
            LIMIT 1
          ) THEN
            (SELECT COALESCE(SUM(ice.cantidad), 0)
             FROM items_cotizacion_evento ice
             LEFT JOIN servicios s ON ice.id_servicio = s.id
             LEFT JOIN subcategorias_servicio sc ON s.id_subcategoria = sc.id
             WHERE SUBSTRING_INDEX(ice.id_evento, '_s', 1) = SUBSTRING_INDEX(e.Idocupacion, '_s', 1)
               AND DATE(COALESCE(ice.fecha_servicio, e.FechaEvento)) = DATE(e.FechaEvento)
               AND (LOWER(COALESCE(ice.nombre, '')) LIKE '%desayuno%' OR (LOWER(COALESCE(sc.nombre, '')) LIKE '%desayuno%' AND LOWER(COALESCE(ice.nombre, '')) NOT LIKE '%almuerzo%' AND LOWER(COALESCE(ice.nombre, '')) NOT LIKE '%cena%'))
            )
          ELSE 0
        END AS cant_desayunos,
        CASE
          WHEN e.Idocupacion = (
            SELECT t.Idocupacion 
            FROM tbl_seguimientocotizaciones t 
            WHERE SUBSTRING_INDEX(t.Idocupacion, '_s', 1) = SUBSTRING_INDEX(e.Idocupacion, '_s', 1) 
              AND DATE(t.FechaEvento) = DATE(e.FechaEvento) 
            ORDER BY t.Pax DESC, t.Idocupacion ASC 
            LIMIT 1
          ) THEN
            (SELECT COALESCE(SUM(ice.cantidad), 0)
             FROM items_cotizacion_evento ice
             LEFT JOIN servicios s ON ice.id_servicio = s.id
             LEFT JOIN subcategorias_servicio sc ON s.id_subcategoria = sc.id
             WHERE SUBSTRING_INDEX(ice.id_evento, '_s', 1) = SUBSTRING_INDEX(e.Idocupacion, '_s', 1)
               AND DATE(COALESCE(ice.fecha_servicio, e.FechaEvento)) = DATE(e.FechaEvento)
               AND (LOWER(COALESCE(ice.nombre, '')) LIKE '%refa%am%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%refa%a.m.%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%refacci%am%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%coffee%break%am%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%coffee%break%a.m.%' OR (LOWER(COALESCE(sc.nombre, '')) LIKE '%refa%am%' AND LOWER(COALESCE(ice.nombre, '')) NOT LIKE '%almuerzo%' AND LOWER(COALESCE(ice.nombre, '')) NOT LIKE '%cena%'))
            )
          ELSE 0
        END AS cant_refacciones_am,
        CASE
          WHEN e.Idocupacion = (
            SELECT t.Idocupacion 
            FROM tbl_seguimientocotizaciones t 
            WHERE SUBSTRING_INDEX(t.Idocupacion, '_s', 1) = SUBSTRING_INDEX(e.Idocupacion, '_s', 1) 
              AND DATE(t.FechaEvento) = DATE(e.FechaEvento) 
            ORDER BY t.Pax DESC, t.Idocupacion ASC 
            LIMIT 1
          ) THEN
            (SELECT COALESCE(SUM(ice.cantidad), 0)
             FROM items_cotizacion_evento ice
             LEFT JOIN servicios s ON ice.id_servicio = s.id
             LEFT JOIN subcategorias_servicio sc ON s.id_subcategoria = sc.id
             WHERE SUBSTRING_INDEX(ice.id_evento, '_s', 1) = SUBSTRING_INDEX(e.Idocupacion, '_s', 1)
               AND DATE(COALESCE(ice.fecha_servicio, e.FechaEvento)) = DATE(e.FechaEvento)
               AND (LOWER(COALESCE(ice.nombre, '')) LIKE '%almuerzo%' OR (LOWER(COALESCE(sc.nombre, '')) LIKE '%almuerzo%' AND LOWER(COALESCE(ice.nombre, '')) NOT LIKE '%cena%' AND LOWER(COALESCE(ice.nombre, '')) NOT LIKE '%desayuno%'))
            )
          ELSE 0
        END AS cant_almuerzos,
        CASE
          WHEN e.Idocupacion = (
            SELECT t.Idocupacion 
            FROM tbl_seguimientocotizaciones t 
            WHERE SUBSTRING_INDEX(t.Idocupacion, '_s', 1) = SUBSTRING_INDEX(e.Idocupacion, '_s', 1) 
              AND DATE(t.FechaEvento) = DATE(e.FechaEvento) 
            ORDER BY t.Pax DESC, t.Idocupacion ASC 
            LIMIT 1
          ) THEN
            (SELECT COALESCE(SUM(ice.cantidad), 0)
             FROM items_cotizacion_evento ice
             LEFT JOIN servicios s ON ice.id_servicio = s.id
             LEFT JOIN subcategorias_servicio sc ON s.id_subcategoria = sc.id
             WHERE SUBSTRING_INDEX(ice.id_evento, '_s', 1) = SUBSTRING_INDEX(e.Idocupacion, '_s', 1)
               AND DATE(COALESCE(ice.fecha_servicio, e.FechaEvento)) = DATE(e.FechaEvento)
               AND (LOWER(COALESCE(ice.nombre, '')) LIKE '%refa%pm%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%refa%p.m.%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%refacci%pm%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%coffee%break%pm%' OR LOWER(COALESCE(ice.nombre, '')) LIKE '%coffee%break%p.m.%' OR (LOWER(COALESCE(sc.nombre, '')) LIKE '%refa%pm%' AND LOWER(COALESCE(ice.nombre, '')) NOT LIKE '%almuerzo%' AND LOWER(COALESCE(ice.nombre, '')) NOT LIKE '%cena%'))
            )
          ELSE 0
        END AS cant_refacciones_pm,
        CASE
          WHEN e.Idocupacion = (
            SELECT t.Idocupacion 
            FROM tbl_seguimientocotizaciones t 
            WHERE SUBSTRING_INDEX(t.Idocupacion, '_s', 1) = SUBSTRING_INDEX(e.Idocupacion, '_s', 1) 
              AND DATE(t.FechaEvento) = DATE(e.FechaEvento) 
            ORDER BY t.Pax DESC, t.Idocupacion ASC 
            LIMIT 1
          ) THEN
            (SELECT COALESCE(SUM(ice.cantidad), 0)
             FROM items_cotizacion_evento ice
             LEFT JOIN servicios s ON ice.id_servicio = s.id
             LEFT JOIN subcategorias_servicio sc ON s.id_subcategoria = sc.id
             WHERE SUBSTRING_INDEX(ice.id_evento, '_s', 1) = SUBSTRING_INDEX(e.Idocupacion, '_s', 1)
               AND DATE(COALESCE(ice.fecha_servicio, e.FechaEvento)) = DATE(e.FechaEvento)
               AND (LOWER(COALESCE(ice.nombre, '')) LIKE '%cena%' OR (LOWER(COALESCE(sc.nombre, '')) LIKE '%cena%' AND LOWER(COALESCE(ice.nombre, '')) NOT LIKE '%almuerzo%' AND LOWER(COALESCE(ice.nombre, '')) NOT LIKE '%desayuno%'))
            )
          ELSE 0
        END AS cant_cenas
      FROM tbl_seguimientocotizaciones e
      LEFT JOIN evento_metadatos m ON e.Idocupacion = m.id_ocupacion
      ${EVENTO_USER_JOIN}
      WHERE e.Estatuscotizacion IN (4, 7, 8)`;

    let params = [];

    if (req.query.search) {
      const searchTerm = `%${req.query.search}%`;
      query += ` AND (e.Institucion LIKE ? OR e.Salon LIKE ? OR e.Vendedor LIKE ? OR e.TipoEvento LIKE ?)`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    } else if (date) {
      query += ` AND YEARWEEK(FechaEvento, 1) = YEARWEEK(?, 1)`;
      params.push(date);
    } else {
      query += ` AND YEARWEEK(FechaEvento, 1) = YEARWEEK(CURDATE(), 1)`;
    }

    query += ` ORDER BY FechaEvento ASC, HoraI ASC;`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

export async function getEventById(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT
        e.Idocupacion,
        e.Institucion,
        e.Pax,
        e.Estatuscotizacion,
        COALESCE(u.nombre_completo, u.nombre, e.Vendedor) AS Vendedor,
        e.FechaEvento,
        e.FechaSalida,
        e.HoraI,
        e.HoraF,
        e.TipoEvento,
        e.Telefono,
        e.Salon,
        e.EncargadoEvento,
        e.NoDoc,
        COALESCE(m.tiene_alertas, 0) AS tiene_alertas,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM informes_eventos ie
            WHERE ie.id_ocupacion = e.Idocupacion 
               OR SUBSTRING_INDEX(ie.id_ocupacion, '_s', 1) = SUBSTRING_INDEX(e.Idocupacion, '_s', 1)
               OR ie.id_ocupacion LIKE CONCAT(SUBSTRING_INDEX(e.Idocupacion, '_s', 1), '_%')
          ) THEN 1
          ELSE 0
        END AS tiene_informe,
        m.alertas_text
      FROM tbl_seguimientocotizaciones e
      LEFT JOIN evento_metadatos m ON e.Idocupacion = m.id_ocupacion
      ${EVENTO_USER_JOIN}
      WHERE e.Idocupacion = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateEventStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { estatus } = req.body;

    if (![4, 7, 8].includes(Number(estatus))) {
      return res.status(400).json({ message: 'Estatus inválido. Debe ser 4 (Confirmado), 7 (Pre-reserva) u 8 (Mantenimiento)' });
    }

    const statusMap = { 4: 'Confirmado', 7: 'Pre reserva', 8: 'Mantenimiento' };
    const mappedStatus = statusMap[Number(estatus)];
    await pool.query(
      'UPDATE eventos SET estado = ? WHERE id = ?',
      [mappedStatus, id]
    );
    emitChange(req, 'evento_status', 'updated', { id });

    res.json({ message: 'Estatus actualizado correctamente' });
  } catch (error) {
    next(error);
  }
}

export async function getEventStats(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT
        COUNT(*) AS total_eventos,
        SUM(CASE WHEN Estatuscotizacion = 4 THEN 1 ELSE 0 END) AS confirmados,
        SUM(CASE WHEN Estatuscotizacion = 7 THEN 1 ELSE 0 END) AS pre_reservas,
        SUM(CASE WHEN Estatuscotizacion = 8 THEN 1 ELSE 0 END) AS mantenimientos,
        SUM(Pax) AS total_pax,
        ROUND(AVG(Pax)) AS pax_promedio
      FROM tbl_seguimientocotizaciones
      WHERE Estatuscotizacion IN (4, 7, 8)
    `);

    const [tipoRows] = await pool.query(`
      SELECT TipoEvento, COUNT(*) AS cantidad
      FROM tbl_seguimientocotizaciones
      WHERE Estatuscotizacion IN (4, 7, 8) AND TipoEvento IS NOT NULL AND TipoEvento != ''
      GROUP BY TipoEvento
      ORDER BY cantidad DESC
      LIMIT 6
    `);

    const [salonRows] = await pool.query(`
      SELECT Salon, COUNT(*) AS cantidad
      FROM tbl_seguimientocotizaciones
      WHERE Estatuscotizacion IN (4, 7, 8) AND Salon IS NOT NULL AND Salon != ''
      GROUP BY Salon
      ORDER BY cantidad DESC
      LIMIT 5
    `);

    const [proximos] = await pool.query(`
      SELECT Idocupacion, Institucion, FechaEvento, HoraI, Pax, Estatuscotizacion, Salon
      FROM tbl_seguimientocotizaciones
      WHERE Estatuscotizacion IN (4, 7, 8) AND FechaEvento >= CURDATE()
      ORDER BY FechaEvento ASC, HoraI ASC
      LIMIT 5
    `);

    res.json({
      resumen: rows[0],
      por_tipo: tipoRows,
      por_salon: salonRows,
      proximos_eventos: proximos,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEventQuote(req, res, next) {
  const { id } = req.params;
  const { quote, status } = req.body;

  if (!quote || typeof quote !== 'object') {
    return res.status(400).json({ message: 'Objeto quote requerido' });
  }

  const rawId = String(id || '').trim();
  if (!rawId) {
    return res.status(400).json({ message: 'ID de evento requerido' });
  }

  const baseId = rawId.replace(/_(s|slot)\d+.*$/, '');
  const q = quote;

  const items = Array.isArray(q.items) ? q.items : [];
  const subtotal = items.reduce((acc, x) => acc + Number(x?.qty || 0) * Number(x?.price || 0), 0);
  const discountType = String(q.discountType || 'AMOUNT').toUpperCase() === 'PERCENT' ? 'PERCENT' : 'AMOUNT';
  const discountValue = Math.max(0, Number(q.discountValue || 0));
  const discountAmount = discountType === 'PERCENT'
    ? Math.max(0, Math.min(subtotal, (subtotal * Math.min(100, discountValue)) / 100))
    : Math.max(0, Math.min(subtotal, discountValue));
  const total = Math.max(0, subtotal - discountAmount);
  const currentVersion = Math.max(1, Number(q.version || 1));

  const asDate = (val) => {
    if (!val) return null;
    const s = String(val).trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };
  const str = (val) => String(val || '').trim();

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Actualizar eventos: cotizacion_json y estado (para baseId y slots)
    const quoteClean = { ...q, advances: undefined };
    const quoteJson = JSON.stringify(quoteClean);

    if (status) {
      await conn.query(
        `UPDATE eventos SET cotizacion_json = ?, estado = ? WHERE id = ? OR id_grupo = ? OR id LIKE CONCAT(?, '_%')`,
        [quoteJson, status, baseId, baseId, baseId]
      );
    } else {
      await conn.query(
        `UPDATE eventos SET cotizacion_json = ? WHERE id = ? OR id_grupo = ? OR id LIKE CONCAT(?, '_%')`,
        [quoteJson, baseId, baseId, baseId]
      );
    }

    // 2. UPSERT en cotizaciones_evento
    await conn.query(
      `INSERT INTO cotizaciones_evento
        (id_evento, id_empresa, id_encargado, nombre_empresa, nombre_encargado, contacto, correo, facturar_a, direccion, tipo_evento, lugar, horario_texto, codigo, fecha_documento, telefono, nit, personas, fecha_evento, folio, fecha_fin, fecha_max_pago, tipo_pago, notas_internas, notas, version_actual, subtotal, descuento_tipo, descuento_valor, descuento_monto, total_neto, cotizado_en_iso, json_crudo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         id_empresa = VALUES(id_empresa),
         id_encargado = VALUES(id_encargado),
         nombre_empresa = VALUES(nombre_empresa),
         nombre_encargado = VALUES(nombre_encargado),
         contacto = VALUES(contacto),
         correo = VALUES(correo),
         facturar_a = VALUES(facturar_a),
         direccion = VALUES(direccion),
         tipo_evento = VALUES(tipo_evento),
         lugar = VALUES(lugar),
         horario_texto = VALUES(horario_texto),
         codigo = VALUES(codigo),
         fecha_documento = VALUES(fecha_documento),
         telefono = VALUES(telefono),
         nit = VALUES(nit),
         personas = VALUES(personas),
         fecha_evento = VALUES(fecha_evento),
         folio = VALUES(folio),
         fecha_fin = VALUES(fecha_fin),
         fecha_max_pago = VALUES(fecha_max_pago),
         tipo_pago = VALUES(tipo_pago),
         notas_internas = VALUES(notas_internas),
         notas = VALUES(notas),
         version_actual = VALUES(version_actual),
         subtotal = VALUES(subtotal),
         descuento_tipo = VALUES(descuento_tipo),
         descuento_valor = VALUES(descuento_valor),
         descuento_monto = VALUES(descuento_monto),
         total_neto = VALUES(total_neto),
         cotizado_en_iso = VALUES(cotizado_en_iso),
         json_crudo = VALUES(json_crudo)`,
      [
        baseId,
        str(q.companyId) || null,
        str(q.managerId) || null,
        str(q.companyName) || null,
        str(q.managerName) || null,
        str(q.contact) || null,
        str(q.email) || null,
        str(q.billTo) || null,
        str(q.address) || null,
        str(q.eventType) || null,
        str(q.venue) || null,
        str(q.schedule) || null,
        str(q.code) || null,
        asDate(q.docDate),
        str(q.phone) || null,
        str(q.nit) || null,
        q.people === null || q.people === undefined || q.people === '' ? null : Math.max(0, Number(q.people)),
        asDate(q.eventDate),
        str(q.folio) || null,
        asDate(q.endDate),
        asDate(q.dueDate),
        str(q.paymentType) || null,
        str(q.internalNotes) || null,
        str(q.notes) || null,
        currentVersion,
        Number(subtotal || 0),
        discountType,
        Number(discountValue || 0),
        Number(discountAmount || 0),
        Number(total || 0),
        str(q.quotedAt) || null,
        JSON.stringify(q)
      ]
    );

    // 3. Diff delete e inserción de ítems en items_cotizacion_evento
    const incomingItemIds = [];
    const itemParams = [];
    const itemPlaceholders = [];

    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const rowKey = str(it?.rowId) || `row_${idx + 1}`;
      const itemId = `${baseId.slice(0, 80)}__${rowKey.slice(0, 40)}__${idx + 1}`.slice(0, 200);
      incomingItemIds.push(itemId);
      itemPlaceholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      itemParams.push(
        itemId,
        baseId,
        str(it?.serviceId) || null,
        asDate(it?.serviceDate),
        Number(it?.qty || 0),
        Number(it?.price || 0),
        Number(it?.unitPrice || it?.price || 0),
        str(it?.quantityMode || 'MANUAL'),
        Number(it?.qty || 0) * Number(it?.price || 0),
        str(it?.name || it?.description || '(sin nombre)'),
        str(it?.description) || null
      );
    }

    const [existingItems] = await conn.query('SELECT id FROM items_cotizacion_evento WHERE id_evento = ?', [baseId]);
    const incomingSet = new Set(incomingItemIds);
    const toDelete = existingItems.map(r => String(r.id)).filter(eid => !incomingSet.has(eid));

    if (toDelete.length > 0) {
      const placeholders = toDelete.map(() => '?').join(',');
      await conn.query(
        `DELETE FROM items_cotizacion_evento WHERE id_evento = ? AND id IN (${placeholders})`,
        [baseId, ...toDelete]
      );
    }

    if (itemPlaceholders.length > 0) {
      await conn.query(
        `INSERT INTO items_cotizacion_evento
          (id, id_evento, id_servicio, fecha_servicio, cantidad, precio, precio_unitario, modo_cantidad, total_linea, nombre, descripcion)
         VALUES ${itemPlaceholders.join(',')}
         ON DUPLICATE KEY UPDATE
           id_servicio = VALUES(id_servicio),
           fecha_servicio = VALUES(fecha_servicio),
           cantidad = VALUES(cantidad),
           precio = VALUES(precio),
           precio_unitario = VALUES(precio_unitario),
           modo_cantidad = VALUES(modo_cantidad),
           total_linea = VALUES(total_linea),
           nombre = VALUES(nombre),
           descripcion = VALUES(descripcion)`,
        itemParams
      );
    }

    // 4. Versiones: cotizacion_versiones_evento
    const rawVersions = Array.isArray(q.versions) ? q.versions : [];
    const versionRows = [];
    for (const v of rawVersions) {
      if (!v || typeof v !== 'object') continue;
      const vNum = Math.max(1, Number(v.version || 0));
      versionRows.push({ version: vNum, snapshot: { ...v, version: vNum, versions: [] } });
    }
    if (!versionRows.some(x => Number(x.version) === currentVersion)) {
      versionRows.push({ version: currentVersion, snapshot: { ...q, version: currentVersion, versions: [] } });
    }
    versionRows.sort((a, b) => Number(a.version) - Number(b.version));

    if (versionRows.length > 0) {
      const vValues = [];
      const vParams = [];
      for (const v of versionRows) {
        const vItems = Array.isArray(v.snapshot?.items) ? v.snapshot.items : [];
        const vSub = vItems.reduce((acc, x) => acc + Number(x?.qty || 0) * Number(x?.price || 0), 0);
        const vDisType = String(v.snapshot?.discountType || 'AMOUNT').toUpperCase() === 'PERCENT' ? 'PERCENT' : 'AMOUNT';
        const vDisVal = Math.max(0, Number(v.snapshot?.discountValue || 0));
        const vDisAmt = vDisType === 'PERCENT'
          ? Math.max(0, Math.min(vSub, (vSub * Math.min(100, vDisVal)) / 100))
          : Math.max(0, Math.min(vSub, vDisVal));
        const vTot = Math.max(0, vSub - vDisAmt);

        vValues.push('(?, ?, ?, ?, ?, ?, ?, ?, ?)');
        vParams.push(
          baseId,
          Number(v.version),
          Number(vSub || 0),
          vDisType,
          Number(vDisVal || 0),
          Number(vDisAmt || 0),
          Number(vTot || 0),
          str(v.snapshot?.quotedAt) || null,
          JSON.stringify(v.snapshot)
        );
      }
      await conn.query(
        `INSERT INTO cotizacion_versiones_evento
          (id_evento, version_num, subtotal, descuento_tipo, descuento_valor, descuento_monto, total_neto, cotizado_en_iso, json_crudo)
         VALUES ${vValues.join(',')}
         ON DUPLICATE KEY UPDATE
           subtotal = VALUES(subtotal),
           descuento_tipo = VALUES(descuento_tipo),
           descuento_valor = VALUES(descuento_valor),
           descuento_monto = VALUES(descuento_monto),
           total_neto = VALUES(total_neto),
           cotizado_en_iso = VALUES(cotizado_en_iso),
           json_crudo = VALUES(json_crudo)`,
        vParams
      );
    }

    // 5. Anticipos si vienen incluidos
    if (Array.isArray(q.advances) && q.advances.length > 0) {
      for (const adv of q.advances) {
        const advId = str(adv.id) || `adv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await conn.query(
          `INSERT INTO anticipos_evento
            (id, id_evento, fecha_anticipo, monto, tipo_pago, descripcion, numero_boleta, id_usuario_creador, nombre_usuario_creador, nombre_evidencia, tipo_evidencia, creado_en_iso)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            fecha_anticipo = VALUES(fecha_anticipo),
            monto = VALUES(monto),
            tipo_pago = VALUES(tipo_pago),
            descripcion = VALUES(descripcion),
            numero_boleta = VALUES(numero_boleta),
            nombre_evidencia = VALUES(nombre_evidencia),
            tipo_evidencia = VALUES(tipo_evidencia)`,
          [
            advId,
            baseId,
            asDate(adv.date) || asDate(new Date()),
            Math.max(0, Number(adv.amount || 0)),
            str(adv.paymentType || 'Efectivo'),
            str(adv.description) || null,
            str(adv.voucherNumber) || null,
            str(adv.createdByUserId) || null,
            str(adv.createdByName) || null,
            str(adv.evidenceName) || null,
            str(adv.evidenceType) || null,
            str(adv.createdAt) || new Date().toISOString()
          ]
        );
      }
    }

    await conn.commit();

    emitChange(req, 'quote', 'updated', { id: baseId, quote: q, status });
    if (req.io) {
      req.io.emit('state-updated', { timestamp: Date.now() });
    }

    res.json({ ok: true, id: baseId, quote: q, status });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
}
