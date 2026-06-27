import { useState, useMemo, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../../utils/numberToWords';

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

// Categories definition
const CATEGORIES = [
  { key: 'alimentosBebidas', label: 'Alimentos & Bebidas', icon: '🍽️', color: '#3b82f6' },
  { key: 'hospedajeJdl', label: 'Hospedaje JDL', icon: '🏨', color: '#8b5cf6' },
  { key: 'hospedajeTerceros', label: 'Hospedaje de Terceros', icon: '🏡', color: '#f59e0b' },
  { key: 'miscelaneos', label: 'Misceláneos', icon: '📦', color: '#10b981' },
];

// Active statuses to include (events that are relevant for revenue)
const ACTIVE_STATUSES = new Set([
  'Confirmado', 'Pre reserva', 'Realizado', 'Seguimiento',
  '1er Cotizacion', 'Lista de Espera', 'Reserva sin Cotizacion'
]);

export default function ReportsIngresosCategorias({ onClose }) {
  const { events } = useOutletContext();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [fromDate, setFromDate] = useState(getLocalDateStr(firstOfMonth));
  const [toDate, setToDate] = useState(getLocalDateStr(lastOfMonth));
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredBarPos, setHoveredBarPos] = useState(null);

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

  // Helper to extract catBucket amount safely
  const pickCatAmount = (catBuckets, key) => {
    if (!catBuckets) return 0;
    const bucket = catBuckets[key];
    if (!bucket) return 0;
    return Math.max(0, Number(bucket.amount || 0));
  };

  // ── Aggregate catBuckets by category and month ──
  const chartData = useMemo(() => {
    if (!events || !monthList.length) return { categoryData: [], monthlyData: [], grandTotal: 0 };

    const from = monthList[0].key + '-01';
    const to = monthList[monthList.length - 1].key + '-' + String(monthList[monthList.length - 1].daysInMonth).padStart(2, '0');

    // Totals per category across all months
    const catTotals = { alimentosBebidas: 0, hospedajeJdl: 0, hospedajeTerceros: 0, miscelaneos: 0 };
    let grandTotal = 0;

    // Monthly breakdown per category
    const monthlyCatTotals = {}; // { "YYYY-MM": { alimentosBebidas: 0, hospedajeJdl: 0, ... } }

    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) continue;
      if (!ACTIVE_STATUSES.has(String(ev.status || '').trim())) continue;

      const monthKey = d.substring(0, 7);
      const catBuckets = ev.quote?.catBuckets || {};

      if (!monthlyCatTotals[monthKey]) {
        monthlyCatTotals[monthKey] = { alimentosBebidas: 0, hospedajeJdl: 0, hospedajeTerceros: 0, miscelaneos: 0 };
      }

      for (const cat of CATEGORIES) {
        const amount = pickCatAmount(catBuckets, cat.key);
        if (amount > 0) {
          catTotals[cat.key] += amount;
          grandTotal += amount;
          monthlyCatTotals[monthKey][cat.key] += amount;
        }
      }
    }

    // Build category data for the chart
    const categoryData = CATEGORIES.map(cat => ({
      ...cat,
      totalAmount: catTotals[cat.key],
      pct: grandTotal > 0 ? (catTotals[cat.key] / grandTotal) * 100 : 0,
    }));

    // Sort by amount descending
    categoryData.sort((a, b) => b.totalAmount - a.totalAmount);

    // Build monthly breakdown
    const monthlyData = monthList.map(m => {
      const mTotals = monthlyCatTotals[m.key] || { alimentosBebidas: 0, hospedajeJdl: 0, hospedajeTerceros: 0, miscelaneos: 0 };
      const monthTotal = Object.values(mTotals).reduce((s, v) => s + v, 0);
      return {
        monthKey: m.key,
        monthName: m.monthName,
        monthShort: m.monthShort,
        year: m.year,
        total: monthTotal,
        categories: CATEGORIES.map(cat => ({
          key: cat.key,
          label: cat.label,
          color: cat.color,
          amount: mTotals[cat.key] || 0,
          pct: monthTotal > 0 ? ((mTotals[cat.key] || 0) / monthTotal) * 100 : 0,
        })),
      };
    });

    return { categoryData, monthlyData, grandTotal };
  }, [events, monthList]);

  const { categoryData, monthlyData, grandTotal } = chartData;

  // ── Aggregated KPIs ──
  const maxAmount = useMemo(() => categoryData.length > 0 ? Math.max(...categoryData.map(c => c.totalAmount)) : 0, [categoryData]);
  const activeMonths = useMemo(() => monthlyData.filter(m => m.total > 0).length, [monthlyData]);

  // Top category
  const topCategory = useMemo(() => {
    if (!categoryData.length) return null;
    return categoryData.reduce((best, c) => c.totalAmount > best.totalAmount ? c : best, categoryData[0]);
  }, [categoryData]);

  // ── Tooltip data ──
  const hoveredCat = useMemo(
    () => (hoveredBar !== null && categoryData[hoveredBar]) ? categoryData[hoveredBar] : null,
    [hoveredBar, categoryData]
  );

  // ── Animation state ──
  const [animationPhase, setAnimationPhase] = useState('complete');
  const [visibleBars, setVisibleBars] = useState(9999);
  const animationKeyRef = useRef(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (categoryData.length > 0) {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        setAnimationPhase('complete');
        setVisibleBars(categoryData.length);
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
          if (i >= categoryData.length) {
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
  }, [categoryData]);

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

  const getBarColor = (pct, isHovered, baseColor) => {
    if (isHovered) return baseColor;
    return baseColor + 'cc';
  };

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
            <div className="reports-title">📊 Ingresos por Categoría de Servicio</div>
            <div className="reports-subtitle">Montos en Quetzales generados por categoría de servicio · Alimentos & Bebidas · Hospedajes · Misceláneos</div>
          </div>
        </div>
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
              <span className="reports-eyebrow">Ingresos por categoría</span>
              <h3 className="reports-section-title">Montos Totales por Categoría de Servicio</h3>
              <p className="reports-section-text">
                Cada barra representa una categoría de servicio. La altura muestra el monto total en Quetzales generado por los eventos en el período seleccionado.
                Pasa el mouse sobre cada barra para ver detalles.
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
                💰 <strong style={{ color: '#0f172a' }}>{formatMoney(grandTotal)}</strong> total
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                📂 <strong style={{ color: '#0f172a' }}>{categoryData.length}</strong> {categoryData.length === 1 ? 'categoría' : 'categorías'}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                📅 <strong style={{ color: '#0f172a' }}>{monthList.length}</strong> {monthList.length === 1 ? 'mes' : 'meses'} · <strong>{activeMonths}</strong> activos
              </span>
              {topCategory && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🏆 <strong style={{ color: topCategory.color }}>{topCategory.label}</strong> {Math.round(topCategory.pct)}%
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ── Storytelling ── */}
        <div className="reports-storytelling-card" style={sectionStyle(200)}>
          <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Análisis del período</span>
          <p className="reports-story-text">
            En el rango del <strong className="highlight-slate">{fromDate}</strong> al <strong className="highlight-slate">{toDate}</strong> se generó un total de <strong className="highlight-green">{formatMoney(grandTotal)}</strong> en ingresos,
            distribuidos en <strong className="highlight-slate">{categoryData.length}</strong> categorías de servicio a lo largo de <strong className="highlight-slate">{monthList.length}</strong> {monthList.length === 1 ? 'mes' : 'meses'}.
            {topCategory ? ` La categoría líder es <strong className="highlight-blue">{topCategory.label}</strong> con <strong className="highlight-green">{formatMoney(topCategory.totalAmount)}</strong> ({Math.round(topCategory.pct)}% del total).` : ''}
          </p>
        </div>

        {/* ── Bar Chart ── */}
        <section className="reports-hero-panel" style={{ gap: '12px', ...sectionStyle(350) }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Gráfico de barras por categoría</span>
              <h3 className="reports-section-title">Montos por Categoría</h3>
              <p className="reports-section-text">Pasa el mouse sobre cada barra para ver el monto total, porcentaje y desglose de la categoría</p>
            </div>
            {/* Category legend */}
            <div style={{ display: 'flex', gap: '14px', fontSize: '10px', fontWeight: 700, color: '#64748b', alignItems: 'center', flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <span key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: cat.color, display: 'inline-block' }} />
                  {cat.label}
                </span>
              ))}
              {grandTotal > 0 && (
                <span style={{ marginLeft: '4px', color: '#94a3b8', fontStyle: 'italic' }}>
                  Total: <strong>{formatMoney(grandTotal)}</strong>
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
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '80px', flexShrink: 0, paddingBottom: '28px' }}>
                {[100, 80, 60, 40, 20, 0].map(pct => (
                  <span key={pct} style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textAlign: 'right', lineHeight: '12px' }}>
                    {formatMoney(maxAmount * pct / 100)}
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

                {categoryData.length === 0 ? (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700, color: '#94a3b8',
                    flexDirection: 'column', gap: '8px',
                  }}>
                    <span style={{ fontSize: '32px' }}>📭</span>
                    <span>No hay ingresos registrados en este período</span>
                  </div>
                ) : (
                  categoryData.map((cat, i) => {
                    const isHovered = hoveredBar === i;
                    const pctOfMax = maxAmount > 0 ? (cat.totalAmount / maxAmount) * 100 : 0;
                    const barColor = getBarColor(cat.pct, isHovered, cat.color);

                    return (
                      <div
                        key={cat.key}
                        style={{
                          flex: '1 1 0',
                          minWidth: '80px',
                          maxWidth: '140px',
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
                        {/* Amount label above bar */}
                        <div style={{
                          fontSize: cat.totalAmount > 0 ? '10px' : '0',
                          fontWeight: 900, color: barColor,
                          lineHeight: 1, marginBottom: '3px',
                          opacity: isHovered || cat.pct > 15 ? 1 : 0.7,
                          transition: 'all 0.15s ease',
                          transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                        }}>
                          {cat.totalAmount > 0 ? formatMoney(cat.totalAmount) : ''}
                        </div>

                        {/* The bar */}
                        <div style={{
                          width: '80%',
                          height: `${Math.max(pctOfMax > 0 ? Math.max(4, pctOfMax) : 0, 0)}%`,
                          background: cat.totalAmount === 0
                            ? '#f1f5f9'
                            : `linear-gradient(180deg, ${cat.color}, ${cat.color}aa)`,
                          borderRadius: '4px 4px 0 0',
                          transition: 'opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, transform 0.15s ease',
                          opacity: i < visibleBars ? 1 : (animationPhase === 'initial' ? 0 : 1),
                          boxShadow: cat.totalAmount > 0
                            ? (isHovered ? `0 0 12px ${cat.color}50, inset 0 1px 0 rgba(255,255,255,0.3)` : `inset 0 1px 0 rgba(255,255,255,0.3)`)
                            : 'none',
                          transform: isHovered && cat.totalAmount > 0 ? 'scaleX(1.1)' : 'scaleX(1)',
                          minHeight: cat.totalAmount > 0 ? '4px' : '2px',
                        }} />

                        {/* Category name + % at bottom */}
                        <div style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: cat.color,
                          marginTop: '6px', textAlign: 'center',
                          lineHeight: 1.1,
                          position: 'absolute', bottom: '-18px', left: 0, right: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          transition: 'color 0.15s ease',
                        }}>
                          {cat.icon} {cat.label}
                        </div>
                        <div style={{
                          fontSize: '8px',
                          fontWeight: 600,
                          color: '#94a3b8',
                          position: 'absolute', bottom: '-30px', left: 0, right: 0,
                          textAlign: 'center',
                        }}>
                          {Math.round(cat.pct)}%
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Premium Tooltip (fixed position, outside overflow containers) ── */}
        {hoveredCat && hoveredBarPos && (() => {
          const cat = hoveredCat;
          // Find the monthly breakdown for this category
          const monthsWithData = monthlyData.filter(m => {
            const catMonth = m.categories.find(c => c.key === cat.key);
            return catMonth && catMonth.amount > 0;
          });
          const eventMonths = monthsWithData.length;
          
          return (
            <div style={{
              position: 'fixed',
              left: `${Math.min(hoveredBarPos.x, window.innerWidth - 280)}px`,
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{
                      width: '10px', height: '10px', borderRadius: '3px',
                      background: cat.color, display: 'inline-block', flexShrink: 0
                    }} />
                    <span style={{ fontSize: '14px', fontWeight: 900, letterSpacing: '-0.01em' }}>
                      {cat.icon} {cat.label}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '10px', color: '#cbd5e1' }}>
                    <span style={{ color: '#94a3b8' }}>💰 Total</span>
                    <span style={{ fontWeight: 800, color: '#10b981' }}>{formatMoney(cat.totalAmount)}</span>
                    <span style={{ color: '#94a3b8' }}>📊 Porcentaje</span>
                    <span style={{ fontWeight: 800, color: cat.color }}>{Math.round(cat.pct)}%</span>
                    <span style={{ color: '#94a3b8' }}>📅 Meses activos</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{eventMonths} de {monthList.length}</span>
                    <span style={{ color: '#94a3b8' }}>📈 Promedio/mes</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{formatMoney(eventMonths > 0 ? cat.totalAmount / eventMonths : 0)}</span>
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
              <span className="reports-eyebrow">Tabla mensual detallada</span>
              <h3 className="reports-section-title">Desglose por mes × categoría</h3>
            </div>
          </div>

          <div className="reports-table-wrap" style={{ maxHeight: '500px' }}>
            <table className="reports-table" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Total mes</th>
                  {categoryData.map(cat => (
                    <th key={cat.key} style={{ textAlign: 'center', fontSize: '9px', padding: '8px 4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cat.label === 'Alimentos & Bebidas' ? 'A&B' : cat.label === 'Hospedaje de Terceros' ? 'H. 3ros' : cat.label === 'Hospedaje JDL' ? 'H. JDL' : 'Misc.'}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyData.map(m => {
                  const isCurrentMonth = m.monthKey === currentMonthKey;
                  return (
                    <tr key={m.monthKey} style={{ background: isCurrentMonth ? '#eff6ff' : 'transparent' }}>
                      <td style={{ fontWeight: 700 }}>{m.monthName} {m.year}</td>
                      <td style={{ fontWeight: 800, color: '#0f172a' }}>{m.total > 0 ? formatMoney(m.total) : '—'}</td>
                      {categoryData.map(cat => {
                        const catMonth = m.categories.find(c => c.key === cat.key);
                        const amount = catMonth?.amount || 0;
                        return (
                          <td key={cat.key} style={{ textAlign: 'center', padding: '8px 4px', fontSize: '10px' }}>
                            {amount > 0 ? (
                              <>
                                <div style={{ fontWeight: 700, fontSize: '11px', color: '#0f172a' }}>{formatMoney(amount)}</div>
                                <div style={{ fontWeight: 600, color: cat.color }}>{Math.round(catMonth?.pct || 0)}%</div>
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
              {/* Totals row */}
              {categoryData.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td style={{ fontWeight: 800, color: '#0f172a' }}>Total</td>
                    <td style={{ fontWeight: 800, color: '#0f172a' }}>{formatMoney(grandTotal)}</td>
                    {categoryData.map(cat => (
                      <td key={cat.key} style={{ textAlign: 'center', padding: '8px 4px' }}>
                        <div style={{ fontWeight: 700, fontSize: '11px', color: '#0f172a' }}>{formatMoney(cat.totalAmount)}</div>
                        <div style={{ fontWeight: 600, color: cat.color }}>{Math.round(cat.pct)}%</div>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
