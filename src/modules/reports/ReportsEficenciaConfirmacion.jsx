import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../../utils/numberToWords';
import { getEquipos } from '../../services/api.js';
import ReportInfo from './components/ReportInfo';
import MultiSelect from './components/MultiSelect';

const PENDING_STATUSES = [
  'Reserva sin Cotizacion', '1er Cotizacion', 'Seguimiento',
  'Lista de Espera', 'Pre reserva'
];
const PENDING_STATUS_SET = new Set(PENDING_STATUSES);

// Temas de color para equipos
const TEAM_THEMES = [
  { color: '#10b981', bg: '#dcfce7', textColor: '#065f46', icon: '💼' },
  { color: '#3b82f6', bg: '#dbeafe', textColor: '#1e40af', icon: '📞' },
  { color: '#8b5cf6', bg: '#ede9fe', textColor: '#5b21b6', icon: '👑' },
  { color: '#f59e0b', bg: '#fef3c7', textColor: '#92400e', icon: '⭐' },
  { color: '#ec4899', bg: '#fce7f3', textColor: '#9d174d', icon: '🌟' },
  { color: '#06b6d4', bg: '#cffafe', textColor: '#155e75', icon: '💎' },
];

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
            <div className="reports-title">📊 Eficiencia de Confirmación de Eventos</div>
            <div className="reports-subtitle">Eventos confirmados por vendedor · Montos en Quetzales · Porcentajes</div>
          </div>
        </div>
        <ReportInfo reportKey="eficienciaConfirmacion" />
        <button className="btn-exit" type="button" onClick={onClose}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver
        </button>
      </div>

      <div className="reports-page-body">
        {/* ── Hero KPIs ── */}
        <section className="reports-hero-panel" style={sectionStyle(50)}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Confirmación por vendedor</span>
              <h3 className="reports-section-title">Eventos Confirmados × Vendedor</h3>
            </div>
          </div>

          {/* Toolbar */}
          <div className="reports-toolbar" style={{ gap: '16px', padding: '16px 20px', flexWrap: 'wrap' }}>
            <label className="field" style={{ flex: '0 0 148px' }}>
              <span>Desde</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '0 0 148px' }}>
              <span>Hasta</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </label>
            <div className="reports-actions">
              <button type="button" onClick={handleReset}>Mes Actual</button>
            </div>
            <label className="field" style={{ flex: '0 0 160px' }}>
              <span>Ordenar por</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ fontSize: '11px', fontWeight: 700, padding: '6px 8px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>
                <option value="amount">Monto (Q)</option>
                <option value="events">Cantidad eventos</option>
                <option value="name">Nombre</option>
              </select>
            </label>
            <div className="field" style={{ flex: '0 0 240px' }}>
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

          {/* KPIs Globales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', padding: '0 20px 16px' }}>
            <div style={{ background: '#dcfce7', borderRadius: '12px', padding: '14px 18px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', marginBottom: '4px' }}>💚 Confirmados</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#065f46' }}>{totalConfirmedEvents}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>{formatMoney(totalAmount)}</div>
            </div>
            <div style={{ background: '#fef3c7', borderRadius: '12px', padding: '14px 18px', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', marginBottom: '4px' }}>🟡 Pendientes</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#92400e' }}>{totalPendingEvents}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706' }}>{formatMoney(totalPendingAmount)}</div>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px 18px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>👥 Equipos</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>{teamData.length}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{teamData.reduce((s, t) => s + t.userCount, 0)} vendedores</div>
            </div>
          </div>
        </section>

        {/* ── Secciones por Equipo ── */}
        {teamData.length === 0 ? (
          <section className="reports-hero-panel" style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>
              No hay datos de confirmación en este período
            </div>
          </section>
        ) : (
          teamData.map((team, teamIdx) => (
            <section key={team.id} className="reports-hero-panel" style={{ gap: '12px', ...sectionStyle(100 + teamIdx * 50) }}>
              {/* Header del equipo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: team.theme.bg, borderRadius: '10px', border: `1px solid ${team.theme.color}30` }}>
                <span style={{ fontSize: '24px' }}>{team.theme.icon}</span>
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

