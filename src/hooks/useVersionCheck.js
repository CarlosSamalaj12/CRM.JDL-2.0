// useVersionCheck.js
// Hook que:
//  1) Consulta /api/version al montar (y periódicamente)
//  2) Compara con la versión del bundle (inyectada por Vite) y la versión instalada en sesión
//  3) Si hay una nueva versión → invalida sesión local y expone updateState para que el modal aparezca
//
// Uso:
//   const { updateState, reload, currentVersion, serverVersion } = useVersionCheck({ intervalMs: 3 * 60 * 60 * 1000 });
//   {updateState && <ForceUpdateModal {...updateState} onUpdate={reload} />}

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  fetchServerVersion,
  evaluateUpdate,
  forcePurgeAndLogout,
  clearFirebasePersistence,
  compareVersions,
  CURRENT_VERSION,
} from '../services/versionService';

const DEFAULT_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 horas

// Invalida preventivamente las credenciales locales en cuanto se detecta un force-logout
// para que si el usuario cierra la pestaña o recarga durante el conteo regresivo, no conserve su sesión.
function preemptivelyInvalidateSession() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearFirebasePersistence().catch(() => {});
  } catch (_) {}
}

export function useVersionCheck({ intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = {}) {
  const [updateState, setUpdateState] = useState(null);
  const [serverVersion, setServerVersion] = useState(null);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    if (!mountedRef.current) return;
    if (typeof window !== 'undefined' && window.location.pathname === '/login') return;
    setChecking(true);
    try {
      const info = await fetchServerVersion();
      if (!mountedRef.current) return;
      if (info) {
        setServerVersion(info.version);
        setLastCheck(new Date());
        const result = evaluateUpdate(info);
        setUpdateState(result.needsUpdate ? result : null);
      }
    } finally {
      if (mountedRef.current) setChecking(false);
    }
  }, []);

  // Función pública: purga sesión, cachés y redirige a login
  const reload = useCallback(async (targetVer) => {
    const v = targetVer || updateState?.serverVersion || serverVersion || '';
    await forcePurgeAndLogout(v);
  }, [updateState, serverVersion]);

  // Check al montar + polling
  useEffect(() => {
    if (!enabled) return undefined;
    mountedRef.current = true;

    // Check inmediato tras montar
    const initialTimer = setTimeout(() => {
      check();
    }, 300);

    // Polling periódico
    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        check();
      }, intervalMs);
    };
    startPolling();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        check();
      }
    };
    const onFocus = () => {
      check();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    // Listener del Service Worker: cuando se activa una versión nueva,
    // el SW manda un mensaje { type: 'SW_ACTIVATED', version: '...' }.
    const onSwMessage = (event) => {
      const data = event.data;
      if (data && (data.type === 'SW_ACTIVATED' || data.type === 'SW_UPDATED')) {
        setTimeout(() => check(), 200);
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }

    // Listener para eventos directos de Socket.IO en tiempo real
    const onSystemForceLogout = (e) => {
      if (typeof window !== 'undefined' && window.location.pathname === '/login') return;
      const data = e.detail || {};
      if (CURRENT_VERSION === '0.0.0-dev' || CURRENT_VERSION.startsWith('0.0.0-')) return;
      const savedVersion = localStorage.getItem('crm_installed_version');
      if (
        data.version &&
        compareVersions(CURRENT_VERSION, data.version) >= 0 &&
        savedVersion &&
        compareVersions(savedVersion, data.version) >= 0
      ) {
        return;
      }
      setServerVersion(data.version || 'nueva');
      setUpdateState({
        needsUpdate: true,
        reason: 'force-logout',
        forceLogout: true,
        serverVersion: data.version,
        message: data.message || 'Se ha desplegado una nueva versión del sistema. Se cerrará sesión para aplicar los cambios limpiamente.',
      });
    };
    window.addEventListener('system:force-logout', onSystemForceLogout);

    return () => {
      mountedRef.current = false;
      clearTimeout(initialTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('system:force-logout', onSystemForceLogout);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage);
      }
    };
  }, [enabled, intervalMs, check]);

  return {
    updateState,
    serverVersion,
    currentVersion: CURRENT_VERSION,
    checking,
    lastCheck,
    check,
    checkNow: check,
    reload,
  };
}
