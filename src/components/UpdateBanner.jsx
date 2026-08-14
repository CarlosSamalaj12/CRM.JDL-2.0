import { useState, useEffect, useCallback, useRef } from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';

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

  const { updateState, reload } = useVersionCheck({
    intervalMs: 15 * 60 * 1000 // Polling cada 15 minutos en background
  });

  // Escuchar el evento sw-update-ready (desde main.jsx cuando el SW se instala)
  useEffect(() => {
    const handler = (event) => {
      setWaitingWorker(event.detail);
      showBanner();
    };

    window.addEventListener('sw-update-ready', handler);
    return () => {
      window.removeEventListener('sw-update-ready', handler);
    };
  }, [updateState]);

  // Escuchar SW_ACTIVATED directamente desde el Service Worker
  const handleSWMessage = useCallback((data) => {
    if (data.type === 'SW_ACTIVATED') {
      showBanner();
    }
  }, []);
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

    // Si es una actualización obligatoria, no auto-descartar
    const isRequired = updateState?.reason === 'below-min';
    if (isRequired) {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
      return;
    }

    // Aumentar auto-dismiss a 45 segundos para dar suficiente tiempo en móviles
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    autoDismissRef.current = setTimeout(() => {
      setVisible(false);
      setDismissed(true);
    }, 45000);
  }

  // Mostrar el banner cuando el version checker detecte actualización
  useEffect(() => {
    if (updateState) {
      showBanner();
    }
  }, [updateState]);

  const targetVersion = updateState?.serverVersion || '';

  const handleUpdate = useCallback(async () => {
    setUpdating(true);
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    if (targetVersion) {
      try { sessionStorage.setItem('dismissed_version', targetVersion); } catch (_) {}
    }

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
    } catch (e) {
      console.warn('[UpdateBanner] Error al purgar cachés:', e);
    }

    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }

    const url = new URL(window.location.href);
    url.searchParams.set('_u', String(Date.now()));
    window.location.replace(url.toString());
  }, [waitingWorker, targetVersion]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
    if (targetVersion) {
      try { sessionStorage.setItem('dismissed_version', targetVersion); } catch (_) {}
    }
  }, [targetVersion]);

  if (!visible || dismissed) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 999999,
    }}>
      <style>{`
        @keyframes bannerSlideIn {
          0% { opacity: 0; transform: translateY(-120%) scale(0.95); }
          50% { transform: translateY(4px) scale(1.01); }
          70% { transform: translateY(-2px); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bannerGlow {
          0%, 100% { box-shadow: 0 4px 20px rgba(234, 179, 8, 0.15), 0 0 60px rgba(234, 179, 8, 0.05); }
          50% { box-shadow: 0 4px 30px rgba(234, 179, 8, 0.35), 0 0 80px rgba(234, 179, 8, 0.12); }
        }
        @keyframes iconPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.85; }
        }
        @keyframes ringWave {
          0% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.6); }
          70% { box-shadow: 0 0 0 20px rgba(234, 179, 8, 0); }
          100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes textPop {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
      `}</style>

      <div style={{
        background: 'linear-gradient(135deg, #7c2d12 0%, #92400e 25%, #b45309 50%, #d97706 75%, #92400e 100%)',
        backgroundSize: '200% 100%',
        animation: 'bannerSlideIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both, bannerGlow 3s ease-in-out infinite, shimmer 4s linear infinite',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        borderBottom: '2px solid rgba(251, 191, 36, 0.3)',
        flexWrap: 'wrap',
      }}>
        {/* Icono con anillo pulsante */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            animation: 'ringWave 2s ease-out infinite',
          }} />
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'iconPulse 2s ease-in-out infinite',
            boxShadow: '0 2px 12px rgba(251, 191, 36, 0.4)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c2d12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </div>
        </div>

        {/* Texto */}
        <div style={{
          color: '#fff',
          fontSize: '14px',
          fontWeight: 600,
          textAlign: 'center',
          animation: 'textPop 2.5s ease-in-out infinite',
        }}>
          <strong style={{ color: '#fbbf24', fontSize: '15px' }}>
            ⚡ ¡Nueva versión disponible!
          </strong>
          <span style={{ color: '#fde68a', fontWeight: 400, marginLeft: '6px' }}>
            {updateState?.message || 'Hay cambios nuevos en el sistema. Actualiza para recibirlos.'}
          </span>
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleUpdate}
            disabled={updating}
            onMouseEnter={() => !updating && setUpdateHovered(true)}
            onMouseLeave={() => setUpdateHovered(false)}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: updating
                ? '#cbd5e1'
                : updateHovered
                  ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
                  : 'linear-gradient(135deg, #d97706, #f59e0b)',
              color: updating ? '#64748b' : '#7c2d12',
              fontSize: '12px',
              fontWeight: 900,
              cursor: updating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              boxShadow: updating
                ? 'none'
                : updateHovered
                  ? '0 4px 16px rgba(245, 158, 11, 0.5), inset 0 1px 0 rgba(255,255,255,0.3)'
                  : '0 2px 8px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
              transform: !updating && updateHovered ? 'translateY(-1px) scale(1.02)' : 'translateY(0) scale(1)',
              opacity: updating ? 0.8 : 1,
            }}
          >
            {updating ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: 'shimmer 1.5s linear infinite' }}>
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                Actualizando...
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Actualizar ahora
              </>
            )}
          </button>

          {/* Solo mostrar botón Cerrar si no es una actualización requerida obligatoria */}
          {updateState?.reason !== 'below-min' && (
            <button
              onClick={handleDismiss}
              disabled={updating}
              onMouseEnter={() => !updating && setCloseHovered(true)}
              onMouseLeave={() => setCloseHovered(false)}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: closeHovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                color: closeHovered ? '#fff' : '#fde68a',
                cursor: updating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                opacity: updating ? 0.3 : 1,
              }}
              title="Cerrar"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
