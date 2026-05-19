import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { STATUS_META_LIST, AUTO_STATUSES, getStatusFromQuotePresence } from '../constants';
import authService from '../../../services/authService';
import historyService from '../../../services/historyService';
import reminderService from '../../../services/reminderService';
import conflictService, { checkSlotConflicts, findAllConflicts } from '../../../services/conflictService';
import AppointmentModal from './AppointmentModal';
import HistoryPanel from './HistoryPanel';
import QuoteModal from './QuoteModal';

const HOUR_START = 0;
const HOUR_END = 23;

function timeToMinutes(time) {
  if (!time || typeof time !== 'string') return 0;
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || 0, 10);
}

function minutesToTime(minutes) {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function compareTime(a, b) {
  const am = timeToMinutes(a);
  const bm = timeToMinutes(b);
  return am - bm;
}

function isValidClockTime(time) {
  if (!time || typeof time !== 'string') return false;
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  return hh >= HOUR_START && hh <= HOUR_END && mm >= 0 && mm < 60;
}

function normalizeSlotDateRange(slot, fallbackStart = "", fallbackEnd = "") {
  const rawStart = String(slot?.dateStart || fallbackStart || "").trim();
  const rawEnd = String(slot?.dateEnd || fallbackEnd || rawStart).trim();
  if (!rawStart && !rawEnd) return { start: "", end: "" };
  if (!rawStart) return { start: rawEnd, end: rawEnd };
  if (!rawEnd) return { start: rawStart, end: rawStart };
  return rawStart <= rawEnd ? { start: rawStart, end: rawEnd } : { start: rawEnd, end: rawStart };
}

export default function ReservationForm({ onCancel }) {
  const { events, salones, users, handleAddEvent, handleDeleteEvent, refreshData } = useOutletContext();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [slotConflicts, setSlotConflicts] = useState([]);

  const urlDate = searchParams.get('date');
  const urlEndDate = searchParams.get('endDate') || urlDate;
  const urlStart = searchParams.get('start');
  const urlEnd = searchParams.get('end');

  const getDefaultDate = () => urlDate || new Date().toISOString().split('T')[0];
  const getDefaultEndDate = () => urlEndDate || getDefaultDate();

  const getCurrentUserId = () => {
    const currentUser = authService.getCurrentUser();
    return currentUser?.id || '';
  };

  const [formData, setFormData] = useState({
    name: '',
    salon: '',
    status: 'Reserva sin Cotizacion',
    date: getDefaultDate(),
    endDate: getDefaultEndDate(),
    startTime: urlStart || '10:00',
    endTime: urlEnd || '12:00',
    pax: '',
    notes: '',
    clientName: '',
    clientPhone: '',
    userId: getCurrentUserId()
  });

  const [slots, setSlots] = useState([
    { salon: '', pax: '', dateStart: getDefaultDate(), dateEnd: getDefaultEndDate(), startTime: urlStart || '10:00', endTime: urlEnd || '12:00', status: 'Reserva sin Cotizacion' }
  ]);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (salones?.length > 0 && !formData.salon && slots[0].salon === '') {
      const newSlots = slots.map((s, i) => i === 0 ? { ...s, salon: salones[0] } : s);
      setSlots(newSlots);
      setFormData(prev => ({ ...prev, salon: salones[0] }));
    }
  }, [salones]);

  useEffect(() => {
    if (id && events) {
      const existingEvent = events.find(ev => ev.id === id);
      if (existingEvent) {
        setFormData({
          name: existingEvent.name || '',
          salon: existingEvent.salon || '',
          status: existingEvent.status || 'Reserva sin Cotizacion',
          date: existingEvent.date || getDefaultDate(),
          endDate: existingEvent.endDate || existingEvent.date || getDefaultDate(),
          startTime: existingEvent.startTime || '10:00',
          endTime: existingEvent.endTime || '12:00',
          pax: existingEvent.pax || '',
          notes: existingEvent.notes || '',
          clientName: existingEvent.clientName || '',
          clientPhone: existingEvent.clientPhone || '',
          userId: existingEvent.userId || ''
        });

        if (existingEvent.slots && existingEvent.slots.length > 0) {
          setSlots(existingEvent.slots);
        } else {
          setSlots([{
            salon: existingEvent.salon || (salones?.length > 0 ? salones[0] : ''),
            pax: existingEvent.pax || '',
            dateStart: existingEvent.date || getDefaultDate(),
            dateEnd: existingEvent.endDate || existingEvent.date || getDefaultDate(),
            startTime: existingEvent.startTime || '10:00',
            endTime: existingEvent.endTime || '12:00',
            status: existingEvent.status || 'Reserva sin Cotizacion'
          }]);
        }
      }
    } else {
      setFormData({
        name: '',
        salon: salones?.length > 0 ? salones[0] : '',
        status: 'Reserva sin Cotizacion',
        date: getDefaultDate(),
        endDate: getDefaultEndDate(),
        startTime: urlStart || '10:00',
        endTime: urlEnd || '12:00',
        pax: '',
        notes: '',
        clientName: '',
        clientPhone: '',
        userId: getCurrentUserId()
      });
      setSlots([{
        salon: salones?.length > 0 ? salones[0] : '',
        pax: '',
        dateStart: getDefaultDate(),
        dateEnd: getDefaultEndDate(),
        startTime: urlStart || '10:00',
        endTime: urlEnd || '12:00',
        status: 'Reserva sin Cotizacion'
      }]);
    }
  }, [id, events, salones, urlDate, urlEndDate, urlStart, urlEnd]);

  const showNotification = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'date' || name === 'endDate') {
      const dateVal = name === 'date' ? value : formData.date;
      const endVal = name === 'endDate' ? value : formData.endDate;
      const newSlots = slots.map(s => ({
        ...s,
        dateStart: s.dateStart || dateVal,
        dateEnd: s.dateEnd || endVal
      }));
      setSlots(newSlots);
    }
  };

  const syncEventPaxFromSlots = useCallback(() => {
    const total = slots.reduce((acc, slot) => acc + Math.max(0, Number(slot?.pax || 0)), 0);
    setFormData(prev => ({ ...prev, pax: total > 0 ? total : '' }));
    return total;
  }, [slots]);

  const syncHiddenTimesFromFirstSlot = useCallback(() => {
    if (slots.length > 0) {
      setFormData(prev => ({
        ...prev,
        startTime: slots[0].startTime || prev.startTime,
        endTime: slots[0].endTime || prev.endTime,
        salon: slots[0].salon || prev.salon
      }));
    }
  }, [slots]);

  const addSlotRow = () => {
    const newSlot = {
      salon: salones?.length > 0 ? salones[0] : '',
      pax: '',
      dateStart: formData.date,
      dateEnd: formData.endDate,
      startTime: '10:00',
      endTime: '12:00',
      status: formData.status
    };
    setSlots([...slots, newSlot]);
  };

  const removeSlotRow = (index) => {
    if (slots.length <= 1) {
      showNotification('Debe existir al menos un bloque', 'error');
      return;
    }
    const newSlots = slots.filter((_, i) => i !== index);
    setSlots(newSlots);
    syncEventPaxFromSlots();
    syncHiddenTimesFromFirstSlot();
  };

  const handleSlotChange = (index, field, value) => {
    const newSlots = slots.map((s, i) => i === index ? { ...s, [field]: value } : s);
    setSlots(newSlots);
    if (field === 'pax') {
      syncEventPaxFromSlots();
    }
    if (field === 'salon' || field === 'startTime' || field === 'endTime') {
      syncHiddenTimesFromFirstSlot();
    }
  };

  const validateReservationRequiredFields = useCallback(() => {
    const issues = [];
    const newErrors = [];

    const name = formData.name.trim();
    if (!name) issues.push('Nombre del evento');

    const dateStart = formData.date.trim();
    if (!dateStart) issues.push('Fecha inicial');

    const dateEnd = formData.endDate.trim();
    if (!dateEnd) issues.push('Fecha final');

    const userId = formData.userId.trim();
    if (!userId) issues.push('Usuario');

    const totalPax = syncEventPaxFromSlots();
    if (!totalPax || totalPax <= 0) issues.push('PAX total');

    if (!slots.length) issues.push('Al menos un bloque de salón y horario');

    slots.forEach((s, i) => {
      const idx = i + 1;
      if (!s.salon) issues.push(`Bloque ${idx}: Salón`);
      if (!s.pax || Number(s.pax) <= 0) issues.push(`Bloque ${idx}: PAX`);
      
      const slotRange = normalizeSlotDateRange(s, dateStart, dateEnd);
      if (!slotRange.start) issues.push(`Bloque ${idx}: Fecha desde`);
      if (!slotRange.end) issues.push(`Bloque ${idx}: Fecha hasta`);

      if (slotRange.start && slotRange.end && dateStart && dateEnd) {
        const eventRange = normalizeSlotDateRange({ dateStart, dateEnd });
        if (slotRange.start < eventRange.start || slotRange.end > eventRange.end) {
          issues.push(`Bloque ${idx}: Fechas fuera del rango del evento`);
        }
      }

      if (!s.startTime || !isValidClockTime(s.startTime)) issues.push(`Bloque ${idx}: Hora inicio`);
      if (!s.endTime || !isValidClockTime(s.endTime)) issues.push(`Bloque ${idx}: Hora fin`);
      
      if (s.startTime && s.endTime && compareTime(s.endTime, s.startTime) <= 0) {
        issues.push(`Bloque ${idx}: La hora final debe ser mayor que inicio`);
      }
    });

    setValidationErrors(issues);
    return { ok: issues.length === 0, issues };
  }, [formData, slots, syncEventPaxFromSlots]);

  const handleMaintenance = () => {
    setFormData(prev => ({ ...prev, status: 'Mantenimiento', name: 'MANTENIMIENTO' }));
    const newSlots = slots.map(s => ({ ...s, status: 'Mantenimiento' }));
    setSlots(newSlots);
    showNotification('Estado cambiado a Mantenimiento', 'info');
  };

  const handleCancelEvent = async () => {
    if (!id) {
      showNotification('Solo se pueden cancelar eventos existentes', 'error');
      return;
    }
    if (window.confirm('¿Deseas cambiar el estado a "Cancelado"?')) {
      try {
        await handleAddEvent({ ...formData, id, status: 'Cancelado', slots });
        showNotification('Evento cancelado');
        setTimeout(() => navigate('/calendar'), 1000);
      } catch {
        showNotification('Error al cancelar', 'error');
      }
    }
  };

  const handleDeleteReservation = async () => {
    if (!id) {
      showNotification('Solo se pueden eliminar eventos existentes', 'error');
      return;
    }
    if (window.confirm(`¿Estás seguro de eliminar esta reserva?`)) {
      try {
        await handleDeleteEvent(id);
        await historyService.add(id, 'Reserva eliminada');
        showNotification('Reserva eliminada');
        setTimeout(() => navigate('/calendar'), 1000);
      } catch {
        showNotification('Error al eliminar', 'error');
      }
    }
  };

  const handleOpenAppointments = () => {
    if (!id) {
      showNotification('Guarda la reserva primero para agregar citas', 'error');
      return;
    }
    setShowAppointmentModal(true);
  };

  const handleOpenHistory = () => {
    if (!id) {
      showNotification('Guarda la reserva primero para ver el historial', 'error');
      return;
    }
    setShowHistoryModal(true);
  };

  const handleOpenQuote = () => {
    if (!id) {
      showNotification('Guarda la reserva primero para crear una cotización', 'error');
      return;
    }
    setShowQuoteModal(true);
  };

  const handleQuoteSave = async (quoteData) => {
    try {
      const currentEvent = events.find(ev => ev.id === id);
      await handleAddEvent({
        ...currentEvent,
        quote: quoteData,
        status: '1er Cotizacion'
      });
      showNotification('Cotización guardada');
      setShowQuoteModal(false);
    } catch {
      showNotification('Error al guardar cotización', 'error');
    }
  };

  const handleSave = async () => {
    if (saving) return;

    const validation = validateReservationRequiredFields();
    if (!validation.ok) {
      showNotification(`Completa: ${validation.issues[0]}${validation.issues.length > 1 ? ` (+${validation.issues.length - 1} pendientes)` : ''}`, 'error');
      return;
    }

    const conflictCheck = conflictService.checkAllSlots(slots, events, id);
    const hasConflicts = conflictCheck.some(r => !r.ok);
    const hardConflicts = conflictCheck.filter(r => r.type === 'conflict' && !r.ok);
    
    if (hardConflicts.length > 0) {
      showNotification(`Conflicto: ${hardConflicts[0].message}`, 'error');
      setSlotConflicts(conflictCheck);
      return;
    }

    if (hasConflicts) {
      const warningMsg = conflictCheck.find(r => r.hint)?.hint || 'Hay conflictos de horario';
      setSlotConflicts(conflictCheck);
      showNotification(warningMsg, 'error');
      return;
    }

    setSaving(true);
    try {
      const eventData = {
        ...formData,
        id: id || undefined,
        pax: formData.pax ? parseInt(formData.pax) : null,
        slots: slots,
        salon: slots.map(s => s.salon).join(', ')
      };

      const savedEvent = await handleAddEvent(eventData);

      if (id) {
        const existingEvent = events.find(ev => ev.id === id);
        if (existingEvent) {
          await historyService.addDetailed(id, existingEvent, eventData);
        }
      } else {
        await historyService.add(savedEvent.id, 'Reserva creada');
      }

      showNotification(id ? 'Cambios guardados' : 'Reserva creada');
      setTimeout(() => navigate('/calendar'), 1000);
    } catch {
      showNotification('Error al guardar', 'error');
      setSaving(false);
    }
  };

  const btnBase = {
    padding: '10px 18px',
    borderRadius: '10px',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer',
    border: '1px solid',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s'
  };

  const btnAction = {
    ...btnBase,
    background: '#f0f7ff',
    borderColor: '#d3e4fe',
    color: '#2563eb',
  };

  const btnCancel = {
    ...btnBase,
    background: '#fff1f1',
    borderColor: '#fecaca',
    color: '#dc2626',
  };

  const btnSave = {
    ...btnBase,
    background: '#0b1c30',
    color: 'white',
    padding: '12px 36px',
    fontSize: '15px',
    borderColor: '#0b1c30',
    boxShadow: '0 4px 10px rgba(11, 28, 48, 0.15)'
  };

  const inputStyle = {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '2px solid #f1f5f9',
    fontSize: '13px',
    fontWeight: '600',
    width: '100%'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: '800',
    color: '#64748b',
    marginBottom: '6px',
    textTransform: 'uppercase'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
      {toast.show && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', padding: '14px 28px', background: toast.type === 'error' ? '#dc2626' : '#059669', color: 'white', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 9999, fontWeight: '700' }}>
          {toast.message}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '42px', fontWeight: '800', color: '#0b1c30', margin: 0 }}>{id ? 'Editar reserva' : 'Nueva reserva'}</h1>
          <button onClick={() => navigate('/calendar')} style={{ background: '#e2e8f0', border: 0, width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

        {validationErrors.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ color: '#dc2626', fontWeight: '700', marginBottom: '8px' }}>⚠️ Faltan datos por completar:</div>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#991b1b', fontSize: '13px' }}>
              {validationErrors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
              {validationErrors.length > 5 && <li>...y {validationErrors.length - 5} más</li>}
            </ul>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <label style={labelStyle}>Nombre del evento *</label>
              <input name="name" value={formData.name} onChange={handleChange} placeholder="Ej: Boda Civil Fam. González" style={{ ...inputStyle, fontSize: '16px', marginBottom: '20px' }} />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Estado de la Reserva</label>
                  <select name="status" value={formData.status} onChange={handleChange} style={{ ...inputStyle, padding: '12px' }}>
                    {STATUS_META_LIST.map(s => {
                      const isAuto = AUTO_STATUSES.includes(s.key);
                      return (
                        <option key={s.key} value={s.key} disabled={isAuto}>
                          {s.key}{isAuto ? ' (auto)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>* Los estados automáticos se asignan según corresponda</div>
                </div>
                <div>
                  <label style={labelStyle}>Encargado del Seguimiento</label>
                  <select name="userId" value={formData.userId} onChange={handleChange} style={{ ...inputStyle, padding: '12px' }}>
                    <option value="">-- Sin Encargado --</option>
                    {users?.map(u => (
                      <option key={u.id} value={u.id}>👤 {u.fullName || u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Salones (Selecciona todos los que correspondan)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginTop: '8px' }}>
                  {salones.map(s => {
                    const isSelected = slots.some(slot => slot.salon === s);
                    return (
                      <div
                        key={s}
                        onClick={() => {
                          const hasSlot = slots.some(slot => slot.salon === s);
                          if (hasSlot) {
                            const idx = slots.findIndex(slot => slot.salon === s);
                            removeSlotRow(idx);
                          } else {
                            addSlotRow();
                            const newSlots = [...slots];
                            newSlots[newSlots.length - 1].salon = s;
                            setSlots(newSlots);
                          }
                        }}
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          background: isSelected ? '#eff6ff' : 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontWeight: '700',
                          fontSize: '13px',
                          color: isSelected ? '#1e40af' : '#475569'
                        }}
                      >
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          border: '2px solid',
                          borderColor: isSelected ? '#2563eb' : '#cbd5e1',
                          background: isSelected ? '#2563eb' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '10px'
                        }}>{isSelected && '✓'}</div>
                        <span>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0b1c30', margin: 0 }}>Bloques de Salón y Horario</h3>
                <button onClick={addSlotRow} style={{ ...btnAction, padding: '8px 16px', fontSize: '12px' }}>+ Agregar Bloque</button>
              </div>

              {slotConflicts.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '700', color: '#dc2626', marginBottom: '8px', fontSize: '13px' }}>⚠️ Conflictos de horario detectados:</div>
                  {slotConflicts.map((r, i) => (
                    <div key={i} style={{ fontSize: '12px', color: '#991b1b', marginBottom: '4px' }}>
                      Bloque {r.index + 1}: {r.message || r.hint}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {slots.map((slot, index) => (
                  <div key={index} style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontWeight: '800', color: '#64748b', fontSize: '12px' }}>BLOQUE {index + 1}</span>
                      {slots.length > 1 && (
                        <button onClick={() => removeSlotRow(index)} style={{ background: '#fef2f2', border: 'none', borderRadius: '6px', padding: '6px 12px', color: '#dc2626', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Eliminar</button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 1fr 100px 100px', gap: '10px', alignItems: 'end' }}>
                      <div>
                        <label style={labelStyle}>Salón</label>
                        <select value={slot.salon} onChange={e => handleSlotChange(index, 'salon', e.target.value)} style={inputStyle}>
                          <option value="">-- Seleccionar --</option>
                          {salones?.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>PAX</label>
                        <input type="number" value={slot.pax} onChange={e => handleSlotChange(index, 'pax', e.target.value)} placeholder="0" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Fecha Desde</label>
                        <input type="date" value={slot.dateStart} onChange={e => handleSlotChange(index, 'dateStart', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Fecha Hasta</label>
                        <input type="date" value={slot.dateEnd} onChange={e => handleSlotChange(index, 'dateEnd', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Inicio</label>
                        <input type="time" value={slot.startTime} onChange={e => handleSlotChange(index, 'startTime', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Fin</label>
                        <input type="time" value={slot.endTime} onChange={e => handleSlotChange(index, 'endTime', e.target.value)} style={inputStyle} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '16px', padding: '12px', background: '#f0f7ff', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>PAX TOTAL:</span>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#2563eb' }}>{formData.pax || 0}</span>
              </div>
            </div>

            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px', color: '#0b1c30', marginTop: 0 }}>Información del Cliente</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>Nombre de quien reserva</label>
                  <input name="clientName" value={formData.clientName} onChange={handleChange} placeholder="Ej: Carlos Samalaj" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Teléfono del Cliente</label>
                  <input name="clientPhone" value={formData.clientPhone} onChange={handleChange} placeholder="Ej: +502 5555-5555" style={inputStyle} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '12px', marginTop: 0 }}>Agenda</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>Fecha de Inicio</label>
                  <input type="date" name="date" value={formData.date} onChange={handleChange} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Fecha de Fin</label>
                  <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} style={inputStyle} />
                </div>
              </div>
            </div>
            
            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '12px', marginTop: 0 }}>Notas</h3>
              <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Detalles u observaciones de la reserva..." style={{ ...inputStyle, height: '100px', resize: 'none' }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderTop: '2px solid #f1f5f9', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '80px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={handleOpenHistory} style={btnAction}>Historial</button>
          <button onClick={handleOpenAppointments} style={btnAction}>Ver citas</button>
          <button onClick={handleOpenAppointments} style={btnAction}>Agregar cita</button>
          <button onClick={handleMaintenance} style={btnAction}>Poner en mantenimiento</button>
          <button onClick={handleCancelEvent} style={btnCancel}>Cancelar evento</button>
          {id && <button onClick={handleDeleteReservation} style={{ ...btnCancel, background: '#7f1d1d', color: 'white', borderColor: '#7f1d1d' }}>Eliminar</button>}
          <button onClick={handleOpenQuote} style={btnAction}>Cotizar evento</button>
        </div>
        
        <button onClick={handleSave} disabled={saving} style={btnSave}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <style>{`
        button:hover { filter: brightness(0.95); transform: translateY(-1px); }
        button:active { transform: translateY(0); }
      `}</style>

      {showAppointmentModal && id && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAppointmentModal(false)}>
          <div onClick={e => e.stopPropagation()}>
            <AppointmentModal eventId={id} eventName={formData.name} onClose={() => setShowAppointmentModal(false)} onSaved={refreshData} />
          </div>
        </div>
      )}

      {showHistoryModal && id && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowHistoryModal(false)}>
          <div onClick={e => e.stopPropagation()}>
            <HistoryPanel eventId={id} eventName={formData.name} onClose={() => setShowHistoryModal(false)} />
          </div>
        </div>
      )}

      {showQuoteModal && id && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowQuoteModal(false)}>
          <div onClick={e => e.stopPropagation()}>
            <QuoteModal event={events?.find(ev => ev.id === id)} onClose={() => setShowQuoteModal(false)} onSave={handleQuoteSave} />
          </div>
        </div>
      )}
    </div>
  );
}