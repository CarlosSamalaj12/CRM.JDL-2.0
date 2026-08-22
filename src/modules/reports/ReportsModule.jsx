import { useState, useMemo, useEffect, useRef } from 'react';
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
import ReportsComisiones from './ReportsComisiones';
import ReportsProyeccionMetas from './ReportsProyeccionMetas';
import './reports.css';

const BENTO_CARDS = [
  {
    id: 'ventas', title: 'Reporte de Ventas',
    desc: 'Resumen comercial, cotizaciones y montos del pipeline',
    badge: 'Ventas • Cotizaciones • Comisiones',
    icon: 'chart-bar', variant: 'blue', category: 'Ventas', featured: true,
  },
  {
    id: 'contabilidad', title: 'Estado de Cuenta',
    desc: 'Ventas netas, cobros y control financiero por empresa',
    badge: 'Contabilidad • Cartera • Pagos',
    icon: 'wallet', variant: 'green', category: 'Finanzas',
  },
  {
    id: 'ocupacion', title: 'Ocupación',
    desc: 'Uso de salones, disponibilidad y operación semanal',
    badge: 'Salones • PAX • Ocupación',
    icon: 'calendar', variant: 'purple', category: 'Operación',
  },
  {
    id: 'dashboard', title: 'Dashboard',
    desc: 'KPIs, metas comerciales y rendimiento ejecutivo',
    badge: 'KPIs • Metas • Rendimiento',
    icon: 'gauge', variant: 'amber', category: 'KPIs', featured: true,
  },
  {
    id: 'institucion', title: 'Por Institución',
    desc: 'Dashboard detallado por cliente, consumo e historial',
    badge: 'Clientes • Historial • Análisis',
    icon: 'building', variant: 'rose', category: 'Clientes',
  },
  {
    id: 'satisfaccion', title: 'Satisfacción',
    desc: 'Ratings de servicio, evaluación por evento y tendencias',
    badge: 'Calidad • Ratings • Clientes',
    icon: 'star', variant: 'teal', category: 'Calidad', featured: true,
  },
  {
    id: 'ocupacionBarras', title: 'Porcentaje Ocupación de Eventos',
    desc: 'Gráfico mensual de ocupación PAX vs capacidad de salones',
    badge: 'Barras • % Ocupación • Mensual',
    icon: 'bar-chart', variant: 'indigo', category: 'Operación', featured: true,
  },
  {
    id: 'eficenciaEventos', title: 'Eficiencia por Estado',
    desc: 'Distribución porcentual mensual de eventos por estado',
    badge: 'Estados • % • Apilado',
    icon: 'pie-chart', variant: 'teal', category: 'Operación', featured: true,
  },
  {
    id: 'seguimientosPendientes', title: 'Seguimientos Pendientes',
    desc: 'Eventos en pipeline comercial por vendedor · Pre-Reserva · Negociación · 1ra Cotización',
    badge: 'Pipeline • Vendedores • Estados',
    icon: 'list-checks', variant: 'amber', category: 'Pipeline', featured: true,
  },
  {
    id: 'eficenciaConfirmacion', title: 'Eficiencia de Confirmación',
    desc: 'Eventos confirmados por vendedor · Montos en Quetzales · Porcentajes',
    badge: 'Confirmados • Montos • Vendedores',
    icon: 'check-circle', variant: 'green', category: 'KPIs', featured: true,
  },
  {
    id: 'ingresosCategorias', title: 'Ingresos por Categoría',
    desc: 'Montos en Quetzales generados por categoría de servicio · Alimentos & Bebidas · Hospedajes · Misceláneos',
    badge: 'Categorías • Montos • Servicios',
    icon: 'layers', variant: 'indigo', category: 'Finanzas', featured: true,
  },
  {
    id: 'comisiones', title: 'Comisiones',
    desc: 'Ventas vs niveles de meta · Cálculo de comisiones · Progreso hacia siguiente nivel',
    badge: 'Comisiones • Metas • %',
    icon: 'award', variant: 'purple', category: 'Ventas', featured: true,
  },
  {
    id: 'proyeccionMetas', title: 'Proyección de Metas',
    desc: 'Proyección de ventas por vendedor · Cuánto necesita vender para alcanzar el siguiente nivel de meta',
    badge: 'Proyección • Metas • Gaps',
    icon: 'target', variant: 'amber', category: 'KPIs', featured: true,
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
  comisiones: (handleClose) => <ReportsComisiones onClose={handleClose} />,
  proyeccionMetas: (handleClose) => <ReportsProyeccionMetas onClose={handleClose} />,
};

// ─── Chips de filtro ───
const FILTER_CHIPS = [
  { id: 'all',       label: 'Todos',     icon: 'grid' },
  { id: 'Ventas',    label: 'Ventas',    icon: 'chart-bar' },
  { id: 'Finanzas',  label: 'Finanzas',  icon: 'wallet' },
  { id: 'Operación', label: 'Operación', icon: 'calendar' },
  { id: 'KPIs',      label: 'KPIs',      icon: 'gauge' },
  { id: 'Clientes',  label: 'Clientes',  icon: 'building' },
  { id: 'Calidad',   label: 'Calidad',   icon: 'star' },
  { id: 'Pipeline',  label: 'Pipeline',  icon: 'list-checks' },
];

// ─── Bottom nav (estilo YouTube) ───
const BOTTOM_NAV = [
  { id: 'home',    label: 'Inicio',   icon: 'home' },
  { id: 'reports', label: 'Informes', icon: 'chart' },
  { id: 'add',     label: 'Nuevo',    icon: 'plus' },
  { id: 'alerts',  label: 'Alertas',  icon: 'bell' },
  { id: 'more',    label: 'Más',      icon: 'menu' },
];

// ─── Iconos SVG inline (estilo Lucide ultra minimalista) ───
const Icon = ({ name, size = 22, stroke = 'currentColor' }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: 1.25, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'search':
      return <svg {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    case 'bell':
      return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
    case 'home':
      return <svg {...props}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /></svg>;
    case 'chart':
      return <svg {...props}><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-6" /></svg>;
    case 'chart-bar':
      return <svg {...props}><path d="M3 3v18h18" /><path d="M8 17V11" /><path d="M13 17V7" /><path d="M18 17V13" /></svg>;
    case 'bar-chart':
      return <svg {...props}><path d="M3 3v18h18" /><path d="M8 17V12" /><path d="M13 17V8" /><path d="M18 17v-3" /></svg>;
    case 'pie-chart':
      return <svg {...props}><path d="M21 12A9 9 0 1 1 12 3v9z" /></svg>;
    case 'gauge':
      return <svg {...props}><path d="M21 13A9 9 0 1 0 6 5.5" /><path d="M12 14v-4" /><path d="m12 14 4-3.5" /></svg>;
    case 'wallet':
      return <svg {...props}><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M3 9h18" /><circle cx="17" cy="13" r="0.8" fill={stroke} /></svg>;
    case 'calendar':
      return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4M16 3v4" /></svg>;
    case 'building':
      return <svg {...props}><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" /></svg>;
    case 'star':
      return <svg {...props}><polygon points="12 3 15.1 8.3 21 9.3 16.5 13.6 17.8 19.5 12 16.8 6.2 19.5 7.5 13.6 3 9.3 8.9 8.3 12 3" /></svg>;
    case 'list-checks':
      return <svg {...props}><path d="m3 6 1.5 1.5 3-3" /><path d="m3 13 1.5 1.5 3-3" /><path d="m3 20 1.5 1.5 3-3" /><path d="M9 6h12" /><path d="M9 13h12" /><path d="M9 20h12" /></svg>;
    case 'check-circle':
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>;
    case 'layers':
      return <svg {...props}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></svg>;
    case 'award':
      return <svg {...props}><circle cx="12" cy="9" r="6" /><path d="M9 14.5 7.5 21l4.5-3 4.5 3L15 14.5" /></svg>;
    case 'target':
      return <svg {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill={stroke} /></svg>;
    case 'grid':
      return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
    case 'plus':
      return <svg {...props} strokeWidth={1.8}><path d="M12 5v14M5 12h14" /></svg>;
    case 'menu':
      return <svg {...props}><path d="M3 6h18M3 12h18M3 18h12" /></svg>;
    case 'arrow-right':
      return <svg {...props}><path d="M5 12h14M13 5l7 7-7 7" /></svg>;
    case 'arrow-left':
      return <svg {...props}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>;
    case 'x':
      return <svg {...props}><path d="M18 6 6 18M6 6l12 12" /></svg>;
    default:
      return null;
  }
};

export default function ReportsModule() {
  const navigate = useNavigate();
  const [selectedReport, setSelectedReport] = useState(null);
  const [search, setSearch] = useState('');
  const [activeChip, setActiveChip] = useState('all');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const chipsRef = useRef(null);
  const searchInputRef = useRef(null);

  // Foco automático al abrir búsqueda
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Drag horizontal para los chips (estilo YouTube)
  useEffect(() => {
    const el = chipsRef.current;
    if (!el) return;
    let isDown = false, startX = 0, scrollLeft = 0;
    const onDown = (e) => {
      isDown = true;
      el.classList.add('reports-chips--dragging');
      startX = (e.pageX || e.touches?.[0]?.pageX || 0) - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    };
    const onLeave = () => { isDown = false; el.classList.remove('reports-chips--dragging'); };
    const onUp = () => { isDown = false; el.classList.remove('reports-chips--dragging'); };
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

  // Filtrado por búsqueda + chip
  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return BENTO_CARDS.filter((card) => {
      const matchChip = activeChip === 'all' || card.category === activeChip;
      const matchSearch = !q
        || card.title.toLowerCase().includes(q)
        || card.desc.toLowerCase().includes(q)
        || card.badge.toLowerCase().includes(q)
        || (card.category || '').toLowerCase().includes(q);
      return matchChip && matchSearch;
    });
  }, [search, activeChip]);

  const handleClose = () => setSelectedReport(null);

  // ────────────── VISTA SUB-REPORTE (mantiene la lógica existente) ──────────────
  if (selectedReport && reports[selectedReport]) {
    return reports[selectedReport](handleClose);
  }

  // ────────────── VISTA HUB (selector de reporte) — YouTube mobile style ──────────────
  return (
    <div className="reports-mobile-shell">
      {/* ── HEADER STICKY (estilo YouTube mobile) ── */}
      <header className="reports-mobile-header">
        <div className="reports-mobile-header__row">
          <div className="reports-mobile-header__brand">
            <div className="reports-mobile-header__logo" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="m10 9 5 3-5 3z" fill="currentColor" />
              </svg>
            </div>
            <div className="reports-mobile-header__title">
              <div className="reports-mobile-header__eyebrow">EMS · Jardines del Lago</div>
              <div className="reports-mobile-header__heading">Reportes</div>
            </div>
          </div>

          <div className="reports-mobile-header__actions">
            <button
              type="button"
              className="reports-icon-btn"
              onClick={() => { setShowSearch((s) => !s); setShowNotifications(false); }}
              aria-label="Buscar reporte"
              data-tooltip="Buscar"
            >
              <Icon name="search" size={20} />
            </button>

            <button
              type="button"
              className="reports-icon-btn reports-icon-btn--badge"
              onClick={() => { setShowNotifications((s) => !s); setShowSearch(false); }}
              aria-label="Notificaciones"
              data-tooltip="Notificaciones"
            >
              <Icon name="bell" size={20} />
              <span className="reports-icon-btn__dot">3</span>
            </button>

            <button
              type="button"
              className="reports-icon-btn"
              onClick={() => navigate('/calendar')}
              aria-label="Salir"
              data-tooltip="Salir"
            >
              <Icon name="x" size={20} />
            </button>
          </div>
        </div>

        {/* Search bar expandible */}
        {showSearch && (
          <div className="reports-mobile-search">
            <Icon name="search" size={18} stroke="#64748b" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar reportes, categorías…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="reports-mobile-search__input"
            />
            {search && (
              <button
                type="button"
                className="reports-mobile-search__clear"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
              >
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        )}

        {/* Panel de notificaciones */}
        {showNotifications && (
          <div className="reports-mobile-notifications" role="dialog" aria-label="Notificaciones">
            <div className="reports-mobile-notifications__head">
              <strong>Notificaciones</strong>
              <button
                type="button"
                onClick={() => setShowNotifications(false)}
                className="reports-mobile-notifications__close"
              >
                Marcar leídas
              </button>
            </div>
            <ul className="reports-mobile-notifications__list">
              <li>
                <span className="reports-mobile-notifications__dot" style={{ background: '#ef4444' }} />
                <div>
                  <div className="reports-mobile-notifications__title">Cotización #1284 pendiente</div>
                  <div className="reports-mobile-notifications__meta">hace 12 min · Negociación</div>
                </div>
              </li>
              <li>
                <span className="reports-mobile-notifications__dot" style={{ background: '#f59e0b' }} />
                <div>
                  <div className="reports-mobile-notifications__title">Meta de comisiones al 78%</div>
                  <div className="reports-mobile-notifications__meta">hace 1 h · Proyección</div>
                </div>
              </li>
              <li>
                <span className="reports-mobile-notifications__dot" style={{ background: '#10b981' }} />
                <div>
                  <div className="reports-mobile-notifications__title">Reporte de ocupación listo</div>
                  <div className="reports-mobile-notifications__meta">ayer · Operación</div>
                </div>
              </li>
            </ul>
          </div>
        )}
      </header>

      {/* ── CHIPS DE FILTRO (scroll horizontal estilo YouTube) ── */}
      <div className="reports-chips-wrap">
        <div className="reports-chips" ref={chipsRef}>
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`reports-chip ${activeChip === chip.id ? 'reports-chip--active' : ''}`}
              onClick={() => setActiveChip(chip.id)}
            >
              <Icon name={chip.icon} size={15} stroke="currentColor" />
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── LISTA DE REPORTES (cards YouTube-style) ── */}
      <div className="reports-mobile-body">
        <div className="reports-mobile-body__meta">
          <span>
            {filteredCards.length === BENTO_CARDS.length
              ? `${BENTO_CARDS.length} reportes disponibles`
              : `${filteredCards.length} de ${BENTO_CARDS.length} reportes`}
          </span>
          {activeChip !== 'all' && (
            <span className="reports-mobile-body__active-chip">
              Filtrando: {FILTER_CHIPS.find((c) => c.id === activeChip)?.label}
            </span>
          )}
        </div>

        {filteredCards.length === 0 ? (
          <div className="reports-empty">
            <div className="reports-empty__icon">
              <Icon name="search" size={22} stroke="currentColor" />
            </div>
            <div className="reports-empty__title">Sin resultados</div>
            <div className="reports-empty__text">Probá con otro término o cambiá el filtro.</div>
            <button
              type="button"
              className="reports-empty__btn"
              onClick={() => { setSearch(''); setActiveChip('all'); }}
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <ul className="reports-mobile-list">
            {filteredCards.map((card) => {
              return (
                <li key={card.id} className="reports-tile-item">
                  <button
                    type="button"
                    className={`reports-tile reports-tile--${card.variant}`}
                    onClick={() => setSelectedReport(card.id)}
                  >
                    <div
                      className="reports-tile__icon"
                      style={{ color: ICON_BG[card.variant] || ICON_BG.blue }}
                    >
                      <Icon name={card.icon} size={22} stroke="currentColor" />
                    </div>

                    <div className="reports-tile__body">
                      <div className="reports-tile__title-row">
                        <span className="reports-tile__title">{card.title}</span>
                        {card.featured && (
                          <span className="reports-tile__pin" aria-label="Destacado" title="Destacado">
                            <Icon name="star" size={12} stroke="currentColor" />
                          </span>
                        )}
                      </div>
                      <div className="reports-tile__meta">{card.desc}</div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── BOTTOM NAV (fija abajo, estilo YouTube) ── */}
      <nav className="reports-bottom-nav" aria-label="Navegación principal">
        {BOTTOM_NAV.map((item) => {
          const isActive = item.id === 'reports';
          return (
            <button
              key={item.id}
              type="button"
              className={`reports-bottom-nav__item ${isActive ? 'reports-bottom-nav__item--active' : ''} ${item.id === 'add' ? 'reports-bottom-nav__item--add' : ''}`}
              onClick={() => {
                if (item.id === 'home') navigate('/calendar');
                if (item.id === 'alerts') setShowNotifications((s) => !s);
                if (item.id === 'more') navigate('/settings');
              }}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.id === 'add' ? (
                <span className="reports-bottom-nav__add-circle">
                  <Icon name="plus" size={26} stroke="#fff" />
                </span>
              ) : (
                <Icon name={item.icon} size={22} />
              )}
              <span className="reports-bottom-nav__label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
