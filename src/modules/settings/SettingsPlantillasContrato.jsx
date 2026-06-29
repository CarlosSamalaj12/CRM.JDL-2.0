import { useState, useEffect } from 'react';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';

const uid = () => `ctpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export default function SettingsPlantillasContrato({ inline }) {
  const [contractTemplates, setContractTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ id: '', name: '', filename: '', headerImage: '', footerImage: '' });

  const loadTemplates = async () => {
    try {
      const state = await loadCrmState();
      setContractTemplates(Array.isArray(state?.contractTemplates) ? state.contractTemplates : []);
      
      // Fetch available HTML files from public/templates/
      // Known template files - directory listing not available
      // setTemplatesDir(['Jardines.html', 'ServiHosp.html']);
    } catch (err) {
      console.error('Error loading contract templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const resetDraft = () => {
    setEditingId(null);
    setDraft({ id: '', name: '', filename: '', headerImage: '', footerImage: '' });
  };

  const startEdit = (tpl) => {
    setEditingId(tpl.id);
    setDraft({ id: tpl.id, name: tpl.name, filename: tpl.filename, headerImage: tpl.headerImage || '', footerImage: tpl.footerImage || '' });
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      alert('Escribe un nombre para la plantilla');
      return;
    }
    if (!draft.filename.trim()) {
      alert('Selecciona un archivo HTML');
      return;
    }

    try {
      const state = await loadCrmState();
      const baseState = (state && typeof state === 'object') ? state : {};
      const current = Array.isArray(baseState.contractTemplates) ? baseState.contractTemplates : [];
      
      let next;
      if (editingId) {
        next = current.map(t => String(t.id) === String(editingId)
          ? { ...t, name: draft.name.trim(), filename: draft.filename.trim(), headerImage: draft.headerImage || '', footerImage: draft.footerImage || '' }
          : t
        );
      } else {
        next = [...current, { id: uid(), name: draft.name.trim(), filename: draft.filename.trim(), headerImage: draft.headerImage || '', footerImage: draft.footerImage || '' }];
      }

      await saveCrmState({ ...baseState, contractTemplates: next });
      setContractTemplates(next);
      resetDraft();
    } catch (err) {
      console.error('Error saving contract template:', err);
      alert('Error al guardar la plantilla');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta plantilla de contrato?')) return;
    
    try {
      const state = await loadCrmState();
      const baseState = (state && typeof state === 'object') ? state : {};
      const current = Array.isArray(baseState.contractTemplates) ? baseState.contractTemplates : [];
      const next = current.filter(t => String(t.id) !== String(id));
      
      await saveCrmState({ ...baseState, contractTemplates: next });
      setContractTemplates(next);
      
      if (String(editingId) === String(id)) resetDraft();
    } catch (err) {
      console.error('Error deleting contract template:', err);
    }
  };

  const availableHtmlFiles = ['Jardines.html', 'ServiHosp.html'];
  const availableHeaders = ['Encabezadojdl.png', 'EncabezadoServ.jpg'];
  const availableFooters = ['piedepaginajdl.png'];

  if (loading) {
    return <div style={{ padding: 20, color: '#64748b' }}>Cargando...</div>;
  }

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Editor inline */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
          {editingId ? 'Editar plantilla de contrato' : 'Nueva plantilla de contrato'}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px', minWidth: 140 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.3px' }}>
              Nombre
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
              placeholder="Ej: Jardines (Corporativo)"
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 6,
                border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', color: '#0f172a', boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ flex: '1 1 160px', minWidth: 140 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.3px' }}>
              Archivo HTML
            </label>
            <select
              value={draft.filename}
              onChange={e => setDraft(p => ({ ...p, filename: e.target.value }))}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 6,
                border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', color: '#0f172a', boxSizing: 'border-box'
              }}
            >
              <option value="">— Seleccionar —</option>
              {availableHtmlFiles.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 160px', minWidth: 140 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.3px' }}>
              Encabezado
            </label>
            <select
              value={draft.headerImage}
              onChange={e => setDraft(p => ({ ...p, headerImage: e.target.value }))}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 6,
                border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', color: '#0f172a', boxSizing: 'border-box'
              }}
            >
              <option value="">— Usar el del HTML —</option>
              {availableHeaders.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 160px', minWidth: 140 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.3px' }}>
              Pie de página
            </label>
            <select
              value={draft.footerImage}
              onChange={e => setDraft(p => ({ ...p, footerImage: e.target.value }))}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 6,
                border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', color: '#0f172a', boxSizing: 'border-box'
              }}
            >
              <option value="">— Usar el del HTML —</option>
              {availableFooters.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: '7px 16px', fontSize: 11, fontWeight: 700, borderRadius: 6,
                border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer'
              }}
            >
              {editingId ? 'Guardar cambios' : 'Agregar'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetDraft}
                style={{
                  padding: '7px 16px', fontSize: 11, fontWeight: 700, borderRadius: 6,
                  border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista de plantillas */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 100px',
          background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
          fontSize: 10, fontWeight: 800, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: '.3px',
        }}>
          <span style={{ padding: '10px 14px' }}>Nombre</span>
          <span style={{ padding: '10px 14px' }}>Archivo</span>
          <span style={{ padding: '10px 14px' }}>Encabezado</span>
          <span style={{ padding: '10px 14px' }}>Pie</span>
          <span style={{ padding: '10px 14px' }}>Acciones</span>
        </div>
        {contractTemplates.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
            No hay plantillas de contrato configuradas. Agrega una nueva arriba.
          </div>
        ) : (
          contractTemplates.map(tpl => (
            <div key={tpl.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 100px',
              borderBottom: '1px solid #f1f5f9',
              fontSize: 12, color: '#334155',
              background: String(tpl.id) === String(editingId) ? '#f0fdf4' : '#fff',
            }}>
              <span style={{ padding: '10px 14px', fontWeight: 700 }}>{tpl.name || '—'}</span>
              <span style={{ padding: '10px 14px', color: '#64748b' }}>{tpl.filename || '—'}</span>
              <span style={{ padding: '10px 14px', color: '#64748b', fontSize: 11 }}>{tpl.headerImage || '—'}</span>
              <span style={{ padding: '10px 14px', color: '#64748b', fontSize: 11 }}>{tpl.footerImage || '—'}</span>
              <span style={{ padding: '6px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => startEdit(tpl)}
                  title="Editar"
                  style={{
                    width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', padding: 0,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(tpl.id)}
                  title="Eliminar"
                  style={{
                    width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 4, border: '1px solid #fee2e2', background: '#fef2f2', cursor: 'pointer', padding: 0,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="settings-section-card" style={{ overflow: 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>📄 Plantillas de Contrato</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Configura qué plantilla HTML se usa para cada tipo de contrato en la cotización.
          </div>
        </div>
      </div>
      {content}
    </div>
  );
}
