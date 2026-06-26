import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import authService from '../../../services/authService';
import reminderService from '../../../services/reminderService';
import eventService from '../../../services/eventService';
import { STATUS_META } from '../../../modules/calendar/constants';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobileReminderOpen, setIsMobileReminderOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  // Auto-ocultar el botón flotante de menú al scrollear
  const [fabVisible, setFabVisible] = useState(true);
  const lastScrollY = useRef(0);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const target = document.scrollingElement || document.documentElement;
    const handler = () => {
      const y = window.scrollY || target.scrollTop || 0;
      const delta = y - lastScrollY.current;
      lastScrollY.current = y;
      if (y < 8) { setFabVisible(true); return; }
      if (delta > 8) setFabVisible(false);
      else if (delta < -8) setFabVisible(true);
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setFabVisible(true), 2200);
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => {
      window.removeEventListener('scroll', handler);
      clearTimeout(hideTimerRef.current);
    };
  }, []);

  const user = authService.getCurrentUser() || {
    name: 'Invitado',
    avatarDataUrl: 'https://ui-avatars.com/api/?name=Guest&background=cbd5e1&color=64748b',
    role: 'vendedor'
  };
  const userRole = String(user.role || '').trim().toLowerCase();
  const isAdmin = userRole === 'admin';
  const isCrmUser = userRole !== 'eventos' && userRole !== 'coordinador';

  const handleLogout = () => {
    authService.clearSession();
    navigate('/login');
  };

  // Reminder state
  const [reminders, setReminders] = useState([]);
  const [isReminderOpen, setIsReminderOpen] = useState(false);

  // Load reminders on mount
  useEffect(() => {
    async function fetchReminders() {
      try {
        const allRems = await reminderService.getAll();
        const allEvents = await eventService.getAll();
        const currentUser = authService.getCurrentUser();
        const isAdmin = currentUser?.role === 'admin';
        const now = new Date();

        // Flatten reminders into an array with eventId
        const flat = [];
        Object.entries(allRems).forEach(([eventId, evRems]) => {
          const event = allEvents.find(e => e.id === eventId) || {};
          evRems.forEach(r => {
            // Filtrar por usuario
            const isMine = !r.createdBy || r.createdBy === currentUser?.id;
            if (!isAdmin && !isMine) return;

            // Filtrar por fecha futura (solo recordatorios que no han pasado)
            const reminderDateTime = new Date(`${r.date}T${r.time}:00`);
            if (reminderDateTime < now) return;

            flat.push({ 
              ...r, 
              eventId,
              eventName: event.name || event.title || eventId,
              eventStatus: event.status || 'Desconocido',
              eventSalon: event.salon || 'Sin asignar'
            });
          });
        });
        
        // Ordenar por fecha y hora más próxima
        flat.sort((a, b) => {
          const dateA = new Date(`${a.date}T${a.time}:00`);
          const dateB = new Date(`${b.date}T${b.time}:00`);
          return dateA - dateB;
        });

        setReminders(flat);
      } catch (e) {
        console.error('Failed to load reminders', e);
      }
    }
    fetchReminders();
  }, []);

  const getStatusColor = (status) => {
    return STATUS_META[status]?.color || '#cbd5e1';
  };

  const handleDismissReminder = async (e, eventId, reminderId) => {
    e.stopPropagation(); // Evita que abra la reserva
    try {
      await reminderService.delete(eventId, reminderId);
      // Eliminar de la vista inmediatamente
      setReminders(prev => prev.filter(r => r.id !== reminderId));
    } catch (err) {
      console.error('Error al descartar recordatorio', err);
    }
  };

  const toggleReminderPanel = () => {
    setIsReminderOpen(!isReminderOpen);
  };

  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsReminderOpen(false);
      }
    }
    if (isReminderOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isReminderOpen]);


  return (
    <>
      {/* Botón de Hamburguesa Flotante en Móvil */}
      <button 
className={`mobile-hamburger-btn${fabVisible ? ' fab-visible' : ' fab-hidden'}`}
        onClick={() => setIsMobileOpen(true)}
        aria-label="Abrir men"
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
                <span className="drawer-logo-text">Jardines CRM</span>
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
                </>
              )}
              <button 
                className={`drawer-nav-item ${location.pathname === '/kanban' ? 'isActive' : ''}`} 
                onClick={() => { setIsMobileOpen(false); navigate('/kanban'); }}
              >
                <span className="material-symbols-outlined">grid_view</span>
                <span>Tablero Ocupación</span>
              </button>

              {isAdmin && (
                <button 
                  className={`drawer-nav-item ${location.pathname === '/settings' ? 'isActive' : ''}`} 
                  onClick={() => { setIsMobileOpen(false); navigate('/settings'); }}
                >
                  <span className="material-symbols-outlined">settings</span>
                  <span>Configuraciones</span>
                </button>
              )}
            </nav>

            <div className="mobile-drawer-profile">
              <div className="profile-info">
                <img src={user.avatarDataUrl || user.avatar} alt="User avatar" className="profile-avatar" />
                <div className="profile-text">
                  <span className="profile-name">{user.name}</span>
                  <span className="profile-role">
                    {userRole === 'admin' ? 'Administrador' : ['recepcionista', 'frontoffice', 'front_office'].includes(userRole) ? 'Recepcionista' : userRole === 'eventos' ? 'Eventos' : userRole === 'coordinador' ? 'Coordinador' : 'Vendedor'}
                  </span>
                </div>
              </div>

              <div className="mobile-drawer-reminders">
                <button 
                  className="reminders-toggle-btn"
                  onClick={() => setIsMobileReminderOpen(!isMobileReminderOpen)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`material-symbols-outlined ${reminders.length > 0 ? 'bell-animated' : ''}`}>notifications</span>
                    <span style={{ color: '#cbd5e1' }}>Recordatorios</span>
                    {reminders.length > 0 && <span className="drawer-notification-count">{reminders.length}</span>}
                  </div>
                  <span className="material-symbols-outlined">
                    {isMobileReminderOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                
                {isMobileReminderOpen && (
                  <div className="drawer-reminders-list">
                    {reminders.map((r, idx) => (
                      <div 
                        key={idx} 
                        className="drawer-reminder-card"
                        onClick={() => {
                          setIsMobileOpen(false);
                          navigate(`/reserva/${r.eventId}`);
                        }}
                      >
                        <div className="reminder-card-main">
                          <strong className="reminder-card-title">{r.eventName}</strong>
                          <button 
                            className="reminder-card-check"
                            onClick={(e) => handleDismissReminder(e, r.eventId, r.id)}
                            title="Marcar como revisado"
                          >
                            <span className="material-symbols-outlined">check_circle</span>
                          </button>
                        </div>
                        <div className="reminder-card-sub">
                          <span>🕒 {r.date} {r.time}</span>
                          {r.eventSalon && <span> • 📍 {r.eventSalon}</span>}
                        </div>
                      </div>
                    ))}
                    {reminders.length === 0 && (
                      <div className="drawer-no-reminders">No tienes citas pendientes</div>
                    )}
                  </div>
                )}
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

      <aside className="lum-sidebar" aria-label="Menu principal" style={{ containerType: 'inline-size', position: 'relative', zIndex: 100 }}>
        <style>{`
          /* Definimos el contenedor para usar Container Queries */
          .lum-sidebar {
            container-type: inline-size;
            container-name: sidebar;
          }

          .sideUserProfile {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 14px;
            background: rgba(0,0,0,0.1);
            border-top: 1px solid rgba(255,255,255,0.05);
            margin-top: auto;
          }

          .sideUserLabel {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .sideUserName {
            display: flex;
            flex-direction: column;
          }

          /* LOGICA: Solo cuando el NAVBAR mismo se haga delgado (< 180px por ejemplo) */
          @container sidebar (max-width: 180px) {
            .sideUserProfile {
              flex-direction: column;
              gap: 15px;
              justify-content: center;
              width: 100%;
              padding: 16px 0;
            }
            .sideUserBellWrapper {
              order: 2;
            }
            .sideUserLabel {
              order: 1;
            }
          }

          @keyframes bellRing {
            0%, 85%, 100% { transform: rotate(0); }
            88% { transform: rotate(15deg); }
            91% { transform: rotate(-15deg); }
            94% { transform: rotate(10deg); }
            97% { transform: rotate(-10deg); }
          }
          .bell-animated {
            animation: bellRing 4s ease-in-out infinite;
            transform-origin: top center;
            display: inline-block;
          }
          
          .reminder-item {
            padding: 12px;
            margin-bottom: 8px;
            background: #ffffff;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            cursor: pointer;
            transition: all 0.2s;
          }
          .reminder-item:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
            transform: translateY(-1px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }

          /* Estilos para el menú Hamburguesa Flotante y el Drawer en Móvil */
          .mobile-hamburger-btn {
            display: none;
            position: fixed;
            bottom: 16px;
            left: 16px;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(20, 184, 166, 0.86) !important;
            color: #ffffff !important;
            border: none !important;
            box-shadow: 0 3px 10px rgba(20, 184, 166, 0.28) !important;
            z-index: 10001;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            padding: 0 !important;
            transition: transform 0.25s ease, opacity 0.25s ease, background 0.2s ease, box-shadow 0.2s ease;
          }
          /* Estado discreto: semi-transparente en reposo */
          .mobile-hamburger-btn.fab-visible {
            opacity: 0.62;
          }
          .mobile-hamburger-btn.fab-visible:hover,
          .mobile-hamburger-btn.fab-visible:active {
            opacity: 1;
            background: rgba(20, 184, 166, 1) !important;
            box-shadow: 0 4px 14px rgba(20, 184, 166, 0.42) !important;
          }
          /* Auto-ocultar: se desliza y atenúa al scrollear */
          .mobile-hamburger-btn.fab-hidden {
            opacity: 0 !important;
            transform: translateY(16px) scale(0.85) !important;
            pointer-events: none !important;
          }
          .mobile-hamburger-btn:active {
            transform: scale(0.92);
          }
          .mobile-hamburger-btn span {
            font-size: 22px;
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

          .reminders-toggle-btn {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            background: transparent !important;
            border: none !important;
            color: #94a3b8 !important;
            font-size: 12.5px;
            font-weight: 700;
            cursor: pointer;
            padding: 4px 0;
            box-shadow: none !important;
            outline: none !important;
          }
          .drawer-notification-count {
            background: #ef4444;
            color: #ffffff;
            font-size: 9px;
            padding: 2px 7px;
            border-radius: 999px;
            font-weight: 900;
          }
          .drawer-reminders-list {
            margin-top: 8px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 200px;
            overflow-y: auto;
            padding-right: 2px;
          }
          .drawer-reminder-card {
            padding: 10px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            cursor: pointer;
          }
          .reminder-card-main {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 8px;
          }
          .reminder-card-title {
            color: #f1f5f9;
            font-size: 12.5px;
            font-weight: 700;
            word-break: break-word;
          }
          .reminder-card-check {
            background: transparent !important;
            border: none !important;
            color: #10b981 !important;
            cursor: pointer;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: none !important;
            outline: none !important;
          }
          .reminder-card-check span {
            font-size: 18px;
            color: #10b981 !important;
          }
          .reminder-card-sub {
            font-size: 10.5px;
            color: #94a3b8;
          }
          .drawer-no-reminders {
            font-size: 11px;
            color: #64748b;
            text-align: center;
            padding: 10px 0;
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
            color: #2dd4bf;
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
            color: #2dd4bf !important;
          }
          .qp-support-email span.material-symbols-outlined,
          .qp-support-phone span.material-symbols-outlined {
            font-size: 15px;
            color: #94a3b8 !important;
            flex-shrink: 0;
          }
          .qp-support-email:hover span.material-symbols-outlined,
          .qp-support-phone:hover span.material-symbols-outlined {
            color: #2dd4bf !important;
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

          /* ─── Desktop sidebar item alignment ─── */
          .lum-sideItem {
            justify-content: flex-start !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
          }
          .lum-sideItem span.material-symbols-outlined {
            width: 24px !important;
            min-width: 24px !important;
            line-height: 1 !important;
            flex: 0 0 24px !important;
            flex-shrink: 0 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .lum-sideItem span:last-child {
            flex: 1 !important;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: left !important;
          }

          /* ─── Exit/Close Button (minimalist, red on hover) ─── */
          .lum-sideItem.exit-btn {
            transition: all 0.15s ease;
          }
          .lum-sideItem.exit-btn:hover {
            background: rgba(239, 68, 68, 0.12) !important;
            color: #f87171 !important;
          }
          .lum-sideItem.exit-btn:hover span.material-symbols-outlined {
            color: #f87171 !important;
          }

          /* ─── Desktop support card ─── */

          @container sidebar (max-width: 180px) {
            .lum-sideFooter .lum-sideItem .material-symbols-outlined:first-child {
              margin: 0 auto;
            }
          }

          @media (max-width: 768px) {
            .mobile-hamburger-btn {
              display: flex;
            }
          }
        `}</style>

      {
        (() => {
          const userRole = (user.role || '').toLowerCase();
          const isCrmUser = !['eventos', 'coordinador'].includes(userRole);
          return null;
        })()
      }
      <div className="lum-sidebarBrand">
        <div className="logo">
          <img src="/Oficial_JDL_blanco.png" alt="Logo Jardines CRM" className="topbarLogoImg" />
        </div>
        <div className="brandText">
          <div className="title">Jardines CRM</div>
        </div>
      </div>

      <nav className="lum-sideNav">
        {isCrmUser && (
          <button 
            className={`lum-sideItem ${location.pathname === '/customers' ? 'isActive' : ''}`} 
            type="button"
            onClick={() => navigate('/customers')}
          >
            <span className="material-symbols-outlined">group</span>
            <span>Clientes potenciales</span>
          </button>
        )}
        
        {isCrmUser && (
          <button 
            className={`lum-sideItem ${location.pathname === '/calendar' ? 'isActive' : ''}`} 
            type="button" 
            onClick={() => navigate('/calendar')}
          >
            <span className="material-symbols-outlined">calendar_month</span>
            <span>Calendario</span>
          </button>
        )}
        
        {isCrmUser && (
          <button 
            className={`lum-sideItem ${location.pathname === '/search' ? 'isActive' : ''}`} 
            type="button"
            onClick={() => navigate('/search')}
          >
            <span className="material-symbols-outlined">search</span>
            <span>Buscar evento</span>
          </button>
        )}
        
        {isCrmUser && (
          <button 
            className={`lum-sideItem ${location.pathname === '/reports' ? 'isActive' : ''}`} 
            type="button"
            onClick={() => navigate('/reports')}
          >
            <span className="material-symbols-outlined">analytics</span>
            <span>Reportes</span>
          </button>
        )}

        <button 
          className={`lum-sideItem ${location.pathname === '/kanban' ? 'isActive' : ''}`} 
          type="button"
          onClick={() => navigate('/kanban')}
        >
          <span className="material-symbols-outlined">grid_view</span>
          <span>Tablero Ocupación</span>
        </button>

        {isAdmin && (
          <button 
            className={`lum-sideItem ${location.pathname === '/settings' ? 'isActive' : ''}`} 
            type="button"
            onClick={() => navigate('/settings')}
          >
            <span className="material-symbols-outlined">settings</span>
            <span>Configuraciones</span>
          </button>
        )}
      </nav>

      {isCrmUser && (
        <div className="lum-sideCta">
          <button 
            className="btnPrimary" 
            type="button"
            onClick={() => navigate('/nueva-reserva')}
          >+ Nueva reserva</button>
        </div>
      )}

      {/* SECCION DE PERFIL */}
      <div className="sideUserProfile">
        <div className="sideUserLabel">
          <div className="sideUserAvatarWrap" style={{ 
            width: '34px', 
            height: '34px', 
            borderRadius: '50%', 
            overflow: 'hidden',
            border: '1px solid #14b8a6',
            flexShrink: 0
          }}>
            <img src={user.avatarDataUrl || user.avatar} alt="User" style={{ width: '100%', height: '100%' }} />
          </div>
          <div className="sideUserName">
            <span style={{ color: '#f8fafc', fontSize: '12px', fontWeight: '600' }}>{user.name}</span>
            <span style={{ color: '#94a3b8', fontSize: '10px' }}>
              {userRole === 'admin' ? 'Administrador' : ['recepcionista', 'frontoffice', 'front_office'].includes(userRole) ? 'Recepcionista' : userRole === 'eventos' ? 'Eventos' : userRole === 'coordinador' ? 'Coordinador' : 'Vendedor'}
            </span>
          </div>
        </div>

        {/* Wrapper for button & reminder bubble */}
        <div ref={wrapperRef} className="sideUserBellWrapper" style={{ position: 'relative', display: 'inline-block' }}>
          <button
            className="sideUserBell"
            onClick={toggleReminderPanel}
            style={{
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              padding: '4px'
            }}
            aria-label="Recordatorios"
          >
            <span className={`material-symbols-outlined ${reminders.length > 0 ? 'bell-animated' : ''}`} style={{ fontSize: '22px' }}>
              notifications
            </span>
            {reminders.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '9px',
                  minWidth: '14px',
                  height: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  fontWeight: '900',
                  border: '1px solid #1e293b'
                }}
              >
                {reminders.length}
              </span>
            )}
          </button>
          {/* Reminder bubble (panel) */}
          {isReminderOpen && (
            <div className="sideUserReminderPanel"
                 style={{
                   position: 'absolute',
                   left: 'calc(100% + 15px)',
                   bottom: '-5px',
                   background: '#ffffff',
                   color: '#0f172a',
                   width: '340px',
                   borderRadius: '12px',
                   padding: '16px',
                   border: '2px solid #cbd5e1', /* Added clearer border */
                   boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                   zIndex: 9999,
                   opacity: isReminderOpen ? 1 : 0,
                   transform: isReminderOpen ? 'translateX(0)' : 'translateX(-15px)',
                   transition: 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                 }}>
              
              {/* Tooltip triangle pointing left */}
              <div style={{
                position: 'absolute',
                left: '-7px',
                bottom: '16px',
                width: '10px',
                height: '10px',
                background: '#ffffff',
                transform: 'rotate(45deg)',
                borderLeft: '2px solid #cbd5e1',
                borderBottom: '2px solid #cbd5e1',
                zIndex: 10
              }} />

              <div className="sideUserReminderHeader" style={{ marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '14px', fontWeight: '700' }}>Citas pendientes</strong>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                  {reminders.length === 0 ? '0 pendientes' : `${reminders.length} próximas`}
                </span>
              </div>
              
              <div className="sideUserReminderList" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                {reminders.map((r, idx) => (
                  <div 
                    key={idx} 
                    className="reminder-item"
                    onClick={() => {
                      setIsReminderOpen(false);
                      navigate(`/reserva/${r.eventId}`);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', gap: '12px' }}>
                      <strong style={{ fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <span style={{ wordBreak: 'break-word' }}>{r.eventName}</span>
                        {r.eventStatus !== 'Desconocido' && (
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: getStatusColor(r.eventStatus), display: 'inline-block', flexShrink: 0 }} title={r.eventStatus} />
                        )}
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '600', whiteSpace: 'nowrap' }}>{r.date}</span>
                        <button 
                          onClick={(e) => handleDismissReminder(e, r.eventId, r.id)}
                          title="Marcar como revisado"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#10b981',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#d1fae5'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>{r.date} {r.time}</span>
                      {r.eventSalon && r.eventSalon !== 'Sin asignar' && (
                        <>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span>{r.eventSalon}</span>
                        </>
                      )}
                      {r.channel && (
                        <>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span style={{ textTransform: 'capitalize' }}>{r.channel}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {reminders.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: '13px' }}>
                    No tienes citas pendientes
                  </div>
                )}
              </div>
            </div>
          )}
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
      <div className="lum-sideFooter">
        <button 
          className={`lum-sideItem ${location.pathname === '/support' ? 'isActive' : ''}`} 
          type="button"
          onClick={() => setIsSupportOpen(true)}
        >
          <span className="material-symbols-outlined">support_agent</span>
          <span>Soporte</span>
        </button>          <button 
            className="lum-sideItem exit-btn" 
            type="button" 
            onClick={handleLogout}
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Cerrar sesión</span>
          </button>
      </div>
    </aside>
    </>
  );
}
