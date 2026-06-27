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
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request' ||
        error?.code === 'auth/operation-not-supported' ||
        error?.message?.includes('Cross-Origin-Opener-Policy') ||
        error?.message?.includes('window.closed');

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
