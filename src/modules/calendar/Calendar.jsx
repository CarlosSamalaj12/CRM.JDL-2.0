import { useMemo, useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate, useLocation } from 'react-router-dom';
import { STATUS_META } from './constants';
import ReservationForm from './components/ReservationForm';

const HOUR_HEIGHT = 56;
const HOUR_START = 6;
const HOUR_END = 23;

function formatDate(date) {
  return date.toISOString().split('T')[0];
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

function getWeekDays(startDate) {
  return Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
}

function formatHour(hour) {
  const h = hour % 12 || 12;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${h}:00 ${ampm}`;
}

function timeToY(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return ((h - HOUR_START) * 60 + m) / 60 * HOUR_HEIGHT;
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

export default function Calendar() {
  const { 
    viewMode, 
    setViewMode,
    currentDate, 
    setCurrentDate, 
    customTitle, 
    setCustomTitle, 
    events, 
    users,
    handleAddEvent,
    statusFilter,
    setStatusFilter,
    searchQuery,
    roomFilter
  } = useOutletContext();
  
  const navigate = useNavigate();
  const location = useLocation();
  const calendarRef = useRef(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);

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
        
        const formatTime = (h) => `${String(h).padStart(2, '0')}:00`;
        
        navigate(`/nueva-reserva?date=${minDate}&endDate=${maxDate}&start=${formatTime(minHour)}&end=${formatTime(maxHour + 1)}`);
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

  const weekStart = useMemo(() => getStartOfWeek(currentDate), [currentDate]);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  
  const monthStart = useMemo(() => {
    const d = new Date(currentDate);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, [currentDate]);

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
      const start = ev.date;
      const end = ev.endDate || ev.date;
      return dateStr >= start && dateStr <= end;
    });
  };

  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

  const handleDayClick = (dateStr) => {
    navigate(`/nueva-reserva?date=${dateStr}&start=10:00&end=12:00`);
  };

  const handleEventClick = (eventId) => {
    navigate(`/reserva/${eventId}`);
  };



  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const renderWeekView = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
        {/* Contenedor Desplazable que contiene tanto cabecera como cuerpo */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          
          {/* Cabecera Pinned */}
          <div style={{ 
            display: 'flex', 
            background: 'rgba(255, 255, 255, 0.95)', 
            backdropFilter: 'blur(10px)',
            borderBottom: '2px solid #e2e8f0', 
            position: 'sticky',
            top: 0,
            zIndex: 10,
            flexShrink: 0
          }}>
            {/* Espaciador de horas con etiqueta "HORA" */}
            <div style={{ 
              width: '70px', 
              flexShrink: 0, 
              borderRight: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: '800',
              color: '#94a3b8',
              background: '#f8fafc'
            }}>
              HORA
            </div>
            
            {/* Encabezados de días */}
            <div style={{ flex: 1, display: 'flex' }}>
            {weekDates.map((day, idx) => {
              const dateStr = formatDate(day);
              const isToday = dateStr === todayStr;
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              
              return (
                <div key={idx} style={{ 
                  flex: 1, 
                  height: '64px',
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  borderRight: idx < 6 ? '1px solid #e2e8f0' : 'none',
                  background: isToday ? '#f0f7ff' : 'transparent',
                  transition: 'background 0.2s'
                }}>
                  <div style={{ 
                    fontSize: '10px', 
                    fontWeight: '800', 
                    color: isToday ? '#2563eb' : isWeekend ? '#e11d48' : '#64748b', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {day.toLocaleDateString('es-ES', { weekday: 'short' })}
                  </div>
                  <div style={{ 
                    width: '28px', 
                    height: '28px', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: isToday ? '#2563eb' : 'transparent',
                    color: isToday ? 'white' : isWeekend ? '#e11d48' : '#0f172a',
                    fontSize: '13px', 
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
        <div style={{ display: 'flex', position: 'relative' }}>
          {/* Columna de etiquetas de horas */}
          <div style={{ 
            width: '70px', 
            flexShrink: 0, 
            background: 'rgba(248, 250, 252, 0.85)', 
            borderRight: '1px solid #e2e8f0',
            position: 'sticky',
            left: 0,
            zIndex: 5
          }}>
            {hours.map(hour => (
              <div key={hour} style={{ 
                height: HOUR_HEIGHT, 
                display: 'flex', 
                alignItems: 'flex-start', 
                justifyContent: 'flex-end', 
                paddingRight: '10px'
              }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', marginTop: '-6px' }}>
                  {formatHour(hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Cuadrícula de columnas de días */}
          <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
            {weekDates.map((day, idx) => {
              const dateStr = formatDate(day);
              const dayEvents = getEventsForDay(dateStr);
              const layouts = computeEventLayouts(dayEvents);
              
              return (
                <div key={idx} style={{ 
                  flex: 1, 
                  borderRight: idx < 6 ? '1px solid #e2e8f0' : 'none', 
                  position: 'relative',
                  background: 'white'
                }}>
                  {/* Líneas horizontales de horas */}
                  {hours.map(hour => {
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
                          borderBottom: isSelected && isBottomCell ? '1.5px solid #2563eb' : '1px solid #f1f5f9',
                        }}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return; // solo click izquierdo
                          setSelectionStart({ dateStr, hour });
                          setSelectionCurrent({ dateStr, hour });
                          setSelectionActive(true);
                        }}
                        onMouseEnter={() => {
                          if (selectionActive) {
                            setSelectionCurrent({ dateStr, hour });
                          }
                        }}
                      />
                    );
                  })}
                  
                  {/* Eventos */}
                  {dayEvents.map((ev) => {
                    const top = timeToY(ev.startTime);
                    const height = Math.max(24, timeToY(ev.endTime) - top);
                    const color = STATUS_META[ev.status]?.color || '#64748b';
                    
                    const isMaint = ev.status === 'Mantenimiento' || ev.status === 'Mantenimiento Realizado';
                    const normalBg = isMaint
                      ? `repeating-linear-gradient(45deg, ${color}12, ${color}12 8px, ${color}20 8px, ${color}20 16px)`
                      : `${color}12`;
                    const hoverBg = isMaint
                      ? `repeating-linear-gradient(45deg, ${color}20, ${color}20 8px, ${color}30 8px, ${color}30 16px)`
                      : `${color}25`;

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
                          left: `calc(${leftPct}% + 4px)`,
                          width: `calc(${widthPct}% - 8px)`,
                          height: `${height - 2}px`,
                          background: normalBg,
                          borderLeft: `4px solid ${color}`,
                          borderRadius: '8px',
                          padding: '6px 8px',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          zIndex: 1 + lane,
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'scale(1.02)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                          e.currentTarget.style.zIndex = 100;
                          e.currentTarget.style.background = hoverBg;

                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredEvent({
                            ev,
                            rect: {
                              top: rect.top,
                              left: rect.left,
                              width: rect.width,
                              height: rect.height
                            }
                          });
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.02)';
                          e.currentTarget.style.zIndex = 1 + lane;
                          e.currentTarget.style.background = normalBg;
                          setHoveredEvent(null);
                        }}
                      >
                        <div style={{ 
                          fontSize: '11px', 
                          fontWeight: '800', 
                          color: '#0f172a', 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis' 
                        }}>
                          {ev.status === 'Mantenimiento' ? '🛠️ ' : ev.status === 'Mantenimiento Realizado' ? '✅🛠️ ' : ''}{ev.name}
                        </div>
                        <div style={{ fontSize: '9px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>
                          🕒 {ev.startTime} - {ev.endTime}
                        </div>
                        <div style={{ fontSize: '9px', fontWeight: '700', color: color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          📍 {ev.salon}
                        </div>
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
      <div style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '16px' }}>
          {['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: '800', color: '#64748b', padding: '8px' }}>{d}</div>
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
                onClick={() => handleDayClick(dateStr)}
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
                  fontSize: '12px', fontWeight: '700', 
                  color: item.isCurrentMonth ? '#0f172a' : '#94a3b8',
                  textAlign: 'center'
                }}>{item.date.getDate()}</div>
                {dayEvents.slice(0, 2).map(ev => {
                  const color = STATUS_META[ev.status]?.color || '#64748b';
                  return (
                    <div key={ev.id} style={{
                      fontSize: '9px',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      background: `${color}20`,
                      color: color,
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {ev.name}
                    </div>
                  );
                })}
                {dayEvents.length > 2 && (
                  <div style={{ fontSize: '9px', color: '#64748b', textAlign: 'center' }}>+{dayEvents.length - 2}</div>
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
        {/* Cabecera Pinned */}
        <div style={{ 
          height: '60px', 
          borderBottom: '2px solid #e2e8f0', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          background: isToday ? '#f0f7ff' : 'white',
          flexShrink: 0,
          zIndex: 10
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
            background: 'rgba(248, 250, 252, 0.85)', 
            borderRight: '1px solid #e2e8f0',
            position: 'sticky',
            left: 0,
            zIndex: 5
          }}>
            {hours.map(hour => (
              <div key={hour} style={{ 
                height: HOUR_HEIGHT, 
                display: 'flex', 
                alignItems: 'flex-start', 
                justifyContent: 'flex-end', 
                paddingRight: '10px'
              }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', marginTop: '-6px' }}>
                  {formatHour(hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Cuadrícula de un solo día */}
          <div style={{ flex: 1, position: 'relative', background: 'white' }}>
            {hours.map(hour => {
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
                    borderBottom: isSelected && isBottomCell ? '1.5px solid #2563eb' : '1px solid #f1f5f9',
                  }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return; // solo click izquierdo
                    setSelectionStart({ dateStr, hour });
                    setSelectionCurrent({ dateStr, hour });
                    setSelectionActive(true);
                  }}
                  onMouseEnter={() => {
                    if (selectionActive) {
                      setSelectionCurrent({ dateStr, hour });
                    }
                  }}
                />
              );
            })}
            
            {dayEvents.map((ev) => {
              const top = timeToY(ev.startTime);
              const height = Math.max(24, timeToY(ev.endTime) - top);
              const color = STATUS_META[ev.status]?.color || '#64748b';
              
              const isMaint = ev.status === 'Mantenimiento' || ev.status === 'Mantenimiento Realizado';
              const normalBg = isMaint
                ? `repeating-linear-gradient(45deg, ${color}12, ${color}12 8px, ${color}20 8px, ${color}20 16px)`
                : `${color}12`;
              const hoverBg = isMaint
                ? `repeating-linear-gradient(45deg, ${color}20, ${color}20 8px, ${color}30 8px, ${color}30 16px)`
                : `${color}20`;

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
                    padding: '8px 16px',
                    cursor: 'pointer',
                    zIndex: 1 + lane,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
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

                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredEvent({
                      ev,
                      rect: {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height
                      }
                    });
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.02)';
                    e.currentTarget.style.background = normalBg;
                    setHoveredEvent(null);
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                    {ev.status === 'Mantenimiento' ? '🛠️ ' : ev.status === 'Mantenimiento Realizado' ? '✅🛠️ ' : ''}{ev.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#475569' }}>
                    <span>🕒 {ev.startTime} - {ev.endTime}</span>
                    <span>•</span>
                    <span style={{ color: color, fontWeight: '700' }}>📍 {ev.salon}</span>
                    {ev.pax && (
                      <>
                        <span>•</span>
                        <span>👥 {ev.pax} PAX</span>
                      </>
                    )}
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
      <div style={{ 
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
                      title={hasEvents ? `${dayEvents.length} reservas:\n${dayEvents.map(e => `• ${e.name} (${e.status})`).join('\n')}` : ''}
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
    const sortedEvents = [...filteredEvents].sort((a, b) => {
      return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
    });

    return (
      <div style={{ 
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
              <span style={{ fontSize: '48px' }}>📅</span>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#334155', margin: 0 }}>No hay eventos agendados</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0, maxWidth: '320px' }}>
                No se encontraron reservas que coincidan con los filtros activos. Intenta cambiar de estado o crea una nueva reserva.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sortedEvents.map((ev) => {
                const color = STATUS_META[ev.status]?.color || '#64748b';
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
                          🕒 {ev.startTime} - {ev.endTime}
                        </span>
                        <span>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600', color: '#475569' }}>
                          📍 {ev.salon}
                        </span>
                        {ev.pax && (
                          <>
                            <span>•</span>
                            <span>👥 {ev.pax} PAX</span>
                          </>
                        )}
                      </div>
                      
                      {ev.trackingUser && (
                        <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          👤 Encargado: <strong style={{ color: '#64748b' }}>{ev.trackingUser}</strong>
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
      margin: '0 20px 20px 20px',
      display: 'flex', 
      flexDirection: 'column', 
      background: 'white',
      border: '1.5px solid #e2e8f0',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)'
    }}>
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
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{
            width: '100%', maxWidth: '1100px', maxHeight: '90vh', background: '#f8fafc',
            borderRadius: '24px', boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            <ReservationForm onCancel={() => navigate('/calendar')} />
          </div>
        </div>
      )}

      {/* Tooltip flotante Premium personalizado */}
      {hoveredEvent && (() => {
        const { ev, rect } = hoveredEvent;
        const color = STATUS_META[ev.status]?.color || '#64748b';
        
        // Calcular si colocar a la derecha o a la izquierda del elemento
        const tooltipWidth = 320;
        const gap = 12;
        const windowWidth = window.innerWidth;
        const showOnLeft = rect.left + rect.width + tooltipWidth + gap > windowWidth;
        const leftPos = showOnLeft 
          ? rect.left - tooltipWidth - gap 
          : rect.left + rect.width + gap;
          
        return (
          <div style={{
            position: 'fixed',
            top: `${Math.min(rect.top, window.innerHeight - 320)}px`,
            left: `${leftPos}px`,
            width: `${tooltipWidth}px`,
            zIndex: 99999,
            pointerEvents: 'none',
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderLeft: `6px solid ${color}`,
            borderRadius: '16px',
            padding: '16px 20px',
            boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {/* Header: Estado con color del estado */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '9px',
                fontWeight: '900',
                color: color,
                background: `${color}15`,
                border: `1px solid ${color}30`,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {ev.status}
              </span>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700' }}>
                Detalles de reserva
              </span>
            </div>

            {/* Título de la reserva */}
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', lineHeight: '1.3' }}>
              {ev.name}
            </div>

            {/* Separador */}
            <div style={{ height: '1px', background: '#f1f5f9' }} />

            {/* Cuerpo del Tooltip */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                <span style={{ fontSize: '14px' }}>🕒</span>
                <span><strong>Horario:</strong> {ev.startTime} - {ev.endTime}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                <span style={{ fontSize: '14px' }}>📍</span>
                <span><strong>Salón:</strong> {ev.salon || 'Sin salón'}</span>
              </div>
              {ev.pax ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                  <span style={{ fontSize: '14px' }}>👥</span>
                  <span><strong>PAX:</strong> {ev.pax} invitados</span>
                </div>
              ) : null}
              {ev.clientName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                  <span style={{ fontSize: '14px' }}>👤</span>
                  <span><strong>Cliente:</strong> {ev.clientName}</span>
                </div>
              ) : null}
              {ev.clientPhone ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                  <span style={{ fontSize: '14px' }}>📞</span>
                  <span><strong>Teléfono:</strong> {ev.clientPhone}</span>
                </div>
              ) : null}
            </div>

            {/* Notas si existen */}
            {ev.notes && (
              <>
                <div style={{ height: '1px', background: '#f1f5f9' }} />
                <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', borderLeft: '3px solid #cbd5e1', lineHeight: '1.4' }}>
                  "{ev.notes}"
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}