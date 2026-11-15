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
// Determinar authDomain:
// Solo usar el proxy first-party (window.location.host) cuando VITE_FIREBASE_AUTH_PROXY=true
// esté activado explícitamente en .env (y el servidor web/Nginx en producción reenvíe /__/auth/*
// y /__/firebase/* al backend en lugar de devolver index.html).
const currentHost = typeof window !== 'undefined' ? (window.location?.host || '') : '';
const currentHostname = typeof window !== 'undefined' ? (window.location?.hostname || '') : '';
const isLocalhost =
  !currentHostname ||
  currentHostname === 'localhost' ||
  currentHostname === '127.0.0.1' ||
  currentHostname.startsWith('192.168.');

const useFirstPartyAuthProxy =
  !isLocalhost &&
  String(import.meta.env.VITE_FIREBASE_AUTH_PROXY || '').toLowerCase() === 'true' &&
  Boolean(currentHost);

const resolvedAuthDomain = useFirstPartyAuthProxy
  ? currentHost
  : (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "crm-jardines-del-lago.firebaseapp.com");

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForInitialSetupToPreventCrash",
  authDomain: resolvedAuthDomain,
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
    // Limpiar cualquier bandera residual de redirección antes de intentar popup
    try {
      localStorage.removeItem('google_auth_started_at');
      sessionStorage.removeItem('pending_google_redirect');
    } catch {}

    // Intentar primero signInWithPopup para todos los dispositivos (incluyendo móviles).
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result?.user || null;
    } catch (error) {
      // NOTA CRÍTICA: NO usar error?.message?.includes('popup') porque códigos normales
      // como 'auth/popup-closed-by-user' y 'auth/cancelled-popup-request' incluyen la palabra "popup"
      // y desviaban por error hacia signInWithRedirect en iPhone!
      const isUserCancelled =
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request';

      const isPopupBlocked =
        !isUserCancelled && (
          error?.code === 'auth/popup-blocked' ||
          error?.code === 'auth/operation-not-supported-in-this-environment' ||
          error?.code === 'auth/operation-not-supported' ||
          error?.code === 'auth/web-storage-unsupported' ||
          error?.message?.includes('Cross-Origin-Opener-Policy')
        );

      if (isPopupBlocked) {
        const isSameOriginAuth =
          typeof window !== 'undefined' &&
          resolvedAuthDomain === window.location?.host;

        const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
        const isIOS = /iPhone|iPad|iPod/i.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        // En iOS con authDomain cruzado (*.firebaseapp.com), signInWithRedirect falla siempre
        // con "missing initial state" por el particionado de sessionStorage (ITP).
        // Solo redirigir si el proxy first-party (/__/auth) está activo en el mismo dominio,
        // o si no es un entorno iOS con dominio cruzado.
        if (isIOS && !isSameOriginAuth) {
          try {
            localStorage.removeItem('google_auth_started_at');
            sessionStorage.removeItem('pending_google_redirect');
          } catch {}
          const iosPopupErr = new Error(
            'Safari bloqueó la ventana emergente de Google. En tu iPhone ve a Configuración > Safari y desactiva "Bloquear ventanas emergentes", o abre el enlace directamente en Safari/Chrome.'
          );
          iosPopupErr.code = 'auth/ios-popup-blocked';
          throw iosPopupErr;
        }

        console.warn('[Firebase] Popup bloqueado por el navegador. Iniciando redirección nativa a Google...');
        try {
          localStorage.setItem('google_auth_started_at', String(Date.now()));
          sessionStorage.setItem('pending_google_redirect', '1');
        } catch {}
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

    const startedAt = typeof window !== 'undefined' ? localStorage.getItem('google_auth_started_at') : null;
    const isRecentAuth = Boolean(startedAt && (Date.now() - Number(startedAt) < 120000));
    const isPending = (typeof window !== 'undefined' && sessionStorage.getItem('pending_google_redirect') === '1') || isRecentAuth;

    // Solo resolver redirección si el usuario realmente inició un flujo de Google Login
    if (!isPending) {
      return null;
    }

    try {
      // 1. Intentar resolver el resultado del redirect de Firebase
      const result = await getRedirectResult(auth);
      if (result?.user) {
        cleanupFlags();
        return result.user;
      }

      // 2. Si getRedirectResult es null pero estamos esperando redirect, comprobar si auth.currentUser ya se hidrató
      if (auth.currentUser) {
        cleanupFlags();
        return auth.currentUser;
      }

      // 3. Si venía de una redirección de Google reciente, esperar máximo 5s a onAuthStateChanged
      const user = await new Promise((resolve) => {
        let unsub = () => {};
        const timeout = setTimeout(() => {
          unsub();
          resolve(null);
        }, 5000);

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
