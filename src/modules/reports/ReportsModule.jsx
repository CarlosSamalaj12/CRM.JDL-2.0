import { useState, useMemo, useEffect, useRef } from 'react';

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
import ReportsComisiones from './ReportsComisiones';
import ReportsProyeccionMetas from './ReportsProyeccionMetas';
import ReportsEventosAsignados from './ReportsEventosAsignados';
import './reports.css';

// ─── Iconos SVG vectoriales minimalistas para el Hub ───
const HubIcon = ({ name, size = 20, stroke = 'currentColor', fill = 'none' }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill, stroke, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'trending-up':
      return <svg {...props}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
    case 'wallet':
      return <svg {...props}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>;
    case 'calendar':
      return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
    case 'target':
      return <svg {...props}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
    case 'building':
      return <svg {...props}><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="22" x2="9" y2="2" /><line x1="15" y1="22" x2="15" y2="2" /><line x1="4" y1="12" x2="20" y2="12" /></svg>;
    case 'star':
      return <svg {...props} fill={fill !== 'none' ? fill : 'currentColor'}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
    case 'bar-chart':
      return <svg {...props}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
    case 'stacked-bars':
      return <svg {...props}><rect x="4" y="14" width="16" height="6" rx="1" /><rect x="4" y="8" width="16" height="4" rx="1" /><rect x="4" y="4" width="16" height="2" rx="1" /></svg>;
    case 'clipboard':
      return <svg {...props}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>;
    case 'users':
      return <svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case 'check-circle':
      return <svg {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
    case 'dollar':
      return <svg {...props}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
    case 'award':
      return <svg {...props}><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></svg>;
    case 'sparkles':
      return <svg {...props}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>;
    case 'arrow-up-right':
      return <svg {...props}><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>;
    case 'search':
      return <svg {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    default:
      return null;
  }
};

const BENTO_CARDS = [
  {
    id: 'ventas', title: 'Reporte de Ventas',
    desc: 'Análisis detallado de transacciones, conversiones por canal, ticket promedio y comparativa histórica de ingresos operativos.',
    badge: 'Ventas • Cotizaciones • Comisiones',
    iconName: 'trending-up', variant: 'blue', category: 'Ventas', featured: true,
  },
  {
    id: 'dashboard', title: 'Dashboard Principal',
    desc: 'Vista ejecutiva consolidada de métricas críticas diarias, KPIs, metas comerciales y rendimiento ejecutivo.',
    badge: 'Resumen • KPIs • Metas',
    iconName: 'target', variant: 'amber', category: 'KPIs', featured: true,
  },
  {
    id: 'contabilidad', title: 'Estado de Cuenta',
    desc: 'Balance general, flujo de caja, cobranzas y ventas netas con control financiero por empresa.',
    badge: 'Caja • Bancos • Cartera',
    iconName: 'wallet', variant: 'emerald', category: 'Finanzas', featured: false,
  },
  {
    id: 'satisfaccion', title: 'Índice de Satisfacción',
    desc: 'NPS, encuestas post-servicio, calificaciones de eventos y métricas de retención de clientes clave.',
    badge: 'NPS • Feedback • Ratings',
    iconName: 'star', variant: 'teal', category: 'Calidad', featured: true,
  },
  {
    id: 'ocupacion', title: 'Ocupación Semanal',
    desc: 'Utilización de salones, disponibilidad de espacios físicos y resumen de PAX de la operación semanal.',
    badge: 'Espacios • Salas • PAX',
    iconName: 'calendar', variant: 'violet', category: 'Operación', featured: false,
  },
  {
    id: 'institucion', title: 'Por Institución',
    desc: 'Desglose de ingresos y volumen de eventos por cuentas corporativas y clientes frecuentes.',
    badge: 'B2B • Cuentas • Clientes',
    iconName: 'building', variant: 'rose', category: 'Clientes', featured: false,
  },
  {
    id: 'ocupacionBarras', title: '% Ocupación de Eventos',
    desc: 'Gráfico mensual comparativo de ocupación de PAX vs capacidad máxima de salones.',
    badge: 'Barras • % Ocupación • Mensual',
    iconName: 'bar-chart', variant: 'indigo', category: 'Operación', featured: true,
  },
  {
    id: 'eficenciaEventos', title: 'Eficiencia por Estado',
    desc: 'Distribución porcentual mensual de eventos por estado en formato apilado.',
    badge: 'Estados • % • Apilado',
    iconName: 'stacked-bars', variant: 'teal', category: 'Operación', featured: true,
  },
  {
    id: 'seguimientosPendientes', title: 'Seguimientos Pendientes',
    desc: 'Eventos en pipeline comercial por vendedor · Pre-Reserva · Negociación · 1ra Cotización.',
    badge: 'Pipeline • Vendedores • Estados',
    iconName: 'clipboard', variant: 'amber', category: 'Pipeline', featured: true,
  },
  {
    id: 'eficenciaConfirmacion', title: 'Eficiencia de Confirmación',
    desc: 'Eventos confirmados por vendedor · Montos en Quetzales y porcentajes de conversión.',
    badge: 'Confirmados • Montos • Vendedores',
    iconName: 'check-circle', variant: 'emerald', category: 'KPIs', featured: true,
  },
  {
    id: 'ingresosCategorias', title: 'Ingresos por Categoría',
    desc: 'Montos generados por categoría de servicio · Alimentos & Bebidas · Hospedajes · Misceláneos.',
    badge: 'Categorías • Montos • Servicios',
    iconName: 'dollar', variant: 'indigo', category: 'Finanzas', featured: true,
  },
  {
    id: 'comisiones', title: 'Comisiones',
    desc: 'Ventas vs niveles de meta · Cálculo de comisiones por vendedor · Avance de metas.',
    badge: 'Comisiones • Metas • %',
    iconName: 'award', variant: 'purple', category: 'Ventas', featured: true,
  },
  {
    id: 'proyeccionMetas', title: 'Proyección de Metas',
    desc: 'Proyección de ventas por vendedor · Brecha de ventas requerida para la siguiente meta.',
    badge: 'Proyección • Metas • Gaps',
    iconName: 'target', variant: 'amber', category: 'KPIs', featured: true,
  },
  {
    id: 'eventosAsignados', title: 'Eventos Asignados',
    desc: 'Fechas de asignación, tiempo de respuesta, embudo de conversión y distribución por vendedor de los leads del pipeline comercial.',
    badge: 'Asignaciones • Respuesta • Vendedores',
    iconName: 'users', variant: 'teal', category: 'Pipeline', featured: true,
  },
];

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
  comisiones: (handleClose) => <ReportsComisiones onClose={handleClose} />,
  proyeccionMetas: (handleClose) => <ReportsProyeccionMetas onClose={handleClose} />,
  eventosAsignados: (handleClose) => <ReportsEventosAsignados onClose={handleClose} />,
};

