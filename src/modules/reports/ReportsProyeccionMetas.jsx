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

export default function ReportsProyeccionMetas({ onClose }) {
  const { events, users } = useOutletContext();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [fromDate, setFromDate] = useState(getLocalDateStr(firstOfMonth));
  const [toDate, setToDate] = useState(getLocalDateStr(lastOfMonth));
  const [userFilter, setUserFilter] = useState('all');
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredBarPos, setHoveredBarPos] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const reportRef = useRef(null);

  // ── Compute days elapsed and remaining ──
  const periodInfo = useMemo(() => {
    const start = new Date(fromDate + 'T00:00:00');
    const end = new Date(toDate + 'T00:00:00');
    const now = new Date();
    const clamp = (d) => d < start ? start : (d > end ? end : d);
    const elapsedMs = clamp(now).getTime() - start.getTime();
    const totalMs = end.getTime() - start.getTime();
    const elapsedDays = Math.max(1, Math.ceil(elapsedMs / 86400000));
    const totalDays = Math.max(1, Math.ceil(totalMs / 86400000));
    const remainingDays = Math.max(0, totalDays - elapsedDays);
    return { elapsedDays, totalDays, remainingDays };
  }, [fromDate, toDate]);

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
        amount: 0,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }, [fromDate, toDate]);

  // ── Aggregate sales by user ──
  const projectionData = useMemo(() => {
    if (!events || !monthList.length || !users) return { userRows: [] };

    // Aggregate sales by userId
    const salesByUser = {};
    const eventsByUser = {};
    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < fromDate || d > toDate) continue;
      const status = String(ev.status || '').trim();
      if (!ACTIVE_STATUSES.has(status)) continue;
      const amount = Math.max(0, Number(ev.quote?.total || 0));
      if (amount <= 0) continue;
      const userId = String(ev.userId || '').trim();
      if (!userId) continue;
      if (userFilter !== 'all' && userId !== userFilter) continue;

      salesByUser[userId] = (salesByUser[userId] || 0) + amount;
      eventsByUser[userId] = (eventsByUser[userId] || 0) + 1;
    }

    const rows = [];
    for (const user of users) {
      const userId = String(user.id).trim();
      if (!userId) continue;
      const currentSales = salesByUser[userId] || 0;
      const eventCount = eventsByUser[userId] || 0;
      const tiers = Array.isArray(user.goalTiers) ? [...user.goalTiers].filter(t => t.amount > 0).sort((a, b) => a.amount - b.amount) : [];
      const hasTiers = tiers.length > 0 && user.salesTargetEnabled;

      // Find current tier and next tier
      let reachedTier = null;
      let nextTier = null;
      let currentTierIdx = -1;

      if (hasTiers) {
        for (let i = 0; i < tiers.length; i++) {
          if (currentSales >= tiers[i].amount) {
            reachedTier = tiers[i];
            currentTierIdx = i;
          }
        }
        nextTier = tiers[currentTierIdx + 1] || null;
      }

      // Calculate projections
      const neededForNext = nextTier ? Math.max(0, nextTier.amount - currentSales) : 0;
      const dailyAvg = periodInfo.elapsedDays > 0 ? currentSales / periodInfo.elapsedDays : 0;
      const projectedTotal = dailyAvg * periodInfo.totalDays;
      const projectedCommission = reachedTier ? (projectedTotal * reachedTier.percentage) / 100 : 0;
      const potentialCommissionNext = nextTier ? (projectedTotal * nextTier.percentage) / 100 : 0;
      const dailyNeeded = periodInfo.remainingDays > 0 ? neededForNext / periodInfo.remainingDays : 0;
      const canReachNext = projectedTotal >= (nextTier?.amount || Infinity);
      const pctToNext = nextTier && currentSales > 0
        ? Math.min(100, Math.max(0, ((currentSales - (reachedTier?.amount || 0)) / (nextTier.amount - (reachedTier?.amount || 0))) * 100))
        : 0;

      rows.push({
        userId,
        name: user.fullName || user.name || userId,
        currentSales,
        eventCount,
        eventAvg: eventCount > 0 ? currentSales / eventCount : 0,
        dailyAvg,
        projectedTotal,
        projectedCommission,
        hasTiers,
        tiers,
        reachedTier,
        nextTier,
        neededForNext,
        dailyNeeded,
        canReachNext,
        pctToNext,
        gapStatus: neededForNext === 0 ? 'complete' : (dailyNeeded <= dailyAvg ? 'on_track' : 'needs_boost'),
        potentialCommissionNext,
      });
    }

    // Sort: users with tiers first, then by current sales desc
    rows.sort((a, b) => {
      if (a.hasTiers && !b.hasTiers) return -1;
      if (!a.hasTiers && b.hasTiers) return 1;
      return b.currentSales - a.currentSales;
    });

    return { userRows: rows };
  }, [events, monthList, users, periodInfo, userFilter]);

  const { userRows } = projectionData;

  // ── Aggregated KPIs ──
  const totalCurrentSales = useMemo(() => userRows.reduce((s, r) => s + r.currentSales, 0), [userRows]);
  const totalProjected = useMemo(() => userRows.reduce((s, r) => s + r.projectedTotal, 0), [userRows]);
  const totalGapNeeded = useMemo(() => userRows.reduce((s, r) => s + r.neededForNext, 0), [userRows]);
  const usersOnTrack = useMemo(() => userRows.filter(r => r.hasTiers && r.gapStatus === 'on_track').length, [userRows]);
  const usersNeedBoost = useMemo(() => userRows.filter(r => r.hasTiers && r.gapStatus === 'needs_boost').length, [userRows]);
  const usersComplete = useMemo(() => userRows.filter(r => r.hasTiers && r.gapStatus === 'complete').length, [userRows]);

  const maxSales = useMemo(() => userRows.length > 0 ? Math.max(...userRows.map(r => Math.max(r.currentSales, r.neededForNext > 0 ? r.currentSales + r.neededForNext : 0))) : 0, [userRows]);
  const maxBarAmount = maxSales > 0 ? maxSales * 1.1 : 1;

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

  const sectionStyle = (delay) => ({
    opacity: animationPhase === 'initial' ? 0 : 1,
    transform: animationPhase === 'initial' ? 'translateY(20px)' : 'translateY(0)',
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
  });

  const handleReset = () => {
    const t = new Date();
    setFromDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth(), 1)));
    setToDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth() + 1, 0)));
  };

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
      pdf.save(`proyeccion_metas_${fromDate}_a_${toDate}.pdf`);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExportExcel = () => {
    const escCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'Vendedor', 'Ventas Actuales (GTQ)', 'Eventos', 'Promedio/Evento (GTQ)',
      'Tier Actual', 'Siguiente Tier', 'Necesita Vender (GTQ)', 'Diario Necesario (GTQ)',
      'Promedio Diario (GTQ)', 'Proyectado (GTQ)', 'Estado',
    ];
    const rows = userRows.filter(r => r.hasTiers).map(r => [
      escCsv(r.name),
      r.currentSales.toFixed(2),
      r.eventCount,
      r.eventAvg.toFixed(2),
      escCsv(r.reachedTier?.name || 'Ninguno'),
      escCsv(r.nextTier?.name || '—'),
      r.neededForNext.toFixed(2),
      r.dailyNeeded.toFixed(2),
      r.dailyAvg.toFixed(2),
      r.projectedTotal.toFixed(2),
      escCsv(r.gapStatus === 'complete' ? 'Completado' : r.gapStatus === 'on_track' ? 'En camino' : 'Requiere impulso'),
    ]);
    const csvContent = [
      escCsv('PROYECCIÓN DE METAS'),
      `,,Período,${fromDate},a,${toDate},,,,`,
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `proyeccion_metas_${fromDate}_a_${toDate}.csv`;
    link.click();
  };

  const getGapColor = (status) => {
    if (status === 'complete') return '#10b981';
    if (status === 'on_track') return '#3b82f6';
    return '#f59e0b';
  };

  const getGapLabel = (status) => {
    if (status === 'complete') return '✓ Meta alcanzada';
    if (status === 'on_track') return 'En camino';
    return 'Requiere impulso';
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
            <div className="reports-title">🎯 Proyección de Metas</div>
            <div className="reports-subtitle">¿Cuánto necesita vender cada vendedor para alcanzar el siguiente nivel?</div>
          </div>
        </div>
        <button className="btn-exit" type="button" onClick={onClose}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver
        </button>
      </div>

      <div className="reports-page-body">
        {/* ── Hero / KPIs ── */}
        <section className="reports-hero-panel" style={{ gap: '12px' }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Proyección por vendedor</span>
              <h3 className="reports-section-title">Proyección de Ventas vs Metas</h3>
              <p className="reports-section-text">
                Basado en el promedio diario de ventas, proyectamos cuánto alcanzará cada vendedor
                y cuánto necesita vender para llegar al siguiente nivel de meta.
              </p>
            </div>
          </div>

          {/* KPI Banner */}
          <div style={{
            display: 'flex', gap: '16px', padding: '16px 20px',
            background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
            borderRadius: '12px', flexWrap: 'wrap', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                💰 Ventas actuales: <strong style={{ color: '#0f172a', fontSize: '13px' }}>{formatMoney(totalCurrentSales)}</strong>
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                📈 Proyectado: <strong style={{ color: '#2563eb', fontSize: '13px' }}>{formatMoney(totalProjected)}</strong>
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                🎯 Gap total: <strong style={{ color: '#f59e0b', fontSize: '13px' }}>{formatMoney(totalGapNeeded)}</strong>
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                📅 Día {periodInfo.elapsedDays} de {periodInfo.totalDays} · <strong style={{ color: '#f59e0b' }}>{periodInfo.remainingDays} restantes</strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
                background: '#d1fae5', color: '#065f46',
              }}>
                ✅ {usersComplete} completados
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
                background: '#dbeafe', color: '#1e40af',
              }}>
                📊 {usersOnTrack} en camino
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
                background: '#fef3c7', color: '#92400e',
              }}>
                ⚡ {usersNeedBoost} requieren impulso
              </span>
            </div>
          </div>

          {/* Toolbar */}
          <div className="reports-toolbar" style={{ gap: '12px', padding: '12px 20px' }}>
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
            {/* Filtro por vendedor */}
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              style={{
                fontSize: '11px', fontWeight: 700, padding: '6px 10px',
                borderRadius: '8px', border: '1.5px solid #e2e8f0',
                background: '#fff', color: '#0f172a', cursor: 'pointer',
                outline: 'none', minWidth: '130px',
              }}
            >
              <option value="all">👥 Todos</option>
              {users?.map(u => (
                <option key={u.id} value={String(u.id)}>
                  {u.fullName || u.name || u.id}
                </option>
              ))}
            </select>
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
          </div>
        </section>

        {/* ── Bar Chart: Ventas actuales vs Gap hacia siguiente meta ── */}
        <section className="reports-hero-panel" style={{ gap: '12px', ...sectionStyle(200) }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Gráfico de barras</span>
              <h3 className="reports-section-title">Ventas actuales vs Siguiente meta</h3>
              <p className="reports-section-text">Barra verde = ventas acumuladas · Barra ámbar = gap hasta el siguiente nivel · Pasa el mouse para detalles</p>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '14px', fontSize: '10px', fontWeight: 700, color: '#64748b', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981', display: 'inline-block' }} /> Ventas actuales
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#f59e0b', display: 'inline-block' }} /> Gap necesario
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981', display: 'inline-block' }} /> ✓ Meta alcanzada
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

                {userRows.filter(r => r.hasTiers).length === 0 ? (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700, color: '#94a3b8',
                    flexDirection: 'column', gap: '8px',
                  }}>
                    <span style={{ fontSize: '32px' }}>📭</span>
                    <span>No hay vendedores con metas configuradas en este período</span>
                  </div>
                ) : (
                  userRows.filter(r => r.hasTiers).map((r, i) => {
                    const isHovered = hoveredBar === i;
                    const totalBarAmount = r.currentSales + r.neededForNext;
                    const salesPct = maxBarAmount > 0 ? (r.currentSales / maxBarAmount) * 100 : 0;
                    const gapPct = maxBarAmount > 0 && r.neededForNext > 0 ? (r.neededForNext / maxBarAmount) * 100 : 0;
                    const hasSales = r.currentSales > 0;
                    const isComplete = r.gapStatus === 'complete';

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
                          gap: '1px',
                        }}
                        onMouseEnter={(e) => {
                          setHoveredBar(i);
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredBarPos({ x: rect.left + rect.width / 2, y: rect.top });
                        }}
                        onMouseLeave={() => { setHoveredBar(null); setHoveredBarPos(null); }}
                      >
                        {/* Gap bar (amber) — behind sales bar, only shown when there's a gap */}
                        {r.neededForNext > 0 && (
                          <div style={{
                            width: '45%',
                            height: `${Math.max(Math.max(salesPct + gapPct, 3))}%`,
                            background: isHovered
                              ? 'linear-gradient(180deg, #d97706, #f59e0b)'
                              : 'linear-gradient(180deg, #f59e0b, #fbbf24)',
                            borderRadius: '3px 3px 0 0',
                            transition: 'opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease',
                            opacity: i < visibleBars ? 0.35 : 0,
                            position: 'absolute',
                            bottom: 0,
                            boxShadow: isHovered ? '0 0 10px rgba(245,158,11,0.3)' : 'none',
                          }} />
                        )}

                        {/* Sales bar (green) */}
                        <div style={{
                          width: '45%',
                          height: `${Math.max(salesPct > 0 ? Math.max(4, salesPct) : 0, 0)}%`,
                          background: isComplete
                            ? (isHovered ? 'linear-gradient(180deg, #059669, #10b981)' : 'linear-gradient(180deg, #10b981, #34d399)')
                            : (isHovered ? 'linear-gradient(180deg, #059669, #10b981)' : 'linear-gradient(180deg, #10b981, #34d399)'),
                          borderRadius: '3px 3px 0 0',
                          transition: 'opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease',
                          opacity: i < visibleBars ? 1 : (animationPhase === 'initial' ? 0 : 1),
                          position: 'relative',
                          zIndex: 2,
                          boxShadow: isHovered && hasSales ? '0 0 10px rgba(16,185,129,0.4)' : 'none',
                          minHeight: hasSales ? '4px' : '2px',
                        }}>
                          {/* Checkmark icon for completed */}
                          {isComplete && (
                            <div style={{
                              position: 'absolute', top: '-4px', right: '-4px',
                              fontSize: '12px', lineHeight: 1,
                            }}>
                              ✅
                            </div>
                          )}
                        </div>

                        {/* Tier badge (if next tier exists) */}
                        {r.nextTier && (
                          <div style={{
                            position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)',
                            fontSize: '8px', fontWeight: 900, color: '#f59e0b',
                            textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                            whiteSpace: 'nowrap',
                          }}>
                            {r.nextTier.name}
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

                        {/* Sales amount below name */}
                        {hasSales && (
                          <div style={{
                            fontSize: '7px', fontWeight: 600, color: '#059669',
                            position: 'absolute', bottom: '-32px', left: 0, right: 0,
                            textAlign: 'center',
                          }}>
                            {formatMoney(r.currentSales)}
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
                minWidth: '260px',
                maxWidth: '340px',
                animation: 'tooltipFadeIn 0.15s ease-out both',
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, marginBottom: '6px', letterSpacing: '-0.01em' }}>
                    {r.name}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '10px', color: '#cbd5e1' }}>
                    <span style={{ color: '#94a3b8' }}>💰 Ventas</span>
                    <span style={{ fontWeight: 800, color: '#10b981' }}>{formatMoney(r.currentSales)}</span>
                    {r.reachedTier ? (
                      <>
                        <span style={{ color: '#94a3b8' }}>🎯 Tier alcanzado</span>
                        <span style={{ fontWeight: 700, color: '#f59e0b' }}>
                          {r.reachedTier.name} ({r.reachedTier.percentage}%)
                        </span>
                      </>
                    ) : null}
                    {r.nextTier ? (
                      <>
                        <span style={{ color: '#94a3b8' }}>📊 Siguiente meta</span>
                        <span style={{ fontWeight: 700, color: '#60a5fa' }}>
                          {r.nextTier.name} (Q {r.nextTier.amount.toLocaleString()})
                        </span>
                        <span style={{ color: '#94a3b8' }}>📈 Gap necesario</span>
                        <span style={{ fontWeight: 800, color: '#f59e0b' }}>{formatMoney(r.neededForNext)}</span>
                        <span style={{ color: '#94a3b8' }}>📅 Prom. diario</span>
                        <span style={{ fontWeight: 700, color: '#cbd5e1' }}>{formatMoney(r.dailyAvg)} / día</span>
                        <span style={{ color: '#94a3b8' }}>🎯 Proyectado</span>
                        <span style={{ fontWeight: 800, color: '#60a5fa' }}>{formatMoney(r.projectedTotal)}</span>
                        <span style={{ color: '#94a3b8' }}>📊 Progreso</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{
                            width: '60px', height: '6px', borderRadius: '999px',
                            background: '#334155', overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${Math.round(Math.min(100, r.pctToNext))}%`, height: '100%',
                              borderRadius: '999px',
                              background: r.gapStatus === 'complete' ? '#10b981' : r.gapStatus === 'on_track' ? '#3b82f6' : '#f59e0b',
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                          <span style={{ fontWeight: 800, color: '#f59e0b', fontSize: '10px' }}>
                            {Math.round(r.pctToNext)}%
                          </span>
                        </div>
                      </>
                    ) : (
                      <span style={{ color: '#94a3b8', gridColumn: '1 / -1', fontStyle: 'italic' }}>
                        🏆 Meta máxima alcanzada
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
        <section className="reports-hero-panel" style={{ gap: '8px', ...sectionStyle(350) }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Tabla de proyección</span>
              <h3 className="reports-section-title">Desglose por vendedor</h3>
            </div>
          </div>

          <div className="reports-table-wrap" style={{ maxHeight: '600px' }}>
            <table className="reports-table" style={{ minWidth: '1100px' }}>
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Ventas actuales</th>
                  <th>Eventos</th>
                  <th>Prom. x evento</th>
                  <th>Tier actual</th>
                  <th>Siguiente meta</th>
                  <th>Necesita vender</th>
                  <th>Diario necesario</th>
                  <th>Prom. diario</th>
                  <th>Proyectado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {userRows.filter(r => r.hasTiers).length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      No hay vendedores con niveles de meta configurados.
                    </td>
                  </tr>
                ) : (
                  userRows.filter(r => r.hasTiers).map(r => {
                    const gapColor = getGapColor(r.gapStatus);
                    const gapLabel = getGapLabel(r.gapStatus);
                    const hasGap = r.neededForNext > 0;

                    return (
                      <tr key={r.userId} style={{
                        background: r.gapStatus === 'complete' ? '#f0fdf4' :
                                     r.gapStatus === 'needs_boost' ? '#fffbeb' : 'transparent',
                      }}>
                        <td style={{ fontWeight: 700 }}>{r.name}</td>
                        <td style={{ fontWeight: 700, color: '#059669' }}>{formatMoney(r.currentSales)}</td>
                        <td style={{ fontWeight: 600 }}>{r.eventCount}</td>
                        <td style={{ fontWeight: 600, color: '#64748b' }}>{r.eventAvg > 0 ? formatMoney(r.eventAvg) : '—'}</td>
                        <td>
                          {r.reachedTier ? (
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: '999px',
                              fontSize: '10px', fontWeight: 700,
                              background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d',
                            }}>
                              {r.reachedTier.name}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '10px' }}>Sin meta</span>
                          )}
                        </td>
                        <td>
                          {r.nextTier ? (
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>
                              {r.nextTier.name} <span style={{ fontWeight: 600, color: '#64748b' }}>(Q {r.nextTier.amount.toLocaleString()})</span>
                            </span>
                          ) : r.reachedTier ? (
                            <span style={{ color: '#10b981', fontWeight: 700, fontSize: '11px' }}>🏆 Meta máxima alcanzada</span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '10px' }}>—</span>
                          )}
                        </td>
                        <td>
                          {hasGap ? (
                            <span style={{ fontWeight: 700, color: '#f59e0b' }}>{formatMoney(r.neededForNext)}</span>
                          ) : (
                            <span style={{ color: '#10b981', fontWeight: 700, fontSize: '11px' }}>✅ Completado</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 700, color: '#f59e0b' }}>
                          {r.dailyNeeded > 0 ? formatMoney(r.dailyNeeded) : '—'}
                        </td>
                        <td style={{ fontWeight: 700, color: '#3b82f6' }}>
                          {r.dailyAvg > 0 ? formatMoney(r.dailyAvg) : '—'}
                        </td>
                        <td style={{ fontWeight: 700, color: '#2563eb' }}>{formatMoney(r.projectedTotal)}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                            {/* Progress bar */}
                            <div style={{
                              width: '60px', height: '6px', borderRadius: '999px',
                              background: '#e2e8f0', overflow: 'hidden',
                            }}>
                              <div style={{
                                width: `${Math.round(Math.min(100, r.pctToNext))}%`, height: '100%',
                                borderRadius: '999px',
                                background: r.gapStatus === 'complete' ? '#10b981' : r.gapStatus === 'on_track' ? '#3b82f6' : '#f59e0b',
                                transition: 'width 0.5s ease',
                              }} />
                            </div>
                            <span style={{
                              fontSize: '9px', fontWeight: 700, color: gapColor,
                              whiteSpace: 'nowrap',
                            }}>
                              {gapLabel}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {userRows.filter(r => r.hasTiers).length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td style={{ fontWeight: 800 }}>Total</td>
                    <td style={{ fontWeight: 800, color: '#059669' }}>{formatMoney(totalCurrentSales)}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td style={{ fontWeight: 800, color: '#f59e0b' }}>{formatMoney(totalGapNeeded)}</td>
                    <td></td>
                    <td></td>
                    <td style={{ fontWeight: 800, color: '#2563eb' }}>{formatMoney(totalProjected)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Users without tiers section */}
          {userRows.filter(r => !r.hasTiers).length > 0 && (
            <details style={{ marginTop: '12px', cursor: 'pointer' }}>
              <summary style={{
                fontSize: '12px', fontWeight: 700, color: '#64748b',
                padding: '8px 12px', background: '#f8fafc', borderRadius: '8px',
              }}>
                Vendedores sin metas configuradas ({userRows.filter(r => !r.hasTiers).length})
              </summary>
              <div style={{ padding: '8px 12px' }}>
                <table className="reports-table" style={{ minWidth: '600px' }}>
                  <thead>
                    <tr>
                      <th>Vendedor</th>
                      <th>Ventas</th>
                      <th>Eventos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRows.filter(r => !r.hasTiers).map(r => (
                      <tr key={r.userId} style={{ color: '#94a3b8' }}>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td>{r.currentSales > 0 ? formatMoney(r.currentSales) : '—'}</td>
                        <td>{r.eventCount || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}
