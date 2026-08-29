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

const BENTO_CARDS = [
  {
    id: 'ventas', title: 'Reporte de Ventas',
    desc: 'Análisis detallado de transacciones, conversiones por canal, ticket promedio y comparativa histórica de ingresos operativos.',
    badge: 'Ventas • Cotizaciones • Comisiones',
    materialIcon: 'trending_up', variant: 'blue', category: 'Ventas', featured: true,
  },
  {
    id: 'dashboard', title: 'Dashboard Principal',
    desc: 'Vista ejecutiva consolidada de métricas críticas diarias, KPIs, metas comerciales y rendimiento ejecutivo.',
    badge: 'Resumen • KPIs • Metas',
    materialIcon: 'dashboard', variant: 'amber', category: 'KPIs', featured: true,
  },
  {
    id: 'contabilidad', title: 'Estado de Cuenta',
    desc: 'Balance general, flujo de caja, cobranzas y ventas netas con control financiero por empresa.',
    badge: 'Caja • Bancos • Cartera',
    materialIcon: 'account_balance', variant: 'emerald', category: 'Finanzas', featured: false,
  },
  {
    id: 'satisfaccion', title: 'Índice de Satisfacción',
    desc: 'NPS, encuestas post-servicio, calificaciones de eventos y métricas de retención de clientes clave.',
    badge: 'NPS • Feedback • Ratings',
    materialIcon: 'sentiment_satisfied', variant: 'teal', category: 'Calidad', featured: true,
  },
  {
    id: 'ocupacion', title: 'Ocupación Semanal',
    desc: 'Utilización de salones, disponibilidad de espacios físicos y resumen de PAX de la operación semanal.',
    badge: 'Espacios • Salas • PAX',
    materialIcon: 'meeting_room', variant: 'violet', category: 'Operación', featured: false,
  },
  {
    id: 'institucion', title: 'Por Institución',
    desc: 'Desglose de ingresos y volumen de eventos por cuentas corporativas y clientes frecuentes.',
    badge: 'B2B • Cuentas • Clientes',
    materialIcon: 'corporate_fare', variant: 'rose', category: 'Clientes', featured: false,
  },
  {
    id: 'ocupacionBarras', title: '% Ocupación de Eventos',
    desc: 'Gráfico mensual comparativo de ocupación de PAX vs capacidad máxima de salones.',
    badge: 'Barras • % Ocupación • Mensual',
    materialIcon: 'bar_chart', variant: 'indigo', category: 'Operación', featured: true,
  },
  {
    id: 'eficenciaEventos', title: 'Eficiencia por Estado',
    desc: 'Distribución porcentual mensual de eventos por estado en formato apilado.',
    badge: 'Estados • % • Apilado',
    materialIcon: 'stacked_line_chart', variant: 'teal', category: 'Operación', featured: true,
  },
  {
    id: 'seguimientosPendientes', title: 'Seguimientos Pendientes',
    desc: 'Eventos en pipeline comercial por vendedor · Pre-Reserva · Negociación · 1ra Cotización.',
    badge: 'Pipeline • Vendedores • Estados',
    materialIcon: 'pending_actions', variant: 'amber', category: 'Pipeline', featured: true,
  },
  {
    id: 'eficenciaConfirmacion', title: 'Eficiencia de Confirmación',
    desc: 'Eventos confirmados por vendedor · Montos en Quetzales y porcentajes de conversión.',
    badge: 'Confirmados • Montos • Vendedores',
    materialIcon: 'verified', variant: 'emerald', category: 'KPIs', featured: true,
  },
  {
    id: 'ingresosCategorias', title: 'Ingresos por Categoría',
    desc: 'Montos generados por categoría de servicio · Alimentos & Bebidas · Hospedajes · Misceláneos.',
    badge: 'Categorías • Montos • Servicios',
    materialIcon: 'payments', variant: 'indigo', category: 'Finanzas', featured: true,
  },
  {
    id: 'comisiones', title: 'Comisiones',
    desc: 'Ventas vs niveles de meta · Cálculo de comisiones por vendedor · Avance de metas.',
    badge: 'Comisiones • Metas • %',
    materialIcon: 'military_tech', variant: 'purple', category: 'Ventas', featured: true,
  },
  {
    id: 'proyeccionMetas', title: 'Proyección de Metas',
    desc: 'Proyección de ventas por vendedor · Brecha de ventas requerida para la siguiente meta.',
    badge: 'Proyección • Metas • Gaps',
    materialIcon: 'ads_click', variant: 'amber', category: 'KPIs', featured: true,
  },
  {
    id: 'eventosAsignados', title: 'Eventos Asignados',
    desc: 'Fechas de asignación, tiempo de respuesta, embudo de conversión y distribución por vendedor de los leads del pipeline comercial.',
    badge: 'Asignaciones • Respuesta • Vendedores',
    materialIcon: 'handshake', variant: 'teal', category: 'Pipeline', featured: true,
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
  { id: 'all',       label: 'Todos',     icon: 'grid_view' },
  { id: 'Ventas',    label: 'Ventas',    icon: 'trending_up' },
  { id: 'Finanzas',  label: 'Finanzas',  icon: 'account_balance_wallet' },
  { id: 'Operación', label: 'Operación', icon: 'engineering' },
  { id: 'KPIs',      label: 'KPIs',      icon: 'speed' },
  { id: 'Clientes',  label: 'Clientes',  icon: 'groups' },
  { id: 'Calidad',   label: 'Calidad',   icon: 'verified' },
  { id: 'Pipeline',  label: 'Pipeline',  icon: 'linear_scale' },
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
                <span className="material-symbols-outlined">{chip.icon}</span>
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de tarjetas de reporte */}
      {filteredCards.length === 0 ? (
        <div className="reports-empty">
          <div className="reports-empty__icon">🔍</div>
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
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="reports-hub-card-star-text">Destacado</span>
                  </div>
                )}

                <div className="reports-hub-card-icon">
                  <span className="material-symbols-outlined">{card.materialIcon}</span>
                </div>

                <span className="reports-hub-card-cat">{card.category}</span>
                <h3 className="reports-hub-card-title">{card.title}</h3>
                <p className="reports-hub-card-desc">{card.desc}</p>

                <div className="reports-hub-card-foot">
                  <div className="reports-hub-card-tags">
                    {card.badge}
                  </div>
                  <span className="material-symbols-outlined reports-hub-card-arrow">arrow_outward</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
