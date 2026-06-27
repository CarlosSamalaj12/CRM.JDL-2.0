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

// Statuses considered as active sales
const ACTIVE_STATUSES = new Set([
  'Pre reserva', 'Reserva sin Cotizacion', '1er Cotizacion', 'Seguimiento',
  'Lista de Espera', 'Confirmado', 'Realizado',
]);

export default function ReportsVentasUsuario({ onClose }) {
  const { events, users } = useOutletContext();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [fromDate, setFromDate] = useState(getLocalDateStr(firstOfMonth));
  const [toDate, setToDate] = useState(getLocalDateStr(lastOfMonth));
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredBarPos, setHoveredBarPos] = useState(null);
  const [hoveredTableCellPos, setHoveredTableCellPos] = useState(null);
  const [hoveredTableCellData, setHoveredTableCellData] = useState(null);
  const [sortBy, setSortBy] = useState('amount'); // 'amount' | 'events' | 'name'
  const [userFilter, setUserFilter] = useState('all');
  const [pdfLoading, setPdfLoading] = useState(false);
  const reportRef = useRef(null);

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

  // ── Aggregate sales by user ──
  const userData = useMemo(() => {
    if (!events || !monthList.length) return [];

    const from = monthList[0].key + '-01';
    const to = monthList[monthList.length - 1].key + '-' + String(monthList[monthList.length - 1].daysInMonth).padStart(2, '0');

    // Aggregate by userId
    const userAgg = {}; // { userId: { count, totalAmount, monthBreakdown: { "YYYY-MM": { count, amount } } } }

    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) continue;

      // Only include events with active status AND a quote total
      const status = String(ev.status || '').trim();
      if (!ACTIVE_STATUSES.has(status)) continue;

      const amount = Math.max(0, Number(ev.quote?.total || 0));
      if (amount <= 0) continue; // Only events with actual monetary value

      const userId = String(ev.userId || '').trim();
      if (!userId) continue;
      if (userFilter !== 'all' && userId !== userFilter) continue;

      const monthKey = d.substring(0, 7);

      if (!userAgg[userId]) {
        userAgg[userId] = { count: 0, totalAmount: 0, monthBreakdown: {} };
      }
      userAgg[userId].count += 1;
      userAgg[userId].totalAmount += amount;

      if (!userAgg[userId].monthBreakdown[monthKey]) {
        userAgg[userId].monthBreakdown[monthKey] = { count: 0, amount: 0 };
      }
      userAgg[userId].monthBreakdown[monthKey].count += 1;
      userAgg[userId].monthBreakdown[monthKey].amount += amount;
    }

    const userIds = Object.keys(userAgg);
    if (userIds.length === 0) return [];

    const totalAmountAll = userIds.reduce((sum, id) => sum + userAgg[id].totalAmount, 0);

    // Build result array with user info
    const result = userIds.map(userId => {
      const user = (users || []).find(u => String(u.id) === userId);
      const name = user?.fullName || user?.name || userId;
      const agg = userAgg[userId];
      return {
        userId,
        name,
        count: agg.count,
        totalAmount: agg.totalAmount,
        pct: totalAmountAll > 0 ? (agg.totalAmount / totalAmountAll) * 100 : 0,
        avgAmount: agg.count > 0 ? agg.totalAmount / agg.count : 0,
        monthBreakdown: agg.monthBreakdown,
      };
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'amount') return b.totalAmount - a.totalAmount;
      if (sortBy === 'events') return b.count - a.count;
      return (a.name || '').localeCompare(b.name || '');
    });

    return result;
  }, [events, monthList, users, sortBy, userFilter]);

  // ── Monthly breakdown (for table) ──
  const monthlyData = useMemo(() => {
    if (!userData.length) return [];

    return monthList.map(m => {
      let monthCount = 0;
      let monthAmount = 0;
      for (const u of userData) {
        const b = u.monthBreakdown[m.key];
        if (b) {
          monthCount += b.count;
          monthAmount += b.amount;
        }
      }
      return {
        monthKey: m.key,
        monthName: m.monthName,
        monthShort: m.monthShort,
        year: m.year,
        count: monthCount,
        totalAmount: monthAmount,
        userRows: userData.map(u => ({
          userId: u.userId,
          name: u.name,
          count: u.monthBreakdown[m.key]?.count || 0,
          amount: u.monthBreakdown[m.key]?.amount || 0,
        })).filter(r => r.count > 0),
      };
    });
  }, [userData, monthList]);

  // ── Aggregated KPIs ──
  const totalEvents = useMemo(() => userData.reduce((s, u) => s + u.count, 0), [userData]);
  const totalAmount = useMemo(() => userData.reduce((s, u) => s + u.totalAmount, 0), [userData]);
  const totalUsers = userData.length;
  const maxAmount = useMemo(() => userData.length > 0 ? Math.max(...userData.map(u => u.totalAmount)) : 0, [userData]);

  // Top seller
  const topSeller = useMemo(() => {
    if (!userData.length) return null;
    return userData.reduce((best, u) => u.totalAmount > best.totalAmount ? u : best, userData[0]);
  }, [userData]);

  // ── Tooltip data ──
  const hoveredUser = useMemo(
    () => (hoveredBar !== null && userData[hoveredBar]) ? userData[hoveredBar] : null,
    [hoveredBar, userData]
  );

  // ── Animation state ──
  const [animationPhase, setAnimationPhase] = useState('complete');
  const [visibleBars, setVisibleBars] = useState(9999);
  const animationKeyRef = useRef(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (userData.length > 0) {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        setAnimationPhase('complete');
        setVisibleBars(userData.length);
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
          if (i >= userData.length) {
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
  }, [userData]);

  const handleReset = () => {
    const t = new Date();
    setFromDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth(), 1)));
    setToDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth() + 1, 0)));
  };

  const handleExportExcel = () => {
    const escCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    // Sheet 1: Summary by vendor
    const summaryHeaders = ['Vendedor', 'Eventos', 'Monto Total (GTQ)', 'Porcentaje (%)', 'Promedio por Evento (GTQ)'];
    const summaryRows = userData.map(u => [
      escCsv(u.name),
      u.count,
      u.totalAmount.toFixed(2),
      Math.round(u.pct).toString(),
      (u.count > 0 ? u.totalAmount / u.count : 0).toFixed(2),
    ]);
    const totalRow = [
      escCsv('TOTAL'),
      totalEvents,
      totalAmount.toFixed(2),
      '100',
      (totalEvents > 0 ? totalAmount / totalEvents : 0).toFixed(2),
    ];

    // Sheet 2: Monthly breakdown by vendor
    const monthHeaders = ['Mes', 'Vendedor', 'Eventos', 'Monto (GTQ)', '% del Mes'];
    const monthRows = [];
    for (const m of monthlyData) {
      const label = `${m.monthName} ${m.year}`;
      let monthTotal = 0;
      for (const row of m.userRows) monthTotal += row.amount;
      for (const row of m.userRows) {
        monthRows.push([
          escCsv(label),
          escCsv(row.name),
          row.count,
          row.amount.toFixed(2),
          monthTotal > 0 ? ((row.amount / monthTotal) * 100).toFixed(1) : '0',
        ]);
      }
    }

    const csvContent = [
      // Summary sheet
      escCsv('RESUMEN POR VENDEDOR'),
      summaryHeaders.join(','),
      ...summaryRows.map(r => r.join(',')),
      totalRow.join(','),
      '',
      // Monthly breakdown sheet
      escCsv('DESGLOSE MENSUAL POR VENDEDOR'),
      monthHeaders.join(','),
      ...monthRows.map(r => r.join(',')),
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ventas_por_usuario_${fromDate}_a_${toDate}.csv`;
    link.click();
  };

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');
      const el = reportRef.current;
      if (!el) { setPdfLoading(false); return; }
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      let heightLeft = pdfH;
      let position = 0;
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 0, position, pdfW, pdfH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfW, pdfH);
        heightLeft -= pageH;
      }
      pdf.save(`ventas_por_usuario_${fromDate}_a_${toDate}.pdf`);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const sectionStyle = (delay) => ({
    opacity: animationPhase === 'initial' ? 0 : 1,
    transform: animationPhase === 'initial' ? 'translateY(20px)' : 'translateY(0)',
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
  });

  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const getBarColor = (pct, isHovered) => {
    if (pct >= 40) return isHovered ? '#059669' : '#10b981';
    if (pct >= 20) return isHovered ? '#0284c7' : '#3b82f6';
    if (pct >= 10) return isHovered ? '#2563eb' : '#60a5fa';
    if (pct > 0) return isHovered ? '#7c3aed' : '#a5b4fc';
    return '#e5e7eb';
  };

  return (
    <div className="reports-page-container" ref={reportRef}>
      <style>{`@keyframes tooltipFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {/* Header */}
      <div className="reports-page-header">
        <div className="reports-brand-header">
          <div className="reports-brand-badge">
            <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
          </div>
          <div>
            <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
            <div className="reports-title">💰 Ventas por Usuario</div>
            <div className="reports-subtitle">Montos en Quetzales generados por vendedor · Conteo de eventos · Porcentajes</div>
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
              <span className="reports-eyebrow">Ventas por vendedor</span>
              <h3 className="reports-section-title">Ventas × Vendedor</h3>
              <p className="reports-section-text">
                Cada barra representa un vendedor. La altura muestra el monto total en Quetzales de eventos con valor económico en estado activo.
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

            {/* Export PDF */}
            <button type="button" onClick={handleExportPDF} disabled={pdfLoading} style={{
              fontSize: '11px', fontWeight: 800, padding: '7px 14px',
              borderRadius: '8px', border: '1.5px solid #dc2626',
              background: pdfLoading ? '#fca5a5' : '#dc2626', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px',
              transition: 'all 0.15s ease',
              opacity: pdfLoading ? 0.7 : 1,
            }}
              onMouseEnter={e => { if (!pdfLoading) { e.currentTarget.style.background = '#b91c1c'; e.currentTarget.style.borderColor = '#b91c1c'; }}}
              onMouseLeave={e => { if (!pdfLoading) { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.borderColor = '#dc2626'; }}}
            >
              <svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 13v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" />
                <path d="M5 8l4 4 4-4" />
                <path d="M9 12V2" />
              </svg>
              {pdfLoading ? 'Generando...' : 'Exportar PDF'}
            </button>

            {/* User filter */}
            <label className="field" style={{ flex: '0 0 150px' }}>
              <span>Vendedor</span>
              <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={{
                fontSize: '11px', fontWeight: 700, padding: '6px 8px',
                borderRadius: '8px', border: '1.5px solid #e2e8f0',
                background: 'white', cursor: 'pointer',
              }}>
                <option value="all">Todos</option>
                {users?.map(u => (
                  <option key={u.id} value={String(u.id)}>{u.fullName || u.name || u.username}</option>
                ))}
              </select>
            </label>

            {/* Sort selector */}
            <label className="field" style={{ flex: '0 0 160px' }}>
              <span>Ordenar por</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ fontSize: '11px', fontWeight: 700, padding: '6px 8px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>
                <option value="amount">Monto (Q)</option>
                <option value="events">Cantidad eventos</option>
                <option value="name">Nombre</option>
              </select>
            </label>

            {/* Export button */}
            <button type="button" onClick={handleExportExcel} style={{
              fontSize: '11px', fontWeight: 800, padding: '7px 14px',
              borderRadius: '8px', border: '1.5px solid #16a34a',
              background: '#16a34a', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px',
              transition: 'all 0.15s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#15803d'; e.currentTarget.style.borderColor = '#15803d'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.borderColor = '#16a34a'; }}
            >
              <svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 13v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" />
                <path d="M5 8l4 4 4-4" />
                <path d="M9 12V2" />
              </svg>
              Exportar CSV
            </button>

            {/* Mini KPI chips */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                📋 <strong style={{ color: '#0f172a' }}>{totalEvents}</strong> {totalEvents === 1 ? 'evento' : 'eventos'}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                💰 <strong style={{ color: '#0f172a' }}>{formatMoney(totalAmount)}</strong>
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                👤 <strong style={{ color: '#0f172a' }}>{totalUsers}</strong> {totalUsers === 1 ? 'vendedor' : 'vendedores'}
              </span>
              {topSeller && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🏆 <strong style={{ color: '#0f172a' }}>{topSeller.name}</strong> {Math.round(topSeller.pct)}%
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ── Storytelling ── */}
        <div className="reports-storytelling-card" style={sectionStyle(200)}>
          <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Análisis del período</span>
          <p className="reports-story-text">
            En el rango del <strong className="highlight-slate">{fromDate}</strong> al <strong className="highlight-slate">{toDate}</strong> se registraron <strong className="highlight-blue">{totalEvents}</strong> eventos con valor económico por un total de <strong className="highlight-green">{formatMoney(totalAmount)}</strong>,
            distribuidos entre <strong className="highlight-slate">{totalUsers}</strong> {totalUsers === 1 ? 'vendedor' : 'vendedores'}.
            {topSeller ? <> El vendedor con mayor facturación es <strong className="highlight-blue">{topSeller.name}</strong> con <strong className="highlight-green">{formatMoney(topSeller.totalAmount)}</strong> ({Math.round(topSeller.pct)}% del total) en <strong className="highlight-slate">{topSeller.count}</strong> {topSeller.count === 1 ? 'evento' : 'eventos'}.</> : ''}
            El ticket promedio por evento es de <strong className="highlight-accent">{formatMoney(totalEvents > 0 ? totalAmount / totalEvents : 0)}</strong>.
          </p>
        </div>

        {/* ── Bar Chart ── */}
        <section className="reports-hero-panel" style={{ gap: '12px', ...sectionStyle(350) }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Gráfico de barras por vendedor</span>
              <h3 className="reports-section-title">Ventas × Vendedor</h3>
              <p className="reports-section-text">Pasa el mouse sobre cada barra para ver eventos, monto y porcentaje del vendedor</p>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '14px', fontSize: '10px', fontWeight: 700, color: '#64748b', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981', display: 'inline-block' }} /> ≥40%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3b82f6', display: 'inline-block' }} /> 20-39%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#60a5fa', display: 'inline-block' }} /> 10-19%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#a5b4fc', display: 'inline-block' }} /> {'<10%'}
              </span>
              {totalAmount > 0 && (
                <span style={{ marginLeft: '4px', color: '#94a3b8', fontStyle: 'italic' }}>
                  Total: <strong>{formatMoney(totalAmount)}</strong>
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

                {userData.length === 0 ? (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700, color: '#94a3b8',
                    flexDirection: 'column', gap: '8px',
                  }}>
                    <span style={{ fontSize: '32px' }}>📭</span>
                    <span>No hay ventas registradas en este período</span>
                  </div>
                ) : (
                  userData.map((u, i) => {
                    const isHovered = hoveredBar === i;
                    const pctOfMax = maxAmount > 0 ? (u.totalAmount / maxAmount) * 100 : 0;
                    const barColor = getBarColor(u.pct, isHovered);

                    return (
                      <div
                        key={u.userId}
                        style={{
                          flex: '1 1 0',
                          minWidth: '60px',
                          maxWidth: '120px',
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
                          fontSize: u.totalAmount > 0 ? '10px' : '0',
                          fontWeight: 900, color: barColor,
                          lineHeight: 1, marginBottom: '3px',
                          opacity: isHovered || u.pct > 30 ? 1 : 0.7,
                          transition: 'all 0.15s ease',
                          transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                        }}>
                          {u.totalAmount > 0 ? formatMoney(u.totalAmount) : ''}
                        </div>

                        {/* The bar */}
                        <div style={{
                          width: '80%',
                          height: `${Math.max(pctOfMax > 0 ? Math.max(4, pctOfMax) : 0, 0)}%`,
                          background: u.totalAmount === 0
                            ? '#f1f5f9'
                            : `linear-gradient(180deg, ${barColor}, ${barColor}dd)`,
                          borderRadius: '4px 4px 0 0',
                          transition: 'opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, transform 0.15s ease',
                          opacity: i < visibleBars ? 1 : (animationPhase === 'initial' ? 0 : 1),
                          boxShadow: u.totalAmount > 0
                            ? (isHovered ? `0 0 12px ${barColor}50, inset 0 1px 0 rgba(255,255,255,0.3)` : `inset 0 1px 0 rgba(255,255,255,0.3)`)
                            : 'none',
                          transform: isHovered && u.totalAmount > 0 ? 'scaleX(1.1)' : 'scaleX(1)',
                          minHeight: u.totalAmount > 0 ? '4px' : '2px',
                        }} />

                        {/* Name + count at bottom */}
                        <div style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          color: isHovered ? '#0f172a' : '#64748b',
                          marginTop: '6px', textAlign: 'center',
                          lineHeight: 1.1,
                          position: 'absolute', bottom: '-18px', left: 0, right: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          transition: 'color 0.15s ease',
                        }}>
                          {u.name.split(' ').slice(0, 2).join(' ')}
                        </div>
                        <div style={{
                          fontSize: '8px',
                          fontWeight: 600,
                          color: '#94a3b8',
                          position: 'absolute', bottom: '-30px', left: 0, right: 0,
                          textAlign: 'center',
                        }}>
                          {u.count} {u.count === 1 ? 'ev' : 'evs'} · {Math.round(u.pct)}%
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
        {hoveredUser && hoveredBarPos && (() => {
          const u = hoveredUser;
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
                  <div style={{ fontSize: '14px', fontWeight: 900, marginBottom: '6px', letterSpacing: '-0.01em' }}>
                    {u.name}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '10px', color: '#cbd5e1' }}>
                    <span style={{ color: '#94a3b8' }}>💰 Total vendido</span>
                    <span style={{ fontWeight: 800, color: '#10b981' }}>{formatMoney(u.totalAmount)}</span>
                    <span style={{ color: '#94a3b8' }}>📋 Eventos</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{u.count}</span>
                    <span style={{ color: '#94a3b8' }}>📊 Porcentaje</span>
                    <span style={{ fontWeight: 800, color: '#60a5fa' }}>{Math.round(u.pct)}%</span>
                    <span style={{ color: '#94a3b8' }}>📈 Ticket promedio</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{formatMoney(u.avgAmount)} / evento</span>
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

        {/* ── Premium Tooltip for table cells (fixed position, outside overflow containers) ── */}
        {hoveredTableCellData && hoveredTableCellPos && (() => {
          const d = hoveredTableCellData;
          return (
            <div style={{
              position: 'fixed',
              left: `${Math.min(hoveredTableCellPos.x, window.innerWidth - 260)}px`,
              top: `${Math.max(10, hoveredTableCellPos.y - 10)}px`,
              transform: 'translate(-50%, -100%)',
              zIndex: 99998,
              pointerEvents: 'none',
            }}>
              <div style={{
                background: '#0f172a', color: '#fff',
                padding: '12px 16px',
                borderRadius: '12px',
                fontSize: '11px', fontWeight: 600,
                boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                minWidth: '200px',
                maxWidth: '300px',
                animation: 'tooltipFadeIn 0.15s ease-out both',
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 900, marginBottom: '6px', letterSpacing: '-0.01em' }}>
                    {d.isMonthTotal ? '📅' : ''} {d.name}
                    {d.month !== 'Total' && <span style={{ fontWeight: 600, color: '#94a3b8', marginLeft: '6px' }}>{d.month} {d.year}</span>}
                    {d.month === 'Total' && <span style={{ fontWeight: 600, color: '#94a3b8', marginLeft: '6px' }}>({d.month})</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '10px', color: '#cbd5e1' }}>
                    <span style={{ color: '#94a3b8' }}>💰 Monto</span>
                    <span style={{ fontWeight: 800, color: '#10b981' }}>{formatMoney(d.amount)}</span>
                    <span style={{ color: '#94a3b8' }}>📋 Eventos</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{d.count}</span>
                    {!d.isMonthTotal && (
                      <>
                        <span style={{ color: '#94a3b8' }}>📊 Porcentaje</span>
                        <span style={{ fontWeight: 800, color: '#60a5fa' }}>{Math.round(d.pct)}%</span>
                      </>
                    )}
                    {d.isMonthTotal && (
                      <>
                        <span style={{ color: '#94a3b8' }}>📊 % del total</span>
                        <span style={{ fontWeight: 800, color: '#60a5fa' }}>{Math.round(d.pct)}%</span>
                      </>
                    )}
                    <span style={{ color: '#94a3b8' }}>📈 Promedio</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{formatMoney(d.count > 0 ? d.amount / d.count : 0)} / evento</span>
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
              <h3 className="reports-section-title">Desglose por mes × vendedor</h3>
            </div>
          </div>

          <div className="reports-table-wrap" style={{ maxHeight: '500px' }}>
            <table className="reports-table" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Total eventos</th>
                  <th>Total monto</th>
                  {userData.map(u => (
                    <th key={u.userId} style={{ textAlign: 'center', fontSize: '9px', padding: '8px 4px', maxWidth: '100px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.name.split(' ').slice(0, 2).join(' ')}
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
                      <td style={{ fontWeight: 800, color: '#0f172a', cursor: 'pointer' }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredTableCellPos({ x: rect.left + rect.width / 2, y: rect.top });
                          setHoveredTableCellData({
                            name: 'Total del mes',
                            month: m.monthName,
                            year: m.year,
                            count: m.count,
                            amount: m.totalAmount,
                            pct: totalAmount > 0 ? (m.totalAmount / totalAmount) * 100 : 0,
                            isMonthTotal: true,
                          });
                        }}
                        onMouseLeave={() => { setHoveredTableCellPos(null); setHoveredTableCellData(null); }}
                      >{m.count}</td>
                      <td style={{ fontWeight: 700, color: '#059669', cursor: 'pointer' }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredTableCellPos({ x: rect.left + rect.width / 2, y: rect.top });
                          setHoveredTableCellData({
                            name: 'Total del mes',
                            month: m.monthName,
                            year: m.year,
                            count: m.count,
                            amount: m.totalAmount,
                            pct: totalAmount > 0 ? (m.totalAmount / totalAmount) * 100 : 0,
                            isMonthTotal: true,
                          });
                        }}
                        onMouseLeave={() => { setHoveredTableCellPos(null); setHoveredTableCellData(null); }}
                      >{m.totalAmount > 0 ? formatMoney(m.totalAmount) : '—'}</td>
                      {userData.map(u => {
                        const row = m.userRows.find(r => r.userId === u.userId);
                        const count = row?.count || 0;
                        const amount = row?.amount || 0;
                        return (
                          <td
                            key={u.userId}
                            style={{ textAlign: 'center', padding: '8px 4px', fontSize: '10px', cursor: count > 0 ? 'pointer' : 'default' }}
                            onMouseEnter={(e) => {
                              if (count <= 0) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredTableCellPos({ x: rect.left + rect.width / 2, y: rect.top });
                              setHoveredTableCellData({
                                name: u.name,
                                month: m.monthName,
                                year: m.year,
                                count,
                                amount,
                                pct: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
                              });
                            }}
                            onMouseLeave={() => { setHoveredTableCellPos(null); setHoveredTableCellData(null); }}
                          >
                            {count > 0 ? (
                              <>
                                <div style={{ fontWeight: 700, fontSize: '11px', color: '#0f172a' }}>{count}</div>
                                <div style={{ fontWeight: 600, color: '#059669' }}>{formatMoney(amount)}</div>
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
              {userData.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td style={{ fontWeight: 800, color: '#0f172a' }}>Total</td>
                    <td style={{ fontWeight: 800, color: '#0f172a' }}>{totalEvents}</td>
                    <td style={{ fontWeight: 800, color: '#059669' }}>{formatMoney(totalAmount)}</td>
                    {userData.map(u => (
                      <td
                        key={u.userId}
                        style={{ textAlign: 'center', padding: '8px 4px', fontSize: '10px', cursor: 'pointer' }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredTableCellPos({ x: rect.left + rect.width / 2, y: rect.top });
                          setHoveredTableCellData({
                            name: u.name,
                            month: 'Total',
                            year: '',
                            count: u.count,
                            amount: u.totalAmount,
                            pct: totalAmount > 0 ? (u.totalAmount / totalAmount) * 100 : 0,
                          });
                        }}
                        onMouseLeave={() => { setHoveredTableCellPos(null); setHoveredTableCellData(null); }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '11px', color: '#0f172a' }}>{u.count}</div>
                        <div style={{ fontWeight: 600, color: '#059669' }}>{formatMoney(u.totalAmount)}</div>
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
