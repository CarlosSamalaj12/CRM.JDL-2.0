import { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { STATUS_META } from '../calendar/constants';

const STATUS_DESCRIPTIONS = {
  'Reserva sin Cotizacion': 'Cliente potencial recién agregado, sin cotización creada',
  '1er Cotizacion': 'Se generó la primera cotización, pendiente de revisión',
  'Seguimiento': 'Cotización enviada, en proceso de seguimiento con el cliente',
  'Lista de Espera': 'Cliente interesado pero sin fecha confirmada, en espera',
  'Pre reserva': 'Apartado provisional, pendiente de confirmación final',
  'Perdido': 'Oportunidad cerrada, el cliente no concretó',
  'Confirmado': 'Reserva confirmada y asegurada',
  'Cancelado': 'Reserva cancelada por el cliente o el sistema',
  'Mantenimiento': 'Salón en mantenimiento programado',
  'Mantenimiento Realizado': 'Mantenimiento completado',
};
import './search.css';
import '../../styles/tooltips.css';

export default function SearchModule() {
  const { events, users, salones } = useOutletContext();
  const navigate = useNavigate();
  
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salonFilter, setSalonFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Debounce: espera 300ms después de que el usuario deja de escribir
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    
    let filtered = events;

    if (debouncedQuery) {
      const term = debouncedQuery.toLowerCase();
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
  }, [events, debouncedQuery, statusFilter, salonFilter, userFilter, dateFrom, dateTo]);

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
    <div className="search-page">
      <div className="search-card">
        {/* Header */}
        <div className="search-header">
          <h2 className="search-title">Buscar Eventos</h2>
          <p className="search-subtitle">Encuentra reservas por nombre, cliente, salón, fecha y más</p>
        </div>

        {/* Filters */}
        <div className="search-filters">
          <div className="search-filters-row">
            <div className="search-input-wrap">
              <span className="search-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m16 16 4 4" />
                </svg>
              </span>
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className={`search-clear-input${query ? ' visible' : ''}`}
                onClick={() => setQuery('')}
                tabIndex={query ? 0 : -1}
                aria-label="Limpiar búsqueda"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            
            <div className="search-field">
              <label className="search-field-label">Estado</label>
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                {Object.keys(STATUS_META).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="search-field">
              <label className="search-field-label">Salón</label>
              <select 
                value={salonFilter} 
                onChange={e => setSalonFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                {salones?.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="search-field">
              <label className="search-field-label">Vendedor</label>
              <select 
                value={userFilter} 
                onChange={e => setUserFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                {users?.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName || u.name}</option>
                ))}
              </select>
            </div>

            <div className="search-field">
              <label className="search-field-label">Desde</label>
              <input 
                type="date" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>

            <div className="search-field">
              <label className="search-field-label">Hasta</label>
              <input 
                type="date" 
                value={dateTo} 
                onChange={e => setDateTo(e.target.value)}
              />
            </div>

            <div className="search-actions">
              <span className="search-result-count">
                {filteredEvents.length} resultados
              </span>
              <button className="search-clear-btn" onClick={clearFilters}>
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Table area */}
        <div className="search-table-area">
          <div className="search-table-wrap">
            <table className="search-table">
              <thead>
                <tr>
                  <th>CÓDIGO</th>
                  <th>EVENTO</th>
                  <th>CLIENTE</th>
                  <th>SALÓN</th>
                  <th>FECHA</th>
                  <th>ESTADO</th>
                  <th className="center"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="search-empty-state">
                        No se encontraron eventos que coincidan con tu búsqueda
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map(ev => {
                    const assignedUser = users?.find(u => u.id === ev.userId);
                    return (
                      <tr key={ev.id}>
                        <td className="mono">{ev.id?.substring(0, 12)}</td>
                        <td>
                          <div className="search-event-name">{ev.name}</div>
                          <div className="search-event-assignee">
                            Encargado: {assignedUser?.fullName || assignedUser?.name || 'Sin asignar'}
                          </div>
                        </td>
                        <td>
                          <div className="search-client-name">{ev.clientName || '-'}</div>
                          {ev.clientPhone && <div className="search-client-phone">{ev.clientPhone}</div>}
                        </td>
                        <td><span className="search-salon-name">{ev.salon}</span></td>
                        <td>
                          <div className="search-date-main">{ev.date}</div>
                          <div className="search-date-time">{ev.startTime} - {ev.endTime}</div>
                        </td>
                        <td>
                          <span className="search-status-badge" data-desc={STATUS_DESCRIPTIONS[ev.status] || ''} style={{ 
                            background: `${getStatusColor(ev.status)}15`,
                            color: getStatusColor(ev.status),
                            border: `1px solid ${getStatusColor(ev.status)}30`
                          }}>
                            {ev.status}
                          </span>
                        </td>
                        <td className="center">
                          <button 
                            className="search-view-btn"
                            onClick={() => navigate(`/reserva/${ev.id}`)}
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
