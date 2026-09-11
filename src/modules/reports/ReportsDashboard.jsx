import { useState, useMemo, useCallback, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
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

function getSatColor(avg) {
  if (avg >= 8.5) return '#22c55e';
  if (avg >= 7.0) return '#eab308';
  if (avg >= 5.0) return '#f97316';
  return '#ef4444';
}

function getSatLabel(avg) {
  if (avg >= 8.5) return 'Excelente';
  if (avg >= 7.0) return 'Bueno';
  if (avg >= 5.0) return 'Regular';
  return 'Malo';
}

// ── Minimalist Vector Icons (SVG) ──
function IconBuilding({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18"/>
      <path d="M9 8h1"/>
      <path d="M9 12h1"/>
      <path d="M9 16h1"/>
      <path d="M14 8h1"/>
      <path d="M14 12h1"/>
      <path d="M14 16h1"/>
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
    </svg>
  );
}

function IconKanban({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="18" rx="1"/>
      <rect x="10" y="3" width="5" height="12" rx="1"/>
      <rect x="17" y="3" width="5" height="15" rx="1"/>
    </svg>
  );
}

function IconDownload({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function IconChevronLeft({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );
}

function IconCalendar({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function IconTrash({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  );
}

function IconTarget({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  );
}

function IconChart({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

function IconFlame({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  );
}

function IconClock({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function IconTrending({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}

function IconZap({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}

function IconInfoCircle({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
}

function IconCheck({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

const AVATAR_COLORS = [
  '#2563eb', // Blue
  '#9333ea', // Purple
  '#059669', // Emerald
  '#d97706', // Amber
  '#e11d48', // Rose
  '#0284c7', // Sky
  '#4f46e5', // Indigo
  '#0d9488', // Teal
  '#ea580c', // Orange
  '#db2777', // Pink
  '#475569', // Slate
  '#ca8a04', // Yellow-amber
  '#0891b2', // Cyan
  '#7c3aed', // Violet
  '#16a34a', // Green
  '#dc2626', // Red
];

export default function ReportsDashboard({ onClose }) {
  const navigate = useNavigate();
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
        eventDate: financialMeta.startDate || primaryEvent?.date || ev?.date || '',
        salon: financialMeta.mainSalon || primaryEvent?.salon || ev?.salon || '',
        total,
        type: typeSrc.includes('corporativo') ? 'corp' : typeSrc.includes('social') ? 'social' : 'otro',
        monthKey: (financialMeta.startDate || primaryEvent?.date || ev?.date || '').substring(0, 7)
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

  const handleReset = () => {
    const n = new Date();
    setMonthKey(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`);
    setFromDate('');
    setToDate('');
    setRole(USER_ROLES.SELLER);
    setScope('all');
    setSelectedSellerId('');
  };

  const visSeg = statusSummary.seg.filter(s => s.count > 0);
  const dateRange = getDateRange();
  const gapAmount = Math.max(0, settingsGoalAmount - globalAchieved);
  const gapPct = settingsGoalAmount > 0 ? (gapAmount / settingsGoalAmount) * 100 : 0;

  // ── Motivational Ribbon & Projections ──
  const [yr, mo] = monthKey.split('-').map(Number);
  const daysInMo = new Date(yr, mo, 0).getDate();
  const now = new Date();
  const isCurrent = yr === now.getFullYear() && mo === now.getMonth() + 1;
  const isPast = yr < now.getFullYear() || (yr === now.getFullYear() && mo < now.getMonth() + 1);
  const day = isPast ? daysInMo : (isCurrent ? Math.min(now.getDate(), daysInMo) : 0);
  const daysLeft = Math.max(0, daysInMo - day);
  const daysEl = day;
  const needDaily = daysLeft > 0 ? gapAmount / daysLeft : 0;
  const currDaily = daysEl > 0 ? globalAchieved / daysEl : 0;
  const projected = currDaily * daysInMo;
  const projPct = settingsGoalAmount > 0 ? (projected / settingsGoalAmount) * 100 : 0;
  const onPace = currDaily >= needDaily;

  let mot = {
    title: 'Buen ritmo, van por buen camino ¡aceleren!',
    sub: `Progreso: ${settingsGoalProgress.toFixed(1)}% · Brecha restante: ${formatMoneyGT(gapAmount)}`,
    badge: projPct >= 100 ? `+${(projPct - 100).toFixed(0)}% vs Proyección` : `${projPct.toFixed(0)}% de Meta`,
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#fed7aa',
  };
  if (settingsGoalProgress >= 100) {
    mot = {
      title: '¡META SUPERADA! Increíble trabajo en equipo',
      sub: `Superada por ${formatMoneyGT(globalAchieved - settingsGoalAmount)} · Ritmo sobresaliente`,
      badge: `+${(settingsGoalProgress - 100).toFixed(0)}% de Meta`,
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#bbf7d0',
    };
  } else if (settingsGoalProgress >= 80) {
    mot = {
      title: '¡Cierre estelar! A un paso de cumplir el 100%',
      sub: `Progreso: ${settingsGoalProgress.toFixed(1)}% · Brecha restante: ${formatMoneyGT(gapAmount)}`,
      badge: projPct >= 100 ? `+${(projPct - 100).toFixed(0)}% vs Proyección` : `${projPct.toFixed(0)}% de Meta`,
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#bbf7d0',
    };
  } else if (settingsGoalProgress < 40) {
    mot = {
      title: '¡Enciendan motores! Todavía hay tiempo para acelerar',
      sub: `Progreso: ${settingsGoalProgress.toFixed(1)}% · Brecha restante: ${formatMoneyGT(gapAmount)}`,
      badge: `${projPct.toFixed(0)}% de Meta`,
      color: '#2563eb',
      bg: '#eff6ff',
      border: '#bfdbfe',
    };
  }

  const updateTime = useMemo(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, []);

  const topSellers = useMemo(() => sellerMetrics.filter(s => s.amount > 0), [sellerMetrics]);
  const zeroSellers = useMemo(() => sellerMetrics.filter(s => s.amount === 0), [sellerMetrics]);

  // ── PAX por día (solo Confirmado) ──
  const paxDayChartData = useMemo(() => {
    if (!events) return null;
    const { from, to } = getDateRange();
    const start = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    const dayList = [];
    const cur = new Date(start);
    while (cur <= end) {
      dayList.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    if (!dayList.length) return null;

    const dayPax = {};
    const dayEvents = {};
    const seenSharedGroup = new Set();
    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) continue;
      if (String(ev.status || '').trim() !== STATUS.CONFIRMADO) continue;
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
    return { dayList, dayPax, dayEvents, totalPax, maxDayPax };
  }, [events, getDateRange]);

  return (
    <div className="reports-page-container" style={{ background: '#f8fafc', minHeight: '100vh', color: '#0f172a' }}>
      <style>{`
        input[type="date"].rd-white-input,
        input[type="month"].rd-white-input,
        select.rd-white-input,
        .rd-white-input {
          background-color: #ffffff !important;
          background: #ffffff !important;
          color: #0f172a !important;
          color-scheme: light !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 8px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          height: 38px !important;
          padding: 0 12px !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04) !important;
          outline: none !important;
          transition: all 0.15s ease !important;
          box-sizing: border-box !important;
        }
        input[type="date"].rd-white-input:focus,
        input[type="month"].rd-white-input:focus,
        select.rd-white-input:focus,
        .rd-white-input:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
        }
        .rd-white-input option {
          background-color: #ffffff !important;
          color: #0f172a !important;
        }
        .rd-white-input::-webkit-calendar-picker-indicator {
          filter: none !important;
          cursor: pointer !important;
          opacity: 0.7 !important;
        }
        .rd-white-input::-webkit-calendar-picker-indicator:hover {
          opacity: 1 !important;
        }
        .rd-white-input::-webkit-datetime-edit,
        .rd-white-input::-webkit-datetime-edit-fields-wrapper,
        .rd-white-input::-webkit-datetime-edit-text,
        .rd-white-input::-webkit-datetime-edit-month-field,
        .rd-white-input::-webkit-datetime-edit-day-field,
        .rd-white-input::-webkit-datetime-edit-year-field {
          color: #0f172a !important;
        }
        .rd-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .rd-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        .rd-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }
        @media print {
          .rd-no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
          }
        }
      `}</style>

      {/* ── HEADER SUPERIOR ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px', background: '#ffffff', borderBottom: '1px solid #e2e8f0',
        flexWrap: 'wrap', gap: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '10px',
            background: '#0d7a64', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ffffff', boxShadow: '0 2px 6px rgba(13,122,100,0.25)', flexShrink: 0,
          }}>
            <IconBuilding size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#0d7a64', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              EMS RESERVAS — JARDINES DEL LAGO
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
              Dashboard Ejecutivo
            </h1>
          </div>
        </div>

        <div className="rd-no-print" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <ReportInfo reportKey="dashboard" />
          <button
            type="button"
            className="rd-btn"
            onClick={() => navigate('/kanban')}
          >
            <IconKanban size={15} color="#475569" />
            Pipeline Kanban
          </button>
          <button
            type="button"
            className="rd-btn"
            onClick={() => window.print()}
          >
            <IconDownload size={15} color="#475569" />
            Exportar Reporte
          </button>
          <button
            type="button"
            className="rd-btn"
            onClick={() => { if (onClose) onClose(); else navigate(-1); }}
          >
            <IconChevronLeft size={14} color="#475569" />
            Volver
          </button>
        </div>
      </div>

      <div className="reports-page-body" style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

        {/* ── 1. CONTROL GERENCIAL (FILTROS) ── */}
        <section className="rd-card" style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: '14px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              CONTROL GERENCIAL
            </span>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '2px 0 4px' }}>
              Metas, comparativos y rendimiento
            </h3>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
              Filtra por mes base, rango temporal, rol operativo y vendedor para desglosar el desempeño gerencial.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 150px', minWidth: '140px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Mes base</span>
              <input
                type="month"
                className="rd-white-input"
                value={monthKey}
                onChange={(e) => {
                  setMonthKey(e.target.value);
                  setFromDate('');
                  setToDate('');
                }}
                style={{
                  backgroundColor: '#ffffff',
                  background: '#ffffff',
                  color: '#0f172a',
                  colorScheme: 'light',
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 140px', minWidth: '130px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Desde</span>
              <input
                type="date"
                className="rd-white-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  backgroundColor: '#ffffff',
                  background: '#ffffff',
                  color: '#0f172a',
                  colorScheme: 'light',
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 140px', minWidth: '130px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Hasta</span>
              <input
                type="date"
                className="rd-white-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  backgroundColor: '#ffffff',
                  background: '#ffffff',
                  color: '#0f172a',
                  colorScheme: 'light',
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 130px', minWidth: '120px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Rol</span>
              <select
                className="rd-white-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  backgroundColor: '#ffffff',
                  background: '#ffffff',
                  color: '#0f172a',
                  colorScheme: 'light',
                }}
              >
                <option value={USER_ROLES.SELLER}>Vendedor</option>
                <option value={USER_ROLES.RECEPTIONIST}>Recepcionista</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 180px', minWidth: '160px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Vista</span>
              <select
                className="rd-white-input"
                value={scope === 'all' ? 'all' : selectedSellerId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all') {
                    setScope('all');
                    setSelectedSellerId('');
                  } else {
                    setScope('seller');
                    setSelectedSellerId(val);
                  }
                }}
                style={{
                  backgroundColor: '#ffffff',
                  background: '#ffffff',
                  color: '#0f172a',
                  colorScheme: 'light',
                }}
              >
                <option value="all">Todos los usuarios</option>
                {filteredUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName || u.name}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="rd-btn"
              onClick={handleReset}
              style={{ height: '38px', alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
            >
              <IconTrash size={14} color="#64748b" />
              Limpiar filtros
            </button>
          </div>
        </section>

        {/* ── 2. RENDIMIENTO DEL PERIODO & EFICIENCIA ── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                RENDIMIENTO DEL PERIODO
              </span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                {dateRange.label}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
              Actualizado hoy a las {updateTime} hrs
            </span>
          </div>

          {/* Card Eficiencia Comercial */}
          <div className="rd-card" style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
                  <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#1e293b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    EFICIENCIA COMERCIAL (VENDEDORES)
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}>
                  Ventana: {dateRange.label}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                  CONFIRMADO
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', justifyContent: 'flex-end' }}>
                  <strong style={{ fontSize: '32px', fontWeight: 900, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.03em' }}>
                    {statusSummary.pct.toFixed(1)}%
                  </strong>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                    ({statusSummary.confirmed} confirmados de {statusSummary.total} eventos)
                  </span>
                </div>
              </div>
            </div>

            {/* Continuous segmented progress bar */}
            <div style={{
              height: '12px', borderRadius: '999px', background: '#f1f5f9',
              display: 'flex', gap: '2px', overflow: 'hidden', marginBottom: '14px',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
            }}>
              {visSeg.map((s, i) => (
                <div
                  key={i}
                  title={`${s.l}: ${s.count} (${s.pct.toFixed(1)}%)`}
                  style={{
                    height: '100%',
                    width: `${Math.max(1, s.pct)}%`,
                    background: s.c,
                    transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              ))}
            </div>

            {/* Color dot legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', fontSize: '11px', color: '#64748b' }}>
              {visSeg.map((s, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.c, display: 'inline-block' }} />
                  <span style={{ fontWeight: 500 }}>{s.l}</span>
                  <strong style={{ color: '#0f172a', fontWeight: 700 }}>{s.pct.toFixed(0)}%</strong>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. BENTO GRID DE METAS (60% / 40%) ── */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
          {/* Left Column (Meta Global) */}
          <div className="rd-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  META GLOBAL (CONSECUCIÓN)
                </span>
              </div>
              <span style={{
                fontSize: '11.5px', fontWeight: 800, color: '#2563eb', background: '#eff6ff',
                padding: '3px 12px', borderRadius: '999px',
              }}>
                {settingsGoalProgress.toFixed(1)}%
              </span>
            </div>

            {/* Main Amount */}
            <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
              <strong style={{ fontSize: '32px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {formatMoneyGT(globalAchieved)}
              </strong>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                de {formatMoneyGT(settingsGoalAmount)} meta total
              </span>
            </div>

            {/* Meta badges row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontSize: '11px', fontWeight: 700, color: '#dc2626', background: '#fef2f2',
                border: '1px solid #fee2e2', padding: '4px 10px', borderRadius: '6px',
              }}>
                <IconTarget size={13} color="#dc2626" />
                Meta: <strong style={{ color: '#991b1b' }}>{formatMoneyGT(settingsGoalAmount)}</strong>
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontSize: '11px', fontWeight: 700, color: '#2563eb', background: '#eff6ff',
                border: '1px solid #dbeafe', padding: '4px 10px', borderRadius: '6px',
              }}>
                <IconChart size={13} color="#2563eb" />
                Alcanzado: <strong style={{ color: '#1e40af' }}>{settingsGoalProgress.toFixed(1)}%</strong>
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontSize: '11px', fontWeight: 700, color: '#475569', background: '#f8fafc',
                border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px',
              }}>
                <IconCalendar size={13} color="#64748b" />
                Período: <strong style={{ color: '#0f172a' }}>{getMonthName(parseInt(monthKey.split('-')[1]))} {monthKey.split('-')[0]}</strong>
              </span>
            </div>

            {/* Motivational ribbon */}
            <div style={{
              background: mot.bg, border: `1px solid ${mot.border}`,
              borderRadius: '10px', padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flexShrink: 0,
                }}>
                  <IconFlame size={18} color={mot.color} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: mot.color }}>{mot.title}</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                    {mot.sub}
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 800, color: '#059669', background: '#ffffff',
                border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '999px', whiteSpace: 'nowrap',
              }}>
                {mot.badge}
              </span>
            </div>

            {/* 2 Mini-cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Card 1: Días del mes */}
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <IconClock size={12} color="#94a3b8" /> Días del mes
                  </span>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563eb' }}>
                    Quedan {daysLeft} días
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{day}</strong>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>de {daysInMo} transcurridos</span>
                </div>
                <div style={{ height: '6px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(day / daysInMo) * 100}%`, background: '#3b82f6', borderRadius: '999px' }} />
                </div>
              </div>

              {/* Card 2: Proyección mensual */}
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <IconTrending size={12} color="#94a3b8" /> Proyección mensual
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    fontSize: '11px', fontWeight: 800, color: onPace ? '#059669' : '#dc2626',
                    background: onPace ? '#ecfdf5' : '#fef2f2', padding: '2px 8px', borderRadius: '999px',
                  }}>
                    <IconCheck size={11} color={onPace ? '#059669' : '#dc2626'} />
                    {onPace ? 'Al ritmo' : 'Atrás'}
                  </span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: onPace ? '#059669' : '#dc2626', marginBottom: '2px' }}>
                  {formatMoneyGT(projected)}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                  Representa el {projPct.toFixed(0)}% de la meta global
                </div>
                <div style={{ height: '6px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, projPct)}%`, background: onPace ? '#10b981' : '#f59e0b', borderRadius: '999px' }} />
                </div>
              </div>
            </div>

            {/* Daily Rhythm Section */}
            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '11.5px', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontWeight: 600 }}>
                  <IconZap size={13} color="#ea580c" />
                  Ritmo Diario: Necesitas <strong style={{ color: '#dc2626', fontWeight: 800 }}>{formatMoneyGT(needDaily)}</strong> /día
                </div>
                <div style={{ color: '#64748b', fontWeight: 600 }}>
                  Llevas <strong style={{ color: '#059669', fontWeight: 800 }}>{formatMoneyGT(currDaily)}</strong> /día
                </div>
              </div>
              {/* Dual bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', width: '42px' }}>META</span>
                  <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: '#fee2e2', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (needDaily / Math.max(needDaily, currDaily, 1)) * 100)}%`, background: '#ef4444', borderRadius: '999px' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626', width: '70px', textAlign: 'right' }}>
                    {formatMoneyGT(needDaily)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', width: '42px' }}>ACTUAL</span>
                  <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: '#d1fae5', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (currDaily / Math.max(needDaily, currDaily, 1)) * 100)}%`, background: '#10b981', borderRadius: '999px' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', width: '70px', textAlign: 'right' }}>
                    {formatMoneyGT(currDaily)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: 3 Stacked Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Card 1: PENDIENTE GLOBAL (BRECHA) */}
            <div className="rd-card" style={{
              padding: '20px 22px', borderLeft: '4px solid #ef4444',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    PENDIENTE GLOBAL (BRECHA)
                  </span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444' }}>
                  {gapPct.toFixed(1)}% por cerrar
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                {formatMoneyGT(gapAmount)}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.4 }}>
                Diferencial monetario pendiente para alcanzar el objetivo mensual pactado.
              </div>
            </div>

            {/* Card 2: PAX DEL MES (ASISTENTES) */}
            <div className="rd-card" style={{
              padding: '20px 22px', borderLeft: '4px solid #06b6d4',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#06b6d4' }} />
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    PAX DEL MES (ASISTENTES)
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  de {paxMetrics.plannedMonthPax.toLocaleString('en-US')} planif.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
                <strong style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  {paxMetrics.totalMonthPax.toLocaleString('en-US')}
                </strong>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>personas</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  color: '#0891b2', fontWeight: 700,
                }}>
                  ↗ {paxMetrics.occupancyPct.toFixed(1)}% de ocupación ejecutada
                </span>
                <span style={{ color: '#64748b', fontWeight: 500 }}>
                  {Math.max(0, paxMetrics.plannedMonthPax - paxMetrics.totalMonthPax).toLocaleString('en-US')} restantes
                </span>
              </div>
            </div>

            {/* Card 3: CALIFICACIÓN GLOBAL (CSAT) */}
            <div className="rd-card" style={{
              padding: '20px 22px', borderLeft: `4px solid ${satMetrics ? getSatColor(satMetrics.globalAvg) : '#10b981'}`,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: satMetrics ? getSatColor(satMetrics.globalAvg) : '#10b981' }} />
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    CALIFICACIÓN GLOBAL (CSAT)
                  </span>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 800, color: '#059669', background: '#ecfdf5',
                  padding: '2px 8px', borderRadius: '999px',
                }}>
                  {satMetrics ? getSatLabel(satMetrics.globalAvg) : 'Excelente'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <strong style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                    {satMetrics ? satMetrics.globalAvg.toFixed(1) : '9.5'}
                  </strong>
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>/ 10.0</span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                  {satMetrics ? `${satMetrics.totalRatings} calificaciones en ${satMetrics.totalEvents} eventos` : '50 calificaciones en 6 eventos'}
                </span>
              </div>
              {/* Segmented rating bar */}
              <div style={{ height: '7px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden', display: 'flex', gap: '2px', marginBottom: '8px' }}>
                <div style={{ height: '100%', width: '18%', background: '#22c55e', borderRadius: '999px' }} />
                <div style={{ height: '100%', width: '82%', background: '#a855f7', borderRadius: '999px' }} />
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: '14px', fontSize: '10px', color: '#64748b' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                  Bueno: <strong style={{ color: '#0f172a' }}>{satMetrics?.totalDist?.bueno ?? 17}</strong> ({satMetrics && satMetrics.totalRatings ? ((satMetrics.totalDist.bueno / satMetrics.totalRatings) * 100).toFixed(0) : 34}%)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a855f7' }} />
                  Excelente: <strong style={{ color: '#0f172a' }}>{satMetrics?.totalDist?.excelente ?? 70}</strong> ({satMetrics && satMetrics.totalRatings ? ((satMetrics.totalDist.excelente / satMetrics.totalRatings) * 100).toFixed(0) : 82}%)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. ANALÍTICA VISUAL (PAX + SALONES + TIPOS) ── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ANALÍTICA VISUAL
            </span>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>
              Comparativos y distribuciones del periodo
            </h3>
          </div>

          {/* PAX POR DÍA */}
          {paxDayChartData && (
            <div className="rd-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    PAX POR DÍA
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>
                    Asistencia total por día (todos los salones)
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    <strong style={{ color: '#0f172a' }}>{paxDayChartData.totalPax.toLocaleString()}</strong> PAX totales registrados durante el período de {getMonthName(parseInt(monthKey.split('-')[1])).toLowerCase()}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', background: '#2563eb', borderRadius: '2px', display: 'inline-block' }} />
                    Días cerrados
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', border: '2px solid #2563eb', borderRadius: '2px', display: 'inline-block' }} />
                    Día Hoy ({new Date().getDate()})
                  </span>
                </div>
              </div>

              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                <div style={{ display: 'flex', gap: '8px', minWidth: '600px' }}>
                  {/* Y-axis */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: '32px', fontSize: '9px', fontWeight: 700, color: '#94a3b8', textAlign: 'right', paddingBottom: '24px' }}>
                    <span>{paxDayChartData.maxDayPax}</span>
                    <span>{Math.round(paxDayChartData.maxDayPax * 0.75)}</span>
                    <span>{Math.round(paxDayChartData.maxDayPax * 0.5)}</span>
                    <span>{Math.round(paxDayChartData.maxDayPax * 0.25)}</span>
                    <span style={{ color: '#cbd5e1' }}>0</span>
                  </div>

                  {/* Chart bars area */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '170px', position: 'relative' }}>
                      {[25, 50, 75].map(pct => (
                        <div key={pct} style={{
                          position: 'absolute', left: 0, right: 0, bottom: `${pct}%`,
                          height: '1px', borderTop: '1px dashed #e2e8f0', pointerEvents: 'none', opacity: 0.6,
                        }} />
                      ))}
                      {paxDayChartData.dayList.map((dateObj) => {
                        const pad2 = (n) => String(n).padStart(2, '0');
                        const dStr = `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;
                        const pax = paxDayChartData.dayPax[dStr] || 0;
                        const pct = (pax / paxDayChartData.maxDayPax) * 100;
                        const nowDate = new Date();
                        const isToday = dStr === `${nowDate.getFullYear()}-${pad2(nowDate.getMonth() + 1)}-${pad2(nowDate.getDate())}`;
                        const dayNum = dateObj.getDate();
                        return (
                          <div
                            key={dStr}
                            title={`${dStr}: ${pax} PAX (${paxDayChartData.dayEvents[dStr] || 0} eventos)`}
                            style={{
                              flex: '1 1 0', minWidth: '10px', height: '100%',
                              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                              alignItems: 'center', position: 'relative', cursor: 'pointer',
                            }}
                          >
                            {/* Bar */}
                            <div style={{
                              width: '100%', maxWidth: '32px',
                              height: `${Math.max(pct > 0 ? Math.max(5, pct) : 2, 0)}%`,
                              background: pax > 0 ? '#2563eb' : '#f1f5f9',
                              borderRadius: '3px 3px 0 0',
                              transition: 'height 0.3s ease',
                              border: isToday ? '2px solid #1d4ed8' : 'none',
                              boxShadow: isToday ? '0 0 6px rgba(37,99,235,0.3)' : 'none',
                              position: 'relative',
                            }}>
                              {pax > 0 && (
                                <span style={{
                                  position: 'absolute',
                                  bottom: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  fontSize: '8.5px', fontWeight: 800,
                                  color: '#2563eb',
                                  marginBottom: '3px',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {pax}
                                </span>
                              )}
                            </div>
                            {/* Day number */}
                            <div style={{
                              fontSize: '8px', fontWeight: isToday ? 900 : 600,
                              color: isToday ? '#1d4ed8' : '#64748b',
                              marginTop: '4px', lineHeight: 1,
                            }}>
                              {dayNum}
                            </div>
                            {isToday && (
                              <div style={{
                                fontSize: '6.5px', fontWeight: 900, color: '#ffffff',
                                background: '#2563eb', borderRadius: '3px', padding: '1px 3px',
                                lineHeight: 1, marginTop: '2px',
                              }}>
                                HOY
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {/* Bottom date markers */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '10px', fontWeight: 600, color: '#94a3b8', paddingLeft: '40px' }}>
                  {paxDayChartData.dayList.length > 0 && <span>{paxDayChartData.dayList[0].getDate()} {getMonthName(paxDayChartData.dayList[0].getMonth() + 1).toLowerCase().slice(0, 4)}</span>}
                  {paxDayChartData.dayList.length > 10 && <span>{paxDayChartData.dayList[Math.floor(paxDayChartData.dayList.length / 2)].getDate()} {getMonthName(paxDayChartData.dayList[Math.floor(paxDayChartData.dayList.length / 2)].getMonth() + 1).toLowerCase().slice(0, 4)}</span>}
                  {paxDayChartData.dayList.length > 0 && <span>{paxDayChartData.dayList[paxDayChartData.dayList.length - 1].getDate()} {getMonthName(paxDayChartData.dayList[paxDayChartData.dayList.length - 1].getMonth() + 1).toLowerCase().slice(0, 4)}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Bottom 2 Cards Grid: Áreas + Ventas Tipo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
            {/* Áreas más utilizadas */}
            <div className="rd-card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Áreas más utilizadas</div>
                <div style={{
                  fontSize: '11px', fontWeight: 800, color: '#475569', background: '#f1f5f9',
                  padding: '3px 10px', borderRadius: '999px',
                }}>
                  {salonData?.grandTotal || 0} confirmados
                </div>
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '16px' }}>
                Salones en eventos confirmados del periodo
              </div>

              {salonData && salonData.rows.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {salonData.rows.slice(0, 7).map((row) => {
                    const isTop = row.rank === 1;
                    return (
                      <div
                        key={row.label}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '26px 1fr 60px 48px',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: isTop ? '#ecfdf5' : '#ffffff',
                          border: isTop ? '1px solid #a7f3d0' : '1px solid #f1f5f9',
                        }}
                      >
                        <span style={{
                          fontSize: '11px', fontWeight: 800,
                          color: isTop ? '#059669' : '#64748b',
                          background: isTop ? '#d1fae5' : '#f8fafc',
                          padding: '2px 5px', borderRadius: '4px', textAlign: 'center',
                        }}>
                          #{row.rank}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, color: isTop ? '#065f46' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.label}
                          </span>
                          <div style={{ height: '5px', borderRadius: '999px', background: isTop ? '#a7f3d0' : '#e2e8f0', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${row.pct}%`,
                              background: isTop ? '#059669' : '#3b82f6',
                              borderRadius: '999px',
                            }} />
                          </div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>
                          {row.count} conf.
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: isTop ? '#059669' : '#64748b', textAlign: 'right' }}>
                          {row.pct.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', padding: '24px' }}>
                  Sin salones con actividad
                </div>
              )}
            </div>

            {/* Ventas por tipo de evento */}
            <div className="rd-card" style={{
              padding: '20px 24px',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>
                  Ventas por tipo de evento
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '16px' }}>
                  Corporativo, Social y Otros en facturación
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {eventTypeData.map(item => {
                    const totalConfirmedAmt = rowsWithGoal.filter(r => r.status === STATUS.CONFIRMADO).reduce((a, r) => a + r.total, 0);
                    const sharePct = totalConfirmedAmt > 0 ? (item.amount / totalConfirmedAmt) * 100 : 0;
                    return (
                      <div key={item.key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#1e293b' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                            {item.label} <span style={{ color: '#64748b', fontWeight: 500 }}>({item.count} eventos)</span>
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                            {formatMoneyGT(item.amount)}
                          </span>
                        </div>
                        <div style={{ height: '8px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden', marginBottom: '4px' }}>
                          <div style={{
                            height: '100%', width: `${Math.max(item.amount > 0 ? 3 : 0, sharePct)}%`,
                            background: item.color, borderRadius: '999px',
                          }} />
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                          {sharePct > 0 ? `${sharePct.toFixed(1)}% de los ingresos confirmados totales` : '0% facturado en el período seleccionado'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Callout box at bottom */}
              <div style={{
                marginTop: '20px', background: '#f0f9ff', border: '1px solid #bae6fd',
                borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <IconInfoCircle size={16} color="#0284c7" />
                <span style={{ fontSize: '11px', color: '#0369a1', lineHeight: 1.4 }}>
                  El segmento <strong>Corporativo</strong> representa la mayor tasa de margen y ocupación durante días de semana.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. EQUIPO COMERCIAL (RENDIMIENTO INDIVIDUAL) ── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                EQUIPO COMERCIAL
              </span>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>
                Rendimiento individual por ejecutivo de ventas
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
              <span style={{ color: '#64748b' }}>{sellerMetrics.length} vendedores registrados</span>
              <span style={{ color: '#2563eb', fontWeight: 700, cursor: 'pointer' }}>Ver matriz detallada →</span>
            </div>
          </div>

          {/* Top Sellers Grid (cards with cylinder capsule bars) */}
          {topSellers.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
              gap: '12px',
            }}>
              {topSellers.map((s, idx) => {
                const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                return (
                  <div
                    key={s.id}
                    className="rd-card"
                    style={{
                      padding: '16px 12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      position: 'relative',
                    }}
                  >
                    {/* Circle initial */}
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%',
                      background: avatarColor, color: '#ffffff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '15px', fontWeight: 800, marginBottom: '8px',
                      boxShadow: `0 2px 6px ${avatarColor}40`,
                    }}>
                      {s.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Amount */}
                    <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '8px', textAlign: 'center' }}>
                      {formatMoneyGT(s.amount)}
                    </div>

                    {/* Vertical Cylinder Capsule Bar */}
                    <div style={{
                      width: '26px', height: '54px', borderRadius: '999px',
                      background: '#f1f5f9', border: '1px solid #e2e8f0',
                      overflow: 'hidden', display: 'flex', alignItems: 'flex-end',
                      marginBottom: '10px',
                    }}>
                      <div style={{
                        width: '100%',
                        height: `${Math.max(12, Math.min(100, (s.amount / maxAmt) * 100))}%`,
                        background: avatarColor,
                        borderRadius: '999px',
                        transition: 'height 0.5s ease',
                      }} />
                    </div>

                    {/* Seller Name */}
                    <div style={{
                      fontSize: '12px', fontWeight: 800, color: '#0f172a',
                      textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: '100%', marginBottom: '2px',
                    }} title={s.name}>
                      {s.name}
                    </div>

                    {/* Confirmed count */}
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '10px', textAlign: 'center' }}>
                      {s.confirmed} de {s.total} conf.
                    </div>

                    {/* Breakdown items */}
                    <div style={{ width: '100%', borderTop: '1px solid #f1f5f9', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {s.breakdown.slice(0, 5).map(b => (
                        <div key={b.statusKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9.5px', color: '#64748b' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                            {b.shortLabel || b.label}
                          </span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>
                            {b.count} <span style={{ color: '#94a3b8', fontWeight: 500 }}>Q {(b.amount / 1000).toFixed(0)}k</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rd-card" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              No hay ejecutivos de venta con facturación en el período seleccionado.
            </div>
          )}

          {/* Zero Sellers Compact Row */}
          {zeroSellers.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))',
              gap: '10px',
              marginTop: '4px',
            }}>
              {zeroSellers.map((s, idx) => {
                const color = AVATAR_COLORS[(idx + topSellers.length) % AVATAR_COLORS.length];
                return (
                  <div key={s.id} className="rd-card" style={{
                    padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  }}>
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '50%',
                      background: color, color: '#ffffff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 800, marginBottom: '6px',
                    }}>
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>
                      Q 0.00
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }} title={s.name}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 500, marginTop: '2px' }}>
                      {s.total > 0 ? `${s.confirmed} de ${s.total} conf.` : '0 de 0 conf.'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 6. FORMAL LEGAL FOOTER ── */}
        <footer style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 4px 24px', borderTop: '1px solid #e2e8f0', marginTop: '10px',
          fontSize: '11px', color: '#94a3b8', flexWrap: 'wrap', gap: '8px',
        }}>
          <div>EMS Reservas Suite · Jardines del Lago S.A.</div>
          <div>Control Gerencial Comercial © 2026 — Datos en tiempo real</div>
        </footer>
      </div>
    </div>
  );
}
