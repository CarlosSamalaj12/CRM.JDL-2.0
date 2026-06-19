import { useMemo, useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate, useLocation } from 'react-router-dom';
import { STATUS_META } from './constants';
import ReservationForm from './components/ReservationForm';
import { toast } from '../../utils/toast';
import '../../styles/tooltips.css';

const HOUR_HEIGHT = 56;
const HOUR_START = 6;
const HOUR_END = 24;

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Sunday starts the week
  return new Date(d.setDate(diff));
}

function formatHour(hour) {
  if (hour === 24) return '00:00';
  return `${String(hour).padStart(2, '0')}:00`;
}

function timeToY(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return ((h - HOUR_START) * 60 + m) / 60 * HOUR_HEIGHT;
}

function formatTime(hour) {
  return `${String(Math.min(hour, 24)).padStart(2, '0')}:00`;
}

function computeEventLayouts(dayEvents) {
  if (!dayEvents || dayEvents.length === 0) return {};
  
  // 1. Ordenar por hora de inicio, luego hora de fin
  const sorted = [...dayEvents].sort((a, b) => {
    const startDiff = (a.startTime || '').localeCompare(b.startTime || '');
    if (startDiff !== 0) return startDiff;
    return (a.endTime || '').localeCompare(b.endTime || '');
  });

  // 2. Agrupar en clusters de eventos que se traslapan en cualquier punto
  const clusters = [];
  for (const event of sorted) {
    let placed = false;
    for (const cluster of clusters) {
      const overlapsAny = cluster.some(e => {
        const aStart = e.startTime || '00:00';
        const aEnd = e.endTime || '23:59';
        const bStart = event.startTime || '00:00';
        const bEnd = event.endTime || '23:59';
        return aStart < bEnd && aEnd > bStart;
      });
      if (overlapsAny) {
        cluster.push(event);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push([event]);
    }
  }

  // 3. Asignar carriles (lanes) dentro de cada cluster
  const layouts = {};
  for (const cluster of clusters) {
    const lanes = []; // Almacena el endTime del último evento de cada carril
    for (const event of cluster) {
      let laneIndex = 0;
      let foundLane = false;
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] <= (event.startTime || '00:00')) {
          laneIndex = i;
          lanes[i] = event.endTime || '23:59';
          foundLane = true;
          break;
        }
      }
      if (!foundLane) {
        laneIndex = lanes.length;
        lanes.push(event.endTime || '23:59');
      }
      layouts[event.id] = { lane: laneIndex, totalLanes: 0 };
    }
    
    // Asignar el total de carriles del cluster a cada evento del cluster
    for (const event of cluster) {
      layouts[event.id].totalLanes = lanes.length;
    }
  }

  return layouts;
}

function getEventTooltip(ev) {
  if (!ev) return '';
  const lines = [
    `Reserva: ${ev.name || ''}`,
    `Estado: ${ev.status || ''}`,
    `Horario: ${ev.startTime || ''} - ${ev.endTime || ''}`,
    `Salón: ${ev.salon || 'Sin salón'}`,
    ev.pax ? `PAX: ${ev.pax}` : null,
    ev.clientName ? `Cliente: ${ev.clientName}` : null,
    ev.clientPhone ? `Teléfono: ${ev.clientPhone}` : null,
    ev.notes ? `Notas: ${ev.notes}` : null
  ].filter(Boolean);
  return lines.join('\n');
}

function getEventSeriesBadge(ev, allEvents = []) {
  const groupId = String(ev?.groupId || '').trim();
  if (!groupId) return '';

  const series = (allEvents || [])
    .filter(item => String(item?.groupId || '').trim() === groupId)
    .sort((a, b) => {
      const byDate = String(a?.date || '').localeCompare(String(b?.date || ''));
      if (byDate !== 0) return byDate;
      const byStart = String(a?.startTime || '').localeCompare(String(b?.startTime || ''));
      if (byStart !== 0) return byStart;
      const bySalon = String(a?.salon || '').localeCompare(String(b?.salon || ''));
      if (bySalon !== 0) return bySalon;
      return String(a?.id || '').localeCompare(String(b?.id || ''));
    });

  if (series.length <= 1) return '';
  const index = series.findIndex(item => String(item?.id || '') === String(ev?.id || ''));
  if (index < 0) return '';
  return `Reserva ${index + 1}/${series.length}`;
}

function getStatusAbbreviation(status) {
  switch (status) {
    case 'Reserva sin Cotizacion': return 'RSC';
    case '1er Cotizacion': return '1C';
    case 'Perdido': return 'P';
    case 'Seguimiento': return 'S';
    case 'Lista de Espera': return 'LE';
    case 'Pre reserva': return 'PR';
    case 'Confirmado': return 'C';
    case 'Cancelado': return 'CAN';
    case 'Mantenimiento': return 'MNT';
    case 'Mantenimiento Realizado': return 'MR';
    default: return '';
  }
}

function SeriesBadge({ label, color = '#2563eb', compact = false }) {
  if (!label) return null;
  return (
    <span style={{
      alignSelf: 'flex-start',
      padding: compact ? '2px 6px' : '3px 8px',
      borderRadius: '999px',
      fontSize: compact ? '8px' : '10px',
      fontWeight: '800',
      color,
      background: `${color}12`,
      border: `1px solid ${color}35`,
      whiteSpace: 'nowrap'
    }}>
      {label}
    </span>
  );
}

