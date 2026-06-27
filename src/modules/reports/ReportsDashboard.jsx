import { useState, useMemo, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { loadState } from '../../services/stateService';

const STATUS = { CONFIRMADO: 'Confirmado', PRERESERVA: 'Pre reserva' };
const USER_ROLES = { SELLER: 'vendedor', RECEPTIONIST: 'recepcionista' };
const isGoalStatus = (s) => s === STATUS.CONFIRMADO || s === STATUS.PRERESERVA;

const SAT_RATING_LEVELS = [
  { value: 'malo', label: 'Malo', score: 1, color: '#ef4444', bg: '#fef2f2' },
  { value: 'regular', label: 'Regular', score: 2, color: '#eab308', bg: '#fffbeb' },
  { value: 'bueno', label: 'Bueno', score: 3, color: '#22c55e', bg: '#f0fdf4' },
  { value: 'excelente', label: 'Excelente', score: 4, color: '#a855f7', bg: '#faf5ff' },
];

const STATUS_META = [
  { key: 'Reserva sin Cotizacion', label: 'Reserva sin Cot.', color: '#00A3FF' },
  { key: '1er Cotizacion', label: '1ra Cotización', color: '#007A64' },
  { key: 'Seguimiento', label: 'Negociación', color: '#FF8C00' },
  { key: 'Lista de Espera', label: 'Lista Espera', color: '#FFD700' },
  { key: 'Pre reserva', label: 'Pre-Reserva', color: '#FF00CC' },
  { key: 'Confirmado', label: 'Confirmado', color: '#00CC66' },
  { key: 'Cancelado', label: 'Cancelado', color: '#FF3333' },
  { key: 'Perdido', label: 'Perdido', color: '#FF9A9E' },
  { key: 'Mantenimiento', label: 'Mantenimiento', color: '#8A2BE2' },
  { key: 'Mantenimiento Realizado', label: 'Mant. Realiz.', color: '#94a3b8' },
  { key: 'Realizado', label: 'Realizado', color: '#22c55e' },
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
  const [hoveredStatusSeg, setHoveredStatusSeg] = useState(null); // { monthIdx, segIdx }

  // ── Satisfaction data ──
  const [checklists, setChecklists] = useState({});
  const [satLoading, setSatLoading] = useState(true);

  // ── Global Monthly Goals (from Settings → Metas Globales) ──
  const [globalMonthlyGoals, setGlobalMonthlyGoals] = useState([]);
  const [globalGoalsLoading, setGlobalGoalsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const state = await loadState({ cacheBust: true });
        setChecklists((state.eventChecklists && typeof state.eventChecklists === 'object') ? state.eventChecklists : {});
        setGlobalMonthlyGoals(Array.isArray(state.globalMonthlyGoals) ? state.globalMonthlyGoals : []);
        setSalonCapacitiesOccupancy((state.salonCapacities && typeof state.salonCapacities === 'object') ? state.salonCapacities : {});
        setSalonOccupancyEnabled(Array.isArray(state.salonOccupancyEnabled) ? state.salonOccupancyEnabled : []);
      } catch (err) { console.error(err); }
      finally { setSatLoading(false); setGlobalGoalsLoading(false); }
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

  // ── Settings Global Monthly Goal (from Settings → Metas Globales) ──
  const settingsGlobalGoal = useMemo(() => {
    if (globalGoalsLoading || !globalMonthlyGoals.length) return null;
    const goal = globalMonthlyGoals.find(g => g.month === monthKey);
    return goal ? { amount: goal.amount, active: goal.active !== false } : null;
  }, [globalMonthlyGoals, monthKey, globalGoalsLoading]);
  const settingsGoalAmount = settingsGlobalGoal?.amount || 0;
  const settingsGoalProgress = settingsGoalAmount > 0 ? (globalAchieved / settingsGoalAmount) * 100 : 0;

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
      const items = Array.isArray(chk?.evaluacion?.items)
        ? chk.evaluacion.items
        : (Array.isArray(chk?.items) ? chk.items.filter(i => i.sectionType === 'evaluacion') : []);
      const ratedItems = items.filter(i => i.rating !== null && i.rating !== undefined);
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

  // ── Daily Occupancy KPIs (from ReportsOcupacionBarras) ──
  const ACTIVE_STATUSES = new Set([STATUS.CONFIRMADO, STATUS.PRERESERVA]);

  const [salonCapacitiesOccupancy, setSalonCapacitiesOccupancy] = useState({});
  const [salonOccupancyEnabled, setSalonOccupancyEnabled] = useState([]);

  const totalMarkedCapacity = useMemo(() => {
    return salonOccupancyEnabled.reduce((sum, name) => sum + Math.max(0, Number(salonCapacitiesOccupancy[name] || 0)), 0);
  }, [salonCapacitiesOccupancy, salonOccupancyEnabled]);

  const markedSalonSet = useMemo(() => new Set(salonOccupancyEnabled), [salonOccupancyEnabled]);

  const occupancyData = useMemo(() => {
    if (!events) return null;
    const { from, to } = getDateRange();
    // Generate day list for the range
    const start = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    const dayList = [];
    const cur = new Date(start);
    while (cur <= end) {
      dayList.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    if (!dayList.length) return null;

    // Sum PAX per day for active events in marked salons
    const dayPax = {};
    const dayCounts = {};
    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) continue;
      if (!ACTIVE_STATUSES.has(String(ev.status || ''))) continue;
      const evSalon = String(ev.salon || '').trim();
      if (!markedSalonSet.has(evSalon)) continue;
      const pax = Math.max(0, Number(ev.pax || 0));
      if (pax > 0) {
        dayPax[d] = (dayPax[d] || 0) + pax;
      }
      dayCounts[d] = (dayCounts[d] || 0) + 1;
    }

    const totalPax = Object.values(dayPax).reduce((a, b) => a + b, 0);
    const totalEvents = Object.values(dayCounts).reduce((a, b) => a + b, 0);
    const activeDays = Object.keys(dayPax).length;
    const totalDays = dayList.length;
    const avgDaily = totalDays > 0 ? totalPax / totalDays : 0;
    const maxPax = totalMarkedCapacity > 0 ? totalMarkedCapacity : 1;

    let peakDate = '', peakPax = 0, peakCount = 0;
    for (const [d, p] of Object.entries(dayPax)) {
      if (p > peakPax) { peakPax = p; peakDate = d; peakCount = dayCounts[d] || 0; }
    }

    const paxUtilPct = (totalMarkedCapacity > 0 && totalDays > 0)
      ? (totalPax / (totalMarkedCapacity * totalDays)) * 100
      : 0;

    return { 
      totalPax, totalEvents, activeDays, totalDays, avgDaily, 
      maxPax, peakDate, peakPax, peakCount, 
      dayPax, dayList, totalMarkedCapacity, paxUtilPct 
    };
  }, [events, getDateRange, markedSalonSet, totalMarkedCapacity]);

  const handleReset = () => { const n = new Date(); setMonthKey(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`); setFromDate(''); setToDate(''); setRole(USER_ROLES.SELLER); setScope('all'); setSelectedSellerId(''); };

  // ── Status monthly distribution (stacked bar) ──
  const statusMonthlyData = useMemo(() => {
    if (!events) return [];
    const { from, to } = getDateRange();
    const start = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    // Build month list from range
    const months = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      months.push({
        key: `${y}-${String(m + 1).padStart(2, '0')}`,
        monthName: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m],
        monthShort: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][m],
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    if (!months.length) return [];

    const fromFull = months[0].key + '-01';
    const lastMonthKey = months[months.length - 1].key;
    const toFull = lastMonthKey + '-' + String(new Date(parseInt(lastMonthKey.split('-')[0]), parseInt(lastMonthKey.split('-')[1]), 0).getDate()).padStart(2, '0');

    const monthStatusCounts = {};
    const monthTotals = {};
    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < fromFull || d > toFull) continue;
      const monthKey = d.substring(0, 7);
      const status = String(ev.status || 'Reserva sin Cotizacion').trim();
      if (!monthStatusCounts[monthKey]) { monthStatusCounts[monthKey] = {}; monthTotals[monthKey] = 0; }
      monthStatusCounts[monthKey][status] = (monthStatusCounts[monthKey][status] || 0) + 1;
      monthTotals[monthKey] = (monthTotals[monthKey] || 0) + 1;
    }

    return months.map(m => {
      const counts = monthStatusCounts[m.key] || {};
      const total = monthTotals[m.key] || 0;
      const segments = STATUS_META.map(s => ({
        statusKey: s.key, label: s.label, color: s.color,
        count: counts[s.key] || 0,
        pct: total > 0 ? ((counts[s.key] || 0) / total) * 100 : 0,
      })).filter(s => s.count > 0);
      // Sort: larger pct first for visual clarity
      segments.sort((a, b) => b.pct - a.pct);
      return { monthKey: m.key, monthName: m.monthName, monthShort: m.monthShort, total, segments };
    });
  }, [events, getDateRange]);

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
            <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
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

            {/* ── Global Monthly Goal Card (from Settings → Metas Globales) ── */}
            <div className="bento-tile" style={{
              gridColumn: 'span 2', border: 'none',
              background: settingsGoalAmount > 0 && settingsGoalProgress >= 100
                ? 'linear-gradient(135deg, #f0fdf4, #ecfdf5)'
                : settingsGoalAmount > 0 && settingsGoalProgress >= 80
                  ? 'linear-gradient(135deg, #fffbeb, #fef3c7)'
                  : 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
              borderLeft: `4px solid ${settingsGoalAmount > 0 && settingsGoalProgress >= 100 ? '#16a34a' : settingsGoalAmount > 0 && settingsGoalProgress >= 80 ? '#f59e0b' : '#0284c7'}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
              transition: 'all 0.25s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '3px',
                    background: settingsGoalAmount > 0 && settingsGoalProgress >= 100 ? '#16a34a' : settingsGoalAmount > 0 && settingsGoalProgress >= 80 ? '#f59e0b' : '#0284c7',
                    display: 'inline-block', flexShrink: 0,
                    boxShadow: settingsGoalAmount > 0 && settingsGoalProgress >= 100 ? '0 0 0 2px rgba(22,163,74,0.2)' : settingsGoalAmount > 0 && settingsGoalProgress >= 80 ? '0 0 0 2px rgba(245,158,11,0.2)' : '0 0 0 2px rgba(2,132,199,0.2)',
                  }} />
                  <span className="reports-eyebrow">🎯 Meta Global (Configuración)</span>
                </div>
                {settingsGoalAmount > 0 && (
                  <span style={{
                    fontSize: '10px', fontWeight: '800', padding: '3px 12px', borderRadius: '999px',
                    background: settingsGoalProgress >= 100 ? '#dcfce7' : settingsGoalProgress >= 80 ? '#fef3c7' : '#e0f2fe',
                    color: settingsGoalProgress >= 100 ? '#15803d' : settingsGoalProgress >= 80 ? '#b45309' : '#0369a1',
                  }}>
                    {settingsGoalProgress.toFixed(1)}%
                  </span>
                )}
              </div>
              {settingsGoalAmount > 0 ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', lineHeight: 1, letterSpacing: '-0.03em' }}>
                        {formatMoneyGT(globalAchieved)}
                      </strong>
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginLeft: '6px' }}>
                        de {formatMoneyGT(settingsGoalAmount)}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: '14px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}>
                    <div style={{
                      height: '100%', borderRadius: '999px',
                      background: settingsGoalProgress >= 100
                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                        : settingsGoalProgress >= 80
                          ? 'linear-gradient(90deg, #facc15, #eab308)'
                          : 'linear-gradient(90deg, #38bdf8, #0284c7)',
                      width: `${Math.min(100, settingsGoalProgress)}%`,
                      transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
                      boxShadow: '0 0 8px rgba(0,0,0,0.1)',
                    }} />
                  </div>
                  {/* ── Stats row ── */}
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      💰 <strong style={{ color: '#0f172a' }}>{formatMoneyGT(settingsGoalAmount)}</strong> meta
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      📊 <strong style={{ color: '#0f172a' }}>{settingsGoalProgress.toFixed(1)}%</strong> alcanzado
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      📅 <strong style={{ color: '#0f172a' }}>{getMonthName(parseInt(monthKey.split('-')[1]))}</strong> {monthKey.split('-')[0]}
                    </span>
                  </div>

                  {/* ── 🚀 Motivational Indicators ── */}
                  {(() => {
                    const now = new Date();
                    const [yr, mo] = monthKey.split('-').map(Number);
                    const daysInMo = new Date(yr, mo, 0).getDate();
                    const isCurrent = yr === now.getFullYear() && mo === now.getMonth() + 1;
                    const isPast = yr < now.getFullYear() || (yr === now.getFullYear() && mo < now.getMonth() + 1);
                    const day = isPast ? daysInMo : (isCurrent ? Math.min(now.getDate(), daysInMo) : 0);
                    const daysLeft = Math.max(0, daysInMo - day);
                    const daysEl = day;
                    const needDaily = daysLeft > 0 ? Math.max(0, settingsGoalAmount - globalAchieved) / daysLeft : 0;
                    const currDaily = daysEl > 0 ? globalAchieved / daysEl : 0;
                    const projected = currDaily * daysInMo;
                    const projPct = settingsGoalAmount > 0 ? (projected / settingsGoalAmount) * 100 : 0;
                    const onPace = currDaily >= needDaily;
                    const msgs = [
                      { min: 100, emoji: '🏆', msg: '¡META SUPERADA! Increíble trabajo en equipo', color: '#16a34a', bg: '#f0fdf4' },
                      { min: 90, emoji: '🎯', msg: '¡Lo tienen al alcance! Un último esfuerzo y la rompen', color: '#16a34a', bg: '#f0fdf4' },
                      { min: 75, emoji: '⚡', msg: '¡Ya casi llegamos! No bajen el ritmo, sigan así', color: '#ca8a04', bg: '#fefce8' },
                      { min: 50, emoji: '🚀', msg: 'Van a media máquina, ¡sigan empujando fuerte!', color: '#ca8a04', bg: '#fefce8' },
                      { min: 25, emoji: '🔥', msg: 'Buen ritmo, van por buen camino ¡aceleren!', color: '#2563eb', bg: '#eff6ff' },
                      { min: 0, emoji: '💪', msg: '¡Enciendan motores! Todavía hay tiempo para alcanzarla', color: '#2563eb', bg: '#eff6ff' },
                    ];
                    const mot = msgs.find(m => settingsGoalProgress >= m.min) || msgs[msgs.length - 1];

                    return (
                      <>
                        {/* Separador sutil */}
                        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)', margin: '12px 0 10px' }} />

                        {/* Motivational ribbon */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          background: mot.bg, borderRadius: '10px',
                          padding: '8px 14px', marginBottom: '10px',
                          border: `1px solid ${mot.color}20`,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6)`,
                        }}>
                          <span style={{ fontSize: '22px', lineHeight: 1 }}>{mot.emoji}</span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: mot.color, letterSpacing: '-0.01em' }}>{mot.msg}</div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginTop: '1px' }}>
                              Progreso: {settingsGoalProgress.toFixed(1)}% · Meta: {formatMoneyGT(settingsGoalAmount)}
                            </div>
                          </div>
                        </div>

                        {/* Indicators grid: 2 columns */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {/* Días restantes */}
                          <div style={{
                            background: '#f8fafc', borderRadius: '10px', padding: '10px 12px',
                            border: '1px solid #f1f5f9',
                          }}>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                              ⏱️ Días del mes
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                              <strong style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{day}</strong>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>de {daysInMo}</span>
                              <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 800, color: daysLeft <= 7 ? '#dc2626' : '#2563eb' }}>
                                {daysLeft === 1 ? 'Último día' : `Quedan ${daysLeft} días`}
                              </span>
                            </div>
                            {/* Mini day progress bar */}
                            <div style={{ height: '5px', borderRadius: '999px', background: '#e2e8f0', marginTop: '5px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: '999px',
                                background: `linear-gradient(90deg, #3b82f6, ${daysLeft <= 7 ? '#ef4444' : '#2563eb'})`,
                                width: `${(day / daysInMo) * 100}%`,
                                transition: 'width 0.4s ease',
                              }} />
                            </div>
                          </div>

                          {/* Proyección mensual */}
                          <div style={{
                            background: '#f8fafc', borderRadius: '10px', padding: '10px 12px',
                            border: '1px solid #f1f5f9',
                          }}>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                              📈 Proyección mensual
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                              <strong style={{ fontSize: '16px', fontWeight: 900, color: onPace ? '#16a34a' : '#dc2626', lineHeight: 1, letterSpacing: '-0.02em' }}>
                                {formatMoneyGT(projected)}
                              </strong>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                                vs {formatMoneyGT(settingsGoalAmount)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px',
                                background: onPace ? '#dcfce7' : '#fef2f2',
                                color: onPace ? '#15803d' : '#dc2626',
                              }}>
                                {onPace ? '✅ Al ritmo' : '⚠️ Atrás'}
                              </span>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: projPct >= 100 ? '#16a34a' : '#64748b' }}>
                                {projPct.toFixed(0)}% de la meta
                              </span>
                            </div>
                            {/* Mini projection bar */}
                            <div style={{ height: '5px', borderRadius: '999px', background: '#e2e8f0', marginTop: '5px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: '999px',
                                background: onPace ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, #f87171, #dc2626)',
                                width: `${Math.min(100, projPct)}%`,
                                transition: 'width 0.4s ease',
                              }} />
                            </div>
                          </div>

                          {/* Ritmo diario — spans full width */}
                          <div style={{
                            gridColumn: 'span 2',
                            background: '#f8fafc', borderRadius: '10px', padding: '10px 12px',
                            border: '1px solid #f1f5f9',
                          }}>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>
                              💪 Ritmo diario
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                                Necesitas <strong style={{ color: '#dc2626', fontWeight: 800 }}>{formatMoneyGT(needDaily)}</strong>/día
                              </span>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                                Llevas <strong style={{ color: onPace ? '#16a34a' : '#dc2626', fontWeight: 800 }}>{formatMoneyGT(currDaily)}</strong>/día
                              </span>
                            </div>
                            {/* Dual bar comparison */}
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', minWidth: '32px' }}>META</span>
                              <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: '#fee2e2', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}>
                                <div style={{
                                  height: '100%', borderRadius: '999px',
                                  background: 'linear-gradient(90deg, #fca5a5, #ef4444)',
                                  width: `${Math.min(100, needDaily > 0 && currDaily > 0 ? (needDaily / Math.max(needDaily, currDaily)) * 100 : 0)}%`,
                                  transition: 'width 0.4s ease',
                                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                                }} />
                              </div>
                              <span style={{ fontSize: '10px', fontWeight: 800, color: '#dc2626', minWidth: '58px', textAlign: 'right' }}>{formatMoneyGT(needDaily)}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                              <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', minWidth: '32px' }}>ACTUAL</span>
                              <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: '#dcfce7', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}>
                                <div style={{
                                  height: '100%', borderRadius: '999px',
                                  background: 'linear-gradient(90deg, #86efac, #22c55e)',
                                  width: `${Math.min(100, needDaily > 0 && currDaily > 0 ? (currDaily / Math.max(needDaily, currDaily)) * 100 : currDaily > 0 ? 100 : 0)}%`,
                                  transition: 'width 0.4s ease 0.1s',
                                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                                }} />
                              </div>
                              <span style={{ fontSize: '10px', fontWeight: 800, color: onPace ? '#16a34a' : '#dc2626', minWidth: '58px', textAlign: 'right' }}>{formatMoneyGT(currDaily)}</span>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </>
              ) : (
                <div style={{ padding: '12px 0', textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
                  {globalGoalsLoading ? 'Cargando...' : `No hay meta global configurada para ${getMonthName(parseInt(monthKey.split('-')[1]))}. Ve a Configuración → Metas Globales para establecerla.`}
                </div>
              )}
            </div>
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

        {/* ── 3.5. Ocupación KPIs ── */}
        {occupancyData && (
          <section className="reports-hero-panel" style={{ gap: '10px' }}>
            <div className="reports-section-intro">
              <div>
                <span className="reports-eyebrow">Ocupación diaria (PAX)</span>
                <h3 className="reports-section-title">PAX ocupados vs capacidad de salones</h3>
                <p className="reports-section-text">Capacidad total de salones marcados: <strong>{occupancyData.totalMarkedCapacity.toLocaleString()}</strong> PAX/día</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
              {/* Días activos */}
              <div className="bento-tile" style={{
                border: 'none', borderRadius: '14px', padding: '14px 16px',
                background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                borderLeft: '4px solid #0284c7',
                boxShadow: '0 1px 3px rgba(2,132,199,0.12), 0 4px 12px rgba(2,132,199,0.06)',
                transition: 'all 0.25s ease', cursor: 'default',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(2,132,199,0.18), 0 8px 24px rgba(2,132,199,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(2,132,199,0.12), 0 4px 12px rgba(2,132,199,0.06)'; }}
              >
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                  📅 Días activos
                </div>
                <strong style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.03em' }}>
                  {occupancyData.activeDays}
                </strong>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginTop: '3px' }}>
                  de {occupancyData.totalDays} días ({((occupancyData.activeDays / occupancyData.totalDays) * 100).toFixed(0)}%)
                </div>
                <div style={{ height: '5px', borderRadius: '999px', background: '#bae6fd', marginTop: '6px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '999px',
                    background: 'linear-gradient(90deg, #38bdf8, #0284c7)',
                    width: `${(occupancyData.activeDays / occupancyData.totalDays) * 100}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>

              {/* PAX totales */}
              <div className="bento-tile" style={{
                border: 'none', borderRadius: '14px', padding: '14px 16px',
                background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                borderLeft: '4px solid #16a34a',
                boxShadow: '0 1px 3px rgba(22,163,74,0.12), 0 4px 12px rgba(22,163,74,0.06)',
                transition: 'all 0.25s ease', cursor: 'default',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(22,163,74,0.18), 0 8px 24px rgba(22,163,74,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(22,163,74,0.12), 0 4px 12px rgba(22,163,74,0.06)'; }}
              >
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                  🧑 PAX totales
                </div>
                <strong style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.03em' }}>
                  {occupancyData.totalPax.toLocaleString()}
                </strong>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginTop: '3px' }}>
                  {occupancyData.totalEvents} eventos · Cap. {occupancyData.totalMarkedCapacity.toLocaleString()}/día
                </div>
              </div>

              {/* Utilización mensual */}
              <div className="bento-tile" style={{
                border: 'none', borderRadius: '14px', padding: '14px 16px',
                background: 'linear-gradient(135deg, #fefce8, #fffbeb)',
                borderLeft: '4px solid #ca8a04',
                boxShadow: '0 1px 3px rgba(202,138,4,0.12), 0 4px 12px rgba(202,138,4,0.06)',
                transition: 'all 0.25s ease', cursor: 'default',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(202,138,4,0.18), 0 8px 24px rgba(202,138,4,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(202,138,4,0.12), 0 4px 12px rgba(202,138,4,0.06)'; }}
              >
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#a16207', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                  📊 Utilización mensual
                </div>
                <strong style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.03em' }}>
                  {occupancyData.paxUtilPct.toFixed(1)}%
                </strong>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginTop: '3px' }}>
                  Prom. {occupancyData.avgDaily.toFixed(0)} PAX / {occupancyData.totalMarkedCapacity.toLocaleString()} cap.
                </div>
              </div>

              {/* Día pico */}
              <div className="bento-tile" style={{
                border: 'none', borderRadius: '14px', padding: '14px 16px',
                background: 'linear-gradient(135deg, #fdf2f8, #fce7f3)',
                borderLeft: '4px solid #db2777',
                boxShadow: '0 1px 3px rgba(219,39,119,0.12), 0 4px 12px rgba(219,39,119,0.06)',
                transition: 'all 0.25s ease', cursor: 'default',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(219,39,119,0.18), 0 8px 24px rgba(219,39,119,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(219,39,119,0.12), 0 4px 12px rgba(219,39,119,0.06)'; }}
              >
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#be185d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                  🏆 Día pico
                </div>
                <strong style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                  {occupancyData.peakDate || '-'}
                </strong>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                  <strong style={{ color: '#db2777' }}>{occupancyData.peakPax.toLocaleString()}</strong> PAX · {((occupancyData.totalMarkedCapacity > 0 ? occupancyData.peakPax / occupancyData.totalMarkedCapacity : 0) * 100).toFixed(0)}% capacidad
                </div>
              </div>
            </div>

            {/* Mini bar distribution */}
            <div style={{
              background: '#ffffff', borderRadius: '14px', padding: '16px 20px',
              border: '1px solid #f1f5f9',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  📊 Distribución diaria PAX vs Capacidad
                </div>
                <div style={{ display: 'flex', gap: '8px', fontSize: '9px', fontWeight: 600, color: '#94a3b8' }}>
                  <span>◉ ≥90%</span>
                  <span>◉ 70-89%</span>
                  <span>◉ 40-69%</span>
                  <span>◉ 1-39%</span>
                  <span>◉ 0%</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '48px', position: 'relative' }}>
                {/* Background grid lines */}
                {[25, 50, 75].map(pct => (
                  <div key={pct} style={{
                    position: 'absolute', left: 0, right: 0, bottom: `${pct}%`,
                    height: '1px', borderTop: '1px dashed #e2e8f0', pointerEvents: 'none', opacity: 0.5,
                  }} />
                ))}
                {occupancyData.dayList.map((dateObj, i) => {
                  const dStr = dateObj.toISOString().split('T')[0];
                  const pax = occupancyData.dayPax[dStr] || 0;
                  const pct = occupancyData.totalMarkedCapacity > 0 ? (pax / occupancyData.totalMarkedCapacity) * 100 : 0;
                  const barColor = pct >= 90 ? '#10b981' : pct >= 70 ? '#3b82f6' : pct >= 40 ? '#60a5fa' : pct > 0 ? '#a5b4fc' : '#e2e8f0';
                  const isToday = dStr === new Date().toISOString().split('T')[0];
                  return (
                    <div
                      key={dStr}
                      title={`${dStr}: ${pax} PAX (${Math.round(pct)}% de ${occupancyData.totalMarkedCapacity.toLocaleString()} PAX)`}
                      style={{
                        flex: '1 1 0', minWidth: '4px', maxWidth: '20px',
                        height: '100%', display: 'flex', flexDirection: 'column',
                        justifyContent: 'flex-end', alignItems: 'center',
                        position: 'relative', cursor: 'help',
                      }}
                    >
                      <div style={{
                        width: '100%',
                        height: `${Math.max(pct > 0 ? Math.max(3, pct) : 0, 0)}%`,
                        background: barColor,
                        borderRadius: '2px 2px 0 0',
                        transition: 'height 0.3s ease',
                        minHeight: pax > 0 ? '3px' : '0',
                        opacity: isToday ? 1 : 0.8,
                        boxShadow: isToday ? `0 0 4px ${barColor}60` : 'none',
                      }} />
                      {isToday && (
                        <div style={{
                          position: 'absolute', bottom: '-14px',
                          fontSize: '6px', fontWeight: 900, color: '#2563eb',
                          whiteSpace: 'nowrap',
                        }}>
                          HOY
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* X-axis date labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '8px', fontWeight: 600, color: '#94a3b8' }}>
                {occupancyData.dayList.length > 0 && (
                  <span>{occupancyData.dayList[0].toLocaleDateString('es', { month: 'short', day: 'numeric' })}</span>
                )}
                {occupancyData.dayList.length > 10 && (
                  <span style={{ marginLeft: 'auto' }}>
                    {occupancyData.dayList[Math.floor(occupancyData.dayList.length / 2)].toLocaleDateString('es', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                {occupancyData.dayList.length > 0 && (
                  <span>{occupancyData.dayList[occupancyData.dayList.length - 1].toLocaleDateString('es', { month: 'short', day: 'numeric' })}</span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── 3.7. Eficiencia por Estado (stacked bar) ── */}
        {statusMonthlyData.length > 0 && (
          <section className="reports-hero-panel" style={{ gap: '8px' }}>
            <div className="reports-section-intro">
              <div>
                <span className="reports-eyebrow">Eficiencia por Estado</span>
                <h3 className="reports-section-title">Distribución mensual de eventos</h3>
                <p className="reports-section-text">Cada barra es un mes. Pasa el mouse sobre los segmentos.</p>
              </div>
            </div>
            <div style={{
              background: '#ffffff', borderRadius: '12px', padding: '16px 16px 20px',
              border: '1px solid #f1f5f9',
            }}>
              {/* Mini legend */}
              <div style={{ display: 'flex', gap: '8px', fontSize: '9px', fontWeight: 700, color: '#94a3b8', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
                {STATUS_META.map(s => {
                  const totalCount = statusMonthlyData.reduce((sum, m) => sum + (m.segments.find(seg => seg.statusKey === s.key)?.count || 0), 0);
                  if (totalCount === 0) return null;
                  return (
                    <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.color, display: 'inline-block' }} />
                      {s.label}
                    </span>
                  );
                })}
              </div>
              {/* Stacked chart */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '140px', position: 'relative' }}>
                {statusMonthlyData.map((mData, mIdx) => {
                  const activeSeg = hoveredStatusSeg?.monthIdx === mIdx
                    ? mData.segments[hoveredStatusSeg.segIdx]
                    : null;
                  return (
                    <div key={mData.monthKey} style={{
                      flex: '1 1 0', minWidth: '24px', maxWidth: '50px',
                      height: '100%', display: 'flex', flexDirection: 'column',
                      justifyContent: 'flex-end', position: 'relative',
                    }}>
                      <div style={{
                        width: '100%', height: mData.segments.length > 0 ? '100%' : '4px',
                        borderRadius: '3px 3px 0 0', overflow: 'hidden',
                        background: mData.segments.length > 0 ? 'transparent' : '#f1f5f9',
                        display: 'flex', flexDirection: 'column-reverse',
                      }}>
                        {mData.segments.map((seg, segIdx) => {
                          const isHovered = hoveredStatusSeg?.monthIdx === mIdx && hoveredStatusSeg?.segIdx === segIdx;
                          return (
                            <div key={seg.statusKey}
                              style={{
                                width: '100%', height: `${Math.max(seg.pct, 2)}%`,
                                background: isHovered
                                  ? `linear-gradient(180deg, ${seg.color}, ${seg.color}dd)`
                                  : seg.color,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                borderBottom: '1px solid rgba(255,255,255,0.25)',
                                filter: isHovered ? 'brightness(1.15)' : 'none',
                                minHeight: '3px',
                              }}
                              onMouseEnter={() => setHoveredStatusSeg({ monthIdx: mIdx, segIdx })}
                              onMouseLeave={() => setHoveredStatusSeg(null)}
                            />
                          );
                        })}
                      </div>

                      {/* Tooltip outside overflow:hidden */}
                      {activeSeg && (
                        <div style={{
                          position: 'absolute', bottom: '100%', left: '50%',
                          transform: 'translateX(-50%)', marginBottom: '6px',
                          background: '#0f172a', color: '#fff',
                          padding: '6px 10px', borderRadius: '8px',
                          fontSize: '10px', fontWeight: 600,
                          whiteSpace: 'nowrap', zIndex: 9999,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                          pointerEvents: 'none',
                        }}>
                          <div style={{ textAlign: 'center' }}>
                            <strong style={{ fontSize: '12px', color: activeSeg.color }}>{activeSeg.label}</strong>
                            <div style={{ color: '#94a3b8', marginTop: '1px' }}>
                              {activeSeg.count} {activeSeg.count === 1 ? 'evento' : 'eventos'}
                            </div>
                            <div style={{ color: '#fff', fontWeight: 800, fontSize: '12px' }}>
                              {Math.round(activeSeg.pct)}%
                            </div>
                            <div style={{ color: '#64748b', marginTop: '1px', fontSize: '9px' }}>
                              {mData.monthName} · {mData.total} total
                            </div>
                          </div>
                          <div style={{
                            position: 'absolute', top: '100%', left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0, height: 0,
                            borderLeft: '5px solid transparent',
                            borderRight: '5px solid transparent',
                            borderTop: '5px solid #0f172a',
                          }} />
                        </div>
                      )}

                      <div style={{
                        fontSize: '8px', fontWeight: 700, color: '#94a3b8',
                        textAlign: 'center', marginTop: '4px', lineHeight: 1,
                      }}>
                        {mData.monthShort}
                      </div>
                    </div>
                  );
                })}
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
