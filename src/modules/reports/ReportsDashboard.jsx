import { useState, useMemo, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { loadState } from '../../services/stateService';
import ReportInfo from './components/ReportInfo';
import { getEventSeriesFinancialMeta } from './components/eventSeriesUtils';

const STATUS = { CONFIRMADO: 'Confirmado', PRERESERVA: 'Pre reserva' };
const USER_ROLES = { SELLER: 'vendedor', RECEPTIONIST: 'recepcionista' };
const isGoalStatus = (s) => s === STATUS.CONFIRMADO;

const SAT_RATING_LEVELS = [
  { value: 'malo', label: 'Malo', score: 2.5, color: '#ef4444', bg: '#fef2f2' },
  { value: 'regular', label: 'Regular', score: 5, color: '#eab308', bg: '#fffbeb' },
  { value: 'bueno', label: 'Bueno', score: 7.5, color: '#22c55e', bg: '#f0fdf4' },
  { value: 'excelente', label: 'Excelente', score: 10, color: '#a855f7', bg: '#faf5ff' },
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
      } catch (err) { console.error(err); }
      finally { setSatLoading(false); setGlobalGoalsLoading(false); }
    })();
  }, []);

  const formatMoneyGT = (v) => 'Q ' + Number(v||0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const getMonthName = (m) => ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m-1] || '';
  const getRoleLabel = (r) => r === USER_ROLES.SELLER ? 'Vendedor' : 'Recepcionista';

  // Formato corto dd-mm-yy para el label del rango
  const fmtShort = (iso) => {
    if (!iso) return '';
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso;
    return `${m[3]}-${m[2]}-${m[1].slice(2)}`;
  };

  const getDateRange = useCallback(() => {
    if (!fromDate || !toDate) {
      const [y,m] = monthKey.split('-');
      const s = new Date(parseInt(y), parseInt(m)-1, 1);
      const e = new Date(parseInt(y), parseInt(m), 0);
      const fromIso = s.toISOString().split('T')[0];
      const toIso = e.toISOString().split('T')[0];
      return { from: fromIso, to: toIso, label: `${fmtShort(fromIso)} → ${fmtShort(toIso)}` };
    }
    return { from: fromDate, to: toDate, label: `${fmtShort(fromDate)} → ${fmtShort(toDate)}` };
  }, [monthKey, fromDate, toDate]);

  const filteredUsers = useMemo(() => (users||[]).filter(u => String(u.role||'').toLowerCase() === (role === USER_ROLES.SELLER ? 'vendedor' : 'recepcionista')), [users, role]);

  const dashboardRows = useMemo(() => {
    if (!events) return [];
    const { from, to } = getDateRange();
    const rows = []; const seenGroups = new Set();
    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) continue;
      const key = ev.groupId || ev.id;
      if (seenGroups.has(key)) continue;
      seenGroups.add(key);

      // Mismo cálculo que ReportsVentas: usar el primaryEvent (slot del salón principal)
      // para que la cotización refleje la reserva completa.
      const financialMeta = getEventSeriesFinancialMeta(ev, events);
      const primaryEvent = financialMeta.primaryEvent || ev;
      const quote = primaryEvent?.quote || ev?.quote || {};
      const typeSrc = (quote?.eventType || primaryEvent?.name || ev?.name || '').toLowerCase();
      const total = Math.max(0, Number(quote?.totalGtq || quote?.total || 0));

      rows.push({
        userId: String(primaryEvent?.userId || ev?.userId || ''),
        status: primaryEvent?.status || ev?.status || '',
        eventDate: primaryEvent?.date || ev?.date || '',
        salon: financialMeta.mainSalon || primaryEvent?.salon || ev?.salon || '',
        total,
        type: typeSrc.includes('corporativo') ? 'corp' : typeSrc.includes('social') ? 'social' : 'otro',
        monthKey: (primaryEvent?.date || ev?.date || '').substring(0, 7)
      });
    }
    return rows;
  }, [events, getDateRange]);

  const filteredRows = useMemo(() => dashboardRows.filter(r => { if (scope === 'seller' && selectedSellerId && r.userId !== selectedSellerId) return false; return true; }), [dashboardRows, scope, selectedSellerId]);

  const statusMeta = () => [
    { k: STATUS.CONFIRMADO, l: 'Confirmado', s: 'Conf.', c: '#10c972' },
    { k: 'Pre reserva', l: 'Pre-reserva', s: 'Pre-rsv', c: '#d07db8' },
    { k: 'Seguimiento', l: 'Negociacion', s: 'Neg.', c: '#ff6b3a' },
    { k: 'Perdido', l: 'Perdido', s: 'Perd.', c: '#7c5cff' },
    { k: 'Cancelado', l: 'Cancelado', s: 'Canc.', c: '#e42a48' },
    { k: 'Reserva sin Cotizacion', l: 'Reserva sin cotizacion', s: 'RSC', c: '#0ea5e9' }
  ];

  const statusSummary = useMemo(() => {
    const meta = statusMeta(); const cnt = {}; meta.forEach(m => cnt[m.k] = 0);
    filteredRows.forEach(r => { if (cnt[r.status] !== undefined) cnt[r.status]++; });
    const total = Object.values(cnt).reduce((a,b) => a+b, 0);
    const confirmed = cnt[STATUS.CONFIRMADO]||0;
    return { total, confirmed, pct: total ? (confirmed/total)*100 : 0, seg: meta.map(m => ({...m, count: cnt[m.k]||0, pct: total ? ((cnt[m.k]||0)/total)*100 : 0})) };
  }, [filteredRows]);

  const usersWithGoal = useMemo(() => new Set(
    (users || [])
      .filter(u => {
        const role = String(u.role || '').toLowerCase();
        return (role === 'vendedor' || role === 'admin') && u.salesTargetEnabled;
      })
      .map(u => u.id)
  ), [users]);
  const rowsWithGoal = useMemo(() => filteredRows.filter(r => usersWithGoal.has(r.userId)), [filteredRows, usersWithGoal]);
  const globalAchieved = useMemo(() => rowsWithGoal.filter(r => isGoalStatus(r.status)).reduce((a,r) => a+r.total, 0), [rowsWithGoal]);
  const focusedUser = scope === 'seller' && selectedSellerId ? users?.find(u => u.id === selectedSellerId) : null;
  const personalGoal = focusedUser?.monthlyGoals ? (focusedUser.monthlyGoals.find(g => g.month === monthKey)?.amount||0) : 0;
  const personalAchieved = focusedUser ? filteredRows.filter(r => r.userId === focusedUser.id && isGoalStatus(r.status)).reduce((a,r) => a+r.total, 0) : 0;
  const pProg = personalGoal ? (personalAchieved/personalGoal)*100 : 0;

  // ── Settings Global Monthly Goal (from Settings → Metas Globales) ──
  // Se auto-detecta del rango: si el rango es 1 mes, usa la meta de ese mes.
  // Si es multi-mes, suma las metas de todos los meses incluidos.
  // Si no hay rango custom, usa el monthKey directamente.
  const settingsGlobalGoal = useMemo(() => {
    if (globalGoalsLoading || !globalMonthlyGoals.length) return null;
    const { from, to } = getDateRange();
    // Listar todos los meses (YYYY-MM) que cubre el rango [from, to]
    const months = [];
    const start = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    // Sumar las metas de los meses incluidos (solo los activos)
    const goalsInRange = months
      .map(m => globalMonthlyGoals.find(g => g.month === m))
      .filter(Boolean)
      .filter(g => g.active !== false);
    const totalAmount = goalsInRange.reduce((a, g) => a + (g.amount || 0), 0);
    if (totalAmount <= 0) return null;
    return { amount: totalAmount, monthsCount: months.length, months };
  }, [globalMonthlyGoals, getDateRange, globalGoalsLoading]);
  const settingsGoalAmount = settingsGlobalGoal?.amount || 0;
  const settingsGoalProgress = settingsGoalAmount > 0 ? (globalAchieved / settingsGoalAmount) * 100 : 0;

  // ── PAX del mes + % Ocupación de eventos ──
  // Misma lógica que "PAX por día" pero sumando todo el rango.
  // - totalMonthPax: PAX de eventos Confirmados en el rango (con dedup por slot compartido)
  // - plannedMonthPax: PAX de TODOS los eventos del rango (cualquier status)
  // - occupancyPct: % de PAX que se confirmó sobre lo planificado
  const paxMetrics = useMemo(() => {
    if (!events) return { totalMonthPax: 0, plannedMonthPax: 0, occupancyPct: 0 };
    const { from, to } = getDateRange();
    const inRange = events.filter(ev => {
      const d = String(ev.date || '');
      return d && d >= from && d <= to;
    });
    const seenSharedPlanned = new Set();
    const seenSharedConfirmed = new Set();
    let totalMonthPax = 0;     // sólo Confirmados
    let plannedMonthPax = 0;   // todos los estatus
    for (const ev of inRange) {
      const status = String(ev.status || '').trim();
      const pax = Math.max(0, Number(ev.slotPax ?? ev.pax ?? 0));
      const groupKey = ev.groupId || ev.id;
      const isShared = ev.paxCompartido === 1 || ev.paxCompartido === true || ev.paxShared === true || ev.pax_compartido === 1;
      // Slot compartido: dedupe por (día + groupId) para no duplicar
      const sharedKey = isShared ? `${ev.date || ''}_${groupKey}` : null;
      // Planificado: cualquier status
      if (!isShared || !seenSharedPlanned.has(sharedKey)) {
        if (isShared) seenSharedPlanned.add(sharedKey);
        plannedMonthPax += pax;
      }
      // Confirmado: dedupe slots compartidos
      if (status === STATUS.CONFIRMADO) {
        if (!isShared || !seenSharedConfirmed.has(sharedKey)) {
          if (isShared) seenSharedConfirmed.add(sharedKey);
          totalMonthPax += pax;
        }
      }
    }
    const occupancyPct = plannedMonthPax > 0 ? (totalMonthPax / plannedMonthPax) * 100 : 0;
    return { totalMonthPax, plannedMonthPax, occupancyPct };
  }, [events, getDateRange]);

  const salonData = useMemo(() => {
    if (!events) return null;
    const { from, to } = getDateRange();
    const c = {};
    // Cuenta por SLOT (no por evento único): un evento de 3 días = 3.
    // Igual que el query SQL: GROUP BY Salon sin deduplicar por groupId.
    events.forEach(ev => {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) return;
      if (String(ev.status || '').trim() !== STATUS.CONFIRMADO) return;
      const s = String(ev.salon || '').trim() || '(sin salón)';
      c[s] = (c[s] || 0) + 1;
    });
    const grandTotal = Object.values(c).reduce((a,b) => a+b, 0);
    if (!grandTotal) return null;
    const sorted = Object.entries(c)
      .sort((a,b) => b[1]-a[1])
      .map(([l,n],i) => ({
        rank: i + 1,
        label: l,
        count: n,
        pct: (n / grandTotal) * 100,
      }));
    return { rows: sorted, grandTotal };
  }, [events, getDateRange]);

  const sellerMetrics = useMemo(() => {
    if (!events) return [];
    const statusList = statusMeta(); // [ {k, l, c}, ... ]
    const { from, to } = getDateRange();
    // Cuenta por SLOT (alineado con SQL y con salonData): 1 evento multi-día = N.
    // Filtra por fecha aquí directamente para no depender de filteredRows (deduplicado).
    const dateFiltered = events.filter(ev => {
      const d = String(ev.date || '');
      return d && d >= from && d <= to;
    });
    const scopeUsers = filteredUsers.filter(u => !scope || scope==='all' || u.id === selectedSellerId);
    return scopeUsers.map(s => {
      const userEvents = dateFiltered.filter(r => String(r.userId) === String(s.id));
      // El dinero NO se infla por multi-slot: solo se cuenta 1 vez por groupId
      // usando el primaryEvent (mismo cálculo que dashboardRows).
      const seenGroupsForMoney = new Set();
      const byStatus = {}; // [statusKey]: { count, amount }
      userEvents.forEach(ev => {
        const groupKey = ev.groupId || ev.id;
        const status = String(ev.status || '').trim() || '(sin status)';
        if (!byStatus[status]) byStatus[status] = { count: 0, amount: 0 };
        // Count: por slot (alineado con SQL)
        byStatus[status].count += 1;
        // Amount: solo el primer slot del grupo aporta el total
        if (!seenGroupsForMoney.has(groupKey)) {
          seenGroupsForMoney.add(groupKey);
          const financialMeta = getEventSeriesFinancialMeta(ev, events);
          const primaryEvent = financialMeta.primaryEvent || ev;
          const quote = primaryEvent?.quote || ev?.quote || {};
          const total = Math.max(0, Number(quote?.totalGtq || quote?.total || 0));
          byStatus[status].amount += total;
        }
      });
      // Desglose por estado: { statusKey, label, shortLabel, color, count, amount }
      const breakdown = statusList.map(m => ({
        statusKey: m.k,
        label: m.l,
        shortLabel: m.s,
        color: m.c,
        count: byStatus[m.k]?.count || 0,
        amount: byStatus[m.k]?.amount || 0,
      })).filter(b => b.count > 0);
      return {
        id: s.id,
        name: s.fullName||s.name||getRoleLabel(role),
        total: userEvents.length,
        confirmed: byStatus[STATUS.CONFIRMADO]?.count || 0,
        amount: byStatus[STATUS.CONFIRMADO]?.amount || 0,
        breakdown,
      };
    }).sort((a,b) => b.amount - a.amount);
  }, [events, getDateRange, filteredUsers, scope, selectedSellerId, role]);
  const maxAmt = Math.max(1, ...sellerMetrics.map(s => s.amount));

  const eventTypeData = useMemo(() => {
    const labels = { corp: 'Corporativo', social: 'Social', otro: 'Otro' };
    const colors = { corp: '#2563eb', social: '#10c972', otro: '#f59e0b' };
    const totals = { corp: { count: 0, amount: 0 }, social: { count: 0, amount: 0 }, otro: { count: 0, amount: 0 } };
    // Mismo criterio que el "Total Venta" global: solo eventos Confirmados
    // de usuarios que tienen meta habilitada (salesTargetEnabled).
    rowsWithGoal.filter(r => r.status === STATUS.CONFIRMADO).forEach((row) => {
      const key = totals[row.type] ? row.type : 'otro';
      totals[key].count += 1;
      totals[key].amount += Number(row.total || 0);
    });
    const max = Math.max(1, ...Object.values(totals).map((item) => item.amount));
    return Object.entries(totals).map(([key, item]) => ({
      key, label: labels[key], color: colors[key], count: item.count, amount: item.amount, pct: (item.amount / max) * 100
    }));
  }, [rowsWithGoal]);

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
      label: 'Meta Global', value: formatMoneyGT(settingsGoalAmount),
      trend: `${settingsGoalProgress.toFixed(1)}%`,
      trendColor: settingsGoalProgress>=100 ? '#15803d' : settingsGoalProgress>=80 ? '#b45309' : '#1d4ed8',
      trendBg: settingsGoalProgress>=100 ? '#dcfce7' : settingsGoalProgress>=80 ? '#fef3c7' : '#eff6ff',
      accent: settingsGoalProgress>=100 ? '#16a34a' : settingsGoalProgress>=80 ? '#f59e0b' : '#2563eb',
    },
    {
      label: 'Pendiente Global', value: formatMoneyGT(Math.max(0,settingsGoalAmount-globalAchieved)),
      trend: globalAchieved >= settingsGoalAmount ? 'Superada' : '',
      accent: globalAchieved >= settingsGoalAmount ? '#16a34a' : '#e11d48',
    },
    {
      // PAX total del mes (eventos Confirmados) — útil para entender demanda real
      label: 'PAX del Mes', value: paxMetrics.totalMonthPax.toLocaleString('en-US'),
      trend: `${paxMetrics.occupancyPct.toFixed(1)}% ocup.`,
      trendColor: paxMetrics.occupancyPct >= 80 ? '#15803d' : paxMetrics.occupancyPct >= 50 ? '#b45309' : '#1d4ed8',
      trendBg: paxMetrics.occupancyPct >= 80 ? '#dcfce7' : paxMetrics.occupancyPct >= 50 ? '#fef3c7' : '#eff6ff',
      accent: paxMetrics.occupancyPct >= 80 ? '#16a34a' : paxMetrics.occupancyPct >= 50 ? '#f59e0b' : '#0ea5e9',
      subtitle: `de ${paxMetrics.plannedMonthPax.toLocaleString('en-US')} planificados`,
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
        <ReportInfo reportKey="dashboard" />
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
            {kpiCards
              .filter((kpi, i) => {
                if (i < 2 && settingsGoalAmount === 0) return false; // hide global cards when no meta configured
                return true;
              })
              .map((kpi, i) => (
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

        {/* ── 3.6. PAX por día (solo Confirmado) ── */}
        {(() => {
          if (!events) return null;
          const { from, to } = getDateRange();
          const start = new Date(from + 'T00:00:00');
          const end = new Date(to + 'T00:00:00');
          const dayList = [];
          const cur = new Date(start);
          while (cur <= end) { dayList.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
          if (!dayList.length) return null;
          const dayPax = {};
          const dayEvents = {};
          const seenSharedGroup = new Set();
          for (const ev of events) {
            const d = String(ev.date || '');
            if (!d || d < from || d > to) continue;
            if (String(ev.status || '').trim() !== 'Confirmado') continue;
            const isShared = ev.paxCompartido === 1 || ev.paxCompartido === true || ev.paxShared === true || ev.pax_compartido === 1;
            const groupKey = ev.groupId || ev.id;
            const dayGroupKey = `${d}_${groupKey}`;
            const pax = Math.max(0, Number(ev.slotPax ?? ev.pax ?? 0));

            if (isShared) {
              if (!seenSharedGroup.has(dayGroupKey)) {
                seenSharedGroup.add(dayGroupKey);
                dayEvents[d] = (dayEvents[d] || 0) + 1;
                dayPax[d] = (dayPax[d] || 0) + pax;
              }
            } else {
              dayEvents[d] = (dayEvents[d] || 0) + 1;
              dayPax[d] = (dayPax[d] || 0) + pax;
            }
          }
          const totalPax = Object.values(dayPax).reduce((a, b) => a + b, 0);
          const maxDayPax = Math.max(1, ...Object.values(dayPax));
          return (
            <section className="reports-hero-panel" style={{ gap: '10px' }}>
              <div className="reports-section-intro">
                <div>
                  <span className="reports-eyebrow">PAX por día</span>
                  <h3 className="reports-section-title">Asistencia total por día (todos los salones)</h3>
                  <p className="reports-section-text"><strong>{totalPax.toLocaleString()}</strong> PAX totales en el periodo</p>
                </div>
              </div>
              <div className="reports-chart-scroll-wrap" style={{
                background: '#ffffff', borderRadius: '14px', padding: '20px 24px',
                border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', maxWidth: '100%',
              }}>
                <div style={{ display: 'flex', gap: '6px', minWidth: '520px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: '32px', fontSize: '9px', fontWeight: 700, color: '#94a3b8', textAlign: 'right', paddingBottom: '20px' }}>
                    <span>{maxDayPax}</span>
                    <span>{Math.round(maxDayPax * 0.75)}</span>
                    <span>{Math.round(maxDayPax * 0.5)}</span>
                    <span>{Math.round(maxDayPax * 0.25)}</span>
                    <span style={{ color: '#cbd5e1' }}>0</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '160px', position: 'relative' }}>
                      {[25, 50, 75].map(pct => (
                        <div key={pct} style={{
                          position: 'absolute', left: 0, right: 0, bottom: `${pct}%`,
                          height: '1px', borderTop: '1px dashed #e2e8f0', pointerEvents: 'none', opacity: 0.5,
                        }} />
                      ))}
                      {dayList.map((dateObj) => {
                        const pad2 = (n) => String(n).padStart(2, '0');
                        const dStr = `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;
                        const pax = dayPax[dStr] || 0;
                        const pct = (pax / maxDayPax) * 100;
                        const now = new Date();
                        const isToday = dStr === `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
                        const dayNum = dateObj.getDate();
                        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                        return (
                          <div key={dStr} title={`${dStr}: ${pax} PAX (${dayEvents[dStr] || 0} eventos)`} style={{
                            flex: '1 1 0', minWidth: '8px', height: '100%',
                            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                            alignItems: 'center', position: 'relative', cursor: 'help',
                          }}>
                            <div style={{
                              width: '100%', maxWidth: '36px',
                              height: `${Math.max(pct > 0 ? Math.max(4, pct) : 2, 0)}%`,
                              background: pax > 0
                                ? 'linear-gradient(180deg, #2563eb, #1e40af)'
                                : '#f1f5f9',
                              borderRadius: '3px 3px 0 0',
                              transition: 'height 0.3s ease',
                              minHeight: pax > 0 ? '4px' : '2px',
                              opacity: isToday ? 1 : 0.85,
                              boxShadow: isToday ? '0 0 8px #2563eb50' : 'inset 0 1px 0 rgba(0,0,0,0.05)',
                              position: 'relative',
                            }}>
                              {pax > 0 && (
                                <span style={{
                                  position: 'absolute',
                                  top: pct >= 20 ? '4px' : `-${Math.max(14, pct * 0.4 + 6)}px`,
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  fontSize: '9px', fontWeight: 900,
                                  color: pct >= 20 ? '#fff' : '#1e40af',
                                  textShadow: pct >= 20 ? '0 1px 3px rgba(0,0,0,0.5)' : 'none',
                                  whiteSpace: 'nowrap',
                                  background: pct < 20 ? '#ffffff' : 'transparent',
                                  padding: pct < 20 ? '0 3px' : '0',
                                  borderRadius: pct < 20 ? '3px' : '0',
                                }}>{pax}</span>
                              )}
                            </div>
                            <div style={{
                              fontSize: isToday ? '8px' : '7px', fontWeight: isToday ? 900 : 600,
                              color: isToday ? '#1d4ed8' : isWeekend ? '#94a3b8' : '#64748b',
                              marginTop: '3px', lineHeight: 1, whiteSpace: 'nowrap',
                            }}>{dayNum}</div>
                            {isToday && <div style={{ fontSize: '6px', fontWeight: 900, color: '#1d4ed8', lineHeight: 1, marginTop: '1px' }}>HOY</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '9px', fontWeight: 600, color: '#94a3b8', paddingLeft: '38px' }}>
                  {dayList.length > 0 && <span>{dayList[0].toLocaleDateString('es', { month: 'short', day: 'numeric' })}</span>}
                  {dayList.length > 10 && <span>{dayList[Math.floor(dayList.length / 2)].toLocaleDateString('es', { month: 'short', day: 'numeric' })}</span>}
                  {dayList.length > 0 && <span>{dayList[dayList.length - 1].toLocaleDateString('es', { month: 'short', day: 'numeric' })}</span>}
                </div>
              </div>
            </section>
          );
        })()}

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
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div className="reports-chart-title" style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Áreas más utilizadas</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                  <strong style={{ color: '#0f172a', fontSize: '13px' }}>{salonData?.grandTotal || 0}</strong> confirmados
                </div>
              </div>
              <div className="reports-chart-subtitle">Salones en eventos confirmados del periodo</div>
              {salonData && salonData.rows.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                  {salonData.rows.map((row) => {
                    const barColor =
                      row.rank === 1 ? '#118895' :
                      row.rank === 2 ? '#0d6b76' :
                      row.rank === 3 ? '#c9a961' :
                      row.rank === 4 ? '#5b95f0' :
                      row.rank === 5 ? '#9b5de5' :
                      '#94a3b8';
                    return (
                      <div
                        key={row.label}
                        title={`${row.label}: ${row.count} confirmados (${row.pct.toFixed(1)}%)`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '24px minmax(110px, 1fr) 60px 56px',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: row.rank === 1 ? '#f0fdfa' : '#f8fafc',
                          border: row.rank === 1 ? '1px solid #11889533' : '1px solid transparent',
                          transition: 'background 0.15s',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = row.rank === 1 ? '#ccfbf1' : '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = row.rank === 1 ? '#f0fdfa' : '#f8fafc'}
                      >
                        <div style={{
                          fontSize: '11px', fontWeight: 800,
                          color: row.rank <= 3 ? '#0f172a' : '#94a3b8',
                          textAlign: 'center',
                          fontVariantNumeric: 'tabular-nums',
                        }}>#{row.rank}</div>
                        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{
                            fontSize: '12px', fontWeight: 700,
                            color: '#1e293b',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{row.label}</div>
                          <div style={{
                            height: '6px', borderRadius: '999px',
                            background: '#e2e8f0', overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${row.pct}%`,
                              background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
                              borderRadius: '999px',
                              transition: 'width 0.4s ease',
                            }} />
                          </div>
                        </div>
                        <div style={{
                          fontSize: '12px', fontWeight: 800,
                          color: '#0f172a',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}>{row.count}</div>
                        <div style={{
                          fontSize: '11px', fontWeight: 700,
                          color: row.rank <= 3 ? barColor : '#64748b',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}>{row.pct.toFixed(1)}%</div>
                      </div>
                    );
                  })}
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
                  <div style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center', fontWeight: 600, marginBottom: '8px' }}>
                    <span style={{ color: '#16a34a', fontWeight: 800 }}>{s.confirmed}</span> de {s.total} confirmados
                  </div>
                  {/* Desglose por estado: count + dinero */}
                  {s.breakdown.length > 0 && (
                    <div style={{
                      width: '100%', paddingTop: '8px', marginTop: '4px',
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex', flexDirection: 'column', gap: '5px',
                    }}>
                      {s.breakdown.map(b => {
                        const isConfirmado = b.statusKey === STATUS.CONFIRMADO;
                        return (
                        <div key={b.statusKey} style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr auto auto',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '10px',
                          fontWeight: 600,
                        }}>
                          <span style={{
                            width: '7px', height: '7px', borderRadius: '50%',
                            background: b.color, display: 'inline-block', flexShrink: 0,
                            boxShadow: `0 0 0 1.5px ${b.color}30`,
                          }} />
                          <span style={{
                            color: '#475569',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', minWidth: 0,
                          }} title={b.label}>
                            {b.shortLabel || b.label}
                          </span>
                          <span style={{
                            background: isConfirmado ? '#dcfce7' : '#f1f5f9',
                            color: isConfirmado ? '#15803d' : '#0f172a',
                            fontWeight: 800,
                            fontSize: '10px',
                            fontVariantNumeric: 'tabular-nums',
                            padding: '2px 7px',
                            borderRadius: '999px',
                            minWidth: '22px',
                            textAlign: 'center',
                            border: isConfirmado ? '1px solid #86efac' : '1px solid transparent',
                          }} title={`${b.count} evento${b.count !== 1 ? 's' : ''} en estado ${b.label}`}>
                            {b.count}
                          </span>
                          <span style={{
                            color: '#0f172a', fontWeight: 800,
                            fontSize: '9.5px',
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                            textAlign: 'right',
                            minWidth: '52px',
                          }}>
                            {formatMoneyGT(b.amount)}
                          </span>
                        </div>
                      );})}
                    </div>
                  )}
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
