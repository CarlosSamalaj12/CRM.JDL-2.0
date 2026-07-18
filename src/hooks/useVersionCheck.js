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
import { fetchServerVersion, evaluateUpdate, CURRENT_VERSION } from '../services/versionService';

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

  // Función pública: recarga la página (limpia SW viejo, baja assets nuevos)
  const reload = useCallback(() => {
    // Truco para evitar que el SW nos siga sirviendo la versión vieja:
    // ?_t=<timestamp> fuerza al SW a no usar la respuesta cacheada.
    const url = new URL(window.location.href);
    url.searchParams.set('_u', String(Date.now()));
    window.location.replace(url.toString());
  }, []);

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

    return () => {
      mountedRef.current = false;
      clearTimeout(initialTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
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
