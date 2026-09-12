import { useState, useMemo, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import ReportInfo from './components/ReportInfo';
import MultiSelect from './components/MultiSelect';

// ── Minimalist Vector Icons ──
function IconCalendar({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconTrendingUp({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconTarget({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconAward({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  );
}

function IconChevronLeft({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconInbox({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

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
  { key: 'Mantenimiento Realizado', label: 'Mant. Realizado', color: '#94a3b8' },
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

  const setPreset = (preset) => {
    const n = new Date();
    if (preset === 'thisMonth') {
      setFromDate(getLocalDateStr(new Date(n.getFullYear(), n.getMonth(), 1)));
      setToDate(getLocalDateStr(new Date(n.getFullYear(), n.getMonth() + 1, 0)));
    } else if (preset === 'lastMonth') {
      setFromDate(getLocalDateStr(new Date(n.getFullYear(), n.getMonth() - 1, 1)));
      setToDate(getLocalDateStr(new Date(n.getFullYear(), n.getMonth(), 0)));
    } else if (preset === 'last3Months') {
      setFromDate(getLocalDateStr(new Date(n.getFullYear(), n.getMonth() - 2, 1)));
      setToDate(getLocalDateStr(new Date(n.getFullYear(), n.getMonth() + 1, 0)));
    } else if (preset === 'year') {
      setFromDate(getLocalDateStr(new Date(n.getFullYear(), 0, 1)));
      setToDate(getLocalDateStr(new Date(n.getFullYear(), 11, 31)));
    }
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
            <div className="reports-title">Eficiencia de Eventos por Estado</div>
            <div className="reports-subtitle">Distribución porcentual mensual de eventos por estado · 100% = total de eventos del mes</div>
          </div>
        </div>
        <ReportInfo reportKey="eficienciaEventos" />
        <button className="btn-exit" type="button" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconChevronLeft size={16} />
          Volver
        </button>
      </div>

      <div className="reports-page-body">
        {/* ── 4 Tarjetas KPI Ejecutivas ── */}
        <section className="reports-hero-panel" style={{ gap: '16px', ...sectionStyle(50) }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            width: '100%',
          }}>
            {/* Card 1: Total Eventos */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Eventos
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconTrendingUp size={16} color="#2563eb" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {totalEvents} <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 600 }}>eventos</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {totalVisibleEvents} visibles en {totalMonths} {totalMonths === 1 ? 'mes' : 'meses'}
              </div>
            </div>

            {/* Card 2: Estado Dominante */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Estado Predominante
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconTarget size={16} color="#059669" />
                </div>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {topStatus.key ? (STATUS_META.find(s => s.key === topStatus.key)?.label || topStatus.key) : 'Sin datos'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {topStatus.count} eventos ({totalEvents > 0 ? Math.round((topStatus.count / totalEvents) * 100) : 0}% del volumen)
              </div>
            </div>

            {/* Card 3: Confirmados */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Confirmados
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconAward size={16} color="#059669" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#059669', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {statusTotals['Confirmado'] || 0} <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 600 }}>eventos</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {totalEvents > 0 ? (((statusTotals['Confirmado'] || 0) / totalEvents) * 100).toFixed(1) : 0}% tasa de confirmación
              </div>
            </div>

            {/* Card 4: Periodo */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Rango Temporal
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconCalendar size={16} color="#475569" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {totalMonths} <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 600 }}>{totalMonths === 1 ? 'Mes' : 'Meses'}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Del {fromDate} al {toDate}
              </div>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="reports-toolbar" style={{ gap: '12px', padding: '12px 20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="preset-btn"
                onClick={() => setPreset('thisMonth')}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#ffffff', color: '#334155', cursor: 'pointer'
                }}
              >
                Este Mes
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => setPreset('lastMonth')}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#ffffff', color: '#334155', cursor: 'pointer'
                }}
              >
                Mes Anterior
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => setPreset('last3Months')}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#ffffff', color: '#334155', cursor: 'pointer'
                }}
              >
                Últimos 3M
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => setPreset('year')}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#ffffff', color: '#334155', cursor: 'pointer'
                }}
              >
                Año
              </button>
            </div>

            <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }} />

            <label className="field" style={{ flex: '0 0 142px' }}>
              <span>Desde</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '0 0 142px' }}>
              <span>Hasta</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </label>
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
            <div className="field" style={{ minWidth: 220 }}>
              <MultiSelect
                selected={enabledStatuses}
                onChange={setEnabledStatuses}
                options={STATUS_META.map(s => ({ value: s.key, label: s.label, color: s.color }))}
                placeholder="Filtro de estado"
                emptyLabel="Todos los estados"
              />
            </div>
          </div>

          {/* ── Chart container ── */}
          <div className="reports-chart-scroll-wrap" style={{
            background: '#ffffff', borderRadius: '14px', padding: '24px 20px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
            border: '1px solid #f1f5f9',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', maxWidth: '100%',
          }}>
            <div style={{ minWidth: '460px' }}>
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
                    <IconInbox size={32} color="#94a3b8" />
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: '11px', color: '#cbd5e1' }}>
                    <span style={{ color: '#94a3b8' }}>Eventos:</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{seg.count}</span>
                    <span style={{ color: '#94a3b8' }}>Porcentaje:</span>
                    <span style={{ fontWeight: 800, color: seg.color }}>{Math.round(seg.visiblePct)}%</span>
                    <span style={{ color: '#94a3b8' }}>Mes:</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{month.monthName} {month.year}</span>
                    <span style={{ color: '#94a3b8' }}>Total mes:</span>
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
