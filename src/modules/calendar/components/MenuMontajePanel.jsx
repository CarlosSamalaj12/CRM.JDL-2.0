import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';

// Helper unique ID generator
const uid = () => Math.random().toString(36).substring(2, 9);

export default function MenuMontajePanel({ event, quote, setQuote }) {
  // Tabs: 'builder' (Premium Builder) or 'classic' (Classic Editor)
  const [activeSubTab, setActiveSubTab] = useState('builder');

  // Combo Selector: Date + Salon
  const [selectedKey, setSelectedKey] = useState('');
  const [events, setEvents] = useState([]);
  
  // Catalogs state
  const [catalogs, setCatalogs] = useState({
    proteins: [],
    preparations: [], // Loaded dynamically based on selected protein
    salsas: [],
    guarniciones: [],
    postres: [],
    bebidas: [],
    comentarios: [],
    montajeTipos: [],
    montajeAdicionales: []
  });

  // Builder form state (for the currently selected combo key)
  const [selectedProtein, setSelectedProtein] = useState('');
  const [selectedPrep, setSelectedPrep] = useState('');
  const [selectedSalsas, setSelectedSalsas] = useState([]);
  const [selectedGuarniciones, setSelectedGuarniciones] = useState([]);
  const [guarnicionQtys, setGuarnicionQtys] = useState({});
  const [selectedPostres, setSelectedPostres] = useState([]);
  const [postreQtys, setPostreQtys] = useState({});
  const [selectedBebidas, setSelectedBebidas] = useState([]);
  const [bebidaQtys, setBebidaQtys] = useState({});
  const [selectedComentarios, setSelectedComentarios] = useState([]);
  const [comentarioLibre, setComentarioLibre] = useState('');
  const [selectedMontajeTipo, setSelectedMontajeTipo] = useState('');
  const [selectedMontajeAdicionales, setSelectedMontajeAdicionales] = useState([]);

  // Active builder category stage:
  // 'plato', 'preparacion', 'salsa', 'guarnicion', 'postre', 'bebida', 'montaje_tipo', 'montaje_adicional'
  const [builderStage, setBuilderStage] = useState('plato');
  const [filterQuery, setFilterQuery] = useState('');
  const [showAllOptions, setShowAllOptions] = useState(false);

  // Manual inputs for the currently selected combo key (Classic mode)
  const [menuTitle, setMenuTitle] = useState('');
  const [menuQty, setMenuQty] = useState('');
  const [menuDescription, setMenuDescription] = useState('');
  const [montajeDescription, setMontajeDescription] = useState('');

  // Selected Version for Menu & Montaje
  const [selectedMmsVersion, setSelectedMmsVersion] = useState(quote.menuMontajeVersion || 1);

  // Active dishes line items list (draft line items before combining into description)
  const [lineItemsDraft, setLineItemsDraft] = useState([]);
  const [activeLineKey, setActiveLineKey] = useState(''); // Selected line item to edit

  // ----------------------------------------------------
  // LOADERS & INITIALIZATION
  // ----------------------------------------------------

  const loadData = async () => {
    try {
      // Load events list from state to compute date-salon combos
      const stateRes = await fetch('/api/state');
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        setEvents(stateData?.state?.events || []);
      }

      // Load all simple catalogs in parallel
      const [
        proteinsRes, salsasRes, guarnicionesRes, postresRes,
        bebidasRes, comentariosRes, montajeTiposRes, adicionalesRes
      ] = await Promise.all([
        fetch('/api/menu-catalog/plato_fuerte').then(r => r.json()),
        fetch('/api/menu-catalog/salsa').then(r => r.json()),
        fetch('/api/menu-catalog/guarnicion').then(r => r.json()),
        fetch('/api/menu-catalog/postre').then(r => r.json()),
        fetch('/api/menu-catalog/bebida').then(r => r.json()),
        fetch('/api/menu-catalog/comentario').then(r => r.json()),
        fetch('/api/menu-catalog/montaje_tipo').then(r => r.json()),
        fetch('/api/menu-catalog/montaje_adicional').then(r => r.json())
      ]);

      setCatalogs(prev => ({
        ...prev,
        proteins: proteinsRes.items?.filter(x => x.activo !== false) || [],
        salsas: salsasRes.items?.filter(x => x.activo !== false) || [],
        guarniciones: guarnicionesRes.items?.filter(x => x.activo !== false) || [],
        postres: postresRes.items?.filter(x => x.activo !== false) || [],
        bebidas: bebidasRes.items?.filter(x => x.activo !== false) || [],
        comentarios: comentariosRes.items?.filter(x => x.activo !== false) || [],
        montajeTipos: montajeTiposRes.items?.filter(x => x.activo !== false) || [],
        montajeAdicionales: adicionalesRes.items?.filter(x => x.activo !== false) || []
      }));

    } catch (err) {
      console.error('Error al cargar catálogos de Menú & Montaje:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute distinct date-salon combos for the event series
  const combos = useMemo(() => {
    if (!event || !events.length) return [];
    
    // Find all events in the same group series
    const targetGroupId = event.id_grupo || event.idGroup;
    let series = [];
    if (targetGroupId) {
      series = events.filter(x => String(x.id_grupo || x.idGroup || '') === String(targetGroupId));
    } else {
      series = [event];
    }

    // Sort series chronologically
    series.sort((a, b) => {
      const dateCompare = String(a.fecha_evento || a.date || '').localeCompare(String(b.fecha_evento || b.date || ''));
      if (dateCompare !== 0) return dateCompare;
      const salonCompare = String(a.nombre_salon || a.salon || '').localeCompare(String(b.nombre_salon || b.salon || ''));
      if (salonCompare !== 0) return salonCompare;
      return String(a.hora_inicio || a.startTime || '').localeCompare(String(b.hora_inicio || b.startTime || ''));
    });

    const seen = new Set();
    const result = [];
    series.forEach(item => {
      const d = item.fecha_evento || item.date || '';
      const s = item.nombre_salon || item.salon || '';
      if (!d || !s) return;
      const key = `${d}|${s}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ key, date: d, salon: s });
    });

    return result;
  }, [event, events]);

  // Set initial selected key combo
  useEffect(() => {
    if (combos.length > 0 && !selectedKey) {
      setSelectedKey(combos[0].key);
    }
  }, [combos, selectedKey]);

  // Load preparations dynamically when protein changes
  useEffect(() => {
    if (!selectedProtein) {
      setCatalogs(prev => ({ ...prev, preparations: [] }));
      setSelectedPrep('');
      return;
    }

    fetch(`/api/menu-catalog/preparacion?plato_id=${selectedProtein}`)
      .then(r => r.json())
      .then(data => {
        const preps = data.items?.filter(x => x.activo !== false) || [];
        setCatalogs(prev => ({ ...prev, preparations: preps }));
        if (preps.length > 0) {
          setSelectedPrep(String(preps[0].id));
        } else {
          setSelectedPrep('');
        }
      })
      .catch(err => console.error('Error al cargar preparaciones:', err));
  }, [selectedProtein]);

  // Load version data or event state when combo key or version changes
  useEffect(() => {
    if (!selectedKey) return;
    const [date, salon] = selectedKey.split('|');
    
    // Find matching saved entry in the current quote draft
    const entries = quote.menuMontajeEntries || [];
    const entry = entries.find(x => String(x.date || '') === date && String(x.salon || '') === salon);

    if (entry) {
      setMenuTitle(entry.menuTitle || '');
      setMenuQty(entry.menuQty || '');
      setMenuDescription(entry.menuDescription || '');
      setMontajeDescription(entry.montajeDescription || '');
      
      // Parse line items if available in entry.lineItems structure, or reset
      if (entry.lineItems && Array.isArray(entry.lineItems)) {
        setLineItemsDraft(entry.lineItems);
      } else {
        setLineItemsDraft([]);
      }
    } else {
      setMenuTitle('');
      setMenuQty(quote.people || event?.pax || '');
      setMenuDescription('');
      setMontajeDescription('');
      setLineItemsDraft([]);
    }

    // Reset current builder picks
    setSelectedProtein('');
    setSelectedPrep('');
    setSelectedSalsas([]);
    setSelectedGuarniciones([]);
    setSelectedPostres([]);
    setSelectedBebidas([]);
    setSelectedComentarios([]);
    setComentarioLibre('');
    setSelectedMontajeTipo('');
    setSelectedMontajeAdicionales([]);
    setActiveLineKey('');
    setBuilderStage('plato');
  }, [selectedKey, quote.menuMontajeEntries, selectedMmsVersion]);

  // ----------------------------------------------------
  // AUTOMATIC COMPILER LOGIC
  // ----------------------------------------------------

  // Build textual menu description from multiple line items
  const compileMenuDescription = (items) => {
    if (!items.length) {
      return "[PLATOS FUERTES]\n- Por definir";
    }

    const lines = [];
    items.forEach((line, index) => {
      if (index > 0) lines.push('');
      lines.push(`[PLATO ${index + 1}]`);

      const plateName = catalogs.proteins.find(x => String(x.id) === String(line.platoId))?.nombre || 'Por definir';
      const prepName = catalogs.preparations.find(x => String(x.id) === String(line.preparacionId))?.nombre || 
                       (line.preparacionId ? `Prep #${line.preparacionId}` : 'Por definir');

      const salsasStr = line.salsaIds?.length 
        ? line.salsaIds.map(sid => catalogs.salsas.find(x => String(x.id) === String(sid))?.nombre).filter(Boolean).join(', ') 
        : 'Por definir';

      const guarnicionesStr = line.guarnicionIds?.length
        ? line.guarnicionIds.map(gid => catalogs.guarniciones.find(x => String(x.id) === String(gid))?.nombre).filter(Boolean).join(', ')
        : 'Por definir';

      const postresStr = line.postreIds?.length
        ? line.postreIds.map(pid => {
            const name = catalogs.postres.find(x => String(x.id) === String(pid))?.nombre || '';
            const qty = line.postreQtys?.[pid] || 1;
            return `${name} (x${qty})`;
          }).filter(Boolean).join(', ')
        : 'Por definir';

      const bebidasStr = line.bebidaIds?.length
        ? line.bebidaIds.map(bid => {
            const name = catalogs.bebidas.find(x => String(x.id) === String(bid))?.nombre || '';
            const qty = line.bebidaQtys?.[bid] || 1;
            return `${name} (x${qty})`;
          }).filter(Boolean).join(', ')
        : 'Por definir';

      const commentList = line.comentarioIds?.map(cid => catalogs.comentarios.find(x => String(x.id) === String(cid))?.nombre).filter(Boolean) || [];
      if (line.comentarioLibre) {
        commentList.push(line.comentarioLibre);
      }
      const commentsStr = commentList.length ? `COMENTARIOS (${commentList.join(', ')})` : '';

      const parts = [
        `PLATO FUERTE (Cant ${line.qty || 1} - ${plateName})`,
        `PREPARACION (${prepName})`,
        `SALSAS (${salsasStr})`,
        `GUARNICIONES (${guarnicionesStr})`,
        `POSTRES (${postresStr})`,
        `BEBIDAS (${bebidasStr})`
      ];
      if (commentsStr) parts.push(commentsStr);

      lines.push(`- ${parts.join(' | ')}`);
    });

    return lines.join('\n').trim();
  };

  // Build textual montage description
  const compileMontajeDescription = () => {
    const tipoName = catalogs.montajeTipos.find(x => String(x.id) === String(selectedMontajeTipo))?.nombre || 'Por definir';
    const adicionalesStr = selectedMontajeAdicionales.length
      ? selectedMontajeAdicionales.map(aid => catalogs.montajeAdicionales.find(x => String(x.id) === String(aid))?.nombre).filter(Boolean).join(', ')
      : 'Ninguno';

    const lines = [
      "[MONTAJE]",
      `- TIPO (${tipoName}) | ADICIONALES (${adicionalesStr})`
    ];

    if (montajeDescription && !montajeDescription.startsWith('[MONTAJE]')) {
      lines.push('');
      lines.push('[DETALLE]');
      lines.push(montajeDescription);
    }

    return lines.join('\n').trim();
  };

  // Sync builder components changes back into textual descriptions
  const syncBuilderToText = (updatedLineItems) => {
    const autoMenu = compileMenuDescription(updatedLineItems);
    setMenuDescription(autoMenu);

    if (selectedMontajeTipo) {
      const autoMontaje = compileMontajeDescription();
      setMontajeDescription(autoMontaje);
    }
  };

  // ----------------------------------------------------
  // HANDLERS & BUILDER WORKFLOW
  // ----------------------------------------------------

  const handleStageOptionClick = async (id, name) => {
    const numId = Number(id);

    if (builderStage === 'plato') {
      setSelectedProtein(String(numId));
      
      // Prompt for quantity
      const { value: qty } = await Swal.fire({
        title: `Cantidad para ${name}`,
        input: 'number',
        inputLabel: 'Ingrese la cantidad de platos fuertes',
        inputValue: menuQty || quote.people || event?.pax || 1,
        showCancelButton: true,
        inputValidator: (value) => {
          if (!value || Number(value) <= 0) {
            return '¡Debe ingresar una cantidad mayor a cero!';
          }
        }
      });

      if (!qty) return;
      const safeQty = Math.floor(Number(qty));
      setMenuQty(safeQty);

      // Create new line draft key or edit active one
      const key = activeLineKey || uid();
      const newLine = {
        key,
        platoId: numId,
        preparacionId: null,
        qty: safeQty,
        salsaIds: [],
        guarnicionIds: [],
        postreIds: [],
        postreQtys: {},
        bebidaIds: [],
        bebidaQtys: {},
        comentarioIds: [],
        comentarioLibre: ''
      };

      let updatedList = [];
      const exists = lineItemsDraft.some(x => x.key === key);
      if (exists) {
        updatedList = lineItemsDraft.map(x => x.key === key ? { ...x, platoId: numId, qty: safeQty } : x);
      } else {
        updatedList = [...lineItemsDraft, newLine];
      }

      setLineItemsDraft(updatedList);
      setActiveLineKey(key);
      syncBuilderToText(updatedList);

      // Advance stage
      setBuilderStage('preparacion');
      setFilterQuery('');

    } else if (builderStage === 'preparacion') {
      if (!activeLineKey) return;
      setSelectedPrep(String(numId));
      
      const updatedList = lineItemsDraft.map(x => x.key === activeLineKey ? { ...x, preparacionId: numId } : x);
      setLineItemsDraft(updatedList);
      syncBuilderToText(updatedList);

      setBuilderStage('guarnicion');
      setFilterQuery('');

    } else if (builderStage === 'salsa') {
      if (!activeLineKey) return;
      const current = selectedSalsas.includes(numId)
        ? selectedSalsas.filter(x => x !== numId)
        : [...selectedSalsas, numId];

      setSelectedSalsas(current);
      const updatedList = lineItemsDraft.map(x => x.key === activeLineKey ? { ...x, salsaIds: current } : x);
      setLineItemsDraft(updatedList);
      syncBuilderToText(updatedList);

    } else if (builderStage === 'guarnicion') {
      if (!activeLineKey) return;
      const isSelected = selectedGuarniciones.includes(numId);
      let updatedGuarniciones = [...selectedGuarniciones];

      if (isSelected) {
        updatedGuarniciones = updatedGuarniciones.filter(x => x !== numId);
        const nextQtys = { ...guarnicionQtys };
        delete nextQtys[numId];
        setGuarnicionQtys(nextQtys);
      } else {
        updatedGuarniciones.push(numId);
        setGuarnicionQtys(prev => ({ ...prev, [numId]: 1 }));
      }

      setSelectedGuarniciones(updatedGuarniciones);
      const updatedList = lineItemsDraft.map(x => x.key === activeLineKey ? { ...x, guarnicionIds: updatedGuarniciones } : x);
      setLineItemsDraft(updatedList);
      syncBuilderToText(updatedList);

    } else if (builderStage === 'postre') {
      if (!activeLineKey) return;
      const isSelected = selectedPostres.includes(numId);
      let updatedPostres = [...selectedPostres];
      let nextQtys = { ...postreQtys };

      if (isSelected) {
        updatedPostres = updatedPostres.filter(x => x !== numId);
        delete nextQtys[numId];
      } else {
        // Prompt for item quantity
        const { value: qty } = await Swal.fire({
          title: `Porciones de ${name}`,
          input: 'number',
          inputValue: 1,
          showCancelButton: true,
          inputValidator: (v) => (!v || Number(v) <= 0) && 'Ingrese cantidad válida'
        });
        if (!qty) return;
        updatedPostres.push(numId);
        nextQtys[numId] = Math.floor(Number(qty));
      }

      setSelectedPostres(updatedPostres);
      setPostreQtys(nextQtys);

      const updatedList = lineItemsDraft.map(x => x.key === activeLineKey ? { ...x, postreIds: updatedPostres, postreQtys: nextQtys } : x);
      setLineItemsDraft(updatedList);
      syncBuilderToText(updatedList);

    } else if (builderStage === 'bebida') {
      if (!activeLineKey) return;
      const isSelected = selectedBebidas.includes(numId);
      let updatedBebidas = [...selectedBebidas];
      let nextQtys = { ...bebidaQtys };

      if (isSelected) {
        updatedBebidas = updatedBebidas.filter(x => x !== numId);
        delete nextQtys[numId];
      } else {
        const { value: qty } = await Swal.fire({
          title: `Servicios de ${name}`,
          input: 'number',
          inputValue: menuQty || 1,
          showCancelButton: true,
          inputValidator: (v) => (!v || Number(v) <= 0) && 'Ingrese cantidad válida'
        });
        if (!qty) return;
        updatedBebidas.push(numId);
        nextQtys[numId] = Math.floor(Number(qty));
      }

      setSelectedBebidas(updatedBebidas);
      setBebidaQtys(nextQtys);

      const updatedList = lineItemsDraft.map(x => x.key === activeLineKey ? { ...x, bebidaIds: updatedBebidas, bebidaQtys: nextQtys } : x);
      setLineItemsDraft(updatedList);
      syncBuilderToText(updatedList);

    } else if (builderStage === 'montaje_tipo') {
      setSelectedMontajeTipo(String(numId));
      
      // Auto-compile montage string
      const autoMontaje = compileMontajeDescription();
      setMontajeDescription(autoMontaje);

      // Prompt to advance to additions
      setBuilderStage('montaje_adicional');
      setFilterQuery('');

    } else if (builderStage === 'montaje_adicional') {
      const current = selectedMontajeAdicionales.includes(numId)
        ? selectedMontajeAdicionales.filter(x => x !== numId)
        : [...selectedMontajeAdicionales, numId];

      setSelectedMontajeAdicionales(current);
      
      const tipoName = catalogs.montajeTipos.find(x => String(x.id) === String(selectedMontajeTipo))?.nombre || 'Por definir';
      const adicionalesStr = current.length
        ? current.map(aid => catalogs.montajeAdicionales.find(x => String(x.id) === String(aid))?.nombre).filter(Boolean).join(', ')
        : 'Ninguno';

      let autoMontaje = `[MONTAJE]\n- TIPO (${tipoName}) | ADICIONALES (${adicionalesStr})`;
      if (montajeDescription && montageDescription.includes('[DETALLE]')) {
        const manualParts = montageDescription.split('[DETALLE]');
        autoMontaje += `\n\n[DETALLE]${manualParts[1]}`;
      }
      setMontajeDescription(autoMontaje);
    }
  };

  const handleEditLineItem = (line) => {
    setActiveLineKey(line.key);
    setSelectedProtein(String(line.platoId));
    setSelectedPrep(String(line.preparacionId || ''));
    setSelectedSalsas(line.salsaIds || []);
    setSelectedGuarniciones(line.guarnicionIds || []);
    setGuarnicionQtys(line.guarnicionQtys || {});
    setSelectedPostres(line.postreIds || []);
    setPostreQtys(line.postreQtys || {});
    setSelectedBebidas(line.bebidaIds || []);
    setBebidaQtys(line.bebidaQtys || {});
    setSelectedComentarios(line.comentarioIds || []);
    setComentarioLibre(line.comentarioLibre || '');
    setBuilderStage('plato');
  };

  const handleRemoveLineItem = (key) => {
    const updated = lineItemsDraft.filter(x => x.key !== key);
    setLineItemsDraft(updated);
    if (activeLineKey === key) {
      setActiveLineKey('');
      setSelectedProtein('');
      setSelectedPrep('');
    }
    syncBuilderToText(updated);
  };

  const handleClearForm = () => {
    Swal.fire({
      title: '¿Limpiar todo?',
      text: 'Se vaciarán todas las selecciones actuales del constructor.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed) {
        setLineItemsDraft([]);
        setActiveLineKey('');
        setSelectedProtein('');
        setSelectedPrep('');
        setSelectedSalsas([]);
        setSelectedGuarniciones([]);
        setSelectedPostres([]);
        setSelectedBebidas([]);
        setSelectedComentarios([]);
        setComentarioLibre('');
        setSelectedMontajeTipo('');
        setSelectedMontajeAdicionales([]);
        setMenuDescription('');
        setMontajeDescription('');
        setMenuTitle('');
        setMenuQty('');
      }
    });
  };

  // ----------------------------------------------------
  // PERSIST & SAVE STATE INTEGRATION
  // ----------------------------------------------------

  const handleSaveMenuMontaje = async (isUpdateOnly = false) => {
    if (!selectedKey) {
      Swal.fire('Error', 'Seleccione una combinación de fecha y salón.', 'error');
      return;
    }

    const [date, salon] = selectedKey.split('|');

    if (!menuTitle && !menuDescription && !montajeDescription) {
      Swal.fire('Atención', 'Complete al menos los campos de menú o montaje para guardar.', 'info');
      return;
    }

    // Prepare matching entry row
    const existingEntries = [...(quote.menuMontajeEntries || [])];
    const idx = existingEntries.findIndex(x => String(x.date || '') === date && String(x.salon || '') === salon);
    
    const row = {
      id: idx >= 0 ? existingEntries[idx].id : uid(),
      date,
      salon,
      menuTitle: menuTitle || `Menú de ${event?.name || 'Evento'}`,
      menuQty: menuQty ? Number(menuQty) : '',
      menuDescription,
      montajeDescription,
      lineItems: lineItemsDraft,
      updatedAt: new Date().toISOString()
    };

    if (idx >= 0) {
      existingEntries[idx] = row;
    } else {
      existingEntries.push(row);
    }

    const currentVersions = [...(quote.menuMontajeVersions || [])];
    let targetVerNum = Number(selectedMmsVersion || quote.menuMontajeVersion || 1);
    let createdNewVer = false;

    if (isUpdateOnly) {
      // Update existing selected version array entry
      const vIdx = currentVersions.findIndex(v => Number(v.version) === targetVerNum);
      if (vIdx >= 0) {
        currentVersions[vIdx] = {
          ...currentVersions[vIdx],
          entries: existingEntries,
          savedAt: new Date().toISOString()
        };
      } else {
        currentVersions.push({ version: targetVerNum, entries: existingEntries, savedAt: new Date().toISOString() });
      }
    } else {
      // Create next version
      const maxVer = currentVersions.reduce((max, v) => Math.max(max, Number(v.version || 0)), 0);
      targetVerNum = maxVer + 1;
      currentVersions.push({
        version: targetVerNum,
        entries: existingEntries,
        savedAt: new Date().toISOString()
      });
      createdNewVer = true;
    }

    // Set updated quote object properties
    setQuote(prev => ({
      ...prev,
      menuMontajeEntries: existingEntries,
      menuMontajeVersion: targetVerNum,
      menuMontajeVersions: currentVersions
    }));

    setSelectedMmsVersion(targetVerNum);

    Swal.fire({
      title: '¡Operación Exitosa!',
      text: createdNewVer 
        ? `Menú y montaje guardados correctamente en la nueva versión V${targetVerNum}.` 
        : `Menú y montaje actualizados exitosamente en la versión V${targetVerNum}.`,
      icon: 'success',
      timer: 2000,
      showConfirmButton: false
    });
  };

  // Load a version from the historic snapshots
  const handleLoadVersionHistory = () => {
    const verNum = Number(selectedMmsVersion);
    const verSnap = quote.menuMontajeVersions?.find(v => Number(v.version) === verNum);

    if (!verSnap) {
      Swal.fire('Error', 'No se encontró la versión seleccionada en el historial.', 'error');
      return;
    }

    Swal.fire({
      title: `¿Cargar Versión V${verNum}?`,
      text: 'Esto reemplazará las asignaciones de menú y montaje actuales con el respaldo seleccionado.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cargar',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed) {
        setQuote(prev => ({
          ...prev,
          menuMontajeEntries: verSnap.entries || [],
          menuMontajeVersion: verNum
        }));
        Swal.fire('Cargado', `Se aplicó el respaldo de la versión V${verNum}.`, 'success');
      }
    });
  };

  // ----------------------------------------------------
  // IN-APP PRINT & PDF GENERATOR
  // ----------------------------------------------------
  
  const handlePrintMms = () => {
    const entries = quote.menuMontajeEntries || [];
    if (!entries.length) {
      Swal.fire('Error', 'No hay datos de menú y montaje para imprimir.', 'error');
      return;
    }

    const docTitle = `${quote.companyName || 'Cliente'} - MENÚ & MONTAJE`;
    const orderedCombos = [...entries].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const sectionsHtml = orderedCombos.map(r => `
      <article class="mmReportCard" style="page-break-after: always; margin-bottom: 24px; border: 1px solid #bdd0e9; border-radius: 12px; overflow: hidden; background: #fff; font-family: sans-serif;">
        <div class="mmReportHead" style="background: linear-gradient(135deg, #0f3c67, #165d90); color: #fff; padding: 14px; font-size: 18px; font-weight: 900; text-transform: uppercase;">
          ${quote.companyName || 'Menú y Montaje'} - ${r.date}
        </div>
        <div class="mmReportMeta" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px; background: #edf5ff; border-bottom: 1px solid #c9d8ee; font-size: 13.5px;">
          <div><b>Folio:</b> ${quote.folio || 'N/A'}</div>
          <div><b>No. Cotización:</b> ${quote.code || 'N/A'}</div>
          <div><b>Salón:</b> ${r.salon}</div>
          <div><b>Pax Asignado:</b> ${r.menuQty || quote.people || 'N/A'}</div>
          <div><b>Tipo Evento:</b> ${quote.eventType || 'N/A'}</div>
          <div><b>Horario:</b> ${quote.schedule || 'N/A'}</div>
        </div>
        <div class="mmReportBlock" style="padding: 16px; border-bottom: 1px solid #d9e2f2;">
          <h3 style="margin: 0 0 10px; color: #0a3f67; font-size: 16px; text-transform: uppercase;">🍽️ Menú: ${r.menuTitle}</h3>
          <pre style="white-space: pre-wrap; font-family: sans-serif; font-size: 13px; color: #334155; margin: 0;">${r.menuDescription || 'Detalle no ingresado'}</pre>
        </div>
        <div class="mmReportBlock" style="padding: 16px;">
          <h3 style="margin: 0 0 10px; color: #0a3f67; font-size: 16px; text-transform: uppercase;">⛺ Montaje</h3>
          <pre style="white-space: pre-wrap; font-family: sans-serif; font-size: 13px; color: #334155; margin: 0;">${r.montajeDescription || 'Detalle no ingresado'}</pre>
        </div>
      </article>
    `).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
      <head>
        <title>${docTitle}</title>
        <style>
          body { background: #eef3fb; padding: 20px; font-family: system-ui, sans-serif; }
          @media print {
            body { background: #fff; padding: 0; }
            .mmReportCard { box-shadow: none; page-break-after: always; }
          }
        </style>
      </head>
      <body>
        <div style="max-width: 900px; margin: 0 auto;">
          ${sectionsHtml}
        </div>
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ----------------------------------------------------
  // FILTERED BUILDER OPTIONS
  // ----------------------------------------------------

  const filteredStageOptions = useMemo(() => {
    let list = [];
    const term = filterQuery.toLowerCase().trim();

    if (builderStage === 'plato') {
      list = catalogs.proteins;
    } else if (builderStage === 'preparacion') {
      list = catalogs.preparations;
    } else if (builderStage === 'salsa') {
      list = catalogs.salsas;
    } else if (builderStage === 'guarnicion') {
      list = catalogs.guarniciones;
    } else if (builderStage === 'postre') {
      list = catalogs.postres;
    } else if (builderStage === 'bebida') {
      list = catalogs.bebidas;
    } else if (builderStage === 'montaje_tipo') {
      list = catalogs.montajeTipos;
    } else if (builderStage === 'montaje_adicional') {
      list = catalogs.montajeAdicionales;
    }

    if (term) {
      list = list.filter(x => x.nombre?.toLowerCase().includes(term));
    }

    return list;
  }, [builderStage, catalogs, filterQuery]);

  // Check if item is selected in builder
  const isOptionSelected = (id) => {
    const numId = Number(id);
    if (builderStage === 'plato') return String(numId) === selectedProtein;
    if (builderStage === 'preparacion') return String(numId) === selectedPrep;
    if (builderStage === 'salsa') return selectedSalsas.includes(numId);
    if (builderStage === 'guarnicion') return selectedGuarniciones.includes(numId);
    if (builderStage === 'postre') return selectedPostres.includes(numId);
    if (builderStage === 'bebida') return selectedBebidas.includes(numId);
    if (builderStage === 'montaje_tipo') return String(numId) === selectedMontajeTipo;
    if (builderStage === 'montaje_adicional') return selectedMontajeAdicionales.includes(numId);
    return false;
  };

  // ----------------------------------------------------
  // TEXT TOOLS (FORMATTING HELPERS)
  // ----------------------------------------------------

  const insertTextSnippet = (snippetType, target) => {
    const textToInsert = snippetType === 'separator' ? '\n-------------------------------------------\n' : '';
    if (target === 'menu') {
      setMenuDescription(prev => prev + textToInsert);
    } else {
      setMontajeDescription(prev => prev + textToInsert);
    }
  };

  // ----------------------------------------------------
  // RENDERING CSS STYLES (HSL PALETTE)
  // ----------------------------------------------------

  const containerStyle = {
    background: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
  };

  const sectionHeadStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '2px solid #f1f5f9',
    paddingBottom: '14px',
    marginBottom: '8px'
  };

  const titleStyle = {
    margin: 0,
    fontSize: '18px',
    fontWeight: '900',
    color: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const comboGridStyle = {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 0.8fr',
    gap: '16px',
    background: '#f8fafc',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0'
  };

  const labelStyle = {
    fontSize: '11px',
    fontWeight: '800',
    color: '#475569',
    marginBottom: '6px',
    textTransform: 'uppercase',
    display: 'block',
    letterSpacing: '0.5px'
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1.5px solid #cbd5e1',
    fontSize: '13px',
    color: '#1e293b',
    background: 'white',
    boxSizing: 'border-box'
  };

  const tabBtnStyle = (tabId) => ({
    padding: '10px 18px',
    borderRadius: '8px',
    fontWeight: '800',
    fontSize: '12.5px',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s',
    background: activeSubTab === tabId ? '#1e3a8a' : '#f1f5f9',
    color: activeSubTab === tabId ? 'white' : '#475569'
  });

  const stageBtnStyle = (stageId) => ({
    padding: '8px 14px',
    borderRadius: '6px',
    fontWeight: '800',
    fontSize: '12px',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s',
    background: builderStage === stageId ? '#0d9488' : '#eff6ff',
    color: builderStage === stageId ? 'white' : '#2563eb'
  });

  return (
    <div style={containerStyle}>
      {/* Header and Version controls */}
      <div style={sectionHeadStyle}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <h3 style={titleStyle}>🍽️ Planificador de Menú & Montaje</h3>
          <span style={{
            background: '#e0f2fe',
            color: '#0369a1',
            fontSize: '11.5px',
            fontWeight: '900',
            padding: '3px 8px',
            borderRadius: '6px'
          }}>
            V{quote.menuMontajeVersion || 1} Activa
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            type="button" 
            onClick={() => setActiveSubTab('builder')} 
            style={tabBtnStyle('builder')}
          >
            🧩 Constructor Interactivo
          </button>
          <button 
            type="button" 
            onClick={() => setActiveSubTab('classic')} 
            style={tabBtnStyle('classic')}
          >
            ✍️ Editor Clásico (Manual)
          </button>
        </div>
      </div>

      {/* Date & Salon Select Combo */}
      <div style={comboGridStyle}>
        <div>
          <label style={labelStyle}>Fecha + Salón Asignados</label>
          <select 
            value={selectedKey}
            onChange={e => setSelectedKey(e.target.value)}
            style={inputStyle}
          >
            {combos.map(c => (
              <option key={c.key} value={c.key}>{c.date} — {c.salon}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label style={labelStyle}>Versión Histórica</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <select 
              value={selectedMmsVersion} 
              onChange={e => setSelectedMmsVersion(Number(e.target.value))}
              style={inputStyle}
            >
              {quote.menuMontajeVersions && quote.menuMontajeVersions.length > 0 ? (
                quote.menuMontajeVersions.map(v => (
                  <option key={v.version} value={v.version}>Versión V{v.version} ({v.savedAt?.split('T')[0]})</option>
                ))
              ) : (
                <option value="1">Versión V1 (Borrador)</option>
              )}
            </select>
            <button 
              type="button"
              onClick={handleLoadVersionHistory}
              style={{
                background: '#eff6ff',
                color: '#2563eb',
                border: '1.5px solid #bfdbfe',
                padding: '8px 12px',
                borderRadius: '8px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              Cargar
            </button>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Documento Relativo</label>
          <input 
            value={quote.code || '(Sin guardar)'}
            readOnly 
            style={{ ...inputStyle, background: '#f1f5f9', fontWeight: 'bold', color: '#64748b' }}
          />
        </div>
      </div>

      {/* INTERACTIVE BUILDER TAB */}
      {activeSubTab === 'builder' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.3fr', gap: '20px' }}>
          {/* Builder Options Workbench */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Step Category Selectors */}
            <div style={{
              background: '#f8fafc',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px'
            }}>
              <button type="button" onClick={() => { setBuilderStage('plato'); setFilterQuery(''); }} style={stageBtnStyle('plato')}>1. Plato Fuerte</button>
              <button type="button" disabled={!selectedProtein} onClick={() => { setBuilderStage('preparacion'); setFilterQuery(''); }} style={stageBtnStyle('preparacion')}>2. Preparación</button>
              <button type="button" disabled={!selectedProtein} onClick={() => { setBuilderStage('salsa'); setFilterQuery(''); }} style={stageBtnStyle('salsa')}>3. Salsas</button>
              <button type="button" disabled={!selectedProtein} onClick={() => { setBuilderStage('guarnicion'); setFilterQuery(''); }} style={stageBtnStyle('guarnicion')}>4. Guarniciones</button>
              <button type="button" disabled={!selectedProtein} onClick={() => { setBuilderStage('postre'); setFilterQuery(''); }} style={stageBtnStyle('postre')}>5. Postres</button>
              <button type="button" disabled={!selectedProtein} onClick={() => { setBuilderStage('bebida'); setFilterQuery(''); }} style={stageBtnStyle('bebida')}>6. Bebidas</button>
              <button type="button" onClick={() => { setBuilderStage('montaje_tipo'); setFilterQuery(''); }} style={stageBtnStyle('montaje_tipo')}>7. Montaje Tipo</button>
              <button type="button" disabled={!selectedMontajeTipo} onClick={() => { setBuilderStage('montaje_adicional'); setFilterQuery(''); }} style={stageBtnStyle('montaje_adicional')}>8. Adicionales</button>
            </div>

            {/* Quick Actions Search Bar */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder={`Filtrar opciones de ${builderStage}...`} 
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                style={inputStyle}
              />
              <button 
                type="button" 
                onClick={handleClearForm}
                style={{
                  background: '#fef2f2',
                  color: '#991b1b',
                  border: '1.5px solid #fca5a5',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontWeight: '800',
                  fontSize: '12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                🗑️ Anular Todo
              </button>
            </div>

            {/* Dynamic Catalog Board */}
            <div style={{
              background: 'white',
              border: '1.5px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '16px',
              minHeight: '260px',
              maxHeight: '340px',
              overflowY: 'auto'
            }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '13px', textTransform: 'uppercase', color: '#475569', fontWeight: '900' }}>
                📋 Disponibles en Catálogo ({builderStage})
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px' }}>
                {filteredStageOptions.length > 0 ? (
                  filteredStageOptions.map(opt => {
                    const selected = isOptionSelected(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleStageOptionClick(opt.id, opt.nombre)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: selected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          background: selected ? '#eff6ff' : '#f8fafc',
                          color: selected ? '#1e40af' : '#1e293b',
                          fontWeight: '700',
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>{opt.nombre}</span>
                        {selected && <span style={{ color: '#2563eb' }}>✓</span>}
                      </button>
                    );
                  })
                ) : (
                  <div style={{ colSpan: '3', padding: '16px', color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>
                    No se encontraron opciones para el filtro aplicado.
                  </div>
                )}
              </div>
            </div>

            {/* Active Plate / Line draft items list */}
            {lineItemsDraft.length > 0 && (
              <div style={{ background: '#f0fdf4', padding: '12px 16px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '12.5px', color: '#166534', fontWeight: '900', textTransform: 'uppercase' }}>
                  🥗 Platos Fuertes Configurados en este día
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {lineItemsDraft.map((line, idx) => {
                    const protein = catalogs.proteins.find(x => String(x.id) === String(line.platoId))?.nombre || 'Plato';
                    const active = line.key === activeLineKey;
                    return (
                      <div key={line.key} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: active ? '1.5px solid #166534' : '1px solid #dcfce7'
                      }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#14532d' }}>
                          [Plato {idx + 1}] {protein} (Cant: {line.qty})
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            type="button" 
                            onClick={() => handleEditLineItem(line)}
                            style={{
                              background: '#eff6ff',
                              color: '#2563eb',
                              border: 'none',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            Editar
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveLineItem(line.key)}
                            style={{
                              background: '#fef2f2',
                              color: '#991b1b',
                              border: 'none',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Builder Live Comanda Preview Column */}
          <div style={{
            background: 'linear-gradient(to bottom, #f8fafc, #edf2f7)',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            justifyContent: 'space-between'
          }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '900', color: '#1e3a8a' }}>
                📝 Resumen de la Comanda
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Vista preliminar formateada del menú y montaje antes de consolidar.
              </p>

              {/* Live Preview Text Areas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
                <div>
                  <label style={labelStyle}>Descripción de Menú compilado</label>
                  <textarea 
                    value={menuDescription}
                    onChange={e => setMenuDescription(e.target.value)}
                    rows={6}
                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px', background: '#ffffff' }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Descripción de Montaje compilado</label>
                  <textarea 
                    value={montajeDescription}
                    onChange={e => setMontajeDescription(e.target.value)}
                    rows={4}
                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px', background: '#ffffff' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleSaveMenuMontaje(true)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'white',
                    border: '1.5px solid #cbd5e1',
                    color: '#475569',
                    fontWeight: '800',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  Actualizar Activa
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveMenuMontaje(false)}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '8px',
                    background: '#0d9488',
                    border: 'none',
                    color: 'white',
                    fontWeight: '800',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(13, 148, 136, 0.2)'
                  }}
                >
                  Guardar V{quote.menuMontajeVersions?.length + 1 || 2}
                </button>
              </div>
              
              <button
                type="button"
                onClick={handlePrintMms}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '10px',
                  borderRadius: '8px',
                  background: '#1e3a8a',
                  color: 'white',
                  border: 'none',
                  fontWeight: '800',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                🖨️ Generar Informe / Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLASSIC MANUAL EDITOR TAB */}
      {activeSubTab === 'classic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Título comercial del menú</label>
              <input 
                type="text" 
                placeholder="Ej: Desayunos Buffet Americano, Almuerzo Gala"
                value={menuTitle}
                onChange={e => setMenuTitle(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Cantidad (Menú PAX)</label>
              <input 
                type="number" 
                placeholder="Ej: 150"
                value={menuQty}
                onChange={e => setMenuQty(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Free Form Menu Description */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, margin: 0 }}>Descripción Manual del Menú</label>
                <button 
                  type="button" 
                  onClick={() => insertTextSnippet('separator', 'menu')}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  + Separador
                </button>
              </div>
              <textarea 
                value={menuDescription}
                onChange={e => setMenuDescription(e.target.value)}
                rows={10}
                placeholder="Escriba aquí los detalles del menú libremente..."
                style={{ ...inputStyle, fontFamily: 'monospace' }}
              />
              <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                {menuDescription.length} caracteres
              </span>
            </div>

            {/* Free Form Montage Description */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, margin: 0 }}>Descripción Manual del Montaje</label>
                <button 
                  type="button" 
                  onClick={() => insertTextSnippet('separator', 'montaje')}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  + Separador
                </button>
              </div>
              <textarea 
                value={montajeDescription}
                onChange={e => setMontajeDescription(e.target.value)}
                rows={10}
                placeholder="Escriba aquí las notas de montaje y logística libremente..."
                style={{ ...inputStyle, fontFamily: 'monospace' }}
              />
              <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                {montajeDescription.length} caracteres
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={handlePrintMms}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                background: '#1e3a8a',
                color: 'white',
                border: 'none',
                fontWeight: '800',
                fontSize: '12.5px',
                cursor: 'pointer'
              }}
            >
              🖨️ Imprimir / PDF
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleSaveMenuMontaje(true)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: 'white',
                  border: '1.5px solid #cbd5e1',
                  color: '#475569',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Actualizar Activa
              </button>
              <button
                type="button"
                onClick={() => handleSaveMenuMontaje(false)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  background: '#0d9488',
                  border: 'none',
                  color: 'white',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)'
                }}
              >
                Guardar como Nueva Versión V{quote.menuMontajeVersions?.length + 1 || 2}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History log block */}
      {quote.menuMontajeEntries && quote.menuMontajeEntries.length > 0 && (
        <div style={{
          background: '#f8fafc',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginTop: '10px'
        }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#1e3a8a', fontWeight: '900', textTransform: 'uppercase' }}>
            📅 Registros de Comanda ya generados para esta Cotización ({quote.menuMontajeEntries.length})
          </h4>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: 'bold' }}>
                  <th style={{ padding: '6px 8px' }}>Fecha</th>
                  <th style={{ padding: '6px 8px' }}>Salón</th>
                  <th style={{ padding: '6px 8px' }}>Título Menú</th>
                  <th style={{ padding: '6px 8px' }}>Cantidad</th>
                  <th style={{ padding: '6px 8px' }}>Última Actualización</th>
                </tr>
              </thead>
              <tbody>
                {quote.menuMontajeEntries.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{entry.date}</td>
                    <td style={{ padding: '6px 8px' }}>{entry.salon}</td>
                    <td style={{ padding: '6px 8px' }}>{entry.menuTitle}</td>
                    <td style={{ padding: '6px 8px' }}>{entry.menuQty || 'N/A'}</td>
                    <td style={{ padding: '6px 8px' }}>{entry.updatedAt?.split('T')[0] || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
