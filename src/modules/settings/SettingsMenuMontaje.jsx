import React, { useState, useEffect } from 'react';

const handleClose = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) modal.hidden = true;
};

export default function SettingsMenuMontaje() {
  const [activeTab, setActiveTab] = useState('combinations'); // 'combinations' or 'catalog'
  
  // States for Catalog Tab
  const [catalogKind, setCatalogKind] = useState('plato_fuerte');
  const [catalogItems, setCatalogItems] = useState([]);
  const [proteinsList, setProteinsList] = useState([]); // For preparations to link a protein
  const [newItemName, setNewItemName] = useState('');
  const [newProteinId, setNewProteinId] = useState('');
  const [newDishType, setNewDishType] = useState('NORMAL');
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(false);

  // States for Combinations Tab
  const [selectedProtein, setSelectedProtein] = useState('');
  const [preparations, setPreparations] = useState([]);
  const [selectedPreparation, setSelectedPreparation] = useState('');
  
  // Lists of checkboxes in Combinations
  const [salsas, setSalsas] = useState([]);
  const [guarniciones, setGuarniciones] = useState([]);
  const [postres, setPostres] = useState([]);
  const [bebidas, setBebidas] = useState([]);
  const [montajeTipos, setMontajeTipos] = useState([]);
  const [montajeAdicionales, setMontajeAdicionales] = useState([]);

  // Checked IDs
  const [checkedSalsas, setCheckedSalsas] = useState([]);
  const [checkedGuarniciones, setCheckedGuarniciones] = useState([]);
  const [checkedPostres, setCheckedPostres] = useState([]);
  const [checkedBebidas, setCheckedBebidas] = useState([]);
  const [checkedMontajeTipos, setCheckedMontajeTipos] = useState([]);
  const [checkedMontajeAdicionales, setCheckedMontajeAdicionales] = useState([]);

  // Load proteins & catalog lists initially
  useEffect(() => {
    fetchProteins();
    loadCatalogItems(catalogKind);
    loadAllCatalogLists();
  }, []);

  useEffect(() => {
    loadCatalogItems(catalogKind);
  }, [catalogKind]);

  // Load preparations when selected protein changes
  useEffect(() => {
    if (selectedProtein) {
      fetch(`/api/menu-catalog/preparacion?plato_id=${selectedProtein}`)
        .then(r => r.json())
        .then(data => {
          setPreparations(data.items || []);
          setSelectedPreparation('');
        })
        .catch(err => console.error('Error fetching preparations:', err));
    } else {
      setPreparations([]);
      setSelectedPreparation('');
    }
  }, [selectedProtein]);

  // Load suggest connections when selected protein & prep are both chosen
  useEffect(() => {
    if (selectedProtein && selectedPreparation) {
      fetch(`/api/menu-suggestions?plato_id=${selectedProtein}&preparacion_id=${selectedPreparation}`)
        .then(r => r.json())
        .then(data => {
          setCheckedSalsas((data.salsas || []).map(x => x.id));
          setCheckedGuarniciones((data.guarniciones || []).map(x => x.id));
          setCheckedPostres((data.postres || []).map(x => x.id));
          setCheckedBebidas((data.bebidas || []).map(x => x.id));
          setCheckedMontajeTipos((data.montajeTipos || []).map(x => x.id));
          setCheckedMontajeAdicionales((data.montajeAdicionales || []).map(x => x.id));
        })
        .catch(err => console.error('Error fetching combinations suggestions:', err));
    } else {
      resetCheckedLists();
    }
  }, [selectedProtein, selectedPreparation]);

  const resetCheckedLists = () => {
    setCheckedSalsas([]);
    setCheckedGuarniciones([]);
    setCheckedPostres([]);
    setCheckedBebidas([]);
    setCheckedMontajeTipos([]);
    setCheckedMontajeAdicionales([]);
  };

  const fetchProteins = () => {
    fetch('/api/menu-catalog/plato_fuerte')
      .then(r => r.json())
      .then(data => setProteinsList(data.items || []))
      .catch(err => console.error(err));
  };

  const loadAllCatalogLists = async () => {
    try {
      const [sData, gData, pData, bData, mtData, maData] = await Promise.all([
        fetch('/api/menu-catalog/salsa').then(r => r.json()),
        fetch('/api/menu-catalog/guarnicion').then(r => r.json()),
        fetch('/api/menu-catalog/postre').then(r => r.json()),
        fetch('/api/menu-catalog/bebida').then(r => r.json()),
        fetch('/api/menu-catalog/montaje_tipo').then(r => r.json()),
        fetch('/api/menu-catalog/montaje_adicional').then(r => r.json()),
      ]);
      setSalsas(sData.items || []);
      setGuarniciones(gData.items || []);
      setPostres(pData.items || []);
      setBebidas(bData.items || []);
      setMontajeTipos(mtData.items || []);
      setMontajeAdicionales(maData.items || []);
    } catch (err) {
      console.error('Error loading all lists:', err);
    }
  };

  const loadCatalogItems = (kind) => {
    setLoading(true);
    fetch(`/api/menu-catalog/${kind}`)
      .then(r => r.json())
      .then(data => {
        setCatalogItems(data.items || []);
        setEditingItem(null);
        setNewItemName('');
        setNewProteinId('');
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const handleSaveCatalogItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const payload = {
      nombre: newItemName.trim(),
    };

    if (catalogKind === 'preparacion') {
      if (!newProteinId) {
        alert('Debe seleccionar una proteína base');
        return;
      }
      payload.id_plato_fuerte = Number(newProteinId);
    } else if (catalogKind === 'plato_fuerte') {
      payload.tipo_plato = newDishType;
    }

    try {
      const res = await fetch(`/api/menu-catalog/${catalogKind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setNewItemName('');
        setNewProteinId('');
        loadCatalogItems(catalogKind);
        if (catalogKind === 'plato_fuerte') fetchProteins();
        loadAllCatalogLists();
      } else {
        alert('Error al guardar el ítem: ' + data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateItem = async (item, updates) => {
    const payload = {
      nombre: updates.nombre !== undefined ? updates.nombre : item.nombre,
      activo: updates.activo !== undefined ? updates.activo : item.activo,
    };

    if (catalogKind === 'preparacion') {
      payload.id_plato_fuerte = item.id_plato_fuerte;
    }

    try {
      const res = await fetch(`/api/menu-catalog/${catalogKind}/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        loadCatalogItems(catalogKind);
        if (catalogKind === 'plato_fuerte') fetchProteins();
        loadAllCatalogLists();
      } else {
        alert('Error al actualizar: ' + data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSuggestions = async () => {
    if (!selectedProtein || !selectedPreparation) {
      alert('Seleccione proteína y preparación para guardar');
      return;
    }

    const payload = {
      id_plato_fuerte: Number(selectedProtein),
      id_preparacion: Number(selectedPreparation),
      salsaIds: checkedSalsas.map(Number),
      postreIds: checkedPostres.map(Number),
      guarnicionIds: checkedGuarniciones.map(Number),
      bebidaIds: checkedBebidas.map(Number),
      montajeTipoIds: checkedMontajeTipos.map(Number),
      montajeAdicionalIds: checkedMontajeAdicionales.map(Number),
    };

    try {
      const res = await fetch('/api/menu-suggestions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        alert('Combinación y sugerencias guardadas con éxito');
      } else {
        alert('Error al guardar combinaciones: ' + data.message);
      }
    } catch (err) {
      console.error(err);
      alert('Error en red al guardar sugerencias');
    }
  };

  const toggleCheck = (list, setList, id) => {
    if (list.includes(id)) {
      setList(list.filter(x => x !== id));
    } else {
      setList([...list, id]);
    }
  };

  return (
    <div className="modalBackdrop" id="menuSuggestionsBackdrop" hidden onClick={(e) => { if (e.target.id === 'menuSuggestionsBackdrop') handleClose('menuSuggestionsBackdrop'); }}>
      <div className="modal glass-modal" role="dialog" aria-modal="true" aria-labelledby="menuSuggestionsTitle" style={{ maxWidth: '960px' }}>
        <div className="modalHeader" style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '16px' }}>
          <div>
            <div className="modalTitle" id="menuSuggestionsTitle" style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: '#0284c7' }}>restaurant_menu</span>
              Gestión de Menú & Montaje
            </div>
            <div className="modalSubtitle" style={{ color: '#475569' }}>
              Configura el catálogo culinario, los montajes del salón y las combinaciones sugeridas de platillos
            </div>
          </div>
          <button className="iconBtn" id="btnMenuSuggestionsClose" type="button" title="Cerrar" onClick={() => handleClose('menuSuggestionsBackdrop')} style={{ color: '#64748b' }}>&#10005;</button>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '6px', borderRadius: '8px', margin: '24px 32px 0 32px', gap: '8px' }}>
          <button 
            className="btn" 
            type="button"
            onClick={() => setActiveTab('combinations')}
            style={{ 
              flex: 1, 
              background: activeTab === 'combinations' ? '#ffffff' : 'transparent',
              color: activeTab === 'combinations' ? '#0f172a' : '#475569',
              fontWeight: activeTab === 'combinations' ? '600' : '400',
              boxShadow: activeTab === 'combinations' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              borderRadius: '6px',
              padding: '10px'
            }}
          >
            🥗 Combinaciones y Reglas de Platillo
          </button>
          <button 
            className="btn" 
            type="button"
            onClick={() => setActiveTab('catalog')}
            style={{ 
              flex: 1, 
              background: activeTab === 'catalog' ? '#ffffff' : 'transparent',
              color: activeTab === 'catalog' ? '#0f172a' : '#475569',
              fontWeight: activeTab === 'catalog' ? '600' : '400',
              boxShadow: activeTab === 'catalog' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              borderRadius: '6px',
              padding: '10px'
            }}
          >
            📋 Gestionar Catálogo Base
          </button>
        </div>

        {activeTab === 'combinations' ? (
          /* COMBINATIONS RULES TAB */
          <div className="modalBody" style={{ padding: '24px 32px' }}>
            <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0369a1', marginBottom: '4px' }}>Flujo Recomendado</div>
              <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                1. Registra tus platos y complementos en la pestaña de <strong>Catálogo Base</strong>.<br />
                2. Selecciona un Plato Base y una Preparación abajo, y marca los acompañamientos válidos para guiar al vendedor.
              </div>
            </div>

            <div className="row2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <label className="field">
                <span style={{ fontWeight: '600', color: '#334155' }}>1. Selecciona Proteína / Plato Base</span>
                <select 
                  value={selectedProtein} 
                  onChange={e => setSelectedProtein(e.target.value)}
                  className="uniformFieldControl"
                  style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px' }}
                >
                  <option value="">-- Elige un plato base --</option>
                  {proteinsList.filter(x => x.activo).map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} ({p.tipo_plato})</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span style={{ fontWeight: '600', color: '#334155' }}>2. Selecciona Preparación</span>
                <select 
                  value={selectedPreparation} 
                  onChange={e => setSelectedPreparation(e.target.value)}
                  disabled={!selectedProtein}
                  className="uniformFieldControl"
                  style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px' }}
                >
                  <option value="">-- Elige una preparación --</option>
                  {preparations.filter(x => x.activo).map(pr => (
                    <option key={pr.id} value={pr.id}>{pr.nombre}</option>
                  ))}
                </select>
              </label>
            </div>

            {selectedProtein && selectedPreparation ? (
              <>
                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '20px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                    Acompañamientos permitidos para esta combinación:
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    Marca los elementos que el vendedor podrá seleccionar al cotizar este plato.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  {/* Salsas Card */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>🥫 Salsas / Aderezos</span>
                    </div>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {salsas.length === 0 ? <span style={{ fontSize: '12px', color: '#94a3b8' }}>Sin elementos registrados</span> : 
                        salsas.filter(x => x.activo).map(x => (
                          <label key={x.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={checkedSalsas.includes(x.id)} onChange={() => toggleCheck(checkedSalsas, setCheckedSalsas, x.id)} />
                            <span>{x.nombre}</span>
                          </label>
                        ))
                      }
                    </div>
                  </div>

                  {/* Guarniciones Card */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '12px' }}>
                      <span>🥔 Guarniciones válidas</span>
                    </div>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {guarniciones.length === 0 ? <span style={{ fontSize: '12px', color: '#94a3b8' }}>Sin elementos registrados</span> : 
                        guarniciones.filter(x => x.activo).map(x => (
                          <label key={x.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={checkedGuarniciones.includes(x.id)} onChange={() => toggleCheck(checkedGuarniciones, setCheckedGuarniciones, x.id)} />
                            <span>{x.nombre}</span>
                          </label>
                        ))
                      }
                    </div>
                  </div>

                  {/* Postres Card */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '12px' }}>
                      <span>🍰 Postres recomendados</span>
                    </div>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {postres.length === 0 ? <span style={{ fontSize: '12px', color: '#94a3b8' }}>Sin elementos registrados</span> : 
                        postres.filter(x => x.activo).map(x => (
                          <label key={x.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={checkedPostres.includes(x.id)} onChange={() => toggleCheck(checkedPostres, setCheckedPostres, x.id)} />
                            <span>{x.nombre}</span>
                          </label>
                        ))
                      }
                    </div>
                  </div>

                  {/* Bebidas Card */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '12px' }}>
                      <span>🍹 Bebidas sugeridas</span>
                    </div>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {bebidas.length === 0 ? <span style={{ fontSize: '12px', color: '#94a3b8' }}>Sin elementos registrados</span> : 
                        bebidas.filter(x => x.activo).map(x => (
                          <label key={x.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={checkedBebidas.includes(x.id)} onChange={() => toggleCheck(checkedBebidas, setCheckedBebidas, x.id)} />
                            <span>{x.nombre}</span>
                          </label>
                        ))
                      }
                    </div>
                  </div>

                  {/* Montaje Tipos Card */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '12px' }}>
                      <span>🪑 Montajes de salón</span>
                    </div>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {montajeTipos.length === 0 ? <span style={{ fontSize: '12px', color: '#94a3b8' }}>Sin elementos registrados</span> : 
                        montajeTipos.filter(x => x.activo).map(x => (
                          <label key={x.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={checkedMontajeTipos.includes(x.id)} onChange={() => toggleCheck(checkedMontajeTipos, setCheckedMontajeTipos, x.id)} />
                            <span>{x.nombre}</span>
                          </label>
                        ))
                      }
                    </div>
                  </div>

                  {/* Adicionales Card */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '12px' }}>
                      <span>🕯️ Adicionales / Extras</span>
                    </div>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {montajeAdicionales.length === 0 ? <span style={{ fontSize: '12px', color: '#94a3b8' }}>Sin elementos registrados</span> : 
                        montajeAdicionales.filter(x => x.activo).map(x => (
                          <label key={x.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={checkedMontajeAdicionales.includes(x.id)} onChange={() => toggleCheck(checkedMontajeAdicionales, setCheckedMontajeAdicionales, x.id)} />
                            <span>{x.nombre}</span>
                          </label>
                        ))
                      }
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px', gap: '12px' }}>
                  <button className="btn-cancelar" type="button" onClick={resetCheckedLists}>Limpiar Selección</button>
                  <button className="btn-teal" type="button" onClick={handleSaveSuggestions}>Guardar combinación</button>
                </div>
              </>
            ) : (
              <div style={{ padding: '60px 0', textTransform: 'none', textAlign: 'center', color: '#94a3b8' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#cbd5e1', marginBottom: '8px' }}>soup_kitchen</span>
                <div>Selecciona un Plato Base y una Preparación para configurar los acompañamientos permitidos.</div>
              </div>
            )}
          </div>
        ) : (
          /* CATALOG BASE TAB */
          <div className="modalBody" style={{ padding: '24px 32px' }}>
            <form onSubmit={handleSaveCatalogItem} style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>Agregar nuevo elemento al catálogo</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr', gap: '16px', alignItems: 'end' }}>
                <label className="field">
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Categoría de Catálogo</span>
                  <select 
                    value={catalogKind} 
                    onChange={e => setCatalogKind(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px' }}
                  >
                    <option value="plato_fuerte">Proteína / Plato base</option>
                    <option value="preparacion">Preparación (Salsas / Cocciones)</option>
                    <option value="salsa">Salsa / Aderezo sugerido</option>
                    <option value="guarnicion">Guarnición sugerida</option>
                    <option value="postre">Postre sugerido</option>
                    <option value="bebida">Bebida sugerida</option>
                    <option value="comentario">Comentario adicional estándar</option>
                    <option value="montaje_tipo">Tipo de montaje</option>
                    <option value="montaje_adicional">Adicional de montaje</option>
                  </select>
                </label>

                <label className="field">
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Nombre del nuevo elemento</span>
                  <input 
                    type="text" 
                    placeholder="Ej: Filete Mignon, Al ajillo, Puré rústico, etc."
                    value={newItemName}
                    onChange={e => setNewItemName(e.target.value)}
                    required
                    style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px' }}
                  />
                </label>

                <div>
                  <button className="btn-teal" type="submit" style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_circle</span>
                    Agregar ítem
                  </button>
                </div>
              </div>

              {/* Conditional parameters based on Kind */}
              {catalogKind === 'preparacion' && (
                <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  <label className="field">
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Vincular con Proteína / Plato Base</span>
                    <select 
                      value={newProteinId} 
                      onChange={e => setNewProteinId(e.target.value)}
                      required
                      style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px' }}
                    >
                      <option value="">-- Selecciona el plato base al que pertenece esta preparación --</option>
                      {proteinsList.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {catalogKind === 'plato_fuerte' && (
                <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  <label className="field">
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Tipo de plato culinario</span>
                    <select 
                      value={newDishType} 
                      onChange={e => setNewDishType(e.target.value)}
                      style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px' }}
                    >
                      <option value="NORMAL">Normal (A base de proteína animal)</option>
                      <option value="VEGETARIANO">Vegetariano</option>
                      <option value="VEGANO">Vegano</option>
                    </select>
                  </label>
                </div>
              )}
            </form>

            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>
              Lista de elementos en el catálogo ({catalogItems.length})
            </div>

            <div className="quoteTableWrap" style={{ maxHeight: '360px', overflowY: 'auto' }}>
              <table className="quoteTable">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    {catalogKind === 'preparacion' && <th>Proteína Vinculada</th>}
                    {catalogKind === 'plato_fuerte' && <th>Tipo</th>}
                    <th style={{ width: '160px', textAlign: 'center' }}>Estado</th>
                    <th style={{ width: '120px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={catalogKind === 'preparacion' || catalogKind === 'plato_fuerte' ? 4 : 3} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>Cargando catálogo...</td>
                    </tr>
                  ) : catalogItems.length === 0 ? (
                    <tr>
                      <td colSpan={catalogKind === 'preparacion' || catalogKind === 'plato_fuerte' ? 4 : 3} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>No hay elementos registrados en esta categoría.</td>
                    </tr>
                  ) : (
                    catalogItems.map(item => (
                      <tr key={item.id}>
                        <td>
                          {editingItem && editingItem.id === item.id ? (
                            <input 
                              type="text" 
                              value={editingItem.nombre} 
                              onChange={e => setEditingItem({ ...editingItem, nombre: e.target.value })}
                              style={{ width: '100%', height: '32px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '4px 8px' }}
                            />
                          ) : (
                            <span style={{ fontWeight: '500', color: item.activo ? '#1e293b' : '#94a3b8' }}>{item.nombre}</span>
                          )}
                        </td>
                        
                        {catalogKind === 'preparacion' && (
                          <td style={{ fontSize: '12px', color: '#64748b' }}>
                            {proteinsList.find(p => p.id === item.id_plato_fuerte)?.nombre || `ID: ${item.id_plato_fuerte}`}
                          </td>
                        )}

                        {catalogKind === 'plato_fuerte' && (
                          <td>
                            <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: item.tipo_plato === 'VEGETARIANO' ? '#dcfce7' : item.tipo_plato === 'VEGANO' ? '#f0fdf4' : '#f1f5f9', color: item.tipo_plato === 'VEGETARIANO' ? '#15803d' : item.tipo_plato === 'VEGANO' ? '#166534' : '#475569' }}>
                              {item.tipo_plato}
                            </span>
                          </td>
                        )}

                        <td style={{ textAlign: 'center' }}>
                          <label className="statusSwitchInline" style={{ justifyContent: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={!!item.activo} 
                              onChange={e => handleUpdateItem(item, { activo: e.target.checked })}
                            />
                            <span style={{ fontSize: '12px', color: item.activo ? '#16a34a' : '#ef4444', fontWeight: '600' }}>
                              {item.activo ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                          </label>
                        </td>

                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {editingItem && editingItem.id === item.id ? (
                              <>
                                <button className="btn-teal" type="button" onClick={() => { handleUpdateItem(item, { nombre: editingItem.nombre }); setEditingItem(null); }} style={{ padding: '4px 8px', fontSize: '12px' }}>
                                  Guardar
                                </button>
                                <button className="btn-cancel" type="button" onClick={() => setEditingItem(null)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button className="btn-mantenimiento" type="button" onClick={() => setEditingItem(item)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                                Editar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
