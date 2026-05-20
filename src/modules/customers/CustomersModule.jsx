import { useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { STATUS_META } from '../calendar/constants';

const LEADS_PIPELINE_STATUSES = [
  'Reserva sin Cotizacion',
  '1er Cotizacion',
  'Seguimiento',
  'Lista de Espera',
  'Pre reserva',
  'Perdido'
];

export default function CustomersModule() {
  const navigate = useNavigate();
  const { events, users, salones } = useOutletContext();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const leadsData = useMemo(() => {
    if (!events || events.length === 0) return [];
    
    return events
      .filter(ev => LEADS_PIPELINE_STATUSES.includes(ev.status))
      .map(ev => {
        const assignedUser = users?.find(u => u.id === ev.userId);
        return {
          ...ev,
          userName: assignedUser?.fullName || assignedUser?.name || 'Sin encargado',
          eventDate: ev.date,
          eventEndDate: ev.endDate || ev.date
        };
      });
  }, [events, users]);

  const filteredLeads = useMemo(() => {
    let filtered = leadsData;

    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(l => 
        l.name?.toLowerCase().includes(term) ||
        l.clientName?.toLowerCase().includes(term) ||
        l.salon?.toLowerCase().includes(term) ||
        l.notes?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(l => l.status === statusFilter);
    }

    if (userFilter !== 'all') {
      filtered = filtered.filter(l => l.userId === userFilter);
    }

    if (dateFrom) {
      filtered = filtered.filter(l => l.date >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(l => l.date <= dateTo);
    }

    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  }, [leadsData, search, statusFilter, userFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const getStatusColor = (status) => {
    return STATUS_META[status]?.color || '#64748b';
  };

  const handleShowEvent = (eventId) => {
    navigate(`/reserva/${eventId}`);
  };

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: '100%',
        width: '100%', 
        maxWidth: '1400px', 
        margin: '0 auto',
        background: '#fff',
        borderRadius: '24px',
        border: '1px solid #d3e4fe',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#1e293b', margin: 0 }}>
                Pipeline de Leads
              </h1>
              <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px', margin: 0 }}>
                {filteredLeads.length} leads en el pipeline
              </p>
            </div>
              <button 
                onClick={() => navigate('/calendar')}
                className="iconBtn"
                title="Cerrar"
                style={{ 
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px 8px',
                  lineHeight: '1'
                }}
              >&#10005;</button>
          </div>
        </div>

        <div style={{ padding: '16px 24px 12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ flex: '2 1 200px' }}>
              <input 
                type="text" 
                placeholder="Buscar por nombre, cliente, salón..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '13px', height: '38px', boxSizing: 'border-box' }}
              />
            </div>
            
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Estado</label>
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e2e8f0', fontWeight: '600', fontSize: '13px', height: '38px', boxSizing: 'border-box' }}
              >
                <option value="all">Todos los estados</option>
                {LEADS_PIPELINE_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 140px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Vendedor</label>
              <select 
                value={userFilter} 
                onChange={e => setUserFilter(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e2e8f0', fontWeight: '600', fontSize: '13px', height: '38px', boxSizing: 'border-box' }}
              >
                <option value="all">Todos los vendedores</option>
                {users?.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName || u.name}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 130px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Fecha desde</label>
              <input 
                type="date" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '2px solid #e2e8f0', fontWeight: '600', fontSize: '13px', height: '38px', boxSizing: 'border-box' }} 
              />
            </div>

            <div style={{ flex: '1 1 130px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Fecha hasta</label>
              <input 
                type="date" 
                value={dateTo} 
                onChange={e => setDateTo(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '2px solid #e2e8f0', fontWeight: '600', fontSize: '13px', height: '38px', boxSizing: 'border-box' }} 
              />
            </div>

            <button onClick={clearFilters} style={{ 
              background: '#f1f5f9', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', color: '#0351beff', fontSize: '12px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              Limpiar filtros
            </button>
          </div>
        </div>

        <div style={{ padding: '0 24px 24px 24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflowX: 'auto', overflowY: 'auto', flex: 1, width: '100%', minHeight: 0 }}>
            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>FECHA</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>EVENTO</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>CLIENTE</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>SALÓN</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>PAX</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>ESTADO</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'left', padding: '14px 16px', fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>VENDEDOR</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', textAlign: 'center', padding: '14px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '14px' }}>
                      No hay leads para los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                      <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: '#64748b' }}>{l.date}</td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>{l.name}</td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>{l.clientName || '-'}</td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>{l.salon}</td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>{l.pax || '-'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ 
                          display: 'inline-block', 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          fontSize: '11px', 
                          fontWeight: '700', 
                          background: `${getStatusColor(l.status)}15`,
                          color: getStatusColor(l.status),
                          border: `1px solid ${getStatusColor(l.status)}30`
                        }}>
                          {l.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>{l.userName}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button 
                          onClick={() => handleShowEvent(l.id)}
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}