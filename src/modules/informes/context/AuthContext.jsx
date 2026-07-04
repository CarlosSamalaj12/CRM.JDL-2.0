import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import authService from '../../../services/authService';

const AuthContext = createContext(null);

function mapRole(role) {
  const raw = String(role || '').trim().toLowerCase();
  if (raw === 'admin') return 'Admin';
  if (raw === 'frontoffice' || raw === 'front_office' || raw === 'recepcionista') return 'FrontOffice';
  if (raw === 'vendedor' || raw === 'sales') return 'Vendedor';
  if (raw === 'coordinador') return 'Coordinador';
  if (raw === 'eventos') return 'Eventos';
  return role || '';
}

function normalizeCrmUser(rawUser) {
  if (!rawUser || typeof rawUser !== 'object') return null;

  const nombre = rawUser.nombre || rawUser.fullName || rawUser.name || rawUser.username || rawUser.email || '';
  const rol = mapRole(rawUser.rol || rawUser.role);

  return {
    ...rawUser,
    nombre,
    rol,
    email: rawUser.email || rawUser.correo || '',
  };
}

function getSessionSnapshot() {
  const token = localStorage.getItem('token');
  const currentUser = authService.getCurrentUser();
  const user = token ? normalizeCrmUser(currentUser) : null;

  return {
    token: token || null,
    user,
  };
}

export function AuthProvider({ children }) {
  const initialSession = useMemo(() => getSessionSnapshot(), []);
  const [user, setUser] = useState(initialSession.user);
  const [token, setToken] = useState(initialSession.token);
  const [loading, setLoading] = useState(false);

  const syncSession = useCallback(() => {
    const next = getSessionSnapshot();
    setToken(next.token);
    setUser(next.user);
    setLoading(false);
  }, []);

  useEffect(() => {
    syncSession();
    window.addEventListener('storage', syncSession);
    window.addEventListener('focus', syncSession);

    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener('focus', syncSession);
    };
  }, [syncSession]);

  useEffect(() => {
    if (user && token) {
      // Registrar e inicializar Web Push nativo para PWA
      import('../../../services/webPushService.js').then(({ requestNotificationPermissionAndSubscribe }) => {
        requestNotificationPermissionAndSubscribe();
      }).catch(err => {
        console.warn('[WebPush] Error inicializando en AuthContext:', err.message);
      });
    }
  }, [user, token]);

  const login = async () => {
    throw new Error('Use el login principal del EMS para acceder a Informes.');
  };

  const register = async () => {
    throw new Error('El registro desde Informes está deshabilitado. Use el acceso del CRM.');
  };

  const logout = () => {
    authService.clearSession();
    setToken(null);
    setUser(null);
  };

  const authFetch = async (url, options = {}) => {
    const headers = { ...options.headers };
    const sessionToken = localStorage.getItem('token');

    if (sessionToken) {
      headers.Authorization = `Bearer ${sessionToken}`;
    }

    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(url, { ...options, headers });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, register, authFetch, syncSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
