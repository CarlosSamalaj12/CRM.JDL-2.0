import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReportsModule from './ReportsModule';
import ReportsVentas from './ReportsVentas';
import ReportsContabilidad from './ReportsContabilidad';
import ReportsInstitucion from './ReportsInstitucion';
import './reports.css';

const REPORT_TYPES = {
  hub: 'hub', sales: 'sales', accounting: 'accounting',
  dashboard: 'dashboard', institution: 'institution',
};

// Catálogo completo: se usa para la bento grid (desktop) y para los chips / cards (móvil)
const ALL_REPORTS = [
  { id: REPORT_TYPES.sales,        label: 'Reporte de Ventas',           meta: 'Resumen comercial, cotizaciones y montos del pipeline', badge: 'Ventas • Cotizaciones • Comisiones',       icon: '📊', variant: 'blue',   category: 'Ventas',    featured: true },
  { id: REPORT_TYPES.accounting,   label: 'Estado de Cuenta',            meta: 'Ventas netas, cobros y control financiero por empresa', badge: 'Contabilidad • Cartera • Pagos',            icon: '💳', variant: 'green',  category: 'Finanzas'                    },
  { id: 'ocupacion',               label: 'Ocupación',                   meta: 'Uso de salones, disponibilidad y operación semanal',  badge: 'Salones • PAX • Ocupación',                icon: '📅', variant: 'purple', category: 'Operación'                   },
  { id: REPORT_TYPES.dashboard,    label: 'Dashboard',                   meta: 'KPIs, metas comerciales y rendimiento ejecutivo',       badge: 'KPIs • Metas • Rendimiento',               icon: '📈', variant: 'amber',  category: 'KPIs',      featured: true },
  { id: REPORT_TYPES.institution,  label: 'Por Institución',             meta: 'Dashboard detallado por cliente, consumo e historial', badge: 'Clientes • Historial • Análisis',          icon: '🏢', variant: 'rose',   category: 'Clientes'                   },
  { id: 'satisfaccion',            label: 'Satisfacción',                meta: 'Ratings de servicio, evaluación por evento y tendencias', badge: 'Calidad • Ratings • Clientes',           icon: '⭐', variant: 'teal',   category: 'Calidad',   featured: true },
  { id: 'ocupacionBarras',         label: 'Porcentaje Ocupación',        meta: 'Gráfico mensual de ocupación PAX vs capacidad de salones', badge: 'Barras • % Ocupación • Mensual',       icon: '📊', variant: 'indigo', category: 'Operación', featured: true },
  { id: 'eficenciaEventos',        label: 'Eficiencia por Estado',       meta: 'Distribución porcentual mensual de eventos por estado', badge: 'Estados • % • Apilado',                  icon: '📈', variant: 'teal',   category: 'Operación', featured: true },
  { id: 'seguimientosPendientes',  label: 'Seguimientos Pendientes',     meta: 'Eventos en pipeline comercial por vendedor',          badge: 'Pipeline • Vendedores • Estados',          icon: '📋', variant: 'amber',  category: 'Pipeline',  featured: true },
  { id: 'eficenciaConfirmacion',   label: 'Eficiencia de Confirmación',  meta: 'Eventos confirmados por vendedor · Montos en Quetzales', badge: 'Confirmados • Montos • Vendedores',     icon: '✅', variant: 'green',  category: 'KPIs',      featured: true },
  { id: 'ingresosCategorias',      label: 'Ingresos por Categoría',      meta: 'Montos generados por categoría de servicio',          badge: 'Categorías • Montos • Servicios',          icon: '💰', variant: 'indigo', category: 'Finanzas',  featured: true },
  { id: 'comisiones',              label: 'Comisiones',                  meta: 'Ventas vs niveles de meta · Cálculo de comisiones',    badge: 'Comisiones • Metas • %',                   icon: '🏆', variant: 'purple', category: 'Ventas',    featured: true },
  { id: 'proyeccionMetas',         label: 'Proyección de Metas',         meta: 'Proyección de ventas por vendedor',                    badge: 'Proyección • Metas • Gaps',                icon: '🎯', variant: 'amber',  category: 'KPIs',      featured: true },
];

const ICON_BG = {
  blue: '#2563eb', green: '#16a34a', purple: '#7c3aed',
  amber: '#d97706', rose: '#e11d48', teal: '#0d9488', indigo: '#4f46e5',
};

// Categorías que aparecen como chips de filtro
const FILTER_CHIPS = [
  { id: 'all',        label: 'Todos',      icon: '✦' },
  { id: 'Ventas',     label: 'Ventas',     icon: '📊' },
  { id: 'Finanzas',   label: 'Finanzas',   icon: '💳' },
  { id: 'Operación',  label: 'Operación',  icon: '📅' },
  { id: 'KPIs',       label: 'KPIs',       icon: '📈' },
  { id: 'Clientes',   label: 'Clientes',   icon: '🏢' },
  { id: 'Calidad',    label: 'Calidad',    icon: '⭐' },
  { id: 'Pipeline',   label: 'Pipeline',   icon: '📋' },
];

