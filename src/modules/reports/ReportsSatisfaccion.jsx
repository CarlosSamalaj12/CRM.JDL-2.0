import { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { loadState } from '../../services/stateService';
import ReportInfo from './components/ReportInfo';

const RATING_LEVELS = [
  { value: 'excelente', label: 'Excelente', emoji: '💎', score: 10, color: '#a855f7', bg: '#faf5ff' },
  { value: 'bueno', label: 'Bueno', emoji: '🟢', score: 7.5, color: '#22c55e', bg: '#f0fdf4' },
  { value: 'regular', label: 'Regular', emoji: '🟡', score: 5, color: '#eab308', bg: '#fffbeb' },
  { value: 'malo', label: 'Malo', emoji: '🔴', score: 2.5, color: '#ef4444', bg: '#fef2f2' },
  { value: 'no_aplica', label: 'N/A', emoji: '🚫', score: 0, color: '#94a3b8', bg: '#f1f5f9' },
];

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getRatingColor(avg) {
  if (avg >= 8.75) return '#22c55e';
  if (avg >= 6.25) return '#eab308';
  if (avg >= 3.75) return '#f97316';
  return '#ef4444';
}

function getRatingEmoji(avg) {
  if (avg >= 8.75) return '😍';
  if (avg >= 6.25) return '😊';
  if (avg >= 3.75) return '😐';
  return '😟';
}

function getRatingLabel(avg) {
  if (avg >= 8.75) return 'Excelente';
  if (avg >= 6.25) return 'Bueno';
  if (avg >= 3.75) return 'Regular';
  return 'Malo';
}

function fmtMonth(yyyymm) {
  const [y, m] = yyyymm.split('-');
  return `${MONTH_SHORT[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export default function ReportsSatisfaccion({ onClose }) {
  const { events } = useOutletContext();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [viewTab, setViewTab] = useState('general');

  // ── Load satisfaction data ──
  const [checklists, setChecklists] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const state = await loadState({ cacheBust: true });
        setChecklists((state.eventChecklists && typeof state.eventChecklists === 'object') ? state.eventChecklists : {});
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  // ── Compute satisfaction data ──
  const satisfactionData = useMemo(() => {
    if (loading || !events) return null;

    const results = [];
    for (const [evtId, chk] of Object.entries(checklists)) {
      const ev = Array.isArray(events) ? events.find(e => String(e.id) === evtId) : null;
      if (!ev) continue;
      const date = ev.date || ev.eventDate || '';
      if (date < fromDate || date > toDate) continue;

      const items = Array.isArray(chk?.evaluacion?.items)
        ? chk.evaluacion.items
        : (Array.isArray(chk?.items) ? chk.items.filter(i => i.sectionType === 'evaluacion') : []);
      // N/A (rating === 'no_aplica') se excluye del numerador Y del denominador.
      const ratedItems = items.filter(i => i.rating !== null && i.rating !== undefined && i.rating !== 'no_aplica');
      const notApplicableCount = items.filter(i => i.rating === 'no_aplica').length;
      const unratedCount = items.filter(i => i.rating === null || i.rating === undefined).length;
      if (ratedItems.length === 0) continue;

      const totalScore = ratedItems.reduce((sum, i) => sum + (RATING_LEVELS.find(r => r.value === i.rating)?.score || 0), 0);
      const avg = totalScore / ratedItems.length;

      const dist = { malo: 0, regular: 0, bueno: 0, excelente: 0 };
      ratedItems.forEach(i => { if (dist[i.rating] !== undefined) dist[i.rating]++; });

      results.push({
        eventId: evtId,
        eventName: ev.eventName || ev.client || ev.name || 'Evento',
        date,
        salon: ev.salon || '',
        status: ev.status || '',
        avg,
        total: ratedItems.length,
        notApplicableCount,
        unratedCount,
        distribution: dist,
        items: ratedItems.map(i => ({
          text: i.text,
          sectionName: i.sectionName,
          rating: i.rating,
          score: RATING_LEVELS.find(r => r.value === i.rating)?.score || 0,
        })),
      });
    }

    results.sort((a, b) => b.date.localeCompare(a.date));
    return results;
  }, [checklists, events, fromDate, toDate, loading]);

  // ── Aggregate metrics ──
  const metrics = useMemo(() => {
    if (!satisfactionData || satisfactionData.length === 0) return null;

    const totalRatings = satisfactionData.reduce((sum, ev) => sum + ev.total, 0);
    const allScores = satisfactionData.flatMap(ev => ev.items.map(i => i.score));
    const globalAvg = totalRatings > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

    const totalDist = { malo: 0, regular: 0, bueno: 0, excelente: 0 };
    satisfactionData.forEach(ev => {
      Object.entries(ev.distribution).forEach(([k, v]) => { totalDist[k] += v; });
    });

    const eventsWithRating = satisfactionData.length;
    const recentAvg = satisfactionData.slice(0, 10).reduce((sum, ev) => sum + ev.avg, 0) / Math.min(10, satisfactionData.length);

    return {
      totalEvents: eventsWithRating,
      totalRatings,
      globalAvg,
      recentAvg,
      totalDist,
      excellentPct: totalRatings > 0 ? (totalDist.excelente / totalRatings) * 100 : 0,
      goodPct: totalRatings > 0 ? (totalDist.bueno / totalRatings) * 100 : 0,
      regularPct: totalRatings > 0 ? (totalDist.regular / totalRatings) * 100 : 0,
      badPct: totalRatings > 0 ? (totalDist.malo / totalRatings) * 100 : 0,
    };
  }, [satisfactionData]);

  // ── Trends by month ──
  const monthlyTrend = useMemo(() => {
    if (!satisfactionData) return [];
    const byMonth = {};
    satisfactionData.forEach(ev => {
      const mk = ev.date.substring(0, 7);
      if (!byMonth[mk]) byMonth[mk] = { scores: [], count: 0, events: 0 };
      byMonth[mk].scores.push(ev.avg);
      byMonth[mk].count += ev.total;
      byMonth[mk].events++;
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        avg: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        total: data.count,
        events: data.events,
      }));
  }, [satisfactionData]);

  const handleReset = () => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    setFromDate(d.toISOString().split('T')[0]);
    setToDate(new Date().toISOString().split('T')[0]);
    setViewTab('general');
  };

  if (loading) {
    return (
      <div className="reports-page-container">
        <div className="reports-page-header">
          <div className="reports-brand-header">
            <div className="reports-brand-badge">
              <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
            </div>
            <div>
              <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
              <div className="reports-title">Satisfacción del Cliente</div>
              <div className="reports-subtitle">Cargando datos de evaluación...</div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={onClose}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        </div>
        <div className="reports-page-body" style={{ alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
          <div style={{ fontSize: '14px', color: '#94a3b8' }}>⏳ Cargando...</div>
        </div>
      </div>
    );
  }

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
            <div className="reports-title">⭐ Satisfacción del Cliente</div>
            <div className="reports-subtitle">Evaluación de servicio por evento con ratings Malo / Regular / Bueno / Excelente</div>
          </div>
        </div>
        <ReportInfo reportKey="satisfaccion" />
        <button className="btn-exit" type="button" onClick={onClose}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver
        </button>
      </div>

      <div className="reports-page-body">
        {/* ── Filters ── */}
        <section className="reports-hero-panel">
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Filtros de periodo</span>
              <h3 className="reports-section-title">Análisis de satisfacción</h3>
              <p className="reports-section-text">Evalúa la percepción del cliente sobre el servicio recibido en cada evento.</p>
            </div>
          </div>
          <div className="reports-toolbar" style={{ gap: '16px', padding: '16px 20px' }}>
            <label className="field" style={{ flex: '0 0 148px', maxWidth: '148px' }}>
              <span>Desde</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '0 0 148px', maxWidth: '148px' }}>
              <span>Hasta</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </label>
            <div className="reports-actions" style={{ marginLeft: '0' }}>
              <button type="button" onClick={handleReset}>Últimos 3 meses</button>
            </div>
          </div>
        </section>

        {/* ── No data ── */}
        {(!satisfactionData || satisfactionData.length === 0) ? (
          <div className="reports-hero-panel" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', border: '1px dashed #e2e8f0', borderRadius: '16px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
            <p>No hay evaluaciones de satisfacción en el periodo seleccionado.</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Crea secciones de tipo "Evaluación" en las plantillas de checklist y asígnalas a eventos para ver los resultados aquí.</p>
          </div>
        ) : (
          <>
            {/* ── Hero KPI Cards (4 columnas) ── */}
            <section className="reports-hero-panel" style={{ gap: '12px' }}>
              <div className="reports-section-intro">
                <div>
                  <span className="reports-eyebrow">Resumen general</span>
                  <h3 className="reports-section-title">KPIs de satisfacción</h3>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                {/* Calificación global */}
                <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: getRatingColor(metrics.globalAvg), gridColumn: 'span 2', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: '-10px', top: '-10px', fontSize: '90px', opacity: 0.08 }}>{getRatingEmoji(metrics.globalAvg)}</div>
                  <span className="reports-eyebrow">Calificación global</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '4px' }}>
                    <strong style={{ fontSize: '2.4rem', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
                      {metrics.globalAvg.toFixed(1)}
                    </strong>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: getRatingColor(metrics.globalAvg) }}>
                      / 10.0
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '20px' }}>{getRatingEmoji(metrics.globalAvg)}</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: getRatingColor(metrics.globalAvg), textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {getRatingLabel(metrics.globalAvg)}
                    </span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden', marginTop: '8px' }}>
                    <div style={{ height: '100%', borderRadius: '999px', background: `linear-gradient(90deg, ${getRatingColor(metrics.globalAvg)}, ${getRatingColor(metrics.globalAvg)}cc)`, width: `${(metrics.globalAvg / 10) * 100}%`, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                    Basado en <strong>{metrics.totalRatings}</strong> calificaciones de <strong>{metrics.totalEvents}</strong> eventos
                  </div>
                </div>

                {/* Eventos evaluados */}
                <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#6366f1', gap: '4px' }}>
                  <span className="reports-eyebrow">Eventos evaluados</span>
                  <strong style={{ fontSize: '2rem', fontWeight: '900', color: '#0f172a', lineHeight: 1, marginTop: '4px' }}>{metrics.totalEvents}</strong>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>en el periodo</span>
                </div>

                {/* Tendencia reciente */}
                <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#3b82f6', gap: '4px' }}>
                  <span className="reports-eyebrow">Prom. últimos 10</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                    <strong style={{ fontSize: '2rem', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>{metrics.recentAvg.toFixed(1)}</strong>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: metrics.recentAvg >= metrics.globalAvg ? '#16a34a' : '#dc2626' }}>
                      {metrics.recentAvg >= metrics.globalAvg ? '↑' : '↓'}
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>vs global {metrics.globalAvg.toFixed(1)}</span>
                </div>
              </div>
            </section>

            {/* ── Distribution (donut) + Monthly Trend (line chart) ── */}
            <section className="reports-hero-panel" style={{ gap: '12px' }}>
              <div className="reports-section-intro">
                <div>
                  <span className="reports-eyebrow">Distribución y tendencia</span>
                  <h3 className="reports-section-title">Calificaciones y evolución</h3>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: '14px' }}>
                {/* Donut de distribución */}
                <div className="bento-tile" style={{ padding: '20px', gap: '16px' }}>
                  <div>
                    <div className="reports-eyebrow">Proporción de ratings</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>{metrics.totalRatings} calificaciones en total</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    <DonutChart dist={metrics.totalDist} total={metrics.totalRatings} />
                    <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {RATING_LEVELS.map(r => {
                        const count = metrics.totalDist[r.value] || 0;
                        const pct = metrics.totalRatings > 0 ? (count / metrics.totalRatings) * 100 : 0;
                        return (
                          <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: r.color, flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: r.color, flex: 1 }}>{r.emoji} {r.label}</span>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{count}</span>
                            <span style={{ fontSize: '11px', color: '#94a3b8', minWidth: '38px', textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Tendencia mensual (line chart) */}
                <div className="bento-tile" style={{ padding: '20px', gap: '12px' }}>
                  <div>
                    <div className="reports-eyebrow">Tendencia mensual</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>Evolución del promedio por mes</div>
                  </div>
                  <TrendChart data={monthlyTrend} />
                </div>
              </div>
            </section>

            {/* ── Per-event detail ── */}
            <section className="reports-hero-panel" style={{ gap: '12px' }}>
              <div className="reports-section-intro">
                <div>
                  <span className="reports-eyebrow">Detalle</span>
                  <h3 className="reports-section-title">Puntos evaluados por evento</h3>
                </div>
              </div>
              <div className="reports-table-wrap">
                <table className="reports-table" style={{ minWidth: '700px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '36px' }}>#</th>
                      <th>Evento</th>
                      <th>Salón</th>
                      <th style={{ textAlign: 'center' }}>Promedio</th>
                      <th style={{ textAlign: 'center' }}>Calificación</th>
                      <th style={{ textAlign: 'center', width: '180px' }}>Distribución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {satisfactionData.map((ev, idx) => (
                      <tr key={ev.eventId}>
                        <td style={{ color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                        <td>
                          <strong style={{ color: '#0f172a' }}>{ev.eventName}</strong>
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>{ev.date} {ev.salon ? `· ${ev.salon}` : ''}</div>
                        </td>
                        <td style={{ color: '#475569' }}>{ev.salon || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: getRatingColor(ev.avg) }}>
                            {ev.avg.toFixed(1)}
                          </span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}> / 10.0</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '20px' }}>{getRatingEmoji(ev.avg)}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                            {RATING_LEVELS.map(r => {
                              const cnt = ev.distribution[r.value] || 0;
                              if (cnt === 0) return null;
                              return (
                                <span key={r.value} style={{
                                  padding: '2px 6px', borderRadius: '4px',
                                  background: r.bg, color: r.color,
                                  fontSize: '10px', fontWeight: 700,
                                }}>
                                  {r.emoji} {cnt}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Storytelling ── */}
            <div className="reports-storytelling-card">
              <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Narración de satisfacción</span>
              <p className="reports-story-text">
                En el periodo analizado, se evaluaron <strong className="highlight-blue">{metrics.totalEvents} eventos</strong> con un total de <strong className="highlight-blue">{metrics.totalRatings} puntos</strong> calificados.
                La satisfacción global promedio es de <strong className="highlight-green">{metrics.globalAvg.toFixed(1)} / 10.0</strong>, lo que corresponde a un nivel <strong className={metrics.globalAvg >= 8.75 ? 'highlight-green' : metrics.globalAvg >= 6.25 ? 'highlight-orange' : 'highlight-slate'}>{getRatingLabel(metrics.globalAvg)}</strong>.
                El <strong className="highlight-green">{metrics.excellentPct.toFixed(0)}%</strong> de las calificaciones fueron <strong className="highlight-green">Excelente 💎</strong>, mientras que el <strong className={metrics.badPct > 0 ? 'highlight-orange' : 'highlight-slate'}>{metrics.badPct.toFixed(0)}%</strong> fueron <strong className={metrics.badPct > 0 ? 'highlight-orange' : 'highlight-slate'}>Malo 🔴</strong>.
                {monthlyTrend.length >= 2 && (
                  <> La tendencia mensual muestra {monthlyTrend[monthlyTrend.length - 1].avg >= monthlyTrend[0].avg ? 'una mejora' : 'una disminución'} en el último periodo evaluado.</>
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Donut Chart (SVG) ───
function DonutChart({ dist, total }) {
  const size = 160;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const order = ['excelente', 'bueno', 'regular', 'malo'];
  const levels = order.map(v => RATING_LEVELS.find(r => r.value === v));

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      </svg>
    );
  }

  let offset = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {levels.map(lv => {
          const cnt = dist[lv.value] || 0;
          if (cnt === 0) return null;
          const len = (cnt / total) * circumference;
          const seg = (
            <circle
              key={lv.value}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={lv.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${circumference - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return seg;
        })}
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</span>
        <span style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{total}</span>
        <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>calificaciones</span>
      </div>
    </div>
  );
}

// ─── Line / Area Chart (SVG) ───
function TrendChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ padding: '20px', color: '#94a3b8', fontWeight: 700, textAlign: 'center' }}>Sin datos para graficar.</div>;
  }

  const W = 560;
  const H = 200;
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const yMax = 10;
  const yMin = 0;
  const points = data.map((d, i) => {
    const x = data.length === 1 ? padL + innerW / 2 : padL + (i / (data.length - 1)) * innerW;
    const y = padT + (1 - (d.avg - yMin) / (yMax - yMin)) * innerH;
    return { x, y, d };
  });

  // Smooth path with Catmull-Rom-ish line
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)} ${padT + innerH} L${points[0].x.toFixed(1)} ${padT + innerH} Z`;

  const lastAvg = data[data.length - 1]?.avg || 0;
  const lineColor = getRatingColor(lastAvg);

  // Y axis labels (0, 5, 10)
  const yLabels = [0, 5, 10];

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines + Y labels */}
        {yLabels.map(v => {
          const y = padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;
          return (
            <g key={v}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" strokeDasharray="3 4" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fontWeight="700" fill="#94a3b8">{v}</text>
            </g>
          );
        })}

        {/* Area */}
        <path d={areaPath} fill="url(#trendFill)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke={lineColor} strokeWidth="2.5" />
            <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f172a">{p.d.avg.toFixed(1)}</text>
          </g>
        ))}

        {/* X labels */}
        {points.map((p, i) => (
          <text key={`x${i}`} x={p.x} y={H - padB + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#64748b">
            {fmtMonth(p.d.month)}
          </text>
        ))}
      </svg>
    </div>
  );
}
