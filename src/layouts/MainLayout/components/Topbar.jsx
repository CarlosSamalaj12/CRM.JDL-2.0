import React, { useState } from 'react';
import { STATUS_META } from '../../../modules/calendar/constants';
import DatePickerPopover from './DatePickerPopover';

const views = [
  { key: 'day', label: 'Día' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'timeline', label: 'Timeline' },
];

export default function Topbar({ 
  viewMode, 
  setViewMode, 
  dateLabel, 
  currentDate,
  setCurrentDate,
  onToday, 
  onPrev, 
  onNext, 
  statusFilter, 
  setStatusFilter, 
  searchQuery, 
  setSearchQuery, 
  roomFilter, 
  setRoomFilter, 
  salones = [], 
  sellerFilter, 
  setSellerFilter, 
  users = [] 
}) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const salonesCount = Array.isArray(salones) ? salones.length : 0;

  // Extract optional week badge from dateLabel e.g. "15 sept — 21 sept 2026 S38"
  const weekMatch = String(dateLabel || '').match(/^(.*?)(?:\s+(S\d+))?$/);
  const mainDateText = weekMatch ? weekMatch[1] : dateLabel;
  const weekBadge = weekMatch ? weekMatch[2] : null;

  return (
    <header className="topbar-executive" style={{
      position: 'relative',
      backgroundColor: '#ffffff',
      borderBottom: '1px solid rgba(226, 232, 240, 0.9)',
      padding: '10px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      flexShrink: 0,
      zIndex: 1000,
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
      boxSizing: 'border-box'
    }}>
      {/* ─── FILA 1: NAVEGACIÓN DE FECHA, RANGO Y SELECTOR DE VISTAS ─── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        {/* Left: Date Navigator & Active Range Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onToday}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#334155',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              height: '32px',
              boxSizing: 'border-box'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
          >
            Hoy
          </button>

          {/* Chevrons [< | >] */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(241, 245, 249, 0.9)',
            borderRadius: '8px',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            padding: '2px',
            height: '32px',
            boxSizing: 'border-box'
          }}>
            <button
              type="button"
              onClick={onPrev}
              title="Anterior"
              style={{
                padding: '4px 6px',
                color: '#475569',
                border: 'none',
                backgroundColor: 'transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffffff'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div style={{ width: '1px', height: '14px', backgroundColor: '#cbd5e1', margin: '0 2px' }}></div>
            <button
              type="button"
              onClick={onNext}
              title="Siguiente"
              style={{
                padding: '4px 6px',
                color: '#475569',
                border: 'none',
                backgroundColor: 'transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffffff'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Active Range Badge with Interactive Popover */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(prev => !prev)}
              title="Haz clic para saltar a una fecha, mes o año específico"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: isDatePickerOpen 
                  ? '#f0fdf4' 
                  : 'linear-gradient(to bottom, #ffffff, rgba(248, 250, 252, 0.8))',
                border: isDatePickerOpen 
                  ? '1px solid #10b981' 
                  : '1px solid rgba(226, 232, 240, 0.9)',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                color: isDatePickerOpen ? '#065f46' : '#1e293b',
                letterSpacing: '-0.01em',
                boxShadow: isDatePickerOpen
                  ? '0 0 0 2px rgba(16, 185, 129, 0.15)'
                  : '0 1px 2px rgba(15, 23, 42, 0.03)',
                height: '32px',
                boxSizing: 'border-box',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                if (!isDatePickerOpen) e.currentTarget.style.backgroundColor = '#f8fafc';
              }}
              onMouseLeave={e => {
                if (!isDatePickerOpen) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
                <line x1="16" y1="2.5" x2="16" y2="5.5" />
                <line x1="8" y1="2.5" x2="8" y2="5.5" />
                <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
                <path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01M16 17h.01" strokeWidth="2.2" />
              </svg>
              <span>{mainDateText}</span>
              {weekBadge && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  backgroundColor: isDatePickerOpen ? '#dcfce7' : '#f1f5f9',
                  color: isDatePickerOpen ? '#15803d' : '#64748b',
                  fontWeight: 600,
                  marginLeft: '2px'
                }}>
                  {weekBadge}
                </span>
              )}
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke={isDatePickerOpen ? "#059669" : "#94a3b8"} 
                strokeWidth="2.2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{
                  transform: isDatePickerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease'
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* DatePickerPopover Dropdown */}
            <DatePickerPopover
              isOpen={isDatePickerOpen}
              onClose={() => setIsDatePickerOpen(false)}
              currentDate={currentDate}
              onSelectDate={(newDate) => {
                if (setCurrentDate) setCurrentDate(newDate);
              }}
            />
          </div>
        </div>

        {/* Right: Segmented View Controller & En vivo indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px',
            borderRadius: '8px',
            backgroundColor: 'rgba(241, 245, 249, 0.9)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            fontSize: '12px',
            fontWeight: 500,
            color: '#475569',
            boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
            height: '32px',
            boxSizing: 'border-box'
          }}>
            {views.map(v => {
              const active = viewMode === v.key;
              const activeColor = v.key === 'timeline' ? '#4f46e5' : '#047857';
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setViewMode(v.key)}
                  style={{
                    padding: active ? '4px 12px' : '4px 10px',
                    borderRadius: '6px',
                    border: active ? '1px solid rgba(226, 232, 240, 0.6)' : 'none',
                    backgroundColor: active ? '#ffffff' : 'transparent',
                    color: active ? activeColor : '#475569',
                    fontWeight: active ? 700 : 500,
                    fontSize: '12px',
                    cursor: 'pointer',
                    boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.05)' : 'none',
                    transition: 'all 0.15s ease',
                    height: '26px',
                    boxSizing: 'border-box'
                  }}
                >
                  {v.label}
                </button>
              );
            })}
          </div>

          {/* Realtime Live Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            paddingLeft: '10px',
            borderLeft: '1px solid #e2e8f0',
            height: '20px'
          }}>
            <span style={{ position: 'relative', display: 'flex', width: '8px', height: '8px' }}>
              <span className="cal-pulse-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#34d399', opacity: 0.75 }}></span>
              <span style={{ position: 'relative', borderRadius: '50%', width: '8px', height: '8px', background: '#10b981' }}></span>
            </span>
            <span style={{ fontSize: '11px', fontWeight: 500, color: '#64748b' }}>En vivo</span>
          </div>
        </div>
      </div>

      {/* ─── FILA 2: COMPACT FILTERS & OMNISEARCH BAR IN SINGLE ROW ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        paddingTop: '2px'
      }}>
        {/* Room Selector (w-48 = 192px) */}
        <div style={{ width: '192px', flexShrink: 0, position: 'relative' }}>
          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            style={{
              width: '100%',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: 'rgba(248, 250, 252, 0.8)',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '6px 30px 6px 12px',
              color: '#1e293b',
              cursor: 'pointer',
              appearance: 'none',
              height: '32px',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'all 0.15s ease'
            }}
          >
            <option value="all">Todos los Salones ({salonesCount})</option>
            {[...(salones || [])]
              .sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' }))
              .map(room => (
                <option key={room} value={room}>{room}</option>
              ))}
          </select>
          <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </div>

        {/* Vendedor Selector (w-44 = 176px) */}
        <div style={{ width: '176px', flexShrink: 0, position: 'relative' }}>
          <select
            value={sellerFilter}
            onChange={(e) => setSellerFilter(e.target.value)}
            style={{
              width: '100%',
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: 'rgba(248, 250, 252, 0.8)',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '6px 30px 6px 12px',
              color: '#334155',
              cursor: 'pointer',
              appearance: 'none',
              height: '32px',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'all 0.15s ease'
            }}
          >
            <option value="all">Todos los Vendedores</option>
            {(users || [])
              .filter(u => {
                const r = String(u.role || '').trim().toLowerCase();
                return ['admin','vendedor','recepcionista','frontoffice','front_office'].includes(r);
              })
              .sort((a, b) => {
                const nameA = (a.fullName || a.name || a.nombre || '').trim();
                const nameB = (b.fullName || b.name || b.nombre || '').trim();
                return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
              })
              .map(user => (
                <option key={user.id} value={user.id}>
                  {user.fullName || user.name || user.nombre}
                </option>
              ))}
          </select>
          <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </div>

        {/* Unified OmniSearch Bar with ⌘K */}
        <div 
          className="topbar-search-pill-container"
          style={{ 
            position: 'relative', 
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            height: '32px',
            backgroundColor: 'rgba(248, 250, 252, 0.9)',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '0 8px 0 10px',
            boxSizing: 'border-box',
            transition: 'all 0.15s ease',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)'
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.borderColor = '#10b981';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.15)';
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(248, 250, 252, 0.9)';
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.03)';
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, marginRight: '8px', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-input-naked"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, cotización, código o salón..."
            style={{
              flex: 1,
              width: '100%',
              minWidth: 0,
              height: '100%',
              fontSize: '12px',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#0f172a',
              boxSizing: 'border-box',
              WebkitAppearance: 'none',
              padding: 0
            }}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              title="Limpiar búsqueda"
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                padding: '2px 4px',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                WebkitAppearance: 'none'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          ) : (
            <kbd style={{
              padding: '2px 5px',
              fontSize: '9px',
              color: '#94a3b8',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              boxShadow: '0 1px 1px rgba(0,0,0,0.02)',
              fontFamily: 'monospace',
              fontWeight: 600,
              flexShrink: 0,
              marginLeft: '6px'
            }}>⌘K</kbd>
          )}
        </div>
      </div>

      <style>{`
        @keyframes calPulsePing {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(0.95); opacity: 0; }
        }
        .cal-pulse-ring {
          animation: calPulsePing 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        body:not(.informes-theme) .topbar-executive button {
          min-height: unset !important;
          box-sizing: border-box !important;
        }
        body:not(.informes-theme) .topbar-executive select {
          min-height: unset !important;
          box-sizing: border-box !important;
          background: rgba(248, 250, 252, 0.8) !important;
          background-color: rgba(248, 250, 252, 0.8) !important;
          color: #334155 !important;
          border: 1px solid #e2e8f0 !important;
        }
        body:not(.informes-theme) .topbar-executive input {
          min-height: unset !important;
          box-sizing: border-box !important;
          background: rgba(248, 250, 252, 0.8) !important;
          background-color: rgba(248, 250, 252, 0.8) !important;
          color: #0f172a !important;
          border: 1px solid #e2e8f0 !important;
        }
        body:not(.informes-theme) .topbar-executive input:focus {
          background: #ffffff !important;
          background-color: #ffffff !important;
          border-color: #10b981 !important;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2) !important;
        }
        body:not(.informes-theme) .topbar-executive input::placeholder {
          color: #94a3b8 !important;
        }
      `}</style>
    </header>
  );
}
