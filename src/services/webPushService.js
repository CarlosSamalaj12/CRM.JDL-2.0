/**
 * Convierte una clave VAPID codificada en Base64 URL Safe a un array Uint8.
 */
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Solicita permisos de notificación y suscribe el Service Worker al servicio Push del navegador.
 */
export async function requestNotificationPermissionAndSubscribe() {
  if (typeof window === 'undefined') return null;

  // Verificar soporte en el navegador
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[WebPush] Este navegador no soporta notificaciones Push nativas.');
    return null;
  }

  // Si el permiso ya está denegado
  if (Notification.permission === 'denied') {
    console.log('[WebPush] El permiso de notificaciones está bloqueado/denegado en este navegador.');
    return null;
  }

  try {
    // Solicitar permiso al usuario
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[WebPush] Permiso de notificaciones denegado por el usuario.');
      return null;
    }

    // Obtener la registración del Service Worker de la PWA (sw.js)
    const registration = await navigator.serviceWorker.ready;
    if (!registration) {
      console.warn('[WebPush] Service Worker de la PWA no listo.');
      return null;
    }

    const vapidPublicKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidPublicKey) {
      console.warn('[WebPush] No se detectó la clave pública VAPID (VITE_FIREBASE_VAPID_KEY).');
      return null;
    }

    // Suscribir al servicio Push del navegador
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(vapidPublicKey)
    });

    if (subscription) {
      // Enviar la suscripción completa al backend
      const sessionToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (sessionToken) {
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/webpush/save-subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            subscription: subscription
          })
        });

        if (response.ok) {
          console.log('[WebPush] Suscripción sincronizada con éxito en el servidor.');
        } else {
          console.error('[WebPush] Error al guardar la suscripción en el servidor:', response.statusText);
        }
      }
      return subscription;
    }

    return null;
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('Registration failed') || error.message?.includes('push service error')) {
      console.warn('[WebPush] El servicio Push del navegador no está disponible temporalmente (posible bloqueo de notificaciones en el sistema operativo o problemas de conexión de Chrome con los servidores de Google FCM).');
    } else {
      console.error('[WebPush] Error al solicitar permisos o suscribirse a push:', error);
    }
    return null;
  }
}

export const webPushService = {
  requestNotificationPermissionAndSubscribe
};

export default webPushService;
