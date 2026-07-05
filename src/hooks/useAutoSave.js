import { useEffect, useRef } from 'react';

const DRAFT_PREFIX = 'quote_draft_';

/**
 * Build a storage key scoped to an event.
 */
function getDraftKey(event) {
  try {
    const id = event?.id || event?.code || 'new';
    return `${DRAFT_PREFIX}${id}`;
  } catch {
    return `${DRAFT_PREFIX}new`;
  }
}

/**
 * Save a draft snapshot to localStorage with a size guard.
 */
export function saveDraft(event, data) {
  try {
    const key = getDraftKey(event);
    const raw = JSON.stringify({
      savedAt: new Date().toISOString(),
      ...data,
    });
    if (raw.length < 500_000) {
      localStorage.setItem(key, raw);
    }
  } catch (_) { /* quota exceeded or blocked */ }
}

/**
 * Load a previously saved draft from localStorage.
 */
export function loadDraft(event) {
  try {
    const key = getDraftKey(event);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Remove the draft from localStorage (call after a successful save).
 */
export function clearDraft(event) {
  try {
    const key = getDraftKey(event);
    localStorage.removeItem(key);
  } catch (_) { /* ignore */ }
}

/**
 * React hook — auto-saves `data` to localStorage every `delay` ms
 * whenever `data` changes.  Pass `event` to scope the draft to that
 * event (or omit / pass null for a generic draft).
 */
export function useAutoSave(event, data, delay = 800) {
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
