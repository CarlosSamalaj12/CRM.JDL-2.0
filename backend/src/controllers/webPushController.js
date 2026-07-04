import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const pool = mysql.createPool(dbConfig);

/**
 * Guarda o actualiza una suscripción de notificaciones Push nativas.
 */
export async function guardarSuscripcion(req, res) {
  const usuarioId = req.user?.id;
  const { subscription } = req.body;

  if (!usuarioId) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  if (!subscription || !subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
    return res.status(400).json({ error: 'Datos de suscripción incompletos o inválidos' });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    await conn.query(`
      INSERT INTO usuarios_push_subscriptions (usuario_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        p256dh = VALUES(p256dh),
        auth = VALUES(auth),
        creado_en = CURRENT_TIMESTAMP
    `, [
      usuarioId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth
    ]);

    return res.status(200).json({ message: 'Suscripción push guardada con éxito' });
  } catch (error) {
    console.error('[WebPushController] Error al guardar suscripción:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor al procesar la suscripción' });
  } finally {
    if (conn) conn.release();
  }
}
