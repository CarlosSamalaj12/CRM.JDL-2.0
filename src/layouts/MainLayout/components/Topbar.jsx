import React from 'react';
import { STATUS_META } from '../../../modules/calendar/constants';

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
      gap: '8px',
      padding: '8px 16px',
      minHeight: '66px',
      background: 'var(--ui-surface)',
      borderBottom: '1px solid var(--ui-border)'
    }}>
      
      {/* Grupo superior: Navegación y selector de vista */}
      <div className="topbar-nav-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* 1. BARRA DE FECHA DINAMICA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button 
            className="btn" 
            onClick={onToday}
            style={{ height: '36px', padding: '0 10px', fontSize: '12px' }}
          >Hoy</button>
          
          <div className="nav" style={{ display: 'flex', alignItems: 'center', height: '36px' }}>
            <button className="iconBtn" onClick={onPrev} style={{ width: '28px', height: '100%', borderRight: '0' }}>&lsaquo;</button>
            <div className="weekLabel" style={{ 
              minWidth: '140px', 
              fontSize: '12px',
              padding: '0 8px',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--ui-surface)',
              borderLeft: '1px solid var(--ui-border)',
              borderRight: '1px solid var(--ui-border)',
              fontWeight: '600',
              textTransform: 'capitalize'
            }}>
              {dateLabel}
            </div>
            <button className="iconBtn" onClick={onNext} style={{ width: '28px', height: '100%', borderLeft: '0' }}>&rsaquo;</button>
          </div>
        </div>

        {/* 2. SELECTOR DE VISTA (Dia, Semana, Mes, Año, Agenda) */}
        <div style={{ flexShrink: 0 }}>
          <select 
            id="navMode" 
            className="formSelect" 
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            style={{ height: '36px', minWidth: '80px', fontSize: '12px', cursor: 'pointer' }}
          >
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
            <option value="year">Año</option>
            <option value="agenda">Agenda</option>
          </select>
        </div>
      </div>

      {/* Grupo inferior/filtros: Búsqueda y Filtros de Estado y Salones */}
      <div className="topbar-filters-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', flexWrap: 'wrap' }}>
        {/* FILTRO DE ESTADO (solo para mes y semana) */}
        <div style={{ flexShrink: 0 }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="formSelect"
            style={{
              height: '36px',
              minWidth: '130px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '600',
              border: isFilterActive ? `2px solid ${STATUS_META[statusFilter]?.color || 'var(--ui-border)'}` : '1px solid var(--ui-border)',
              color: isFilterActive ? (STATUS_META[statusFilter]?.color || 'var(--ui-text-muted)') : 'var(--ui-text-muted)',
              background: isFilterActive ? `${STATUS_META[statusFilter]?.color || 'var(--ui-border)'}10` : 'var(--ui-surface)'
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

        {/* 3. SELECTOR DE SALONES */}
        <div style={{ flexShrink: 0 }}>
          <select 
            id="roomSelect" 
            className="formSelect" 
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            style={{ height: '36px', minWidth: '130px', fontSize: '12px', cursor: 'pointer' }}
          >
            <option value="all">Todos los Salones</option>
            {salones?.map(room => (
              <option key={room} value={room}>{room}</option>
            ))}
          </select>
        </div>

        {/* 4. BARRA DE BUSQUEDA */}
        <div style={{ flex: '1 1 200px', minWidth: '120px' }}>
          <label className="lum-search" style={{ margin: '0', height: '36px' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#64748b', marginRight: '4px' }}>
              <circle cx="11" cy="11" r="7" />
              <path d="m16 16 4 4" />
            </svg>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '12px', border: 'none', outline: 'none', background: 'transparent', boxShadow: 'none' }} 
              autoComplete="off"
            />
          </label>
        </div>
      </div>
    </header>
  );
}
