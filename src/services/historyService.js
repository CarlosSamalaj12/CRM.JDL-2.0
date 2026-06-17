import authService from './authService';
import { loadState, saveState } from './stateService';

export const historyService = {
  async getAll() {
    try {
      const state = await loadState({ cacheBust: false });
      return state?.changeHistory || {};
    } catch (err) {
      console.error('Error al obtener historial:', err);
      return {};
    }
  },

  async getByEventId(eventId) {
    const history = await this.getAll();
    return history[eventId] || [];
  },

  async add(eventId, changeDescription) {
    const currentHistory = await this.getAll();
    const eventHistory = currentHistory[eventId] || [];
    
    const currentUser = authService.getCurrentUser();
    
    const newEntry = {
      id: `hist_${Date.now()}`,
      at: new Date().toISOString(),
      actorUserId: currentUser?.id || 'unknown',
      actorName: currentUser?.fullName || currentUser?.name || 'Usuario',
      avatarDataUrl: currentUser?.avatarDataUrl || '',
      change: changeDescription
    };

    const updatedHistory = {
      ...currentHistory,
      [eventId]: [...eventHistory, newEntry]
    };

    try {
      const currentState = await loadState();
      await saveState({ ...currentState, changeHistory: updatedHistory });
      return newEntry;
    } catch (err) {
      console.error('Error agregando entrada de historial:', err);
      throw err;
    }
  },

  async addDetailed(eventId, oldSnapshot, newSnapshot) {
    const changes = [];
    const ignoredFields = new Set(['slots', 'id', 'groupId']);
    
    Object.keys(newSnapshot).forEach(key => {
      if (ignoredFields.has(key)) return;
      
      const oldValue = oldSnapshot[key];
      const newValue = newSnapshot[key];
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push(`• ${this.formatFieldName(key)}: "${oldValue || '-'}" → "${newValue || '-'}"`);
      }
    });
    
    if (changes.length > 0) {
      await this.add(eventId, `Cambios: ${changes.join(', ')}`);
    }
  },

  formatFieldName(field) {
    const fieldNames = {
      name: 'Nombre del evento',
      salon: 'Salón',
      date: 'Fecha de inicio',
      endDate: 'Fecha de fin',
      startTime: 'Hora de inicio',
      endTime: 'Hora de fin',
      status: 'Estado',
      pax: 'Cantidad de personas',
      notes: 'Notas',
      clientName: 'Nombre del cliente',
      clientPhone: 'Teléfono del cliente',
      userId: 'Encargado'
    };
    return fieldNames[field] || field;
  }
};

export default historyService;
