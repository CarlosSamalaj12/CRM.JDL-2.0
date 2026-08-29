import api from './api';

// Servicio de checklists relacionales.
// Reemplaza el uso directo de loadCrmState/saveCrmState sobre las claves
// checklistTemplates, checklistTemplateItems, checklistTemplateSections
// y eventChecklists en app_state_kv.

const BASE = '/api/checklist';

export const checklistService = {
  // Plantillas
  async getPlantillas({ includeInactive = true } = {}) {
    return api.get(`${BASE}/plantillas`, { includeInactive: String(includeInactive) });
  },

  async getPlantilla(id) {
    return api.get(`${BASE}/plantillas/${id}`);
  },

  async createPlantilla({ nombre, activo = true, secciones = [] }) {
    return api.post(`${BASE}/plantillas`, { nombre, activo, secciones });
  },

  async updatePlantilla(id, { nombre, activo = true, secciones = [] }) {
    return api.put(`${BASE}/plantillas/${id}`, { nombre, activo, secciones });
  },

  async setPlantillaActivo(id, activo) {
    return api.patch(`${BASE}/plantillas/${id}/activo`, { activo });
  },

  async deletePlantilla(id) {
    return api.delete(`${BASE}/plantillas/${id}`);
  },

  // Respuestas por evento
  async getEvento(eventoId) {
    return api.get(`${BASE}/eventos/${encodeURIComponent(eventoId)}`);
  },

  async saveEventoTab(eventoId, tab, { plantillaId, notas, items }) {
    return api.put(`${BASE}/eventos/${encodeURIComponent(eventoId)}/${tab}`, {
      plantillaId,
      notas,
      items,
    });
  },

  async getHistorial(eventoId, { tab, limit = 100 } = {}) {
    return api.get(`${BASE}/eventos/${encodeURIComponent(eventoId)}/historial`, { tab, limit });
  },

  // Snapshot (compatibilidad con reportes)
  async getSnapshot() {
    return api.get(`${BASE}/snapshot`);
  },

  // Migración (admin)
  async migrate() {
    return api.post(`${BASE}/migrar`);
  },
};

export default checklistService;
