import { useEffect, useState, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import ErrorBoundary from '../../../components/ErrorBoundary';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import NotificationBell from './NotificationBell.jsx';
import SearchBar from './SearchBar.jsx';
import PwaInstallBanner from './PwaInstallBanner.jsx';
import { useVersionCheck } from '../../../hooks/useVersionCheck';
import ForceUpdateModal from '../../../components/ForceUpdateModal';
import VersionFooter from '../../../components/VersionFooter';
import {
  IconGrid,
  IconHome,
  IconMoon,
  IconPackage,
  IconSettings,
  IconSun,
} from './Icons.jsx';
import '../styles.scss';
import '../styles.css';
import '../mobile-table.css';

export default function ReportsLayout() {
  const { user, logout } = useAuth();
  const { pushSupported, pushSubscribed, enablePushNotifications } = useSocket();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  // Sistema de control de versiones: polling cada 3h
  const { updateState, serverVersion, currentVersion, reload } = useVersionCheck({
    intervalMs: 3 * 60 * 60 * 1000,
  });

  // Auto-ocultar el botón flotante de menú al scrollear hacia abajo
  const [fabVisible, setFabVisible] = useState(true);
  const lastScrollY = useRef(0);
  const hideTimerRef = useRef(null);

  // Safety net: restaurar scroll del body al montar/desmontar
  useEffect(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  // Safety net: resetear overflow del body periódicamente
  useEffect(() => {
    const interval = setInterval(() => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const target = document.scrollingElement || document.documentElement;
    const handler = () => {
      const y = window.scrollY || target.scrollTop || 0;
      const delta = y - lastScrollY.current;
      lastScrollY.current = y;
      if (y < 8) {
        setFabVisible(true);
        return;
      }
      if (delta > 8) {
        setFabVisible(false);
      } else if (delta < -8) {
        setFabVisible(true);
      }
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setFabVisible(true), 2200);
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => {
      window.removeEventListener('scroll', handler);
      clearTimeout(hideTimerRef.current);
    };
  }, []);

  const canManageCatalog = user && ['Admin', 'FrontOffice', 'Vendedor'].includes(user.rol);
  const isAdmin = user?.rol === 'Admin';
  const isCrmUser = user && ['Admin', 'FrontOffice', 'Vendedor'].includes(user.rol);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    document.body.classList.add('informes-theme');
    document.documentElement.classList.add('informes-theme-root');

    return () => {
      document.body.classList.remove('informes-theme');
      document.documentElement.classList.remove('informes-theme-root');
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleExitReports = () => {
    navigate('/calendar');
  };

  return (
    <div className="reports-root app-shell informes-shell">
      {/* Botón de Hamburguesa Flotante en Móvil */}
      <button
        className={`mobile-hamburger-btn${fabVisible ? ' fab-visible' : ' fab-hidden'}`}
        onClick={() => setIsMobileOpen(true)}
        aria-label="Abrir menú"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>

      {/* Cajón de Navegación (Drawer) en Móvil */}
      {isMobileOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setIsMobileOpen(false)}>
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div className="drawer-logo-wrap">
                <div className="drawer-logo-badge">
                  <img src="/Oficial_JDL_blanco.png" alt="Logo" className="drawer-logo-img" />
                </div>
                <span className="drawer-logo-text">Sistema Informes</span>
              </div>
            </div>

            <nav className="mobile-drawer-nav">
              {isCrmUser && (
                <>
                  <button 
                    className={`drawer-nav-item ${location.pathname === '/customers' ? 'isActive' : ''}`} 
                    onClick={() => { setIsMobileOpen(false); navigate('/customers'); }}
                  >
                    <span className="material-symbols-outlined">group</span>
                    <span>Clientes potenciales</span>
                  </button>
                  <button 
                    className={`drawer-nav-item ${location.pathname === '/calendar' ? 'isActive' : ''}`} 
                    onClick={() => { setIsMobileOpen(false); navigate('/calendar'); }}
                  >
                    <span className="material-symbols-outlined">calendar_month</span>
                    <span>Calendario</span>
                  </button>
                  <button 
                    className={`drawer-nav-item ${location.pathname === '/search' ? 'isActive' : ''}`} 
                    onClick={() => { setIsMobileOpen(false); navigate('/search'); }}
                  >
                    <span className="material-symbols-outlined">search</span>
                    <span>Buscar evento</span>
                  </button>
                  <button 
                    className={`drawer-nav-item ${location.pathname === '/reports' ? 'isActive' : ''}`} 
                    onClick={() => { setIsMobileOpen(false); navigate('/reports'); }}
                  >
                    <span className="material-symbols-outlined">analytics</span>
                    <span>Reportes</span>
                  </button>
                  
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', margin: '8px 0' }} />
                </>
              )}
              
              <button 
                className={`drawer-nav-item ${location.pathname === '/informes' ? 'isActive' : ''}`} 
                onClick={() => { setIsMobileOpen(false); navigate('/informes'); }}
              >
                <span className="material-symbols-outlined">dashboard</span>
                <span>Dashboard</span>
              </button>
              <button 
                className={`drawer-nav-item ${location.pathname === '/kanban' ? 'isActive' : ''}`} 
                onClick={() => { setIsMobileOpen(false); navigate('/kanban'); }}
              >
                <span className="material-symbols-outlined">grid_view</span>
                <span>Ocupación</span>
              </button>
              
              {canManageCatalog && (
                <>
                  <button 
                    className={`drawer-nav-item ${location.pathname === '/catalog' ? 'isActive' : ''}`} 
                    onClick={() => { setIsMobileOpen(false); navigate('/catalog'); }}
                  >
                    <span className="material-symbols-outlined">restaurant_menu</span>
                    <span>Catálogo Platillos</span>
                  </button>
                  <button 
                    className={`drawer-nav-item ${location.pathname === '/config' ? 'isActive' : ''}`} 
                    onClick={() => { setIsMobileOpen(false); navigate('/config'); }}
                  >
                    <span className="material-symbols-outlined">settings</span>
                    <span>Config</span>
                  </button>
                </>
              )}
              
              {isCrmUser && (
                <>
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', margin: '8px 0' }} />
                  <button 
                    className={`drawer-nav-item ${location.pathname === '/settings' ? 'isActive' : ''}`} 
                    onClick={() => { setIsMobileOpen(false); navigate('/settings'); }}
                  >
                    <span className="material-symbols-outlined">settings_applications</span>
                    <span>Configuraciones CRM</span>
                  </button>
                </>
              )}
            </nav>

            <div className="mobile-drawer-profile">
              <div className="profile-info">
                <div className="profile-avatar" style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  overflow: 'hidden', border: '1px solid #14b8a6', flexShrink: 0
                }}>
                  <img src={user?.avatarDataUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user?.nombre || 'User') + '&background=cbd5e1&color=64748b'} alt="Avatar" style={{ width: '100%', height: '100%' }} />
                </div>
                <div className="profile-text">
                  <span className="profile-name">{user?.nombre || user?.email}</span>
                  <span className="profile-role">
                    {user?.rol === 'Admin' ? 'Administrador' : user?.rol === 'FrontOffice' ? 'Recepcionista' : user?.rol === 'Coordinador' ? 'Coordinador' : user?.rol === 'Eventos' ? 'Eventos' : 'Vendedor'}
                  </span>
                </div>
              </div>
            </div>

            {isSupportOpen && (
              <div className="qp-support-modal-backdrop" onClick={() => setIsSupportOpen(false)}>
                <div className="qp-support-modal" onClick={e => e.stopPropagation()}>
                  <div className="qp-support-modal-header">
                    <span className="material-symbols-outlined">support_agent</span>
                    <span>Soporte Técnico</span>
                    <button className="qp-support-modal-close" onClick={() => setIsSupportOpen(false)}>
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                  <div className="qp-support-modal-body">
                    <div className="qp-support-contact">
                      <img src="https://ui-avatars.com/api/?name=Sistemas+Hoteles&background=14b8a6&color=fff&size=40" alt="SH" className="qp-support-avatar" />
                      <div className="qp-support-info">
                        <span className="qp-support-name">Sistemas Hoteles</span>
                        <a href="mailto:sistemashotel@jardinesdellago.com" className="qp-support-email">
                          <span className="material-symbols-outlined">mail</span>
                          sistemashotel@jardinesdellago.com
                        </a>
                        <a href="tel:+50255178100" className="qp-support-phone">
                          <span className="material-symbols-outlined">call</span>
                          +502 5517 8100
                        </a>
                      </div>
                    </div>
                    <div className="qp-support-divider" />
                    <div className="qp-support-contact">
                      <img src="https://ui-avatars.com/api/?name=Sistemas+JDL&background=14b8a6&color=fff&size=40" alt="SJ" className="qp-support-avatar" />
                      <div className="qp-support-info">
                        <span className="qp-support-name">Sistemas JDL</span>
                        <a href="mailto:sistema@jardinesdellago.com" className="qp-support-email">
                          <span className="material-symbols-outlined">mail</span>
                          sistema@jardinesdellago.com
                        </a>
                        <a href="tel:+50256325547" className="qp-support-phone">
                          <span className="material-symbols-outlined">call</span>
                          +502 56325547
                        </a>
                      </div>
                    </div>
                    <div className="qp-support-hours">
                      <span className="material-symbols-outlined">schedule</span>
                      Lun-Sáb 8:00-18:00
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="mobile-drawer-footer">
              <button className="drawer-footer-btn" onClick={() => setIsSupportOpen(true)}>
                <span className="material-symbols-outlined">support_agent</span>
                <span>Soporte</span>
              </button>
              <button className="drawer-footer-btn danger" onClick={handleLogout}>
                <span className="material-symbols-outlined">logout</span>
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="app-header">
        <div className="header-left">
          <div className="brand-icon">
            <img src="/logo.png" alt="JDL" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }} />
          </div>
          <div>
            <p className="brand">Sistema de Informes</p>
            <p className="brand-sub">Gestión de Eventos</p>
          </div>
        </div>
        <nav className="app-nav">
          <NavLink
            to="/informes"
            end
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <IconHome size={16} /> <span className="nav-text">Dashboard</span>
          </NavLink>
          <NavLink
            to="/kanban"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <IconGrid size={16} /> <span className="nav-text">Ocupación</span>
          </NavLink>
          {canManageCatalog && (
            <>
              <NavLink
                to="/catalog"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                <IconPackage size={16} /> <span className="nav-text">Catálogo</span>
              </NavLink>

              <NavLink
                to="/config"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                <IconSettings size={16} /> <span className="nav-text">Config</span>
              </NavLink>
            </>
          )}
        </nav>
        <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="header-search-container">
            <SearchBar />
          </div>
          <div className="header-actions-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="header-username" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {user?.nombre || user?.email}
            </span>
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="btn-ghost btn-sm"
              data-tooltip={darkMode ? 'Modo claro' : 'Modo oscuro'}
              style={{ fontSize: '0.85rem' }}
            >
              {darkMode ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
            <NotificationBell />
            <PwaInstallBanner
              onEnableNotifications={enablePushNotifications}
              isPushSubscribed={pushSubscribed}
              isPushSupported={pushSupported}
            />
            {isCrmUser && (
              <button
                type="button"
                onClick={handleExitReports}
                className="btn-exit"
                data-tooltip="Volver al CRM"
              >
                <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="16" height="16" className="crm-icon-x">
                  <path d="M4 4l10 10M14 4l-10 10" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Footer con versión (esquina inferior derecha) */}
      <VersionFooter style={{ position: 'fixed', bottom: 8, right: 12, zIndex: 1000 }} />

      {/* Modal obligatorio si el server tiene una versión más reciente */}
      <ForceUpdateModal
        open={!!updateState}
        serverVersion={updateState?.serverVersion || serverVersion}
        currentVersion={currentVersion}
        message={updateState?.message}
        reason={updateState?.reason}
        onUpdate={reload}
      />

      <style>{`
        @media screen {
          .reports-root .mobile-hamburger-btn,
          .informes-shell .mobile-hamburger-btn {
            display: flex !important;
            position: fixed !important;
            bottom: 16px !important;
            left: 16px !important;
            width: 44px !important;
            height: 44px !important;
            border-radius: 50% !important;
            background: rgba(20, 184, 166, 0.86) !important;
            color: #ffffff !important;
            border: none !important;
            box-shadow: 0 3px 10px rgba(20, 184, 166, 0.28) !important;
            z-index: 10001 !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            padding: 0 !important;
            transition: transform 0.25s ease, opacity 0.25s ease, background 0.2s ease, box-shadow 0.2s ease !important;
          }
          @media (max-width: 767px) {
            .informes-shell .app-header {
              position: relative !important;
              padding: 0.6rem 0.75rem !important;
              display: grid !important;
              grid-template-columns: 1fr auto !important;
              grid-template-rows: auto auto !important;
              gap: 0.5rem !important;
              border-radius: var(--radius-lg) !important;
              margin-bottom: 0.25rem !important;
              top: 0 !important;
              z-index: 1001 !important;
            }
            .informes-shell .header-left {
              grid-column: 1 !important;
              grid-row: 1 !important;
              width: auto !important;
            }
            .informes-shell .header-controls {
              display: contents !important;
            }
            .informes-shell .header-actions-container {
              grid-column: 2 !important;
              grid-row: 1 !important;
              display: flex !important;
              align-items: center !important;
              gap: 0.4rem !important;
            }
            .informes-shell .header-search-container {
              grid-column: 1 / -1 !important;
              grid-row: 2 !important;
              width: 100% !important;
            }
            .informes-shell .header-search-container > div {
              min-width: 0 !important;
              width: 100% !important;
            }
            .informes-shell .header-username {
              display: none !important;
            }
            .informes-shell .kanban-shell {
              margin-top: 0 !important;
            }
            .informes-shell .kanban-header {
              top: 0 !important;
              z-index: 1000 !important;
              background: var(--bg-app) !important;
              margin-top: 0 !important;
            }
            /* Ocultar navegación en móvil — está en el drawer */
            .informes-shell .app-nav {
              display: none !important;
            }
            /* Header-left más compacto */
            .informes-shell .header-left .brand-icon {
              width: 30px !important;
              height: 30px !important;
            }
            .informes-shell .header-left .brand-icon img {
              padding: 3px !important;
            }
            .informes-shell .brand {
              font-size: 0.82rem !important;
            }
            .informes-shell .brand-sub {
              font-size: 0.65rem !important;
            }
            /* Botón X (btn-exit): tamaño táctil adecuado */
            .informes-shell .btn-exit {
              padding: 0.35rem 0.4rem !important;
              min-width: 36px !important;
              min-height: 36px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
            }
          }

          /* ─── Perfil de usuario centrado en el drawer móvil ─── */
          .mobile-drawer-profile .profile-info {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 6px;
          }
          .mobile-drawer-profile .profile-text {
            align-items: center;
            text-align: center;
          }

          /* Estado discreto: semi-transparente en reposo */
          .reports-root .mobile-hamburger-btn.fab-visible,
          .informes-shell .mobile-hamburger-btn.fab-visible {
            opacity: 0.62 !important;
          }
          /* Al tocar o posar el cursor vuelve a opacidad completa */
          .reports-root .mobile-hamburger-btn.fab-visible:hover,
          .informes-shell .mobile-hamburger-btn.fab-visible:hover,
          .reports-root .mobile-hamburger-btn.fab-visible:active,
          .informes-shell .mobile-hamburger-btn.fab-visible:active {
            opacity: 1 !important;
            background: rgba(20, 184, 166, 1) !important;
            box-shadow: 0 4px 14px rgba(20, 184, 166, 0.42) !important;
          }
          /* Auto-ocultar: se desliza y atenúa al scrollear */
          .reports-root .mobile-hamburger-btn.fab-hidden,
          .informes-shell .mobile-hamburger-btn.fab-hidden {
            opacity: 0 !important;
            transform: translateY(16px) scale(0.85) !important;
            pointer-events: none !important;
          }
          .reports-root .mobile-hamburger-btn:active,
          .informes-shell .mobile-hamburger-btn:active {
            transform: scale(0.92) !important;
          }
          .reports-root .mobile-hamburger-btn span,
          .informes-shell .mobile-hamburger-btn span {
            font-size: 22px !important;
            color: #ffffff !important;
          }

          .mobile-drawer-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.5);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 20000;
            display: flex;
            justify-content: flex-start;
          }

          .mobile-drawer-content {
            width: 256px;
            height: 100%;
            background: #0b1c30;
            box-shadow: 4px 0 25px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            padding: 20px 16px;
            gap: 10px;
            overflow-y: auto;
            animation: slideInLeft 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          }

          @keyframes slideInLeft {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
          }

          .mobile-drawer-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }
          .drawer-logo-wrap {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .drawer-logo-badge {
            width: 34px;
            height: 34px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.22);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            flex-shrink: 0;
          }
          .drawer-logo-img {
            width: 24px;
            height: 24px;
            object-fit: contain;
          }
          .drawer-logo-text {
            color: #ffffff;
            font-size: 16px;
            font-weight: 800;
          }

          .mobile-drawer-nav {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }
          .drawer-nav-item {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 12px !important;
            width: 100% !important;
            padding: 8px 12px !important;
            background: transparent !important;
            border: none !important;
            color: #cbd5e1 !important;
            font-size: 14px !important;
            font-weight: 700 !important;
            border-radius: 8px !important;
            cursor: pointer !important;
            text-align: left !important;
            transition: all 0.15s ease-in-out;
            box-shadow: none !important;
            outline: none !important;
            white-space: nowrap !important;
            overflow: visible !important;
            margin: 0 !important;
          }
          .drawer-nav-item span.material-symbols-outlined {
            width: 24px;
            min-width: 24px;
            font-size: 22px;
            line-height: 1;
            color: #94a3b8 !important;
            flex-shrink: 0;
            flex: 0 0 24px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .drawer-nav-item span:last-child {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: left !important;
          }
          .drawer-nav-item:hover, .drawer-nav-item.isActive {
            background: rgba(56, 189, 248, 0.08) !important;
            color: #38bdf8 !important;
          }
          .drawer-nav-item:hover span.material-symbols-outlined, .drawer-nav-item.isActive span.material-symbols-outlined {
            color: #38bdf8 !important;
          }

          .mobile-drawer-profile {
            margin-top: auto;
            padding: 14px 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .profile-info {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .profile-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 1px solid #14b8a6;
          }
          .profile-text {
            display: flex;
            flex-direction: column;
          }
          .profile-name {
            color: #f8fafc;
            font-size: 13.5px;
            font-weight: 700;
          }
          .profile-role {
            color: #94a3b8;
            font-size: 10.5px;
          }

          .qp-support-modal-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .qp-support-modal {
            width: min(380px, 90vw);
            background: #0f172a;
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 16px;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
            overflow: hidden;
          }
          .qp-support-modal-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 16px 18px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            color: #f1f5f9;
            font-size: 15px;
            font-weight: 800;
          }
          .qp-support-modal-header span.material-symbols-outlined:first-child {
            font-size: 22px;
            color: #38bdf8;
          }
          .qp-support-modal-close {
            margin-left: auto;
            background: transparent !important;
            border: none !important;
            color: #64748b !important;
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            box-shadow: none !important;
            outline: none !important;
          }
          .qp-support-modal-close span {
            font-size: 20px;
            color: #64748b !important;
          }
          .qp-support-modal-close:hover,
          .qp-support-modal-close:hover span {
            color: #f1f5f9 !important;
          }
          .qp-support-modal-body {
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .qp-support-contact {
            display: flex;
            align-items: flex-start;
            gap: 12px;
          }
          .qp-support-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            flex-shrink: 0;
          }
          .qp-support-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 0;
            flex: 1;
          }
          .qp-support-name {
            color: #f1f5f9;
            font-size: 13px;
            font-weight: 700;
          }
          .qp-support-email,
          .qp-support-phone {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #94a3b8 !important;
            font-size: 11.5px;
            font-weight: 600;
            text-decoration: none;
            transition: color 0.15s;
            word-break: break-all;
          }
          .qp-support-email:hover,
          .qp-support-phone:hover {
            color: #38bdf8 !important;
          }
          .qp-support-email span.material-symbols-outlined,
          .qp-support-phone span.material-symbols-outlined {
            font-size: 15px;
            color: #94a3b8 !important;
            flex-shrink: 0;
          }
          .qp-support-email:hover span.material-symbols-outlined,
          .qp-support-phone:hover span.material-symbols-outlined {
            color: #38bdf8 !important;
          }
          .qp-support-divider {
            height: 1px;
            background: rgba(255, 255, 255, 0.06);
            margin: 0;
          }
          .qp-support-hours {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
            padding-top: 4px;
          }
          .qp-support-hours span.material-symbols-outlined {
            font-size: 16px;
            color: #64748b !important;
          }
          .mobile-drawer-footer {
            display: flex;
            justify-content: space-between;
            padding-top: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
          .drawer-footer-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            background: transparent !important;
            border: none !important;
            color: #94a3b8 !important;
            font-size: 10.5px;
            font-weight: 600;
            cursor: pointer;
            padding: 6px;
            box-shadow: none !important;
            outline: none !important;
          }
          .drawer-footer-btn span {
            font-size: 15px;
            color: #94a3b8 !important;
          }
          .drawer-footer-btn:hover {
            color: #cbd5e1 !important;
          }
          .drawer-footer-btn:hover span {
            color: #cbd5e1 !important;
          }
          .drawer-footer-btn.danger:hover {
            color: #f87171 !important;
          }
          .drawer-footer-btn.danger:hover span {
            color: #f87171 !important;
          }
        }
      `}</style>
    </div>
  );
}
