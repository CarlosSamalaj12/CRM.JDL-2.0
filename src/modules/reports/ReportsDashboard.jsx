import { useState, useMemo, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

const STATUS = { CONFIRMADO: 'Confirmado', PRERESERVA: 'Pre reserva' };
const USER_ROLES = { SELLER: 'vendedor', RECEPTIONIST: 'recepcionista' };
const isGoalStatus = (s) => s === STATUS.CONFIRMADO || s === STATUS.PRERESERVA;

const SAT_RATING_LEVELS = [
  { value: 'malo', label: 'Malo', score: 1, color: '#ef4444', bg: '#fef2f2' },
  { value: 'regular', label: 'Regular', score: 2, color: '#eab308', bg: '#fffbeb' },
  { value: 'bueno', label: 'Bueno', score: 3, color: '#22c55e', bg: '#f0fdf4' },
  { value: 'excelente', label: 'Excelente', score: 4, color: '#a855f7', bg: '#faf5ff' },
];

function getSatColor(avg) {
  if (avg >= 3.5) return '#22c55e';
  if (avg >= 2.5) return '#eab308';
  if (avg >= 1.5) return '#f97316';
  return '#ef4444';
}

function getSatLabel(avg) {
  if (avg >= 3.5) return 'Excelente';
  if (avg >= 2.5) return 'Bueno';
  if (avg >= 1.5) return 'Regular';
  return 'Malo';
}

export default function ReportsDashboard({ onClose }) {
  const { events, users } = useOutletContext();
  const [monthKey, setMonthKey] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; });
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [role, setRole] = useState(USER_ROLES.SELLER);
  const [scope, setScope] = useState('all');
  const [selectedSellerId, setSelectedSellerId] = useState('');

  // ── Satisfaction data ──
  const [checklists, setChecklists] = useState({});
  const [satLoading, setSatLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { loadState } = await import('../../services/stateService');
        const state = await loadState({ cacheBust: true });
        setChecklists((state.eventChecklists && typeof state.eventChecklists === 'object') ? state.eventChecklists : {});
      } catch (err) { console.error(err); }
      finally { setSatLoading(false); }
    })();
  }, []);

  const formatMoneyGT = (v) => 'Q ' + Number(v||0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const getMonthName = (m) => ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m-1] || '';
  const getRoleLabel = (r) => r === USER_ROLES.SELLER ? 'Vendedor' : 'Recepcionista';

  const getDateRange = useCallback(() => {
    if (!fromDate || !toDate) { const [y,m] = monthKey.split('-'); const s = new Date(parseInt(y), parseInt(m)-1, 1); const e = new Date(parseInt(y), parseInt(m), 0); return { from: s.toISOString().split('T')[0], to: e.toISOString().split('T')[0], label: `${getMonthName(parseInt(m))} de ${monthKey.split('-')[0]}` }; }
    return { from: fromDate, to: toDate, label: `${fromDate} - ${toDate}` };
  }, [monthKey, fromDate, toDate]);

  const filteredUsers = useMemo(() => (users||[]).filter(u => String(u.role||'').toLowerCase() === (role === USER_ROLES.SELLER ? 'vendedor' : 'recepcionista')), [users, role]);

  const dashboardRows = useMemo(() => {
    if (!events) return [];
    const { from, to } = getDateRange();
    const rows = []; const groups = new Map();
    for (const ev of events) { const key = `${ev.date}|${ev.salon||''}|${ev.id}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(ev); }
    for (const [, series] of groups.entries()) {
      if (!series.some(ev => { const d = ev.date; return d >= from && d <= to; })) continue;
      const head = series[0];
      rows.push({ userId: String(head.userId||''), status: head.status, eventDate: head.date, salon: head.salon||'', total: Math.max(0, head.quote?.total||0), type: (head.quote?.eventType||head.name||'').toLowerCase().includes('corporativo') ? 'corp' : (head.quote?.eventType||head.name||'').toLowerCase().includes('social') ? 'social' : 'otro', monthKey: head.date?.substring(0,7) });
    }
    return rows;
  }, [events, getDateRange]);

  const filteredRows = useMemo(() => dashboardRows.filter(r => { if (scope === 'seller' && selectedSellerId && r.userId !== selectedSellerId) return false; return true; }), [dashboardRows, scope, selectedSellerId]);

  const statusMeta = () => [ { k: STATUS.CONFIRMADO, l: 'Confirmado', c: '#10c972' }, { k: 'Pre reserva', l: 'Pre-reserva', c: '#d07db8' }, { k: 'Seguimiento', l: 'Negociacion', c: '#ff6b3a' }, { k: 'Perdido', l: 'Perdido', c: '#7c5cff' }, { k: 'Cancelado', l: 'Cancelado', c: '#e42a48' }, { k: 'Reserva sin Cotizacion', l: 'Reserva sin cotizacion', c: '#0ea5e9' } ];

  const statusSummary = useMemo(() => {
    const meta = statusMeta(); const cnt = {}; meta.forEach(m => cnt[m.k] = 0);
    filteredRows.forEach(r => { if (cnt[r.status] !== undefined) cnt[r.status]++; });
    const total = Object.values(cnt).reduce((a,b) => a+b, 0);
    const confirmed = cnt[STATUS.CONFIRMADO]||0;
    return { total, confirmed, pct: total ? (confirmed/total)*100 : 0, seg: meta.map(m => ({...m, count: cnt[m.k]||0, pct: total ? ((cnt[m.k]||0)/total)*100 : 0})) };
  }, [filteredRows]);

  const globalGoal = useMemo(() => { const y = monthKey.substring(0,4); let g=0; (users||[]).forEach(u => { if (!u.salesTargetEnabled || !u.monthlyGoals) return; u.monthlyGoals.forEach(m => { if (m.month?.startsWith(y) && m.month === monthKey) g += Number(m.amount||0); }); }); return g; }, [users, monthKey]);
  const globalAchieved = useMemo(() => filteredRows.filter(r => isGoalStatus(r.status)).reduce((a,r) => a+r.total, 0), [filteredRows]);
  const focusedUser = scope === 'seller' && selectedSellerId ? users?.find(u => u.id === selectedSellerId) : null;
  const personalGoal = focusedUser?.monthlyGoals ? (focusedUser.monthlyGoals.find(g => g.month === monthKey)?.amount||0) : 0;
  const personalAchieved = focusedUser ? filteredRows.filter(r => r.userId === focusedUser.id && isGoalStatus(r.status)).reduce((a,r) => a+r.total, 0) : 0;
  const gProg = globalGoal ? (globalAchieved/globalGoal)*100 : 0;
  const pProg = personalGoal ? (personalAchieved/personalGoal)*100 : 0;

  const salonData = useMemo(() => {
    const c = {};
    filteredRows.forEach(r => { const s = r.salon || '(sin salon)'; c[s] = (c[s]||0)+1; });
    const p = ['#5b95f0','#facc15','#9b5de5','#e92f55','#10c972'];
    const o = Object.entries(c).sort((a,b) => b[1]-a[1]).map(([l,n],i) => ({l, n, c: p[i%p.length]})).slice(0,6);
    const tot = o.reduce((a,b) => a+b.n, 0);
    if (!tot) return null;
    let cur = 0; const slices = o.map(it => { const pct = (it.n/tot)*100; const nxt = cur+pct; const s = `${it.c} ${cur.toFixed(0)}% ${nxt.toFixed(0)}%`; cur = nxt; return s; });
    return { slices, o, tot };
  }, [filteredRows]);

  const sellerMetrics = useMemo(() => {
    return filteredUsers.filter(u => !scope || scope==='all' || u.id === selectedSellerId).map(s => {
      const sr = filteredRows.filter(r => r.userId === s.id);
      const cr = sr.filter(r => r.status === STATUS.CONFIRMADO);
      return { id: s.id, name: s.fullName||s.name||getRoleLabel(role), total: sr.length, confirmed: cr.length, amount: cr.reduce((a,b) => a+b.total, 0) };
    }).sort((a,b) => b.amount - a.amount);
  }, [filteredUsers, filteredRows, scope, selectedSellerId, role]);
  const maxAmt = Math.max(1, ...sellerMetrics.map(s => s.amount));

  const eventTypeData = useMemo(() => {
    const labels = { corp: 'Corporativo', social: 'Social', otro: 'Otro' };
    const colors = { corp: '#2563eb', social: '#10c972', otro: '#f59e0b' };
    const totals = { corp: { count: 0, amount: 0 }, social: { count: 0, amount: 0 }, otro: { count: 0, amount: 0 } };
    filteredRows.forEach((row) => {
      const key = totals[row.type] ? row.type : 'otro';
      totals[key].count += 1;
      totals[key].amount += Number(row.total || 0);
    });
    const max = Math.max(1, ...Object.values(totals).map((item) => item.amount));
    return Object.entries(totals).map(([key, item]) => ({
      key, label: labels[key], color: colors[key], count: item.count, amount: item.amount, pct: (item.amount / max) * 100
    }));
  }, [filteredRows]);

  // ── Satisfaction metrics ──
  const satisfactionData = useMemo(() => {
    if (satLoading || !events) return null;
    const { from, to } = getDateRange();
    const results = [];
    for (const [evtId, chk] of Object.entries(checklists)) {
      const ev = Array.isArray(events) ? events.find(e => String(e.id) === evtId) : null;
      if (!ev) continue;
      const date = ev.date || ev.eventDate || '';
      if (date < from || date > to) continue;
      const items = Array.isArray(chk.items) ? chk.items : [];
      const evalItems = items.filter(i => i.sectionType === 'evaluacion');
      const ratedItems = evalItems.filter(i => i.rating !== null && i.rating !== undefined);
      if (ratedItems.length === 0) continue;
      const totalScore = ratedItems.reduce((sum, i) => sum + (SAT_RATING_LEVELS.find(r => r.value === i.rating)?.score || 0), 0);
      const avg = totalScore / ratedItems.length;
      const dist = { malo: 0, regular: 0, bueno: 0, excelente: 0 };
      ratedItems.forEach(i => { if (dist[i.rating] !== undefined) dist[i.rating]++; });
      results.push({ eventId: evtId, avg, total: ratedItems.length, distribution: dist, items: ratedItems.map(i => ({ rating: i.rating, score: SAT_RATING_LEVELS.find(r => r.value === i.rating)?.score || 0 })) });
    }
    return results;
  }, [checklists, events, getDateRange, satLoading]);

  const satMetrics = useMemo(() => {
    if (!satisfactionData || satisfactionData.length === 0) return null;
    const totalRatings = satisfactionData.reduce((sum, ev) => sum + ev.total, 0);
    const allScores = satisfactionData.flatMap(ev => ev.items.map(i => i.score));
    const globalAvg = totalRatings > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
    const totalDist = { malo: 0, regular: 0, bueno: 0, excelente: 0 };
    satisfactionData.forEach(ev => { Object.entries(ev.distribution).forEach(([k, v]) => { totalDist[k] += v; }); });
    return { totalEvents: satisfactionData.length, totalRatings, globalAvg, totalDist };
  }, [satisfactionData]);

  const handleReset = () => { const n = new Date(); setMonthKey(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`); setFromDate(''); setToDate(''); setRole(USER_ROLES.SELLER); setScope('all'); setSelectedSellerId(''); };

  const visSeg = statusSummary.seg.filter(s => s.count > 0);
  const dateRange = getDateRange();

  const kpiGradient = (accent) => {
    if (accent === '#16a34a') return 'linear-gradient(135deg, #f0fdf4, #ecfdf5)';
    if (accent === '#e11d48') return 'linear-gradient(135deg, #fef2f2, #fff1f2)';
    if (accent === '#f59e0b') return 'linear-gradient(135deg, #fffbeb, #fef3c7)';
    return 'linear-gradient(135deg, #eff6ff, #f8fafc)';
  };

  // ── Bento KPI cards data ──
  const kpiCards = [
    {
      label: `Meta ${getRoleLabel(role)}`, value: formatMoneyGT(globalGoal),
      trend: `${gProg.toFixed(1)}%`, trendColor: gProg>=100 ? '#15803d' : gProg>=80 ? '#b45309' : '#1d4ed8',
      trendBg: gProg>=100 ? '#dcfce7' : gProg>=80 ? '#fef3c7' : '#eff6ff',
      accent: gProg>=100 ? '#16a34a' : gProg>=80 ? '#f59e0b' : '#2563eb',
    },
    {
      label: 'Pendiente Rol', value: formatMoneyGT(Math.max(0,globalGoal-globalAchieved)),
      trend: globalAchieved >= globalGoal ? 'Superada' : '',
      accent: globalAchieved >= globalGoal ? '#16a34a' : '#e11d48',
    },
    {
      label: 'Meta Personal', value: formatMoneyGT(personalGoal),
      trend: `${pProg.toFixed(1)}%`, trendColor: pProg>=100 ? '#15803d' : pProg>=80 ? '#b45309' : '#1d4ed8',
      trendBg: pProg>=100 ? '#dcfce7' : pProg>=80 ? '#fef3c7' : '#eff6ff',
      accent: pProg>=100 ? '#16a34a' : pProg>=80 ? '#f59e0b' : '#2563eb',
      subtitle: focusedUser?.fullName || getRoleLabel(role),
    },
    {
      label: 'Pendiente Personal', value: formatMoneyGT(Math.max(0,personalGoal-personalAchieved)),
      trend: personalAchieved >= personalGoal ? 'Superada' : '',
      accent: personalAchieved >= personalGoal ? '#16a34a' : '#e11d48',
      subtitle: focusedUser?.fullName || getRoleLabel(role),
    },
  ];

  // ── Color utility for progress bars ──
  const progColor = (pct) => pct >= 100 ? '#16a34a' : pct >= 80 ? '#f59e0b' : '#3b82f6';

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
            <div className="reports-title">Dashboard Ejecutivo</div>
            <div className="reports-subtitle">Metas comerciales, rendimiento y analítica del periodo</div>
          </div>
        </div>
        <button className="btn-exit" type="button" onClick={onClose}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver
        </button>
      </div>

      <div className="reports-page-body">
        {/* ── 1. Filtros ── */}
        <section className="reports-hero-panel">
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Control gerencial</span>
              <h3 className="reports-section-title">Metas, comparativos y rendimiento</h3>
              <p className="reports-section-text">Filtra por mes, rol y vendedor para ver el desempeño del periodo.</p>
            </div>
          </div>

          <div className="reports-toolbar" style={{ gap: '16px', padding: '16px 20px' }}>
            <label className="field" style={{ flex: '0 0 172px', maxWidth: '172px' }}>
              <span>Mes base</span>
              <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '0 0 148px', maxWidth: '148px' }}>
              <span>Desde</span>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '0 0 148px', maxWidth: '148px' }}>
              <span>Hasta</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '0 0 126px', maxWidth: '136px' }}>
              <span>Rol</span>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="vendedor">Vendedor</option>
                <option value="recepcionista">Recepcionista</option>
              </select>
            </label>
            <label className="field" style={{ flex: '0 0 144px', maxWidth: '154px' }}>
              <span>Vista</span>
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="all">Todos los usuarios</option>
                <option value="seller">Usuario específico</option>
              </select>
            </label>
            {scope === 'seller' && (
              <label className="field" style={{ flex: '0 0 164px', maxWidth: '174px' }}>
                <span>Usuario</span>
                <select value={selectedSellerId} onChange={(e) => setSelectedSellerId(e.target.value)}>
                  <option value="">Selecciona vendedor</option>
                  {filteredUsers.map(u => <option key={u.id} value={u.id}>{u.fullName||u.name}</option>)}
                </select>
              </label>
            )}
            <div className="reports-actions" style={{ marginLeft: '0' }}>
              <button type="button" onClick={handleReset}>Limpiar filtros</button>
            </div>
          </div>
        </section>

        {/* ── 2. Hero Bar: Eficiencia + Estado general ── */}
        <section className="reports-hero-panel" style={{ gap: '12px' }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Rendimiento del periodo</span>
              <h3 className="reports-section-title">{dateRange.label}</h3>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Hero card: Eficiencia premium */}
            <div className="bento-tile" style={{
              gridColumn: 'span 2', border: 'none',
              background: 'linear-gradient(135deg, #f8fafc, #eff6ff)',
              borderLeft: '4px solid #2563eb',
              boxShadow: '0 1px 3px rgba(37,99,235,0.12), 0 4px 12px rgba(37,99,235,0.06)',
              transition: 'all 0.25s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.18), 0 8px 24px rgba(37,99,235,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(37,99,235,0.12), 0 4px 12px rgba(37,99,235,0.06)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '3px', background: '#2563eb', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 0 2px rgba(37,99,235,0.2)' }} />
                    <span className="reports-eyebrow">Eficiencia ({getRoleLabel(role)})</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{dateRange.label}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Confirmado</div>
                  <strong style={{ fontSize: '28px', fontWeight: '900', display: 'block', lineHeight: 1, color: '#0f172a', letterSpacing: '-0.03em' }}>{statusSummary.pct.toFixed(1)}%</strong>
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>
                    {statusSummary.total} eventos · {statusSummary.confirmed} conf.
                  </div>
                </div>
              </div>
              {/* Barra de estados premium */}
              <div style={{
                height: '10px', borderRadius: '999px', background: '#e2e8f0', display: 'flex',
                gap: '3px', margin: '12px 0 8px', overflow: 'hidden',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
              }}>
                {visSeg.slice(0,5).map((s,i) => (
                  <div key={i} style={{
                    height: '100%', width: `${Math.max(3,s.pct)}%`, background: s.c,
                    borderRadius: '4px', transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
                    boxShadow: s.pct > 0 ? 'inset 0 1px 0 rgba(255,255,255,0.3)' : 'none',
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '10px', color: '#64748b' }}>
                {visSeg.slice(0,5).map((s,i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, background: '#ffffff80', padding: '2px 8px', borderRadius: '999px', backdropFilter: 'blur(4px)' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.c, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 0 2px ${s.c}20` }} />
                    {s.l.substring(0,12)} <strong style={{ color: '#0f172a' }}>{s.pct.toFixed(0)}%</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* KPI Cards premium */}
            {kpiCards.map((kpi, i) => (
              <div
                key={i}
                className="bento-tile reports-kpi-tile"
                style={{
                  border: 'none',
                  background: kpiGradient(kpi.accent),
                  borderLeft: `4px solid ${kpi.accent}`,
                  boxShadow: `0 1px 3px ${kpi.accent}15, 0 4px 12px ${kpi.accent}08`,
                  transition: 'all 0.25s ease',
                  cursor: 'default',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${kpi.accent}20, 0 8px 24px ${kpi.accent}10`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 1px 3px ${kpi.accent}15, 0 4px 12px ${kpi.accent}08`; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '3px', background: kpi.accent, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 0 2px ${kpi.accent}20` }} />
                    <span className="reports-eyebrow" style={{ fontSize: '10px' }}>{kpi.label}</span>
                  </div>
                  {kpi.subtitle && (
                    <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, textAlign: 'right', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {kpi.subtitle}
                    </span>
                  )}
                </div>
                <strong style={{
                  fontSize: '1.55rem', fontWeight: '900', color: '#0f172a', lineHeight: '1.1',
                  letterSpacing: '-0.03em', display: 'block', marginBottom: '4px',
                }}>
                  {kpi.value}
                </strong>
                {kpi.trend && (
                  <span style={{
                    fontSize: '10px', fontWeight: '800', padding: '3px 10px', borderRadius: '999px',
                    background: kpi.trendBg || '#f1f5f9', color: kpi.trendColor || '#475569',
                    width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: '4px',
                    boxShadow: `inset 0 1px 2px rgba(0,0,0,0.04)`,
                  }}>
                    <span style={{ fontSize: '10px' }}>{kpi.accent === '#16a34a' ? '↑' : kpi.accent === '#e11d48' ? '↓' : '→'}</span>
                    {kpi.trend}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── 3. Satisfacción premium ── */}
        {satMetrics && (
          <section className="reports-hero-panel" style={{ gap: '12px' }}>
            <div className="reports-section-intro">
              <div>
                <span className="reports-eyebrow">Satisfacción del Cliente</span>
                <h3 className="reports-section-title">Calificaciones de servicio</h3>
                <p className="reports-section-text">Ratings Malo / Regular / Bueno / Excelente en checklist de eventos.</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{
                gridColumn: 'span 2', border: 'none', borderRadius: '14px', padding: '20px',
                background: `linear-gradient(135deg, ${getSatColor(satMetrics.globalAvg)}06, #ffffff)`,
                borderLeft: `4px solid ${getSatColor(satMetrics.globalAvg)}`,
                boxShadow: `0 1px 3px ${getSatColor(satMetrics.globalAvg)}15, 0 4px 12px ${getSatColor(satMetrics.globalAvg)}08`,
                transition: 'all 0.25s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${getSatColor(satMetrics.globalAvg)}20, 0 8px 24px ${getSatColor(satMetrics.globalAvg)}10`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 1px 3px ${getSatColor(satMetrics.globalAvg)}15, 0 4px 12px ${getSatColor(satMetrics.globalAvg)}08`; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '3px', background: getSatColor(satMetrics.globalAvg), display: 'inline-block', flexShrink: 0, boxShadow: `0 0 0 2px ${getSatColor(satMetrics.globalAvg)}20` }} />
                    <span className="reports-eyebrow" style={{ fontSize: '10px' }}>Calificación global</span>
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: '800', padding: '3px 12px', borderRadius: '999px',
                    background: getSatColor(satMetrics.globalAvg) + '18',
                    color: getSatColor(satMetrics.globalAvg),
                    border: `1px solid ${getSatColor(satMetrics.globalAvg)}30`,
                  }}>
                    {getSatLabel(satMetrics.globalAvg)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '2.2rem', fontWeight: '900', color: '#0f172a', lineHeight: 1, letterSpacing: '-0.03em' }}>
                    {satMetrics.globalAvg.toFixed(1)}
                  </strong>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: getSatColor(satMetrics.globalAvg) }}>/ 4.0</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginLeft: '4px' }}>
                    · {satMetrics.totalRatings} calif. en {satMetrics.totalEvents} eventos
                  </span>
                </div>
                <div style={{ height: '10px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden', marginTop: '4px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}>
                  <div style={{ height: '100%', borderRadius: '999px', background: `linear-gradient(90deg, ${getSatColor(satMetrics.globalAvg)}, ${getSatColor(satMetrics.globalAvg)}cc)`, width: `${(satMetrics.globalAvg / 4) * 100}%`, transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)', boxShadow: `0 0 8px ${getSatColor(satMetrics.globalAvg)}40` }} />
                </div>

                {/* Distribution bar premium */}
                <div style={{ display: 'flex', height: '24px', borderRadius: '8px', overflow: 'hidden', marginTop: '14px', gap: '3px' }}>
                  {SAT_RATING_LEVELS.map(r => {
                    const cnt = satMetrics.totalDist[r.value] || 0;
                    const pct = satMetrics.totalRatings > 0 ? (cnt / satMetrics.totalRatings) * 100 : 0;
                    if (pct === 0) return null;
                    return (
                      <div key={r.value} style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(180deg, ${r.color}, ${r.color}dd)`, borderRadius: '5px', minWidth: '6px', transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)', position: 'relative', boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25)` }}>
                        <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,0.35)', letterSpacing: '0.02em' }}>
                          {pct > 10 ? `${r.label} ${pct.toFixed(0)}%` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '14px', marginTop: '10px', fontSize: '10px', flexWrap: 'wrap' }}>
                  {SAT_RATING_LEVELS.map(r => {
                    const cnt = satMetrics.totalDist[r.value] || 0;
                    const pct = satMetrics.totalRatings > 0 ? (cnt / satMetrics.totalRatings) * 100 : 0;
                    return (
                      <span key={r.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700, background: r.bg, padding: '3px 10px', borderRadius: '999px', border: `1px solid ${r.color}25` }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: r.color, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 0 2px ${r.color}20` }} />
                        {r.label}: <span style={{ color: '#0f172a', fontWeight: 800 }}>{cnt}</span> <span style={{ color: '#94a3b8', fontWeight: 600 }}>({pct.toFixed(0)}%)</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── 4. Storytelling ── */}
        <div className="reports-storytelling-card">
          <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Narración ejecutiva</span>
          <p className="reports-story-text">
            En el periodo <strong className="highlight-slate">{dateRange.label}</strong>, el equipo de {getRoleLabel(role).toLowerCase()}s gestionó <strong className="highlight-blue">{statusSummary.total}</strong> eventos con una tasa de confirmación del <strong className="highlight-green">{statusSummary.pct.toFixed(1)}%</strong>. 
            La meta global del rol es de <strong className="highlight-blue">{formatMoneyGT(globalGoal)}</strong> con un avance del <strong className="highlight-green">{gProg.toFixed(1)}%</strong>.
            {focusedUser ? ` El desempeño de ${focusedUser.fullName || ''} muestra ${personalAchieved >= personalGoal ? 'un cumplimiento sobresaliente de la meta personal.' : `un avance del ${pProg.toFixed(1)}% sobre su meta personal de ${formatMoneyGT(personalGoal)}.`}` : ''}
            {satMetrics && ` En satisfacción, la calificación global es de ${satMetrics.globalAvg.toFixed(1)} / 4.0 (${getSatLabel(satMetrics.globalAvg)}) con ${satMetrics.totalEvents} eventos evaluados.`}
          </p>
        </div>

        {/* ── 5. Charts Grid ── */}
        <section className="reports-hero-panel" style={{ gap: '12px' }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Analítica visual</span>
              <h3 className="reports-section-title">Comparativos y distribuciones del periodo</h3>
            </div>
          </div>

          <div className="reports-charts-grid">
            {/* Salones chart premium */}
            <div className="reports-chart-card" style={{ border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)', borderRadius: '14px' }}>
              <div className="reports-chart-title" style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Áreas más utilizadas</div>
              <div className="reports-chart-subtitle">Distribución de salones en el periodo</div>
              {salonData ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '16px' }}>
                  <div style={{
                    width: '100px', height: '100px', borderRadius: '50%', flexShrink: 0,
                    background: `conic-gradient(${salonData.slices.join(',')})`,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1), inset 0 2px 4px rgba(255,255,255,0.3)',
                    border: '2px solid #fff',
                  }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: '#64748b', flex: 1 }}>
                    {salonData.o.map((it,i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', borderRadius: '8px', background: '#f8fafc', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                      >
                        <span style={{ width: '10px', height: '10px', borderRadius: '4px', background: `linear-gradient(135deg, ${it.c}, ${it.c}aa)`, display: 'inline-block', flexShrink: 0 }} />
                        <strong style={{ color: '#1e293b', fontWeight: 700, fontSize: '12px' }}>{it.l.substring(0,18)}</strong>
                        <span style={{ marginLeft: 'auto', fontWeight: 800, color: '#0f172a' }}>{((it.n/salonData.tot)*100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', padding: '32px' }}>Sin salones con actividad</div>
              )}
            </div>

            {/* Event types chart premium */}
            <div className="reports-chart-card" style={{ border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)', borderRadius: '14px' }}>
              <div className="reports-chart-title" style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Ventas por tipo de evento</div>
              <div className="reports-chart-subtitle">Corporativo, Social y Otros</div>
              <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
                {eventTypeData.some(item => item.count > 0) ? eventTypeData.map(item => (
                  <div key={item.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '3px', background: item.color, display: 'inline-block' }} />
                        {item.label} <span style={{ color: '#94a3b8', fontWeight: 600 }}>({item.count})</span>
                      </span>
                      <span style={{ color: '#0f172a', fontWeight: 800 }}>{formatMoneyGT(item.amount)}</span>
                    </div>
                    <div style={{ height: '12px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}>
                      <div style={{
                        width: `${Math.max(4, item.pct)}%`, height: '100%',
                        background: `linear-gradient(90deg, ${item.color}, ${item.color}cc)`,
                        borderRadius: '999px', transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
                        boxShadow: `0 0 6px ${item.color}30`,
                      }} />
                    </div>
                  </div>
                )) : (
                  <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', padding: '32px' }}>Sin ventas por tipo en el periodo</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. Seller Cards ── */}
        <section className="reports-hero-panel" style={{ gap: '12px' }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Equipo</span>
              <h3 className="reports-section-title">Rendimiento individual</h3>
            </div>
          </div>

          <div className="reports-seller-grid">
            {sellerMetrics.length ? sellerMetrics.map((s, idx) => {
              const colors = [['#2563eb','#60a5fa'], ['#7c3aed','#a78bfa'], ['#059669','#34d399'], ['#d97706','#fbbf24'], ['#dc2626','#f87171']];
              const [c1, c2] = colors[idx % colors.length];
              const pct = maxAmt > 0 ? Math.max(8, (s.amount / maxAmt) * 80) : 8;
              return (
                <div key={s.id} className="reports-seller-card" style={{
                  position: 'relative', paddingTop: '20px', border: 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
                  borderRadius: '14px', transition: 'all 0.25s ease',
                  background: '#ffffff',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)'; }}
                >
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: `linear-gradient(135deg, ${c1}, ${c2})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '15px', fontWeight: '800', color: '#fff',
                    boxShadow: `0 4px 12px ${c1}30`,
                    marginBottom: '6px',
                  }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.02em' }}>{formatMoneyGT(s.amount)}</div>
                  <div style={{
                    width: '36px', height: '70px', borderRadius: '10px',
                    background: '#f1f5f9', display: 'flex', alignItems: 'flex-end',
                    overflow: 'hidden', margin: '6px 0', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
                  }}>
                    <div style={{
                      width: '100%',
                      height: `${pct}%`,
                      background: `linear-gradient(180deg, ${c2}, ${c1})`,
                      borderRadius: '0 0 8px 8px',
                      transition: 'height 0.5s cubic-bezier(0.22,1,0.36,1)',
                    }} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a', textAlign: 'center' }}>{s.name}</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center', fontWeight: 600 }}>
                    <span style={{ color: '#16a34a', fontWeight: 800 }}>{s.confirmed}</span> de {s.total} confirmados
                  </div>
                </div>
              );
            }) : (
              <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', gridColumn: '1/-1', padding: '40px' }}>
                No hay asesores comerciales con metas asignadas.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