// Items del bottom nav (estilo YouTube: Home, Shorts, +, Subs, Library)
const BOTTOM_NAV = [
  { id: 'home',     label: 'Inicio',   icon: 'home' },
  { id: 'reports',  label: 'Informes', icon: 'chart' },
  { id: 'add',      label: 'Nuevo',    icon: 'plus' },
  { id: 'alerts',   label: 'Alertas',  icon: 'bell' },
  { id: 'more',     label: 'Más',      icon: 'menu' },
];

// ─── Iconos SVG inline (estilo YouTube, finos y consistentes) ───
const Icon = ({ name, size = 22, stroke = 'currentColor' }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'search':
      return <svg {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    case 'bell':
      return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
    case 'cast':
      return <svg {...props}><path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" /><path d="M2 12h3a3 3 0 0 1 3 3v3" /><path d="M2 18h1" /></svg>;
    case 'avatar':
      return <svg {...props}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
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
    case 'clock':
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'check':
      return <svg {...props}><path d="m5 12 5 5 9-11" /></svg>;
    case 'spark':
      return <svg {...props}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>;
    default:
      return null;
  }
};

export default function ReportsModuleContainer() {
  const navigate = useNavigate();
  const [activeReport, setActiveReport] = useState(REPORT_TYPES.hub);
  const [search, setSearch] = useState('');
  const [activeChip, setActiveChip] = useState('all');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const chipsRef = useRef(null);
  const searchInputRef = useRef(null);

  // Foco automático en el search al activarse
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Filtrado por búsqueda + chip
  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_REPORTS.filter((r) => {
      const matchChip = activeChip === 'all' || r.category === activeChip;
      const matchSearch = !q
        || r.label.toLowerCase().includes(q)
        || r.meta.toLowerCase().includes(q)
        || r.badge.toLowerCase().includes(q)
        || r.category.toLowerCase().includes(q);
      return matchChip && matchSearch;
    });
  }, [search, activeChip]);

  // Scroll horizontal de los chips: arrastrar con el mouse (estilo YouTube)
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

  // ────────────── VISTA HUB (selector de reporte) ──────────────
  if (activeReport === REPORT_TYPES.hub) {
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

          {/* Search bar expandible (estilo YouTube) */}
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
                <button type="button" onClick={() => setShowNotifications(false)} className="reports-mobile-notifications__close">
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
              {filteredReports.length === ALL_REPORTS.length
                ? `${ALL_REPORTS.length} reportes disponibles`
                : `${filteredReports.length} de ${ALL_REPORTS.length} reportes`}
            </span>
            {activeChip !== 'all' && (
              <span className="reports-mobile-body__active-chip">
                Filtrando: {FILTER_CHIPS.find((c) => c.id === activeChip)?.label}
              </span>
            )}
          </div>

          {filteredReports.length === 0 ? (
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
              {filteredReports.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`reports-mobile-card reports-mobile-card--${r.variant}`}
                    onClick={() => setActiveReport(r.id)}
                    onMouseEnter={() => {}}
                    onMouseLeave={() => {}}
                  >
                    <div
                      className="reports-mobile-card__icon"
                      style={{ background: ICON_BG[r.variant] || ICON_BG.blue }}
                    >
                      {r.icon}
                    </div>

                    <div className="reports-mobile-card__body">
                      <div className="reports-mobile-card__title-row">
                        <span className="reports-mobile-card__title">{r.label}</span>
                        {r.featured && <span className="reports-mobile-card__pin" title="Destacado">★</span>}
                      </div>
                      <div className="reports-mobile-card__meta">{r.meta}</div>
                      <div className="reports-mobile-card__foot">
                        <span className={`reports-mobile-card__badge reports-mobile-card__badge--${r.variant}`}>
                          {r.category}
                        </span>
                        <span className="reports-mobile-card__sub">{r.badge}</span>
                      </div>
                    </div>

                    <div className="reports-mobile-card__arrow" aria-hidden="true">
                      <Icon name="arrow-right" size={18} />
                    </div>
                  </button>
                </li>
              ))}
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

  // ────────────── VISTA SUB-REPORTE (mantiene la estética actual) ──────────────
  return (
    <div className="reports-page-container">
      <div className="reports-page-header">
        <div className="reports-brand-header">
          <button onClick={() => setActiveReport(REPORT_TYPES.hub)} className="reports-back-btn" type="button">
            <Icon name="arrow-left" size={16} />
            Volver a Reportes
          </button>
        </div>
        <button onClick={() => navigate('/calendar')} className="btn-exit" type="button" data-tooltip="Cerrar">
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="reports-page-body">
        {activeReport === REPORT_TYPES.dashboard && <ReportsModule />}
        {activeReport === REPORT_TYPES.sales && <ReportsVentas />}
        {activeReport === REPORT_TYPES.accounting && <ReportsContabilidad />}
        {activeReport === REPORT_TYPES.institution && <ReportsInstitucion />}
        {![REPORT_TYPES.dashboard, REPORT_TYPES.sales, REPORT_TYPES.accounting, REPORT_TYPES.institution].includes(activeReport) && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>
            Reporte en construcción…
          </div>
        )}
      </div>
    </div>
  );
}
