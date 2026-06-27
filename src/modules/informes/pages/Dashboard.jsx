import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEventStats } from '../services/api.js';
import {
  IconCalendar, IconCheckCircle, IconUsers, IconTrendingUp,
  IconMapPin, IconTag, IconBuilding, IconClock
} from '../components/Icons.jsx';

const statusColors = {
  4: 'confirmed',
  7: 'prereserva',
};

const statusLabels = {
  4: 'Confirmado',
  7: 'Pre-reserva',
};

const barColors = ['purple', 'green', 'amber', 'blue', 'pink', 'gray'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEventStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="status-message">Cargando estadísticas...</p>;
  if (error) return <p className="status-message status-error">{error}</p>;
  if (!stats) return <p className="status-message">No hay datos disponibles</p>;

  const { resumen, por_tipo, por_salon, proximos_eventos } = stats;
  const maxTipo = por_tipo.length > 0 ? Math.max(...por_tipo.map(t => t.cantidad)) : 1;
  const maxSalon = por_salon.length > 0 ? Math.max(...por_salon.map(s => s.cantidad)) : 1;

  return (
    <section className="dashboard-shell">
      <div className="dashboard-header">
        <div>
          <h1>Panel de Control</h1>
          <p>Resumen general de eventos y ocupación</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/kanban')} data-tooltip="Ver todos los eventos">
          <div className="stat-icon purple"><IconCalendar size={22} /></div>
          <div className="stat-info">
            <div className="stat-value">{resumen.total_eventos}</div>
            <div className="stat-label">Total de Eventos</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/kanban?status=4')} data-tooltip="Filtrar: solo confirmados">
          <div className="stat-icon green"><IconCheckCircle size={22} /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: 'var(--success-color)' }}>{resumen.confirmados}</div>
            <div className="stat-label">Confirmados</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/kanban?status=7')} data-tooltip="Filtrar: solo pre-reservas">
          <div className="stat-icon" style={{ background: 'rgba(217, 70, 239, 0.12)', color: '#d946ef' }}><IconClock size={22} /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#d946ef' }}>{resumen.pre_reservas}</div>
            <div className="stat-label">Pre-reservas</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/kanban')} data-tooltip="Ir a Ocupación">
          <div className="stat-icon blue"><IconUsers size={22} /></div>
          <div className="stat-info">
            <div className="stat-value">{resumen.total_pax}</div>
            <div className="stat-label">Total Pax</div>
            <div className="stat-change up">
              <IconTrendingUp size={14} />
              Promedio {resumen.pax_promedio} por evento
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="dashboard-grid">
        {/* Eventos por Tipo */}
        <div className="dashboard-card">
          <h3><IconTag size={16} /> Eventos por Tipo</h3>
          {por_tipo.length > 0 ? (
            <div className="chart-bar-group">
              {por_tipo.map((item, i) => (
                <div key={item.TipoEvento} className="chart-bar-row" onClick={() => navigate(`/kanban?tipo=${encodeURIComponent(item.TipoEvento)}`)} data-tooltip={`Filtrar por: ${item.TipoEvento}`}>
                  <span className="chart-bar-label">{item.TipoEvento}</span>
                  <div className="chart-bar-track">
                    <div
                      className={`chart-bar-fill ${barColors[i % barColors.length]}`}
                      style={{ width: `${(item.cantidad / maxTipo) * 100}%` }}
                    >
                      {item.cantidad}
                    </div>
                  </div>
                  <span className="chart-bar-count">{item.cantidad}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">Sin datos de tipos de evento</p>
          )}
        </div>

        {/* Eventos por Salón */}
        <div className="dashboard-card">
          <h3><IconBuilding size={16} /> Eventos por Salón</h3>
          {por_salon.length > 0 ? (
            <div className="chart-bar-group">
              {por_salon.map((item, i) => (
                <div key={item.Salon} className="chart-bar-row" onClick={() => navigate(`/kanban?salon=${encodeURIComponent(item.Salon)}`)} data-tooltip={`Filtrar por: ${item.Salon}`}>
                  <span className="chart-bar-label">{item.Salon}</span>
                  <div className="chart-bar-track">
                    <div
                      className={`chart-bar-fill ${barColors[(i + 1) % barColors.length]}`}
                      style={{ width: `${(item.cantidad / maxSalon) * 100}%` }}
                    >
                      {item.cantidad}
                    </div>
                  </div>
                  <span className="chart-bar-count">{item.cantidad}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">Sin datos de salones</p>
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="dashboard-card">
        <h3><IconCalendar size={16} /> Próximos Eventos</h3>
        {proximos_eventos.length > 0 ? (
          <div className="event-list-compact">
            {proximos_eventos.map((ev) => (
              <div key={ev.Idocupacion} className="event-item-compact" onClick={() => navigate(`/informe/${ev.Idocupacion}`)} data-tooltip="Ver informe del evento">
                <span className="event-item-date">
                  <IconClock size={13} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                  {formatDate(ev.FechaEvento)}
                </span>
                <span className="event-item-name">{ev.Institucion}</span>
                <span className="event-item-pax">
                  <IconUsers size={12} style={{ marginRight: 2, verticalAlign: 'middle' }} />
                  {ev.Pax} pax
                </span>
                <span className={`event-item-status ${statusColors[ev.Estatuscotizacion] || ''}`}>
                  {statusLabels[ev.Estatuscotizacion] || '?'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="dashboard-empty">No hay eventos próximos</p>
        )}
      </div>
    </section>
  );
}
