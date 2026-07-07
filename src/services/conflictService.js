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

export function findHardBlocks(draft, existingEvents, ignoreIds = null, noConflictSalons = []) {
  if (noConflictSalons.includes(String(draft.salon || '').trim().toLowerCase())) return [];
  const ignoreSet = ignoreIds ? new Set(ignoreIds) : new Set();
  const slotDate = draft.date || draft.dateStart;
  
  return existingEvents.filter(e => {
    if (noConflictSalons.includes(String(e.salon || '').trim().toLowerCase())) return false;
    if (ignoreSet.has(String(e.id))) return false;
    if (e.id === draft.id) return false;
    if (e.salon !== draft.salon) return false;
    if (e.date !== slotDate) return false;
    if (e.status === 'Cancelado') return false;
    if (!HARD_BLOCK_STATUSES.includes(e.status)) return false;
    
    return timesOverlap(e.startTime, e.endTime, draft.startTime, draft.endTime);
  });
}

export function findMaintenanceDayBlocks(draft, existingEvents, ignoreIds = null, noConflictSalons = []) {
  if (noConflictSalons.includes(String(draft.salon || '').trim().toLowerCase())) return [];
  const ignoreSet = ignoreIds ? new Set(ignoreIds) : new Set();
  const slotDate = draft.date || draft.dateStart;
  
  return existingEvents.filter(e => {
    if (noConflictSalons.includes(String(e.salon || '').trim().toLowerCase())) return false;
    if (ignoreSet.has(String(e.id))) return false;
    if (e.id === draft.id) return false;
    if (e.salon !== draft.salon) return false;
    if (e.date !== slotDate) return false;
    if (e.status !== 'Mantenimiento') return false;
    
    return timesOverlap(e.startTime, e.endTime, draft.startTime, draft.endTime);
  });
}

export function findAllConflicts(draft, existingEvents, ignoreIds = null, noConflictSalons = []) {
  if (noConflictSalons.includes(String(draft.salon || '').trim().toLowerCase())) return [];
  const ignoreSet = ignoreIds ? new Set(ignoreIds) : new Set();
  const slotDate = draft.date || draft.dateStart;
  
  return existingEvents.filter(e => {
    if (noConflictSalons.includes(String(e.salon || '').trim().toLowerCase())) return false;
    if (ignoreSet.has(String(e.id))) return false;
    if (e.id === draft.id) return false;
    if (e.salon !== draft.salon) return false;
    if (e.date !== slotDate) return false;
    if (e.status === 'Cancelado') return false;
    
    return timesOverlap(e.startTime, e.endTime, draft.startTime, draft.endTime);
  });
}

export function evaluateRules(draft, existingEvents, ignoreIds = null, noConflictSalons = []) {
  const slotDate = draft.date || draft.dateStart;
  if (!slotDate || !draft.startTime || !draft.endTime) {
    return { ok: true, message: '', hint: '' };
  }

  // Si el salón está marcado como "sin conflicto", no genera conflicto con ningún evento
  if (noConflictSalons.includes(String(draft.salon || '').trim().toLowerCase())) {
    return { ok: true, message: '', hint: '' };
  }

  const hardBlocks = findHardBlocks(draft, existingEvents, ignoreIds, noConflictSalons);
  const hasHardBlock = hardBlocks.length > 0;
  
  const maintenanceBlocks = findMaintenanceDayBlocks(draft, existingEvents, ignoreIds, noConflictSalons);
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

export function checkSlotConflicts(slot, existingEvents, eventId = null, noConflictSalons = []) {
  const ignoreIds = eventId ? [eventId] : [];
  return evaluateRules(slot, existingEvents, ignoreIds, noConflictSalons);
}


export function datesOverlap(aStart, aEnd, bStart, bEnd) {
  const aS = String(aStart || '');
  const aE = String(aEnd || aS);
  const bS = String(bStart || '');
  const bE = String(bEnd || bS);
  if (!aS || !bS) return true;
  return aS <= bE && bS <= aE;
}

export function checkSameSalonOverlap(slots) {
  const results = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      if (String(a.salon || '').trim().toLowerCase() !== String(b.salon || '').trim().toLowerCase()) continue;
      const aDateS = a.dateStart || a.date || a.fecha_evento;
      const aDateE = a.dateEnd || a.endDate || aDateS;
      const bDateS = b.dateStart || b.date || b.fecha_evento;
      const bDateE = b.dateEnd || b.endDate || bDateS;
      if (!datesOverlap(aDateS, aDateE, bDateS, bDateE)) continue;
      const aStart = a.startTime || a.hora_inicio;
      const aEnd = a.endTime || a.hora_fin;
      const bStart = b.startTime || b.hora_inicio;
      const bEnd = b.endTime || b.hora_fin;
      if (!timesOverlap(aStart, aEnd, bStart, bEnd)) continue;
      const msg = `El salón "${a.salon}" tiene horarios traslapados (${aStart}-${aEnd} y ${bStart}-${bEnd})`;
      results.push({ index: i, ok: false, message: msg, hint: msg, type: 'conflict', slot: a });
      results.push({ index: j, ok: false, message: msg, hint: msg, type: 'conflict', slot: b });
    }
  }
  return results;
}

export const conflictService = {
  timesOverlap,
  isHardBlockingStatus,
  findHardBlocks,
  findMaintenanceDayBlocks,
  findAllConflicts,
  evaluateRules,
  checkSlotConflicts,
  checkSameSalonOverlap,
  
  checkAllSlots(slots, existingEvents, eventId = null, noConflictSalons = []) {
    const results = [];
    const ignoreIds = eventId ? [eventId] : [];
    
    const overlapResults = checkSameSalonOverlap(slots);
    const overlapIndexes = new Set(overlapResults.map(r => r.index));
    results.push(...overlapResults);
    
    for (let i = 0; i < slots.length; i++) {
      if (overlapIndexes.has(i)) continue;
      const slot = slots[i];
      const result = evaluateRules(slot, existingEvents, ignoreIds, noConflictSalons);
      results.push({ index: i, ...result, slot });
    }
    
    return results;
  }
};

export default conflictService;
