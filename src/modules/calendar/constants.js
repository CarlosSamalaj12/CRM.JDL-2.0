// Constantes base del calendario
export const HOUR_START = 0;
export const HOUR_END = 23; 
export const HOUR_HEIGHT = 56; // Pixeles por hora
export const SNAP_MINUTES = 30; // Redondeo de seleccion

/**
 * Convierte una hora "HH:mm" a posicion Y en pixeles
 */
export const timeToY = (t) => {
  if (!t || typeof t !== 'string') return 0;
  const parts = t.split(":");
  const hh = parseInt(parts[0], 10);
  const mm = parts[1] ? parseInt(parts[1], 10) : 0;
  const minutes = (hh - HOUR_START) * 60 + mm;
  return (minutes / 60) * HOUR_HEIGHT;
};

/**
 * Formatea una hora numerica (0-23) a formato legible 12h
 */
export const formatHourAmPm = (hour) => {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  let h = hour % 12;
  if (h === 0) h = 12;
  return `${h}:00 ${ampm}`;
};

/**
 * Convierte minutos desde el inicio de la rejilla a formato "HH:mm"
 */
export const minutesToTime = (minuteFromGridStart) => {
  const base = HOUR_START * 60 + minuteFromGridStart;
  const hh = Math.floor(base / 60);
  const mm = base % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export const STATUS_META_LIST = [
  { key: 'Reserva sin Cotizacion', color: '#00A3FF' },
  { key: '1er Cotizacion', color: '#007A64' },
  { key: 'Perdido', color: '#FF9A9E' },
  { key: 'Seguimiento', color: '#FF8C00' },
  { key: 'Lista de Espera', color: '#FFD700' },
  { key: 'Pre reserva', color: '#FF00CC' },
  { key: 'Confirmado', color: '#00CC66' },
  { key: 'Cancelado', color: '#FF3333' },
  { key: 'Mantenimiento', color: '#8A2BE2' },
  { key: 'Mantenimiento Realizado', color: '#94a3b8' },
];

export const AUTO_STATUSES = [
  'Reserva sin Cotizacion',
  '1er Cotizacion',
  'Seguimiento',
  'Perdido'
];

export const isAutoStatus = (status) => AUTO_STATUSES.includes(status);

export const getDefaultEventStatus = () => 'Reserva sin Cotizacion';

export const getStatusFromQuotePresence = (hasQuote) => {
  return hasQuote ? '1er Cotizacion' : 'Reserva sin Cotizacion';
};

export const STATUS_META = STATUS_META_LIST.reduce((acc, item) => {
  acc[item.key] = item;
  return acc;
}, {});
