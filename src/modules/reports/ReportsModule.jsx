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
    icon: '📊', variant: 'blue', category: 'Ventas', featured: true,
  },
  {
    id: 'contabilidad', title: 'Estado de Cuenta',
    desc: 'Ventas netas, cobros y control financiero por empresa',
    badge: 'Contabilidad • Cartera • Pagos',
    icon: '💳', variant: 'green', category: 'Finanzas',
  },
  {
    id: 'ocupacion', title: 'Ocupación',
    desc: 'Uso de salones, disponibilidad y operación semanal',
    badge: 'Salones • PAX • Ocupación',
    icon: '📅', variant: 'purple', category: 'Operación',
  },
  {
    id: 'dashboard', title: 'Dashboard',
    desc: 'KPIs, metas comerciales y rendimiento ejecutivo',
    badge: 'KPIs • Metas • Rendimiento',
    icon: '📈', variant: 'amber', category: 'KPIs', featured: true,
  },
  {
    id: 'institucion', title: 'Por Institución',
    desc: 'Dashboard detallado por cliente, consumo e historial',
    badge: 'Clientes • Historial • Análisis',
    icon: '🏢', variant: 'rose', category: 'Clientes',
  },
  {
    id: 'satisfaccion', title: 'Satisfacción',
    desc: 'Ratings de servicio, evaluación por evento y tendencias',
    badge: 'Calidad • Ratings • Clientes',
    icon: '⭐', variant: 'teal', category: 'Calidad', featured: true,
  },
  {
    id: 'ocupacionBarras', title: 'Porcentaje Ocupación de Eventos',
    desc: 'Gráfico mensual de ocupación PAX vs capacidad de salones',
    badge: 'Barras • % Ocupación • Mensual',
    icon: '📊', variant: 'indigo', category: 'Operación', featured: true,
  },
  {
    id: 'eficenciaEventos', title: 'Eficiencia por Estado',
    desc: 'Distribución porcentual mensual de eventos por estado',
    badge: 'Estados • % • Apilado',
    icon: '📈', variant: 'teal', category: 'Operación', featured: true,
  },
  {
    id: 'seguimientosPendientes', title: 'Seguimientos Pendientes',
    desc: 'Eventos en pipeline comercial por vendedor · Pre-Reserva · Negociación · 1ra Cotización',
    badge: 'Pipeline • Vendedores • Estados',
    icon: '📋', variant: 'amber', category: 'Pipeline', featured: true,
  },
  {
    id: 'eficenciaConfirmacion', title: 'Eficiencia de Confirmación',
    desc: 'Eventos confirmados por vendedor · Montos en Quetzales · Porcentajes',
    badge: 'Confirmados • Montos • Vendedores',
    icon: '✅', variant: 'green', category: 'KPIs', featured: true,
  },
  {
    id: 'ingresosCategorias', title: 'Ingresos por Categoría',
    desc: 'Montos en Quetzales generados por categoría de servicio · Alimentos & Bebidas · Hospedajes · Misceláneos',
    badge: 'Categorías • Montos • Servicios',
    icon: '💰', variant: 'indigo', category: 'Finanzas', featured: true,
  },
  {
    id: 'comisiones', title: 'Comisiones',
    desc: 'Ventas vs niveles de meta · Cálculo de comisiones · Progreso hacia siguiente nivel',
    badge: 'Comisiones • Metas • %',
    icon: '🏆', variant: 'purple', category: 'Ventas', featured: true,
  },
  {
    id: 'proyeccionMetas', title: 'Proyección de Metas',
    desc: 'Proyección de ventas por vendedor · Cuánto necesita vender para alcanzar el siguiente nivel de meta',
    badge: 'Proyección • Metas • Gaps',
    icon: '🎯', variant: 'amber', category: 'KPIs', featured: true,
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
  { id: 'all',       label: 'Todos',     icon: '✦' },
  { id: 'Ventas',    label: 'Ventas',    icon: '📊' },
  { id: 'Finanzas',  label: 'Finanzas',  icon: '💳' },
  { id: 'Operación', label: 'Operación', icon: '📅' },
  { id: 'KPIs',      label: 'KPIs',      icon: '📈' },
  { id: 'Clientes',  label: 'Clientes',  icon: '🏢' },
  { id: 'Calidad',   label: 'Calidad',   icon: '⭐' },
  { id: 'Pipeline',  label: 'Pipeline',  icon: '📋' },
];

// ─── Bottom nav (estilo YouTube) ───
const BOTTOM_NAV = [
  { id: 'home',    label: 'Inicio',   icon: 'home' },
  { id: 'reports', label: 'Informes', icon: 'chart' },
  { id: 'add',     label: 'Nuevo',    icon: 'plus' },
  { id: 'alerts',  label: 'Alertas',  icon: 'bell' },
  { id: 'more',    label: 'Más',      icon: 'menu' },
];

// ─── Iconos SVG inline (estilo YouTube, finos y consistentes) ───
const Icon = ({ name, size = 22, stroke = 'currentColor' }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'search':
      return <svg {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    case 'bell':
      return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
    case 'home':
      return <svg {...props}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /></svg>;
    case 'chart':
      return <svg {...props}><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-6" /></svg>;
    case 'plus':
      return <svg {...props} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>;
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
              <span className="reports-chip__icon">{chip.icon}</span>
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
            <div className="reports-empty__icon">🔍</div>
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
                <li key={card.id}>
                  <button
                    type="button"
                    className={`reports-mobile-card reports-mobile-card--${card.variant}`}
                    onClick={() => setSelectedReport(card.id)}
                    onMouseEnter={() => {}}
                    onMouseLeave={() => {}}
                  >
                    <div
                      className="reports-mobile-card__icon"
                      style={{ background: ICON_BG[card.variant] || ICON_BG.blue }}
                    >
                      {card.icon}
                    </div>

                    <div className="reports-mobile-card__body">
                      <div className="reports-mobile-card__title-row">
                        <span className="reports-mobile-card__title">{card.title}</span>
                        {card.featured && (
                          <span className="reports-mobile-card__pin" title="Destacado">★</span>
                        )}
                      </div>
                      <div className="reports-mobile-card__meta">{card.desc}</div>
                      <div className="reports-mobile-card__foot">
                        <span className={`reports-mobile-card__badge reports-mobile-card__badge--${card.variant}`}>
                          {card.category}
                        </span>
                        <span className="reports-mobile-card__sub">{card.badge}</span>
                      </div>
                    </div>

                    <div className="reports-mobile-card__arrow" aria-hidden="true">
                      <Icon name="arrow-right" size={18} />
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
