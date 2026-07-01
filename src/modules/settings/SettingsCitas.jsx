import React, { useState, useEffect, useRef } from 'react';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';
import { toast } from '../../utils/toast';

export default function SettingsCitas({ inline, onBack }) {
  const citasModalRef = useRef(null);
  const [reminderOffset, setReminderOffset] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const state = await loadCrmState();
      setReminderOffset(Number(state.appointmentReminderOffset || 0));
    } catch (err) {
      console.error('Error al cargar la configuración de citas:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentState = await loadCrmState();
      await saveCrmState({ ...currentState, appointmentReminderOffset: Number(reminderOffset) });
      toast('Configuración de citas guardada ✓');
      window.dispatchEvent(new Event('stateUpdated'));
    } catch (err) {
      console.error('Error al guardar configuración de citas:', err);
      toast('Error al guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>📅 Citas y Recordatorios</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Configura el tiempo de anticipación para activar las notificaciones visuales de citas en el sistema
          </div>
        </div>
      </div>

      <div className="settings-field-group">
        <label className="settings-modern-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '12px', color: '#475569' }}>Mostrar alerta y notificar citas pendientes antes de:</span>
          <select
            value={reminderOffset}
            onChange={e => setReminderOffset(Number(e.target.value))}
            style={{
              width: '100%', maxWidth: '320px', padding: '8px 12px', borderRadius: '8px',
              border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600,
              color: '#0f172a', background: '#fff', outline: 'none'
            }}
          >
            <option value={0}>Sin límite (Mostrar siempre todas las citas futuras)</option>
            <option value={15}>15 minutos antes de la cita</option>
            <option value={30}>30 minutos antes de la cita</option>
            <option value={60}>1 hora antes de la cita</option>
            <option value={120}>2 horas antes de la cita</option>
            <option value={720}>12 horas antes de la cita</option>
            <option value={1440}>24 horas (1 día) antes de la cita</option>
            <option value={2880}>48 horas (2 días) antes de la cita</option>
            <option value={10080}>7 días (1 semana) antes de la cita</option>
          </select>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
            Las citas que falten más de este tiempo para su inicio no activarán la animación de campana ni se listarán en las notificaciones pendientes de los vendedores.
          </div>
        </label>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button
          className="settings-accent-btn"
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving ? '💾 Guardando...' : '💾 Guardar Configuración'}
        </button>
      </div>

      <div style={{
        marginTop: '20px', padding: '12px 16px', background: '#eff6ff',
        borderRadius: '10px', border: '1px solid #bfdbfe', fontSize: '11px', color: '#1e3a8a', lineHeight: 1.6
      }}>
        <strong>📌 ¿Cómo funciona?</strong><br />
        Esta configuración permite que la campana de notificaciones de citas en la barra lateral solo llame la atención de los usuarios cuando tengan citas verdaderamente próximas. Al configurar un tiempo límite (ej: 1 hora), las citas creadas con anticipación no resaltarán hasta que falte exactamente 1 hora para su realización.
      </div>
    </>
  );

  if (inline) {
    return (
      <div className="settings-section-card" style={{ overflow: 'visible' }}>
        {content}
      </div>
    );
  }

  return (
    <div className="modalBackdrop" id="citasBackdrop" hidden onClick={(e) => { if (citasModalRef.current && !citasModalRef.current.contains(e.target)) onBack?.(); }}>
      <div ref={citasModalRef} className="modal" role="dialog" aria-modal="true">
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Configuración de Citas</div>
            <div className="modalSubtitle">Ajusta el margen de anticipación para avisos de citas</div>
          </div>
          <button className="btn-exit" type="button" title="Cerrar" onClick={onBack}>
            <svg className="crm-icon-x" viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l10 10M14 4l-10 10" /></svg>
          </button>
        </div>
        <div className="modalBody">{content}</div>
        <div className="modalFooter">
          <div></div>
          <div className="rightActions">
            <button className="btn-exit" type="button" onClick={onBack}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
