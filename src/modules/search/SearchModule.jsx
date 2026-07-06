import { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { STATUS_META } from '../calendar/constants';
import './search.css';
import '../../styles/tooltips.css';

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

export default function SearchModule() {
  let navigate;
  let outlet = {};
  try {
    navigate = useNavigate();
    outlet = useOutletContext();
  } catch (_err) {
    navigate = (path) => { window.location.href = path; };
    outlet = {};
  }
  const { events = [], users = [], salones = [] } = outlet;

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salonFilter, setSalonFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const groupedEvents = useMemo(() => {
    if (!events) return [];

    const groups = new Map();
    for (const ev of events) {
      const key = ev.groupId || ev.id;
      if (!groups.has(key)) {
        groups.set(key, { main: ev, subs: [] });
      }
      groups.get(key).subs.push(ev);
    }

    const merged = [];
    for (const group of groups.values()) {
      const subs = group.subs.sort((a, b) => {
        const byDate = String(a?.date || '').localeCompare(String(b?.date || ''));
        if (byDate !== 0) return byDate;
        return String(a?.salon || '').localeCompare(String(b?.salon || ''));
      });
      const main = subs[0];
      merged.push({
        ...main,
        _subEvents: subs,
        _salonList: [...new Set(subs.map(s => s.salon).filter(Boolean))],
        _dateStart: subs[0]?.date || '',
        _dateEnd: subs[subs.length - 1]?.date || '',
      });
    }

    let filtered = merged;

    if (debouncedQuery) {
      const term = debouncedQuery.toLowerCase();
      filtered = filtered.filter(ev =>
        ev.name?.toLowerCase().includes(term) ||
        ev.clientName?.toLowerCase().includes(term) ||
        ev.clientPhone?.toLowerCase().includes(term) ||
        ev.notes?.toLowerCase().includes(term) ||
        ev.id?.toLowerCase().includes(term) ||
        ev.quote?.code?.toLowerCase().includes(term) ||
        ev._salonList.some(s => s.toLowerCase().includes(term))
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(ev => ev.status === statusFilter);
    }

    if (salonFilter !== 'all') {
      filtered = filtered.filter(ev => ev._salonList.some(s => s.includes(salonFilter)));
    }

    if (userFilter !== 'all') {
      filtered = filtered.filter(ev => ev.userId === userFilter);
    }

    if (dateFrom) {
      filtered = filtered.filter(ev => ev._dateEnd >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(ev => ev._dateStart <= dateTo);
    }

    return filtered.sort((a, b) => b._dateStart?.localeCompare(a._dateStart));
  }, [events, debouncedQuery, statusFilter, salonFilter, userFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setSalonFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const getStatusColor = (status) => STATUS_META[status]?.color || '#64748b';

  return (
    <div className="search-page">
      <div className="search-card">
        {/* Header */}
        <div className="search-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '17px', boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
              flexShrink: 0,
            }}>🔍</div>
            <div>
              <h2 className="search-title">Buscar Eventos</h2>
              <p className="search-subtitle">Encuentra reservas por nombre, cliente, salón, No. Doc y más</p>
            </div>
          </div>
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
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">Todos</option>
                {Object.keys(STATUS_META).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="search-field">
              <label className="search-field-label">Salón</label>
              <select value={salonFilter} onChange={e => setSalonFilter(e.target.value)}>
                <option value="all">Todos</option>
                {salones?.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="search-field">
              <label className="search-field-label">Vendedor</label>
              <select value={userFilter} onChange={e => setUserFilter(e.target.value)}>
                <option value="all">Todos</option>
                {users?.map(u => <option key={u.id} value={u.id}>{u.fullName || u.name}</option>)}
              </select>
            </div>

            <div className="search-field">
              <label className="search-field-label">Desde</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>

            <div className="search-field">
              <label className="search-field-label">Hasta</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>

            <div className="search-actions">
              <span className="search-result-count">
                {groupedEvents.length} resultados
              </span>
              <button className="search-clear-btn" onClick={clearFilters}>Limpiar</button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="search-table-area">
          <div className="search-table-wrap">
            <table className="search-table">
              <thead>
                <tr>
                  <th>No. DOC</th>
                  <th>EVENTO</th>
                  <th>CLIENTE</th>
                  <th>SALÓN</th>
                  <th>FECHA</th>
                  <th>ESTADO</th>
                  <th className="center"></th>
                </tr>
              </thead>
                <tbody>
                  {groupedEvents.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="search-empty-state">
                          No se encontraron eventos que coincidan con tu búsqueda
                        </div>
                      </td>
                    </tr>
                  ) : (
                    groupedEvents.map(ev => {
                      const assignedUser = users?.find(u => u.id === ev.userId);
                      const docCode = ev.quote?.code || ev.id?.substring(0, 12) || '-';
                      const isMultiSalon = ev._subEvents.length > 1;
                      return (
                        <tr key={ev.id}>
                          <td>
                            <span className="search-doc-code">{docCode}</span>
                          </td>
                          <td>
                            <div className="search-event-name">{ev.name}</div>
                            <div className="search-event-assignee">
                              {assignedUser?.fullName || assignedUser?.name || 'Sin asignar'}
                            </div>
                          </td>
                          <td>
                            <div className="search-client-name">{ev.clientName || '-'}</div>
                            {ev.clientPhone && <div className="search-client-phone">{ev.clientPhone}</div>}
                          </td>
                          <td>
                            {isMultiSalon ? (
                              <div className="search-salon-list">
                                {ev._salonList.map((s, i) => (
                                  <span key={i} className="search-salon-tag">{s}</span>
                                ))}
                              </div>
                            ) : (
                              <span className="search-salon-name">{ev.salon}</span>
                            )}
                          </td>
                          <td>
                            <div className="search-date-main">
                              {ev._dateStart}{ev._dateStart !== ev._dateEnd ? ` - ${ev._dateEnd}` : ''}
                            </div>
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
                            <button className="search-view-btn" onClick={() => navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`)}>
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
