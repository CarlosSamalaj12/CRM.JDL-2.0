import api from './api';

export async function getHabitacionesApi(params = {}) {
  const q = new URLSearchParams();
  if (params.mes) q.set('mes', params.mes);
  if (params.desde) q.set('desde', params.desde);
  if (params.hasta) q.set('hasta', params.hasta);
  if (params.vendedor) q.set('vendedor', params.vendedor);
  if (params.estado) q.set('estado', params.estado);
  if (params.tipo_habitacion) q.set('tipo_habitacion', params.tipo_habitacion);
  if (params.search) q.set('search', params.search);

  const queryStr = q.toString() ? `?${q.toString()}` : '';
  return await api.get(`/api/habitaciones${queryStr}`);
}

export async function getHabitacionApi(id) {
  if (!id) throw new Error('ID de reserva requerido');
  return await api.get(`/api/habitaciones/${encodeURIComponent(id)}`);
}

export async function createHabitacionApi(data) {
  const res = await api.post('/api/habitaciones', data);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('habitaciones-updated'));
  }
  return res;
}

export async function updateHabitacionApi(id, data) {
  if (!id) throw new Error('ID de reserva requerido');
  const res = await api.put(`/api/habitaciones/${encodeURIComponent(id)}`, data);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('habitaciones-updated'));
  }
  return res;
}

export async function deleteHabitacionApi(id, { hard = false } = {}) {
  if (!id) throw new Error('ID de reserva requerido');
  const queryStr = hard ? '?hard=true' : '';
  const res = await api.delete(`/api/habitaciones/${encodeURIComponent(id)}${queryStr}`);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('habitaciones-updated'));
  }
  return res;
}

export async function registrarContactoApi(id, { tipo = 'WhatsApp' } = {}) {
  if (!id) throw new Error('ID de reserva requerido');
  const res = await api.post(`/api/habitaciones/${encodeURIComponent(id)}/contacto`, { tipo });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('habitaciones-updated'));
  }
  return res;
}

export async function getHuespedHistorialApi(query) {
  if (!query) return { totalEstancias: 0, esFrecuente: false, estancias: [] };
  return await api.get(`/api/habitaciones/huesped/historial?query=${encodeURIComponent(query)}`);
}

export async function getCatalogosHabitacionesApi(categoria) {
  if (!categoria) throw new Error('Categoría de catálogo requerida');
  return await api.get(`/api/habitaciones/catalogos/${encodeURIComponent(categoria)}`);
}

export async function createCatalogoHabitacionApi(categoria, data) {
  if (!categoria) throw new Error('Categoría de catálogo requerida');
  const res = await api.post(`/api/habitaciones/catalogos/${encodeURIComponent(categoria)}`, data);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('habitaciones-catalogos-updated'));
  }
  return res;
}

export async function updateCatalogoHabitacionApi(categoria, id, data) {
  if (!categoria || !id) throw new Error('Categoría e ID requeridos');
  const res = await api.put(`/api/habitaciones/catalogos/${encodeURIComponent(categoria)}/${encodeURIComponent(id)}`, data);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('habitaciones-catalogos-updated'));
  }
  return res;
}

export async function getCatalogoItemUsageApi(categoria, id) {
  if (!categoria || !id) throw new Error('Categoría e ID requeridos');
  return await api.get(`/api/habitaciones/catalogos/${encodeURIComponent(categoria)}/${encodeURIComponent(id)}/usage`);
}

export async function deleteCatalogoHabitacionApi(categoria, id) {
  if (!categoria || !id) throw new Error('Categoría e ID requeridos');
  const res = await api.delete(`/api/habitaciones/catalogos/${encodeURIComponent(categoria)}/${encodeURIComponent(id)}`);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('habitaciones-catalogos-updated'));
  }
  return res;
}

export async function getMetasHabitacionesApi(mes = '') {
  const queryStr = mes ? `?mes=${encodeURIComponent(mes)}` : '';
  return await api.get(`/api/habitaciones/metas${queryStr}`);
}

export async function updateMetasHabitacionesApi(data) {
  const res = await api.put('/api/habitaciones/metas', data);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('habitaciones-metas-updated'));
  }
  return res;
}

export async function getCampanaClientesPorSegmentoApi(idSegmento) {
  if (!idSegmento) return [];
  return await api.get(`/api/habitaciones/campanas/segmento/${encodeURIComponent(idSegmento)}`);
}

export async function uploadPromocionImagenApi(file) {
  if (!file) throw new Error('Archivo requerido');

  // 1. Lectura inmediata a Base64 Data URL para visualización y persistencia garantizada
  let localDataUrl = null;
  try {
    localDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  } catch (readErr) {
    console.warn('[uploadPromocionImagenApi] No se pudo leer localmente con FileReader:', readErr);
  }

  // 2. Intentar subir al servidor mediante FormData / API
  try {
    const formData = new FormData();
    formData.append('imagen', file);
    if (localDataUrl) {
      formData.append('dataUrl', localDataUrl);
    }

    const res = await api.postForm('/api/habitaciones/catalogos/upload-imagen', formData);
    if (res?.url) {
      return res;
    }
  } catch (err) {
    console.warn('[uploadPromocionImagenApi] Backend upload falló, usando Base64 local:', err?.message);
  }

  // 3. Fallback infalible con DataURL de alta fidelidad
  if (localDataUrl) {
    return {
      url: localDataUrl,
      filename: file.name,
      size: file.size,
      mimeType: file.type || 'image/jpeg'
    };
  }

  throw new Error('No se pudo procesar la imagen');
}

const habitacionesService = {
  getHabitaciones: getHabitacionesApi,
  getHabitacion: getHabitacionApi,
  createHabitacion: createHabitacionApi,
  updateHabitacion: updateHabitacionApi,
  deleteHabitacion: deleteHabitacionApi,
  registrarContacto: registrarContactoApi,
  getHuespedHistorial: getHuespedHistorialApi,
  getCatalogos: getCatalogosHabitacionesApi,
  getCatalogoItemUsage: getCatalogoItemUsageApi,
  createCatalogo: createCatalogoHabitacionApi,
  updateCatalogo: updateCatalogoHabitacionApi,
  deleteCatalogo: deleteCatalogoHabitacionApi,
  getMetas: getMetasHabitacionesApi,
  updateMetas: updateMetasHabitacionesApi,
  getCampanaClientesPorSegmento: getCampanaClientesPorSegmentoApi,
  uploadPromocionImagen: uploadPromocionImagenApi,
};

export default habitacionesService;

