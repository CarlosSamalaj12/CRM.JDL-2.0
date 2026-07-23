import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotas, createNota, getUsuariosCached, toggleReaccionNota, getTareasUsuario, getTareasSemanaByOcupacion } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { IconMapPin, IconClock, IconUser, IconFileText, IconEye, IconGripVertical, IconMessageCircle, IconAtSign, IconClipboardList, IconCheckSquare } from './Icons.jsx';
import ReactionTooltip from './ReactionTooltip.jsx';
import { emitOpenEventChecklist } from '../../../utils/appEvents';

const statusMap = {
  4: { label: 'Confirmado', color: 'green' },
  7: { label: 'Pre-reserva', color: 'fucsia' },
  8: { label: 'Mantenimiento', color: 'purple' },
};

function getMencionFilter(text) {
  const atIdx = text.lastIndexOf('@');
  if (atIdx < 0) return null;
  const after = text.slice(atIdx + 1);
  if (after.includes(' ')) return null;
  return after;
}

export default function EventCard({ event, dragHandleProps, highlighted = false, onNavigateToTareas, highlightNotaId }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { connected: socketConnected, onEvent, joinRoom, leaveRoom } = useSocket();
  const [notasOpen, setNotasOpen] = useState(() => Boolean(highlightNotaId));
  const [notaText, setNotaText] = useState('');
  const [notas, setNotas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [menciones, setMenciones] = useState([]);
  const [showMenciones, setShowMenciones] = useState(false);
  const [mencionFilter, setMencionFilter] = useState('');
  const [sending, setSending] = useState(false);
  const [reactingTo, setReactingTo] = useState(null);
  const [hoveredTooltip, setHoveredTooltip] = useState(null);
  const [hoverAlertBadge, setHoverAlertBadge] = useState(false);
  const [tareasCount, setTareasCount] = useState(0);
  const notaInputRef = useRef(null);
  const cardRef = useRef(null);
  const userMap = useMemo(() => {
    const map = {};
    usuarios.forEach(u => { map[u.id] = u.nombre; });
    return map;
  }, [usuarios]);
  const currentUserId = (() => {
    try { const t = localStorage.getItem('token'); if (!t) return user?.id || null; return JSON.parse(atob(t.split('.')[1])).id || user?.id || null; } catch { return user?.id || null; }
  })();
  const currentUserEmail = user?.email || '';

  const loadTareasCount = useCallback(() => {
    if (!currentUserId || !event.Idocupacion) return;
    const params = {};
    if (user?.teamId) params.equipo_id = user.teamId;
    Promise.all([
      getTareasUsuario(event.Idocupacion, currentUserId).catch(() => []),
      getTareasSemanaByOcupacion(event.Idocupacion, params).catch(() => []),
    ]).then(([personales, semanales]) => {
      const pendingPersonales = personales.filter(t => !t.completada).length;
      const pendingSemanales = semanales.filter(t => !t.completada).length;
      setTareasCount(pendingPersonales + pendingSemanales);
    });
  }, [currentUserId, event.Idocupacion, user?.teamId]);
  const currentUserName = user?.nombre || user?.name || '';
  const REACCIONES = [
    { emoji: '❤️', label: 'Me encanta' },
    { emoji: '😡', label: 'Enojado' },
    { emoji: '😂', label: 'Me divierte' },
    { emoji: '👍', label: 'Ok' },
  ];
  const esAlerta = event.tiene_alertas == 1 || event.tiene_alertas === true;
  const status = statusMap[event.Estatuscotizacion] || { label: 'Desconocido', color: 'gray' };
  const colorClass = status.color === 'green' ? 'confirmed' : status.color === 'fucsia' ? 'prereserva' : status.color === 'purple' ? 'mantenimiento' : '';
  const cardClass = `event-card ${colorClass}`;

  useEffect(() => {
    getUsuariosCached().then(setUsuarios).catch(() => {});
  }, []);

  useEffect(() => {
    loadTareasCount();
  }, [loadTareasCount]);

  // Escuchar cambios en tiempo real via socket (entity:changed -> tarea_semanal / tarea_evento)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.entity === 'tarea_semanal' || e.detail?.entity === 'tarea_evento') {
        loadTareasCount();
      }
    };
    window.addEventListener('entity:changed', handler);
    return () => window.removeEventListener('entity:changed', handler);
  }, [loadTareasCount]);

  useEffect(() => {
    getNotas(event.Idocupacion).then(setNotas).catch(() => {});
  }, [event.Idocupacion]);

  const lastHighlightRef = useRef(null);
  useEffect(() => {
    if (highlightNotaId && notas.length > 0 && highlightNotaId !== lastHighlightRef.current) {
      const hasMatch = notas.some(n => String(n.id) === String(highlightNotaId));
      if (hasMatch) {
        lastHighlightRef.current = highlightNotaId;
        const timerId = setTimeout(() => {
          const el = document.getElementById(`nota-${highlightNotaId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
        return () => clearTimeout(timerId);
      }
    }
  }, [highlightNotaId, notas]);

  useEffect(() => {
    if (!notasOpen) return;
    getNotas(event.Idocupacion).then(setNotas).catch(() => {});
  }, [notasOpen, event.Idocupacion]);

  useEffect(() => {
    if (!socketConnected || !event.Idocupacion) return;
    const room = `evento:${event.Idocupacion}`;
    joinRoom(room);
    const handler = (data) => {
      if (String(data.idocupacion) === String(event.Idocupacion) && notasOpen) {
        getNotas(event.Idocupacion).then(setNotas).catch(() => {});
      }
    };
    const cleanup = onEvent('nota:created', handler);
    return () => { cleanup(); leaveRoom(room); };
  }, [socketConnected, event.Idocupacion, notasOpen, onEvent, joinRoom, leaveRoom]);

  const handleAddNota = async () => {
    if (!notaText.trim() || sending) return;
    setSending(true);
    try {
      await createNota(event.Idocupacion, {
        contenido: notaText.trim(),
        mencion_a_id: menciones.length > 0 ? menciones.map(m => m.id) : null,
      });
      setNotaText('');
      setMenciones([]);
      setShowMenciones(false);
      setMencionFilter('');
      const updated = await getNotas(event.Idocupacion);
      setNotas(updated);
      toast.success('Nota enviada');
    } catch {
      toast.error('Error al enviar la nota');
    }
    setSending(false);
  };

  const selectMencion = (user) => {
    if (!menciones.find(m => m.id === user.id)) {
      setMenciones([...menciones, user]);
    }
    setShowMenciones(false);
    setMencionFilter('');
    const input = notaInputRef.current;
    if (input) {
      const text = input.value;
      const atIdx = text.lastIndexOf('@');
      if (atIdx >= 0) {
        const newText = text.substring(0, atIdx);
        setNotaText(newText);
      }
      setTimeout(() => input.focus(), 0);
    }
  };

  const removeMencion = (userId) => {
    setMenciones(menciones.filter(m => m.id !== userId));
  };

  const handleInputChange = (val) => {
    setNotaText(val);
    const filt = getMencionFilter(val);
    if (filt === null) {
      setShowMenciones(false);
      setMencionFilter('');
    } else {
      setMencionFilter(filt);
      setShowMenciones(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showMenciones && mencionFilter) {
        const match = usuarios.find(u =>
          String(u.id) !== String(currentUserId) &&
          u.email !== currentUserEmail &&
          u.nombre !== currentUserName &&
          u.nombre.toLowerCase().startsWith(mencionFilter.toLowerCase())
        );
        if (match) { selectMencion(match); return; }
      }
      handleAddNota();
    }
  };

  const usuariosFiltrados = showMenciones
    ? usuarios.filter(u => {
        const uId = String(u.id || '');
        const uEmail = String(u.email || u.correo || '');
        const uNombre = String(u.nombre || u.name || '');
        const isSelf = uId === String(currentUserId || '') ||
                       (currentUserEmail && uEmail.toLowerCase() === currentUserEmail.toLowerCase()) ||
                       (currentUserName && uNombre.toLowerCase() === currentUserName.toLowerCase());
        if (isSelf) return false;
        if (!mencionFilter) return true;
        const filt = mencionFilter.toLowerCase();
        return uNombre.toLowerCase().includes(filt) || uEmail.toLowerCase().includes(filt);
      })
    : [];

  const notasFiltradas = notas.filter(n => {
    if (!n.menciones || n.menciones.length === 0) return true;
    if (String(n.usuario_id) === String(currentUserId)) return true;
    return n.menciones.some(m => String(m.id) === String(currentUserId));
  });

  return (
    <article 
      ref={cardRef}
      id={`evento-${event.Idocupacion}`}
      className={cardClass}
      style={{
        border: highlighted ? '2px solid #8b5cf6' : undefined,
        boxShadow: highlighted ? '0 0 20px rgba(139, 92, 246, 0.4)' : undefined,
        background: highlighted ? 'rgba(139, 92, 246, 0.05)' : undefined,
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div className={`event-tag event-tag-${status.color}`}>
            {status.label}
          </div>
        </div>
        {dragHandleProps && (
          <span className="drag-handle" {...dragHandleProps}>
            <IconGripVertical size={16} />
          </span>
        )}
      </div>
      <h3>{event.Institucion || 'Evento sin nombre'}</h3>
      <p className="event-meta">
        <span><IconMapPin size={14} /> {event.Salon || 'Sin salón'}</span>
        <span><IconClock size={14} /> {event.HoraI || '??:??'} - {event.HoraF || '??:??'}</span>
      </p>
      <p className="event-details">
        <strong>{event.Pax || 0} personas</strong> · {event.TipoEvento || 'Sin tipo'}
      </p>
      <p className="event-details" style={{ cursor: 'pointer' }} onClick={() => {
        const msg = event.Vendedor
          ? `Vendedor: ${event.Vendedor}\nContacto: ${event.TelefonoVendedor || 'No disponible'}`
          : 'Sin vendedor asignado';
        alert(msg);
      }} data-tooltip="Ver información del vendedor">
        <IconUser size={13} /> {event.Vendedor || 'N/A'}
      </p>
      <div className="event-actions">
        {esAlerta && (
          <div
            style={{
              position: 'absolute', top: '0', right: '0',
              background: 'linear-gradient(135deg, #f59e0b, #eab308)',
              color: 'white',
              fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.04em',
              padding: '0.15rem 0.5rem 0.15rem 0.6rem',
              borderRadius: '0 var(--radius-md) 0 var(--radius-sm)',
              textTransform: 'uppercase',
              zIndex: 2,
              display: 'flex', alignItems: 'center', gap: '0.2rem',
              boxShadow: '0 2px 6px rgba(234,179,8,0.3)',
            }}
            onMouseEnter={() => setHoverAlertBadge(true)}
            onMouseLeave={() => setHoverAlertBadge(false)}
          >
            ⚠️ Alertas
            {hoverAlertBadge && event.alertas_text && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 'auto',
                  left: '0',
                  marginTop: '0.25rem',
                  background: '#1e293b',
                  color: '#f8fafc',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  letterSpacing: 'normal',
                  textTransform: 'none',
                  padding: '0.4rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'normal',
                  maxWidth: 'min(260px, calc(100vw - 2rem))',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                  zIndex: 100,
                  pointerEvents: 'none',
                }}
              >
                ⚠️ {event.alertas_text}
              </div>
            )}
          </div>
        )}
        {user && ['Admin','Vendedor','FrontOffice'].includes(user.rol) && (
          <button type="button" onClick={() => navigate(`/informe/pos/${event.Idocupacion}`)} data-tooltip="Nuevo informe" style={{flexShrink:0}}>
            <IconFileText size={13} /> + Informe
          </button>
        )}
        <button 
          type="button" 
          onClick={() => navigate(`/informe/${event.Idocupacion}?date=${event.FechaEvento ? String(event.FechaEvento).slice(0, 10) : ''}`)} 
          data-tooltip="Ver informe" 
          style={{
            flex: '0 0 30px',
            justifyContent: 'center',
            padding: '0.4rem 0',
            background: 'transparent',
            color: 'var(--primary)',
            borderColor: 'transparent',
            opacity: event.tiene_informe ? 1 : 0.25,
            transition: 'all 0.2s ease'
          }}
        >
          <IconEye size={13} />
        </button>
        <button type="button" onClick={() => emitOpenEventChecklist(event.Idocupacion)} data-tooltip="Abrir check list del evento" style={{flex:'0 0 32px',justifyContent:'center',padding:'0.4rem 0',background:'var(--primary-bg)',color:'var(--primary)',borderColor:'transparent'}}>
          <IconClipboardList size={13} />
        </button>
        <button type="button" className={`tareas-btn ${tareasCount > 0 ? 'has-tareas' : ''}`} onClick={() => onNavigateToTareas?.(event.Idocupacion)} data-tooltip={tareasCount > 0 ? `${tareasCount} tarea(s) pendiente(s)` : 'Ir a tareas semanales'} style={{flex:'0 0 30px',justifyContent:'center',padding:'0.4rem 0',background:'var(--primary-bg)',color:'var(--primary)',borderColor:'transparent',position:'relative'}}>
          <IconCheckSquare size={13} />
          {tareasCount > 0 && <span className="tareas-badge">{tareasCount}</span>}
        </button>
        <button type="button" className={`notas-btn ${notasOpen ? 'active' : ''} ${notasFiltradas.length > 0 ? 'has-notas' : ''}`} onClick={() => setNotasOpen(!notasOpen)} data-tooltip={notasFiltradas.length > 0 ? `${notasFiltradas.length} nota(s)` : 'Agregar nota'} style={{background:'var(--primary-bg)',color:'var(--primary)',borderColor:notasOpen ? 'var(--primary)' : 'transparent'}}>
          <IconMessageCircle size={13} />
          {notasFiltradas.length > 0 && <span className="notas-badge">{notasFiltradas.length}</span>}
        </button>
      </div>

      {notasOpen && (
        <div className="notas-popover" onClick={(e) => e.stopPropagation()}>
          <div className="notas-list">
            {notasFiltradas.length === 0 ? (
              <p className="notas-empty">Sin notas aún. Usa @ para mencionar.</p>
            ) : (
              notasFiltradas.map((n, i) => (
                <div key={n.id || i} className={`nota-item ${String(n.id) === String(highlightNotaId) ? 'nota-highlighted' : ''}`} id={`nota-${n.id}`}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.3rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{n.usuario_nombre || 'Usuario'}</strong>
                      {n.menciones && n.menciones.length > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', flexWrap: 'wrap', marginLeft: '0.2rem' }}>
                          {n.menciones.map(m => (
                            <span key={m.id} className="colab-mention-tag">
                              <IconAtSign size={9} /> {m.nombre}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(n.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {/* Reaction chips inline with timestamp */}
                      {REACCIONES.map(r => {
                        const users = (n.reacciones || {})[r.emoji] || [];
                        if (users.length === 0) return null;
                        const isActive = users.includes(currentUserId);
                        return (
                          <button
                            key={r.emoji}
                            onClick={async () => {
                              try { await toggleReaccionNota(n.id, r.emoji); const u = await getNotas(event.Idocupacion); setNotas(u); } catch {}
                            }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.08rem',
                              fontSize: '0.58rem', padding: '0.03rem 0.2rem',
                              borderRadius: 'var(--radius-full)',
                              border: '1px solid',
                              borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                              background: isActive ? 'var(--primary-bg)' : 'transparent',
                              cursor: 'pointer', lineHeight: 1.1,
                            }}
                            title={r.label}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredTooltip({ x: rect.left + rect.width / 2, y: rect.top, emoji: r.emoji, label: r.label, userIds: users });
                            }}
                            onMouseLeave={() => setHoveredTooltip(null)}
                          >
                            <span style={{ fontSize: '0.65rem' }}>{r.emoji}</span>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.55rem' }}>{users.length}</span>
                          </button>
                        );
                      })}
                      {/* Floating add reaction button */}
                      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setReactingTo(reactingTo === n.id ? null : n.id); }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.55rem', width: '14px', height: '14px',
                            borderRadius: '50%', border: 'none',
                            background: reactingTo === n.id ? 'var(--primary-bg)' : 'transparent',
                            cursor: 'pointer', lineHeight: 1, padding: 0,
                            opacity: 0.5,
                          }}
                          title="Reaccionar"
                        >
                          +
                        </button>
                        {reactingTo === n.id && (
                          <div
                            style={{
                              position: 'absolute', top: '1.4rem', right: '-0.15rem',
                              display: 'flex', gap: '0.12rem',
                              background: 'var(--bg-card)', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-full)',
                              padding: '0.12rem 0.25rem',
                              boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                              zIndex: 100, whiteSpace: 'nowrap',
                            }}
                          >
                            {REACCIONES.map(r => (
                              <button
                                key={r.emoji}
                                onClick={async () => {
                                  try { await toggleReaccionNota(n.id, r.emoji); } catch {}
                                  setReactingTo(null);
                                  const u = await getNotas(event.Idocupacion);
                                  setNotas(u);
                                }}
                                style={{
                                  fontSize: '1rem', padding: '0.06rem 0.1rem',
                                  border: 'none', background: 'transparent',
                                  cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                                  transition: 'transform 0.12s', lineHeight: 1,
                                }}
                                title={r.label}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                              >
                                {r.emoji}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Backdrop to close popover */}
                        {reactingTo === n.id && (
                          <div onClick={() => setReactingTo(null)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                        )}
                      </div>
                    </div>
                  </div>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem' }}>{n.contenido}</p>
                </div>
              ))
            )}
          </div>

          <div className="notas-input-row" style={{ position: 'relative', flexDirection: 'column' }}>
            {showMenciones && usuariosFiltrados.length > 0 && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                maxHeight: '150px', overflowY: 'auto', zIndex: 1000,
              }}>
                {usuariosFiltrados.map(u => (
                  <div key={u.id}
                    style={{ padding: '0.35rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}
                    onMouseDown={(e) => { e.preventDefault(); selectMencion(u); }}
                    onTouchStart={(e) => {
                      // Guardar coordenadas de inicio para detectar scroll vs tap
                      const touch = e.touches[0];
                      e.currentTarget._touchStart = { x: touch.clientX, y: touch.clientY };
                    }}
                    onTouchEnd={(e) => {
                      const start = e.currentTarget._touchStart;
                      if (start) {
                        const touch = e.changedTouches[0];
                        const dx = Math.abs(touch.clientX - start.x);
                        const dy = Math.abs(touch.clientY - start.y);
                        // Si se movió menos de 10px en cualquier dirección, es un tap real
                        if (dx < 10 && dy < 10) {
                          e.preventDefault();
                          selectMencion(u);
                        }
                      }
                    }}
                    onClick={() => selectMencion(u)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                      {(u.nombre || u.email || '?').charAt(0).toUpperCase()}
                    </span>
                    <span><strong>{u.nombre || u.email}</strong> {u.rol && <small style={{ color: 'var(--text-muted)' }}>{u.rol}</small>}</span>
                  </div>
                ))}
              </div>
            )}
            {menciones.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', padding: '0.2rem 0' }}>
                {menciones.map(m => (
                  <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', color: 'var(--primary)', background: 'var(--primary-bg)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)' }}>
                    <IconAtSign size={10} /> {m.nombre}
                    <button onClick={() => removeMencion(m.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0', fontSize: '0.65rem', lineHeight: 1 }}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <input
                ref={notaInputRef}
                type="text"
                placeholder="Escribe una nota... Usa @ para mencionar"
                value={notaText}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ flex: 1 }}
              />
              <button className="btn-primary btn-sm" onClick={handleAddNota} disabled={!notaText.trim() || sending}>
                {sending ? '...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {hoveredTooltip && (
        <ReactionTooltip
          emoji={hoveredTooltip.emoji}
          label={hoveredTooltip.label}
          userIds={hoveredTooltip.userIds}
          userMap={userMap}
          x={hoveredTooltip.x}
          y={hoveredTooltip.y}
          onClose={() => setHoveredTooltip(null)}
        />
      )}
    </article>
  );
}
