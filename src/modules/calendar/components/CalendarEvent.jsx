import React from 'react';
import { useNavigate } from 'react-router-dom';
import { timeToY, STATUS_META } from '../constants';

export default function CalendarEvent({ event, layout }) {
  const navigate = useNavigate();
  const top = timeToY(event.startTime);
  const bottom = timeToY(event.endTime);
  const height = Math.max(42, bottom - top);

  const meta = STATUS_META[event.status];
  const color = meta ? meta.color : "#64748b";

  const handleEventClick = (e) => {
    e.stopPropagation();
    navigate(`/reserva/${event.id}`);
  };

  // Logica de carril original
  const lane = layout?.lane ?? 0;
  const lanes = Math.max(1, layout?.lanes ?? 1);
  const sidePad = 8;
  const gap = 6;
  
  // Asumimos un ancho base de columna de 240px (min-width definido en el grid)
  // En un entorno real podriamos usar un ResizeObserver, pero para paridad visual usamos el calculo proporcional
  const leftPx = sidePad + lane * (100 / lanes);
  const widthPct = (100 - (sidePad * 2 / 2.4)) / lanes; // Simplificado para React

  const cardStyle = {
    position: 'absolute',
    top: `${top + 6}px`,
    height: `${height - 10}px`,
    left: `calc(${lane * (100 / lanes)}% + ${sidePad}px)`,
    width: `calc(${100 / lanes}% - ${sidePad * 1.5}px)`,
    zIndex: 10 + lane,
    
    // Estilo visual original (Degradados y bordes)
    background: `linear-gradient(180deg, ${color}33, ${color}1F)`, // rgba equivalents
    border: '1px solid',
    borderColor: `${color}6B`,
    borderRadius: '6px',
    padding: '6px 8px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    transition: 'transform 0.1s, box-shadow 0.1s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  const statusShort = event.status
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <div 
      className="event" 
      style={{ ...cardStyle, cursor: 'pointer' }} 
      onClick={handleEventClick} 
      data-event-id={event.id}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.02)';
        e.currentTarget.style.zIndex = '100';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.zIndex = 10 + lane;
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: '800', color: color }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }}></span>
        <span style={{ textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{event.status}</span>
        <small style={{ opacity: 0.7, marginLeft: 'auto' }}>{statusShort}</small>
      </div>
      
      <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2' }}>
        {event.name}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <div style={{ fontSize: '10px', color: '#475569', fontWeight: '600' }}>
          {event.startTime} - {event.endTime}
        </div>
        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '500' }}>
          {event.salon || '-'}
        </div>
      </div>
    </div>
  );
}
