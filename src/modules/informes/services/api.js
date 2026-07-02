const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

let usuariosCache = null;
let usuariosCachePromise = null;

export async function getUsuariosCached() {
  if (usuariosCache) return usuariosCache;
  if (usuariosCachePromise) return usuariosCachePromise;
  usuariosCachePromise = getUsuarios().then(data => {
    usuariosCache = data;
    usuariosCachePromise = null;
    return data;
  }).catch(err => {
    usuariosCachePromise = null;
    throw err;
  });
  return usuariosCachePromise;
}

export async function fetchEvents(date) {
  const url = date ? `${apiUrl}/api/events?date=${date}` : `${apiUrl}/api/events`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('No se pudieron cargar los eventos');
  }
  return response.json();
}

export async function fetchEventById(id) {
  const response = await fetch(`${apiUrl}/api/events/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error('Error al cargar el evento');
  return response.json();
}

export async function fetchEventStats() {
  const response = await fetch(`${apiUrl}/api/events/stats`);
  if (!response.ok) throw new Error('No se pudieron cargar las estadísticas');
  return response.json();
}

// --- CATÁLOGO API ---

// Ingredientes
export async function createIngrediente(data) {
  const response = await fetch(`${apiUrl}/api/catalog/ingredientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    let msg = 'Error al crear ingrediente';
    try { const body = await response.json(); if (body?.message) msg = body.message; } catch {}
    throw new Error(msg);
  }
  return response.json();
}

export async function getIngredientes() {
  const response = await fetch(`${apiUrl}/api/catalog/ingredientes`);
  if (!response.ok) throw new Error('Error al cargar ingredientes');
  return response.json();
}

