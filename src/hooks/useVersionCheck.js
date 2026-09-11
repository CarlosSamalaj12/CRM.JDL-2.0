// useVersionCheck.js
// Hook que:
//  1) Consulta /api/version al montar (y cada 3 horas)
//  2) Compara con la versión del bundle (inyectada por Vite)
//  3) Si la del server es mayor → expone updateState para que el modal aparezca
//
// Uso:
//   const { updateState, reload, currentVersion, serverVersion } = useVersionCheck({ intervalMs: 3 * 60 * 60 * 1000 });
//   {updateState && <ForceUpdateModal {...updateState} onUpdate={reload} />}

import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchServerVersion, evaluateUpdate, forcePurgeAndLogout, CURRENT_VERSION } from '../services/versionService';

const DEFAULT_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 horas

export function useVersionCheck({ intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = {}) {
  const [updateState, setUpdateState] = useState(null);
  const [serverVersion, setServerVersion] = useState(null);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    if (!mountedRef.current) return;
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

    // Check inicial después de 3 segundos (para no interferir con el primer paint)
    const initialTimer = setTimeout(() => {
      check();
    }, 3000);

    // Polling cada 3h (también al volver a la pestaña después de estar oculta)
    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        check();
      }, intervalMs);
    };
    startPolling();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Al volver a la pestaña, hacer un check extra por si nos quedamos atrás
        check();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Listener del Service Worker: cuando se activa una versión nueva,
    // Listener del Service Worker: cuando se activa una versión nueva,
    // el SW manda un mensaje { type: 'SW_ACTIVATED', version: '...' }.
    // Disparamos un check inmediato para mostrar el modal sin esperar al polling de 3h.
    const onSwMessage = (event) => {
      const data = event.data;
      if (data && (data.type === 'SW_ACTIVATED' || data.type === 'SW_UPDATED')) {
        // Esperar un instante para que el SW termine de tomar control
        setTimeout(() => check(), 500);
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }

    // Listener para eventos directos de Socket.IO en tiempo real
    const onSystemForceLogout = (e) => {
      const data = e.detail || {};
      if (CURRENT_VERSION === '0.0.0-dev' || CURRENT_VERSION.startsWith('0.0.0-')) return;
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
    checkNow: check,
    reload,
  };
}
