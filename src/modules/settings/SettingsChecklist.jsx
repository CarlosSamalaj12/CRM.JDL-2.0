import React, { useState, useEffect, useRef } from 'react';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';
import { toast, modernConfirm } from '../../utils/toast';
import { APP_EVENT_OPEN_EVENT_CHECKLIST } from '../../utils/appEvents';

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
export default function SettingsChecklist() {
  const eventRef = useRef(null);

  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [evtId, setEvtId] = useState(null);
  const [evtData, setEvtData] = useState(null);
  const [evtTplId, setEvtTplId] = useState('');
  const [evtNotes, setEvtNotes] = useState('');
  const [evtItems, setEvtItems] = useState([]);

  const s = {
    label: { fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: '4px' },
    input: { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #d1d9e6', background: '#ffffff', color: '#0f172a', fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
    select: { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #d1d9e6', background: '#ffffff', color: '#0f172a', fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit' },
  };

  useEffect(() => {
    const handler = async (e) => {
      const id = e?.detail?.eventId;
      if (!id) return;
      try {
        const state = await loadCrmState();
        setTemplates(Array.isArray(state.checklistTemplates) ? state.checklistTemplates : []);
        const events = Array.isArray(state.events) ? state.events : [];
        const checklists = (state.eventChecklists && typeof state.eventChecklists === 'object') ? state.eventChecklists : {};
        const ev = events.find(x => x.id === id);
        setEvtId(id);
        setEvtData(ev || null);
        const chk = checklists[id] || ev?.checklist;
        setEvtTplId(String(chk?.templateId || ''));
        setEvtNotes(chk?.notes || '');
        setEvtItems(chk?.items || []);
        if (eventRef.current) eventRef.current.style.display = 'flex';
      } catch (err) { console.error(err); toast('Error al abrir checklist'); }
    };
    window.addEventListener(APP_EVENT_OPEN_EVENT_CHECKLIST, handler);
    return () => window.removeEventListener(APP_EVENT_OPEN_EVENT_CHECKLIST, handler);
  }, []);

  const closeEvent = () => { if (eventRef.current) eventRef.current.style.display = 'none'; };

  const handleEvtTpl = (e) => {
    const id = e.target.value;
    setEvtTplId(id);
    if (!id) { setEvtItems([]); return; }
    const tpl = templates.find(t => t.id === Number(id));
    if (!tpl) return;
    setEvtItems(tpl.sections.flatMap(s =>
      s.items.map(item => ({ 
        id: item.id, text: item.text, sectionName: s.name,
        sectionType: s.type || 'operativa',
        status: 'pendiente',
        rating: null,
        comment: '' 
      }))
    ));
  };

  const setRating = (id, rating) => setEvtItems(prev => prev.map(i => i.id === id ? { ...i, rating } : i));

  const setSt = (id, status) => setEvtItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  const setCm = (id, comment) => setEvtItems(prev => prev.map(i => i.id === id ? { ...i, comment } : i));

  const evtTotal = evtItems.length;
  const evtDone = evtItems.filter(i => i.status === 'cumplido').length;
  const evtProgress = evtTotal > 0 ? Math.round(((evtDone + evtItems.filter(i => i.status === 'en_proceso' || i.status === 'no_aplica').length) / evtTotal) * 100) : 0;
  const evtSat = (evtTotal - evtItems.filter(i => i.status === 'no_aplica').length) > 0
    ? Math.round((evtDone / (evtTotal - evtItems.filter(i => i.status === 'no_aplica').length)) * 100) : 0;

  // Satisfaction calculations
  const evalItems = evtItems.filter(i => i.sectionType === 'evaluacion');
  const ratedItems = evalItems.filter(i => i.rating !== null);
  const satisfactionAvg = ratedItems.length > 0
    ? (ratedItems.reduce((sum, i) => sum + (RATING_LEVELS.find(r => r.value === i.rating)?.score || 0), 0) / ratedItems.length)
    : 0;
  const satisfactionPct = Math.round((satisfactionAvg / 4) * 100);

  const handleSaveEvent = async () => {
    if (!evtId) { toast('No hay evento'); return; }
    setSaving(true);
    try {
      const state = await loadCrmState();
      const cur = (state.eventChecklists && typeof state.eventChecklists === 'object') ? state.eventChecklists : {};
      await saveCrmState({ ...state, eventChecklists: { ...cur, [evtId]: { templateId: evtTplId ? Number(evtTplId) : null, notes: evtNotes, items: evtItems } } });
      toast('Check list guardado ✓');
      window.dispatchEvent(new Event('stateUpdated'));
      closeEvent();
    } catch (err) { console.error(err); toast('Error al guardar'); }
    finally { setSaving(false); }
  };

  return (
    <>
      {/* ═══ MODAL: Check List del Evento (abierto desde calendario) ═══ */}
      <div
        ref={eventRef}
        id="eventChecklistBackdrop"
        onClick={e => { if (e.target.id === 'eventChecklistBackdrop') closeEvent(); }}
        style={{
          display: 'none',
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(15,23,42,0.35)',
          alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}
      >
        <div role="dialog" style={{
          width: 'min(94vw, 820px)',
          height: 'min(92vh, 860px)',
          display: 'flex', flexDirection: 'column',
          background: '#ffffff', border: '1px solid #e2e8f0',
          borderRadius: '12px', boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>✅ Check List — Evento</div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>
                {evtData ? `${evtData.eventName || evtData.client || evtData.name || ''} — ${evtData.date || evtData.eventDate || ''}` : ''}
              </div>
            </div>
            <button className="btn-exit" type="button" onClick={closeEvent}><XIcon /></button>
          </div>

          {/* Body */}
          <div style={{ flex: '1 1 0', overflowY: 'scroll', overflowX: 'hidden', overscrollBehavior: 'contain', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafd' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <span style={s.label}>Plantilla</span>
                <select value={evtTplId} onChange={handleEvtTpl} style={s.select}>
                  <option value="">-- Seleccionar --</option>
                  {templates.filter(t => t.active !== false).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <span style={s.label}>Fecha</span>
                <input type="text" readOnly value={evtData?.date || evtData?.eventDate || ''} style={{ ...s.input, background: '#f8fafc' }} />
              </div>
              <div>
                <span style={s.label}>Evento</span>
                <input type="text" readOnly value={evtData?.eventName || evtData?.client || evtData?.name || ''} style={{ ...s.input, background: '#f8fafc' }} />
              </div>
            </div>

            <div>
              <span style={s.label}>Notas / Sugerencias</span>
              <textarea value={evtNotes} onChange={e => setEvtNotes(e.target.value)}
                rows={2} placeholder="Observaciones generales..."
                style={{ ...s.input, resize: 'vertical', minHeight: '50px' }} />
            </div>

            {/* Progress + Satisfaction */}
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700 }}>
                <span>Avance <span style={{ color: '#6366f1' }}>{evtProgress}%</span></span>
                <span>Operativo <span style={{ color: '#10b981' }}>{evtSat}%</span></span>
              </div>
              <div style={{ height: '8px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg,#6366f1,#10b981)', width: `${evtProgress}%`, transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.72rem', color: '#94a3b8' }}>
                <span>✅ {evtDone} cumplido(s)</span>
                <span>🔄 {evtItems.filter(i => i.status === 'en_proceso').length} en proceso</span>
                <span>⏳ {evtItems.filter(i => i.status === 'pendiente').length} pendiente(s)</span>
                <span>🚫 {evtItems.filter(i => i.status === 'no_aplica').length} no aplica</span>
              </div>

              {/* Satisfaction score bar */}
              {evalItems.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
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
            </div>

            {/* Items table */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: '#ffffff' }}>
              {evtItems.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  Selecciona una plantilla para cargar los puntos a evaluar
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', width: '36px' }}>#</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Punto</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', width: '200px' }}>
                        {evtItems.some(i => i.sectionType === 'evaluacion') ? 'Calificación' : 'Estado'}
                      </th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', width: '180px' }}>Comentario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evtItems.map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: item.sectionType === 'evaluacion' ? '#faf5ff' : 'transparent' }}>
                        <td style={{ padding: '6px 10px', color: '#94a3b8', fontWeight: 600, fontSize: '0.72rem' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ color: '#6366f1', fontSize: '0.7rem', fontWeight: 600 }}>
                            {item.sectionName ? `[${item.sectionName}] ` : ''}
                            {item.sectionType === 'evaluacion' && <span style={{ color: '#7c3aed', fontWeight: 700 }}>⭐ </span>}
                          </span>
                          <span style={{ color: '#0f172a', fontWeight: 500 }}>{item.text}</span>
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          {item.sectionType === 'evaluacion' ? (
                            <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                              {RATING_LEVELS.map(r => (
                                <button
                                  key={r.value}
                                  type="button"
                                  onClick={() => setRating(item.id, item.rating === r.value ? null : r.value)}
                                  title={r.label}
                                  style={{
                                    padding: '4px 7px', borderRadius: '6px', border: item.rating === r.value ? `2px solid ${r.value === 'malo' ? '#ef4444' : r.value === 'regular' ? '#eab308' : r.value === 'bueno' ? '#22c55e' : '#a855f7'}` : '1.5px solid #e2e8f0',
                                    background: item.rating === r.value ? (r.value === 'malo' ? '#fef2f2' : r.value === 'regular' ? '#fffbeb' : r.value === 'bueno' ? '#f0fdf4' : '#faf5ff') : '#fff',
                                    fontSize: '0.7rem', fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.12s',
                                    color: item.rating === r.value ? (r.value === 'malo' ? '#dc2626' : r.value === 'regular' ? '#ca8a04' : r.value === 'bueno' ? '#16a34a' : '#9333ea') : '#94a3b8',
                                    opacity: item.rating && item.rating !== r.value ? 0.5 : 1,
                                  }}
                                >
                                  {r.emoji} {r.label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <select value={item.status} onChange={e => setSt(item.id, e.target.value)}
                              style={{ padding: '4px 8px', borderRadius: '6px', border: '1.5px solid #d1d9e6', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: item.status === 'cumplido' ? '#f0fdf4' : item.status === 'en_proceso' ? '#fffbeb' : item.status === 'no_aplica' ? '#f0f9ff' : '#ffffff', color: item.status === 'cumplido' ? '#16a34a' : item.status === 'en_proceso' ? '#d97706' : item.status === 'no_aplica' ? '#0ea5e9' : '#64748b', appearance: 'auto' }}>
                              <option value="pendiente">Pendiente</option>
                              <option value="en_proceso">En proceso</option>
                              <option value="cumplido">Cumplido</option>
                              <option value="no_aplica">No aplica</option>
                            </select>
                          )}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input type="text" value={item.comment} onChange={e => setCm(item.id, e.target.value)}
                            placeholder="..." style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1.5px solid #e2e8f0', fontSize: '0.75rem', outline: 'none', background: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ flexShrink: 0, padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
            <button className="btn-exit" type="button" onClick={closeEvent}>Cerrar</button>
            <button type="button" onClick={handleSaveEvent} disabled={saving}
              style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#10b981', color: '#fff', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : 'Guardar check list'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
