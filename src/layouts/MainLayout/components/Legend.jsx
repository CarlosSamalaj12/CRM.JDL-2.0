import React, { useMemo } from 'react';

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const STATUS_CONFIGS = [
  { key: 'Reserva sin Cotizacion', label: 'Sin Cotización', bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd', dot: '#0ea5e9' },
  { key: 'Pre reserva', label: 'Pre-reserva', bg: '#fdf4ff', text: '#86198f', border: '#f5d0fe', dot: '#d946ef' },
  { key: 'Confirmado', label: 'Confirmado', bg: '#f0fdfa', text: '#115e59', border: '#99f6e4', dot: '#14b8a6' },
  { key: '1er Cotizacion', label: '1er Cotización', bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', dot: '#10b981' },
  { key: 'Seguimiento', label: 'Seguimiento', bg: '#fffbeb', text: '#78350f', border: '#fde68a', dot: '#f59e0b' },
  { key: 'Lista de Espera', label: 'Lista de Espera', bg: '#fefce8', text: '#854d0e', border: '#fef08a', dot: '#eab308' },
  { key: 'Perdido', label: 'Perdido', bg: '#fff1f2', text: '#9f1239', border: '#fecdd3', dot: '#f43f5e' },
  { key: 'Cancelado', label: 'Cancelado', bg: '#fff1f2', text: '#9f1239', border: '#fecdd3', dot: '#e11d48' },
  { key: 'Mantenimiento', label: 'Mantenimiento', bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff', dot: '#a855f7' },
  { key: 'Mantenimiento Realizado', label: 'Mantenimiento Realizado', bg: '#f1f5f9', text: '#334155', border: '#e2e8f0', dot: '#94a3b8' },
];

export default function Legend({ 
  statusFilter = 'all', 
  setStatusFilter = () => {}, 
  events = [], 
  currentDate = new Date(), 
  viewMode = 'week',
  onResetFilters = () => {}
}) {
  // Filtrar eventos visibles en el rango actual para calcular contadores reales
  const visibleEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];
    
    if (viewMode === 'week') {
      const d = new Date(currentDate);
      const day = d.getDay();
      const start = new Date(d.setDate(d.getDate() - day));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const startStr = formatDate(start);
      const endStr = formatDate(end);
      return events.filter(e => e.date && e.date >= startStr && e.date <= endStr);
    } else if (viewMode === 'day') {
      const dStr = formatDate(currentDate);
      return events.filter(e => e.date === dStr);
    } else if (viewMode === 'month') {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const prefix = `${year}-${month}`;
      return events.filter(e => e.date && e.date.startsWith(prefix));
    }
    return events;
  }, [events, currentDate, viewMode]);

  // Contadores por estado
  const statusCounts = useMemo(() => {
    const map = {};
    for (const cfg of STATUS_CONFIGS) {
      map[cfg.key] = 0;
    }
    for (const ev of visibleEvents) {
      const st = ev.status;
      if (st && map[st] !== undefined) {
        map[st]++;
      }
    }
    return map;
  }, [visibleEvents]);

  const totalVisibleCount = visibleEvents.length;

  return (
    <section 
      className="status-legend-bar" 
      id="legend" 
      style={{ 
        padding: '6px 20px',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        fontSize: '12px',
        userSelect: 'none',
        flexShrink: 0,
        boxSizing: 'border-box'
      }}
    >
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        width: '100%',
        padding: '2px 0'
      }}>
        {/* Left: Filtros Icon & Chips */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px',
          flex: 1,
          minWidth: 0
        }}>
          {/* Label Filtros */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: '#94a3b8',
            fontWeight: 700,
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            paddingRight: '4px',
            flexShrink: 0
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <span>Filtros</span>
          </div>

          {/* Chip "Todos" */}
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: statusFilter === 'all' ? '#0f172a' : '#ffffff',
              color: statusFilter === 'all' ? '#ffffff' : '#334155',
              border: statusFilter === 'all' ? '1px solid #0f172a' : '1px solid #cbd5e1',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
          >
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#34d399'
            }}></span>
            <span>Todos</span>
            <span style={{
              marginLeft: '2px',
              padding: '1px 6px',
              borderRadius: '999px',
              fontSize: '10px',
              fontFamily: 'monospace',
              fontWeight: 700,
              backgroundColor: statusFilter === 'all' ? '#1e293b' : '#f1f5f9',
              color: statusFilter === 'all' ? '#e2e8f0' : '#475569'
            }}>
              {totalVisibleCount}
            </span>
          </button>

          {/* Chips por Estado */}
          {STATUS_CONFIGS.map(cfg => {
            const isActive = statusFilter === cfg.key;
            const count = statusCounts[cfg.key] || 0;
            return (
              <button
                key={cfg.key}
                type="button"
                onClick={() => setStatusFilter(isActive ? 'all' : cfg.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: isActive ? 700 : 500,
                  backgroundColor: cfg.bg,
                  color: cfg.text,
                  border: isActive ? `2px solid ${cfg.dot}` : `1px solid ${cfg.border}`,
                  boxShadow: isActive ? '0 0 0 1px rgba(15, 23, 42, 0.08)' : '0 1px 1px rgba(0, 0, 0, 0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
              >
                <span style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: cfg.dot,
                  boxShadow: `0 0 4px ${cfg.dot}66`
                }}></span>
                <span>{cfg.label}</span>
                <span style={{
                  marginLeft: '2px',
                  padding: '1px 5px',
                  borderRadius: '999px',
                  fontSize: '9px',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  backgroundColor: '#ffffff',
                  color: cfg.text,
                  border: `1px solid ${cfg.border}`
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Limpiar Filtros & Total Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
          paddingLeft: '8px',
          borderLeft: '1px solid #e2e8f0'
        }}>
          <button
            type="button"
            onClick={onResetFilters}
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: '#64748b',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '6px',
              padding: '3px 8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>Limpiar filtros</span>
          </button>

          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: 'monospace',
            color: '#64748b',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            padding: '2px 8px',
            borderRadius: '6px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)'
          }}>
            {totalVisibleCount} eventos
          </span>
        </div>
      </div>

      <style>{`
        body:not(.informes-theme) .status-legend-bar button {
          min-height: unset !important;
          box-sizing: border-box !important;
        }
      `}</style>
    </section>
  );
}
