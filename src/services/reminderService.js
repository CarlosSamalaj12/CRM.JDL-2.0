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
    return reminders[eventId] || [];
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
      createdAt: new Date().toISOString(),
      createdBy: authService.getCurrentUser()?.id || 'unknown'
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

  async getUpcoming() {
    const reminders = await this.getAll();
    const allReminders = [];
    const now = new Date();

    Object.entries(reminders).forEach(([eventId, eventReminders]) => {
      eventReminders.forEach(rem => {
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