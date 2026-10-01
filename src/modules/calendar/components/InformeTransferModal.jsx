import React, { useState, useEffect } from 'react';

// ─── Iconografía Minimalista SVG Moderna ───
const IconSwap = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>
  </svg>
);

const IconArchive = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
  </svg>
);

const IconUtensils = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M15 2v18"/><path d="M7 2v20"/><path d="M3 2v4a4 4 0 0 0 4 4 4 4 0 0 0 4-4V2"/>
  </svg>
);

const IconShieldAlert = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 2 8 4v6c0 5.25-3.5 10-8 12-4.5-2-8-6.75-8-12V6l8-4Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
  </svg>
);

const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconBuilding = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/>
  </svg>
);

const IconCalendar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
  </svg>
);

const IconFileText = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/>
  </svg>
);

const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconInfo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/>
  </svg>
);

const IconAlertTriangle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
  </svg>
);

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

/**
 * Modal Inteligente Ejecutivo de Blindaje Antidesfase de Informes.
 * Permite resolver conflictos ante cambios en fechas o salones con 3 acciones:
 *  - Reasignar a un nuevo slot/salón válido dentro de la nueva reserva.
 *  - Desvincular / Archivar para preservación histórica sin perder datos culinarios.
 *  - Eliminar con soft-delete y registro de auditoría.
 */
