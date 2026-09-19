import api from './api';

let stateEtag = null;
let cachedState = null;
let cacheTimestamp = 0;       // Unix ms — cuándo se guardó el cachedState
let activeLoadPromise = null;
const CACHE_TTL_MS = 90_000;  // 90 segundos máximo de vida del caché en memoria
const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;

export async function loadState({ cacheBust = false } = {}) {
  const now = Date.now();
  const cacheExpired = (now - cacheTimestamp) > CACHE_TTL_MS;

  // Servir caché si: existe, no expiró, y no se pidió bust explícito
  if (cachedState && !cacheBust && !cacheExpired) {
    return cachedState;
  }
  if (activeLoadPromise && !cacheBust) {
    return activeLoadPromise;
  }

  const promise = (async () => {
    const url = `${API_BASE_URL}/api/state${cacheBust ? `?t=${Date.now()}` : ''}`;
    const headers = { 'Content-Type': 'application/json' };
    if (stateEtag && cachedState && !cacheBust && !cacheExpired) headers['If-None-Match'] = stateEtag;

    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(url, { method: 'GET', headers });

      if (response.status === 304 && cachedState) {
        // 304 significa que el servidor confirma que no hubo cambios.
        // Refrescar el timestamp para reiniciar el TTL.
        cacheTimestamp = Date.now();
        return cachedState;
      }

      const newEtag = response.headers.get('ETag');
      if (newEtag && !cacheBust) stateEtag = newEtag;

      const data = await response.json();
      const state = data?.state || data || {};
      cachedState = state;
      cacheTimestamp = Date.now();
      return state;
    } catch (error) {
      console.error('loadState error:', error);
      return cachedState || {};
    } finally {
      if (activeLoadPromise === promise) {
        activeLoadPromise = null;
      }
    }
  })();

  if (!cacheBust) {
    activeLoadPromise = promise;
  }

  return promise;
}

/** Invalida el caché en memoria sin hacer un request.
 *  Útil cuando el socket notifica un cambio y queremos que
 *  el próximo loadState() vaya siempre al servidor. */
export function invalidateStateCache() {
  cacheTimestamp = 0;
  stateEtag = null;
}

function compressBase64Image(dataUrl, type) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve(dataUrl);
      return;
    }
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      resolve(dataUrl);
      return;
    }
    // If it's already small (< 100KB), don't process
    if (dataUrl.length < 100000) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (type === 'avatar') {
        const maxDim = 150;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
      } else {
        const maxW = 400;
        const maxH = 200;
        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const mime = type === 'avatar' ? 'image/jpeg' : 'image/png';
      const quality = type === 'avatar' ? 0.75 : undefined;
      resolve(canvas.toDataURL(mime, quality));
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
}

export async function saveState(state) {
  const nextState = state && typeof state === 'object' ? state : {};
  
  if (Array.isArray(nextState.users)) {
    const promises = nextState.users.map(async (u) => {
      if (u.avatarDataUrl && u.avatarDataUrl.length >= 100000) {
        u.avatarDataUrl = await compressBase64Image(u.avatarDataUrl, 'avatar');
      }
      if (u.signatureDataUrl && u.signatureDataUrl.length >= 100000) {
        u.signatureDataUrl = await compressBase64Image(u.signatureDataUrl, 'signature');
      }
      return u;
    });
    await Promise.all(promises);
  }

  // Actualizar caché local inmediatamente (antes del PUT)
  // para que el próximo loadState() use los datos frescos sin ir al servidor
  cachedState = nextState;
  // Invalidar ETag para que el servidor confirme el nuevo estado en la siguiente lectura
  stateEtag = null;

  try {
    const result = await api.put('/api/state', { state: nextState });

    // Notificar a los componentes que el state cambió
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('entity:changed', {
          detail: { entity: 'state', action: 'updated', data: { keys: Object.keys(nextState) } }
        }));
      }
    } catch (_) { /* noop */ }

    return result;
  } catch (err) {
    // En caso de error, limpiar caché para forzar re-lectura limpia
    cachedState = null;
    stateEtag = null;
    throw err;
  }
}

export async function updateState(updater, options = {}) {
  const currentState = await loadState(options);
  const nextState = typeof updater === 'function'
    ? await updater(currentState)
    : { ...currentState, ...(updater || {}) };

  await saveState(nextState);
  return nextState;
}

