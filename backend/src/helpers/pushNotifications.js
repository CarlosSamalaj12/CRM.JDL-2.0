import admin from 'firebase-admin';
import pool from '../config/db.js';

let initialized = false;

function initFirebaseAdmin() {
  if (initialized) return;

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'authcrmjdl';

  if (!clientEmail || !privateKey) {
    console.warn("⚠️ Firebase Admin: Faltan credenciales en las variables de entorno (GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY). Las notificaciones push no se enviarán.");
    return;
  }

  try {
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey,
      }),
    });
    initialized = true;
    console.log("⚙️ Firebase Admin SDK: Inicializado correctamente.");
  } catch (error) {
    console.error("❌ Firebase Admin SDK: Error al inicializar:", error);
  }
}

/**
 * Envía una notificación push FCM a todos los dispositivos registrados de un usuario.
 * @param {string} usuarioId ID del usuario destino
 * @param {string} titulo Título de la notificación
 * @param {string} cuerpo Cuerpo de la notificación
 * @param {object} data Datos extra opcionales para la app
 */
export async function enviarNotificacionPush(usuarioId, titulo, cuerpo, data = {}) {
  initFirebaseAdmin();
  if (!initialized) return;

  try {
    // Buscar tokens activos del usuario en la base de datos
    const [tokens] = await pool.query(
      'SELECT token FROM usuarios_fcm_tokens WHERE usuario_id = ?',
      [usuarioId]
    );

    if (tokens.length === 0) {
      return; // El usuario no tiene dispositivos registrados para notificaciones push
    }

    const promesas = tokens.map(async ({ token }) => {
      const mensaje = {
        token: token,
        notification: {
          title: titulo,
          body: cuerpo,
        },
        data: data,
        webpush: {
          notification: {
            icon: '/favicon.ico', // Icono por defecto de la aplicación
            badge: '/favicon.ico',
          }
        }
      };

      try {
        await admin.messaging().send(mensaje);
      } catch (err) {
        // Si el token es inválido o ha expirado, lo eliminamos de la base de datos
        if (
          err.code === 'messaging/invalid-registration-token' ||
          err.code === 'messaging/registration-token-not-registered'
        ) {
          console.log(`[FCM] Eliminando token inválido para usuario ${usuarioId}`);
          await pool.query(
            'DELETE FROM usuarios_fcm_tokens WHERE usuario_id = ? AND token = ?',
            [usuarioId, token]
          );
        } else {
          console.error(`[FCM] Error enviando a token de usuario ${usuarioId}:`, err.message);
        }
      }
    });

    await Promise.all(promesas);
  } catch (error) {
    console.error(`[FCM] Error en el flujo de envío push para usuario ${usuarioId}:`, error);
  }
}
