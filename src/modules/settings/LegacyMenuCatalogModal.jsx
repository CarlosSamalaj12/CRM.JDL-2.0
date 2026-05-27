import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast, modernConfirm } from '../../utils/toast';

const KIND_LABELS = {
  plato_fuerte: 'Proteina / Plato base',
  preparacion: 'Preparacion',
  salsa: 'Salsa / Aderezo',
  guarnicion: 'Guarnicion',
  postre: 'Postre',
  bebida: 'Bebida',
  comentario: 'Comentario adicional',
  montaje_tipo: 'Tipo de montaje',
  montaje_adicional: 'Adicional de montaje'
};

export default function LegacyMenuCatalogModal() {
  // ── Refs for both backdrops ──
  const suggestionsRef = useRef(null);
  const catalogRef = useRef(null);

  // ── Visibility state ──
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  // ── Shared data ──
  const [menuCatalog, setMenuCatalog] = useState([]);
  const [menuSuggestions, setMenuSuggestions] = useState([]);

  // ── Suggestions modal state ──
  const [sugProteinId, setSugProteinId] = useState('');
  const [sugPreparationId, setSugPreparationId] = useState('');
  const [checkedSalsas, setCheckedSalsas] = useState([]);
  const [checkedGuarniciones, setCheckedGuarniciones] = useState([]);
  const [checkedPostres, setCheckedPostres] = useState([]);
  const [checkedBebidas, setCheckedBebidas] = useState([]);
  const [checkedMontajeTipos, setCheckedMontajeTipos] = useState([]);
  const [checkedMontajeAdicionales, setCheckedMontajeAdicionales] = useState([]);

  // ── Catalog modal state ──
  const [catKind, setCatKind] = useState('plato_fuerte');
  const [catProteinId, setCatProteinId] = useState('');
  const [catName, setCatName] = useState('');
  const [catDishType, setCatDishType] = useState('NORMAL');
  const [catNoProtein, setCatNoProtein] = useState(false);
  const [catEditId, setCatEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  // ── MutationObserver for suggestions backdrop ──
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (suggestionsRef.current) {
        setSuggestionsOpen(!suggestionsRef.current.hidden);
      }
    });
    if (suggestionsRef.current) {
      observer.observe(suggestionsRef.current, { attributes: true, attributeFilter: ['hidden'] });
      setSuggestionsOpen(!suggestionsRef.current.hidden);
    }
    return () => observer.disconnect();
  }, []);

  // ── MutationObserver for catalog backdrop ──
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (catalogRef.current) {
        setCatalogOpen(!catalogRef.current.hidden);
      }
    });
    if (catalogRef.current) {
      observer.observe(catalogRef.current, { attributes: true, attributeFilter: ['hidden'] });
      setCatalogOpen(!catalogRef.current.hidden);
    }
    return () => observer.disconnect();
  }, []);

  // ── Load data when either modal opens ──
  useEffect(() => {
    if (suggestionsOpen || catalogOpen) {
      loadData();
    }
  }, [suggestionsOpen, catalogOpen]);

  const loadData = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      const state = data?.state || data || {};
      setMenuCatalog(Array.isArray(state.menuCatalog) ? state.menuCatalog : []);
      setMenuSuggestions(Array.isArray(state.menuSuggestions) ? state.menuSuggestions : []);
    } catch (err) {
      console.error('Error al cargar catalogo:', err);
      toast('Error al cargar datos del catalogo');
    }
  };

  // ── Persist helper ──
  const persistState = async (updates) => {
    const stateRes = await fetch('/api/state');
    const stateData = await stateRes.json();
    const currentState = stateData.state || {};
    await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: { ...currentState, ...updates } })
    });
    window.dispatchEvent(new Event('stateUpdated'));
  };

  // ── Close helpers ──
  const closeSuggestions = () => {
    if (suggestionsRef.current) {
      suggestionsRef.current.hidden = true;
      setSuggestionsOpen(false);
    }
  };

  const closeCatalog = () => {
    if (catalogRef.current) {
      catalogRef.current.hidden = true;
      setCatalogOpen(false);
    }
  };

  // ── Switch between modals ──
  const openCatalogFromSuggestions = () => {
    closeSuggestions();
    if (catalogRef.current) {
      catalogRef.current.hidden = false;
      setCatalogOpen(true);
    }
  };

  const openSuggestionsFromCatalog = () => {
    closeCatalog();
    if (suggestionsRef.current) {
      suggestionsRef.current.hidden = false;
      setSuggestionsOpen(true);
    }
  };

  const handleOpenSuggestionsFor = (item) => {
    closeCatalog();
    if (item.kind === 'plato_fuerte') {
      setSugProteinId(String(item.id));
      setSugPreparationId('');
    } else if (item.kind === 'preparacion') {
      setSugProteinId(String(item.proteinId || ''));
      setSugPreparationId(String(item.id));
    }
    if (suggestionsRef.current) {
      suggestionsRef.current.hidden = false;
      setSuggestionsOpen(true);
    }
  };

  // ═══════════════════════════════════════════════
  // SUGGESTIONS MODAL LOGIC
  // ═══════════════════════════════════════════════

  const activeProteins = menuCatalog.filter(m => m.kind === 'plato_fuerte' && m.active);
  const activePreparations = menuCatalog.filter(m => m.kind === 'preparacion' && m.proteinId === sugProteinId && m.active);

  const itemsByKind = useCallback((kind) => menuCatalog.filter(m => m.kind === kind && m.active), [menuCatalog]);

  // When protein or preparation changes, load existing suggestion
  useEffect(() => {
    if (sugProteinId && sugPreparationId) {
      const existing = menuSuggestions.find(
        s => String(s.proteinId) === String(sugProteinId) && String(s.preparationId) === String(sugPreparationId)
      );
      if (existing) {
        setCheckedSalsas(existing.salsas || []);
        setCheckedGuarniciones(existing.guarniciones || []);
        setCheckedPostres(existing.postres || []);
        setCheckedBebidas(existing.bebidas || []);
        setCheckedMontajeTipos(existing.montajeTipos || []);
        setCheckedMontajeAdicionales(existing.montajeAdicionales || []);
      } else {
        clearSuggestionChecks();
      }
    } else {
      clearSuggestionChecks();
    }
  }, [sugProteinId, sugPreparationId, menuSuggestions]);

  // Reset preparation when protein changes
  useEffect(() => {
    setSugPreparationId('');
  }, [sugProteinId]);

  const clearSuggestionChecks = () => {
    setCheckedSalsas([]);
    setCheckedGuarniciones([]);
    setCheckedPostres([]);
    setCheckedBebidas([]);
    setCheckedMontajeTipos([]);
    setCheckedMontajeAdicionales([]);
  };

  const toggleCheck = (list, setList, id) => {
    const numId = Number(id);
    setList(prev => prev.includes(numId) ? prev.filter(x => x !== numId) : [...prev, numId]);
  };

  const handleSaveSuggestion = async () => {
    if (!sugProteinId || !sugPreparationId) {
      toast('Selecciona plato base y preparacion');
      return;
    }
    setSaving(true);
    try {
      const entry = {
        proteinId: String(sugProteinId),
        preparationId: String(sugPreparationId),
        salsas: checkedSalsas,
        guarniciones: checkedGuarniciones,
        postres: checkedPostres,
        bebidas: checkedBebidas,
        montajeTipos: checkedMontajeTipos,
        montajeAdicionales: checkedMontajeAdicionales
      };

      let updated = [...menuSuggestions];
      const idx = updated.findIndex(
        s => String(s.proteinId) === String(sugProteinId) && String(s.preparationId) === String(sugPreparationId)
      );
      if (idx >= 0) {
        updated[idx] = entry;
      } else {
        updated.push(entry);
      }

      await persistState({ menuSuggestions: updated });
      setMenuSuggestions(updated);
      toast('Combinacion guardada');
    } catch (err) {
      console.error('Error al guardar combinacion:', err);
      toast('Error al guardar combinacion');
    } finally {
      setSaving(false);
    }
  };

  const renderCheckboxList = (kind, checkedList, setCheckedList) => {
    const items = itemsByKind(kind);
    if (items.length === 0) {
      return <div style={{ color: '#94a3b8', fontSize: '13px', padding: '8px 0' }}>No hay items activos en el catalogo.</div>;
    }
    return items.map(item => (
      <label key={item.id} className="statusSwitchInline" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={checkedList.includes(item.id)}
          onChange={() => toggleCheck(checkedList, setCheckedList, item.id)}
        />
        <span>{item.name}</span>
      </label>
    ));
  };

  // ═══════════════════════════════════════════════
  // CATALOG MODAL LOGIC
  // ═══════════════════════════════════════════════

  const catalogProteins = menuCatalog.filter(m => m.kind === 'plato_fuerte' && m.active);
  const filteredCatalog = menuCatalog.filter(m => m.kind === catKind);

  const resetCatalogForm = () => {
    setCatEditId(null);
    setCatName('');
    setCatProteinId('');
    setCatDishType('NORMAL');
    setCatNoProtein(false);
  };

  // Reset form when kind changes
  useEffect(() => {
    resetCatalogForm();
  }, [catKind]);

  const loadCatalogForEdit = (item) => {
    setCatEditId(item.id);
    setCatName(item.name);
    setCatKind(item.kind);
    setCatProteinId(item.proteinId || '');
    setCatDishType(item.dishType || 'NORMAL');
    setCatNoProtein(item.noProtein || false);
  };

  const handleSaveCatalog = async () => {
    const nameTrimmed = catName.trim();
    if (!nameTrimmed) {
      toast('Nombre es requerido');
      return;
    }
    if (catKind === 'preparacion' && !catProteinId) {
      toast('Selecciona la proteina base para esta preparacion');
      return;
    }

    // Check duplicate name within same kind (and same proteinId for preparaciones)
    const duplicate = menuCatalog.find(m => {
      if (catEditId && m.id === catEditId) return false;
      if (m.kind !== catKind) return false;
      if (m.name.toLowerCase() !== nameTrimmed.toLowerCase()) return false;
      if (catKind === 'preparacion' && String(m.proteinId) !== String(catProteinId)) return false;
      return true;
    });
    if (duplicate) {
      toast('Ya existe un item con ese nombre en esta categoria');
      return;
    }

    setSaving(true);
    try {
      let updated = [...menuCatalog];
      const record = {
        id: catEditId || Date.now(),
        kind: catKind,
        name: nameTrimmed,
        active: true,
        proteinId: catKind === 'preparacion' ? String(catProteinId) : null,
        dishType: catKind === 'plato_fuerte' ? catDishType : 'NORMAL',
        noProtein: catKind === 'plato_fuerte' ? catNoProtein : false
      };

      if (catEditId) {
        const idx = updated.findIndex(m => m.id === catEditId);
        if (idx >= 0) {
          record.active = updated[idx].active; // preserve active status on edit
          updated[idx] = record;
        }
      } else {
        updated.push(record);
      }

      await persistState({ menuCatalog: updated });
      setMenuCatalog(updated);
      toast(catEditId ? 'Item actualizado' : 'Item agregado');
      resetCatalogForm();
    } catch (err) {
      console.error('Error al guardar item:', err);
      toast('Error al guardar item del catalogo');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCatalogActive = async (item) => {
    const action = item.active ? 'inhabilitar' : 'reactivar';
    const confirmed = await modernConfirm({
      title: `${item.active ? 'Inhabilitar' : 'Reactivar'} item`,
      message: `¿Desea ${action} "${item.name}"?`,
      confirmText: item.active ? 'Inhabilitar' : 'Reactivar',
      cancelText: 'Cancelar'
    });
    if (!confirmed) return;

    try {
      const updated = menuCatalog.map(m =>
        m.id === item.id ? { ...m, active: !m.active } : m
      );
      await persistState({ menuCatalog: updated });
      setMenuCatalog(updated);
      toast(item.active ? 'Item inhabilitado' : 'Item reactivado');
    } catch (err) {
      console.error('Error al cambiar estado:', err);
      toast('Error al cambiar estado del item');
    }
  };

  const getItemDetail = (item) => {
    const parts = [];
    if (item.kind === 'plato_fuerte') {
      if (item.dishType && item.dishType !== 'NORMAL') parts.push(item.dishType);
      if (item.noProtein) parts.push('Sin proteina');
    }
    if (item.kind === 'preparacion' && item.proteinId) {
      const protein = menuCatalog.find(m => String(m.id) === String(item.proteinId));
      if (protein) parts.push(`Para: ${protein.name}`);
    }
    return parts.join(' · ') || '—';
  };

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════

  return (
    <>
    {/* ══════════ MODAL 1: SUGGESTIONS ══════════ */}
    <div className="modalBackdrop" id="menuSuggestionsBackdrop" ref={suggestionsRef} hidden
      onClick={(e) => { if (e.target.id === 'menuSuggestionsBackdrop') closeSuggestions(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="menuSuggestionsTitle">
        <div className="modalHeader">
          <div>
            <div className="modalTitle" id="menuSuggestionsTitle">Combinaciones de platillo</div>
            <div className="modalSubtitle">Primero crea el catalogo base y luego define que puede llevar cada combinacion de plato base + preparacion.</div>
          </div>
          <button className="iconBtn" id="btnMenuSuggestionsClose" type="button" title="Cerrar" onClick={closeSuggestions}>&#10005;</button>
        </div>

        <div className="modalBody menuSuggestBody">
          <section className="menuSuggestIntroCard">
            <div className="menuSuggestIntroEyebrow">Flujo recomendado</div>
            <div className="menuSuggestIntroText">1. Crea primero tu catalogo base: proteinas, preparaciones, guarniciones, postres, bebidas y montaje. 2. Luego entra aqui y arma las combinaciones posibles para cada plato base. Ejemplo: Lomito + Al oregano puede llevar ciertas guarniciones, bebidas, postres y montaje.</div>
          </section>

          <section className="menuSuggestContextCard">
            <div className="menuSuggestSectionHead">
              <div>
                <div className="menuSuggestSectionTitle">1. Plato base y preparacion</div>
                <div className="menuSuggestSectionText">Estas reglas se guardan para una combinacion exacta de plato base + preparacion.</div>
              </div>
            </div>
            <div className="row2 menuSuggestContextGrid">
              <label className="field menuSuggestField">
                <span>Plato base / Proteina</span>
                <select id="menuSuggestionsProtein" value={sugProteinId} onChange={(e) => setSugProteinId(e.target.value)}>
                  <option value="">-- Seleccionar --</option>
                  {activeProteins.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label className="field menuSuggestField">
                <span>Preparacion</span>
                <select id="menuSuggestionsPreparation" value={sugPreparationId} onChange={(e) => setSugPreparationId(e.target.value)} disabled={!sugProteinId}>
                  <option value="">-- Seleccionar --</option>
                  {activePreparations.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="menuSuggestSelectionCard">
            <div className="menuSuggestSectionHead">
              <div>
                <div className="menuSuggestSectionTitle">2. Posibles combinaciones</div>
                <div className="menuSuggestSectionText">Marca y ordena lo que si puede acompanar a esta combinacion. Asi construyes los platillos posibles sin duplicar productos.</div>
              </div>
            </div>

            <div className="row2 menuSuggestCols">
              <div className="field menuSuggestField menuSuggestFieldCard">
                <span>Salsas / Aderezos sugeridos</span>
                <small className="menuSuggestFieldHint">Aplican a este plato base con esta preparacion.</small>
                <div className="menuSuggestList" id="menuSuggestionsSalsas">
                  {renderCheckboxList('salsa', checkedSalsas, setCheckedSalsas)}
                </div>
              </div>
              <div className="field menuSuggestField menuSuggestFieldCard">
                <span>Guarniciones sugeridas</span>
                <small className="menuSuggestFieldHint">Estas son las guarniciones que combinan con esta version del plato.</small>
                <div className="menuSuggestList" id="menuSuggestionsGuarniciones">
                  {renderCheckboxList('guarnicion', checkedGuarniciones, setCheckedGuarniciones)}
                </div>
              </div>
            </div>

            <div className="row2 menuSuggestCols">
              <div className="field menuSuggestField menuSuggestFieldCard">
                <span>Postres sugeridos</span>
                <small className="menuSuggestFieldHint">Postres que combinan con esta combinacion de plato.</small>
                <div className="menuSuggestList" id="menuSuggestionsPostres">
                  {renderCheckboxList('postre', checkedPostres, setCheckedPostres)}
                </div>
              </div>
              <div className="field menuSuggestField menuSuggestFieldCard">
                <span>Bebidas sugeridas</span>
                <small className="menuSuggestFieldHint">Refrescos o bebidas recomendadas para esta combinacion.</small>
                <div className="menuSuggestList" id="menuSuggestionsBebidas">
                  {renderCheckboxList('bebida', checkedBebidas, setCheckedBebidas)}
                </div>
              </div>
            </div>

            <div className="row2 menuSuggestCols">
              <div className="field menuSuggestField menuSuggestFieldCard">
                <span>Tipos de montaje sugeridos</span>
                <small className="menuSuggestFieldHint">Montajes que si aplican a esta combinacion.</small>
                <div className="menuSuggestList" id="menuSuggestionsMontajeTipos">
                  {renderCheckboxList('montaje_tipo', checkedMontajeTipos, setCheckedMontajeTipos)}
                </div>
              </div>
              <div className="field menuSuggestField menuSuggestFieldCard">
                <span>Extras de montaje sugeridos</span>
                <small className="menuSuggestFieldHint">Extras opcionales permitidos para este plato.</small>
                <div className="menuSuggestList" id="menuSuggestionsMontajeAdicionales">
                  {renderCheckboxList('montaje_adicional', checkedMontajeAdicionales, setCheckedMontajeAdicionales)}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="modalFooter">
          <div className="leftActions">
            <button className="btn" id="btnMenuSuggestionsManageCatalog" type="button" onClick={openCatalogFromSuggestions}>Gestionar catalogo base</button>
          </div>
          <div className="rightActions">
            <button className="btn" id="btnMenuSuggestionsDiscard" type="button" onClick={closeSuggestions}>Cancelar</button>
            <button className="btnPrimary" id="btnMenuSuggestionsSave" type="button" disabled={saving} onClick={handleSaveSuggestion}>
              {saving ? 'Guardando...' : 'Guardar combinacion'}
            </button>
          </div>
        </div>
      </div>
    </div>


    {/* ══════════ MODAL 2: CATALOG CRUD ══════════ */}
    <div className="modalBackdrop" id="menuCatalogBackdrop" ref={catalogRef} hidden
      onClick={(e) => { if (e.target.id === 'menuCatalogBackdrop') closeCatalog(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="menuCatalogTitle">
        <div className="modalHeader">
          <div>
            <div className="modalTitle" id="menuCatalogTitle">Gestionar catalogo Menu &amp; Montaje</div>
            <div className="modalSubtitle">Crea, edita e inhabilita proteinas, preparaciones, salsas, guarniciones, postres y mas.</div>
          </div>
          <button className="iconBtn" id="btnMenuCatalogClose" type="button" title="Cerrar" onClick={closeCatalog}>&#10005;</button>
        </div>

        <div className="modalBody">
          <div className="row2">
            <label className="field">
              <span>Catalogo</span>
              <select id="menuCatalogKind" value={catKind} onChange={(e) => setCatKind(e.target.value)}>
                <option value="plato_fuerte">Proteina / Plato base</option>
                <option value="preparacion">Preparacion</option>
                <option value="salsa">Salsa / Aderezo</option>
                <option value="guarnicion">Guarnicion</option>
                <option value="postre">Postre</option>
                <option value="bebida">Bebida</option>
                <option value="comentario">Comentario adicional</option>
                <option value="montaje_tipo">Tipo de montaje</option>
                <option value="montaje_adicional">Adicional de montaje</option>
              </select>
            </label>
            <label className="field" id="menuCatalogProteinWrap" hidden={catKind !== 'preparacion'}>
              <span>Proteina base (para preparacion)</span>
              <select id="menuCatalogProtein" value={catProteinId} onChange={(e) => setCatProteinId(e.target.value)}>
                <option value="">-- Seleccionar proteina --</option>
                {catalogProteins.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="row2">
            <label className="field">
              <span>Nombre</span>
              <input id="menuCatalogName" type="text" placeholder="Escribe el nombre" value={catName} onChange={(e) => setCatName(e.target.value)} />
            </label>
            <label className="field" id="menuCatalogDishTypeWrap" hidden={catKind !== 'plato_fuerte'}>
              <span>Tipo de plato</span>
              <select id="menuCatalogDishType" value={catDishType} onChange={(e) => setCatDishType(e.target.value)}>
                <option value="NORMAL">Normal</option>
                <option value="VEGETARIANO">Vegetariano</option>
                <option value="VEGANO">Vegano</option>
              </select>
            </label>
          </div>

          <div className="row2">
            <div className="field" id="menuCatalogNoProteinWrap" hidden={catKind !== 'plato_fuerte'}>
              <span>Aplicacion</span>
              <label className="statusSwitchInline menuCatalogSwitchInline">
                <input id="menuCatalogNoProtein" type="checkbox" checked={catNoProtein} onChange={(e) => setCatNoProtein(e.target.checked)} />
                <span>Este plato puede ser sin proteina</span>
              </label>
            </div>
            <div className="field">
              <span>Acciones</span>
              <div className="rightActions">
                <button className="btn" id="btnMenuCatalogReset" type="button" onClick={resetCatalogForm}>Limpiar formulario</button>
                <button className="btnPrimary" id="btnMenuCatalogSave" type="button" disabled={saving} onClick={handleSaveCatalog}>
                  {saving ? 'Guardando...' : (catEditId ? 'Actualizar registro' : 'Guardar registro')}
                </button>
              </div>
            </div>
          </div>

          <div className="quoteTableWrap">
            <table className="quoteTable">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Detalle</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="menuCatalogBody">
                {filteredCatalog.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                      No hay items en esta categoria
                    </td>
                  </tr>
                ) : (
                  filteredCatalog.map(item => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{getItemDetail(item)}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: item.active ? '#dcfce7' : '#fee2e2',
                          color: item.active ? '#15803d' : '#991b1b'
                        }}>
                          {item.active ? 'Activo' : 'Inhabilitado'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {(item.kind === 'plato_fuerte' || item.kind === 'preparacion') && (
                            <button
                              type="button"
                              title="Asociar sugerencias / combinaciones"
                              onClick={() => handleOpenSuggestionsFor(item)}
                              style={{ background: '#faf5ff', border: '1px solid #d8b4fe', color: '#7c3aed', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              🍴
                            </button>
                          )}
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => loadCatalogForEdit(item)}
                            style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            title={item.active ? 'Inhabilitar' : 'Reactivar'}
                            onClick={() => handleToggleCatalogActive(item)}
                            style={{
                              background: item.active ? '#fff1f2' : '#f0fdf4',
                              border: '1px solid',
                              borderColor: item.active ? '#fecdd3' : '#bbf7d0',
                              color: item.active ? '#e11d48' : '#16a34a',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 'bold'
                            }}
                          >
                            {item.active ? '🚫' : '↻'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modalFooter">
          <div className="leftActions">
            <button className="btn" id="btnMenuCatalogOpenSuggestions" type="button" onClick={openSuggestionsFromCatalog}>Reglas sugeridas</button>
          </div>
          <div className="rightActions">
            <button className="btn" id="btnMenuCatalogDiscard" type="button" onClick={closeCatalog}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>

    </>
  );
}
