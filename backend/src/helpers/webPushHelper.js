import webpush from 'web-push';
import mysql from 'mysql2/promise';

// Configurar los detalles de VAPID
const publicKey = process.env.VITE_FIREBASE_VAPID_KEY;
const privateKey = process.env.WEB_PUSH_PRIVATE_VAPID_KEY;

if (publicKey && privateKey) {
  webpush.setVapidDetails(
    'mailto:kevin@jardinesdellago.tech',
    publicKey,
    privateKey
  );
  console.log('[WebPush] Configurado exitosamente con claves VAPID.');
} else {
  console.warn('[WebPush] ADVERTENCIA: No se detectaron claves VAPID en las variables de entorno.');
}

// Configurar pool de base de datos
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const pool = mysql.createPool(dbConfig);

/**
 * Envía una notificación Push nativa a un usuario.
 * @param {string} usuarioId ID del usuario destino.
 * @param {string} titulo Título de la notificación.
 * @param {string} cuerpo Cuerpo del mensaje.
 * @param {object} data Datos adicionales (url, etc).
 */
export async function enviarNotificacionWebPush(usuarioId, titulo, cuerpo, data = {}) {
  let conn;
  try {
    conn = await pool.getConnection();
    
    // Obtener las suscripciones activas del usuario
    const [subs] = await conn.query(
      'SELECT endpoint, p256dh, auth FROM usuarios_push_subscriptions WHERE usuario_id = ?',
      [usuarioId]
    );

    if (!subs.length) {
      return;
    }

    const payload = JSON.stringify({
      title: titulo,
      body: cuerpo,
      data: data
    });

    const promesas = subs.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(subscription, payload);
      } catch (err) {
        // Si el código de estado es 404 o 410, la suscripción expiró o fue eliminada por el usuario
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[WebPush] Suscripción obsoleta detectada. Eliminando de la BD: ${sub.endpoint}`);
          await conn.query(
            'DELETE FROM usuarios_push_subscriptions WHERE usuario_id = ? AND endpoint = ?',
            [usuarioId, sub.endpoint]
          );
        } else {
          console.error(`[WebPush] Error enviando a suscripción del usuario ${usuarioId}:`, err.message);
        }
      }
    });

    await Promise.all(promesas);
  } catch (dbErr) {
    console.error(`[WebPush] Error en la base de datos al buscar suscripciones para el usuario ${usuarioId}:`, dbErr.message);
  } finally {
    if (conn) conn.release();
  }
}