export async function updateIngrediente(id, data) {
  const response = await fetch(`${apiUrl}/api/catalog/ingredientes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar ingrediente');
  return response.json();
}

export async function deleteIngrediente(id) {
  const response = await fetch(`${apiUrl}/api/catalog/ingredientes/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Error al eliminar ingrediente');
}

export async function getIngredienteAsociaciones(id) {
  const response = await fetch(`${apiUrl}/api/catalog/ingredientes/${id}/asociaciones`);
  if (!response.ok) throw new Error('Error al consultar asociaciones del ingrediente');
  return response.json();
}

// Opciones
export async function createOpcionIngrediente(data) {
  const response = await fetch(`${apiUrl}/api/catalog/opciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    let msg = 'Error al crear opción';
    try { const body = await response.json(); if (body?.message) msg = body.message; } catch {}
    throw new Error(msg);
  }
  return response.json();
}

export async function getOpcionesIngrediente(ingrediente_id) {
  const url = ingrediente_id ? `${apiUrl}/api/catalog/opciones?ingrediente_id=${ingrediente_id}` : `${apiUrl}/api/catalog/opciones`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Error al cargar opciones');
  return response.json();
}

export async function updateOpcionIngrediente(id, data) {
  const response = await fetch(`${apiUrl}/api/catalog/opciones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar opción');
  return response.json();
}

export async function deleteOpcionIngrediente(id) {
  const response = await fetch(`${apiUrl}/api/catalog/opciones/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Error al eliminar opción');
  return response.json();
}

// Menús
export async function createMenu(data) {
  const response = await fetch(`${apiUrl}/api/catalog/menus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al crear menú');
  return response.json();
}

export async function updateMenu(id, data) {
  const response = await fetch(`${apiUrl}/api/catalog/menus/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar menú');
  return response.json();
}

export async function getMenus() {
  const response = await fetch(`${apiUrl}/api/catalog/menus`);
  if (!response.ok) throw new Error('Error al cargar menús');
  return response.json();
}

// Items del menú
export async function createMenuItem(data) {
  const response = await fetch(`${apiUrl}/api/catalog/menu-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al añadir item al menú');
  return response.json();
}

export async function deleteMenuItem(id) {
  const response = await fetch(`${apiUrl}/api/catalog/menu-items/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Error al eliminar item del menú');
  return response.json();
}

export async function updateMenuItem(id, data) {
  const response = await fetch(`${apiUrl}/api/catalog/menu-items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar item del menú');
  return response.json();
}

export async function getMenuItems(menu_id) {
  const url = menu_id ? `${apiUrl}/api/catalog/menu-items?menu_id=${menu_id}` : `${apiUrl}/api/catalog/menu-items`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Error al cargar items del menú');
  return response.json();
}

// --- CATEGORÍAS DE ALIMENTO ---

export async function getCategorias() {
  const response = await fetch(`${apiUrl}/api/catalog/categorias`);
  if (!response.ok) throw new Error('Error al cargar categorías');
  return response.json();
}

export async function createCategoria(nombre) {
  const response = await fetch(`${apiUrl}/api/catalog/categorias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre }),
  });
  if (!response.ok) throw new Error('Error al crear categoría');
  return response.json();
}

export async function updateCategoria(id, data) {
  const response = await fetch(`${apiUrl}/api/catalog/categorias/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar categoría');
  return response.json();
}

export async function deleteCategoria(id) {
  const response = await fetch(`${apiUrl}/api/catalog/categorias/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Error al eliminar categoría');
  return response.json();
}

// --- PLATILLOS API (NUEVO) ---

export async function createPlatillo(data) {
  const response = await fetch(`${apiUrl}/api/platillos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al crear platillo');
  return response.json();
}

export async function getPlatillos() {
  const response = await fetch(`${apiUrl}/api/platillos`);
  if (!response.ok) throw new Error('Error al cargar platillos');
  return response.json();
}

export async function updatePlatillo(id, data) {
  const response = await fetch(`${apiUrl}/api/platillos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar platillo');
  return response.json();
}

export async function deletePlatillo(id) {
  const response = await fetch(`${apiUrl}/api/platillos/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Error al eliminar platillo');
  return response.json();
}

export async function getSugerenciasDisponibles() {
  const response = await fetch(`${apiUrl}/api/platillos/sugerencias/disponibles`);
  if (!response.ok) throw new Error('Error al cargar sugerencias');
  return response.json();
}

export async function getPlatilloDetalle(id) {
  const response = await fetch(`${apiUrl}/api/platillos/${id}`);
  if (!response.ok) throw new Error('Error al cargar detalle del platillo');
  return response.json();
}

export async function addComponentePlatillo(platillo_id, data) {
  const response = await fetch(`${apiUrl}/api/platillos/${platillo_id}/componentes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al añadir componente');
  return response.json();
}

export async function removeComponentePlatillo(comp_id) {
  const response = await fetch(`${apiUrl}/api/platillos/componentes/${comp_id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Error al eliminar componente');
  return response.json();
}

export async function updateComponentePlatillo(comp_id, data) {
  const response = await fetch(`${apiUrl}/api/platillos/componentes/${comp_id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar componente');
  return response.json();
}

// --- INFORMES API ---

export async function createInforme(id_ocupacion) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ id_ocupacion }),
  });
  if (!response.ok) throw new Error('Error al crear informe');
  return response.json();
}

export async function getInformesByOcupacion(id_ocupacion) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/ocupacion/${encodeURIComponent(id_ocupacion)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let msg = 'Error al cargar versiones';
    try {
      const body = await response.json();
      if (body?.message) msg = body.message;
    } catch { /* ignore */ }
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

export async function getInformes() {
  const response = await fetch(`${apiUrl}/api/informes`);
  if (!response.ok) throw new Error('Error al cargar informes');
  return response.json();
}

export async function getInformeById(id) {
  const response = await fetch(`${apiUrl}/api/informes/${id}`);
  if (!response.ok) {
    let msg = 'Error al cargar el informe';
    try {
      const body = await response.json();
      if (body?.message) msg = body.message;
    } catch { /* ignore */ }
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

export async function getMetadatosEvento(id) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/events/${encodeURIComponent(id)}/metadata`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al cargar metadatos');
  return response.json();
}

export async function saveMetadatosEvento(id, data) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/events/${encodeURIComponent(id)}/metadata`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al guardar metadatos');
  return response.json();
}

export async function updateEventStatus(id, estatus) {
  const response = await fetch(`${apiUrl}/api/events/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estatus }),
  });
  if (!response.ok) throw new Error('Error al actualizar estado');
  return response.json();
}

export async function createInformeDia(data) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/dias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al crear día del informe');
  return response.json();
}

export async function deleteInformeDias(informeId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/${informeId}/dias`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al eliminar días del informe');
  return response.json();
}

// --- DETALLE DE MENÚ Y CONFIGURACIÓN POR DÍA ---

export async function getMenuDetalle(menuId) {
  const response = await fetch(`${apiUrl}/api/catalog/menus/${menuId}/detalle`);
  if (!response.ok) throw new Error('Error al cargar detalle del menú');
  return response.json();
}

export async function getDiaMenuDetalle(diaId) {
  const response = await fetch(`${apiUrl}/api/informes/dias/${diaId}/detalle`);
  if (!response.ok) throw new Error('Error al cargar detalle del día');
  return response.json();
}

export async function saveDiaMenuDetalle(diaId, items) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/dias/${diaId}/detalle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ items }),
  });
  if (!response.ok) throw new Error('Error al guardar detalle del día');
  return response.json();
}

// --- NOTIFICACIONES API ---

export async function getNotificaciones() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/notificaciones`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al cargar notificaciones');
  return response.json();
}

export async function getNoLeidasCount() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/notificaciones/no-leidas`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al contar notificaciones');
  return response.json();
}

export async function marcarLeida(id) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/notificaciones/${id}/leer`, {
    method: 'PATCH',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al marcar notificación');
  return response.json();
}

export async function marcarTodasLeidas() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/notificaciones/leer-todas`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al marcar notificaciones');
  return response.json();
}

// --- COLABORACIÓN EN INFORMES ---

export async function getComentarios(informeId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/${informeId}/comentarios`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al cargar comentarios');
  return response.json();
}

export async function createComentario(informeId, data) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/${informeId}/comentarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al crear comentario');
  return response.json();
}

export async function marcarInformeLeido(informeId) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${apiUrl}/api/informes/${informeId}/leer`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return false;
    await response.json();
    return true;
  } catch {
    return false;
  }
}

export async function getLecturas(informeId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/${informeId}/lecturas`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al cargar lecturas');
  return response.json();
}

export async function toggleDestacado(informeId, data) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/${informeId}/destacar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data || {}),
  });
  if (!response.ok) throw new Error('Error al destacar');
  return response.json();
}

