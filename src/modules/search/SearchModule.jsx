import { useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { STATUS_META } from '../calendar/constants';

export default function SearchModule() {
  const { events, users, salones } = useOutletContext();
  const navigate = useNavigate();
  
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salonFilter, setSalonFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    
    let filtered = events;

    if (query) {
      const term = query.toLowerCase();
      filtered = filtered.filter(ev => 
        ev.name?.toLowerCase().includes(term) ||
        ev.clientName?.toLowerCase().includes(term) ||
        ev.clientPhone?.toLowerCase().includes(term) ||
        ev.salon?.toLowerCase().includes(term) ||
        ev.notes?.toLowerCase().includes(term) ||
        ev.id?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(ev => ev.status === statusFilter);
    }

    if (salonFilter !== 'all') {
      filtered = filtered.filter(ev => ev.salon?.includes(salonFilter));
    }

    if (userFilter !== 'all') {
      filtered = filtered.filter(ev => ev.userId === userFilter);
    }

    if (dateFrom) {
      filtered = filtered.filter(ev => ev.date >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(ev => ev.date <= dateTo);
    }

    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [events, query, statusFilter, salonFilter, userFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setSalonFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const getStatusColor = (status) => {
    return STATUS_META[status]?.color || '#64748b';
  };

  return (
    <div className="module-container-wrapper" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div className="module-card-container" style={{ 
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        maxWidth: '1400px', 
        margin: '0 auto',
        background: '#fff',
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        <div className="module-header-container" style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#0b1c30', margin: 0 }}>Buscar Eventos</h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px', margin: 0 }}>Encuentra reservas por nombre, cliente, salón, fecha y más</p>
        </div>

        <div className="module-filters-container" style={{ padding: '16px 24px 12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ flex: '2 1 200px', display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '0 12px', borderRadius: '8px', border: '2px solid #e2e8f0', height: '38px', boxSizing: 'border-box' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '8px', color: '#64748b' }}>search</span>
              <input 
                type="text" 
                placeholder="Buscar..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px', color: '#0b1c30' }}
              />
            </div>
            
            <div style={{ flex: '1 1 120px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Estado</label>
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e2e8f0', fontWeight: '600', fontSize: '13px', height: '38px', boxSizing: 'border-box' }}
              >
                <option value="all">Todos</option>
                {Object.keys(STATUS_META).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 120px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Salón</label>
              <select 
                value={salonFilter} 
                onChange={e => setSalonFilter(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e2e8f0', fontWeight: '600', fontSize: '13px', height: '38px', boxSizing: 'border-box' }}
              >
                <option value="all">Todos</option>
                {salones?.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 120px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Vendedor</label>
              <select 
                value={userFilter} 
                onChange={e => setUserFilter(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e2e8f0', fontWeight: '600', fontSize: '13px', height: '38px', boxSizing: 'border-box' }}
              >
                <option value="all">Todos</option>
                {users?.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName || u.name}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 110px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Desde</label>
              <input 
                type="date" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '2px solid #e2e8f0', fontWeight: '600', fontSize: '13px', height: '38px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ flex: '1 1 110px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Hasta</label>
              <input 
                type="date" 
                value={dateTo} 
                onChange={e => setDateTo(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '2px solid #e2e8f0', fontWeight: '600', fontSize: '13px', height: '38px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', whiteSpace: 'nowrap' }}>
                {filteredEvents.length} resultados
              </span>
              <button onClick={clearFilters} style={{ 
                background: '#f1f5f9', border: 'none', padding: '10px 14px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', color: '#64748b', fontSize: '12px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                Limpiar
              </button>
            </div>
          </div>
        </div>

        <div className="module-table-wrapper" style={{ padding: '0 24px 24px 24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflowX: 'auto', overflowY: 'auto', flex: 1, width: '100%', minHeight: 0 }}>
            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>CÓDIGO</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>EVENTO</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>CLIENTE</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>SALÓN</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>FECHA</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>ESTADO</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'center', padding: '14px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                      No se encontraron eventos que coincidan con tu búsqueda
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map(ev => {
                    const assignedUser = users?.find(u => u.id === ev.userId);
                    return (
                      <tr key={ev.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                        <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>{ev.id?.substring(0, 12)}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>{ev.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Encargado: {assignedUser?.fullName || assignedUser?.name || 'Sin asignar'}</div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13px' }}>
                          <div style={{ color: '#334155' }}>{ev.clientName || '-'}</div>
                          {ev.clientPhone && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{ev.clientPhone}</div>}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>{ev.salon}</td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b' }}>
                          <div style={{ fontWeight: '600' }}>{ev.date}</div>
                          <div style={{ fontSize: '11px' }}>{ev.startTime} - {ev.endTime}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ 
                            display: 'inline-block', 
                            padding: '4px 10px', 
                            borderRadius: '20px', 
                            fontSize: '10px', 
                            fontWeight: '700', 
                            background: `${getStatusColor(ev.status)}15`,
                            color: getStatusColor(ev.status),
                            border: `1px solid ${getStatusColor(ev.status)}30`
                          }}>
                            {ev.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <button 
                            onClick={() => navigate(`/reserva/${ev.id}`)}
                            style={{ 
                              border: '1px solid #bfdbfe', 
                              background: '#eff6ff', 
                              padding: '6px 14px', 
                              borderRadius: '8px', 
                              cursor: 'pointer', 
                              fontSize: '13px', 
                              fontWeight: '700', 
                              color: '#1d4ed8'
                            }}
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}