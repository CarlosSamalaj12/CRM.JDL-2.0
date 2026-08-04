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
    try {
      const state = await loadState({ cacheBust: false });
      const events = state?.events || [];
      const targetEvent = events.find(e => String(e.id) === String(eventId));
      
      const groupId = targetEvent?.groupId ? String(targetEvent.groupId).trim() : null;
      const history = state?.changeHistory || {};
      
      if (groupId) {
        // Encontrar todos los IDs de eventos que comparten el mismo groupId o cuyo ID coincide con el groupId
        const groupEventIds = events
          .filter(e => String(e.groupId).trim() === groupId || String(e.id).trim() === groupId)
          .map(e => String(e.id));
        
        groupEventIds.push(groupId);
        
        const uniqueIds = Array.from(new Set(groupEventIds));
        const consolidated = [];
        const seenKeys = new Set();
        
        for (const id of uniqueIds) {
          const list = history[id] || [];
          for (const entry of list) {
            const uniqueKey = `${entry.at || entry.timestamp}|${entry.change}|${entry.actorUserId}`;
            if (!seenKeys.has(uniqueKey)) {
              seenKeys.add(uniqueKey);
              consolidated.push(entry);
            }
          }
        }
        
        // Ordenar el historial consolidado cronológicamente por marca de tiempo
        consolidated.sort((a, b) => new Date(a.at || a.timestamp || 0) - new Date(b.at || b.timestamp || 0));
        return consolidated;
      }
      
      return history[eventId] || [];
    } catch (err) {
      console.error('Error al obtener historial consolidado por eventId:', err);
      return [];
    }
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
    const ignoredFields = new Set(['slots', 'id', 'groupId', 'quote']);
    
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
