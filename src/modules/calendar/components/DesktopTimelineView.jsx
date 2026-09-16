import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { STATUS_META } from '../constants';

const DAY_START_HOUR = 6;  // 06:00
const DAY_END_HOUR = 24;   // 24:00
const MIN_SLOT_MINUTES = 60; // 1 hora mínima para considerar libre

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDateIso(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStartOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  // domingo = 0 -> queremos lunes como día 0
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEventCodeBadge(evt) {
  if (!evt) return '';
  const isPre = (evt.status || '').toLowerCase().includes('pre');
  const rawId = String(evt.id || '').replace(/[^0-9]/g, '');
  const idNum = rawId ? rawId.slice(-3) : '294';
  if (isPre) return `PR-${idNum}`;
  return `#EV-${idNum}`;
}

function getEventCardStyle(status = '') {
  const st = (status || '').toLowerCase();
  if (st.includes('confirm')) {
    return {
      bg: '#fff1f2',
      border: '#fecdd3',
      text: '#881337',
      statusText: '#be123c',
      badgeBg: '#ffe4e6',
      badgeBorder: '#fca5a5',
      badgeText: '#9f1239',
      icon: '📑'
    };
  }
  if (st.includes('cotiz') || st.includes('proceso') || st.includes('seguim') || st.includes('1er')) {
    return {
      bg: '#fffbeb',
      border: '#fde68a',
      text: '#78350f',
      statusText: '#b45309',
      badgeBg: '#fef3c7',
      badgeBorder: '#fcd34d',
      badgeText: '#92400e',
      icon: '📑'
    };
  }
  if (st.includes('pre') || st.includes('espera')) {
    return {
      bg: '#f5f3ff',
      border: '#ddd6fe',
      text: '#4c1d95',
      statusText: '#6d28d9',
      badgeBg: '#ede9fe',
      badgeBorder: '#c4b5fd',
      badgeText: '#5b21b6',
      icon: '📑'
    };
  }
  if (st.includes('manten')) {
    return {
      bg: '#faf5ff',
      border: '#e9d5ff',
      text: '#581c87',
      statusText: '#7e22ce',
      badgeBg: '#f3e8ff',
      badgeBorder: '#d8b4fe',
      badgeText: '#6b21a8',
      icon: '🔧'
    };
  }
  return {
    bg: '#f8fafc',
    border: '#e2e8f0',
    text: '#1e293b',
    statusText: '#475569',
    badgeBg: '#f1f5f9',
    badgeBorder: '#cbd5e1',
    badgeText: '#334155',
    icon: '📑'
  };
}

export default function DesktopTimelineView({
  events = [],
  salones = [],
  salonCapacities = {},
  disabledSalones = [],
  users = [],
  currentDate = new Date(),
  setCurrentDate = () => {},
  searchQuery = '',
  roomFilter = 'all',
  sellerFilter = 'all',
  statusFilter = 'all'
}) {
  const navigate = useNavigate();

  // Modo de vista interno: 'timeline' (Matriz de 6 bloques) o 'cards' (Tarjetas detalladas)
  const [displayMode, setDisplayMode] = useState('timeline');
  const [activeFilter, setActiveFilter] = useState('todas'); // 'todas' | 'libres' | 'parcial' | 'ocupados' | 'mantenimiento' | 'grandes'
  const [selectedBlockInfo, setSelectedBlockInfo] = useState(null);
  const [hoveredBlock, setHoveredBlock] = useState(null);

  const selectedDateStr = useMemo(() => formatDateIso(currentDate), [currentDate]);
  const todayStr = useMemo(() => formatDateIso(new Date()), []);
  const isTodaySelected = selectedDateStr === todayStr;

  // Salones activos (sin inhabilitados)
  const activeSalones = useMemo(() => {
    return salones
      .map(s => typeof s === 'string' ? s : (s?.name || s?.label || ''))
      .filter(s => s && !disabledSalones.includes(s));
  }, [salones, disabledSalones]);

  // Mapa de usuarios para vendedores
  const usersMap = useMemo(() => {
    const map = new Map();
    (users || []).forEach(u => {
      const id = String(u?.id || u?.userId || '');
      const name = u?.name || u?.nombre || '';
      if (id && name) map.set(id, name);
    });
    return map;
  }, [users]);

  // 6 bloques estándar (10h, 12h, 14h, 16h, 18h, 20h)
  const TIMELINE_BLOCKS = useMemo(() => [
    { id: '10h', label: '10h', startMin: 8 * 60, endMin: 11 * 60, title: '08:00 - 11:00', start: '08:00', end: '11:00' },
    { id: '12h', label: '12h', startMin: 11 * 60, endMin: 13 * 60, title: '11:00 - 13:00', start: '11:00', end: '13:00' },
    { id: '14h', label: '14h', startMin: 13 * 60, endMin: 15 * 60, title: '13:00 - 15:00', start: '13:00', end: '15:00' },
    { id: '16h', label: '16h', startMin: 15 * 60, endMin: 17 * 60, title: '15:00 - 17:00', start: '15:00', end: '17:00' },
    { id: '18h', label: '18h', startMin: 17 * 60, endMin: 19 * 60, title: '17:00 - 19:00', start: '17:00', end: '19:00' },
    { id: '20h', label: '20h', startMin: 19 * 60, endMin: 23 * 60, title: '19:00 - 23:00', start: '19:00', end: '23:00' },
  ], []);

  // Bloque actual en tiempo real si estamos en HOY
  const currentBlockId = useMemo(() => {
    if (!isTodaySelected) return null;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const matched = TIMELINE_BLOCKS.find(b => nowMin >= b.startMin && nowMin < b.endMin);
    return matched ? matched.id : (nowMin < 8 * 60 ? '10h' : '20h');
  }, [isTodaySelected, TIMELINE_BLOCKS]);

  // ─── TIRA SEMANAL COMPACTA DE 7 DÍAS ───
  const weekDays = useMemo(() => {
    const monday = getStartOfWeekMonday(currentDate);
    const dayNames = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = formatDateIso(d);

      const dayEvts = (events || []).filter(e => {
        if (e.status === 'Cancelado') return false;
        return e.date === iso || (e.date <= iso && e.endDate >= iso);
      });

      const uniqueStatuses = Array.from(new Set(dayEvts.map(e => e.status).filter(Boolean)));
      const dotColors = uniqueStatuses.map(st => {
        const meta = STATUS_META[st];
        return meta?.color || '#3b82f6';
      }).slice(0, 3);

      return {
        date: d,
        iso,
        dayName: dayNames[i],
        dayNum: d.getDate(),
        isToday: iso === todayStr,
        isSelected: iso === selectedDateStr,
        isWeekend: i >= 5,
        eventCount: dayEvts.length,
        dotColors: dotColors.length > 0 ? dotColors : ['#10b981']
      };
    });
  }, [currentDate, events, selectedDateStr, todayStr]);

  // ─── COMPUTAR ESTADO DE SALONES PARA LA FECHA SELECCIONADA ───
  const salonesStatusList = useMemo(() => {
    const dayStartMin = DAY_START_HOUR * 60; // 360 (06:00)
    const dayEndMin = DAY_END_HOUR * 60;     // 1440 (24:00)
    const totalDayHours = DAY_END_HOUR - DAY_START_HOUR; // 18h

    return activeSalones.map(salonName => {
      const capacity = salonCapacities[salonName] || 0;

      // Eventos del salón en la fecha seleccionada
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

      // Mantenimiento
      const maintenanceEvt = salonEvents.find(e => e.status === 'Mantenimiento');
      if (maintenanceEvt) {
        return {
          salonName,
          capacity,
          category: capacity > 150 ? 'grande' : 'estandar',
          statusType: 'mantenimiento',
          badgeText: 'Mantenimiento',
          badgeClass: 'dt-badge-maintenance',
          accentColor: '#8a2be2',
          maintenanceInfo: {
            title: maintenanceEvt.name || 'Mantenimiento programado',
            description: maintenanceEvt.notes || 'Área bajo labores de mantenimiento.',
            hours: `${maintenanceEvt.startTime || '06:00'} - ${maintenanceEvt.endTime || '24:00'}`
          },
          events: salonEvents,
          timeline: []
        };
      }

      // Si no hay eventos -> 100% Libre
      if (salonEvents.length === 0) {
        return {
          salonName,
          capacity,
          category: capacity > 150 ? 'grande' : 'estandar',
          statusType: 'libres',
          badgeText: 'Libre todo el día',
          badgeClass: 'dt-badge-available',
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

      // Con eventos: ordenamos cronológicamente
      const sortedEvents = [...salonEvents].sort((a, b) => {
        return (a.startTime || '06:00').localeCompare(b.startTime || '06:00');
      });

      const timeline = [];
      let currentPointer = dayStartMin;

      sortedEvents.forEach(evt => {
        const evStart = Math.max(dayStartMin, timeToMinutes(evt.startTime || '06:00'));
        const evEnd = Math.min(dayEndMin, timeToMinutes(evt.endTime || '24:00'));

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
          ? 'Ocupado todo el día' 
          : `Parcial (${salonEvents.length} evt)`,
        badgeClass: isFullDay ? 'dt-badge-occupied' : 'dt-badge-partial',
        accentColor: isFullDay ? '#ef4444' : '#3b82f6',
        events: salonEvents,
        timeline
      };
    });
  }, [activeSalones, salonCapacities, events, selectedDateStr, usersMap]);

  // ─── CONTEOS DE KPIS ───
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
      ocupados: ocupados + parcial,
      ocupadosExclusivos: ocupados,
      mantenimiento
    };
  }, [salonesStatusList]);

  // ─── FILTRADO INTEGRADO (CHIPS + TOPBAR SEARCH / FILTERS) ───
  const filteredSalones = useMemo(() => {
    return salonesStatusList.filter(s => {
      // 1. Chip rápido
      if (activeFilter === 'libres' && s.statusType !== 'libres') return false;
      if (activeFilter === 'parcial' && s.statusType !== 'parcial') return false;
      if (activeFilter === 'ocupados' && s.statusType !== 'ocupados' && s.statusType !== 'parcial') return false;
      if (activeFilter === 'mantenimiento' && s.statusType !== 'mantenimiento') return false;
      if (activeFilter === 'grandes' && (s.capacity || 0) < 150) return false;

      // 2. Filtro de salón de Topbar
      if (roomFilter && roomFilter !== 'all') {
        if (s.salonName.toLowerCase() !== roomFilter.toLowerCase()) return false;
      }

      // 3. Filtro de estado de Topbar
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'Mantenimiento') {
          if (s.statusType !== 'mantenimiento') return false;
        } else {
          const hasMatchingEvent = (s.events || []).some(e => e.status === statusFilter);
          if (!hasMatchingEvent) return false;
        }
      }

      // 4. Filtro de vendedor de Topbar
      if (sellerFilter && sellerFilter !== 'all') {
        const hasMatchingSeller = (s.events || []).some(e => {
          const sId = String(e.userId || '');
          const sName = usersMap.get(sId) || e.seller || '';
          return sId === String(sellerFilter) || sName.toLowerCase().includes(sellerFilter.toLowerCase());
        });
        if (!hasMatchingSeller) return false;
      }

      // 5. Búsqueda de Topbar
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = s.salonName.toLowerCase().includes(q);
        const matchEvents = (s.events || []).some(e => 
          (e.name || '').toLowerCase().includes(q) ||
          (e.client || '').toLowerCase().includes(q) ||
          (e.clientName || '').toLowerCase().includes(q) ||
          (e.seller || '').toLowerCase().includes(q)
        );
        if (!matchName && !matchEvents) return false;
      }

      return true;
    });
  }, [salonesStatusList, activeFilter, roomFilter, statusFilter, sellerFilter, searchQuery, usersMap]);

  // ─── SALONES CON SUS 6 BLOQUES MAPEADOS ───
  const salonesWithBlocks = useMemo(() => {
    return filteredSalones.map(s => {
      const blocks = TIMELINE_BLOCKS.map(block => {
        if (s.statusType === 'mantenimiento') {
          return {
            blockId: block.id,
            blockTitle: block.title,
            start: block.start,
            end: block.end,
            status: 'maintenance',
            pillVariant: 'maintenance',
            cardStyle: getEventCardStyle('Mantenimiento'),
            codeBadge: 'MNT',
            label: 'Mantenimiento',
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

          const sellerName = usersMap.get(String(evt.userId)) || evt.seller || 'Ventas';
          const quoteTotal = evt.quote?.total || (evt.quote ? Number(evt.quote) : 0);
          const cardStyle = getEventCardStyle(evt.status);
          const codeBadge = getEventCodeBadge(evt);

          return {
            blockId: block.id,
            blockTitle: block.title,
            start: block.start,
            end: block.end,
            status: 'occupied',
            event: {
              ...evt,
              sellerName,
              quoteTotal
            },
            cardStyle,
            codeBadge,
            pillVariant,
            accentColor: accent,
            bgColor: bg
          };
        }

        return {
          blockId: block.id,
          blockTitle: block.title,
          start: block.start,
          end: block.end,
          status: 'free',
          pillVariant: 'free',
          label: 'Libre',
          accentColor: '#10b981',
          bgColor: '#d1fae5'
        };
      });

      return {
        ...s,
        timelineBlocks: blocks
      };
    });
  }, [filteredSalones, TIMELINE_BLOCKS, usersMap]);

  // ─── NAVEGACIÓN SEMANAL ───
  const handlePrevWeek = useCallback(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  }, [currentDate, setCurrentDate]);

  const handleNextWeek = useCallback(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  }, [currentDate, setCurrentDate]);

  // ─── ACCIONES DE RESERVA Y APERTURA ───
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

  return (
    <main className="dt-workspace" data-purpose="timeline-workspace">
      {/* BEGIN: Calendar Day Pills and Quick Statistics Filter Bar */}
      <section className="dt-ribbon-bar" data-purpose="date-selector-pills">
        {/* Weekday Navigation Pills */}
        <div className="dt-weekday-nav">
          <button
            type="button"
            className="dt-week-arrow-btn"
            onClick={handlePrevWeek}
            title="Semana anterior"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {weekDays.map(day => {
            const isSelected = day.isSelected;
            return (
              <button
                key={day.iso}
                type="button"
                className={`dt-day-pill ${isSelected ? 'dt-day-pill-active' : ''}`}
                onClick={() => setCurrentDate(new Date(day.date.getTime()))}
                title={`${day.dayName} ${day.dayNum} (${day.eventCount} eventos)`}
              >
                <span className="dt-day-name">{day.dayName}</span>
                <span className="dt-day-num">{day.dayNum}</span>
                {isSelected ? (
                  <span className="dt-day-pulse-dot" />
                ) : day.eventCount > 0 ? (
                  <span
                    className="dt-day-status-dot"
                    style={{
                      backgroundColor: day.isWeekend ? '#f43f5e' : (day.dotColors[0] || '#10b981')
                    }}
                  />
                ) : null}
              </button>
            );
          })}

          <button
            type="button"
            className="dt-week-arrow-btn"
            onClick={handleNextWeek}
            title="Semana siguiente"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Filter Count Badges & Grid/Card switch */}
        <div className="dt-ribbon-right">
          <div className="dt-kpi-container">
            <button
              type="button"
              className={`dt-kpi-item ${activeFilter === 'todas' ? 'dt-kpi-all' : ''}`}
              onClick={() => setActiveFilter('todas')}
              title="Ver todos los salones"
            >
              <span>Todos</span>
              <span className="dt-kpi-pill-cnt">{kpiCounts.total}</span>
            </button>

            <button
              type="button"
              className={`dt-kpi-item dt-kpi-emerald ${activeFilter === 'libres' ? 'dt-kpi-active-emerald' : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'libres' ? 'todas' : 'libres')}
              title="Filtrar salones libres todo el día"
            >
              <span className="dt-kpi-dot dt-dot-emerald" />
              <span>Libres</span>
              <span style={{ fontWeight: 700 }}>{kpiCounts.libres}</span>
            </button>

            <button
              type="button"
              className={`dt-kpi-item dt-kpi-indigo ${activeFilter === 'parcial' ? 'dt-kpi-active-indigo' : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'parcial' ? 'todas' : 'parcial')}
              title="Filtrar salones con ocupación parcial"
            >
              <span className="dt-kpi-dot dt-dot-indigo" />
              <span>Parcial</span>
              <span style={{ fontWeight: 700 }}>{kpiCounts.parcial}</span>
            </button>

            <button
              type="button"
              className={`dt-kpi-item dt-kpi-rose ${activeFilter === 'ocupados' ? 'dt-kpi-active-rose' : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'ocupados' ? 'todas' : 'ocupados')}
              title="Filtrar salones con eventos confirmados u ocupados"
            >
              <span className="dt-kpi-dot dt-dot-rose" />
              <span>Ocupados</span>
              <span style={{ fontWeight: 700 }}>{kpiCounts.ocupados}</span>
            </button>

            <button
              type="button"
              className={`dt-kpi-item dt-kpi-pax ${activeFilter === 'grandes' ? 'dt-kpi-active-dark' : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'grandes' ? 'todas' : 'grandes')}
              title="Filtrar salones con capacidad mayor a 150 comensales"
            >
              <span>&gt;150 PAX</span>
            </button>
          </div>

          {/* Grid / Card switch */}
          <div className="dt-view-switch">
            <button
              type="button"
              className={`dt-view-switch-btn ${displayMode === 'timeline' ? 'dt-view-switch-btn-active' : ''}`}
              onClick={() => setDisplayMode('timeline')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="3" width="4" height="18" rx="1" />
                <rect x="10" y="3" width="4" height="18" rx="1" />
                <rect x="16" y="3" width="4" height="18" rx="1" />
              </svg>
              <span>Matriz</span>
            </button>
            <button
              type="button"
              className={`dt-view-switch-btn ${displayMode === 'cards' ? 'dt-view-switch-btn-active' : ''}`}
              onClick={() => setDisplayMode('cards')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span>Tarjetas</span>
            </button>
          </div>
        </div>
      </section>

      {/* BEGIN: Venue Scheduling Timeline Table (12-column grid) */}
      <div className="dt-timeline-grid-container" data-purpose="timeline-grid-container">
        <div className="dt-timeline-card">
          {/* Table Header / Timeline Hours */}
          <div className="dt-grid-12 dt-header-row">
            {/* Salón Column Header (col-span-3) */}
            <div className="dt-col-span-3 dt-salon-header-cell">
              <span className="dt-sh-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                  <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                  <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                  <path d="M10 6h4" />
                  <path d="M10 10h4" />
                  <path d="M10 14h4" />
                  <path d="M10 18h4" />
                </svg>
                <span>SALÓN / ÁREA</span>
              </span>
              <span className="dt-sh-badge">
                {salonesWithBlocks.length} ÁREAS
              </span>
            </div>

            {/* Time Intervals Headers (col-span-9, grid-cols-6) */}
            <div className="dt-col-span-9 dt-grid-6 dt-header-intervals">
              {TIMELINE_BLOCKS.map(b => {
                const isActiveTime = currentBlockId === b.id;
                return (
                  <div key={b.id} className={`dt-interval-header-cell ${isActiveTime ? 'dt-interval-active-bg' : ''}`}>
                    <div className={`dt-interval-code ${isActiveTime ? 'dt-interval-active-code' : ''}`}>
                      <span>{b.label.toUpperCase()}</span>
                      {isActiveTime && <span className="dt-actual-badge">ACTUAL</span>}
                    </div>
                    <div className={`dt-interval-range ${isActiveTime ? 'dt-interval-active-range' : ''}`}>
                      {b.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table Body Venue Rows */}
          <div className="dt-body-rows">
            {salonesWithBlocks.length === 0 ? (
              <div className="dt-empty-row">
                <p>No hay salones bajo este filtro para la fecha seleccionada.</p>
                <button type="button" onClick={() => setActiveFilter('todas')}>Ver todos los salones</button>
              </div>
            ) : (
              salonesWithBlocks.map(s => {
                const isAllFree = s.statusType === 'libres';
                return (
                  <div key={s.salonName} className="dt-grid-12 dt-venue-row group">
                    {/* Columna Salón (col-span-3) */}
                    <div className="dt-col-span-3 dt-venue-cell">
                      <div>
                        <h3 className="dt-venue-name">{s.salonName}</h3>
                        <div className="dt-venue-meta-line">
                          {s.capacity > 0 && (
                            <span className="dt-cap-pill">Cap. {s.capacity} PAX</span>
                          )}
                          <span className={`dt-vstatus-pill dt-vstatus-${s.statusType}`}>
                            <span className="dt-vstatus-dot" />
                            <span>
                              {s.statusType === 'libres' ? 'Libre día' : s.statusType === 'parcial' ? 'Parcial' : s.statusType === 'ocupados' ? 'Ocupado' : 'Mantenimiento'}
                            </span>
                          </span>
                        </div>
                      </div>
                      {isAllFree && (
                        <button
                          type="button"
                          className="dt-btn-full-day"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBookSalonFull(s.salonName);
                          }}
                          title="Reservar todo el día en este salón"
                        >
                          + Todo el día
                        </button>
                      )}
                    </div>

                    {/* Bloques de Horas (col-span-9, grid-cols-6) */}
                    <div className="dt-col-span-9 dt-grid-6 dt-slots-grid">
                      {s.timelineBlocks.map(block => {
                        const isFree = block.status === 'free';
                        const isOccupied = block.status === 'occupied';
                        const isActiveTime = currentBlockId === block.blockId;

                        if (isFree) {
                          return (
                            <button
                              key={block.blockId}
                              type="button"
                              className={`dt-slot-free-btn ${isActiveTime ? 'dt-slot-free-active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBookFreeSlot(s.salonName, block.start, block.end);
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredBlock({
                                  salonName: s.salonName,
                                  capacity: s.capacity,
                                  blockTitle: block.blockTitle,
                                  status: 'free',
                                  x: rect.left + rect.width / 2,
                                  y: rect.top
                                });
                              }}
                              onMouseLeave={() => setHoveredBlock(null)}
                              title={`Libre: ${block.start} a ${block.end}. Clic para reservar.`}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span>Libre</span>
                              <span className="dt-slot-subtext">+ Reservar</span>
                            </button>
                          );
                        }

                        if (isOccupied && block.event) {
                          const stLower = String(block.event.status || '').toLowerCase();
                          let statusTheme = 'amber';
                          let statusLabel = 'Cotizado';
                          let badgeCode = block.codeBadge || `#EV-${block.event.id}`;
                          
                          if (stLower.includes('confirm') || stLower.includes('ganad') || stLower.includes('pagad')) {
                            statusTheme = 'rose';
                            statusLabel = 'Confirmado';
                          } else if (stLower.includes('pre') || stLower.includes('bloqueo')) {
                            statusTheme = 'indigo';
                            statusLabel = 'Pre-reserva';
                            if (!block.codeBadge) badgeCode = `PR-${block.event.id}`;
                          }

                          return (
                            <div
                              key={block.blockId}
                              className={`dt-slot-card dt-slot-card-${statusTheme}`}
                              onClick={() => {
                                setHoveredBlock(null);
                                setSelectedBlockInfo({
                                  salonName: s.salonName,
                                  capacity: s.capacity,
                                  blockTitle: block.blockTitle,
                                  blockLabel: block.blockId,
                                  start: block.start,
                                  end: block.end,
                                  status: block.status,
                                  event: block.event
                                });
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredBlock({
                                  salonName: s.salonName,
                                  capacity: s.capacity,
                                  blockTitle: block.blockTitle,
                                  status: 'occupied',
                                  event: block.event,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top
                                });
                              }}
                              onMouseLeave={() => setHoveredBlock(null)}
                            >
                              <div className="dt-slot-card-top">
                                <span className="dt-slot-status-label">
                                  {statusTheme === 'rose' ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                      <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                  ) : statusTheme === 'indigo' ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                                    </svg>
                                  ) : (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                      <polyline points="14 2 14 8 20 8" />
                                      <line x1="16" y1="13" x2="8" y2="13" />
                                      <line x1="16" y1="17" x2="8" y2="17" />
                                      <line x1="10" y1="9" x2="8" y2="9" />
                                    </svg>
                                  )}
                                  <span>{statusLabel}</span>
                                </span>
                                <span className="dt-slot-code-badge">{badgeCode}</span>
                              </div>
                              <span className="dt-slot-card-title truncate" title={block.event.name}>
                                {block.event.name} {block.event.pax > 0 ? `· ${block.event.pax}p` : ''}
                              </span>
                            </div>
                          );
                        }

                        // Mantenimiento
                        return (
                          <div
                            key={block.blockId}
                            className="dt-slot-card dt-slot-card-purple"
                            onClick={() => {
                              setHoveredBlock(null);
                              setSelectedBlockInfo({
                                salonName: s.salonName,
                                capacity: s.capacity,
                                blockTitle: block.blockTitle,
                                blockLabel: block.blockId,
                                start: block.start,
                                end: block.end,
                                status: 'maintenance'
                              });
                            }}
                          >
                            <div className="dt-slot-card-top">
                              <span className="dt-slot-status-label">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                                </svg>
                                <span>Mantenimiento</span>
                              </span>
                              <span className="dt-slot-code-badge">MNT</span>
                            </div>
                            <span className="dt-slot-card-title truncate">Labores preventivas</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* BEGIN: Bottom Status Legend Bar */}
      <footer className="dt-status-legend-bar" data-purpose="status-legend-bar">
        <div className="dt-sl-left">
          <span className="dt-sl-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>CÓDIGO DE ESTADOS:</span>
          </span>
          <div className="dt-sl-item">
            <span className="dt-sl-dot dt-dot-emerald" />
            <span>Libre</span>
          </div>
          <div className="dt-sl-item">
            <span className="dt-sl-dot dt-dot-rose" />
            <span>Confirmado</span>
          </div>
          <div className="dt-sl-item">
            <span className="dt-sl-dot dt-dot-amber" />
            <span>Cotizado</span>
          </div>
          <div className="dt-sl-item">
            <span className="dt-sl-dot dt-dot-indigo" />
            <span>Pre-reserva</span>
          </div>
          <div className="dt-sl-item">
            <span className="dt-sl-dot dt-dot-purple" />
            <span>Mantenimiento</span>
          </div>
        </div>

        <div className="dt-sl-right">
          <span>Zona Horaria: <strong className="dt-sl-bold">GMT-6 (Guatemala)</strong></span>
          <span className="dt-sl-sep">•</span>
          <span className="dt-sl-sync">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span>Sincronizado en tiempo real</span>
          </span>
        </div>
      </footer>


      {/* ─── TOOLTIP FLOTANTE ENRIQUECIDO EN HOVER ─── */}
      {hoveredBlock && (
        <div
          className="dt-floating-tooltip"
          style={{
            top: hoveredBlock.y - 8,
            left: hoveredBlock.x,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="dt-tt-header">
            <strong>{hoveredBlock.salonName}</strong>
            <span className="dt-tt-time">{hoveredBlock.blockTitle}</span>
          </div>
          {hoveredBlock.status === 'free' ? (
            <div className="dt-tt-free-body">
              <span className="dt-tt-green-dot">●</span>
              <span>Totalmente disponible • Clic para reservar</span>
            </div>
          ) : hoveredBlock.event ? (
            <div className="dt-tt-event-body">
              <div className="dt-tt-event-title">{hoveredBlock.event.name}</div>
              <div className="dt-tt-meta-row">
                <span><strong>Estado:</strong> {hoveredBlock.event.status}</span>
                <span><strong>Horario:</strong> {hoveredBlock.event.startTime} - {hoveredBlock.event.endTime}</span>
              </div>
              <div className="dt-tt-meta-row">
                <span><strong>Comensales:</strong> {hoveredBlock.event.pax || 0} PAX</span>
                {hoveredBlock.event.sellerName && <span><strong>Vendedor:</strong> {hoveredBlock.event.sellerName}</span>}
              </div>
              {hoveredBlock.event.quoteTotal > 0 && (
                <div className="dt-tt-quote">
                  Cotización: Q {Number(hoveredBlock.event.quoteTotal).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>
          ) : (
            <div className="dt-tt-maint-body">
              <span>Área en mantenimiento</span>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL INTERACTIVO AL HACER CLIC EN UN BLOQUE ─── */}
      {selectedBlockInfo && typeof document !== 'undefined' && createPortal(
        <div
          className="dt-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedBlockInfo(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="dt-modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="dt-modal-header">
              <div className="dt-modal-title-group">
                <div className="dt-modal-icon-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <h3 className="dt-modal-salon-title">{selectedBlockInfo.salonName}</h3>
                  <span className="dt-modal-time-sub">
                    Bloque {selectedBlockInfo.blockTitle} ({selectedBlockInfo.start} a {selectedBlockInfo.end})
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="dt-modal-close-btn"
                onClick={() => setSelectedBlockInfo(null)}
                aria-label="Cerrar diálogo"
              >
                ✕
              </button>
            </div>

            {selectedBlockInfo.status === 'free' ? (
              <div className="dt-modal-body">
                <div className="dt-modal-free-banner">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <div>
                    <strong>Salón Disponible en este Bloque</strong>
                    <p>No existen eventos registrados entre las {selectedBlockInfo.start} y las {selectedBlockInfo.end}.</p>
                  </div>
                </div>

                <div className="dt-modal-actions-list">
                  <button
                    type="button"
                    className="dt-btn-primary dt-btn-full"
                    onClick={() => {
                      handleBookFreeSlot(selectedBlockInfo.salonName, selectedBlockInfo.start, selectedBlockInfo.end);
                      setSelectedBlockInfo(null);
                    }}
                  >
                    + Reservar este bloque horario ({selectedBlockInfo.blockTitle})
                  </button>
                  <button
                    type="button"
                    className="dt-btn-secondary dt-btn-full"
                    onClick={() => {
                      handleBookSalonFull(selectedBlockInfo.salonName);
                      setSelectedBlockInfo(null);
                    }}
                  >
                    Reservar todo el día en este salón
                  </button>
                </div>
              </div>
            ) : selectedBlockInfo.status === 'occupied' && selectedBlockInfo.event ? (
              <div className="dt-modal-body">
                <div className="dt-modal-event-box">
                  <div className="dt-modal-evt-badge-row">
                    <span
                      className="dt-cs-evt-status"
                      style={{
                        backgroundColor: `${selectedBlockInfo.event.statusColor || '#4f46e5'}18`,
                        color: selectedBlockInfo.event.statusColor || '#4f46e5',
                        borderColor: `${selectedBlockInfo.event.statusColor || '#4f46e5'}40`
                      }}
                    >
                      {selectedBlockInfo.event.status?.toUpperCase()}
                    </span>
                    <span className="dt-modal-evt-hours">
                      {selectedBlockInfo.event.startTime} - {selectedBlockInfo.event.endTime}
                    </span>
                  </div>

                  <h4 className="dt-modal-evt-name">{selectedBlockInfo.event.name}</h4>

                  <div className="dt-modal-grid-meta">
                    <div className="dt-modal-meta-item">
                      <span className="dt-m-label">Comensales:</span>
                      <span className="dt-m-val">👤 {selectedBlockInfo.event.pax || 0} PAX</span>
                    </div>
                    <div className="dt-modal-meta-item">
                      <span className="dt-m-label">Vendedor:</span>
                      <span className="dt-m-val">🏷️ {selectedBlockInfo.event.sellerName || 'Ventas'}</span>
                    </div>
                    {selectedBlockInfo.event.client && (
                      <div className="dt-modal-meta-item" style={{ gridColumn: '1 / -1' }}>
                        <span className="dt-m-label">Cliente / Institución:</span>
                        <span className="dt-m-val">🏢 {selectedBlockInfo.event.client}</span>
                      </div>
                    )}
                    {selectedBlockInfo.event.notes && (
                      <div className="dt-modal-meta-item" style={{ gridColumn: '1 / -1' }}>
                        <span className="dt-m-label">Observaciones:</span>
                        <span className="dt-m-val">{selectedBlockInfo.event.notes}</span>
                      </div>
                    )}
                  </div>

                  {selectedBlockInfo.event.quoteTotal > 0 && (
                    <div className="dt-modal-quote-banner">
                      <span>Cotización Total:</span>
                      <strong>Q {Number(selectedBlockInfo.event.quoteTotal).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  )}
                </div>

                <div className="dt-modal-actions-list">
                  <button
                    type="button"
                    className="dt-btn-primary dt-btn-full"
                    onClick={() => {
                      handleOpenEvent(selectedBlockInfo.event.id);
                      setSelectedBlockInfo(null);
                    }}
                  >
                    Ver detalle completo de la reserva
                  </button>
                  <button
                    type="button"
                    className="dt-btn-secondary dt-btn-full"
                    onClick={() => setSelectedBlockInfo(null)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <div className="dt-modal-body">
                <div className="dt-modal-free-banner" style={{ background: '#f5f3ff', borderColor: '#ddd6fe' }}>
                  <span>🔧 Área en mantenimiento preventivo durante esta fecha.</span>
                </div>
                <button
                  type="button"
                  className="dt-btn-secondary dt-btn-full"
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

      {/* ─── ESTILOS CSS DEDICADOS ULTRA FIDEDIGNOS (100% BLUEPRINT) ─── */}
      <style>{`
        /* Reset de botones globales contra design-system-scoped.css */
        body:not(.informes-theme) .dt-workspace button {
          min-height: unset !important;
          max-height: unset !important;
          height: auto;
          border: none;
          background: transparent;
          box-sizing: border-box;
          font-family: inherit;
        }

        .dt-workspace {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background-color: #f8fafc;
          color: #1e293b;
          font-family: 'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, sans-serif;
          height: 100%;
          box-sizing: border-box;
        }

        /* ─── CINTA SEMANAL + KPIS (ROW 4) ─── */
        .dt-ribbon-bar {
          background-color: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          padding: 10px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-shrink: 0;
          box-sizing: border-box;
          overflow-x: auto;
        }

        .dt-weekday-nav {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .dt-week-arrow-btn {
          width: 28px !important;
          height: 28px !important;
          min-height: 28px !important;
          max-height: 28px !important;
          border-radius: 6px !important;
          border: 1px solid #e2e8f0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: #94a3b8 !important;
          background-color: transparent !important;
          cursor: pointer !important;
          padding: 0 !important;
          transition: all 0.15s ease;
        }

        .dt-week-arrow-btn:hover {
          color: #334155 !important;
          background-color: #f8fafc !important;
          border-color: #cbd5e1 !important;
        }

        .dt-day-pill {
          padding: 4px 12px !important;
          border-radius: 8px !important;
          font-size: 12px !important;
          color: #475569 !important;
          font-weight: 500 !important;
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          border: 1px solid transparent !important;
          background-color: transparent !important;
          cursor: pointer !important;
          transition: background-color 0.15s ease;
          height: 28px !important;
          min-height: 28px !important;
          max-height: 28px !important;
          white-space: nowrap !important;
        }

        .dt-day-pill:hover:not(.dt-day-pill-active) {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
        }

        .dt-day-pill-active {
          padding: 4px 14px !important;
          background-color: #4f46e5 !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -2px rgba(79, 70, 229, 0.2) !important;
          outline: 2px solid rgba(79, 70, 229, 0.3) !important;
          border-color: transparent !important;
        }

        .dt-day-pill-active:hover {
          background-color: #4338ca !important;
        }

        .dt-day-name {
          font-size: 11px;
        }

        .dt-day-num {
          font-weight: 700;
          color: inherit;
        }

        .dt-day-pill:not(.dt-day-pill-active) .dt-day-num {
          color: #1e293b;
        }

        .dt-day-pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #ffffff;
          animation: dtPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .dt-day-status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        @keyframes dtPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }

        /* ─── FILTROS KPIS + SELECTOR MATRIZ / TARJETAS ─── */
        .dt-ribbon-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .dt-kpi-container {
          display: flex;
          align-items: center;
          gap: 6px;
          background-color: rgba(241, 245, 249, 0.9);
          padding: 4px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          font-size: 12px;
        }

        .dt-kpi-item {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          padding: 2px 8px !important;
          border-radius: 6px !important;
          font-size: 11px !important;
          font-weight: 500 !important;
          border: none !important;
          background: transparent !important;
          cursor: pointer !important;
          transition: all 0.15s ease;
          height: 24px !important;
          min-height: 24px !important;
          max-height: 24px !important;
          white-space: nowrap !important;
        }

        .dt-kpi-item:hover:not(.dt-kpi-all):not([class*="dt-kpi-active"]) {
          background-color: #ffffff !important;
        }

        .dt-kpi-all {
          background-color: #0f172a !important;
          color: #ffffff !important;
          font-weight: 600 !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
        }

        .dt-kpi-pill-cnt {
          background-color: #334155;
          color: #e2e8f0;
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 9999px;
          font-weight: 700;
        }

        .dt-kpi-emerald { color: #047857 !important; }
        .dt-kpi-indigo { color: #4338ca !important; }
        .dt-kpi-rose { color: #be123c !important; }
        .dt-kpi-pax { color: #475569 !important; }

        .dt-kpi-active-dark {
          background-color: #0f172a !important;
          color: #ffffff !important;
        }
        .dt-kpi-active-emerald {
          background-color: #ffffff !important;
          color: #047857 !important;
          font-weight: 700 !important;
          border: 1px solid #a7f3d0 !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
        }
        .dt-kpi-active-indigo {
          background-color: #ffffff !important;
          color: #4338ca !important;
          font-weight: 700 !important;
          border: 1px solid #c7d2fe !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
        }
        .dt-kpi-active-rose {
          background-color: #ffffff !important;
          color: #be123c !important;
          font-weight: 700 !important;
          border: 1px solid #fecdd3 !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
        }

        .dt-kpi-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dt-dot-emerald { background-color: #10b981; }
        .dt-dot-indigo { background-color: #6366f1; }
        .dt-dot-rose { background-color: #f43f5e; }
        .dt-dot-amber { background-color: #f59e0b; }
        .dt-dot-purple { background-color: #a855f7; }

        /* Grid / Cards view switch */
        .dt-view-switch {
          display: flex;
          align-items: center;
          background-color: #f1f5f9;
          padding: 2px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          font-size: 12px;
          color: #475569;
          font-weight: 500;
        }

        .dt-view-switch-btn {
          display: flex !important;
          align-items: center !important;
          gap: 4px !important;
          padding: 4px 10px !important;
          border-radius: 6px !important;
          font-size: 11px !important;
          color: #475569 !important;
          border: none !important;
          background: transparent !important;
          cursor: pointer !important;
          transition: all 0.15s ease;
          height: 24px !important;
          min-height: 24px !important;
          max-height: 24px !important;
        }

        .dt-view-switch-btn:hover {
          color: #0f172a !important;
        }

        .dt-view-switch-btn-active {
          background-color: #ffffff !important;
          color: #4338ca !important;
          font-weight: 700 !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
        }

        /* ─── TABLERO Y MATRIZ 12 COLUMNAS ─── */
        .dt-timeline-grid-container {
          flex: 1;
          overflow: auto;
          background-color: rgba(241, 245, 249, 0.5);
          padding: 16px;
          box-sizing: border-box;
        }

        .dt-timeline-card {
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(226, 232, 240, 0.9);
          overflow: hidden;
          min-width: 1240px;
        }

        /* 12-column grid layout */
        .dt-grid-12 {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
        }

        .dt-col-span-3 {
          grid-column: span 3 / span 3;
        }

        .dt-col-span-9 {
          grid-column: span 9 / span 9;
        }

        .dt-grid-6 {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }

        /* Table Header */
        .dt-header-row {
          background-color: rgba(248, 250, 252, 0.9);
          border-bottom: 1px solid #e2e8f0;
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .dt-salon-header-cell {
          padding: 12px 12px 12px 20px;
          border-right: 1px solid rgba(226, 232, 240, 0.8);
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #475569;
          box-sizing: border-box;
        }

        .dt-sh-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 700;
        }

        .dt-sh-badge {
          background-color: #e2e8f0;
          color: #334155;
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 9999px;
          font-weight: 700;
        }

        .dt-interval-header-cell {
          padding: 10px 12px;
          text-align: center;
          border-left: 1px solid rgba(226, 232, 240, 0.8);
          box-sizing: border-box;
        }

        .dt-interval-code {
          color: #0f172a;
          font-weight: 700;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .dt-actual-badge {
          background-color: #4f46e5;
          color: #ffffff;
          font-size: 9px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          letter-spacing: 0.04em;
        }

        .dt-interval-range {
          font-size: 10px;
          color: #94a3b8;
          font-weight: 400;
          margin-top: 2px;
        }

        .dt-interval-active-bg {
          background-color: rgba(238, 242, 255, 0.4);
        }
        .dt-interval-active-code {
          color: #312e81;
        }
        .dt-interval-active-range {
          color: rgba(79, 70, 229, 0.8);
          font-weight: 500;
        }

        /* Body Rows */
        .dt-venue-row {
          align-items: center;
          border-bottom: 1px solid rgba(226, 232, 240, 0.7);
          font-size: 12px;
          transition: background-color 0.15s ease;
        }

        .dt-venue-row:hover {
          background-color: rgba(248, 250, 252, 0.7);
        }

        .dt-venue-cell {
          padding: 14px 12px 14px 20px;
          border-right: 1px solid rgba(226, 232, 240, 0.8);
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-sizing: border-box;
        }

        .dt-venue-name {
          font-weight: 700;
          color: #1e293b;
          font-size: 14px;
          margin: 0;
          line-height: 1.2;
        }

        .dt-venue-meta-line {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
        }

        .dt-cap-pill {
          font-size: 10px;
          color: #64748b;
          background-color: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
          border: 1px solid rgba(226, 232, 240, 0.6);
        }

        .dt-vstatus-pill {
          font-size: 10px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .dt-vstatus-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .dt-vstatus-libres { color: #059669; }
        .dt-vstatus-libres .dt-vstatus-dot { background-color: #10b981; }

        .dt-vstatus-parcial { color: #4f46e5; }
        .dt-vstatus-parcial .dt-vstatus-dot { background-color: #6366f1; }

        .dt-vstatus-ocupados { color: #e11d48; }
        .dt-vstatus-ocupados .dt-vstatus-dot { background-color: #f43f5e; }

        .dt-btn-full-day {
          padding: 4px 10px !important;
          border-radius: 6px !important;
          font-size: 11px !important;
          font-weight: 500 !important;
          color: #475569 !important;
          background-color: #f1f5f9 !important;
          border: 1px solid rgba(226, 232, 240, 0.8) !important;
          cursor: pointer !important;
          transition: all 0.15s ease;
          white-space: nowrap !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
          height: 26px !important;
          min-height: 26px !important;
          max-height: 26px !important;
        }

        .dt-btn-full-day:hover {
          background-color: #e2e8f0 !important;
          color: #0f172a !important;
        }

        .dt-slots-grid {
          padding: 8px;
          gap: 8px;
          box-sizing: border-box;
          border-left: 1px solid rgba(226, 232, 240, 0.8);
        }

        /* Free Slot Button */
        .dt-slot-free-btn {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          padding: 10px 8px !important;
          border-radius: 8px !important;
          background-color: rgba(236, 253, 245, 0.7) !important;
          border: 1px solid rgba(167, 243, 208, 0.8) !important;
          color: #065f46 !important;
          font-weight: 500 !important;
          font-size: 12px !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
          height: 48px !important;
          min-height: 48px !important;
          max-height: 48px !important;
          box-sizing: border-box !important;
          width: 100% !important;
        }

        .dt-slot-free-btn:hover {
          background-color: rgba(209, 250, 229, 0.9) !important;
          border-color: #6ee7b7 !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06) !important;
          transform: translateY(-1px);
        }

        .dt-slot-free-active {
          background-color: rgba(236, 253, 245, 0.9) !important;
          border-color: #6ee7b7 !important;
          outline: 1px solid rgba(99, 102, 241, 0.3) !important;
        }

        .dt-slot-subtext {
          font-size: 10px;
          color: #059669;
          font-weight: 400;
        }

        /* Occupied Slot Card */
        .dt-slot-card {
          padding: 8px 10px;
          border-radius: 8px;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          cursor: pointer;
          transition: all 0.15s ease;
          height: 48px;
          min-height: 48px;
          max-height: 48px;
          box-sizing: border-box;
        }

        .dt-slot-card:hover {
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
          transform: translateY(-1px);
        }

        .dt-slot-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          line-height: 1;
          margin-bottom: 3px;
        }

        .dt-slot-status-label {
          font-weight: 700;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .dt-slot-code-badge {
          font-size: 9px;
          padding: 1px 4px;
          border-radius: 4px;
          font-weight: 700;
        }

        .dt-slot-card-title {
          font-size: 10px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
        }

        /* Amber (Cotizado) */
        .dt-slot-card-amber {
          background-color: rgba(254, 243, 199, 0.9);
          border: 1px solid #fcd34d;
          color: #78350f;
        }
        .dt-slot-card-amber .dt-slot-status-label { color: #b45309; }
        .dt-slot-card-amber .dt-slot-code-badge {
          background-color: rgba(253, 230, 138, 0.7);
          color: #92400e;
        }
        .dt-slot-card-amber .dt-slot-card-title { color: rgba(146, 64, 14, 0.8); }

        /* Indigo (Pre-reserva) */
        .dt-slot-card-indigo {
          background-color: rgba(238, 242, 255, 0.9);
          border: 1px solid #c7d2fe;
          color: #312e81;
        }
        .dt-slot-card-indigo .dt-slot-status-label { color: #4f46e5; }
        .dt-slot-card-indigo .dt-slot-code-badge {
          background-color: #e0e7ff;
          color: #3730a3;
        }
        .dt-slot-card-indigo .dt-slot-card-title { color: rgba(67, 56, 202, 0.8); }

        /* Rose (Confirmado) */
        .dt-slot-card-rose {
          background-color: rgba(255, 241, 242, 0.9);
          border: 1px solid #fecdd3;
          color: #881337;
        }
        .dt-slot-card-rose .dt-slot-status-label { color: #e11d48; }
        .dt-slot-card-rose .dt-slot-code-badge {
          background-color: rgba(254, 205, 211, 0.7);
          color: #9f1239;
        }
        .dt-slot-card-rose .dt-slot-card-title { color: rgba(159, 18, 57, 0.8); }

        /* Purple (Mantenimiento) */
        .dt-slot-card-purple {
          background-color: rgba(250, 245, 255, 0.9);
          border: 1px solid #e9d5ff;
          color: #581c87;
        }
        .dt-slot-card-purple .dt-slot-status-label { color: #9333ea; }
        .dt-slot-card-purple .dt-slot-code-badge {
          background-color: #f3e8ff;
          color: #6b21a8;
        }
        .dt-slot-card-purple .dt-slot-card-title { color: rgba(107, 33, 168, 0.8); }

        /* ─── BARRA INFERIOR DE ESTADOS Y SINCRONIZACIÓN ─── */
        .dt-status-legend-bar {
          background-color: #ffffff;
          border-top: 1px solid #e2e8f0;
          padding: 10px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #475569;
          flex-shrink: 0;
          user-select: none;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          box-sizing: border-box;
        }

        .dt-sl-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .dt-sl-title {
          font-weight: 700;
          color: #1e293b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .dt-sl-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 500;
          color: #334155;
        }

        .dt-sl-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .dt-sl-right {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #94a3b8;
          font-size: 11px;
        }

        .dt-sl-bold {
          color: #475569;
          font-weight: 600;
        }

        .dt-sl-sep {
          color: #cbd5e1;
        }

        .dt-sl-sync {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #059669;
          font-weight: 500;
        }

        /* ─── MODAL Y TOOLTIPS ─── */
        .dt-floating-tooltip {
          position: fixed;
          background: #0f172a;
          color: #ffffff;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 11.5px;
          z-index: 1000;
          pointer-events: none;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
          max-width: 280px;
          line-height: 1.4;
        }

        .dt-tt-header {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          border-bottom: 1px solid #334155;
          padding-bottom: 4px;
          margin-bottom: 6px;
        }

        .dt-tt-time {
          color: #94a3b8;
        }

        .dt-tt-free-body {
          color: #34d399;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .dt-tt-green-dot {
          color: #10b981;
        }

        .dt-tt-event-title {
          font-weight: 700;
          font-size: 12px;
          color: #f8fafc;
          margin-bottom: 4px;
        }

        .dt-tt-meta-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 10.5px;
          color: #cbd5e1;
        }

        .dt-tt-quote {
          margin-top: 4px;
          font-weight: 700;
          color: #fbbf24;
          font-size: 11px;
        }

        .dt-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
        }

        .dt-modal-dialog {
          background: #ffffff;
          border-radius: 12px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
          overflow: hidden;
          animation: dtModalIn 0.15s ease-out;
        }

        @keyframes dtModalIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }

        .dt-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid #e2e8f0;
        }

        .dt-modal-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .dt-modal-icon-badge {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: #eef2ff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dt-modal-salon-title {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .dt-modal-time-sub {
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
        }

        .dt-modal-close-btn {
          width: 28px !important;
          height: 28px !important;
          border-radius: 6px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: #64748b !important;
          cursor: pointer !important;
          font-size: 14px !important;
        }

        .dt-modal-close-btn:hover {
          background: #f1f5f9 !important;
          color: #0f172a !important;
        }

        .dt-modal-body {
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .dt-modal-free-banner {
          display: flex;
          gap: 10px;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          border-radius: 8px;
          padding: 10px 12px;
          color: #065f46;
          font-size: 11.5px;
        }

        .dt-modal-free-banner p {
          margin: 2px 0 0;
          color: #047857;
        }

        .dt-modal-actions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .dt-btn-full {
          width: 100% !important;
          justify-content: center !important;
          padding: 9px 14px !important;
          font-size: 12px !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          cursor: pointer !important;
          height: 36px !important;
          min-height: 36px !important;
          max-height: 36px !important;
          display: flex !important;
          align-items: center !important;
        }

        .dt-btn-primary {
          background: #4f46e5 !important;
          color: #ffffff !important;
          border: none !important;
        }
        .dt-btn-primary:hover {
          background: #4338ca !important;
        }

        .dt-btn-secondary {
          background: #ffffff !important;
          color: #334155 !important;
          border: 1px solid #cbd5e1 !important;
        }
        .dt-btn-secondary:hover {
          background: #f8fafc !important;
        }

        .dt-modal-event-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .dt-modal-evt-badge-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .dt-cs-evt-status {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid transparent;
        }

        .dt-modal-evt-hours {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
        }

        .dt-modal-evt-name {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .dt-modal-grid-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          font-size: 11px;
        }

        .dt-modal-meta-item {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .dt-m-label {
          font-size: 9.5px;
          color: #94a3b8;
          font-weight: 600;
        }

        .dt-m-val {
          color: #1e293b;
          font-weight: 600;
        }

        .dt-modal-quote-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #eef2ff;
          border: 1px solid #c7d2fe;
          border-radius: 6px;
          padding: 6px 10px;
          color: #4338ca;
          font-size: 11.5px;
          margin-top: 2px;
        }

        .dt-empty-row {
          padding: 40px 16px;
          text-align: center;
          color: #64748b;
          font-size: 13px;
        }

        .dt-empty-row button {
          margin-top: 10px;
          padding: 6px 14px !important;
          background-color: #4f46e5 !important;
          color: #ffffff !important;
          border-radius: 6px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
        }
      `}</style>
    </main>
  );
}
