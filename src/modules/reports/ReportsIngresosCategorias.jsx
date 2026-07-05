import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../../utils/numberToWords';
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

const CATEGORIES = [
  { key: 'alimentosBebidas', label: 'Alimentos & Bebidas', icon: '🍽️', color: '#3b82f6' },
  { key: 'hospedajeJdl', label: 'Hospedaje JDL', icon: '🏨', color: '#8b5cf6' },
  { key: 'hospedajeTerceros', label: 'Hospedaje de Terceros', icon: '🏡', color: '#f59e0b' },
  { key: 'miscelaneos', label: 'Misceláneos', icon: '📦', color: '#10b981' },
];

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

  const CAT_ITEM_MAP = [
    { key: 'alimentosBebidas', patterns: ['alimentos', 'bebidas', 'comida', 'catering', 'menu', 'bar', 'coctel'] },
    { key: 'hospedajeJdl',     patterns: ['hospedaje jdl', 'hospedaje propio'] },
    { key: 'hospedajeTerceros', patterns: ['hospedaje de terceros', 'hospedaje terceros', 'hospedaje 3ros'] },
  ];

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

    const from = monthList[0].key + '-01';
    const to = monthList[monthList.length - 1].key + '-' + String(monthList[monthList.length - 1].daysInMonth).padStart(2, '0');

    const catTotals = { alimentosBebidas: 0, hospedajeJdl: 0, hospedajeTerceros: 0, miscelaneos: 0 };
    let grandTotal = 0;
    const monthlyCatTotals = {};

    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) continue;
      if (!ACTIVE_STATUSES.has(String(ev.status || '').trim())) continue;

      const monthKey = d.substring(0, 7);
      const quoteItems = ev.quote?.items || [];
      if (!monthlyCatTotals[monthKey]) {
        monthlyCatTotals[monthKey] = { alimentosBebidas: 0, hospedajeJdl: 0, hospedajeTerceros: 0, miscelaneos: 0 };
      }
      for (const item of quoteItems) {
        const itemTotal = Number(item.qty || 0) * Number(item.price || 0);
        if (itemTotal <= 0) continue;
        const bucketKey = mapCategoryToBucket(item.category || '', item.name);
        catTotals[bucketKey] += itemTotal;
        grandTotal += itemTotal;
        monthlyCatTotals[monthKey][bucketKey] += itemTotal;
      }
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
          key: cat.key, label: cat.label, color: cat.color,
          amount: mTotals[cat.key] || 0,
          pct: monthTotal > 0 ? ((mTotals[cat.key] || 0) / monthTotal) * 100 : 0,
        })),
      };
    });

    return { categoryData, monthlyData, grandTotal };
  }, [events, monthList]);

  const { categoryData, grandTotal } = chartData;

  const handleReset = () => {
    const t = new Date();
    setFromDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth(), 1)));
    setToDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth() + 1, 0)));
  };

  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const maxAmount = categoryData.length > 0 ? Math.max(...categoryData.map(c => c.totalAmount)) : 0;

  return (
    <div className="reports-page-container">
      {/* Header */}
      <div className="reports-page-header">
        <div className="reports-brand-header">
          <div className="reports-brand-badge">
            <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
          </div>
          <div>
            <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
            <div className="reports-title">📊 Ingresos por Categoría de Servicio</div>
            <div className="reports-subtitle">Montos en Quetzales por categoría · Alimentos & Bebidas · Hospedajes · Misceláneos</div>
          </div>
        </div>
        <ReportInfo reportKey="ingresosCategorias" />
        <button className="btn-exit" type="button" onClick={onClose}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver
        </button>
      </div>

      <div className="reports-page-body">
        {/* Filters */}
        <section className="reports-hero-panel">
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
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                💰 <strong style={{ color: '#0f172a' }}>{formatMoney(grandTotal)}</strong> total
              </span>
            </div>
          </div>
        </section>

        {/* Storytelling */}
        <div className="reports-storytelling-card">
          <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Análisis del período</span>
          <p className="reports-story-text">
            Del <strong className="highlight-slate">{fromDate}</strong> al <strong className="highlight-slate">{toDate}</strong> se generaron <strong className="highlight-green">{formatMoney(grandTotal)}</strong> en ingresos.
            {categoryData.map(c => ` ${c.icon} ${c.label}: ${formatMoney(c.totalAmount)} (${Math.round(c.pct)}%)`).join(' · ')}
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
              return (
                <div key={cat.key} style={{
                  background: '#ffffff', borderRadius: '12px', padding: '14px 18px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: `${cat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '18px',
                      }}>{cat.icon}</div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{cat.label}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{Math.round(cat.pct)}% del total</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.02em' }}>{formatMoney(cat.totalAmount)}</div>
                    </div>
                  </div>
                  <div style={{ height: '10px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}>
                    <div style={{
                      height: '100%', borderRadius: '999px',
                      background: `linear-gradient(90deg, ${cat.color}, ${cat.color}bb)`,
                      width: `${Math.max(2, pct)}%`,
                      transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
                      boxShadow: `0 0 6px ${cat.color}30`,
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
                  {CATEGORIES.map(cat => (
                    <th key={cat.key} style={{ textAlign: 'center', fontSize: '10px', padding: '8px 6px' }}>
                      <span style={{ fontSize: '14px' }}>{cat.icon}</span>
                      <div style={{ fontWeight: 700, marginTop: '2px' }}>{cat.label}</div>
                    </th>
                  ))}
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
