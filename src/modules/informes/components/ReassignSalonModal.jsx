import React, { useState, useEffect } from 'react';
import { loadState as loadCrmState } from '../../../services/stateService';
import { reassignInformeSlot } from '../services/api';
import { useToast } from '../context/ToastContext';
import { IconRefreshCw, IconX, IconCheck } from './Icons';

export default function ReassignSalonModal({
  isOpen,
  informeId,
  currentSalon = '',
  currentOcupacionId = '',
  dias = [],
  onClose,
  onReassigned,
}) {
  const toast = useToast();
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [updateDayContent, setUpdateDayContent] = useState(true);

  useEffect(() => {
    if (!isOpen || !currentOcupacionId) return;

    let mounted = true;
    setLoadingSlots(true);

    loadCrmState()
      .then(state => {
        if (!mounted) return;
        const allEvts = Array.isArray(state?.events) ? state.events : [];
        const cleanId = (id) => String(id || '').replace(/^#/, '').trim();
        const normId = cleanId(currentOcupacionId);
        const baseId = normId.replace(/_(s|slot)\d+.*$/, '');

        // Encontrar evento y grupo
        const targetEv = allEvts.find(e => {
          const eId = cleanId(e.id || e.Idocupacion);
          const egId = cleanId(e.groupId);
          return eId === normId || egId === normId || eId === baseId || egId === baseId;
        });

        const gId = cleanId(targetEv?.groupId || baseId || normId);
        const series = allEvts.filter(e => {
          const eId = cleanId(e.id || e.Idocupacion || '');
          const egId = cleanId(e.groupId || '');
          return egId === gId || eId === gId || (baseId && eId.startsWith(baseId));
        });

        const slots = [];
        series.forEach(ev => {
          const sId = cleanId(ev.id || ev.Idocupacion || '');
          const sDate = String(ev.date || ev.eventDateStart || ev.FechaEvento || '').slice(0, 10);
          const sSalon = String(ev.salon || ev.nombre_salon || ev.Salon || '').trim();
          const sHorario = (ev.startTime && ev.endTime)
            ? `${ev.startTime} - ${ev.endTime}`
            : (ev.HoraI && ev.HoraF ? `${ev.HoraI} - ${ev.HoraF}` : '');
          const sPax = ev.slotPax || ev.pax || ev.Pax || '';

          if (sSalon && sDate) {
            slots.push({
              id: sId,
              salon: sSalon,
              fecha: sDate,
              horario: sHorario,
              pax: sPax,
              isCurrent: sId === normId
            });
          }
        });

        // Ordenar por fecha cronológica
        slots.sort((a, b) => a.fecha.localeCompare(b.fecha));
        setAvailableSlots(slots);

        // Preseleccionar el primer slot disponible diferente al actual o el primero
        const diffIdx = slots.findIndex(s => !s.isCurrent);
        setSelectedSlotIndex(diffIdx !== -1 ? diffIdx : 0);
      })
      .catch(err => {
        console.warn('Error al cargar salones del CRM:', err);
      })
      .finally(() => {
        if (mounted) setLoadingSlots(false);
      });

    return () => { mounted = false; };
  }, [isOpen, currentOcupacionId, currentSalon]);

  if (!isOpen) return null;

  const handleApply = async () => {
    const chosenSlot = availableSlots[selectedSlotIndex];
    if (!chosenSlot) {
      toast.error('Selecciona un salón destino');
      return;
    }

    if (chosenSlot.isCurrent) {
      toast.error('El informe ya está asignado a este salón. Selecciona otro salón para transferirlo.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        targetSlotId: chosenSlot.id,
        targetSalon: updateDayContent ? chosenSlot.salon : undefined,
        targetHorario: updateDayContent ? chosenSlot.horario : undefined,
        targetFecha: updateDayContent ? chosenSlot.fecha : undefined,
      };

      await reassignInformeSlot(informeId, payload);
      toast.success(`Informe transferido exitosamente a ${chosenSlot.salon}`);
      if (typeof onReassigned === 'function') {
        onReassigned({
          targetSlotId: chosenSlot.id,
          targetSalon: chosenSlot.salon,
          targetHorario: chosenSlot.horario,
          targetFecha: chosenSlot.fecha,
        });
      }
      if (typeof onClose === 'function') onClose();
    } catch (err) {
      toast.error(err.message || 'Error al reasignar salón');
    } finally {
      setSaving(false);
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
        if (e.target === e.currentTarget && typeof onClose === 'function') onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Cabecera */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{
                background: '#e0f2fe',
                color: '#0284c7',
                fontSize: '11px',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: '6px',
                letterSpacing: '0.04em'
              }}>
                LOGÍSTICA DE EVENTO
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              Reasignar Salón u Ocupación
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: '20px 24px', maxHeight: '380px', overflowY: 'auto' }}>
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            fontSize: '12.5px',
            color: '#475569'
          }}>
            <div><strong>Informe actual:</strong> #{informeId}</div>
            <div><strong>Salón vinculado:</strong> <span style={{ color: '#0284c7', fontWeight: '800' }}>{currentSalon || 'No asignado'}</span></div>
            <div><strong>Ocupación vinculada:</strong> <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: '4px', fontSize: '11.5px' }}>#{currentOcupacionId}</code></div>
          </div>

          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
            Selecciona el salón/fecha de la reserva a donde transferir el informe:
          </label>

          {loadingSlots ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
              Cargando salones del evento...
            </div>
          ) : availableSlots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
              No se encontraron otros salones en esta reserva.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {availableSlots.map((slot, idx) => {
                const isSelected = selectedSlotIndex === idx;
                return (
                  <div
                    key={slot.id || idx}
                    onClick={() => setSelectedSlotIndex(idx)}
                    style={{
                      border: isSelected ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: isSelected ? '#f0f9ff' : '#ffffff',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: isSelected ? '#0369a1' : '#1e293b' }}>
                          {slot.salon}
                        </span>
                        {slot.isCurrent ? (
                          <span style={{ fontSize: '11px', fontWeight: '700', background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                            ● Salón Actual
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', fontWeight: '600', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '6px' }}>
                            Disponible
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        📅 {slot.fecha} {slot.horario ? `· ⏰ ${slot.horario}` : ''} {slot.pax ? `· 👥 ${slot.pax} pax` : ''}
                      </div>
                    </div>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: isSelected ? '6px solid #0284c7' : '2px solid #cbd5e1',
                      background: '#ffffff',
                      boxSizing: 'border-box'
                    }} />
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
            <label
              onClick={(e) => {
                e.preventDefault();
                setUpdateDayContent(prev => !prev);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              {/* Checkbox ejecutivo personalizado con IconCheck visible */}
              <div
                style={{
                  width: '20px',
                  minWidth: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  border: updateDayContent ? '2px solid #0284c7' : '2px solid #94a3b8',
                  background: updateDayContent ? '#0284c7' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: updateDayContent ? '0 2px 6px rgba(2, 132, 199, 0.25)' : 'none',
                  flexShrink: 0,
                  boxSizing: 'border-box'
                }}
              >
                {updateDayContent && (
                  <IconCheck size={13} color="#ffffff" strokeWidth={3} />
                )}
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155', lineHeight: 1.3 }}>
                Actualizar también el nombre de salón y horario en el informe
              </span>
            </label>
          </div>
        </div>

        {/* Pie de acciones */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #e2e8f0',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
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
            onClick={handleApply}
            disabled={saving || availableSlots.length === 0 || availableSlots[selectedSlotIndex]?.isCurrent}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#ffffff',
              background: (availableSlots[selectedSlotIndex]?.isCurrent) ? '#94a3b8' : 'linear-gradient(135deg, #005954 0%, #0284c7 100%)',
              border: 'none',
              borderRadius: '8px',
              cursor: (saving || availableSlots.length === 0 || availableSlots[selectedSlotIndex]?.isCurrent) ? 'not-allowed' : 'pointer',
              opacity: (saving || availableSlots.length === 0 || availableSlots[selectedSlotIndex]?.isCurrent) ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <IconRefreshCw size={14} />
            {saving ? 'Reasignando...' : (availableSlots[selectedSlotIndex]?.isCurrent ? 'Salón Ya Asignado' : 'Aplicar Reasignación')}
          </button>
        </div>
      </div>
    </div>
  );
}
