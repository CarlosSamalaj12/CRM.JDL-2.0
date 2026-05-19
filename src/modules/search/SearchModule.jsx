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
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto',
        background: '#fff',
        borderRadius: '20px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0b1c30', margin: '0 0 8px 0' }}>Buscar Eventos</h2>
          <p style={{ color: '#64748b', margin: 0 }}>Encuentra reservas por nombre, cliente, salón, fecha y más</p>
        </div>

        <div style={{ padding: '24px 32px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '0 16px', 
              borderRadius: '12px', border: '2px solid #e2e8f0', height: '52px', marginBottom: '16px'
            }}>
              <span style={{ fontSize: '22px', marginRight: '12px' }}>🔍</span>
              <input 
                type="text" 
                placeholder="Buscar por evento, cliente, teléfono, salón, notes..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '15px', color: '#0b1c30' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Estado</label>
                <select 
                  value={statusFilter} 
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600' }}
                >
                  <option value="all">Todos</option>
                  {Object.keys(STATUS_META).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Salón</label>
                <select 
                  value={salonFilter} 
                  onChange={e => setSalonFilter(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600' }}
                >
                  <option value="all">Todos</option>
                  {salones?.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Vendedor</label>
                <select 
                  value={userFilter} 
                  onChange={e => setUserFilter(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600' }}
                >
                  <option value="all">Todos</option>
                  {users?.map(u => (
                    <option key={u.id} value={u.id}>{u.fullName || u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Rango de Fechas</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="date" 
                    value={dateFrom} 
                    onChange={e => setDateFrom(e.target.value)}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600', fontSize: '12px' }}
                  />
                  <input 
                    type="date" 
                    value={dateTo} 
                    onChange={e => setDateTo(e.target.value)}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600', fontSize: '12px' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
                {filteredEvents.length} resultado{filteredEvents.length !== 1 ? 's' : ''}
              </span>
              <button onClick={clearFilters} style={{ 
                background: '#f1f5f9', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', color: '#64748b'
              }}>
                Limpiar filtros
              </button>
            </div>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>CÓDIGO</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>EVENTO</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>CLIENTE</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>SALÓN</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>FECHA</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>ESTADO</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px' }}></th>
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
                            style={{ border: '1px solid #e2e8f0', background: '#fff', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            👁️
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