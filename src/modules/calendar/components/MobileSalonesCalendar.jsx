import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { STATUS_META, STATUS_META_LIST } from '../constants';
import authService from '../../../services/authService';

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 24; // 18 horas operativas (06:00 a 24:00)
const MIN_SLOT_MINUTES = 60; // Mínimo 1 hora libre para mostrar botón '+ Reservar'

function pad(num) {
  return String(num).padStart(2, '0');
}

function formatDateIso(d) {
  if (!d) return '';
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${year}-${month}-${day}`;
}

function timeToMinutes(t) {
  if (!t || typeof t !== 'string') return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${pad(h)}:${pad(min)}`;
}

// Obtener lunes de la semana
function getStartOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  return new Date(d.setDate(diff));
}

export default function MobileSalonesCalendar({
  events = [],
  salones = [],
  salonCapacities = {},
  disabledSalones = [],
  users = [],
  currentDate = new Date(),
  setCurrentDate = () => {},
  setViewMode = () => {},
  onSwitchToClassicCalendar = null
}) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('todas'); // 'todas' | 'libres' | 'parcial' | 'ocupados' | 'mantenimiento' | 'grandes'
  const [showLegend, setShowLegend] = useState(false);

  const currentUser = useMemo(() => authService.getCurrentUser() || {}, []);
  const userInitials = useMemo(() => {
    const name = currentUser?.name || currentUser?.nombre || 'CR';
    return name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'CR';
  }, [currentUser]);

  const selectedDateStr = useMemo(() => formatDateIso(currentDate), [currentDate]);
  const todayStr = useMemo(() => formatDateIso(new Date()), []);

  // Salones activos (excluyendo inhabilitados)
  const activeSalones = useMemo(() => {
    return salones.filter(s => !disabledSalones.includes(s));
  }, [salones, disabledSalones]);

  // Mapa de usuarios por ID para resolver vendedores
  const usersMap = useMemo(() => {
    const map = new Map();
    (users || []).forEach(u => {
      if (u?.id) map.set(String(u.id), u.name || u.nombre || 'Vendedor');
    });
    return map;
  }, [users]);

  // ─── TIRA SEMANAL (LUNES A DOMINGO) ───
  const weekDays = useMemo(() => {
    const monday = getStartOfWeekMonday(currentDate);
    const dayNames = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = formatDateIso(d);
      
      // Obtener eventos del día para extraer los puntos de colores por estado
      const dayEvts = (events || []).filter(e => {
        if (e.status === 'Cancelado') return false;
        return e.date === iso || (e.date <= iso && e.endDate >= iso);
      });

      // Estados únicos presentes en el día
      const uniqueStatuses = Array.from(new Set(dayEvts.map(e => e.status).filter(Boolean)));
      
      // Mapear colores de los estados
      const dotColors = uniqueStatuses.map(st => {
        const meta = STATUS_META[st];
        return meta?.color || '#3b82f6';
      }).slice(0, 3); // Máximo 3 puntos para mantener la estética limpia

      return {
        date: d,
        iso,
        dayName: dayNames[i],
        dayNum: d.getDate(),
        isToday: iso === todayStr,
        isSelected: iso === selectedDateStr,
        isWeekend: i >= 5, // SÁB y DOM en rojo sutil según maqueta
        dotColors: dotColors.length > 0 ? dotColors : ['#10b981'] // Verde si no hay eventos ocupados
      };
    });
  }, [currentDate, events, selectedDateStr, todayStr]);

  // ─── CÁLCULO DE DISPONIBILIDAD POR SALÓN PARA EL DÍA SELECCIONADO ───
  const salonesStatusList = useMemo(() => {
    const dayStartMin = DAY_START_HOUR * 60; // 360 (06:00)
    const dayEndMin = DAY_END_HOUR * 60;     // 1440 (24:00)
    const totalDayHours = DAY_END_HOUR - DAY_START_HOUR; // 18 horas

    return activeSalones.map(salonName => {
      const capacity = salonCapacities[salonName] || 0;

      // Eventos que ocupan este salón en la fecha seleccionada
      const salonEvents = (events || []).filter(e => {
        if (e.status === 'Cancelado') return false;
        const inDate = e.date === selectedDateStr || (e.date <= selectedDateStr && e.endDate >= selectedDateStr);
        if (!inDate) return false;

        const mainSalon = String(e.salon || '').trim().toLowerCase();
        const target = salonName.trim().toLowerCase();
        if (mainSalon === target) return true;

        if (Array.isArray(e.salones)) {
          return e.salones.some(s => String(s || '').trim().toLowerCase() === target);
        }
        return false;
      });

      // ¿Tiene evento de Mantenimiento?
      const maintenanceEvt = salonEvents.find(e => e.status === 'Mantenimiento');
      if (maintenanceEvt) {
        const startM = Math.max(dayStartMin, timeToMinutes(maintenanceEvt.startTime || '06:00'));
        const endM = Math.min(dayEndMin, timeToMinutes(maintenanceEvt.endTime || '24:00'));
        const reopenHour = maintenanceEvt.endTime || '16:00';
        const hasReopen = endM < dayEndMin && (dayEndMin - endM) >= MIN_SLOT_MINUTES;

        return {
          salonName,
          capacity,
          category: capacity > 150 ? 'grande' : 'estandar',
          statusType: 'mantenimiento',
          badgeText: '● MANTENIMIENTO',
          badgeClass: 'badge-maintenance',
          accentColor: '#8a2be2',
          maintenanceInfo: {
            title: maintenanceEvt.name || 'Mantenimiento programado',
            description: maintenanceEvt.notes || `Horario restringido: ${minutesToTime(startM)} - ${minutesToTime(endM)}.`,
            reopenHour,
            hasReopen
          },
          events: salonEvents,
          timeline: []
        };
      }

      // Si no hay ningún evento programado -> 100% DISPONIBLE TODO EL DÍA
      if (salonEvents.length === 0) {
        return {
          salonName,
          capacity,
          category: capacity > 150 ? 'grande' : 'estandar',
          statusType: 'libres',
          badgeText: '● DISPONIBLE TODO EL DÍA',
          badgeClass: 'badge-available',
          accentColor: '#10b981',
          totalAvailableHours: totalDayHours,
          percentFree: 100,
          events: [],
          timeline: [
            {
              type: 'free',
              startTime: '06:00',
              endTime: '24:00',
              durationHours: totalDayHours
            }
          ]
        };
      }

      // Hay eventos: ordenamos cronológicamente y calculamos los intervalos libres
      const sortedEvents = [...salonEvents].sort((a, b) => {
        return (a.startTime || '06:00').localeCompare(b.startTime || '06:00');
      });

      // Construir timeline combinando slots libres y eventos ocupados
      const timeline = [];
      let currentPointer = dayStartMin;

      sortedEvents.forEach(evt => {
        const evStart = Math.max(dayStartMin, timeToMinutes(evt.startTime || '06:00'));
        const evEnd = Math.min(dayEndMin, timeToMinutes(evt.endTime || '24:00'));

        // Hueco libre previo al evento
        if (evStart > currentPointer) {
          const gapMinutes = evStart - currentPointer;
          if (gapMinutes >= MIN_SLOT_MINUTES) {
            timeline.push({
              type: 'free',
              startTime: minutesToTime(currentPointer),
              endTime: minutesToTime(evStart),
              durationHours: Math.round((gapMinutes / 60) * 10) / 10
            });
          }
        }

        // Vendedor resuelto
        const sellerName = usersMap.get(String(evt.userId)) || evt.seller || 'Ventas';
        const quoteTotal = evt.quote?.total || (evt.quote ? Number(evt.quote) : 0);

        timeline.push({
          type: 'event',
          id: evt.id,
          name: evt.name || 'Evento sin título',
          startTime: evt.startTime || '06:00',
          endTime: evt.endTime || '24:00',
          status: evt.status || 'Reserva sin Cotizacion',
          statusColor: STATUS_META[evt.status]?.color || '#3b82f6',
          pax: evt.pax || 0,
          quoteTotal,
          client: evt.clientName || evt.client || '',
          seller: sellerName,
          notes: evt.notes || ''
        });

        currentPointer = Math.max(currentPointer, evEnd);
      });

      // Hueco libre final después del último evento
      if (currentPointer < dayEndMin) {
        const gapMinutes = dayEndMin - currentPointer;
        if (gapMinutes >= MIN_SLOT_MINUTES) {
          timeline.push({
            type: 'free',
            startTime: minutesToTime(currentPointer),
            endTime: minutesToTime(dayEndMin),
            durationHours: Math.round((gapMinutes / 60) * 10) / 10
          });
        }
      }

      const hasFreeSlots = timeline.some(t => t.type === 'free');
      const isFullDay = !hasFreeSlots;

      return {
        salonName,
        capacity,
        category: capacity > 150 ? 'grande' : 'estandar',
        statusType: isFullDay ? 'ocupados' : 'parcial',
        badgeText: isFullDay 
          ? '● OCUPADO TODO EL DÍA' 
          : `● OCUPACIÓN PARCIAL (${salonEvents.length} ${salonEvents.length === 1 ? 'EVENTO' : 'EVENTOS'})`,
        badgeClass: isFullDay ? 'badge-occupied' : 'badge-partial',
        accentColor: isFullDay ? '#ef4444' : '#3b82f6',
        events: salonEvents,
        timeline
      };
    });
  }, [activeSalones, salonCapacities, events, selectedDateStr, usersMap]);

  // ─── CONTEOS PARA TARJETAS KPI Y CHIPS ───
  const kpiCounts = useMemo(() => {
    let libres = 0;
    let parcial = 0;
    let ocupados = 0;
    let mantenimiento = 0;

    salonesStatusList.forEach(s => {
      if (s.statusType === 'libres') libres++;
      else if (s.statusType === 'parcial') parcial++;
      else if (s.statusType === 'ocupados') ocupados++;
      else if (s.statusType === 'mantenimiento') mantenimiento++;
    });

    return {
      total: salonesStatusList.length,
      libres,
      parcial,
      ocupados: ocupados + parcial, // Todos los que tienen ocupación
      ocupadosExclusivos: ocupados,
      mantenimiento
    };
  }, [salonesStatusList]);

  // ─── LISTA FILTRADA DE SALONES ───
  const filteredSalones = useMemo(() => {
    return salonesStatusList.filter(s => {
      if (activeFilter === 'todas') return true;
      if (activeFilter === 'libres') return s.statusType === 'libres';
      if (activeFilter === 'parcial') return s.statusType === 'parcial';
      if (activeFilter === 'ocupados') return s.statusType === 'ocupados' || s.statusType === 'parcial';
      if (activeFilter === 'mantenimiento') return s.statusType === 'mantenimiento';
      if (activeFilter === 'grandes') return (s.capacity || 0) >= 150;
      return true;
    });
  }, [salonesStatusList, activeFilter]);

  const dateInputRef = useRef(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [exactDateValue, setExactDateValue] = useState(() => formatDateIso(currentDate));
  const [pickerYear, setPickerYear] = useState(() => {
    return currentDate instanceof Date && !isNaN(currentDate.getTime()) 
      ? currentDate.getFullYear() 
      : new Date().getFullYear();
  });

  // Sincronizar el año del picker y el valor exacto cuando cambie currentDate o abra el modal
  useEffect(() => {
    if (currentDate instanceof Date && !isNaN(currentDate.getTime())) {
      setPickerYear(currentDate.getFullYear());
      setExactDateValue(formatDateIso(currentDate));
    }
  }, [currentDate, showMonthPicker]);

  const isTodaySelected = useMemo(() => {
    return selectedDateStr === todayStr;
  }, [selectedDateStr, todayStr]);

  // Modo de vista: 'timeline' (por defecto más práctico como la referencia) o 'cards'
  const [activeViewMode, setActiveViewMode] = useState('timeline');
  const [selectedBlockInfo, setSelectedBlockInfo] = useState(null);

  // 6 bloques de tiempo estándar como en la referencia (10h, 12h, 14h, 16h, 18h, 20h)
  const TIMELINE_BLOCKS = useMemo(() => [
    { id: '10h', label: '10h', startMin: 8 * 60, endMin: 11 * 60, title: '08:00 - 11:00' },
    { id: '12h', label: '12h', startMin: 11 * 60, endMin: 13 * 60, title: '11:00 - 13:00' },
    { id: '14h', label: '14h', startMin: 13 * 60, endMin: 15 * 60, title: '13:00 - 15:00' },
    { id: '16h', label: '16h', startMin: 15 * 60, endMin: 17 * 60, title: '15:00 - 17:00' },
    { id: '18h', label: '18h', startMin: 17 * 60, endMin: 19 * 60, title: '17:00 - 19:00' },
    { id: '20h', label: '20h', startMin: 19 * 60, endMin: 23 * 60, title: '19:00 - 23:00' },
  ], []);

  // Bloque actual activo si es la fecha de hoy
  const currentBlockId = useMemo(() => {
    if (!isTodaySelected) return null;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const matched = TIMELINE_BLOCKS.find(b => nowMin >= b.startMin && nowMin < b.endMin);
    return matched ? matched.id : (nowMin < 8 * 60 ? '10h' : '20h');
  }, [isTodaySelected, TIMELINE_BLOCKS]);

  // Mapeo enriquecido para la vista de Timeline diario con paleta armonizada al CRM
  const salonesWithBlocks = useMemo(() => {
    return filteredSalones.map(s => {
      const blocks = TIMELINE_BLOCKS.map(block => {
        if (s.statusType === 'mantenimiento') {
          return {
            blockId: block.id,
            blockTitle: block.title,
            status: 'maintenance',
            pillVariant: 'maintenance',
            accentColor: '#7c3aed',
            bgColor: '#ede9fe'
          };
        }

        const evt = (s.events || []).find(e => {
          const evStart = timeToMinutes(e.startTime || '06:00');
          const evEnd = timeToMinutes(e.endTime || '24:00');
          return evStart < block.endMin && evEnd > block.startMin;
        });

        if (evt) {
          const stLower = (evt.status || '').toLowerCase();
          let pillVariant = 'occupied-blue';
          let accent = '#2563eb';
          let bg = '#dbeafe';

          if (stLower.includes('confirm')) {
            pillVariant = 'occupied';
            accent = '#e11d48';
            bg = '#ffe4e6';
          } else if (stLower.includes('tentat') || stLower.includes('cotiz') || stLower.includes('proceso') || stLower.includes('seguim')) {
            pillVariant = 'occupied-amber';
            accent = '#d97706';
            bg = '#fef3c7';
          } else if (stLower.includes('espera') || stLower.includes('pre')) {
            pillVariant = 'occupied-blue';
            accent = '#2563eb';
            bg = '#dbeafe';
          } else {
            pillVariant = 'occupied-slate';
            accent = '#64748b';
            bg = '#f1f5f9';
          }

          return {
            blockId: block.id,
            blockTitle: block.title,
            status: 'occupied',
            event: evt,
            pillVariant,
            accentColor: accent,
            bgColor: bg
          };
        }

        return {
          blockId: block.id,
          blockTitle: block.title,
          status: 'free',
          pillVariant: 'free',
          accentColor: '#10b981',
          bgColor: '#d1fae5'
        };
      });

      return {
        ...s,
        timelineBlocks: blocks
      };
    });
  }, [filteredSalones, TIMELINE_BLOCKS]);

  const MONTH_LIST = useMemo(() => [
    { num: 0, name: 'Enero', short: 'Ene' },
    { num: 1, name: 'Febrero', short: 'Feb' },
    { num: 2, name: 'Marzo', short: 'Mar' },
    { num: 3, name: 'Abril', short: 'Abr' },
    { num: 4, name: 'Mayo', short: 'May' },
    { num: 5, name: 'Junio', short: 'Jun' },
    { num: 6, name: 'Julio', short: 'Jul' },
    { num: 7, name: 'Agosto', short: 'Ago' },
    { num: 8, name: 'Septiembre', short: 'Sep' },
    { num: 9, name: 'Octubre', short: 'Oct' },
    { num: 10, name: 'Noviembre', short: 'Nov' },
    { num: 11, name: 'Diciembre', short: 'Dic' },
  ], []);

  // ─── NAVEGACIÓN DE FECHAS Y SEMANAS (ROBUSTA) ───
  const handlePrevWeek = useCallback((e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const current = currentDate instanceof Date && !isNaN(currentDate.getTime()) ? currentDate : new Date();
    const d = new Date(current.getTime());
    d.setDate(d.getDate() - 7);
    setCurrentDate(new Date(d.getTime()));
  }, [currentDate, setCurrentDate]);

  const handleNextWeek = useCallback((e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const current = currentDate instanceof Date && !isNaN(currentDate.getTime()) ? currentDate : new Date();
    const d = new Date(current.getTime());
    d.setDate(d.getDate() + 7);
    setCurrentDate(new Date(d.getTime()));
  }, [currentDate, setCurrentDate]);

  // Soporte de deslizamiento táctil (swipe) para cambiar de semana naturalmente
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Deslizamiento horizontal intencional (> 45px) y no vertical
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        handleNextWeek(); // Deslizar hacia la izquierda -> semana siguiente
      } else {
        handlePrevWeek(); // Deslizar hacia la derecha -> semana anterior
      }
    }
  }, [handleNextWeek, handlePrevWeek]);

  const handleGoToday = useCallback((e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setCurrentDate(new Date());
  }, [setCurrentDate]);

  const handleSelectDay = useCallback((dateObj) => {
    setCurrentDate(new Date(dateObj.getTime()));
  }, [setCurrentDate]);

  const handleSelectMonth = useCallback((monthNum) => {
    const currentDay = currentDate instanceof Date && !isNaN(currentDate.getTime()) ? currentDate.getDate() : 1;
    const daysInTargetMonth = new Date(pickerYear, monthNum + 1, 0).getDate();
    const safeDay = Math.min(currentDay, daysInTargetMonth);
    const newDate = new Date(pickerYear, monthNum, safeDay, 12, 0, 0);
    setCurrentDate(newDate);
    setShowMonthPicker(false);
  }, [currentDate, pickerYear, setCurrentDate]);

  const handleApplyExactDate = useCallback(() => {
    if (!exactDateValue) return;
    const [y, m, d] = exactDateValue.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const newD = new Date(y, m - 1, d, 12, 0, 0);
      setCurrentDate(newD);
      setShowMonthPicker(false);
    }
  }, [exactDateValue, setCurrentDate]);

  // Formato cabecera: "Mié 9 Sept 2026"
  const formattedHeaderDate = useMemo(() => {
    const weekday = currentDate.toLocaleDateString('es-ES', { weekday: 'short' });
    const day = currentDate.getDate();
    const month = currentDate.toLocaleDateString('es-ES', { month: 'short' });
    const year = currentDate.getFullYear();
    const cap = (str) => str.charAt(0).toUpperCase() + str.slice(1).replace('.', '');
    return `${cap(weekday)} ${day} ${cap(month)} ${year}`;
  }, [currentDate]);

  // ─── ACCIONES DE RESERVA ───
  const handleBookSalonFull = (salonName) => {
    navigate(`/nueva-reserva?date=${selectedDateStr}&salon=${encodeURIComponent(salonName)}`);
  };

  const handleBookFreeSlot = (salonName, startTime, endTime) => {
    navigate(`/nueva-reserva?date=${selectedDateStr}&salon=${encodeURIComponent(salonName)}&start=${startTime}&end=${endTime}`);
  };

  const handleOpenEvent = (eventId) => {
    if (!eventId) return;
    navigate(`/reserva/${eventId}`);
  };

  const handleCreateNewReservation = () => {
    navigate(`/nueva-reserva?date=${selectedDateStr}`);
  };

  const handleOpenDrawer = () => {
    window.dispatchEvent(new CustomEvent('open-mobile-drawer'));
  };

  return (
    <div className="mobile-salones-root">
      {/* ─── 1. TOP HEADER INSTITUCIONAL ─── */}
      <header className="ms-topbar">
        <div className="ms-topbar-left">
          <button className="ms-icon-btn" onClick={handleOpenDrawer} aria-label="Abrir menú de navegación">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2.4" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="ms-brand-info">
            <div className="ms-brand-title">
              <span>Jardines EMS</span>
            </div>
            <div className="ms-brand-sub">
              <span className="ms-online-dot"></span>
              <span>Sede Campestre Central</span>
            </div>
          </div>
        </div>

        <div className="ms-topbar-right">
          <button className="ms-icon-btn ms-notif-btn" onClick={() => navigate('/kanban?viewMode=tareas')} aria-label="Notificaciones y Tareas">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="ms-notif-dot"></span>
          </button>
          <div className="ms-avatar-circle" title={currentUser?.name || 'Usuario'}>
            <span>{userInitials}</span>
          </div>
        </div>
      </header>

      {/* ─── 2. BARRA DE FECHA & NAVEGADOR DE SEMANAS ─── */}
      <div className="ms-date-control-card">
        <div className="ms-date-picker-row">
          <div className="ms-date-nav-group">
            <button
              type="button"
              className="ms-date-arrow"
              onClick={handlePrevWeek}
              aria-label="Semana anterior"
              title="Semana anterior (o desliza hacia la derecha)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <button
              type="button"
              className="ms-date-display"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowMonthPicker(true);
              }}
              title="Toca para seleccionar mes o fecha exacta"
              aria-label="Seleccionar mes y año"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="3" ry="3" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="ms-date-text">{formattedHeaderDate}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="ms-date-caret">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <button
              type="button"
              className="ms-date-arrow"
              onClick={handleNextWeek}
              aria-label="Semana siguiente"
              title="Semana siguiente (o desliza hacia la izquierda)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            className={`ms-today-btn ${isTodaySelected ? 'ms-today-active' : ''}`}
            onClick={handleGoToday}
            title="Ir al día de hoy"
          >
            Hoy
          </button>
        </div>

        {/* ─── TIRA SEMANAL HORIZONTAL (7 DÍAS + SWIPE) ─── */}
        <div
          className="ms-week-strip"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {weekDays.map(dayItem => (
            <button
              key={dayItem.iso}
              type="button"
              className={`ms-week-day-pill ${dayItem.isSelected ? 'ms-day-selected' : ''}`}
              onClick={() => handleSelectDay(dayItem.date)}
            >
              <span className={`ms-day-name ${dayItem.isWeekend ? 'ms-day-weekend' : ''}`}>
                {dayItem.dayName}
              </span>
              <div className="ms-day-num-wrap">
                <span className="ms-day-num">{dayItem.dayNum}</span>
                {dayItem.isSelected && <span className="ms-day-active-plus">+</span>}
                {dayItem.isToday && !dayItem.isSelected && <span className="ms-today-indicator" title="Hoy"></span>}
              </div>
              <div className="ms-day-dots">
                {dayItem.dotColors.map((color, idx) => (
                  <span
                    key={idx}
                    className="ms-dot"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── MODAL DEDICADO PARA BUSCAR MES Y AÑO (RENDERIZADO CON PORTAL AL BODY) ─── */}
      {showMonthPicker && typeof document !== 'undefined' && createPortal(
        <div
          className="ms-month-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMonthPicker(false);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Seleccionar Mes y Año"
        >
          <div className="ms-month-modal-card" onClick={e => e.stopPropagation()}>
            <div className="ms-month-modal-header">
              <div className="ms-month-modal-title-wrap">
                <div className="ms-modal-icon-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="3" ry="3" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div className="ms-month-modal-title-box">
                  <span className="ms-month-modal-title">Mes y Disponibilidad</span>
                  <span className="ms-month-modal-sub">Elige un mes o fecha para consultar disponibilidad</span>
                </div>
              </div>
              <button
                type="button"
                className="ms-month-modal-close"
                onClick={() => setShowMonthPicker(false)}
                aria-label="Cerrar modal"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Stepper de Año */}
            <div className="ms-year-stepper">
              <button
                type="button"
                className="ms-year-btn"
                onClick={() => setPickerYear(y => y - 1)}
                aria-label="Año anterior"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div className="ms-year-center-box">
                <span className="ms-year-text">{pickerYear}</span>
                {pickerYear !== new Date().getFullYear() && (
                  <button
                    type="button"
                    className="ms-year-today-shortcut"
                    onClick={() => setPickerYear(new Date().getFullYear())}
                  >
                    Hoy ({new Date().getFullYear()})
                  </button>
                )}
              </div>
              <button
                type="button"
                className="ms-year-btn"
                onClick={() => setPickerYear(y => y + 1)}
                aria-label="Año siguiente"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Cuadrícula de 12 Meses */}
            <div className="ms-month-grid">
              {MONTH_LIST.map(m => {
                const isSelectedMonth = currentDate.getMonth() === m.num && currentDate.getFullYear() === pickerYear;
                return (
                  <button
                    key={m.num}
                    type="button"
                    className={`ms-month-item-btn ${isSelectedMonth ? 'ms-month-item-active' : ''}`}
                    onClick={() => handleSelectMonth(m.num)}
                  >
                    <span className="ms-month-short">{m.short}</span>
                    <span className="ms-month-full">{m.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Selector de Fecha Exacta */}
            <div className="ms-month-exact-date-box">
              <div className="ms-month-exact-label-row">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="ms-month-exact-label">O fecha exacta</span>
              </div>
              <div className="ms-month-exact-controls-row">
                <input
                  type="date"
                  className="ms-month-exact-input"
                  value={exactDateValue}
                  onChange={(e) => {
                    // Actualiza solo el valor local para que el usuario pueda cambiar de mes libremente con las flechitas ↑/↓ del navegador sin que se cierre
                    setExactDateValue(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyExactDate();
                    }
                  }}
                />
                <button
                  type="button"
                  className="ms-month-exact-apply-btn"
                  onClick={handleApplyExactDate}
                  title="Ir a la fecha seleccionada"
                >
                  Aplicar
                </button>
              </div>
            </div>

            {/* Acciones Rápidas */}
            <div className="ms-month-modal-footer">
              <button
                type="button"
                className="ms-month-today-btn"
                onClick={() => {
                  setCurrentDate(new Date());
                  setShowMonthPicker(false);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Ir a hoy
              </button>
              <button
                type="button"
                className="ms-month-cancel-btn"
                onClick={() => setShowMonthPicker(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── 3. TARJETAS KPI DE 1 CLIC (LIBRES, OCUPADOS, MANTENIMIENTO) ─── */}
      <div className="ms-kpi-grid">
        <button
          type="button"
          className={`ms-kpi-card ms-kpi-libres ${activeFilter === 'libres' ? 'ms-kpi-active' : ''}`}
          onClick={() => setActiveFilter(prev => prev === 'libres' ? 'todas' : 'libres')}
        >
          <div className="ms-kpi-icon-wrap ms-icon-libres">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="ms-kpi-info">
            <div className="ms-kpi-label">LIBRES</div>
            <div className="ms-kpi-value">
              <span className="ms-kpi-number">{kpiCounts.libres}</span>
              <span className="ms-kpi-unit">salones</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className={`ms-kpi-card ms-kpi-ocupados ${activeFilter === 'ocupados' ? 'ms-kpi-active' : ''}`}
          onClick={() => setActiveFilter(prev => prev === 'ocupados' ? 'todas' : 'ocupados')}
        >
          <div className="ms-kpi-icon-wrap ms-icon-ocupados">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="ms-kpi-info">
            <div className="ms-kpi-label">OCUPADOS</div>
            <div className="ms-kpi-value">
              <span className="ms-kpi-number">{kpiCounts.ocupados}</span>
              <span className="ms-kpi-unit">salones</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className={`ms-kpi-card ms-kpi-mant ${activeFilter === 'mantenimiento' ? 'ms-kpi-active' : ''}`}
          onClick={() => setActiveFilter(prev => prev === 'mantenimiento' ? 'todas' : 'mantenimiento')}
        >
          <div className="ms-kpi-icon-wrap ms-icon-mant">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <div className="ms-kpi-info">
            <div className="ms-kpi-label">MANT.</div>
            <div className="ms-kpi-value">
              <span className="ms-kpi-number">{kpiCounts.mantenimiento}</span>
              <span className="ms-kpi-unit">área</span>
            </div>
          </div>
        </button>
      </div>

      {/* ─── 4. BARRA DE CHIPS DE FILTRO RÁPIDO ─── */}
      <div className="ms-chips-scroller">
        <button
          className={`ms-chip ${activeFilter === 'todas' ? 'active' : ''}`}
          onClick={() => setActiveFilter('todas')}
        >
          Todas ({kpiCounts.total})
        </button>
        <button
          className={`ms-chip ${activeFilter === 'libres' ? 'active' : ''}`}
          onClick={() => setActiveFilter('libres')}
        >
          Solo Libres ({kpiCounts.libres})
        </button>
        <button
          className={`ms-chip ${activeFilter === 'parcial' ? 'active' : ''}`}
          onClick={() => setActiveFilter('parcial')}
        >
          Ocupación Parcial ({kpiCounts.parcial})
        </button>
        <button
          className={`ms-chip ${activeFilter === 'ocupados' ? 'active' : ''}`}
          onClick={() => setActiveFilter('ocupados')}
        >
          Ocupados ({kpiCounts.ocupados})
        </button>
        <button
          className={`ms-chip ${activeFilter === 'grandes' ? 'active' : ''}`}
          onClick={() => setActiveFilter('grandes')}
        >
          Salones Grandes (&gt;150)
        </button>
        {kpiCounts.mantenimiento > 0 && (
          <button
            className={`ms-chip ${activeFilter === 'mantenimiento' ? 'active' : ''}`}
            onClick={() => setActiveFilter('mantenimiento')}
          >
            Mantenimiento ({kpiCounts.mantenimiento})
          </button>
        )}
      </div>

      {/* ─── 5. CONTENIDO PRINCIPAL (VISTA TIMELINE O VISTA TARJETAS) ─── */}
      {activeViewMode === 'timeline' ? (
        <div className="ms-timeline-container">
          {salonesWithBlocks.length === 0 ? (
            <div className="ms-empty-state">
              <div className="ms-empty-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <circle cx="12" cy="16" r="2" />
                </svg>
              </div>
              <div className="ms-empty-title">No hay salones bajo este filtro</div>
              <p className="ms-empty-sub">Prueba seleccionando "Todas" o cambiando la fecha arriba.</p>
              <button className="ms-empty-btn" onClick={() => setActiveFilter('todas')}>
                Ver todos los salones
              </button>
            </div>
          ) : (
            <div className="ms-timeline-card">
              <div className="ms-tl-header">
                <div className="ms-tl-title-wrap">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="ms-tl-icon">
                    <line x1="18" y1="20" x2="18" y2="4" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="4" />
                  </svg>
                  <span className="ms-tl-title">Timeline Diario — 6 Bloques</span>
                </div>
                <div className="ms-tl-badge-date">
                  {isTodaySelected ? 'HOY' : formattedHeaderDate}
                </div>
              </div>

              <div className="ms-tl-grid-wrap">
                <div className="ms-tl-grid">
                  {/* Fila encabezado de columnas */}
                  <div className="ms-tl-row ms-tl-header-row">
                    <div className="ms-tl-col-salon ms-tl-header-cell">SALA</div>
                    {TIMELINE_BLOCKS.map(b => (
                      <div
                        key={b.id}
                        className={`ms-tl-col-block ms-tl-header-cell ${currentBlockId === b.id ? 'ms-tl-active-time' : ''}`}
                      >
                        <span>{b.label}</span>
                        {currentBlockId === b.id && <span className="ms-tl-caret-down">▲</span>}
                      </div>
                    ))}
                  </div>

                  {/* Filas de cada salón */}
                  {salonesWithBlocks.map(s => (
                    <div key={s.salonName} className="ms-tl-row">
                      <div className="ms-tl-col-salon ms-tl-salon-cell" title={`${s.salonName} (Cap. ${s.capacity} Pax)`}>
                        <span className="ms-tl-salon-name">{s.salonName}</span>
                      </div>
                      {s.timelineBlocks.map(block => (
                        <div
                          key={block.blockId}
                          className="ms-tl-col-block ms-tl-block-cell"
                          onClick={() => setSelectedBlockInfo({
                            salonName: s.salonName,
                            capacity: s.capacity,
                            blockTitle: block.blockTitle,
                            blockLabel: block.blockId,
                            status: block.status,
                            event: block.event
                          })}
                        >
                          <div
                            className={`ms-tl-pill ms-tl-pill-${block.pillVariant || block.status}`}
                            title={`${s.salonName} • ${block.blockTitle}: ${block.status === 'free' ? 'Libre' : (block.event?.name || 'Ocupado')}`}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Leyenda de la matriz estilo referencia con colores del CRM */}
              <div className="ms-tl-legend-row">
                <div className="ms-tl-legend-item">
                  <span className="ms-tl-legend-dot" style={{ background: '#d1fae5', borderTop: '2.5px solid #10b981' }}></span>
                  <span>Libres</span>
                </div>
                <div className="ms-tl-legend-item">
                  <span className="ms-tl-legend-dot" style={{ background: '#ffe4e6', borderTop: '2.5px solid #e11d48' }}></span>
                  <span>Confirmado</span>
                </div>
                <div className="ms-tl-legend-item">
                  <span className="ms-tl-legend-dot" style={{ background: '#fef3c7', borderTop: '2.5px solid #d97706' }}></span>
                  <span>Cotizado</span>
                </div>
                <div className="ms-tl-legend-item">
                  <span className="ms-tl-legend-dot" style={{ background: '#dbeafe', borderTop: '2.5px solid #2563eb' }}></span>
                  <span>Pre-reserva</span>
                </div>
                <div className="ms-tl-legend-item">
                  <span className="ms-tl-legend-dot" style={{ background: '#ede9fe', borderTop: '2.5px solid #7c3aed' }}></span>
                  <span>Mant.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="ms-salones-container">
        {filteredSalones.length === 0 ? (
          <div className="ms-empty-state">
            <div className="ms-empty-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="3" ry="3" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <circle cx="12" cy="16" r="2" />
              </svg>
            </div>
            <div className="ms-empty-title">No hay salones bajo este filtro</div>
            <p className="ms-empty-sub">Prueba seleccionando "Todas" o cambiando la fecha arriba.</p>
            <button className="ms-empty-btn" onClick={() => setActiveFilter('todas')}>
              Ver todos los salones
            </button>
          </div>
        ) : (
          filteredSalones.map(salon => {
            return (
              <div 
                key={salon.salonName} 
                className="ms-salon-card"
                style={{ borderLeftColor: salon.accentColor }}
              >
                {/* Cabecera de Tarjeta del Salón */}
                <div className="ms-salon-header">
                  <div className="ms-salon-title-row">
                    <h3 className="ms-salon-name">{salon.salonName}</h3>
                    <div className="ms-salon-badges">
                      {salon.capacity > 0 && (
                        <span className="ms-cap-badge">CAP. {salon.capacity} PAX</span>
                      )}
                      <span className={`ms-status-badge ${salon.badgeClass}`}>
                        {salon.badgeText}
                      </span>
                    </div>
                  </div>
                  <div className="ms-salon-meta-tags">
                    <span>{salon.capacity > 150 ? 'Área Principal' : 'Área para Eventos'} • Jardines del Lago</span>
                  </div>
                </div>

                {/* CUERPO CASO 1: DISPONIBLE TODO EL DÍA */}
                {salon.statusType === 'libres' && (
                  <div className="ms-salon-body-available">
                    <div className="ms-timeline-full-bar">
                      <div className="ms-timeline-hours-label">
                        <span>06:00</span>
                        <span className="ms-hours-middle">18 HORAS DISPONIBLES CONTINUAS</span>
                        <span>24:00</span>
                      </div>
                      <div className="ms-progress-track">
                        <div className="ms-progress-fill-available"></div>
                      </div>
                    </div>

                    <div className="ms-card-action-bar">
                      <button
                        type="button"
                        className="ms-btn-primary ms-btn-full"
                        onClick={() => handleBookSalonFull(salon.salonName)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>Reservar este salón</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* CUERPO CASO 2: MANTENIMIENTO */}
                {salon.statusType === 'mantenimiento' && (
                  <div className="ms-salon-body-maintenance">
                    <div className="ms-maintenance-box">
                      <div className="ms-mant-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.2">
                          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                        </svg>
                      </div>
                      <div className="ms-mant-content">
                        <div className="ms-mant-title">{salon.maintenanceInfo.title}</div>
                        <div className="ms-mant-desc">{salon.maintenanceInfo.description}</div>
                      </div>
                    </div>

                    {salon.maintenanceInfo.hasReopen && (
                      <div className="ms-card-action-bar">
                        <button
                          type="button"
                          className="ms-btn-reopen"
                          onClick={() => handleBookFreeSlot(salon.salonName, salon.maintenanceInfo.reopenHour, '24:00')}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          Reservar tarde ({salon.maintenanceInfo.reopenHour}+)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* CUERPO CASO 3: OCUPACIÓN PARCIAL O COMPLETA */}
                {(salon.statusType === 'parcial' || salon.statusType === 'ocupados') && (
                  <div className="ms-salon-body-occupied">
                    <div className="ms-timeline-list">
                      {salon.timeline.map((item, idx) => {
                        if (item.type === 'free') {
                          return (
                            <div key={`free-${idx}`} className="ms-slot-free-row">
                              <div className="ms-slot-free-left">
                                <span className="ms-slot-hours">{item.startTime} - {item.endTime}</span>
                                <span className="ms-slot-free-dot">● Libre</span>
                              </div>
                              <button
                                type="button"
                                className="ms-btn-reserve-slot"
                                onClick={() => handleBookFreeSlot(salon.salonName, item.startTime, item.endTime)}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                  <line x1="12" y1="5" x2="12" y2="19" />
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Reservar
                              </button>
                            </div>
                          );
                        }

                        // Evento ocupado
                        return (
                          <div 
                            key={`evt-${item.id || idx}`} 
                            className="ms-event-card"
                            onClick={() => handleOpenEvent(item.id)}
                          >
                            <div className="ms-event-card-top">
                              <span className="ms-event-time">{item.startTime} - {item.endTime}</span>
                              <div className="ms-event-badges-right">
                                <span 
                                  className="ms-event-status-pill"
                                  style={{ backgroundColor: `${item.statusColor}18`, color: item.statusColor, borderColor: `${item.statusColor}40` }}
                                >
                                  {item.status.toUpperCase()}
                                </span>
                                {item.quoteTotal > 0 && (
                                  <span className="ms-event-quote">
                                    Cot. Q {Number(item.quoteTotal).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="ms-event-card-middle">
                              <span className="ms-event-name">{item.name}</span>
                              {item.pax > 0 && (
                                <span className="ms-event-pax">PAX {item.pax}</span>
                              )}
                            </div>

                            <div className="ms-event-card-bottom">
                              <span className="ms-event-seller">
                                Vendedor: <strong>{item.seller}</strong>
                                {item.client ? ` • Cliente: ${item.client}` : ''}
                                {item.notes ? ` • ${item.notes.slice(0, 55)}` : ''}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Botones inferiores para salones con eventos */}
                    <div className="ms-card-footer-actions">
                      {salon.events.length > 0 && (
                        <button
                          type="button"
                          className="ms-btn-secondary"
                          onClick={() => handleOpenEvent(salon.events[0].id)}
                        >
                          Ver detalle
                        </button>
                      )}
                      <button
                        type="button"
                        className="ms-btn-primary ms-btn-flex"
                        onClick={() => handleBookSalonFull(salon.salonName)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Añadir reserva
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      )}

      {/* ─── 6. CÓDIGO DE COLORES OPERATIVO (DESPLEGABLE AL FINAL) ─── */}
      <div className="ms-legend-section">
        <button
          type="button"
          className="ms-legend-toggle"
          onClick={() => setShowLegend(prev => !prev)}
        >
          <div className="ms-legend-toggle-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 10 10 0 0 0 0-20" />
            </svg>
            <span className="ms-legend-title">CÓDIGO DE COLORES OPERATIVO</span>
          </div>
          <div className="ms-legend-toggle-right">
            <span className="ms-legend-count">{STATUS_META_LIST.length} Estados</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showLegend ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', marginLeft: '6px' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {showLegend && (
          <div className="ms-legend-content">
            <div className="ms-legend-grid">
              {STATUS_META_LIST.map(st => (
                <div key={st.key} className="ms-legend-item">
                  <span className="ms-legend-color-dot" style={{ backgroundColor: st.color }}></span>
                  <span className="ms-legend-name">{st.key}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Espaciador inferior para no tapar con la barra fija */}
      <div className="ms-bottom-spacer"></div>

      {/* ─── 7. BARRA INFERIOR UNIFICADA (VISTA TIMELINE / TARJETAS + NUEVA RESERVA) ─── */}
      <nav className="ms-bottom-bar-unified" aria-label="Controles principales">
        <button
          type="button"
          className={`ms-bottom-view-btn ${activeViewMode === 'timeline' ? 'ms-view-timeline-active' : ''}`}
          onClick={() => setActiveViewMode(prev => prev === 'timeline' ? 'cards' : 'timeline')}
          aria-label={activeViewMode === 'timeline' ? 'Cambiar a vista de tarjetas' : 'Cambiar a vista de timeline'}
        >
          {activeViewMode === 'timeline' ? (
            <>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
              <span>Vista Tarjetas</span>
            </>
          ) : (
            <>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="4" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="4" />
              </svg>
              <span>Vista Timeline</span>
            </>
          )}
        </button>

        <button
          type="button"
          className="ms-bottom-new-btn"
          onClick={handleCreateNewReservation}
          aria-label="Crear nueva reserva"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Nueva reserva</span>
        </button>
      </nav>

      {/* ─── MODAL DETALLE / ACCIÓN RÁPIDA DE BLOQUE EN TIMELINE ─── */}
      {selectedBlockInfo && typeof document !== 'undefined' && createPortal(
        <div
          className="ms-month-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedBlockInfo(null);
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="ms-block-detail-card" onClick={e => e.stopPropagation()}>
            <div className="ms-block-detail-header">
              <div className="ms-block-detail-title-wrap">
                <div className="ms-modal-icon-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <h3 className="ms-block-detail-salon">{selectedBlockInfo.salonName}</h3>
                  <span className="ms-block-detail-time">{selectedBlockInfo.blockTitle}</span>
                </div>
              </div>
              <button
                type="button"
                className="ms-month-modal-close"
                onClick={() => setSelectedBlockInfo(null)}
                aria-label="Cerrar detalle"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {selectedBlockInfo.status === 'free' ? (
              <div className="ms-block-detail-body">
                <div className="ms-block-free-banner">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <div>
                    <strong>Salón Disponible</strong>
                    <p>No hay eventos registrados en este bloque horario.</p>
                  </div>
                </div>
                <div className="ms-block-actions">
                  <button
                    type="button"
                    className="ms-btn-primary ms-btn-full"
                    onClick={() => {
                      const [startH, endH] = selectedBlockInfo.blockTitle.split(' - ');
                      handleBookFreeSlot(selectedBlockInfo.salonName, startH, endH);
                      setSelectedBlockInfo(null);
                    }}
                  >
                    + Reservar este horario ({selectedBlockInfo.blockTitle})
                  </button>
                  <button
                    type="button"
                    className="ms-btn-secondary ms-btn-full"
                    onClick={() => {
                      handleBookSalonFull(selectedBlockInfo.salonName);
                      setSelectedBlockInfo(null);
                    }}
                  >
                    Reservar todo el día
                  </button>
                </div>
              </div>
            ) : selectedBlockInfo.status === 'occupied' && selectedBlockInfo.event ? (
              <div className="ms-block-detail-body">
                <div className="ms-block-event-box">
                  <div className="ms-block-event-header">
                    <span 
                      className="ms-event-status-pill"
                      style={{ 
                        backgroundColor: `${selectedBlockInfo.event.statusColor}18`, 
                        color: selectedBlockInfo.event.statusColor, 
                        borderColor: `${selectedBlockInfo.event.statusColor}40` 
                      }}
                    >
                      {selectedBlockInfo.event.status?.toUpperCase()}
                    </span>
                    <span className="ms-event-time">
                      {selectedBlockInfo.event.startTime} - {selectedBlockInfo.event.endTime}
                    </span>
                  </div>
                  <h4 className="ms-block-event-title">{selectedBlockInfo.event.name}</h4>
                  <div className="ms-block-event-meta">
                    {selectedBlockInfo.event.pax > 0 && <span>👤 {selectedBlockInfo.event.pax} PAX</span>}
                    {selectedBlockInfo.event.seller && <span>🏷️ {selectedBlockInfo.event.seller}</span>}
                    {selectedBlockInfo.event.client && <span>🏢 {selectedBlockInfo.event.client}</span>}
                  </div>
                  {selectedBlockInfo.event.quoteTotal > 0 && (
                    <div className="ms-block-quote-total">
                      Cotización: Q {Number(selectedBlockInfo.event.quoteTotal).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
                <div className="ms-block-actions">
                  <button
                    type="button"
                    className="ms-btn-primary ms-btn-full"
                    onClick={() => {
                      handleOpenEvent(selectedBlockInfo.event.id);
                      setSelectedBlockInfo(null);
                    }}
                  >
                    Ver detalle de la reserva
                  </button>
                  <button
                    type="button"
                    className="ms-btn-secondary ms-btn-full"
                    onClick={() => setSelectedBlockInfo(null)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <div className="ms-block-detail-body">
                <p>Área en mantenimiento preventivo.</p>
                <button
                  type="button"
                  className="ms-btn-secondary ms-btn-full"
                  onClick={() => setSelectedBlockInfo(null)}
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ─── ESTILOS CSS DEDICADOS PARA LA VISTA MÓVIL ─── */}
      <style>{`
        .mobile-salones-root {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          padding-bottom: 20px;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        /* ─── TOPBAR ─── */
        .ms-topbar {
          position: sticky;
          top: 0;
          z-index: 120;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #ffffff;
          padding: 10px 16px;
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
        }

        .ms-topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ms-brand-info {
          display: flex;
          flex-direction: column;
        }

        .ms-brand-title {
          font-size: 16px;
          font-weight: 800;
          color: #1e1b4b;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }

        .ms-brand-sub {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
        }

        .ms-online-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          display: inline-block;
        }

        .ms-topbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ms-icon-btn {
          position: relative;
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: 8px;
          color: #475569;
        }

        .ms-notif-dot {
          position: absolute;
          top: 5px;
          right: 5px;
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          border: 1.5px solid #ffffff;
        }

        .ms-avatar-circle {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #e0e7ff;
          color: #4338ca;
          font-size: 12px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1.5px solid #c7d2fe;
        }

        /* Anular de forma radical cualquier pseudo-elemento button::after / button::before global que intercepte clics */
        .mobile-salones-root button::after,
        .mobile-salones-root button::before,
        .mobile-salones-root *::after,
        .ms-month-modal-backdrop button::after,
        .ms-month-modal-backdrop button::before,
        .ms-month-modal-backdrop *::after {
          display: none !important;
          content: none !important;
          pointer-events: none !important;
        }

        /* ─── FECHA & TIRA SEMANAL PREMIUM ─── */
        .ms-date-control-card {
          background: linear-gradient(180deg, #ffffff 0%, #fcfdfe 100%) !important;
          margin: 12px 14px 14px !important;
          padding: 13px 12px 14px !important;
          border-radius: 18px !important;
          border: 1px solid rgba(226, 232, 240, 0.9) !important;
          box-shadow: 0 4px 14px -3px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03) !important;
          position: relative !important;
          z-index: 10 !important;
        }

        .ms-date-picker-row {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          margin-bottom: 12px !important;
          width: 100% !important;
          position: relative !important;
          z-index: 10 !important;
        }

        .ms-date-nav-group {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          position: relative !important;
          z-index: 10 !important;
        }

        .ms-date-arrow {
          all: unset !important;
          box-sizing: border-box !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 36px !important;
          min-width: 36px !important;
          max-width: 36px !important;
          height: 36px !important;
          min-height: 36px !important;
          max-height: 36px !important;
          padding: 0 !important;
          margin: 0 !important;
          border-radius: 50% !important;
          border: 1px solid #e2e8f0 !important;
          background: #ffffff !important;
          color: #334155 !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          flex-shrink: 0 !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05) !important;
          user-select: none !important;
          position: relative !important;
          z-index: 25 !important;
          pointer-events: auto !important;
          touch-action: manipulation !important;
          -webkit-tap-highlight-color: transparent !important;
        }

        .ms-date-arrow:hover {
          background: #f1f5f9 !important;
          border-color: #cbd5e1 !important;
          color: #0f172a !important;
        }

        .ms-date-arrow:active {
          transform: scale(0.9) !important;
          background: #e2e8f0 !important;
        }

        .ms-date-arrow svg {
          width: 18px !important;
          height: 18px !important;
          min-width: 18px !important;
          min-height: 18px !important;
          display: block !important;
          stroke: currentColor !important;
          stroke-width: 2.4px !important;
          pointer-events: none !important;
        }

        .ms-date-display {
          all: unset !important;
          box-sizing: border-box !important;
          position: relative !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 7px !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          padding: 6px 14px 6px 11px !important;
          border-radius: 9999px !important;
          cursor: pointer !important;
          user-select: none !important;
          transition: all 0.15s ease !important;
          z-index: 25 !important;
          pointer-events: auto !important;
          touch-action: manipulation !important;
          -webkit-tap-highlight-color: transparent !important;
        }

        .ms-date-display:hover {
          background: #f1f5f9 !important;
          border-color: #cbd5e1 !important;
        }

        .ms-date-display:active {
          transform: scale(0.97) !important;
          background: #e2e8f0 !important;
        }

        .ms-date-display svg,
        .ms-date-display span {
          pointer-events: none !important;
        }

        .ms-date-text {
          font-size: 14px !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          letter-spacing: -0.015em !important;
          white-space: nowrap !important;
          pointer-events: none !important;
        }

        .ms-date-caret {
          color: #94a3b8 !important;
          transition: transform 0.15s ease, color 0.15s ease !important;
          flex-shrink: 0 !important;
          pointer-events: none !important;
        }

        .ms-date-display:hover .ms-date-caret {
          color: #475569 !important;
          transform: translateY(1px) !important;
        }

        .ms-today-btn {
          all: unset !important;
          box-sizing: border-box !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          height: 32px !important;
          min-height: 32px !important;
          max-height: 32px !important;
          padding: 0 14px !important;
          margin: 0 !important;
          border-radius: 9999px !important;
          background: #f1f5f9 !important;
          color: #334155 !important;
          font-size: 12.5px !important;
          font-weight: 700 !important;
          border: 1px solid #e2e8f0 !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          flex-shrink: 0 !important;
          user-select: none !important;
          position: relative !important;
          z-index: 25 !important;
          pointer-events: auto !important;
          touch-action: manipulation !important;
          -webkit-tap-highlight-color: transparent !important;
        }

        .ms-today-btn:hover {
          background: #e2e8f0 !important;
          color: #0f172a !important;
        }

        .ms-today-btn:active {
          transform: scale(0.93) !important;
        }

        .ms-today-btn.ms-today-active {
          background: #eff6ff !important;
          border-color: #bfdbfe !important;
          color: #2563eb !important;
        }

        /* ─── MODAL DEDICADO PARA BUSCAR MES Y AÑO (PORTAL AL BODY) ─── */
        .ms-month-modal-backdrop {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: rgba(15, 23, 42, 0.6) !important;
          backdrop-filter: blur(4px) !important;
          -webkit-backdrop-filter: blur(4px) !important;
          z-index: 999999 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 16px !important;
          box-sizing: border-box !important;
          animation: msFadeIn 0.18s ease-out !important;
        }

        .ms-month-modal-card {
          background: #ffffff !important;
          border-radius: 20px !important;
          width: 100% !important;
          max-width: 360px !important;
          padding: 20px !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
          border: 1px solid #e2e8f0 !important;
          box-sizing: border-box !important;
          animation: msScaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
          position: relative !important;
        }

        @keyframes msFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes msScaleIn {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .ms-month-modal-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          margin-bottom: 14px !important;
        }

        .ms-month-modal-title-wrap {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
        }

        .ms-modal-icon-badge {
          width: 36px !important;
          height: 36px !important;
          border-radius: 10px !important;
          background: #eef2ff !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
          color: #4f46e5 !important;
        }

        .ms-month-modal-title-box {
          display: flex !important;
          flex-direction: column !important;
        }

        .ms-month-modal-title {
          font-size: 16px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          line-height: 1.2 !important;
        }

        .ms-month-modal-sub {
          font-size: 11px !important;
          font-weight: 500 !important;
          color: #64748b !important;
          margin-top: 2px !important;
        }

        .ms-month-modal-close {
          all: unset !important;
          box-sizing: border-box !important;
          width: 32px !important;
          height: 32px !important;
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          color: #64748b !important;
          background: #f1f5f9 !important;
          transition: all 0.15s ease !important;
        }

        .ms-month-modal-close:hover {
          background: #e2e8f0 !important;
          color: #0f172a !important;
        }

        /* Stepper de Año */
        .ms-year-stepper {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 12px !important;
          padding: 6px 12px !important;
          margin-bottom: 14px !important;
        }

        .ms-year-btn {
          all: unset !important;
          box-sizing: border-box !important;
          width: 32px !important;
          height: 32px !important;
          border-radius: 8px !important;
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 18px !important;
          font-weight: 800 !important;
          color: #1e293b !important;
          cursor: pointer !important;
          transition: all 0.12s ease !important;
        }

        .ms-year-btn:hover {
          background: #f1f5f9 !important;
        }

        .ms-year-btn:active {
          transform: scale(0.92) !important;
        }

        .ms-year-center-box {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 2px !important;
        }

        .ms-year-text {
          font-size: 17px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          letter-spacing: 0.02em !important;
        }

        .ms-year-today-shortcut {
          all: unset !important;
          cursor: pointer !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          color: #4f46e5 !important;
          background: #eef2ff !important;
          padding: 1px 6px !important;
          border-radius: 4px !important;
        }

        /* Grid de Meses */
        .ms-month-grid {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 8px !important;
          margin-bottom: 14px !important;
        }

        .ms-month-item-btn {
          all: unset !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 10px 4px !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 12px !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          text-align: center !important;
          position: relative !important;
          touch-action: manipulation !important;
        }

        .ms-month-item-btn span {
          pointer-events: none !important;
        }

        .ms-month-item-btn:hover:not(.ms-month-item-active) {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 2px 4px rgba(15, 23, 42, 0.04) !important;
        }

        .ms-month-item-btn:active:not(.ms-month-item-active) {
          transform: scale(0.95) !important;
        }

        .ms-month-short {
          font-size: 13px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          line-height: 1.2 !important;
        }

        .ms-month-full {
          font-size: 10px !important;
          font-weight: 600 !important;
          color: #64748b !important;
          margin-top: 2px !important;
        }

        /* Mes seleccionado */
        .ms-month-item-btn.ms-month-item-active {
          background: linear-gradient(145deg, #4f46e5 0%, #4338ca 100%) !important;
          border-color: #3730a3 !important;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35) !important;
          transform: scale(1.02) !important;
        }

        .ms-month-item-btn.ms-month-item-active .ms-month-short {
          color: #ffffff !important;
        }

        .ms-month-item-btn.ms-month-item-active .ms-month-full {
          color: #c7d2fe !important;
        }


        /* Tarjeta de Fecha Exacta */
        .ms-month-exact-date-box {
          display: flex !important;
          flex-direction: column !important;
          gap: 6px !important;
          padding: 10px 12px !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 12px !important;
          margin-bottom: 14px !important;
        }

        .ms-month-exact-label-row {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
        }

        .ms-month-exact-label {
          font-size: 11px !important;
          font-weight: 700 !important;
          color: #475569 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.04em !important;
        }

        .ms-month-exact-controls-row {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .ms-month-exact-input {
          all: unset !important;
          box-sizing: border-box !important;
          font-size: 13.5px !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          border: 1.5px solid #cbd5e1 !important;
          background: #ffffff !important;
          border-radius: 9px !important;
          padding: 0 10px !important;
          height: 38px !important;
          cursor: pointer !important;
          flex: 1 !important;
          min-width: 0 !important;
          transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
        }

        .ms-month-exact-input:focus {
          border-color: #4f46e5 !important;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12) !important;
        }

        .ms-month-exact-input::-webkit-calendar-picker-indicator {
          cursor: pointer !important;
          opacity: 0.65 !important;
          padding: 0 2px !important;
          margin-left: 6px !important;
          transition: opacity 0.15s ease !important;
        }

        .ms-month-exact-input::-webkit-calendar-picker-indicator:hover {
          opacity: 1 !important;
        }

        .ms-month-exact-apply-btn {
          all: unset !important;
          box-sizing: border-box !important;
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%) !important;
          color: #ffffff !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          height: 38px !important;
          padding: 0 18px !important;
          border-radius: 9px !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          white-space: nowrap !important;
          flex-shrink: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 2px 4px rgba(79, 70, 229, 0.25) !important;
          touch-action: manipulation !important;
        }

        .ms-month-exact-apply-btn:hover {
          background: linear-gradient(135deg, #4338ca 0%, #3730a3 100%) !important;
          box-shadow: 0 4px 8px rgba(79, 70, 229, 0.35) !important;
        }

        .ms-month-exact-apply-btn:active {
          transform: scale(0.95) !important;
        }

        .ms-month-modal-footer {
          display: flex !important;
          gap: 8px !important;
        }

        .ms-month-today-btn {
          all: unset !important;
          box-sizing: border-box !important;
          flex: 1 !important;
          padding: 10px !important;
          background: #eff6ff !important;
          border: 1px solid #bfdbfe !important;
          color: #1d4ed8 !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          border-radius: 12px !important;
          text-align: center !important;
          cursor: pointer !important;
          transition: all 0.12s ease !important;
        }

        .ms-month-today-btn:hover {
          background: #dbeafe !important;
        }

        .ms-month-cancel-btn {
          all: unset !important;
          box-sizing: border-box !important;
          flex: 1 !important;
          padding: 10px !important;
          background: #f1f5f9 !important;
          border: 1px solid #e2e8f0 !important;
          color: #475569 !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          border-radius: 12px !important;
          text-align: center !important;
          cursor: pointer !important;
          transition: all 0.12s ease !important;
        }

        .ms-month-cancel-btn:hover {
          background: #e2e8f0 !important;
          color: #0f172a !important;
        }

        .ms-week-strip {
          display: grid !important;
          grid-template-columns: repeat(7, 1fr) !important;
          gap: 6px !important;
        }

        .ms-week-day-pill {
          all: unset !important;
          box-sizing: border-box !important;
          background: #f8fafc !important;
          border: 1px solid #eef2f6 !important;
          border-radius: 14px !important;
          padding: 8px 2px 7px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          cursor: pointer !important;
          transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1) !important;
          user-select: none !important;
          position: relative !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02) !important;
          -webkit-tap-highlight-color: transparent !important;
        }

        .ms-week-day-pill:hover:not(.ms-day-selected) {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 3px 6px -1px rgba(15, 23, 42, 0.06) !important;
        }

        .ms-week-day-pill:active:not(.ms-day-selected) {
          transform: scale(0.95) !important;
        }

        .ms-day-name {
          font-size: 10px !important;
          font-weight: 700 !important;
          color: #64748b !important;
          text-transform: uppercase !important;
          letter-spacing: 0.03em !important;
          transition: color 0.15s ease !important;
        }

        .ms-day-name.ms-day-weekend {
          color: #ef4444 !important; /* Rojo sutil para fin de semana según la referencia */
        }

        .ms-day-num-wrap {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          position: relative !important;
          margin: 3px 0 4px !important;
        }

        .ms-day-num {
          font-size: 16px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          line-height: 1 !important;
          transition: color 0.15s ease !important;
        }

        .ms-day-active-plus {
          position: absolute !important;
          right: -8px !important;
          top: -3px !important;
          font-size: 10px !important;
          color: #c7d2fe !important;
          font-weight: 900 !important;
        }

        .ms-today-indicator {
          position: absolute !important;
          top: -2px !important;
          right: -8px !important;
          width: 5px !important;
          height: 5px !important;
          border-radius: 50% !important;
          background: #3b82f6 !important;
        }

        .ms-day-dots {
          display: flex !important;
          gap: 3px !important;
          min-height: 5px !important;
          align-items: center !important;
        }

        .ms-dot {
          width: 4.5px !important;
          height: 4.5px !important;
          border-radius: 50% !important;
          flex-shrink: 0 !important;
        }

        /* Día seleccionado activo */
        .ms-week-day-pill.ms-day-selected {
          background: linear-gradient(145deg, #4f46e5 0%, #4338ca 100%) !important;
          border-color: #3730a3 !important;
          box-shadow: 0 6px 16px -2px rgba(79, 70, 229, 0.38) !important;
          transform: translateY(-2px) scale(1.02) !important;
        }

        .ms-week-day-pill.ms-day-selected .ms-day-name {
          color: #c7d2fe !important;
        }

        .ms-week-day-pill.ms-day-selected .ms-day-name.ms-day-weekend {
          color: #fecdd3 !important; /* Rosa pastel para fin de semana cuando está seleccionado */
        }

        .ms-week-day-pill.ms-day-selected .ms-day-num {
          color: #ffffff !important;
        }

        .ms-week-day-pill.ms-day-selected .ms-day-active-plus {
          color: #ffffff !important;
        }

        /* ─── TARJETAS KPI ─── */
        .ms-kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          padding: 12px 14px 4px;
        }

        .ms-kpi-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 8px 6px;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }

        .ms-kpi-active {
          border-color: #4f46e5 !important;
          background: #f5f3ff !important;
          box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
        }

        .ms-kpi-icon-wrap {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ms-icon-libres { background: #ecfdf5; }
        .ms-icon-ocupados { background: #ede9fe; }
        .ms-icon-mant { background: #e0f2fe; }

        .ms-kpi-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .ms-kpi-label {
          font-size: 9px;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 0.03em;
        }

        .ms-kpi-value {
          display: flex;
          align-items: baseline;
          gap: 3px;
        }

        .ms-kpi-number {
          font-size: 15px;
          font-weight: 900;
          color: #0f172a;
          line-height: 1.1;
        }

        .ms-kpi-unit {
          font-size: 10px;
          color: #059669;
          font-weight: 700;
        }

        .ms-kpi-ocupados .ms-kpi-unit { color: #4338ca; }
        .ms-kpi-mant .ms-kpi-unit { color: #0284c7; }

        /* ─── CHIPS DE FILTRO ─── */
        .ms-chips-scroller {
          display: flex !important;
          flex-wrap: nowrap !important;
          gap: 8px !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          -webkit-overflow-scrolling: touch !important;
          padding: 8px 14px !important;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }

        .ms-chips-scroller::-webkit-scrollbar {
          display: none !important;
        }

        .ms-chip {
          flex: 0 0 auto !important;
          flex-shrink: 0 !important;
          min-width: max-content !important;
          white-space: nowrap !important;
          border: 1px solid #cbd5e1 !important;
          background: #ffffff !important;
          color: #475569 !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          padding: 0 16px !important;
          height: 32px !important;
          border-radius: 999px !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-sizing: border-box !important;
          line-height: 1 !important;
        }

        .ms-chip:hover {
          background: #f1f5f9 !important;
          color: #1e293b !important;
        }

        .ms-chip.active {
          background: #4338ca !important;
          color: #ffffff !important;
          border-color: #4338ca !important;
          box-shadow: 0 2px 6px rgba(67, 56, 202, 0.25) !important;
        }

        /* ─── CONTENEDOR DE SALONES ─── */
        .ms-salones-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 4px 14px 10px;
        }

        .ms-salon-card {
          background: #ffffff;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          border-left-width: 5px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .ms-salon-header {
          padding: 12px 14px 10px;
          border-bottom: 1px solid #f1f5f9;
        }

        .ms-salon-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }

        .ms-salon-name {
          margin: 0;
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.2;
        }

        .ms-salon-badges {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .ms-cap-badge {
          background: #f1f5f9;
          color: #475569;
          font-size: 9px;
          font-weight: 800;
          padding: 3px 6px;
          border-radius: 6px;
          letter-spacing: 0.02em;
        }

        .ms-status-badge {
          font-size: 9px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 999px;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }

        .badge-available {
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }

        .badge-partial {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
        }

        .badge-occupied {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .badge-maintenance {
          background: #f5f3ff;
          color: #7c3aed;
          border: 1px solid #ddd6fe;
        }

        .ms-salon-meta-tags {
          margin-top: 4px;
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
        }

        /* ─── CUERPO DISPONIBLE ─── */
        .ms-salon-body-available {
          padding: 12px 14px;
        }

        .ms-timeline-full-bar {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 12px;
          margin-bottom: 12px;
        }

        .ms-timeline-hours-label {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          font-weight: 800;
          color: #475569;
          margin-bottom: 8px;
        }

        .ms-hours-middle {
          color: #0d9488;
          font-size: 10px;
          letter-spacing: 0.04em;
        }

        .ms-progress-track {
          width: 100%;
          height: 8px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }

        .ms-progress-fill-available {
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, #10b981 0%, #14b8a6 100%);
          border-radius: 999px;
        }

        /* ─── CUERPO MANTENIMIENTO ─── */
        .ms-salon-body-maintenance {
          padding: 12px 14px;
        }

        .ms-maintenance-box {
          background: #faf5ff;
          border: 1px solid #e9d5ff;
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 10px;
        }

        .ms-mant-icon {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .ms-mant-title {
          font-size: 13px;
          font-weight: 800;
          color: #6b21a8;
          margin-bottom: 3px;
        }

        .ms-mant-desc {
          font-size: 11px;
          color: #7e22ce;
          line-height: 1.4;
        }

        .ms-btn-reopen {
          width: 100%;
          background: #f5f3ff;
          border: 1px solid #c4b5fd;
          color: #6d28d9;
          font-size: 12px;
          font-weight: 700;
          padding: 10px;
          border-radius: 10px;
          cursor: pointer;
        }

        /* ─── CUERPO OCUPADO / PARCIAL ─── */
        .ms-salon-body-occupied {
          padding: 12px 14px;
        }

        .ms-timeline-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 12px;
        }

        /* Fila de slot libre */
        .ms-slot-free-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 10px;
          padding: 6px 12px;
        }

        .ms-slot-free-left {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
        }

        .ms-slot-free-dot {
          color: #059669;
          font-size: 11px;
        }

        .ms-btn-reserve-slot {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #4338ca;
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
        }

        /* Tarjeta de evento individual */
        .ms-event-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 12px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .ms-event-card:active {
          background: #f8fafc;
        }

        .ms-event-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 5px;
        }

        .ms-event-time {
          font-size: 12px;
          font-weight: 800;
          color: #0f172a;
        }

        .ms-event-badges-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ms-event-status-pill {
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 6px;
          border: 1px solid transparent;
        }

        .ms-event-quote {
          font-size: 11px;
          font-weight: 800;
          color: #059669;
        }

        .ms-event-card-middle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .ms-event-name {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          line-height: 1.2;
        }

        .ms-event-pax {
          background: #f1f5f9;
          color: #475569;
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 6px;
          white-space: nowrap;
        }

        .ms-event-card-bottom {
          font-size: 10px;
          color: #64748b;
          line-height: 1.3;
        }

        /* Botones de acción */
        .ms-btn-primary {
          background: #4338ca;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          padding: 10px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 2px 6px rgba(67, 56, 202, 0.2);
        }

        .ms-btn-full {
          width: 100%;
        }

        .ms-btn-flex {
          flex: 1;
        }

        .ms-btn-secondary {
          background: #ffffff;
          color: #334155;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          padding: 10px 16px;
          cursor: pointer;
        }

        .ms-card-footer-actions {
          display: flex;
          gap: 8px;
        }

        .ms-plus-circle {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }

        /* ─── LEYENDA DESPLEGABLE ─── */
        .ms-legend-section {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          margin: 6px 14px 14px;
          overflow: hidden;
        }

        .ms-legend-toggle {
          width: 100%;
          background: #ffffff;
          border: none;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
        }

        .ms-legend-toggle-left {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ms-legend-title {
          font-size: 11px;
          font-weight: 800;
          color: #475569;
          letter-spacing: 0.02em;
        }

        .ms-legend-toggle-right {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #4338ca;
          font-weight: 700;
        }

        .ms-legend-content {
          padding: 10px 14px 12px;
          border-top: 1px solid #f1f5f9;
        }

        .ms-legend-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .ms-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #334155;
        }

        .ms-legend-color-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* ─── ESPACIADOR Y BARRA INFERIOR UNIFICADA ─── */
        .ms-bottom-spacer {
          height: 80px !important;
        }

        body:has(.mobile-salones-root) .mobile-hamburger-btn,
        #appShell:has(.mobile-salones-root) .mobile-hamburger-btn {
          display: none !important;
        }

        .ms-bottom-bar-unified {
          position: fixed !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          height: 64px !important;
          background: rgba(255, 255, 255, 0.96) !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border-top: 1px solid #e2e8f0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 12px !important;
          padding: 0 14px calc(env(safe-area-inset-bottom, 0px)) !important;
          z-index: 140 !important;
          box-shadow: 0 -4px 16px rgba(15, 23, 42, 0.08) !important;
        }

        .ms-bottom-view-btn {
          all: unset !important;
          box-sizing: border-box !important;
          flex: 1 !important;
          height: 44px !important;
          border-radius: 12px !important;
          background: #f1f5f9 !important;
          border: 1.5px solid #cbd5e1 !important;
          color: #1e293b !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          touch-action: manipulation !important;
        }

        .ms-bottom-view-btn:active {
          transform: scale(0.96) !important;
        }

        .ms-bottom-view-btn.ms-view-timeline-active {
          background: #eef2ff !important;
          border-color: #a5b4fc !important;
          color: #4338ca !important;
          box-shadow: 0 1px 4px rgba(79, 70, 229, 0.15) !important;
        }

        .ms-bottom-new-btn {
          all: unset !important;
          box-sizing: border-box !important;
          flex: 1 !important;
          height: 44px !important;
          border-radius: 12px !important;
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%) !important;
          color: #ffffff !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          font-size: 13.5px !important;
          font-weight: 700 !important;
          cursor: pointer !important;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3) !important;
          transition: all 0.15s ease !important;
          touch-action: manipulation !important;
        }

        .ms-bottom-new-btn:active {
          transform: scale(0.96) !important;
        }

        /* ─── VISTA TIMELINE DIARIO (MATRIZ DE 6 BLOQUES ARMONIZADA AL CRM) ─── */
        .ms-timeline-container {
          padding: 0 14px;
          margin-bottom: 20px;
        }

        .ms-timeline-card {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 16px !important;
          padding: 14px 12px !important;
          box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.06) !important;
          color: #0f172a !important;
        }

        .ms-tl-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          margin-bottom: 12px !important;
          padding-bottom: 10px !important;
          border-bottom: 1px solid #f1f5f9 !important;
        }

        .ms-tl-title-wrap {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .ms-tl-icon {
          flex-shrink: 0 !important;
        }

        .ms-tl-title {
          font-size: 14px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          letter-spacing: 0.01em !important;
        }

        .ms-tl-badge-date {
          font-size: 11px !important;
          font-weight: 800 !important;
          color: #4338ca !important;
          background: #eef2ff !important;
          border: 1px solid #c7d2fe !important;
          padding: 2px 8px !important;
          border-radius: 6px !important;
          letter-spacing: 0.03em !important;
        }

        .ms-tl-grid-wrap {
          width: 100% !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }

        .ms-tl-grid {
          min-width: 320px !important;
          width: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 7px !important;
        }

        .ms-tl-row {
          display: grid !important;
          grid-template-columns: 86px repeat(6, 1fr) !important;
          gap: 5px !important;
          align-items: center !important;
          padding: 2px 0 !important;
          border-bottom: 1px solid #f8fafc !important;
        }

        .ms-tl-header-row {
          margin-bottom: 4px !important;
          padding-bottom: 6px !important;
          border-bottom: 1.5px solid #e2e8f0 !important;
        }

        .ms-tl-header-cell {
          font-size: 11px !important;
          font-weight: 700 !important;
          color: #64748b !important;
          text-align: center !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 2px !important;
        }

        .ms-tl-header-cell:first-child {
          justify-content: flex-start !important;
          padding-left: 2px !important;
          font-weight: 800 !important;
          color: #475569 !important;
        }

        .ms-tl-active-time {
          color: #4338ca !important;
          font-weight: 800 !important;
        }

        .ms-tl-caret-down {
          font-size: 8px !important;
          color: #4338ca !important;
          margin-left: 1px !important;
        }

        .ms-tl-salon-cell {
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          min-width: 0 !important;
        }

        .ms-tl-salon-name {
          font-size: 12px !important;
          font-weight: 700 !important;
          color: #1e293b !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          line-height: 1.2 !important;
        }

        .ms-tl-block-cell {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .ms-tl-pill {
          width: 100% !important;
          height: 24px !important;
          border-radius: 5px !important;
          cursor: pointer !important;
          transition: transform 0.1s ease, filter 0.1s ease !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 1px 2px rgba(15, 23, 42, 0.05) !important;
          border-bottom: 1.5px solid rgba(0, 0, 0, 0.12) !important;
          border-left: 1px solid rgba(0, 0, 0, 0.06) !important;
          border-right: 1px solid rgba(0, 0, 0, 0.06) !important;
        }

        .ms-tl-pill:active {
          transform: scale(0.92) !important;
          filter: brightness(0.95) !important;
        }

        /* Pills en paleta armonizada al CRM */
        .ms-tl-pill-free {
          background: #d1fae5 !important;
          border-top: 2.5px solid #10b981 !important;
          border-bottom-color: #6ee7b7 !important;
          border-left-color: #a7f3d0 !important;
          border-right-color: #a7f3d0 !important;
        }

        .ms-tl-pill-occupied {
          background: #ffe4e6 !important;
          border-top: 2.5px solid #e11d48 !important;
          border-bottom-color: #fda4af !important;
          border-left-color: #fecdd3 !important;
          border-right-color: #fecdd3 !important;
        }

        .ms-tl-pill-occupied-amber {
          background: #fef3c7 !important;
          border-top: 2.5px solid #d97706 !important;
          border-bottom-color: #fcd34d !important;
          border-left-color: #fde68a !important;
          border-right-color: #fde68a !important;
        }

        .ms-tl-pill-occupied-blue,
        .ms-tl-pill-occupied-indigo {
          background: #dbeafe !important;
          border-top: 2.5px solid #2563eb !important;
          border-bottom-color: #93c5fd !important;
          border-left-color: #bfdbfe !important;
          border-right-color: #bfdbfe !important;
        }

        .ms-tl-pill-occupied-slate {
          background: #f1f5f9 !important;
          border-top: 2.5px solid #64748b !important;
          border-bottom-color: #cbd5e1 !important;
          border-left-color: #e2e8f0 !important;
          border-right-color: #e2e8f0 !important;
        }

        .ms-tl-pill-maintenance {
          background: #ede9fe !important;
          border-top: 2.5px solid #7c3aed !important;
          border-bottom-color: #c4b5fd !important;
          border-left-color: #ddd6fe !important;
          border-right-color: #ddd6fe !important;
        }

        .ms-tl-legend-row {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 12px !important;
          margin-top: 14px !important;
          padding: 8px 12px !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 10px !important;
          flex-wrap: wrap !important;
        }

        .ms-tl-legend-item {
          display: flex !important;
          align-items: center !important;
          gap: 5px !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          color: #475569 !important;
        }

        .ms-tl-legend-dot {
          width: 10px !important;
          height: 10px !important;
          border-radius: 3px !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08) !important;
        }

        /* ─── MODAL DETALLE DE BLOQUE ─── */
        .ms-block-detail-card {
          background: #ffffff !important;
          border-radius: 20px 20px 0 0 !important;
          padding: 20px 18px 26px 18px !important;
          width: 100% !important;
          max-width: 480px !important;
          box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.25) !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 14px !important;
          animation: msSlideUp 0.2s ease-out !important;
        }

        @keyframes msSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .ms-block-detail-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
        }

        .ms-block-detail-title-wrap {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
        }

        .ms-block-detail-salon {
          margin: 0 !important;
          font-size: 16px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
        }

        .ms-block-detail-time {
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #64748b !important;
        }

        .ms-block-detail-body {
          display: flex !important;
          flex-direction: column !important;
          gap: 14px !important;
        }

        .ms-block-free-banner {
          background: #ecfdf5 !important;
          border: 1px solid #a7f3d0 !important;
          border-radius: 12px !important;
          padding: 12px 14px !important;
          display: flex !important;
          align-items: flex-start !important;
          gap: 10px !important;
          color: #065f46 !important;
        }

        .ms-block-free-banner strong {
          display: block !important;
          font-size: 14px !important;
          margin-bottom: 2px !important;
        }

        .ms-block-free-banner p {
          margin: 0 !important;
          font-size: 12px !important;
          color: #047857 !important;
        }

        .ms-block-event-box {
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 12px !important;
          padding: 12px 14px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 8px !important;
        }

        .ms-block-event-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
        }

        .ms-block-event-title {
          margin: 0 !important;
          font-size: 15px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
        }

        .ms-block-event-meta {
          display: flex !important;
          gap: 10px !important;
          font-size: 11px !important;
          color: #64748b !important;
          font-weight: 600 !important;
          flex-wrap: wrap !important;
        }

        .ms-block-quote-total {
          font-size: 13px !important;
          font-weight: 800 !important;
          color: #059669 !important;
          padding-top: 4px !important;
          border-top: 1px dashed #cbd5e1 !important;
        }

        .ms-block-actions {
          display: flex !important;
          flex-direction: column !important;
          gap: 8px !important;
        }

        /* Estado vacío */
        .ms-empty-state {
          background: #ffffff;
          border-radius: 14px;
          border: 1px dashed #cbd5e1;
          padding: 30px 16px;
          text-align: center;
        }

        .ms-empty-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .ms-empty-title {
          font-size: 15px;
          font-weight: 800;
          color: #1e293b;
          margin-bottom: 4px;
        }

        .ms-empty-sub {
          font-size: 12px;
          color: #64748b;
          margin: 0 0 14px;
        }

        .ms-empty-btn {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #334155;
          font-size: 12px;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 8px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
