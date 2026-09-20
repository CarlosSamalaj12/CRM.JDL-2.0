import React, { useState } from 'react';

/**
 * Modal inteligente que se dispara al guardar una reserva en el Calendario
 * si el sistema detecta que un salón que ya contaba con un informe activo
 * ha sido modificado, acortado o cambiado de fecha.
 */
export default function InformeTransferModal({
  isOpen,
  affectedInformes = [],
  availableSlots = [],
  onConfirm,
  onProceedWithoutTransfer,
  onCancel,
}) {
  const [transfers, setTransfers] = useState(() => {
    const initial = {};
    affectedInformes.forEach(inf => {
      // Intentar auto-seleccionar el slot que coincida con la fecha del informe
      const matchingIdx = availableSlots.findIndex(s => {
        const start = s.dateStart || '';
        const end = s.dateEnd || start;
        return inf.currentDate >= start && inf.currentDate <= end;
      });
      initial[inf.id] = matchingIdx !== -1 ? String(matchingIdx) : '0';
    });
    return initial;
  });

  if (!isOpen) return null;

  const handleSelectChange = (infId, value) => {
    setTransfers(prev => ({ ...prev, [infId]: value }));
  };

  const handleApplyTransfers = () => {
    if (typeof onConfirm === 'function') {
      onConfirm(transfers);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999999,
        padding: '16px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && typeof onCancel === 'function') onCancel();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Cabecera */}
        <div style={{ padding: '20px 24px 16px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              background: '#fef3c7',
              color: '#d97706',
              fontSize: '11px',
              fontWeight: '800',
              padding: '3px 8px',
              borderRadius: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              ⚠️ TRANSFERENCIA DE INFORME
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
            Salón con Informe de Evento Detectado
          </h2>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
            Has modificado las fechas o salones de la reserva, pero existen informes de evento activos con menús y logística programados.
          </p>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: '20px 24px', maxHeight: '380px', overflowY: 'auto' }}>
          {affectedInformes.map((inf) => {
            const selectedVal = transfers[inf.id] ?? '0';
            return (
              <div
                key={inf.id}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  marginBottom: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#1e293b' }}>
                    📄 Informe #{inf.id} (v{inf.version || 1})
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                    {inf.currentDate || 'Sin fecha'}
                  </span>
                </div>

                <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '10px', lineHeight: 1.4 }}>
                  <div><strong>Salón previo:</strong> {inf.currentSalon || 'No especificado'}</div>
                  <div><strong>Menú asignado:</strong> {inf.menuNombre || 'Servicio programado'}</div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    ¿A qué salón de la nueva reserva deseas transferir este informe?
                  </label>
                  <select
                    value={selectedVal}
                    onChange={(e) => handleSelectChange(inf.id, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {availableSlots.map((slot, idx) => {
                      const isDateMatch = inf.currentDate && inf.currentDate >= (slot.dateStart || '') && inf.currentDate <= (slot.dateEnd || slot.dateStart || '');
                      const prefix = isDateMatch ? '⭐ (Recomendado) ' : '';
                      return (
                        <option key={idx} value={String(idx)}>
                          {prefix}{slot.salon} — {slot.dateStart}{slot.dateEnd && slot.dateEnd !== slot.dateStart ? ` al ${slot.dateEnd}` : ''} ({slot.startTime} - {slot.endTime})
                        </option>
                      );
                    })}
                    <option value="none">Conservar salón previo sin transferir</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pie de acciones */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#475569',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onProceedWithoutTransfer}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#334155',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Guardar sin Transferir
          </button>

          <button
            type="button"
            onClick={handleApplyTransfers}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#ffffff',
              background: 'linear-gradient(135deg, #005954 0%, #0284c7 100%)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
            }}
          >
            ✓ Guardar y Transferir Informe
          </button>
        </div>
      </div>
    </div>
  );
}
