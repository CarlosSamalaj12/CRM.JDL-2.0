// versionService.js
// Servicio para consultar la versión actual del server y compararla con la del bundle local.

const apiUrl = import.meta.env.VITE_API_URL || '';

/**
 * Versión del bundle que está corriendo el usuario AHORA.
 * Inyectada por Vite al hacer build (vite.config.js → define.__APP_VERSION__).
 * En dev es "0.0.0-dev".
 */
export const CURRENT_VERSION =
  (typeof globalThis !== 'undefined' && globalThis.__APP_VERSION__) || '0.0.0-dev';

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
  // Compara lexicográficamente — funciona porque el formato es YYYY-MM-DD-NN
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Consulta la versión actual del server.
 * Devuelve { version, minVersion, required, message, deployedAt }.
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
      message: String(data.message || ''),
      deployedAt: data.deployedAt || null,
    };
  } catch {
    return null;
  }
}

/**
 * Decide si el cliente debe forzar actualización.
 * Devuelve:
 *   { needsUpdate: false } → todo OK
 *   { needsUpdate: true, reason: 'outdated' | 'required' | 'below-min', serverVersion, message }
 */
export function evaluateUpdate(serverInfo) {
  if (!serverInfo) return { needsUpdate: false };
  const cmp = compareVersions(CURRENT_VERSION, serverInfo.version);
  if (cmp < 0) {
    return {
      needsUpdate: true,
      reason: 'outdated',
      serverVersion: serverInfo.version,
      message: serverInfo.message || 'Hay una nueva versión disponible. Por favor actualiza para continuar.',
    };
  }
  // Si el server marca como required, clientes por debajo de minVersion también fuerzan
  if (serverInfo.required) {
    const minCmp = compareVersions(CURRENT_VERSION, serverInfo.minVersion);
    if (minCmp < 0) {
      return {
        needsUpdate: true,
        reason: 'below-min',
        serverVersion: serverInfo.version,
        minVersion: serverInfo.minVersion,
        message: serverInfo.message || `Esta versión ya no es compatible. Por favor actualiza.`,
      };
    }
  }
  return { needsUpdate: false };
}
