import api from './api';
import authService from './authService';

export const reminderService = {
  async getAll() {
    try {
      const response = await api.get('/api/state');
      return response?.state?.reminders || {};
    } catch (err) {
      console.error('Error al obtener recordatorios:', err);
      return {};
    }
  },

  async getByEventId(eventId) {
    const reminders = await this.getAll();
    const allForEvent = reminders[eventId] || [];
    
    const currentUser = authService.getCurrentUser();
    // Los administradores ven todas las citas del evento.
    // Los demás roles solo ven las que ellos crearon.
    if (currentUser?.role === 'admin') return allForEvent;
    return allForEvent.filter(r => !r.createdBy || r.createdBy === currentUser?.id);
  },

  async add(eventId, reminderData) {
    const currentReminders = await this.getAll();
    const eventReminders = currentReminders[eventId] || [];
    
    const newReminder = {
      id: `rem_${Date.now()}`,
      date: reminderData.date,
      time: reminderData.time,
      channel: reminderData.channel || 'whatsapp',
      notes: reminderData.notes || '',
      notes: reminderData.notes || '',
      createdAt: new Date().toISOString(),
      createdBy: authService.getCurrentUser()?.id || 'unknown',
      creatorName: authService.getCurrentUser()?.name || authService.getCurrentUser()?.email || 'Usuario'
    };

    const updatedReminders = {
      ...currentReminders,
      [eventId]: [...eventReminders, newReminder]
    };

    try {
      const response = await api.get('/api/state', { t: Date.now() });
      const currentState = response?.state || {};
      await api.put('/api/state', { 
        state: { ...currentState, reminders: updatedReminders } 
      });
      return newReminder;
    } catch (err) {
      console.error('Error agregando recordatorio:', err);
      throw err;
    }
  },

  async delete(eventId, reminderId) {
    const currentReminders = await this.getAll();
    const eventReminders = currentReminders[eventId] || [];
    
    const updatedReminders = {
      ...currentReminders,
      [eventId]: eventReminders.filter(r => r.id !== reminderId)
    };

    try {
      const response = await api.get('/api/state', { t: Date.now() });
      const currentState = response?.state || {};
      await api.put('/api/state', { 
        state: { ...currentState, reminders: updatedReminders } 
      });
      return true;
    } catch (err) {
      console.error('Error eliminando recordatorio:', err);
      throw err;
    }
  },

  async update(eventId, reminderId, updatedData) {
    const currentReminders = await this.getAll();
    const eventReminders = currentReminders[eventId] || [];
    
    const updatedRemindersList = eventReminders.map(rem => {
      if (rem.id === reminderId) {
        return {
          ...rem,
          date: updatedData.date,
          time: updatedData.time,
          channel: updatedData.channel,
          notes: updatedData.notes,
          updatedAt: new Date().toISOString()
        };
      }
      return rem;
    });

    const updatedReminders = {
      ...currentReminders,
      [eventId]: updatedRemindersList
    };

    try {
      const response = await api.get('/api/state', { t: Date.now() });
      const currentState = response?.state || {};
      await api.put('/api/state', { 
        state: { ...currentState, reminders: updatedReminders } 
      });
      return true;
    } catch (err) {
      console.error('Error actualizando recordatorio:', err);
      throw err;
    }
  },

  async getUpcoming() {
    const reminders = await this.getAll();
    const allReminders = [];
    const now = new Date();
    const currentUser = authService.getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';

    Object.entries(reminders).forEach(([eventId, eventReminders]) => {
      eventReminders.forEach(rem => {
        // Filtrar por usuario: admin ve todo, los demás solo sus propias citas.
        const isMine = !rem.createdBy || rem.createdBy === currentUser?.id;
        if (!isAdmin && !isMine) return;

        const reminderDateTime = new Date(`${rem.date}T${rem.time}:00`);
        if (reminderDateTime >= now) {
          allReminders.push({ ...rem, eventId });
        }
      });
    });

    return allReminders.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}:00`);
      const dateB = new Date(`${b.date}T${b.time}:00`);
      return dateA - dateB;
    });
  }
};

export default reminderService;