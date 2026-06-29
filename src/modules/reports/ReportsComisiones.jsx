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

const ACTIVE_STATUSES = new Set([
  'Pre reserva', 'Reserva sin Cotizacion', '1er Cotizacion', 'Seguimiento',
  'Lista de Espera', 'Confirmado', 'Realizado',
]);

// ── Commission calculation logic ──
function calcCommission(totalSales, tiers) {
  if (!tiers || !tiers.length || totalSales <= 0) {
    return { reachedTier: null, commissionAmount: 0, nextTier: tiers?.[0] || null, progressToNext: 0 };
  }

  // Sort tiers by amount ascending
  const sorted = [...tiers].sort((a, b) => a.amount - b.amount);

  let reachedTier = null;
  for (const t of sorted) {
    if (totalSales >= t.amount) {
      reachedTier = t;
    }
  }

  // Commission = totalSales * the percentage of the reached tier
  const commissionAmount = reachedTier ? (totalSales * reachedTier.percentage) / 100 : 0;

  // Find next tier
  const nextTier = reachedTier
    ? sorted.find(t => t.amount > reachedTier.amount) || null
    : sorted[0];

  const progressToNext = nextTier && totalSales > 0
    ? Math.min(100, Math.max(0, ((totalSales - (reachedTier?.amount || 0)) / (nextTier.amount - (reachedTier?.amount || 0))) * 100))
    : (reachedTier ? 100 : 0);

  return { reachedTier, commissionAmount, nextTier, progressToNext };
}

