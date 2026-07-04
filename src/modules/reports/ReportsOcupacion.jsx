import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { STATUS_META } from '../calendar/constants';
import { generateQuotePrintDocument, buildMenuMontajeReportHtml } from '../../utils/printUtils';
import { emitOpenEventChecklist } from '../../utils/appEvents';
import SettingsChecklist from '../settings/SettingsChecklist';
import { toast } from '../../utils/toast';
import { loadState } from '../../services/stateService';
import ReportInfo from './components/ReportInfo';

const getMonday = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return getLocalDateString(d);
};

const getLocalDateString = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
};

const STATUS = { PRERESERVA: 'Pre reserva', CONFIRMADO: 'Confirmado' };
const ALLOWED_STATUSES = new Set([STATUS.PRERESERVA, STATUS.CONFIRMADO]);

function getAllChkItems(chk) {
  if (!chk) return [];
  if (Array.isArray(chk.items)) return chk.items;
  const all = [];
  if (chk.operativa?.items) all.push(...chk.operativa.items);
  if (chk.evaluacion?.items) all.push(...chk.evaluacion.items);
  return all;
}

export default function ReportsOcupacion({ onClose }) {
  const { events, users } = useOutletContext();
  
  const [companies, setCompanies] = useState([]);
  const [eventChecklists, setEventChecklists] = useState({});
  const [checklistFilter, setChecklistFilter] = useState('');

  const formatTimestamp = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString('es-GT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  const loadStateData = async () => {
    try {
      const stateData = await loadState();
      setCompanies(stateData?.companies || []);
      setEventChecklists(stateData?.eventChecklists || {});
    } catch (err) {
      console.error("Error loading companies/checklists:", err);
    }
  };

  useEffect(() => {
    loadStateData();
    const handleStateUpdate = () => { loadStateData(); };
    window.addEventListener('stateUpdated', handleStateUpdate);
    return () => window.removeEventListener('stateUpdated', handleStateUpdate);
  }, []);

  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    return getLocalDateString(monday);
  });

  const weekDays = useMemo(() => {
    const start = new Date(currentWeekStart + 'T00:00:00');
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return getLocalDateString(d);
    });
  }, [currentWeekStart]);

  const todayISOStr = useMemo(() => getLocalDateString(new Date()), []);
  const initialSelectedDay = useMemo(() => {
    if (weekDays.includes(todayISOStr)) return todayISOStr;
    return weekDays[0];
  }, [weekDays, todayISOStr]);

  const [selectedDay, setSelectedDay] = useState(initialSelectedDay);
  const stripRef = useRef(null);
  const stripScrollPosRef = useRef(0);

  useEffect(() => {
    if (!weekDays.includes(selectedDay)) setSelectedDay(weekDays[0]);
  }, [weekDays, selectedDay]);

  const rows = useMemo(() => {
    if (!events) return [];
    const fromIso = weekDays[0], toIso = weekDays[6];
    let result = events
      .filter(ev => {
        const d = String(ev.date || '');
        return d && d >= fromIso && d <= toIso && ALLOWED_STATUSES.has(String(ev.status || ''));
      })
      .map(ev => {
        const user = users?.find(u => String(u.id) === String(ev.userId));
        const checklist = eventChecklists[ev.id] || ev.checklist;
        return {
          eventId: String(ev.id||''), status: String(ev.status||''),
          statusColor: STATUS_META[ev.status]?.color||'#2563eb',
          eventDate: String(ev.date||''), startTime: String(ev.startTime||''),
          endTime: String(ev.endTime||''), eventName: String(ev.name||''),
          salon: String(ev.salon||''), company: ev.quote?.companyName||'',
          seller: String(user?.fullName||user?.name||''),
          pax: Number(ev.pax||ev.quote?.people||0), total: Number(ev.quote?.total||0),
          rawEvent: { ...ev, checklist }
        };
      })
      .sort((a, b) => {
        const d = a.eventDate.localeCompare(b.eventDate);
        if (d) return d;
        const t = a.startTime.localeCompare(b.startTime);
        return t || a.salon.localeCompare(b.salon);
      });

    // Apply checklist status filter
    if (checklistFilter) {
      result = result.filter(r => {
        const chk = r.rawEvent.checklist;
        const chkItems = getAllChkItems(chk);
        if (checklistFilter === 'pendiente') return !chkItems.length;
        if (checklistFilter === 'en_proceso') return chkItems.length > 0 && !chkItems.every(i => i.status === 'cumplido' || i.status === 'no_aplica');
        if (checklistFilter === 'completo') return chkItems.length > 0 && chkItems.every(i => i.status === 'cumplido' || i.status === 'no_aplica');
        return true;
      });
    }

    return result;
  }, [events, users, weekDays, eventChecklists, checklistFilter]);

  const summary = useMemo(() => {
    const totalEvents = rows.length;
    const confirmed = rows.filter(r => r.status === STATUS.CONFIRMADO).length;
    const pre = rows.filter(r => r.status === STATUS.PRERESERVA).length;
    const pax = rows.reduce((a, r) => a + Math.max(0, r.pax), 0);
    const totalRevenue = rows.reduce((a, r) => a + r.total, 0);
    const activeDays = new Set(rows.map(r => r.eventDate).filter(Boolean)).size;
    return { totalEvents, confirmed, pre, pax, totalRevenue, activeDays, confirmedPct: totalEvents ? Math.round((confirmed / totalEvents) * 100) : 0 };
  }, [rows]);

  const selectedDayData = useMemo(() => {
    const dayRows = rows.filter(r => r.eventDate === selectedDay);
    const dateObj = new Date(selectedDay + 'T00:00:00');
    return {
      date: selectedDay,
      formattedDate: dateObj.toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      eventsCount: dayRows.length, confirmed: dayRows.filter(r => r.status === STATUS.CONFIRMADO).length,
      pre: dayRows.filter(r => r.status === STATUS.PRERESERVA).length,
      pax: dayRows.reduce((s, r) => s + Math.max(0, r.pax), 0),
      total: dayRows.reduce((s, r) => s + r.total, 0)
    };
  }, [rows, selectedDay]);

  const dayCards = useMemo(() => weekDays.map(d => {
    const dayRows = rows.filter(r => r.eventDate === d);
    const dateObj = new Date(d + 'T00:00:00');
    return {
      date: d,
      dayName: ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'][dateObj.getDay()],
      dayNumber: dateObj.getDate(), monthLabel: dateObj.toLocaleDateString('es-GT', { month: 'short' }).toUpperCase(),
      count: dayRows.length, confirmedCount: dayRows.filter(r => r.status === STATUS.CONFIRMADO).length,
      preCount: dayRows.filter(r => r.status === STATUS.PRERESERVA).length,
      revenue: dayRows.reduce((a,r) => a+r.total, 0), rows: dayRows,
    };
  }), [weekDays, rows, currentWeekStart]);

  const formatMoneyGT = (v) => 'Q ' + Number(v||0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handlePrevWeek = () => {
    const s = new Date(currentWeekStart + 'T00:00:00');
    s.setDate(s.getDate() - 7);
    setCurrentWeekStart(getLocalDateString(s));
  };

  const handleNextWeek = () => {
    const s = new Date(currentWeekStart + 'T00:00:00');
    s.setDate(s.getDate() + 7);
    setCurrentWeekStart(getLocalDateString(s));
  };

  const handleGoToday = () => {
    const t = new Date();
    const day = t.getDay();
    const diff = t.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(getLocalDateString(new Date(t.setDate(diff))));
  };

  const handleExportExcel = () => {
    if (!rows.length) { toast("No hay datos para exportar."); return; }
    try {
      const worksheetData = rows.map(r => {
        const ev = r.rawEvent;
        return {
          'Encargado Evento': ev.quote?.phone || ev.clientPhone || '-',
          'Vendedor': r.seller,
          'Última Cotización': ev.quote ? `V${ev.quote.version || 1} - ${ev.quote.quotedAt ? new Date(ev.quote.quotedAt).toISOString().split('T')[0] : ''}` : '-',
          'Último Informe M&M': ev.quote?.menuMontajeVersion ? `V${ev.quote.menuMontajeVersion}` : '-',
          'Check List': ev.checklist ? 'Sí' : 'No', 'Total Evento': r.total,
          'Última Modificación': formatTimestamp(ev.updatedAt || ev.createdAt || ev.quote?.quotedAt)
        };
      });
      const ws = XLSX.utils.json_to_sheet(worksheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ocupación Semanal');
      XLSX.writeFile(wb, `Reporte_Ocupacion_${weekDays[0]}_a_${weekDays[6]}.xlsx`);
      toast('Reporte exportado exitosamente');
    } catch (err) { toast('Error al exportar a Excel'); }
  };

  const handleQuoteClick = async (r) => {
    const ev = r.rawEvent;
    if (!ev?.quote) { toast("Este evento no tiene cotización."); return; }
    try {
      const user = users?.find(u => String(u.id) === String(ev.userId));
      if (await generateQuotePrintDocument(ev.quote, user, "standard", ev) !== false) toast("Generando vista previa de cotización...");
    } catch { toast("Error al abrir la cotización."); }
  };

  const handleMenuClick = (r) => {
    const ev = r.rawEvent;
    if (!ev?.quote) { toast("Este evento no tiene cotización."); return; }
    const html = buildMenuMontajeReportHtml(ev, ev.quote, "full", { companies, users });
    if (!html) { toast("No hay datos de menú/montaje para imprimir."); return; }
    const w = window.open("about:blank", "_blank");
    if (!w) { toast("Habilita ventanas emergentes."); return; }
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
  };

  const handleChecklistClick = (r) => {
    if (!r?.eventId) { toast("No se encontro el evento."); return; }
    emitOpenEventChecklist(r.eventId);
  };

  // ── Bento KPI data ──
  const kpiCards = [
    { label: 'Eventos', value: summary.totalEvents, accent: '#2563eb', meta: `${summary.activeDays} día(s) activo(s)` },
    { label: 'Confirmados', value: summary.confirmed, accent: '#16a34a', meta: `${summary.confirmedPct}% del total` },
    { label: 'Pre Reserva', value: summary.pre, accent: '#d97706', meta: `${100 - summary.confirmedPct}% pendiente` },
    { label: 'PAX Totales', value: summary.pax.toLocaleString(), accent: '#7c3aed', meta: 'personas' },
    { label: 'Facturación', value: formatMoneyGT(summary.totalRevenue), accent: '#0d9488', meta: 'valor cotizado' },
  ];

  // Restore occupancyDaysStrip scroll position after re-renders (useLayoutEffect for no visual flash)
  useLayoutEffect(() => {
    if (stripRef.current && stripScrollPosRef.current > 0) {
      stripRef.current.scrollLeft = stripScrollPosRef.current;
    }
  });

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
            <div className="reports-title">Reporte de Ocupación</div>
            <div className="reports-subtitle">Semana {weekDays[0]} a {weekDays[6]} (Lunes a Domingo)</div>
          </div>
        </div>
        <ReportInfo reportKey="ocupacion" />
        <button className="btn-exit" type="button" onClick={onClose}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver
        </button>
      </div>

      <div className="reports-page-body">
        {/* ── Hero + Bento KPIs ── */}
        <section className="reports-hero-panel">
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Vista ejecutiva semanal</span>
              <h3 className="reports-section-title">Lectura de ocupación y rentabilidad</h3>
              <p className="reports-section-text">Filtra la semana, identifica días críticos y baja al detalle operativo.</p>
            </div>
          </div>

          {/* Bento KPI Grid */}
          <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {kpiCards.map((k, i) => (
              <div key={i} className="bento-tile reports-kpi-tile" style={{ borderTop: `4px solid ${k.accent}` }}>
                <span className="reports-eyebrow">{k.label}</span>
                <strong>{k.value}</strong>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{k.meta}</span>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="reports-toolbar">
            <label className="field">
              <span>Semana (desde lunes)</span>
              <input type="date" value={currentWeekStart} onChange={e => setCurrentWeekStart(getMonday(e.target.value))} />
            </label>
            <div className="reports-actions">
              <button type="button" onClick={handlePrevWeek}>‹ Anterior</button>
              <button type="button" onClick={handleNextWeek}>Siguiente ›</button>
              <button type="button" onClick={handleGoToday}>Hoy</button>
              <button className="btnPrimary" type="button" onClick={handleExportExcel}>Exportar Excel</button>
            </div>
          </div>
        </section>

        {/* ── Storytelling ── */}
        <div className="reports-storytelling-card">
          <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Narración de Ocupación</span>
          <p className="reports-story-text">
            Para la semana analizada (del Lunes <strong className="highlight-slate">{weekDays[0]}</strong> al Domingo <strong className="highlight-slate">{weekDays[6]}</strong>), se registra un total de <strong className="highlight-blue">{summary.totalEvents}</strong> eventos distribuidos en <strong className="highlight-slate">{summary.activeDays}</strong> días con actividad operativa. Este movimiento representa una capacidad total de <strong className="highlight-accent">{summary.pax.toLocaleString()}</strong> PAX movilizados, generando un valor cotizado total de <strong className="highlight-green">{formatMoneyGT(summary.totalRevenue)}</strong>. De los eventos programados, un <strong className="highlight-green">{summary.confirmedPct}%</strong> ya están en estado <strong className="highlight-green">Confirmado</strong> ({summary.confirmed} eventos), mientras que el restante <strong className="highlight-orange">{100 - summary.confirmedPct}%</strong> ({summary.pre} eventos) permanece en <strong className="highlight-orange">Pre reserva</strong>.
          </p>
        </div>

        {/* ── Week Strip ── */}
        <section className="reports-hero-panel" style={{ gap: '8px' }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Comportamiento diario</span>
              <h3 className="reports-section-title">Distribución y ritmo de eventos</h3>
            </div>
          </div>

          <div className="occupancyDaysStrip" ref={stripRef}
            onScroll={() => {
              if (stripRef.current) stripScrollPosRef.current = stripRef.current.scrollLeft;
            }}>
            {dayCards.map((d, i) => (
              <div key={d.date} className="occupancyWeekColumn" style={{
                flex: '1 0 150px', minWidth: '150px', display: 'flex', flexDirection: 'column', padding: '0 10px 12px',
                background: selectedDay === d.date ? '#f8fafc' : (i % 2 ? '#fafcff' : '#ffffff'),
                borderRight: i < 6 ? '1px solid #e2e8f0' : 'none',
              }}>
                {/* Day Header */}
                <div onClick={() => setSelectedDay(d.date)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0', borderBottom: '1px solid #e2e8f0', cursor: 'pointer',
                    margin: '0 -10px', paddingLeft: '10px', paddingRight: '10px',
                  }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d.dayName}</div>
                    <strong style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', lineHeight: 1, display: 'block' }}>{d.dayNumber}</strong>
                  </div>
                  <small style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>{d.monthLabel}</small>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
                  <span><b style={{ color: '#1e293b' }}>{d.count}</b> eventos</span>
                  <span><b style={{ color: '#16a34a' }}>{d.confirmedCount}</b> conf.</span>
                  <span><b style={{ color: '#d97706' }}>{d.preCount}</b> pre</span>
                </div>

                {/* Revenue */}
                <div style={{
                  fontSize: '11px', fontWeight: 700, color: d.revenue > 0 ? '#2563eb' : '#94a3b8',
                  padding: '6px 0', borderTop: '1px solid #f1f5f9', marginTop: '6px'
                }}>
                  {d.revenue > 0 ? formatMoneyGT(d.revenue) : 'Sin monto'}
                </div>

                {/* Events */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', flex: 1 }}>
                  {d.rows.length ? d.rows.map(r => (
                    <div key={r.eventId}
                      onClick={() => setSelectedDay(d.date)}
                      style={{
                        padding: '8px', borderRadius: '10px', border: '1px solid #e2e8f0',
                        borderLeft: `4px solid ${r.statusColor}`,
                        background: '#ffffff', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', gap: '3px',
                        transition: 'all 0.15s ease',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8' }}>
                        <span style={{ fontWeight: 700 }}>{r.startTime}</span>
                        <span style={{ fontWeight: 800, fontSize: '8px', textTransform: 'uppercase', color: r.statusColor }}>
                          {r.status === 'Confirmado' ? 'CONF' : 'PRE'}
                        </span>
                      </div>
                      <strong style={{ fontSize: '11px', color: '#0f172a', lineHeight: '1.2' }}>{r.eventName}</strong>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>{r.salon}</span>
                    </div>
                  )) : (
                    <div style={{ fontSize: '10px', color: '#cbd5e1', textAlign: 'center', padding: '16px 0' }}>Sin eventos</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Day Detail ── */}
        <section className="reports-hero-panel" style={{ gap: '10px' }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Foco del día</span>
              <h3 className="reports-section-title">Detalle interpretativo — {selectedDayData.date}</h3>
            </div>
          </div>

          <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {[
              { label: 'Eventos', value: selectedDayData.eventsCount, accent: '#2563eb' },
              { label: 'Confirmados', value: selectedDayData.confirmed, accent: '#16a34a' },
              { label: 'Pre Reserva', value: selectedDayData.pre, accent: '#d97706' },
              { label: 'PAX', value: selectedDayData.pax, accent: '#7c3aed' },
              { label: 'Total Cotizado', value: formatMoneyGT(selectedDayData.total), accent: '#0d9488' },
            ].map((k, i) => (
              <div key={i} className="bento-tile reports-kpi-tile" style={{ borderTop: `4px solid ${k.accent}` }}>
                <span className="reports-eyebrow">{k.label}</span>
                <strong style={{ fontSize: k.label === 'Total Cotizado' ? '1.2rem' : '2rem' }}>{k.value}</strong>
              </div>
            ))}
          </div>
        </section>



        {/* ── Events Table ── */}
        <section className="reports-hero-panel" style={{ gap: '8px' }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Operación Detallada</span>
              <h3 className="reports-section-title">Tabla de eventos y resultados</h3>
              <p className="reports-section-text">Estado, salón, vendedor, cotización, checklist y montos</p>
            </div>
            <div className="reports-actions" style={{ gap: '8px', flexWrap: 'nowrap' }}>
              <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '6px', margin: 0 }}>
                <span style={{ fontSize: '11px', whiteSpace: 'nowrap', fontWeight: 700, color: '#64748b' }}>Check List:</span>
                <select value={checklistFilter} onChange={e => setChecklistFilter(e.target.value)}
                  style={{
                    height: '32px', padding: '0 8px', borderRadius: '6px',
                    border: '1px solid #d1d9e6', fontSize: '12px', fontWeight: 600,
                    background: checklistFilter ? '#eff4ff' : '#ffffff',
                    color: '#0f172a', cursor: 'pointer',
                  }}>
                  <option value="">Todos</option>
                  <option value="pendiente">⏳ Pendiente</option>
                  <option value="en_proceso">🔄 En proceso</option>
                  <option value="completo">✅ Completo</option>
                </select>
              </label>
            </div>
          </div>

          <div className="reports-table-wrap" style={{ minHeight: '300px' }}>
            <table className="reports-table" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th>Encargado</th>
                  <th>Vendedor</th>
                  <th>Última Cotización</th>
                  <th>Menú/Montaje</th>
                  <th>Check List</th>
                  <th style={{ textAlign: 'right' }}>Total Evento</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((r, i) => {
                  const ev = r.rawEvent;
                  const hasQuote = !!ev.quote;
                  const formatQuoteDate = (q) => {
                    if (!q) return '';
                    const d = new Date(q);
                    return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                  };
                  const quoteLabel = hasQuote ? `V${ev.quote.version || 1} - ${formatQuoteDate(ev.quote.quotedAt)}` : '-';
                  const hasMenu = !!(ev.quote?.menuMontajeEntries?.length || ev.quote?.menuMontajeVersion);
                  const menuLabel = hasMenu ? `V${ev.quote?.menuMontajeVersion || 1}` : '-';
                  const chkItems = getAllChkItems(ev.checklist);
                  const hasChecklist = chkItems.length > 0;
                  const completed = hasChecklist && chkItems.every(item => item.status === 'cumplido' || item.status === 'no_aplica');
                  const checklistLabel = completed ? "Completo" : (hasChecklist ? "En proceso" : "Iniciar");

                  return (
                    <tr key={r.eventId}>
                      <td style={{ fontWeight: 700 }}>{ev.quote?.phone || ev.clientPhone || '-'}</td>
                      <td>{r.seller || '-'}</td>
                      <td>
                        {hasQuote ? (
                          <button type="button" onClick={() => handleQuoteClick(r)}
                            style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', color: '#1e293b' }}>
                            {quoteLabel}
                          </button>
                        ) : <span style={{ color: '#94a3b8' }}>-</span>}
                      </td>
                      <td>
                        {hasMenu ? (
                          <button type="button" onClick={() => handleMenuClick(r)}
                            style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', color: '#1e293b' }}>
                            {menuLabel}
                          </button>
                        ) : <span style={{ color: '#94a3b8' }}>-</span>}
                      </td>
                      <td>
                        <button type="button" onClick={() => handleChecklistClick(r)}
                          style={{
                            padding: '4px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '6px',
                            border: `1px solid ${completed ? '#86efac' : hasChecklist ? '#fde68a' : '#e2e8f0'}`,
                            background: completed ? '#f0fdf4' : hasChecklist ? '#fffbeb' : '#f8fafc',
                            color: completed ? '#15803d' : hasChecklist ? '#b45309' : '#475569',
                            cursor: 'pointer',
                          }}>
                          {checklistLabel}
                        </button>
                      </td>
                      <td style={{ fontWeight: 700, textAlign: 'right', color: '#0f172a' }}>{formatMoneyGT(r.total)}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      Sin eventos Confirmados/Pre reserva para esta semana.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      
      <SettingsChecklist />
    </div>
  );
}
