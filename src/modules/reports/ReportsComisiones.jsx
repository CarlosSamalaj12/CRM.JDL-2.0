import { useState, useMemo, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../../utils/numberToWords';
import ReportInfo from './components/ReportInfo';
import MultiSelect from './components/MultiSelect';
import { getEventSeriesFinancialMeta } from './components/eventSeriesUtils';

// ── Minimalist Vector Icons ──
function IconCalendar({ size = 15, color = 'currentColor' }) {
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

function IconStar({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconDownload({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconChevronLeft({ size = 14, color = 'currentColor' }) {
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

const ACTIVE_STATUSES = new Set([
  'Confirmado',
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
  const sellerUsers = useMemo(() => (users || []).filter(u => {
    const r = String(u.role || '').toLowerCase();
    return r === 'vendedor' || r === 'admin';
  }), [users]);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const initialMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [fromDate, setFromDate] = useState(getLocalDateStr(firstOfMonth));
  const [toDate, setToDate] = useState(getLocalDateStr(lastOfMonth));
  const [monthKey, setMonthKey] = useState(initialMonthKey); // YYYY-MM
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredBarPos, setHoveredBarPos] = useState(null);
  const [userFilter, setUserFilter] = useState(new Set()); // Set vacío = "Todos"
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

    // Aggregate sales by userId (deduplicando por groupId igual que Reporte de Ventas)
    // IMPORTANTE: dedup PRIMERO, fecha después — si no, una reserva multi-slot que
    // arranca antes del rango (ej. Jul 30 + Aug 5) pero tiene slots dentro del
    // rango quedaría doble-contada acá y excluida en Ventas, rompiendo los números.
    const salesByUser = {};
    const seenReservations = new Set();
    for (const ev of events) {
      const groupKey = ev.groupId || ev.id;
      if (!groupKey) continue;
      if (seenReservations.has(groupKey)) continue;
      seenReservations.add(groupKey);

      // Mismo "primary event" que usa Reporte de Ventas → mismo userId y misma fecha
      // de referencia (la más temprana de la serie, ordenada por date + startTime + salon).
      const financialMeta = getEventSeriesFinancialMeta(ev, events);
      const primaryEvent = financialMeta.primaryEvent || ev;
      const eventDate = String(financialMeta.startDate || ev.date || '').trim();
      if (!eventDate || eventDate < from || eventDate > to) continue;

      const status = String(primaryEvent.status || ev.status || '').trim();
      if (!ACTIVE_STATUSES.has(status)) continue;

      const amount = Math.max(0, Number(primaryEvent.quote?.total || ev.quote?.total || 0));
      if (amount <= 0) continue;

      const userId = String(primaryEvent.userId || ev.userId || '').trim();
      if (!userId) continue;
      if (userFilter.size > 0 && !userFilter.has(userId)) continue;

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
      const tiers = Array.isArray(user.goalTiers) ? user.goalTiers.filter(t => t.amount > 0) : [];
      if (tiers.length === 0) continue;

      const salesAmount = salesByUser[userId] || 0;
      const { reachedTier, commissionAmount, nextTier, progressToNext } = calcCommission(salesAmount, tiers);

      rows.push({
        userId,
        name: user.fullName || user.name || userId,
        salesAmount,
        hasTiers: true,
        tiers,
        reachedTier,
        commissionAmount,
        commissionPct: reachedTier ? reachedTier.percentage : 0,
        nextTier,
        progressToNext,
      });

      totalSales += salesAmount;
      totalCommission += commissionAmount;
      totalUsersWithTiers++;
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
    const mk = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
    setMonthKey(mk);
    setFromDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth(), 1)));
    setToDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth() + 1, 0)));
  };

  const handleMonthChange = (val) => {
    if (!val) return;
    setMonthKey(val);
    const [y, m] = val.split('-').map(Number);
    setFromDate(getLocalDateStr(new Date(y, m - 1, 1)));
    setToDate(getLocalDateStr(new Date(y, m, 0)));
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
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });

    const rowsHtml = userRows.map((r, i) => `<tr${i % 2 === 1 ? ' style="background:#f8fafc"' : ''}>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:700;color:#0f172a">${r.name}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:700;text-align:right;color:#059669">Q ${r.salesAmount.toFixed(2)}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:10px;color:#92400e;font-weight:600">${r.reachedTier?.name || (r.hasTiers ? 'Ninguno' : '-')}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:700;text-align:center;color:#2563eb">${r.reachedTier ? r.reachedTier.percentage + '%' : (r.hasTiers ? '0%' : '-')}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:700;text-align:right;color:#6366f1">Q ${r.commissionAmount.toFixed(2)}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:10px;color:#475569">${r.nextTier ? r.nextTier.name + ' (Q ' + new Intl.NumberFormat('es-GT').format(r.nextTier.amount) + ')' : '-'}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:700;text-align:center;color:#3b82f6">${r.hasTiers ? Math.round(r.progressToNext) + '%' : '-'}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="ProgId" content="Excel.Sheet">
<style>table{border-collapse:collapse;font-family:'Segoe UI',Arial,sans-serif;width:100%}
th{background:#0f172a;color:#fff;padding:8px 10px;border:1px solid #0f172a;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:left}
th.right{text-align:right}</style></head><body>
<table>
  <tr><td colspan="7" style="padding:14px 10px 4px;font-size:9px;color:#64748b;font-weight:700;border:none">EMS RESERVAS - JARDINES DEL LAGO</td></tr>
  <tr><td colspan="7" style="padding:0 10px 2px;font-size:16px;font-weight:900;color:#0f172a;border:none;letter-spacing:-0.02em">Reporte de Comisiones</td></tr>
  <tr><td colspan="7" style="padding:0 10px 14px;font-size:11px;color:#475569;border:none">Período: ${fromDate} → ${toDate} - Generado: ${dateStr} - ${timeStr}</td></tr>
  <tr>
    <th>Vendedor</th><th class="right">Ventas (Q)</th><th>Nivel</th><th>%</th><th class="right">Comisión</th><th>Siguiente</th><th>Progreso</th>
  </tr>
  ${rowsHtml || '<tr><td colspan="7" style="padding:20px;text-align:center;border:1px solid #d1d5db;color:#94a3b8;font-size:12px">Sin datos.</td></tr>'}
  <tr>
    <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:800;color:#0f172a;background:#f1f5f9">Total - ${userRows.length} vendedor(es)</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px;font-weight:900;text-align:right;color:#059669;background:#f1f5f9">Q ${new Intl.NumberFormat('es-GT',{minimumFractionDigits:2}).format(totalSales)}</td>
    <td colspan="2" style="padding:8px 10px;border:1px solid #d1d5db;background:#f1f5f9"></td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px;font-weight:900;text-align:right;color:#6366f1;background:#f1f5f9">Q ${new Intl.NumberFormat('es-GT',{minimumFractionDigits:2}).format(totalCommission)}</td>
    <td colspan="2" style="padding:8px 10px;border:1px solid #d1d5db;background:#f1f5f9"></td>
  </tr>
  <tr><td colspan="7" style="padding:12px 10px 4px;font-size:8px;color:#94a3b8;border:none;text-align:center">Jardines del Lago - EMS Reservas - Reporte generado el ${dateStr}</td></tr>
</table></body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Comisiones_${fromDate}_a_${toDate}.xls`;
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
    <div className="reports-page-container" ref={reportRef} style={{ background: '#f8fafc' }}>
      <style>{`
        @keyframes tooltipFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .comm-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03);
          transition: all 0.2s ease;
        }
        .comm-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.06), 0 12px 24px -6px rgba(0,0,0,0.04);
        }
        .preset-btn {
          font-size: 11px;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .preset-btn:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #0f172a;
          transform: translateY(-1px);
        }
      `}</style>

      {/* ── Header Principal ── */}
      <div className="reports-page-header" style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div className="reports-brand-header" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(59,130,246,0.1)'
          }}>
            <img src="/Oficial_JDL_acua.png" alt="Logo" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7c3aed', marginBottom: '2px' }}>
              EMS Reservas · Jardines del Lago
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Reporte de Comisiones
              <span style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '6px',
                background: '#f5f3ff',
                color: '#7c3aed',
                border: '1px solid #ddd6fe',
                letterSpacing: '0.02em'
              }}>
                Metas & Comisiones
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Ventas vs niveles de meta · Cálculo de comisiones por vendedor · Progreso hacia siguiente nivel
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={pdfLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #fca5a5',
              background: pdfLoading ? '#fee2e2' : '#ffffff',
              color: '#dc2626',
              fontSize: '12px',
              fontWeight: 700,
              cursor: pdfLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <IconDownload size={14} color="#dc2626" />
            {pdfLoading ? 'Generando PDF...' : 'Exportar PDF'}
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #a7f3d0',
              background: '#ffffff',
              color: '#059669',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <IconDownload size={14} color="#059669" />
            Exportar CSV
          </button>

          <ReportInfo reportKey="comisiones" />

          <button
            className="btn-exit"
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <IconChevronLeft size={14} />
            Volver
          </button>
        </div>
      </div>

      <div className="reports-page-body" style={{ padding: '24px 28px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* ── Toolbar de Filtros ── */}
        <section className="comm-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '8px' }}>
                <IconCalendar size={14} color="#64748b" />
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Mes:</span>
                <input
                  type="month"
                  value={monthKey}
                  onChange={e => handleMonthChange(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '12px', fontWeight: 700, color: '#0f172a', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button type="button" className="preset-btn" onClick={handleReset}>
                  Mes Actual
                </button>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => {
                    const [y, m] = monthKey.split('-').map(Number);
                    const prev = new Date(y, m - 2, 1);
                    const k = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
                    handleMonthChange(k);
                  }}
                >
                  Mes Anterior
                </button>
              </div>

              <div style={{ minWidth: '220px' }}>
                <MultiSelect
                  selected={userFilter}
                  onChange={setUserFilter}
                  options={sellerUsers.map(u => ({ value: String(u.id), label: u.fullName || u.name || u.username }))}
                  placeholder="Vendedor"
                  emptyLabel="Todos los vendedores"
                  searchable
                  width="100%"
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                {userFilter.size > 0 ? `Filtrando: ${userFilter.size} vendedor(es)` : 'Todos los vendedores evaluados'}
              </span>
            </div>
          </div>
        </section>

        {/* ── 4 Tarjetas KPI Ejecutivas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {/* KPI 1: Ventas Totales */}
          <div className="comm-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                Ventas del Período
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconTrendingUp size={16} color="#059669" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                {formatMoney(totalSales)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Total eventos confirmados
              </div>
            </div>
          </div>

          {/* KPI 2: Comisiones Generadas */}
          <div className="comm-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                Comisiones Generadas
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconAward size={16} color="#7c3aed" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#7c3aed', lineHeight: 1.1 }}>
                {formatMoney(totalCommission)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Tasa efectiva: <strong style={{ color: '#0f172a' }}>{totalSales > 0 ? ((totalCommission / totalSales) * 100).toFixed(2) : '0'}%</strong>
              </div>
            </div>
          </div>

          {/* KPI 3: Vendedores con Metas */}
          <div className="comm-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                Vendedores Evaluados
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconTarget size={16} color="#2563eb" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                {totalUsersWithTiers}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                {userRows.filter(r => r.reachedTier).length} han alcanzado nivel de meta
              </div>
            </div>
          </div>

          {/* KPI 4: Líder en Comisión */}
          <div className="comm-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                Mayor Comisión
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconStar size={16} color="#d97706" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                {topByCommission && topByCommission.commissionAmount > 0 ? formatMoney(topByCommission.commissionAmount) : 'Q 0.00'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {topByCommission && topByCommission.commissionAmount > 0 ? topByCommission.name : 'Sin comisiones en período'}
              </div>
            </div>
          </div>
        </div>

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
          <div className="reports-chart-scroll-wrap" style={{
            background: '#ffffff', borderRadius: '14px', padding: '24px 20px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
            border: '1px solid #f1f5f9',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', maxWidth: '100%',
          }}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px', minHeight: '320px', minWidth: '480px' }}>
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
                    <span style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ventas</span>
                    <span style={{ fontWeight: 800, color: '#10b981' }}>{formatMoney(r.salesAmount)}</span>
                    <span style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Comisión</span>
                    <span style={{ fontWeight: 800, color: '#60a5fa' }}>{formatMoney(r.commissionAmount)}</span>
                    {r.hasTiers ? (
                      <>
                        <span style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nivel</span>
                        <span style={{ fontWeight: 700, color: r.reachedTier ? '#f59e0b' : '#94a3b8' }}>
                          {r.reachedTier ? `${r.reachedTier.name} (${r.reachedTier.percentage}%)` : 'Sin alcanzar'}
                        </span>
                        <span style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Siguiente meta</span>
                        <span style={{ fontWeight: 700, color: '#fff' }}>
                          {r.nextTier ? `${r.nextTier.name} (Q ${r.nextTier.amount.toLocaleString()})` : '—'}
                        </span>
                        <span style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Progreso</span>
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
                  <th>Nivel alcanzado</th>
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
