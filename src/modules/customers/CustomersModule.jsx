import { useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { STATUS_META } from '../calendar/constants';
import '../../styles/tooltips.css';

const PIPELINE_STAGES = [
  { key: 'Reserva sin Cotizacion', label: 'Nuevo', icon: '🆕', desc: 'Cliente potencial recién agregado, sin cotización' },
  { key: '1er Cotizacion', label: 'Cotizado', icon: '📄', desc: 'Primera cotización generada, pendiente de revisión' },
  { key: 'Seguimiento', label: 'Seguimiento', icon: '📞', desc: 'Cotización enviada, en negociación con el cliente' },
  { key: 'Lista de Espera', label: 'Lista de Espera', icon: '⏳', desc: 'Interesado sin fecha, en espera' },
  { key: 'Pre reserva', label: 'Pre-Reserva', icon: '📌', desc: 'Apartado provisional, pendiente de confirmación' },
  { key: 'Confirmado', label: 'Ganado', icon: '✅', desc: 'Reserva confirmada con anticipo/pago' },
];

const EXCLUDED_STATUSES = new Set(['Cancelado', 'Perdido', 'Mantenimiento', 'Mantenimiento Realizado', 'Realizado']);

export default function CustomersModule() {
  let navigate;
  let outlet = {};
  try {
    navigate = useNavigate();
    outlet = useOutletContext();
  } catch (_err) {
    navigate = (path) => { window.location.href = path; };
    outlet = {};
  }
  const events = outlet?.events || [];
  const users = outlet?.users || [];

  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');

  const pipelineData = useMemo(() => {
    if (!events || events.length === 0) return [];

    const stageMap = {};
    PIPELINE_STAGES.forEach(s => { stageMap[s.key] = []; });

    for (const ev of events) {
      if (EXCLUDED_STATUSES.has(ev.status)) continue;
      const assignedUser = users?.find(u => u.id === ev.userId);
      const stage = stageMap[ev.status];
      if (!stage) continue;
      stage.push({
        ...ev,
        userName: assignedUser?.fullName || assignedUser?.name || 'Sin encargado',
      });
    }

    // Sort each stage by date descending
    PIPELINE_STAGES.forEach(s => {
      stageMap[s.key].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    });

    return stageMap;
  }, [events, users]);

  const filteredPipeline = useMemo(() => {
    if (!search && userFilter === 'all') return pipelineData;

    const result = {};
    for (const stage of PIPELINE_STAGES) {
      let items = pipelineData[stage.key] || [];
      if (search) {
        const term = search.toLowerCase();
        items = items.filter(l =>
          l.name?.toLowerCase().includes(term) ||
          l.clientName?.toLowerCase().includes(term) ||
          l.salon?.toLowerCase().includes(term)
        );
      }
      if (userFilter !== 'all') {
        items = items.filter(l => l.userId === userFilter);
      }
      result[stage.key] = items;
    }
    return result;
  }, [pipelineData, search, userFilter]);

  const totalLeads = useMemo(() => {
    return Object.values(filteredPipeline).reduce((sum, arr) => sum + arr.length, 0);
  }, [filteredPipeline]);

  const stageStats = useMemo(() => {
    const stats = {};
    for (const stage of PIPELINE_STAGES) {
      const items = filteredPipeline[stage.key] || [];
      let totalPax = 0, totalIncome = 0;
      for (const ev of items) {
        totalPax += Number(ev.pax || 0);
        totalIncome += Number(ev.quote?.totalGtq || ev.quote?.total || 0);
      }
      stats[stage.key] = { totalPax, totalIncome };
    }
    // Lost column stats (respecting same filters)
    const lostAll = events?.filter(ev => ev.status === 'Cancelado' || ev.status === 'Perdido') || [];
    let lostFiltered = lostAll;
    if (search) {
      const t = search.toLowerCase();
      lostFiltered = lostFiltered.filter(ev =>
        ev.name?.toLowerCase().includes(t) ||
        ev.clientName?.toLowerCase().includes(t) ||
        ev.salon?.toLowerCase().includes(t)
      );
    }
    if (userFilter !== 'all') {
      lostFiltered = lostFiltered.filter(ev => ev.userId === userFilter);
    }
    let lostPax = 0, lostIncome = 0;
    for (const ev of lostFiltered) {
      lostPax += Number(ev.pax || 0);
      lostIncome += Number(ev.quote?.totalGtq || ev.quote?.total || 0);
    }
    stats.lost = { totalPax: lostPax, totalIncome: lostIncome };
    return stats;
  }, [filteredPipeline, events, search, userFilter]);

  const getStatusColor = (status) => {
    return STATUS_META[status]?.color || '#64748b';
  };

  const clearFilters = () => {
    setSearch('');
    setUserFilter('all');
  };

  return (
    <div className="module-container-wrapper" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '1600px',
        margin: '0 auto', background: '#fff', borderRadius: '24px', border: '1px solid #d3e4fe', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
              }}>🔁</div>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', margin: 0, lineHeight: 1.2 }}>
                  Embudo de Ventas
                </h1>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '2px 0 0' }}>
                  {totalLeads} {'oportunidades en el embudo'}
                </p>
              </div>
            </div>
            <button onClick={() => navigate('/calendar')} className="btn-exit" data-tooltip="Cerrar"
              style={{ width: '36px', height: '36px', padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="16" height="16" className="crm-icon-x">
                <path d="M4 4l10 10M14 4l-10 10" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <input type="text" placeholder="Buscar por nombre, cliente, salón..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: '2 1 240px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '13px', height: '38px', boxSizing: 'border-box', background: '#fff', color: '#1e293b' }} />
            <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
              style={{ flex: '0 1 180px', padding: '9px 10px', borderRadius: '8px', border: '2px solid #e2e8f0', fontWeight: '600', fontSize: '13px', height: '38px', boxSizing: 'border-box', background: '#fff', color: '#1e293b' }}>
              <option value="all">Todos los vendedores</option>
              {users?.map(u => <option key={u.id} value={u.id}>{u.fullName || u.name}</option>)}
            </select>
            <button onClick={clearFilters} style={{
              background: '#f1f5f9', border: 'none', padding: '10px 16px', borderRadius: '8px',
              fontWeight: '700', cursor: 'pointer', color: '#0351beff', fontSize: '12px', height: '38px',
            }}>Limpiar</button>
          </div>
        </div>

        {/* Pipeline Kanban */}
        <div className="pipeline-kanban" style={{ flex: 1, display: 'flex', gap: '12px', padding: '16px 24px 24px', overflowX: 'auto', overflowY: 'auto', minHeight: 0 }}>
          {PIPELINE_STAGES.map(stage => {
            const items = filteredPipeline[stage.key] || [];
            const stageColor = getStatusColor(stage.key);

            return (
              <div key={stage.key} className="pipeline-stage" style={{
                flex: '1 0 260px', minWidth: '240px', maxWidth: '320px',
                display: 'flex', flexDirection: 'column', borderRadius: '14px',
                background: '#f8fafc', border: '1px solid #e2e8f0', overflow: 'hidden',
              }}>
                {/* Stage header */}
                <div style={{
                  padding: '12px 14px', borderBottom: '1px solid #e2e8f0',
                  background: '#fff', flexShrink: 0,
                  borderLeft: `4px solid ${stageColor}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>{stage.icon}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
                          {stage.label}
                        </div>
                        <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600, lineHeight: 1.2 }}>
                          {stage.desc}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      minWidth: '24px', height: '24px', borderRadius: '8px',
                      background: `${stageColor}18`, color: stageColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: '900',
                    }}>{items.length}</div>
                  </div>
                  {/* Stage stats */}
                  <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>
                      👥 <strong style={{ color: '#0f172a' }}>{(stageStats[stage.key]?.totalPax || 0).toLocaleString()}</strong> PAX
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>
                      💰 <strong style={{ color: '#059669' }}>Q {(stageStats[stage.key]?.totalIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                </div>

                {/* Cards */}
                <div style={{ flex: 1, padding: '8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {items.length === 0 ? (
                    <div style={{
                      textAlign: 'center', color: '#cbd5e1', fontSize: '12px', fontWeight: 600,
                      padding: '24px 8px', fontStyle: 'italic',
                    }}>
                      Sin oportunidades
                    </div>
                  ) : items.map(ev => (
                    <div key={ev.id} onClick={() => navigate(`/reserva/${ev.id}`)}
                      style={{
                        background: '#fff', borderRadius: '10px', padding: '10px 12px',
                        border: '1px solid #e2e8f0', cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = stageColor; e.currentTarget.style.boxShadow = `0 2px 8px ${stageColor}15`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '4px', lineHeight: 1.3 }}>
                        {ev.name || 'Sin nombre'}
                      </div>
                      {ev.clientName && (
                        <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, marginBottom: '3px' }}>
                          👤 {ev.clientName}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '10px', color: '#94a3b8', fontWeight: 600, marginTop: '4px' }}>
                        {ev.date && <span>📅 {ev.date}</span>}
                        {ev.salon && <span>📍 {ev.salon}</span>}
                        {ev.pax > 0 && <span>👥 {ev.pax} pax</span>}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                        <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>
                          👤 {ev.userName}
                        </span>
                        <span style={{
                          fontSize: '8px', fontWeight: '800', color: stageColor,
                          padding: '2px 8px', borderRadius: '999px', background: `${stageColor}12`,
                          border: `1px solid ${stageColor}25`, letterSpacing: '0.02em',
                        }}>
                          {stage.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Lost column */}
          {(() => {
            const lostItems = events?.filter(ev => ev.status === 'Cancelado' || ev.status === 'Perdido') || [];
            const lostFiltered = !search && userFilter === 'all' ? lostItems
              : lostItems.filter(ev => {
                  if (search) {
                    const t = search.toLowerCase();
                    if (!ev.name?.toLowerCase().includes(t) && !ev.clientName?.toLowerCase().includes(t) && !ev.salon?.toLowerCase().includes(t)) return false;
                  }
                  if (userFilter !== 'all' && ev.userId !== userFilter) return false;
                  return true;
                });
            return (
              <div className="pipeline-stage" style={{
                flex: '1 0 220px', minWidth: '200px', maxWidth: '260px',
                display: 'flex', flexDirection: 'column', borderRadius: '14px',
                background: '#fef2f2', border: '1px solid #fecaca', overflow: 'hidden',
              }}>
                <div style={{
                  padding: '12px 14px', borderBottom: '1px solid #fecaca',
                  background: '#fff', flexShrink: 0,
                  borderLeft: '4px solid #ef4444',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>💔</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#991b1b', lineHeight: 1.2 }}>
                          Perdido
                        </div>
                        <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600, lineHeight: 1.2 }}>
                          Oportunidades cerradas sin éxito
                        </div>
                      </div>
                    </div>
                    <div style={{
                      minWidth: '24px', height: '24px', borderRadius: '8px',
                      background: '#fef2f2', color: '#ef4444',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: '900',
                    }}>{lostFiltered.length}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>
                      👥 <strong style={{ color: '#991b1b' }}>{(stageStats.lost?.totalPax || 0).toLocaleString()}</strong> PAX
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>
                      💰 <strong style={{ color: '#991b1b' }}>Q {(stageStats.lost?.totalIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, padding: '8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {lostFiltered.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '12px', fontWeight: 600, padding: '24px 8px', fontStyle: 'italic' }}>
                      Sin pérdidas
                    </div>
                  ) : lostFiltered.map(ev => (
                    <div key={ev.id} onClick={() => navigate(`/reserva/${ev.id}`)}
                      style={{
                        background: '#fff', borderRadius: '10px', padding: '10px 12px',
                        border: '1px solid #fecaca', cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(239,68,68,0.15)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '4px', lineHeight: 1.3 }}>
                        {ev.name || 'Sin nombre'}
                      </div>
                      {ev.clientName && (
                        <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, marginBottom: '3px' }}>
                          👤 {ev.clientName}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '10px', color: '#94a3b8', fontWeight: 600, marginTop: '4px' }}>
                        {ev.date && <span>📅 {ev.date}</span>}
                        {ev.salon && <span>📍 {ev.salon}</span>}
                      </div>
                      <div style={{ textAlign: 'right', marginTop: '6px' }}>
                        <span style={{
                          fontSize: '8px', fontWeight: '800', color: '#ef4444',
                          padding: '2px 8px', borderRadius: '999px', background: '#fef2f2',
                          border: '1px solid #fecaca', letterSpacing: '0.02em',
                        }}>
                          {ev.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <style>{`
        .btn-exit {
          background: transparent !important;
          color: #94a3b8 !important;
          border: none !important;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
          overflow: visible;
          outline: none;
          font-family: inherit;
        }
        .btn-exit:hover {
          background: rgba(239, 68, 68, 0.08) !important;
          color: #ef4444 !important;
        }
        .btn-exit:focus-visible {
          outline: 2px solid #ef4444;
          outline-offset: 2px;
        }
        .btn-exit:active {
          transform: scale(0.88);
        }
        .btn-exit svg {
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .btn-exit:hover svg {
          transform: scale(1.2);
        }
        .btn-exit:hover .crm-icon-x {
          transform: rotate(90deg) scale(1.2);
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        @media (max-width: 768px) {
          .pipeline-kanban {
            flex-direction: column !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }
          .pipeline-stage {
            flex: none !important;
            min-width: 0 !important;
            max-width: none !important;
          }
        }
      `}</style>
    </div>
  );
}
