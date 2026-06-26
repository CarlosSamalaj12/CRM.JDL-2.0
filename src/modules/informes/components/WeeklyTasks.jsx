import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  getTareasSemana,
  createTareaSemanal,
  updateTareaSemanal,
  updateTarea,
  deleteTarea,
  deleteTareaSemanal,
  getHistorialTareasSemana,
  autoMarcarNoRealizado,
  getTareasEvento,
  logHistorialEntry,
} from '../services/api.js';


const ACCION_LABELS = {
  created: 'creó',
  completed: 'completó',
  uncompleted: 'desmarcó',
  edited: 'editó',
  deleted: 'eliminó',
  no_realizado: 'marcó como no realizado',
};

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function getMonday(isoDate) {
  const d = new Date(isoDate + 'T12:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const m = new Date(d);
  m.setDate(diff);
  return m.toISOString().slice(0, 10);
}

function formatHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatFechaCorta(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    const r = String(u.role || '').trim().toLowerCase();
    let rol = r;
    if (r === 'admin') rol = 'Admin';
    else if (r === 'frontoffice' || r === 'front_office' || r === 'recepcionista') rol = 'FrontOffice';
    else if (r === 'vendedor' || r === 'sales') rol = 'Vendedor';
    else if (r === 'coordinador') rol = 'Coordinador';
    else if (r === 'eventos') rol = 'Eventos';
    return { ...u, rol };
  } catch { return null; }
}

