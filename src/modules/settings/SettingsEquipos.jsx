import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { getEquipos, createEquipo, updateEquipo, deleteEquipo } from '../../services/api.js';
import { useDataSync } from '../../hooks/useDataSync.js';

export default function SettingsEquipos() {
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadEquipos = useCallback(async () => {
    try {
      const data = await getEquipos();
      setEquipos(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Error al cargar equipos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEquipos(); }, [loadEquipos]);

  useDataSync('equipo_trabajo', () => loadEquipos());

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
    const nombreTrim = nombre.trim();
    if (!nombreTrim) return;
    if (equipos.some(eq => eq.id !== editId && eq.nombre.toLowerCase() === nombreTrim.toLowerCase())) {
      toast.error(`Ya existe un equipo llamado "${nombreTrim}"`);
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await updateEquipo(editId, { nombre: nombreTrim, descripcion: descripcion.trim() });
        toast('Equipo actualizado ✓');
      } else {
        await createEquipo({ nombre: nombreTrim, descripcion: descripcion.trim() });
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

  const filteredEquipos = useMemo(() => {
    if (!searchTerm.trim()) return equipos;
    const q = searchTerm.toLowerCase().trim();
    return equipos.filter(eq =>
      (eq.nombre || '').toLowerCase().includes(q) ||
      (eq.descripcion || '').toLowerCase().includes(q)
    );
  }, [equipos, searchTerm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '10px', width: '100%' }}>
      <style>{`
        .equipo-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; transition: all 0.15s; }
        .equipo-card:hover { border-color: #6366f1; background: #f8fafc; }
        .equipo-info { flex: 1; min-width: 0; }
        .equipo-nombre { font-size: 13.5px; font-weight: 700; color: #0f172a; }
        .equipo-desc { font-size: 11.5px; color: #64748b; margin-top: 2px; }
        .equipo-miembros { font-size: 11px; color: #0284c7; font-weight: 700; white-space: nowrap; flex-shrink: 0; background: #e0f2fe; padding: 3px 10px; border-radius: 9999px; }
        .equipo-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .equipo-actions .settings-usr-icon-btn { width: 32px; height: 32px; padding: 0; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; transition: all 0.12s; display: flex; align-items: center; justify-content: center; color: #64748b; }
        .equipo-actions .btn-edit-usuario:hover { color: #2563eb; border-color: #2563eb; background: #eff6ff; }
        .equipo-actions .btn-delete-usuario:hover { color: #ef4444; border-color: #ef4444; background: #fef2f2; }
        .equipo-form { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; margin-bottom: 10px; }
        .equipo-form-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .equipo-form-row input { flex: 1 1 200px; height: 38px; padding: 0 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; outline: none; background: #ffffff !important; color: #0f172a !important; box-sizing: border-box; }
        .equipo-form-row input:focus { border-color: #2563eb; }
        .equipo-form-row textarea { flex: 1 1 240px; min-height: 38px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; outline: none; background: #ffffff !important; color: #0f172a !important; resize: vertical; font-family: inherit; box-sizing: border-box; }
        .equipo-form-row textarea:focus { border-color: #2563eb; }
        .equipo-form-actions { display: flex; gap: 8px; margin-top: 10px; }
        .equipos-empty { padding: 40px; text-align: center; color: #94a3b8; font-size: 13px; }
      `}</style>

      {/* Buscador y Acción */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '420px' }}>
          <input
            type="text"
            className="settings-search-bar-input"
            placeholder="🔍 Buscar por nombre de equipo o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="settings-primary-btn"
          onClick={openNew}
          style={{ padding: '7px 16px', fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span>➕ Nuevo Equipo</span>
        </button>
      </div>

      {/* Formulario Crear / Editar */}
      {showForm && (
        <form className="equipo-form" onSubmit={handleSave}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
            {editId ? '✏️ Editar Equipo' : '➕ Nuevo Equipo de Trabajo'}
          </div>
          <div className="equipo-form-row">
            <input
              type="text" placeholder="Nombre del equipo (ej: Bodega y Contabilidad)" value={nombre}
              onChange={e => setNombre(e.target.value)} required autoFocus
            />
            <textarea
              placeholder="Descripción (opcional)" value={descripcion}
              onChange={e => setDescripcion(e.target.value)} rows={2}
            />
          </div>
          <div className="equipo-form-actions">
            <button type="submit" className="settings-primary-btn" disabled={saving || !nombre.trim()} style={{ padding: '6px 16px', fontSize: '12px' }}>
              {saving ? 'Guardando...' : editId ? '💾 Guardar Cambios' : '✓ Crear Equipo'}
            </button>
            <button type="button" className="settings-secondary-btn" onClick={() => { setShowForm(false); setEditId(null); setNombre(''); setDescripcion(''); }} style={{ padding: '6px 14px', fontSize: '12px' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de Equipos con Scroll Interno */}
      <div style={{ flex: '1 1 auto', minHeight: 0, maxHeight: 'calc(100vh - 190px)', overflowY: 'auto', background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '12px' }}>
        {loading ? (
          <div className="equipos-empty">Cargando equipos...</div>
        ) : filteredEquipos.length === 0 ? (
          <div className="equipos-empty">
            {searchTerm ? `Sin equipos coincidentes con "${searchTerm}"` : 'Sin equipos de trabajo aún. Registra el primero arriba.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredEquipos.map(eq => (
              <div key={eq.id} className="equipo-card">
                <div className="equipo-info">
                  <div className="equipo-nombre">{eq.nombre}</div>
                  {eq.descripcion && <div className="equipo-desc">{eq.descripcion}</div>}
                </div>
                <span className="equipo-miembros">👥 {eq.miembros || 0} miembro{(eq.miembros || 0) !== 1 ? 's' : ''}</span>
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
    </div>
  );
}
