import { useEffect, useState } from 'react';
import {
  getEquipos, createEquipo, updateEquipo, deleteEquipo,
  getSillas, createSilla, updateSilla, deleteSilla,
  getMesas, createMesa, updateMesa, deleteMesa,
} from '../services/api.js';
import { loadState, saveState } from '../../../services/stateService.js';
import { useToast } from '../context/ToastContext.jsx';
import { IconPlus, IconTrash, IconSettings, IconSearch, IconX } from '../components/Icons.jsx';
import { useDataSyncMulti } from '../../../hooks/useDataSync.js';
import OrdenTiemposEditor from '../components/OrdenTiemposEditor.jsx';

// ─── Componente reutilizable para CRUD con toggle activo/inactivo ───
function CrudTab({ title, items, onCreate, onDelete, onEdit, onToggleActive, icon }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [search, setSearch] = useState('');
  const toast = useToast();

  const filtered = search
    ? items.filter(i => i.nombre.toLowerCase().includes(search.toLowerCase()))
    : items;
  const activeCount = items.filter(i => i.activo !== 0).length;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await onCreate(newName.trim());
      setNewName('');
      toast.success(`${title} • "${newName.trim()}" creado`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (!confirm(`¿Eliminar "${nombre}" permanentemente?`)) return;
    try {
      await onDelete(id);
      toast.success('Eliminado');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.nombre);
  };

  const saveEdit = async (id) => {
    if (!editName.trim()) return;
    try {
      await onEdit(id, { nombre: editName.trim() });
      setEditingId(null);
      toast.success('Actualizado');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="config-tab">
      {/* ─── HEADER ─── */}
      <div className="config-tab-header">
        <div className="config-tab-title">
          <span className="config-tab-icon">{icon}</span>
          <span>{title}</span>
          <span className="config-tab-count">{items.length}</span>
          {activeCount < items.length && (
            <span className="config-tab-inactive-count">{items.length - activeCount} inactivo(s)</span>
          )}
        </div>
        <div className="config-tab-actions">
          <div className="config-tab-search">
            <IconSearch size={13} />
            <input
              type="text" placeholder={`Filtrar ${title.toLowerCase()}...`}
              value={search} onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="config-tab-search-clear" onClick={() => setSearch('')}>
                <IconX size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── CREATE FORM ─── */}
      <form className="config-create-form" onSubmit={handleCreate}>
        <input
          type="text" placeholder={`Nuevo ${title.slice(0, -1).toLowerCase()}...`}
          value={newName} onChange={e => setNewName(e.target.value)}
        />
        <button type="submit" className="btn-primary btn-sm">
          <IconPlus size={14} /> Agregar
        </button>
      </form>

      {/* ─── LIST ─── */}
      <div className="config-list">
        {filtered.length === 0 && (
          <div className="config-empty">
            {search ? 'Sin resultados' : `Sin ${title.toLowerCase()} aún — agrega uno arriba`}
          </div>
        )}
        {filtered.map(item => {
          const isActive = item.activo !== 0;
          return (
            <div key={item.id} className={`config-item ${!isActive ? 'config-item-inactive' : ''}`}>
              {editingId === item.id ? (
                <div className="config-item-edit">
                  <input
                    type="text" value={editName}
                    onChange={e => setEditName(e.target.value)}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit(item.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button className="btn-primary btn-sm" onClick={() => saveEdit(item.id)} data-tooltip="Guardar">✓</button>
                  <button className="btn-secondary btn-sm" onClick={() => setEditingId(null)} data-tooltip="Cancelar">✕</button>
                </div>
              ) : (
                <>
                  <div className="config-item-info">
                    <span className="config-item-name" onDoubleClick={() => startEdit(item)}>
                      {item.nombre}
                    </span>
                    {!isActive && <span className="config-item-badge config-badge-inactive">Inactivo</span>}
                    {isActive && <span className="config-item-badge config-badge-active">Activo</span>}
                  </div>
                  <div className="config-item-actions">
                    <button className="config-action-btn config-action-edit" onClick={() => startEdit(item)}
                      data-tooltip="Editar nombre">
                      ✏️
                    </button>
                    <button
                      className={`config-action-btn ${isActive ? 'config-action-disable' : 'config-action-enable'}`}
                      onClick={() => onToggleActive(item.id, !isActive ? 1 : 0)}
                      data-tooltip={isActive ? 'Inhabilitar' : 'Habilitar'}
                    >
                      {isActive ? '🔴' : '🟢'}
                    </button>
                    <button className="config-action-btn config-action-delete"
                      onClick={() => handleDelete(item.id, item.nombre)} data-tooltip="Eliminar permanentemente">
                      <IconTrash size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL DE CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════
export default function Configuracion() {
  const [activeTab, setActiveTab] = useState('equipos');
  const [equipos, setEquipos] = useState([]);
  const [sillas, setSillas] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [tiposMontaje, setTiposMontaje] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const DEFAULT_TIPOS_MONTAJE = [
    'Escuela', 'Imperial', 'Banquete', 'Cóctel', 'Auditorio',
    'Mesa redonda', 'Buffet', 'U', 'Presidencial', 'Personalizado'
  ];

  const loadTiposMontaje = async () => {
    try {
      const state = await loadState();
      const saved = state?.informe_tipos_montaje;
      if (Array.isArray(saved) && saved.length > 0) {
        setTiposMontaje(saved);
      } else {
        setTiposMontaje(DEFAULT_TIPOS_MONTAJE.map((nombre, idx) => ({
          id: `default-${idx}`,
          nombre,
          activo: 1,
        })));
      }
    } catch (err) {
      console.error('Error cargando tipos de montaje:', err);
      setTiposMontaje(DEFAULT_TIPOS_MONTAJE.map((nombre, idx) => ({
        id: `default-${idx}`,
        nombre,
        activo: 1,
      })));
    }
  };

  const persistTiposMontaje = async (next) => {
    try {
      const state = await loadState();
      await saveState({ ...state, informe_tipos_montaje: next });
      window.dispatchEvent(new Event('stateUpdated'));
    } catch (err) {
      console.error('Error guardando tipos de montaje:', err);
      throw err;
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [e, s, m] = await Promise.all([
        getEquipos(), getSillas(), getMesas(), loadTiposMontaje()
      ]);
      setEquipos(e);
      setSillas(s);
      setMesas(m);
    } catch (err) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  useDataSyncMulti(['equipo', 'tipo_silla', 'tipo_mesa', 'forma_pago'], () => loadAll());

  // ─── Toggle activo para equipos/sillas/mesas ───
  const toggleItemActive = async (id, activo, apiUpdate) => {
    try {
      await apiUpdate(id, { activo });
      toast.success(activo ? 'Habilitado' : 'Inhabilitado');
      loadAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return (
    <div className="config-loading">
      <div className="config-loading-spinner" />
      <span>Cargando configuración...</span>
    </div>
  );

  const tabs = [
    { id: 'equipos', label: 'Equipos', icon: '🔧', count: equipos.length },
    { id: 'sillas', label: 'Sillas', icon: '💺', count: sillas.length },
    { id: 'mesas', label: 'Mesas', icon: '🪑', count: mesas.length },
    { id: 'tipos-montaje', label: 'Tipos de montaje', icon: '🏛️', count: tiposMontaje.length },
    { id: 'orden', label: 'Orden tiempos', icon: '🍽️', count: null },
  ];

  return (
    <div className="config-page">
      <div className="config-page-header">
        <div className="config-page-title">
          <IconSettings size={22} />
          <h1>Configuración</h1>
        </div>
        <p className="config-page-sub">Gestiona equipos, tipos de sillas y tipos de mesas del sistema</p>
      </div>

      {/* ─── TABS ─── */}
      <div className="config-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`config-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="config-tab-btn-icon">{tab.icon}</span>
            <span className="config-tab-btn-label">{tab.label}</span>
            {tab.count !== null && <span className="config-tab-btn-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* ─── CONTENIDO ─── */}
      {activeTab === 'equipos' && (
        <CrudTab
          title="Equipos" icon="🔧"
          items={equipos}
          onCreate={async (n) => { await createEquipo(n); loadAll(); }}
          onDelete={async (id) => { await deleteEquipo(id); loadAll(); }}
          onEdit={async (id, data) => { await updateEquipo(id, data); loadAll(); }}
          onToggleActive={(id, activo) => toggleItemActive(id, activo, updateEquipo)}
        />
      )}

      {activeTab === 'sillas' && (
        <CrudTab
          title="Sillas" icon="💺"
          items={sillas}
          onCreate={async (n) => { await createSilla(n); loadAll(); }}
          onDelete={async (id) => { await deleteSilla(id); loadAll(); }}
          onEdit={async (id, data) => { await updateSilla(id, data); loadAll(); }}
          onToggleActive={(id, activo) => toggleItemActive(id, activo, updateSilla)}
        />
      )}

      {activeTab === 'mesas' && (
        <CrudTab
          title="Mesas" icon="🪑"
          items={mesas}
          onCreate={async (n) => { await createMesa(n); loadAll(); }}
          onDelete={async (id) => { await deleteMesa(id); loadAll(); }}
          onEdit={async (id, data) => { await updateMesa(id, data); loadAll(); }}
          onToggleActive={(id, activo) => toggleItemActive(id, activo, updateMesa)}
        />
      )}

      {activeTab === 'tipos-montaje' && (
        <CrudTab
          title="Tipos de montaje" icon="🏛️"
          items={tiposMontaje}
          onCreate={async (nombre) => {
            const next = [...tiposMontaje, { id: `tm-${Date.now()}`, nombre, activo: 1 }];
            setTiposMontaje(next);
            await persistTiposMontaje(next);
          }}
          onDelete={async (id) => {
            const next = tiposMontaje.filter(t => t.id !== id);
            setTiposMontaje(next);
            await persistTiposMontaje(next);
          }}
          onEdit={async (id, data) => {
            const next = tiposMontaje.map(t => t.id === id ? { ...t, ...data } : t);
            setTiposMontaje(next);
            await persistTiposMontaje(next);
          }}
          onToggleActive={async (id, activo) => {
            const next = tiposMontaje.map(t => t.id === id ? { ...t, activo } : t);
            setTiposMontaje(next);
            await persistTiposMontaje(next);
          }}
        />
      )}

      {activeTab === 'orden' && (
        <div className="config-tab">
          <div className="config-tab-header">
            <div className="config-tab-title">
              <span className="config-tab-icon">🍽️</span>
              <span>Orden de Tiempos de Comida</span>
            </div>
          </div>
          <OrdenTiemposEditor inline />
        </div>
      )}

    </div>
  );
}
