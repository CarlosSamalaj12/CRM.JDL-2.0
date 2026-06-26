import React from 'react';
import { STATUS_META } from '../../../modules/calendar/constants';

const views = [
  { key: 'day', label: 'Día' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
  { key: 'agenda', label: 'Agenda' },
];

export default function Topbar({ 
  viewMode, 
  setViewMode, 
  dateLabel, 
  onToday, 
  onPrev, 
  onNext, 
  statusFilter, 
  setStatusFilter, 
  isCalendarView,
  searchQuery,
  setSearchQuery,
  roomFilter,
  setRoomFilter,
  salones
}) {
  const isFilterActive = isCalendarView && (viewMode === 'month' || viewMode === 'week');

  return (
    <header className="topbar" style={{ 
      position: 'relative',
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '10px',
      padding: '10px 18px',
      minHeight: '62px',
      background: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
    }}>
      
      {/* 1. DATE NAVIGATION */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={onToday}
          style={{
            height: '34px',
            padding: '0 14px',
            fontSize: '12px',
            fontWeight: 700,
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            color: '#0f172a',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.15s ease',
            letterSpacing: '0.02em',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Hoy
        </button>

        <div style={{ display: 'flex', alignItems: 'center', height: '34px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <button
            onClick={onPrev}
            style={{
              width: '32px',
              height: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              transition: 'all 0.15s ease',
              padding: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div style={{
            minWidth: '160px',
            padding: '0 12px',
            fontSize: '12.5px',
            fontWeight: 600,
            color: '#0f172a',
            textAlign: 'center',
            borderLeft: '1px solid #e2e8f0',
            borderRight: '1px solid #e2e8f0',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
          }}>
            {dateLabel}
          </div>
          <button
            onClick={onNext}
            style={{
              width: '32px',
              height: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              transition: 'all 0.15s ease',
              padding: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. VIEW SELECTOR — SEGMENTED PILLS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: '#f1f5f9', borderRadius: '8px', padding: '2px', flexShrink: 0 }}>
        {views.map(v => {
          const active = viewMode === v.key;
          return (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              style={{
                height: '30px',
                padding: '0 12px',
                fontSize: '11.5px',
                fontWeight: active ? 700 : 500,
                borderRadius: '6px',
                border: 'none',
                background: active ? '#ffffff' : 'transparent',
                color: active ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: active ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.background = '#e2e8f0'; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent'; } }}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {/* 3. STATUS FILTER */}
      <div style={{ flexShrink: 0 }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            height: '34px',
            minWidth: '140px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '8px',
            padding: '0 10px',
            border: isFilterActive ? `2px solid ${STATUS_META[statusFilter]?.color || '#e2e8f0'}` : '1px solid #e2e8f0',
            color: isFilterActive ? (STATUS_META[statusFilter]?.color || '#0f172a') : '#64748b',
            background: isFilterActive ? `${STATUS_META[statusFilter]?.color || '#ffffff'}10` : '#ffffff',
            outline: 'none',
            appearance: 'auto',
          }}
        >
          <option value="all">Todos los Estados</option>
          {Object.entries(STATUS_META).map(([status, meta]) => (
            <option key={status} value={status} style={{ color: meta.color }}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* 4. ROOM FILTER */}
      <div style={{ flexShrink: 0 }}>
        <select
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
          style={{
            height: '34px',
            minWidth: '130px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            borderRadius: '8px',
            padding: '0 10px',
            border: '1px solid #e2e8f0',
            color: '#475569',
            background: '#ffffff',
            outline: 'none',
            appearance: 'auto',
          }}
        >
          <option value="all">Todos los Salones</option>
          {salones?.map(room => (
            <option key={room} value={room}>{room}</option>
          ))}
        </select>
      </div>

      {/* 5. SEARCH */}
      <div style={{ flex: '1 1 180px', minWidth: '120px' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: '34px',
          padding: '0 10px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          transition: 'border-color 0.15s ease',
        }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar evento..."
            style={{
              fontSize: '12px',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              boxShadow: 'none',
              color: '#0f172a',
              width: '100%',
              fontWeight: 500,
            }}
            autoComplete="off"
          />
        </label>
      </div>
    </header>
  );
}