// ─── Chips de filtro ───
const FILTER_CHIPS = [
  { id: 'all',       label: 'Todos',     iconName: 'sparkles' },
  { id: 'Ventas',    label: 'Ventas',    iconName: 'trending-up' },
  { id: 'Finanzas',  label: 'Finanzas',  iconName: 'wallet' },
  { id: 'Operación', label: 'Operación', iconName: 'calendar' },
  { id: 'KPIs',      label: 'KPIs',      iconName: 'target' },
  { id: 'Clientes',  label: 'Clientes',  iconName: 'building' },
  { id: 'Calidad',   label: 'Calidad',   iconName: 'star' },
  { id: 'Pipeline',  label: 'Pipeline',  iconName: 'clipboard' },
];

export default function ReportsModule() {
  const [selectedReport, setSelectedReport] = useState(null);
  const [activeChip, setActiveChip] = useState('all');
  const chipsRef = useRef(null);

  // Drag horizontal para los chips
  useEffect(() => {
    const el = chipsRef.current;
    if (!el) return;
    let isDown = false, startX = 0, scrollLeft = 0;
    const onDown = (e) => {
      isDown = true;
      startX = (e.pageX || e.touches?.[0]?.pageX || 0) - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    };
    const onLeave = () => { isDown = false; };
    const onUp = () => { isDown = false; };
    const onMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = (e.pageX || e.touches?.[0]?.pageX || 0) - el.offsetLeft;
      el.scrollLeft = scrollLeft - (x - startX);
    };
    el.addEventListener('mousedown', onDown);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('mouseup', onUp);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('touchstart', onDown, { passive: true });
    el.addEventListener('touchend', onUp);
    el.addEventListener('touchmove', onMove, { passive: true });
    return () => {
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('mouseup', onUp);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('touchstart', onDown);
      el.removeEventListener('touchend', onUp);
      el.removeEventListener('touchmove', onMove);
    };
  }, []);

  // Filtrado por chip
  const filteredCards = useMemo(() => {
    return BENTO_CARDS.filter((card) => {
      return activeChip === 'all' || card.category === activeChip;
    });
  }, [activeChip]);

  const handleClose = () => setSelectedReport(null);

  // ────────────── VISTA SUB-REPORTE ──────────────
  if (selectedReport && reports[selectedReport]) {
    return reports[selectedReport](handleClose);
  }

  // ────────────── VISTA HUB DE REPORTES ──────────────
  return (
    <div className="reports-hub-container">
      {/* Encabezado sin buscador */}
      <div className="reports-hub-header">
        <div className="reports-hub-title-area">
          <h1 className="reports-hub-title">Reportes Generales</h1>
          <p className="reports-hub-subtitle">
            Visualiza y analiza las métricas clave del sistema operativo. Utiliza los filtros para encontrar el dashboard específico que necesitas.
          </p>
        </div>

        {/* Chips de filtro */}
        <div className="reports-hub-chips-bar" ref={chipsRef}>
          {FILTER_CHIPS.map((chip) => {
            const isActive = activeChip === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                className={`reports-hub-chip ${isActive ? 'reports-hub-chip--active' : ''}`}
                onClick={() => setActiveChip(chip.id)}
              >
                <HubIcon name={chip.iconName} size={14} />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de tarjetas de reporte */}
      {filteredCards.length === 0 ? (
        <div className="reports-empty">
          <div className="reports-empty__icon" style={{ display: 'flex', justifyContent: 'center' }}>
            <HubIcon name="search" size={40} stroke="#94a3b8" />
          </div>
          <div className="reports-empty__title">Sin resultados</div>
          <div className="reports-empty__text">No hay reportes en esta categoría.</div>
          <button
            type="button"
            className="reports-empty__btn"
            onClick={() => setActiveChip('all')}
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="reports-hub-grid">
          {filteredCards.map((card) => {
            return (
              <div
                key={card.id}
                className={`reports-hub-card reports-hub-card--${card.variant}`}
                onClick={() => setSelectedReport(card.id)}
              >
                {card.featured && (
                  <div className="reports-hub-card-star" title="Destacado">
                    <HubIcon name="star" size={12} stroke="#f59e0b" fill="#f59e0b" />
                    <span className="reports-hub-card-star-text">Destacado</span>
                  </div>
                )}

                <div className="reports-hub-card-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HubIcon name={card.iconName} size={22} stroke="currentColor" />
                </div>

                <span className="reports-hub-card-cat">{card.category}</span>
                <h3 className="reports-hub-card-title">{card.title}</h3>
                <p className="reports-hub-card-desc">{card.desc}</p>

                <div className="reports-hub-card-foot">
                  <div className="reports-hub-card-tags">
                    {card.badge}
                  </div>
                  <span className="reports-hub-card-arrow" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <HubIcon name="arrow-up-right" size={16} stroke="currentColor" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
