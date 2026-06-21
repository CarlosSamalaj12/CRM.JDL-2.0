import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  getComentarios, createComentario,
  marcarInformeLeido, getLecturas,
  toggleDestacado, getDestacados,
  getHistorial, getUsuarios,
  toggleReaccionComentario
} from '../services/api.js';
import { useSocket } from '../context/SocketContext.jsx';
import ReactionTooltip from './ReactionTooltip.jsx';
import {
  IconMessageCircle, IconSend, IconAtSign,
  IconCheckCircle, IconStar, IconHistory,
  IconEye, IconUsers, IconAlertCircle
} from './Icons.jsx';

export default function ColaboracionPanel({ informeId, diaId }) {
  const [activeTab, setActiveTab] = useState('comentarios');
  const [comentarios, setComentarios] = useState([]);
  const [lecturas, setLecturas] = useState([]);
  const [destacados, setDestacados] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [menciones, setMenciones] = useState([]);
  const [showMenciones, setShowMenciones] = useState(false);
  const [mencionFilter, setMencionFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [miDestacado, setMiDestacado] = useState(false);
  const [userLeido, setUserLeido] = useState(false);
  const [reactingTo, setReactingTo] = useState(null);
  const [hoveredTooltip, setHoveredTooltip] = useState(null);
  const [respondiendoA, setRespondiendoA] = useState(null);
  const [textoRespuesta, setTextoRespuesta] = useState('');
  const comentarioRef = useRef(null);
  const respuestaRef = useRef(null);
  const commentListRef = useRef(null);
  const socket = useSocket();
  const userMap = useMemo(() => {
    const map = {};
    usuarios.forEach(u => { map[u.id] = u.nombre; });
    return map;
  }, [usuarios]);
  const currentUserId = (() => {
    try { const t = localStorage.getItem('token'); if (!t) return null; return JSON.parse(atob(t.split('.')[1])).id; } catch { return null; }
  })();
  const REACCIONES = [
    { emoji: '❤️', label: 'Me encanta' },
    { emoji: '😡', label: 'Enojado' },
    { emoji: '😂', label: 'Me divierte' },
    { emoji: '👍', label: 'Ok' },
  ];

  const loadAll = useCallback(async () => {
    try {
      const [cmts, lect, dest, hist, users] = await Promise.all([
        getComentarios(informeId),
        getLecturas(informeId),
        getDestacados(informeId),
        getHistorial(informeId),
        getUsuarios(),
      ]);
      setComentarios(cmts);
      setLecturas(lect);
      setDestacados(dest);
      setHistorial(hist);
      setUsuarios(users);

      // Hacer scroll al final después de actualizar
      setTimeout(() => {
        if (commentListRef.current) {
          commentListRef.current.scrollTop = commentListRef.current.scrollHeight;
        }
      }, 100);

      // Check if current user has already marked as read
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload?.id) {
            setUserLeido(lect.some((l) => l.usuario_id === payload.id));
            setMiDestacado(dest.some((d) => d.usuario_id === payload.id));
          }
        } catch { /* ignore */ }
      }
    } catch (err) { 
      console.error('[ColaboracionPanel] Error en loadAll:', err);
    }
  }, [informeId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!socket) return;
    
    const handler = (data) => {
      if (String(data.informe_id) === String(informeId)) {
        loadAll();
      }
    };
    
    const cleanup = socket.onEvent('comentario:created', handler);
    return cleanup;
  }, [socket, informeId, loadAll]);

  const handleComentar = async () => {
    if (!nuevoComentario.trim()) return;
    setLoading(true);
    try {
      await createComentario(informeId, {
        contenido: nuevoComentario,
        dia_id: diaId || null,
        mencion_a_id: menciones.length > 0 ? menciones.map(m => m.id) : null,
      });
      setNuevoComentario('');
      setMenciones([]);
      setShowMenciones(false);
      setMencionFilter('');
      loadAll();
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleResponder = async (parentId) => {
    if (!textoRespuesta.trim()) return;
    setLoading(true);
    try {
      await createComentario(informeId, {
        contenido: textoRespuesta,
        dia_id: diaId || null,
        parent_id: parentId,
        mencion_a_id: menciones.length > 0 ? menciones.map(m => m.id) : null,
      });
      setTextoRespuesta('');
      setMenciones([]);
      setRespondiendoA(null);
      loadAll();
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleEnterado = async () => {
    try {
      await marcarInformeLeido(informeId);
    } catch { /* ignore */ }
    setUserLeido(true);
    loadAll();
  };

  const handleDestacar = async () => {
    await toggleDestacado(informeId, { dia_id: diaId || null });
    setMiDestacado(!miDestacado);
    loadAll();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleComentar();
    }
  };

  // Extraer el texto después del último @ para filtrar usuarios
  // Devuelve: null (no hay @), '' (hay @ pero vacío/espacio), o string (texto a filtrar)
  const getMencionFilter = (text) => {
    const atIdx = text.lastIndexOf('@');
    if (atIdx < 0) return null;
    const after = text.slice(atIdx + 1);
    if (after.includes(' ')) return null;
    return after;
  };

  const usuariosFiltrados = showMenciones && mencionFilter !== null
    ? usuarios.filter(u =>
        u.id !== currentUserId && (
          !mencionFilter ||
          u.nombre.toLowerCase().includes(mencionFilter.toLowerCase()) ||
          (u.email && u.email.toLowerCase().includes(mencionFilter.toLowerCase()))
        )
      )
    : [];

  const selectMencion = (user) => {
    if (!menciones.find(m => m.id === user.id)) {
      setMenciones([...menciones, user]);
    }
    setShowMenciones(false);
    setMencionFilter('');
    const input = comentarioRef.current;
    if (input) {
      const text = input.value;
      const atIdx = text.lastIndexOf('@');
      if (atIdx >= 0) {
        const newText = text.substring(0, atIdx) + `@${user.nombre} `;
        setNuevoComentario(newText);
      }
      // Mantener el focus en el input después de seleccionar
      setTimeout(() => {
        input.focus();
        // Mover el cursor al final
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }, 0);
    }
  };

  const removeMencion = (userId) => {
    setMenciones(menciones.filter(m => m.id !== userId));
  };

  const tabs = [
    { id: 'comentarios', label: 'Comentarios', icon: IconMessageCircle, count: comentarios.length },
    { id: 'historial', label: 'Actividad', icon: IconHistory },
    { id: 'lectores', label: 'Lectores', icon: IconEye, count: lecturas.length },
  ];

  return (
    <div className="colab-panel">
      <div className="colab-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`colab-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={14} />
              {tab.label}
              {tab.count > 0 && <span className="colab-tab-count">{tab.count}</span>}
            </button>
          );
        })}
      </div>

      <div className="colab-content">
        {/* Tab: COMENTARIOS */}
        {activeTab === 'comentarios' && (
          <div className="colab-comentarios">
            <div className="colab-comment-list" ref={commentListRef}>
              {comentarios.length === 0 && (
                <p className="colab-empty">Sin comentarios aún. Usa @ para mencionar a alguien.</p>
              )}
              {comentarios.map((c) => (
                <div key={c.id} className={`colab-comment-item ${c.dia_id === diaId ? 'colab-highlight' : ''}`}>
                  <div className="colab-avatar">{c.usuario_nombre?.charAt(0) || '?'}</div>
                  <div className="colab-comment-body">
                    <div className="colab-comment-header">
                      <strong>{c.usuario_nombre}</strong>
                      {c.menciones && c.menciones.length > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', flexWrap: 'wrap', marginRight: '0.3rem' }}>
                          {c.menciones.map(m => (
                            <span key={m.id} className="colab-mention-tag">
                              <IconAtSign size={11} /> {m.nombre}
                            </span>
                          ))}
                        </span>
                      )}
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
                        <span className="colab-time">
                          {new Date(c.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {/* Reaction chips inline with timestamp */}
                        {REACCIONES.map(r => {
                          const users = (c.reacciones || {})[r.emoji] || [];
                          if (users.length === 0) return null;
                          const isActive = users.includes(currentUserId);
                          return (
                            <button
                              key={r.emoji}
                              onClick={async () => {
                                try { await toggleReaccionComentario(informeId, c.id, r.emoji); loadAll(); } catch {}
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.1rem',
                                fontSize: '0.62rem', padding: '0.04rem 0.25rem',
                                borderRadius: 'var(--radius-full)',
                                border: '1px solid',
                                borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                                background: isActive ? 'var(--primary-bg)' : 'transparent',
                                cursor: 'pointer', lineHeight: 1.2,
                                transition: 'all 0.15s',
                              }}
                              title={r.label}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredTooltip({ x: rect.left + rect.width / 2, y: rect.top, emoji: r.emoji, label: r.label, userIds: users });
                              }}
                              onMouseLeave={() => setHoveredTooltip(null)}
                            >
                              <span style={{ fontSize: '0.7rem' }}>{r.emoji}</span>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.58rem' }}>{users.length}</span>
                            </button>
                          );
                        })}
                        {/* Floating add reaction button */}
                        <div style={{ position: 'relative', display: 'inline-flex' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setReactingTo(reactingTo === c.id ? null : c.id); }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.6rem', width: '16px', height: '16px',
                              borderRadius: '50%', border: 'none',
                              background: reactingTo === c.id ? 'var(--primary-bg)' : 'transparent',
                              cursor: 'pointer', lineHeight: 1, padding: 0,
                              opacity: 0.5, transition: 'all 0.15s',
                            }}
                            title="Reaccionar"
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                          >
                            +
                          </button>
                          {reactingTo === c.id && (
                            <div
                              style={{
                                position: 'absolute', top: '1.5rem', right: '-0.2rem',
                                display: 'flex', gap: '0.15rem',
                                background: 'var(--bg-card)', border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-full)',
                                padding: '0.2rem 0.35rem',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                                zIndex: 100, whiteSpace: 'nowrap',
                              }}
                            >
                              {REACCIONES.map(r => (
                                <button
                                  key={r.emoji}
                                  onClick={async () => {
                                    try { await toggleReaccionComentario(informeId, c.id, r.emoji); } catch {}
                                    setReactingTo(null);
                                    loadAll();
                                  }}
                                  style={{
                                    fontSize: '1.15rem', padding: '0.1rem 0.15rem',
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
                          {/* Backdrop to close popover on outside click */}
                          {reactingTo === c.id && (
                            <div
                              onClick={() => setReactingTo(null)}
                              style={{
                                position: 'fixed', inset: 0, zIndex: 99,
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="colab-comment-text">{c.contenido}</p>
                    {/* Botón Responder */}
                    <button
                      onClick={() => setRespondiendoA(respondiendoA === c.id ? null : c.id)}
                      style={{
                        marginTop: '0.3rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '0.2rem 0',
                      }}
                    >
                      💬 Responder
                    </button>
                    {/* Input de respuesta */}
                    {respondiendoA === c.id && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.3rem' }}>
                        <input
                          ref={respuestaRef}
                          type="text"
                          value={textoRespuesta}
                          onChange={e => setTextoRespuesta(e.target.value)}
                          placeholder="Escribe tu respuesta..."
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '0.4rem 0.6rem',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.78rem',
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && textoRespuesta.trim()) {
                              handleResponder(c.id);
                            }
                          }}
                        />
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => handleResponder(c.id)}
                          disabled={!textoRespuesta.trim()}
                          style={{ fontSize: '0.72rem' }}
                        >
                          Enviar
                        </button>
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => {
                            setRespondiendoA(null);
                            setTextoRespuesta('');
                          }}
                          style={{ fontSize: '0.72rem' }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    {/* Respuestas anidadas */}
                    {c.respuestas && c.respuestas.length > 0 && (
                      <div style={{ marginLeft: '1.5rem', borderLeft: '2px solid var(--border)', paddingLeft: '0.8rem', marginTop: '0.5rem' }}>
                        {c.respuestas.map(r => (
                          <div key={r.id}>
                            <div className="colab-comment-item" style={{ background: 'var(--bg-elevated)', padding: '0.6rem', marginBottom: '0.4rem' }}>
                              <div className="colab-avatar">{r.usuario_nombre?.charAt(0) || '?'}</div>
                              <div className="colab-comment-body">
                                <div className="colab-comment-header">
                                  <strong style={{ fontSize: '0.78rem' }}>{r.usuario_nombre || 'Usuario'}</strong>
                                  <span className="colab-time">
                                    {new Date(r.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="colab-comment-text" style={{ fontSize: '0.78rem' }}>{r.contenido}</p>
                                {/* Botón Responder en respuestas anidadas */}
                                <button
                                  onClick={() => setRespondiendoA(respondiendoA === r.id ? null : r.id)}
                                  style={{
                                    marginTop: '0.3rem',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--primary)',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: '0.2rem 0',
                                  }}
                                >
                                  💬 Responder
                                </button>
                                {/* Input de respuesta para respuesta anidada */}
                                {respondiendoA === r.id && (
                                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.3rem' }}>
                                    <input
                                      ref={respuestaRef}
                                      type="text"
                                      value={textoRespuesta}
                                      onChange={e => setTextoRespuesta(e.target.value)}
                                      placeholder="Escribe tu respuesta..."
                                      autoFocus
                                      style={{
                                        flex: 1,
                                        padding: '0.4rem 0.6rem',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.78rem',
                                      }}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter' && textoRespuesta.trim()) {
                                          handleResponder(r.id);
                                        }
                                      }}
                                    />
                                    <button
                                      className="btn-primary btn-sm"
                                      onClick={() => handleResponder(r.id)}
                                      disabled={!textoRespuesta.trim()}
                                      style={{ fontSize: '0.72rem' }}
                                    >
                                      Enviar
                                    </button>
                                    <button
                                      className="btn-secondary btn-sm"
                                      onClick={() => {
                                        setRespondiendoA(null);
                                        setTextoRespuesta('');
                                      }}
                                      style={{ fontSize: '0.72rem' }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Sub-respuestas anidadas (nivel 2) */}
                            {r.respuestas && r.respuestas.length > 0 && (
                              <div style={{ marginLeft: '1.5rem', borderLeft: '2px solid var(--border)', paddingLeft: '0.8rem', marginTop: '0.3rem' }}>
                                {r.respuestas.map(r2 => (
                                  <div key={r2.id} className="colab-comment-item" style={{ background: 'var(--bg-elevated)', padding: '0.6rem', marginBottom: '0.4rem' }}>
                                    <div className="colab-avatar">{r2.usuario_nombre?.charAt(0) || '?'}</div>
                                    <div className="colab-comment-body">
                                      <div className="colab-comment-header">
                                        <strong style={{ fontSize: '0.78rem' }}>{r2.usuario_nombre || 'Usuario'}</strong>
                                        <span className="colab-time">
                                          {new Date(r2.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      <p className="colab-comment-text" style={{ fontSize: '0.78rem' }}>{r2.contenido}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="colab-comment-form">
              {showMenciones && (
                <div className="colab-mention-list">
                  {usuariosFiltrados.length === 0 ? (
                    <div className="colab-mention-item" style={{ cursor: 'default', opacity: 0.6 }}>
                      <span><em>{usuarios.length === 0 ? 'Cargando usuarios...' : 'Sin resultados'}</em></span>
                    </div>
                  ) : (
                    usuariosFiltrados.map((u) => (
                      <div key={u.id} className="colab-mention-item" onClick={() => selectMencion(u)}>
                        <span className="colab-mention-avatar">{u.nombre.charAt(0)}</span>
                        <span><strong>{u.nombre}</strong> <small>{u.rol}</small></span>
                      </div>
                    ))
                  )}
                </div>
              )}
              {menciones.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  {menciones.map(m => (
                    <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: 'var(--primary)', background: 'var(--primary-bg)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)' }}>
                      <IconAtSign size={11} /> {m.nombre}
                      <button onClick={() => removeMencion(m.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0', fontSize: '0.65rem', lineHeight: 1 }}>✕</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="colab-input-row">
                <input
                  ref={comentarioRef}
                  type="text"
                  placeholder="Escribe un comentario... Usa @ para mencionar"
                  value={nuevoComentario}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNuevoComentario(val);
                    const filt = getMencionFilter(val);
                    if (filt === null) {
                      setShowMenciones(false);
                      setMencionFilter('');
                    } else {
                      setMencionFilter(filt);
                      setShowMenciones(true);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                />
                <button className="btn-primary btn-sm" onClick={handleComentar} disabled={loading || !nuevoComentario.trim()}>
                  <IconSend size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: HISTORIAL */}
        {activeTab === 'historial' && (
          <div className="colab-history">
            {historial.length === 0 ? (
              <p className="colab-empty">Sin actividad registrada aún.</p>
            ) : (
              historial.map((h, i) => (
                <div key={h.id || i} className="colab-history-item">
                  <div className="colab-history-dot" />
                  <div className="colab-history-body">
                    <strong>{h.usuario_nombre}</strong>
                    <span className="colab-history-action">{h.accion}</span>
                    {h.descripcion && <p className="colab-history-desc">{h.descripcion}</p>}
                    <span className="colab-time">
                      {new Date(h.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: LECTORES */}
        {activeTab === 'lectores' && (
          <div className="colab-readers">
            {lecturas.length === 0 ? (
              <p className="colab-empty">Nadie ha marcado este informe como leído aún.</p>
            ) : (
              <div className="colab-reader-list">
                {lecturas.map((l) => (
                  <div key={l.id} className="colab-reader-item">
                    <div className="colab-avatar">{l.usuario_nombre?.charAt(0) || '?'}</div>
                    <div>
                      <strong>{l.usuario_nombre}</strong>
                      <span className="colab-time">
                        Leyó el {new Date(l.leido_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <IconCheckCircle size={16} className="colab-reader-check" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Acciones rápidas */}
      <div className="colab-actions">
        <button
          className={`btn-ghost btn-sm ${userLeido ? 'colab-action-done' : ''}`}
          onClick={handleEnterado}
          data-tooltip={userLeido ? 'Ya marcaste este informe como leído' : 'Marcar como leído'}
        >
          <IconCheckCircle size={14} />
          {userLeido ? 'Leído' : 'Enterado'}
        </button>
        <button
          className={`btn-ghost btn-sm ${miDestacado ? 'colab-action-active' : ''}`}
          onClick={handleDestacar}
          data-tooltip={miDestacado ? 'Quitar énfasis' : 'Destacar esta sección'}
        >
          <IconStar size={14} />
          {miDestacado ? 'Destacado' : 'Destacar'}
        </button>
      </div>
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
    </div>
  );
}
