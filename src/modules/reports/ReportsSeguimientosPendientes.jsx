import { useState, useMemo, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import ReportInfo from './components/ReportInfo';

// ── Minimalist Vector Icons ──
function IconClock({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

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

function IconTarget({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

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

function IconChevronLeft({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

const PENDING_STATUSES = [
  { key: 'Reserva sin Cotizacion', label: 'Reserva sin Cot.', color: '#00A3FF' },
  { key: '1er Cotizacion', label: '1ra Cotización', color: '#007A64' },
  { key: 'Seguimiento', label: 'Negociación', color: '#FF8C00' },
  { key: 'Lista de Espera', label: 'Lista Espera', color: '#eab308' },
  { key: 'Pre reserva', label: 'Pre-Reserva', color: '#ec4899' },
];

const STATUS_SET = new Set(PENDING_STATUSES.map(s => s.key));

function getStatusMeta(key) {
  return PENDING_STATUSES.find(s => s.key === key);
}

function formatMoneyGT(v) {
  return 'Q ' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReportsSeguimientosPendientes({ onClose }) {
  const { events, users } = useOutletContext();
  const navigate = useNavigate();
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [monthKey, setMonthKey] = useState(defaultMonth);
  const [userIdFilter, setUserIdFilter] = useState(null); // null = todos
  const [hoveredEvent, setHoveredEvent] = useState(null); // { userId, statusKey, evIdx, x, y }
  const [expandedUserId, setExpandedUserId] = useState(null); // which user card is expanded

  const pendingStatusSet = useMemo(() => STATUS_SET, []);

  // ── Aggregate: group pending events by userId, then by status ──
  const { userData, statusTotals, moneyByStatus, totalMoneyAtStake, totalMoneyByUser } = useMemo(() => {
    if (!events || !users) return { userData: [], statusTotals: {}, moneyByStatus: {}, totalMoneyAtStake: 0, totalMoneyByUser: {} };

    const [yr, mo] = monthKey.split('-').map(Number);
    const from = `${monthKey}-01`;
    const to = `${monthKey}-${new Date(yr, mo, 0).getDate()}`;

    const userMap = new Map();
    const accTotals = {};
    const accMoney = {};
    const accMoneyByUser = {};
    let grandTotalMoney = 0;

    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) continue;
      const status = String(ev.status || '').trim();
      if (!pendingStatusSet.has(status)) continue;

      const uid = String(ev.userId || '').trim();
      if (!uid) continue;

      // Calcular dinero cotizado del evento
      const money = Number(ev.quote?.totalGtq || ev.quote?.total || 0);

      if (!userMap.has(uid)) {
        let user = users.find(u => String(u.id) === uid);
        if (!user) {
          user = users.find(u => String(u.id).toLowerCase() === uid.toLowerCase());
        }
        if (!user) {
          console.warn('[SeguimientosPendientes] Usuario no encontrado para userId:', uid, '- disponibles:', users.length, 'usuarios');
        }
        userMap.set(uid, {
          userId: uid,
          name: user?.fullName || user?.name || uid,
          role: user?.role || '',
          events: {},
          moneyByStatus: {},
          total: 0,
          totalMoney: 0,
        });
      }
      const entry = userMap.get(uid);
      if (!entry.events[status]) entry.events[status] = [];
      entry.events[status].push({
        id: ev.id || ev._id,
        name: ev.name || 'Sin nombre',
        date: d,
        salon: ev.salon || ev.nombre_salon || '',
        status,
        pax: ev.pax || 0,
        money,
      });
      entry.total++;
      entry.totalMoney += money;
      entry.moneyByStatus[status] = (entry.moneyByStatus[status] || 0) + money;
      accTotals[status] = (accTotals[status] || 0) + 1;
      accMoney[status] = (accMoney[status] || 0) + money;
      accMoneyByUser[uid] = (accMoneyByUser[uid] || 0) + money;
      grandTotalMoney += money;
    }

    const sorted = Array.from(userMap.values()).sort((a, b) => b.totalMoney - a.totalMoney);

    for (const u of sorted) {
      for (const statusKey of Object.keys(u.events)) {
        u.events[statusKey].sort((a, b) => a.date.localeCompare(b.date));
      }
    }

    return { userData: sorted, statusTotals: accTotals, moneyByStatus: accMoney, totalMoneyAtStake: grandTotalMoney, totalMoneyByUser: accMoneyByUser };
  }, [events, users, monthKey, pendingStatusSet]);

  // ── All vendor users (for the dropdown, even if they have 0 pending) ──
  const allVendors = useMemo(() => {
    return (users || [])
      .filter(u => String(u.role || '').toLowerCase() === 'vendedor')
      .sort((a, b) => (a.fullName || a.name || '').localeCompare(b.fullName || b.name || ''));
  }, [users]);

  // ── Filter by selected user ──
  const filteredUserData = useMemo(() => {
    if (!userIdFilter) return userData;
    return userData.filter(u => u.userId === userIdFilter);
  }, [userData, userIdFilter]);

  const totalPending = useMemo(
    () => filteredUserData.reduce((s, u) => s + u.total, 0),
    [filteredUserData]
  );
  const totalUsers = filteredUserData.length;

  // Reset filter when month changes
  const handleMonthChange = (val) => {
    setMonthKey(val);
    setUserIdFilter(null);
  };

  const handleReset = () => {
    const n = new Date();
    setMonthKey(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`);
  };

  const navigateMonth = (direction) => {
    const [yr, mo] = monthKey.split('-').map(Number);
    const d = new Date(yr, mo - 1 + direction, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setMonthKey(newMonth);
    setUserIdFilter(null);
  };

  const dominantStatus = useMemo(() => {
    let top = null;
    let max = -1;
    for (const s of PENDING_STATUSES) {
      const c = statusTotals[s.key] || 0;
      if (c > max) {
        max = c;
        top = s;
      }
    }
    return top && max > 0 ? { ...top, count: max, money: formatMoneyGT(moneyByStatus[top.key] || 0) } : null;
  }, [statusTotals, moneyByStatus]);

  // Click en un evento → abre el formulario de edición de reserva
  const handleEventClick = useCallback((ev) => {
    if (!ev || !ev.id) return;
    setHoveredEvent(null);
    navigate(`/reserva/${ev.id}`);
  }, [navigate]);

  // Tooltip info for current hover
  const tooltipEvent = useMemo(() => {
    if (!hoveredEvent) return null;
    const user = userData.find(u => u.userId === hoveredEvent.userId);
    if (!user) return null;
    const evs = user.events[hoveredEvent.statusKey];
    if (!evs) return null;
    return evs[hoveredEvent.evIdx] || null;
  }, [hoveredEvent, userData]);

  const sectionStyle = { opacity: 1, transform: 'translateY(0)', transition: 'opacity 0.5s ease' };

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
            <div className="reports-title">Seguimientos Pendientes</div>
            <div className="reports-subtitle">Eventos en pipeline comercial por vendedor · Pre-Reserva · Negociación · 1ra Cotización · Reserva sin Cot. · Lista Espera</div>
          </div>
        </div>
        <ReportInfo reportKey="seguimientos" />
        <button className="btn-exit" type="button" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconChevronLeft size={16} />
          Volver
        </button>
      </div>

      <div className="reports-page-body">
        {/* ── 4 Tarjetas KPI Ejecutivas ── */}
        <section className="reports-hero-panel" style={{ gap: '16px', ...sectionStyle }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            width: '100%',
          }}>
            {/* Card 1: Total Pendientes */}
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
                  Total Pendientes
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconClock size={16} color="#2563eb" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {totalPending} <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 600 }}>eventos</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Prospectos activos en pipeline
              </div>
            </div>

            {/* Card 2: Monto en Juego */}
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
                  Monto en Juego
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconTrendingUp size={16} color="#059669" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#059669', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {formatMoneyGT(totalMoneyAtStake)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Total cotizado en seguimiento
              </div>
            </div>

            {/* Card 3: Vendedores con Pipeline */}
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
                  Vendedores
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconUsers size={16} color="#7c3aed" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {totalUsers} <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 600 }}>{totalUsers === 1 ? 'vendedor' : 'vendedores'}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Gestionando prospectos este mes
              </div>
            </div>

            {/* Card 4: Etapa Dominante */}
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
                  Etapa Dominante
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconTarget size={16} color="#d97706" />
                </div>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: dominantStatus?.color || '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {dominantStatus ? dominantStatus.label : 'Sin pendientes'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {dominantStatus ? `${dominantStatus.count} eventos (${dominantStatus.money})` : 'Pipeline al día'}
              </div>
            </div>
          </div>

          {/* ── Toolbar con Presets ── */}
          <div className="reports-toolbar" style={{ gap: '12px', padding: '12px 20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="preset-btn"
                onClick={() => navigateMonth(-1)}
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
                onClick={() => { handleReset(); setUserIdFilter(null); }}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#ffffff', color: '#334155', cursor: 'pointer'
                }}
              >
                Mes Actual
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => navigateMonth(1)}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '6px 12px',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  background: '#ffffff', color: '#334155', cursor: 'pointer'
                }}
              >
                Próximo Mes
              </button>
            </div>

            <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }} />

            <label className="field" style={{ flex: '0 0 150px', marginBottom: 0 }}>
              <span>Mes</span>
              <input type="month" value={monthKey} onChange={e => handleMonthChange(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '0 0 220px', marginBottom: 0 }}>
              <span>Vendedor</span>
              <select value={userIdFilter || ''} onChange={e => setUserIdFilter(e.target.value || null)}>
                <option value="">Todos los vendedores</option>
                {allVendors.map(v => {
                  const pendingCount = userData.find(u => u.userId === String(v.id))?.total || 0;
                  return (
                    <option key={v.id} value={String(v.id)}>
                      {(v.fullName || v.name)}{pendingCount > 0 ? ` (${pendingCount})` : ''}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        </section>

        {/* ── Legend / Status filter pills ── */}
        <div className="reports-storytelling-card" style={sectionStyle}>
          <div style={{ display: 'flex', gap: '8px', fontSize: '10px', fontWeight: 700, color: '#64748b', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 800, marginRight: '4px' }}>ESTADOS:</span>
            {PENDING_STATUSES.map(s => (
              <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', background: `${s.color}15`, border: `1.5px solid ${s.color}40` }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                {s.label} <strong style={{ color: '#0f172a' }}>{statusTotals[s.key] || 0}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* ── Comparativa en dinero por estado ── */}
        {totalPending > 0 && (
          <section className="reports-hero-panel" style={sectionStyle}>
            <div className="reports-section-intro">
              <div>
                <span className="reports-eyebrow">Dinero en juego</span>
                <h3 className="reports-section-title">¿Cuánto se está dejando en la mesa?</h3>
                <p className="reports-section-text">
                  Si el vendedor cierra <strong>todas</strong> estas operaciones en pipeline, recupera este monto. Cada estado muestra el valor cotizado total.
                </p>
              </div>
            </div>

            {/* Total en juego */}
            <div className="bento-tile" style={{
              borderTop: '4px solid #10c972',
              padding: '18px 22px',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
              display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
            }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconTrendingUp size={22} color="#059669" />
              </div>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <div className="reports-eyebrow">Total en juego este mes</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1, marginTop: '2px' }}>
                  {formatMoneyGT(totalMoneyAtStake)}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>
                  {totalPending} evento{totalPending !== 1 ? 's' : ''} en pipeline de {totalUsers} vendedor{totalUsers !== 1 ? 'es' : ''}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 800, background: '#dcfce7', borderRadius: '8px', padding: '6px 12px' }}>
                POTENCIAL DE CIERRE
              </div>
            </div>

            {/* Grid por estado */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {PENDING_STATUSES.map(s => {
                const count = statusTotals[s.key] || 0;
                const money = moneyByStatus[s.key] || 0;
                const pct = totalMoneyAtStake > 0 ? (money / totalMoneyAtStake) * 100 : 0;
                if (count === 0) return null;
                return (
                  <div key={s.key} className="bento-tile" style={{
                    borderTop: `4px solid ${s.color}`,
                    padding: '14px 16px',
                    gap: '8px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                        <span style={{ fontSize: '11px', fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{s.label}</span>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', background: '#f1f5f9', borderRadius: '999px', padding: '2px 8px' }}>{count} ev.</span>
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                      {formatMoneyGT(money)}
                    </div>
                    <div style={{ height: '6px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(2, pct)}%`, height: '100%', background: s.color, borderRadius: '999px', transition: 'width 0.5s ease' }} />
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>
                      {pct.toFixed(1)}% del total en juego
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── User Cards ── */}
        {filteredUserData.length === 0 ? (
          <section className="reports-hero-panel">
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <IconClock size={40} color="#94a3b8" />
              </div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#64748b' }}>{userIdFilter ? 'No hay eventos para este vendedor' : 'No hay eventos pendientes'}</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>{userIdFilter ? 'El vendedor seleccionado no tiene eventos en estados de seguimiento para ' : 'Ningún evento en estados de seguimiento para '}{monthKey}</div>
            </div>
          </section>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredUserData.map((user) => {
              const isExpanded = expandedUserId === user.userId;
              // Compute per-user stats
              const statusBreakdown = PENDING_STATUSES.map(s => ({
                ...s,
                count: user.events[s.key]?.length || 0,
              })).filter(s => s.count > 0);

              return (
              <section key={user.userId} className="reports-hero-panel" style={{ gap: '10px' }}>
                {/* Clickable header */}
                <div
                  onClick={() => setExpandedUserId(isExpanded ? null : user.userId)}
                  style={{
                    cursor: 'pointer',
                    borderRadius: isExpanded ? '14px 14px 0 0' : '14px',
                    border: `1px solid ${isExpanded ? '#cbd5e1' : '#e2e8f0'}`,
                    background: isExpanded ? '#ffffff' : '#f8fafc',
                    padding: '14px 18px',
                    transition: 'all 0.2s ease',
                    boxShadow: isExpanded ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                  }}
                  onMouseEnter={e => { if (!isExpanded) { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; } }}
                  onMouseLeave={e => { if (!isExpanded) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: `linear-gradient(135deg, #6366f1, #8b5cf6)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '15px', fontWeight: 800, color: '#fff',
                      boxShadow: '0 3px 8px rgba(99,102,241,0.3)',
                      flexShrink: 0,
                    }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="reports-eyebrow" style={{ fontSize: '9px' }}>Vendedor</span>
                      <h3 className="reports-section-title" style={{ fontSize: '16px', margin: '1px 0 0' }}>{user.name}</h3>
                      {user.totalMoney > 0 && (
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                          {formatMoneyGT(user.totalMoney)} en juego
                        </div>
                      )}
                    </div>

                    {/* Mini stats in header */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
                      {statusBreakdown.slice(0, 3).map(s => (
                        <div key={s.key} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '14px', fontWeight: 900, color: s.color, lineHeight: 1.2 }}>{s.count}</div>
                          <div style={{ fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{s.label.split(' ')[0]}</div>
                        </div>
                      ))}
                      <div style={{ textAlign: 'center', padding: '0 4px' }}>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>{user.total}</div>
                        <div style={{ fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Total</div>
                      </div>
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        background: isExpanded ? '#e2e8f0' : '#f1f5f9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '13px', color: '#64748b',
                        transition: 'transform 0.25s ease',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        flexShrink: 0,
                      }}>
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Distribution bar always visible */}
                  <div style={{ height: '6px', borderRadius: '999px', background: '#e2e8f0', display: 'flex', gap: '2px', overflow: 'hidden', marginTop: '10px' }}>
                    {PENDING_STATUSES.map(s => {
                      const count = user.events[s.key]?.length || 0;
                      const pct = user.total > 0 ? (count / user.total) * 100 : 0;
                      return pct > 0 ? (
                        <div key={s.key} style={{
                          width: `${pct}%`, height: '100%',
                          background: s.color, borderRadius: '4px',
                          minWidth: count > 0 ? '3px' : '0',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
                          transition: 'width 0.3s ease',
                        }} />
                      ) : null;
                    })}
                  </div>
                </div>

                {/* Expanded content */}
                <div style={{
                  overflow: 'hidden',
                  maxHeight: isExpanded ? '6000px' : '0',
                  opacity: isExpanded ? 1 : 0,
                  transition: 'max-height 0.4s ease, opacity 0.3s ease, margin 0.3s ease',
                  marginTop: isExpanded ? '0' : '-8px',
                  marginBottom: isExpanded ? '4px' : '0',
                }}>
                  <div style={{
                    border: '1px solid #e2e8f0',
                    borderTop: 'none',
                    borderRadius: '0 0 14px 14px',
                    background: '#ffffff',
                    padding: '6px 18px 18px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}>
                    {/* ── Stats row ── */}
                    {statusBreakdown.length > 0 && (
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', padding: '12px 0', borderBottom: '1px solid #f1f5f9', marginBottom: '14px' }}>
                        {statusBreakdown.map(s => {
                          const pct = Math.round((s.count / user.total) * 100);
                          const money = user.moneyByStatus[s.key] || 0;
                          return (
                            <div key={s.key} style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              background: `${s.color}08`,
                              border: `1px solid ${s.color}20`,
                              borderRadius: '10px',
                              padding: '8px 14px',
                              flex: '0 1 auto',
                              minWidth: '160px',
                            }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                              <div>
                                <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{s.label}</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                  <span style={{ fontSize: '16px', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.count}</span>
                                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>ev.</span>
                                </div>
                                {money > 0 && (
                                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', marginTop: '1px' }}>
                                    {formatMoneyGT(money)}
                                  </div>
                                )}
                              </div>
                              {/* Mini bar */}
                              <div style={{ width: '40px', height: '6px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden', marginLeft: 'auto', flexShrink: 0 }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: s.color, borderRadius: '999px' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Events grid ── */}
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {PENDING_STATUSES.map(s => {
                        const evs = user.events[s.key];
                        if (!evs || evs.length === 0) return null;
                        return (
                          <div key={s.key}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: s.color, display: 'inline-block' }} />
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                {s.label}
                              </span>
                              <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{evs.length}</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {evs.map((ev, evIdx) => {
                                const isHovered = hoveredEvent?.userId === user.userId
                                  && hoveredEvent?.statusKey === s.key
                                  && hoveredEvent?.evIdx === evIdx;

                                return (
                                  <div
                                    key={`${ev.id}-${ev.date}`}
                                    role="button"
                                    tabIndex={0}
                                    title={`Editar reserva: ${ev.name} (${ev.date})`}
                                    style={{
                                      background: isHovered ? '#f1f5f9' : '#f8fafc',
                                      border: `1px solid ${isHovered ? s.color : '#e2e8f0'}`,
                                      borderRadius: '8px',
                                      padding: '6px 10px',
                                      cursor: 'pointer',
                                      transition: 'all 0.12s ease',
                                      position: 'relative',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      color: '#334155',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                    }}
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setHoveredEvent({ userId: user.userId, statusKey: s.key, evIdx, x: rect.left + rect.width / 2, y: rect.top });
                                    }}
                                    onMouseLeave={() => setHoveredEvent(null)}
                                    onClick={() => handleEventClick(ev)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEventClick(ev); } }}
                                  >
                                    <span style={{ color: s.color, fontWeight: 700 }}>{ev.date}</span>
                                    <span style={{ color: '#0f172a', fontWeight: 700, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</span>
                                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>{ev.salon}</span>
                                    <span style={{ marginLeft: 'auto', color: s.color, fontSize: '12px', opacity: isHovered ? 1 : 0.45, transition: 'opacity 0.12s' }}>✎</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            );})}
          </div>
        )}

        {/* ── Premium Tooltip (portal-like, fixed position) ── */}
        {tooltipEvent && hoveredEvent && (() => {
          const statusMeta = getStatusMeta(tooltipEvent.status);
          return (
            <div style={{
              position: 'fixed',
              left: `${Math.min(hoveredEvent.x, window.innerWidth - 220)}px`,
              top: `${Math.max(10, hoveredEvent.y - 10)}px`,
              transform: 'translate(-50%, -100%)',
              background: '#0f172a', color: '#fff',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '11px', fontWeight: 600,
              zIndex: 99999,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              pointerEvents: 'none',
              minWidth: '200px',
              maxWidth: '280px',
            }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: statusMeta?.color || '#94a3b8', display: 'inline-block', flexShrink: 0 }} />
                  <strong style={{ fontSize: '13px', color: statusMeta?.color || '#fff' }}>{tooltipEvent.name}</strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 8px', fontSize: '10px', color: '#cbd5e1' }}>
                  <span style={{ color: '#94a3b8' }}>Fecha</span>
                  <span style={{ fontWeight: 700, color: '#fff' }}>{tooltipEvent.date}</span>
                  <span style={{ color: '#94a3b8' }}>Salón</span>
                  <span style={{ fontWeight: 700, color: '#fff' }}>{tooltipEvent.salon || '—'}</span>
                  <span style={{ color: '#94a3b8' }}>Estado</span>
                  <span style={{ fontWeight: 700, color: statusMeta?.color || '#fff' }}>{statusMeta?.label || tooltipEvent.status}</span>
                  <span style={{ color: '#94a3b8' }}>Vendedor</span>
                  <span style={{ fontWeight: 700, color: '#fff' }}>{userData.find(u => u.userId === hoveredEvent.userId)?.name || '—'}</span>
                </div>
              </div>
              <div style={{
                position: 'absolute', top: '100%', left: '50%',
                transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid #0f172a',
              }} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
