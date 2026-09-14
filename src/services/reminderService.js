import authService from './authService';
import { loadState, saveState } from './stateService';
import api from './api';

export const reminderService = {
  async getAll() {
    try {
      const state = await loadState({ cacheBust: false });
      return state?.reminders || {};
    } catch (err) {
      console.error('Error al obtener recordatorios:', err);
      return {};
    }
  },

  async getByEventId(eventId) {
    const rawId = String(eventId || '').trim();
    const currentUser = authService.getCurrentUser();

    if (rawId) {
      try {
        const items = await api.get(`/api/events/${encodeURIComponent(rawId)}/reminders`);
        if (Array.isArray(items)) {
          if (currentUser?.role === 'admin') return items;
          return items.filter(r => {
            const creatorId = r.createdBy || r.createdByUserId;
            return !creatorId || creatorId === currentUser?.id;
          });
        }
      } catch (apiErr) {
        console.warn('[reminderService.getByEventId] Falló endpoint atómico, recurriendo a estado local:', apiErr);
      }
    }

    const reminders = await this.getAll();
    const allForEvent = reminders[rawId] || [];
    
    // Los administradores ven todas las citas del evento.
    // Los demás roles solo ven las que ellos crearon.
    if (currentUser?.role === 'admin') return allForEvent;
    return allForEvent.filter(r => {
      const creatorId = r.createdBy || r.createdByUserId;
      return !creatorId || creatorId === currentUser?.id;
    });
  },

  async add(eventId, reminderData) {
    const rawId = String(eventId || '').trim();
    const currentUser = authService.getCurrentUser();
    const createdBy = currentUser?.id || 'unknown';
    const creatorName = currentUser?.name || currentUser?.email || 'Usuario';

    try {
      const res = await api.post(`/api/events/${encodeURIComponent(rawId)}/reminders`, {
        date: reminderData.date,
        time: reminderData.time,
        channel: reminderData.channel || 'whatsapp',
        notes: reminderData.notes || '',
        createdBy
      });
      if (res?.reminder) {
        return { ...res.reminder, creatorName };
      }
    } catch (apiErr) {
      console.warn('[reminderService.add] Falló endpoint atómico, recurriendo a saveState fallback:', apiErr);
    }

    const currentReminders = await this.getAll();
    const eventReminders = currentReminders[rawId] || [];
    
    const newReminder = {
      id: `rem_${Date.now()}`,
      date: reminderData.date,
      time: reminderData.time,
      channel: reminderData.channel || 'whatsapp',
      notes: reminderData.notes || '',
      createdAt: new Date().toISOString(),
      createdBy,
      creatorName,
      finalizado: false
    };

    const updatedReminders = {
      ...currentReminders,
      [rawId]: [...eventReminders, newReminder]
    };

    try {
      const currentState = await loadState();
      await saveState({ ...currentState, reminders: updatedReminders });
      return newReminder;
    } catch (err) {
      console.error('Error agregando recordatorio:', err);
      throw err;
    }
  },

  async delete(eventId, reminderId) {
    const rawId = String(eventId || '').trim();
    const remId = String(reminderId || '').trim();

    try {
      await api.delete(`/api/events/${encodeURIComponent(rawId)}/reminders/${encodeURIComponent(remId)}`);
      return true;
    } catch (apiErr) {
      console.warn('[reminderService.delete] Falló endpoint atómico, recurriendo a saveState fallback:', apiErr);
    }

    const currentReminders = await this.getAll();
    const eventReminders = currentReminders[rawId] || [];
    
    const updatedReminders = {
      ...currentReminders,
      [rawId]: eventReminders.filter(r => r.id !== remId)
    };

    try {
      const currentState = await loadState();
      await saveState({ ...currentState, reminders: updatedReminders });
      return true;
    } catch (err) {
      console.error('Error eliminando recordatorio:', err);
      throw err;
    }
  },

  async markAsFinalizado(eventId, reminderId) {
    const rawId = String(eventId || '').trim();
    const remId = String(reminderId || '').trim();

    try {
      await api.patch(`/api/events/${encodeURIComponent(rawId)}/reminders/${encodeURIComponent(remId)}/toggle`, {
        finalizado: true
      });
      return true;
    } catch (apiErr) {
      console.warn('[reminderService.markAsFinalizado] Falló endpoint atómico, recurriendo a saveState fallback:', apiErr);
    }

    const currentReminders = await this.getAll();
    const eventReminders = currentReminders[rawId] || [];

    const updatedRemindersList = eventReminders.map(rem => {
      if (rem.id === remId) {
        return { ...rem, finalizado: true };
      }
      return rem;
    });

    const updatedReminders = {
      ...currentReminders,
      [rawId]: updatedRemindersList
    };

    try {
      const currentState = await loadState();
      await saveState({ ...currentState, reminders: updatedReminders });
      return true;
    } catch (err) {
      console.error('Error marcando recordatorio como finalizado:', err);
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
      const currentState = await loadState();
      await saveState({ ...currentState, reminders: updatedReminders });
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

    Object.entries(reminders).forEach(([eventId, eventReminders]) => {
      eventReminders.forEach(rem => {
        const creatorId = rem.createdBy || rem.createdByUserId;
        const isMine = !creatorId || creatorId === currentUser?.id;
        if (!isMine) return;
        if (rem.finalizado) return;

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
