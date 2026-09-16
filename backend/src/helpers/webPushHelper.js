import webpush from 'web-push';
import pool from '../config/db.js';

function ensureVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(
        'mailto:sistema@jardinesdellago.com',
        publicKey,
        privateKey
      );
      return true;
    } catch (e) {
      console.warn('[WebPush Helper] Error configurando VAPID:', e.message);
    }
  }
  return false;
}

// Configurar VAPID al cargar
ensureVapidConfig();

/**
 * Envía una notificación Push nativa a un usuario.
 * @param {string} usuarioId ID del usuario destino.
 * @param {string} titulo Título de la notificación.
 * @param {string} cuerpo Cuerpo del mensaje.
 * @param {object} data Datos adicionales (url, autorId, etc).
 */
export async function enviarNotificacionWebPush(usuarioId, titulo, cuerpo, data = {}) {
  let conn;
  try {
    ensureVapidConfig();
    conn = await pool.getConnection();
    
    // Obtener las suscripciones activas del usuario desde push_subscriptions
    const [subs] = await conn.query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE usuario_id = ?',
      [String(usuarioId)]
    );

    if (!subs.length) {
      return;
    }

    const targetUrl = data.url || '/';
    const payload = JSON.stringify({
      title: titulo,
      body: cuerpo,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      url: targetUrl,
      tag: targetUrl,
      requireInteraction: true,
      data: {
        ...data,
        url: targetUrl
      }
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
        // Solo 404 o 410 representan suscripciones desinstaladas o caducadas por el navegador
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[WebPush Helper] Suscripción expirada (${err.statusCode}). Eliminando de la BD: ${sub.endpoint?.slice(0, 50)}...`);
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
