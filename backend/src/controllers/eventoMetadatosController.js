import pool from '../config/db.js';

export async function getMetadatos(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM evento_metadatos WHERE id_ocupacion = ?', [id]);
    if (rows.length === 0) return res.json({ id_ocupacion: id });
    res.json(rows[0]);
  } catch (error) { next(error); }
}

export async function saveMetadatos(req, res, next) {
  try {
    const { id } = req.params;
    const { desayunos, habitaciones, tiene_alertas, alertas_text } = req.body;
    await pool.query(
      'INSERT INTO evento_metadatos (id_ocupacion, desayunos, habitaciones, tiene_alertas, alertas_text) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE desayunos = VALUES(desayunos), habitaciones = VALUES(habitaciones), tiene_alertas = VALUES(tiene_alertas), alertas_text = VALUES(alertas_text)',
      [id, desayunos || 0, habitaciones || 0, tiene_alertas ? 1 : 0, alertas_text || null]
    );
    const result = { id_ocupacion: id, desayunos: desayunos || 0, habitaciones: habitaciones || 0, tiene_alertas: Boolean(tiene_alertas), alertas_text: alertas_text || null };
    req.io.to(`evento:${id}`).emit('metadatos:updated', result);
    res.json(result);
  } catch (error) { next(error); }
}