export async function getDestacados(informeId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/${informeId}/destacados`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al cargar destacados');
  return response.json();
}

export async function getHistorial(informeId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/${informeId}/historial`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al cargar historial');
  return response.json();
}

export async function getUsuarios() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/usuarios`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al cargar usuarios');
  return response.json();
}

// ─── Actualizar notas de un ítem individual del detalle de menú ───
export async function updateDiaMenuItemNotas(itemId, notas) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/detalle/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ notas }),
  });
  if (!response.ok) throw new Error('Error al actualizar notas');
  return response.json();
}

// --- MONTAJE API ---

export async function saveMontaje(diaId, data) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/montaje/${diaId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al guardar montaje');
  return response.json();
}

export async function getMontaje(diaId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/montaje/${diaId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al cargar montaje');
  return response.json();
}

export async function getTiposMontaje() {
  const response = await fetch(`${apiUrl}/api/montaje/tipos`);
  if (!response.ok) throw new Error('Error al cargar tipos de montaje');
  return response.json();
}

// --- IMÁGENES DE INFORMES ---

export async function getImagenes(informeId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/${informeId}/imagenes`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al cargar imágenes');
  return response.json();
}

export async function createImagen(informeId, data) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/${informeId}/imagenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al agregar imagen');
  return response.json();
}

