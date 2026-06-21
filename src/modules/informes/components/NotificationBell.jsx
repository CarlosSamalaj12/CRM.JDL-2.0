import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotificaciones, getNoLeidasCount, marcarLeida, marcarTodasLeidas } from '../services/api.js';
import {
  IconBell, IconCheckCircle, IconFileText, IconMessageCircle,
  IconAlertCircle, IconClock, IconEye, IconAtSign
} from './Icons.jsx';

const TYPE_CONFIG = {
  informe:  { icon: IconFileText,    label: 'Informe',     color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  comentario: { icon: IconMessageCircle, label: 'Comentario', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  mencion:  { icon: IconAtSign,     label: 'Mención',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  respuesta: { icon: IconMessageCircle, label: 'Respuesta', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
  alerta:   { icon: IconAlertCircle, label: 'Alerta',     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  recordatorio: { icon: IconClock,  label: 'Recordatorio', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
};

const DEFAULT_TYPE = { icon: IconFileText, label: 'Notificación', color: '#64748b', bg: 'rgba(100,116,139,0.1)' };

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [animatingOut, setAnimatingOut] = useState(false);
  const ref = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const [data, { count }] = await Promise.all([getNotificaciones(), getNoLeidasCount()]);
      setNotifs(data);
      setNoLeidas(count);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const closeDropdown = () => {
    setAnimatingOut(true);
    timeoutRef.current = setTimeout(() => { setOpen(false); setAnimatingOut(false); }, 200);
  };

  const toggleDropdown = () => {
    if (open) {
      closeDropdown();
    } else {
      setOpen(true);
      load();
    }
  };

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    await marcarLeida(id);
    load();
  };

  const handleMarkAllRead = async () => {
    await marcarTodasLeidas();
    load();
  };

  const handleNotifClick = async (n) => {
    if (!n.leido) {
      try {
        await marcarLeida(n.id);
        setNoLeidas((prev) => Math.max(0, prev - 1));
        setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, leido: 1 } : x));
      } catch { /* ignore */ }
    }
    
    // Si es una mención o respuesta, verificar si existe informe
    if ((n.tipo === 'mencion' || n.tipo === 'respuesta') && n.idocupacion) {
      try {
        // Intentar obtener el informe por id_ocupacion
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/informes/ocupacion/${n.idocupacion}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (response.ok) {
          const informes = await response.json();
          // El endpoint devuelve un array de informes
          if (Array.isArray(informes) && informes.length > 0) {
            // Usar el primer informe (el más reciente)
            const informe = informes[0];
            // Navegar al informe con el comentario resaltado
            navigate(`/informe/${informe.id}?highlightComentario=${n.comentario_id || ''}`);
          } else {
            // Si no existe informe, navegar al Kanban con la tarjeta resaltada
            navigate(`/kanban?highlightEvento=${n.idocupacion}`);
          }
        } else {
          // Si no existe informe, navegar al Kanban con la tarjeta resaltada
          navigate(`/kanban?highlightEvento=${n.idocupacion}`);
        }
      } catch (error) {
        console.error('Error verificando informe:', error);
        // En caso de error, ir al Kanban
        navigate(`/kanban?highlightEvento=${n.idocupacion}`);
      }
    } else if (n.idocupacion) {
      // Para otros tipos de notificaciones con idocupacion, intentar ir al informe
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/informes/ocupacion/${n.idocupacion}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (response.ok) {
          const informes = await response.json();
          if (Array.isArray(informes) && informes.length > 0) {
            navigate(`/informe/${informes[0].id}`);
          } else {
            navigate(`/kanban?highlightEvento=${n.idocupacion}`);
          }
        } else {
          navigate(`/kanban?highlightEvento=${n.idocupacion}`);
        }
      } catch {
        navigate(`/kanban?highlightEvento=${n.idocupacion}`);
      }
    } else if (n.informe_id) {
      navigate(`/informe/${n.informe_id}`);
    }
    
    closeDropdown();
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Hace ${diffHr}h`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const getTypeConfig = (tipo) => TYPE_CONFIG[tipo] || DEFAULT_TYPE;

  return (
    <div ref={ref} className="notif-bell-wrapper">
      <button
        className={`btn-icon notif-bell ${open ? 'notif-bell-active' : ''}`}
        onClick={toggleDropdown}
        title="Notificaciones"
        aria-label="Notificaciones"
      >
        <IconBell size={18} />
        {noLeidas > 0 && (
          <span className="notif-badge" key={noLeidas}>
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className={`notif-dropdown ${animatingOut ? 'notif-dropdown-exit' : ''}`}>
          <div className="notif-dropdown-header">
            <div className="notif-dropdown-title">
              <IconBell size={16} />
              Notificaciones
              {noLeidas > 0 && <span className="notif-header-count">{noLeidas}</span>}
            </div>
            {noLeidas > 0 && (
              <button className="btn-ghost btn-sm" onClick={handleMarkAllRead}>
                <IconCheckCircle size={13} /> Leer todas
              </button>
            )}
          </div>

          <div className="notif-dropdown-body">
            {notifs.length === 0 ? (
              <div className="notif-empty-state">
                <div className="notif-empty-icon">
                  <IconBell size={32} />
                </div>
                <p className="notif-empty-title">Sin notificaciones</p>
                <p className="notif-empty-desc">No tienes notificaciones nuevas. Te avisaremos cuando haya novedades.</p>
              </div>
            ) : (
              <>
                {notifs.map((n) => {
                  const cfg = getTypeConfig(n.tipo);
                  const IconType = cfg.icon;
                  return (
                    <div
                      key={n.id}
                      className={`notif-item ${n.leido ? '' : 'notif-item-unread'}`}
                      onClick={() => handleNotifClick(n)}
                    >
                      <div className="notif-item-icon" style={{ background: cfg.bg, color: cfg.color }}>
                        <IconType size={16} />
                      </div>
                      <div className="notif-item-content">
                        <div className="notif-item-title">
                          {n.titulo}
                          <span className="notif-type-badge" style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="notif-item-msg">{n.mensaje}</div>
                        <div className="notif-item-footer">
                          <span className="notif-item-time">{formatTime(n.fecha_creacion)}</span>
                          {!n.leido && (
                            <button
                              className="notif-mark-read"
                              onClick={(e) => handleMarkRead(n.id, e)}
                              title="Marcar como leída"
                            >
                              <IconEye size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      {!n.leido && <span className="notif-dot pulse" />}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {notifs.length > 0 && (
            <div className="notif-dropdown-footer">
              <span className="notif-footer-text">
                {noLeidas > 0
                  ? `${noLeidas} notificaciones sin leer`
                  : 'Todas las notificaciones están leídas'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
