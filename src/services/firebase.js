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
    // En móviles y tablets táctiles, los navegadores (Chrome Mobile, Safari iOS) bloquean popups por defecto.
    // Usamos signInWithRedirect directamente para abrir la ventana nativa de selección de cuentas de Google.
    if (isMobileDevice()) {
      try {
        sessionStorage.setItem('pending_google_redirect', '1');
        await signInWithRedirect(auth, googleProvider);
        return null; // El navegador redirigirá a Google
      } catch (err) {
        sessionStorage.removeItem('pending_google_redirect');
        console.error("Firebase Google redirect login error on mobile:", err);
        throw err;
      }
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      // Fallback a redirect en escritorio si el navegador bloquea la ventana emergente
      const isPopupFailure =
        error?.code === 'auth/popup-blocked' ||
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request' ||
        error?.code === 'auth/operation-not-supported' ||
        error?.code === 'auth/web-storage-unsupported' ||
        error?.message?.includes('popup') ||
        error?.message?.includes('Cross-Origin-Opener-Policy') ||
        error?.message?.includes('closed');

      if (isPopupFailure) {
        console.warn('[Firebase] Popup bloqueado o cerrado, usando redirección a Google...');
        sessionStorage.setItem('pending_google_redirect', '1');
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
      sessionStorage.removeItem('pending_google_redirect');
      return result?.user || null;
    } catch (error) {
      sessionStorage.removeItem('pending_google_redirect');
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