export async function uploadImagen(informeId, file, descripcion) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('imagen', file);
  if (descripcion) formData.append('descripcion', descripcion);
  const response = await fetch(`${apiUrl}/api/informes/${informeId}/imagenes/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!response.ok) throw new Error('Error al subir imagen');
  return response.json();
}

export async function deleteImagen(imgId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/imagenes/${imgId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al eliminar imagen');
  return response.json();
}

// --- CONFIGURACIÓN API ---

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Equipos (físico - mobiliario)
export async function getEquipos() {
  const response = await fetch(`${apiUrl}/api/config/equipos`, { headers: authHeaders() });
  if (!response.ok) throw new Error('Error al cargar equipos');
  return response.json();
}

// Equipos de Trabajo (equipos_trabajo)
export async function getEquiposTrabajo() {
  const response = await fetch(`${apiUrl}/api/equipos`, { headers: authHeaders() });
  if (!response.ok) throw new Error('Error al cargar equipos de trabajo');
  return response.json();
}

export async function createEquipo(nombre) {
  const response = await fetch(`${apiUrl}/api/config/equipos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ nombre }),
  });
  if (!response.ok) throw new Error('Error al crear equipo');
  return response.json();
}

export async function updateEquipo(id, data) {
  const response = await fetch(`${apiUrl}/api/config/equipos/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar equipo');
  return response.json();
}

export async function deleteEquipo(id) {
  const response = await fetch(`${apiUrl}/api/config/equipos/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (!response.ok) throw new Error('Error al eliminar equipo');
  return response.json();
}

// Sillas
export async function getSillas() {
  const response = await fetch(`${apiUrl}/api/config/sillas`, { headers: authHeaders() });
  if (!response.ok) throw new Error('Error al cargar sillas');
  return response.json();
}

export async function createSilla(nombre) {
  const response = await fetch(`${apiUrl}/api/config/sillas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ nombre }),
  });
  if (!response.ok) throw new Error('Error al crear tipo de silla');
  return response.json();
}

export async function updateSilla(id, data) {
  const response = await fetch(`${apiUrl}/api/config/sillas/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar silla');
  return response.json();
}

export async function deleteSilla(id) {
  const response = await fetch(`${apiUrl}/api/config/sillas/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (!response.ok) throw new Error('Error al eliminar silla');
  return response.json();
}

// Mesas
export async function getMesas() {
  const response = await fetch(`${apiUrl}/api/config/mesas`, { headers: authHeaders() });
  if (!response.ok) throw new Error('Error al cargar mesas');
  return response.json();
}

export async function createMesa(nombre) {
  const response = await fetch(`${apiUrl}/api/config/mesas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ nombre }),
  });
  if (!response.ok) throw new Error('Error al crear tipo de mesa');
  return response.json();
}

export async function updateMesa(id, data) {
  const response = await fetch(`${apiUrl}/api/config/mesas/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar mesa');
  return response.json();
}

export async function deleteMesa(id) {
  const response = await fetch(`${apiUrl}/api/config/mesas/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (!response.ok) throw new Error('Error al eliminar mesa');
  return response.json();
}

// Formas de Pago
export async function getFormasPago() {
  const response = await fetch(`${apiUrl}/api/config/formas-pago`, { headers: authHeaders() });
  if (!response.ok) throw new Error('Error al cargar formas de pago');
  return response.json();
}

export async function createFormaPago(nombre) {
  const response = await fetch(`${apiUrl}/api/config/formas-pago`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ nombre }),
  });
  if (!response.ok) throw new Error('Error al crear forma de pago');
  return response.json();
}

export async function updateFormaPago(id, data) {
  const response = await fetch(`${apiUrl}/api/config/formas-pago/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar forma de pago');
  return response.json();
}

export async function deleteFormaPago(id) {
  const response = await fetch(`${apiUrl}/api/config/formas-pago/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (!response.ok) throw new Error('Error al eliminar forma de pago');
  return response.json();
}

// --- USUARIOS API (gestión) ---

export async function getUsers() {
  const response = await fetch(`${apiUrl}/api/users`, { headers: authHeaders() });
  if (!response.ok) throw new Error('Error al cargar usuarios');
  return response.json();
}

export async function createUser(data) {
  const response = await fetch(`${apiUrl}/api/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al crear usuario');
  return response.json();
}

export async function updateUser(id, data) {
  const response = await fetch(`${apiUrl}/api/users/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar usuario');
  return response.json();
}

export async function toggleUserActive(id) {
  const response = await fetch(`${apiUrl}/api/users/${id}/toggle-active`, {
    method: 'PATCH', headers: authHeaders(),
  });
  if (!response.ok) throw new Error('Error al cambiar estado del usuario');
  return response.json();
}

// --- NOTAS DE KANBAN ---

export async function getNotas(idocupacion) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/notas/${idocupacion}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al cargar notas');
  return response.json();
}

// --- REACCIONES ---

export async function toggleReaccionComentario(informeId, comentarioId, reaccion) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/informes/${informeId}/comentarios/${comentarioId}/reaccion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ reaccion }),
  });
  if (!response.ok) throw new Error('Error al toggle reacción');
  return response.json();
}

