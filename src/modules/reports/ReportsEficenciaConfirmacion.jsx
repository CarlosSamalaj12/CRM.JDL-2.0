import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../../utils/numberToWords';
import { getEquipos } from '../../services/api.js';
import ReportInfo from './components/ReportInfo';
import MultiSelect from './components/MultiSelect';

// ── Minimalist Vector Icons ──
function IconTrendingUp({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
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

function IconClock({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconTarget({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconAward({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
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

const PENDING_STATUSES = [
  'Reserva sin Cotizacion', '1er Cotizacion', 'Seguimiento',
  'Lista de Espera', 'Pre reserva'
];
const PENDING_STATUS_SET = new Set(PENDING_STATUSES);

// Temas vectoriales limpios para equipos
const TEAM_THEMES = [
  { color: '#10b981', bg: '#dcfce7', textColor: '#065f46', icon: 'trending-up' },
  { color: '#3b82f6', bg: '#dbeafe', textColor: '#1e40af', icon: 'users' },
  { color: '#8b5cf6', bg: '#ede9fe', textColor: '#5b21b6', icon: 'award' },
  { color: '#f59e0b', bg: '#fef3c7', textColor: '#92400e', icon: 'target' },
  { color: '#ec4899', bg: '#fce7f3', textColor: '#9d174d', icon: 'clock' },
  { color: '#06b6d4', bg: '#cffafe', textColor: '#155e75', icon: 'users' },
];

function TeamThemeIcon({ icon, size = 20, color = 'currentColor' }) {
  if (icon === 'trending-up') return <IconTrendingUp size={size} color={color} />;
  if (icon === 'award') return <IconAward size={size} color={color} />;
  if (icon === 'target') return <IconTarget size={size} color={color} />;
  if (icon === 'clock') return <IconClock size={size} color={color} />;
  return <IconUsers size={size} color={color} />;
}

function getLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthName(m) {
  return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m] || '';
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export default function ReportsEficenciaConfirmacion({ onClose }) {
  const { events, users } = useOutletContext();
  const sellerUsers = useMemo(() => (users || []).filter(u => {
    const r = String(u.role || '').toLowerCase();
    return r === 'vendedor' || r === 'admin';
  }).sort((a, b) => (a.fullName || a.name || '').localeCompare(b.fullName || b.name || '')), [users]);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [fromDate, setFromDate] = useState(getLocalDateStr(firstOfMonth));
  const [toDate, setToDate] = useState(getLocalDateStr(lastOfMonth));
  const [sortBy, setSortBy] = useState('name');
  const [userFilter, setUserFilter] = useState(new Set());
  const [equipos, setEquipos] = useState([]);

  // Cargar equipos
  useEffect(() => {
    (async () => {
      try {
        const data = await getEquipos();
        setEquipos(Array.isArray(data) ? data : (data?.equipos || []));
      } catch (err) {
        console.warn('No se pudieron cargar los equipos:', err);
        setEquipos([]);
      }
    })();
  }, []);

  // ── Generate months ──
  const monthList = useMemo(() => {
    const months = [];
    const start = new Date(fromDate + 'T00:00:00');
    const end = new Date(toDate + 'T00:00:00');
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      months.push({
        key: `${y}-${String(m + 1).padStart(2, '0')}`,
        year: y,
        month: m,
        monthName: getMonthName(m),
        monthShort: getMonthName(m).substring(0, 3),
        daysInMonth: daysInMonth(y, m),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }, [fromDate, toDate]);

  // ── Helper: calcula datos para un grupo de usuarios (un equipo) ──
  const computeTeamUserData = useCallback((teamUsers, filterSet) => {
    if (!events || !monthList.length) return [];

    const from = monthList[0].key + '-01';
    const to = monthList[monthList.length - 1].key + '-' + String(monthList[monthList.length - 1].daysInMonth).padStart(2, '0');
    const validUserIds = new Set(teamUsers.map(u => String(u.id)));

    const userAgg = {};
    const seenReservations = new Set();

    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) continue;
      const status = String(ev.status || '').trim();
      const isConfirmed = status === 'Confirmado';
      const isPending = PENDING_STATUS_SET.has(status);
      if (!isConfirmed && !isPending) continue;

      const userId = String(ev.userId || '').trim();
      if (!userId) continue;
      if (!validUserIds.has(userId)) continue;
      if (filterSet.size > 0 && !filterSet.has(userId)) continue;

      const groupKey = ev.groupId || ev.id;
      if (seenReservations.has(groupKey)) continue;
      seenReservations.add(groupKey);

      const amount = Math.max(0, Number(ev.quote?.total || 0));

      if (!userAgg[userId]) {
        userAgg[userId] = { count: 0, totalAmount: 0, pendingCount: 0, pendingAmount: 0 };
      }
      if (isConfirmed) {
        userAgg[userId].count += 1;
        userAgg[userId].totalAmount += amount;
      } else if (isPending) {
        userAgg[userId].pendingCount += 1;
        userAgg[userId].pendingAmount += amount;
      }
    }

    const teamUserIds = Object.keys(userAgg);
    const totalAmountAll = teamUserIds.reduce((sum, id) => sum + userAgg[id].totalAmount, 0);

    const result = teamUserIds.map(userId => {
      const user = teamUsers.find(u => String(u.id) === userId);
      const name = user?.fullName || user?.name || userId;
      const agg = userAgg[userId];
      return {
        userId,
        name,
        count: agg.count,
        totalAmount: agg.totalAmount,
        pendingCount: agg.pendingCount,
        pendingAmount: agg.pendingAmount,
        pct: totalAmountAll > 0 ? (agg.totalAmount / totalAmountAll) * 100 : 0,
        avgAmount: agg.count > 0 ? agg.totalAmount / agg.count : 0,
      };
    });

    result.sort((a, b) => {
      if (sortBy === 'amount') return b.totalAmount - a.totalAmount;
      if (sortBy === 'events') return b.count - a.count;
      return (a.name || '').localeCompare(b.name || '');
    });

    return result;
  }, [events, monthList, sortBy]);

  // ── Equipos agrupados con sus datos ──
  const teamData = useMemo(() => {
    if (!users || users.length === 0) return [];

    // Map de equipos
    const equipoById = new Map();
    for (const eq of equipos) {
      const id = String(eq.id ?? eq.equipo_id ?? '').trim();
      if (id) {
        equipoById.set(id, {
          id,
          nombre: eq.nombre || eq.name || 'Sin nombre',
          descripcion: eq.descripcion || eq.description || ''
        });
      }
    }

    // Agrupa usuarios por teamId
    const groupsMap = new Map();
    for (const u of users) {
      const role = String(u.role || '').toLowerCase();
      if (role !== 'vendedor' && role !== 'admin' && role !== '') continue;
      const tid = u.teamId != null ? String(u.teamId) : '__no_team__';
      if (!groupsMap.has(tid)) groupsMap.set(tid, []);
      groupsMap.get(tid).push(u);
    }

    const teamList = [];

    // Equipos conocidos
    for (const eq of equipos) {
      const tid = String(eq.id);
      const members = groupsMap.get(tid) || [];
      if (members.length === 0) continue;
      const theme = TEAM_THEMES[teamList.length % TEAM_THEMES.length];
      const userRows = computeTeamUserData(members, userFilter);
      const totalConfirmed = userRows.reduce((s, r) => s + r.count, 0);
      const totalAmount = userRows.reduce((s, r) => s + r.totalAmount, 0);
      const totalPending = userRows.reduce((s, r) => s + r.pendingCount, 0);
      const totalPendingAmount = userRows.reduce((s, r) => s + r.pendingAmount, 0);
      const maxAmount = userRows.length > 0 ? Math.max(...userRows.map(r => r.totalAmount + r.pendingAmount)) : 0;

      if (userRows.length > 0) {
        teamList.push({
          id: tid,
          name: eq.nombre || 'Sin nombre',
          descripcion: eq.descripcion || '',
          theme,
          members,
          userRows,
          totalConfirmed,
          totalAmount,
          totalPending,
          totalPendingAmount,
          maxAmount: Math.max(maxAmount, 1),
          userCount: members.length,
        });
      }
      groupsMap.delete(tid);
    }

    // Usuarios sin equipo
    if (groupsMap.has('__no_team__')) {
      const members = groupsMap.get('__no_team__');
      const theme = TEAM_THEMES[teamList.length % TEAM_THEMES.length];
      const userRows = computeTeamUserData(members, userFilter);
      const totalConfirmed = userRows.reduce((s, r) => s + r.count, 0);
      const totalAmount = userRows.reduce((s, r) => s + r.totalAmount, 0);
      const totalPending = userRows.reduce((s, r) => s + r.pendingCount, 0);
      const totalPendingAmount = userRows.reduce((s, r) => s + r.pendingAmount, 0);
      const maxAmount = userRows.length > 0 ? Math.max(...userRows.map(r => r.totalAmount + r.pendingAmount)) : 0;

      if (userRows.length > 0) {
        teamList.push({
          id: '__no_team__',
          name: 'Sin equipo asignado',
          descripcion: 'Vendedores sin equipo configurado',
          theme,
          members,
          userRows,
          totalConfirmed,
          totalAmount,
          totalPending,
          totalPendingAmount,
          maxAmount: Math.max(maxAmount, 1),
          userCount: members.length,
        });
      }
      groupsMap.delete('__no_team__');
    }

    return teamList;
  }, [users, equipos, computeTeamUserData, userFilter]);

  // Totales globales
  const totalConfirmedEvents = teamData.reduce((s, t) => s + t.totalConfirmed, 0);
  const totalAmount = teamData.reduce((s, t) => s + t.totalAmount, 0);
  const totalPendingEvents = teamData.reduce((s, t) => s + t.totalPending, 0);
  const totalPendingAmount = teamData.reduce((s, t) => s + t.totalPendingAmount, 0);
  const globalMaxAmount = teamData.length > 0 ? Math.max(...teamData.map(t => t.maxAmount)) : 1;

  const handleReset = () => {
    const t = new Date();
    setFromDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth(), 1)));
    setToDate(getLocalDateStr(new Date(t.getFullYear(), t.getMonth() + 1, 0)));
  };

  const setPreset = (preset) => {
    const n = new Date();
    if (preset === 'thisMonth') {
      setFromDate(getLocalDateStr(new Date(n.getFullYear(), n.getMonth(), 1)));
      setToDate(getLocalDateStr(new Date(n.getFullYear(), n.getMonth() + 1, 0)));
    } else if (preset === 'lastMonth') {
      setFromDate(getLocalDateStr(new Date(n.getFullYear(), n.getMonth() - 1, 1)));
      setToDate(getLocalDateStr(new Date(n.getFullYear(), n.getMonth(), 0)));
    } else if (preset === 'last3Months') {
      setFromDate(getLocalDateStr(new Date(n.getFullYear(), n.getMonth() - 2, 1)));
      setToDate(getLocalDateStr(new Date(n.getFullYear(), n.getMonth() + 1, 0)));
    } else if (preset === 'year') {
      setFromDate(getLocalDateStr(new Date(n.getFullYear(), 0, 1)));
      setToDate(getLocalDateStr(new Date(n.getFullYear(), 11, 31)));
    }
  };

  const getBarColor = (pct) => {
    if (pct >= 40) return '#10b981';
    if (pct >= 20) return '#3b82f6';
    if (pct >= 10) return '#60a5fa';
    return '#a5b4fc';
  };

  const getBarColorPending = (pct) => {
    if (pct >= 40) return '#f59e0b';
    if (pct >= 20) return '#fbbf24';
    return '#fcd34d';
  };

  const sectionStyle = (delay) => ({
    opacity: 1,
    transition: `opacity 0.4s ease ${delay}ms`,
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
            <div className="reports-title">Eficiencia de Confirmación de Eventos</div>
            <div className="reports-subtitle">Eventos confirmados por vendedor · Montos en Quetzales · Porcentajes</div>
          </div>
        </div>
        <ReportInfo reportKey="eficienciaConfirmacion" />
        <button className="btn-exit" type="button" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconChevronLeft size={16} />
          Volver
        </button>
      </div>

      <div className="reports-page-body">
        {/* ── 4 Tarjetas KPI Ejecutivas ── */}
        <section className="reports-hero-panel" style={{ gap: '16px', ...sectionStyle(50) }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            width: '100%',
          }}>
            {/* Card 1: Confirmados */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Confirmados
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconTrendingUp size={16} color="#059669" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#059669', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {formatMoney(totalAmount)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {totalConfirmedEvents} eventos cerrados
              </div>
            </div>

            {/* Card 2: Pendientes */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pendientes (Pipeline)
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconClock size={16} color="#d97706" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#d97706', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {formatMoney(totalPendingAmount)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {totalPendingEvents} eventos en seguimiento
              </div>
            </div>

            {/* Card 3: Tasa de Cierre */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Tasa de Cierre
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconTarget size={16} color="#2563eb" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#2563eb', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {(totalAmount + totalPendingAmount) > 0 ? ((totalAmount / (totalAmount + totalPendingAmount)) * 100).toFixed(1) : '0.0'}%
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Conversión sobre monto cotizado
              </div>
            </div>

            {/* Card 4: Fuerza de Ventas */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Fuerza Comercial
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconUsers size={16} color="#7c3aed" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {teamData.reduce((s, t) => s + t.userCount, 0)} <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 600 }}>vendedores</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                En {teamData.length} equipo{teamData.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="reports-toolbar" style={{ gap: '12px', padding: '12px 20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="preset-btn"
                onClick={() => setPreset('thisMonth')}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#ffffff', color: '#334155', cursor: 'pointer'
                }}
              >
                Este Mes
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => setPreset('lastMonth')}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#ffffff', color: '#334155', cursor: 'pointer'
                }}
              >
                Mes Anterior
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => setPreset('last3Months')}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#ffffff', color: '#334155', cursor: 'pointer'
                }}
              >
                Últimos 3M
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => setPreset('year')}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#ffffff', color: '#334155', cursor: 'pointer'
                }}
              >
                Año
              </button>
            </div>

            <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }} />

            <label className="field" style={{ flex: '0 0 142px' }}>
              <span>Desde</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '0 0 142px' }}>
              <span>Hasta</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '0 0 150px' }}>
              <span>Ordenar por</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ fontSize: '11px', fontWeight: 700, padding: '6px 8px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>
                <option value="amount">Monto (Q)</option>
                <option value="events">Cantidad eventos</option>
                <option value="name">Nombre</option>
              </select>
            </label>
            <div className="field" style={{ flex: '1 1 200px', minWidth: '180px' }}>
              <MultiSelect
                selected={userFilter}
                onChange={setUserFilter}
                options={sellerUsers.map(u => ({ value: String(u.id), label: u.fullName || u.name || u.username }))}
                placeholder="Vendedor"
                emptyLabel="Todos"
                searchable
                width="100%"
              />
            </div>
          </div>
        </section>

        {/* ── Secciones por Equipo ── */}
        {teamData.length === 0 ? (
          <section className="reports-hero-panel" style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <IconUsers size={40} color="#94a3b8" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>
              No hay datos de confirmación en este período
            </div>
          </section>
        ) : (
          teamData.map((team, teamIdx) => (
            <section key={team.id} className="reports-hero-panel" style={{ gap: '12px', ...sectionStyle(100 + teamIdx * 50) }}>
              {/* Header del equipo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: team.theme.bg, borderRadius: '10px', border: `1px solid ${team.theme.color}30` }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                  <TeamThemeIcon icon={team.theme.icon} size={20} color={team.theme.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: team.theme.textColor }}>{team.name}</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: team.theme.color }}>{team.userCount} vendedor(es) · {team.totalConfirmed} confirmados · {team.totalPending} pendientes</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669' }}>{formatMoney(team.totalAmount)}</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>confirmado</div>
                </div>
              </div>

              {/* Barras por vendedor */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 8px' }}>
                {team.userRows.map((user, idx) => {
                  const confirmedPct = (user.totalAmount / team.maxAmount) * 100;
                  const pendingPct = (user.pendingAmount / team.maxAmount) * 100;
                  const totalPct = confirmedPct + pendingPct;
                  const userSharePct = team.totalAmount > 0 ? (user.totalAmount / team.totalAmount) * 100 : 0;
                  // Mostrar decimal si es menor a 1%
                  const pctLabel = userSharePct < 1 && userSharePct > 0 
                    ? userSharePct.toFixed(1) + '%' 
                    : (userSharePct < 5 ? userSharePct.toFixed(1) + '%' : Math.round(userSharePct) + '%');
                  return (
                    <div key={user.userId} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Nombre */}
                      <div style={{ width: '110px', flexShrink: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b' }}>{user.count}c · {user.pendingCount}p · {pctLabel}</div>
                      </div>
                      {/* Barra */}
                      <div style={{ flex: 1, position: 'relative', height: '36px', background: '#f1f5f9', borderRadius: '8px', overflow: 'hidden' }}>
                        {/* Barra pendiente (abajo) */}
                        {pendingPct > 0 && (
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            width: `${pendingPct}%`,
                            height: '40%',
                            background: 'repeating-linear-gradient(45deg, #fbbf24, #fbbf24 4px, #f59e0b 4px, #f59e0b 8px)',
                            borderRadius: '0 0 8px 0',
                            transition: 'width 0.5s ease',
                          }} />
                        )}
                        {/* Barra confirmado (arriba) */}
                        <div style={{
                          position: 'absolute',
                          bottom: pendingPct > 0 ? '40%' : 0,
                          left: 0,
                          width: `${confirmedPct}%`,
                          height: pendingPct > 0 ? '60%' : '100%',
                          background: `linear-gradient(90deg, ${getBarColor(totalPct)}, ${getBarColor(totalPct)}cc)`,
                          borderRadius: pendingPct > 0 ? '0' : '8px',
                          transition: 'width 0.5s ease',
                          boxShadow: `0 0 8px ${getBarColor(totalPct)}40`,
                        }} />
                        {/* Label del % dentro de la barra */}
                        {confirmedPct > 12 && (
                          <div style={{
                            position: 'absolute',
                            right: '6px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '10px',
                            fontWeight: 800,
                            color: '#0f172a',
                            pointerEvents: 'none',
                          }}>
                            {pctLabel}
                          </div>
                        )}
                      </div>
                      {/* Montos */}
                      <div style={{ width: '150px', flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#059669' }}>{formatMoney(user.totalAmount)}</div>
                        {user.pendingAmount > 0 && (
                          <div style={{ fontSize: '10px', fontWeight: 600, color: '#d97706' }}>+{formatMoney(user.pendingAmount)} pend.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totales del equipo */}
              <div style={{ display: 'flex', gap: '12px', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', marginTop: '4px' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Confirmados</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#059669' }}>{team.totalConfirmed}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Monto Conf.</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#059669' }}>{formatMoney(team.totalAmount)}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Pendientes</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#d97706' }}>{team.totalPending}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Monto Pend.</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#d97706' }}>{formatMoney(team.totalPendingAmount)}</div>
                </div>
              </div>
            </section>
          ))
        )}

        {/* Leyenda */}
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', padding: '16px', color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '12px', background: '#10b981', borderRadius: '3px' }} />
            <span>Confirmado</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '12px', background: 'repeating-linear-gradient(45deg, #fbbf24, #fbbf24 2px, #f59e0b 2px, #f59e0b 4px)', borderRadius: '3px' }} />
            <span>Pendiente</span>
          </div>
        </div>
      </div>
    </div>
  );
}