export default function InformeTransferModal({
  isOpen,
  conflicts = [],
  affectedInformes = [],
  availableSlots = [],
  onConfirm,
  onProceedWithoutTransfer,
  onCancel,
  isSubmitting = false
}) {
  // Normalizar lista de conflictos proveniente de props
  const rawList = conflicts && conflicts.length > 0 ? conflicts : affectedInformes;

  const normalizedConflicts = (rawList || []).map(item => ({
    informeId: item.informeId || item.id,
    diaId: item.diaId || null,
    fecha: item.fecha || item.currentDate || '',
    salon: item.salon || item.currentSalon || 'No especificado',
    menuNombre: item.menuNombre || item.menu_nombre || 'Menú programado',
    horario: item.horario || '',
    version: item.version || 1
  }));

  const [resolutions, setResolutions] = useState({});

  useEffect(() => {
    if (!isOpen || normalizedConflicts.length === 0) return;

    const initial = {};
    normalizedConflicts.forEach((c) => {
      const key = `${c.informeId}_${c.diaId || 'main'}`;
      // Intentar auto-seleccionar slot disponible que coincida en fecha
      const matchingSlot = availableSlots.find(s => {
        const start = String(s.dateStart || s.date || '').slice(0, 10);
        const end = String(s.dateEnd || start).slice(0, 10);
        return c.fecha >= start && c.fecha <= end;
      });

      const fallbackSlot = availableSlots[0];
      const target = matchingSlot || fallbackSlot;

      initial[key] = {
        informeId: c.informeId,
        diaId: c.diaId,
        action: 'reassign', // 'reassign' | 'archive' | 'delete'
        targetSlotId: target ? String(target.id) : '',
        targetSalon: target ? target.salon : '',
        targetFecha: c.fecha || (target ? (target.dateStart || target.date) : ''),
        targetHorario: target ? `${target.startTime || '10:00'} - ${target.endTime || '12:00'}` : c.horario
      };
    });

    setResolutions(initial);
  }, [isOpen, rawList.length, availableSlots.length]);

  if (!isOpen || normalizedConflicts.length === 0) return null;

  const handleActionToggle = (key, newAction) => {
    setResolutions(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        action: newAction
      }
    }));
  };

  const handleSlotSelect = (key, slotId) => {
    const selectedSlot = availableSlots.find(s => String(s.id) === String(slotId));
    setResolutions(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        targetSlotId: slotId,
        targetSalon: selectedSlot?.salon || '',
        targetHorario: selectedSlot ? `${selectedSlot.startTime || '10:00'} - ${selectedSlot.endTime || '12:00'}` : '',
        targetFecha: selectedSlot ? (selectedSlot.dateStart || selectedSlot.date || prev[key]?.targetFecha) : prev[key]?.targetFecha
      }
    }));
  };

  const handleApplyResolutions = () => {
    const resList = Object.values(resolutions);
    if (typeof onConfirm === 'function') {
      onConfirm(resList);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(5px)',
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
          borderRadius: '20px',
          width: '100%',
          maxWidth: '680px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
          animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Cabecera Moderna */}
        <div style={{
          padding: '22px 28px 18px 28px',
          borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
              <div style={{
                background: '#fef3c7',
                borderRadius: '9px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <IconShieldAlert />
              </div>
              <span style={{
                background: '#fef3c7',
                color: '#b45309',
                fontSize: '11px',
                fontWeight: '800',
                padding: '3px 9px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}>
                Blindaje Antidesfase de Informes
              </span>
            </div>

            <h2 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
              Resolución de Informes por Modificación de Reserva
            </h2>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
              Has modificado las fechas o salones de la reserva. El sistema detectó informes activos con logística y menús que requieren destino:
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            title="Cerrar"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <IconX />
          </button>
        </div>

        {/* Lista de Conflictos Bento */}
        <div style={{ padding: '20px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {normalizedConflicts.map((c) => {
            const key = `${c.informeId}_${c.diaId || 'main'}`;
            const currentRes = resolutions[key] || { action: 'reassign' };
            const isDeleting = currentRes.action === 'delete';
            const isArchiving = currentRes.action === 'archive';

            return (
              <div
                key={key}
                style={{
                  background: isDeleting ? '#fff1f2' : (isArchiving ? '#f8fafc' : '#ffffff'),
                  border: isDeleting ? '1.5px solid #fecdd3' : (isArchiving ? '1.5px solid #cbd5e1' : '1.5px solid #e2e8f0'),
                  borderRadius: '16px',
                  padding: '16px 18px',
                  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.18s ease'
                }}
              >
                {/* Meta del Conflicto */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '12.5px',
                      fontWeight: '800',
                      color: '#0369a1',
                      background: '#e0f2fe',
                      padding: '3px 9px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <IconFileText />
                      <span>Informe #{c.informeId} (v{c.version})</span>
                    </span>
                    <span style={{
                      fontSize: '12.5px',
                      fontWeight: '700',
                      color: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <IconCalendar /> {c.fecha || 'Sin fecha específica'}
                    </span>
                  </div>

                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <IconBuilding /> Salón previo: <strong style={{ color: '#0f172a' }}>{c.salon}</strong>
                  </span>
                </div>

                {/* Resumen Menú / Montaje */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: isDeleting ? '#ffe4e6' : '#f1f5f9',
                  padding: '7px 12px',
                  borderRadius: '9px',
                  marginBottom: '12px',
                  fontSize: '12.5px',
                  color: isDeleting ? '#9f1239' : '#334155'
                }}>
                  <IconUtensils />
                  <span><strong>Menú asignado:</strong> {c.menuNombre}</span>
                  {c.horario && (
                    <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <IconClock />
                      <span>{c.horario}</span>
                    </span>
                  )}
                </div>

                {/* Barra de Acciones Tri-Estado (Pills no nativas) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                  background: '#f1f5f9',
                  padding: '4px',
                  borderRadius: '11px',
                  marginBottom: '12px'
                }}>
                  {/* Botón Reasignar */}
                  <button
                    type="button"
                    onClick={() => handleActionToggle(key, 'reassign')}
                    style={{
                      border: 'none',
                      background: currentRes.action === 'reassign' ? '#ffffff' : 'transparent',
                      color: currentRes.action === 'reassign' ? '#0284c7' : '#64748b',
                      fontWeight: '700',
                      fontSize: '12px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: currentRes.action === 'reassign' ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <IconSwap /> Reasignar
                  </button>

                  {/* Botón Archivar */}
                  <button
                    type="button"
                    onClick={() => handleActionToggle(key, 'archive')}
                    style={{
                      border: 'none',
                      background: currentRes.action === 'archive' ? '#ffffff' : 'transparent',
                      color: currentRes.action === 'archive' ? '#334155' : '#64748b',
                      fontWeight: '700',
                      fontSize: '12px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: currentRes.action === 'archive' ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <IconArchive /> Archivar
                  </button>

                  {/* Botón Eliminar */}
                  <button
                    type="button"
                    onClick={() => handleActionToggle(key, 'delete')}
                    style={{
                      border: 'none',
                      background: currentRes.action === 'delete' ? '#ffffff' : 'transparent',
                      color: currentRes.action === 'delete' ? '#e11d48' : '#64748b',
                      fontWeight: '700',
                      fontSize: '12px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: currentRes.action === 'delete' ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <IconTrash /> Eliminar
                  </button>
                </div>

                {/* Sub-Panel según Acción */}
                {currentRes.action === 'reassign' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                      Transferir a nuevo salón disponible dentro de la reserva:
                    </label>
                    <select
                      value={currentRes.targetSlotId}
                      onChange={(e) => handleSlotSelect(key, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        fontSize: '13px',
                        fontWeight: '600',
                        borderRadius: '9px',
                        border: '1.5px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {availableSlots.map(slot => {
                        const sStart = String(slot.dateStart || slot.date || '').slice(0, 10);
                        const sEnd = String(slot.dateEnd || sStart).slice(0, 10);
                        const isDateMatch = c.fecha && c.fecha >= sStart && c.fecha <= sEnd;
                        const prefix = isDateMatch ? '⭐ (Misma Fecha) ' : '';
                        return (
                          <option key={slot.id} value={slot.id}>
                            {prefix}{slot.salon} — {sStart}{sEnd !== sStart ? ` al ${sEnd}` : ''} ({slot.startTime || '10:00'} - {slot.endTime || '12:00'})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {currentRes.action === 'archive' && (
                  <div style={{
                    fontSize: '12px',
                    color: '#475569',
                    background: '#f8fafc',
                    padding: '9px 13px',
                    borderRadius: '9px',
                    borderLeft: '3.5px solid #0284c7',
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <span style={{ marginTop: '2px', flexShrink: 0 }}><IconInfo /></span>
                    <span><strong>Conservación Histórica:</strong> El informe se desvinculará del calendario activo y se guardará íntegro con sus menús e ingredientes en el archivo histórico.</span>
                  </div>
                )}

                {currentRes.action === 'delete' && (
                  <div style={{
                    fontSize: '12px',
                    color: '#9f1239',
                    background: '#ffe4e6',
                    padding: '9px 13px',
                    borderRadius: '9px',
                    borderLeft: '3.5px solid #f43f5e',
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <span style={{ marginTop: '2px', flexShrink: 0 }}><IconAlertTriangle /></span>
                    <span><strong>Soft Delete Auditado:</strong> El informe será marcado como eliminado con registro en auditoría. Podrá ser consultado o restaurado por administradores.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pie de Acciones */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid #f1f5f9',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#475569',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '9px',
              cursor: 'pointer'
            }}
          >
            Cancelar Modificación
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {typeof onProceedWithoutTransfer === 'function' && (
              <button
                type="button"
                onClick={onProceedWithoutTransfer}
                disabled={isSubmitting}
                style={{
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#334155',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '9px',
                  cursor: 'pointer'
                }}
              >
                Guardar sin Transferir
              </button>
            )}

            <button
              type="button"
              onClick={handleApplyResolutions}
              disabled={isSubmitting}
              title="Guardar y Transferir Informe"
              style={{
                padding: '10px 22px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#ffffff',
                background: 'linear-gradient(135deg, #005954 0%, #0284c7 100%)',
                border: 'none',
                borderRadius: '9px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.28)'
              }}
            >
              <IconCheck /> {isSubmitting ? 'Guardando...' : 'Confirmar y Guardar Reserva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
