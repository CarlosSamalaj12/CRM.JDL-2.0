import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  logHistorialEntry,
  getEquiposTrabajo,
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
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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

export default function WeeklyTasks({
  selectedDate,
  events = [],
  onDateChange,
  mobileDayIndex: parentMobileDayIndex,
  setMobileDayIndex: parentSetMobileDayIndex,
  setTaskCounts,
  targetEventId,
  onTargetEventProcessed
}) {
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
  const [newSelectedDays, setNewSelectedDays] = useState([]);
  const [adding, setAdding] = useState(false);
  const [equipos, setEquipos] = useState([]);
  const [newEquipoId, setNewEquipoId] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editIdOcupacion, setEditIdOcupacion] = useState('');

  const [filterStatus, setFilterStatus] = useState('todas');
  const [collapseNoPending, setCollapseNoPending] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [localMobileDayIndex, setLocalMobileDayIndex] = useState(() => ((new Date().getDay() + 6) % 7));
  const mobileDayIndex = parentMobileDayIndex !== undefined ? parentMobileDayIndex : localMobileDayIndex;
  const setMobileDayIndex = parentSetMobileDayIndex !== undefined ? parentSetMobileDayIndex : setLocalMobileDayIndex;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (isMobile) {
      const idx = ((new Date().getDay() + 6) % 7);
      setMobileDayIndex(idx);
    }
  }, [semana_lunes, isMobile]);

  const handlePrevWeek = () => {
    if (!onDateChange) return;
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    onDateChange(d.toISOString().slice(0, 10));
  };
  const handleNextWeek = () => {
    if (!onDateChange) return;
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    onDateChange(d.toISOString().slice(0, 10));
  };

  const diasEvento = useMemo(() => {
    if (!newIdOcupacion) return [];
    // El evento seleccionado tiene un Idocupacion que corresponde a un día específico.
    // Buscamos todos los días del mismo evento agrupando por Institucion + Salon.
    const sel = events.find(e => String(e.Idocupacion) === String(newIdOcupacion));
    if (!sel) return [];
    return events
      .filter(e => e.Institucion === sel.Institucion && e.Salon === sel.Salon)
      .map(e => e.displayDate)
      .filter((d, i, arr) => arr.indexOf(d) === i)
      .sort();
  }, [newIdOcupacion, events]);

  const uniqueEvents = useMemo(() => {
    // Cada evento en la BD ya representa un día (Idocupacion único por día).
    // Filtramos por la fecha seleccionada y agrupamos por Institucion+Salon
    // para mostrar cada evento una sola vez en el dropdown.
    const seen = new Set();
    return events.filter(e => {
      if (e.displayDate !== newFecha) return false;
      const key = `${e.Institucion || ''}|${e.Salon || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [events, newFecha]);

  const lastEventRef = useRef(null);
  if (lastEventRef.current !== newIdOcupacion) {
    lastEventRef.current = newIdOcupacion;
    if (!newIdOcupacion) {
      setNewSelectedDays([]);
    } else {
      setNewSelectedDays(diasEvento.length > 1 ? [newFecha] : diasEvento);
    }
  }

  useEffect(() => {
    getEquiposTrabajo().then(data => setEquipos(data)).catch(() => {});
  }, []);

  const loadTareas = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    // autoMarcarNoRealizado se ejecuta aparte para que no bloquee la carga si falla
    autoMarcarNoRealizado().catch(err => {
      console.warn('autoMarcarNoRealizado falló (no crítico):', err);
    });
    try {
      const params = {};
      const uid = String(user?.id || user?._id || '');
      if (uid) params.usuario_id = uid;
      if (user?.teamId) params.equipo_id = user.teamId;
      const semanales = await getTareasSemana(semana_lunes, params);
      if (!Array.isArray(semanales)) {
        console.warn('getTareasSemana returned non-array:', semanales);
        setTareas([]);
      } else {
        semanales.sort((a, b) => {
          const da = String(a.fecha_tarea || '').slice(0, 10);
          const db = String(b.fecha_tarea || '').slice(0, 10);
          if (da !== db) return da < db ? -1 : 1;
          return (a.id || 0) - (b.id || 0);
        });
        setTareas(semanales);
      }
    } catch (err) {
      console.error('Error loading weekly tasks:', err);
      toast('Error al cargar tareas. Verifica tu conexión.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [semana_lunes, user?.teamId, user?.id, user?._id]);

  useEffect(() => {
    loadTareas(true);
  }, [loadTareas]);

  // Escuchar cambios en tiempo real via socket (entity:changed → tarea_semanal)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.entity === 'tarea_semanal') {
        loadTareas(false);
      }
    };
    window.addEventListener('entity:changed', handler);
    return () => window.removeEventListener('entity:changed', handler);
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
    const daysToCreate = newSelectedDays.length > 0 ? newSelectedDays : [newFecha];
    try {
      for (const day of daysToCreate) {
        await createTareaSemanal({
          semana_lunes: getMonday(day),
          fecha_tarea: day,
          contenido: newContenido.trim(),
          id_ocupacion: newIdOcupacion || null,
          equipo_id: Number(newEquipoId) || null,
          usuario_id: user.id || user._id || '',
          usuario_nombre: user.name || user.nombre || user.username || '',
        });
      }
      setNewContenido('');
      setNewIdOcupacion('');
      setNewSelectedDays([]);
      toast(`Tarea${daysToCreate.length > 1 ? 's' : ''} agregada${daysToCreate.length > 1 ? 's' : ''} ✓`);
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

  const canCompleteTask = (tarea) => {
    if (!user) return false;
    const uid = String(user.id || user._id || '');
    const isCreator = uid && String(tarea.usuario_id) === uid;

    if (tarea.equipo_id) {
      if (user?.teamId) {
        return Number(user.teamId) === Number(tarea.equipo_id);
      }
      return isCreator;
    }

    return isCreator;
  };

  const filteredTareas = tareas.filter(t => {
    if (filterStatus === 'todas') return true;
    if (filterStatus === 'pendientes') return !t.completada && !t.no_realizado;
    if (filterStatus === 'completadas') return t.completada;
    if (filterStatus === 'no_realizado') return t.no_realizado;
    return true;
  });

  const weekDays = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(semana_lunes + 'T12:00:00');
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const tareasDia = filteredTareas.filter(t => String(t.fecha_tarea || '').slice(0, 10) === iso);
      return { iso, label: `${DAY_LABELS[d.getDay()]} ${d.getDate()}`, tareas: tareasDia };
    });
    // Ordenar: días con tareas pendientes primero, luego orden cronológico
    return days.sort((a, b) => {
      const aHasPending = a.tareas.some(t => !t.completada && !t.no_realizado);
      const bHasPending = b.tareas.some(t => !t.completada && !t.no_realizado);
      if (aHasPending && !bHasPending) return -1;
      if (!aHasPending && bHasPending) return 1;
      return a.iso < b.iso ? -1 : 1;
    });
  }, [semana_lunes, filteredTareas]);

  // Navegar al primer día con tareas pendientes del evento seleccionado
  useEffect(() => {
    if (!targetEventId || !tareas.length) return;

    // Buscar el primer día que tenga tareas PENDIENTES (no completadas) de ese evento
    for (let i = 0; i < weekDays.length; i++) {
      const day = weekDays[i];
      const hasPending = day.tareas.some(t =>
        String(t.id_ocupacion) === String(targetEventId) && !t.completada && !t.no_realizado
      );
      if (hasPending) {
        setMobileDayIndex(i);
        break;
      }
    }

    // Limpiar el target después de procesarlo
    if (onTargetEventProcessed) {
      onTargetEventProcessed();
    }
  }, [targetEventId, tareas, weekDays, setMobileDayIndex, onTargetEventProcessed]);

  useEffect(() => {
    if (setTaskCounts) {
      const counts = {};
      weekDays.forEach(day => {
        counts[day.iso] = day.tareas.length;
      });
      setTaskCounts(prev => {
        const hasChanged = Object.keys(counts).some(k => prev[k] !== counts[k]);
        return hasChanged ? counts : prev;
      });
    }
  }, [weekDays, setTaskCounts]);

  const totalCount = filteredTareas.length;
  const completedCount = filteredTareas.filter(t => t.completada).length;
  const noRealizadoCount = filteredTareas.filter(t => t.no_realizado).length;
  const pendingCount = filteredTareas.filter(t => !t.completada && !t.no_realizado).length;

  return (
    <div style={{ padding: isMobile ? '24px 12px 12px 12px' : '16px 20px' }}>
      {/* Mobile date selector removed to prevent duplication, managed by parent header */}



      {/* Stats bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px', flexWrap: 'wrap',
        marginBottom: '16px', padding: isMobile ? '10px 12px' : '12px 16px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: '12px',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', width: isMobile ? '100%' : 'auto' }}>
          <span style={{color:'#10b981', marginRight:4}}>✓</span>
          Tareas de la semana
        </span>
        <div style={{ display: 'flex', gap: isMobile ? '10px' : '12px', fontSize: '12px', fontWeight: 600, flexWrap: 'wrap', flex: 1 }}>
          <span style={{ color: 'var(--text-muted)' }}>Total <strong style={{ color: 'var(--text-main)' }}>{totalCount}</strong></span>
          <span style={{ color: '#16a34a' }}>Completadas <strong>{completedCount}</strong></span>
          <span style={{ color: '#f59e0b' }}>Pendientes <strong>{pendingCount}</strong></span>
          {noRealizadoCount > 0 && (
            <span style={{ color: '#ef4444' }}>No realizadas <strong>{noRealizadoCount}</strong></span>
          )}
        </div>
        <button
          onClick={handleToggleHistorial}
          style={{
            marginLeft: isMobile ? '0' : 'auto', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)',
            background: showHistorial ? 'var(--surface-2)' : 'var(--bg-card)', cursor: 'pointer', fontSize: '11px',
            fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px',
            transition: 'all 0.15s', width: isMobile ? '100%' : 'auto', justifyContent: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = showHistorial ? 'var(--surface-2)' : 'var(--bg-card)'; }}
        >
          Historial
        </button>
      </div>

      {/* Filter chips + collapse button */}
      <div style={{
        display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {[
          { key: 'todas', label: 'Todas', color: '#6366f1' },
          { key: 'pendientes', label: 'Pendientes', color: '#f59e0b' },
          { key: 'completadas', label: 'Completadas', color: '#16a34a' },
          { key: 'no_realizado', label: 'No realizadas', color: '#ef4444' },
        ].map(({ key, label, color }) => {
          const active = filterStatus === key;
          return (
            <button key={key} onClick={() => setFilterStatus(key)}
              style={{
                padding: '4px 12px', borderRadius: '999px', border: '1px solid',
                borderColor: active ? color : 'var(--border)',
                background: active ? `${color}15` : 'var(--bg-card)',
                color: active ? color : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '11px', fontWeight: active ? 700 : 600,
                transition: 'all 0.12s',
              }}
            >
              {label}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setCollapseNoPending(!collapseNoPending)}
          style={{
            padding: '4px 12px', borderRadius: '999px', border: '1px solid',
            borderColor: collapseNoPending ? '#6366f1' : 'var(--border)',
            background: collapseNoPending ? 'var(--primary-bg)' : 'var(--bg-card)',
            color: collapseNoPending ? '#6366f1' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: '11px', fontWeight: collapseNoPending ? 700 : 600,
            transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: '4px',
          }}
          data-tooltip={collapseNoPending ? 'Mostrar todos los días' : 'Ocultar días sin tareas pendientes'}
        >
          <span style={{ fontSize: '12px', lineHeight: 1 }}>{collapseNoPending ? '▣' : '☐'}</span>
          {collapseNoPending ? 'Mostrar todos' : 'Ocultar sin pendientes'}
        </button>
      </div>

      {/* History panel */}
      {showHistorial && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', background: 'var(--surface-hover)',
          border: '1px solid var(--border)', borderRadius: '10px', maxHeight: '240px',
          overflowY: 'auto', fontSize: '12px',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', fontSize: '12px' }}>
            Historial de cambios
          </div>
          {histLoading ? (
            <span style={{ color: 'var(--text-muted)' }}>Cargando...</span>
          ) : historial.length === 0 ? (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin cambios registrados</span>
          ) : (
            historial.map(h => (
              <div key={h.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                padding: '6px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{
                  padding: '2px 7px', borderRadius: '4px', fontSize: '10px',
                  fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                  background: h.accion === 'deleted' ? 'var(--danger-bg)' : h.accion === 'completed' ? 'var(--success-bg)' : h.accion === 'no_realizado' ? 'var(--warning-bg)' : 'var(--surface-2)',
                  color: h.accion === 'deleted' ? '#ef4444' : h.accion === 'completed' ? '#16a34a' : h.accion === 'no_realizado' ? '#d97706' : 'var(--text-muted)',
                }}>
                  {ACCION_LABELS[h.accion] || h.accion}
                </span>
                <span style={{ flex: 1, color: 'var(--text-main)', minWidth: 0 }}>
                  {h.accion === 'deleted' ? (
                    <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{h.contenido_previo}</span>
                  ) : h.accion === 'edited' ? (
                    <span>"{h.contenido_previo}" → "{h.contenido_nuevo}"</span>
                  ) : (
                    <span>{h.contenido_nuevo || h.contenido_previo}</span>
                  )}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {h.usuario_nombre} {formatHora(h.creado_en)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add task form */}
      <form onSubmit={handleAdd} style={{
        display: 'flex', gap: '8px', marginBottom: '16px',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        flexWrap: isMobile ? 'nowrap' : 'wrap',
      }}>
        <input
          type="text" value={newContenido} onChange={e => setNewContenido(e.target.value)}
          placeholder="Nueva tarea..." required
          style={{
            flex: isMobile ? '1 1 auto' : '1 1 200px',
            width: isMobile ? '100%' : 'auto',
            height: isMobile ? '44px' : '36px', padding: '0 12px', borderRadius: '8px',
            border: '1px solid var(--border)',
            fontSize: isMobile ? '16px' : '13px', outline: 'none',
            background: 'var(--bg-card)', color: 'var(--text-main)', minWidth: isMobile ? '0' : '150px',
          }}
          onFocus={e => e.target.style.borderColor = '#6366f1'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <input
          type="date" value={newFecha} onChange={e => { setNewFecha(e.target.value); setNewIdOcupacion(''); setNewSelectedDays([]); }}
          style={{
            width: isMobile ? '100%' : 'auto',
            height: isMobile ? '44px' : '36px', padding: '0 10px', borderRadius: '8px',
            border: '1px solid var(--border)',
            fontSize: isMobile ? '16px' : '12px', outline: 'none',
            background: 'var(--bg-card)', color: 'var(--text-main)',
          }}
        />
        <select value={newIdOcupacion} onChange={e => { setNewIdOcupacion(e.target.value); setNewSelectedDays([]); }}
          style={{
            width: isMobile ? '100%' : 'auto',
            height: isMobile ? '44px' : '36px', padding: '0 10px', borderRadius: '8px',
            border: '1px solid var(--border)', fontSize: isMobile ? '14px' : '12px', outline: 'none',
            background: 'var(--bg-card)', color: 'var(--text-main)', maxWidth: isMobile ? 'none' : '220px',
            cursor: 'pointer',
          }}
        >
          <option value="">Sin evento</option>
          {uniqueEvents.map(ev => (
            <option key={ev.Idocupacion ?? `${ev.Institucion}-${ev.Salon}`} value={ev.Idocupacion}>
              {ev.Institucion || '—'} · {ev.Salon || '—'}
            </option>
          ))}
        </select>
        {diasEvento.length > 1 && (
          <div style={{ width: '100%', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', padding: '4px 0' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Asignar a:</span>
            {diasEvento.map(day => {
              const checked = newSelectedDays.includes(day);
              return (
                <button
                  key={day} type="button"
                  onClick={() => {
                    setNewSelectedDays(prev =>
                      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                    );
                  }}
                  style={{
                    fontSize: '11px', fontWeight: checked ? 700 : 500, cursor: 'pointer',
                    padding: '6px 12px', borderRadius: '6px', border: '1px solid',
                    borderColor: checked ? '#6366f1' : 'var(--border)',
                    background: checked ? 'var(--primary-bg)' : 'var(--bg-card)',
                    color: checked ? '#6366f1' : 'var(--text-secondary)',
                    transition: 'all 0.12s', minHeight: '36px',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                  }}
                  onTouchStart={e => e.currentTarget.style.transform = 'scale(0.96)'}
                  onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {checked ? '✓ ' : ''}{new Date(day + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: isMobile ? '100%' : 'auto', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <select value={newEquipoId} onChange={e => setNewEquipoId(e.target.value)}
            style={{
              flex: isMobile ? '1 1 auto' : '0 0 auto',
              width: isMobile ? '100%' : 'auto',
              height: isMobile ? '44px' : '36px', padding: '0 10px', borderRadius: '8px',
              border: '1px solid var(--border)', fontSize: isMobile ? '14px' : '12px', outline: 'none',
              background: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer', maxWidth: isMobile ? 'none' : '180px',
            }}
          >
            <option value="">Asignar a...</option>
            {equipos.map(eq => (
              <option key={eq.id} value={eq.id}>{eq.nombre}</option>
            ))}
          </select>
          {(() => {
            const selectedEq = newEquipoId ? equipos.find(eq => eq.id === Number(newEquipoId)) : null;
            if (!selectedEq) return null;
            return (
              <span style={{
                fontSize: '11px', fontWeight: 700, color: '#d97706', flexShrink: 0,
                padding: '2px 8px', borderRadius: '4px', background: 'var(--warning-bg)',
                border: '1px solid var(--warning)', whiteSpace: 'nowrap',
              }}>
                → {selectedEq.nombre}
              </span>
            );
          })()}
        </div>
        <button type="submit" disabled={adding || !user}
          style={{
            width: isMobile ? '100%' : 'auto',
            height: isMobile ? '44px' : '36px', padding: isMobile ? '0 12px' : '0 16px', borderRadius: '8px', border: 'none',
            background: !user ? 'var(--border-light)' : '#6366f1', color: '#ffffff', cursor: !user ? 'not-allowed' : 'pointer',
            fontSize: isMobile ? '14px' : '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
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
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          Cargando tareas...
        </div>
      ) : (
        /* Tasks table grouped by day */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {weekDays
            .filter((_, i) => !isMobile || i === mobileDayIndex)
            .filter(day => isMobile || !collapseNoPending || day.tareas.some(t => !t.completada && !t.no_realizado))
            .map(day => {
            const isFuture = day.iso > new Date().toISOString().slice(0, 10);
            const isToday = day.iso === new Date().toISOString().slice(0, 10);
            return (
              <div key={day.iso} style={{
                border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden',
                background: isToday ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                borderColor: isToday ? '#6366f1' : 'var(--border)',
                opacity: day.tareas.length === 0 ? 0.6 : 1,
              }}>
                <div style={{
                  padding: '8px 14px', fontSize: '12px', fontWeight: 700,
                  background: isToday ? 'rgba(99,102,241,0.06)' : 'var(--surface-hover)',
                  color: isToday ? '#6366f1' : 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span>{formatFechaCorta(day.iso)}</span>
                  <span style={{
                    fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)',
                    background: 'var(--surface-2)', padding: '1px 7px', borderRadius: '999px',
                  }}>
                    {day.tareas.filter(t => t.completada).length}/{day.tareas.length}
                  </span>
                </div>

                {day.tareas.length === 0 ? (
                  <div style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Sin tareas para este día
                  </div>
                ) : (
                  day.tareas.map(t => {
                    const isEditing = editingId === t.id;
                    const isPast = String(t.fecha_tarea || '').slice(0, 10) < new Date().toISOString().slice(0, 10) && !t.completada;
                    return (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px',
                        flexWrap: isMobile ? 'wrap' : 'nowrap',
                        padding: isMobile ? '10px 12px' : '8px 14px', borderBottom: '1px solid #f1f5f9',
                        background: t.completada ? 'var(--success-bg)' : t.no_realizado ? 'var(--danger-bg)' : 'var(--bg-card)',
                        opacity: t.completada ? 0.7 : 1,
                      }}>
                        {canCompleteTask(t) ? (
                          <button onClick={() => handleToggleComplete(t)}
                            style={{
                              padding: isMobile ? '5px 12px' : (t.completada ? '3px 12px' : '3px 10px'), borderRadius: '20px', border: '2px solid',
                              borderColor: t.completada ? '#10b981' : t.no_realizado ? '#ef4444' : 'var(--border)',
                              background: t.completada ? '#10b981' : t.no_realizado ? 'var(--danger-bg)' : 'var(--bg-card)',
                              cursor: 'pointer', flexShrink: 0,
                              fontSize: isMobile ? '12px' : '11px', fontWeight: 700, lineHeight: isMobile ? '24px' : '20px',
                              minHeight: isMobile ? '36px' : 'auto',
                              color: t.completada ? '#ffffff' : t.no_realizado ? '#ef4444' : 'var(--text-muted)',
                              transition: 'all 0.15s', whiteSpace: 'nowrap',
                            }}
                            data-tooltip={t.completada ? 'Desmarcar' : 'Completar'}
                            onMouseEnter={e => {
                              if (!t.completada && !t.no_realizado) { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.background = 'var(--primary-bg)'; }
                            }}
                            onMouseLeave={e => {
                              if (!t.completada && !t.no_realizado) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--bg-card)'; }
                            }}
                          >
                            {Boolean(t.completada) && 'Hecho'}
                            {Boolean(t.no_realizado) && !t.completada && 'No realizado'}
                            {!t.completada && !t.no_realizado && 'Pendiente'}
                          </button>
                        ) : (
                          <span style={{
                            padding: isMobile ? '5px 12px' : (t.completada ? '3px 12px' : '3px 10px'), borderRadius: '20px', border: '2px solid',
                            borderColor: t.completada ? '#10b981' : t.no_realizado ? '#ef4444' : 'var(--border)',
                            background: t.completada ? '#10b981' : t.no_realizado ? 'var(--danger-bg)' : 'var(--surface-hover)',
                            flexShrink: 0,
                            fontSize: isMobile ? '12px' : '11px', fontWeight: 700, lineHeight: isMobile ? '24px' : '20px',
                            minHeight: isMobile ? '36px' : 'auto',
                            color: t.completada ? '#ffffff' : t.no_realizado ? '#ef4444' : 'var(--text-muted)',
                            whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center',
                          }}>
                            {Boolean(t.completada) && 'Hecho'}
                            {Boolean(t.no_realizado) && !t.completada && 'No realizado'}
                            {!t.completada && !t.no_realizado && 'Pendiente'}
                          </span>
                        )}

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
                                border: '1px solid var(--border)', fontSize: '11px', outline: 'none',
                                background: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer',
                                maxWidth: '180px',
                              }}
                            >
                              <option value="">Sin evento</option>
                              {(() => {
                                const taskDate = String(t.fecha_tarea || '').slice(0, 10);
                                const seen = new Set();
                                return events.filter(e => {
                                  if (e.displayDate !== taskDate) return false;
                                  const key = `${e.Institucion || ''}|${e.Salon || ''}`;
                                  if (seen.has(key)) return false;
                                  seen.add(key);
                                  return true;
                                }).map(ev => (
                                  <option key={ev.Idocupacion ?? `${ev.Institucion}-${ev.Salon}`} value={ev.Idocupacion}>
                                    {ev.Institucion || '—'} · {ev.Salon || '—'}
                                  </option>
                                ));
                              })()}
                            </select>
                            <button onClick={() => handleSaveEdit(t)}
                              style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                              OK
                            </button>
                            <button onClick={() => setEditingId(null)}
                              style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => { setEditingId(t.id); setEditText(t.contenido); setEditIdOcupacion(t.id_ocupacion || ''); }}
                            style={{
                              flex: 1, fontSize: isMobile ? '13px' : '12.5px', cursor: 'text', minWidth: 0,
                              color: t.completada ? 'var(--text-muted)' : t.no_realizado ? '#ef4444' : 'var(--text-main)',
                              textDecoration: t.completada ? 'line-through' : 'none',
                            }}
                          >
                            {t.contenido}
                          </span>
                        )}

                        <div style={{
                          display: 'flex', alignItems: 'center', gap: isMobile ? '5px' : '6px',
                          flexWrap: 'wrap',
                          flex: isMobile ? '1 1 100%' : '0 0 auto',
                          justifyContent: isMobile ? 'flex-start' : 'flex-end',
                        }}>
                          {(t.evento_institucion || t.id_ocupacion) && !isEditing && (
                            <span style={{
                              fontSize: '10px', fontWeight: 600, color: '#6366f1', flexShrink: 0,
                              padding: '1px 7px', borderRadius: '4px', background: 'var(--primary-bg)',
                              maxWidth: isMobile ? '100%' : '180px', overflow: 'hidden', textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px',
                            }}>
                              {t.evento_institucion || 'Evento'} {t.evento_salon ? `· ${t.evento_salon}` : ''}
                            </span>
                          )}

                          <span style={{
                            fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0,
                            padding: '1px 6px', borderRadius: '4px', background: 'var(--surface-2)',
                          }}>
                            {t.usuario_nombre || '—'}
                          </span>
                          {(() => {
                            const eq = equipos.find(e => e.id === t.equipo_id);
                            if (!eq) return null;
                            const isMyTeam = Number(user?.teamId) === Number(t.equipo_id);
                            return (
                              <span style={{
                                fontSize: '11px', fontWeight: 700, color: isMyTeam ? '#0ea5e9' : '#d97706', flexShrink: 0,
                                padding: '2px 8px', borderRadius: '4px', background: isMyTeam ? 'var(--primary-bg)' : 'var(--warning-bg)',
                                border: `1px solid ${isMyTeam ? 'var(--primary)' : 'var(--warning)'}`,
                              }}>
                                {eq.nombre}
                              </span>
                            );
                          })()}

                          <button onClick={() => { if (!isEditing) { setEditingId(t.id); setEditText(t.contenido); setEditIdOcupacion(t.id_ocupacion || ''); } }}
                            style={{
                              padding: isMobile ? '5px 9px' : '2px 7px', borderRadius: '4px', border: '1px solid transparent',
                              cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0,
                              fontSize: isMobile ? '12px' : '11px', fontWeight: 600, lineHeight: isMobile ? '24px' : '20px',
                              transition: 'all 0.15s', background: 'transparent',
                              minHeight: isMobile ? '36px' : '30px',
                            }}
                            data-tooltip="Editar"
                          >
                            Editar
                          </button>
                          <button onClick={() => handleDelete(t)}
                            style={{
                              padding: isMobile ? '5px 9px' : '2px 7px', borderRadius: '4px', border: '1px solid transparent',
                              cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0,
                              fontSize: isMobile ? '12px' : '11px', fontWeight: 600, lineHeight: isMobile ? '24px' : '20px',
                              transition: 'all 0.15s', background: 'transparent',
                              minHeight: isMobile ? '36px' : '30px',
                            }}
                            data-tooltip="Eliminar"
                          >
                            Eliminar
                          </button>
                        </div>
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
        button[data-tooltip="Editar"]:hover,
        button[data-tooltip="Eliminar"]:hover { background: var(--surface-2) !important; }
        button[data-tooltip="Eliminar"]:hover { color: #ef4444 !important; }
        button[data-tooltip="Editar"]:hover { color: #6366f1 !important; }
      `}</style>
    </div>
  );
}
