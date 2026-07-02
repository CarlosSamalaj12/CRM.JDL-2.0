import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ReportsVentas from './ReportsVentas';
import ReportsContabilidad from './ReportsContabilidad';
import ReportsOcupacion from './ReportsOcupacion';
import ReportsInstitucion from './ReportsInstitucion';
import ReportsDashboard from './ReportsDashboard';
import ReportsSatisfaccion from './ReportsSatisfaccion';
import ReportsOcupacionBarras from './ReportsOcupacionBarras';
import ReportsEficenciaEventos from './ReportsEficenciaEventos';
import ReportsEficenciaConfirmacion from './ReportsEficenciaConfirmacion';
import ReportsIngresosCategorias from './ReportsIngresosCategorias';
import ReportsSeguimientosPendientes from './ReportsSeguimientosPendientes';
import ReportsVentasUsuario from './ReportsVentasUsuario';
import ReportsComisiones from './ReportsComisiones';
import ReportsProyeccionMetas from './ReportsProyeccionMetas';
import './reports.css';

const BENTO_CARDS = [
  { 
    id: 'ventas', title: 'Reporte de Ventas', 
    desc: 'Resumen comercial, cotizaciones y montos del pipeline',
    badge: 'Ventas • Cotizaciones • Comisiones',
    icon: '📊', variant: 'blue', featured: true,
  },
  { 
    id: 'contabilidad', title: 'Estado de Cuenta',
    desc: 'Ventas netas, cobros y control financiero por empresa',
    badge: 'Contabilidad • Cartera • Pagos',
    icon: '💳', variant: 'green',
  },
  { 
    id: 'ocupacion', title: 'Ocupación',
    desc: 'Uso de salones, disponibilidad y operación semanal',
    badge: 'Salones • PAX • Ocupación',
    icon: '📅', variant: 'purple',
  },
  { 
    id: 'dashboard', title: 'Dashboard',
    desc: 'KPIs, metas comerciales y rendimiento ejecutivo',
    badge: 'KPIs • Metas • Rendimiento',
    icon: '📈', variant: 'amber',
  },
  { 
    id: 'institucion', title: 'Por Institución',
    desc: 'Dashboard detallado por cliente, consumo e historial',
    badge: 'Clientes • Historial • Análisis',
    icon: '🏢', variant: 'rose',
  },
  { 
    id: 'satisfaccion', title: 'Satisfacción',
    desc: 'Ratings de servicio, evaluación por evento y tendencias',
    badge: 'Calidad • Ratings • Clientes',
    icon: '⭐', variant: 'teal', featured: true,
  },
  { 
    id: 'ocupacionBarras', title: 'Porcentaje Ocupación de Eventos',
    desc: 'Gráfico mensual de ocupación PAX vs capacidad de salones',
    badge: 'Barras • % Ocupación • Mensual',
    icon: '📊', variant: 'indigo', featured: true,
  },
  { 
    id: 'eficenciaEventos', title: 'Eficiencia por Estado',
    desc: 'Distribución porcentual mensual de eventos por estado',
    badge: 'Estados • % • Apilado',
    icon: '📈', variant: 'teal', featured: true,
  },
  { 
    id: 'seguimientosPendientes', title: 'Seguimientos Pendientes',
    desc: 'Eventos en pipeline comercial por vendedor · Pre-Reserva · Negociación · 1ra Cotización',
    badge: 'Pipeline • Vendedores • Estados',
    icon: '📋', variant: 'amber', featured: true,
  },
  { 
    id: 'eficenciaConfirmacion', title: 'Eficiencia de Confirmación',
    desc: 'Eventos confirmados por vendedor · Montos en Quetzales · Porcentajes',
    badge: 'Confirmados • Montos • Vendedores',
    icon: '✅', variant: 'green', featured: true,
  },
  { 
    id: 'ingresosCategorias', title: 'Ingresos por Categoría',
    desc: 'Montos en Quetzales generados por categoría de servicio · Alimentos & Bebidas · Hospedajes · Misceláneos',
    badge: 'Categorías • Montos • Servicios',
    icon: '💰', variant: 'indigo', featured: true,
  },
  { 
    id: 'ventasUsuario', title: 'Ventas por Usuario',
    desc: 'Montos generados por vendedor · Eventos con valor económico · Porcentajes y promedios',
    badge: 'Vendedores • Montos • % Porcentajes',
    icon: '👤', variant: 'amber', featured: true,
  },
  { 
    id: 'comisiones', title: 'Comisiones',
    desc: 'Ventas vs niveles de meta · Cálculo de comisiones · Progreso hacia siguiente nivel',
    badge: 'Comisiones • Metas • %',
    icon: '🏆', variant: 'purple', featured: true,
  },
  { 
    id: 'proyeccionMetas', title: 'Proyección de Metas',
    desc: 'Proyección de ventas por vendedor · Cuánto necesita vender para alcanzar el siguiente nivel de meta',
    badge: 'Proyección • Metas • Gaps',
    icon: '🎯', variant: 'amber', featured: true,
  },
];

