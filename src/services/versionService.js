// versionService.js
// Servicio para consultar la versión actual del server y compararla con la del bundle local.

const apiUrl = import.meta.env.VITE_API_URL || '';

/**
 * Versión del bundle que está corriendo el usuario AHORA.
 * Inyectada por Vite al hacer build (vite.config.js → define.__APP_VERSION__).
 * En dev es "0.0.0-dev".
 */
export const CURRENT_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev';

/**
 * Compara dos versiones con formato YYYY-MM-DD-NN.
 * Devuelve:
 *   -1 si a < b
 *    0 si a == b
 *    1 si a > b
 */
export function compareVersions(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 0;
  // Si contiene guiones (viejo formato YYYY-MM-DD-NN), hacemos comparación simple
  if (a.includes('-') && !a.includes('.') && b.includes('-') && !b.includes('.')) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
  // Comparación semántica por puntos (ej: 2.0.1, 2.10)
  const pa = String(a).split('.').map(x => parseInt(x, 10) || 0);
  const pb = String(b).split('.').map(x => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

/**
 * Consulta la versión actual del server.
 * Devuelve { version, minVersion, required, forceLogout, message, deployedAt }.
 * Si el server no responde o el endpoint no existe (ej. dev sin el endpoint), devuelve null.
 */
export async function fetchServerVersion() {
  try {
    const response = await fetch(`${apiUrl}/api/version?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      version: String(data.version || '0.0.0-unknown'),
      minVersion: String(data.minVersion || data.version || '0.0.0-unknown'),
      required: Boolean(data.required),
      forceLogout: Boolean(data.forceLogout),
      message: String(data.message || ''),
      deployedAt: data.deployedAt || null,
    };
  } catch {
    return null;
  }
}

/**
 * Purgado completo de sesión, cachés de navegador, Service Workers
 * y redirección limpia a la pantalla de login con aviso de actualización.
 */
export async function forcePurgeAndLogout(targetVersion = '') {
  try {
    // 1. Limpiar caches del Service Worker y CacheStorage
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    // 2. Desregistrar Service Workers activos para forzar descarga limpia
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
  } catch (e) {
    console.warn('[forcePurgeAndLogout] Error limpiando caches/SW:', e);
  }

  // 3. Limpiar credenciales y estado de sesión
  try {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    sessionStorage.clear();
    if (targetVersion) {
      localStorage.setItem('crm_installed_version', targetVersion);
    }
  } catch (_) {}

  // 4. Redirigir a login con flag de actualización y cache-buster
  const verParam = targetVersion ? `&v=${encodeURIComponent(targetVersion)}` : '';
  window.location.replace(`/login?update=1${verParam}&_u=${Date.now()}`);
}

/**
 * Decide si el cliente debe forzar actualización y cierre de sesión.
 * Devuelve:
 *   { needsUpdate: false } → todo OK
 *   { needsUpdate: true, reason: 'force-logout' | 'outdated' | 'required' | 'below-min', serverVersion, forceLogout, message }
 */
export function evaluateUpdate(serverInfo) {
  if (!serverInfo) return { needsUpdate: false };

  // Modo dev: la versión local es "0.0.0-dev" (no es comparable contra el server).
  // No mostrar el modal/banner si la versión tiene el prefijo de desarrollo limpio.
  if (
    CURRENT_VERSION === '0.0.0-dev' ||
    CURRENT_VERSION.startsWith('0.0.0-')
  ) {
    return { needsUpdate: false };
  }

  const cmp = compareVersions(CURRENT_VERSION, serverInfo.version);

  // Si se exige forceLogout o la actualización es requerida, no se permite descartar
  const isMandatory = serverInfo.forceLogout || serverInfo.required;
  if (!isMandatory) {
    try {
      const dismissedVersion = sessionStorage.getItem('dismissed_version');
      if (dismissedVersion && compareVersions(dismissedVersion, serverInfo.version) >= 0) {
        return { needsUpdate: false };
      }
    } catch (_) {}
  }

  if (cmp < 0 || (serverInfo.forceLogout && cmp !== 0)) {
    return {
      needsUpdate: true,
      reason: serverInfo.forceLogout ? 'force-logout' : 'outdated',
      forceLogout: Boolean(serverInfo.forceLogout),
      serverVersion: serverInfo.version,
      message: serverInfo.message || 'Hay una nueva versión disponible. Se cerrará sesión para aplicar los cambios limpiamente.',
    };
  }

  // Si el server marca como required, clientes por debajo de minVersion también fuerzan
  if (serverInfo.required) {
    const minCmp = compareVersions(CURRENT_VERSION, serverInfo.minVersion);
    if (minCmp < 0) {
      return {
        needsUpdate: true,
        reason: 'below-min',
        forceLogout: true,
        serverVersion: serverInfo.version,
        minVersion: serverInfo.minVersion,
        message: serverInfo.message || `Esta versión ya no es compatible. Se cerrará sesión para actualizar.`,
      };
    }
  }

  return { needsUpdate: false };
}