export async function saveCompanyApi(companyData) {
  if (!companyData || typeof companyData !== 'object') {
    throw new Error('Datos de empresa inválidos');
  }
  const res = await api.post('/api/companies', { company: companyData });
  const savedCompany = res?.company || companyData;

  // Actualizar la caché local en memoria para no requerir descargar los 17MB de nuevo
  if (cachedState && Array.isArray(cachedState.companies)) {
    const idx = cachedState.companies.findIndex(c => String(c.id) === String(savedCompany.id));
    if (idx >= 0) {
      cachedState.companies[idx] = savedCompany;
    } else {
      cachedState.companies.push(savedCompany);
    }
    if (companyData.active !== undefined && Array.isArray(cachedState.disabledCompanies)) {
      const idStr = String(savedCompany.id);
      if (companyData.active === false && !cachedState.disabledCompanies.includes(idStr)) {
        cachedState.disabledCompanies.push(idStr);
      } else if (companyData.active === true) {
        cachedState.disabledCompanies = cachedState.disabledCompanies.filter(x => String(x) !== idStr);
      }
    }
  }

  // Notificar al resto de la app
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'company', action: 'saved', data: savedCompany }
    }));
  }

  return savedCompany;
}

export async function saveQuickManagerApi(companyId, managerData) {
  if (!companyId || !managerData || !managerData.name) {
    throw new Error('ID de empresa y nombre de encargado requeridos');
  }
  const res = await api.post(`/api/companies/${companyId}/managers`, { manager: managerData });
  const savedManager = res?.manager || managerData;

  // Actualizar caché local
  if (cachedState && Array.isArray(cachedState.companies)) {
    const comp = cachedState.companies.find(c => String(c.id) === String(companyId));
    if (comp) {
      if (!Array.isArray(comp.managers)) comp.managers = [];
      const mIdx = comp.managers.findIndex(m => String(m.id) === String(savedManager.id));
      if (mIdx >= 0) comp.managers[mIdx] = savedManager;
      else comp.managers.push(savedManager);
      if (!comp.owner) comp.owner = savedManager.name;
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'manager', action: 'saved', data: { companyId, manager: savedManager } }
    }));
  }

  return savedManager;
}

export async function deleteCompanyApi(companyId) {
  if (!companyId) return null;
  const res = await api.request(`/api/companies/${companyId}`, { method: 'DELETE' });
  if (cachedState && Array.isArray(cachedState.companies)) {
    cachedState.companies = cachedState.companies.filter(c => String(c.id) !== String(companyId));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'company', action: 'deleted', data: { id: companyId } }
    }));
  }
  return res;
}

export async function saveServiceApi(serviceData) {
  if (!serviceData || typeof serviceData !== 'object') {
    throw new Error('Datos de servicio inválidos');
  }
  const isEdit = Boolean(serviceData.id);
  const endpoint = isEdit ? `/api/servicios/${encodeURIComponent(serviceData.id)}` : '/api/servicios';
  const method = isEdit ? 'put' : 'post';

  const res = await api[method](endpoint, serviceData);
  const savedService = res?.servicio || serviceData;

  // Actualizar la caché local en memoria
  if (cachedState && Array.isArray(cachedState.services)) {
    const idx = cachedState.services.findIndex(s => String(s.id) === String(savedService.id));
    if (idx >= 0) {
      cachedState.services[idx] = savedService;
    } else {
      cachedState.services.push(savedService);
    }
  }

  // Notificar al resto de la app
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'servicio', action: isEdit ? 'updated' : 'created', data: savedService }
    }));
  }

  return savedService;
}

export async function deleteServiceApi(serviceId) {
  if (!serviceId) return null;
  const res = await api.delete(`/api/servicios/${encodeURIComponent(serviceId)}`);

  // Actualizar caché local
  if (cachedState && Array.isArray(cachedState.services)) {
    cachedState.services = cachedState.services.filter(s => String(s.id) !== String(serviceId));
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'servicio', action: 'deleted', data: { id: serviceId } }
    }));
  }
  return res;
}

export async function batchImportServicesApi(servicesList) {
  if (!Array.isArray(servicesList) || servicesList.length === 0) {
    throw new Error('Lista de servicios vacía');
  }
  const res = await api.post('/api/servicios/batch', { servicios: servicesList });
  const savedList = res?.servicios || servicesList;

  if (cachedState && Array.isArray(cachedState.services)) {
    const map = new Map(cachedState.services.map(s => [String(s.id), s]));
    for (const s of savedList) {
      map.set(String(s.id), s);
    }
    cachedState.services = Array.from(map.values());
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'servicio', action: 'batch', data: { count: savedList.length } }
    }));
  }
  return res;
}

