import webpush from 'web-push';
import mysql from 'mysql2/promise';

// Configurar los detalles de VAPID con las mismas variables que server.cjs
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  webpush.setVapidDetails(
    'mailto:sistema@jardinesdellago.com',
    publicKey,
    privateKey
  );
  console.log('[WebPush Helper] Configurado exitosamente con claves VAPID.');
} else {
  console.warn('[WebPush Helper] ADVERTENCIA: No se detectaron claves VAPID en las variables de entorno.');
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
    
    // Obtener las suscripciones activas del usuario desde push_subscriptions
    const [subs] = await conn.query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE usuario_id = ?',
      [String(usuarioId)]
    );

    if (!subs.length) {
      return;
    }

    const payload = JSON.stringify({
      title: titulo,
      body: cuerpo,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      url: data.url || '/',
      tag: data.url || 'default',
      requireInteraction: true,
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
        // Si el código de estado es 404, 410, 400 o 401, la suscripción expiró o es inválida
        if (err.statusCode === 404 || err.statusCode === 410 || err.statusCode === 400 || err.statusCode === 401) {
          console.log(`[WebPush Helper] Suscripción obsoleta (${err.statusCode}). Eliminando de la BD: ${sub.endpoint?.slice(0, 50)}...`);
          try {
            await conn.query(
              'DELETE FROM push_subscriptions WHERE usuario_id = ? AND endpoint = ?',
              [String(usuarioId), sub.endpoint]
            );
          } catch (delErr) {
            console.error('[WebPush Helper] Error al eliminar suscripción obsoleta:', delErr.message);
          }
        } else {
          console.error(`[WebPush Helper] Error (${err.statusCode || 'desconocido'}) al enviar push a usuario ${usuarioId}:`, err.message);
        }
      }
    });

    await Promise.all(promesas);
  } catch (dbErr) {
    console.error(`[WebPush Helper] Error en la base de datos al buscar suscripciones para el usuario ${usuarioId}:`, dbErr.message);
  } finally {
    if (conn) conn.release();
  }
}
