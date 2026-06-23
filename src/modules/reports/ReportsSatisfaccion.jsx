import { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { loadState } from '../../services/stateService';

const RATING_LEVELS = [
  { value: 'malo', label: 'Malo', emoji: '🔴', score: 1, color: '#ef4444', bg: '#fef2f2' },
  { value: 'regular', label: 'Regular', emoji: '🟡', score: 2, color: '#eab308', bg: '#fffbeb' },
  { value: 'bueno', label: 'Bueno', emoji: '🟢', score: 3, color: '#22c55e', bg: '#f0fdf4' },
  { value: 'excelente', label: 'Excelente', emoji: '💎', score: 4, color: '#a855f7', bg: '#faf5ff' },
];

const RATING_COLORS = {
  malo: '#ef4444', regular: '#eab308', bueno: '#22c55e', excelente: '#a855f7',
};

function getRatingColor(avg) {
  if (avg >= 3.5) return '#22c55e';
  if (avg >= 2.5) return '#eab308';
  if (avg >= 1.5) return '#f97316';
  return '#ef4444';
}

function getRatingEmoji(avg) {
  if (avg >= 3.5) return '😍';
  if (avg >= 2.5) return '😊';
  if (avg >= 1.5) return '😐';
  return '😟';
}

function getRatingLabel(avg) {
  if (avg >= 3.5) return 'Excelente';
  if (avg >= 2.5) return 'Bueno';
  if (avg >= 1.5) return 'Regular';
  return 'Malo';
}

export default function ReportsSatisfaccion({ onClose }) {
  const { events } = useOutletContext();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [viewTab, setViewTab] = useState('general');

  // ── Load satisfaction data via inline fetch ──
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
      const ratedItems = items.filter(i => i.rating !== null && i.rating !== undefined);

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

  const formatMoneyGT = (v) => 'Q ' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
              <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
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
            <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
            <div className="reports-title">⭐ Satisfacción del Cliente</div>
            <div className="reports-subtitle">Evaluación de servicio por evento con ratings Malo / Regular / Bueno / Excelente</div>
          </div>
        </div>
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
            {/* ── Hero KPI Cards ── */}
            <section className="reports-hero-panel" style={{ gap: '12px' }}>
              <div className="reports-section-intro">
                <div>
                  <span className="reports-eyebrow">Resumen general</span>
                  <h3 className="reports-section-title">KPIs de satisfacción</h3>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                {/* Global average */}
                <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: getRatingColor(metrics.globalAvg), gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="reports-eyebrow">Calificación global</span>
                    <span style={{ fontSize: '24px' }}>{getRatingEmoji(metrics.globalAvg)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <strong style={{ fontSize: '2.2rem', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
                      {metrics.globalAvg.toFixed(1)}
                    </strong>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: getRatingColor(metrics.globalAvg) }}>
                      / 4.0 — {getRatingLabel(metrics.globalAvg)}
                    </span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden', marginTop: '4px' }}>
                    <div style={{ height: '100%', borderRadius: '999px', background: getRatingColor(metrics.globalAvg), width: `${(metrics.globalAvg / 4) * 100}%`, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Basado en {metrics.totalRatings} calificaciones de {metrics.totalEvents} eventos
                  </div>
                </div>

                {/* Eventos evaluados */}
                <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#6366f1' }}>
                  <span className="reports-eyebrow">Eventos evaluados</span>
                  <strong style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>{metrics.totalEvents}</strong>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>en el periodo</span>
                </div>

                {/* Tendencia reciente */}
                <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#3b82f6' }}>
                  <span className="reports-eyebrow">Prom. últimos 10</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <strong style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>{metrics.recentAvg.toFixed(1)}</strong>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: metrics.recentAvg >= metrics.globalAvg ? '#16a34a' : '#dc2626' }}>
                      {metrics.recentAvg >= metrics.globalAvg ? '↑' : '↓'}
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>vs global {metrics.globalAvg.toFixed(1)}</span>
                </div>
              </div>
            </section>

            {/* ── Distribution Chart ── */}
            <section className="reports-hero-panel" style={{ gap: '12px' }}>
              <div className="reports-section-intro">
                <div>
                  <span className="reports-eyebrow">Distribución</span>
                  <h3 className="reports-section-title">Desglose de calificaciones</h3>
                </div>
              </div>
              <div className="reports-charts-grid">
                <div className="reports-chart-card">
                  <div className="reports-chart-title">Proporción de ratings</div>
                  <div className="reports-chart-subtitle">{metrics.totalRatings} calificaciones en total</div>
                  <div style={{ display: 'flex', height: '24px', borderRadius: '12px', overflow: 'hidden', margin: '16px 0', gap: '3px' }}>
                    {RATING_LEVELS.map(r => {
                      const pct = metrics.totalRatings > 0 ? (metrics.totalDist[r.value] / metrics.totalRatings) * 100 : 0;
                      if (pct === 0) return null;
                      return (
                        <div key={r.value} style={{
                          height: '100%', width: `${pct}%`, background: r.color,
                          borderRadius: '4px', transition: 'width 0.5s ease',
                          minWidth: pct > 0 ? '4px' : '0',
                        }} />
                      );
                    })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                    {RATING_LEVELS.map(r => {
                      const count = metrics.totalDist[r.value] || 0;
                      const pct = metrics.totalRatings > 0 ? (count / metrics.totalRatings) * 100 : 0;
                      return (
                        <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', background: r.bg }}>
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>{r.emoji}</span>
                          <span style={{ flex: 1, fontWeight: 700, color: r.color }}>{r.label}</span>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>{count}</span>
                          <span style={{ color: '#94a3b8' }}>({pct.toFixed(0)}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Monthly trend */}
                <div className="reports-chart-card">
                  <div className="reports-chart-title">Tendencia mensual</div>
                  <div className="reports-chart-subtitle">Evolución del promedio por mes</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', margin: '16px 0', padding: '0 8px' }}>
                    {monthlyTrend.map(m => {
                      const pct = (m.avg / 4) * 100;
                      return (
                        <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                          <div style={{
                            width: '100%', maxWidth: '40px',
                            height: `${Math.max(8, pct)}%`,
                            background: getRatingColor(m.avg),
                            borderRadius: '6px 6px 0 0',
                            transition: 'height 0.4s ease',
                            position: 'relative',
                          }}>
                            <span style={{
                              position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)',
                              fontSize: '9px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap',
                            }}>
                              {m.avg.toFixed(1)}
                            </span>
                          </div>
                          <span style={{ fontSize: '8px', fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap', transform: 'rotate(-45deg)', transformOrigin: 'left' }}>
                            {m.month.substring(5, 7)}/{m.month.substring(2, 4)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* ── Per-point analysis ── */}
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
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}> / 4.0</span>
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
                La satisfacción global promedio es de <strong className="highlight-green">{metrics.globalAvg.toFixed(1)} / 4.0</strong>, lo que corresponde a un nivel <strong className={metrics.globalAvg >= 3.5 ? 'highlight-green' : metrics.globalAvg >= 2.5 ? 'highlight-orange' : 'highlight-slate'}>{getRatingLabel(metrics.globalAvg)}</strong>.
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
