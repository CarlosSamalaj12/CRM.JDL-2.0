import React, { useState, useEffect } from 'react';
import { loadState as loadCrmState, invalidateStateCache } from '../../services/stateService';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';
import { useDataSync } from '../../hooks/useDataSync.js';
import { getEquipos, toggleUserActive, deleteUser } from '../../services/api.js';

const ROLE_LABELS = {
  admin: 'Administrador',
  recepcionista: 'Recepcionista',
  vendedor: 'Vendedor',
  eventos: 'Eventos',
  coordinador: 'Coordinador',
};

const ROLE_COLORS = {
  admin: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  recepcionista: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  vendedor: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  eventos: { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' },
  coordinador: { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
};

export default function SettingsUsers() {
  const [users, setUsers] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('name'); // 'name' | 'email' | 'phone' | 'team' | 'role' | 'active'
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'

  const fetchUsersAndTeams = async () => {
    setLoading(true);
    try {
      const [state, teamsData] = await Promise.all([
        loadCrmState(),
        getEquipos().catch(err => {
          console.warn('Error al cargar equipos en SettingsUsers:', err);
          return [];
        })
      ]);
      const fetchedUsers = Array.isArray(state?.users)
        ? state.users
        : (state?.users && typeof state.users === 'object' ? Object.values(state.users) : null);
      if (fetchedUsers) {
        setUsers(fetchedUsers);
      }
      if (Array.isArray(teamsData)) {
        setEquipos(teamsData);
      }
    } catch (e) {
      console.error('Error cargando usuarios o equipos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndTeams();

    const handleSync = () => {
      fetchUsersAndTeams();
    };

    window.addEventListener('usersUpdated', handleSync);
    return () => {
      window.removeEventListener('usersUpdated', handleSync);
    };
  }, []);

  useDataSync('usuario', () => fetchUsersAndTeams());
  useDataSync('equipo_trabajo', () => fetchUsersAndTeams());

  const toggleActive = async (userId) => {
    const targetUser = users.find(u => u.id === userId);
    const newActive = targetUser ? !targetUser.active : false;
    const updatedUsers = users.map(u => u.id === userId ? { ...u, active: newActive } : u);
    setUsers(updatedUsers);
    try {
      await toggleUserActive(userId);
      invalidateStateCache();
      window.dispatchEvent(new CustomEvent('usersUpdated'));
      toast.success('Estado actualizado correctamente.', { duration: 1500 });
    } catch (e) {
      setUsers(users);
      toast.error(e.message || 'No se pudo cambiar el estado del usuario.');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Eliminar usuario",
      text: `¿Estás seguro de eliminar permanentemente a "${userName}"?`,
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      background: "#f8fbff",
      color: "#10243b",
    });
    if (!result.isConfirmed) return;

    try {
      await deleteUser(userId);
      invalidateStateCache();
      const updatedUsers = users.filter(u => u.id !== userId);
      setUsers(updatedUsers);
      window.dispatchEvent(new CustomEvent('usersUpdated'));
      toast.success('Usuario eliminado permanentemente.', { duration: 2000 });
    } catch (e) {
      toast.error(e.message || 'Error al eliminar usuario');
    }
  };

  const avatarFor = (u) => u.avatarDataUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullName || u.name || '?')}&background=0ea5e9&color=fff&size=80`;

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const renderSortIndicator = (key) => {
    if (sortKey !== key) {
      return (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
        </svg>
      );
    }
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0284c7"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: sortDir === 'desc' ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s ease'
        }}
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    );
  };

  const safeEquipos = Array.isArray(equipos) ? equipos : [];
  const safeUsers = Array.isArray(users) ? users : [];

  const sortedUsers = [...safeUsers].sort((a, b) => {
    let result = 0;
    if (sortKey === 'name') {
      const nameA = (a.fullName || a.name || '').trim();
      const nameB = (b.fullName || b.name || '').trim();
      result = nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    } else if (sortKey === 'email') {
      const emailA = (a.email || '').trim();
      const emailB = (b.email || '').trim();
      result = emailA.localeCompare(emailB, 'es', { sensitivity: 'base' });
    } else if (sortKey === 'phone') {
      const phoneA = (a.phone || '').trim();
      const phoneB = (b.phone || '').trim();
      result = phoneA.localeCompare(phoneB, 'es', { sensitivity: 'base' });
    } else if (sortKey === 'team') {
      const teamA = safeEquipos.find(eq => eq.id === a.teamId)?.nombre || 'Z_Sin equipo';
      const teamB = safeEquipos.find(eq => eq.id === b.teamId)?.nombre || 'Z_Sin equipo';
      result = teamA.localeCompare(teamB, 'es', { sensitivity: 'base' });
    } else if (sortKey === 'role') {
      const roleA = ROLE_LABELS[a.role] || a.role || '';
      const roleB = ROLE_LABELS[b.role] || b.role || '';
      result = roleA.localeCompare(roleB, 'es', { sensitivity: 'base' });
    } else if (sortKey === 'active') {
      const actA = a.active !== false ? 1 : 0;
      const actB = b.active !== false ? 1 : 0;
      result = actB - actA;
    }
    // Desempate secundario por nombre alfabético
    if (result === 0) {
      const nameA = (a.fullName || a.name || '').trim();
      const nameB = (b.fullName || b.name || '').trim();
      result = nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    }
    return sortDir === 'asc' ? result : -result;
  });

  const filteredUsers = sortedUsers.filter(u => {
    const term = searchTerm.toLowerCase();
    const teamName = safeEquipos.find(eq => eq.id === u.teamId)?.nombre || 'Sin equipo';
    const roleLabel = ROLE_LABELS[u.role] || 'Vendedor';
    return (
      (u.fullName || u.name || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.phone || '').toLowerCase().includes(term) ||
      teamName.toLowerCase().includes(term) ||
      roleLabel.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ marginBottom: '32px' }}>
      <style>{`
        .usr-table { width: 100%; border-collapse: collapse; }
        .usr-table th { background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 14px; text-align: left; border-bottom: 2px solid #e2e8f0; }
        .usr-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .usr-table tr:last-child td { border-bottom: none; }
        .usr-table tr:hover td { background: #f8fafc; }
        .role-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1px solid; }
        .usr-icon-btn { background: none; border: none; cursor: pointer; padding: 6px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; transition: background 0.15s; }
        .usr-switch { position: relative; display: inline-block; width: 38px; height: 22px; }
        .usr-switch input { opacity: 0; width: 0; height: 0; }
        .usr-slider { position: absolute; cursor: pointer; inset: 0; background: #cbd5e1; border-radius: 22px; transition: 0.25s; }
        .usr-slider:before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.25s; }
        input:checked + .usr-slider { background: #10b981; }
        input:checked + .usr-slider:before { transform: translateX(16px); }
        .usr-hide-phone { }
        @media (max-width: 640px) { .usr-hide-phone { display: none; } }
        .usr-table { min-width: 600px; width: 100%; border-collapse: separate; border-spacing: 0; }
        .usr-table-wrapper { flex: 1; min-height: 0; overflow-y: auto; }
      `}</style>

      {/* Buscador + Acción */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '420px', display: 'flex', alignItems: 'center' }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: 'absolute', left: 12, pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="settings-search-bar-input"
            placeholder="Buscar por nombre, correo, equipo o rol..."
            value={searchTerm ?? ''}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px' }}
          />
        </div>

        <button
          id="btnSettingsAddUser"
          type="button"
          className="settings-primary-btn"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('openAddUser'));
          }}
          style={{ padding: '7px 16px', fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Nuevo Usuario</span>
        </button>
      </div>

      {/* Table */}
      <div className="usr-table-wrapper" style={{ flex: '1 1 auto', minHeight: 0, maxHeight: 'calc(100vh - 190px)', overflowY: 'auto', background: 'white', border: '1px solid #cbd5e1', borderRadius: '12px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Cargando usuarios...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No hay usuarios registrados aún.</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Sin resultados para "{searchTerm}"</div>
        ) : (
          <table className="usr-table">
            <thead>
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '2px solid #cbd5e1', cursor: 'pointer', userSelect: 'none' }}
                  title="Ordenar por nombre alfabéticamente"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>Usuario</span>
                    {renderSortIndicator('name')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('email')}
                  style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '2px solid #cbd5e1', cursor: 'pointer', userSelect: 'none' }}
                  title="Ordenar por correo"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>Correo</span>
                    {renderSortIndicator('email')}
                  </div>
                </th>
                <th
                  className="usr-hide-phone"
                  onClick={() => handleSort('phone')}
                  style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '2px solid #cbd5e1', cursor: 'pointer', userSelect: 'none' }}
                  title="Ordenar por teléfono"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>Teléfono</span>
                    {renderSortIndicator('phone')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('team')}
                  style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '2px solid #cbd5e1', cursor: 'pointer', userSelect: 'none' }}
                  title="Ordenar por equipo"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>Equipo</span>
                    {renderSortIndicator('team')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('role')}
                  style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '2px solid #cbd5e1', cursor: 'pointer', userSelect: 'none' }}
                  title="Ordenar por rol"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>Rol</span>
                    {renderSortIndicator('role')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('active')}
                  style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                  title="Ordenar por estado activo"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <span>Activo</span>
                    {renderSortIndicator('active')}
                  </div>
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => {
                const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.vendedor;
                const teamName = equipos.find(eq => eq.id === u.teamId)?.nombre || null;
                return (
                  <tr key={u.id}>
                    {/* Avatar + Name */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={avatarFor(u)} alt={u.fullName} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #e2e8f0' }} />
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>{u.fullName || u.name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{u.username || '—'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td>
                      <span style={{ fontSize: '13px', color: '#334155' }}>{u.email || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin correo</span>}</span>
                    </td>

                    {/* Phone */}
                    <td className="usr-hide-phone">
                      <span style={{ fontSize: '13px', color: '#334155' }}>{u.phone || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>}</span>
                    </td>

                    {/* Team */}
                    <td>
                      {teamName ? (
                        <span style={{ fontSize: '13px', color: '#4f46e5', fontWeight: '600' }}>
                          {teamName}
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Sin equipo</span>
                      )}
                    </td>

                    {/* Role */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span className="role-badge" style={{ background: roleStyle.bg, color: roleStyle.color, borderColor: roleStyle.border }}>
                          {ROLE_LABELS[u.role] || 'Vendedor'}
                        </span>
                        {u.canUseChecklist && (
                          <span
                            title="Tiene permiso para llenar y guardar Check Lists"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              fontSize: '10.5px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: '#ecfdf5',
                              color: '#065f46',
                              border: '1px solid #a7f3d0',
                              fontWeight: 700,
                            }}
                          >
                            ✓ CheckList
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Active toggle */}
                    <td style={{ textAlign: 'center' }}>
                      <label className="usr-switch" title={u.active !== false ? 'Activo - clic para desactivar' : 'Inactivo - clic para activar'}>
                        <input type="checkbox" checked={u.active !== false} onChange={() => toggleActive(u.id)} />
                        <span className="usr-slider"></span>
                      </label>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="usr-icon-btn"
                          title="Editar usuario"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('editUser', { detail: { userId: u.id } }));
                          }}
                          style={{ width: '32px', height: '32px', padding: 0, borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '17px', color: '#0ea5e9' }}>edit</span>
                        </button>
                        <button
                          type="button"
                          className="usr-icon-btn"
                          title="Eliminar usuario"
                          onClick={() => handleDeleteUser(u.id, u.fullName || u.name)}
                          style={{ width: '32px', height: '32px', padding: 0, borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '17px', color: '#ef4444' }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
