import React from 'react';
import { STATUS_META } from '../../../modules/calendar/constants';

export default function Topbar({ viewMode, setViewMode, dateLabel, onToday, onPrev, onNext, statusFilter, setStatusFilter, isCalendarView }) {
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
      background: '#fff',
      borderBottom: '1px solid #d3e4fe'
    }}>
      
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
            background: 'white',
            borderLeft: '1px solid #d3e4fe',
            borderRight: '1px solid #d3e4fe',
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

      {/* FILTRO DE ESTADO (solo para mes y semana) - visible siempre pero solo funciona en esas vistas */}
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
            border: isFilterActive ? `2px solid ${STATUS_META[statusFilter]?.color || '#e2e8f0'}` : '1px solid #e2e8f0',
            color: isFilterActive ? (STATUS_META[statusFilter]?.color || '#64748b') : '#64748b',
            background: isFilterActive ? `${STATUS_META[statusFilter]?.color || '#e2e8f0'}10` : '#fff'
          }}
        >
          <option value="all">Todos</option>
          {Object.entries(STATUS_META).map(([status, meta]) => (
            <option key={status} value={status} style={{ color: meta.color }}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* 3. SELECTOR DE SALONES */}
      <div style={{ flexShrink: 0 }}>
        <select id="roomSelect" className="formSelect" style={{ height: '36px', minWidth: '130px', fontSize: '12px', cursor: 'pointer' }}>
          <option value="todos">Todos</option>
          <option value="flores">Las Flores</option>
          <option value="lago">El Lago</option>
        </select>
      </div>

      {/* 4. BARRA DE BUSQUEDA */}
      <div style={{ flex: '1 1 200px', minWidth: '120px' }}>
        <label className="lum-search" style={{ margin: '0', height: '36px' }}>
          <span className="material-symbols-outlined">search</span>
          <input type="text" placeholder="Buscar eventos, clientes o salones..." style={{ fontSize: '12px' }} />
        </label>
      </div>

    </header>
  );
}
