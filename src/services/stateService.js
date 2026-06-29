import api from './api';

let stateEtag = null;
let cachedState = null;
const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;

export async function loadState({ cacheBust = false } = {}) {
  const url = `${API_BASE_URL}/api/state${cacheBust ? `?t=${Date.now()}` : ''}`;
  const headers = { 'Content-Type': 'application/json' };
  if (stateEtag && cachedState) headers['If-None-Match'] = stateEtag;

  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(url, { method: 'GET', headers });

    if (response.status === 304 && cachedState) {
      return cachedState;
    }

    const newEtag = response.headers.get('ETag');
    if (newEtag) stateEtag = newEtag;

    const data = await response.json();
    const state = data?.state || data || {};
    cachedState = state;
    return state;
  } catch (error) {
    console.error('loadState error:', error);
    return cachedState || {};
  }
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

  cachedState = nextState;
  stateEtag = null;

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