export async function saveCategoryApi(categoryData) {
  if (!categoryData || !categoryData.name) {
    throw new Error('Nombre de categoría requerido');
  }
  const hasDbId = Boolean(categoryData.id && !String(categoryData.id).startsWith('cat_'));
  const endpoint = hasDbId ? `/api/categorias-servicio/${encodeURIComponent(categoryData.id)}` : '/api/categorias-servicio';
  const method = hasDbId ? 'put' : 'post';

  const res = await api[method](endpoint, { nombre: categoryData.name });
  const savedCat = res?.categoria || categoryData;

  if (cachedState && Array.isArray(cachedState.serviceCategories)) {
    const idx = cachedState.serviceCategories.findIndex(c => String(c.id) === String(savedCat.id) || c.name === savedCat.name);
    if (idx >= 0) {
      cachedState.serviceCategories[idx] = { ...cachedState.serviceCategories[idx], ...savedCat };
    } else {
      cachedState.serviceCategories.push({ id: String(savedCat.id), name: savedCat.nombre || savedCat.name, subcategories: [] });
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'categoria_servicio', action: hasDbId ? 'updated' : 'created', data: savedCat }
    }));
  }
  return savedCat;
}

export async function deleteCategoryApi(categoryId) {
  if (!categoryId) return null;
  const res = await api.delete(`/api/categorias-servicio/${encodeURIComponent(categoryId)}`);

  if (cachedState && Array.isArray(cachedState.serviceCategories)) {
    cachedState.serviceCategories = cachedState.serviceCategories.filter(c => String(c.id) !== String(categoryId));
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'categoria_servicio', action: 'deleted', data: { id: categoryId } }
    }));
  }
  return res;
}

export async function saveSubcategoryApi(categoryId, subcategoryData) {
  if (!categoryId || !subcategoryData || !subcategoryData.name) {
    throw new Error('Categoría y nombre de subcategoría requeridos');
  }
  const hasDbId = Boolean(subcategoryData.id && !String(subcategoryData.id).startsWith('sub_'));
  const endpoint = hasDbId ? `/api/subcategorias-servicio/${encodeURIComponent(subcategoryData.id)}` : '/api/subcategorias-servicio';
  const method = hasDbId ? 'put' : 'post';

  const res = await api[method](endpoint, { id_categoria: categoryId, nombre: subcategoryData.name });
  const savedSub = res?.subcategoria || subcategoryData;

  if (cachedState && Array.isArray(cachedState.serviceCategories)) {
    const cat = cachedState.serviceCategories.find(c => String(c.id) === String(categoryId));
    if (cat) {
      if (!Array.isArray(cat.subcategories)) cat.subcategories = [];
      const sIdx = cat.subcategories.findIndex(s => String(s.id) === String(savedSub.id));
      if (sIdx >= 0) cat.subcategories[sIdx] = savedSub;
      else cat.subcategories.push(savedSub);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'subcategoria_servicio', action: hasDbId ? 'updated' : 'created', data: savedSub }
    }));
  }
  return savedSub;
}

export async function deleteSubcategoryApi(subcategoryId, categoryId = null) {
  if (!subcategoryId) return null;
  let res;
  if (categoryId) {
    res = await api.delete(`/api/categorias-servicio/${encodeURIComponent(categoryId)}/subcategorias/${encodeURIComponent(subcategoryId)}`).catch(() => null);
  }
  if (!res) {
    res = await api.delete(`/api/subcategorias-servicio/${encodeURIComponent(subcategoryId)}`);
  }

  if (cachedState && Array.isArray(cachedState.serviceCategories)) {
    for (const c of cachedState.serviceCategories) {
      if (Array.isArray(c.subcategories)) {
        c.subcategories = c.subcategories.filter(s => String(s.id) !== String(subcategoryId));
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'subcategoria_servicio', action: 'deleted', data: { id: subcategoryId } }
    }));
  }
  return res;
}

export async function getPlantillasApi() {
  const res = await api.get('/api/plantillas');
  const plantillas = res?.plantillas || [];
  if (cachedState) {
    cachedState.quickTemplates = plantillas;
    cachedState.quoteServiceTemplates = plantillas;
  }
  return plantillas;
}

export async function savePlantillaApi(plantillaData) {
  if (!plantillaData || typeof plantillaData !== 'object') {
    throw new Error('Datos de plantilla inválidos');
  }
  const res = await api.post('/api/plantillas', { plantilla: plantillaData });
  const saved = res?.plantilla || plantillaData;

  if (cachedState) {
    const updateList = (list) => {
      if (!Array.isArray(list)) return [saved];
      const idx = list.findIndex(t => String(t.id) === String(saved.id));
      if (idx >= 0) list[idx] = saved;
      else list.push(saved);
      return list;
    };
    cachedState.quickTemplates = updateList(cachedState.quickTemplates);
    cachedState.quoteServiceTemplates = updateList(cachedState.quoteServiceTemplates);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'plantilla', action: 'saved', data: saved }
    }));
  }
  return saved;
}

