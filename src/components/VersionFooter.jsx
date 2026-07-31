// VersionFooter.jsx
// Footer pequeño que muestra la versión actual del bundle y la del server.
// Útil para que el usuario (y soporte) siempre vea qué versión está corriendo.

import { useVersionCheck } from '../hooks/useVersionCheck';

export default function VersionFooter({ style, showServer = true, intervalMs, variant = 'light' }) {
  const { currentVersion, serverVersion, lastCheck, checking, checkNow } = useVersionCheck({
    intervalMs: intervalMs ?? 3 * 60 * 60 * 1000,
    enabled: showServer,
  });

  const hasMismatch = serverVersion && serverVersion !== currentVersion;
  const isDark = variant === 'dark';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '6px 12px',
        fontSize: '11px',
        color: isDark ? '#94a3b8' : '#64748b',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        userSelect: 'none',
        ...style,
      }}
      title={
        lastCheck
          ? `Última verificación: ${lastCheck.toLocaleString('es-ES')}`
          : 'Verificando versión...'
      }
    >
      <span
        style={{
          padding: '2px 6px',
          background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'}`,
          borderRadius: '4px',
          color: isDark ? '#cbd5e1' : '#475569',
        }}
      >
        v{currentVersion}
      </span>
      {showServer && serverVersion && (
        <>
          <span style={{ opacity: 0.5, color: isDark ? 'rgba(255,255,255,0.2)' : 'inherit' }}>·</span>
          <span
            style={{
              padding: '2px 6px',
              background: hasMismatch ? (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7') : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9'),
              border: `1px solid ${hasMismatch ? (isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a') : (isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0')}`,
              borderRadius: '4px',
              color: hasMismatch ? (isDark ? '#fbbf24' : '#92400e') : (isDark ? '#cbd5e1' : '#475569'),
            }}
          >
            server: v{serverVersion}
          </span>
        </>
      )}
      <button
        type="button"
        onClick={checkNow}
        disabled={checking}
        title="Verificar versión del servidor ahora"
        style={{
          background: 'transparent',
          border: 'none',
          color: isDark ? 'rgba(255, 255, 255, 0.4)' : '#94a3b8',
          cursor: checking ? 'wait' : 'pointer',
          padding: '0 4px',
          fontSize: '11px',
        }}
      >
        {checking ? '⟳' : '↻'}
      </button>
    </div>
  );
}
