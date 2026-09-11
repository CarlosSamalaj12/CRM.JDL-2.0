import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  getComentarios, createComentario,
  marcarInformeLeido, getLecturas,
  getHistorial, getUsuarios,
  toggleReaccionComentario
} from '../services/api.js';
import { useSocket } from '../context/SocketContext.jsx';
import ReactionTooltip from './ReactionTooltip.jsx';
import {
  IconMessageCircle, IconSend, IconAtSign,
  IconCheckCircle, IconHistory,
  IconEye, IconUsers, IconAlertCircle
} from './Icons.jsx';

export default function ColaboracionPanel({ informeId, diaId, highlightComentarioId }) {
  const [activeTab, setActiveTab] = useState('comentarios');
  const [comentarios, setComentarios] = useState([]);
  const [lecturas, setLecturas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosError, setUsuariosError] = useState(null);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [menciones, setMenciones] = useState([]);
  const [showMenciones, setShowMenciones] = useState(false);
  const [mencionFilter, setMencionFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const [userLeido, setUserLeido] = useState(false);
  const [reactingTo, setReactingTo] = useState(null);
  const [hoveredTooltip, setHoveredTooltip] = useState(null);
  const [respondiendoA, setRespondiendoA] = useState(null);
  const [textoRespuesta, setTextoRespuesta] = useState('');
  const comentarioRef = useRef(null);
  const respuestaRef = useRef(null);
  const commentListRef = useRef(null);
  const highlightAppliedRef = useRef(false);

  // Buscar un elemento de comentario por ID
  const findCommentEl = (commentId) => {
    return document.getElementById(`comentario-${commentId}`);
  };

  // Hacer scroll al comentario resaltado
  const scrollToHighlightedComment = (commentId) => {
    if (!commentId) return;
    if (highlightAppliedRef.current) return;
    highlightAppliedRef.current = true;
    setTimeout(() => {
      const el = findCommentEl(Number(commentId));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('colab-comment-highlighted');
        setTimeout(() => el.classList.remove('colab-comment-highlighted'), 3000);
      }
    }, 400);
  };
  const { connected: socketConnected, onEvent, joinRoom } = useSocket();
  const userMap = useMemo(() => {
    const map = {};
    usuarios.forEach(u => { map[u.id] = u.nombre; });
    return map;
  }, [usuarios]);
  const currentUserId = (() => {
    try { const t = localStorage.getItem('token'); if (!t) { const u = localStorage.getItem('user'); return u ? JSON.parse(u).id : null; } return JSON.parse(atob(t.split('.')[1])).id; } catch { try { const u = localStorage.getItem('user'); return u ? JSON.parse(u).id : null; } catch { return null; } }
  })();
  const currentUser = (() => { try { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null; } catch { return null; } })();
  const currentUserEmail = currentUser?.email || currentUser?.correo || '';
  const currentUserName = currentUser?.nombre || currentUser?.name || '';
  const REACCIONES = [
    { emoji: '❤️', label: 'Me encanta' },
    { emoji: '😡', label: 'Enojado' },
    { emoji: '😂', label: 'Me divierte' },
    { emoji: '👍', label: 'Ok' },
  ];

  const loadAll = useCallback(async () => {
    // 1. Cargar comentarios
    getComentarios(informeId)
      .then((cmts) => {
        setComentarios(cmts);
        // Scroll al comentario resaltado (solo en la primera carga)
        scrollToHighlightedComment(highlightComentarioId);
        // Hacer scroll al final después de actualizar
        setTimeout(() => {
          if (commentListRef.current) {
            commentListRef.current.scrollTop = commentListRef.current.scrollHeight;
          }
        }, 100);
      })
      .catch((err) => console.error('[ColaboracionPanel] Error comentarios:', err));

    // 2. Cargar lecturas
    getLecturas(informeId)
      .then((lect) => {
        setLecturas(lect);
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload?.id) {
              setUserLeido(lect.some((l) => l.usuario_id === payload.id));
            }
          } catch { /* ignore */ }
        }
      })
      .catch((err) => console.error('[ColaboracionPanel] Error lecturas:', err));

    // 3. Cargar historial
    getHistorial(informeId)
      .then(setHistorial)
      .catch((err) => console.error('[ColaboracionPanel] Error historial:', err));

    // 4. Cargar usuarios
    getUsuarios()
      .then((users) => {
        setUsuarios(users);
        setUsuariosError(null);
      })
      .catch((err) => {
        console.error('[ColaboracionPanel] Error usuarios:', err);
        setUsuariosError(err.message || 'Error al cargar usuarios');
      });
  }, [informeId, highlightComentarioId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!socketConnected) return;
    
    const handler = (data) => {
      if (String(data.informe_id) === String(informeId)) {
        loadAll();
      }
    };
    
    const cleanup = onEvent('comentario:created', handler);
    return cleanup;
  }, [socketConnected, informeId, loadAll, onEvent]);

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
      let newText = text;
      if (atIdx >= 0) {
        newText = text.substring(0, atIdx);
        setNuevoComentario(newText);
      }
      // Mantener el focus en el input después de seleccionar
      setTimeout(() => {
        input.focus();
        // Mover el cursor al final
        const len = newText.length;
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
    <div className="colab-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* ─── PESTAÑAS SEGMENTADAS TIPO CÁPSULA ─── */}
      <div className="colab-tabs" style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 12px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        gap: '6px',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          background: '#e2e8f0',
          padding: '3px',
          borderRadius: '10px',
          flex: 1,
        }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`colab-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  height: '32px',
                  padding: '0 8px',
                  borderRadius: '7px',
                  border: 'none',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#4f46e5' : '#64748b',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '999px',
                    background: isActive ? '#eef2ff' : '#cbd5e1',
                    color: isActive ? '#4f46e5' : '#475569',
                    lineHeight: 1.2,
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Enterado / Leído pill button */}
        <button
          type="button"
          onClick={handleEnterado}
          title={userLeido ? 'Ya marcaste este informe como leído' : 'Marcar como leído / enterado'}
          style={{
            height: '32px',
            padding: '0 10px',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: userLeido ? '#a7f3d0' : '#cbd5e1',
            background: userLeido ? '#ecfdf5' : '#ffffff',
            color: userLeido ? '#059669' : '#475569',
            fontSize: '11.5px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease',
          }}
        >
          <IconCheckCircle size={14} style={{ color: userLeido ? '#10b981' : '#94a3b8' }} />
          <span>{userLeido ? 'Leído' : 'Enterado'}</span>
        </button>
      </div>

      <div className="colab-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', padding: 0 }}>
        {/* Tab: COMENTARIOS */}
        {activeTab === 'comentarios' && (
          <div className="colab-comentarios" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div className="colab-comment-list" ref={commentListRef} style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', margin: 0 }}>
              {comentarios.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '36px 20px',
                  textAlign: 'center',
                  color: '#64748b',
                  margin: 'auto 0',
                }}>
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4f46e5',
                    marginBottom: '12px',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.12)',
                  }}>
                    <IconMessageCircle size={26} />
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                    Canal de comunicación activo
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748b', maxWidth: '280px', lineHeight: 1.4 }}>
                    Escribe notas sobre el evento o usa <strong style={{ color: '#4f46e5' }}>@</strong> para mencionar a un usuario del equipo.
                  </div>
                </div>
              ) : null}

              {comentarios.map((c) => (
                <div key={c.id} id={`comentario-${c.id}`} className={`colab-comment-item ${c.dia_id === diaId ? 'colab-highlight' : ''}`} style={{
                  display: 'flex',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: c.dia_id === diaId ? '#eef2ff' : '#f8fafc',
                  border: '1px solid',
                  borderColor: c.dia_id === diaId ? '#c7d2fe' : '#e2e8f0',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}>
                  <div className="colab-avatar" style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 800,
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(99,102,241,0.25)',
                  }}>
                    {c.usuario_nombre?.charAt(0) || '?'}
                  </div>
                  <div className="colab-comment-body" style={{ flex: 1, minWidth: 0 }}>
                    <div className="colab-comment-header" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{c.usuario_nombre}</strong>
                      {c.menciones && c.menciones.length > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          {c.menciones.map(m => (
                            <span key={m.id} className="colab-mention-tag" style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#4f46e5',
                              background: '#e0e7ff',
                              padding: '1px 6px',
                              borderRadius: '999px',
                            }}>
                              <IconAtSign size={10} /> {m.nombre}
                            </span>
                          ))}
                        </span>
                      )}
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <span className="colab-time" style={{ fontSize: '11px', color: '#94a3b8' }}>
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
                              type="button"
                              onClick={async () => {
                                try { await toggleReaccionComentario(informeId, c.id, r.emoji); loadAll(); } catch {}
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '2px',
                                fontSize: '11px', padding: '1px 6px',
                                borderRadius: '999px',
                                border: '1px solid',
                                borderColor: isActive ? '#6366f1' : '#cbd5e1',
                                background: isActive ? '#eef2ff' : '#ffffff',
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
                              <span style={{ fontSize: '12px' }}>{r.emoji}</span>
                              <span style={{ color: '#475569', fontWeight: 700, fontSize: '10px' }}>{users.length}</span>
                            </button>
                          );
                        })}
                        {/* Floating add reaction button */}
                        <div style={{ position: 'relative', display: 'inline-flex' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setReactingTo(reactingTo === c.id ? null : c.id); }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '12px', width: '22px', height: '22px',
                              borderRadius: '50%', border: '1px solid #cbd5e1',
                              background: reactingTo === c.id ? '#eef2ff' : '#ffffff',
                              color: '#64748b',
                              cursor: 'pointer', lineHeight: 1, padding: 0,
                              transition: 'all 0.15s',
                            }}
                            title="Reaccionar"
                          >
                            +
                          </button>
                          {reactingTo === c.id && (
                            <div
                              style={{
                                position: 'absolute', top: '1.5rem', right: '-0.2rem',
                                display: 'flex', gap: '4px',
                                background: '#ffffff', border: '1px solid #cbd5e1',
                                borderRadius: '999px',
                                padding: '4px 8px',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                                zIndex: 100, whiteSpace: 'nowrap',
                              }}
                            >
                              {REACCIONES.map(r => (
                                <button
                                  key={r.emoji}
                                  type="button"
                                  onClick={async () => {
                                    try { await toggleReaccionComentario(informeId, c.id, r.emoji); } catch {}
                                    setReactingTo(null);
                                    loadAll();
                                  }}
                                  style={{
                                    fontSize: '16px', padding: '2px 4px',
                                    border: 'none', background: 'transparent',
                                    cursor: 'pointer', borderRadius: '4px',
                                    transition: 'transform 0.12s', lineHeight: 1,
                                  }}
                                  title={r.label}
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
                    <p className="colab-comment-text" style={{ margin: '2px 0 0 0', fontSize: '13.5px', color: '#334155', lineHeight: 1.45, wordBreak: 'break-word' }}>
                      {c.contenido}
                    </p>
                    {/* Botón Responder */}
                    <button
                      type="button"
                      onClick={() => setRespondiendoA(respondiendoA === c.id ? null : c.id)}
                      style={{
                        marginTop: '4px',
                        background: 'none',
                        border: 'none',
                        color: '#4f46e5',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '2px 0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      💬 Responder
                    </button>
                    {/* Input de respuesta */}
                    {respondiendoA === c.id && (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          ref={respuestaRef}
                          type="text"
                          value={textoRespuesta}
                          onChange={e => setTextoRespuesta(e.target.value)}
                          placeholder="Escribe tu respuesta..."
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '13px',
                            background: '#ffffff',
                            color: '#0f172a',
                            outline: 'none',
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && textoRespuesta.trim()) {
                              handleResponder(c.id);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          onClick={() => handleResponder(c.id)}
                          disabled={!textoRespuesta.trim()}
                          style={{
                            height: '32px',
                            padding: '0 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 700,
                            background: '#4f46e5',
                            color: '#ffffff',
                            border: 'none',
                            cursor: textoRespuesta.trim() ? 'pointer' : 'not-allowed',
                          }}
                        >
                          Enviar
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => {
                            setRespondiendoA(null);
                            setTextoRespuesta('');
                          }}
                          style={{
                            height: '32px',
                            padding: '0 8px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            background: '#f1f5f9',
                            color: '#64748b',
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    {/* Respuestas anidadas */}
                    {c.respuestas && c.respuestas.length > 0 && (
                      <div style={{ marginLeft: '12px', borderLeft: '2.5px solid #818cf8', paddingLeft: '10px', marginTop: '8px' }}>
                        {c.respuestas.map(r => (
                          <div key={r.id}>
                            <div id={`comentario-${r.id}`} className="colab-comment-item" style={{
                              background: '#ffffff',
                              padding: '8px 10px',
                              marginBottom: '6px',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                            }}>
                              <div className="colab-avatar" style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: '#818cf8',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}>
                                {r.usuario_nombre?.charAt(0) || '?'}
                              </div>
                              <div className="colab-comment-body">
                                <div className="colab-comment-header" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <strong style={{ fontSize: '12px', color: '#0f172a' }}>{r.usuario_nombre || 'Usuario'}</strong>
                                  <span className="colab-time" style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                                    {new Date(r.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="colab-comment-text" style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#334155' }}>{r.contenido}</p>
                                {/* Botón Responder en respuestas anidadas */}
                                <button
                                  type="button"
                                  onClick={() => setRespondiendoA(respondiendoA === r.id ? null : r.id)}
                                  style={{
                                    marginTop: '3px',
                                    background: 'none',
                                    border: 'none',
                                    color: '#4f46e5',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    padding: '2px 0',
                                  }}
                                >
                                  💬 Responder
                                </button>
                                {/* Input de respuesta para respuesta anidada */}
                                {respondiendoA === r.id && (
                                  <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
                                    <input
                                      ref={respuestaRef}
                                      type="text"
                                      value={textoRespuesta}
                                      onChange={e => setTextoRespuesta(e.target.value)}
                                      placeholder="Escribe tu respuesta..."
                                      autoFocus
                                      style={{
                                        flex: 1,
                                        padding: '6px 8px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        background: '#ffffff',
                                      }}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter' && textoRespuesta.trim()) {
                                          handleResponder(r.id);
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="btn-primary btn-sm"
                                      onClick={() => handleResponder(r.id)}
                                      disabled={!textoRespuesta.trim()}
                                      style={{ fontSize: '11px', padding: '0 8px', height: '28px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '6px' }}
                                    >
                                      Enviar
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-secondary btn-sm"
                                      onClick={() => {
                                        setRespondiendoA(null);
                                        setTextoRespuesta('');
                                      }}
                                      style={{ fontSize: '11px', padding: '0 6px', height: '28px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ─── FORMULARIO DE COMENTARIO ANCLADO AL FONDO ─── */}
            <div className="colab-comment-form" style={{
              flexShrink: 0,
              background: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              padding: '10px 14px',
              paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))',
              position: 'relative',
              boxSizing: 'border-box',
            }}>
              {showMenciones && (
                <div className="colab-mention-list" style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '12px',
                  right: '12px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  marginBottom: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.12)',
                  zIndex: 1000,
                }}>
                  {usuariosError ? (
                    <div className="colab-mention-item" style={{ cursor: 'default', padding: '10px 12px', color: '#ef4444', fontSize: '12.5px' }}>
                      <span>❌ {usuariosError}</span>
                    </div>
                  ) : usuariosFiltrados.length === 0 ? (
                    <div className="colab-mention-item" style={{ cursor: 'default', padding: '10px 12px', color: '#94a3b8', fontSize: '12.5px' }}>
                      <span><em>{usuarios.length === 0 ? 'Cargando usuarios...' : 'Sin resultados'}</em></span>
                    </div>
                  ) : (
                    usuariosFiltrados.map((u) => (
                      <div
                        key={u.id}
                        className="colab-mention-item"
                        onMouseDown={(e) => { e.preventDefault(); selectMencion(u); }}
                        onTouchStart={(e) => {
                          const touch = e.touches[0];
                          e.currentTarget._touchStart = { x: touch.clientX, y: touch.clientY };
                        }}
                        onTouchEnd={(e) => {
                          const start = e.currentTarget._touchStart;
                          if (start) {
                            const touch = e.changedTouches[0];
                            const dx = Math.abs(touch.clientX - start.x);
                            const dy = Math.abs(touch.clientY - start.y);
                            if (dx < 10 && dy < 10) {
                              e.preventDefault();
                              selectMencion(u);
                            }
                          }
                        }}
                        onClick={() => selectMencion(u)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.15s',
                        }}
                      >
                        <span className="colab-mention-avatar" style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}>
                          {(u.nombre || u.email || '?').charAt(0).toUpperCase()}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>{u.nombre || u.email}</strong>
                          {u.rol && <span style={{ fontSize: '11px', color: '#64748b' }}>{u.rol}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {menciones.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {menciones.map(m => (
                    <span key={m.id} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: '#4f46e5',
                      background: '#eef2ff',
                      border: '1px solid #c7d2fe',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontWeight: 600,
                    }}>
                      <IconAtSign size={12} /> {m.nombre}
                      <button
                        type="button"
                        onClick={() => removeMencion(m.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#6366f1',
                          cursor: 'pointer',
                          padding: '0 2px',
                          fontSize: '12px',
                          lineHeight: 1,
                          fontWeight: 'bold',
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="colab-input-row" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                boxSizing: 'border-box',
              }}>
                {/* Botón rápido @ para menciones */}
                <button
                  type="button"
                  onClick={() => {
                    const text = nuevoComentario ? `${nuevoComentario} @` : '@';
                    setNuevoComentario(text);
                    setMencionFilter('');
                    setShowMenciones(true);
                    if (comentarioRef.current) {
                      comentarioRef.current.focus();
                    }
                  }}
                  title="Mencionar a alguien (@)"
                  style={{
                    width: '38px',
                    minWidth: '38px',
                    maxWidth: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#4f46e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    padding: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <IconAtSign size={16} />
                </button>

                {/* Input de texto principal */}
                <input
                  ref={comentarioRef}
                  type="text"
                  placeholder="Escribe un comentario..."
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
                  style={{
                    flex: '1 1 0%',
                    minWidth: 0,
                    height: '40px',
                    padding: '0 14px',
                    background: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '20px',
                    fontSize: '14.5px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                />

                {/* Botón circular de enviar */}
                <button
                  type="button"
                  className="colab-send-btn"
                  onClick={handleComentar}
                  disabled={loading || !nuevoComentario.trim()}
                  title="Enviar comentario"
                  style={{
                    width: '40px',
                    minWidth: '40px',
                    maxWidth: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: nuevoComentario.trim()
                      ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                      : '#e2e8f0',
                    color: nuevoComentario.trim() ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    cursor: nuevoComentario.trim() ? 'pointer' : 'not-allowed',
                    boxShadow: nuevoComentario.trim() ? '0 2px 8px rgba(99, 102, 241, 0.35)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <IconSend size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: HISTORIAL */}
        {activeTab === 'historial' && (
          <div className="colab-history" style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
            {historial.length === 0 ? (
              <p className="colab-empty" style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', padding: '24px' }}>
                Sin actividad registrada aún.
              </p>
            ) : (
              historial.map((h, i) => (
                <div key={h.id || i} className="colab-history-item" style={{
                  display: 'flex',
                  gap: '10px',
                  padding: '8px 0 8px 14px',
                  borderLeft: '2px solid #e2e8f0',
                  marginLeft: '8px',
                  position: 'relative',
                }}>
                  <div className="colab-history-dot" style={{
                    position: 'absolute',
                    left: '-5px',
                    top: '12px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#6366f1',
                    border: '2px solid #ffffff',
                  }} />
                  <div className="colab-history-body" style={{ flex: 1 }}>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>{h.usuario_nombre}</strong>
                    <span className="colab-history-action" style={{ fontSize: '12px', color: '#4f46e5', marginLeft: '6px', fontWeight: 600 }}>
                      {h.accion}
                    </span>
                    {h.descripcion && <p className="colab-history-desc" style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>{h.descripcion}</p>}
                    <span className="colab-time" style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
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
          <div className="colab-readers" style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
            {lecturas.length === 0 ? (
              <p className="colab-empty" style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', padding: '24px' }}>
                Nadie ha marcado este informe como leído aún.
              </p>
            ) : (
              <div className="colab-reader-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {lecturas.map((l) => (
                  <div key={l.id} className="colab-reader-item" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                  }}>
                    <div className="colab-avatar" style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}>
                      {l.usuario_nombre?.charAt(0) || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>{l.usuario_nombre}</strong>
                      <span className="colab-time" style={{ fontSize: '11px', color: '#059669', fontWeight: 500 }}>
                        Leyó el {new Date(l.leido_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <IconCheckCircle size={18} style={{ color: '#059669', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
