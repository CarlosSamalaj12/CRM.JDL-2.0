// ForceUpdateModal.jsx
// Modal full-screen OBLIGATORIO que se muestra cuando el server tiene una versión
// más reciente que la del cliente. No se cierra con ESC, click afuera ni nada.
// Único botón: "Actualizar ahora" → recarga la página (limpia el SW viejo).

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const REFRESH_COUNTDOWN_SECONDS = 30; // Auto-refresh si el usuario ignora el modal

export default function ForceUpdateModal({
  open = false,
  serverVersion,
  currentVersion,
  message,
  onUpdate,
  onDismiss, // opcional: si existe, se muestra botón secundario "Más tarde"
  reason,    // 'outdated' | 'below-min'
}) {
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_COUNTDOWN_SECONDS);

  useEffect(() => {
    if (!open) return undefined;
    setSecondsLeft(REFRESH_COUNTDOWN_SECONDS);

    // Bloquear ESC
    const onKey = (e) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    window.addEventListener('keydown', onKey);

    // Countdown → auto-refresh
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          if (onUpdate) onUpdate();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      window.removeEventListener('keydown', onKey);
      clearInterval(interval);
    };
  }, [open, onUpdate]);

  if (!open) return null;

  // Renderizar con portal en el body para que nada pueda "tapar" el modal
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-update-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647, // máx z-index posible
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(4px)',
        padding: '16px',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '440px',
          width: '100%',
          background: '#ffffff',
          borderRadius: '12px',
          padding: '28px 24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 16px',
            background: '#fef3c7',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
          }}
          aria-hidden="true"
        >
          🔄
        </div>

        <h2
          id="force-update-title"
          style={{
            margin: '0 0 8px',
            fontSize: '20px',
            fontWeight: 700,
            color: '#0f172a',
          }}
        >
          {reason === 'below-min' ? 'Actualización obligatoria' : 'Nueva versión disponible'}
        </h2>

        <p
          style={{
            margin: '0 0 20px',
            fontSize: '14px',
            color: '#475569',
            lineHeight: 1.5,
          }}
        >
          {message || 'Hay una nueva versión de la aplicación. Por favor actualiza para continuar.'}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#64748b',
          }}
        >
          <div
            style={{
              padding: '4px 10px',
              background: '#f1f5f9',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
            }}
          >
            Actual: <strong style={{ color: '#0f172a' }}>{currentVersion || '—'}</strong>
          </div>
          <div
            style={{
              padding: '4px 10px',
              background: '#dcfce7',
              borderRadius: '6px',
              border: '1px solid #bbf7d0',
            }}
          >
            Nueva: <strong style={{ color: '#15803d' }}>{serverVersion || '—'}</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={onUpdate}
          autoFocus
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#0f172a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#0f172a'; }}
        >
          Actualizar ahora
        </button>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              marginTop: '8px',
              width: '100%',
              padding: '8px',
              background: 'transparent',
              color: '#64748b',
              border: 'none',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Más tarde
          </button>
        )}

        <div
          style={{
            marginTop: '16px',
            fontSize: '11px',
            color: '#94a3b8',
          }}
        >
          La página se recargará automáticamente en{' '}
          <strong style={{ color: '#0f172a' }}>{secondsLeft}s</strong>
        </div>
      </div>
    </div>,
    document.body
  );
}
