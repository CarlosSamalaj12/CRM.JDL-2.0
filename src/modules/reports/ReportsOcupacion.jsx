import { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { STATUS_META } from '../calendar/constants';
import { generateQuotePrintDocument, buildMenuMontajeReportHtml } from '../../utils/printUtils';
import { emitOpenEventChecklist } from '../../utils/appEvents';
import SettingsChecklist from '../settings/SettingsChecklist';
import { toast } from '../../utils/toast';
import { loadState } from '../../services/stateService';

const STATUS = { PRERESERVA: 'Pre reserva', CONFIRMADO: 'Confirmado' };
const ALLOWED_STATUSES = new Set([STATUS.PRERESERVA, STATUS.CONFIRMADO]);

export default function ReportsOcupacion({ onClose }) {
  const { events, users, occupancyWeeklyOps, handleUpdateOccupancyOps } = useOutletContext();
  
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    let active = true;
    const fetchCompanies = async () => {
      try {
        const stateData = await loadState();
        if (active) {
          setCompanies(stateData?.companies || []);
        }
      } catch (err) {
        console.error("Error loading companies:", err);
      }
    };
    fetchCompanies();
    return () => { active = false; };
  }, []);

  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date(); const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff)).toISOString().split('T')[0];
  });

  const weekDays = useMemo(() => {
    const start = new Date(currentWeekStart + 'T00:00:00');
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]; });
  }, [currentWeekStart]);

  const rows = useMemo(() => {
    if (!events) return [];
    const fromIso = weekDays[0], toIso = weekDays[6];
    const filtered = events.filter(ev => {
      const eventDate = String(ev.date || '');
      if (!eventDate || eventDate < fromIso || eventDate > toIso) return false;
      if (!ALLOWED_STATUSES.has(String(ev.status || ''))) return false;
      return true;
    });
    return filtered.map(ev => {
      const user = users?.find(u => String(u.id) === String(ev.userId));
      return { 
        eventId: String(ev.id||''), 
        status: String(ev.status||''), 
        statusColor: STATUS_META[ev.status]?.color||'#2563eb', 
        eventDate: String(ev.date||''), 
        startTime: String(ev.startTime||''), 
        endTime: String(ev.endTime||''), 
        eventName: String(ev.name||''), 
        salon: String(ev.salon||''), 
        company: ev.quote?.companyName||'', 
        seller: String(user?.fullName||user?.name||''), 
        pax: Number(ev.pax||ev.quote?.people||0), 
        total: Number(ev.quote?.total||0),
        rawEvent: ev
      };
    }).sort((a, b) => { const d = a.eventDate.localeCompare(b.eventDate); if (d !== 0) return d; const t = a.startTime.localeCompare(b.startTime); return t !== 0 ? t : a.salon.localeCompare(b.salon); });
  }, [events, users, weekDays]);

  const summaryCards = useMemo(() => {
    const confirmed = rows.filter(r => r.status === STATUS.CONFIRMADO).length;
    const pre = rows.filter(r => r.status === STATUS.PRERESERVA).length;
    const pax = rows.reduce((acc, r) => acc + Math.max(0, r.pax), 0);
    const totalRevenue = rows.reduce((a, r) => a + r.total, 0);
    const activeDays = new Set(rows.map(r => r.eventDate).filter(Boolean)).size;
    const confirmedPct = rows.length ? Math.round((confirmed / rows.length) * 100) : 0;
    const moneyGT = (v) => 'Q ' + Number(v||0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return [
      { code: 'EV', label: 'Eventos semana', value: rows.length, meta: `${activeDays} dia(s) con actividad`, hint: rows.length ? 'Panorama general de ocupacion' : 'Sin actividad en el periodo' },
      { code: 'OK', label: 'Confirmados', value: confirmed, meta: `${confirmedPct}% del total semanal`, hint: 'Eventos listos para ejecutar' },
      { code: 'PR', label: 'Pre reserva', value: pre, meta: `${100-confirmedPct}% del total semanal`, hint: 'Pendientes de consolidacion' },
      { code: 'PX', label: 'PAX total', value: pax, meta: `Promedio ${rows.length ? Math.round(pax/rows.length) : 0} por evento`, hint: 'Capacidad movilizada en la semana' },
      { code: 'GT', label: 'Total cotizado', value: moneyGT(totalRevenue), meta: `Ticket promedio ${moneyGT(rows.length ? totalRevenue/rows.length : 0)}`, hint: 'Monto unico por reserva consolidada' },
    ];
  }, [rows]);

  const dayCards = useMemo(() => weekDays.map(d => {
    const dayRows = rows.filter(r => r.eventDate === d);
    const dateObj = new Date(d + 'T00:00:00');
    const opsData = occupancyWeeklyOps?.[currentWeekStart]?.[d] || { breakfasts: 0, rooms: 0 };
    return { date: d, dayName: ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'][dateObj.getDay()], dayNumber: dateObj.getDate(), monthLabel: dateObj.toLocaleDateString('es-GT', { month: 'short' }).toUpperCase(), 
      count: dayRows.length, confirmedCount: dayRows.filter(r => r.status === STATUS.CONFIRMADO).length, 
      preCount: dayRows.filter(r => r.status === STATUS.PRERESERVA).length, 
      revenue: dayRows.reduce((a,r) => a+r.total, 0), 
      rows: dayRows, breakfasts: opsData.breakfasts, rooms: opsData.rooms };
  }), [weekDays, rows, occupancyWeeklyOps, currentWeekStart]);

  const formatMoneyGT = (v) => 'Q ' + Number(v||0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const handlePrevWeek = () => { const s = new Date(currentWeekStart + 'T00:00:00'); s.setDate(s.getDate() - 7); setCurrentWeekStart(s.toISOString().split('T')[0]); };
  const handleNextWeek = () => { const s = new Date(currentWeekStart + 'T00:00:00'); s.setDate(s.getDate() + 7); setCurrentWeekStart(s.toISOString().split('T')[0]); };
  const handleGoToday = () => { const t = new Date(); const d = t.getDay(); const diff = t.getDate() - d + (d === 0 ? -6 : 1); setCurrentWeekStart(new Date(t.setDate(diff)).toISOString().split('T')[0]); };

  const handleExportExcel = () => {
    if (!rows.length) {
      toast("No hay datos para exportar.");
      return;
    }
    try {
      const worksheetData = rows.map(r => ({
        'Estado': r.status,
        'PAX': r.pax,
        'Fecha Evento': r.eventDate,
        'Hora Inicio': r.startTime,
        'Hora Fin': r.endTime,
        'Evento': r.eventName,
        'Salón': r.salon,
        'Institución': r.company || '-',
        'Vendedor': r.seller,
        'Total Cotizado': r.total
      }));
      
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Ocupación Semanal');
      XLSX.writeFile(workbook, `Reporte_Ocupacion_${weekDays[0]}_a_${weekDays[6]}.xlsx`);
      toast('Reporte exportado exitosamente');
    } catch (err) {
      console.error('Error al exportar Excel:', err);
      toast('Error al exportar a Excel');
    }
  };

  const handleQuoteClick = async (r) => {
    const ev = r.rawEvent;
    if (!ev?.quote) {
      toast("Este evento no tiene cotización.");
      return;
    }
    try {
      const user = users?.find(u => String(u.id) === String(ev.userId));
      const success = await generateQuotePrintDocument(ev.quote, user);
      if (success !== false) {
        toast("Generando vista previa de cotización...");
      }
    } catch (err) {
      console.error(err);
      toast("Error al abrir la cotización.");
    }
  };

  const handleMenuClick = (r) => {
    const ev = r.rawEvent;
    if (!ev?.quote) {
      toast("Este evento no tiene cotización ni informe de Menú & Montaje.");
      return;
    }
    const html = buildMenuMontajeReportHtml(ev, ev.quote, "full", { companies, users });
    if (!html) {
      toast("No hay datos de menú/montaje para imprimir.");
      return;
    }
    const w = window.open("about:blank", "_blank");
    if (!w) {
      toast("Habilita ventanas emergentes para generar el informe.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  const handleChecklistClick = (r) => {
    if (!r?.eventId) {
      toast("No se encontro el evento para abrir el checklist.");
      return;
    }
    emitOpenEventChecklist(r.eventId);
  };

  const styles = {
    backdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflow: 'hidden' },
    modal: { width: 'min(1280px, calc(100vw - 32px))', height: '92vh', maxHeight: '92vh', background: 'linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%)', borderRadius: '16px', border: '1px solid rgba(191,210,232,0.5)', boxShadow: '0 25px 60px rgba(15,23,42,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    header: { background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,249,255,0.96) 100%)', borderBottom: '1px solid rgba(148,163,184,0.16)', padding: '16px 24px', display: 'flex', alignItems: 'center', minHeight: '86px', justifyContent: 'space-between', gap: '14px' },
    brandBadge: { width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #c7d8ec', background: '#f5faff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
    brandLogo: { width: '40px', height: '40px', objectFit: 'contain' },
    brandCopy: { flex: '1' },
    eyebrow: { color: '#64748b', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' },
    title: { margin: '4px 0 0', fontSize: '22px', fontWeight: '900', color: '#0f172a' },
    subtitle: { marginTop: '2px', color: '#64748b', fontSize: '13px' },
    closeBtn: { width: '40px', height: '40px', borderRadius: '10px', border: 'none', background: '#f1f5f9', color: '#64748b', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    body: { padding: '18px', flex: '1', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' },
    sectionEyebrow: { fontSize: '10px', fontWeight: '900', color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '999px', padding: '5px 9px', display: 'inline-block', textTransform: 'uppercase', letterSpacing: '0.08em' },
    sectionHeader: { marginBottom: '12px' },
    sectionTitle: { fontSize: '16px', fontWeight: '850', color: '#0f172a', marginTop: '8px' },
    sectionDesc: { fontSize: '12px', color: '#64748b', marginTop: '4px' },
    toolbar: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '14px', background: '#f1f6fd', borderRadius: '12px', border: '1px solid #dbe7f5', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' },
    fieldLabel: { fontSize: '10px', fontWeight: '900', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' },
    input: { height: '42px', borderRadius: '12px', border: '1px solid #bfdbfe', padding: '0 12px', fontSize: '14px', fontWeight: '600' },
    btn: { height: '42px', borderRadius: '12px', border: '1px solid #bfdbfe', background: '#ffffff', color: '#475569', fontWeight: '800', fontSize: '13px', cursor: 'pointer', padding: '0 16px' },
    btnPrimary: { height: '42px', borderRadius: '12px', border: 'none', background: '#1d4ed8', color: '#ffffff', fontWeight: '850', fontSize: '13px', cursor: 'pointer', padding: '0 18px', boxShadow: '0 8px 18px rgba(29,78,216,0.2)' },
    actions: { marginLeft: 'auto', display: 'flex', gap: '10px' },
    summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' },
    summaryCard: { position: 'relative', minHeight: '142px', padding: '16px', borderRadius: '16px', border: '1px solid #dbe7f5', background: '#ffffff', boxShadow: '0 10px 24px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', gap: '7px' },
    cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    cardKicker: { fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' },
    cardIcon: { width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '900' },
    cardValue: { fontSize: '28px', fontWeight: '850', color: '#07172c' },
    cardMeta: { fontSize: '13px', fontWeight: '700', color: '#334155' },
    cardHint: { fontSize: '12px', fontWeight: '600', color: '#64748b' },
    daysStrip: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))', gap: '0', overflowX: 'auto', border: '1px solid #d7e4f2', borderRadius: '18px', background: '#ffffff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 24px rgba(15,23,42,0.05)' },
    weekColumn: { minHeight: '520px', display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 12px 14px', borderRight: '1px solid #e0e8f2', background: 'linear-gradient(180deg, #fbfdff 0%, #f7fbff 100%)' },
    weekColumnEven: { background: 'linear-gradient(180deg, #f8fbff 0%, #f3f8ff 100%)' },
    weekDayHead: { position: 'sticky', top: '0', zIndex: '2', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '4px 8px', minHeight: '72px', width: 'calc(100% + 24px)', margin: '0 -12px', padding: '12px', border: '0', borderBottom: '1px solid #d7e4f2', background: 'linear-gradient(180deg, #ffffff 0%, #edf4fc 100%)', textAlign: 'left', cursor: 'pointer' },
    weekDayHeadSpan: { fontSize: '11px', fontWeight: '900', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#475569' },
    weekDayHeadStrong: { gridRow: '1 / span 2', gridColumn: '2', fontSize: '28px', lineHeight: '1', fontWeight: '950', color: '#0f172a' },
    weekDayHeadSmall: { fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b' },
    weekDayStats: { display: 'grid', gridTemplateColumns: '1fr', gap: '6px', marginTop: '4px' },
    weekDayStat: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minHeight: '28px', padding: '6px 8px', border: '1px solid #dce8f5', borderRadius: '10px', background: 'rgba(255,255,255,0.86)', color: '#475569', fontSize: '11px', fontWeight: '800' },
    weekDayStatB: { color: '#0f172a', fontSize: '13px' },
    weekRevenue: { justifyContent: 'flex-start', color: '#0f3158', fontWeight: '800', fontSize: '11px', padding: '6px 8px', border: '1px solid #dce8f5', borderRadius: '10px', background: 'rgba(255,255,255,0.86)' },
    weekEvents: { display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '330px', paddingTop: '4px' },
    weekEmpty: { minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd9e8', borderRadius: '14px', background: '#f8fafc', color: '#64748b', fontSize: '12px', fontWeight: '800' },
    weekEvent: { position: 'relative', width: '100%', minHeight: '136px', display: 'flex', flexDirection: 'column', gap: '5px', padding: '12px 12px 12px 14px', border: '1px solid #cddcec', borderLeftWidth: '4px', borderRadius: '12px', background: 'linear-gradient(180deg, rgba(255,255,255,0.90), rgba(255,255,255,0.74))', cursor: 'pointer', boxShadow: '0 8px 16px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.85)', overflow: 'hidden' },
    weekEventTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
    weekEventTime: { fontSize: '11px', fontWeight: '900', color: '#2563eb' },
    weekEventStatus: { maxWidth: '92px', padding: '4px 7px', border: '1px solid #cddcec', borderRadius: '999px', background: 'rgba(37,99,235,0.13)', color: '#0f172a', fontSize: '9px', fontWeight: '950', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    weekEventName: { fontSize: '13px', fontWeight: '800', color: '#0f172a' },
    weekEventSalon: { fontSize: '11px', color: '#475569' },
    weekEventCompany: { fontSize: '10px', color: '#64748b' },
    opsPanel: { marginTop: '14px', border: '1px solid #d8e2f1', borderRadius: '18px', padding: '14px', background: 'linear-gradient(180deg, #fafdff 0%, #f3f7fe 100%)' },
    opsTitleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' },
    opsLegend: { fontSize: '11px', fontWeight: '800', letterSpacing: '0.04em', color: '#425a7f', textTransform: 'uppercase' },
    opsGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '10px' },
    opsCard: { border: '1px solid #cfdbed', borderRadius: '14px', padding: '10px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '154px' },
    opsHead: { fontSize: '11px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', textAlign: 'center' },
    opsField: { display: 'flex', flexDirection: 'column', gap: '4px' },
    opsLabel: { fontSize: '9px', color: '#64748b', textTransform: 'uppercase' },
    opsInput: { height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', textAlign: 'center', padding: '0 4px' },
    tableWrap: { overflow: 'auto', border: '1px solid #dbe7f5', borderRadius: '16px', background: '#ffffff', boxShadow: '0 10px 24px rgba(15,23,42,0.05)' },
    table: { borderCollapse: 'separate', borderSpacing: '0', width: '100%' },
    th: { background: 'linear-gradient(180deg, #eaf1fb 0%, #dbe4ef 100%)', color: '#0f2744', padding: '12px', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid #cbd5e1' },
    td: { background: '#ffffff', color: '#0f172a', padding: '10px', fontSize: '13px', borderBottom: '1px solid #e5edf7' },
    trEven: { background: '#f8fbff' },
    statusBadge: (c) => ({ background: `${c}22`, color: c, fontSize: '10px', fontWeight: '900', padding: '3px 8px', borderRadius: '999px', textTransform: 'uppercase' }),
    emptyState: { padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' },
  };

  return (
    <div className="modalBackdrop" id="occupancyReportBackdrop" style={styles.backdrop} onClick={(e) => { if (e.target.id === 'occupancyReportBackdrop') onClose(); }}>
      <div className="modal occupancyReportModal" style={styles.modal}>
        <div className="modalHeader" style={styles.header}>
          <div style={styles.brandBadge}><img src="/Oficial_JDL_acua.png" alt="JDL" style={styles.brandLogo} /></div>
          <div className="reportBrandCopy" style={styles.brandCopy}>
            <div className="reportBrandEyebrow" style={styles.eyebrow}>CRM Reservas | Jardines del Lago</div>
            <div className="modalTitle" id="occupancyReportTitle" style={styles.title}>Reporte de ocupación</div>
            <div className="modalSubtitle" style={styles.subtitle}>Semana {weekDays[0]} a {weekDays[6]} (Lunes a Domingo)</div>
          </div>
          <button onClick={onClose} className="iconBtn reportModalClose">✕</button>
        </div>
        <div style={styles.body}>
          <div style={styles.sectionHeader}><div><div style={styles.sectionEyebrow}>Vista ejecutiva semanal</div><div style={styles.sectionTitle}>Lectura de ocupación y rentabilidad</div><div style={styles.sectionDesc}>Filtra la semana, identifica dias criticos y baja al detalle operativo sin perder contexto.</div></div></div>
          <div className="reports-ocupacion-toolbar" style={styles.toolbar}>
            <span style={styles.fieldLabel}>Semana (desde lunes)</span>
            <button onClick={handlePrevWeek} style={styles.btn}>‹</button>
            <input type="date" value={currentWeekStart} onChange={(e) => setCurrentWeekStart(e.target.value)} style={styles.input} />
            <button onClick={handleNextWeek} style={styles.btn}>›</button>
            <button onClick={handleGoToday} style={styles.btn}>Semana actual</button>
            <div style={styles.actions}><button onClick={handleExportExcel} style={styles.btnPrimary}>Exportar Excel</button></div>
          </div>
          
          <div style={styles.sectionHeader}><div><div style={styles.sectionEyebrow}>Resumen ejecutivo</div><div style={styles.sectionTitle}>KPIs prioritarios de la semana</div></div></div>
          <div className="reports-ocupacion-summary-grid" style={styles.summaryGrid}>
            {summaryCards.map((c, i) => {
              const colors = i===0 ? {c:'#2563eb',bg:'#dbeafe'} : i===1 ? {c:'#16a34a',bg:'#dcfce7'} : i===2 ? {c:'#d97706',bg:'#fef3c7'} : i===3 ? {c:'#0891b2',bg:'#cffafe'} : {c:'#7c3aed',bg:'#ede9fe'};
              return <div key={i} style={{...styles.summaryCard, borderTop: `4px solid ${colors.c}`}}>
                <div style={styles.cardTop}><span style={styles.cardKicker}>{c.label}</span><span style={{...styles.cardIcon, background: colors.bg, color: colors.c}}>{c.code}</span></div>
                <strong style={styles.cardValue}>{c.value}</strong>
                <div style={styles.cardMeta}>{c.meta}</div>
                <div style={styles.cardHint}>{c.hint}</div>
              </div>;
            })}
          </div>

          <div style={styles.sectionHeader}><div><div style={styles.sectionEyebrow}>Comportamiento diario</div><div style={styles.sectionTitle}>Distribución y ritmo de eventos</div></div></div>
          <div style={styles.daysStrip}>
            {dayCards.map((d, i) => (
              <div key={d.date} style={{...styles.weekColumn, ...(i%2 ? styles.weekColumnEven : {})}}>
                <div style={styles.weekDayHead}>
                  <span style={styles.weekDayHeadSpan}>{d.dayName}</span>
                  <strong style={styles.weekDayHeadStrong}>{d.dayNumber}</strong>
                  <small style={styles.weekDayHeadSmall}>{d.monthLabel}</small>
                </div>
                <div style={styles.weekDayStats}>
                  <div style={styles.weekDayStat}><span>eventos</span><b style={styles.weekDayStatB}>{d.count}</b></div>
                  <div style={styles.weekDayStat}><span>conf.</span><b style={styles.weekDayStatB}>{d.confirmedCount}</b></div>
                  <div style={styles.weekDayStat}><span>pre</span><b style={styles.weekDayStatB}>{d.preCount}</b></div>
                  <div style={styles.weekDayStat}><span>desayunos</span><b style={styles.weekDayStatB}>{d.breakfasts}</b></div>
                  <div style={styles.weekDayStat}><span>habitaciones</span><b style={styles.weekDayStatB}>{d.rooms}</b></div>
                </div>
                <div style={styles.weekRevenue}>{d.revenue > 0 ? formatMoneyGT(d.revenue) : 'Sin monto'}</div>
                <div style={styles.weekEvents}>
                  {d.rows.length ? d.rows.map(r => {
                    const ev = r.rawEvent;
                    const hasQuote = !!ev.quote;
                    const hasMenu = !!(ev.quote?.menuMontajeEntries && ev.quote.menuMontajeEntries.length > 0 || ev.quote?.menuMontajeVersion);
                    const hasChecklist = !!(ev.checklist && ev.checklist.items && ev.checklist.items.length > 0);
                    const completed = hasChecklist && ev.checklist.items.every(i => i.status === 'cumplido' || i.status === 'no_aplica');
                    
                    return (
                      <div key={r.eventId} style={{...styles.weekEvent, borderLeftColor: r.statusColor}}>
                        <div style={styles.weekEventTop}>
                          <span style={styles.weekEventTime}>{r.startTime} - {r.endTime}</span>
                          <span style={{...styles.weekEventStatus, background: `${r.statusColor}22`, borderColor: `${r.statusColor}55`}}>
                            {r.status === 'Confirmado' ? 'CONF' : 'PRE'}
                          </span>
                        </div>
                        <strong style={styles.weekEventName}>{r.eventName}</strong>
                        <span style={styles.weekEventSalon}>{r.salon}</span>
                        <small style={styles.weekEventCompany}>{r.company || r.seller}</small>
                        
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                          {hasQuote && (
                            <button 
                              type="button" 
                              onClick={() => handleQuoteClick(r)}
                              style={{ 
                                background: '#eff6ff', 
                                border: '1px solid #bfdbfe', 
                                color: '#2563eb', 
                                padding: '2px 4px', 
                                borderRadius: '4px', 
                                cursor: 'pointer',
                                fontSize: '9px',
                                fontWeight: 'bold'
                              }}
                              title="Ver Cotización"
                            >
                              COT
                            </button>
                          )}
                          {hasMenu && (
                            <button 
                              type="button" 
                              onClick={() => handleMenuClick(r)}
                              style={{ 
                                background: '#f0fdf4', 
                                border: '1px solid #bbf7d0', 
                                color: '#16a34a', 
                                padding: '2px 4px', 
                                borderRadius: '4px', 
                                cursor: 'pointer',
                                fontSize: '9px',
                                fontWeight: 'bold'
                              }}
                              title="Ver Menú & Montaje"
                            >
                              M&M
                            </button>
                          )}
                          <button 
                            type="button" 
                            onClick={() => handleChecklistClick(r)}
                            style={{ 
                              background: completed ? '#dcfce7' : (hasChecklist ? '#fef3c7' : '#f1f5f9'), 
                              border: '1px solid',
                              borderColor: completed ? '#bbf7d0' : (hasChecklist ? '#fde047' : '#cbd5e1'), 
                              color: completed ? '#15803d' : (hasChecklist ? '#a16207' : '#475569'), 
                              padding: '2px 4px', 
                              borderRadius: '4px', 
                              cursor: 'pointer',
                              fontSize: '9px',
                              fontWeight: 'bold'
                            }}
                            title="Llenar Checklist"
                          >
                            CHK
                          </button>
                        </div>
                      </div>
                    );
                  }) : <div style={styles.weekEmpty}>Sin eventos</div>}
                </div>
              </div>
            ))}
          </div>

          <div style={styles.opsPanel}>
            <div style={styles.opsTitleRow}><span style={styles.opsLegend}>Operación hotelera</span><span style={{...styles.opsLegend, color: '#64748b'}}>Edición habilitada</span></div>
            <div className="reports-ocupacion-ops-grid" style={styles.opsGrid}>
              {dayCards.map(d => (
                <div key={d.date} style={styles.opsCard}>
                  <div style={styles.opsHead}>{d.dayName.substring(0,3)} {d.dayNumber}</div>
                  <div style={styles.opsField}><span style={styles.opsLabel}>Desayunos</span><input type="number" value={d.breakfasts} onChange={(e) => handleUpdateOccupancyOps(currentWeekStart, d.date, { breakfasts: parseInt(e.target.value)||0, rooms: d.rooms })} style={styles.opsInput} /></div>
                  <div style={styles.opsField}><span style={styles.opsLabel}>Habitaciones</span><input type="number" value={d.rooms} onChange={(e) => handleUpdateOccupancyOps(currentWeekStart, d.date, { breakfasts: d.breakfasts, rooms: parseInt(e.target.value)||0 })} style={styles.opsInput} /></div>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.sectionHeader}><div><div style={styles.sectionEyebrow}>Operación detallada</div><div style={styles.sectionTitle}>Tabla de eventos y resultados</div><div style={styles.sectionDesc}>Prioriza estado, salon, vendedor, cotizacion, checklist y montos sin saturar la lectura.</div></div></div>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>PAX</th>
                  <th style={styles.th}>Fecha evento</th>
                  <th style={styles.th}>Hora inicio</th>
                  <th style={styles.th}>Hora final</th>
                  <th style={styles.th}>Evento</th>
                  <th style={styles.th}>Salón</th>
                  <th style={styles.th}>Institución</th>
                  <th style={styles.th}>Vendedor</th>
                  <th style={styles.th}>Cotización</th>
                  <th style={styles.th}>Menú & Montaje</th>
                  <th style={styles.th}>Checklist</th>
                  <th style={styles.th}>Total evento</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((r, i) => {
                  const ev = r.rawEvent;
                  const hasQuote = !!ev.quote;
                  const quoteLabel = hasQuote ? `V${ev.quote.version || 1}` : '-';
                  const hasMenu = !!(ev.quote?.menuMontajeEntries && ev.quote.menuMontajeEntries.length > 0 || ev.quote?.menuMontajeVersion);
                  const menuLabel = hasMenu ? `V${ev.quote?.menuMontajeVersion || 1}` : '-';
                  const hasChecklist = !!(ev.checklist && ev.checklist.items && ev.checklist.items.length > 0);
                  const completed = hasChecklist && ev.checklist.items.every(i => i.status === 'cumplido' || i.status === 'no_aplica');
                  const checklistLabel = completed ? "Completo" : (hasChecklist ? "En proceso" : "Iniciar");

                  return (
                    <tr key={r.eventId} style={i%2 ? styles.trEven : {}}>
                      <td style={styles.td}><span style={styles.statusBadge(r.statusColor)}>{r.status}</span></td>
                      <td style={styles.td}><strong>{r.pax}</strong></td>
                      <td style={styles.td}>{r.eventDate}</td>
                      <td style={styles.td}>{r.startTime}</td>
                      <td style={styles.td}>{r.endTime}</td>
                      <td style={styles.td}><strong>{r.eventName}</strong></td>
                      <td style={styles.td}>{r.salon}</td>
                      <td style={styles.td}>{r.company || '-'}</td>
                      <td style={styles.td}>{r.seller}</td>
                      
                      {/* Action cell 1: Cotización */}
                      <td style={styles.td}>
                        {hasQuote ? (
                          <button 
                            type="button" 
                            onClick={() => handleQuoteClick(r)}
                            style={{ 
                              background: '#eff6ff', 
                              border: '1px solid #bfdbfe', 
                              color: '#2563eb', 
                              padding: '4px 8px', 
                              borderRadius: '6px', 
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}
                          >
                            {quoteLabel}
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                      
                      {/* Action cell 2: Menú & Montaje */}
                      <td style={styles.td}>
                        {hasMenu ? (
                          <button 
                            type="button" 
                            onClick={() => handleMenuClick(r)}
                            style={{ 
                              background: '#f0fdf4', 
                              border: '1px solid #bbf7d0', 
                              color: '#16a34a', 
                              padding: '4px 8px', 
                              borderRadius: '6px', 
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}
                          >
                            {menuLabel}
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                      
                      {/* Action cell 3: Checklist */}
                      <td style={styles.td}>
                        <button 
                          type="button" 
                          onClick={() => handleChecklistClick(r)}
                          style={{ 
                            background: completed ? '#dcfce7' : (hasChecklist ? '#fef3c7' : '#f1f5f9'), 
                            border: '1px solid',
                            borderColor: completed ? '#bbf7d0' : (hasChecklist ? '#fde047' : '#cbd5e1'), 
                            color: completed ? '#15803d' : (hasChecklist ? '#a16207' : '#475569'), 
                            padding: '4px 8px', 
                            borderRadius: '6px', 
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          {checklistLabel}
                        </button>
                      </td>
                      
                      <td style={styles.td}><strong style={{ color: '#2563eb' }}>{formatMoneyGT(r.total)}</strong></td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={13} style={styles.emptyState}>Sin eventos Confirmados/Pre reserva para esta semana.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <SettingsChecklist />
    </div>
  );
}