const ICON_BG = {
  blue: '#2563eb', green: '#16a34a', purple: '#7c3aed',
  amber: '#d97706', rose: '#e11d48', teal: '#0d9488', indigo: '#4f46e5',
};

const reports = {
  ventas: (handleClose) => <ReportsVentas onClose={handleClose} />,
  contabilidad: (handleClose) => <ReportsContabilidad onClose={handleClose} />,
  ocupacion: (handleClose) => <ReportsOcupacion onClose={handleClose} />,
  dashboard: (handleClose) => <ReportsDashboard onClose={handleClose} />,
  institucion: (handleClose) => <ReportsInstitucion onClose={handleClose} />,
  satisfaccion: (handleClose) => <ReportsSatisfaccion onClose={handleClose} />,
  ocupacionBarras: (handleClose) => <ReportsOcupacionBarras onClose={handleClose} />,
  eficenciaEventos: (handleClose) => <ReportsEficenciaEventos onClose={handleClose} />,
  eficenciaConfirmacion: (handleClose) => <ReportsEficenciaConfirmacion onClose={handleClose} />,
  ingresosCategorias: (handleClose) => <ReportsIngresosCategorias onClose={handleClose} />,
  seguimientosPendientes: (handleClose) => <ReportsSeguimientosPendientes onClose={handleClose} />,
  ventasUsuario: (handleClose) => <ReportsVentasUsuario onClose={handleClose} />,
  comisiones: (handleClose) => <ReportsComisiones onClose={handleClose} />,
  proyeccionMetas: (handleClose) => <ReportsProyeccionMetas onClose={handleClose} />,
};

export default function ReportsModule() {
  let navigate;
  try {
    navigate = useNavigate();
  } catch (_err) {
    // Fallback si useNavigate falla (ocurre con Vite HMR en recargas rápidas)
    navigate = (path) => { window.location.href = path; };
  }
  const [selectedReport, setSelectedReport] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const handleClose = () => setSelectedReport(null);

  if (selectedReport && reports[selectedReport]) {
    return reports[selectedReport](handleClose);
  }

  return (
    <>
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
      `}</style>
    <div style={{ 
      padding: '32px 40px', height: '100%', background: '#ffffff',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: '4px' }}>
            EMS Reservas | Jardines del Lago
          </div>
          <h1 style={{ fontSize: '40px', fontWeight: '900', color: '#0f172a', margin: 0, letterSpacing: '-0.03em', lineHeight: '1.1' }}>
            Reportes
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', marginTop: '6px', fontWeight: '500' }}>
            Elige el reporte que deseas consultar
          </p>
        </div>
        <button 
          onClick={() => navigate('/calendar')}
          data-tooltip="Cerrar"
          className="btn-exit"
          style={{
            width: '36px', height: '36px', padding: '0',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%',
          }}
        >
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="16" height="16" className="crm-icon-x">
            <path d="M4 4l10 10M14 4l-10 10" />
          </svg>
        </button>
      </div>

      {/* Bento Grid */}
      <div className="reports-bento">
        {BENTO_CARDS.map((card) => {
          const isHovered = hoveredId === card.id;
          return (
            <div
              key={card.id}
              className={`reports-bento-card reports-bento-card--${card.variant} ${card.featured ? 'reports-bento__featured' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedReport(card.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelectedReport(card.id); }}
              onMouseEnter={() => setHoveredId(card.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="reports-bento-top">
                <div 
                  className="reports-bento-icon"
                  style={{ 
                    background: ICON_BG[card.variant],
                    fontSize: card.featured ? '28px' : '22px',
                    width: card.featured ? '60px' : '48px',
                    height: card.featured ? '60px' : '48px',
                    transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                    transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease',
                  }}
                >
                  {card.icon}
                </div>
                <div className="reports-bento-arrow">→</div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="reports-bento-title" style={{ fontSize: card.featured ? '22px' : '18px' }}>
                  {card.title}
                </div>
                <div className="reports-bento-desc">{card.desc}</div>
              </div>

              <div className="reports-bento-meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={`reports-bento-badge reports-bento-badge--${card.variant}`}>
                  {card.badge}
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', opacity: isHovered ? 1 : 0.5, transition: 'opacity 0.2s ease' }}>
                  Abrir →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}
