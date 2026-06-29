import { useState, useEffect, useCallback } from 'react';
import reminderService from '../../../services/reminderService';
import authService from '../../../services/authService';
import api from '../../../services/api';
import ConfirmModal from '../../../components/ConfirmModal';
import { toast } from '../../../utils/toast';

export default function AppointmentModal({ eventId, eventName, onClose, onSaved }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newReminder, setNewReminder] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    channel: 'whatsapp',
    notes: ''
  });
  const [editingReminderId, setEditingReminderId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, reminderId: null });
  
  const currentUser = authService.getCurrentUser();

  const loadReminders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reminderService.getByEventId(eventId);
      setReminders(data);
    } catch (error) {
      console.error('Error cargando recordatorios:', error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const handleAddOrUpdate = async () => {
    if (!newReminder.date || !newReminder.time) return;
    setSaving(true);
    try {
      if (editingReminderId) {
        await reminderService.update(eventId, editingReminderId, newReminder);
        // Nota: Por ahora la actualización en Google Calendar habría que hacerla manualmente,
        // ya que la API de Google no nos devolvió un eventId rastreable en el recordatorio anterior.
        // Se actualiza en el CRM para que el vendedor tenga la fecha correcta.
      } else {
        const savedReminder = await reminderService.add(eventId, newReminder);
        
        // Enviar a Google Calendar si el usuario tiene email configurado
        if (currentUser && currentUser.email) {        try {
          const res = await api.post('/api/calendar/invite', {
            date: newReminder.date,
            time: newReminder.time,
            eventName: `Cita: ${eventName}`,
            email: currentUser.email,
            notes: `Medio: ${newReminder.channel}. ${newReminder.notes}`,
            reminderId: savedReminder?.id,
          });
          if (res?.mode === 'direct') {
            console.log("✅ Cita registrada directamente en tu Google Calendar");
          } else if (res?.mode === 'invite') {
            console.log("📧 Se envió una invitación a tu correo. Acéptala para ver la cita en tu Google Calendar.");
          }
        } catch (calendarError) {
          // El error en Google Calendar no debe bloquear el guardado del recordatorio
          console.error('Error enviando la cita a Google Calendar:', calendarError);
        }        }
      }

      await loadReminders();
      setShowForm(false);
      setEditingReminderId(null);
      setNewReminder({
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        channel: 'whatsapp',
        notes: ''
      });
      if (onSaved) onSaved();
    } catch (error) {
      console.error(error);
      toast('Error al guardar recordatorio');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (reminderId) => {
    setConfirmConfig({ isOpen: true, reminderId });
  };

  const confirmDelete = async () => {
    const { reminderId } = confirmConfig;
    setConfirmConfig({ isOpen: false, reminderId: null });
    if (!reminderId) return;

    try {
      await reminderService.delete(eventId, reminderId);

      // Eliminar también del Google Calendar
      try {
        await api.post('/api/calendar/delete-reminder', { reminderId, email: currentUser?.email });
      } catch (calendarError) {
        console.error('Error eliminando cita de Google Calendar:', calendarError);
      }

      await loadReminders();
      if (onSaved) onSaved();
    } catch (error) {
      console.error(error);
      toast('Error al eliminar');
    }
  };

  const handleEditClick = (rem) => {
    setNewReminder({
      date: rem.date,
      time: rem.time,
      channel: rem.channel || 'whatsapp',
      notes: rem.notes || ''
    });
    setEditingReminderId(rem.id);
    setShowForm(true);
  };

  const formatDateTime = (rem) => {
    const d = new Date(`${rem.date}T${rem.time}:00`);
    return d.toLocaleDateString('es-ES', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const channelLabels = {
    whatsapp: 'WhatsApp',
    email: 'Correo',
    phone: 'Teléfono',
    sms: 'SMS',
    presential: 'Presencial'
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
    maxHeight: '550px',
    overflowY: 'auto',
    background: '#f8fafc'
  };

  const footerStyle = {
    padding: '16px 24px',
    borderTop: '2px solid #f1f5f9',
    background: 'white'
  };

  const cardStyle = {
    background: 'white',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  };

  const labelStyle = {
    fontSize: '11px',
    fontWeight: '800',
    color: '#64748b',
    marginBottom: '6px',
    textTransform: 'uppercase',
    display: 'block'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '2px solid #f1f5f9',
    fontSize: '14px',
    fontWeight: '600',
    background: '#ffffff',
    color: '#0f172a'
  };

  return (
    <>
      <style>{`
        .btn-exit {
          background: rgba(255,255,255,0.1);
          color: white !important;
          border: none !important;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
          overflow: visible;
          outline: none;
        }
        .btn-exit:hover {
          background: rgba(239, 68, 68, 0.3) !important;
          color: #fca5a5 !important;
        }
        .btn-exit:focus-visible {
          outline: 2px solid #fca5a5;
          outline-offset: 2px;
        }
        .btn-exit:active {
          transform: scale(0.88);
        }
        .btn-exit svg {
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .btn-exit:hover svg {
          transform: scale(1.2);
        }
        .btn-exit:hover .crm-icon-x {
          transform: rotate(90deg) scale(1.2);
        }
        @media (max-width: 540px) {
          .app-modal-container {
            max-width: calc(100vw - 32px) !important;
            width: 100% !important;
            border-radius: 16px !important;
            max-height: calc(100dvh - 32px) !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .app-modal-header {
            padding: 14px 16px !important;
          }
          .app-modal-header h2 {
            font-size: 17px !important;
          }
          .app-modal-header p {
            font-size: 12px !important;
          }
          .app-modal-body {
            padding: 16px !important;
            max-height: calc(100dvh - 200px) !important;
          }
          .app-modal-footer {
            padding: 12px 16px !important;
          }
          .app-modal-card {
            padding: 12px !important;
            gap: 10px !important;
          }
          .app-modal-card-icon {
            width: 38px !important;
            height: 38px !important;
            font-size: 17px !important;
            border-radius: 10px !important;
          }
          .app-modal-card-title {
            font-size: 12.5px !important;
            flex-wrap: wrap !important;
          }
          .app-modal-card-desc {
            font-size: 11px !important;
          }
          .app-modal-action-btn {
            padding: 5px 10px !important;
            font-size: 10px !important;
          }
          .app-modal-form input,
          .app-modal-form select,
          .app-modal-form textarea {
            padding: 10px !important;
            font-size: 13px !important;
          }
          .app-modal-form label {
            font-size: 10px !important;
          }
          .app-modal-empty-icon {
            font-size: 36px !important;
          }
          .app-modal-empty-title {
            font-size: 14px !important;
          }
          .app-modal-empty-desc {
            font-size: 12px !important;
          }
          .app-modal-btn-row {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .app-modal-btn-row button {
            width: 100% !important;
          }
        }
        @media (max-width: 380px) {
          .app-modal-container {
            max-width: calc(100vw - 16px) !important;
            max-height: calc(100dvh - 16px) !important;
          }
          .app-modal-header {
            padding: 10px 12px !important;
          }
          .app-modal-body {
            padding: 12px !important;
          }
          .app-modal-footer {
            padding: 10px 12px !important;
          }
        }
      `}</style>
    <div className="modal mini" style={{
      width: '480px',
      maxWidth: 'calc(100vw - 40px)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div className="modalHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
        <div>
          <h2 id="appointmentTitle" className="modalTitle" style={{ margin: 0, fontWeight: '800' }}>📅 Citas y Recordatorios</h2>
          <p className="modalSubtitle" style={{ margin: '4px 0 0' }}>{eventName}</p>
        </div>
        <button onClick={onClose} id="btnAppointmentClose" className="btn-exit" style={{
          width: '36px', height: '36px', borderRadius: '50%', padding: '0',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="16" height="16" className="crm-icon-x">
            <path d="M4 4l10 10M14 4l-10 10" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="modalBody" style={{ padding: '24px', maxHeight: '550px', overflowY: 'auto' }}>
        {!showForm ? (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontWeight: '600' }}>
                Cargando...
              </div>
            ) : reminders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <div className="app-modal-empty-icon" style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <div className="app-modal-empty-title" style={{ fontWeight: '700', fontSize: '16px', color: '#64748b' }}>No hay citas programadas</div>
                <div className="app-modal-empty-desc" style={{ fontSize: '13px', marginTop: '8px' }}>Agrega recordatorios para dar seguimiento</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reminders.map(rem => (
                  <div key={rem.id} className="app-modal-card" style={cardStyle}>
                    <div className="app-modal-card-icon" style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: '#18c5bc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '22px',
                      flexShrink: 0
                    }}>📅</div>
                    <div style={{ flex: 1 }}>
                      <div className="app-modal-card-title" style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {formatDateTime(rem)}
                        {rem.creatorName && (
                          <span style={{ 
                            fontSize: '10px', 
                            background: '#e2e8f0', 
                            color: '#475569', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            fontWeight: '600'
                          }}>
                            👤 {rem.creatorName}
                          </span>
                        )}
                      </div>
                      <div className="app-modal-card-desc" style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: '600' }}>
                        {channelLabels[rem.channel] || rem.channel}
                        {rem.notes && ` • ${rem.notes}`}
                      </div>
                    </div>
                    
                    {/* Botones de acción: Solo visibles si el creador es el usuario actual */}
                    {(!(rem.createdBy || rem.createdByUserId) || (rem.createdBy || rem.createdByUserId) === currentUser?.id) && (
                      <div className="app-modal-actions" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <button onClick={() => handleEditClick(rem)} className="app-modal-action-btn" style={{
                          padding: '6px 12px',
                          fontSize: '11px',
                          background: '#f1f5f9',
                          color: '#475569',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '700'
                        }}>
                          Editar
                        </button>
                        <button onClick={() => handleDeleteClick(rem.id)} className="app-modal-action-btn" style={{
                          padding: '6px 12px',
                          fontSize: '11px',
                          background: '#fee2e2',
                          color: '#ef4444',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '700'
                        }}>
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="app-modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Fecha</label>
              <input type="date" value={newReminder.date} onChange={e => setNewReminder(prev => ({ ...prev, date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Hora</label>
              <input type="time" step="300" value={newReminder.time} onChange={e => setNewReminder(prev => ({ ...prev, time: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Medio de contacto</label>
              <select value={newReminder.channel} onChange={e => setNewReminder(prev => ({ ...prev, channel: e.target.value }))} style={inputStyle}>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Correo electrónico</option>
                <option value="phone">Teléfono</option>
                <option value="sms">SMS</option>
                <option value="presential">Presencial</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Notas</label>
              <textarea value={newReminder.notes} onChange={e => setNewReminder(prev => ({ ...prev, notes: e.target.value }))} placeholder="Detalles de la cita..." style={{ ...inputStyle, minHeight: '80px', resize: 'none' }} />
            </div>
            <div className="app-modal-btn-row" style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button onClick={() => { setShowForm(false); setEditingReminderId(null); }} className="btnSecondary" style={{ width: '50%', padding: '12px' }}>Cancelar</button>
              <button onClick={handleAddOrUpdate} disabled={saving} className="btnPrimary" style={{ width: '50%', padding: '12px', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando...' : editingReminderId ? 'Actualizar Cita' : 'Guardar Cita'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!showForm && (
        <div className="app-modal-footer" style={footerStyle}>
          <button onClick={() => setShowForm(true)} className="btnPrimary" style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            fontSize: '14px'
          }}>
            + Agregar Nueva Cita
          </button>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title="Eliminar Cita"
        message="¿Estás seguro de que deseas eliminar esta cita de seguimiento? Esta acción no se puede deshacer."
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        isDanger={true}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmConfig({ isOpen: false, reminderId: null })}
      />
    </div>
    </>
  );
}
