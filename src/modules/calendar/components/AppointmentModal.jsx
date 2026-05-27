import { useState, useEffect } from 'react';
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

  const loadReminders = async () => {
    setLoading(true);
    try {
      const data = await reminderService.getByEventId(eventId);
      setReminders(data);
    } catch (error) {
      console.error('Error cargando recordatorios:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, [eventId]);

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
        await reminderService.add(eventId, newReminder);
        
        // Enviar a Google Calendar si el usuario tiene email configurado
        if (currentUser && currentUser.email) {
        console.log("AppointmentModal -> Enviando peticion a Google Calendar para email:", currentUser.email);
        try {
          const res = await api.post('/api/calendar/invite', {
            date: newReminder.date,
            time: newReminder.time,
            eventName: `Cita: ${eventName}`,
            email: currentUser.email,
            notes: `Medio: ${newReminder.channel}. ${newReminder.notes}`,
          });
          console.log("AppointmentModal -> Respuesta de Google Calendar:", res);

          if (res?.mode === 'direct') {
            console.log("✅ Cita registrada directamente en tu Google Calendar");
          } else if (res?.mode === 'invite') {
            console.log("📧 Se envió una invitación a tu correo. Acéptala para ver la cita en tu Google Calendar.");
          }
        } catch (calendarError) {
          // El error en Google Calendar no debe bloquear el guardado del recordatorio
          console.error("AppointmentModal -> Error enviando a Google Calendar:", calendarError);
        }
      } else {
        console.warn("AppointmentModal -> No se envio a Google Calendar porque el currentUser no tiene email", currentUser);
      }
      } // <- Cierra el else de !editingReminderId

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
    maxHeight: '380px',
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
    fontWeight: '600'
  };

  const btnPrimary = {
    padding: '12px 24px',
    borderRadius: '10px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
    background: '#0b1c30',
    color: 'white',
    boxShadow: '0 4px 10px rgba(11, 28, 48, 0.15)'
  };

  const btnSecondary = {
    padding: '12px 24px',
    borderRadius: '10px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#64748b'
  };

  return (
    <div style={{
      width: '480px',
      background: 'white',
      borderRadius: '20px',
      boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>📅 Citas y Recordatorios</h2>
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
        {!showForm ? (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontWeight: '600' }}>
                Cargando...
              </div>
            ) : reminders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <div style={{ fontWeight: '700', fontSize: '16px', color: '#64748b' }}>No hay citas programadas</div>
                <div style={{ fontSize: '13px', marginTop: '8px' }}>Agrega recordatorios para dar seguimiento</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reminders.map(rem => (
                  <div key={rem.id} style={cardStyle}>
                    <div style={{
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
                      <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: '600' }}>
                        {channelLabels[rem.channel] || rem.channel}
                        {rem.notes && ` • ${rem.notes}`}
                      </div>
                    </div>
                    
                    {/* Botones de acción: Solo visibles si el creador es el usuario actual */}
                    {(!rem.createdBy || rem.createdBy === currentUser?.id) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <button onClick={() => handleEditClick(rem)} style={{
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
                        <button onClick={() => handleDeleteClick(rem.id)} style={{
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Fecha</label>
              <input type="date" value={newReminder.date} onChange={e => setNewReminder(prev => ({ ...prev, date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Hora</label>
              <input type="time" value={newReminder.time} onChange={e => setNewReminder(prev => ({ ...prev, time: e.target.value }))} style={inputStyle} />
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
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button onClick={() => { setShowForm(false); setEditingReminderId(null); }} className="btn-cancel" style={{ width: '50%', padding: '12px' }}>Cancelar</button>
              <button onClick={handleAddOrUpdate} disabled={saving} className="btn-teal" style={{ width: '50%', padding: '12px', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando...' : editingReminderId ? 'Actualizar Cita' : 'Guardar Cita'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!showForm && (
        <div style={footerStyle}>
          <button onClick={() => setShowForm(true)} className="btn-cotizar" style={{
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
  );
}