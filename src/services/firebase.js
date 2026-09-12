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

// Custom OAuth parameters (optional, e.g. prompt: select_account)
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export function isMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || window.opera || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua);
  const isTouchScreen = Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && window.innerWidth <= 1024);
  return isMobileUA || isTouchScreen;
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
    // Registrar marca de tiempo persistente para detectar retorno en conexiones móviles lentas
    try {
      localStorage.setItem('google_auth_started_at', String(Date.now()));
      sessionStorage.setItem('pending_google_redirect', '1');
    } catch {}

    // Intentar primero signInWithPopup para todos los dispositivos (incluyendo móviles).
    // En navegadores móviles modernos (iOS Safari, Android Chrome), signInWithPopup
    // funciona de forma nativa abriendo una pestaña o ventana modal de selección de cuentas de Google,
    // siempre que se invoque de forma directa en el evento táctil del usuario.
    // Además, evita el bloqueo de almacenamiento de terceros (Safari ITP / Chrome Partitioning)
    // que causa que signInWithRedirect falle en getRedirectResult().
    try {
      const result = await signInWithPopup(auth, googleProvider);
      try {
        localStorage.removeItem('google_auth_started_at');
        sessionStorage.removeItem('pending_google_redirect');
      } catch {}
      return result?.user || null;
    } catch (error) {
      // Si el navegador bloqueó la ventana emergente, recurrir a redirección nativa
      const isPopupBlocked =
        error?.code === 'auth/popup-blocked' ||
        error?.code === 'auth/operation-not-supported' ||
        error?.code === 'auth/web-storage-unsupported' ||
        error?.message?.includes('popup') ||
        error?.message?.includes('Cross-Origin-Opener-Policy');

      if (isPopupBlocked) {
        console.warn('[Firebase] Popup bloqueado por el navegador. Iniciando redirección nativa a Google...');
        await signInWithRedirect(auth, googleProvider);
        return null;
      }

      try {
        localStorage.removeItem('google_auth_started_at');
        sessionStorage.removeItem('pending_google_redirect');
      } catch {}
      console.error("Firebase Google login error:", error);
      throw error;
    }
  },

  async getGoogleRedirectUser() {
    const cleanupFlags = () => {
      try {
        sessionStorage.removeItem('pending_google_redirect');
        localStorage.removeItem('google_auth_started_at');
      } catch {}
    };

    try {
      // 1. Intentar resolver el resultado del redirect de Firebase
      const result = await getRedirectResult(auth);
      if (result?.user) {
        cleanupFlags();
        return result.user;
      }

      // 2. Si getRedirectResult es null, comprobar si auth.currentUser ya se hidrató en memoria
      if (auth.currentUser) {
        cleanupFlags();
        return auth.currentUser;
      }

      // 3. Si venía de una autenticación de Google reciente (hasta 2 min), esperar a onAuthStateChanged
      // En móviles con internet lento (3G/4G), Firebase puede tardar 3 a 7 segundos en resolver el token
      const startedAt = typeof window !== 'undefined' ? localStorage.getItem('google_auth_started_at') : null;
      const isRecentAuth = startedAt && (Date.now() - Number(startedAt) < 120000);
      const isPending = (typeof window !== 'undefined' && sessionStorage.getItem('pending_google_redirect') === '1') || isRecentAuth;

      if (isPending) {
        const user = await new Promise((resolve) => {
          let unsub = () => {};
          // Dar hasta 7.5 segundos en redes móviles lentas para que Firebase Auth complete el handshake
          const timeout = setTimeout(() => {
            unsub();
            resolve(null);
          }, 7500);

          unsub = auth.onAuthStateChanged((u) => {
            if (u) {
              clearTimeout(timeout);
              unsub();
              resolve(u);
            }
          });
        });

        cleanupFlags();
        return user;
      }

      return null;
    } catch (error) {
      cleanupFlags();
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
