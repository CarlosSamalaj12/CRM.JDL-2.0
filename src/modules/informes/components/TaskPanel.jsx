import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getTareasUsuario, createTarea, updateTarea, deleteTarea } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { IconX, IconCheck, IconTrash, IconEdit } from './Icons.jsx';

export default function TaskPanel({ idOcupacion, onClose, anchorRef }) {
  const { user } = useAuth();
  const toast = useToast();
  const [tareas, setTareas] = useState([]);
  const [nuevaTarea, setNuevaTarea] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef(null);
  const editInputRef = useRef(null);
  const panelRef = useRef(null);

  const currentUserId = user?.id || (() => {
    try { const t = localStorage.getItem('token'); if (!t) return null; return JSON.parse(atob(t.split('.')[1])).id; } catch { return null; }
  })();

  useEffect(() => {
    if (!currentUserId || !idOcupacion) return;
    loadTareas();
  }, [currentUserId, idOcupacion]);

  useEffect(() => {
    if (!anchorRef?.current) return;
    
    let rafId = null;
    
    const calculatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      
      const rect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const panelWidth = 320;
      
      // Calcular posición vertical (debajo del botón)
      const top = rect.bottom + window.scrollY + 8;
      
      // Calcular posición horizontal
      let left;
      if (rect.left < viewportWidth / 2) {
        // Si el anchor está en la mitad izquierda, abrir hacia la derecha
        left = rect.left + window.scrollX;
      } else {
        // Si está en la mitad derecha, abrir hacia la izquierda
        left = rect.right + window.scrollX - panelWidth;
      }
      
      setPosition({ top, left });
    };
    
    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(calculatePosition);
    };
    
    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', handleScroll, true);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [anchorRef]);

  const loadTareas = async () => {
    setLoading(true);
    try {
      const data = await getTareasUsuario(idOcupacion, currentUserId);
      setTareas(data);
    } catch {
      toast.error('Error al cargar tareas');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTarea = async () => {
    if (!nuevaTarea.trim() || saving) return;
    setSaving(true);
    try {
      const nueva = await createTarea(idOcupacion, {
        usuario_id: currentUserId,
        usuario_nombre: user?.nombre || user?.fullName || user?.email || 'Usuario',
        contenido: nuevaTarea.trim(),
      });
      setTareas([nueva, ...tareas]);
      setNuevaTarea('');
      inputRef.current?.focus();
    } catch {
      toast.error('Error al crear tarea');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCompletada = async (tarea) => {
    try {
      const updated = await updateTarea(tarea.id, { completada: !tarea.completada });
      setTareas(tareas.map(t => t.id === tarea.id ? updated : t));
    } catch {
      toast.error('Error al actualizar tarea');
    }
  };

  const handleDeleteTarea = async (tareaId) => {
    try {
      await deleteTarea(tareaId);
      setTareas(tareas.filter(t => t.id !== tareaId));
    } catch {
      toast.error('Error al eliminar tarea');
    }
  };

  const handleStartEdit = (tarea) => {
    setEditingId(tarea.id);
    setEditText(tarea.contenido);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const handleSaveEdit = async (tareaId) => {
    if (!editText.trim()) return;
    try {
      const updated = await updateTarea(tareaId, { contenido: editText.trim() });
      setTareas(tareas.map(t => t.id === tareaId ? updated : t));
      setEditingId(null);
      setEditText('');
    } catch {
      toast.error('Error al actualizar tarea');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddTarea();
    }
  };

  const handleEditKeyDown = (e, tareaId) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit(tareaId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditText('');
    }
  };

  const tareasPendientes = tareas.filter(t => !t.completada);
  const tareasCompletadas = tareas.filter(t => t.completada);

  return createPortal(
    <div ref={panelRef} className="task-panel" style={position} onClick={(e) => e.stopPropagation()}>
      <div className="task-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.9rem' }}>📋</span>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Mis Tareas</span>
        </div>
        <button onClick={onClose} className="task-panel-close" title="Cerrar">
          <IconX size={14} />
        </button>
      </div>

      <div className="task-panel-stats">
        <span className="task-stat">
          <span className="task-stat-num">{tareasPendientes.length}</span> pendientes
        </span>
        <span className="task-stat">
          <span className="task-stat-num">{tareasCompletadas.length}</span> completadas
        </span>
      </div>

      <div className="task-panel-input">
        <input
          ref={inputRef}
          type="text"
          placeholder="Agregar nueva tarea..."
          value={nuevaTarea}
          onChange={(e) => setNuevaTarea(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
        />
        <button
          className="btn-primary btn-sm"
          onClick={handleAddTarea}
          disabled={!nuevaTarea.trim() || saving}
        >
          {saving ? '...' : '+'}
        </button>
      </div>

      <div className="task-panel-list">
        {loading ? (
          <p className="task-panel-empty">Cargando...</p>
        ) : tareas.length === 0 ? (
          <p className="task-panel-empty">Sin tareas aún. Agrega tu primera tarea.</p>
        ) : (
          <>
            {tareasPendientes.length > 0 && (
              <div className="task-section">
                <span className="task-section-title">Pendientes</span>
                {tareasPendientes.map(tarea => (
                  <div key={tarea.id} className={`task-item ${tarea.completada ? 'completed' : ''}`}>
                    <button
                      className="task-checkbox"
                      onClick={() => handleToggleCompletada(tarea)}
                      title="Marcar como completada"
                    >
                      {tarea.completada && <IconCheck size={10} />}
                    </button>
                    {editingId === tarea.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className="task-edit-input"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, tarea.id)}
                        onBlur={() => handleSaveEdit(tarea.id)}
                      />
                    ) : (
                      <span className="task-text" onDoubleClick={() => handleStartEdit(tarea)}>
                        {tarea.contenido}
                      </span>
                    )}
                    <div className="task-actions">
                      {editingId !== tarea.id && (
                        <>
                          <button onClick={() => handleStartEdit(tarea)} title="Editar">
                            <IconEdit size={11} />
                          </button>
                          <button onClick={() => handleDeleteTarea(tarea.id)} title="Eliminar" className="task-delete">
                            <IconTrash size={11} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tareasCompletadas.length > 0 && (
              <div className="task-section completed-section">
                <span className="task-section-title">Completadas</span>
                {tareasCompletadas.map(tarea => (
                  <div key={tarea.id} className="task-item completed">
                    <button
                      className="task-checkbox checked"
                      onClick={() => handleToggleCompletada(tarea)}
                      title="Marcar como pendiente"
                    >
                      <IconCheck size={10} />
                    </button>
                    {editingId === tarea.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className="task-edit-input"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, tarea.id)}
                        onBlur={() => handleSaveEdit(tarea.id)}
                      />
                    ) : (
                      <span className="task-text" onDoubleClick={() => handleStartEdit(tarea)}>
                        {tarea.contenido}
                      </span>
                    )}
                    <div className="task-actions">
                      {editingId !== tarea.id && (
                        <>
                          <button onClick={() => handleStartEdit(tarea)} title="Editar">
                            <IconEdit size={11} />
                          </button>
                          <button onClick={() => handleDeleteTarea(tarea.id)} title="Eliminar" className="task-delete">
                            <IconTrash size={11} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .task-panel {
          position: absolute;
          width: 320px;
          max-height: 450px;
          background: var(--bg-card, #fff);
          border: 1px solid var(--border, #e2e8f0);
          border-radius: var(--radius-md, 8px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .task-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.6rem 0.8rem;
          border-bottom: 1px solid var(--border, #e2e8f0);
          background: var(--bg-elevated, #f8fafc);
        }
        .task-panel-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.2rem;
          border-radius: 4px;
          color: var(--text-muted, #64748b);
          display: flex;
          align-items: center;
        }
        .task-panel-close:hover {
          background: var(--bg-hover, #f1f5f9);
        }
        .task-panel-stats {
          display: flex;
          gap: 1rem;
          padding: 0.5rem 0.8rem;
          font-size: 0.7rem;
          color: var(--text-muted, #64748b);
          border-bottom: 1px solid var(--border, #e2e8f0);
        }
        .task-stat-num {
          font-weight: 700;
          color: var(--primary, #6366f1);
        }
        .task-panel-input {
          display: flex;
          gap: 0.4rem;
          padding: 0.6rem 0.8rem;
          border-bottom: 1px solid var(--border, #e2e8f0);
        }
        .task-panel-input input {
          flex: 1;
          padding: 0.4rem 0.6rem;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: var(--radius-sm, 6px);
          font-size: 0.8rem;
          background: var(--bg-card, #fff);
          color: var(--text, #0f172a);
        }
        .task-panel-input input:focus {
          outline: none;
          border-color: var(--primary, #6366f1);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
        }
        .task-panel-input .btn-sm {
          padding: 0.4rem 0.8rem;
          font-size: 0.85rem;
          font-weight: 700;
        }
        .task-panel-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.4rem 0;
        }
        .task-panel-empty {
          text-align: center;
          padding: 1.5rem 1rem;
          color: var(--text-muted, #64748b);
          font-size: 0.78rem;
        }
        .task-section {
          margin-bottom: 0.5rem;
        }
        .task-section-title {
          display: block;
          padding: 0.3rem 0.8rem;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted, #64748b);
        }
        .task-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.8rem;
          transition: background 0.15s;
        }
        .task-item:hover {
          background: var(--bg-hover, #f8fafc);
        }
        .task-item.completed .task-text {
          text-decoration: line-through;
          color: var(--text-muted, #94a3b8);
        }
        .task-checkbox {
          width: 16px;
          height: 16px;
          border: 2px solid var(--border, #cbd5e1);
          border-radius: 4px;
          background: var(--bg-card, #fff);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.15s;
        }
        .task-checkbox:hover {
          border-color: var(--primary, #6366f1);
        }
        .task-checkbox.checked {
          background: var(--success, #10b981);
          border-color: var(--success, #10b981);
          color: white;
        }
        .task-text {
          flex: 1;
          font-size: 0.8rem;
          color: var(--text, #0f172a);
          word-break: break-word;
          cursor: text;
        }
        .task-edit-input {
          flex: 1;
          padding: 0.2rem 0.4rem;
          border: 1px solid var(--primary, #6366f1);
          border-radius: 4px;
          font-size: 0.8rem;
          background: var(--bg-card, #fff);
          color: var(--text, #0f172a);
        }
        .task-edit-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
        }
        .task-actions {
          display: flex;
          gap: 0.2rem;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .task-item:hover .task-actions {
          opacity: 1;
        }
        .task-actions button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.2rem;
          border-radius: 4px;
          color: var(--text-muted, #64748b);
          display: flex;
          align-items: center;
        }
        .task-actions button:hover {
          background: var(--bg-hover, #f1f5f9);
          color: var(--primary, #6366f1);
        }
        .task-actions .task-delete:hover {
          color: var(--danger, #ef4444);
        }
      `}</style>
    </div>,
    document.body
  );
}
