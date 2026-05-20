import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import authService from '../../../services/authService';

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
            padding: 15px 5px;
          }
          .sideUserName {
            display: none !important;
          }
          .sideUserLabel {
            justify-content: center;
            width: 100%;
          }
          .sideUserBell {
            order: 2;
          }
          .sideUserAvatarWrap {
            order: 1;
          }
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

        {user.role === 'admin' && (
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

        <div className="sideUserBell" style={{ position: 'relative', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>notifications</span>
          <span style={{ 
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
          }}>3</span>
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
