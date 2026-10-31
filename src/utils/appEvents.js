export const APP_EVENT_OPEN_EVENT_CHECKLIST = 'crm:open-event-checklist';

export function emitOpenEventChecklist(eventId, eventData = null) {
  window.dispatchEvent(new CustomEvent(APP_EVENT_OPEN_EVENT_CHECKLIST, {
    detail: { eventId, eventData },
  }));
}
