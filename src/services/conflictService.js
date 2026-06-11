const HARD_BLOCK_STATUSES = ['Confirmado', 'Pre reserva'];

export function timeToMinutes(time) {
  if (!time || typeof time !== 'string') return 0;
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || 0, 10);
}

export function compareTime(a, b) {
  const am = timeToMinutes(a);
  const bm = timeToMinutes(b);
  return am - bm;
}

export function isValidClockTime(time) {
  if (!time || typeof time !== 'string') return false;
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm < 60;
}

export function timesOverlap(aStart, aEnd, bStart, bEnd) {
  if (!isValidClockTime(aStart) || !isValidClockTime(aEnd) || !isValidClockTime(bStart) || !isValidClockTime(bEnd)) {
    return false;
  }
  return compareTime(aStart, bEnd) < 0 && compareTime(aEnd, bStart) > 0;
}

export function isHardBlockingStatus(status) {
  return HARD_BLOCK_STATUSES.includes(status);
}

export function findHardBlocks(draft, existingEvents, ignoreIds = null) {
  const ignoreSet = ignoreIds ? new Set(ignoreIds) : new Set();
  const slotDate = draft.date || draft.dateStart;
  
  return existingEvents.filter(e => {
    if (ignoreSet.has(String(e.id))) return false;
    if (e.id === draft.id) return false;
    if (e.salon !== draft.salon) return false;
    if (e.date !== slotDate) return false;
    if (e.status === 'Cancelado') return false;
    if (!HARD_BLOCK_STATUSES.includes(e.status)) return false;
    
    return timesOverlap(e.startTime, e.endTime, draft.startTime, draft.endTime);
  });
}

export function findMaintenanceDayBlocks(draft, existingEvents, ignoreIds = null) {
  const ignoreSet = ignoreIds ? new Set(ignoreIds) : new Set();
  const slotDate = draft.date || draft.dateStart;
  
  return existingEvents.filter(e => {
    if (ignoreSet.has(String(e.id))) return false;
    if (e.id === draft.id) return false;
    if (e.salon !== draft.salon) return false;
    if (e.date !== slotDate) return false;
    if (e.status !== 'Mantenimiento') return false;
    
    return timesOverlap(e.startTime, e.endTime, draft.startTime, draft.endTime);
  });
}

export function findAllConflicts(draft, existingEvents, ignoreIds = null) {
  const ignoreSet = ignoreIds ? new Set(ignoreIds) : new Set();
  const slotDate = draft.date || draft.dateStart;
  
  return existingEvents.filter(e => {
    if (ignoreSet.has(String(e.id))) return false;
    if (e.id === draft.id) return false;
    if (e.salon !== draft.salon) return false;
    if (e.date !== slotDate) return false;
    if (e.status === 'Cancelado') return false;
    
    return timesOverlap(e.startTime, e.endTime, draft.startTime, draft.endTime);
  });
}

export function evaluateRules(draft, existingEvents, ignoreIds = null) {
  const slotDate = draft.date || draft.dateStart;
  if (!slotDate || !draft.startTime || !draft.endTime) {
    return { ok: true, message: '', hint: '' };
  }

  const hardBlocks = findHardBlocks(draft, existingEvents, ignoreIds);
  const hasHardBlock = hardBlocks.length > 0;
  
  const maintenanceBlocks = findMaintenanceDayBlocks(draft, existingEvents, ignoreIds);
  const hasMaintenanceDayBlock = maintenanceBlocks.length > 0;

  if (hasMaintenanceDayBlock && draft.status !== 'Lista de Espera' && draft.status !== 'Mantenimiento') {
    return {
      ok: false,
      message: 'Salón en Mantenimiento este día. Solo se permite Lista de Espera.',
      hint: 'Mantenimiento activo: no se permite Confirmado ni Pre reserva.',
      type: 'maintenance'
    };
  }

  if (hasHardBlock) {
    if (draft.status === 'Mantenimiento') {
      return {
        ok: false,
        message: 'No puedes poner en Mantenimiento: ya hay una reserva Confirmada o Pre reserva en ese horario.',
        hint: 'Mantenimiento solo se permite si no hay Confirmado ni Pre reserva cruzados.',
        type: 'conflict'
      };
    }
    if (draft.status === 'Confirmado' || draft.status === 'Pre reserva') {
      return {
        ok: false,
        message: `Ya hay un evento ${hardBlocks[0]?.name || 'Confirmado/Pre reserva'} en ese horario en el salón ${draft.salon}.`,
        hint: 'Solo puede existir un Confirmado o Pre reserva por horario. Usa Lista de Espera.',
        type: 'conflict',
        conflictingEvents: hardBlocks
      };
    }
    return {
      ok: true,
      hint: `Hay cruce con ${hardBlocks.length} evento(s) Confirmado/Pre reserva. Recomendado: Lista de Espera.`,
      type: 'warning',
      conflictingEvents: hardBlocks
    };
  }

  return { ok: true, message: '', hint: '' };
}

export function checkSlotConflicts(slot, existingEvents, eventId = null) {
  const ignoreIds = eventId ? [eventId] : [];
  return evaluateRules(slot, existingEvents, ignoreIds);
}

export const conflictService = {
  timesOverlap,
  isHardBlockingStatus,
  findHardBlocks,
  findMaintenanceDayBlocks,
  findAllConflicts,
  evaluateRules,
  checkSlotConflicts,
  
  checkAllSlots(slots, existingEvents, eventId = null) {
    const results = [];
    const ignoreIds = eventId ? [eventId] : [];
    
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const result = evaluateRules(slot, existingEvents, ignoreIds);
      results.push({ index: i, ...result, slot });
    }
    
    return results;
  }
};

export default conflictService;
