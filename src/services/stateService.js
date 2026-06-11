import api from './api';

export async function loadState({ cacheBust = true } = {}) {
  const params = cacheBust ? { t: Date.now() } : {};
  const response = await api.get('/api/state', params);
  return response?.state || response || {};
}

export async function saveState(state) {
  const nextState = state && typeof state === 'object' ? state : {};
  return api.put('/api/state', { state: nextState });
}

export async function updateState(updater, options = {}) {
  const currentState = await loadState(options);
  const nextState = typeof updater === 'function'
    ? await updater(currentState)
    : { ...currentState, ...(updater || {}) };

  await saveState(nextState);
  return nextState;
}

const stateService = {
  loadState,
  saveState,
  updateState,
};

export default stateService;
