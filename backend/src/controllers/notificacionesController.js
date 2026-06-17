import pool from '../config/db.js';

export async function getNotificaciones(req, res, next) {
  try {
    const usuario_id = req.user?.id;
    const { solo_no_leidas } = req.query;
    let query = 'SELECT * FROM notificaciones WHERE (usuario_id = ? OR usuario_id IS NULL) ORDER BY fecha_creacion DESC LIMIT 20';
    let params = [usuario_id];

    if (solo_no_leidas === 'true') {
      query = 'SELECT * FROM notificaciones WHERE (usuario_id = ? OR usuario_id IS NULL) AND leido = 0 ORDER BY fecha_creacion DESC LIMIT 20';
    }

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) { next(error); }
}

export async function getNoLeidasCount(req, res, next) {
  try {
    const usuario_id = req.user?.id;
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM notificaciones WHERE (usuario_id = ? OR usuario_id IS NULL) AND leido = 0', [usuario_id]);
    res.json({ count: rows[0].count });
  } catch (error) { next(error); }
}

export async function marcarLeida(req, res, next) {
  try {
    const { id } = req.params;
    const usuario_id = req.user?.id;
    await pool.query('UPDATE notificaciones SET leido = 1 WHERE id = ? AND (usuario_id = ? OR usuario_id IS NULL)', [id, usuario_id]);
    res.json({ message: 'Notificación marcada como leída' });
  } catch (error) { next(error); }
}

export async function marcarTodasLeidas(req, res, next) {
  try {
    const usuario_id = req.user?.id;
    await pool.query('UPDATE notificaciones SET leido = 1 WHERE (usuario_id = ? OR usuario_id IS NULL) AND leido = 0', [usuario_id]);
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) { next(error); }
}
