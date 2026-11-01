import { useEffect, useRef } from 'react';
import authService from '../services/authService';

const DRAFT_PREFIX = 'quote_draft_';
const MAX_DRAFT_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 días (evita perder borradores de vendedores de días anteriores)

/**
 * Limpia borradores viejos (> 14 días) en localStorage para liberar cuota.
 */
export function pruneExpiredDrafts() {
  try {
    const now = Date.now();
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DRAFT_PREFIX)) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.savedAt) {
              const age = now - new Date(parsed.savedAt).getTime();
              if (age > MAX_DRAFT_AGE_MS || Number.isNaN(age)) {
                keysToRemove.push(k);
              }
            } else {
              keysToRemove.push(k);
            }
          }
        } catch (_parseErr) {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch (_delErr) {
        // Ignorar errores al remover clave individual
      }
    });
  } catch (_iterErr) {
    // Ignorar errores al acceder al storage
  }
}

/**
 * Construye una clave única para el borrador del evento o usuario.
 */
export function getDraftKey(event) {
  try {
    const id = event?.id || event?.code;
    if (id && String(id).trim() && String(id).trim() !== 'new') {
      const baseId = String(id).trim().replace(/_(s|slot)\d+.*$/, '');
      return `${DRAFT_PREFIX}${baseId}`;
    }
    const currentUserId = authService.getCurrentUser()?.id || 'default';
    return `${DRAFT_PREFIX}new_${currentUserId}`;
  } catch (_keyErr) {
    return `${DRAFT_PREFIX}new_default`;
  }
}

/**
 * Sanitiza los datos de la cotización antes de guardar en almacenamiento local:
 * Excluye historiales de versiones pesadas y plantillas cacheadas para mantener el JSON ligero.
 */
function sanitizeDraftData(data) {
  if (!data || typeof data !== 'object') return {};
  const rest = { ...data };
  delete rest.versions;
  delete rest.contractTemplates;
  delete rest.catalogServices;
  return rest;
}

/**
 * Guarda un borrador de cotización en localStorage de forma segura y optimizada.
 */
export function saveDraft(event, data) {
  try {
    if (!data) return;
    const key = getDraftKey(event);
    const cleanData = sanitizeDraftData(data);
    const payload = {
      savedAt: new Date().toISOString(),
      ...cleanData,
    };
    const raw = JSON.stringify(payload);

    try {
      localStorage.setItem(key, raw);
    } catch (_quotaErr) {
      // Si la cuota de localStorage está llena, purgar borradores vencidos e intentar una vez más
      pruneExpiredDrafts();
      try {
        localStorage.setItem(key, raw);
      } catch (_retryErr) {
        console.warn('No se pudo guardar el borrador en localStorage por límite de cuota.');
      }
    }
  } catch (_saveErr) {
    /* Quota exceeded o almacenamiento restringido */
  }
}

/**
 * Carga un borrador previo de localStorage verificando su caducidad y coherencia.
 */
export function loadDraft(event) {
  try {
    const key = getDraftKey(event);
    let raw = localStorage.getItem(key);
    // Fallback por si el borrador fue guardado con el ID de un slot específico (ej. 38702_s2_20261115)
    if (!raw && event?.id && String(event.id).trim() !== key.slice(DRAFT_PREFIX.length)) {
      raw = localStorage.getItem(`${DRAFT_PREFIX}${String(event.id).trim()}`);
    }
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      clearDraft(event);
      return null;
    }

    // 1. Validar caducidad máxima (14 días)
    if (parsed.savedAt) {
      const savedTime = new Date(parsed.savedAt).getTime();
      const ageMs = Date.now() - savedTime;
      if (Number.isNaN(ageMs) || ageMs > MAX_DRAFT_AGE_MS) {
        clearDraft(event);
        return null;
      }

      // 2. Si el evento en servidor ya tiene cotización con servicios y fecha de guardado/actualización
      // posterior al borrador, significa que ya fue guardado formalmente y este borrador local es obsoleto.
      // Si el servidor aún tiene items: [], NUNCA borrar el borrador local por updatedAt del evento (ej. por cambio de estado o abono).
      const serverHasItems = Array.isArray(event?.quote?.items) && event.quote.items.length > 0;
      const quoteSavedTime = event?.quote?.quotedAt ? new Date(event.quote.quotedAt).getTime() : 0;
      const eventUpdatedTime = event?.updatedAt ? new Date(event.updatedAt).getTime() : 0;
      const effectiveServerTime = quoteSavedTime || (serverHasItems ? eventUpdatedTime : 0);
      if (serverHasItems && effectiveServerTime && savedTime < effectiveServerTime) {
        clearDraft(event);
        return null;
      }
    }

    return parsed;
  } catch (_loadErr) {
    return null;
  }
}

/**
 * Elimina el borrador de localStorage (llamar tras guardar exitosamente o al descartar).
 */
export function clearDraft(event) {
  try {
    const key = getDraftKey(event);
    localStorage.removeItem(key);
    if (event?.id) {
      localStorage.removeItem(`${DRAFT_PREFIX}${String(event.id).trim()}`);
    }
  } catch (_clearErr) {
    /* ignore */
  }
}

/**
 * React hook — guarda periódicamente el borrador en localStorage tras cada cambio.
 */
export function useAutoSave(event, data, delay = 1000) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveDraft(event, data);
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, delay, event]);
}
