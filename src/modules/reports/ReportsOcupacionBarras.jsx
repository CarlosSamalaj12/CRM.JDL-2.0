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

const STATUS = { CONFIRMADO: 'Confirmado', PRERESERVA: 'Pre reserva' };
const ACTIVE_STATUSES = new Set([STATUS.CONFIRMADO, STATUS.PRERESERVA]);

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

  // ── Get set of marked salon names for quick lookup ──
  const markedSalonSet = useMemo(() => new Set(salonOccupancyEnabled), [salonOccupancyEnabled]);

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
      const evSalon = String(ev.salon || '').trim();
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
      const pct = monthlyCapacity > 0 ? (totalPax / monthlyCapacity) * 100 : 0;

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

  const paxUtilPct = totalMonthlyCapacity > 0 ? (totalPax / totalMonthlyCapacity) * 100 : 0;

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
    if (pct >= 90) return isHovered ? '#059669' : '#10b981';
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
            <div className="reports-subtitle">% de ocupación mensual PAX vs capacidad de salones · Selecciona qué salones influyen en Configuración</div>
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
              <span className="reports-eyebrow">Porcentaje de Ocupación</span>
              <h3 className="reports-section-title">PAX ocupados vs capacidad mensual de salones</h3>
              <p className="reports-section-text">
                Cada barra representa un mes. El % indica los PAX ocupados sobre la capacidad total del mes
                (capacidad diaria × días del mes) de los salones marcados como "Influye en diagrama" en Configuración → Salones.
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
                📅 <strong style={{ color: '#0f172a' }}>{monthList.length}</strong> {monthList.length === 1 ? 'mes' : 'meses'}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                🧑 <strong style={{ color: '#0f172a' }}>{totalPax.toLocaleString()}</strong> PAX total
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                📊 <strong style={{ color: '#0f172a' }}>{activeMonths}</strong> {activeMonths === 1 ? 'mes activo' : 'meses activos'}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                📈 Prom. <strong style={{ color: '#0f172a' }}>{avgMonthly.toFixed(0)}</strong> PAX/mes
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                🏭 Cap. <strong style={{ color: '#0f172a' }}>{(totalMarkedCapacity).toLocaleString()}</strong> PAX/día
              </span>
            </div>
          </div>
        </section>

        {/* ── Storytelling ── */}
        <div className="reports-storytelling-card" style={sectionStyle(200)}>
          <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Análisis del período</span>
          <p className="reports-story-text">
            En el rango del <strong className="highlight-slate">{fromDate}</strong> al <strong className="highlight-slate">{toDate}</strong> hay <strong className="highlight-blue">{totalPax.toLocaleString()}</strong> PAX distribuidos en <strong className="highlight-slate">{totalEvents}</strong> eventos sobre <strong className="highlight-slate">{activeMonths}</strong> {activeMonths === 1 ? 'mes activo' : 'meses activos'}, de un total de <strong className="highlight-slate">{monthList.length}</strong> {monthList.length === 1 ? 'mes' : 'meses'}. La capacidad total diaria de los salones que influyen es de <strong className="highlight-accent">{totalMarkedCapacity.toLocaleString()}</strong> PAX/día. El mes pico fue <strong className="highlight-blue">{peakMonth.monthName}</strong> con <strong className="highlight-green">{peakMonth.totalPax.toLocaleString()}</strong> PAX ({peakMonth.pct.toFixed(1)}% de su capacidad mensual). La utilización global del período es del <strong className="highlight-blue">{paxUtilPct.toFixed(1)}%</strong> con un promedio de <strong className="highlight-accent">{avgMonthly.toFixed(0)}</strong> PAX/mes.
          </p>
        </div>

        {/* ── Bar Chart ── */}
        <section className="reports-hero-panel" style={{ gap: '12px', ...sectionStyle(350) }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Gráfico de barras mensual</span>
              <h3 className="reports-section-title">% Ocupación Mensual PAX vs Capacidad</h3>
              <p className="reports-section-text">Pasa el mouse sobre cada barra para ver PAX, eventos y % de capacidad del mes</p>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '14px', fontSize: '10px', fontWeight: 700, color: '#64748b', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981', display: 'inline-block' }} /> ≥90%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3b82f6', display: 'inline-block' }} /> 70-89%
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
                  Capacidad: <strong>{totalMarkedCapacity.toLocaleString()}</strong> PAX/día · Capacidad mensual = PAX/día × días del mes
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
              {/* Y-axis */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '36px', flexShrink: 0, paddingBottom: '28px' }}>
                {[100, 80, 60, 40, 20, 0].map(pct => (
                  <span key={pct} style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textAlign: 'right', lineHeight: '12px' }}>
                    {pct}%
                  </span>
                ))}
              </div>

              {/* Bars area */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '6px', position: 'relative', minHeight: '280px' }}>
                {/* Grid lines */}
                {[20, 40, 60, 80].map(pct => (
                  <div key={pct} style={{
                    position: 'absolute', left: 0, right: 0, bottom: `${pct}%`,
                    height: '1px', background: '#f1f5f9', pointerEvents: 'none',
                    borderTop: '1px dashed #e2e8f0',
                  }} />
                ))}

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
                      {/* Percentage label above bar */}
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


                      {/* The bar */}
                      <div style={{
                        width: '100%',
                        height: `${Math.max(d.pct > 0 ? Math.max(4, d.pct) : 0, d.pct > 0 ? 4 : 0)}%`,
                        background: d.pct === 0 ? '#f1f5f9' : `linear-gradient(180deg, ${barColor}, ${barColor}dd)`,
                        borderRadius: '4px 4px 0 0',
                        transition: 'opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, transform 0.15s ease',
                        opacity: i < visibleBars ? 1 : (animationPhase === 'initial' ? 0 : 1),
                        boxShadow: d.pct > 0
                          ? (isHovered ? `0 0 12px ${barColor}50, inset 0 1px 0 rgba(255,255,255,0.3)` : `inset 0 1px 0 rgba(255,255,255,0.3)`)
                          : 'none',
                        transform: isHovered && d.pct > 0 ? 'scaleX(1.12)' : 'scaleX(1)',
                        minHeight: d.pct > 0 ? '4px' : '0',
                      }} />

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
                minWidth: '220px',
                maxWidth: '300px',
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
                    <span style={{ color: '#94a3b8' }}>📊 Ocupación</span>
                    <span style={{ fontWeight: 800, color: '#10b981' }}>{Math.round(d.pct)}%</span>
                    <span style={{ color: '#94a3b8' }}>🏭 Cap. mensual</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{monthlyCap.toLocaleString()} PAX</span>
                    <span style={{ color: '#94a3b8', fontSize: '9px' }}>Fórmula</span>
                    <span style={{ color: '#94a3b8', fontSize: '9px' }}>{totalMarkedCapacity.toLocaleString()} PAX/día × {d.daysInMonth} días</span>
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
            <table className="reports-table" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Año</th>
                  <th>Eventos</th>
                  <th>PAX</th>
                  <th>Capacidad mensual</th>
                  <th>% Ocup.</th>
                  <th style={{ textAlign: 'center' }}>Barra</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map(d => {
                  const hasActivity = d.totalPax > 0;
                  const monthlyCap = totalMarkedCapacity * d.daysInMonth;
                  const isCurrentMonth = d.monthKey === currentMonthKey;
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
                      <td>
                        <span style={{
                          fontWeight: 800,
                          color: d.pct >= 90 ? '#059669' : d.pct >= 70 ? '#0284c7' : d.pct >= 40 ? '#64748b' : '#94a3b8',
                        }}>
                          {Math.round(d.pct)}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{
                          height: '8px', width: '60px', borderRadius: '999px',
                          background: '#f1f5f9', overflow: 'hidden', margin: '0 auto',
                        }}>
                          <div style={{
                            height: '100%', borderRadius: '999px',
                            background: d.pct >= 90 ? '#10b981' : d.pct >= 70 ? '#3b82f6' : d.pct >= 40 ? '#60a5fa' : d.pct > 0 ? '#a5b4fc' : '#e5e7eb',
                            width: `${Math.max(d.pct, d.pct > 0 ? 4 : 0)}%`,
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
