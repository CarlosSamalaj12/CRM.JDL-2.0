import { useOutletContext, useNavigate } from 'react-router-dom';
import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { STATUS_META } from '../calendar/constants';
import ReportInfo from './components/ReportInfo';
import MultiSelect from './components/MultiSelect';

// ── Minimalist Vector Icons ──
function IconCalendar({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconCheckCircle({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconClock({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconUsers({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconDollar({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
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

function IconChevronRight({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

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

function formatMoneyGT(v) {
  return 'Q ' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
  // duplicados cuando un evento es multi-día.
  const uniqueReservationRows = useMemo(() => {
    if (!events) return [];
    const seen = new Set();
    const out = [];
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
    const totalEvents = rows.length;
    const confirmed = rows.filter(r => r.status === STATUS.CONFIRMADO).length;
    const pre = rows.filter(r => r.status === STATUS.PRERESERVA).length;
    const pax = uniqueReservationRows.reduce((a, r) => a + Math.max(0, r.pax), 0);
    const totalRevenue = uniqueReservationRows.reduce((a, r) => a + r.total, 0);
    const activeDays = new Set(rows.map(r => r.eventDate).filter(Boolean)).size;
    return { totalEvents, confirmed, pre, pax, totalRevenue, activeDays, confirmedPct: totalEvents ? Math.round((confirmed / totalEvents) * 100) : 0 };
  }, [rows, uniqueReservationRows]);

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
  }, [weekDays, rows, seriesStartDate]);

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

  const kpiCards = [
    { label: 'Eventos (Slots)', value: summary.totalEvents, accent: '#2563eb', bg: '#eff6ff', Icon: IconCalendar, meta: `${summary.activeDays} día(s) activo(s)` },
    { label: 'Confirmados', value: summary.confirmed, accent: '#16a34a', bg: '#ecfdf5', Icon: IconCheckCircle, meta: `${summary.confirmedPct}% del total` },
    { label: 'Pre Reserva', value: summary.pre, accent: '#d97706', bg: '#fffbeb', Icon: IconClock, meta: `${100 - summary.confirmedPct}% en proceso` },
    { label: 'PAX Totales', value: summary.pax.toLocaleString(), accent: '#7c3aed', bg: '#f5f3ff', Icon: IconUsers, meta: 'personas en el ciclo' },
    { label: 'Total Cotizado', value: formatMoneyGT(summary.totalRevenue), accent: '#0d9488', bg: '#f0fdfa', Icon: IconDollar, meta: 'ingresos proyectados' },
  ];

  useLayoutEffect(() => {
    if (stripRef.current && stripScrollPosRef.current > 0) {
      stripRef.current.scrollLeft = stripScrollPosRef.current;
    }
  });

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
            <div className="reports-title">Reporte de Ocupación</div>
            <div className="reports-subtitle">Semana del {weekDays[0]} al {weekDays[6]} (Lunes a Domingo)</div>
          </div>
        </div>
        <ReportInfo reportKey="ocupacion" />
        <button className="btn-exit" type="button" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconChevronLeft size={16} />
          Volver
        </button>
      </div>

      <div className="reports-page-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ── Toolbar ── */}
        <section className="reports-hero-panel">
          <div className="reports-toolbar" style={{ gap: '12px', padding: '12px 20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="field" style={{ flex: '0 0 160px' }}>
              <span>Semana (lunes)</span>
              <input type="date" value={currentWeekStart} onChange={e => setCurrentWeekStart(getMonday(e.target.value))} />
            </label>
            <div className="field" style={{ minWidth: 220 }}>
              <MultiSelect
                selected={statusFilter}
                onChange={setStatusFilter}
                options={ALL_STATUSES.map(s => ({ value: s, label: s, color: STATUS_META[s]?.color || '#64748b' }))}
                placeholder="Estado"
                emptyLabel="Todos los estados"
              />
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                className="preset-btn"
                onClick={handlePrevWeek}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '11px', fontWeight: 700, padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#ffffff', color: '#334155', cursor: 'pointer'
                }}
              >
                <IconChevronLeft size={14} /> Anterior
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={handleGoToday}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#ffffff', color: '#334155', cursor: 'pointer'
                }}
              >
                Hoy
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={handleNextWeek}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '11px', fontWeight: 700, padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#ffffff', color: '#334155', cursor: 'pointer'
                }}
              >
                Siguiente <IconChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>

        {/* ── KPI Grid Ejecutivo ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}>
          {kpiCards.map((k, i) => {
            const CardIcon = k.Icon;
            return (
              <div
                key={i}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {k.label}
                  </span>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: k.bg, color: k.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CardIcon size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {k.value}
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  {k.meta}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Daily Strip ── */}
        <section id="occupancyWeekStrip" className="reports-hero-panel" style={{ gap: '12px' }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Comportamiento diario</span>
              <h3 className="reports-section-title">Distribución y ritmo de eventos</h3>
              <p className="reports-section-text">Haz clic en cualquier evento para editar su reserva</p>
            </div>
          </div>

          <div className="occupancyDaysStrip" ref={stripRef}
            style={{
              display: 'flex',
              overflowX: 'auto',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
            }}
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
                    padding: '12px 0', borderBottom: '1px solid #e2e8f0', cursor: 'pointer',
                    margin: '0 -10px', paddingLeft: '12px', paddingRight: '12px',
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', flex: 1 }}>
                  {d.rows.length ? d.rows.map(r => {
                    const seriesKey = r.rawEvent?.groupId || r.eventId;
                    const isSeriesStart = seriesStartDate.get(seriesKey) === d.date;
                    return (
                      <div key={r.eventId}
                        onClick={() => navigate(`/reserva/${r.eventId}`)}
                        title="Click para abrir el editor de reserva"
                        style={{
                          padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0',
                          borderLeft: `4px solid ${r.statusColor}`,
                          background: '#ffffff', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', gap: '3px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.transform = 'none'; }}
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