export default function WeeklyTasks({ selectedDate, events = [] }) {
  const user = getCurrentUser();
  const semana_lunes = getMonday(selectedDate);

  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistorial, setShowHistorial] = useState(false);
  const showHistorialRef = useRef(false);
  const [historial, setHistorial] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const localHistoryRef = useRef([]);

  const [newContenido, setNewContenido] = useState('');
  const [newFecha, setNewFecha] = useState(selectedDate);
  const [newIdOcupacion, setNewIdOcupacion] = useState('');
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editIdOcupacion, setEditIdOcupacion] = useState('');

  const loadTareas = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      await autoMarcarNoRealizado();
      const [semanales, tareasEventoPromises] = await Promise.all([
        getTareasSemana(semana_lunes),
        ...events
          .filter((e, i, arr) => arr.findIndex(x => x.Idocupacion === e.Idocupacion) === i)
          .map(ev => getTareasEvento(ev.Idocupacion).then(tareas =>
            tareas.map(t => ({
              ...t,
              _source: 'evento',
              fecha_tarea: ev.displayDate,
              evento_institucion: ev.Institucion,
              evento_salon: ev.Salon,
              no_realizado: 0,
              completada_en: null,
              semana_lunes: null,
              creado_en: t.fecha_creacion || t.creado_en,
              actualizado_en: t.fecha_creacion || t.creado_en,
            }))
          ).catch(() => []))
      ]);
      const evento = tareasEventoPromises.flat();
      const marked = new Set();
      const merged = [];
      for (const t of semanales) {
        const key = `${t.fecha_tarea}-${t.contenido}-${t.id_ocupacion || ''}`;
        marked.add(key);
        merged.push({ ...t, _source: 'semanal' });
      }
      for (const t of evento) {
        const key = `${String(t.fecha_tarea || '').slice(0, 10)}-${t.contenido}-${t.id_ocupacion || ''}`;
        if (!marked.has(key)) merged.push(t);
      }
      merged.sort((a, b) => {
        const da = String(a.fecha_tarea || '').slice(0, 10);
        const db = String(b.fecha_tarea || '').slice(0, 10);
        if (da !== db) return da < db ? -1 : 1;
        return (a.id || 0) - (b.id || 0);
      });
      setTareas(merged);
    } catch (err) {
      console.error('Error loading weekly tasks:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [semana_lunes, events]);

  useEffect(() => {
    loadTareas(true);
  }, [loadTareas]);

  const addLocalHistory = (entry) => {
    localHistoryRef.current.unshift({ id: `local-${Date.now()}`, ...entry });
  };

  const loadHistorial = async () => {
    setHistLoading(true);
    try {
      const data = await getHistorialTareasSemana(semana_lunes);
      const localIds = new Set(localHistoryRef.current.map(h => h.id));
      const merged = [...localHistoryRef.current, ...data.filter(h => !localIds.has(h.id))];
      setHistorial(merged);
    } catch (err) {
      console.error('Error loading history:', err);
      setHistorial([...localHistoryRef.current]);
    } finally {
      setHistLoading(false);
    }
  };

  const handleToggleHistorial = () => {
    const next = !showHistorial;
    setShowHistorial(next);
    showHistorialRef.current = next;
    if (next) loadHistorial();
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newContenido.trim() || !user) return;
    setAdding(true);
    try {
      await createTareaSemanal({
        semana_lunes,
        fecha_tarea: newFecha,
        contenido: newContenido.trim(),
        id_ocupacion: newIdOcupacion || null,
        usuario_id: user.id || user._id || '',
        usuario_nombre: user.name || user.nombre || user.username || '',
      });
      setNewContenido('');
      setNewIdOcupacion('');
      toast('Tarea agregada ✓');
      addLocalHistory({
        accion: 'created', contenido_previo: null, contenido_nuevo: newContenido.trim(),
        usuario_nombre: user.name || user.nombre || user.username || '',
        creado_en: new Date().toISOString(),
      });
      await loadTareas(false);
      if (showHistorialRef.current) loadHistorial();
    } catch (err) {
      toast('Error al crear tarea');
      console.error('Error creating task:', err);
    } finally {
      setAdding(false);
    }
  };

  const handleToggleComplete = async (tarea) => {
    if (!user) return;
    try {
      if (tarea._source === 'evento') {
        await updateTarea(tarea.id, { completada: !tarea.completada });
        logHistorialEntry({
          tarea_id: tarea.id, accion: tarea.completada ? 'uncompleted' : 'completed',
          contenido_previo: tarea.contenido, contenido_nuevo: tarea.contenido,
          usuario_id: user.id || user._id || '', usuario_nombre: user.name || user.nombre || user.username || '',
        }).catch(() => {});
      } else {
        await updateTareaSemanal(tarea.id, {
          completada: !tarea.completada,
          usuario_id: user.id || user._id || '',
          usuario_nombre: user.name || user.nombre || user.username || '',
        });
      }
      addLocalHistory({
        accion: tarea.completada ? 'uncompleted' : 'completed',
        contenido_previo: tarea.contenido, contenido_nuevo: tarea.contenido,
        usuario_nombre: user.name || user.nombre || user.username || '',
        creado_en: new Date().toISOString(),
      });
      await loadTareas(false);
      if (showHistorialRef.current) loadHistorial();
    } catch (err) {
      toast('Error al cambiar estado');
      console.error('Error toggling task:', err);
    }
  };

  const handleSaveEdit = async (tarea) => {
    if (!editText.trim() || !user) return;
    try {
      if (tarea._source === 'evento') {
        await updateTarea(tarea.id, { contenido: editText.trim() });
        logHistorialEntry({
          tarea_id: tarea.id, accion: 'edited',
          contenido_previo: tarea.contenido, contenido_nuevo: editText.trim(),
          usuario_id: user.id || user._id || '', usuario_nombre: user.name || user.nombre || user.username || '',
        }).catch(() => {});
      } else {
        await updateTareaSemanal(tarea.id, {
          contenido: editText.trim(),
          id_ocupacion: editIdOcupacion || null,
          usuario_id: user.id || user._id || '',
          usuario_nombre: user.name || user.nombre || user.username || '',
        });
      }
      setEditingId(null);
      toast('Tarea actualizada ✓');
      addLocalHistory({
        accion: 'edited',
        contenido_previo: tarea.contenido, contenido_nuevo: editText.trim(),
        usuario_nombre: user.name || user.nombre || user.username || '',
        creado_en: new Date().toISOString(),
      });
      await loadTareas(false);
      if (showHistorialRef.current) loadHistorial();
    } catch (err) {
      toast('Error al actualizar tarea');
      console.error('Error editing task:', err);
    }
  };

  const handleDelete = async (tarea) => {
    if (!user) return;
    try {
      if (tarea._source === 'evento') {
        await deleteTarea(tarea.id);
        logHistorialEntry({
          tarea_id: tarea.id, accion: 'deleted',
          contenido_previo: tarea.contenido, contenido_nuevo: null,
          usuario_id: user.id || user._id || '', usuario_nombre: user.name || user.nombre || user.username || '',
        }).catch(() => {});
      } else {
        await deleteTareaSemanal(tarea.id, {
          usuario_id: user.id || user._id || '',
          usuario_nombre: user.name || user.nombre || user.username || '',
        });
      }
      toast('Tarea eliminada');
      addLocalHistory({
        accion: 'deleted',
        contenido_previo: tarea.contenido, contenido_nuevo: null,
        usuario_nombre: user.name || user.nombre || user.username || '',
        creado_en: new Date().toISOString(),
      });
      await loadTareas(false);
      if (showHistorialRef.current) loadHistorial();
    } catch (err) {
      toast('Error al eliminar tarea');
      console.error('Error deleting task:', err);
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(semana_lunes + 'T12:00:00');
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const tareasDia = tareas.filter(t => String(t.fecha_tarea || '').slice(0, 10) === iso);
    return { iso, label: `${DAY_LABELS[d.getDay()]} ${d.getDate()}`, tareas: tareasDia };
  });

  const totalCount = tareas.length;
  const completedCount = tareas.filter(t => t.completada).length;
  const noRealizadoCount = tareas.filter(t => t.no_realizado).length;
  const pendingCount = tareas.filter(t => !t.completada && !t.no_realizado).length;

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Stats bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
        marginBottom: '16px', padding: '12px 16px', background: '#ffffff',
        border: '1px solid #e2e8f0', borderRadius: '12px',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
          <span style={{color:'#10b981', marginRight:4}}>✓</span>
          Tareas de la semana
        </span>
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: 600 }}>
          <span style={{ color: '#64748b' }}>Total <strong style={{ color: '#0f172a' }}>{totalCount}</strong></span>
          <span style={{ color: '#16a34a' }}>Completadas <strong>{completedCount}</strong></span>
          <span style={{ color: '#f59e0b' }}>Pendientes <strong>{pendingCount}</strong></span>
          {noRealizadoCount > 0 && (
            <span style={{ color: '#ef4444' }}>No realizadas <strong>{noRealizadoCount}</strong></span>
          )}
        </div>
        <button
          onClick={handleToggleHistorial}
          style={{
            marginLeft: 'auto', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
            background: showHistorial ? '#f1f5f9' : '#ffffff', cursor: 'pointer', fontSize: '11px',
            fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
          onMouseLeave={e => { e.currentTarget.style.background = showHistorial ? '#f1f5f9' : '#ffffff'; }}
        >
          Historial
        </button>
      </div>

      {/* History panel */}
      {showHistorial && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', background: '#f8fafc',
          border: '1px solid #e2e8f0', borderRadius: '10px', maxHeight: '240px',
          overflowY: 'auto', fontSize: '12px',
        }}>
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '8px', fontSize: '12px' }}>
            Historial de cambios
          </div>
          {histLoading ? (
            <span style={{ color: '#94a3b8' }}>Cargando...</span>
          ) : historial.length === 0 ? (
            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin cambios registrados</span>
          ) : (
            historial.map(h => (
              <div key={h.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                padding: '6px 0', borderBottom: '1px solid #e2e8f0',
              }}>
                <span style={{
                  padding: '2px 7px', borderRadius: '4px', fontSize: '10px',
                  fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                  background: h.accion === 'deleted' ? '#fef2f2' : h.accion === 'completed' ? '#f0fdf4' : h.accion === 'no_realizado' ? '#fff7ed' : '#f1f5f9',
                  color: h.accion === 'deleted' ? '#ef4444' : h.accion === 'completed' ? '#16a34a' : h.accion === 'no_realizado' ? '#d97706' : '#64748b',
                }}>
                  {ACCION_LABELS[h.accion] || h.accion}
                </span>
                <span style={{ flex: 1, color: '#334155', minWidth: 0 }}>
                  {h.accion === 'deleted' ? (
                    <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{h.contenido_previo}</span>
                  ) : h.accion === 'edited' ? (
                    <span>"{h.contenido_previo}" → "{h.contenido_nuevo}"</span>
                  ) : (
                    <span>{h.contenido_nuevo || h.contenido_previo}</span>
                  )}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {h.usuario_nombre} {formatHora(h.creado_en)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add task form */}
      <form onSubmit={handleAdd} style={{
        display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          type="text" value={newContenido} onChange={e => setNewContenido(e.target.value)}
          placeholder="Nueva tarea..." required
          style={{
            flex: '1 1 200px', height: '36px', padding: '0 12px', borderRadius: '8px',
            border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none',
            background: '#ffffff', color: '#0f172a', minWidth: '150px',
          }}
          onFocus={e => e.target.style.borderColor = '#6366f1'}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'}
        />
        <input
          type="date" value={newFecha} onChange={e => { setNewFecha(e.target.value); setNewIdOcupacion(''); }}
          style={{
            height: '36px', padding: '0 10px', borderRadius: '8px',
            border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none',
            background: '#ffffff', color: '#0f172a',
          }}
        />
        <select value={newIdOcupacion} onChange={e => setNewIdOcupacion(e.target.value)}
          style={{
            height: '36px', padding: '0 10px', borderRadius: '8px',
            border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none',
            background: '#ffffff', color: '#0f172a', maxWidth: '220px',
            cursor: 'pointer',
          }}
        >
          <option value="">Sin evento</option>
          {events
            .filter(e => e.displayDate === newFecha)
            .filter((e, i, arr) => arr.findIndex(x => x.Idocupacion === e.Idocupacion) === i)
            .map(ev => (
              <option key={ev.Idocupacion} value={ev.Idocupacion}>
                {ev.Institucion || '—'} · {ev.Salon || '—'}
              </option>
            ))}
        </select>
        <button type="submit" disabled={adding || !user}
          style={{
            height: '36px', padding: '0 16px', borderRadius: '8px', border: 'none',
            background: !user ? '#cbd5e1' : '#6366f1', color: '#ffffff', cursor: !user ? 'not-allowed' : 'pointer',
            fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (user) e.currentTarget.style.background = '#4f46e5'; }}
          onMouseLeave={e => { if (user) e.currentTarget.style.background = '#6366f1'; }}
        >
          + Agregar
        </button>
      </form>

      {/* Loading state */}
      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          Cargando tareas...
        </div>
      ) : (
        /* Tasks table grouped by day */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {weekDays.map(day => {
            const isFuture = day.iso > new Date().toISOString().slice(0, 10);
            const isToday = day.iso === new Date().toISOString().slice(0, 10);
            return (
              <div key={day.iso} style={{
                border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden',
                background: isToday ? '#f8faff' : '#ffffff',
                borderColor: isToday ? '#6366f1' : '#e2e8f0',
                opacity: day.tareas.length === 0 ? 0.6 : 1,
              }}>
                <div style={{
                  padding: '8px 14px', fontSize: '12px', fontWeight: 700,
                  background: isToday ? 'rgba(99,102,241,0.06)' : '#f8fafc',
                  color: isToday ? '#6366f1' : '#475569',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span>{formatFechaCorta(day.iso)}</span>
                  <span style={{
                    fontSize: '10px', fontWeight: 600, color: '#94a3b8',
                    background: '#f1f5f9', padding: '1px 7px', borderRadius: '999px',
                  }}>
                    {day.tareas.filter(t => t.completada).length}/{day.tareas.length}
                  </span>
                </div>

                {day.tareas.length === 0 ? (
                  <div style={{ padding: '10px 14px', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                    Sin tareas para este día
                  </div>
                ) : (
                  day.tareas.map(t => {
                    const isEditing = editingId === t.id;
                    const isPast = String(t.fecha_tarea || '').slice(0, 10) < new Date().toISOString().slice(0, 10) && !t.completada;
                    return (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 14px', borderBottom: '1px solid #f1f5f9',
                        background: t.completada ? '#fafdfa' : t.no_realizado ? '#fef2f2' : '#ffffff',
                        opacity: t.completada ? 0.7 : 1,
                      }}>
                        <button onClick={() => handleToggleComplete(t)}
                          style={{
                            padding: t.completada ? '3px 12px' : '3px 10px', borderRadius: '20px', border: '2px solid',
                            borderColor: t.completada ? '#10b981' : t.no_realizado ? '#ef4444' : '#d1d5db',
                            background: t.completada ? '#10b981' : t.no_realizado ? '#fef2f2' : '#ffffff',
                            cursor: 'pointer', flexShrink: 0,
                            fontSize: '11px', fontWeight: 700, lineHeight: '20px',
                            color: t.completada ? '#ffffff' : t.no_realizado ? '#ef4444' : '#6b7280',
                            transition: 'all 0.15s', whiteSpace: 'nowrap',
                          }}
                          data-tooltip={t.completada ? 'Desmarcar' : 'Completar'}
                          onMouseEnter={e => {
                            if (!t.completada && !t.no_realizado) { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.background = '#eef2ff'; }
                          }}
                          onMouseLeave={e => {
                            if (!t.completada && !t.no_realizado) { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = '#ffffff'; }
                          }}
                        >
                          {Boolean(t.completada) && 'Hecho'}
                          {Boolean(t.no_realizado) && !t.completada && 'No realizado'}
                          {!t.completada && !t.no_realizado && 'Pendiente'}
                        </button>

                        {isEditing ? (
                          <div style={{ display: 'flex', flex: 1, gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              value={editText} autoFocus
                              onChange={e => setEditText(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveEdit(t);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              style={{
                                flex: '1 1 140px', padding: '4px 8px', borderRadius: '6px',
                                border: '1px solid #6366f1', fontSize: '12px', outline: 'none',
                              }}
                            />
                            <select value={editIdOcupacion} onChange={e => setEditIdOcupacion(e.target.value)}
                              style={{
                                height: '28px', padding: '0 6px', borderRadius: '6px',
                                border: '1px solid #e2e8f0', fontSize: '11px', outline: 'none',
                                background: '#ffffff', color: '#0f172a', cursor: 'pointer',
                                maxWidth: '180px',
                              }}
                            >
                              <option value="">Sin evento</option>
                              {events
                                .filter(e => e.displayDate === String(t.fecha_tarea || '').slice(0, 10))
                                .filter((e, i, arr) => arr.findIndex(x => x.Idocupacion === e.Idocupacion) === i)
                                .map(ev => (
                                  <option key={ev.Idocupacion} value={ev.Idocupacion}>
                                    {ev.Institucion || '—'} · {ev.Salon || '—'}
                                  </option>
                                ))}
                            </select>
                            <button onClick={() => handleSaveEdit(t)}
                              style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                              OK
                            </button>
                            <button onClick={() => setEditingId(null)}
                              style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#fff', color: '#94a3b8', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => { setEditingId(t.id); setEditText(t.contenido); setEditIdOcupacion(t.id_ocupacion || ''); }}
                            style={{
                              flex: 1, fontSize: '12.5px', cursor: 'text', minWidth: 0,
                              color: t.completada ? '#94a3b8' : t.no_realizado ? '#ef4444' : '#0f172a',
                              textDecoration: t.completada ? 'line-through' : 'none',
                            }}
                          >
                            {t.contenido}
                          </span>
                        )}

                        {(t.evento_institucion || t.id_ocupacion) && !isEditing && (
                          <span style={{
                            fontSize: '10px', fontWeight: 600, color: '#6366f1', flexShrink: 0,
                            padding: '1px 7px', borderRadius: '4px', background: '#eef2ff',
                            maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px',
                          }}>
                            {t.evento_institucion || 'Evento'} {t.evento_salon ? `· ${t.evento_salon}` : ''}
                          </span>
                        )}

                        <span style={{
                          fontSize: '10px', fontWeight: 600, color: '#94a3b8', flexShrink: 0,
                          padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9',
                        }}>
                          {t.usuario_nombre || '—'}
                        </span>

                        <button onClick={() => { if (!isEditing) { setEditingId(t.id); setEditText(t.contenido); setEditIdOcupacion(t.id_ocupacion || ''); } }}
                          style={{
                            padding: '2px 7px', borderRadius: '4px', border: '1px solid transparent',
                            cursor: 'pointer', color: '#94a3b8', flexShrink: 0,
                            fontSize: '11px', fontWeight: 600, lineHeight: '20px',
                            opacity: 0, transition: 'all 0.15s', background: 'transparent',
                          }}
                          className="weekly-task-action-btn"
                          data-tooltip="Editar"
                        >
                          Editar
                        </button>
                        <button onClick={() => handleDelete(t)}
                          style={{
                            padding: '2px 7px', borderRadius: '4px', border: '1px solid transparent',
                            cursor: 'pointer', color: '#94a3b8', flexShrink: 0,
                            fontSize: '11px', fontWeight: 600, lineHeight: '20px',
                            opacity: 0, transition: 'all 0.15s', background: 'transparent',
                          }}
                          className="weekly-task-action-btn"
                          data-tooltip="Eliminar"
                        >
                          Eliminar
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .weekly-task-action-btn { opacity: 0; }
        .weekly-task-action-btn:hover { color: #6366f1 !important; }
        div[class*=""]:hover > .weekly-task-action-btn { opacity: 1; }
        div[style*="display: flex"]:hover > button.weekly-task-action-btn { opacity: 0.5; }
        div[style*="display: flex"]:hover > button.weekly-task-action-btn:hover { opacity: 1; color: #6366f1; }
        div[style*="display: flex"]:hover > button.weekly-task-action-btn:last-child:hover { color: #ef4444 !important; }
      `}</style>
    </div>
  );
}
