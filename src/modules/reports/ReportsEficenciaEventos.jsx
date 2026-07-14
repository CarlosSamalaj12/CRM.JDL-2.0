import { useState, useMemo, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import ReportInfo from './components/ReportInfo';

function getLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthName(m) {
  return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m] || '';
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// All statuses with colors from constants.js, ordered by pipeline
const STATUS_META = [
  { key: 'Reserva sin Cotizacion', label: 'Reserva sin Cotización', color: '#00A3FF' },
  { key: '1er Cotizacion', label: '1ra Cotización', color: '#007A64' },
  { key: 'Seguimiento', label: 'Negociación', color: '#FF8C00' },
  { key: 'Lista de Espera', label: 'Lista de Espera', color: '#FFD700' },
  { key: 'Pre reserva', label: 'Pre-Reserva', color: '#FF00CC' },
  { key: 'Confirmado', label: 'Confirmado', color: '#00CC66' },
  { key: 'Cancelado', label: 'Cancelado', color: '#FF3333' },
  { key: 'Perdido', label: 'Perdido', color: '#FF9A9E' },
  { key: 'Mantenimiento', label: 'Mantenimiento', color: '#8A2BE2' },
  { key: 'Mantenimiento Realizado', label: 'Mant. Realizado', color: '#94a3b8' },
  { key: 'Realizado', label: 'Realizado', color: '#22c55e' },
];

export default function ReportsEficenciaEventos({ onClose }) {
  const { events } = useOutletContext();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [fromDate, setFromDate] = useState(getLocalDateStr(firstOfMonth));
  const [toDate, setToDate] = useState(getLocalDateStr(lastOfMonth));
  const [hoveredSegment, setHoveredSegment] = useState(null); // { monthIdx, segIdx }
  const [hoveredSegPos, setHoveredSegPos] = useState(null);
  const [enabledStatuses, setEnabledStatuses] = useState(() => new Set(STATUS_META.map(s => s.key)));
  const [statusDropOpen, setStatusDropOpen] = useState(false);
  const statusDropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (statusDropRef.current && !statusDropRef.current.contains(e.target)) {
        setStatusDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleStatus = (key) => {
    setEnabledStatuses(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Generate months ──
  const monthList = useMemo(() => {
    const months = [];
    const start = new Date(fromDate + 'T00:00:00');
    const end = new Date(toDate + 'T00:00:00');
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      months.push({
        key: `${y}-${String(m + 1).padStart(2, '0')}`,
        year: y,
        month: m,
        monthName: getMonthName(m),
        monthShort: getMonthName(m).substring(0, 3),
        daysInMonth: daysInMonth(y, m),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }, [fromDate, toDate]);

  // ── Aggregate events by month + status ──
  const chartData = useMemo(() => {
    if (!events || !monthList.length) return [];

    const from = monthList[0].key + '-01';
    const to = monthList[monthList.length - 1].key + '-' + String(monthList[monthList.length - 1].daysInMonth).padStart(2, '0');

    // Count events per month per status
    const monthStatusCounts = {}; // { "YYYY-MM": { "Confirmado": 5, "Cancelado": 2, ... } }
    const monthTotals = {};       // { "YYYY-MM": totalEvents }

    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) continue;
      const monthKey = d.substring(0, 7);
      const status = String(ev.status || 'Reserva sin Cotizacion').trim();

      if (!monthStatusCounts[monthKey]) {
        monthStatusCounts[monthKey] = {};
        monthTotals[monthKey] = 0;
      }
      monthStatusCounts[monthKey][status] = (monthStatusCounts[monthKey][status] || 0) + 1;
      monthTotals[monthKey] = (monthTotals[monthKey] || 0) + 1;
    }

    return monthList.map(m => {
      const counts = monthStatusCounts[m.key] || {};
      const total = monthTotals[m.key] || 0;

      // Build segments for each status
      const allSegments = STATUS_META.map(s => {
        const count = counts[s.key] || 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return {
          statusKey: s.key,
          label: s.label,
          color: s.color,
          count,
          pct,
        };
      });

      // Sort: statuses that have 0% go last, but keep relative order
      allSegments.sort((a, b) => {
        if (a.pct === 0 && b.pct > 0) return 1;
        if (b.pct === 0 && a.pct > 0) return -1;
        return 0;
      });

      // Compute totals for enabled statuses only
      const visibleTotal = allSegments.reduce((sum, s) => enabledStatuses.has(s.statusKey) ? sum + s.count : sum, 0);

      const segments = allSegments.map(s => ({
        ...s,
        visible: enabledStatuses.has(s.statusKey),
        visiblePct: visibleTotal > 0 && enabledStatuses.has(s.statusKey) ? (s.count / visibleTotal) * 100 : 0,
      }));

      return {
        monthKey: m.key,
        monthName: m.monthName,
        monthShort: m.monthShort,
        year: m.year,
        total,
        visibleTotal,
        segments,
        activeStatuses: segments.filter(s => s.count > 0 && s.visible),
      };
    });
  }, [events, monthList, enabledStatuses]);

  // ── Aggregated KPIs ──
  const totalEvents = useMemo(() => chartData.reduce((s, m) => s + m.total, 0), [chartData]);
  const totalVisibleEvents = useMemo(() => chartData.reduce((s, m) => s + m.visibleTotal, 0), [chartData]);
  const totalMonths = monthList.length;

  // Total per status across all months (raw)
  const statusTotals = useMemo(() => {
    const acc = {};
    for (const m of chartData) {
      for (const seg of m.segments) {
        acc[seg.statusKey] = (acc[seg.statusKey] || 0) + seg.count;
      }
    }
    return acc;
  }, [chartData]);

  // Status with most events
  const topStatus = useMemo(() => {
    let max = { key: '', count: 0 };
    for (const [key, count] of Object.entries(statusTotals)) {
      if (enabledStatuses.has(key) && count > max.count) max = { key, count };
    }
    return max;
  }, [statusTotals, enabledStatuses]);

  const hasActiveFilter = enabledStatuses.size < STATUS_META.length;

  // ── Tooltip data ──
  const hoveredSegData = useMemo(() => {
    if (!hoveredSegment) return null;
    const month = chartData[hoveredSegment.monthIdx];
    if (!month) return null;
    const seg = month.segments[hoveredSegment.segIdx];
    return seg && seg.count > 0 ? { seg, month } : null;
  }, [hoveredSegment, chartData]);

  // ── Animation state ──
  const [animationPhase, setAnimationPhase] = useState('complete');
  const [visibleBars, setVisibleBars] = useState(9999);
  const animationKeyRef = useRef(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (chartData.length > 0) {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        setAnimationPhase('complete');
        setVisibleBars(chartData.length);
        return;
      }
      animationKeyRef.current += 1;
      const currentKey = animationKeyRef.current;
      setAnimationPhase('initial');
      setVisibleBars(0);

      let interval;
      const timer = setTimeout(() => {
        if (currentKey !== animationKeyRef.current) return;
        setAnimationPhase('animating');
        let i = 0;
        interval = setInterval(() => {
          i++;
          if (currentKey !== animationKeyRef.current) { clearInterval(interval); return; }
          setVisibleBars(i);
          if (i >= chartData.length) {
            clearInterval(interval);
            setAnimationPhase('complete');
          }
        }, 25);
      }, 100);
      return () => {
        clearTimeout(timer);
        if (interval) clearInterval(interval);
      };
    }
  }, [chartData]);

  const handleReset = () => {
    const t = new Date();
    setFromDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth(), 1)));
    setToDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth() + 1, 0)));
  };

  const sectionStyle = (delay) => ({
    opacity: animationPhase === 'initial' ? 0 : 1,
    transform: animationPhase === 'initial' ? 'translateY(20px)' : 'translateY(0)',
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
  });

  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="reports-page-container">
      <style>{`@keyframes tooltipFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {/* Header */}
      <div className="reports-page-header">
        <div className="reports-brand-header">
          <div className="reports-brand-badge">
            <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
          </div>
          <div>
            <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
            <div className="reports-title">📊 Eficiencia de Eventos por Estado</div>
            <div className="reports-subtitle">Distribución porcentual mensual de eventos por estado · 100% = total de eventos del mes</div>
          </div>
        </div>
        <ReportInfo reportKey="eficienciaEventos" />
        <button className="btn-exit" type="button" onClick={onClose}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver
        </button>
      </div>

      <div className="reports-page-body">
        {/* ── Hero ── */}
        <section className="reports-hero-panel" style={sectionStyle(50)}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Eficiencia por estado</span>
              <h3 className="reports-section-title">% de eventos por estado cada mes</h3>
              <p className="reports-section-text">
                Cada barra representa un mes y está dividida en segmentos por estado. Pasa el mouse sobre cada segmento para ver detalles.
                El ancho de cada segmento representa el % de eventos en ese estado respecto al total del mes.
              </p>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="reports-toolbar" style={{ gap: '16px', padding: '16px 20px' }}>
            <label className="field" style={{ flex: '0 0 148px' }}>
              <span>Desde</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '0 0 148px' }}>
              <span>Hasta</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </label>
            <div className="reports-actions" style={{ gap: '8px' }}>
              <button type="button" onClick={handleReset}>Mes Actual</button>
            </div>

            {/* Mini KPI chips */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                📅 <strong style={{ color: '#0f172a' }}>{totalMonths}</strong> {totalMonths === 1 ? 'mes' : 'meses'}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                📋 <strong style={{ color: '#0f172a' }}>{totalEvents}</strong> eventos
              </span>
              {topStatus.key && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🏆 <strong style={{ color: '#0f172a' }}>{STATUS_META.find(s => s.key === topStatus.key)?.label || topStatus.key}</strong> {Math.round((topStatus.count / totalEvents) * 100)}%
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ── Storytelling ── */}
        <div className="reports-storytelling-card" style={sectionStyle(200)}>
          <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Análisis del período</span>
          <p className="reports-story-text">
            {hasActiveFilter ? (
              <>En el rango del <strong className="highlight-slate">{fromDate}</strong> al <strong className="highlight-slate">{toDate}</strong> hay <strong className="highlight-blue">{totalVisibleEvents}</strong> eventos visibles (de {totalEvents} totales) en <strong className="highlight-slate">{totalMonths}</strong> {totalMonths === 1 ? 'mes' : 'meses'}.
              {topStatus.key ? ` El estado predominante visible es <strong className="highlight-blue">{STATUS_META.find(s => s.key === topStatus.key)?.label || topStatus.key}</strong> con <strong className="highlight-green">{topStatus.count}</strong> eventos ({Math.round((topStatus.count / totalVisibleEvents) * 100)}% de visibles).` : ''}
              {STATUS_META.filter(s => enabledStatuses.has(s.key) && (s.key === 'Confirmado' || s.key === 'Seguimiento')).map(s => {
                const c = statusTotals[s.key] || 0;
                return c > 0 ? ` Eventos en "${s.label}": ${c} (${Math.round((c / totalVisibleEvents) * 100)}% de visibles).` : '';
              }).join('')}
            </>) : (
              <>En el rango del <strong className="highlight-slate">{fromDate}</strong> al <strong className="highlight-slate">{toDate}</strong> se registraron <strong className="highlight-blue">{totalEvents}</strong> eventos distribuidos en <strong className="highlight-slate">{totalMonths}</strong> {totalMonths === 1 ? 'mes' : 'meses'}. 
              El estado predominante es <strong className="highlight-blue">{STATUS_META.find(s => s.key === topStatus.key)?.label || topStatus.key}</strong> con <strong className="highlight-green">{topStatus.count}</strong> eventos ({Math.round((topStatus.count / totalEvents) * 100)}% del total).
              {STATUS_META.filter(s => s.key === 'Confirmado' || s.key === 'Seguimiento').map(s => {
                const c = statusTotals[s.key] || 0;
                return c > 0 ? ` Eventos en "${s.label}": ${c} (${Math.round((c / totalEvents) * 100)}%).` : '';
              }).join('')}
            </>)}
          </p>
        </div>

        {/* ── Stacked Bar Chart ── */}
        <section className="reports-hero-panel" style={{ gap: '12px', ...sectionStyle(350) }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Gráfico de barras apiladas</span>
              <h3 className="reports-section-title">Distribución de Estados × Mes</h3>
              <p className="reports-section-text">Pasa el mouse sobre cada segmento para ver el estado, cantidad y porcentaje</p>
            </div>
            {/* Status dropdown */}
            <div style={{ position: 'relative' }} ref={statusDropRef}>
              <button
                type="button"
                onClick={() => setStatusDropOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px',
                  border: `1px solid ${statusDropOpen ? '#2563eb' : '#e2e8f0'}`,
                  borderRadius: '20px', background: '#ffffff',
                  boxShadow: statusDropOpen ? '0 0 0 2px #2563eb30' : '0 1px 3px #00000008',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                  cursor: 'pointer', outline: 'none',
                }}
              >
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>FILTRO:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', overflow: 'hidden' }}>
                  {[...enabledStatuses].map(k => {
                    const s = STATUS_META.find(m => m.key === k);
                    return s ? (
                      <span key={k} title={s.label} style={{
                        width: 10, height: 10, borderRadius: '50%', background: s.color,
                        flexShrink: 0, boxShadow: `0 0 0 2px ${s.color}25`,
                      }} />
                    ) : null;
                  })}
                  {enabledStatuses.size === 0 && (
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>Ninguno</span>
                  )}
                </div>
                <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0, transform: statusDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  <path d="M2 4l4 4 4-4" />
                </svg>
              </button>
              {statusDropOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: '#ffffff', borderRadius: '16px',
                  boxShadow: '0 8px 32px #00000020', zIndex: 999,
                  overflow: 'hidden', padding: '6px', minWidth: 240,
                }}>
                  {STATUS_META.map(s => {
                    const active = enabledStatuses.has(s.key);
                    return (
                      <label key={s.key} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 10px', cursor: 'pointer',
                        borderRadius: '10px', marginBottom: '2px',
                        transition: 'background 0.1s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = active ? `${s.color}12` : '#f1f5f9'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: '5px', flexShrink: 0,
                          background: active ? '#2563eb' : '#f1f5f9',
                          border: active ? 'none' : '1.5px solid #cbd5e1',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {active && (
                            <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          )}
                        </div>
                        <input type="checkbox" checked={active} onChange={() => toggleStatus(s.key)} style={{ display: 'none' }} />
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569', flex: 1 }}>{s.label}</span>
                      </label>
                    );
                  })}
                  {enabledStatuses.size < STATUS_META.length && (
                    <div style={{ padding: '4px 10px 2px', borderTop: '1px solid #f1f5f9', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => { setEnabledStatuses(new Set(STATUS_META.map(m => m.key))); setStatusDropOpen(false); }}
                        style={{
                          width: '100%', padding: '6px', borderRadius: '10px',
                          background: '#f1f5f9', color: '#2563eb',
                          border: 'none', fontSize: '12px', fontWeight: 700,
                          cursor: 'pointer', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                      >
                        Restaurar todos
                      </button>
                    </div>
                  )}
                  <div style={{ padding: '6px 10px 4px', borderTop: enabledStatuses.size < STATUS_META.length ? 'none' : '1px solid #f1f5f9', marginTop: enabledStatuses.size < STATUS_META.length ? '0' : '4px' }}>
                    <button
                      type="button"
                      onClick={() => setStatusDropOpen(false)}
                      style={{
                        width: '100%', padding: '8px', borderRadius: '14px',
                        background: '#2563eb', color: '#ffffff',
                        border: 'none', fontSize: '13px', fontWeight: 700,
                        cursor: 'pointer', boxShadow: '0 2px 8px #2563eb40',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#1d4ed8'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#2563eb'; }}
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Chart container ── */}
          <div style={{
            background: '#ffffff', borderRadius: '14px', padding: '24px 20px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
            border: '1px solid #f1f5f9',
          }}>
            {/* Scale at top */}
            <div style={{ display: 'flex', marginBottom: '8px', paddingLeft: '80px', fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>
              {[0, 25, 50, 75, 100].map(pct => (
                <span key={pct} style={{ position: 'absolute', left: `${80 + pct * (100 / 4)}px`, transform: 'translateX(-50%)' }}>
                  {pct}%
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px' }}>
              {/* Y-axis: month names */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', width: '70px', flexShrink: 0 }}>
                {chartData.map((monthData) => {
                  const isCurrentMonth = monthData.monthKey === currentMonthKey;
                  return (
                    <div key={monthData.monthKey} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                      height: '32px', paddingRight: '6px',
                    }}>
                      <span style={{
                        fontSize: isCurrentMonth ? '10px' : '9px',
                        fontWeight: isCurrentMonth ? 900 : 600,
                        color: isCurrentMonth ? '#2563eb' : '#94a3b8',
                        whiteSpace: 'nowrap',
                      }}>
                        {monthData.monthShort} {monthData.year.toString().slice(2)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Bars area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', position: 'relative', minHeight: `${Math.max(chartData.length * 36, 200)}px` }}>
                {/* Grid lines */}
                {[25, 50, 75].map(pct => (
                  <div key={pct} style={{
                    position: 'absolute', top: 0, bottom: 0, left: `${pct}%`,
                    width: '1px', background: '#f1f5f9', pointerEvents: 'none',
                    borderLeft: '1px dashed #e2e8f0',
                  }} />
                ))}

                {chartData.length === 0 ? (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700, color: '#94a3b8',
                    flexDirection: 'column', gap: '8px',
                  }}>
                    <span style={{ fontSize: '32px' }}>📭</span>
                    <span>No hay eventos en este período</span>
                  </div>
                ) : chartData.map((monthData, monthIdx) => {
                  const isCurrentMonth = monthData.monthKey === currentMonthKey;
                  const totalVisible = monthData.segments.filter(s => s.visible && s.count > 0).reduce((sum, s) => sum + s.visiblePct, 0);

                  return (
                    <div
                      key={monthData.monthKey}
                      style={{
                        height: '32px', display: 'flex', alignItems: 'center',
                        position: 'relative', gap: '8px',
                        opacity: monthIdx < visibleBars ? 1 : (animationPhase === 'initial' ? 0 : 1),
                        transition: 'opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                    >
                      {/* Stacked bar */}
                      <div style={{
                        flex: 1, height: isCurrentMonth ? '24px' : '20px',
                        borderRadius: '6px', overflow: 'hidden',
                        background: '#f1f5f9',
                        display: 'flex',
                        transition: 'height 0.15s ease',
                        boxShadow: isCurrentMonth ? '0 2px 8px rgba(37,99,235,0.15)' : 'none',
                      }}>
                        {monthData.segments.map((seg, segIdx) => {
                          if (!seg.visible || seg.count <= 0) return null;
                          const isHovered = hoveredSegment?.monthIdx === monthIdx && hoveredSegment?.segIdx === segIdx;
                          return (
                            <div
                              key={seg.statusKey}
                              style={{
                                width: `${seg.visiblePct}%`,
                                height: '100%',
                                background: isHovered ? `linear-gradient(90deg, ${seg.color}, ${seg.color}dd)` : seg.color,
                                transition: 'all 0.15s ease',
                                cursor: 'pointer',
                                borderRight: '1px solid rgba(255,255,255,0.3)',
                                filter: isHovered ? 'brightness(1.15)' : 'none',
                                minWidth: seg.visiblePct > 0 ? '2px' : '0',
                              }}
                              onMouseEnter={(e) => {
                                setHoveredSegment({ monthIdx, segIdx });
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredSegPos({ x: rect.right, y: rect.top + rect.height / 2 });
                              }}
                              onMouseLeave={() => { setHoveredSegment(null); setHoveredSegPos(null); }}
                            />
                          );
                        })}
                      </div>

                      {/* Total % at end of bar */}
                      <div style={{
                        fontSize: '9px', fontWeight: 800, color: '#94a3b8',
                        width: '40px', textAlign: 'right', flexShrink: 0,
                      }}>
                        {Math.round(totalVisible)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Date range */}
            <div style={{ display: 'flex', marginTop: '12px', paddingLeft: '78px', fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>
              {chartData.length > 0 && (
                <span>{chartData[0].monthName} {chartData[0].year}</span>
              )}
              {chartData.length > 1 && (
                <span style={{ marginLeft: 'auto' }}>{chartData[chartData.length - 1].monthName} {chartData[chartData.length - 1].year}</span>
              )}
            </div>
          </div>
        </section>

        {/* ── Premium Tooltip (fixed position, outside overflow containers) ── */}
        {hoveredSegData && hoveredSegPos && (() => {
          const { seg, month } = hoveredSegData;
          return (
            <div style={{
              position: 'fixed',
              left: `${Math.min(hoveredSegPos.x + 12, window.innerWidth - 260)}px`,
              top: `${Math.max(10, hoveredSegPos.y - 40)}px`,
              transform: 'translateY(-50%)',
              zIndex: 99999,
              pointerEvents: 'none',
            }}>
              <div style={{
                background: '#0f172a', color: '#fff',
                padding: '12px 16px',
                borderRadius: '12px',
                fontSize: '11px', fontWeight: 600,
                boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                minWidth: '200px',
                maxWidth: '280px',
                animation: 'tooltipFadeIn 0.15s ease-out both',
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{
                      width: '10px', height: '10px', borderRadius: '3px',
                      background: seg.color, display: 'inline-block', flexShrink: 0
                    }} />
                    <strong style={{ fontSize: '13px', color: seg.color }}>{seg.label}</strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', fontSize: '10px', color: '#cbd5e1' }}>
                    <span style={{ color: '#94a3b8' }}>📋 Eventos</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{seg.count}</span>
                    <span style={{ color: '#94a3b8' }}>📊 Porcentaje</span>
                    <span style={{ fontWeight: 800, color: seg.color }}>{Math.round(seg.visiblePct)}%</span>
                    <span style={{ color: '#94a3b8' }}>📅 Mes</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{month.monthName} {month.year}</span>
                    <span style={{ color: '#94a3b8' }}>📋 Total mes</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{month.visibleTotal} {month.visibleTotal === 1 ? 'evento' : 'eventos'} visibles</span>
                  </div>
                </div>
                <div style={{
                  position: 'absolute', top: '50%', right: '100%',
                  transform: 'translateY(-50%)',
                  width: 0, height: 0,
                  borderTop: '6px solid transparent',
                  borderBottom: '6px solid transparent',
                  borderRight: '6px solid #0f172a',
                }} />
              </div>
            </div>
          );
        })()}

        {/* ── Monthly table ── */}
        <section className="reports-hero-panel" style={{ gap: '8px', ...sectionStyle(500) }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Tabla mensual detallada</span>
              <h3 className="reports-section-title">Desglose por estado × mes</h3>
            </div>
          </div>

          <div className="reports-table-wrap" style={{ maxHeight: '500px' }}>
            <table className="reports-table" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Total</th>
                  {STATUS_META.filter(s => enabledStatuses.has(s.key)).map(s => (
                    <th key={s.key} style={{ textAlign: 'center', fontSize: '9px', padding: '8px 4px' }}>
                      <span style={{
                        display: 'inline-block', width: '8px', height: '8px',
                        borderRadius: '2px', background: s.color, marginRight: '3px',
                        verticalAlign: 'middle',
                      }} />
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.map(d => {
                  const isCurrentMonth = d.monthKey === currentMonthKey;
                  const segMap = {};
                  for (const seg of d.segments) {
                    segMap[seg.statusKey] = seg;
                  }
                  return (
                    <tr key={d.monthKey} style={{ background: isCurrentMonth ? '#eff6ff' : 'transparent' }}>
                      <td style={{ fontWeight: 700 }}>{d.monthName} {d.year}</td>
                      <td style={{ fontWeight: 800, color: '#0f172a' }}>{d.visibleTotal}</td>
                      {STATUS_META.filter(s => enabledStatuses.has(s.key)).map(s => {
                        const seg = segMap[s.key];
                        const count = seg?.count || 0;
                        const visibleTotal = d.visibleTotal;
                        const pct = visibleTotal > 0 ? (count / visibleTotal) * 100 : 0;
                        return (
                          <td key={s.key} style={{ textAlign: 'center', padding: '8px 4px' }}>
                            {count > 0 ? (
                              <>
                                <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>{count}</div>
                                <div style={{
                                  fontWeight: 600, fontSize: '10px',
                                  color: pct >= 30 ? s.color : '#94a3b8',
                                }}>
                                  {Math.round(pct)}%
                                </div>
                              </>
                            ) : (
                              <span style={{ color: '#e2e8f0' }}>—</span>
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
        </section>
      </div>
    </div>
  );
}
