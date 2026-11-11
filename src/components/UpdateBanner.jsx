import { useState, useEffect, useCallback, useRef } from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';
import { CURRENT_VERSION } from '../services/versionService';
import ForceUpdateModal from './ForceUpdateModal';

// Escuchar mensajes del Service Worker (NAVIGATE_TO, SW_ACTIVATED)
function useSWMessage(handler) {
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type) {
        handler(event.data);
      }
    };

    // Escuchar desde el Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }
    // También por window.postMessage (fallback cross-tab)
    window.addEventListener('message', handleMessage);

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
      window.removeEventListener('message', handleMessage);
    };
  }, [handler]);
}

// ── Sonido de notificación (suave) usando Web Audio API ──
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);       // A5
    oscillator.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.08); // C#6
    oscillator.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.16); // E6
    oscillator.frequency.setValueAtTime(1760, ctx.currentTime + 0.24);    // A6

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.6);

    // Limpiar después de terminar
    oscillator.onended = () => ctx.close();
  } catch {
    // Silencio si el navegador no soporta Web Audio
  }
}

export default function UpdateBanner() {
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateHovered, setUpdateHovered] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const autoDismissRef = useRef(null);

  const { updateState, reload, check } = useVersionCheck({
    intervalMs: 15 * 60 * 1000 // Polling cada 15 minutos en background
  });

  // Escuchar el evento sw-update-ready (desde main.jsx cuando el SW se instala)
  useEffect(() => {
    const handler = (event) => {
      setWaitingWorker(event.detail);
      if (check) check();
    };

    window.addEventListener('sw-update-ready', handler);
    return () => {
      window.removeEventListener('sw-update-ready', handler);
    };
  }, [check]);

  // Si el Service Worker se activa, solicitar un check limpio de versión al server (NO mostrar banner a ciegas)
  const handleSWMessage = useCallback((data) => {
    if (data.type === 'SW_ACTIVATED' && check) {
      check();
    }
  }, [check]);
  useSWMessage(handleSWMessage);

  // Limpiar el timer de auto-dismiss si el componente se desmonta
  useEffect(() => {
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, []);

  function showBanner() {
    setVisible(true);
    setDismissed(false);

    // Reproducir sonido
    setTimeout(() => playNotificationSound(), 100);

    // Si es actualización obligatoria (below-min), no auto-descartar
    const isRequired = updateState?.reason === 'below-min';
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    if (isRequired) return;

    // Para actualizaciones no críticas: el banner permanece hasta que el usuario
    // decida actualizar o cerrar explícitamente. NO se auto-descarta.
    // (Se eliminó el auto-dismiss de 45s que causaba activaciones invisibles del SW)
  }

  // Mostrar el banner cuando el version checker detecte actualización
  useEffect(() => {
    if (updateState) {
      showBanner();
    }
  }, [updateState]);

  const targetVersion = updateState?.serverVersion || '';
  const isForceLogout = Boolean(updateState?.forceLogout || updateState?.reason === 'force-logout' || updateState?.reason === 'below-min');

  const handleUpdate = useCallback(async () => {
    setUpdating(true);
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    if (targetVersion) {
      try { sessionStorage.setItem('dismissed_version', targetVersion); } catch (_) {}
    }

    if (waitingWorker) {
      try {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      } catch (_) {}
    }

    await reload(targetVersion);
  }, [waitingWorker, targetVersion, reload]);

  const handleDismiss = useCallback(() => {
    if (isForceLogout) return; // No se puede descartar si es obligatorio
    setVisible(false);
    setDismissed(true);
    if (targetVersion) {
      try { sessionStorage.setItem('dismissed_version', targetVersion); } catch (_) {}
    }
  }, [targetVersion, isForceLogout]);

  // Si no hay actualización detectada por el servidor, no renderizar nada
  if (!updateState?.needsUpdate) return null;

  // Actualización obligatoria: mostrar modal prioritario e inescapable de pantalla completa
  return (
    <ForceUpdateModal
      open={true}
      serverVersion={targetVersion}
      currentVersion={CURRENT_VERSION}
      message={updateState?.message}
      onUpdate={handleUpdate}
      reason={updateState?.reason}
      forceLogout={true}
    />
  );
}