export async function deletePlantillaApi(plantillaId) {
  if (!plantillaId) return null;
  const res = await api.delete(`/api/plantillas/${encodeURIComponent(plantillaId)}`);
  if (cachedState) {
    if (Array.isArray(cachedState.quickTemplates)) {
      cachedState.quickTemplates = cachedState.quickTemplates.filter(t => String(t.id) !== String(plantillaId));
    }
    if (Array.isArray(cachedState.quoteServiceTemplates)) {
      cachedState.quoteServiceTemplates = cachedState.quoteServiceTemplates.filter(t => String(t.id) !== String(plantillaId));
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'plantilla', action: 'deleted', data: { id: plantillaId } }
    }));
  }
  return res;
}

export async function getExchangeRateDataApi() {
  try {
    const res = await api.get('/api/exchange-rate');
    const currentRate = Number(res?.currentRate ?? res?.exchangeRate ?? 7.75);
    const validRate = Number.isFinite(currentRate) && currentRate > 0 ? currentRate : 7.75;
    const history = Array.isArray(res?.history) ? res.history : [];
    if (cachedState) {
      cachedState.exchangeRate = validRate;
      cachedState.exchangeRateHistory = history;
    }
    return {
      currentRate: validRate,
      effectiveDate: res?.effectiveDate || null,
      history,
    };
  } catch (err) {
    return {
      currentRate: cachedState?.exchangeRate ? Number(cachedState.exchangeRate) : 7.75,
      effectiveDate: null,
      history: Array.isArray(cachedState?.exchangeRateHistory) ? cachedState.exchangeRateHistory : [],
    };
  }
}

export async function addExchangeRateHistoryApi({ fechaVigencia, tasa, notas }) {
  const rate = Number(tasa);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Tipo de cambio inválido. Debe ser un número mayor a 0.');
  }
  const dateStr = String(fechaVigencia || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('Fecha de vigencia inválida. Formato requerido: AAAA-MM-DD.');
  }

  const res = await api.post('/api/exchange-rate/history', {
    fechaVigencia: dateStr,
    tasa: rate,
    notas: notas || '',
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'exchange_rate', action: 'created', data: res?.entry }
    }));
    window.dispatchEvent(new Event('stateUpdated'));
  }
  return res;
}

export async function updateExchangeRateHistoryApi(id, { fechaVigencia, tasa, notas }) {
  if (!id) throw new Error('ID de registro histórico requerido.');
  const rate = Number(tasa);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Tipo de cambio inválido. Debe ser un número mayor a 0.');
  }
  const dateStr = String(fechaVigencia || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('Fecha de vigencia inválida. Formato requerido: AAAA-MM-DD.');
  }

  const res = await api.put(`/api/exchange-rate/history/${encodeURIComponent(id)}`, {
    fechaVigencia: dateStr,
    tasa: rate,
    notas: notas || '',
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'exchange_rate', action: 'updated', data: { id, fechaVigencia: dateStr, tasa: rate } }
    }));
    window.dispatchEvent(new Event('stateUpdated'));
  }
  return res;
}

export async function deleteExchangeRateHistoryApi(id) {
  if (!id) throw new Error('ID de registro histórico requerido.');
  const res = await api.delete(`/api/exchange-rate/history/${encodeURIComponent(id)}`);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'exchange_rate', action: 'deleted', data: { id } }
    }));
    window.dispatchEvent(new Event('stateUpdated'));
  }
  return res;
}

export async function resolveExchangeRateAtDateApi(date) {
  const dateStr = String(date || '').trim().slice(0, 10);
  try {
    const res = await api.get(`/api/exchange-rate/resolve?date=${encodeURIComponent(dateStr)}`);
    return {
      rate: Number(res?.rate || 7.75),
      effectiveDate: res?.effectiveDate || null,
      notas: res?.notas || '',
    };
  } catch (err) {
    return { rate: 7.75, effectiveDate: null, notas: '' };
  }
}

