import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import authService from '../../../services/authService';
import reminderService from '../../../services/reminderService';
import eventService from '../../../services/eventService';
import { STATUS_META } from '../../../modules/calendar/constants';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = authService.getCurrentUser() || {
    name: 'Invitado',
    avatarDataUrl: 'https://ui-avatars.com/api/?name=Guest&background=cbd5e1&color=64748b'
  };

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
      `}</style>

      <div className="lum-sidebarBrand">
        <div className="logo">
          <img src="/Oficial_JDL_blanco.png" alt="Logo Jardines CRM" className="topbarLogoImg" />
        </div>
        <div className="brandText">
          <div className="title">Jardines CRM</div>
        </div>
      </div>

      <nav className="lum-sideNav">
        <button 
          className={`lum-sideItem ${location.pathname === '/customers' ? 'isActive' : ''}`} 
          type="button"
          onClick={() => navigate('/customers')}
        >
          <span className="material-symbols-outlined">group</span>
          <span>Clientes potenciales</span>
        </button>
        
        <button 
          className={`lum-sideItem ${location.pathname === '/calendar' ? 'isActive' : ''}`} 
          type="button" 
          onClick={() => navigate('/calendar')}
        >
          <span className="material-symbols-outlined">calendar_month</span>
          <span>Calendario</span>
        </button>
        
        <button 
          className={`lum-sideItem ${location.pathname === '/search' ? 'isActive' : ''}`} 
          type="button"
          onClick={() => navigate('/search')}
        >
          <span className="material-symbols-outlined">search</span>
          <span>Buscar evento</span>
        </button>
        
        <button 
          className={`lum-sideItem ${location.pathname === '/reports' ? 'isActive' : ''}`} 
          type="button"
          onClick={() => navigate('/reports')}
        >
          <span className="material-symbols-outlined">analytics</span>
          <span>Reportes</span>
        </button>

        <button 
          className={`lum-sideItem ${location.pathname === '/settings' ? 'isActive' : ''}`} 
          type="button"
          onClick={() => navigate('/settings')}
        >
          <span className="material-symbols-outlined">settings</span>
          <span>Configuraciones</span>
        </button>
      </nav>

      <div className="lum-sideCta">
        <button 
          className="btnPrimary" 
          type="button"
          onClick={() => navigate('/nueva-reserva')}
        >+ Nueva reserva</button>
      </div>

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
              {user.role === 'admin' ? 'Administrador' : user.role === 'recepcionista' ? 'Recepcionista' : 'Vendedor'}
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

      <div className="lum-sideFooter">
        <button 
          className={`lum-sideItem ${location.pathname === '/support' ? 'isActive' : ''}`} 
          type="button"
          onClick={() => navigate('/support')}
        >
          <span className="material-symbols-outlined">support_agent</span>
          <span>Soporte</span>
        </button>
        <button 
          className="lum-sideItem" 
          type="button" 
          onClick={handleLogout}
        >
          <span className="material-symbols-outlined">logout</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
