import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';
import SearchBar from './SearchBar.jsx';
import {
  IconGrid,
  IconHome,
  IconMoon,
  IconPackage,
  IconSettings,
  IconSun,
} from './Icons.jsx';
import '../styles.scss';

export default function ReportsLayout() {
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  const canManageCatalog = user && ['Admin', 'FrontOffice', 'Vendedor', 'Eventos'].includes(user.rol);
  const isAdmin = user?.rol === 'Admin';

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
        className="mobile-hamburger-btn" 
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
                <img src="/logo.png" alt="Logo" className="drawer-logo-img" />
                <span className="drawer-logo-text">Sistema Informes</span>
              </div>
              <button className="close-drawer-btn" onClick={() => setIsMobileOpen(false)} aria-label="Cerrar menú">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <nav className="mobile-drawer-nav">
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
                <span>Kanban</span>
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
              
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', margin: '8px 0' }} />
              
              <button 
                className={`drawer-nav-item ${location.pathname === '/settings' ? 'isActive' : ''}`} 
                onClick={() => { setIsMobileOpen(false); navigate('/settings'); }}
              >
                <span className="material-symbols-outlined">settings_applications</span>
                <span>Configuraciones CRM</span>
              </button>
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
            <IconHome size={16} /> Dashboard
          </NavLink>
          <NavLink
            to="/kanban"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <IconGrid size={16} /> Kanban
          </NavLink>
          {canManageCatalog && (
            <>
              <NavLink
                to="/catalog"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                <IconPackage size={16} /> Catálogo
              </NavLink>

              <NavLink
                to="/config"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                <IconSettings size={16} /> Config
              </NavLink>
            </>
          )}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
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
          <SearchBar />
          <NotificationBell />
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

        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <style>{`
        .reports-root .mobile-hamburger-btn,
        .informes-shell .mobile-hamburger-btn {
          display: flex !important;
          position: fixed !important;
          bottom: 20px !important;
          left: 20px !important;
          width: 54px !important;
          height: 54px !important;
          border-radius: 50% !important;
          background: #14b8a6 !important;
          color: #ffffff !important;
          border: none !important;
          box-shadow: 0 4px 14px rgba(20, 184, 166, 0.4) !important;
          z-index: 10001 !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          transition: all 0.2s ease-in-out !important;
          padding: 0 !important;
        }
        .reports-root .mobile-hamburger-btn:active,
        .informes-shell .mobile-hamburger-btn:active {
          transform: scale(0.9) !important;
        }
        .reports-root .mobile-hamburger-btn span,
        .informes-shell .mobile-hamburger-btn span {
          font-size: 26px !important;
          color: #ffffff !important;
        }

        .mobile-drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.5);
          z-index: 20000;
          display: flex;
          justify-content: flex-start;
        }

        .mobile-drawer-content {
          width: 290px;
          height: 100%;
          background: #0b1c30;
          box-shadow: 4px 0 25px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
          padding: 20px 16px;
          gap: 16px;
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
        .drawer-logo-img {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }
        .drawer-logo-text {
          color: #ffffff;
          font-size: 16px;
          font-weight: 800;
        }
        .close-drawer-btn {
          background: transparent !important;
          border: none !important;
          color: #94a3b8 !important;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: none !important;
          outline: none !important;
        }
        .close-drawer-btn span {
          font-size: 24px;
          color: #94a3b8 !important;
        }
        .close-drawer-btn:hover, .close-drawer-btn:hover span {
          color: #ffffff !important;
        }

        .mobile-drawer-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .drawer-nav-item {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 12px !important;
          width: 100% !important;
          padding: 12px !important;
          background: transparent !important;
          border: none !important;
          color: #cbd5e1 !important;
          font-size: 14.5px !important;
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
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          padding: 6px;
          box-shadow: none !important;
          outline: none !important;
        }
        .drawer-footer-btn span {
          font-size: 18px;
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

        /* Media query para hamburguesa removido por visualización global */
      `}</style>
    </div>
  );
}
