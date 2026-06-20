import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { fetchEvents } from '../services/api.js';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../../services/stateService';
import EventCard from '../components/EventCard.jsx';

import { IconGrid, IconTag, IconBuilding, IconCheckCircle, IconClock, IconX, IconPrinter, IconFileText, IconMapPin, IconUser, IconDownload } from '../components/Icons.jsx';
import SettingsChecklist from '../../settings/SettingsChecklist';

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const statusMap = {
  4: { label: 'Confirmado', color: 'green' },
  7: { label: 'Pre-reserva', color: 'fucsia' },
};

function formatIsoDate(value) {
  if (!value) return '';
  const date = typeof value === 'string' && value.length <= 10 
    ? new Date(value + 'T12:00:00') 
    : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function expandEventByDay(event) {
  const startStr = String(event.FechaEvento || '').slice(0, 10);
  const endStr = String(event.FechaSalida || event.FechaEvento || '').slice(0, 10);
  if (!startStr) return [];

  const start = new Date(startStr + 'T12:00:00');
  const end = new Date(endStr + 'T12:00:00');
  const result = [];
  const current = new Date(start);

  while (current <= end) {
    const formatted = formatIsoDate(current);
    result.push({
      ...event,
      displayDate: formatted,
      dayIndex: current.getDay(),
      dayLabel: `${dayNames[current.getDay()]} ${formatted}`,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

function formatDateShort(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' });
}

function getWeekMonday(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

export default function Kanban() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [filterExiting, setFilterExiting] = useState(false);

  const [viewMode, setViewMode] = useState('kanban');
  const [occupancyOps, setOccupancyOps] = useState({});
  const [editingDay, setEditingDay] = useState(null);
  const [editDes, setEditDes] = useState(0);
  const [editHab, setEditHab] = useState(0);
  const currentUser = (() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      const r = String(u.role || '').trim().toLowerCase();
      let rol = r;
      if (r === 'admin') rol = 'Admin';
      else if (r === 'frontoffice' || r === 'front_office' || r === 'recepcionista') rol = 'FrontOffice';
      else if (r === 'vendedor' || r === 'sales') rol = 'Vendedor';
      else if (r === 'coordinador') rol = 'Coordinador';
      else if (r === 'eventos') rol = 'Eventos';
      return { ...u, rol };
    } catch { return null; }
  })();
  const isOccupancyEditable = currentUser && ['Admin', 'Vendedor', 'FrontOffice'].includes(currentUser.rol);

  useEffect(() => {
    const loadOcc = () => {
      loadCrmState().then(state => {
        setOccupancyOps(state?.occupancyWeeklyOps || {});
      }).catch(() => {});
    };
    loadOcc();
    window.addEventListener('stateUpdated', loadOcc);
    return () => window.removeEventListener('stateUpdated', loadOcc);
  }, []);

  const handleOccupancySave = async (isoDate) => {
    if (!isoDate) return;
    const weekStart = getWeekMonday(isoDate);
    if (!weekStart) return;
    setEditingDay(null);
    try {
      const state = await loadCrmState();
      const serverWeekly = state?.occupancyWeeklyOps || {};
      const currentWeekly = serverWeekly[weekStart] || {};
      const merged = {
        ...serverWeekly,
        [weekStart]: { ...currentWeekly, [isoDate]: { breakfasts: Math.max(0, Number(editDes) || 0), rooms: Math.max(0, Number(editHab) || 0) } }
      };
      await saveCrmState({ ...state, occupancyWeeklyOps: merged });
      setOccupancyOps(merged);
      window.dispatchEvent(new Event('stateUpdated'));
    } catch { toast?.error?.('Error al guardar ocupación') || console.error('Error saving occupancy'); }
  };

  const filterStatus = searchParams.get('status');
  const filterTipo = searchParams.get('tipo');
  const filterSalon = searchParams.get('salon');
  const filterAlertas = searchParams.get('alertas');
  const hasFilter = filterStatus || filterTipo || filterSalon || filterAlertas;

  useEffect(() => {
    setLoading(true);
    fetchEvents(selectedDate)
      .then((eventsData) => {
        const expanded = eventsData.flatMap(expandEventByDay);
        setEvents(expanded);
        setEventsTotal(expanded.length);
      })
      .catch((err) => setError(err.message || 'Error desconocido'))
      .finally(() => setLoading(false));

  }, [selectedDate]);

  const selectedDateObj = new Date(selectedDate + 'T12:00:00');
  const day = selectedDateObj.getDay();
  const diff = selectedDateObj.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(selectedDateObj.setDate(diff));

  const columns = dayNames.map((name, index) => {
    const currentDay = new Date(monday);
    currentDay.setDate(monday.getDate() + index);
    const formattedHeader = currentDay.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    const yyyy = currentDay.getFullYear();
    const mm = String(currentDay.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDay.getDate()).padStart(2, '0');
    const isoDate = `${yyyy}-${mm}-${dd}`;
    return { dayIndex: index, name: formattedHeader, isoDate, items: events.filter((e) => e.dayIndex === index) };
  });

  const filteredColumns = columns.map((col) => ({
    ...col,
    items: col.items.filter((e) => {
      if (filterStatus && e.Estatuscotizacion !== Number(filterStatus)) return false;
      if (filterTipo && e.TipoEvento !== filterTipo) return false;
      if (filterSalon && e.Salon !== filterSalon) return false;
      if (filterAlertas && !(e.tiene_alertas == 1 || e.tiene_alertas === true)) return false;
      return true;
    }),
  }));

  const totalEvents = filteredColumns.reduce((sum, col) => sum + col.items.length, 0);

  const days = dayNames.map((_, index) => {
    const currentDay = new Date(monday);
    currentDay.setDate(monday.getDate() + index);
    const isoDate = currentDay.toISOString().slice(0, 10);
    const label = currentDay.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const dayEvents = events.filter((e) => e.dayIndex === index);
    return { isoDate, label, events: dayEvents, shortDate: formatDateShort(isoDate) };
  }).filter((d) => d.events.length > 0);
  const clearFilters = () => {
    if (filterExiting) return;
    setFilterExiting(true);
    setTimeout(() => {
      setSearchParams({});
      setFilterExiting(false);
    }, 250);
  };

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const rows = events.map(e => ({
      'Fecha': e.displayDate || '',
      'Institución': e.Institucion || '',
      'Salón': e.Salon || '',
      'Horario': `${e.HoraI || ''} - ${e.HoraF || ''}`,
      'Pax': e.Pax || 0,
      'Tipo': e.TipoEvento || '',
      'Estado': statusMap[e.Estatuscotizacion]?.label || '',
      'Vendedor': e.Vendedor || '',
      'Alertas': (e.tiene_alertas == 1 || e.tiene_alertas === true) ? 'Sí' : 'No',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Eventos');
    XLSX.writeFile(wb, `eventos-semana-${selectedDate}.xlsx`);
  };

  let filterLabel = '';
  if (filterStatus === '4') filterLabel = 'Confirmados';
  else if (filterStatus === '7') filterLabel = 'Pre-reservas';
  else if (filterTipo) filterLabel = `Tipo: ${filterTipo}`;
  else if (filterSalon) filterLabel = `Salón: ${filterSalon}`;
  else if (filterAlertas) filterLabel = '⚠️ Alertas';

  return (
    <section className="kanban-shell">
      <div className="kanban-header">
        <div className="kanban-title">
          <h2>{viewMode === 'kanban' ? <><IconGrid size={22} /> Kanban</> : <><IconFileText size={22} /> Tabla Semanal</>}</h2>
          <p>{totalEvents} eventos en la semana{hasFilter ? ' (filtrados)' : ''}</p>
        </div>
        <div className="kanban-filter" style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
          <div className="view-toggle">
            <button className={`view-toggle-btn${viewMode === 'kanban' ? ' active' : ''}`} onClick={() => setViewMode('kanban')}>
              <IconGrid size={13} /> Kanban
            </button>
            <button className={`view-toggle-btn${viewMode === 'tabla' ? ' active' : ''}`} onClick={() => setViewMode('tabla')}>
              <IconFileText size={13} /> Tabla
            </button>
          </div>
          <button
            className={`btn-ghost btn-sm ${filterAlertas ? 'active' : ''}`}
            onClick={() => {
              const newParams = new URLSearchParams(searchParams);
              if (filterAlertas) {
                newParams.delete('alertas');
              } else {
                newParams.set('alertas', '1');
              }
              setSearchParams(newParams);
            }}
            data-tooltip={filterAlertas ? 'Quitar filtro de alertas' : 'Mostrar solo eventos con alertas'}
            style={filterAlertas ? {background:'rgba(245,158,11,0.15)',borderColor:'rgba(245,158,11,0.4)',color:'#d97706'} : {}}
          >
            ⚠️ Alertas
          </button>
          <button className="btn-ghost btn-sm" onClick={exportToExcel} data-tooltip="Exportar a Excel">
            <IconDownload size={14} /> Excel
          </button>
          {viewMode === 'tabla' && (
            <button className="btn-ghost btn-sm" onClick={() => window.print()} data-tooltip="Imprimir / PDF">
              <IconPrinter size={14} /> Descargar
            </button>
          )}
          <label htmlFor="week-filter">Filtrar semana</label>
          <input id="week-filter" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>
      </div>

      {(hasFilter || filterExiting) && (
        <div className={`kanban-filter-bar ${filterExiting ? 'filter-exit' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="kanban-filter-badge">
              {filterStatus === '4' && <><IconCheckCircle size={14} /> {filterLabel}</>}
              {filterStatus === '7' && <><IconClock size={14} /> {filterLabel}</>}
              {filterTipo && <><IconTag size={14} /> {filterLabel}</>}
              {filterSalon && <><IconBuilding size={14} /> {filterLabel}</>}
              {filterAlertas && <><span style={{fontSize:'1rem'}}>⚠️</span> Alertas</>}
            </span>
            <span className="kanban-filter-count">
              {totalEvents} de {eventsTotal} eventos
            </span>
          </div>
          <button className="btn-ghost btn-sm" onClick={clearFilters} data-tooltip="Quitar filtros">
            <IconX size={14} /> Limpiar filtros
          </button>
        </div>
      )}

      {loading && <p className="status-message">Cargando eventos...</p>}
      {error && <p className="status-message status-error">{error}</p>}

      {!loading && !error && viewMode === 'kanban' && (
        <div className="kanban-board">
          {filteredColumns.map((column) => {
            const dayOps = (occupancyOps[getWeekMonday(column.isoDate)]?.[column.isoDate]) || { breakfasts: 0, rooms: 0 };
            const isEditing = editingDay === column.isoDate;
            return (
            <div key={column.name} className="kanban-column">
              <div className="kanban-column-header">
                <div style={{display:'flex',flexDirection:'column',gap:'2px',width:'100%'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%'}}>
                    <span>{column.name}</span>
                    <span className="kanban-column-count">{column.items.length}</span>
                  </div>
                  {!isEditing ? (
                    <div style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'0.6rem',fontWeight:600}}>
                      <span style={{padding:'1px 5px',borderRadius:'4px',background:'#f0fdf4',color:'#16a34a'}}>Des {dayOps.breakfasts}</span>
                      <span style={{padding:'1px 5px',borderRadius:'4px',background:'#eff6ff',color:'#2563eb'}}>Hab {dayOps.rooms}</span>
                      {isOccupancyEditable && (
                        <button type="button" onClick={() => { setEditingDay(column.isoDate); setEditDes(dayOps.breakfasts); setEditHab(dayOps.rooms); }}
                          style={{padding:'0 5px',border:'1px solid #d1d9e6',borderRadius:'4px',background:'#fff',cursor:'pointer',fontSize:'10px',lineHeight:'18px',color:'#6366f1'}}>
                          {'\u270F\uFE0F'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'0.6rem'}}>
                      <span style={{fontWeight:600,color:'#16a34a'}}>Des</span>
                      <input type="number" min="0" value={editDes} onChange={e => setEditDes(Number(e.target.value))}
                        style={{width:'44px',padding:'1px 4px',border:'1px solid #d1d9e6',borderRadius:'4px',fontSize:'0.65rem',fontWeight:600,textAlign:'center'}} />
                      <span style={{fontWeight:600,color:'#2563eb'}}>Hab</span>
                      <input type="number" min="0" value={editHab} onChange={e => setEditHab(Number(e.target.value))}
                        style={{width:'44px',padding:'1px 4px',border:'1px solid #d1d9e6',borderRadius:'4px',fontSize:'0.65rem',fontWeight:600,textAlign:'center'}} />
                      <button type="button" onClick={() => handleOccupancySave(column.isoDate)}
                        style={{padding:'0 6px',border:'none',borderRadius:'4px',background:'#10b981',color:'#fff',cursor:'pointer',fontSize:'10px',fontWeight:700,lineHeight:'18px'}}>OK</button>
                      <button type="button" onClick={() => setEditingDay(null)}
                        style={{padding:'0 6px',border:'1px solid #d1d9e6',borderRadius:'4px',background:'#fff',cursor:'pointer',fontSize:'10px',lineHeight:'18px',color:'#94a3b8'}}>X</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="kanban-column-body">
                {column.items.length === 0 ? (
                  <p className="kanban-empty">Sin eventos este día</p>
                ) : (
                  column.items.map((event) => (
                      <EventCard key={`${event.Idocupacion}-${event.displayDate}`} event={event} />
                  ))
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}

      {!loading && !error && viewMode === 'tabla' && (
        <div style={{overflowX:'auto'}}>
          <table className="tabla-eventos">              <thead>
              <tr>
                <th>Día</th>
                <th>Estado</th>
                <th>Institución</th>
                <th>Salón</th>
                <th>Horario</th>
                <th>Pax</th>
                <th>Alertas</th>
                <th>Vendedor</th>
              </tr>
            </thead>
            <tbody>
              {days.length === 0 ? (
                <tr>
                <td colSpan={8} style={{textAlign:'center',padding:'2rem',color:'var(--text-muted)'}}>
                  No hay eventos esta semana
                </td>
                </tr>
              ) : days.flatMap((day) => {
                const rows = [];
                rows.push(
                  <tr key={day.isoDate} className="tabla-dia-header">
                    <td colSpan={8}><div className="tabla-dia-inner">
                      <span className="tabla-dia-label">{day.label}</span>
                    </div></td>
                  </tr>
                );
                if (day.events.length === 0) {
                  rows.push(
                    <tr key={`${day.isoDate}-empty`}>
                      <td style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{day.shortDate}</td>
                      <td colSpan={6} style={{color:'var(--text-muted)',fontSize:'0.82rem',textAlign:'center'}}>
                        Sin eventos este día
                      </td>
                    </tr>
                  );
                } else {
                  day.events.forEach((ev, ei) => {
                    const st = statusMap[ev.Estatuscotizacion] || { label: 'Desconocido', color: 'gray' };
                    rows.push(
                      <tr key={`${day.isoDate}-${ev.Idocupacion}-${ei}`}>
                        <td style={{fontSize:'0.75rem',color:'var(--text-muted)',whiteSpace:'nowrap'}}>{day.shortDate}</td>
                        <td><span className={`event-tag event-tag-${st.color}`} style={{fontSize:'0.65rem',padding:'0.1rem 0.35rem'}}>{st.label}</span></td>
                        <td style={{fontWeight:500}}>{ev.Institucion || '—'}</td>
                        <td><IconMapPin size={13} /> {ev.Salon || '—'}</td>
                        <td><IconClock size={13} /> {ev.HoraI || '??:??'} - {ev.HoraF || '??:??'}</td>
                        <td>{ev.Pax || 0}</td>
                        <td>{(ev.tiene_alertas == 1 || ev.tiene_alertas === true) ? <span className="event-tag event-tag-warning" style={{fontSize:'0.65rem',padding:'0.1rem 0.35rem'}}>⚠️ Alertas</span> : '—'}</td>
                        <td><IconUser size={13} /> {ev.Vendedor || '—'}</td>
                      </tr>
                    );
                  });
                }
                return rows;
              })}
            </tbody>
          </table>
        </div>
      )}
      <SettingsChecklist />
    </section>
  );
}
