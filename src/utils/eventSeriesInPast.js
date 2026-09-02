// Helpers compartidos por SettingsChecklist y ReservationForm para evaluar
// si una serie de eventos (mismo groupId) ya terminó, considerando días de gracia.
//
// La serie de eventos representa una reserva multi-día donde cada día es un slot
// con su propio id (evt_xxx_s1_NNNNNN, evt_xxx_s2_NNNNNN, ...) pero comparten el
// mismo `groupId`. Para saber si la serie ya pasó, hay que mirar la fecha más
// tardía entre todos los slots, no solo el slot abierto.

export function getSeriesForEvent(events = [], eventId = '') {
  const target = events.find(ev => String(ev.id) === String(eventId));
  if (!target) return [];
  const groupId = String(target.groupId || '').trim();
  if (!groupId) return [target];
  const series = events.filter(ev => String(ev.groupId || '').trim() === groupId);
  return series.length ? series : [target];
}

export function reservationKeyFromEvent(ev) {
  if (!ev) return "";
  return String(ev.groupId || ev.id || "").trim();
}

export function isEventSeriesInPast(events = [], eventId = '', graceDays = 0) {
  const series = getSeriesForEvent(events, eventId);
  if (!series.length) return false;
  const lastDate = series.reduce((max, ev) => {
    const d = String(ev.endDate || ev.FechaSalida || ev.date || ev.eventDateEnd || ev.eventDateStart || ev.FechaEvento || '').slice(0, 10);
    return d > max ? d : max;
  }, '');
  if (!lastDate) return false;
  const now = new Date();
  now.setDate(now.getDate() - Number(graceDays || 0));
  const pad = (n) => String(n).padStart(2, '0');
  const cutoffIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return lastDate < cutoffIso;
}
