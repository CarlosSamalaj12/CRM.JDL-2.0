import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getEquipos, createEquipo, updateEquipo, deleteEquipo } from '../../services/api.js';

export default function SettingsEquipos() {
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);

  const loadEquipos = useCallback(async () => {
    try {
      const data = await getEquipos();
      setEquipos(data);
    } catch {
      toast.error('Error al cargar equipos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEquipos(); }, [loadEquipos]);

  useEffect(() => {
    const handler = () => loadEquipos();
    window.addEventListener('usersUpdated', handler);
    return () => window.removeEventListener('usersUpdated', handler);
  }, [loadEquipos]);

  const openNew = () => {
    setEditId(null);
    setNombre('');
    setDescripcion('');
    setShowForm(true);
  };

  const openEdit = (eq) => {
    setEditId(eq.id);
    setNombre(eq.nombre);
    setDescripcion(eq.descripcion || '');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        await updateEquipo(editId, { nombre: nombre.trim(), descripcion: descripcion.trim() });
        toast('Equipo actualizado ✓');
      } else {
        await createEquipo({ nombre: nombre.trim(), descripcion: descripcion.trim() });
        toast('Equipo creado ✓');
      }
      setShowForm(false);
      setEditId(null);
      setNombre('');
      setDescripcion('');
      await loadEquipos();
    } catch {
      toast.error('Error al guardar equipo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eq) => {
    if (!confirm(`¿Eliminar el equipo "${eq.nombre}"? Los usuarios quedarán sin equipo.`)) return;
    try {
      await deleteEquipo(eq.id);
      toast('Equipo eliminado');
      await loadEquipos();
    } catch {
      toast.error('Error al eliminar equipo');
    }
  };

  return (
    <div className="settings-equipos">
      <style>{`
        .settings-equipos { padding: 0; }
        .settings-equipos-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
        .settings-equipos-header h4 { margin: 0; font-size: 14px; color: #0f172a; }
        .equipos-grid { display: flex; flex-direction: column; gap: 6px; max-height: 300px; overflow-y: auto; }
        .equipo-card { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; transition: all 0.15s; }
        .equipo-card:hover { border-color: #cbd5e1; }
        .equipo-info { flex: 1; min-width: 0; }
        .equipo-nombre { font-size: 13px; font-weight: 600; color: #0f172a; }
        .equipo-desc { font-size: 11px; color: #64748b; margin-top: 2px; }
        .equipo-miembros { font-size: 11px; color: #6366f1; font-weight: 600; white-space: nowrap; flex-shrink: 0; background: #eef2ff; padding: 2px 8px; border-radius: 999px; }
        .equipo-actions { display: flex; gap: 4px; flex-shrink: 0; }
        .equipo-actions .settings-usr-icon-btn { width: 30px; height: 30px; padding: 0; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; transition: all 0.12s; display: flex; align-items: center; justify-content: center; color: #94a3b8; }
        .equipo-actions .settings-usr-icon-btn:hover { background: #f1f5f9; }
        .equipo-actions .btn-edit-usuario:hover { color: #6366f1; border-color: #6366f1; background: #eef2ff; }
        .equipo-actions .btn-delete-usuario:hover { color: #ef4444; border-color: #ef4444; background: #fef2f2; }
        .equipo-form { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
        .equipo-form-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .equipo-form-row input { flex: 1 1 180px; height: 36px; padding: 0 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; outline: none; background: #ffffff !important; color: #0f172a !important; box-sizing: border-box; }
        .equipo-form-row input:focus { border-color: #6366f1; background: #ffffff !important; }
        .equipo-form-row textarea { flex: 1 1 200px; min-height: 36px; padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; outline: none; background: #ffffff !important; color: #0f172a !important; resize: vertical; font-family: inherit; box-sizing: border-box; }
        .equipo-form-row textarea:focus { border-color: #6366f1; background: #ffffff !important; }
        .settings-equipos select { background: #ffffff !important; color: #0f172a !important; }
        .equipo-form-actions { display: flex; gap: 6px; margin-top: 8px; }
        .equipo-form-actions button { height: 32px; padding: 0 14px; border-radius: 6px; border: none; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.12s; }
        .btn-save { background: #6366f1; color: #fff; }
        .btn-save:hover { background: #4f46e5; }
        .btn-cancel { background: #fff; color: #64748b; border: 1px solid #e2e8f0 !important; }
        .btn-cancel:hover { background: #f1f5f9; }
        .equipos-empty { padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; }
        /* Mobile responsive for equipos */
        @media (max-width: 640px) {
          .equipo-card { flex-wrap: wrap; gap: 8px; padding: 10px 12px; }
          .equipo-card .equipo-info { flex: 1 1 100%; order: -1; }
          .equipo-card .equipo-miembros { order: 0; }
          .equipo-card .equipo-actions { order: 1; width: 100%; justify-content: flex-end; }
          .equipo-actions .settings-usr-icon-btn { width: 36px; height: 36px; }
          .equipo-form-row { flex-direction: column; gap: 6px; }
          .equipo-form-row input,
          .equipo-form-row textarea { flex: 1 1 auto; width: 100%; }
          .equipo-form-actions { flex-direction: column; gap: 4px; }
          .equipo-form-actions button { width: 100%; height: 38px; }
        }
      `}</style>

      <div className="settings-equipos-header">
        <h4>Equipos de Trabajo</h4>
        <button onClick={openNew} style={{ height: '32px', padding: '0 14px', borderRadius: '6px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
          + Nuevo Equipo
        </button>
      </div>

      {showForm && (
        <form className="equipo-form" onSubmit={handleSave}>
          <div className="equipo-form-row">
            <input
              type="text" placeholder="Nombre del equipo" value={nombre}
              onChange={e => setNombre(e.target.value)} required autoFocus
            />
            <textarea
              placeholder="Descripción (opcional)" value={descripcion}
              onChange={e => setDescripcion(e.target.value)} rows={2}
            />
          </div>
          <div className="equipo-form-actions">
            <button type="submit" className="btn-save" disabled={saving || !nombre.trim()}>
              {saving ? '...' : editId ? 'Guardar' : 'Crear'}
            </button>
            <button type="button" className="btn-cancel" onClick={() => { setShowForm(false); setEditId(null); setNombre(''); setDescripcion(''); }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="equipos-empty">Cargando equipos...</div>
      ) : equipos.length === 0 ? (
        <div className="equipos-empty">Sin equipos de trabajo aún. Crea el primer equipo.</div>
      ) : (
        <div className="equipos-grid">
          {equipos.map(eq => (
            <div key={eq.id} className="equipo-card">
              <div className="equipo-info">
                <div className="equipo-nombre">{eq.nombre}</div>
                {eq.descripcion && <div className="equipo-desc">{eq.descripcion}</div>}
              </div>
              <span className="equipo-miembros">{eq.miembros || 0} miembro{(eq.miembros || 0) !== 1 ? 's' : ''}</span>
              <div className="equipo-actions">
                <button className="settings-usr-icon-btn btn-edit-usuario" onClick={() => openEdit(eq)} title="Editar equipo">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    <path d="m15 5 4 4"/>
                  </svg>
                </button>
                <button className="settings-usr-icon-btn btn-delete-usuario" onClick={() => handleDelete(eq)} title="Eliminar equipo">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
