import { useState, useMemo, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { loadState } from '../../services/stateService';
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

// Normaliza nombres de salón: minúsculas + sin acentos + trim.
// Evita que "Salón A" y "Salon A" no coincidan en el filtro de marcados.
function normalizeSalon(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const STATUS = { CONFIRMADO: 'Confirmado', PRERESERVA: 'Pre reserva' };
const ACTIVE_STATUSES = new Set([STATUS.CONFIRMADO, STATUS.PRERESERVA]);

// Meta = 11% de la capacidad total de los salones marcados como "Influye en diagrama".
// El chart se reescala de modo que esta meta equivale al 100% en pantalla:
//   100% chart = (capacidad_diaria × 0.11) PAX/día
// Para hacerlo configurable, mover a Configuración → Reportes cuando se requiera.
const META_PCT = 0.11;

export default function ReportsOcupacionBarras({ onClose }) {
  const { events } = useOutletContext();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [fromDate, setFromDate] = useState(getLocalDateStr(firstOfMonth));
  const [toDate, setToDate] = useState(getLocalDateStr(lastOfMonth));
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredBarPos, setHoveredBarPos] = useState(null);

  // ── Load capacity data ──
  const [salonCapacities, setSalonCapacities] = useState({});
  const [salonOccupancyEnabled, setSalonOccupancyEnabled] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const state = await loadState({ cacheBust: true });
        setSalonCapacities((state.salonCapacities && typeof state.salonCapacities === 'object') ? state.salonCapacities : {});
        setSalonOccupancyEnabled(Array.isArray(state.salonOccupancyEnabled) ? state.salonOccupancyEnabled : []);
      } catch (err) { console.error(err); }
    })();
  }, []);

  // ── Compute total capacity of marked salons ──
  const totalMarkedCapacity = useMemo(() => {
    return salonOccupancyEnabled.reduce((sum, name) => sum + Math.max(0, Number(salonCapacities[name] || 0)), 0);
  }, [salonCapacities, salonOccupancyEnabled]);

  // ── Get set of marked salon names for quick lookup (normalizado) ──
  const markedSalonSet = useMemo(
    () => new Set(salonOccupancyEnabled.map(normalizeSalon)),
    [salonOccupancyEnabled]
  );

  // ── Generate all months between fromDate and toDate ──
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

  // ── Compute occupancy per month: PAX sum / (total capacity × days in month) ──
  const chartData = useMemo(() => {
    if (!events || !monthList.length) return [];
    if (totalMarkedCapacity <= 0) {
      return monthList.map(m => ({
        monthKey: m.key,
        monthName: m.monthName,
        monthShort: m.monthShort,
        year: m.year,
        daysInMonth: m.daysInMonth,
        count: 0, totalPax: 0,
        pct: 0, label: 'Sin capacidad',
      }));
    }

    const from = monthList[0].key + '-01';
    const to = monthList[monthList.length - 1].key + '-' + String(monthList[monthList.length - 1].daysInMonth).padStart(2, '0');

    // Aggregate by month (YYYY-MM from ev.date)
    const monthPax = {};
    const monthEventCounts = {};
    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) continue;
      if (!ACTIVE_STATUSES.has(String(ev.status || ''))) continue;
      const evSalon = normalizeSalon(ev.salon);
      if (!markedSalonSet.has(evSalon)) continue;
      const monthKey = d.substring(0, 7); // "YYYY-MM"
      const pax = Math.max(0, Number(ev.pax || 0));
      if (pax > 0) {
        monthPax[monthKey] = (monthPax[monthKey] || 0) + pax;
      }
      monthEventCounts[monthKey] = (monthEventCounts[monthKey] || 0) + 1;
    }

    return monthList.map(m => {
      const totalPax = monthPax[m.key] || 0;
      const count = monthEventCounts[m.key] || 0;
      const monthlyCapacity = totalMarkedCapacity * m.daysInMonth;
      // Meta mensual = 11% de la capacidad del mes
      const monthlyMeta = monthlyCapacity * META_PCT;
      // % vs meta: 100% = se alcanzó la meta, 200% = se duplicó la meta
      const pct = monthlyMeta > 0 ? (totalPax / monthlyMeta) * 100 : 0;

      return {
        monthKey: m.key,
        monthName: m.monthName,
        monthShort: m.monthShort,
        year: m.year,
        daysInMonth: m.daysInMonth,
        count,
        totalPax,
        pct,
        label: totalPax > 0
          ? `${totalPax} PAX (${count} evento${count !== 1 ? 's' : ''})`
          : count > 0 ? `Sin PAX (${count} evento${count !== 1 ? 's' : ''})` : 'Sin actividad',
      };
    });
  }, [events, monthList, totalMarkedCapacity, markedSalonSet]);

  const totalPax = useMemo(() => chartData.reduce((s, d) => s + d.totalPax, 0), [chartData]);
  const totalEvents = useMemo(() => chartData.reduce((s, d) => s + d.count, 0), [chartData]);
  const activeMonths = useMemo(() => chartData.filter(d => d.totalPax > 0).length, [chartData]);

  // Meta PAX promedio mensual — se usa para el Y-axis
  // (cada mes tiene días distintos, promediamos para tener un valor representativo)
  const avgMonthlyMeta = useMemo(() => {
    if (monthList.length === 0) return 0;
    const totalDays = monthList.reduce((s, m) => s + m.daysInMonth, 0);
    return Math.round(totalMarkedCapacity * (totalDays / monthList.length) * META_PCT);
  }, [monthList, totalMarkedCapacity]);

  const peakMonth = useMemo(() => {
    let max = { totalPax: 0, monthKey: '', monthName: '', pct: 0 };
    for (const d of chartData) {
      if (d.totalPax > max.totalPax) {
        max = { totalPax: d.totalPax, monthKey: d.monthKey, monthName: d.monthName, pct: d.pct };
      }
    }
    return max;
  }, [chartData]);
  const avgMonthly = monthList.length > 0 ? (totalPax / monthList.length) : 0;

  // Total capacity across all months = sum of monthly capacities
  const totalMonthlyCapacity = useMemo(() => {
    return monthList.reduce((sum, m) => sum + totalMarkedCapacity * m.daysInMonth, 0);
  }, [monthList, totalMarkedCapacity]);

  // Cumplimiento global de la meta en el rango seleccionado
  const totalMeta = totalMonthlyCapacity * META_PCT;
  const paxUtilPct = totalMeta > 0 ? (totalPax / totalMeta) * 100 : 0;

  // ── Tooltip data: depends on chartData, must be defined AFTER it ──
  const hoveredData = useMemo(
    () => (hoveredBar !== null && chartData[hoveredBar]) ? chartData[hoveredBar] : null,
    [hoveredBar, chartData]
  );

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

  const getBarColor = (pct, isHovered) => {
    // Umbrales reescalados vs meta: 100% = meta alcanzada (verde)
    if (pct >= 100) return isHovered ? '#047857' : '#10b981';
    if (pct >= 70) return isHovered ? '#0284c7' : '#3b82f6';
    if (pct >= 40) return isHovered ? '#2563eb' : '#60a5fa';
    if (pct > 0) return isHovered ? '#6366f1' : '#a5b4fc';
    return '#e5e7eb';
  };

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

  // Current month key for highlighting
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
            <div className="reports-title">📊 Porcentaje Ocupación de Eventos</div>
            <div className="reports-subtitle">% de cumplimiento de meta mensual (meta = 11% de capacidad de salones) · Configura qué salones influyen en Configuración → Salones</div>
          </div>
        </div>
        <ReportInfo reportKey="ocupacionBarras" />
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
              <span className="reports-eyebrow">Cumplimiento de Meta</span>
              <h3 className="reports-section-title">PAX ocupados vs meta del 11% de capacidad</h3>
              <p className="reports-section-text">
                Cada barra representa un mes. El 100% equivale a la meta (11% de la capacidad total diaria de los salones
                marcados como "Influye en diagrama" en Configuración → Salones, multiplicada por los días del mes).
                Por encima de 100% se superó la meta.
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
            <button type="button" onClick={handleReset} style={{
              fontSize: '11px', fontWeight: 800, padding: '7px 14px',
              borderRadius: '8px', border: '1.5px solid #e2e8f0',
              background: '#f8fafc', color: '#475569', cursor: 'pointer',
              marginTop: '16px', transition: 'all 0.15s',
              flexShrink: 0,
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
            >Mes Actual</button>

            {/* Metric Cards */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'stretch', flexWrap: 'wrap' }}>
              {[
                { icon: '📅', label: 'Meses', value: `${monthList.length}`, sub: monthList.length === 1 ? 'mes' : 'meses', color: '#6366f1' },
                { icon: '🧑', label: 'PAX total', value: totalPax.toLocaleString(), sub: `${activeMonths} activo(s)`, color: '#10b981' },
                { icon: '📈', label: 'Promedio', value: `${avgMonthly.toFixed(0)}`, sub: 'PAX/mes', color: '#f59e0b' },
                { icon: '🏭', label: 'Capacidad', value: totalMarkedCapacity.toLocaleString(), sub: `PAX/día · Meta ${Math.round(totalMarkedCapacity * META_PCT)}/día`, color: '#3b82f6' },
                { icon: '🎯', label: 'Cumplimiento', value: `${paxUtilPct.toFixed(1)}%`, sub: 'vs meta 11% global', color: '#ec4899' },
              ].map((metric, idx) => (
                <div key={idx} style={{
                  background: `linear-gradient(135deg, ${metric.color}08, ${metric.color}02)`,
                  border: `1px solid ${metric.color}20`,
                  borderRadius: '10px', padding: '10px 14px',
                  minWidth: '100px',
                  display: 'flex', flexDirection: 'column', gap: '2px',
                  transition: 'all 0.2s ease',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${metric.color}20`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '14px' }}>{metric.icon}</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: metric.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{metric.label}</span>
                  </div>
                  <strong style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{metric.value}</strong>
                  <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>{metric.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Storytelling ── */}
        <div className="reports-storytelling-card" style={{ ...sectionStyle(200), padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px', minWidth: '200px' }}>
              <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '6px' }}>Análisis del período</span>
              <p className="reports-story-text" style={{ margin: 0, lineHeight: 1.7 }}>
                Del <strong className="highlight-slate">{fromDate}</strong> al <strong className="highlight-slate">{toDate}</strong> ·
                <strong className="highlight-blue"> {totalPax.toLocaleString()} PAX</strong> en <strong>{totalEvents} eventos</strong>
                sobre <strong>{activeMonths}</strong> {activeMonths === 1 ? 'mes activo' : 'meses activos'} de {monthList.length}.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{
                background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                color: '#fff', borderRadius: '10px', padding: '10px 18px',
                textAlign: 'center', minWidth: '120px',
              }}>
                <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>Mes pico</div>
                <div style={{ fontSize: '15px', fontWeight: 900, marginTop: '2px' }}>{peakMonth.monthName}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: peakMonth.pct >= 100 ? '#10b981' : '#fbbf24' }}>
                  {peakMonth.totalPax.toLocaleString()} PAX · {peakMonth.pct.toFixed(1)}% de meta
                </div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #065f46, #059669)',
                color: '#fff', borderRadius: '10px', padding: '10px 18px',
                textAlign: 'center', minWidth: '120px',
              }}>
                <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6ee7b7' }}>Cumplimiento meta</div>
                <div style={{ fontSize: '24px', fontWeight: 900, marginTop: '2px', lineHeight: 1 }}>{paxUtilPct.toFixed(1)}%</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#6ee7b7' }}>{avgMonthly.toFixed(0)} PAX/mes prom.</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bar Chart ── */}
        <section className="reports-hero-panel" style={{ gap: '12px', ...sectionStyle(350) }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Gráfico de barras mensual</span>
              <h3 className="reports-section-title">PAX por mes vs Meta del 11%</h3>
              <p className="reports-section-text">La línea rosa marca la meta mensual (~{avgMonthlyMeta > 0 ? avgMonthlyMeta.toLocaleString('en-US') : '—'} PAX). Barras verdes la alcanzan o superan. Pasa el mouse sobre cada barra para ver el detalle.</p>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '14px', fontSize: '10px', fontWeight: 700, color: '#64748b', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981', display: 'inline-block' }} /> ≥100% (meta alcanzada)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3b82f6', display: 'inline-block' }} /> 70-99%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#60a5fa', display: 'inline-block' }} /> 40-69%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#a5b4fc', display: 'inline-block' }} /> 1-39%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#e5e7eb', display: 'inline-block' }} /> 0%
              </span>
              {totalMarkedCapacity > 0 ? (
                <span style={{ marginLeft: '4px', color: '#94a3b8', fontStyle: 'italic' }}>
                  Capacidad: <strong>{totalMarkedCapacity.toLocaleString()}</strong> PAX/día · Meta diaria: <strong style={{ color: '#ec4899' }}>{Math.round(totalMarkedCapacity * META_PCT).toLocaleString()}</strong> PAX (11%)
                </span>
              ) : (
                <span style={{ marginLeft: '4px', color: '#f59e0b', fontStyle: 'italic', fontWeight: 700 }}>
                  ⚠️ Ningún salón marcado como "Influye en diagrama" en Configuración → Salones
                </span>
              )}
            </div>
          </div>

          {/* ── Chart container ── */}
          <div style={{
            background: '#ffffff', borderRadius: '14px', padding: '24px 20px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
            border: '1px solid #f1f5f9',
          }}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px', minHeight: '320px' }}>
              {/* Y-axis (cantidades de PAX; referencia 100% = meta promedio mensual) */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '52px', flexShrink: 0, paddingBottom: '28px' }}>
                {[200, 150, 100, 50, 0].map(frac100 => {
                  const isMeta = frac100 === 100;
                  const paxValue = Math.round(avgMonthlyMeta * (frac100 / 100));
                  return (
                    <span key={frac100} style={{
                      fontSize: '9px', fontWeight: isMeta ? 900 : 700,
                      color: isMeta ? '#ec4899' : '#94a3b8',
                      textAlign: 'right', lineHeight: '12px',
                      whiteSpace: 'nowrap',
                    }}>
                      {paxValue.toLocaleString('en-US')}
                    </span>
                  );
                })}
              </div>

              {/* Bars area */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '6px', position: 'relative', minHeight: '280px' }}>
                {/* Grid lines en Y-axis 50 / 150 (corren a 25% / 75% del contenedor) */}
                {[50, 150].map(yPct => (
                  <div key={yPct} style={{
                    position: 'absolute', left: 0, right: 0, bottom: `${yPct / 2}%`,
                    height: '1px', background: 'transparent',
                    borderTop: '1px dashed #e2e8f0', pointerEvents: 'none',
                  }} />
                ))}
                {/* Línea de meta (Y-axis 100% = 50% del contenedor) */}
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: '50%',
                  height: '2px', background: '#ec4899', pointerEvents: 'none',
                  boxShadow: '0 0 6px rgba(236, 72, 153, 0.4)', zIndex: 1,
                }}>
                  <span style={{
                    position: 'absolute', right: '6px', top: '-9px',
                    fontSize: '9px', fontWeight: 900, color: '#fff',
                    background: '#ec4899', padding: '2px 7px', borderRadius: '6px',
                    letterSpacing: '0.05em', whiteSpace: 'nowrap',
                  }}>
                    META {avgMonthlyMeta > 0 ? `${avgMonthlyMeta.toLocaleString('en-US')} PAX` : '11%'}
                  </span>
                </div>

                {chartData.map((d, i) => {
                  const isHovered = hoveredBar === i;
                  const barColor = getBarColor(d.pct, isHovered);
                  const isCurrentMonth = d.monthKey === currentMonthKey;

                  return (
                    <div
                      key={d.monthKey}
                      style={{
                        flex: '1 1 0',
                        minWidth: '28px',
                        maxWidth: '60px',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        setHoveredBar(i);
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredBarPos({ x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onMouseLeave={() => { setHoveredBar(null); setHoveredBarPos(null); }}
                    >
                      {/* PAX count above bar (número completo) */}
                      {d.totalPax > 0 && (
                        <div style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          color: '#475569',
                          lineHeight: 1,
                          marginBottom: '2px',
                          opacity: isHovered ? 1 : 0.85,
                          whiteSpace: 'nowrap',
                          transition: 'opacity 0.15s ease',
                        }}>
                          {d.totalPax.toLocaleString('en-US')}
                        </div>
                      )}

                      {/* Percentage label above bar (vs meta; valor real, sin clamp) */}
                      <div style={{
                        fontSize: d.pct > 0 ? (d.pct >= 100 ? '11px' : '10px') : '0',
                        fontWeight: 900, color: barColor,
                        lineHeight: 1, marginBottom: '3px',
                        opacity: isHovered || d.pct > 70 ? 1 : (d.pct > 0 ? 0.8 : 0),
                        transition: 'all 0.15s ease',
                        textShadow: isHovered ? `0 0 8px ${barColor}40` : 'none',
                        transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                      }}>
                        {d.pct > 0 ? `${Math.round(d.pct)}%` : ''}
                      </div>


                      {/* The bar (altura reescalada: 100% meta = 50% contenedor; clamp visual a 200%) */}
                      <div style={{
                        width: '100%',
                        height: `${d.pct > 0 ? Math.max(2, Math.min(d.pct, 200) / 2) : 0}%`,
                        background: d.pct === 0 ? '#f1f5f9' : `linear-gradient(180deg, ${barColor}, ${barColor}dd)`,
                        borderRadius: '4px 4px 0 0',
                        transition: 'opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, transform 0.15s ease',
                        opacity: i < visibleBars ? 1 : (animationPhase === 'initial' ? 0 : 1),
                        boxShadow: d.pct > 0
                          ? (isHovered ? `0 0 12px ${barColor}50, inset 0 1px 0 rgba(255,255,255,0.3)` : `inset 0 1px 0 rgba(255,255,255,0.3)`)
                          : 'none',
                        transform: isHovered && d.pct > 0 ? 'scaleX(1.12)' : 'scaleX(1)',
                        minHeight: d.pct > 0 ? '4px' : '0',
                        position: 'relative',
                        outline: d.pct >= 100 ? `1.5px solid ${barColor}` : 'none',
                        outlineOffset: d.pct >= 100 ? '-1px' : 0,
                      }}>
                        {d.pct > 200 && (
                          <span style={{
                            position: 'absolute', top: '2px', right: '4px',
                            fontSize: '8px', fontWeight: 900, color: '#fff',
                            background: 'rgba(15,23,42,0.75)', padding: '1px 4px',
                            borderRadius: '3px', letterSpacing: '0.04em',
                          }}>200%+</span>
                        )}
                      </div>

                      {/* Month label at bottom */}
                      <div style={{
                        fontSize: isCurrentMonth ? '10px' : '9px',
                        fontWeight: isCurrentMonth ? 900 : 600,
                        color: isCurrentMonth ? '#2563eb' : '#94a3b8',
                        marginTop: '6px', textAlign: 'center',
                        lineHeight: 1.1, whiteSpace: 'nowrap',
                        position: 'absolute', bottom: '-18px',
                      }}>
                        {d.monthShort}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-axis year labels */}
            <div style={{ display: 'flex', marginTop: '28px', fontSize: '9px', fontWeight: 700, color: '#94a3b8', paddingLeft: '44px' }}>
              {chartData.length > 0 && (
                <span>{chartData[0].monthName} {chartData[0].year}</span>
              )}
              {chartData.length > 6 && chartData.length > 1 && (
                <span style={{ marginLeft: 'auto' }}>{chartData[chartData.length - 1].monthName} {chartData[chartData.length - 1].year}</span>
              )}
            </div>
          </div>
        </section>

        {/* ── Premium Tooltip (fixed position, outside overflow containers) ── */}
        {hoveredData && hoveredBarPos && (() => {
          const d = hoveredData;
          const monthlyCap = totalMarkedCapacity * d.daysInMonth;
          const monthlyMeta = Math.round(monthlyCap * META_PCT);
          const metaHit = d.pct >= 100;
          return (
            <div style={{
              position: 'fixed',
              left: `${Math.min(hoveredBarPos.x, window.innerWidth - 260)}px`,
              top: `${Math.max(10, hoveredBarPos.y - 10)}px`,
              transform: 'translate(-50%, -100%)',
              zIndex: 99999,
              pointerEvents: 'none',
            }}>
              <div style={{
                background: '#0f172a', color: '#fff',
                padding: '12px 16px',
                borderRadius: '12px',
                fontSize: '11px', fontWeight: 600,
                boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                minWidth: '240px',
                maxWidth: '320px',
                animation: 'tooltipFadeIn 0.15s ease-out both',
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, marginBottom: '6px', letterSpacing: '-0.01em' }}>
                    {d.monthName} {d.year}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '10px', color: '#cbd5e1' }}>
                    <span style={{ color: '#94a3b8' }}>🧑 PAX</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{d.totalPax.toLocaleString()}</span>
                    <span style={{ color: '#94a3b8' }}>📋 Eventos</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{d.count}</span>
                    <span style={{ color: '#94a3b8' }}>🎯 Meta (11%)</span>
                    <span style={{ fontWeight: 700, color: '#f9a8d4' }}>{monthlyMeta.toLocaleString()} PAX</span>
                    <span style={{ color: '#94a3b8' }}>📊 % vs Meta</span>
                    <span style={{ fontWeight: 800, color: metaHit ? '#10b981' : '#fbbf24' }}>
                      {Math.round(d.pct)}%{metaHit ? ' ✓' : ''}
                    </span>
                    <span style={{ color: '#94a3b8' }}>🏭 Cap. mensual</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{monthlyCap.toLocaleString()} PAX</span>
                    <span style={{ color: '#94a3b8', fontSize: '9px' }}>Fórmula</span>
                    <span style={{ color: '#94a3b8', fontSize: '9px' }}>
                      {d.totalPax.toLocaleString()} PAX ÷ ({totalMarkedCapacity.toLocaleString()} × {d.daysInMonth} × 0.11)
                    </span>
                  </div>
                </div>
                <div style={{
                  position: 'absolute', top: '100%', left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0, height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '6px solid #0f172a',
                }} />
              </div>
            </div>
          );
        })()}

        {/* ── Monthly table ── */}
        <section className="reports-hero-panel" style={{ gap: '8px', ...sectionStyle(500) }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Tabla mensual</span>
              <h3 className="reports-section-title">Desglose por mes</h3>
            </div>
          </div>

          <div className="reports-table-wrap" style={{ maxHeight: '400px' }}>
            <table className="reports-table" style={{ minWidth: '780px' }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Año</th>
                  <th>Eventos</th>
                  <th>PAX</th>
                  <th>Capacidad mensual</th>
                  <th>Meta (11%)</th>
                  <th>% vs Meta</th>
                  <th style={{ textAlign: 'center' }}>Barra</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map(d => {
                  const hasActivity = d.totalPax > 0;
                  const monthlyCap = totalMarkedCapacity * d.daysInMonth;
                  const monthlyMeta = Math.round(monthlyCap * META_PCT);
                  const isCurrentMonth = d.monthKey === currentMonthKey;
                  const metaHit = d.pct >= 100;
                  return (
                    <tr key={d.monthKey}
                      style={{
                        background: isCurrentMonth ? '#eff6ff' : 'transparent',
                      }}>
                      <td style={{ fontWeight: 700 }}>{d.monthName}</td>
                      <td>{d.year}</td>
                      <td>
                        <strong style={{ color: hasActivity ? '#0f172a' : '#94a3b8' }}>{d.count}</strong>
                        <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '4px' }}>
                          {!hasActivity ? '(sin actividad)' : ''}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: hasActivity ? '#0f172a' : '#94a3b8' }}>
                          {d.totalPax.toLocaleString()}
                        </strong>
                        <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '4px' }}>
                          / {monthlyCap.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '12px' }}>
                        {totalMarkedCapacity.toLocaleString()} × {d.daysInMonth} = {monthlyCap.toLocaleString()}
                      </td>
                      <td style={{ color: '#be185d', fontSize: '12px', fontWeight: 700 }}>
                        {monthlyMeta.toLocaleString()}
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 800,
                          color: metaHit ? '#059669' : d.pct >= 70 ? '#0284c7' : d.pct >= 40 ? '#64748b' : '#94a3b8',
                        }}>
                          {Math.round(d.pct)}%{metaHit ? ' ✓' : ''}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{
                          height: '8px', width: '60px', borderRadius: '999px',
                          background: '#f1f5f9', overflow: 'hidden', margin: '0 auto',
                          position: 'relative',
                        }}>
                          {/* Marca de meta al 50% del ancho (= 100% Y-axis) */}
                          <div style={{
                            position: 'absolute', left: '50%', top: '-1px', bottom: '-1px',
                            width: '1px', background: '#ec4899', zIndex: 1,
                          }} />
                          <div style={{
                            height: '100%', borderRadius: '999px',
                            background: metaHit ? '#10b981' : d.pct >= 70 ? '#3b82f6' : d.pct >= 40 ? '#60a5fa' : d.pct > 0 ? '#a5b4fc' : '#e5e7eb',
                            width: `${d.pct > 0 ? Math.max(4, Math.min(d.pct, 200) / 2) : 0}%`,
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                      </td>
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
