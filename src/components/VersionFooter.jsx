// VersionFooter.jsx
// Footer pequeño que muestra la versión actual del bundle y la del server.
// Útil para que el usuario (y soporte) siempre vea qué versión está corriendo.

import { useVersionCheck } from '../hooks/useVersionCheck';

export default function VersionFooter({ style, showServer = true, intervalMs }) {
  const { currentVersion, serverVersion, lastCheck, checking, checkNow } = useVersionCheck({
    intervalMs: intervalMs ?? 3 * 60 * 60 * 1000,
    enabled: showServer,
  });

  const hasMismatch = serverVersion && serverVersion !== currentVersion;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '6px 12px',
        fontSize: '11px',
        color: '#94a3b8',
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
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          color: '#475569',
        }}
      >
        v{currentVersion}
      </span>
      {showServer && serverVersion && (
        <>
          <span style={{ opacity: 0.5 }}>·</span>
          <span
            style={{
              padding: '2px 6px',
              background: hasMismatch ? '#fef3c7' : '#f1f5f9',
              border: `1px solid ${hasMismatch ? '#fde68a' : '#e2e8f0'}`,
              borderRadius: '4px',
              color: hasMismatch ? '#92400e' : '#475569',
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
          color: '#94a3b8',
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
