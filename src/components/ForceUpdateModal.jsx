// ForceUpdateModal.jsx
// Modal full-screen OBLIGATORIO que se muestra cuando el server tiene una versión
// más reciente que la del cliente. No se cierra con ESC, click afuera ni nada.
// Botón: "Actualizar y reiniciar sesión" → limpia cachés, purga Service Workers y renueva sesión.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function ForceUpdateModal({
  open = false,
  serverVersion,
  currentVersion,
  message,
  onUpdate,
  reason,    // 'force-logout' | 'outdated' | 'below-min'
  forceLogout = true,
}) {
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    // Bloquear ESC
    const onKey = (e) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;

  const handleAction = async () => {
    if (updating) return;
    setUpdating(true);
    if (onUpdate) {
      await onUpdate();
    }
  };

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
        background: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(6px)',
        padding: '16px',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '440px',
          width: '100%',
          background: '#ffffff',
          borderRadius: '16px',
          padding: '32px 26px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
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
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.25)',
          }}
          aria-hidden="true"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#b45309"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: updating ? 'spin 1s linear infinite' : 'none' }}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
        </div>

        <h2
          id="force-update-title"
          style={{
            margin: '0 0 8px',
            fontSize: '20px',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.02em',
          }}
        >
          Actualización obligatoria
        </h2>

        <p
          style={{
            margin: '0 0 20px',
            fontSize: '13.5px',
            color: '#475569',
            lineHeight: 1.5,
          }}
        >
          {message ||
            'Se ha desplegado una nueva versión del sistema con mejoras críticas. Se cerrará la sesión y se renovará la caché para sincronizar tu navegador.'}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            marginBottom: '20px',
            fontSize: '12px',
            color: '#64748b',
          }}
        >
          <div
            style={{
              padding: '5px 12px',
              background: '#f1f5f9',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontWeight: 600,
            }}
          >
            Actual: <strong style={{ color: '#0f172a' }}>{currentVersion || '—'}</strong>
          </div>
          <div
            style={{
              padding: '5px 12px',
              background: '#dcfce7',
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              fontWeight: 600,
            }}
          >
            Nueva: <strong style={{ color: '#15803d' }}>{serverVersion || '—'}</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAction}
          disabled={updating}
          autoFocus
          style={{
            width: '100%',
            padding: '13px 18px',
            background: updating ? '#64748b' : '#0f172a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14.5px',
            fontWeight: 700,
            cursor: updating ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)',
          }}
          onMouseEnter={(e) => { if (!updating) e.currentTarget.style.background = '#1e293b'; }}
          onMouseLeave={(e) => { if (!updating) e.currentTarget.style.background = '#0f172a'; }}
        >
          {updating ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span>Actualizando y limpiando caché...</span>
            </>
          ) : (
            <span>Actualizar y reiniciar sesión</span>
          )}
        </button>
      </div>
    </div>,
    document.body
  );
}
