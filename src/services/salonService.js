import api from './api';
import { loadState } from './stateService';

export const salonService = {
  async getAll() {
    try {
      const state = await loadState();
      return state?.salones || [];
    } catch (err) {
      console.error('Error al obtener salones de la base de datos:', err);
      return [];
    }
  },

  async getSalones() {
    try {
      const result = await api.get('/api/salones');
      return result?.salones || [];
    } catch (err) {
      console.error('Error al obtener salones de la base de datos:', err);
      return [];
    }
  },
};

export default salonService;
