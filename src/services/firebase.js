import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Firebase Config mapping environment variables.
// Uses mock credentials as a fallback to prevent runtime boot crash if not yet configured in .env.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForInitialSetupToPreventCrash",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "crm-jardines-del-lago.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "crm-jardines-del-lago",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "crm-jardines-del-lago.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

let messaging = null;
try {
  messaging = getMessaging(app);
} catch (err) {
  console.warn("⚠️ Firebase Messaging no es soportado en este navegador/entorno:", err.message);
}

// Custom OAuth parameters (optional, e.g. prompt: select_account)
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export async function requestNotificationPermissionAndGetToken() {
  if (!messaging) return null;

  // Si el permiso ya está denegado, no volvemos a solicitarlo para evitar warnings en consola
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied') {
    console.log('[FCM] El permiso de notificaciones está bloqueado/denegado en este navegador. Restablécelo desde la configuración del sitio.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permiso de notificaciones denegado.');
      return null;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    console.log('[FCM] Solicitando token con VAPID Key:', vapidKey ? 'CONFIGURADA (OK)' : 'NO DETECTADA (UNDEFINED)');

    const token = await getToken(messaging, {
      vapidKey: vapidKey
    });

    if (token) {
      // Enviar token al servidor
      const sessionToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (sessionToken) {
        await fetch(`${import.meta.env.VITE_API_URL || ''}/api/guardar-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            token: token,
            dispositivo: navigator.userAgent.slice(0, 100)
          })
        });
        console.log('Token FCM sincronizado con el servidor.');
      }
      return token;
    } else {
      console.warn('No se pudo recuperar el token FCM de Firebase.');
      return null;
    }
  } catch (error) {
    console.error('Error al solicitar permiso o recuperar token FCM:', error);
    return null;
  }
}

export function onMessageRegister(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
}

export const firebaseService = {
  auth,

  async loginWithEmail(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error("Firebase email login error:", error);
      throw error;
    }
  },

  async loginWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      const shouldRedirect =
        error?.code === 'auth/popup-blocked' ||
        error?.code === 'auth/operation-not-supported' ||
        error?.message?.includes('Cross-Origin-Opener-Policy');

      if (shouldRedirect) {
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
      console.error("Firebase Google login error:", error);
      throw error;
    }
  },

  async getGoogleRedirectUser() {
    try {
      const result = await getRedirectResult(auth);
      return result?.user || null;
    } catch (error) {
      console.error("Firebase Google redirect login error:", error);
      throw error;
    }
  },

  async logout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Firebase logout error:", error);
      throw error;
    }
  }
};

export default firebaseService;
