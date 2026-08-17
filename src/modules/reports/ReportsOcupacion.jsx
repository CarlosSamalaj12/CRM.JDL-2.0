import { useOutletContext, useNavigate } from 'react-router-dom';
import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { STATUS_META } from '../calendar/constants';
import ReportInfo from './components/ReportInfo';
import MultiSelect from './components/MultiSelect';
import { getEventSeries } from './components/eventSeriesUtils';

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
const ALL_STATUSES = [
  'Pre reserva', 'Reserva sin Cotizacion', '1er Cotizacion', 'Seguimiento',
  'Lista de Espera', 'Confirmado', 'Cancelado', 'Perdido'
];

export default function ReportsOcupacion({ onClose }) {
  const { events, users } = useOutletContext();
  const navigate = useNavigate();
  
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    return getLocalDateString(monday);
  });

  // Filtro de estado: multi-selección. Vacío = sin filtro (mostrar todos).
  // Default igual al comportamiento previo: solo Pre reserva + Confirmado.
  const [statusFilter, setStatusFilter] = useState(new Set([STATUS.PRERESERVA, STATUS.CONFIRMADO]));

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
        if (!d || d < fromIso || d > toIso) return false;
        // Si statusFilter está vacío = "Todos" (sin filtro)
        if (statusFilter.size === 0) return true;
        return statusFilter.has(String(ev.status || ''));
      })
      .map(ev => {
        const user = users?.find(u => String(u.id) === String(ev.userId));
        return {
          eventId: String(ev.id||''), status: String(ev.status||''),
          statusColor: STATUS_META[ev.status]?.color||'#2563eb',
          eventDate: String(ev.date||''), startTime: String(ev.startTime||''),
          endTime: String(ev.endTime||''), eventName: String(ev.name||''),
          salon: String(ev.salon||''), company: ev.quote?.companyName||'',
          seller: String(user?.fullName||user?.name||''),
          pax: Number(ev.pax||ev.quote?.people||0), total: Number(ev.quote?.total||0),
          rawEvent: ev
        };
      })
      .sort((a, b) => {
        const d = a.eventDate.localeCompare(b.eventDate);
        if (d) return d;
        const t = a.startTime.localeCompare(b.startTime);
        return t || a.salon.localeCompare(b.salon);
      });

    return result;
  }, [events, users, weekDays, statusFilter]);

  // Deduplicar rows por reserva (groupId | id) para evitar sumar totales
  // duplicados cuando un evento es multi-día. Se queda con la fila del
  // primer día de la serie (la que tiene el evento principal).
  const uniqueReservationRows = useMemo(() => {
    if (!events) return [];
    const seen = new Set();
    const out = [];
    // Ordenar rows por fecha para que el primero sea el día de inicio
    const sorted = [...rows].sort((a, b) => String(a.eventDate).localeCompare(String(b.eventDate)));
    for (const r of sorted) {
      const key = r.rawEvent?.groupId || r.eventId;
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  }, [rows, events]);

  const summary = useMemo(() => {
    // totalEvents: cuenta slots (se ven en la week strip, un slot por día por reserva)
    const totalEvents = rows.length;
    const confirmed = rows.filter(r => r.status === STATUS.CONFIRMADO).length;
    const pre = rows.filter(r => r.status === STATUS.PRERESERVA).length;
    // pax: deduplicado por reserva (no se duplica entre slots del mismo evento)
    const pax = uniqueReservationRows.reduce((a, r) => a + Math.max(0, r.pax), 0);
    // totalRevenue: deduplicado por reserva
    const totalRevenue = uniqueReservationRows.reduce((a, r) => a + r.total, 0);
    const activeDays = new Set(rows.map(r => r.eventDate).filter(Boolean)).size;
    return { totalEvents, confirmed, pre, pax, totalRevenue, activeDays, confirmedPct: totalEvents ? Math.round((confirmed / totalEvents) * 100) : 0 };
  }, [rows, uniqueReservationRows]);

  // Mapa: reservationKey -> fecha del día de inicio de la serie.
  // Se usa para mostrar el total cotizado SOLO en el día principal
  // (los demás días del multi-día no muestran monto para evitar duplicados).
  const seriesStartDate = useMemo(() => {
    const map = new Map();
    for (const r of uniqueReservationRows) {
      const key = r.rawEvent?.groupId || r.eventId;
      if (key && !map.has(key)) {
        map.set(key, r.eventDate);
      }
    }
    return map;
  }, [uniqueReservationRows]);

  const dayCards = useMemo(() => {
    return weekDays.map(d => {
      const dayRows = rows.filter(r => r.eventDate === d);
      // Revenue del día: solo contar el total si el día es el día de inicio de esa serie
      const dayRevenue = dayRows.reduce((acc, r) => {
        const key = r.rawEvent?.groupId || r.eventId;
        if (seriesStartDate.get(key) === d && r.total > 0) {
          return acc + r.total;
        }
        return acc;
      }, 0);
      const dateObj = new Date(d + 'T00:00:00');
      return {
        date: d,
        dayName: ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'][dateObj.getDay()],
        dayNumber: dateObj.getDate(), monthLabel: dateObj.toLocaleDateString('es-GT', { month: 'short' }).toUpperCase(),
        count: dayRows.length, confirmedCount: dayRows.filter(r => r.status === STATUS.CONFIRMADO).length,
        preCount: dayRows.filter(r => r.status === STATUS.PRERESERVA).length,
        revenue: dayRevenue, rows: dayRows,
      };
    });
  }, [weekDays, rows, uniqueReservationRows, seriesStartDate, currentWeekStart]);

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

  // ── Bento KPI data ──
  const kpiCards = [
    { label: 'Eventos', value: summary.totalEvents, accent: '#2563eb', meta: `${summary.activeDays} día(s) activo(s)` },
    { label: 'Confirmados', value: summary.confirmed, accent: '#16a34a', meta: `${summary.confirmedPct}% del total` },
    { label: 'Pre Reserva', value: summary.pre, accent: '#d97706', meta: `${100 - summary.confirmedPct}% pendiente` },
    { label: 'PAX Totales', value: summary.pax.toLocaleString(), accent: '#7c3aed', meta: 'personas' },
    { label: 'Total Venta', value: formatMoneyGT(summary.totalRevenue), accent: '#0d9488', meta: 'valor cotizado' },
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
            <div className="field">
              <MultiSelect
                selected={statusFilter}
                onChange={setStatusFilter}
                options={ALL_STATUSES.map(s => ({ value: s, label: s, color: STATUS_META[s]?.color || '#64748b' }))}
                placeholder="Estado"
                emptyLabel="Todos los estados"
              />
            </div>
            <div className="reports-actions">
              <button type="button" onClick={handlePrevWeek}>‹ Anterior</button>
              <button type="button" onClick={handleNextWeek}>Siguiente ›</button>
              <button type="button" onClick={handleGoToday}>Hoy</button>
            </div>
          </div>
        </section>
        <section id="occupancyWeekStrip" className="reports-hero-panel" style={{ gap: '8px' }}>
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
                  {d.rows.length ? d.rows.map(r => {
                    // Mostrar el total SOLO en el día de inicio de la serie
                    // (para no duplicar el monto en cada día de un evento multi-día)
                    const seriesKey = r.rawEvent?.groupId || r.eventId;
                    const isSeriesStart = seriesStartDate.get(seriesKey) === d.date;
                    return (
                      <div key={r.eventId}
                        onClick={() => navigate(`/reserva/${r.eventId}`)}
                        title="Click para abrir el editor de reserva"
                        style={{
                          padding: '8px', borderRadius: '10px', border: '1px solid #e2e8f0',
                          borderLeft: `4px solid ${r.statusColor}`,
                          background: '#ffffff', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', gap: '3px',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8' }}>
                          <span style={{ fontWeight: 700 }}>{r.startTime}</span>
                          <span style={{ fontWeight: 800, fontSize: '8px', textTransform: 'uppercase', color: r.statusColor }}>
                            {r.status === 'Confirmado' ? 'CONF' : 'PRE'}
                          </span>
                        </div>
                        <strong style={{ fontSize: '11px', color: '#0f172a', lineHeight: '1.2' }}>{r.eventName}</strong>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{r.salon}</span>
                        {isSeriesStart && r.total > 0 && (
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                            {formatMoneyGT(r.total)}
                          </span>
                        )}
                      </div>
                    );
                  }) : (
                    <div style={{ fontSize: '10px', color: '#cbd5e1', textAlign: 'center', padding: '16px 0' }}>Sin eventos</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