export default function ReportsComisiones({ onClose }) {
  const { events, users } = useOutletContext();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [fromDate, setFromDate] = useState(getLocalDateStr(firstOfMonth));
  const [toDate, setToDate] = useState(getLocalDateStr(lastOfMonth));
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredBarPos, setHoveredBarPos] = useState(null);
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

  // ── Aggregate sales and compute commissions ──
  const commissionData = useMemo(() => {
    if (!events || !monthList.length || !users) return { userRows: [], totalSales: 0, totalCommission: 0, totalUsersWithTiers: 0 };

    const from = monthList[0].key + '-01';
    const to = monthList[monthList.length - 1].key + '-' + String(monthList[monthList.length - 1].daysInMonth).padStart(2, '0');

    // Aggregate sales by userId
    const salesByUser = {};
    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) continue;
      const status = String(ev.status || '').trim();
      if (!ACTIVE_STATUSES.has(status)) continue;
      const amount = Math.max(0, Number(ev.quote?.total || 0));
      if (amount <= 0) continue;
      const userId = String(ev.userId || '').trim();
      if (!userId) continue;
      if (userFilter !== 'all' && userId !== userFilter) continue;

      salesByUser[userId] = (salesByUser[userId] || 0) + amount;
    }

    // Build rows with commission calculation
    const rows = [];
    let totalSales = 0;
    let totalCommission = 0;
    let totalUsersWithTiers = 0;

    for (const user of users) {
      const userId = String(user.id).trim();
      if (!userId) continue;
      const salesAmount = salesByUser[userId] || 0;
      const tiers = Array.isArray(user.goalTiers) ? user.goalTiers.filter(t => t.amount > 0) : [];
      const hasTiers = tiers.length > 0 && user.salesTargetEnabled;

      const { reachedTier, commissionAmount, nextTier, progressToNext } = hasTiers
        ? calcCommission(salesAmount, tiers)
        : { reachedTier: null, commissionAmount: 0, nextTier: null, progressToNext: 0 };

      rows.push({
        userId,
        name: user.fullName || user.name || userId,
        salesAmount,
        hasTiers: hasTiers && tiers.length > 0,
        tiers,
        reachedTier,
        commissionAmount,
        commissionPct: reachedTier ? reachedTier.percentage : 0,
        nextTier,
        progressToNext,
      });

      totalSales += salesAmount;
      totalCommission += commissionAmount;
      if (hasTiers && tiers.length > 0) totalUsersWithTiers++;
    }

    // Sort: users with sales first, then by commission amount desc
    rows.sort((a, b) => {
      if (a.salesAmount > 0 && b.salesAmount === 0) return -1;
      if (a.salesAmount === 0 && b.salesAmount > 0) return 1;
      return b.commissionAmount - a.commissionAmount;
    });

    return { userRows: rows, totalSales, totalCommission, totalUsersWithTiers };
  }, [events, monthList, users, userFilter]);

  const { userRows, totalSales, totalCommission, totalUsersWithTiers } = commissionData;

  const maxSales = useMemo(() => userRows.length > 0 ? Math.max(...userRows.map(r => r.salesAmount)) : 0, [userRows]);
  const maxCommission = useMemo(() => userRows.length > 0 ? Math.max(...userRows.map(r => r.commissionAmount)) : 0, [userRows]);

  // Top by commission
  const topByCommission = useMemo(() => {
    if (!userRows.length) return null;
    return userRows.reduce((best, r) => r.commissionAmount > best.commissionAmount ? r : best, userRows[0]);
  }, [userRows]);

  // ── Tooltip data ──
  const hoveredRow = useMemo(
    () => (hoveredBar !== null && userRows[hoveredBar]) ? userRows[hoveredBar] : null,
    [hoveredBar, userRows]
  );

  // ── Animation state ──
  const [animationPhase, setAnimationPhase] = useState('complete');
  const [visibleBars, setVisibleBars] = useState(9999);
  const animationKeyRef = useRef(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (userRows.length > 0) {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        setAnimationPhase('complete');
        setVisibleBars(userRows.length);
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
          if (i >= userRows.length) {
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
  }, [userRows]);

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

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');
      const el = reportRef.current;
      if (!el) { setPdfLoading(false); return; }
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
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
      pdf.save(`comisiones_${fromDate}_a_${toDate}.pdf`);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExportExcel = () => {
    const escCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headers = ['Vendedor', 'Ventas (GTQ)', 'Tier Alcanzado', '% Comisión', 'Comisión (GTQ)', 'Siguiente Tier', 'Progreso (%)'];
    const rows = userRows.map(r => [
      escCsv(r.name),
      r.salesAmount.toFixed(2),
      escCsv(r.reachedTier?.name || (r.hasTiers ? 'Ninguno' : '—')),
      r.reachedTier ? r.reachedTier.percentage.toString() : (r.hasTiers ? '0' : '—'),
      r.commissionAmount.toFixed(2),
      escCsv(r.nextTier?.name || '—'),
      r.hasTiers ? Math.round(r.progressToNext).toString() : '—',
    ]);
    const csvContent = [
      escCsv('REPORTE DE COMISIONES'),
      headers.join(','),
      ...rows.map(r => r.join(',')),
      `,Total,${totalSales.toFixed(2)},,${totalCommission.toFixed(2)},,`,
    ].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `comisiones_${fromDate}_a_${toDate}.csv`;
    link.click();
  };

  const maxBarAmount = Math.max(maxSales, maxCommission);

  // ── Unique tier thresholds across all users ──
  const tierThresholds = useMemo(() => {
    const seen = new Set();
    const thresholds = [];
    for (const r of userRows) {
      if (!r.hasTiers) continue;
      for (const t of r.tiers) {
        if (!seen.has(t.name)) {
          seen.add(t.name);
          thresholds.push({ name: t.name, amount: t.amount });
        }
      }
    }
    return thresholds.sort((a, b) => a.amount - b.amount);
  }, [userRows]);

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
            <div className="reports-title">🏆 Reporte de Comisiones</div>
            <div className="reports-subtitle">Ventas vs Niveles de Meta · Cálculo de comisiones · Progreso hacia siguiente nivel</div>
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
              <span className="reports-eyebrow">Comisiones por vendedor</span>
              <h3 className="reports-section-title">Comisiones × Vendedor</h3>
              <p className="reports-section-text">
                Cada barra representa un vendedor. La barra izquierda (verde) muestra sus <strong>ventas totales</strong>,
                la barra derecha (azul) muestra la <strong>comisión</strong> generada según el nivel de meta alcanzado.
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

            {/* Export PDF button */}
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

            {/* Export CSV button */}
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
                💰 <strong style={{ color: '#0f172a' }}>{formatMoney(totalSales)}</strong> en ventas
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                🏆 <strong style={{ color: '#059669' }}>{formatMoney(totalCommission)}</strong> en comisiones
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                👤 <strong style={{ color: '#0f172a' }}>{totalUsersWithTiers}</strong> con metas
              </span>
              {topByCommission && topByCommission.commissionAmount > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🥇 <strong style={{ color: '#0f172a' }}>{topByCommission.name}</strong> {formatMoney(topByCommission.commissionAmount)}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ── Storytelling ── */}
        <div className="reports-storytelling-card" style={sectionStyle(200)}>
          <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Análisis del período</span>
          <p className="reports-story-text">
            En el rango del <strong className="highlight-slate">{fromDate}</strong> al <strong className="highlight-slate">{toDate}</strong> se registraron <strong className="highlight-blue">{formatMoney(totalSales)}</strong> en ventas
            generando <strong className="highlight-green">{formatMoney(totalCommission)}</strong> en comisiones.
            {totalUsersWithTiers > 0
              ? <> <strong className="highlight-slate">{totalUsersWithTiers}</strong> vendedores tienen niveles de meta configurados.</>
              : <> Ningún vendedor tiene niveles de meta configurados. Ve a Configuración → Usuarios para agregarlos.</>}
            {topByCommission && topByCommission.commissionAmount > 0
              ? <> El vendedor con mayor comisión es <strong className="highlight-blue">{topByCommission.name}</strong> con <strong className="highlight-green">{formatMoney(topByCommission.commissionAmount)}</strong>.</>
              : ''}
            La tasa de comisión promedio es de <strong className="highlight-accent">{totalSales > 0 ? ((totalCommission / totalSales) * 100).toFixed(2) : '0'}%</strong>.
          </p>
        </div>

        {/* ── Bar Chart (dual: sales + commission) ── */}
        <section className="reports-hero-panel" style={{ gap: '12px', ...sectionStyle(350) }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Gráfico de barras</span>
              <h3 className="reports-section-title">Ventas vs Comisiones × Vendedor</h3>
              <p className="reports-section-text">Barra verde = ventas totales · Barra azul = comisión generada · Pasa el mouse para detalles</p>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '14px', fontSize: '10px', fontWeight: 700, color: '#64748b', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981', display: 'inline-block' }} /> Ventas
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3b82f6', display: 'inline-block' }} /> Comisión
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#f59e0b', display: 'inline-block' }} /> Meta alcanzada
              </span>
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
                    {formatMoney(maxBarAmount * pct / 100)}
                  </span>
                ))}
              </div>

              {/* Bars area */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '8px', position: 'relative', minHeight: '280px' }}>
                {[20, 40, 60, 80].map(pct => (
                  <div key={pct} style={{
                    position: 'absolute', left: 0, right: 0, bottom: `${pct}%`,
                    height: '1px', background: '#f1f5f9', pointerEvents: 'none',
                    borderTop: '1px dashed #e2e8f0',
                  }} />
                ))}

                {/* Tier threshold reference lines */}
                {maxBarAmount > 0 && tierThresholds.map((th, idx) => {
                  const pct = (th.amount / maxBarAmount) * 100;
                  if (pct <= 0 || pct >= 100) return null;
                  const colors = ['#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316'];
                  const color = colors[idx % colors.length];
                  return (
                    <div key={th.name} style={{
                      position: 'absolute', left: 0, right: 0, bottom: `${pct}%`,
                      height: '0', pointerEvents: 'none',
                      borderTop: `2px dashed ${color}`,
                      zIndex: 5,
                    }}>
                      {/* Label on the right side */}
                      <div style={{
                        position: 'absolute', right: '4px', top: '-8px',
                        fontSize: '9px', fontWeight: 800, color,
                        background: '#ffffff', padding: '0 4px',
                        borderRadius: '3px',
                        lineHeight: '16px',
                        whiteSpace: 'nowrap',
                      }}>
                        {th.name}: {formatMoney(th.amount)}
                      </div>
                    </div>
                  );
                })}

                {userRows.length === 0 ? (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700, color: '#94a3b8',
                    flexDirection: 'column', gap: '8px',
                  }}>
                    <span style={{ fontSize: '32px' }}>📭</span>
                    <span>No hay datos en este período</span>
                  </div>
                ) : (
                  userRows.map((r, i) => {
                    const isHovered = hoveredBar === i;
                    const salesPct = maxBarAmount > 0 ? (r.salesAmount / maxBarAmount) * 100 : 0;
                    const commPct = maxBarAmount > 0 ? (r.commissionAmount / maxBarAmount) * 100 : 0;
                    const hasData = r.salesAmount > 0;

                    return (
                      <div
                        key={r.userId}
                        style={{
                          flex: '1 1 0',
                          minWidth: '70px',
                          maxWidth: '130px',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          position: 'relative',
                          cursor: 'pointer',
                          gap: '2px',
                        }}
                        onMouseEnter={(e) => {
                          setHoveredBar(i);
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredBarPos({ x: rect.left + rect.width / 2, y: rect.top });
                        }}
                        onMouseLeave={() => { setHoveredBar(null); setHoveredBarPos(null); }}
                      >
                        {/* Sales bar */}
                        <div style={{
                          width: '38%',
                          height: `${Math.max(salesPct > 0 ? Math.max(4, salesPct) : 0, 0)}%`,
                          background: hasData
                            ? (isHovered ? 'linear-gradient(180deg, #059669, #10b981)' : 'linear-gradient(180deg, #10b981, #34d399)')
                            : '#f1f5f9',
                          borderRadius: '3px 3px 0 0',
                          transition: 'opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease',
                          opacity: i < visibleBars ? 1 : (animationPhase === 'initial' ? 0 : 1),
                          boxShadow: isHovered && hasData ? '0 0 10px rgba(16,185,129,0.4)' : 'none',
                          minHeight: hasData ? '4px' : '2px',
                        }} />

                        {/* Commission bar */}
                        <div style={{
                          width: '38%',
                          height: `${Math.max(commPct > 0 ? Math.max(3, commPct) : 0, 0)}%`,
                          background: r.commissionAmount > 0
                            ? (isHovered ? 'linear-gradient(180deg, #2563eb, #3b82f6)' : 'linear-gradient(180deg, #3b82f6, #60a5fa)')
                            : '#f1f5f9',
                          borderRadius: '3px 3px 0 0',
                          transition: 'opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease',
                          opacity: i < visibleBars ? 1 : (animationPhase === 'initial' ? 0 : 1),
                          boxShadow: isHovered && r.commissionAmount > 0 ? '0 0 10px rgba(59,130,246,0.4)' : 'none',
                          minHeight: r.commissionAmount > 0 ? '3px' : '2px',
                        }} />

                        {/* Tier badge (if reached) */}
                        {r.reachedTier && (
                          <div style={{
                            position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)',
                            fontSize: '9px', fontWeight: 900, color: '#f59e0b',
                            textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                          }}>
                            {r.reachedTier.name}
                          </div>
                        )}

                        {/* Name at bottom */}
                        <div style={{
                          fontSize: '9px', fontWeight: 700,
                          color: isHovered ? '#0f172a' : '#64748b',
                          position: 'absolute', bottom: '-20px', left: 0, right: 0,
                          textAlign: 'center', lineHeight: 1.1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          transition: 'color 0.15s ease',
                        }}>
                          {r.name.split(' ').slice(0, 2).join(' ')}
                        </div>

                        {/* Commission amount below name */}
                        {r.commissionAmount > 0 && (
                          <div style={{
                            fontSize: '7px', fontWeight: 600, color: '#3b82f6',
                            position: 'absolute', bottom: '-32px', left: 0, right: 0,
                            textAlign: 'center',
                          }}>
                            {formatMoney(r.commissionAmount)}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Premium Tooltip ── */}
        {hoveredRow && hoveredBarPos && (() => {
          const r = hoveredRow;
          return (
            <div style={{
              position: 'fixed',
              left: `${Math.min(hoveredBarPos.x, window.innerWidth - 300)}px`,
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
                minWidth: '250px',
                maxWidth: '340px',
                animation: 'tooltipFadeIn 0.15s ease-out both',
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, marginBottom: '6px', letterSpacing: '-0.01em' }}>
                    {r.name}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '10px', color: '#cbd5e1' }}>
                    <span style={{ color: '#94a3b8' }}>💰 Ventas</span>
                    <span style={{ fontWeight: 800, color: '#10b981' }}>{formatMoney(r.salesAmount)}</span>
                    <span style={{ color: '#94a3b8' }}>🏆 Comisión</span>
                    <span style={{ fontWeight: 800, color: '#60a5fa' }}>{formatMoney(r.commissionAmount)}</span>
                    {r.hasTiers ? (
                      <>
                        <span style={{ color: '#94a3b8' }}>🎯 Tier alcanzado</span>
                        <span style={{ fontWeight: 700, color: r.reachedTier ? '#f59e0b' : '#94a3b8' }}>
                          {r.reachedTier ? `${r.reachedTier.name} (${r.reachedTier.percentage}%)` : 'Ninguno'}
                        </span>
                        <span style={{ color: '#94a3b8' }}>📊 Siguiente meta</span>
                        <span style={{ fontWeight: 700, color: '#fff' }}>
                          {r.nextTier ? `${r.nextTier.name} (Q ${r.nextTier.amount.toLocaleString()})` : '—'}
                        </span>
                        <span style={{ color: '#94a3b8' }}>📈 Progreso</span>
                        <span style={{ fontWeight: 800, color: '#60a5fa' }}>{Math.round(r.progressToNext)}%</span>
                      </>
                    ) : (
                      <span style={{ color: '#94a3b8', gridColumn: '1 / -1', fontStyle: 'italic' }}>
                        Sin niveles de meta configurados
                      </span>
                    )}
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

        {/* ── Detail table ── */}
        <section className="reports-hero-panel" style={{ gap: '8px', ...sectionStyle(500) }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Tabla detallada</span>
              <h3 className="reports-section-title">Desglose de ventas y comisiones por vendedor</h3>
            </div>
          </div>

          <div className="reports-table-wrap" style={{ maxHeight: '500px' }}>
            <table className="reports-table" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Ventas (Q)</th>
                  <th>Tier alcanzado</th>
                  <th>% Comisión</th>
                  <th>Comisión (Q)</th>
                  <th>Siguiente meta</th>
                  <th>Progreso</th>
                </tr>
              </thead>
              <tbody>
                {userRows.map(r => {
                  const noSalesTiers = !r.hasTiers;
                  return (
                    <tr key={r.userId} style={{ background: r.salesAmount === 0 && noSalesTiers ? '#fafafa' : 'transparent' }}>
                      <td style={{ fontWeight: 700 }}>{r.name}</td>
                      <td style={{ fontWeight: 700, color: '#059669' }}>{r.salesAmount > 0 ? formatMoney(r.salesAmount) : '—'}</td>
                      <td>
                        {r.hasTiers ? (
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: '999px',
                            fontSize: '10px', fontWeight: 700,
                            background: r.reachedTier ? '#fef3c7' : '#f1f5f9',
                            color: r.reachedTier ? '#92400e' : '#94a3b8',
                            border: `1px solid ${r.reachedTier ? '#fcd34d' : '#e2e8f0'}`,
                          }}>
                            {r.reachedTier ? r.reachedTier.name : 'Sin alcanzar'}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '10px' }}>Sin metas</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, color: '#2563eb', textAlign: 'center' }}>
                        {r.reachedTier ? `${r.reachedTier.percentage}%` : (r.hasTiers ? '0%' : '—')}
                      </td>
                      <td style={{ fontWeight: 700, color: '#6366f1' }}>{r.commissionAmount > 0 ? formatMoney(r.commissionAmount) : '—'}</td>
                      <td style={{ fontSize: '11px', color: '#64748b' }}>
                        {r.nextTier ? (
                          <><strong>{r.nextTier.name}</strong> (Q {r.nextTier.amount.toLocaleString()})</>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>{r.hasTiers ? '—' : '—'}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {r.hasTiers ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                            <div style={{
                              width: '60px', height: '6px', borderRadius: '999px',
                              background: '#e2e8f0', overflow: 'hidden',
                            }}>
                              <div style={{
                                width: `${Math.round(r.progressToNext)}%`, height: '100%',
                                borderRadius: '999px',
                                background: r.progressToNext >= 100 ? '#10b981' : '#3b82f6',
                                transition: 'width 0.5s ease',
                              }} />
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: r.progressToNext >= 100 ? '#059669' : '#64748b' }}>
                              {Math.round(r.progressToNext)}%
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#e2e8f0' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                  <td style={{ fontWeight: 800, color: '#0f172a' }}>Total</td>
                  <td style={{ fontWeight: 800, color: '#059669' }}>{formatMoney(totalSales)}</td>
                  <td></td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>
                    {totalSales > 0 ? `${((totalCommission / totalSales) * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ fontWeight: 800, color: '#6366f1' }}>{formatMoney(totalCommission)}</td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
