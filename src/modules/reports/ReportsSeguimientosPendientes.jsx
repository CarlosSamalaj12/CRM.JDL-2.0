import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import ReportInfo from './components/ReportInfo';

const PENDING_STATUSES = [
  { key: 'Reserva sin Cotizacion', label: 'Reserva sin Cot.', color: '#00A3FF', icon: '📝' },
  { key: '1er Cotizacion', label: '1ra Cotización', color: '#007A64', icon: '💰' },
  { key: 'Seguimiento', label: 'Negociación', color: '#FF8C00', icon: '🤝' },
  { key: 'Lista de Espera', label: 'Lista Espera', color: '#FFD700', icon: '⏳' },
  { key: 'Pre reserva', label: 'Pre-Reserva', color: '#FF00CC', icon: '📌' },
];

const STATUS_SET = new Set(PENDING_STATUSES.map(s => s.key));

function getStatusMeta(key) {
  return PENDING_STATUSES.find(s => s.key === key);
}

export default function ReportsSeguimientosPendientes({ onClose }) {
  const { events, users } = useOutletContext();
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [monthKey, setMonthKey] = useState(defaultMonth);
  const [userIdFilter, setUserIdFilter] = useState(null); // null = todos
  const [hoveredEvent, setHoveredEvent] = useState(null); // { userId, statusKey, evIdx, x, y }
  const [expandedUserId, setExpandedUserId] = useState(null); // which user card is expanded

  const pendingStatusSet = useMemo(() => STATUS_SET, []);

  // ── Aggregate: group pending events by userId, then by status ──
  const { userData, statusTotals } = useMemo(() => {
    if (!events || !users) return { userData: [], statusTotals: {} };

    const [yr, mo] = monthKey.split('-').map(Number);
    const from = `${monthKey}-01`;
    const to = `${monthKey}-${new Date(yr, mo, 0).getDate()}`;

    // For each userId, collect events by status
    const userMap = new Map(); // userId -> { name, fullName, events: { statusKey: [ev, ev, ...] } }
    const accTotals = {};

    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) continue;
      const status = String(ev.status || '').trim();
      if (!pendingStatusSet.has(status)) continue;

      const uid = String(ev.userId || '').trim();
      if (!uid) continue;

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
          total: 0,
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
      });
      entry.total++;
      accTotals[status] = (accTotals[status] || 0) + 1;
    }

    // Sort users by total pending (desc)
    const sorted = Array.from(userMap.values()).sort((a, b) => b.total - a.total);

    // Sort events within each user by date
    for (const u of sorted) {
      for (const statusKey of Object.keys(u.events)) {
        u.events[statusKey].sort((a, b) => a.date.localeCompare(b.date));
      }
    }

    return { userData: sorted, statusTotals: accTotals };
  }, [events, users, monthKey, pendingStatusSet]);

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
            <div className="reports-title">📋 Seguimientos Pendientes</div>
            <div className="reports-subtitle">Eventos en pipeline comercial por vendedor · Pre-Reserva · Negociación · 1ra Cotización · Reserva sin Cot. · Lista Espera</div>
          </div>
        </div>
        <ReportInfo reportKey="seguimientos" />
        <button className="btn-exit" type="button" onClick={onClose}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver
        </button>
      </div>

      <div className="reports-page-body">
        {/* ── Hero ── */}
        <section className="reports-hero-panel" style={sectionStyle}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Pipeline comercial</span>
              <h3 className="reports-section-title">Eventos pendientes por vendedor</h3>
              <p className="reports-section-text">
                Eventos en estados de seguimiento comercial agrupados por usuario. Pasa el mouse sobre cada evento para ver detalles.
              </p>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="reports-toolbar" style={{ gap: '16px', padding: '16px 20px' }}>
            <label className="field" style={{ flex: '0 0 160px' }}>
              <span>Mes</span>
              <input type="month" value={monthKey} onChange={e => handleMonthChange(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '0 0 200px' }}>
              <span>Vendedor</span>
              <select value={userIdFilter || ''} onChange={e => setUserIdFilter(e.target.value || null)}>
                <option value="">Todos los vendedores</option>
                {userData.map(u => (
                  <option key={u.userId} value={u.userId}>{u.name}</option>
                ))}
              </select>
            </label>
            <div className="reports-actions" style={{ gap: '8px' }}>
              <button type="button" onClick={() => { handleReset(); setUserIdFilter(null); }}>Mes Actual</button>
            </div>

            {/* KPI chips */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                📋 <strong style={{ color: '#0f172a' }}>{totalPending}</strong> pendientes
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                👥 <strong style={{ color: '#0f172a' }}>{totalUsers}</strong> {totalUsers === 1 ? 'vendedor' : 'vendedores'}
              </span>
              {PENDING_STATUSES.map(s => {
                const c = statusTotals[s.key] || 0;
                return c > 0 ? (
                  <span key={s.key} style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: s.color, display: 'inline-block' }} />
                    {c}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        </section>

        {/* ── Legend / Status filter pills ── */}
        <div className="reports-storytelling-card" style={sectionStyle}>
          <div style={{ display: 'flex', gap: '8px', fontSize: '10px', fontWeight: 700, color: '#64748b', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 800, marginRight: '4px' }}>ESTADOS:</span>
            {PENDING_STATUSES.map(s => (
              <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px', background: `${s.color}15`, border: `1.5px solid ${s.color}40` }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                {s.icon} {s.label} <strong style={{ color: '#0f172a' }}>{statusTotals[s.key] || 0}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* ── User Cards ── */}
        {filteredUserData.length === 0 ? (
          <section className="reports-hero-panel">
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>📭</div>
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
                          return (
                            <div key={s.key} style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              background: `${s.color}08`,
                              border: `1px solid ${s.color}20`,
                              borderRadius: '10px',
                              padding: '8px 14px',
                              flex: '0 1 auto',
                              minWidth: '120px',
                            }}>
                              <span style={{ fontSize: '16px' }}>{s.icon}</span>
                              <div>
                                <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{s.label}</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                  <span style={{ fontSize: '18px', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.count}</span>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>{pct}%</span>
                                </div>
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
                                {s.icon} {s.label}
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
                                  >
                                    <span style={{ color: s.color, fontWeight: 700 }}>{ev.date}</span>
                                    <span style={{ color: '#0f172a', fontWeight: 700, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</span>
                                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>{ev.salon}</span>
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
                  <span style={{ color: '#94a3b8' }}>📅 Fecha</span>
                  <span style={{ fontWeight: 700, color: '#fff' }}>{tooltipEvent.date}</span>
                  <span style={{ color: '#94a3b8' }}>📍 Salón</span>
                  <span style={{ fontWeight: 700, color: '#fff' }}>{tooltipEvent.salon || '—'}</span>
                  <span style={{ color: '#94a3b8' }}>📌 Estado</span>
                  <span style={{ fontWeight: 700, color: statusMeta?.color || '#fff' }}>{statusMeta?.label || tooltipEvent.status}</span>
                  <span style={{ color: '#94a3b8' }}>👤 Vendedor</span>
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
