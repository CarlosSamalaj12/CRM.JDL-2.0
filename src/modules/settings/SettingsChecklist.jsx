import React, { useState, useEffect, useRef } from 'react';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';
import { toast, modernConfirm } from '../../utils/toast';
import { APP_EVENT_OPEN_EVENT_CHECKLIST } from '../../utils/appEvents';

export default function SettingsChecklist() {
  // ── Refs for both modals ──
  const templateBackdropRef = useRef(null);
  const eventBackdropRef = useRef(null);

  // ── Modal-open flags ──
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);

  // ── Shared data ──
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);

  // ══════════════════════════════════════
  //  MODAL 1 — Template Editor state
  // ══════════════════════════════════════
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateActive, setTemplateActive] = useState(true);

  // Section form
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [sectionName, setSectionName] = useState('');

  // Item form
  const [itemText, setItemText] = useState('');
  const [itemSectionId, setItemSectionId] = useState('');

  // ══════════════════════════════════════
  //  MODAL 2 — Event Checklist state
  // ══════════════════════════════════════
  const [eventId, setEventId] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [eventTemplateId, setEventTemplateId] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventItems, setEventItems] = useState([]);

  // ── Derived: currently-selected template object ──
  const selectedTemplate = templates.find(t => t.id === Number(selectedTemplateId)) || null;

  // ──────────────────────────────────────
  //  MutationObservers: detect modal open
  // ──────────────────────────────────────
  useEffect(() => {
    const obs1 = new MutationObserver(() => {
      if (templateBackdropRef.current) {
        setIsTemplateOpen(!templateBackdropRef.current.hidden);
      }
    });
    if (templateBackdropRef.current) {
      obs1.observe(templateBackdropRef.current, { attributes: true, attributeFilter: ['hidden'] });
      setIsTemplateOpen(!templateBackdropRef.current.hidden);
    }

    const obs2 = new MutationObserver(() => {});
    if (eventBackdropRef.current) {
      obs2.observe(eventBackdropRef.current, { attributes: true, attributeFilter: ['hidden'] });
    }

    return () => { obs1.disconnect(); obs2.disconnect(); };
  }, []);

  // ── Reload when template modal opens ──
  useEffect(() => {
    if (isTemplateOpen) loadData();
  }, [isTemplateOpen]);

  // ──────────────────────────────────────
  //  Load / persist helpers
  // ──────────────────────────────────────
  const loadData = async () => {
    try {
      const state = await loadCrmState();
      const loaded = Array.isArray(state.checklistTemplates) ? state.checklistTemplates : [];
      setTemplates(loaded);
      resetTemplateForm();
    } catch (err) {
      console.error('Error al cargar checklist templates:', err);
      toast('Error al cargar plantillas de checklist');
    }
  };

  const persistTemplates = async (updatedTemplates) => {
    const currentState = await loadCrmState();
    await saveCrmState({ ...currentState, checklistTemplates: updatedTemplates });
    window.dispatchEvent(new Event('stateUpdated'));
  };

  // ──────────────────────────────────────
  //  Close helpers
  // ──────────────────────────────────────
  const handleCloseTemplate = () => {
    if (templateBackdropRef.current) {
      templateBackdropRef.current.hidden = true;
      setIsTemplateOpen(false);
    }
  };

  const handleCloseEvent = () => {
    if (eventBackdropRef.current) {
      eventBackdropRef.current.hidden = true;
    }
  };

  // ══════════════════════════════════════════════
  //  TEMPLATE EDITOR — handlers
  // ══════════════════════════════════════════════

  const resetTemplateForm = () => {
    setSelectedTemplateId('');
    setTemplateName('');
    setTemplateActive(true);
    resetSectionForm();
    setItemText('');
    setItemSectionId('');
  };

  const resetSectionForm = () => {
    setSelectedSectionId('');
    setSectionName('');
  };

  // ── Template select ──
  const handleTemplateSelectChange = (e) => {
    const id = e.target.value;
    setSelectedTemplateId(id);
    if (id) {
      const tpl = templates.find(t => t.id === Number(id));
      if (tpl) {
        setTemplateName(tpl.name);
        setTemplateActive(tpl.active);
        resetSectionForm();
        setItemText('');
        setItemSectionId(tpl.sections.length > 0 ? String(tpl.sections[0].id) : '');
      }
    } else {
      resetTemplateForm();
    }
  };

  // ── New template button ──
  const handleNewTemplate = () => {
    resetTemplateForm();
  };

  // ── Disable button ──
  const handleDisableTemplate = async () => {
    if (!selectedTemplate) return;
    const confirmed = await modernConfirm({
      title: 'Inhabilitar Plantilla',
      message: `¿Desea inhabilitar la plantilla "${selectedTemplate.name}"?`,
      confirmText: 'Inhabilitar',
      cancelText: 'Cancelar'
    });
    if (!confirmed) return;

    try {
      const updated = templates.map(t =>
        t.id === selectedTemplate.id ? { ...t, active: false } : t
      );
      await persistTemplates(updated);
      setTemplates(updated);
      setTemplateActive(false);
      toast('Plantilla inhabilitada');
    } catch (err) {
      console.error(err);
      toast('Error al inhabilitar plantilla');
    }
  };

  // ── Section: save / create ──
  const handleSaveSection = () => {
    const name = sectionName.trim();
    if (!name) { toast('Nombre de sección es requerido'); return; }
    if (!selectedTemplate) { toast('Primero seleccione o guarde una plantilla'); return; }

    let updatedTemplates;
    if (selectedSectionId) {
      // Edit existing section name
      updatedTemplates = templates.map(t => {
        if (t.id !== selectedTemplate.id) return t;
        return {
          ...t,
          sections: t.sections.map(s =>
            s.id === Number(selectedSectionId) ? { ...s, name } : s
          )
        };
      });
    } else {
      // New section
      const newSection = { id: Date.now(), name, items: [] };
      updatedTemplates = templates.map(t => {
        if (t.id !== selectedTemplate.id) return t;
        return { ...t, sections: [...t.sections, newSection] };
      });
    }
    setTemplates(updatedTemplates);
    resetSectionForm();
    toast(selectedSectionId ? 'Sección actualizada' : 'Sección agregada');
  };

  // ── Section: edit from table ──
  const handleEditSection = (section) => {
    setSelectedSectionId(String(section.id));
    setSectionName(section.name);
  };

  // ── Section: delete ──
  const handleDeleteSection = async (sectionId) => {
    const confirmed = await modernConfirm({
      title: 'Eliminar Sección',
      message: '¿Desea eliminar esta sección y todos sus puntos?',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    });
    if (!confirmed) return;

    const updatedTemplates = templates.map(t => {
      if (t.id !== selectedTemplate.id) return t;
      return { ...t, sections: t.sections.filter(s => s.id !== sectionId) };
    });
    setTemplates(updatedTemplates);
    if (String(sectionId) === selectedSectionId) resetSectionForm();
    if (String(sectionId) === itemSectionId) setItemSectionId('');
    toast('Sección eliminada');
  };

  // ── Add point ──
  const handleAddPoint = () => {
    const text = itemText.trim();
    if (!text) { toast('Texto del punto es requerido'); return; }
    if (!selectedTemplate) { toast('Primero seleccione o guarde una plantilla'); return; }
    if (!itemSectionId) { toast('Seleccione una sección para el punto'); return; }

    const updatedTemplates = templates.map(t => {
      if (t.id !== selectedTemplate.id) return t;
      return {
        ...t,
        sections: t.sections.map(s => {
          if (s.id !== Number(itemSectionId)) return s;
          const newItem = { id: Date.now(), text, order: s.items.length + 1 };
          return { ...s, items: [...s.items, newItem] };
        })
      };
    });
    setTemplates(updatedTemplates);
    setItemText('');
    toast('Punto agregado');
  };

  // ── Delete point ──
  const handleDeletePoint = async (sectionId, itemId) => {
    const confirmed = await modernConfirm({
      title: 'Eliminar Punto',
      message: '¿Desea eliminar este punto?',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    });
    if (!confirmed) return;

    const updatedTemplates = templates.map(t => {
      if (t.id !== selectedTemplate.id) return t;
      return {
        ...t,
        sections: t.sections.map(s => {
          if (s.id !== sectionId) return s;
          const filtered = s.items.filter(i => i.id !== itemId);
          // Re-order
          const reordered = filtered.map((item, idx) => ({ ...item, order: idx + 1 }));
          return { ...s, items: reordered };
        })
      };
    });
    setTemplates(updatedTemplates);
    toast('Punto eliminado');
  };

  // ── Save template (persist) ──

  // Save template sections & items (full persist of in-memory state) ──
  const handleSaveAll = async () => {
    const name = templateName.trim();
    if (!name) { toast('Nombre de plantilla es requerido'); return; }

    setSaving(true);
    try {
      let updatedTemplates;
      const isNew = !selectedTemplateId;

      if (isNew) {
        // Create template first
        const tplSections = selectedTemplate ? selectedTemplate.sections : [];
        const newTemplate = {
          id: Date.now(),
          name,
          active: templateActive,
          sections: tplSections
        };
        updatedTemplates = [...templates, newTemplate];
        setSelectedTemplateId(String(newTemplate.id));
      } else {
        // Update existing — merge current sections state from memory
        updatedTemplates = templates.map(t => {
          if (t.id !== Number(selectedTemplateId)) return t;
          return { ...t, name, active: templateActive };
        });
      }

      await persistTemplates(updatedTemplates);
      setTemplates(updatedTemplates);
      toast(isNew ? 'Plantilla creada' : 'Plantilla guardada');
    } catch (err) {
      console.error(err);
      toast('Error al guardar plantilla');
    } finally {
      setSaving(false);
    }
  };

  // ── Flatten all items for the items table ──
  const allItems = selectedTemplate
    ? selectedTemplate.sections.flatMap(s =>
        s.items.map(item => ({ ...item, sectionName: s.name, sectionId: s.id }))
      )
    : [];

  // ══════════════════════════════════════════════
  //  EVENT CHECKLIST — handlers
  // ══════════════════════════════════════════════

  useEffect(() => {
    const openChecklist = async (evtId) => {
      try {
        const state = await loadCrmState();
        const loadedTemplates = Array.isArray(state.checklistTemplates) ? state.checklistTemplates : [];
        const events = Array.isArray(state.events) ? state.events : [];
        const eventChecklistsObj = state.eventChecklists && typeof state.eventChecklists === 'object' ? state.eventChecklists : {};
        const evt = events.find(e => e.id === evtId);

        setTemplates(loadedTemplates);
        setEventId(evtId);
        setEventData(evt || null);

        const chk = eventChecklistsObj[evtId] || evt?.checklist;
        if (chk) {
          setEventTemplateId(String(chk.templateId || ''));
          setEventNotes(chk.notes || '');
          setEventItems(chk.items || []);
        } else {
          setEventTemplateId('');
          setEventNotes('');
          setEventItems([]);
        }

        if (eventBackdropRef.current) {
          eventBackdropRef.current.hidden = false;
        }
      } catch (err) {
        console.error(err);
        toast('Error al abrir checklist del evento');
      }
    };

    const handleOpenChecklistEvent = (event) => {
      const evtId = event?.detail?.eventId;
      if (evtId) openChecklist(evtId);
    };

    window.addEventListener(APP_EVENT_OPEN_EVENT_CHECKLIST, handleOpenChecklistEvent);
    return () => {
      window.removeEventListener(APP_EVENT_OPEN_EVENT_CHECKLIST, handleOpenChecklistEvent);
    };
  }, []);

  // ── Apply template to event ──
  const handleEventTemplateChange = (e) => {
    const tplId = e.target.value;
    setEventTemplateId(tplId);

    if (!tplId) {
      setEventItems([]);
      return;
    }

    const tpl = templates.find(t => t.id === Number(tplId));
    if (!tpl) return;

    // Build flat items list from template
    const items = tpl.sections.flatMap(s =>
      s.items.map(item => ({
        id: item.id,
        text: item.text,
        sectionName: s.name,
        status: 'pendiente',
        comment: ''
      }))
    );
    setEventItems(items);
  };

  // ── Update item status ──
  const handleEventItemStatus = (itemId, status) => {
    setEventItems(prev => prev.map(i => i.id === itemId ? { ...i, status } : i));
  };

  // ── Update item comment ──
  const handleEventItemComment = (itemId, comment) => {
    setEventItems(prev => prev.map(i => i.id === itemId ? { ...i, comment } : i));
  };

  // ── Progress calculations ──
  const totalItems = eventItems.length;
  const cumplidos = eventItems.filter(i => i.status === 'cumplido').length;
  const enProceso = eventItems.filter(i => i.status === 'en_proceso').length;
  const noAplica = eventItems.filter(i => i.status === 'no_aplica').length;
  const avance = totalItems > 0 ? Math.round(((cumplidos + enProceso + noAplica) / totalItems) * 100) : 0;
  const satisfaccion = (totalItems - noAplica) > 0 ? Math.round((cumplidos / (totalItems - noAplica)) * 100) : 0;

  // ── Save event checklist ──
  const handleSaveEventChecklist = async () => {
    if (!eventId) { toast('No hay evento seleccionado'); return; }

    setSaving(true);
    try {
      const currentState = await loadCrmState();
      const currentChecklists = currentState.eventChecklists && typeof currentState.eventChecklists === 'object' ? currentState.eventChecklists : {};

      const nextChecklists = {
        ...currentChecklists,
        [eventId]: {
          templateId: eventTemplateId ? Number(eventTemplateId) : null,
          notes: eventNotes,
          items: eventItems
        }
      };

      await saveCrmState({
        ...currentState,
        eventChecklists: nextChecklists
      });
      toast('Check list guardado');
      window.dispatchEvent(new Event('stateUpdated'));
      handleCloseEvent();
    } catch (err) {
      console.error(err);
      toast('Error al guardar check list');
    } finally {
      setSaving(false);
    }
  };

  // ══════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════
  return (
    <>
      {/* ═══ MODAL 1: Template Editor ═══ */}
      <div
        className="modalBackdrop"
        id="checklistTemplateBackdrop"
        ref={templateBackdropRef}
        hidden
        onClick={(e) => { if (e.target.id === 'checklistTemplateBackdrop') handleCloseTemplate(); }}
      >
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="checklistTemplateTitle">
          <div className="modalHeader">
            <div>
              <div className="modalTitle" id="checklistTemplateTitle">Configurar Check List</div>
              <div className="modalSubtitle">Define plantillas, secciones y puntos para eventos</div>
            </div>
            <button className="btn-exit" id="btnChecklistTemplateClose" type="button" title="Cerrar" onClick={handleCloseTemplate}>
            <svg className="crm-icon-x" viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l10 10M14 4l-10 10" /></svg>
          </button>
          </div>
          <div className="modalBody">
            {/* Row 1: Template select + name */}
            <div className="settings-field-group">
              <label className="settings-modern-field">
                <span>Plantilla existente</span>
                <select
                  id="checklistTemplateSelect"
                  value={selectedTemplateId}
                  onChange={handleTemplateSelectChange}
                >
                  <option value="">-- Crear nueva plantilla --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.active ? '(Activa)' : '(Inhabilitada)'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-modern-field">
                <span>Nombre de plantilla</span>
                <input
                  id="checklistTemplateName"
                  type="text"
                  placeholder="Ej: Checklist corporativo"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </label>
            </div>

            {/* Row 2: Active + actions */}
                        <div className="settings-field-group">
              <div className="settings-modern-field">
                <span>Estado plantilla</span>
                <label className="settings-switch-inline">
                  <input
                    id="checklistTemplateActive"
                    type="checkbox"
                    checked={templateActive}
                    onChange={(e) => setTemplateActive(e.target.checked)}
                  />
                  <span>{templateActive ? 'Plantilla activa' : 'Plantilla inactiva'}</span>
                </label>
              </div>
                            <div className="settings-modern-field">
                <span>Acciones plantilla</span>
                <div className="rightActions">
                  <button className="settings-cancel-btn" id="btnChecklistTemplateNew" type="button" onClick={handleNewTemplate}>Nueva plantilla</button>
                  <button className="settings-danger-btn" id="btnChecklistTemplateDisable" type="button" onClick={handleDisableTemplate} disabled={!selectedTemplateId}>Inhabilitar</button>
                </div>
              </div>
            </div>

            {/* Row 3: Point input + section selector for adding */}
                        <div className="settings-field-group">
              <label className="settings-modern-field">
                <span>Punto a chequear</span>
                <input
                  id="checklistTemplateInput"
                  type="text"
                  placeholder="Ej: Montaje de mesas completo"
                  value={itemText}
                  onChange={(e) => setItemText(e.target.value)}
                />
              </label>
              <label className="settings-modern-field">
                <span>Seccion</span>
                <select
                  id="checklistTemplateSectionSelect"
                  value={itemSectionId}
                  onChange={(e) => setItemSectionId(e.target.value)}
                >
                  <option value="">-- Seleccione sección --</option>
                  {selectedTemplate && selectedTemplate.sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Row 4: Section edit + section name */}
                        <div className="settings-field-group">
              <label className="settings-modern-field">
                <span>Seccion a editar</span>
                <select
                  id="checklistTemplateSectionEditSelect"
                  value={selectedSectionId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    setSelectedSectionId(sid);
                    if (sid && selectedTemplate) {
                      const sec = selectedTemplate.sections.find(s => s.id === Number(sid));
                      if (sec) setSectionName(sec.name);
                    } else {
                      setSectionName('');
                    }
                  }}
                >
                  <option value="">-- Nueva sección --</option>
                  {selectedTemplate && selectedTemplate.sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
                            <label className="settings-modern-field">
                <span>Nueva o editar seccion</span>
                <input
                  id="checklistTemplateSectionInput"
                  type="text"
                  placeholder="Ej: Salon"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                />
              </label>
            </div>

            {/* Row 5: Section actions + point actions */}
                        <div className="settings-field-group">
              <div className="settings-modern-field">
                <span>Acciones seccion</span>
                <div className="rightActions">
                  <button className="settings-accent-btn" id="btnChecklistTemplateAddSection" type="button" onClick={handleSaveSection}>Guardar seccion</button>
                  <button className="settings-cancel-btn" id="btnChecklistTemplateResetSection" type="button" onClick={resetSectionForm}>Nueva seccion</button>
                </div>
              </div>
              <div className="settings-modern-field">
                <span>Acciones punto</span>
                <div className="rightActions">
                  <button className="settings-primary-btn" id="btnChecklistTemplateAdd" type="button" onClick={handleAddPoint}>Agregar punto</button>
                </div>
              </div>
            </div>

            {/* Sections table */}
                        <div className="settings-table-wrap">
              <table className="settings-table">
                <thead>
                  <tr>
                    <th>Seccion</th>
                    <th>Puntos</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="checklistTemplateSectionsBody">
                  {(!selectedTemplate || selectedTemplate.sections.length === 0) ? (
                    <tr>
                      <td colSpan="3" className="settings-td-center settings-empty-row">
                        {selectedTemplate ? 'No hay secciones' : 'Seleccione una plantilla'}
                      </td>
                    </tr>
                  ) : (
                    selectedTemplate.sections.map(s => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{s.items.length} punto(s)</td>
                        <td className="settings-td-center">
                          <div className="settings-table-actions">
                            <button
                              type="button"
                              title="Editar sección"
                              onClick={() => handleEditSection(s)}
                            >✎</button>
                            <button
                              type="button"
                              title="Eliminar sección"
                              className="danger"
                              onClick={() => handleDeleteSection(s.id)}
                            >✕</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Items table */}
                        <div className="settings-table-wrap">
              <table className="settings-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Seccion</th>
                    <th>Punto</th>
                    <th>Orden</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="checklistTemplateBody">
                  {allItems.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="settings-td-center settings-empty-row">
                        {selectedTemplate ? 'No hay puntos' : 'Seleccione una plantilla'}
                      </td>
                    </tr>
                  ) : (
                    allItems.map((item, idx) => (
                      <tr key={item.id}>
                        <td>{idx + 1}</td>
                        <td>{item.sectionName}</td>
                        <td>{item.text}</td>
                        <td>{item.order}</td>
                        <td className="settings-td-center">
                          <div className="settings-table-actions">
                            <button
                              type="button"
                              title="Eliminar punto"
                              className="danger"
                              onClick={() => handleDeletePoint(item.sectionId, item.id)}
                            >✕</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="modalFooter">
            <div></div>
            <div className="rightActions">
              <button className="btn-exit" type="button" onClick={handleCloseTemplate}>Cerrar</button>
              <button
                className="settings-primary-btn"
                id="btnChecklistTemplateSave"
                type="button"
                disabled={saving}
                onClick={handleSaveAll}
              >
                {saving ? 'Guardando...' : 'Guardar plantilla'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MODAL 2: Event Checklist Fill ═══ */}
      <div
        className="modalBackdrop"
        id="eventChecklistBackdrop"
        ref={eventBackdropRef}
        hidden
        onClick={(e) => { if (e.target.id === 'eventChecklistBackdrop') handleCloseEvent(); }}
      >
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="eventChecklistTitle">
          <div className="modalHeader">
            <div>
              <div className="modalTitle" id="eventChecklistTitle">Hotel Jardines del Lago - Check List</div>
              <div className="modalSubtitle" id="eventChecklistSubtitle">
                {eventData ? `${eventData.eventName || eventData.client || ''} — ${eventData.date || ''}` : '-'}
              </div>
            </div>
            <button className="btn-exit" id="btnEventChecklistClose" type="button" title="Cerrar" onClick={handleCloseEvent}>
            <svg className="crm-icon-x" viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l10 10M14 4l-10 10" /></svg>
          </button>
          </div>
          <div className="modalBody">
            {/* Template select */}
            <div className="settings-modern-field">
              <span>Plantilla</span>
              <select
                id="eventChecklistTemplateSelect"
                value={eventTemplateId}
                onChange={handleEventTemplateChange}
                >
                  <option value="">-- Seleccione plantilla --</option>
                  {templates.filter(t => t.active).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
            </div>

            {/* Date + Event name */}
            <div className="settings-field-group">
              <label className="settings-modern-field">
                <span>Fecha</span>
                <input
                  id="eventChecklistDate"
                  type="text"
                  readOnly
                  value={eventData?.date || eventData?.eventDate || ''}
                />
              </label>
              <label className="settings-modern-field">
                <span>Evento</span>
                <input
                  id="eventChecklistEventName"
                  type="text"
                  readOnly
                  value={eventData?.eventName || eventData?.client || ''}
                />
              </label>
            </div>

            {/* Notes */}
            <label className="settings-modern-field">
              <span>Sugerencias / comentarios</span>
              <textarea
                id="eventChecklistNotes"
                rows="2"
                placeholder="Observaciones generales del check list"
                value={eventNotes}
                onChange={(e) => setEventNotes(e.target.value)}
              ></textarea>
            </label>

            {/* Progress */}
            <div className="checklistProgressCard">
              <div className="checklistProgressHead">
                <strong id="eventChecklistProgressLabel">Avance {avance}%</strong>
                <span id="eventChecklistSatisfactionLabel">Satisfaccion {satisfaccion}%</span>
              </div>
              <div className="checklistProgressTrack" aria-hidden="true">
                <div
                  className="checklistProgressFill"
                  id="eventChecklistProgressFill"
                  style={{ width: `${avance}%` }}
                ></div>
              </div>
            </div>

            {/* Items table */}
            <div className="settings-table-wrap">
              <table className="settings-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Punto a chequear</th>
                    <th>Estado</th>
                    <th>Comentario</th>
                  </tr>
                </thead>
                <tbody id="eventChecklistBody">
                  {eventItems.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="settings-td-center settings-empty-row">
                        Seleccione una plantilla para cargar puntos
                      </td>
                    </tr>
                  ) : (
                    eventItems.map((item, idx) => (
                      <tr key={item.id}>
                        <td>{idx + 1}</td>
                        <td>{item.sectionName ? `[${item.sectionName}] ` : ''}{item.text}</td>
                        <td>
                          <select
                            value={item.status}
                            onChange={(e) => handleEventItemStatus(item.id, e.target.value)}
                            className="settings-input-compact"
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="en_proceso">En proceso</option>
                            <option value="cumplido">Cumplido</option>
                            <option value="no_aplica">No aplica</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={item.comment}
                            onChange={(e) => handleEventItemComment(item.id, e.target.value)}
                            placeholder="Comentario"
                            className="settings-input-compact"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modalFooter">
            <div></div>
            <div className="rightActions">
              <button className="btn-exit" id="btnEventChecklistDiscard" type="button" onClick={handleCloseEvent}>Cerrar</button>
              <button
                className="settings-primary-btn"
                id="btnEventChecklistSave"
                type="button"
                disabled={saving}
                onClick={handleSaveEventChecklist}
              >
                {saving ? 'Guardando...' : 'Guardar check list'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


