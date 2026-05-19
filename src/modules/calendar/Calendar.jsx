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
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getWeekDays(startDate) {
  return Array.from({ length: 5 }, (_, i) => addDays(startDate, i));
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
    setStatusFilter
  } = useOutletContext();
  
  const navigate = useNavigate();
  const location = useLocation();
  const calendarRef = useRef(null);

  const weekStart = useMemo(() => getStartOfWeek(currentDate), [currentDate]);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  
  const monthStart = useMemo(() => {
    const d = new Date(currentDate);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, [currentDate]);

  const todayStr = formatDate(new Date());

  const filteredEvents = useMemo(() => {
    if (statusFilter === 'all') return events;
    return events?.filter(ev => ev.status === statusFilter) || [];
  }, [events, statusFilter]);

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



  const weekDates = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  const renderWeekView = () => (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Columna de horas */}
      <div style={{ width: '70px', flexShrink: 0, background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}>
        <div style={{ height: '60px', borderBottom: '1px solid #e2e8f0' }} />
        {hours.map(hour => (
          <div key={hour} style={{ height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', marginTop: '-6px' }}>{formatHour(hour)}</span>
          </div>
        ))}
      </div>

      {/* Días de la semana */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {weekDates.map((day, idx) => {
          const dateStr = formatDate(day);
          const isToday = dateStr === todayStr;
          const dayEvents = getEventsForDay(dateStr);
          
          return (
            <div key={idx} style={{ flex: 1, borderRight: idx < 4 ? '1px solid #e2e8f0' : 'none', position: 'relative' }}>
              {/* Header del día */}
              <div style={{ 
                height: '60px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                borderBottom: '1px solid #e2e8f0',
                background: isToday ? '#f0f7ff' : 'white',
                cursor: 'pointer'
              }} onClick={() => handleDayClick(dateStr)}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                  {day.toLocaleDateString('es-ES', { weekday: 'short' })}
                </div>
                <div style={{ 
                  width: '32px', height: '32px', 
                  borderRadius: '50%', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? '#2563eb' : 'transparent',
                  color: isToday ? 'white' : '#0f172a',
                  fontSize: '14px', fontWeight: '700'
                }}>
                  {day.getDate()}
                </div>
              </div>

              {/* Grid de horas */}
              <div style={{ position: 'relative' }} onClick={() => handleDayClick(dateStr)}>
                {hours.map(hour => (
                  <div key={hour} style={{ height: HOUR_HEIGHT, borderBottom: '1px solid #f1f5f9' }} />
                ))}
                
                {/* Eventos */}
                {dayEvents.map((ev, i) => {
                  const top = timeToY(ev.startTime);
                  const height = Math.max(20, timeToY(ev.endTime) - top);
                  const color = STATUS_META[ev.status]?.color || '#64748b';
                  
                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); handleEventClick(ev.id); }}
                      style={{
                        position: 'absolute',
                        top: `${top}px`,
                        left: '4px',
                        right: '4px',
                        height: `${height}px`,
                        background: `${color}15`,
                        borderLeft: `3px solid ${color}`,
                        borderRadius: '6px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        zIndex: 1
                      }}
                    >
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.name}
                      </div>
                      <div style={{ fontSize: '9px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {ev.startTime} - {ev.endTime} • {ev.salon}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderMonthView = () => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    
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
          {['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'].map(d => (
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

    return (
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <div style={{ width: '70px', flexShrink: 0, background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}>
          <div style={{ height: '60px', borderBottom: '1px solid #e2e8f0' }} />
          {hours.map(hour => (
            <div key={hour} style={{ height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', marginTop: '-6px' }}>{formatHour(hour)}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ height: '60px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isToday ? '#f0f7ff' : 'white' }}>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              {currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}
            </div>
          </div>
          <div style={{ position: 'relative' }} onClick={() => handleDayClick(dateStr)}>
            {hours.map(hour => (
              <div key={hour} style={{ height: HOUR_HEIGHT, borderBottom: '1px solid #f1f5f9' }} />
            ))}
            {dayEvents.map((ev) => {
              const top = timeToY(ev.startTime);
              const height = Math.max(20, timeToY(ev.endTime) - top);
              const color = STATUS_META[ev.status]?.color || '#64748b';
              
              return (
                <div
                  key={ev.id}
                  onClick={(e) => { e.stopPropagation(); handleEventClick(ev.id); }}
                  style={{
                    position: 'absolute',
                    top: `${top}px`,
                    left: '4px',
                    right: '4px',
                    height: `${height}px`,
                    background: `${color}15`,
                    borderLeft: `3px solid ${color}`,
                    borderRadius: '6px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    zIndex: 1
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>{ev.name}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{ev.startTime} - {ev.endTime} • {ev.salon} • {ev.pax} PAX</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'white' }}>
      {/* Contenido del calendario */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'day' && renderDayView()}
      </div>

      {/* Modal de reserva */}
      {(location.pathname === '/nueva-reserva' || location.pathname.startsWith('/reserva/')) && (
        <div style={{
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
    </div>
  );
}