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
      id: eventData.id || `evt_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    
    try {
      const response = await api.get('/api/state', { t: Date.now() });
      const currentState = response?.state || {};
      const events = currentState.events || [];
      const updatedState = { ...currentState, events: [...events, newEvent] };
      await api.put('/api/state', { state: updatedState });
    } catch (err) {
      console.error('Error guardando en el servidor:', err);
      throw err;
    }
    
    return newEvent;
  },

  async update(id, eventData) {
    try {
      const response = await api.get('/api/state', { t: Date.now() });
      const currentState = response?.state || {};
      const events = currentState.events || [];
      const updatedEvents = events.map(e => e.id === id ? { ...e, ...eventData, updatedAt: new Date().toISOString() } : e);
      await api.put('/api/state', { state: { ...currentState, events: updatedEvents } });
      return updatedEvents.find(e => e.id === id);
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