import api from './api';

export const EVENT_STATUS = {
  PRE_RESERVA: 'Pre reserva',
  RESERVA_SIN_COTIZACION: 'Reserva sin Cotizacion',
  PRIMERA_COTIZACION: '1er Cotizacion',
  SEGUIMIENTO: 'Seguimiento',
  LISTA_ESPERA: 'Lista de Espera',
  CONFIRMADO: 'Confirmado',
  CANCELADO: 'Cancelado',
  MANTENIMIENTO: 'Mantenimiento',
  PERDIDO: 'Perdido',
  REALIZADO: 'Realizado',
};

const pad2 = (value) => String(value).padStart(2, '0');

function uid(prefix = 'evt') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function normalizeDateRange(start, end) {
  const a = String(start || '').trim();
  const b = String(end || a).trim();
  if (!a && !b) return [];
  const min = a && b && a > b ? b : (a || b);
  const max = a && b && a > b ? a : (b || a);
  const startDate = new Date(`${min}T00:00:00`);
  const endDate = new Date(`${max}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [min].filter(Boolean);
  const out = [];
  for (const d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  }
  return out;
}

function expandEventSlots(eventData, existingEvent = null) {
  const slots = Array.isArray(eventData?.slots) ? eventData.slots : [];
  if (!slots.length) return [{ ...eventData }];

  const baseId = String(eventData.id || existingEvent?.id || uid('evt'));
  const groupId = String(eventData.groupId || existingEvent?.groupId || baseId);
  const eventDateStart = String(eventData.date || eventData.eventDateStart || slots[0]?.dateStart || '').trim();
  const eventDateEnd = String(eventData.endDate || eventData.eventDateEnd || eventDateStart).trim();
  const totalPax = eventData.pax === null || eventData.pax === undefined || eventData.pax === ''
    ? slots.reduce((acc, slot) => acc + Math.max(0, Number(slot?.pax || slot?.slotPax || 0)), 0)
    : Number(eventData.pax);
  const salones = Array.from(new Set(slots.map((slot) => String(slot?.salon || '').trim()).filter(Boolean)));
  const expanded = [];

  slots.forEach((slot, slotIndex) => {
    const slotDates = normalizeDateRange(slot.dateStart || eventDateStart, slot.dateEnd || slot.dateStart || eventDateEnd || eventDateStart);
    slotDates.forEach((date, dateIndex) => {
      const isFirst = slotIndex === 0 && dateIndex === 0;
      expanded.push({
        ...eventData,
        id: isFirst ? baseId : `${baseId}_slot_${slotIndex + 1}_${date.replace(/-/g, '')}`,
        groupId,
        salon: String(slot.salon || '').trim(),
        mainSalon: salones[0] || String(slot.salon || '').trim(),
        salones,
        date,
        eventDateStart: eventDateStart || date,
        eventDateEnd: eventDateEnd || date,
        endDate: eventDateEnd || eventDateStart || date,
        startTime: slot.startTime || eventData.startTime,
        endTime: slot.endTime || eventData.endTime,
        status: slot.status || eventData.status || 'Reserva sin Cotizacion',
        pax: slot.pax === '' || slot.pax === null || slot.pax === undefined
          ? (Number.isFinite(totalPax) && totalPax > 0 ? totalPax : null)
          : Math.max(0, Number(slot.pax || 0)),
        slotPax: slot.pax === '' || slot.pax === null || slot.pax === undefined ? null : Math.max(0, Number(slot.pax || 0)),
        slots: undefined,
      });
    });
  });

  return expanded;
}

export const eventService = {
async getAll() {
    try {
      const response = await api.get('/api/state');
      return response?.state?.events || [];
    } catch (err) {
      console.error('Error al obtener eventos de la base de datos:', err);
      return [];
    }
  },

  async getById(id) {
    try {
      const response = await api.get('/api/state', { t: Date.now() });
      const events = response?.state?.events || [];
      return events.find(e => e.id === id) || null;
    } catch (err) {
      console.error('Error al obtener evento por ID de la base de datos:', err);
      return null;
    }
  },

  async create(eventData) {
    const newEvent = {
      ...eventData,
      id: eventData.id || uid('evt'),
      createdAt: new Date().toISOString(),
    };
    
    try {
      const response = await api.get('/api/state', { t: Date.now() });
      const currentState = response?.state || {};
      const events = currentState.events || [];
      const expandedEvents = expandEventSlots(newEvent);
      const updatedState = { ...currentState, events: [...events, ...expandedEvents] };
      await api.put('/api/state', { state: updatedState });
      return expandedEvents[0] || newEvent;
    } catch (err) {
      console.error('Error guardando en el servidor:', err);
      throw err;
    }
  },

  async update(id, eventData) {
    try {
      const response = await api.get('/api/state', { t: Date.now() });
      const currentState = response?.state || {};
      const events = currentState.events || [];
      const existingEvent = events.find(e => String(e.id) === String(id));
      const hasSlots = Array.isArray(eventData?.slots) && eventData.slots.length > 0;
      let updatedEvents;
      let savedEvent;

      if (hasSlots) {
        const groupId = String(eventData.groupId || existingEvent?.groupId || id);
        const expandedEvents = expandEventSlots({ ...existingEvent, ...eventData, id, groupId, updatedAt: new Date().toISOString() }, existingEvent);
        updatedEvents = events
          .filter(e => String(e.id) !== String(id) && String(e.groupId || '') !== groupId)
          .concat(expandedEvents);
        savedEvent = expandedEvents[0];
      } else if (existingEvent?.groupId) {
        updatedEvents = events.map(e => {
          if (String(e.groupId || '') !== String(existingEvent.groupId)) return e;
          return {
            ...e,
            ...eventData,
            id: e.id,
            groupId: e.groupId,
            salon: e.salon,
            mainSalon: e.mainSalon,
            salones: e.salones,
            date: e.date,
            eventDateStart: e.eventDateStart,
            eventDateEnd: e.eventDateEnd,
            endDate: e.endDate,
            startTime: e.startTime,
            endTime: e.endTime,
            pax: e.pax,
            slotPax: e.slotPax,
            updatedAt: new Date().toISOString()
          };
        });
        savedEvent = updatedEvents.find(e => String(e.id) === String(id));
      } else {
        updatedEvents = events.map(e => String(e.id) === String(id) ? { ...e, ...eventData, updatedAt: new Date().toISOString() } : e);
        savedEvent = updatedEvents.find(e => String(e.id) === String(id));
      }
      await api.put('/api/state', { state: { ...currentState, events: updatedEvents } });
      return savedEvent;
    } catch (err) {
      console.error('Error actualizando en el servidor:', err);
      throw err;
    }
  },

  async delete(id) {
    try {
      const response = await api.get('/api/state', { t: Date.now() });
      const currentState = response?.state || {};
      const events = currentState.events || [];
      await api.put('/api/state', { state: { ...currentState, events: events.filter(e => e.id !== id) } });
    } catch (err) {
      console.error('Error eliminando en el servidor:', err);
      throw err;
    }
    return true;
  },

  async updateStatus(id, status) {
    return this.update(id, { status });
  },
};

export default eventService;
