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
    <div className="dt-root">
      {/* ─── BARRA UNIFICADA ULTRA COMPACTA (SEMANA + FILTROS 2-EN-1 + ACCIONES) ─── */}
      <div className="dt-compact-toolbar">
        {/* 1. TIRA SEMANAL COMPACTA (LUN..DOM) */}
        <div className="dt-mini-week-strip">
          <button
            type="button"
            className="dt-mini-nav-btn"
            onClick={handlePrevWeek}
            title="Semana anterior"
          >
            ‹
          </button>
          
          <div className="dt-mini-days-row">
            {weekDays.map(day => {
              const isSelected = day.isSelected;
              return (
                <button
                  key={day.iso}
                  type="button"
                  className={`dt-mini-day-pill ${isSelected ? 'dt-mini-day-active' : ''} ${day.isToday ? 'dt-mini-day-today' : ''}`}
                  onClick={() => setCurrentDate(new Date(day.date.getTime()))}
                  title={`${day.dayName} ${day.dayNum} (${day.eventCount} eventos)`}
                >
                  <span className={`dt-mday-name ${day.isWeekend ? 'dt-mday-weekend' : ''}`}>{day.dayName}</span>
                  <span className="dt-mday-num">{day.dayNum}</span>
                  {day.isToday && <span className="dt-mday-today-dot" title="Hoy" />}
                  {day.eventCount > 0 && !day.isToday && (
                    <span className="dt-mday-dot" style={{ backgroundColor: day.dotColors[0] }} />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="dt-mini-nav-btn"
            onClick={handleNextWeek}
            title="Semana siguiente"
          >
            ›
          </button>
        </div>

        {/* 2. FILTROS RÁPIDOS 2-EN-1 (KPIS COMPACTOS CON 1 CLIC) */}
        <div className="dt-mini-kpi-filters">
          <button
            type="button"
            className={`dt-kpi-pill ${activeFilter === 'todas' ? 'dt-kpi-pill-active' : ''}`}
            onClick={() => setActiveFilter('todas')}
            title="Ver todos los salones"
          >
            <span className="dt-kp-name">Todos</span>
            <span className="dt-kp-count">{kpiCounts.total}</span>
          </button>

          <button
            type="button"
            className={`dt-kpi-pill dt-kpi-pill-green ${activeFilter === 'libres' ? 'dt-kpi-pill-active' : ''}`}
            onClick={() => setActiveFilter('libres')}
            title="Filtrar salones disponibles todo el día"
          >
            <span className="dt-kp-dot" style={{ background: '#10b981' }} />
            <span className="dt-kp-name">Libres</span>
            <span className="dt-kp-count dt-count-green">{kpiCounts.libres}</span>
          </button>

          <button
            type="button"
            className={`dt-kpi-pill dt-kpi-pill-blue ${activeFilter === 'parcial' ? 'dt-kpi-pill-active' : ''}`}
            onClick={() => setActiveFilter('parcial')}
            title="Filtrar salones con ocupación parcial"
          >
            <span className="dt-kp-dot" style={{ background: '#2563eb' }} />
            <span className="dt-kp-name">Parcial</span>
            <span className="dt-kp-count dt-count-blue">{kpiCounts.parcial}</span>
          </button>

          <button
            type="button"
            className={`dt-kpi-pill dt-kpi-pill-rose ${activeFilter === 'ocupados' ? 'dt-kpi-pill-active' : ''}`}
            onClick={() => setActiveFilter('ocupados')}
            title="Filtrar salones con ocupación"
          >
            <span className="dt-kp-dot" style={{ background: '#e11d48' }} />
            <span className="dt-kp-name">Ocupados</span>
            <span className="dt-kp-count dt-count-rose">{kpiCounts.ocupados}</span>
          </button>

          {kpiCounts.mantenimiento > 0 && (
            <button
              type="button"
              className={`dt-kpi-pill dt-kpi-pill-purple ${activeFilter === 'mantenimiento' ? 'dt-kpi-pill-active' : ''}`}
              onClick={() => setActiveFilter('mantenimiento')}
              title="Filtrar salones en mantenimiento"
            >
              <span className="dt-kp-dot" style={{ background: '#7c3aed' }} />
              <span className="dt-kp-name">Mant.</span>
              <span className="dt-kp-count dt-count-purple">{kpiCounts.mantenimiento}</span>
            </button>
          )}

          <button
            type="button"
            className={`dt-kpi-pill ${activeFilter === 'grandes' ? 'dt-kpi-pill-active' : ''}`}
            onClick={() => setActiveFilter('grandes')}
            title="Filtrar salones de gran capacidad (>150 PAX)"
          >
            <span className="dt-kp-name">&gt;150 PAX</span>
          </button>

          {activeFilter !== 'todas' && (
            <button
              type="button"
              className="dt-kpi-reset-btn"
              onClick={() => setActiveFilter('todas')}
              title="Quitar filtro"
            >
              ✕
            </button>
          )}
        </div>

        {/* 3. SELECTOR COMPACTO DE VISTA (MATRIZ / TARJETAS) */}
        <div className="dt-mini-actions">
          <div className="dt-mini-toggle-group">
            <button
              type="button"
              className={`dt-mini-toggle-btn ${displayMode === 'timeline' ? 'dt-toggle-active' : ''}`}
              onClick={() => setDisplayMode('timeline')}
              title="Vista Matriz de 6 Bloques"
            >
              ⫼ Matriz
            </button>
            <button
              type="button"
              className={`dt-mini-toggle-btn ${displayMode === 'cards' ? 'dt-toggle-active' : ''}`}
              onClick={() => setDisplayMode('cards')}
              title="Vista Tarjetas Detalladas"
            >
              ⊞ Tarjetas
            </button>
          </div>
        </div>
      </div>

      {/* ─── CONTENIDO PRINCIPAL (MAXIMIZANDO ESPACIO PARA SALONES) ─── */}
      {displayMode === 'timeline' ? (
        <div className="dt-matrix-card">
          {salonesWithBlocks.length === 0 ? (
            <div className="dt-empty-state">
              <div className="dt-empty-title">No hay salones bajo este filtro</div>
              <p className="dt-empty-desc">Prueba cambiando la fecha o selecciona "Todos".</p>
              <button
                type="button"
                className="dt-btn-secondary"
                onClick={() => setActiveFilter('todas')}
              >
                Ver todos los salones
              </button>
            </div>
          ) : (
            <div className="dt-table-wrapper">
              <table className="dt-matrix-table">
                <thead>
                  <tr>
                    <th className="dt-th-salon">
                      <div className="dt-th-salon-content">
                        <span>SALÓN / ÁREA ({salonesWithBlocks.length})</span>
                      </div>
                    </th>
                    {TIMELINE_BLOCKS.map(b => {
                      const isActiveTime = currentBlockId === b.id;
                      return (
                        <th
                          key={b.id}
                          className={`dt-th-block ${isActiveTime ? 'dt-th-active-now' : ''}`}
                        >
                          <div className="dt-th-content">
                            <span className="dt-th-block-code">{b.label}</span>
                            <span className="dt-th-block-range">{b.title}</span>
                            {isActiveTime && (
                              <span className="dt-now-badge">▲ ACTUAL</span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {salonesWithBlocks.map(s => {
                    const isAllFree = s.statusType === 'libres';
                    return (
                      <tr key={s.salonName} className="dt-tr-salon">
                        {/* Columna Salón Compacta */}
                        <td className="dt-td-salon">
                          <div className="dt-salon-meta-compact">
                            <div className="dt-salon-title-row">
                              <span className="dt-salon-name" title={s.salonName}>{s.salonName}</span>
                              {s.capacity > 0 && (
                                <span className="dt-salon-cap">Cap. {s.capacity}</span>
                              )}
                            </div>
                            <div className="dt-salon-status-row">
                              <span className={`dt-status-pill-small ${s.badgeClass}`}>
                                {s.badgeText}
                              </span>
                              {isAllFree && (
                                <button
                                  type="button"
                                  className="dt-btn-quick-full"
                                  onClick={() => handleBookSalonFull(s.salonName)}
                                  title="Reservar todo el día en este salón"
                                >
                                  + Todo el día
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 6 Bloques Horarios Compactos */}
                        {s.timelineBlocks.map(block => {
                          const isFree = block.status === 'free';
                          const isOccupied = block.status === 'occupied';

                          return (
                            <td
                              key={block.blockId}
                              className="dt-td-block"
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredBlock({
                                  salonName: s.salonName,
                                  capacity: s.capacity,
                                  blockTitle: block.blockTitle,
                                  status: block.status,
                                  event: block.event,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top
                                });
                              }}
                              onMouseLeave={() => setHoveredBlock(null)}
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
                            >
                              {isFree ? (
                                <div className="dt-cell-free">
                                  <div className="dt-pill-3d dt-pill-free">
                                    <div className="dt-free-inner">
                                      <span className="dt-free-text">✓ Libre</span>
                                      <span className="dt-free-action-btn">+ Reservar</span>
                                    </div>
                                  </div>
                                </div>
                              ) : isOccupied && block.event ? (
                                <div className="dt-cell-occupied">
                                  <div className={`dt-pill-3d dt-pill-${block.pillVariant || 'occupied'}`}>
                                    <div className="dt-occ-inner">
                                      <span className="dt-occ-title" title={block.event.name}>
                                        {block.event.name}
                                      </span>
                                      <div className="dt-occ-sub">
                                        {block.event.pax > 0 && <span>👥 {block.event.pax} Pax</span>}
                                        <span className="dt-occ-time">{block.event.startTime} - {block.event.endTime}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="dt-cell-maint">
                                  <div className="dt-pill-3d dt-pill-maintenance">
                                    <div className="dt-maint-inner">
                                      <span>🔧 Mant.</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Mini cinta inferior de leyenda */}
          <div className="dt-legend-bar-compact">
            <span className="dt-legend-title">Código:</span>
            <div className="dt-legend-item">
              <span className="dt-legend-sample" style={{ background: '#d1fae5', borderTop: '2px solid #10b981' }} />
              <span>Libre</span>
            </div>
            <div className="dt-legend-item">
              <span className="dt-legend-sample" style={{ background: '#ffe4e6', borderTop: '2px solid #e11d48' }} />
              <span>Confirmado</span>
            </div>
            <div className="dt-legend-item">
              <span className="dt-legend-sample" style={{ background: '#fef3c7', borderTop: '2px solid #d97706' }} />
              <span>Cotizado</span>
            </div>
            <div className="dt-legend-item">
              <span className="dt-legend-sample" style={{ background: '#dbeafe', borderTop: '2px solid #2563eb' }} />
              <span>Pre-reserva</span>
            </div>
            <div className="dt-legend-item">
              <span className="dt-legend-sample" style={{ background: '#ede9fe', borderTop: '2px solid #7c3aed' }} />
              <span>Mantenimiento</span>
            </div>
          </div>
        </div>
      ) : (
        /* ─── VISTA ALTERNATIVA: TARJETAS DETALLADAS CRONOLÓGICAS (GRID MULTI-COLUMNA) ─── */
        <div className="dt-cards-container">
          {filteredSalones.map(salon => {
            return (
              <div
                key={salon.salonName}
                className="dt-card-salon"
                style={{ borderTopColor: salon.accentColor }}
              >
                <div className="dt-cs-header">
                  <div>
                    <h3 className="dt-cs-title">{salon.salonName}</h3>
                    <div className="dt-cs-meta-row">
                      {salon.capacity > 0 && <span className="dt-cs-cap">CAP. {salon.capacity} PAX</span>}
                      <span className={`dt-status-pill-small ${salon.badgeClass}`}>{salon.badgeText}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="dt-cs-book-all"
                    onClick={() => handleBookSalonFull(salon.salonName)}
                  >
                    + Todo el día
                  </button>
                </div>

                {/* Timeline visualizador de ocupación */}
                <div className="dt-cs-timeline-bar">
                  <div className="dt-cs-timeline-hours">
                    <span>06:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>24:00</span>
                  </div>
                  <div className="dt-cs-track">
                    {salon.timeline.map((item, idx) => {
                      const startM = timeToMinutes(item.startTime);
                      const endM = timeToMinutes(item.endTime);
                      const leftPercent = Math.max(0, ((startM - 360) / 1080) * 100);
                      const widthPercent = Math.max(1, ((endM - startM) / 1080) * 100);

                      if (item.type === 'free') {
                        return (
                          <div
                            key={idx}
                            className="dt-cs-seg dt-cs-seg-free"
                            style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                            title={`Libre: ${item.startTime} - ${item.endTime} (${item.durationHours}h)`}
                            onClick={() => handleBookFreeSlot(salon.salonName, item.startTime, item.endTime)}
                          />
                        );
                      }

                      return (
                        <div
                          key={idx}
                          className="dt-cs-seg dt-cs-seg-occupied"
                          style={{
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            backgroundColor: item.statusColor || '#ef4444'
                          }}
                          title={`${item.name} (${item.startTime} - ${item.endTime})`}
                          onClick={() => handleOpenEvent(item.id)}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Desglose de bloques libres y eventos */}
                <div className="dt-cs-body-items">
                  {salon.timeline.map((item, idx) => {
                    if (item.type === 'free') {
                      return (
                        <div key={idx} className="dt-cs-slot-free">
                          <div className="dt-cs-slot-info">
                            <span className="dt-cs-slot-badge-free">DISPONIBLE</span>
                            <span className="dt-cs-slot-hours">{item.startTime} - {item.endTime}</span>
                            <span className="dt-cs-slot-dur">({item.durationHours}h)</span>
                          </div>
                          <button
                            type="button"
                            className="dt-cs-slot-btn"
                            onClick={() => handleBookFreeSlot(salon.salonName, item.startTime, item.endTime)}
                          >
                            + Reservar
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="dt-cs-event-card">
                        <div className="dt-cs-evt-top">
                          <span
                            className="dt-cs-evt-status"
                            style={{
                              backgroundColor: `${item.statusColor}18`,
                              color: item.statusColor,
                              borderColor: `${item.statusColor}40`
                            }}
                          >
                            {item.status?.toUpperCase()}
                          </span>
                          <span className="dt-cs-evt-hours">{item.startTime} - {item.endTime}</span>
                        </div>
                        <h4 className="dt-cs-evt-title">{item.name}</h4>
                        <div className="dt-cs-evt-details">
                          {item.pax > 0 && <span>👤 {item.pax} PAX</span>}
                          {item.seller && <span>🏷️ {item.seller}</span>}
                          {item.client && <span>🏢 {item.client}</span>}
                        </div>
                        <div className="dt-cs-evt-footer">
                          {item.quoteTotal > 0 && (
                            <span className="dt-cs-evt-quote">
                              Cot: Q {Number(item.quoteTotal).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                          <button
                            type="button"
                            className="dt-cs-evt-link"
                            onClick={() => handleOpenEvent(item.id)}
                          >
                            Ver reserva →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

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

      {/* ─── ESTILOS CSS DEDICADOS ULTRA COMPACTOS (ALTA DENSIDAD) ─── */}
      <style>{`
        .dt-root {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 6px 14px 14px;
          background: #f8fafc;
          height: 100%;
          min-height: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          box-sizing: border-box;
          flex: 1;
        }

        /* ─── 1. BARRA ULTRA COMPACTA (UNA SOLA LÍNEA DE ~36PX) ─── */
        .dt-compact-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 3px 8px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          gap: 6px;
          flex-shrink: 0;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .dt-compact-toolbar::-webkit-scrollbar {
          display: none;
        }

        /* Mini Tira Semanal */
        .dt-mini-week-strip {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }

        .dt-mini-nav-btn {
          width: 22px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #475569;
          font-size: 14px;
          font-weight: 800;
          border-radius: 4px;
          cursor: pointer;
          line-height: 1;
          padding: 0;
          transition: all 0.1s ease;
        }

        .dt-mini-nav-btn:hover {
          background: #eef2ff;
          color: #4338ca;
          border-color: #c7d2fe;
        }

        .dt-mini-days-row {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .dt-mini-day-pill {
          height: 24px;
          padding: 0 4px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          border-radius: 5px;
          display: flex;
          align-items: center;
          gap: 2px;
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .dt-mini-day-pill:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        .dt-mini-day-pill.dt-mini-day-active {
          background: #4338ca !important;
          border-color: #3730a3 !important;
          color: #ffffff !important;
          box-shadow: 0 1px 3px rgba(67, 56, 202, 0.25);
        }

        .dt-mini-day-pill.dt-mini-day-active .dt-mday-name,
        .dt-mini-day-pill.dt-mini-day-active .dt-mday-num {
          color: #ffffff !important;
        }

        .dt-mini-day-pill.dt-mini-day-today:not(.dt-mini-day-active) {
          border-color: #818cf8;
          background: #f5f3ff;
        }

        .dt-mday-name {
          font-size: 9px;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.02em;
        }

        .dt-mday-weekend {
          color: #f43f5e !important;
        }

        .dt-mday-num {
          font-size: 11px;
          font-weight: 800;
          color: #0f172a;
        }

        .dt-mday-today-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #4338ca;
        }

        .dt-mini-day-active .dt-mday-today-dot {
          background: #38bdf8;
        }

        .dt-mday-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
        }

        /* KPIs / Filtros 2-en-1 */
        .dt-mini-kpi-filters {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }

        .dt-kpi-pill {
          height: 24px;
          padding: 0 5px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          border-radius: 5px;
          display: flex;
          align-items: center;
          gap: 3px;
          cursor: pointer;
          font-size: 10.5px;
          color: #475569;
          font-weight: 600;
          transition: all 0.12s ease;
        }

        .dt-kpi-pill:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .dt-kpi-pill.dt-kpi-pill-active {
          background: #0f172a !important;
          color: #ffffff !important;
          border-color: #0f172a !important;
        }

        .dt-kpi-pill.dt-kpi-pill-active .dt-kp-count {
          background: rgba(255, 255, 255, 0.2) !important;
          color: #ffffff !important;
        }

        .dt-kp-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .dt-kp-name {
          line-height: 1;
        }

        .dt-kp-count {
          font-size: 11px;
          font-weight: 800;
          padding: 1px 4px;
          border-radius: 4px;
          background: #f1f5f9;
          color: #334155;
          line-height: 1;
        }

        .dt-count-green {
          color: #059669;
          background: #ecfdf5;
        }

        .dt-count-blue {
          color: #2563eb;
          background: #eff6ff;
        }

        .dt-count-rose {
          color: #e11d48;
          background: #fff1f2;
        }

        .dt-count-purple {
          color: #7c3aed;
          background: #f5f3ff;
        }

        .dt-kpi-reset-btn {
          border: none;
          background: #fee2e2;
          color: #ef4444;
          font-size: 11px;
          font-weight: 800;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        /* Acciones compactas a la derecha */
        .dt-mini-actions {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
          margin-left: auto;
        }

        .dt-mini-toggle-group {
          display: flex;
          background: #f1f5f9;
          border-radius: 5px;
          padding: 2px;
          gap: 2px;
        }

        .dt-mini-toggle-btn {
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 10.5px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.12s ease;
          line-height: 1.2;
        }

        .dt-mini-toggle-btn.dt-toggle-active {
          background: #ffffff;
          color: #4338ca;
          font-weight: 800;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
        }

        .dt-mini-btn-new {
          border: none;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 5px;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(79, 70, 229, 0.25);
          transition: all 0.12s ease;
          white-space: nowrap;
        }

        .dt-mini-btn-new:hover {
          filter: brightness(1.08);
        }

        /* ─── MATRIZ TIMELINE: MAXIMIZADA PARA ESPACIO ÚTIL ─── */
        .dt-matrix-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .dt-table-wrapper {
          flex: 1;
          overflow-y: auto;
          overflow-x: auto;
          min-height: 0;
        }

        .dt-matrix-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          min-width: 860px;
        }

        .dt-matrix-table th {
          background: #f8fafc;
          border-bottom: 1.5px solid #e2e8f0;
          padding: 6px 8px;
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          position: sticky;
          top: 0;
          z-index: 10;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .dt-th-salon {
          width: 200px;
          text-align: left !important;
          padding-left: 12px !important;
          color: #334155 !important;
          font-weight: 800 !important;
        }

        .dt-th-salon-content {
          font-size: 11px;
          letter-spacing: 0.02em;
        }

        .dt-th-block {
          width: calc((100% - 200px) / 6);
        }

        .dt-th-active-now {
          background: #eef2ff !important;
          color: #4338ca !important;
          border-bottom-color: #6366f1 !important;
        }

        .dt-th-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .dt-th-block-code {
          font-size: 12px;
          font-weight: 800;
        }

        .dt-th-block-range {
          font-size: 9.5px;
          font-weight: 500;
          opacity: 0.85;
        }

        .dt-now-badge {
          font-size: 7.5px;
          font-weight: 800;
          color: #4338ca;
          background: #e0e7ff;
          padding: 0 3px;
          border-radius: 3px;
        }

        .dt-tr-salon {
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.08s ease;
        }

        .dt-tr-salon:hover {
          background: #fbfcfe;
        }

        .dt-td-salon {
          padding: 5px 10px 5px 12px;
          border-right: 1px solid #f1f5f9;
          background: #ffffff;
        }

        .dt-salon-meta-compact {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .dt-salon-title-row {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .dt-salon-name {
          font-size: 12.5px;
          font-weight: 800;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dt-salon-cap {
          font-size: 9px;
          font-weight: 700;
          background: #f1f5f9;
          color: #64748b;
          padding: 0 4px;
          border-radius: 3px;
          flex-shrink: 0;
        }

        .dt-salon-status-row {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .dt-status-pill-small {
          font-size: 9px;
          font-weight: 700;
          padding: 0 5px;
          border-radius: 3px;
        }

        .dt-badge-available {
          background: #ecfdf5;
          color: #059669;
        }

        .dt-badge-partial {
          background: #eff6ff;
          color: #2563eb;
        }

        .dt-badge-occupied {
          background: #fff1f2;
          color: #e11d48;
        }

        .dt-badge-maintenance {
          background: #f5f3ff;
          color: #7c3aed;
        }

        .dt-btn-quick-full {
          border: none;
          background: #d1fae5;
          color: #047857;
          font-size: 8.5px;
          font-weight: 700;
          padding: 0 4px;
          border-radius: 3px;
          cursor: pointer;
        }

        .dt-btn-quick-full:hover {
          background: #a7f3d0;
        }

        /* Celdas de Bloques Horarios (Compactas: 34px) */
        .dt-td-block {
          padding: 3px 4px;
          border-right: 1px solid #f8fafc;
          vertical-align: middle;
          cursor: pointer;
        }

        .dt-pill-3d {
          width: 100%;
          height: 32px;
          border-radius: 6px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 1px 2px rgba(15, 23, 42, 0.05);
          border-bottom: 1.5px solid rgba(0, 0, 0, 0.12);
          border-left: 1px solid rgba(0, 0, 0, 0.05);
          border-right: 1px solid rgba(0, 0, 0, 0.05);
          display: flex;
          align-items: center;
          padding: 2px 6px;
          box-sizing: border-box;
          transition: transform 0.08s ease, filter 0.08s ease;
        }

        .dt-pill-3d:hover {
          transform: translateY(-1px);
          filter: brightness(1.02);
        }

        /* Píldora Libre */
        .dt-pill-free {
          background: #d1fae5;
          border-top: 2.5px solid #10b981;
          color: #065f46;
        }

        .dt-free-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          gap: 6px;
        }

        .dt-free-text {
          font-size: 11px;
          font-weight: 700;
          color: #059669;
        }

        .dt-free-action-btn {
          font-size: 9px;
          font-weight: 700;
          color: #047857;
          opacity: 0.8;
        }

        /* Píldora Ocupada (Confirmada) */
        .dt-pill-occupied {
          background: #ffe4e6;
          border-top: 2.5px solid #e11d48;
          color: #881337;
        }

        /* Píldora Ocupada (Cotizada / Ámbar) */
        .dt-pill-occupied-amber {
          background: #fef3c7;
          border-top: 2.5px solid #d97706;
          color: #78350f;
        }

        /* Píldora Ocupada (Pre-reserva / Azul) */
        .dt-pill-occupied-blue {
          background: #dbeafe;
          border-top: 2.5px solid #2563eb;
          color: #1e3a8a;
        }

        .dt-pill-occupied-slate {
          background: #f1f5f9;
          border-top: 2.5px solid #64748b;
          color: #1e293b;
        }

        .dt-occ-inner {
          display: flex;
          flex-direction: column;
          width: 100%;
          gap: 0;
        }

        .dt-occ-title {
          font-size: 10.5px;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.15;
        }

        .dt-occ-sub {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 8.5px;
          font-weight: 600;
          opacity: 0.9;
          line-height: 1;
        }

        .dt-occ-time {
          font-size: 8.5px;
          font-weight: 500;
        }

        /* Píldora Mantenimiento */
        .dt-pill-maintenance {
          background: #ede9fe;
          border-top: 2.5px solid #7c3aed;
          color: #4c1d95;
        }

        .dt-maint-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          font-size: 10.5px;
          font-weight: 700;
        }

        /* Leyenda Compacta al pie de la tabla */
        .dt-legend-bar-compact {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 4px 14px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          flex-wrap: wrap;
          flex-shrink: 0;
        }

        .dt-legend-title {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
        }

        .dt-legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 600;
          color: #475569;
        }

        .dt-legend-sample {
          width: 12px;
          height: 8px;
          border-radius: 2px;
        }

        /* ─── VISTA DE TARJETAS DETALLADAS (GRID) ─── */
        .dt-cards-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
          gap: 10px;
          overflow-y: auto;
          flex: 1;
        }

        .dt-card-salon {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-top: 3px solid #3b82f6;
          border-radius: 10px;
          padding: 10px 12px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .dt-cs-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .dt-cs-title {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .dt-cs-meta-row {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 2px;
        }

        .dt-cs-cap {
          font-size: 9.5px;
          font-weight: 700;
          color: #64748b;
          background: #f1f5f9;
          padding: 1px 4px;
          border-radius: 3px;
        }

        .dt-cs-book-all {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          font-size: 10.5px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 5px;
          cursor: pointer;
        }

        .dt-cs-book-all:hover {
          background: #f1f5f9;
        }

        .dt-cs-timeline-bar {
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 6px;
          padding: 4px 8px;
        }

        .dt-cs-timeline-hours {
          display: flex;
          justify-content: space-between;
          font-size: 8.5px;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 2px;
        }

        .dt-cs-track {
          height: 10px;
          background: #e2e8f0;
          border-radius: 5px;
          position: relative;
          overflow: hidden;
        }

        .dt-cs-seg {
          position: absolute;
          top: 0;
          bottom: 0;
          cursor: pointer;
        }

        .dt-cs-seg-free {
          background: #10b981;
        }

        .dt-cs-body-items {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .dt-cs-slot-free {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #ecfdf5;
          border: 1px dashed #6ee7b7;
          border-radius: 6px;
          padding: 6px 10px;
        }

        .dt-cs-slot-info {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .dt-cs-slot-badge-free {
          font-size: 8.5px;
          font-weight: 800;
          color: #059669;
          background: #d1fae5;
          padding: 1px 5px;
          border-radius: 3px;
        }

        .dt-cs-slot-hours {
          font-size: 11.5px;
          font-weight: 700;
          color: #065f46;
        }

        .dt-cs-slot-dur {
          font-size: 10.5px;
          color: #047857;
        }

        .dt-cs-slot-btn {
          background: #059669;
          color: #ffffff;
          border: none;
          padding: 3px 8px;
          border-radius: 5px;
          font-size: 10.5px;
          font-weight: 700;
          cursor: pointer;
        }

        .dt-cs-event-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .dt-cs-evt-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .dt-cs-evt-status {
          font-size: 9px;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 3px;
        }

        .dt-cs-evt-hours {
          font-size: 10.5px;
          font-weight: 700;
          color: #475569;
        }

        .dt-cs-evt-title {
          font-size: 12px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .dt-cs-evt-details {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10.5px;
          color: #64748b;
        }

        .dt-cs-evt-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 2px;
          padding-top: 2px;
          border-top: 1px solid #f1f5f9;
        }

        .dt-cs-evt-quote {
          font-size: 10.5px;
          font-weight: 700;
          color: #4338ca;
        }

        .dt-cs-evt-link {
          border: none;
          background: transparent;
          color: #4f46e5;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        /* Tooltip Flotante */
        .dt-floating-tooltip {
          position: fixed;
          background: #1e293b;
          color: #ffffff;
          padding: 8px 12px;
          border-radius: 7px;
          font-size: 11.5px;
          z-index: 99999;
          pointer-events: none;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
          max-width: 300px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .dt-tt-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
          padding-bottom: 3px;
        }

        .dt-tt-time {
          color: #94a3b8;
          font-size: 10.5px;
        }

        .dt-tt-free-body {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #6ee7b7;
          font-size: 11px;
          font-weight: 600;
        }

        .dt-tt-green-dot {
          color: #10b981;
        }

        .dt-tt-event-title {
          font-size: 12px;
          font-weight: 800;
          color: #f8fafc;
        }

        .dt-tt-meta-row {
          display: flex;
          justify-content: space-between;
          font-size: 10.5px;
          color: #cbd5e1;
        }

        .dt-tt-quote {
          margin-top: 3px;
          padding-top: 3px;
          border-top: 1px dashed rgba(255, 255, 255, 0.2);
          color: #a5b4fc;
          font-weight: 700;
          font-size: 11px;
        }

        /* Diálogo Modal */
        .dt-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          z-index: 50000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .dt-modal-dialog {
          background: #ffffff;
          border-radius: 14px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 16px 36px -8px rgba(15, 23, 42, 0.2);
          overflow: hidden;
          animation: dtModalIn 0.12s ease-out;
        }

        @keyframes dtModalIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }

        .dt-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .dt-modal-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .dt-modal-icon-badge {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #eef2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
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
        }

        .dt-modal-close-btn {
          border: none;
          background: transparent;
          color: #94a3b8;
          font-size: 15px;
          cursor: pointer;
          padding: 4px;
        }

        .dt-modal-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .dt-modal-free-banner {
          display: flex;
          align-items: flex-start;
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
          gap: 6px;
        }

        .dt-btn-full {
          width: 100%;
          justify-content: center;
          padding: 8px 12px;
          font-size: 12px;
          border-radius: 6px;
          font-weight: 700;
          cursor: pointer;
        }

        .dt-btn-primary {
          background: #4338ca;
          color: #fff;
          border: none;
        }

        .dt-btn-secondary {
          background: #fff;
          color: #334155;
          border: 1px solid #cbd5e1;
        }

        .dt-modal-event-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .dt-modal-evt-badge-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
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
          margin-top: 2px;
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

        .dt-empty-state {
          padding: 40px 16px;
          text-align: center;
        }

        .dt-empty-title {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
        }

        .dt-empty-desc {
          font-size: 12px;
          color: #64748b;
          margin: 4px 0 10px;
        }
      `}</style>
    </div>
  );
}
