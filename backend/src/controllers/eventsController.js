import pool from '../config/db.js';

export async function getEvents(req, res, next) {
  try {
    const { date } = req.query;
    let query = `SELECT
        e.Idocupacion,
        e.Institucion,
        e.Pax,
        e.Estatuscotizacion,
        e.Vendedor,
        e.FechaEvento,
        e.FechaSalida,
        e.HoraI,
        e.HoraF,
        e.TipoEvento,
        e.Telefono,
        e.Salon,
        COALESCE(m.tiene_alertas, 0) AS tiene_alertas,
        m.alertas_text
      FROM tbl_seguimientocotizaciones e
      LEFT JOIN evento_metadatos m ON e.Idocupacion = m.id_ocupacion
      WHERE e.Estatuscotizacion IN (4, 7)`;

    let params = [];

    if (date) {
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
        e.Vendedor,
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
        m.alertas_text
      FROM tbl_seguimientocotizaciones e
      LEFT JOIN evento_metadatos m ON e.Idocupacion = m.id_ocupacion
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

    if (![4, 7].includes(Number(estatus))) {
      return res.status(400).json({ message: 'Estatus inválido. Debe ser 4 (Confirmado) o 7 (Pre-reserva)' });
    }

    const mappedStatus = Number(estatus) === 4 ? 'Confirmado' : 'Pre reserva';
    await pool.query(
      'UPDATE eventos SET estado = ? WHERE id = ?',
      [mappedStatus, id]
    );

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
        SUM(Pax) AS total_pax,
        ROUND(AVG(Pax)) AS pax_promedio
      FROM tbl_seguimientocotizaciones
      WHERE Estatuscotizacion IN (4, 7)
    `);

    const [tipoRows] = await pool.query(`
      SELECT TipoEvento, COUNT(*) AS cantidad
      FROM tbl_seguimientocotizaciones
      WHERE Estatuscotizacion IN (4, 7) AND TipoEvento IS NOT NULL AND TipoEvento != ''
      GROUP BY TipoEvento
      ORDER BY cantidad DESC
      LIMIT 6
    `);

    const [salonRows] = await pool.query(`
      SELECT Salon, COUNT(*) AS cantidad
      FROM tbl_seguimientocotizaciones
      WHERE Estatuscotizacion IN (4, 7) AND Salon IS NOT NULL AND Salon != ''
      GROUP BY Salon
      ORDER BY cantidad DESC
      LIMIT 5
    `);

    const [proximos] = await pool.query(`
      SELECT Idocupacion, Institucion, FechaEvento, HoraI, Pax, Estatuscotizacion, Salon
      FROM tbl_seguimientocotizaciones
      WHERE Estatuscotizacion IN (4, 7) AND FechaEvento >= CURDATE()
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