export default function Calendar() {
  const { 
    viewMode, 
    setViewMode,
    currentDate, 
    setCurrentDate, 
    events, 
    users,
    statusFilter,
    searchQuery,
    roomFilter
  } = useOutletContext();
  
  const navigate = useNavigate();
  const location = useLocation();

  const todayRef = useRef(null);

  useEffect(() => {
    if (viewMode === 'week' && todayRef.current) {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }, 100);
    }
  }, [viewMode, currentDate]);

  const [selectionActive, setSelectionActive] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionCurrent, setSelectionCurrent] = useState(null);

  useEffect(() => {
    if (!selectionActive) return;

    const handleGlobalMouseUp = () => {
      if (selectionActive && selectionStart && selectionCurrent) {
        const minDate = selectionStart.dateStr <= selectionCurrent.dateStr ? selectionStart.dateStr : selectionCurrent.dateStr;
        const maxDate = selectionStart.dateStr <= selectionCurrent.dateStr ? selectionCurrent.dateStr : selectionStart.dateStr;
        const minHour = Math.min(selectionStart.hour, selectionCurrent.hour);
        const maxHour = Math.max(selectionStart.hour, selectionCurrent.hour);
        
        const isSingleCell = minDate === maxDate && minHour === maxHour;
        
        // Solo abrimos si hay más de una celda seleccionada (arrastre)
        if (!isSingleCell) {
          navigate(`/nueva-reserva?date=${minDate}&endDate=${maxDate}&start=${formatTime(minHour)}&end=${formatTime(maxHour + 1)}`);
        }
      }
      setSelectionActive(false);
      setSelectionStart(null);
      setSelectionCurrent(null);
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [selectionActive, selectionStart, selectionCurrent, navigate]);

  const weekStart = useMemo(() => currentDate, [currentDate]);

  const todayStr = formatDate(new Date());

  const filteredEvents = useMemo(() => {
    let result = events || [];

    if (statusFilter !== 'all') {
      result = result.filter(ev => ev.status === statusFilter);
    }

    if (roomFilter && roomFilter !== 'all') {
      result = result.filter(ev => ev.salon?.toLowerCase().includes(roomFilter.toLowerCase()));
    }

    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      result = result.filter(ev => 
        ev.name?.toLowerCase().includes(term) ||
        ev.clientName?.toLowerCase().includes(term) ||
        ev.clientPhone?.toLowerCase().includes(term) ||
        ev.salon?.toLowerCase().includes(term) ||
        ev.notes?.toLowerCase().includes(term) ||
        ev.id?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [events, statusFilter, roomFilter, searchQuery]);

  const getEventsForDay = (dateStr) => {
    return filteredEvents.filter(ev => {
      if (ev.groupId || ev.eventDateStart || ev.eventDateEnd) {
        return ev.date === dateStr;
      }
      const start = ev.date;
      const end = ev.endDate || ev.date;
      return dateStr >= start && dateStr <= end;
    });
  };

  const hourSlots = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  const handleDayClick = (dateStr) => {
    if (dateStr < todayStr) {
      toast('No se pueden programar eventos en fechas anteriores a hoy.');
      return;
    }
    navigate(`/nueva-reserva?date=${dateStr}&start=10:00&end=12:00`);
  };

  const handleEventClick = (eventId) => {
    navigate(`/reserva/${eventId}`);
  };



  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const renderWeekView = () => {
    return (
      <div className="cal-week-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
        {/* Contenedor Desplazable que contiene tanto cabecera como cuerpo */}
        <div className="cal-week-scroll-container" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          
          {/* Cabecera Pinned */}
          <div className="cal-week-header" style={{ 
            display: 'flex', 
            background: '#ffffff', 
            borderBottom: '2px solid #cbd5e1', 
            position: 'sticky',
            top: 0,
            zIndex: 20,
            flexShrink: 0
          }}>
            {/* Espaciador de horas con etiqueta "HORA" */}
            <div className="cal-week-hour-column" style={{ 
              width: '70px', 
              flexShrink: 0, 
              borderRight: '1px solid #e2e8f0',
              borderBottom: '2px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: '800',
              color: '#94a3b8',
              background: '#f8fafc',
              position: 'sticky',
              left: 0,
              zIndex: 21
            }}>
              HORA
            </div>
            
            {/* Encabezados de días */}
            <div className="cal-week-header-days" style={{ flex: 1, display: 'flex' }}>
            {weekDates.map((day, idx) => {
              const dateStr = formatDate(day);
              const isToday = dateStr === todayStr;
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              
              return (
                <div key={idx} ref={isToday ? todayRef : null} className="cal-week-header-day" style={{ 
                  flex: 1, 
                  minWidth: '220px',
                  height: '68px',
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  borderLeft: idx > 0 ? '1px solid #e2e8f0' : 'none',
                  borderBottom: '2px solid #cbd5e1',
                  background: isToday ? '#f0f7ff' : '#ffffff',
                  transition: 'background 0.2s'
                }}>
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: '800', 
                    color: isToday ? '#2563eb' : isWeekend ? '#e11d48' : '#64748b', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {day.toLocaleDateString('es-ES', { weekday: 'short' })}
                  </div>
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: isToday ? '#2563eb' : 'transparent',
                    color: isToday ? 'white' : isWeekend ? '#e11d48' : '#0f172a',
                    fontSize: '15px', 
                    fontWeight: '800',
                    marginTop: '2px'
                  }}>
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cuerpo */}
        <div className="cal-week-body" style={{ display: 'flex', position: 'relative' }}>
          {/* Columna de etiquetas de horas */}
          <div className="cal-week-hour-column" style={{ 
            width: '70px', 
            flexShrink: 0, 
            background: '#f8fafc', 
            borderRight: '1px solid #e2e8f0',
            position: 'sticky',
            left: 0,
            zIndex: 10
          }}>
            {hourSlots.map(hour => (
              <div key={hour} style={{ 
                height: HOUR_HEIGHT, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                borderBottom: '1px solid #dbe4f0'
              }}>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#7c8ea5', lineHeight: 1 }}>
                  {formatHour(hour)}
                </span>
              </div>
            ))}
            <div style={{ 
              height: HOUR_HEIGHT, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderBottom: '1px solid #dbe4f0',
              background: '#f8fafc'
            }}>
              <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#7c8ea5', lineHeight: 1 }}>
                {formatHour(HOUR_END)}
              </span>
            </div>
          </div>

          {/* Cuadrícula de columnas de días */}
          <div className="cal-week-body-days" style={{ flex: 1, display: 'flex', minWidth: 0 }}>
            {weekDates.map((day, idx) => {
              const dateStr = formatDate(day);
              const dayEvents = getEventsForDay(dateStr);
              const layouts = computeEventLayouts(dayEvents);
              
              return (
                <div key={idx} className="cal-week-body-day" style={{ 
                  flex: 1, 
                  minWidth: '220px',
                  borderLeft: idx > 0 ? '1px solid #e2e8f0' : 'none', 
                  position: 'relative',
                  zIndex: 1,
                  background: 'white'
                }}>
                  {/* Líneas horizontales de horas */}
                  {hourSlots.map(hour => {
                    const isSelected = selectionActive && selectionStart && selectionCurrent && (() => {
                      const minDate = selectionStart.dateStr <= selectionCurrent.dateStr ? selectionStart.dateStr : selectionCurrent.dateStr;
                      const maxDate = selectionStart.dateStr <= selectionCurrent.dateStr ? selectionCurrent.dateStr : selectionStart.dateStr;
                      const minHour = Math.min(selectionStart.hour, selectionCurrent.hour);
                      const maxHour = Math.max(selectionStart.hour, selectionCurrent.hour);
                      return dateStr >= minDate && dateStr <= maxDate && hour >= minHour && hour <= maxHour;
                    })();

                    const minDate = selectionStart?.dateStr <= selectionCurrent?.dateStr ? selectionStart?.dateStr : selectionCurrent?.dateStr;
                    const maxDate = selectionStart?.dateStr <= selectionCurrent?.dateStr ? selectionCurrent?.dateStr : selectionStart?.dateStr;

                    const isLeftMost = dateStr === minDate;
                    const isRightMost = dateStr === maxDate;
                    const isTopCell = isSelected && hour === Math.min(selectionStart.hour, selectionCurrent.hour);
                    const isBottomCell = isSelected && hour === Math.max(selectionStart.hour, selectionCurrent.hour);

                    return (
                      <div 
                        key={hour} 
                        style={{ 
                          height: HOUR_HEIGHT, 
                          boxSizing: 'border-box',
                          userSelect: 'none',
                          cursor: 'cell',
                          background: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                          borderLeft: isSelected && isLeftMost ? '1.5px solid #2563eb' : 'none',
                          borderRight: isSelected && isRightMost ? '1.5px solid #2563eb' : 'none',
                          borderTop: isSelected && isTopCell ? '1.5px solid #2563eb' : 'none',
                          borderBottom: isSelected && isBottomCell ? '1.5px solid #2563eb' : '1px solid #dbe4f0',
                          boxShadow: isSelected ? 'inset 0 0 0 1px rgba(37,99,235,0.08)' : 'none',
                        }}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return; // solo click izquierdo
                          if (dateStr < todayStr) {
                            toast('No se pueden programar eventos en fechas anteriores a hoy.');
                            return;
                          }
                          setSelectionStart({ dateStr, hour });
                          setSelectionCurrent({ dateStr, hour });
                          setSelectionActive(true);
                        }}
                        onDoubleClick={(e) => {
                          if (e.button !== 0) return;
                          if (dateStr < todayStr) {
                            toast('No se pueden programar eventos en fechas anteriores a hoy.');
                            return;
                          }
                          navigate(`/nueva-reserva?date=${dateStr}&endDate=${dateStr}&start=${formatTime(hour)}&end=${formatTime(hour + 1)}`);
                        }}
                        onMouseEnter={() => {
                          if (selectionActive) {
                            if (dateStr < todayStr) return; // No permitir arrastrar a fechas pasadas
                            setSelectionCurrent({ dateStr, hour });
                          }
                        }}
                      />
                    );
                  })}
                  <div style={{
                    height: HOUR_HEIGHT,
                    boxSizing: 'border-box',
                    borderBottom: '1px solid #dbe4f0',
                    background: 'transparent'
                  }} />
                  
                  {/* Eventos */}
                  {dayEvents.map((ev) => {
                    const top = timeToY(ev.startTime);
                    const height = Math.max(42, timeToY(ev.endTime) - top);
                    const color = STATUS_META[ev.status]?.color || '#64748b';
                    const seriesBadge = getEventSeriesBadge(ev, events);
                    
                    const isMaint = ev.status === 'Mantenimiento' || ev.status === 'Mantenimiento Realizado';
                    const normalBg = isMaint
                      ? `repeating-linear-gradient(45deg, ${color}12, ${color}12 8px, ${color}20 8px, ${color}20 16px) #ffffff`
                      : `linear-gradient(0deg, ${color}12, ${color}12) #ffffff`;
                    const hoverBg = isMaint
                      ? `repeating-linear-gradient(45deg, ${color}20, ${color}20 8px, ${color}30 8px, ${color}30 16px) #ffffff`
                      : `linear-gradient(0deg, ${color}25, ${color}25) #ffffff`;

                    const layout = layouts[ev.id] || { lane: 0, totalLanes: 1 };
                    const lane = layout.lane;
                    const totalLanes = layout.totalLanes;
                    
                    const leftPct = (lane * 100) / totalLanes;
                    const widthPct = 100 / totalLanes;
                    
                    const seller = users?.find(u => String(u.id) === String(ev.userId));
                    const sellerName = seller?.fullName || seller?.name || 'Sistemas Admin';
                    const showFullDetails = height >= 140;
                    const isCompactHeight = height <= 72;

                    const formatMoneyGT = (val) => {
                      return 'Cot Q ' + Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    };

                    return (
                      <div
                        key={ev.id}
                        data-tooltip={getEventTooltip(ev)}
                        className="cal-tooltip"
                        onClick={(e) => { e.stopPropagation(); handleEventClick(ev.id); }}
                        style={{
                          position: 'absolute',
                          top: `${top}px`,
                          left: `calc(${leftPct}% + 4px)`,
                          width: `calc(${widthPct}% - 8px)`,
                          height: `${height - 2}px`,
                          background: normalBg,
                          borderLeft: `4px solid ${color}`,
                          borderRadius: '10px',
                          padding: '7px 9px',
                          cursor: 'pointer',
                          zIndex: 1 + lane,
                          boxShadow: '0 3px 10px rgba(15, 23, 42, 0.08)',
                          transition: 'background 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = hoverBg;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = normalBg;
                        }}
                      >
                        {showFullDetails ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', height: '100%' }}>
                            {/* Header row: Status and Badge */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                                <span style={{ fontSize: '10px', fontWeight: '800', color: '#334155', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{ev.status}</span>
                              </div>
                              <span style={{
                                width: '28px',
                                height: '16px',
                                borderRadius: '4px',
                                backgroundColor: '#cbd5e1',
                                color: '#1e293b',
                                fontSize: '10px',
                                fontWeight: '900',
                                display: 'flex',
                                alignItems: 'center',
                                justifySelf: 'flex-end',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {getStatusAbbreviation(ev.status)}
                              </span>
                            </div>

                            {/* Event Title */}
                            <div style={{ 
                              fontSize: '13px', 
                              fontWeight: '800', 
                              color: '#0f172a', 
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: '1.2'
                            }}>
                              {ev.status === 'Mantenimiento' ? 'Mantenimiento: ' : ev.status === 'Mantenimiento Realizado' ? 'Mantenimiento realizado: ' : ''}{ev.name}
                            </div>

                            {/* Horario */}
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                              <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Horario</span>
                              <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>{ev.startTime} - {ev.endTime}</span>
                            </div>

                            {/* Salon */}
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                              <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Salón</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.salon}</span>
                            </div>

                            {/* Vendedor */}
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                              <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Vendedor</span>
                              <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sellerName}</span>
                            </div>

                            {/* PAX */}
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                              <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>PAX</span>
                              <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>{ev.pax || ev.quote?.people || 0}</span>
                            </div>

                            {/* Cotizacion */}
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                              <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Cot.</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: '#334155' }}>{formatMoneyGT(ev.quote?.total || 0)}</span>
                            </div>

                            {seriesBadge && <div style={{ marginTop: 'auto' }}><SeriesBadge label={seriesBadge} color={color} compact /></div>}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: isCompactHeight ? '2px' : '2px', height: '100%' }}>
                            {isCompactHeight && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }} />
                                  <span style={{ fontSize: '9px', fontWeight: '800', color: '#334155', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {ev.status}
                                  </span>
                                </div>
                                <span style={{
                                  width: '22px',
                                  height: '14px',
                                  borderRadius: '4px',
                                  backgroundColor: '#cbd5e1',
                                  color: '#1e293b',
                                  fontSize: '9px',
                                  fontWeight: '900',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {getStatusAbbreviation(ev.status)}
                                </span>
                              </div>
                            )}
                            <div style={{ 
                              fontSize: isCompactHeight ? '11px' : '12px',
                              fontWeight: '800', 
                              color: '#0f172a', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: isCompactHeight ? '1.15' : '1.15',
                              minHeight: isCompactHeight ? '14px' : '14px'
                            }}>
                              {ev.status === 'Mantenimiento' ? 'Mantenimiento: ' : ev.status === 'Mantenimiento Realizado' ? 'Mantenimiento realizado: ' : ''}{ev.name}
                            </div>
                            <div style={{ fontSize: isCompactHeight ? '9.5px' : '10.5px', fontWeight: isCompactHeight ? '600' : '600', color: '#475569', whiteSpace: 'nowrap' }}>
                              Horario: {ev.startTime} - {ev.endTime}
                            </div>
                            {!isCompactHeight && (
                              <div style={{ fontSize: '10.5px', fontWeight: '700', color: color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Salón: {ev.salon}
                              </div>
                            )}
                            {!isCompactHeight && seriesBadge && <SeriesBadge label={seriesBadge} color={color} compact />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

  const renderMonthView = () => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const startOffset = firstDayOfMonth;
    
    const monthDays = [];
    for (let i = 0; i < startOffset; i++) {
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - (startOffset - i));
      monthDays.push({ date: prevDate, isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
      monthDays.push({ date, isCurrentMonth: true });
    }
    while (monthDays.length < 42) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + (42 - monthDays.length));
      monthDays.push({ date: nextDate, isCurrentMonth: false });
    }

    return (
      <div className="cal-month-view" style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '16px' }}>
          {['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '12.5px', fontWeight: '800', color: '#64748b', padding: '8px' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {monthDays.map((item, idx) => {
            const dateStr = formatDate(item.date);
            const isToday = dateStr === todayStr;
            const dayEvents = getEventsForDay(dateStr);
            
            return (
              <div
                key={idx}
                className="cal-month-cell"
                onDoubleClick={() => handleDayClick(dateStr)}
                style={{
                  minHeight: '100px',
                  padding: '8px',
                  background: isToday ? '#f0f7ff' : item.isCurrentMonth ? 'white' : '#f8fafc',
                  borderRadius: '8px',
                  border: isToday ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ 
                  fontSize: '14px', fontWeight: '700', 
                  color: item.isCurrentMonth ? '#0f172a' : '#94a3b8',
                  textAlign: 'center'
                }}>{item.date.getDate()}</div>
                {dayEvents.slice(0, 2).map(ev => {
                  const color = STATUS_META[ev.status]?.color || '#64748b';
                  const tooltipText = `Reserva: ${ev.name || ''}\nEstado: ${ev.status || ''}\nHorario: ${ev.startTime || ''} - ${ev.endTime || ''}\nSalón: ${ev.salon || 'Sin salón'}${ev.pax ? `\nPAX: ${ev.pax}` : ''}`;
                  return (
                    <div
                      key={ev.id}
                      data-tooltip={tooltipText}
                      className="cal-tooltip"
                      style={{
                        fontSize: '10.5px',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        background: `${color}20`,
                        color: color,
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%'
                      }}
                    >
                      {ev.name}
                    </div>
                  );
                })}
                {dayEvents.length > 2 && (
                  <div style={{ fontSize: '10.5px', color: '#64748b', textAlign: 'center' }}>+{dayEvents.length - 2}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dateStr = formatDate(currentDate);
    const dayEvents = getEventsForDay(dateStr);
    const isToday = dateStr === todayStr;
    const layouts = computeEventLayouts(dayEvents);

    return (
      <div className="cal-day-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
        {/* Cabecera Pinned */}
        <div style={{ 
          height: '60px', 
          borderBottom: '2px solid #cbd5e1', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          background: isToday ? '#f0f7ff' : 'white',
          flexShrink: 0,
          zIndex: 20
        }}>
          <div style={{ fontSize: '15px', fontWeight: '900', color: isToday ? '#2563eb' : '#0f172a', letterSpacing: '0.5px' }}>
            {currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}
          </div>
        </div>

        {/* Cuerpo Desplazable */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', position: 'relative' }}>
          {/* Columna de etiquetas de horas */}
          <div style={{ 
            width: '70px', 
            flexShrink: 0, 
            background: '#f8fafc', 
            borderRight: '1px solid #e2e8f0',
            position: 'sticky',
            left: 0,
            zIndex: 10
          }}>
            {hourSlots.map(hour => (
              <div key={hour} style={{ 
                height: HOUR_HEIGHT, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                borderBottom: '1px solid #dbe4f0'
              }}>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#7c8ea5', lineHeight: 1 }}>
                  {formatHour(hour)}
                </span>
              </div>
            ))}
            <div style={{ 
              height: HOUR_HEIGHT, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderBottom: '1px solid #dbe4f0',
              background: '#f8fafc'
            }}>
              <span style={{ fontSize: '10px', fontWeight: '800', color: '#7c8ea5', lineHeight: 1 }}>
                {formatHour(HOUR_END)}
              </span>
            </div>
          </div>

          {/* Cuadrícula de un solo día */}
          <div style={{ flex: 1, position: 'relative', zIndex: 1, background: 'white' }}>
            {hourSlots.map(hour => {
              const isSelected = selectionActive && selectionStart && selectionCurrent && (() => {
                const minDate = selectionStart.dateStr <= selectionCurrent.dateStr ? selectionStart.dateStr : selectionCurrent.dateStr;
                const maxDate = selectionStart.dateStr <= selectionCurrent.dateStr ? selectionCurrent.dateStr : selectionStart.dateStr;
                const minHour = Math.min(selectionStart.hour, selectionCurrent.hour);
                const maxHour = Math.max(selectionStart.hour, selectionCurrent.hour);
                return dateStr >= minDate && dateStr <= maxDate && hour >= minHour && hour <= maxHour;
              })();

              const minDate = selectionStart?.dateStr <= selectionCurrent?.dateStr ? selectionStart?.dateStr : selectionCurrent?.dateStr;
              const maxDate = selectionStart?.dateStr <= selectionCurrent?.dateStr ? selectionCurrent?.dateStr : selectionStart?.dateStr;

              const isLeftMost = dateStr === minDate;
              const isRightMost = dateStr === maxDate;
              const isTopCell = isSelected && hour === Math.min(selectionStart.hour, selectionCurrent.hour);
              const isBottomCell = isSelected && hour === Math.max(selectionStart.hour, selectionCurrent.hour);

              return (
                <div 
                  key={hour} 
                  style={{ 
                    height: HOUR_HEIGHT, 
                    boxSizing: 'border-box',
                    userSelect: 'none',
                    cursor: 'cell',
                    background: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                    borderLeft: isSelected && isLeftMost ? '1.5px solid #2563eb' : 'none',
                    borderRight: isSelected && isRightMost ? '1.5px solid #2563eb' : 'none',
                    borderTop: isSelected && isTopCell ? '1.5px solid #2563eb' : 'none',
                    borderBottom: isSelected && isBottomCell ? '1.5px solid #2563eb' : '1px solid #dbe4f0',
                    boxShadow: isSelected ? 'inset 0 0 0 1px rgba(37,99,235,0.08)' : 'none',
                  }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return; // solo click izquierdo
                    if (dateStr < todayStr) {
                      toast('No se pueden programar eventos en fechas anteriores a hoy.');
                      return;
                    }
                    setSelectionStart({ dateStr, hour });
                    setSelectionCurrent({ dateStr, hour });
                    setSelectionActive(true);
                  }}
                  onDoubleClick={(e) => {
                    if (e.button !== 0) return;
                    if (dateStr < todayStr) {
                      toast('No se pueden programar eventos en fechas anteriores a hoy.');
                      return;
                    }
                    navigate(`/nueva-reserva?date=${dateStr}&endDate=${dateStr}&start=${formatTime(hour)}&end=${formatTime(hour + 1)}`);
                  }}
                  onMouseEnter={() => {
                    if (selectionActive) {
                      if (dateStr < todayStr) return; // No permitir arrastrar a fechas pasadas
                      setSelectionCurrent({ dateStr, hour });
                    }
                  }}
                />
              );
            })}
            <div style={{
              height: HOUR_HEIGHT,
              boxSizing: 'border-box',
              borderBottom: '1px solid #dbe4f0',
              background: 'transparent'
            }} />
            
            {dayEvents.map((ev) => {
              const top = timeToY(ev.startTime);
              const height = Math.max(44, timeToY(ev.endTime) - top);
              const isCompactHeight = height <= 72;
              const color = STATUS_META[ev.status]?.color || '#64748b';
              const seriesBadge = getEventSeriesBadge(ev, events);
              
              const isMaint = ev.status === 'Mantenimiento' || ev.status === 'Mantenimiento Realizado';
              const normalBg = isMaint
                ? `repeating-linear-gradient(45deg, ${color}12, ${color}12 8px, ${color}20 8px, ${color}20 16px) #ffffff`
                : `linear-gradient(0deg, ${color}12, ${color}12) #ffffff`;
              const hoverBg = isMaint
                ? `repeating-linear-gradient(45deg, ${color}20, ${color}20 8px, ${color}30 8px, ${color}30 16px) #ffffff`
                : `linear-gradient(0deg, ${color}20, ${color}20) #ffffff`;

              const layout = layouts[ev.id] || { lane: 0, totalLanes: 1 };
              const lane = layout.lane;
              const totalLanes = layout.totalLanes;
              
              const leftPct = (lane * 100) / totalLanes;
              const widthPct = 100 / totalLanes;
              
              return (
                <div
                  key={ev.id}
                  onClick={(e) => { e.stopPropagation(); handleEventClick(ev.id); }}
                  style={{
                    position: 'absolute',
                    top: `${top}px`,
                    left: `calc(${leftPct}% + 8px)`,
                    width: `calc(${widthPct}% - 16px)`,
                    height: `${height - 2}px`,
                    background: normalBg,
                    borderLeft: `4px solid ${color}`,
                    borderRadius: '10px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    zIndex: 1 + lane,
                    boxShadow: '0 3px 10px rgba(15, 23, 42, 0.08)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.01)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.08)';
                    e.currentTarget.style.background = hoverBg;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.02)';
                    e.currentTarget.style.background = normalBg;
                  }}
                >
                  {isCompactHeight && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: '9px', fontWeight: '800', color: '#334155', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ev.status}
                        </span>
                      </div>
                      <span style={{
                        width: '22px',
                        height: '14px',
                        borderRadius: '4px',
                        backgroundColor: '#cbd5e1',
                        color: '#1e293b',
                        fontSize: '9px',
                        fontWeight: '900',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {getStatusAbbreviation(ev.status)}
                      </span>
                    </div>
                  )}
                  <div style={{
                    fontSize: isCompactHeight ? '11px' : '13px',
                    fontWeight: '800',
                    color: '#0f172a',
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: isCompactHeight ? '1.15' : '1.2',
                    minHeight: isCompactHeight ? '14px' : '16px'
                  }}>
                    {ev.status === 'Mantenimiento' ? 'Mantenimiento: ' : ev.status === 'Mantenimiento Realizado' ? 'Mantenimiento realizado: ' : ''}{ev.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isCompactHeight ? '8px' : '12px', fontSize: isCompactHeight ? '9.5px' : '11px', color: '#475569', flexWrap: 'wrap' }}>
                    <span>Horario: {ev.startTime} - {ev.endTime}</span>
                    {!isCompactHeight && (
                      <>
                        <span>|</span>
                        <span style={{ color: color, fontWeight: '700' }}>Salón: {ev.salon}</span>
                      </>
                    )}
                    {!isCompactHeight && ev.pax && (
                      <>
                        <span>|</span>
                        <span>PAX: {ev.pax}</span>
                      </>
                    )}
                    {!isCompactHeight && seriesBadge && <SeriesBadge label={seriesBadge} color={color} compact={isCompactHeight} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

    return (
      <div className="cal-year-view" style={{ 
        padding: '24px', 
        height: '100%', 
        overflowY: 'auto', 
        background: '#f8fafc',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px'
      }}>
        {months.map((monthDate, mIdx) => {
          const monthName = monthDate.toLocaleDateString('es-ES', { month: 'long' });
          const daysInMonth = new Date(year, mIdx + 1, 0).getDate();
          const firstDayOfWeek = new Date(year, mIdx, 1).getDay();
          
          const monthDays = [];
          const prevMonthDaysInMonth = new Date(year, mIdx, 0).getDate();
          
          for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            monthDays.push({
              date: new Date(year, mIdx - 1, prevMonthDaysInMonth - i),
              isCurrentMonth: false
            });
          }
          
          for (let i = 1; i <= daysInMonth; i++) {
            monthDays.push({
              date: new Date(year, mIdx, i),
              isCurrentMonth: true
            });
          }
          
          const totalCells = monthDays.length > 35 ? 42 : 35;
          const nextMonthDaysNeeded = totalCells - monthDays.length;
          for (let i = 1; i <= nextMonthDaysNeeded; i++) {
            monthDays.push({
              date: new Date(year, mIdx + 1, i),
              isCurrentMonth: false
            });
          }

          return (
            <div key={mIdx} style={{
              background: 'white',
              borderRadius: '24px',
              padding: '20px',
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'default'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(15, 23, 42, 0.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(15, 23, 42, 0.05)';
            }}
            >
              <div style={{ 
                fontSize: '15px', 
                fontWeight: '900', 
                color: '#0f172a', 
                textTransform: 'uppercase',
                letterSpacing: '1px',
                textAlign: 'center',
                paddingBottom: '4px'
              }}>
                {monthName}
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)', 
                border: '1px solid #e2e8f0', 
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#f8fafc'
              }}>
                {['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'].map((d, i) => (
                  <div key={i} style={{ 
                    fontSize: '9px', 
                    fontWeight: '800', 
                    color: '#64748b',
                    padding: '6px 0',
                    textAlign: 'center',
                    borderBottom: '1px solid #e2e8f0',
                    borderRight: i < 6 ? '1px solid #e2e8f0' : 'none',
                    background: '#f1f5f9'
                  }}>
                    {d}
                  </div>
                ))}

                {monthDays.map((item, dIdx) => {
                  const dateStr = formatDate(item.date);
                  const isToday = dateStr === todayStr;
                  const dayEvents = getEventsForDay(dateStr);
                  const hasEvents = dayEvents.length > 0;
                  const primaryEvent = dayEvents[0];
                  const eventColor = primaryEvent ? (STATUS_META[primaryEvent.status]?.color || '#2563eb') : 'transparent';
                  const colIdx = dIdx % 7;

                  return (
                    <div
                      key={dIdx}
                      onClick={() => {
                        setCurrentDate(item.date);
                        setViewMode('day');
                      }}
                      style={{
                        height: '36px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        position: 'relative',
                        borderBottom: dIdx < totalCells - 7 ? '1px solid #e2e8f0' : 'none',
                        borderRight: colIdx < 6 ? '1px solid #e2e8f0' : 'none',
                        background: isToday 
                          ? '#2563eb' 
                          : hasEvents 
                            ? `${eventColor}12` 
                            : !item.isCurrentMonth 
                              ? '#f8fafc' 
                              : 'white',
                        color: isToday 
                          ? 'white' 
                          : hasEvents 
                            ? eventColor 
                            : !item.isCurrentMonth 
                              ? '#94a3b8' 
                              : '#334155',
                        transition: 'all 0.15s'
                      }}
                      data-tooltip={hasEvents ? `${dayEvents.length} reservas:\n${dayEvents.map(e => `- ${e.name} (${e.status})`).join('\n')}` : ''}
                      className={hasEvents ? 'cal-tooltip' : ''}
                      onMouseEnter={e => {
                        if (!isToday) {
                          e.currentTarget.style.background = hasEvents ? `${eventColor}25` : '#f1f5f9';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isToday) {
                          e.currentTarget.style.background = hasEvents 
                            ? `${eventColor}12` 
                            : !item.isCurrentMonth 
                              ? '#f8fafc' 
                              : 'white';
                        }
                      }}
                    >
                      <span style={{ 
                        zIndex: 2,
                        position: 'relative',
                        fontWeight: hasEvents ? '800' : '700'
                      }}>
                        {item.date.getDate()}
                      </span>
                      
                      {hasEvents && !isToday && (
                        <span style={{ 
                          position: 'absolute', 
                          bottom: '3px', 
                          width: '4px', 
                          height: '4px', 
                          borderRadius: '50%', 
                          background: eventColor,
                          zIndex: 2
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderAgendaView = () => {
    const sortedEvents = [...filteredEvents]
      .filter(ev => ev.date >= todayStr)
      .sort((a, b) => {
        return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
      });

    return (
      <div className="cal-agenda-view" style={{ 
        padding: '32px 24px', 
        height: '100%', 
        overflowY: 'auto', 
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        alignItems: 'center'
      }}>
        <div style={{ width: '100%', maxWidth: '850px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Cronograma de Reservas</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Listado ordenado cronológicamente de tus reservas programadas.</p>
            </div>
            <span style={{ 
              marginLeft: 'auto', 
              padding: '6px 12px', 
              borderRadius: '20px', 
              background: '#e2e8f0', 
              color: '#475569', 
              fontSize: '11px', 
              fontWeight: '700' 
            }}>
              {sortedEvents.length} {sortedEvents.length === 1 ? 'evento' : 'eventos'}
            </span>
          </div>

          {sortedEvents.length === 0 ? (
            <div style={{
              background: 'white',
              borderRadius: '24px',
              padding: '48px 24px',
              textAlign: 'center',
              border: '1px dashed #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '22px', fontWeight: '800', color: '#94a3b8' }}>Agenda</span>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#334155', margin: 0 }}>No hay eventos agendados</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0, maxWidth: '320px' }}>
                No se encontraron reservas que coincidan con los filtros activos. Intenta cambiar de estado o crea una nueva reserva.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sortedEvents.map((ev) => {
                const color = STATUS_META[ev.status]?.color || '#64748b';
                const seriesBadge = getEventSeriesBadge(ev, events);
                const eventDate = new Date(`${ev.date}T00:00:00`);
                const dayNum = eventDate.getDate();
                const monthName = eventDate.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
                const weekdayName = eventDate.toLocaleDateString('es-ES', { weekday: 'long' });

                return (
                  <div
                    key={ev.id}
                    onClick={() => navigate(`/reserva/${ev.id}`)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid rgba(226, 232, 240, 0.8)',
                      borderRadius: '16px',
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px -3px rgba(0,0,0,0.02)',
                      borderLeft: `4px solid ${color}`,
                      transition: 'all 0.2s',
                      backdropFilter: 'blur(8px)'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(0,0,0,0.06)';
                      e.currentTarget.style.background = '#ffffff';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 4px 15px -3px rgba(0,0,0,0.02)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
                    }}
                  >
                    <div style={{
                      width: '50px',
                      height: '52px',
                      borderRadius: '12px',
                      background: '#f1f5f9',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>{dayNum}</span>
                      <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', marginTop: '2px' }}>{monthName}</span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ev.name}
                        </span>
                        <span style={{ 
                          fontSize: '9px', 
                          fontWeight: '800', 
                          color: '#64748b', 
                          textTransform: 'capitalize',
                          background: '#f1f5f9',
                          padding: '2px 6px',
                          borderRadius: '6px'
                        }}>
                          {weekdayName}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                          Horario: {ev.startTime} - {ev.endTime}
                        </span>
                        <span>|</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600', color: '#475569' }}>
                          Salón: {ev.salon}
                        </span>
                        {ev.pax && (
                          <>
                            <span>|</span>
                            <span>PAX: {ev.pax}</span>
                          </>
                        )}
                        <SeriesBadge label={seriesBadge} color={color} />
                      </div>
                      
                      {ev.trackingUser && (
                        <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          Encargado: <strong style={{ color: '#64748b' }}>{ev.trackingUser}</strong>
                        </div>
                      )}
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '10px',
                        fontWeight: '800',
                        color: color,
                        background: `${color}12`,
                        border: `1px solid ${color}30`,
                        textTransform: 'uppercase'
                      }}>
                        {ev.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="calendar-container" style={{ 
      flex: 1, 
      margin: '0 0 20px 0',
      display: 'flex', 
      flexDirection: 'column', 
      background: 'white',
      border: '1.5px solid #e2e8f0',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)'
    }}>
      <style>{`
        /* ============================================================
           CALENDARIO RESPONSIVE — Estilos correctamente orientados
           ============================================================ */

        /* ─── Tablet & menores ─── */
        @media (max-width: 1024px) {
          /* Año: tarjetas más angostas */
          .cal-year-view {
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) !important;
            gap: 16px !important;
            padding: 16px !important;
          }
        }

        /* ─── Tablet vertical y móviles grandes ─── */
        @media (max-width: 768px) {
          .calendar-container {
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }

          /* =========== VISTA SEMANA =========== */
          .cal-week-view {
            overflow: hidden !important;
          }
          .cal-week-scroll-container {
            overflow-x: auto !important;
            min-width: 100% !important;
            width: 100% !important;
            -webkit-overflow-scrolling: touch;
          }
          .cal-week-header,
          .cal-week-body {
            min-width: 750px !important; /* 700px columns + 50px hour spacer */
            width: max-content !important;
          }
          .cal-week-hour-column {
            width: 50px !important;
            flex-shrink: 0 !important;
          }
          .cal-week-header-days,
          .cal-week-body-days {
            flex: 1 !important;
            display: flex !important;
            min-width: 700px !important;
          }
          .cal-week-header-day,
          .cal-week-body-day {
            flex: 1 !important;
            min-width: 100px !important;
          }
          .cal-week-header-day {
            height: 56px !important;
          }
          .cal-week-header-day > div:first-child {
            font-size: 9.5px !important;
          }
          .cal-week-header-day > div:last-child {
            width: 26px !important;
            height: 26px !important;
            font-size: 12px !important;
          }
          .cal-week-hour-column span {
            font-size: 9px !important;
          }
          /* Eventos en semana — más compactos */
          .cal-week-view .cal-tooltip {
            padding: 4px 6px !important;
            border-radius: 6px !important;
            border-left-width: 3px !important;
          }

          /* =========== VISTA DÍA =========== */
          .cal-day-view > div:nth-child(1) {
            height: 48px !important;
          }
          .cal-day-view > div:nth-child(1) > div {
            font-size: 12px !important;
          }
          .cal-day-view > div:nth-child(2) > div:nth-child(1) {
            width: 48px !important;
          }
          .cal-day-view > div:nth-child(2) > div:nth-child(1) span {
            font-size: 9px !important;
          }

          /* =========== VISTA MES =========== */
          .cal-month-view {
            padding: 8px !important;
          }
          .cal-month-view > div:nth-child(1) {
            gap: 2px !important;
            margin-bottom: 8px !important;
          }
          .cal-month-view > div:nth-child(1) > div {
            font-size: 10px !important;
            padding: 4px !important;
          }
          .cal-month-view > div:nth-child(2) {
            gap: 2px !important;
          }
          .cal-month-cell {
            min-height: 56px !important;
            padding: 4px !important;
          }
          .cal-month-cell > div:first-child {
            font-size: 12px !important;
          }
          .cal-month-cell > div {
            font-size: 9px !important;
            padding: 1px 3px !important;
          }
          .cal-month-cell > div:last-child {
            font-size: 9px !important;
          }

          /* =========== VISTA AÑO =========== */
          .cal-year-view {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
            gap: 14px !important;
            padding: 12px !important;
          }

          /* =========== VISTA AGENDA =========== */
          .cal-agenda-view {
            padding: 16px 12px !important;
            gap: 16px !important;
          }
          .cal-agenda-view > div {
            max-width: 100% !important;
          }
          .cal-agenda-view > div > div:nth-child(2) > div {
            padding: 12px 14px !important;
            flex-direction: column !important;
            gap: 10px !important;
          }
          .cal-agenda-view > div > div:nth-child(2) > div > div:first-child {
            width: 40px !important;
            height: 44px !important;
          }
          .cal-agenda-view > div > div:nth-child(2) > div > div:first-child span:first-child {
            font-size: 14px !important;
          }
          .cal-agenda-view > div > div:nth-child(2) > div > div:first-child span:last-child {
            font-size: 8px !important;
          }
        }

        /* ─── Móviles pequeños (< 480px) ─── */
        @media (max-width: 480px) {
          .cal-week-scroll-container {
            min-width: 100% !important;
            width: 100% !important;
          }
          .cal-week-header,
          .cal-week-body {
            min-width: calc(40px + 7 * (100vw - 40px) / 3) !important;
            width: max-content !important;
          }
          .cal-week-hour-column {
            width: 40px !important;
            flex-shrink: 0 !important;
          }
          .cal-week-header-days,
          .cal-week-body-days {
            flex: 1 !important;
            display: flex !important;
            min-width: calc(7 * (100vw - 40px) / 3) !important;
          }
          .cal-week-header-day,
          .cal-week-body-day {
            flex: 0 0 calc((100vw - 40px) / 3) !important;
            width: calc((100vw - 40px) / 3) !important;
            min-width: calc((100vw - 40px) / 3) !important;
            max-width: calc((100vw - 40px) / 3) !important;
          }
          .cal-week-header-day {
            height: 48px !important;
          }

          .cal-month-cell {
            min-height: 42px !important;
            padding: 2px !important;
          }
          .cal-month-cell > div:nth-child(n+2) {
            display: none !important;
          }

          .cal-year-view {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
            padding: 8px !important;
          }

          .cal-agenda-view {
            padding: 12px 8px !important;
          }
          .cal-agenda-view > div > div:first-child h2 {
            font-size: 16px !important;
          }
        }
      `}</style>
      {/* Contenido del calendario */}
      <div style={{ flex: 1, overflow: (viewMode === 'year' || viewMode === 'agenda') ? 'auto' : 'hidden' }}>
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'day' && renderDayView()}
        {viewMode === 'year' && renderYearView()}
        {viewMode === 'agenda' && renderAgendaView()}
      </div>

      {/* Modal de reserva */}
      {(location.pathname === '/nueva-reserva' || location.pathname.startsWith('/reserva/')) && (
        <div className="reservation-modal-overlay" style={{
          position: 'fixed', inset: 0, background: '#f1f5f9',
          zIndex: 32000, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', padding: 0
        }}>
          <div className="reservation-modal-content" style={{
            width: '100vw', height: '100vh', maxHeight: 'none', background: '#f8fafc',
            borderRadius: 0, boxShadow: 'none',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            <ReservationForm />
          </div>
        </div>
      )}


    </div>
  );
}

