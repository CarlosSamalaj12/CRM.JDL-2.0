import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';
import { toast, modernConfirm } from '../../utils/toast';
import { APP_EVENT_OPEN_EVENT_CHECKLIST } from '../../utils/appEvents';
import authService from '../../services/authService';

const XIcon = () => (
  <svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M4 4l10 10M14 4l-10 10" />
  </svg>
);

const SECTION_TYPE_OPTIONS = [
  { value: 'operativa', label: '⚙️ Operativa', desc: 'Pendiente / Cumplido' },
  { value: 'evaluacion', label: '⭐ Evaluación', desc: 'Malo / Regular / Bueno / Excelente' },
];

const RATING_LEVELS = [
  { value: 'malo', label: 'Malo', emoji: '🔴', score: 1 },
  { value: 'regular', label: 'Regular', emoji: '🟡', score: 2 },
  { value: 'bueno', label: 'Bueno', emoji: '🟢', score: 3 },
  { value: 'excelente', label: 'Excelente', emoji: '💎', score: 4 },
];

/* ══════════════════════════════════════════════
   EDITOR INLINE DE PLANTILLAS (mismo estilo que los demás settings)
   ══════════════════════════════════════════════ */
export function ChecklistTemplateEditor() {
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selTplId, setSelTplId] = useState('');
  const [tplName, setTplName] = useState('');
  const [tplActive, setTplActive] = useState(true);
  const [secName, setSecName] = useState('');
  const [secType, setSecType] = useState('operativa');
  const [editSecId, setEditSecId] = useState('');
  const [pointTextBySec, setPointTextBySec] = useState({});
  const [dragOverSecId, setDragOverSecId] = useState(null);
  const [dragOverItemKey, setDragOverItemKey] = useState(null);
  const dragSecIdx = useRef(null);
  const dragItemKey = useRef(null);

  const selTpl = templates.find(t => t.id === Number(selTplId)) || null;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const state = await loadCrmState();
      setTemplates(Array.isArray(state.checklistTemplates) ? state.checklistTemplates : []);
    } catch (err) { console.error(err); toast('Error al cargar plantillas'); }
  };

  const persist = async (updated) => {
    const state = await loadCrmState();
    await saveCrmState({ ...state, checklistTemplates: updated });
    window.dispatchEvent(new Event('stateUpdated'));
  };

  const getPointText = (secId) => pointTextBySec[secId] || '';

  const selectTemplate = (id) => {
    setSelTplId(id);
    setPointTextBySec({});
    setSecName(''); setEditSecId(''); setSecType('operativa');
    if (id) {
      const tpl = templates.find(t => t.id === Number(id));
      if (tpl) { setTplName(tpl.name); setTplActive(tpl.active !== false); }
    } else {
      setTplName(''); setTplActive(true);
    }
  };

  /* ─── GUARDAR PLANTILLA ─── */
  const handleSaveTpl = async () => {
    if (!tplName.trim()) { toast('Escribe un nombre para la plantilla'); return; }
    const nameTrimmed = tplName.trim();
    const tplExists = selTplId
      ? templates.some(t => t.name.trim().toLowerCase() === nameTrimmed.toLowerCase() && t.id !== Number(selTplId))
      : templates.some(t => t.name.trim().toLowerCase() === nameTrimmed.toLowerCase());
    if (tplExists) { toast('Ya existe una plantilla con ese nombre'); return; }
    setSaving(true);
    try {
      let updated;
      if (!selTplId) {
        const nt = { id: Date.now(), name: tplName.trim(), active: tplActive, sections: [] };
        updated = [...templates, nt];
        setSelTplId(String(nt.id));
      } else {
        updated = templates.map(t => t.id === Number(selTplId) ? { ...t, name: tplName.trim(), active: tplActive } : t);
      }
      await persist(updated);
      setTemplates(updated);
      toast(selTplId ? 'Plantilla guardada ✓' : 'Plantilla creada ✓');
    } catch (err) { console.error(err); toast('Error al guardar'); }
    finally { setSaving(false); }
  };

  /* ─── INHABILITAR ─── */
  const handleDisable = async () => {
    if (!selTpl) return;
    const ok = await modernConfirm({ title: 'Inhabilitar', message: `¿Inhabilitar "${selTpl.name}"?`, confirmText: 'Inhabilitar', cancelText: 'Cancelar' });
    if (!ok) return;
    const updated = templates.map(t => t.id === selTpl.id ? { ...t, active: false } : t);
    await persist(updated); setTemplates(updated); setTplActive(false);
    toast('Plantilla inhabilitada');
  };

  const handleDeleteTpl = async () => {
    if (!selTpl) return;
    const ok = await modernConfirm({ title: 'Eliminar plantilla', message: `¿Eliminar "${selTpl.name}" y todas sus secciones?`, confirmText: 'Eliminar', cancelText: 'Cancelar' });
    if (!ok) return;
    const updated = templates.filter(t => t.id !== selTpl.id);
    await persist(updated); setTemplates(updated);
    setSelTplId(''); setTplName(''); setTplActive(true);
    toast('Plantilla eliminada');
  };

  /* ─── SECCIÓN CRUD ─── */
  const handleSaveSection = () => {
    const name = secName.trim();
    if (!name) { toast('Escribe un nombre para la sección'); return; }
    if (!selTpl) { toast('Primero selecciona o crea una plantilla'); return; }
    const secExists = selTpl.sections.some(s =>
      s.name.trim().toLowerCase() === name.toLowerCase() &&
      String(s.id) !== String(editSecId)
    );
    if (secExists) { toast('Ya existe una seccion con ese nombre en esta plantilla'); return; }
    let updated;
    if (editSecId) {
      updated = templates.map(t => t.id !== selTpl.id ? t : {
        ...t, sections: t.sections.map(s => s.id === Number(editSecId) ? { ...s, name } : s)
      });
    } else {
      updated = templates.map(t => t.id !== selTpl.id ? t : {
        ...t, sections: [...t.sections, { id: Date.now(), name, type: secType, items: [] }]
      });
    }
    setTemplates(updated);
    setSecName(''); setEditSecId(''); setSecType('operativa');
    persist(updated);
    toast(editSecId ? 'Sección actualizada' : 'Sección agregada');
  };

  const handleDeleteSection = async (sid) => {
    const ok = await modernConfirm({ title: 'Eliminar sección', message: '¿Eliminar esta sección y todos sus puntos?', confirmText: 'Eliminar', cancelText: 'Cancelar' });
    if (!ok) return;
    const updated = templates.map(t => t.id !== selTpl.id ? t : { ...t, sections: t.sections.filter(s => s.id !== sid) });
    setTemplates(updated);
    persist(updated);
    if (String(sid) === editSecId) { setSecName(''); setEditSecId(''); }
    toast('Sección eliminada');
  };

  /* ─── PUNTO CRUD ─── */
  const handleAddPoint = (secId) => {
    const text = getPointText(secId).trim();
    if (!text) { toast('Escribe el texto del punto'); return; }
    if (!selTpl) { toast('Selecciona una plantilla'); return; }
    const updated = templates.map(t => {
      if (t.id !== selTpl.id) return t;
      return { ...t, sections: t.sections.map(s => {
        if (s.id !== secId) return s;
        return { ...s, items: [...s.items, { id: Date.now(), text, order: s.items.length + 1 }] };
      }) };
    });
    setTemplates(updated);
    persist(updated);
    setPointTextBySec(prev => ({ ...prev, [secId]: '' }));
    toast('Punto agregado');
  };

  const handleDeletePoint = async (secId, itemId) => {
    const ok = await modernConfirm({ title: 'Eliminar punto', message: '¿Eliminar este punto?', confirmText: 'Eliminar', cancelText: 'Cancelar' });
    if (!ok) return;
    const updated = templates.map(t => {
      if (t.id !== selTpl.id) return t;
      return { ...t, sections: t.sections.map(s => {
        if (s.id !== secId) return s;
        const filtered = s.items.filter(i => i.id !== itemId);
        return { ...s, items: filtered.map((i, idx) => ({ ...i, order: idx + 1 })) };
      }) };
    });
    setTemplates(updated);
    persist(updated);
    toast('Punto eliminado');
  };

  const showEditor = !!(selTpl);

  return (
    <div>
      {/* ── Row: Select + Actions ── */}
      <div className="settings-field-group">
        <label className="settings-modern-field">
          <span>Plantilla existente</span>
          <select value={selTplId} onChange={e => selectTemplate(e.target.value)}>
            <option value="">-- Crear nueva plantilla --</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} {t.active !== false ? '' : '(inactiva)'}</option>
            ))}
          </select>
        </label>
        <label className="settings-modern-field">
          <span>Estado</span>
          <label className="settings-switch-inline" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={tplActive} onChange={e => setTplActive(e.target.checked)} />
            <span>{tplActive ? 'Plantilla activa' : 'Plantilla inactiva'}</span>
          </label>
        </label>
      </div>

      {/* ── Row: Nombre + Acciones ── */}
      <div className="settings-field-group" style={{ marginBottom: '14px' }}>
        <label className="settings-modern-field">
          <span>O escribe el nombre de la plantilla</span>
          <input type="text" value={tplName} onChange={e => setTplName(e.target.value)}
            placeholder="Ej: Check List Salón de Eventos" />
        </label>
        <div className="settings-modern-field">
          <span>&nbsp;</span>
          <div style={{ display: 'flex', gap: '6px', height: '40px', alignItems: 'center' }}>
            <button className="settings-primary-btn" type="button" onClick={handleSaveTpl}
              disabled={saving || !tplName.trim()}>
              {saving ? 'Guardando...' : (selTplId ? '💾 Guardar plantilla' : '✓ Crear plantilla')}
            </button>
            {selTpl && (
              <>
                <button className="settings-danger-btn" type="button" onClick={handleDisable}>
                  Inhabilitar
                </button>
                <button className="settings-danger-btn" type="button" onClick={handleDeleteTpl}
                  style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#dc2626' }}>
                  Eliminar
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Editor de secciones y puntos ── */}
      {!showEditor ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic', border: '1px dashed #e2e8f0', borderRadius: '10px', background: '#f8fafc' }}>
          📋 Selecciona una plantilla existente o escribe el nombre y presiona "Crear plantilla" para empezar.
        </div>
      ) : (
        <>
          {/* Agregar sección */}
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
              {editSecId ? '✎ Editar sección' : '➕ Agregar sección'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" value={secName} onChange={e => setSecName(e.target.value)}
                placeholder="Ej: Salón, Cocina, Baños, Jardín..."
                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #d1d9e6', fontSize: '0.82rem', color: '#0f172a', outline: 'none', background: '#fff', fontFamily: 'inherit' }}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveSection(); }} />
              {!editSecId && (
                <div style={{ display: 'flex', gap: '3px', background: '#e2e8f0', borderRadius: '6px', padding: '2px', flexShrink: 0, alignSelf: 'center' }}>
                  {SECTION_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSecType(opt.value)}
                      title={opt.desc}
                      style={{
                        padding: '6px 10px', borderRadius: '5px', border: 'none',
                        fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                        background: secType === opt.value ? '#fff' : 'transparent',
                        color: secType === opt.value ? '#0f172a' : '#94a3b8',
                        boxShadow: secType === opt.value ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.12s', whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              <button className={editSecId ? 'settings-cancel-btn' : 'settings-accent-btn'} type="button" onClick={handleSaveSection}>
                {editSecId ? 'Actualizar' : '+ Sección'}
              </button>
              {editSecId && (
                <button className="settings-cancel-btn" type="button" onClick={() => { setSecName(''); setEditSecId(''); setSecType('operativa'); }}>
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {/* Lista de secciones con sus puntos */}
          {selTpl.sections.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', fontStyle: 'italic', border: '1px dashed #e2e8f0', borderRadius: '10px', background: '#fff' }}>
              Sin secciones aún. Escribe el nombre de la primera área y presiona "+ Sección".
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selTpl.sections.map((sec, secIdx) => (
                <div
                  key={sec.id}
                  onDragOver={e => {
                    e.preventDefault();
                    setDragOverSecId(sec.id);
                  }}
                  onDragLeave={() => setDragOverSecId(null)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOverSecId(null);
                    const fromIdx = dragSecIdx.current;
                    if (fromIdx === null || fromIdx === secIdx) return;
                    const reordered = [...selTpl.sections];
                    const [moved] = reordered.splice(fromIdx, 1);
                    reordered.splice(secIdx, 0, moved);
                    const updated = templates.map(t => t.id !== selTpl.id ? t : { ...t, sections: reordered });
                    setTemplates(updated);
                    persist(updated);
                    dragSecIdx.current = null;
                  }}
                  style={{
                    border: dragOverSecId === sec.id
                      ? '2px dashed #6366f1'
                      : (editSecId === String(sec.id) ? '2px solid #6366f1' : '1px solid #e2e8f0'),
                    borderRadius: '10px', overflow: 'hidden', background: '#fff',
                    transition: 'border 0.15s ease',
                  }}>
                  {/* Header sección */}
                  <div
                    draggable
                    onDragStart={e => {
                      dragSecIdx.current = secIdx;
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', '');
                    }}
                    onDragEnd={() => { dragSecIdx.current = null; setDragOverSecId(null); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', cursor: 'grab', userSelect: 'none' }}
                  >
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem', cursor: 'grab', lineHeight: 1, flexShrink: 0 }}>⠿</span>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a', flex: 1 }}>
                      {sec.type === 'evaluacion' ? '📊' : '📂'} {sec.name}
                    </span>
                    {/* Toggle tipo de sección */}
                    <div style={{ display: 'flex', gap: '3px', background: '#e2e8f0', borderRadius: '6px', padding: '2px', flexShrink: 0 }}>
                      {SECTION_TYPE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            const updated = templates.map(t =>
                              t.id !== selTpl.id ? t : {
                                ...t,
                                sections: t.sections.map(s =>
                                  s.id !== sec.id ? s : { ...s, type: opt.value }
                                ),
                              }
                            );
                            setTemplates(updated);
                            persist(updated);
                            toast(`Sección cambiada a "${opt.label}"`);
                          }}
                          title={opt.desc}
                          style={{
                            padding: '2px 6px', borderRadius: '5px', border: 'none',
                            fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer',
                            background: (sec.type || 'operativa') === opt.value ? '#fff' : 'transparent',
                            color: (sec.type || 'operativa') === opt.value ? '#0f172a' : '#94a3b8',
                            boxShadow: (sec.type || 'operativa') === opt.value ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all 0.12s', whiteSpace: 'nowrap',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 800, color: '#fff',
                      background: sec.items.length > 0 ? '#6366f1' : '#cbd5e1',
                      padding: '2px 10px', borderRadius: '999px',
                    }}>
                      {sec.items.length} punto{sec.items.length !== 1 ? 's' : ''}
                    </span>
                    <button type="button" onClick={() => { setEditSecId(String(sec.id)); setSecName(sec.name); }}
                      className="settings-usr-icon-btn" style={{ color: '#6366f1' }}>✎</button>
                    <button type="button" onClick={() => handleDeleteSection(sec.id)}
                      className="settings-usr-icon-btn" style={{ color: '#dc2626' }}>✕</button>
                  </div>

                  {/* Items */}
                  <div style={{ padding: '8px 12px' }}>
                    {sec.items.length === 0 ? (
                      <div style={{ fontSize: '0.73rem', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>Sin puntos. Escribe abajo y presiona + Punto.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '8px' }}>
                        {sec.items.map((item, idx) => {
                          const itemKey = `${sec.id}_${item.id}`;
                          return (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={e => {
                                dragItemKey.current = itemKey;
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', '');
                              }}
                              onDragEnd={() => { dragItemKey.current = null; setDragOverItemKey(null); }}
                              onDragOver={e => {
                                e.preventDefault();
                                setDragOverItemKey(itemKey);
                              }}
                              onDragLeave={() => setDragOverItemKey(null)}
                              onDrop={e => {
                                e.preventDefault();
                                setDragOverItemKey(null);
                                const fromKey = dragItemKey.current;
                                if (!fromKey || fromKey === itemKey) return;
                                const [fromSecId, fromItemId] = fromKey.split('_').map(Number);
                                const toIdx = idx;
                                const updated = templates.map(t => {
                                  if (t.id !== selTpl.id) return t;
                                  return {
                                    ...t,
                                    sections: t.sections.map(s => {
                                      if (s.id !== sec.id) return s;
                                      // Only reorder if same section
                                      if (s.id !== fromSecId) return s;
                                      const items = [...s.items];
                                      const fromPos = items.findIndex(i => i.id === fromItemId);
                                      if (fromPos === -1) return s;
                                      const [moved] = items.splice(fromPos, 1);
                                      items.splice(toIdx, 0, moved);
                                      return { ...s, items: items.map((i, pos) => ({ ...i, order: pos + 1 })) };
                                    }),
                                  };
                                });
                                setTemplates(updated);
                                persist(updated);
                                dragItemKey.current = null;
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '6px',
                                background: dragOverItemKey === itemKey ? '#eef2ff' : '#f8fafd',
                                border: dragOverItemKey === itemKey ? '1.5px dashed #6366f1' : '1px solid #f1f5f9',
                                cursor: 'grab', transition: 'background 0.12s, border 0.12s',
                              }}
                            >
                              <span style={{ color: '#94a3b8', fontSize: '0.7rem', cursor: 'grab', lineHeight: 1, flexShrink: 0 }}>⠿</span>
                              <span style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #d1d9e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>{idx + 1}</span>
                              <span style={{ flex: 1, fontSize: '0.82rem', color: '#0f172a' }}>{item.text}</span>
                              <button type="button" onClick={() => handleDeletePoint(sec.id, item.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.75rem', padding: '2px 4px', borderRadius: '4px' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>✕</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Agregar punto */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input type="text"
                        value={getPointText(sec.id)}
                        onChange={e => setPointTextBySec(prev => ({ ...prev, [sec.id]: e.target.value }))}
                        placeholder="Escribe el punto a evaluar..."
                        style={{ flex: 1, padding: '6px 10px', borderRadius: '7px', border: '1.5px solid #d1d9e6', fontSize: '0.78rem', color: '#0f172a', outline: 'none', background: '#fff', fontFamily: 'inherit' }}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddPoint(sec.id); }} />
                      <button type="button" onClick={() => handleAddPoint(sec.id)}
                        disabled={!getPointText(sec.id).trim()}
                        style={{
                          padding: '6px 12px', borderRadius: '7px', border: 'none',
                          background: getPointText(sec.id).trim() ? '#6366f1' : '#e2e8f0',
                          color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                          cursor: getPointText(sec.id).trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
                        }}>
                        + Punto
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   COMPONENTE PRINCIPAL — solo mantiene el Modal
   del Event Checklist (abierto desde el calendario)
   ══════════════════════════════════════════════ */
function normalizeRole(role) {
  const raw = String(role || '').trim().toLowerCase();
  if (raw === 'admin') return 'Admin';
  if (raw === 'frontoffice' || raw === 'front_office' || raw === 'recepcionista') return 'FrontOffice';
  if (raw === 'vendedor' || raw === 'sales') return 'Vendedor';
  if (raw === 'coordinador') return 'Coordinador';
  if (raw === 'eventos') return 'Eventos';
  return role || '';
}

function buildHistoryEntry(user) {
  return {
    userId: user?.id || '',
    userName: user?.fullName || user?.name || user?.username || 'Desconocido',
    userRole: normalizeRole(user?.role),
    timestamp: new Date().toISOString(),
    action: 'edit',
  };
}

function HistoryBadge({ history }) {
  if (!history || history.length === 0) return null;
  const last = history[history.length - 1];
  const d = new Date(last.timestamp);
  const dateStr = d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 500, marginLeft: '8px' }}>
      {'\u00daltima edici\u00f3n: '}{last.userName} ({dateStr})
    </span>
  );
}

const TAB_OPERATIVA = 'operativa';
const TAB_EVALUACION = 'evaluacion';

export default function SettingsChecklist() {
  const [isOpen, setIsOpen] = useState(false);
  const styleElRef = useRef(null);

  // Inyectar/remover estilos del modal directamente en <head>
  useEffect(() => {
    if (isOpen) {
      // Prevenir scroll del body
      document.body.style.overflow = 'hidden';
      // Crear el elemento <style> si no existe
      if (!styleElRef.current) {
        const el = document.createElement('style');
        el.id = 'checklist-modal-styles';
        el.textContent = `
          #eventChecklistBackdrop {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            height: 100dvh !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 999999 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: rgba(15,23,42,0.55) !important;
            overflow: hidden !important;
          }
          #eventChecklistBackdrop > [role="dialog"] {
            width: min(94vw, 880px) !important;
            height: min(92vh, 880px) !important;
            height: min(92dvh, 880px) !important;
            max-width: 100vw !important;
            max-height: 100dvh !important;
            margin: 0 auto !important;
          }
          #eventChecklistBackdrop .checklist-mobile-rating { display: none !important; }
          #eventChecklistBackdrop .checklist-desktop-rating { display: flex !important; }
          @media (max-width: 900px) {
            #eventChecklistBackdrop .checklist-mobile-rating { display: block !important; }
            #eventChecklistBackdrop .checklist-desktop-rating { display: none !important; }
            #eventChecklistBackdrop > [role="dialog"] {
              width: 100vw !important;
              height: 100dvh !important;
              height: 100vh !important;
              max-width: 100vw !important;
              max-height: 100dvh !important;
              border-radius: 0 !important;
              border: none !important;
              box-shadow: none !important;
            }
            #eventChecklistBackdrop .checklist-tab-desc { display: none !important; }
            #eventChecklistBackdrop .checklist-body {
              padding: 10px 12px !important;
              padding-bottom: 24px !important;
            }
            #eventChecklistBackdrop .checklist-footer {
              padding: 10px 12px !important;
              flex-direction: column !important;
              gap: 8px !important;
            }
            #eventChecklistBackdrop .checklist-footer-buttons {
              width: 100% !important;
              justify-content: space-between !important;
            }
            #eventChecklistBackdrop .checklist-footer-buttons button,
            #eventChecklistBackdrop .btn-exit {
              min-height: 44px !important;
              font-size: 0.9rem !important;
            }
            #eventChecklistBackdrop .checklist-table {
              font-size: 0.72rem !important;
              display: block !important;
              overflow-x: auto !important;
            }
            #eventChecklistBackdrop .checklist-table th,
            #eventChecklistBackdrop .checklist-table td {
              padding: 8px 6px !important;
              white-space: normal !important;
            }
            #eventChecklistBackdrop .checklist-table select {
              width: 100% !important;
              font-size: 0.72rem !important;
              min-height: 44px !important;
            }
            #eventChecklistBackdrop .checklist-table-wrapper {
              border: none !important;
              border-radius: 0 !important;
            }
            #eventChecklistBackdrop .checklist-progress-container {
              border: none !important;
              border-radius: 0 !important;
              background: transparent !important;
              padding: 8px 0 !important;
            }
            #eventChecklistBackdrop .checklist-grid select,
            #eventChecklistBackdrop .checklist-grid input,
            #eventChecklistBackdrop .checklist-table select,
            #eventChecklistBackdrop .checklist-table input,
            #eventChecklistBackdrop textarea {
              font-size: 16px !important;
              min-height: 48px !important;
            }
          }
        `;
        document.head.appendChild(el);
        styleElRef.current = el;
      }
    } else {
      document.body.style.overflow = '';
      if (styleElRef.current) {
        document.head.removeChild(styleElRef.current);
        styleElRef.current = null;
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);


  const [templates, setTemplates] = useState([]);
  const [savingOp, setSavingOp] = useState(false);
  const [savingEv, setSavingEv] = useState(false);
  const [evtId, setEvtId] = useState(null);
  const [evtData, setEvtData] = useState(null);
  const [activeTab, setActiveTab] = useState(TAB_OPERATIVA);
  const [currentUser, setCurrentUser] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // Operativa checklist
  const [opTplId, setOpTplId] = useState('');
  const [opNotes, setOpNotes] = useState('');
  const [opItems, setOpItems] = useState([]);
  const [opHistory, setOpHistory] = useState([]);

  // Evaluacion checklist
  const [evTplId, setEvTplId] = useState('');
  const [evNotes, setEvNotes] = useState('');
  const [evItems, setEvItems] = useState([]);
  const [evHistory, setEvHistory] = useState([]);

  const isReadOnly = currentUser?.rol === 'Coordinador';

  const s = {
    label: { fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: '4px' },
    input: { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #d1d9e6', background: '#ffffff', color: '#0f172a', fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
    select: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #d1d9e6', background: '#ffffff', color: '#0f172a', fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit', minHeight: '44px', WebkitAppearance: 'menulist', appearance: 'menulist' },
  };

  useEffect(() => {
    const handler = async (e) => {
      const id = e?.detail?.eventId;
      if (!id) return;
      try {
        const user = authService.getCurrentUser();
        setCurrentUser(user ? { ...user, rol: normalizeRole(user.role) } : null);

        const state = await loadCrmState();
        setTemplates(Array.isArray(state.checklistTemplates) ? state.checklistTemplates : []);
        const events = Array.isArray(state.events) ? state.events : [];
        const checklists = (state.eventChecklists && typeof state.eventChecklists === 'object') ? state.eventChecklists : {};
        const eventFound = events.find(x => x.id === id);
        setEvtId(id);
        setEvtData(eventFound || null);

        let raw = checklists[id] || eventFound?.checklist;
        // Migrate old format (single checklist with mixed items) to new format (operativa/evaluacion)
        if (raw && !raw[TAB_OPERATIVA] && !raw[TAB_EVALUACION] && Array.isArray(raw.items)) {
          const opItems = raw.items.filter(i => i.sectionType !== TAB_EVALUACION);
          const evItems = raw.items.filter(i => i.sectionType === TAB_EVALUACION);
          raw = {
            [TAB_OPERATIVA]: { templateId: raw.templateId, notes: raw.notes, items: opItems, history: [] },
            [TAB_EVALUACION]: { templateId: null, notes: '', items: evItems, history: [] },
          };
          // Persist migration immediately
          await saveCrmState({ ...state, eventChecklists: { ...checklists, [id]: raw } });
        }

        const tpls = Array.isArray(state.checklistTemplates) ? state.checklistTemplates : [];
        const op = raw?.[TAB_OPERATIVA] || {};
        const evTabData = raw?.[TAB_EVALUACION] || {};
        const opTpl = String(op.templateId || '');
        const evTpl = String(evTabData.templateId || '');
        setOpTplId(opTpl);
        setOpNotes(op.notes || '');
        setOpItems(op.items || []);
        setOpHistory(op.history || []);
        setEvTplId(evTpl);
        setEvNotes(evTabData.notes || '');
        setEvItems(evTabData.items || []);
        setEvHistory(evTabData.history || []);
        if (!opTpl && !op.items?.length && tpls.length > 0) {
          const first = tpls[0];
          setOpTplId(String(first.id));
          const items = first.sections.flatMap(s =>
            (s.items || []).map(item => ({
              id: item.id, text: item.text, sectionName: s.name,
              sectionType: s.type || TAB_OPERATIVA,
              status: 'pendiente', rating: null, comment: ''
            }))
          );
          setOpItems(items);
        }
        if (!evTpl && !evTabData.items?.length && tpls.length > 0) {
          const first = tpls[0];
          setEvTplId(String(first.id));
          const items = first.sections.flatMap(s =>
            (s.items || []).map(item => ({
              id: item.id, text: item.text, sectionName: s.name,
              sectionType: s.type || TAB_OPERATIVA,
              status: 'pendiente', rating: null, comment: ''
            }))
          );
          setEvItems(items);
        }
        setActiveTab(TAB_OPERATIVA);

        setIsOpen(true);
      } catch (err) { console.error(err); toast('Error al abrir checklist'); }
    };
    window.addEventListener(APP_EVENT_OPEN_EVENT_CHECKLIST, handler);
    return () => window.removeEventListener(APP_EVENT_OPEN_EVENT_CHECKLIST, handler);
  }, []);

  const closeEvent = () => { setIsOpen(false); };

  const handleTpl = (tab) => (e) => {
    const tid = e.target.value;
    const prevId = tab === TAB_OPERATIVA ? opTplId : evTplId;
    const currentItems = tab === TAB_OPERATIVA ? opItems : evItems;
    if (currentItems.length > 0 && tid !== prevId && !window.confirm('¿Cambiar plantilla? Los items actuales se reemplazarán.')) {
      if (tab === TAB_OPERATIVA) setOpTplId(prevId);
      else setEvTplId(prevId);
      return;
    }
    if (tab === TAB_OPERATIVA) setOpTplId(tid);
    else setEvTplId(tid);
    if (!tid) {
      if (tab === TAB_OPERATIVA) setOpItems([]);
      else setEvItems([]);
      return;
    }
    const tpl = templates.find(t => t.id === Number(tid));
    if (!tpl) return;
    const items = tpl.sections.flatMap(s =>
      (s.items || []).map(item => ({
        id: item.id, text: item.text, sectionName: s.name,
        sectionType: s.type || TAB_OPERATIVA,
        status: 'pendiente',
        rating: null,
        comment: ''
      }))
    );
    if (tab === TAB_OPERATIVA) setOpItems(items);
    else setEvItems(items);
  };

  const setRating = (tab) => (id, rating) => {
    const fn = tab === TAB_OPERATIVA ? setOpItems : setEvItems;
    fn(prev => prev.map(i => i.id === id ? { ...i, rating } : i));
  };

  const setSt = (tab) => (id, status) => {
    const fn = tab === TAB_OPERATIVA ? setOpItems : setEvItems;
    fn(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const setCm = (tab) => (id, comment) => {
    const fn = tab === TAB_OPERATIVA ? setOpItems : setEvItems;
    fn(prev => prev.map(i => i.id === id ? { ...i, comment } : i));
  };

  const handleSave = (tab) => async () => {
    if (!evtId) { toast('No hay evento'); return; }
    const setSaving = tab === TAB_OPERATIVA ? setSavingOp : setSavingEv;
    setSaving(true);
    try {
      const state = await loadCrmState();
      const cur = (state.eventChecklists && typeof state.eventChecklists === 'object') ? state.eventChecklists : {};
      const existing = cur[evtId] || {};
      const entry = buildHistoryEntry(currentUser);
      const tabData = tab === TAB_OPERATIVA
        ? { templateId: opTplId ? Number(opTplId) : null, notes: opNotes, items: opItems, history: [...opHistory, entry] }
        : { templateId: evTplId ? Number(evTplId) : null, notes: evNotes, items: evItems, history: [...evHistory, entry] };
      await saveCrmState({
        ...state,
        eventChecklists: { ...cur, [evtId]: { ...existing, [tab]: tabData } }
      });
      if (tab === TAB_OPERATIVA) setOpHistory(prev => [...prev, entry]);
      else setEvHistory(prev => [...prev, entry]);
      toast(`Check list ${tab === TAB_OPERATIVA ? 'Operativa' : 'Evaluación'} guardado ✓`);
      window.dispatchEvent(new Event('stateUpdated'));
      closeEvent();
    } catch (err) { console.error(err); toast('Error al guardar'); }
    finally { setSaving(false); }
  };


  // Computed for active tab
  const activeItems = activeTab === TAB_OPERATIVA ? opItems : evItems;
  const activeTplId = activeTab === TAB_OPERATIVA ? opTplId : evTplId;
  const activeNotes = activeTab === TAB_OPERATIVA ? opNotes : evNotes;
  const activeHistory = activeTab === TAB_OPERATIVA ? opHistory : evHistory;
  const activeSaving = activeTab === TAB_OPERATIVA ? savingOp : savingEv;

  const total = activeItems.length;
  const done = activeItems.filter(i => i.status === 'cumplido').length;
  const progress = total > 0 ? Math.round(((done + activeItems.filter(i => i.status === 'en_proceso' || i.status === 'no_aplica').length) / total) * 100) : 0;
  const sat = (total - activeItems.filter(i => i.status === 'no_aplica').length) > 0
    ? Math.round((done / (total - activeItems.filter(i => i.status === 'no_aplica').length)) * 100) : 0;

  const evalItems = activeItems;
  const ratedItems = evalItems.filter(i => i.rating !== null);
  const satisfactionAvg = ratedItems.length > 0
    ? (ratedItems.reduce((sum, i) => sum + (RATING_LEVELS.find(r => r.value === i.rating)?.score || 0), 0) / ratedItems.length)
    : 0;
  const satisfactionPct = Math.round((satisfactionAvg / 4) * 100);

  const modalContent = (
    <>


      <div
        id="eventChecklistBackdrop"
        onClick={e => { if (e.target.id === 'eventChecklistBackdrop') closeEvent(); }}
        style={{
          display: isOpen ? 'flex' : 'none',
        }}
      >
        <div role="dialog" style={{
          width: 'min(94vw, 880px)',
          height: 'min(92vh, 880px)',
          display: 'flex', flexDirection: 'column',
          background: '#ffffff', border: '1px solid #e2e8f0',
          borderRadius: '12px', boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 3001,
        }}>
          {/* Header */}
          <div className="checklist-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
            <div>
              <div className="checklist-header-title" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                Check List — Evento
                {isReadOnly && <span style={{ marginLeft: '8px', fontSize: '0.65rem', fontWeight: 600, color: '#f59e0b', background: '#fffbeb', padding: '2px 8px', borderRadius: '999px' }}>Solo lectura</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>
                {evtData ? `${evtData.eventName || evtData.client || evtData.name || ''} — ${evtData.date || evtData.eventDate || ''}` : ''}
              </div>
            </div>
            <button className="btn-exit" type="button" onClick={closeEvent}><XIcon /></button>
          </div>

          {/* Tab bar */}
          <div className="checklist-tab-bar" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafd', flexShrink: 0 }}>
            {[
              { key: TAB_OPERATIVA, label: 'Operativa', icon: '\u2699\uFE0F', desc: 'Pendiente / Cumplido', color: '#6366f1' },
              { key: TAB_EVALUACION, label: 'Evaluaci\u00f3n', icon: '\u2B50', desc: 'Malo / Regular / Bueno / Excelente', color: '#7c3aed' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                className="checklist-tab"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
                  background: activeTab === tab.key ? '#ffffff' : 'transparent',
                  color: activeTab === tab.key ? tab.color : '#94a3b8',
                  borderBottom: activeTab === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
                  transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className="checklist-tab-desc" style={{ fontSize: '0.6rem', fontWeight: 600, color: '#94a3b8', marginLeft: '2px' }}>{tab.desc}</span>
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="checklist-body" style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', minHeight: '0px', overflowY: 'auto', overflowX: 'visible', overscrollBehavior: 'contain', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafd' }}>
            {/* Template selector + event info */}
            {/* Template selector */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={s.label}>Plantilla</span>
              <select value={activeTplId} onChange={handleTpl(activeTab)} style={s.select} disabled={isReadOnly}>
                <option value="">-- Seleccionar --</option>
                {templates.filter(t => t.active !== false).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <span style={s.label}>Notas / Sugerencias</span>
              <textarea value={activeNotes} onChange={e => {
                const val = e.target.value;
                if (activeTab === TAB_OPERATIVA) setOpNotes(val);
                else setEvNotes(val);
              }}
                rows={2} placeholder="Observaciones generales..."
                style={{ ...s.input, resize: 'vertical', minHeight: '50px' }}
                readOnly={isReadOnly} />
            </div>


            {/* Bloque Avance — solo en pestaña Operativa */}
            {activeTab === TAB_OPERATIVA && (
              <div className="checklist-progress-container" style={{ padding: '10px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700 }}>
                  <span>Avance <span style={{ color: '#6366f1' }}>{progress}%</span></span>
                  <span>Operativo <span style={{ color: '#10b981' }}>{sat}%</span></span>
                </div>
                <div style={{ height: '8px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg,#6366f1,#10b981)', width: `${progress}%`, transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.72rem', color: '#94a3b8' }}>
                  <span>{'✅'} {done} cumplido(s)</span>
                  <span>{'🔄'} {activeItems.filter(i => i.status === 'en_proceso').length} en proceso</span>
                  <span>{'⏳'} {activeItems.filter(i => i.status === 'pendiente').length} pendiente(s)</span>
                  <span>{'🚫'} {activeItems.filter(i => i.status === 'no_aplica').length} no aplica</span>
                </div>
              </div>
            )}

            {/* Barra de Satisfacción del Cliente — solo en pestaña Evaluación */}
            {activeTab === TAB_EVALUACION && evalItems.length > 0 && (
              <div className="checklist-progress-container" style={{ padding: '10px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700 }}>
                  <span>⭐ Satisfacción del Cliente</span>
                  <span style={{
                    color: satisfactionAvg >= 3.5 ? '#16a34a' : satisfactionAvg >= 2.5 ? '#d97706' : '#dc2626',
                    fontSize: '0.9rem',
                  }}>
                    {ratedItems.length > 0 ? `${satisfactionAvg.toFixed(1)} / 4.0 (${satisfactionPct}%)` : '—'}
                  </span>
                </div>
                <div style={{ height: '10px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '999px',
                    background: satisfactionAvg >= 3.5 ? '#22c55e' : satisfactionAvg >= 2.5 ? '#eab308' : '#ef4444',
                    width: ratedItems.length > 0 ? `${satisfactionPct}%` : '0%',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.72rem', color: '#94a3b8' }}>
                  <span>💎 Excelente: {evalItems.filter(i => i.rating === 'excelente').length}</span>
                  <span>🟢 Bueno: {evalItems.filter(i => i.rating === 'bueno').length}</span>
                  <span>🟡 Regular: {evalItems.filter(i => i.rating === 'regular').length}</span>
                  <span>🔴 Malo: {evalItems.filter(i => i.rating === 'malo').length}</span>
                  <span>⚪ Sin calificar: {evalItems.filter(i => i.rating === null).length}</span>
                </div>
              </div>
            )}


            {/* History toggle */}
            {activeHistory.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#6366f1', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {showHistory ? '\u25BC' : '\u25B6'} Historial de ediciones ({activeHistory.length})
                </button>
                {showHistory && (
                  <div style={{ marginTop: '6px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#ffffff', padding: '8px 12px', maxHeight: '150px', overflowY: 'auto' }}>
                    {activeHistory.map((h, i) => {
                      const d = new Date(h.timestamp);
                      const dateStr = d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < activeHistory.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: '0.73rem' }}>
                          <span style={{ color: '#0f172a', fontWeight: 600 }}>{h.userName}</span>
                          <span style={{ color: '#94a3b8' }}>{h.userRole} — {dateStr}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Items table */}
            <div className="checklist-table-wrapper" style={{
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              overflowY: 'auto',
              background: '#ffffff',
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: '0%',
              minHeight: '150px'
            }}>
              {activeItems.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  Selecciona una plantilla para cargar los puntos a evaluar
                </div>
              ) : (
                <table className="checklist-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', width: '36px' }}>#</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Punto</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', width: '210px' }}>
                        {activeTab === TAB_EVALUACION ? 'Calificaci\u00f3n' : 'Estado'}
                      </th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', width: '180px' }}>Comentario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeItems.map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: activeTab === TAB_EVALUACION ? '#faf5ff' : 'transparent' }}>
                        <td style={{ padding: '6px 10px', color: '#94a3b8', fontWeight: 600, fontSize: '0.72rem' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ color: '#6366f1', fontSize: '0.7rem', fontWeight: 600 }}>
                            {item.sectionName ? `[${item.sectionName}] ` : ''}
                            {activeTab === TAB_EVALUACION && <span style={{ color: '#7c3aed', fontWeight: 700 }}>{'\u2B50'} </span>}
                          </span>
                          <span style={{ color: '#0f172a', fontWeight: 500 }}>{item.text}</span>
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          {activeTab === TAB_EVALUACION ? (
                            <>
                              {/* Mobile Rating Dropdown */}
                              <div className="checklist-mobile-rating">
                                {(() => {
                                  const ratingColors = {
                                    malo: { border: '#ef4444', bg: '#fef2f2', text: '#dc2626' },
                                    regular: { border: '#eab308', bg: '#fffbeb', text: '#ca8a04' },
                                    bueno: { border: '#22c55e', bg: '#f0fdf4', text: '#16a34a' },
                                    excelente: { border: '#a855f7', bg: '#faf5ff', text: '#9333ea' },
                                  };
                                  const curColor = ratingColors[item.rating] || { border: '#d1d9e6', bg: '#ffffff', text: '#64748b' };
                                  return (
                                    <select
                                      value={item.rating || ''}
                                      onChange={e => !isReadOnly && setRating(activeTab)(item.id, e.target.value || null)}
                                      disabled={isReadOnly}
                                      style={{
                                        padding: '4px 8px', borderRadius: '6px',
                                        border: `1.5px solid ${curColor.border}`,
                                        fontSize: '0.75rem', fontWeight: 600,
                                        cursor: isReadOnly ? 'default' : 'pointer',
                                        background: curColor.bg, color: curColor.text,
                                        opacity: isReadOnly ? 0.75 : 1, width: '100%'
                                      }}
                                    >
                                      <option value="">-- Calificar --</option>
                                      {RATING_LEVELS.map(r => (
                                        <option key={r.value} value={r.value}>{r.emoji} {r.label}</option>
                                      ))}
                                    </select>
                                  );
                                })()}
                              </div>

                              {/* Desktop Rating Buttons */}
                              <div className="checklist-desktop-rating checklist-rating-buttons" style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                                {RATING_LEVELS.map(r => {
                                  const isSelected = item.rating === r.value;
                                  return (
                                    <button
                                      key={r.value}
                                      type="button"
                                      className="checklist-rating-btn"
                                      onClick={() => !isReadOnly && setRating(activeTab)(item.id, isSelected ? null : r.value)}
                                      title={r.label}
                                      disabled={isReadOnly}
                                      style={{
                                        padding: '4px 7px', borderRadius: '6px',
                                        border: isSelected ? `2px solid ${r.value === 'malo' ? '#ef4444' : r.value === 'regular' ? '#eab308' : r.value === 'bueno' ? '#22c55e' : '#a855f7'}` : '1.5px solid #e2e8f0',
                                        background: isSelected ? (r.value === 'malo' ? '#fef2f2' : r.value === 'regular' ? '#fffbeb' : r.value === 'bueno' ? '#f0fdf4' : '#faf5ff') : '#fff',
                                        fontSize: '0.7rem', fontWeight: 700,
                                        cursor: isReadOnly ? 'default' : 'pointer',
                                        opacity: isReadOnly ? 0.85 : (item.rating && !isSelected ? 0.5 : 1),
                                        color: isSelected ? (r.value === 'malo' ? '#dc2626' : r.value === 'regular' ? '#ca8a04' : r.value === 'bueno' ? '#16a34a' : '#9333ea') : '#94a3b8',
                                        filter: isReadOnly && !isSelected ? 'grayscale(0.8)' : 'none',
                                      }}
                                    >
                                      {r.emoji} {r.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          ) : (
                            <select value={item.status} onChange={e => !isReadOnly && setSt(activeTab)(item.id, e.target.value)}
                              disabled={isReadOnly}
                              style={{ padding: '4px 8px', borderRadius: '6px', border: '1.5px solid #d1d9e6', fontSize: '0.75rem', fontWeight: 600, cursor: isReadOnly ? 'default' : 'pointer', background: item.status === 'cumplido' ? '#f0fdf4' : item.status === 'en_proceso' ? '#fffbeb' : item.status === 'no_aplica' ? '#f0f9ff' : '#ffffff', color: item.status === 'cumplido' ? '#16a34a' : item.status === 'en_proceso' ? '#d97706' : item.status === 'no_aplica' ? '#0ea5e9' : '#64748b', opacity: isReadOnly ? 0.75 : 1, appearance: isReadOnly ? 'none' : 'auto' }}>
                              <option value="pendiente">Pendiente</option>
                              <option value="en_proceso">En proceso</option>
                              <option value="cumplido">Cumplido</option>
                              <option value="no_aplica">No aplica</option>
                            </select>
                          )}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input type="text" value={item.comment} onChange={e => !isReadOnly && setCm(activeTab)(item.id, e.target.value)}
                            placeholder="..." readOnly={isReadOnly}
                            style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1.5px solid #e2e8f0', fontSize: '0.75rem', outline: 'none', background: isReadOnly ? '#f8fafc' : '#ffffff', color: '#0f172a', boxSizing: 'border-box' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="checklist-footer" style={{ flexShrink: 0, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {activeTab === TAB_OPERATIVA ? '\u2699\uFE0F Check List Operativa' : '\u2B50 Check List Evaluaci\u00f3n'}
              <HistoryBadge history={activeHistory} />
            </div>
            <div className="checklist-footer-buttons" style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-exit" type="button" onClick={closeEvent}>Cerrar</button>
              {!isReadOnly && (
                <button type="button" onClick={handleSave(activeTab)} disabled={activeSaving}
                  style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#10b981', color: '#fff', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer', opacity: activeSaving ? 0.6 : 1 }}>
                  {activeSaving ? 'Guardando...' : `Guardar ${activeTab === TAB_OPERATIVA ? 'Operativa' : 'Evaluaci\u00f3n'}`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