export async function getExchangeRateApi() {
  try {
    const res = await api.get('/api/exchange-rate');
    const rate = Number(res?.currentRate ?? res?.exchangeRate ?? 7.75);
    const validRate = Number.isFinite(rate) && rate > 0 ? rate : 7.75;
    if (cachedState) {
      cachedState.exchangeRate = validRate;
    }
    return validRate;
  } catch (err) {
    if (cachedState && cachedState.exchangeRate) {
      return Number(cachedState.exchangeRate);
    }
    return 7.75;
  }
}

export async function saveExchangeRateApi(rate) {
  const num = typeof rate === 'number' ? rate : parseFloat(rate);
  if (!num || num <= 0 || !Number.isFinite(num)) {
    throw new Error('Tipo de cambio inválido. Debe ser un número mayor a 0.');
  }

  const res = await api.put('/api/exchange-rate', { exchangeRate: num });
  const savedRate = Number(res?.exchangeRate ?? num);

  if (cachedState) {
    cachedState.exchangeRate = savedRate;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'exchange_rate', action: 'updated', data: { exchangeRate: savedRate } }
    }));
    window.dispatchEvent(new Event('stateUpdated'));
  }

  return savedRate;
}

export async function getSettingApi(key, defaultValue = null) {
  if (!key) return defaultValue;
  try {
    const res = await api.get(`/api/settings/${encodeURIComponent(key)}`);
    const val = res?.value !== undefined ? res.value : defaultValue;
    if (cachedState) {
      cachedState[key] = val;
    }
    return val;
  } catch (err) {
    if (cachedState && cachedState[key] !== undefined) {
      return cachedState[key];
    }
    return defaultValue;
  }
}

export async function saveSettingApi(key, value) {
  if (!key) throw new Error('Clave de configuración requerida.');
  const res = await api.put(`/api/settings/${encodeURIComponent(key)}`, { value });
  const savedVal = res?.value !== undefined ? res.value : value;

  if (cachedState) {
    cachedState[key] = savedVal;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('entity:changed', {
      detail: { entity: 'setting', action: 'updated', data: { key, value: savedVal } }
    }));
    window.dispatchEvent(new Event('stateUpdated'));
  }

  return savedVal;
}

export async function getEventAdvancesApi(eventId) {
  if (!eventId) return { advances: [], advanceLogs: [], summary: {} };
  try {
    const res = await api.get(`/api/events/${encodeURIComponent(eventId)}/anticipos`);
    return res || { advances: [], advanceLogs: [], summary: {} };
  } catch (err) {
    console.error('Error en getEventAdvancesApi:', err);
    return { advances: [], advanceLogs: [], summary: {} };
  }
}

export async function addEventAdvanceApi(eventId, data) {
  if (!eventId) throw new Error('eventId requerido para registrar anticipo.');
  const res = await api.post(`/api/events/${encodeURIComponent(eventId)}/anticipos`, data);
  cachedState = null;
  cacheTimestamp = 0;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('stateUpdated'));
  }
  return res;
}

export async function updateEventAdvanceApi(eventId, advanceId, data) {
  if (!eventId || !advanceId) throw new Error('eventId y advanceId requeridos para actualizar anticipo.');
  const res = await api.put(`/api/events/${encodeURIComponent(eventId)}/anticipos/${encodeURIComponent(advanceId)}`, data);
  cachedState = null;
  cacheTimestamp = 0;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('stateUpdated'));
  }
  return res;
}

export async function deleteEventAdvanceApi(eventId, advanceId, payload = {}) {
  if (!eventId || !advanceId) throw new Error('eventId y advanceId requeridos para eliminar anticipo.');
  const res = await api.delete(`/api/events/${encodeURIComponent(eventId)}/anticipos/${encodeURIComponent(advanceId)}`, payload);
  cachedState = null;
  cacheTimestamp = 0;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('stateUpdated'));
  }
  return res;
}

const stateService = {
  loadState,
  saveState,
  updateState,
  saveCompanyApi,
  saveQuickManagerApi,
  deleteCompanyApi,
  saveServiceApi,
  deleteServiceApi,
  batchImportServicesApi,
  saveCategoryApi,
  deleteCategoryApi,
  saveSubcategoryApi,
  deleteSubcategoryApi,
  getPlantillasApi,
  savePlantillaApi,
  deletePlantillaApi,
  getExchangeRateApi,
  saveExchangeRateApi,
  getExchangeRateDataApi,
  addExchangeRateHistoryApi,
  updateExchangeRateHistoryApi,
  deleteExchangeRateHistoryApi,
  resolveExchangeRateAtDateApi,
  getSettingApi,
  saveSettingApi,
  getEventAdvancesApi,
  addEventAdvanceApi,
  updateEventAdvanceApi,
  deleteEventAdvanceApi,
};

export default stateService;


