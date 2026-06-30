import React, { useState, useEffect } from 'react';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';
import { useDataSync } from '../../hooks/useDataSync.js';

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
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const state = await loadCrmState();
      setUsers(state?.users || []);
    } catch (e) {
      console.error('Error cargando usuarios:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    const handleSync = () => {
      fetchUsers();
    };

    window.addEventListener('usersUpdated', handleSync);
    return () => {
      window.removeEventListener('usersUpdated', handleSync);
    };
  }, []);

  useDataSync('usuario', () => fetchUsers());

  const saveState = async (updatedUsers) => {
    const currentState = await loadCrmState();
    await saveCrmState({ ...currentState, users: updatedUsers });
  };

  const toggleActive = async (userId) => {
    const updatedUsers = users.map(u => u.id === userId ? { ...u, active: !u.active } : u);
    try {
      await saveState(updatedUsers);
      setUsers(updatedUsers);
      window.dispatchEvent(new CustomEvent('usersUpdated'));
      toast.success('Estado actualizado correctamente.', { duration: 1500 });
    } catch (e) {
      toast.error(e.message);
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
      const currentState = await loadCrmState();
      const currentUsers = currentState.users || [];
      const updatedUsers = currentUsers.filter(u => u.id !== userId);
      await saveCrmState({ ...currentState, users: updatedUsers });
      setUsers(updatedUsers);
      window.dispatchEvent(new CustomEvent('usersUpdated'));
      toast.success('Usuario eliminado permanentemente.', { duration: 2000 });
    } catch (e) {
      toast.error(e.message || 'Error al eliminar usuario');
    }
  };

  const avatarFor = (u) => u.avatarDataUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullName || u.name || '?')}&background=0ea5e9&color=fff&size=80`;

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
        .usr-icon-btn:hover { background: #f1f5f9; }
        .usr-switch { position: relative; display: inline-block; width: 38px; height: 22px; }
        .usr-switch input { opacity: 0; width: 0; height: 0; }
        .usr-slider { position: absolute; cursor: pointer; inset: 0; background: #cbd5e1; border-radius: 22px; transition: 0.25s; }
        .usr-slider:before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.25s; }
        input:checked + .usr-slider { background: #10b981; }
        input:checked + .usr-slider:before { transform: translateX(16px); }
        @media (max-width: 640px) { .usr-hide-phone { display: none; } }
        .usr-table { min-width: 600px; }
        .usr-table-wrapper { max-height: 400px; overflow-y: auto; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>👥 Gestión de Usuarios</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Administra cuentas, roles y acceso al sistema</div>
        </div>
        <button
          id="btnSettingsAddUser"
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('openAddUser'));
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#0b1c30', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
          Nuevo usuario
        </button>
      </div>

      {/* Table */}
      <div className="usr-table-wrapper" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Cargando usuarios...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No hay usuarios registrados aún.</div>
        ) : (
          <table className="usr-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th className="usr-hide-phone">Teléfono</th>
                <th>Rol</th>
                <th style={{ textAlign: 'center' }}>Activo</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.vendedor;
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

                    {/* Role */}
                    <td>
                      <span className="role-badge" style={{ background: roleStyle.bg, color: roleStyle.color, borderColor: roleStyle.border }}>
                        {ROLE_LABELS[u.role] || 'Vendedor'}
                      </span>
                    </td>

                    {/* Active toggle */}
                    <td style={{ textAlign: 'center' }}>
                      <label className="usr-switch" title={u.active !== false ? 'Activo - clic para desactivar' : 'Inactivo - clic para activar'}>
                        <input type="checkbox" checked={u.active !== false} onChange={() => toggleActive(u.id)} />
                        <span className="usr-slider"></span>
                      </label>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="usr-icon-btn"
                        title="Editar usuario"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('editUser', { detail: { userId: u.id } }));
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#0ea5e9' }}>edit</span>
                      </button>
                      <button
                        type="button"
                        className="usr-icon-btn"
                        title="Eliminar usuario"
                        style={{ marginLeft: '4px' }}
                        onClick={() => handleDeleteUser(u.id, u.fullName || u.name)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ef4444' }}>delete</span>
                      </button>
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
