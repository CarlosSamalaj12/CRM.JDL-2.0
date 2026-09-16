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
 * Helper para sincronizar el payload de suscripción con los endpoints del backend.
 */
async function saveSubscriptionToBackend(subscription) {
  const sessionToken = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!sessionToken || !subscription) return false;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`
  };
  const subJson = subscription.toJSON ? subscription.toJSON() : subscription;

  try {
    await Promise.allSettled([
      fetch(`${import.meta.env.VITE_API_URL || ''}/api/webpush/save-subscription`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ subscription: subJson })
      }),
      fetch(`${import.meta.env.VITE_API_URL || ''}/api/push/subscribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ subscription: subJson })
      })
    ]);
    console.log('[WebPush] Suscripción sincronizada con éxito en el servidor.');
    return true;
  } catch (err) {
    console.warn('[WebPush] Error enviando suscripción al servidor:', err.message);
    return false;
  }
}

/**
 * Solicita permisos de notificación y suscribe el Service Worker al servicio Push del navegador.
 * @param {object} options
 * @param {boolean} options.forceRenew - Si es true, fuerza desuscripción y recrea la suscripción Push.
 */
export async function requestNotificationPermissionAndSubscribe({ forceRenew = false } = {}) {
  if (typeof window === 'undefined') return null;

  // Verificar soporte en el navegador
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[WebPush] Este navegador no soporta notificaciones Push nativas (requiere iOS 16.4+ agregado a pantalla de inicio).');
    return null;
  }

  // Si el permiso ya está denegado
  if (Notification.permission === 'denied') {
    console.log('[WebPush] El permiso de notificaciones está bloqueado/denegado en este navegador.');
    return null;
  }

  try {
    // Solicitar permiso al usuario si está en 'default'
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[WebPush] Permiso de notificaciones denegado por el usuario.');
        return null;
      }
    }

    // Obtener la registración del Service Worker de la PWA (sw.js)
    const registration = await navigator.serviceWorker.ready;
    if (!registration) {
      console.warn('[WebPush] Service Worker de la PWA no listo.');
      return null;
    }

    // Clave VAPID pública: 우선 dinámicamente del backend, fallback a VITE_VAPID_PUBLIC_KEY
    let vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    try {
      const vapidResp = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/push/vapid-public-key`);
      if (vapidResp.ok) {
        const vapidData = await vapidResp.json();
        if (vapidData?.publicKey && vapidData.publicKey !== 'MISSING_VAPID_PUBLIC_KEY') {
          vapidPublicKey = vapidData.publicKey;
        }
      }
    } catch (e) {
      console.warn('[WebPush] Fallback a clave VAPID estática:', e.message);
    }

    if (!vapidPublicKey) {
      console.warn('[WebPush] No se detectó la clave pública VAPID.');
      return null;
    }

    // Verificar si ya existía una suscripción previa
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub && !forceRenew) {
      // Preservar la suscripción activa (evita romper APNs en iOS al recargar la app)
      await saveSubscriptionToBackend(existingSub);
      return existingSub;
    }

    if (existingSub && forceRenew) {
      try {
        await existingSub.unsubscribe();
      } catch (unsubErr) {
        console.warn('[WebPush] No se pudo desuscribir sub previa:', unsubErr.message);
      }
    }

    // Suscribir al servicio Push del navegador con la clave VAPID sincronizada
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(vapidPublicKey)
    });

    if (subscription) {
      await saveSubscriptionToBackend(subscription);
      return subscription;
    }

    return null;
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('Registration failed') || error.message?.includes('push service error')) {
      console.warn('[WebPush] El servicio Push del navegador no está disponible temporalmente (posible bloqueo en SO o conexión con FCM/APNs).');
    } else {
      console.error('[WebPush] Error al solicitar permisos o suscribirse a push:', error);
    }
    return null;
  }
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export const webPushService = {
  requestNotificationPermissionAndSubscribe,
  saveSubscriptionToBackend,
  isPushSupported,
  getNotificationPermission
};

export default webPushService;
