import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { loadState, saveState } from '../../../services/stateService.js';
import { TIEMPOS_COMIDA } from '../constants/tiemposComida.js';

export default function OrdenTiemposEditor({ onSaved, inline = false, onClose }) {
  const [order, setOrder] = useState(() => TIEMPOS_COMIDA.map(t => t.id));
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      const state = await loadState();
      const saved = state?.informe_tiempos_orden;
      if (Array.isArray(saved) && saved.length > 0) {
        // Asegurar que todos los tiempos existentes estén presentes
        const existing = new Set(saved);
        const missing = TIEMPOS_COMIDA.map(t => t.id).filter(id => !existing.has(id));
        setOrder([...saved, ...missing]);
      } else {
        setOrder(TIEMPOS_COMIDA.map(t => t.id));
      }
    } catch (err) {
      console.error('Error cargando orden de tiempos:', err);
      setOrder(TIEMPOS_COMIDA.map(t => t.id));
    }
  }, []);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleDragStart = (idx) => setDragIdx(idx);

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newOrder = [...order];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(idx, 0, moved);
    setOrder(newOrder);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const state = await loadState();
      await saveState({ ...state, informe_tiempos_orden: order });
      toast.success('Orden de tiempos guardado ✓');
      window.dispatchEvent(new Event('stateUpdated'));
      onSaved?.(order);
      onClose?.();
    } catch (err) {
      console.error('Error guardando orden de tiempos:', err);
      toast.error('Error al guardar el orden');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setOrder(TIEMPOS_COMIDA.map(t => t.id));
  };

  const content = (
    <>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>🍽️ Orden de Tiempos de Comida</div>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
          Arrastra los tiempos para definir el orden en que aparecerán en el constructor de informes.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {order.map((id, idx) => {
          const tc = TIEMPOS_COMIDA.find(t => t.id === id);
          if (!tc) return null;
          return (
            <div
              key={id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: dragIdx === idx ? '#e0f2fe' : dragOverIdx === idx ? '#f1f5f9' : '#ffffff',
                border: `1px solid ${dragOverIdx === idx ? '#3b82f6' : '#e2e8f0'}`,
                borderLeft: `4px solid ${tc.color}`,
                borderRadius: '8px',
                cursor: 'grab',
                userSelect: 'none',
                transition: 'all 0.1s ease',
              }}
            >
              <span style={{ cursor: 'grab', color: '#94a3b8', fontSize: '16px' }}>≡</span>
              <span style={{ fontSize: '16px' }}>{tc.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', flex: 1 }}>{tc.label}</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>#{idx + 1}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '💾 Guardando...' : '💾 Guardar orden'}
        </button>
        <button
          onClick={handleReset}
          disabled={saving}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            color: '#475569',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🔄 Restaurar default
        </button>
        {!inline && (
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        )}
      </div>
    </>
  );

  if (inline) {
    return (
      <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        {content}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '420px',
          maxHeight: '80vh',
          overflowY: 'auto',
          padding: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
}
