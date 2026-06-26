import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function SettingsFormasPago() {
  const [items, setItems] = useState([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const load = async () => {
    try {
      const r = await fetch(`${API_URL}/api/config/formas-pago`, { headers: authHeaders() });
      if (r.ok) setItems(await r.json());
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await fetch(`${API_URL}/api/config/formas-pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ nombre: newName.trim() }),
      });
      setNewName('');
      load();
    } catch {}
  };

  const handleUpdate = async (id, data) => {
    try {
      await fetch(`${API_URL}/api/config/formas-pago/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data),
      });
      load();
    } catch {}
  };

  const handleDelete = async (id, nombre) => {
    if (!confirm(`¿Eliminar "${nombre}" permanentemente?`)) return;
    try {
      await fetch(`${API_URL}/api/config/formas-pago/${id}`, { method: 'DELETE', headers: authHeaders() });
      load();
    } catch {}
  };

  const toggleActive = (id, activo) => handleUpdate(id, { activo });

  return (
    <div>
      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
        Administra las formas de pago disponibles en el sistema. Estas aparecerán en los combos de cotización y anticipos.
      </div>

      <form className="fp-create-form" onSubmit={handleCreate} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text" placeholder="Nueva forma de pago..." value={newName}
          onChange={e => setNewName(e.target.value)}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #d1d9e6',
            fontSize: '0.83rem', outline: 'none', fontFamily: 'inherit'
          }}
        />
        <button type="submit" style={{
          padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#2563eb',
          color: '#fff', fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer'
        }}>
          + Agregar
        </button>
      </form>

      <div className="fp-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px', fontSize: '0.85rem' }}>
            Sin formas de pago aún — agrega una arriba
          </div>
        )}
        {items.map(item => {
          const isActive = item.activo !== 0;
          return (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0',
              background: isActive ? '#fff' : '#f8fafc', opacity: isActive ? 1 : 0.6
            }}>
              {editingId === item.id ? (
                <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                  <input
                    type="text" value={editName} autoFocus
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { handleUpdate(item.id, { nombre: editName.trim() }); setEditingId(null); } if (e.key === 'Escape') setEditingId(null); }}
                    style={{
                      flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1.5px solid #2563eb',
                      fontSize: '0.83rem', outline: 'none', fontFamily: 'inherit'
                    }}
                  />
                  <button onClick={() => { handleUpdate(item.id, { nombre: editName.trim() }); setEditingId(null); }} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>✓</button>
                  <button onClick={() => setEditingId(null)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d9e6', background: '#fff', cursor: 'pointer' }}>✕</button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>{item.nombre}</span>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                      background: isActive ? '#f0fdf4' : '#fef2f2',
                      color: isActive ? '#16a34a' : '#dc2626'
                    }}>
                      {isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => { setEditingId(item.id); setEditName(item.nombre); }}
                      style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.75rem' }}>
                      ✏️
                    </button>
                    <button onClick={() => toggleActive(item.id, isActive ? 0 : 1)}
                      style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.75rem' }}>
                      {isActive ? '🔴' : '🟢'}
                    </button>
                    <button onClick={() => handleDelete(item.id, item.nombre)}
                      style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', color: '#dc2626' }}>
                      🗑️
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