export async function toggleReaccionNota(notaId, reaccion) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/notas/${notaId}/reaccion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ reaccion }),
  });
  if (!response.ok) throw new Error('Error al toggle reacción');
  return response.json();
}

export async function createNota(idocupacion, data) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/notas/${idocupacion}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al crear nota');
  return response.json();
}
// --- BÚSQUEDA CRM ---

export async function buscarOcupaciones(params) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${apiUrl}/api/events?${query}`);
  if (!response.ok) throw new Error('Error al buscar ocupaciones');
  return response.json();
}

export function imagenUrl(url) {
  if (!url) return url;
  if (url.startsWith('/uploads/')) return `${apiUrl}${url}`;
  return url;
}

// --- TAREAS PERSONALES POR EVENTO ---

export async function getTareasUsuario(idOcupacion, usuarioId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/tareas/${idOcupacion}/usuario?usuario_id=${usuarioId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al cargar tareas');
  return response.json();
}

export async function createTarea(idOcupacion, data) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/tareas/${idOcupacion}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al crear tarea');
  return response.json();
}

export async function updateTarea(tareaId, data) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/tareas/${tareaId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar tarea');
  return response.json();
}

export async function deleteTarea(tareaId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/tareas/${tareaId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al eliminar tarea');
  return response.json();
}

// --- TAREAS SEMANALES ---

export async function getTareasSemanaMerged(semanaLunes) {
  const response = await fetch(`${apiUrl}/api/tareas-semanales/${semanaLunes}/merged`);
  if (!response.ok) throw new Error('Error al cargar tareas de la semana');
  return response.json();
}

export async function getTareasSemana(semanaLunes, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = qs ? `${apiUrl}/api/tareas-semanales/${semanaLunes}?${qs}` : `${apiUrl}/api/tareas-semanales/${semanaLunes}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Error al cargar tareas semanales');
  return response.json();
}

export async function createTareaSemanal(data) {
  const response = await fetch(`${apiUrl}/api/tareas-semanales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al crear tarea');
  return response.json();
}

export async function updateTareaSemanal(id, data) {
  const response = await fetch(`${apiUrl}/api/tareas-semanales/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar tarea');
  return response.json();
}

export async function deleteTareaSemanal(id, data) {
  const response = await fetch(`${apiUrl}/api/tareas-semanales/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al eliminar tarea');
  return response.json();
}

export async function getHistorialTareasSemana(semanaLunes) {
  const response = await fetch(`${apiUrl}/api/tareas-semanales/${semanaLunes}/historial`);
  if (!response.ok) throw new Error('Error al cargar historial');
  return response.json();
}

export async function logHistorialEntry(data) {
  const response = await fetch(`${apiUrl}/api/tareas-semanales/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al registrar historial');
  return response.json();
}

export async function autoMarcarNoRealizado() {
  const response = await fetch(`${apiUrl}/api/tareas-semanales/auto/no-realizado`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Error al marcar no realizado');
  return response.json();
}

export async function getTareasSemanaByOcupacion(idOcupacion, params = {}) {
  const qs = Object.keys(params).length > 0 ? `?${new URLSearchParams(params)}` : '';
  const response = await fetch(`${apiUrl}/api/tareas-semanales/evento/${idOcupacion}${qs}`);
  if (!response.ok) throw new Error('Error al cargar tareas semanales del evento');
  return response.json();
}

export async function getTareasEvento(idOcupacion) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiUrl}/api/tareas/evento/${idOcupacion}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al cargar tareas del evento');
  return response.json();
}

