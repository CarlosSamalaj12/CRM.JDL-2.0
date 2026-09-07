import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';
import { toast, modernConfirm } from '../../utils/toast';
import { APP_EVENT_OPEN_EVENT_CHECKLIST } from '../../utils/appEvents';
import { isEventSeriesInPast } from '../../utils/eventSeriesInPast';
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
  { value: 'malo', label: 'Malo', score: 2.5, dot: '#dc2626' },
  { value: 'regular', label: 'Regular', score: 5, dot: '#d97706' },
  { value: 'bueno', label: 'Bueno', score: 7.5, dot: '#16a34a' },
  { value: 'excelente', label: 'Excelente', score: 10, dot: '#7c3aed' },
  { value: 'no_aplica', label: 'N/A', score: 0, dot: '#94a3b8' },
];

// PIN de Admin para autorizar re-edición de la Evaluación después de guardada.
const EVALUATION_UNLOCK_PIN = '20273131';

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
  const [pointTypeBySec, setPointTypeBySec] = useState({});
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
  const handleAddPoint = (secId, secType) => {
    const text = getPointText(secId).trim();
    if (!text) { toast('Escribe el texto del punto'); return; }
    if (!selTpl) { toast('Selecciona una plantilla'); return; }
    const type = secType === 'evaluacion' ? (pointTypeBySec[secId] || 'calificable') : undefined;
    const updated = templates.map(t => {
      if (t.id !== selTpl.id) return t;
      return { ...t, sections: t.sections.map(s => {
        if (s.id !== secId) return s;
        const newItem = { id: Date.now(), text, order: s.items.length + 1 };
        if (type) newItem.type = type;
        return { ...s, items: [...s.items, newItem] };
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
                              <span style={{ flex: 1, fontSize: '0.82rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {item.text}
                                {sec.type === 'evaluacion' && (
                                  <span style={{
                                    fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '999px',
                                    background: item.type === 'libre' ? '#ede9fe' : '#f0fdf4',
                                    color: item.type === 'libre' ? '#7c3aed' : '#16a34a',
                                    border: item.type === 'libre' ? '1px solid #c4b5fd' : '1px solid #86efac',
                                    flexShrink: 0
                                  }}>
                                    {item.type === 'libre' ? '📝 Libre' : '⭐ Calificable'}
                                  </span>
                                )}
                              </span>
                              <button type="button" onClick={() => handleDeletePoint(sec.id, item.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.75rem', padding: '2px 4px', borderRadius: '4px' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>✕</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Agregar punto — toggle inline + input + button en una sola fila */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {sec.type === 'evaluacion' && (
                        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                          {[{ v: 'calificable', label: '⭐ Cal.', color: '#16a34a', bg: '#f0fdf4', border: '#86efac' }, { v: 'libre', label: '📝 Libre', color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' }].map(opt => {
                            const selected = (pointTypeBySec[sec.id] || 'calificable') === opt.v;
                            return (
                              <button key={opt.v} type="button"
                                onClick={() => setPointTypeBySec(prev => ({ ...prev, [sec.id]: opt.v }))}
                                style={{
                                  padding: '4px 9px', borderRadius: '999px', fontSize: '0.67rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                                  border: `1.5px solid ${selected ? opt.border : '#d1d9e6'}`,
                                  background: selected ? opt.bg : '#fff',
                                  color: selected ? opt.color : '#94a3b8',
                                  transition: 'all 0.12s'
                                }}>
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <input type="text"
                        value={getPointText(sec.id)}
                        onChange={e => setPointTextBySec(prev => ({ ...prev, [sec.id]: e.target.value }))}
                        placeholder="Escribe el punto a evaluar..."
                        style={{ flex: 1, padding: '6px 10px', borderRadius: '7px', border: '1.5px solid #d1d9e6', fontSize: '0.78rem', color: '#0f172a', outline: 'none', background: '#fff', fontFamily: 'inherit' }}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddPoint(sec.id, sec.type); }} />
                      <button type="button" onClick={() => handleAddPoint(sec.id, sec.type)}
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
  const checklistModalRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const styleElRef = useRef(null);

  // Contador de locks para evitar corrupción del overflow en ciclos rápidos
  const scrollLockCount = useRef(0);

  const restoreBodyScroll = () => {
    scrollLockCount.current = Math.max(0, scrollLockCount.current - 1);
    if (scrollLockCount.current === 0) {
      document.body.style.overflow = '';
    }
  };

  // Inyectar/remover estilos del modal directamente en <head>
  useEffect(() => {
    if (isOpen) {
      if (scrollLockCount.current === 0) {
        document.body.style.overflow = 'hidden';
      }
      scrollLockCount.current += 1;
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
            background: rgba(15,23,42,0.6) !important;
            overflow: hidden !important;
          }
          #eventChecklistBackdrop > [role="dialog"] {
            width: min(94vw, 840px) !important;
            height: min(92vh, 880px) !important;
            height: min(92dvh, 880px) !important;
            max-width: 100vw !important;
            max-height: 100dvh !important;
            margin: 0 auto !important;
            border-radius: 16px !important;
            background: #ffffff !important;
            box-shadow: 0 20px 50px rgba(15,23,42,0.2) !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            position: relative !important;
          }
          #eventChecklistBackdrop .checklist-body {
            flex: 1 1 0% !important;
            min-height: 0 !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch !important;
            overscroll-behavior: contain !important;
            padding: 14px 16px 20px !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
            background: #f8fafd !important;
          }
          @media (max-width: 900px) {
            #eventChecklistBackdrop {
              align-items: stretch !important;
              justify-content: stretch !important;
              padding: 0 !important;
            }
            #eventChecklistBackdrop > [role="dialog"] {
              width: 100vw !important;
              height: 100dvh !important;
              height: 100vh !important;
              max-width: 100vw !important;
              max-height: 100dvh !important;
              border-radius: 0 !important;
              border: none !important;
              box-shadow: none !important;
              position: fixed !important;
              inset: 0 !important;
            }
            #eventChecklistBackdrop .checklist-body {
              padding: 12px 14px 24px !important;
            }
            #eventChecklistBackdrop select,
            #eventChecklistBackdrop input,
            #eventChecklistBackdrop textarea {
              font-size: 16px !important;
            }
          }
        `;
        document.head.appendChild(el);
        styleElRef.current = el;
      }
    } else {
      restoreBodyScroll();
      if (styleElRef.current) {
        document.head.removeChild(styleElRef.current);
        styleElRef.current = null;
      }
    }
    return () => {
      restoreBodyScroll();
      // Safety net: asegurar scroll tras 2s por si el cleanup falla
      setTimeout(() => { document.body.style.overflow = ''; }, 2000);
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
  const [pastEventEditGraceDays, setPastEventEditGraceDays] = useState(0);
  // Snapshot de events cargado al abrir el modal. Lo usamos para que
  // isEventSeriesInPast vea la serie completa (mismo groupId) en cada render
  // sin volver a llamar a loadCrmState(). Es estable mientras el modal está
  // abierto; al reabrir el modal se refresca desde el state.
  const [events, setEvents] = useState([]);

  // Operativa checklist
  const [opTplIds, setOpTplIds] = useState([]); // array de ids; soporta múltiples plantillas
  const [opNotes, setOpNotes] = useState('');
  const [opItems, setOpItems] = useState([]);
  const [opHistory, setOpHistory] = useState([]);

  // Evaluacion checklist
  const [evTplIds, setEvTplIds] = useState([]); // array de ids; soporta múltiples plantillas
  const [evNotes, setEvNotes] = useState('');
  const [evItems, setEvItems] = useState([]);
  const [evHistory, setEvHistory] = useState([]);

  const isReadOnly = currentUser?.rol === 'Coordinador' && !currentUser?.canUseChecklist;

  // Lock + PIN para re-editar la Evaluación después de guardada
  const [isEvLocked, setIsEvLocked] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinDisplay, setPinDisplay] = useState('');
  const [pinError, setPinError] = useState('');
  // ID del item al que se le hace focus (flash) cuando falla la validación al guardar
  const [flashItemId, setFlashItemId] = useState(null);
  const flashTimerRef = useRef(null);
  const [expandedNoteItemIds, setExpandedNoteItemIds] = useState(new Set());

  // Combinar el read-only del rol con el lock post-guardado
  const isEvReadOnly = isReadOnly || isEvLocked;
  const canUnlockEv = currentUser?.rol === 'Admin' && isEvLocked && !isReadOnly;

  // Lock de Operativa: si TODA la serie del evento terminó (último día + grace),
  // el check list queda BLOQUEADO PERMANENTEMENTE (no se puede desbloquear, ni
  // siquiera con PIN). Esto preserva la inmutabilidad de los check lists de
  // eventos ya finalizados, mientras permite editar durante el evento.
  // Se considera la serie completa (mismo groupId), no solo el slot abierto,
  // para que un evento multi-día no se bloquee apenas arranque el día 2.
  const isEventPast = useMemo(
    () => isEventSeriesInPast(events, evtId, pastEventEditGraceDays),
    [events, evtId, pastEventEditGraceDays]
  );
  const isOpLocked = isEventPast && opItems.length > 0;
  const isOpReadOnly = isReadOnly || isOpLocked;

  // Helper para el read-only de los items (rating, status, comentario) según la pestaña activa.
  // El lock de Evaluación (isEvLocked) sí bloquea la edición de items ya calificados,
  // pero NO bloquea la gestión de plantillas (agregar/quitar), para que el usuario pueda
  // cargar más check lists en un evento cuya primera plantilla ya fue completada.
  const activeReadOnly = activeTab === TAB_EVALUACION ? isEvReadOnly : isOpReadOnly;
  // Para la UI de plantillas (chips, dropdown, "Quitar todas"): el lock de Evaluación
  // NO aplica, solo el rol de Coordinador y el lock de Operativa por evento pasado.
  const activeTplsReadOnly = isReadOnly || (activeTab === TAB_OPERATIVA ? isOpLocked : false);

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
        setPastEventEditGraceDays(Number(state.pastEventEditGraceDays || 0));
        const eventsList = Array.isArray(state.events) ? state.events : [];
        setEvents(eventsList);
        const checklists = (state.eventChecklists && typeof state.eventChecklists === 'object') ? state.eventChecklists : {};
        const eventFound = eventsList.find(x => x.id === id);
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
        // Lectura con fallback legacy: templateIds (array) tiene prioridad;
        // si no existe, se usa templateId (string) convertido a array.
        const opTplIds = Array.isArray(op.templateIds) ? op.templateIds.map(String)
                       : op.templateId ? [String(op.templateId)] : [];
        const evTplIds = Array.isArray(evTabData.templateIds) ? evTabData.templateIds.map(String)
                       : evTabData.templateId ? [String(evTabData.templateId)] : [];
        setOpTplIds(opTplIds);
        setOpNotes(op.notes || '');

        // Merge saved items with current templates (multi):
        // 1) patch type/templateId/templateName on already-saved items
        // 2) append any NEW template items not yet saved in the event checklist
        // 3) filtra por sectionType para que Operativa y Evaluación no se mezclen
        // 4) deduplica items por id entre las distintas plantillas
        const mergeWithMultipleTemplates = (savedItems, templateIds, sectionTypeFilter) => {
          if (!Array.isArray(templateIds) || templateIds.length === 0) return savedItems;
          const allTplItems = [];
          for (const tId of templateIds) {
            const tpl = tpls.find(t => String(t.id) === String(tId));
            if (!tpl) continue;
            const sectionsForType = (tpl.sections || []).filter(
              s => (s.type || TAB_OPERATIVA) === sectionTypeFilter
            );
            for (const sec of sectionsForType) {
              for (const item of (sec.items || [])) {
                allTplItems.push({
                  id: item.id,
                  text: item.text,
                  sectionName: sec.name,
                  sectionType: sec.type || TAB_OPERATIVA,
                  templateId: Number(tId),
                  templateName: tpl.name,
                  type: item.type || undefined,
                  status: 'pendiente',
                  rating: null,
                  comment: '',
                });
              }
            }
          }
          const savedIds = new Set(savedItems.map(i => i.id));
          // patch type y templateId/templateName en items guardados
          const patched = savedItems.map(item => {
            const match = allTplItems.find(x => x.id === item.id);
            if (!match) return item;
            return {
              ...item,
              templateId: match.templateId,
              templateName: match.templateName,
              type: match.type || item.type,
            };
          });
          // items nuevos del template que aún no estaban guardados
          const newItems = allTplItems.filter(i => !savedIds.has(i.id));
          return [...patched, ...newItems];
        };

        const hasSavedEvRatings = Array.isArray(evTabData.items) && evTabData.items.some(
          it => it.rating !== null && it.rating !== undefined
        );
        const hasEvNotes = !!(evTabData.notes && String(evTabData.notes).trim().length > 0);
        const hasEvHistory = Array.isArray(evTabData.history) && evTabData.history.length > 0;
        const evHasData = hasSavedEvRatings || hasEvNotes || hasEvHistory;

        // Si el evento no tiene datos reales guardados de evaluación, descartar plantillas inactivas
        let validEvTplIds = evTplIds;
        if (!evHasData) {
          validEvTplIds = evTplIds.filter(tid => {
            const tpl = tpls.find(t => String(t.id) === String(tid));
            return tpl && tpl.active !== false;
          });
        }

        const hasSavedOpProgress = Array.isArray(op.items) && op.items.some(
          it => it.status && it.status !== 'pendiente'
        );
        const hasOpNotes = !!(op.notes && String(op.notes).trim().length > 0);
        const hasOpHistory = Array.isArray(op.history) && op.history.length > 0;
        const opHasData = hasSavedOpProgress || hasOpNotes || hasOpHistory;

        let validOpTplIds = opTplIds;
        if (!opHasData) {
          validOpTplIds = opTplIds.filter(tid => {
            const tpl = tpls.find(t => String(t.id) === String(tid));
            return tpl && tpl.active !== false;
          });
        }

        let resolvedOpItems = validOpTplIds.length
          ? mergeWithMultipleTemplates(op.items || [], validOpTplIds, TAB_OPERATIVA)
          : (opHasData ? (op.items || []) : []);
        let resolvedEvItems = validEvTplIds.length
          ? mergeWithMultipleTemplates(evTabData.items || [], validEvTplIds, TAB_EVALUACION)
          : (evHasData ? (evTabData.items || []) : []);

        // Defaults: si el tab no tiene plantilla y no hay items, sugerir la primera
        // plantilla ACTIVA que tenga sections del tipo correspondiente.
        if (validOpTplIds.length === 0 && !resolvedOpItems.length && tpls.length > 0) {
          const firstWithOp = tpls.find(t =>
            t.active !== false &&
            (t.sections || []).some(s => (s.type || TAB_OPERATIVA) === TAB_OPERATIVA)
          );
          if (firstWithOp) {
            const tid = String(firstWithOp.id);
            validOpTplIds = [tid];
            const opSections = (firstWithOp.sections || []).filter(s => (s.type || TAB_OPERATIVA) === TAB_OPERATIVA);
            resolvedOpItems = opSections.flatMap(s =>
              (s.items || []).map(item => ({
                id: item.id, text: item.text, sectionName: s.name,
                sectionType: s.type || TAB_OPERATIVA,
                templateId: Number(tid), templateName: firstWithOp.name,
                type: item.type || undefined,
                status: 'pendiente', rating: null, comment: ''
              }))
            );
          }
        }

        if (validEvTplIds.length === 0 && (!resolvedEvItems.length || !hasSavedEvRatings) && tpls.length > 0) {
          const firstWithEv = tpls.find(t =>
            t.active !== false &&
            (t.sections || []).some(s => (s.type || TAB_OPERATIVA) === TAB_EVALUACION)
          );
          if (firstWithEv) {
            const tid = String(firstWithEv.id);
            validEvTplIds = [tid];
            const evSections = (firstWithEv.sections || []).filter(s => (s.type || TAB_OPERATIVA) === TAB_EVALUACION);
            resolvedEvItems = evSections.flatMap(s =>
              (s.items || []).map(item => ({
                id: item.id, text: item.text, sectionName: s.name,
                sectionType: s.type || TAB_OPERATIVA,
                templateId: Number(tid), templateName: firstWithEv.name,
                type: item.type || undefined,
                status: 'pendiente', rating: null, comment: ''
              }))
            );
          }
        }

        setOpTplIds(validOpTplIds);
        setOpItems(resolvedOpItems);
        setOpHistory(op.history || []);
        setEvTplIds(validEvTplIds);
        setEvNotes(evTabData.notes || '');
        setEvItems(resolvedEvItems);
        setEvHistory(evTabData.history || []);
        setActiveTab(TAB_OPERATIVA);

        // Inicializar lock: si la Evaluación ya tiene datos guardados con al menos
        // un rating, queda bloqueada al abrir. Si está vacía, editable normal.
        const hasSavedRatings = resolvedEvItems.length > 0
          && resolvedEvItems.some(it => it.rating !== null && it.rating !== undefined);
        setIsEvLocked(hasSavedRatings);
        setShowPinDialog(false);
        setPinInput('');
        setPinError('');

        setIsOpen(true);
      } catch (err) { console.error(err); toast('Error al abrir checklist'); }
    };
    window.addEventListener(APP_EVENT_OPEN_EVENT_CHECKLIST, handler);
    return () => window.removeEventListener(APP_EVENT_OPEN_EVENT_CHECKLIST, handler);
  }, []);

  const closeEvent = () => {
    setIsOpen(false);
    setIsEvLocked(false);
    setShowPinDialog(false);
    setPinInput('');
    setPinDisplay('');
    setPinError('');
    setFlashItemId(null);
    setExpandedNoteItemIds(new Set());
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
  };

  // Handler del input del PIN: enmascara el valor con puntos (•) en la UI
  // para que el PIN nunca se vea, ni siquiera en iOS Safari.
  const handlePinChange = (e) => {
    const raw = e.target.value || '';
    const digits = raw.replace(/\D/g, ''); // solo dígitos
    setPinInput(digits);
    setPinDisplay('\u2022'.repeat(digits.length));
    setPinError('');
  };

  // Submit del PIN de Admin
  const handlePinSubmit = () => {
    if (currentUser?.rol !== 'Admin') {
      setPinError('Solo usuarios con rol Admin pueden desbloquear.');
      return;
    }
    if (pinInput === EVALUATION_UNLOCK_PIN) {
      setIsEvLocked(false);
      setShowPinDialog(false);
      setPinInput('');
      setPinDisplay('');
      setPinError('');
      toast.success('Evaluación desbloqueada para edición.');
    } else {
      setPinError('PIN incorrecto. Inténtalo de nuevo.');
    }
  };

  // Estado del confirm dialog para cambio de plantilla
  const [tplConfirm, setTplConfirm] = useState(null); // { tab, tid, prevId, currentItems }
  // Ejecuta el cambio real de plantilla
  // Reemplaza completamente la lista de plantillas del tab y re-mergea items
  const applyTplChange = (tab, newTplIds) => {
    const ids = Array.isArray(newTplIds) ? newTplIds.filter(Boolean).map(String) : [];
    if (tab === TAB_OPERATIVA) setOpTplIds(ids);
    else setEvTplIds(ids);
    if (ids.length === 0) {
      if (tab === TAB_OPERATIVA) setOpItems([]);
      else setEvItems([]);
      return;
    }
    const targetType = tab === TAB_OPERATIVA ? TAB_OPERATIVA : TAB_EVALUACION;
    const allItems = [];
    for (const tId of ids) {
      const tpl = templates.find(t => String(t.id) === String(tId));
      if (!tpl) continue;
      const sections = (tpl.sections || []).filter(s => (s.type || TAB_OPERATIVA) === targetType);
      for (const sec of sections) {
        for (const item of (sec.items || [])) {
          allItems.push({
            id: item.id, text: item.text, sectionName: sec.name,
            sectionType: sec.type || TAB_OPERATIVA,
            templateId: Number(tId), templateName: tpl.name,
            type: item.type || undefined,
            status: 'pendiente', rating: null, comment: ''
          });
        }
      }
    }
    if (tab === TAB_OPERATIVA) setOpItems(allItems);
    else setEvItems(allItems);
  };

  // Agrega una plantilla al tab (concatena items al estado actual)
  const addTplToTab = (tab, tplId) => {
    const tid = String(tplId);
    const currentIds = tab === TAB_OPERATIVA ? opTplIds : evTplIds;
    if (currentIds.includes(tid)) return; // ya está
    const currentItems = tab === TAB_OPERATIVA ? opItems : evItems;
    const newIds = [...currentIds, tid];
    if (currentItems.length === 0) {
      // No hay items, no hace falta confirm
      applyTplChange(tab, newIds);
      return;
    }
    setTplConfirm({ mode: 'add', tab, newIds, currentItems });
  };

  // Quita una plantilla del tab y re-mergea con las restantes (conserva items guardados)
  const removeTplFromTab = (tab, tplId) => {
    const tid = String(tplId);
    const currentIds = tab === TAB_OPERATIVA ? opTplIds : evTplIds;
    const newIds = currentIds.filter(id => id !== tid);
    // Re-merge: los items que NO están en las plantillas restantes se quitan
    const targetType = tab === TAB_OPERATIVA ? TAB_OPERATIVA : TAB_EVALUACION;
    const remainingItems = [];
    for (const tId of newIds) {
      const tpl = templates.find(t => String(t.id) === String(tId));
      if (!tpl) continue;
      const sections = (tpl.sections || []).filter(s => (s.type || TAB_OPERATIVA) === targetType);
      for (const sec of sections) {
        for (const item of (sec.items || [])) {
          remainingItems.push({ id: item.id, text: item.text, sectionName: sec.name, sectionType: sec.type || TAB_OPERATIVA, templateId: Number(tId), templateName: tpl.name, type: item.type || undefined });
        }
      }
    }
    const remainingIds = new Set(remainingItems.map(i => i.id));
    const currentItems = tab === TAB_OPERATIVA ? opItems : evItems;
    // Conserva items guardados (con datos) aunque la plantilla se haya quitado
    const keptItems = currentItems.filter(i => remainingIds.has(i.id) || !i.templateId);
    // Para los ids restantes, regenera la info del template
    const finalItems = keptItems.map(i => {
      const fromTpl = remainingItems.find(r => r.id === i.id);
      return fromTpl ? { ...i, templateId: fromTpl.templateId, templateName: fromTpl.templateName, sectionName: fromTpl.sectionName, type: fromTpl.type || i.type } : i;
    });
    if (tab === TAB_OPERATIVA) {
      setOpTplIds(newIds);
      setOpItems(finalItems);
    } else {
      setEvTplIds(newIds);
      setEvItems(finalItems);
    }
  };

  const clearTplFromTab = (tab) => {
    if (tab === TAB_OPERATIVA) {
      setOpTplIds([]);
      setOpItems([]);
    } else {
      setEvTplIds([]);
      setEvItems([]);
    }
  };

  const handleTpl = (tab) => (e) => {
    // Select del dropdown: el value es un id de plantilla a AGREGAR.
    const tid = e.target.value;
    if (!tid) return; // opción vacía, no hacer nada
    e.target.value = ''; // reset visual del select
    addTplToTab(tab, tid);
  };
  const confirmTplChange = () => {
    if (!tplConfirm) return;
    // Si es 'add' (agregar plantilla), preservamos los items actuales y hacemos
    // el merge con las plantillas acumuladas (currentIds + newId).
    if (tplConfirm.mode === 'add') {
      const tab = tplConfirm.tab;
      const newIds = tplConfirm.newIds;
      // Construir el set completo de items: items actuales (con sus datos guardados)
      // + items nuevos que no estén ya en los actuales.
      const currentItems = tab === TAB_OPERATIVA ? opItems : evItems;
      const targetType = tab === TAB_OPERATIVA ? TAB_OPERATIVA : TAB_EVALUACION;
      const tplItems = [];
      for (const tId of newIds) {
        const tpl = templates.find(t => String(t.id) === String(tId));
        if (!tpl) continue;
        const sections = (tpl.sections || []).filter(s => (s.type || TAB_OPERATIVA) === targetType);
        for (const sec of sections) {
          for (const item of (sec.items || [])) {
            tplItems.push({
              id: item.id, text: item.text, sectionName: sec.name,
              sectionType: sec.type || TAB_OPERATIVA,
              templateId: Number(tId), templateName: tpl.name,
              type: item.type || undefined, status: 'pendiente', rating: null, comment: ''
            });
          }
        }
      }
      const existingIds = new Set(currentItems.map(i => i.id));
      const merged = [...currentItems];
      for (const it of tplItems) {
        if (!existingIds.has(it.id)) merged.push(it);
        else {
          // Actualizar info de plantilla en items que ya existían
          const idx2 = merged.findIndex(m => m.id === it.id);
          if (idx2 >= 0) merged[idx2] = { ...merged[idx2], templateId: it.templateId, templateName: it.templateName, sectionName: it.sectionName };
        }
      }
      if (tab === TAB_OPERATIVA) {
        setOpTplIds(newIds);
        setOpItems(merged);
      } else {
        setEvTplIds(newIds);
        setEvItems(merged);
      }
    } else {
      // Modo legacy: reemplazar completamente
      applyTplChange(tplConfirm.tab, tplConfirm.tid);
    }
    setTplConfirm(null);
  };
  const cancelTplChange = () => {
    if (!tplConfirm) return;
    // En modo 'add', no hay que revertir nada (todavía no se aplicó el cambio)
    if (tplConfirm.mode === 'add') {
      setTplConfirm(null);
      return;
    }
    // Modo legacy: revertir el select al valor anterior
    if (tplConfirm.tab === TAB_OPERATIVA) setOpTplIds(tplConfirm.prevIds);
    else setEvTplIds(tplConfirm.prevIds);
    setTplConfirm(null);
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

    // Validación: en Evaluación, todos los puntos deben estar calificados (incluyendo N/A).
    // Las preguntas abiertas (libre) no bloquean — solo necesitan comentario.
    if (tab === TAB_EVALUACION) {
      const unrated = evItems.filter(i =>
        i.type !== 'libre' && (i.rating === null || i.rating === undefined)
      );
      if (unrated.length > 0) {
        // El `unratedItems` derivado se calcula sobre `evItems` directamente, así
        // que refleja el estado más reciente. Llamamos focus sobre él.
        focusFirstUnrated();
        return;
      }
    }

    const setSaving = tab === TAB_OPERATIVA ? setSavingOp : setSavingEv;
    setSaving(true);
    try {
      const state = await loadCrmState();
      const cur = (state.eventChecklists && typeof state.eventChecklists === 'object') ? state.eventChecklists : {};
      const existing = cur[evtId] || {};
      const entry = buildHistoryEntry(currentUser);
      const tabData = tab === TAB_OPERATIVA
        ? { templateIds: opTplIds.map(id => Number(id)).filter(n => Number.isFinite(n)), templateId: opTplIds[0] ? Number(opTplIds[0]) : null, notes: opNotes, items: opItems, history: [...opHistory, entry] }
        : { templateIds: evTplIds.map(id => Number(id)).filter(n => Number.isFinite(n)), templateId: evTplIds[0] ? Number(evTplIds[0]) : null, notes: evNotes, items: evItems, history: [...evHistory, entry] };
      await saveCrmState({
        ...state,
        eventChecklists: { ...cur, [evtId]: { ...existing, [tab]: tabData } }
      });
      if (tab === TAB_OPERATIVA) setOpHistory(prev => [...prev, entry]);
      else setEvHistory(prev => [...prev, entry]);
      toast(`Check list ${tab === TAB_OPERATIVA ? 'Operativa' : 'Evaluación'} guardado ✓`);
      window.dispatchEvent(new Event('stateUpdated'));
      // Lock: después de guardar, la Evaluación queda bloqueada para edición.
      if (tab === TAB_EVALUACION) setIsEvLocked(true);
      closeEvent();
    } catch (err) { console.error(err); toast('Error al guardar'); }
    finally { setSaving(false); }
  };


  // Computed for active tab
  const activeItems = activeTab === TAB_OPERATIVA ? opItems : evItems;
  const activeTplIds = activeTab === TAB_OPERATIVA ? opTplIds : evTplIds;
  const activeNotes = activeTab === TAB_OPERATIVA ? opNotes : evNotes;
  const activeHistory = activeTab === TAB_OPERATIVA ? opHistory : evHistory;
  const activeSaving = activeTab === TAB_OPERATIVA ? savingOp : savingEv;

  // Open questions = evaluacion items with type 'libre'
  const isOpenQuestion = (item) => item.type === 'libre';
  const tableItems = activeTab === TAB_EVALUACION ? activeItems.filter(i => !isOpenQuestion(i)) : activeItems;
  const openQuestions = activeTab === TAB_EVALUACION ? activeItems.filter(i => isOpenQuestion(i)) : [];

  // Items sin calificar en Evaluación (para validación y resaltado)
  const unratedItems = activeTab === TAB_EVALUACION
    ? tableItems.filter(i => i.rating === null || i.rating === undefined)
    : [];
  const unratedIds = new Set(unratedItems.map(i => i.id));

  // Flash effect: cuando el usuario intenta guardar y faltan items, hacemos
  // scroll + highlight al PRIMER item sin calificar y mostramos un mensaje focalizado.
  const focusFirstUnrated = () => {
    if (unratedItems.length === 0) return;
    const first = unratedItems[0];
    // Scroll al row correspondiente dentro del wrapper scrollable
    const el = document.querySelector(`#eventChecklistBackdrop [data-ev-item-id="${first.id}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setFlashItemId(first.id);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashItemId(null), 4000);
    const truncate = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s);
    const label = `${first.sectionName ? `[${first.sectionName}] ` : ''}${truncate(first.text || '(sin texto)', 60)}`;
    toast.error(`Falta evaluar este punto: ${label}`, { autoClose: 5000 });
  };

  const total = activeItems.length;
  const done = activeItems.filter(i => i.status === 'cumplido').length;
  const progress = total > 0 ? Math.round(((done + activeItems.filter(i => i.status === 'en_proceso' || i.status === 'no_aplica').length) / total) * 100) : 0;
  const sat = (total - activeItems.filter(i => i.status === 'no_aplica').length) > 0
    ? Math.round((done / (total - activeItems.filter(i => i.status === 'no_aplica').length)) * 100) : 0;

  const evalItems = tableItems;
  // N/A (rating === 'no_aplica') se excluye del numerador Y del denominador.
  const applicableItems = evalItems.filter(i => i.rating !== null && i.rating !== 'no_aplica');
  const notApplicableCount = evalItems.filter(i => i.rating === 'no_aplica').length;
  const unratedCount = evalItems.filter(i => i.rating === null).length;
  const satisfactionAvg = applicableItems.length > 0
    ? (applicableItems.reduce((sum, i) => sum + (RATING_LEVELS.find(r => r.value === i.rating)?.score || 0), 0) / applicableItems.length)
    : 0;
  const satisfactionPct = Math.round((satisfactionAvg / 10) * 100);

  const getEventTitle = () => {
    if (!evtData) return 'Evento';
    return String(evtData.eventName || evtData.client || evtData.name || evtData.company || 'Evento').trim();
  };

  const getEventDateFormatted = () => {
    if (!evtData) return '';
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const fmt = (str) => {
      if (!str) return '';
      if (str instanceof Date) {
        const d = String(str.getDate()).padStart(2, '0');
        const m = months[str.getMonth()];
        const y = str.getFullYear();
        return `${d} ${m} ${y}`;
      }
      const clean = String(str).trim().slice(0, 10);
      const parts = clean.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        const d = parts[2].padStart(2, '0');
        const m = months[parseInt(parts[1], 10) - 1] || parts[1];
        const y = parts[0];
        return `${d} ${m} ${y}`;
      }
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        const d = String(parsed.getDate()).padStart(2, '0');
        const m = months[parsed.getMonth()];
        const y = parsed.getFullYear();
        return `${d} ${m} ${y}`;
      }
      return str;
    };
    const start = evtData.eventDateStart;
    const end = evtData.eventDateEnd;
    if (start && end && start !== end) {
      return `${fmt(start)} → ${fmt(end)}`;
    }
    return fmt(evtData.date || evtData.eventDate || start || '');
  };

  const modalContent = (
    <>
      <div
        id="eventChecklistBackdrop"
        onClick={e => { if (checklistModalRef.current && !checklistModalRef.current.contains(e.target)) closeEvent(); }}
        style={{
          display: isOpen ? 'flex' : 'none',
        }}
      >
        <div ref={checklistModalRef} role="dialog" aria-modal="true" aria-label="Check List Evento">
          {/* Header */}
          <div className="checklist-header" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '14px 16px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              {/* Purple document icon badge */}
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#eef2ff',
                border: '1.5px solid #c7d2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </div>

              {/* Title and subtitles */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div className="checklist-header-title" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                    Check List — Evento
                  </div>
                  {isReadOnly && (
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: 4 }}>
                      Solo lectura
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  color: '#475569',
                  marginTop: '3px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={getEventTitle()}>
                  {getEventTitle()}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>📅</span>
                  <span>{getEventDateFormatted()}</span>
                </div>
              </div>
            </div>

            {/* Close button */}
            <button
              className="btn-exit"
              type="button"
              onClick={closeEvent}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0
              }}
              aria-label="Cerrar"
            >
              <XIcon />
            </button>
          </div>

          {/* Mode switch (Tabs) */}
          <div className="checklist-tab-bar" style={{
            display: 'flex',
            background: '#f1f5f9',
            padding: '4px',
            borderRadius: '12px',
            gap: '4px',
            margin: '12px 14px 4px',
            flexShrink: 0
          }}>
            <button
              type="button"
              className="checklist-tab"
              onClick={() => setActiveTab(TAB_OPERATIVA)}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 800,
                background: activeTab === TAB_OPERATIVA ? '#ffffff' : 'transparent',
                color: activeTab === TAB_OPERATIVA ? '#4f46e5' : '#64748b',
                boxShadow: activeTab === TAB_OPERATIVA ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>⚙️</span>
              <span>Operativa</span>
            </button>
            <button
              type="button"
              className="checklist-tab"
              onClick={() => setActiveTab(TAB_EVALUACION)}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 800,
                background: activeTab === TAB_EVALUACION ? '#ffffff' : 'transparent',
                color: activeTab === TAB_EVALUACION ? '#7c3aed' : '#64748b',
                boxShadow: activeTab === TAB_EVALUACION ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>⭐</span>
              <span>Evaluación</span>
            </button>
          </div>

          {/* Body */}
          <div className="checklist-body">
            {/* Card 1: Plantillas aplicadas */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '14px 16px',
              boxShadow: '0 2px 8px rgba(15,23,42,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  PLANTILLAS APLICADAS
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                  {activeTplIds.length === 1 ? '1 seleccionada' : `${activeTplIds.length} seleccionadas`}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                {activeTplIds.map(tid => {
                  const tpl = (templates || []).find(t => String(t.id) === tid);
                  const name = tpl?.name || `Plantilla #${tid}`;
                  return (
                    <span
                      key={tid}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 12px',
                        borderRadius: '999px',
                        background: '#eef2ff',
                        border: '1.5px solid #c7d2fe',
                        color: '#3730a3',
                        fontSize: '0.8rem',
                        fontWeight: 700
                      }}
                    >
                      <span>{name}</span>
                      <button
                        type="button"
                        onClick={() => removeTplFromTab(activeTab, tid)}
                        disabled={activeTplsReadOnly}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: '#4f46e5',
                          cursor: activeTplsReadOnly ? 'not-allowed' : 'pointer',
                          fontSize: '1rem',
                          lineHeight: 1,
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        aria-label={`Quitar ${name}`}
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}

                {/* Botón + Agregar plantilla con overlay de selector nativo */}
                {(() => {
                  const availableTpls = (templates || []).filter(t => t.active !== false && !activeTplIds.includes(String(t.id)));
                  return (
                    <div style={{ position: 'relative', display: 'inline-flex' }}>
                      <button
                        type="button"
                        disabled={activeTplsReadOnly || availableTpls.length === 0}
                        style={{
                          padding: '5px 14px',
                          borderRadius: '999px',
                          border: '1.5px dashed #cbd5e1',
                          background: '#f8fafc',
                          color: '#475569',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: (activeTplsReadOnly || availableTpls.length === 0) ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>+</span>
                        <span>Agregar plantilla</span>
                      </button>
                      {availableTpls.length > 0 && !activeTplsReadOnly && (
                        <select
                          value=""
                          onChange={handleTpl(activeTab)}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            opacity: 0,
                            width: '100%',
                            height: '100%',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="" disabled>Seleccionar plantilla...</option>
                          {availableTpls.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
                Podés combinar múltiples plantillas al mismo check list.
              </div>
            </div>

            {/* Card 2: Avance General */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '14px 16px',
              boxShadow: '0 2px 8px rgba(15,23,42,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {activeTab === TAB_OPERATIVA ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      AVANCE GENERAL
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginRight: '6px' }}>
                        OPERATIVO
                      </span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#10b981' }}>
                        {sat}%
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                    {progress}%
                  </div>

                  <div style={{ height: '8px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      borderRadius: '999px',
                      background: 'linear-gradient(90deg, #6366f1, #10b981)',
                      width: `${progress}%`,
                      transition: 'width 0.4s ease'
                    }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {/* Cumplido */}
                    <div style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '10px',
                      padding: '8px 4px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px'
                    }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
                        <span>{done}</span>
                      </div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#16a34a' }}>Cumplido</div>
                    </div>

                    {/* En proceso */}
                    <div style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '10px',
                      padding: '8px 4px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px'
                    }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d97706' }} />
                        <span>{activeItems.filter(i => i.status === 'en_proceso').length}</span>
                      </div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#d97706' }}>En proceso</div>
                    </div>

                    {/* Pendiente */}
                    <div style={{
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '8px 4px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px'
                    }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#64748b' }} />
                        <span>{activeItems.filter(i => i.status === 'pendiente').length}</span>
                      </div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>Pendiente</div>
                    </div>

                    {/* No aplica */}
                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '8px 4px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px'
                    }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
                        <span>{activeItems.filter(i => i.status === 'no_aplica').length}</span>
                      </div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>No aplica</div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      SATISFACCIÓN DEL CLIENTE
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginRight: '6px' }}>
                        PROMEDIO
                      </span>
                      <span style={{
                        fontSize: '0.95rem',
                        fontWeight: 900,
                        color: satisfactionAvg >= 7.5 ? '#16a34a' : satisfactionAvg >= 5 ? '#d97706' : '#dc2626'
                      }}>
                        {applicableItems.length > 0 ? `${satisfactionAvg.toFixed(1)} / 10` : '—'}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                    {applicableItems.length > 0 ? `${satisfactionPct}%` : '0%'}
                  </div>

                  <div style={{ height: '8px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      borderRadius: '999px',
                      background: satisfactionAvg >= 7.5 ? '#22c55e' : satisfactionAvg >= 5 ? '#eab308' : '#ef4444',
                      width: `${satisfactionPct}%`,
                      transition: 'width 0.4s ease'
                    }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '10px', padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#7c3aed' }}>● {evalItems.filter(i => i.rating === 'excelente').length}</div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#7c3aed' }}>Excelente</div>
                    </div>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#16a34a' }}>● {evalItems.filter(i => i.rating === 'bueno').length}</div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#16a34a' }}>Bueno</div>
                    </div>
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#d97706' }}>● {evalItems.filter(i => i.rating === 'regular').length}</div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#d97706' }}>Regular</div>
                    </div>
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#dc2626' }}>● {evalItems.filter(i => i.rating === 'malo').length}</div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#dc2626' }}>Malo</div>
                    </div>
                    <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569' }}>● {unratedCount}</div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b' }}>Sin calificar</div>
                    </div>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b' }}>● {notApplicableCount}</div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8' }}>N/A</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Card 3: Notas / Sugerencias Generales */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '14px 16px',
              boxShadow: '0 2px 8px rgba(15,23,42,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                NOTAS / SUGERENCIAS GENERALES
              </span>
              <textarea
                value={activeNotes}
                onChange={e => {
                  const val = e.target.value;
                  if (activeTab === TAB_OPERATIVA) setOpNotes(val);
                  else setEvNotes(val);
                }}
                rows={2}
                placeholder="Observaciones generales..."
                readOnly={activeReadOnly}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1.5px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#0f172a',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  minHeight: '56px'
                }}
              />
            </div>

            {/* Section: Puntos a verificar */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '4px',
                marginBottom: '8px',
                padding: '0 2px'
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  PUNTOS A VERIFICAR ({tableItems.length})
                </span>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                  Toque para actualizar estado
                </span>
              </div>

              {tableItems.length === 0 ? (
                <div style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                  fontStyle: 'italic'
                }}>
                  Selecciona una plantilla para cargar los puntos a verificar
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tableItems.map((item, idx) => {
                    const isUnrated = unratedIds.has(item.id);
                    const isFlashing = flashItemId === item.id;
                    const isNoteExpanded = expandedNoteItemIds.has(item.id) || (item.comment && String(item.comment).trim().length > 0);
                    const hasComment = item.comment && String(item.comment).trim().length > 0;

                    return (
                      <div
                        key={item.id}
                        data-ev-item-id={item.id}
                        style={{
                          background: isFlashing ? '#fffbeb' : '#ffffff',
                          borderRadius: '14px',
                          border: isFlashing
                            ? '2px solid #f59e0b'
                            : (isUnrated ? '1.5px solid #dc2626' : '1px solid #e2e8f0'),
                          boxShadow: isFlashing
                            ? '0 0 0 4px rgba(245,158,11,0.2)'
                            : '0 1px 4px rgba(15,23,42,0.03)',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Top row: Number circle + Category badge */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#eff6ff',
                            color: '#2563eb',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: '1px'
                          }}>
                            {idx + 1}
                          </div>
                          {item.sectionName && (
                            <span style={{
                              background: '#eff6ff',
                              border: '1px solid #dbeafe',
                              color: '#1d4ed8',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.02em',
                              lineHeight: 1.35,
                              wordBreak: 'break-word',
                              whiteSpace: 'normal',
                              display: 'inline-block',
                              maxWidth: '100%'
                            }}>
                              {item.sectionName.toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Item text / description */}
                        <div style={{
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color: '#0f172a',
                          lineHeight: 1.4,
                          wordBreak: 'break-word',
                          whiteSpace: 'normal'
                        }}>
                          {item.text}
                        </div>

                        {isFlashing && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#fef3c7',
                            border: '1px solid #fde68a',
                            color: '#92400e',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '8px'
                          }}>
                            <span>⚠️</span>
                            <span>Falta evaluar este punto</span>
                          </div>
                        )}

                        {/* Controls row: Status Dropdown + Note Button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {/* Status / Rating selector */}
                          <div style={{ position: 'relative', flex: 1, minWidth: '140px' }}>
                            {activeTab === TAB_OPERATIVA ? (
                              (() => {
                                const STATUS_CONFIG = {
                                  cumplido: { dot: '#16a34a', label: 'Cumplido', bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
                                  en_proceso: { dot: '#d97706', label: 'En proceso', bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
                                  pendiente: { dot: '#64748b', label: 'Pendiente', bg: '#f1f5f9', border: '#cbd5e1', color: '#334155' },
                                  no_aplica: { dot: '#94a3b8', label: 'No aplica', bg: '#f8fafc', border: '#e2e8f0', color: '#64748b' }
                                };
                                const cur = STATUS_CONFIG[item.status] || STATUS_CONFIG.pendiente;
                                return (
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    borderRadius: '10px',
                                    border: `1.5px solid ${cur.border}`,
                                    background: cur.bg,
                                    color: cur.color,
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    minHeight: '38px',
                                    boxSizing: 'border-box',
                                    position: 'relative'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cur.dot }} />
                                      <span>{cur.label}</span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>⌄</span>
                                    <select
                                      value={item.status || 'pendiente'}
                                      onChange={e => !isOpReadOnly && setSt(activeTab)(item.id, e.target.value)}
                                      disabled={isOpReadOnly}
                                      style={{
                                        position: 'absolute',
                                        inset: 0,
                                        opacity: 0,
                                        width: '100%',
                                        height: '100%',
                                        cursor: isOpReadOnly ? 'default' : 'pointer'
                                      }}
                                    >
                                      <option value="pendiente">Pendiente</option>
                                      <option value="en_proceso">En proceso</option>
                                      <option value="cumplido">Cumplido</option>
                                      <option value="no_aplica">No aplica</option>
                                    </select>
                                  </div>
                                );
                              })()
                            ) : (
                              (() => {
                                const curRating = RATING_LEVELS.find(r => r.value === item.rating);
                                const label = curRating?.label || '— Calificar —';
                                const dot = curRating?.dot || '#cbd5e1';
                                return (
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    borderRadius: '10px',
                                    border: `1.5px solid ${curRating ? curRating.dot : '#cbd5e1'}`,
                                    background: '#ffffff',
                                    color: curRating ? curRating.dot : '#64748b',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    minHeight: '38px',
                                    boxSizing: 'border-box',
                                    position: 'relative'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dot }} />
                                      <span>{label}</span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>⌄</span>
                                    <select
                                      value={item.rating || ''}
                                      onChange={e => !(isReadOnly || (isEvLocked && !!item.rating)) && setRating(activeTab)(item.id, e.target.value || null)}
                                      disabled={isReadOnly || (isEvLocked && !!item.rating)}
                                      style={{
                                        position: 'absolute',
                                        inset: 0,
                                        opacity: 0,
                                        width: '100%',
                                        height: '100%',
                                        cursor: isReadOnly ? 'default' : 'pointer'
                                      }}
                                    >
                                      <option value="">— Calificar —</option>
                                      {RATING_LEVELS.map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                );
                              })()
                            )}
                          </div>

                          {/* Note Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedNoteItemIds(prev => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                            }}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '10px',
                              border: hasComment ? '1.5px solid #93c5fd' : '1.5px solid #e2e8f0',
                              background: hasComment ? '#eff6ff' : '#f8fafc',
                              color: hasComment ? '#1d4ed8' : '#475569',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              minHeight: '38px',
                              boxSizing: 'border-box'
                            }}
                          >
                            <span>💬</span>
                            <span>Nota{hasComment ? ' ✓' : ''}</span>
                          </button>
                        </div>

                        {/* Expanded note input */}
                        {isNoteExpanded && (
                          <div style={{ marginTop: '2px' }}>
                            <input
                              type="text"
                              value={item.comment || ''}
                              onChange={e => !(activeTab === TAB_EVALUACION ? (isReadOnly || (isEvLocked && !!item.rating)) : activeReadOnly) && setCm(activeTab)(item.id, e.target.value)}
                              placeholder="Escribir nota o comentario..."
                              readOnly={activeTab === TAB_EVALUACION ? (isReadOnly || (isEvLocked && !!item.rating)) : activeReadOnly}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1.5px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#0f172a',
                                fontSize: '0.8rem',
                                outline: 'none',
                                boxSizing: 'border-box',
                                fontFamily: 'inherit'
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Preguntas Abiertas (Evaluación) */}
            {activeTab === TAB_EVALUACION && openQuestions.length > 0 && (
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '14px 16px',
                boxShadow: '0 2px 8px rgba(15,23,42,0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  PREGUNTAS ABIERTAS ({openQuestions.length})
                </span>
                {openQuestions.map((item, idx) => (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '10px', borderBottom: idx < openQuestions.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <span style={{ fontSize: '0.84rem', color: '#1e293b', fontWeight: 600 }}>
                      {idx + 1}. {item.text}
                    </span>
                    <textarea
                      value={item.comment || ''}
                      onChange={e => !isEvReadOnly && setCm(activeTab)(item.id, e.target.value)}
                      placeholder="Escribir respuesta..."
                      readOnly={isEvReadOnly}
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #d1d5db',
                        fontSize: '0.82rem',
                        outline: 'none',
                        background: isEvReadOnly ? '#f8fafc' : '#ffffff',
                        color: '#0f172a',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* History toggle */}
            {activeHistory.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#6366f1',
                    padding: '4px 2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>{showHistory ? '▼' : '▶'}</span>
                  <span>Historial de ediciones ({activeHistory.length})</span>
                </button>
                {showHistory && (
                  <div style={{ marginTop: '6px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff', padding: '10px 14px', maxHeight: '150px', overflowY: 'auto' }}>
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
          </div>

          {/* Fixed Bottom Footer */}
          <div className="checklist-footer" style={{
            position: 'sticky',
            bottom: 0,
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            padding: '12px 16px',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            zIndex: 100,
            boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
            flexShrink: 0
          }}>
            <button
              className="btn-exit"
              type="button"
              onClick={closeEvent}
              style={{
                padding: '10px 20px',
                borderRadius: '12px',
                border: '1.5px solid #e2e8f0',
                background: '#f8fafc',
                color: '#475569',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                minHeight: '46px',
                minWidth: '85px',
                boxSizing: 'border-box'
              }}
            >
              Cerrar
            </button>

            {canUnlockEv && activeTab === TAB_EVALUACION && (
              <button
                type="button"
                onClick={() => { setShowPinDialog(true); setPinInput(''); setPinDisplay(''); setPinError(''); }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '12px',
                  border: '1.5px solid #6366f1',
                  background: '#eef2ff',
                  color: '#4f46e5',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: '46px',
                  boxSizing: 'border-box'
                }}
              >
                Desbloquear
              </button>
            )}

            {!isReadOnly && activeTab === TAB_EVALUACION && !isEvLocked && (
              <button
                type="button"
                onClick={handleSave(TAB_EVALUACION)}
                disabled={savingEv}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#059669',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  cursor: savingEv ? 'not-allowed' : 'pointer',
                  opacity: savingEv ? 0.6 : 1,
                  minHeight: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(5,150,105,0.25)',
                  boxSizing: 'border-box'
                }}
              >
                <span>✓</span>
                <span>{savingEv ? 'Guardando...' : 'Guardar Evaluación'}</span>
              </button>
            )}

            {!isReadOnly && activeTab === TAB_OPERATIVA && !isOpLocked && (
              <button
                type="button"
                onClick={handleSave(TAB_OPERATIVA)}
                disabled={savingOp}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#059669',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  cursor: savingOp ? 'not-allowed' : 'pointer',
                  opacity: savingOp ? 0.6 : 1,
                  minHeight: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(5,150,105,0.25)',
                  boxSizing: 'border-box'
                }}
              >
                <span>✓</span>
                <span>{savingOp ? 'Guardando...' : 'Guardar Operativa'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // Diálogo de PIN para desbloquear la Evaluación — se renderiza en un portal
  // SEPARADO con z-index mayor al del modal del Check List (999999), para que
  // el cuadro de PIN quede visible POR ENCIMA del modal principal.
  const pinDialogContent = showPinDialog ? (
    <div
      onClick={() => { setShowPinDialog(false); setPinError(''); setPinInput(''); setPinDisplay(''); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000001,
        background: 'rgba(15,23,42,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        style={{
          background: '#ffffff', borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 16px 40px rgba(15,23,42,0.25)',
          width: '100%', maxWidth: '360px',
          padding: '22px 22px 18px 22px',
        }}
      >
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
          🔒 Autorizar edición
        </div>
        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '16px' }}>
          Ingresa el PIN de Admin para desbloquear esta evaluación y poder editarla.
        </div>
        {currentUser?.rol !== 'Admin' && (
          <div style={{ fontSize: '0.75rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 10px', marginBottom: '12px' }}>
            Solo usuarios con rol <strong>Admin</strong> pueden desbloquear la evaluación.
          </div>
        )}
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          autoFocus
          value={pinInput}
          onChange={e => {
            const digits = e.target.value.replace(/\D/g, '');
            setPinInput(digits);
            setPinError('');
          }}
          onKeyDown={e => { if (e.key === 'Enter') handlePinSubmit(); }}
          placeholder="PIN"
          disabled={currentUser?.rol !== 'Admin'}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: '8px',
            border: `1.5px solid ${pinError ? '#dc2626' : '#cbd5e1'}`,
            fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
            background: currentUser?.rol !== 'Admin' ? '#f8fafc' : '#ffffff',
            color: '#0f172a', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            letterSpacing: '0.3em', textAlign: 'center', fontWeight: 700,
            // Enmascara visualmente los caracteres en navegadores WebKit/Blink
            // (iOS Safari, Chrome). En navegadores que no lo soporten, el campo
            // mostrará el PIN real — aceptable como degradación.
            WebkitTextSecurity: 'disc',
            textSecurity: 'disc',
          }}
        />
        {pinError && (
          <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '6px' }}>
            {pinError}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => { setShowPinDialog(false); setPinError(''); setPinInput(''); setPinDisplay(''); }}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#ffffff', color: '#475569', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handlePinSubmit}
            disabled={currentUser?.rol !== 'Admin' || pinInput.length === 0}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: (currentUser?.rol !== 'Admin' || pinInput.length === 0) ? '#cbd5e1' : '#4f46e5',
              color: '#ffffff', fontSize: '0.83rem', fontWeight: 700,
              cursor: (currentUser?.rol !== 'Admin' || pinInput.length === 0) ? 'not-allowed' : 'pointer',
            }}
          >
            Autorizar
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Confirm dialog estilado para cambio de plantilla ──
  const tplConfirmDialogContent = tplConfirm ? (
    <div
      onClick={cancelTplChange}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000001,
        background: 'rgba(15,23,42,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff', borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 50px rgba(15,23,42,0.30)',
          width: '100%', maxWidth: '440px',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ padding: '20px 20px 0 20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{
            width: '40px', height: '40px', flexShrink: 0,
            borderRadius: '50%', background: '#fef3c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div style={{ flex: 1, paddingTop: '2px' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>{tplConfirm?.mode === 'add' ? 'Agregar plantilla' : 'Cambiar plantilla'}</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '4px', lineHeight: 1.45 }}>
              {tplConfirm?.mode === 'add'
              ? 'Se sumarán los items de esta plantilla a los items actuales del check list.'
              : 'Los items actuales del check list se reemplazarán por los de la nueva plantilla. Se perderán las calificaciones, estados y comentarios ya cargados.'}
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
          padding: '20px', marginTop: '12px',
          background: '#f8fafc', borderTop: '1px solid #e2e8f0',
        }}>
          <button
            type="button"
            onClick={cancelTplChange}
            style={{
              padding: '10px 18px', borderRadius: '8px',
              border: '1.5px solid #cbd5e1', background: '#ffffff',
              color: '#475569', fontSize: '0.85rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmTplChange}
            autoFocus
            style={{
              padding: '10px 18px', borderRadius: '8px',
              border: '1.5px solid #6366f1', background: '#6366f1',
              color: '#ffffff', fontSize: '0.85rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            {tplConfirm?.mode === 'add' ? 'Sí, agregar' : 'Sí, cambiar plantilla'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {ReactDOM.createPortal(modalContent, document.body)}
      {ReactDOM.createPortal(pinDialogContent, document.body)}
      {ReactDOM.createPortal(tplConfirmDialogContent, document.body)}
    </>
  );
}
