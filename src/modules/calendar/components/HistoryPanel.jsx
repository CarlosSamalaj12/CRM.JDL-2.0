import { useState, useEffect, useCallback } from 'react';
import historyService from '../../../services/historyService';

export default function HistoryPanel({ eventId, eventName, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredEntryId, setHoveredEntryId] = useState(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await historyService.getByEventId(eventId);
      setHistory(data);
    } catch {
      console.error('Error cargando historial:');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const formatTimestamp = (isoStr) => {
    const d = new Date(isoStr);
    return d.toLocaleString('es-ES', {
      year: 'numeric',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const headerStyle = {
    background: '#0b1c30',
    color: 'white',
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const bodyStyle = {
    padding: '24px',
    maxHeight: '420px',
    overflowY: 'auto',
    background: '#f8fafc'
  };

  const footerStyle = {
    padding: '16px 24px',
    borderTop: '2px solid #f1f5f9',
    background: 'white',
    textAlign: 'center'
  };

  return (
    <div className="hist-modal-container" style={{
      width: '520px',
      maxWidth: 'calc(100vw - 40px)',
      background: 'white',
      borderRadius: '20px',
      boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25)',
      overflow: 'hidden'
    }}>
      <style>{`
        .btn-exit-modal {
          background: rgba(255,255,255,0.1) !important;
          color: white !important;
          border: none !important;
          border-radius: 50% !important;
          width: 36px !important;
          height: 36px !important;
          padding: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          position: relative !important;
          overflow: visible !important;
          outline: none !important;
        }
        .btn-exit-modal:hover {
          background: rgba(239, 68, 68, 0.3) !important;
          color: #fca5a5 !important;
        }
        .btn-exit-modal:active {
          transform: scale(0.88) !important;
        }
        .btn-exit-modal svg {
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        }
        .btn-exit-modal:hover svg {
          transform: rotate(90deg) scale(1.2) !important;
        }
        @media (max-width: 600px) {
          .hist-modal-container {
            max-width: calc(100vw - 32px) !important;
            width: 100% !important;
            border-radius: 16px !important;
            max-height: calc(100dvh - 32px) !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .hist-modal-header {
            padding: 14px 16px !important;
          }
          .hist-modal-header h2 {
            font-size: 17px !important;
          }
          .hist-modal-header p {
            font-size: 12px !important;
          }
          .hist-modal-body {
            padding: 16px !important;
            max-height: calc(100dvh - 200px) !important;
          }
          .hist-modal-footer {
            padding: 12px 16px !important;
          }
          .hist-modal-footer button {
            width: 100% !important;
          }
        }
        @media (max-width: 380px) {
          .hist-modal-container {
            max-width: calc(100vw - 16px) !important;
            max-height: calc(100dvh - 16px) !important;
          }
          .hist-modal-header {
            padding: 10px 12px !important;
          }
          .hist-modal-body {
            padding: 12px !important;
          }
          .hist-modal-footer {
            padding: 10px 12px !important;
          }
        }
      `}</style>
      {/* Header */}
      <div className="hist-modal-header" style={headerStyle}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>📋 Historial de Cambios</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>{eventName}</p>
        </div>
        <button onClick={onClose} className="btn-exit-modal">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="16" height="16">
            <path d="M4 4l10 10M14 4l-10 10" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="hist-modal-body" style={bodyStyle}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontWeight: '600' }}>
            Cargando...
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
            <div style={{ fontWeight: '700', fontSize: '16px', color: '#64748b' }}>No hay cambios registrados</div>
            <div style={{ fontSize: '13px', marginTop: '8px' }}>Los cambios aparecerán aquí cuando modifique la reserva</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {history.slice().reverse().map((entry, idx) => (
              <div key={entry.id || idx} style={{
                position: 'relative',
                paddingLeft: '28px'
              }}>
                {/* Timeline dot */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '6px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: idx === 0 ? '#2563eb' : '#cbd5e1',
                  border: '3px solid white',
                  boxShadow: '0 0 0 2px #e2e8f0'
                }} />
                
                <div style={{
                  background: idx === 0 ? '#f0f7ff' : 'white',
                  padding: '16px',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <span
                      title={entry.at || entry.timestamp}
                      style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', cursor: 'help' }}
                    >
                      {formatTimestamp(entry.at || entry.timestamp)}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600', lineHeight: '1.5' }}>
                    {entry.change}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', position: 'relative' }}>
                    <div
                      style={{ position: 'relative', display: 'inline-flex' }}
                      onMouseEnter={() => setHoveredEntryId(entry.id || idx)}
                      onMouseLeave={() => setHoveredEntryId(null)}
                    >
                      <img
                        src={entry.avatarDataUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.actorName || entry.userName || 'Usuario')}&background=cbd5e1&color=64748b&size=28`}
                        alt={entry.actorName || entry.userName || 'Usuario'}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #e2e8f0',
                          flexShrink: 0,
                          cursor: 'pointer'
                        }}
                      />
                      {/* Custom tooltip */}
                      <div className="custom-avatar-tooltip"
                        style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 8px)',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#0f172a',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none',
                          opacity: (hoveredEntryId === (entry.id || idx)) ? 1 : 0,
                          transition: 'opacity 0.18s ease, transform 0.18s ease',
                          transform: `translateX(-50%) translateY(${(hoveredEntryId === (entry.id || idx)) ? 0 : 4}px)`,
                          zIndex: 100,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
                        }}
                      >
                        {entry.actorName || entry.userName || 'Usuario'}
                        {/* Arrow */}
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 0,
                          height: 0,
                          borderLeft: '5px solid transparent',
                          borderRight: '5px solid transparent',
                          borderTop: '5px solid #0f172a'
                        }} />
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                      {entry.actorName || entry.userName || 'Usuario'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="hist-modal-footer" style={footerStyle}>
        <button onClick={onClose} className="btn-cancel" style={{
          padding: '12px 48px',
          borderRadius: '12px',
          fontSize: '14px'
        }}>
          Cerrar
        </button>
      </div>
    </div>
  );
}