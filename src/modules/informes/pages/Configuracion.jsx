import { useEffect, useState } from 'react';
import {
  getEquipos, createEquipo, updateEquipo, deleteEquipo,
  getSillas, createSilla, updateSilla, deleteSilla,
  getMesas, createMesa, updateMesa, deleteMesa,
  getUsers, createUser, updateUser, toggleUserActive,
} from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { IconPlus, IconTrash, IconUser, IconSettings, IconSearch, IconX } from '../components/Icons.jsx';

const ROLES = ['Admin', 'Vendedor', 'Coordinador', 'FrontOffice'];

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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('equipos');
  const [equipos, setEquipos] = useState([]);
  const [sillas, setSillas] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // New user form
  const [newUser, setNewUser] = useState({ nombre: '', email: '', password: '', rol: 'Vendedor' });
  const [editingUser, setEditingUser] = useState(null);
  const [editUserData, setEditUserData] = useState({});

  const loadAll = async () => {
    setLoading(true);
    try {
      const [e, s, m, u] = await Promise.all([
        getEquipos(), getSillas(), getMesas(), getUsers()
      ]);
      setEquipos(e);
      setSillas(s);
      setMesas(m);
      setUsers(u);
    } catch (err) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

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

  // ─── Usuarios ───
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await createUser(newUser);
      setNewUser({ nombre: '', email: '', password: '', rol: 'Vendedor' });
      toast.success('Usuario creado');
      loadAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const startEditUser = (user) => {
    setEditingUser(user.id);
    setEditUserData({ nombre: user.nombre, email: user.email, rol: user.rol });
  };

  const saveEditUser = async () => {
    if (!editUserData.nombre?.trim()) return;
    try {
      await updateUser(editingUser, editUserData);
      setEditingUser(null);
      toast.success('Usuario actualizado');
      loadAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggleActive = async (id) => {
    try {
      await toggleUserActive(id);
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
  ];

  if (user?.rol === 'Admin') {
    tabs.push({ id: 'usuarios', label: 'Usuarios', icon: <IconUser size={15} />, count: users.length });
  }

  return (
    <div className="config-page">
      <div className="config-page-header">
        <div className="config-page-title">
          <IconSettings size={22} />
          <h1>Configuración</h1>
        </div>
        <p className="config-page-sub">Gestiona equipos, tipos de sillas, tipos de mesas y usuarios del sistema</p>
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
            <span className="config-tab-btn-count">{tab.count}</span>
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

      {activeTab === 'usuarios' && (
        <div className="config-tab">
          {/* ─── HEADER ─── */}
          <div className="config-tab-header">
            <div className="config-tab-title">
              <IconUser size={16} />
              <span>Usuarios</span>
              <span className="config-tab-count">{users.length}</span>
              {users.filter(u => !u.activo).length > 0 && (
                <span className="config-tab-inactive-count">
                  {users.filter(u => !u.activo).length} inactivo(s)
                </span>
              )}
            </div>
          </div>

          {/* ─── CREATE FORM ─── */}
          <form className="config-create-form config-create-form-users" onSubmit={handleCreateUser}>
            <div className="config-create-row">
              <div className="config-create-field">
                <label>Nombre</label>
                <input type="text" placeholder="Nombre completo" value={newUser.nombre}
                  onChange={e => setNewUser({...newUser, nombre: e.target.value})} required />
              </div>
              <div className="config-create-field">
                <label>Email</label>
                <input type="email" placeholder="correo@ejemplo.com" value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})} required />
              </div>
              <div className="config-create-field">
                <label>Contraseña</label>
                <input type="password" placeholder="••••••" value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})} required />
              </div>
              <div className="config-create-field">
                <label>Rol</label>
                <select value={newUser.rol} onChange={e => setNewUser({...newUser, rol: e.target.value})}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="config-create-field config-create-field-btn">
                <label>&nbsp;</label>
                <button type="submit" className="btn-primary btn-sm"><IconPlus size={14} /> Crear Usuario</button>
              </div>
            </div>
          </form>

          {/* ─── LIST ─── */}
          <div className="config-list">
            {users.length === 0 && <div className="config-empty">Sin usuarios aún — agrega uno arriba</div>}
            {users.map(u => {
              const isActive = u.activo !== 0;
              return (
                <div key={u.id} className={`config-item ${!isActive ? 'config-item-inactive' : ''}`}>
                  {editingUser === u.id ? (
                    <div className="config-item-edit config-item-edit-users">
                      <input type="text" value={editUserData.nombre}
                        onChange={e => setEditUserData({...editUserData, nombre: e.target.value})} />
                      <input type="email" value={editUserData.email}
                        onChange={e => setEditUserData({...editUserData, email: e.target.value})} />
                      <select value={editUserData.rol}
                        onChange={e => setEditUserData({...editUserData, rol: e.target.value})}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button className="btn-primary btn-sm" onClick={saveEditUser} data-tooltip="Guardar">✓</button>
                      <button className="btn-secondary btn-sm" onClick={() => setEditingUser(null)} data-tooltip="Cancelar">✕</button>
                    </div>
                  ) : (
                    <>
                      <div className="config-user-info">
                        <div className="config-user-avatar">{u.nombre.charAt(0).toUpperCase()}</div>
                        <div className="config-user-details">
                          <span className="config-item-name">{u.nombre}</span>
                          <span className="config-user-email">{u.email}</span>
                        </div>
                        <span className={`config-user-rol ${u.rol?.toLowerCase()}`}>{u.rol}</span>
                        {!isActive && <span className="config-item-badge config-badge-inactive">Inactivo</span>}
                      </div>
                      <div className="config-item-actions">
                        <button className="config-action-btn config-action-edit" onClick={() => startEditUser(u)}
                          data-tooltip="Editar">
                          ✏️
                        </button>
                        <button
                          className={`config-action-btn ${isActive ? 'config-action-disable' : 'config-action-enable'}`}
                          onClick={() => handleToggleActive(u.id)}
                          data-tooltip={isActive ? 'Inhabilitar' : 'Habilitar'}
                        >
                          {isActive ? '🔴' : '🟢'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
