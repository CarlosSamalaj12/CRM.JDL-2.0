import { useState, useEffect, useCallback } from 'react';
import historyService from '../../../services/historyService';

export default function HistoryPanel({ eventId, eventName, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

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
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
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
    <div style={{
      width: '520px',
      background: 'white',
      borderRadius: '20px',
      boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>📋 Historial de Cambios</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>{eventName}</p>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          fontSize: '20px',
          cursor: 'pointer',
          color: 'white'
        }}>×</button>
      </div>

      {/* Body */}
      <div style={bodyStyle}>
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
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600', lineHeight: '1.5' }}>
                    {entry.change}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', fontWeight: '600' }}>
                    👤 {entry.userName || 'Usuario'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={footerStyle}>
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