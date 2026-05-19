import api from './api';

export const salonService = {
  async getAll() {
    try {
      const response = await api.get('/api/state', { t: Date.now() });
      return response?.state?.salones || [];
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