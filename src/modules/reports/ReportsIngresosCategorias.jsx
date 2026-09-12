import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../../utils/numberToWords';
import ReportInfo from './components/ReportInfo';

// ── Minimalist Vector Icons ──
function IconDollar({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
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

function IconAward({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
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

function IconUtensils({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2v20M21 2v4a3 3 0 0 1-3 3M18 9a3 3 0 0 1-3-3V2M6 2v6a3 3 0 0 0 3 3 3 3 0 0 0 3-3V2M9 11v11" />
    </svg>
  );
}

function IconHotel({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
    </svg>
  );
}

function IconHome({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconPackage({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
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

const CATEGORIES = [
  { key: 'alimentosBebidas', label: 'Alimentos & Bebidas', Icon: IconUtensils, color: '#3b82f6' },
  { key: 'hospedajeJdl', label: 'Hospedaje JDL', Icon: IconHotel, color: '#8b5cf6' },
  { key: 'hospedajeTerceros', label: 'Hospedaje de Terceros', Icon: IconHome, color: '#f59e0b' },
  { key: 'miscelaneos', label: 'Misceláneos', Icon: IconPackage, color: '#10b981' },
];

// Solo eventos confirmados para reflejar ingresos reales cerrados
const CONFIRMED_STATUSES = new Set(['Confirmado']);

export default function ReportsIngresosCategorias({ onClose }) {
  const { events } = useOutletContext();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [fromDate, setFromDate] = useState(getLocalDateStr(firstOfMonth));
  const [toDate, setToDate] = useState(getLocalDateStr(lastOfMonth));

  const setPreset = (preset) => {
    const t = new Date();
    if (preset === 'thisMonth') {
      setFromDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth(), 1)));
      setToDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth() + 1, 0)));
    } else if (preset === 'lastMonth') {
      setFromDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth() - 1, 1)));
      setToDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth(), 0)));
    } else if (preset === 'last3Months') {
      setFromDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth() - 2, 1)));
      setToDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth() + 1, 0)));
    } else if (preset === 'year') {
      setFromDate(getLocalDateStr(new Date(t.getFullYear(), 0, 1)));
      setToDate(getLocalDateStr(new Date(t.getFullYear(), 11, 31)));
    }
  };

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
        year: y, month: m,
        monthName: getMonthName(m),
        monthShort: getMonthName(m).substring(0, 3),
        daysInMonth: daysInMonth(y, m),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }, [fromDate, toDate]);

  const mapCategoryToBucket = (cat, itemName) => {
    // First, try to match from the service category
    if (cat) {
      const c = cat.toLowerCase().trim();
      // Check terceros first so it takes priority
      if (c.includes('terceros') || c.includes('3ros')) return 'hospedajeTerceros';
      if (c.includes('alimentos') || c.includes('bebidas') || c.includes('comida') || c.includes('catering') || c.includes('menu') || c.includes('bar') || c.includes('coctel')) return 'alimentosBebidas';
      if (c.includes('hospedaje') || c.includes('alojamiento')) return 'hospedajeJdl';
    }
    // Fallback: try to infer from the item name
    if (itemName) {
      const n = itemName.toLowerCase().trim();
      if (n.includes('hospedaje') || n.includes('alojamiento') || n.includes('hotel') || n.includes('habitacion')) {
        if (n.includes('terceros') || n.includes('3ros')) return 'hospedajeTerceros';
        return 'hospedajeJdl';
      }
      if (n.includes('alimentos') || n.includes('bebidas') || n.includes('comida') || n.includes('menu') || n.includes('catering') || n.includes('bar')) return 'alimentosBebidas';
    }
    return 'miscelaneos';
  };

  const chartData = useMemo(() => {
    if (!events || !monthList.length) return { categoryData: [], monthlyData: [], grandTotal: 0 };

    const from = fromDate;
    const to = toDate;

    const catTotals = { alimentosBebidas: 0, hospedajeJdl: 0, hospedajeTerceros: 0, miscelaneos: 0 };
    let grandTotal = 0;
    const monthlyCatTotals = {};
    const seenReservations = new Set();

    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) continue;
      if (!CONFIRMED_STATUSES.has(String(ev.status || '').trim())) continue;

      const groupKey = ev.groupId || ev.id;
      if (seenReservations.has(groupKey)) continue;
      seenReservations.add(groupKey);

      const monthKey = d.substring(0, 7);
      const quoteItems = ev.quote?.items || [];
      
      const quoteTotal = Math.max(0, Number(ev.quote?.total || 0));
      if (quoteTotal <= 0) continue;
      
      let dominantBucket = 'miscelaneos';
      let maxItemTotal = 0;
      for (const item of quoteItems) {
        const itemTotal = Number(item.qty || 0) * Number(item.price || 0);
        if (itemTotal > maxItemTotal) {
          maxItemTotal = itemTotal;
          dominantBucket = mapCategoryToBucket(item.category || '', item.name);
        }
      }
      
      if (!monthlyCatTotals[monthKey]) {
        monthlyCatTotals[monthKey] = { alimentosBebidas: 0, hospedajeJdl: 0, hospedajeTerceros: 0, miscelaneos: 0 };
      }
      catTotals[dominantBucket] += quoteTotal;
      grandTotal += quoteTotal;
      monthlyCatTotals[monthKey][dominantBucket] += quoteTotal;
    }

    const categoryData = CATEGORIES.map(cat => ({
      ...cat,
      totalAmount: catTotals[cat.key],
      pct: grandTotal > 0 ? (catTotals[cat.key] / grandTotal) * 100 : 0,
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    const monthlyData = monthList.map(m => {
      const mTotals = monthlyCatTotals[m.key] || { alimentosBebidas: 0, hospedajeJdl: 0, hospedajeTerceros: 0, miscelaneos: 0 };
      const monthTotal = Object.values(mTotals).reduce((s, v) => s + v, 0);
      return {
        monthKey: m.key, monthName: m.monthName, monthShort: m.monthShort, year: m.year,
        total: monthTotal,
        categories: CATEGORIES.map(cat => ({
          key: cat.key, label: cat.label, color: cat.color, Icon: cat.Icon,
          amount: mTotals[cat.key] || 0,
          pct: monthTotal > 0 ? ((mTotals[cat.key] || 0) / monthTotal) * 100 : 0,
        })),
      };
    });

    return { categoryData, monthlyData, grandTotal };
  }, [events, monthList, fromDate, toDate]);

  const { categoryData, grandTotal } = chartData;
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const maxAmount = categoryData.length > 0 ? Math.max(...categoryData.map(c => c.totalAmount)) : 0;

  return (
    <div className="reports-page-container">
      {/* ── Header Ejecutivo ── */}
      <div className="reports-page-header">
        <div className="reports-brand-header">
          <div className="reports-brand-badge">
            <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
          </div>
          <div>
            <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
            <div className="reports-title">Ingresos por Categoría de Servicio</div>
            <div className="reports-subtitle">Montos en Quetzales por categoría · Alimentos & Bebidas · Hospedajes · Misceláneos</div>
          </div>
        </div>
        <ReportInfo reportKey="ingresosCategorias" />
        <button className="btn-exit" type="button" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconChevronLeft size={16} />
          Volver
        </button>
      </div>

      <div className="reports-page-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ── Filters Toolbar ── */}
        <section className="reports-hero-panel">
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

            <label className="field" style={{ flex: '0 0 148px' }}>
              <span>Desde</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '0 0 148px' }}>
              <span>Hasta</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </label>
          </div>
        </section>

        {/* ── KPI Grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}>
          {/* Total Ingresos */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Ingresos Confirmados
              </span>
              <div style={{
                width: '32px', height: '32px', borderRadius: '10px',
                background: '#eff6ff', color: '#2563eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconDollar size={18} />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {formatMoney(grandTotal)}
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
              Período del {fromDate} al {toDate}
            </span>
          </div>

          {/* Categoría Principal */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Categoría Líder
              </span>
              <div style={{
                width: '32px', height: '32px', borderRadius: '10px',
                background: '#ecfdf5', color: '#059669',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconAward size={18} />
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {categoryData[0]?.totalAmount > 0 ? categoryData[0].label : '—'}
            </div>
            <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
              {categoryData[0]?.totalAmount > 0 ? `${formatMoney(categoryData[0].totalAmount)} (${Math.round(categoryData[0].pct)}%)` : 'Sin ingresos'}
            </span>
          </div>

          {/* Promedio Mensual */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Promedio Mensual
              </span>
              <div style={{
                width: '32px', height: '32px', borderRadius: '10px',
                background: '#f5f3ff', color: '#7c3aed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconTrendingUp size={18} />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {formatMoney(monthList.length > 0 ? grandTotal / monthList.length : 0)}
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
              En {monthList.length} {monthList.length === 1 ? 'mes' : 'meses'}
            </span>
          </div>

          {/* Líneas Activas */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Líneas Activas
              </span>
              <div style={{
                width: '32px', height: '32px', borderRadius: '10px',
                background: '#fffbeb', color: '#d97706',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconTarget size={18} />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {categoryData.filter(c => c.totalAmount > 0).length} / {CATEGORIES.length}
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
              Categorías con facturación
            </span>
          </div>
        </div>

        {/* ── Storytelling ── */}
        <div className="reports-storytelling-card">
          <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Análisis del período</span>
          <p className="reports-story-text">
            Del <strong className="highlight-slate">{fromDate}</strong> al <strong className="highlight-slate">{toDate}</strong> se generaron <strong className="highlight-green">{formatMoney(grandTotal)}</strong> en ingresos confirmados.
            {categoryData.map(c => ` ${c.label}: ${formatMoney(c.totalAmount)} (${Math.round(c.pct)}%)`).join(' · ')}
          </p>
        </div>

        {/* ── Category Breakdown ── */}
        <section className="reports-hero-panel" style={{ gap: '12px' }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Distribución por categoría</span>
              <h3 className="reports-section-title">Ingresos por tipo de servicio</h3>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: '1fr' }}>
            {categoryData.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                No hay ingresos registrados en este período
              </div>
            ) : categoryData.map(cat => {
              const pct = maxAmount > 0 ? (cat.totalAmount / maxAmount) * 100 : 0;
              const CatIcon = cat.Icon;
              return (
                <div key={cat.key} style={{
                  background: '#ffffff', borderRadius: '14px', padding: '16px 20px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '10px',
                        background: `${cat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: cat.color, flexShrink: 0
                      }}>
                        <CatIcon size={20} color={cat.color} />
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{cat.label}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{Math.round(cat.pct)}% del total general</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.02em' }}>{formatMoney(cat.totalAmount)}</div>
                    </div>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '999px',
                      background: `linear-gradient(90deg, ${cat.color}, ${cat.color}dd)`,
                      width: `${Math.max(1, pct)}%`,
                      transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Monthly table ── */}
        <section className="reports-hero-panel" style={{ gap: '8px' }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Desglose mensual</span>
              <h3 className="reports-section-title">Detalle por mes × categoría</h3>
            </div>
          </div>

          <div className="reports-table-wrap" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="reports-table" style={{ minWidth: '600px' }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  {CATEGORIES.map(cat => {
                    const CatIcon = cat.Icon;
                    return (
                      <th key={cat.key} style={{ textAlign: 'center', fontSize: '10px', padding: '8px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <CatIcon size={14} color={cat.color} />
                          <span style={{ fontWeight: 700 }}>{cat.label}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {chartData.monthlyData.map(m => {
                  const isCurrentMonth = m.monthKey === currentMonthKey;
                  return (
                    <tr key={m.monthKey} style={{ background: isCurrentMonth ? '#eff6ff' : 'transparent' }}>
                      <td style={{ fontWeight: 700 }}>{m.monthName} {m.year}</td>
                      <td style={{ fontWeight: 800, color: '#0f172a', textAlign: 'right' }}>{m.total > 0 ? formatMoney(m.total) : '—'}</td>
                      {CATEGORIES.map(cat => {
                        const catMonth = m.categories.find(c => c.key === cat.key);
                        const amount = catMonth?.amount || 0;
                        return (
                          <td key={cat.key} style={{ textAlign: 'center', padding: '8px 6px', fontSize: '11px' }}>
                            {amount > 0 ? (
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatMoney(amount)}</div>
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
              {grandTotal > 0 && (
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td style={{ fontWeight: 800, color: '#0f172a' }}>Total</td>
                    <td style={{ fontWeight: 800, color: '#0f172a', textAlign: 'right' }}>{formatMoney(grandTotal)}</td>
                    {CATEGORIES.map(cat => {
                      const total = categoryData.find(c => c.key === cat.key)?.totalAmount || 0;
                      return (
                        <td key={cat.key} style={{ textAlign: 'center', padding: '8px 6px' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '12px' }}>{total > 0 ? formatMoney(total) : '—'}</div>
                        </td>
                      );
                    })}
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
