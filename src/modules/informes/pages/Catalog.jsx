import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';import {
  getIngredientes, 
  createIngrediente, 
  getOpcionesIngrediente, 
  createOpcionIngrediente,
  getPlatillos,
  createPlatillo,
  getPlatilloDetalle,
  addComponentePlatillo,
  removeComponentePlatillo,
  updateComponentePlatillo,
  getSugerenciasDisponibles,
  getMenus,
  createMenu,
  updateMenu,
  getMenuDetalle,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getCategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria,
} from '../services/api.js';
import { IconPackage, IconChefHat, IconMenu, IconTag, IconPlus, IconTrash, IconCheckCircle, IconSearch, IconX } from '../components/Icons.jsx';

const TIPO_LABELS = {
  proteina:     { label: 'Proteína',      icon: '🥩', color: '#ef4444' },
  guarnicion:   { label: 'Guarnición',    icon: '🥗', color: '#10b981' },
  salsa:        { label: 'Salsa',         icon: '🫗', color: '#f59e0b' },
  postre:       { label: 'Postre',        icon: '🍰', color: '#ec4899' },
  tortilla_pan: { label: 'Tortilla/Pan',  icon: '🌮', color: '#a855f7' },
  bebida:       { label: 'Bebida',        icon: '🥤', color: '#06b6d4' },
  otros:        { label: 'Otros',         icon: '📦', color: '#64748b' },
};

const TIPO_OPTS = ['proteina','guarnicion','salsa','postre','tortilla_pan','bebida','otros'];

// ─── Subcomponente: sección de ingredientes por tipo para agregar al platillo ────
function SugerenciaTipoSection({ tipo, ingredientes, opcionesPorIng, seleccionados, onToggle, onOpcionChange }) {
  const cfg = TIPO_LABELS[tipo] || TIPO_LABELS.otros;
  const disponibles = ingredientes.filter(i => i.tipo === tipo || 
    (tipo === 'tortilla_pan' && i.tipo === 'tortilla_pan') ||
    (tipo === 'guarnicion' && i.tipo === 'guarnición'));

  if (disponibles.length === 0) return null;

  return (
    <div className="sug-tipo-section">
      <div className="sug-tipo-header" style={{ borderLeftColor: cfg.color }}>
        <span className="sug-tipo-icon">{cfg.icon}</span>
        <span className="sug-tipo-label">{cfg.label}</span>
        <span className="sug-tipo-count">{seleccionados.filter(s => s.tipo_componente === tipo).length}/{disponibles.length}</span>
      </div>
      <div className="sug-tipo-items">
        {disponibles.map(ing => {
          const sel = seleccionados.find(s => s.ingrediente_id === ing.id && s.tipo_componente === tipo);
          return (
            <div key={ing.id} className={`sug-item ${sel ? 'sug-item-selected' : ''}`}>
              <button
                className="sug-item-btn"
                onClick={() => onToggle(ing, tipo)}
                data-tooltip={sel ? 'Quitar del platillo' : 'Añadir al platillo'}
              >
                <span className="sug-item-check">{sel ? <IconCheckCircle size={14} /> : <span className="sug-item-circle" />}</span>
                <span className="sug-item-name">{ing.nombre}</span>
              </button>
              {sel && opcionesPorIng[ing.id] && opcionesPorIng[ing.id].length > 0 && (
                <select
                  className="sug-item-opcion"
                  value={sel.opcion_id || ''}
                  onChange={e => onOpcionChange(ing.id, tipo, e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Sin opción</option>
                  {opcionesPorIng[ing.id].map(op => (
                    <option key={op.id} value={op.id}>{op.nombre_opcion}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function Catalog() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('ingredientes');
  const [loading, setLoading] = useState(false);

  // ─── INGREDIENTES ───
  const [ingredientes, setIngredientes] = useState([]);
  const [searchIngredientes, setSearchIngredientes] = useState('');
  const [newIngrediente, setNewIngrediente] = useState({ nombre: '', tipo: 'proteina' });
  const [selectedIngrediente, setSelectedIngrediente] = useState(null);
  const [opciones, setOpciones] = useState([]);
  const [newOpcion, setNewOpcion] = useState({ nombre_opcion: '' });
  const ingredientesFiltrados = searchIngredientes
    ? ingredientes.filter(i => {
        const q = searchIngredientes.toLowerCase();
        const tipoLabel = (TIPO_LABELS[i.tipo]?.label || i.tipo).toLowerCase();
        return i.nombre.toLowerCase().includes(q) || tipoLabel.includes(q);
      })
    : ingredientes;

  // ─── PLATILLOS ───
  const [platillos, setPlatillos] = useState([]);
  const [searchPlatillos, setSearchPlatillos] = useState('');
  const [newPlatillo, setNewPlatillo] = useState({ nombre_platillo: '', descripcion: '' });
  const [selectedPlatillo, setSelectedPlatillo] = useState(null);
  const [platilloDetalle, setPlatilloDetalle] = useState(null);
  const [sugerenciasData, setSugerenciasData] = useState(null); // ingredientes_agrupados + opciones_por_ingrediente
  const platillosFiltrados = searchPlatillos
    ? platillos.filter(p => p.nombre_platillo.toLowerCase().includes(searchPlatillos.toLowerCase()))
    : platillos;

  // ─── CATEGORÍAS DE ALIMENTO ───
  const [categorias, setCategorias] = useState([]);
  const [newCategoria, setNewCategoria] = useState('');
  const [editingCategoriaId, setEditingCategoriaId] = useState(null);
  const [editCategoriaName, setEditCategoriaName] = useState('');

  // ─── MENÚS ───
  const [menus, setMenus] = useState([]);
  const [searchMenus, setSearchMenus] = useState('');
  const [newMenu, setNewMenu] = useState({ nombre_menu: '', descripcion: '', categoria_id: '' });
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [menuDetalle, setMenuDetalle] = useState(null);
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [editMenuName, setEditMenuName] = useState('');
  const [editMenuDesc, setEditMenuDesc] = useState('');
  const [editMenuCategoriaId, setEditMenuCategoriaId] = useState(null);
  const menusFiltrados = searchMenus
    ? menus.filter(m => m.nombre_menu.toLowerCase().includes(searchMenus.toLowerCase()))
    : menus;

  useEffect(() => {
    loadIngredientes();
    loadPlatillos();
    loadMenus();
    loadCategorias();
  }, []);

  const loadIngredientes = async () => {
    setLoading(true);
    try { setIngredientes(await getIngredientes()); }
    catch (err) { toast.error('Error al cargar ingredientes: ' + err.message); }
    finally { setLoading(false); }
  };

  const loadPlatillos = async () => {
    try { setPlatillos(await getPlatillos()); }
    catch (err) { toast.error('Error al cargar platillos: ' + err.message); }
  };

  const loadMenus = async () => {
    try { setMenus(await getMenus()); }
    catch (err) { toast.error('Error al cargar menús: ' + err.message); }
  };

  const loadCategorias = async () => {
    try { setCategorias(await getCategorias()); }
    catch (err) { toast.error('Error al cargar categorías: ' + err.message); }
  };

  const handleIngredienteSelect = async (ing) => {
    setSelectedIngrediente(ing);
    try {
      const opts = await getOpcionesIngrediente(ing.id);
      setOpciones(opts);
    } catch (err) {
      toast.error('Error al cargar opciones: ' + err.message);
    }
  };

  const handlePlatilloSelect = async (plat) => {
    setSelectedPlatillo(plat);
    setLoading(true);
    try {
      const [detalle, sugerencias] = await Promise.all([
        getPlatilloDetalle(plat.id),
        getSugerenciasDisponibles(),
      ]);
      setPlatilloDetalle(detalle);
      setSugerenciasData(sugerencias);
    } catch (err) {
      toast.error('Error al cargar detalle: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMenuSelect = async (menu) => {
    setSelectedMenu(menu);
    setLoading(true);
    try {
      const detalle = await getMenuDetalle(menu.id);
      setMenuDetalle(detalle);
    } catch (err) {
      toast.error('Error al cargar detalle del menú: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Handlers Ingredientes ───
  const onAddIngrediente = async (e) => {
    e.preventDefault();
    try {
      await createIngrediente(newIngrediente);
      toast.success(`Ingrediente "${newIngrediente.nombre}" creado`);
      setNewIngrediente({ nombre: '', tipo: 'proteina' });
      loadIngredientes();
    } catch (err) {
      toast.error('Error al crear ingrediente: ' + err.message);
    }
  };

  const onAddOpcion = async (e) => {
    e.preventDefault();
    try {
      await createOpcionIngrediente({ ...newOpcion, ingrediente_id: selectedIngrediente.id });
      toast.success(`Opción "${newOpcion.nombre_opcion}" añadida`);
      setNewOpcion({ nombre_opcion: '' });
      handleIngredienteSelect(selectedIngrediente);
    } catch (err) {
      toast.error('Error al crear opción: ' + err.message);
    }
  };

  // ─── Handlers Platillos ───
  const onAddPlatillo = async (e) => {
    e.preventDefault();
    try {
      const nuevo = await createPlatillo(newPlatillo);
      toast.success(`Platillo "${newPlatillo.nombre_platillo}" creado`);
      setNewPlatillo({ nombre_platillo: '', descripcion: '', categoria_id: '' });
      await loadPlatillos();
      handlePlatilloSelect(nuevo);
    } catch (err) {
      toast.error('Error al crear platillo: ' + err.message);
    }
  };

  const onAddCategoria = async (e) => {
    e.preventDefault();
    if (!newCategoria.trim()) return;
    try {
      await createCategoria(newCategoria.trim());
      toast.success(`Categoría "${newCategoria.trim()}" creada`);
      setNewCategoria('');
      loadCategorias();
    } catch (err) {
      toast.error('Error al crear categoría: ' + err.message);
    }
  };

  const startEditCategoria = (cat) => {
    setEditingCategoriaId(cat.id);
    setEditCategoriaName(cat.nombre);
  };

  const saveEditCategoria = async () => {
    if (!editCategoriaName.trim()) return;
    try {
      await updateCategoria(editingCategoriaId, { nombre: editCategoriaName.trim() });
      toast.success('Categoría actualizada');
      setEditingCategoriaId(null);
      loadCategorias();
      loadPlatillos();
    } catch (err) {
      toast.error('Error al actualizar categoría: ' + err.message);
    }
  };

  const onDeleteCategoria = async (id, nombre) => {
    if (!confirm(`¿Eliminar la categoría "${nombre}"? Se quitará de los platillos que la usen.`)) return;
    try {
      await deleteCategoria(id);
      toast.success(`Categoría "${nombre}" eliminada`);
      loadCategorias();
      loadPlatillos();
    } catch (err) {
      toast.error('Error al eliminar categoría: ' + err.message);
    }
  };

  const onAddMenu = async (e) => {
    e.preventDefault();
    try {
      const nuevo = await createMenu(newMenu);
      toast.success(`Menú "${newMenu.nombre_menu}" creado`);
      resetNewMenuForm();
      await loadMenus();
      handleMenuSelect(nuevo);
    } catch (err) {
      toast.error('Error al crear menú: ' + err.message);
    }
  };

  const resetNewMenuForm = () => {
    setNewMenu({ nombre_menu: '', descripcion: '', categoria_id: '' });
  };

  const startEditMenu = (menu) => {
    setEditingMenuId(menu.id);
    setEditMenuName(menu.nombre_menu);
    setEditMenuDesc(menu.descripcion || '');
    setEditMenuCategoriaId(menu.categoria_id || null);
  };

  const saveEditMenu = async () => {
    if (!editMenuName.trim()) return;
    try {
      const updated = await updateMenu(editingMenuId, {
        nombre_menu: editMenuName.trim(),
        descripcion: editMenuDesc.trim() || null,
        categoria_id: editMenuCategoriaId || null,
      });
      toast.success('Menú actualizado');
      setEditingMenuId(null);
      if (selectedMenu?.id === editingMenuId) {
        setSelectedMenu(prev => ({ ...prev, ...updated }));
      }
      await loadMenus();
    } catch (err) {
      toast.error('Error al actualizar menú: ' + err.message);
    }
  };

  const onToggleSugerencia = async (ingrediente, tipo) => {
    try {
      const existing = platilloDetalle?.componentes?.find(
        c => c.ingrediente_id === ingrediente.id && c.tipo_componente === tipo
      );
      if (existing) {
        await removeComponentePlatillo(existing.id);
        toast.info(`"${ingrediente.nombre}" quitado del platillo`);
      } else {
        await addComponentePlatillo(selectedPlatillo.id, {
          ingrediente_id: ingrediente.id,
          tipo_componente: tipo,
          cantidad: 1,
        });
        toast.success(`"${ingrediente.nombre}" añadido al platillo`);
      }
      handlePlatilloSelect(selectedPlatillo);
    } catch (err) {
      toast.error('Error al actualizar sugerencia: ' + err.message);
    }
  };

  const onOpcionSugerenciaChange = async (ingredienteId, tipo, opcionId) => {
    try {
      const existing = platilloDetalle?.componentes?.find(
        c => c.ingrediente_id === ingredienteId && c.tipo_componente === tipo
      );
      if (existing) {
        await updateComponentePlatillo(existing.id, { opcion_id: opcionId });
        handlePlatilloSelect(selectedPlatillo);
      }
    } catch (err) {
      toast.error('Error al cambiar opción: ' + err.message);
    }
  };

  // ─── Handlers Menús ───
  const onToggleMenuItem = async (ingrediente, tipo) => {
    try {
      const existing = menuDetalle?.items?.find(
        item => item.ingrediente_id === ingrediente.id
      );
      if (existing) {
        await deleteMenuItem(existing.id);
        toast.info(`"${ingrediente.nombre}" quitado del menú`);
      } else {
        await createMenuItem({
          menu_id: selectedMenu.id,
          ingrediente_id: ingrediente.id,
          cantidad: 1,
        });
        toast.success(`"${ingrediente.nombre}" añadido al menú`);
      }
      handleMenuSelect(selectedMenu);
    } catch (err) {
      toast.error('Error al actualizar menú: ' + err.message);
    }
  };

  const onOpcionMenuChange = async (ingredienteId, opcionId) => {
    try {
      const existing = menuDetalle?.items?.find(
        item => item.ingrediente_id === ingredienteId
      );
      if (existing) {
        await updateMenuItem(existing.id, { opcion_id: opcionId });
        handleMenuSelect(selectedMenu);
      }
    } catch (err) {
      toast.error('Error al cambiar opción: ' + err.message);
    }
  };

  return (
    <div className="catalog-container">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <IconPackage size={22} /> Gestión de Platillos
      </h1>

      <div className="tabs">
        <button onClick={() => setActiveTab('ingredientes')} className={activeTab === 'ingredientes' ? 'active' : ''}>
          <IconTag size={15} /> Ingredientes
        </button>
        <button onClick={() => setActiveTab('platillos')} className={activeTab === 'platillos' ? 'active' : ''}>
          <IconChefHat size={15} /> Platillos
        </button>
        <button onClick={() => setActiveTab('menus')} className={activeTab === 'menus' ? 'active' : ''}>
          <IconMenu size={15} /> Menús
        </button>
        <button onClick={() => setActiveTab('categorias')} className={activeTab === 'categorias' ? 'active' : ''}>
          <IconTag size={15} /> Categorías
        </button>
      </div>

      {/* ════════ TAB: INGREDIENTES ════════ */}
      {activeTab === 'ingredientes' && (
        <div className="catalog-grid">
          <section className="catalog-section">
            <h3><IconTag size={16} /> Crear Ingrediente</h3>
            <form onSubmit={onAddIngrediente}>
              <input 
                placeholder="Nombre del ingrediente" 
                value={newIngrediente.nombre} 
                onChange={e => setNewIngrediente({...newIngrediente, nombre: e.target.value})} 
                required 
              />
              <select value={newIngrediente.tipo} onChange={e => setNewIngrediente({...newIngrediente, tipo: e.target.value})}>
                <option value="proteina">Proteína</option>
                <option value="guarnicion">Guarnición</option>
                <option value="salsa">Salsa</option>
                <option value="postre">Postre</option>
                <option value="tortilla_pan">Tortilla / Pan</option>
                <option value="bebida">Bebida</option>
                <option value="otros">Otros</option>
              </select>
              <button type="submit" className="btn-primary"><IconPlus size={15} /> Añadir Ingrediente</button>
            </form>

            <div style={{position:'relative',margin:'0.75rem 0'}}>
              <IconSearch size={13} style={{position:'absolute',left:'0.5rem',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none'}} />
              <input
                type="text" placeholder="Buscar ingrediente..."
                value={searchIngredientes}
                onChange={e => setSearchIngredientes(e.target.value)}
                style={{paddingLeft:'1.6rem',fontSize:'0.82rem',width:'100%'}}
              />
              {searchIngredientes && (
                <button
                  onClick={() => setSearchIngredientes('')}
                  style={{position:'absolute',right:'0.3rem',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'0.2rem',lineHeight:1}}
                >
                  <IconX size={13} />
                </button>
              )}
            </div>
            <ul className="item-list">
              {ingredientesFiltrados.length === 0 ? (
                <li style={{color:'var(--text-muted)',fontStyle:'italic',textAlign:'center',padding:'0.5rem',fontSize:'0.85rem',listStyle:'none'}}>
                  {searchIngredientes ? 'Sin resultados' : 'Sin ingredientes aún'}
                </li>
              ) : (
                ingredientesFiltrados.map(ing => (
                  <li key={ing.id} onClick={() => handleIngredienteSelect(ing)} className={selectedIngrediente?.id === ing.id ? 'selected' : ''}>
                    <span style={{ marginRight: 6 }}>{TIPO_LABELS[ing.tipo]?.icon || '📦'}</span>
                    {ing.nombre} <small>{TIPO_LABELS[ing.tipo]?.label || ing.tipo}</small>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="catalog-section">
            <h3>Opciones: <span style={{color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.9rem'}}>{selectedIngrediente?.nombre || '---'}</span></h3>
            {selectedIngrediente ? (
              <>
                <form onSubmit={onAddOpcion}>
                  <input 
                    placeholder="Ej: A la plancha, Al horno..." 
                    value={newOpcion.nombre_opcion} 
                    onChange={e => setNewOpcion({nombre_opcion: e.target.value})} 
                    required 
                  />
                  <button type="submit" className="btn-primary"><IconPlus size={15} /> Añadir Opción</button>
                </form>
                <ul className="item-list">
                  {opciones.map(opt => <li key={opt.id}>{opt.nombre_opcion}</li>)}
                </ul>
              </>
            ) : (
              <p style={{color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', padding: '1rem 0'}}>
                Selecciona un ingrediente para añadir opciones de preparación
              </p>
            )}
          </section>
        </div>
      )}

      {/* ════════ TAB: PLATILLOS ════════ */}
      {activeTab === 'platillos' && (
        <div className="catalog-grid" style={{ gridTemplateColumns: selectedPlatillo ? '320px 1fr' : '1fr 1fr' }}>
          {/* Lista de platillos */}
          <section className="catalog-section">
            <h3><IconChefHat size={16} /> Platillos</h3>
            <form onSubmit={onAddPlatillo}>
              <input 
                placeholder="Nombre del platillo (ej: Filete de Pollo)" 
                value={newPlatillo.nombre_platillo} 
                onChange={e => setNewPlatillo({...newPlatillo, nombre_platillo: e.target.value})} 
                required 
              />
              <textarea 
                placeholder="Descripción opcional..." 
                value={newPlatillo.descripcion} 
                onChange={e => setNewPlatillo({...newPlatillo, descripcion: e.target.value})}
              />
              <select
                value={newPlatillo.categoria_id || ''}
                onChange={e => setNewPlatillo({...newPlatillo, categoria_id: e.target.value ? Number(e.target.value) : null})}
                style={{marginBottom:'0.5rem'}}
              >
                <option value="">Sin categoría</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <button type="submit" className="btn-primary"><IconPlus size={15} /> Crear Platillo</button>
            </form>

            <div style={{position:'relative',margin:'0.75rem 0'}}>
              <IconSearch size={13} style={{position:'absolute',left:'0.5rem',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none'}} />
              <input
                type="text" placeholder="Buscar platillo..."
                value={searchPlatillos}
                onChange={e => setSearchPlatillos(e.target.value)}
                style={{paddingLeft:'1.6rem',fontSize:'0.82rem',width:'100%'}}
              />
              {searchPlatillos && (
                <button
                  onClick={() => setSearchPlatillos('')}
                  style={{position:'absolute',right:'0.3rem',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'0.2rem',lineHeight:1}}
                >
                  <IconX size={13} />
                </button>
              )}
            </div>
            <ul className="item-list" style={{ marginTop: '1rem' }}>
              {platillosFiltrados.length === 0 ? (
                <p style={{color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem', fontSize: '0.9rem', textAlign: 'center'}}>
                  {searchPlatillos ? 'Sin resultados' : 'No hay platillos aún. ¡Crea el primero!'}
                </p>
              ) : (
                platillosFiltrados.map(p => (
                  <li key={p.id} onClick={() => handlePlatilloSelect(p)} className={selectedPlatillo?.id === p.id ? 'selected' : ''}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',gap:'0.5rem'}}>
                      <span>{p.nombre_platillo}</span>
                      {p.categoria_nombre && (
                        <span style={{fontSize:'0.68rem',padding:'0.1rem 0.4rem',borderRadius:'var(--radius-full)',background:'var(--primary-bg)',color:'var(--primary)',fontWeight:600,whiteSpace:'nowrap'}}>
                          {p.categoria_nombre}
                        </span>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* Sugerencias del platillo seleccionado */}
          {selectedPlatillo && (
            <section className="catalog-section">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Sugerencias: <span style={{fontWeight: 400, fontSize: '0.9rem', color: 'var(--primary)'}}>{selectedPlatillo.nombre_platillo}</span>
              </h3>
              <p style={{fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem'}}>
                Selecciona los ingredientes que combinan con este platillo. Se mostrarán como sugerencias al crear un informe.
              </p>

              {loading ? (
                <p className="status-message">Cargando...</p>
              ) : sugerenciasData ? (
                <div className="sug-tipo-grid">
                  {TIPO_OPTS.map(tipo => (
                    <SugerenciaTipoSection
                      key={tipo}
                      tipo={tipo}
                      ingredientes={sugerenciasData.ingredientes_agrupados[tipo]?.filter(
                        (_, idx, arr) => arr.findIndex(i => i.id === _.id) === idx
                      ) || []}
                      opcionesPorIng={sugerenciasData.opciones_por_ingrediente || {}}
                      seleccionados={platilloDetalle?.componentes || []}
                      onToggle={onToggleSugerencia}
                      onOpcionChange={onOpcionSugerenciaChange}
                    />
                  ))}
                </div>
              ) : (
                <p className="status-message">Selecciona un platillo para ver sus sugerencias</p>
              )}
            </section>
          )}
        </div>
      )}

      {/* ════════ TAB: CATEGORÍAS ════════ */}
      {activeTab === 'categorias' && (
        <div className="catalog-grid">
          <section className="catalog-section">
            <h3><IconTag size={16} /> Categorías de Alimento</h3>
            <p style={{fontSize:'0.82rem',color:'var(--text-muted)',marginBottom:'0.75rem'}}>
              Categorías para clasificar platillos por tiempo de comida: Desayuno, Refacción, Almuerzo, Cena, etc.
            </p>
            <form onSubmit={onAddCategoria}>
              <input 
                placeholder="Nueva categoría (ej: Brunch, Snack...)" 
                value={newCategoria} 
                onChange={e => setNewCategoria(e.target.value)} 
                required 
              />
              <button type="submit" className="btn-primary"><IconPlus size={15} /> Crear Categoría</button>
            </form>

            <ul className="item-list" style={{marginTop:'1rem'}}>
              {categorias.length === 0 ? (
                <p style={{color:'var(--text-muted)',fontStyle:'italic',padding:'1rem',fontSize:'0.9rem',textAlign:'center'}}>
                  Sin categorías aún
                </p>
              ) : (
                categorias.map(c => {
                  if (editingCategoriaId === c.id) {
                    return (
                      <li key={c.id} style={{display:'flex',alignItems:'center',gap:'0.35rem',padding:'0.35rem',background:'var(--bg-input)',borderRadius:'var(--radius-sm)',border:'1px solid var(--primary)'}}>
                        <input
                          type="text" value={editCategoriaName}
                          onChange={e => setEditCategoriaName(e.target.value)}
                          autoFocus
                          placeholder="Nombre"
                          onKeyDown={e => { if (e.key === 'Enter') saveEditCategoria(); if (e.key === 'Escape') setEditingCategoriaId(null); }}
                          style={{fontSize:'0.85rem',flex:1}}
                        />
                        <button className="btn-primary btn-sm" onClick={saveEditCategoria} data-tooltip="Guardar">✓</button>
                        <button className="btn-secondary btn-sm" onClick={() => setEditingCategoriaId(null)} data-tooltip="Cancelar">✕</button>
                      </li>
                    );
                  }
                  return (
                    <li key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <span onDoubleClick={() => startEditCategoria(c)} style={{cursor:'pointer'}}>{c.nombre}</span>
                      <div style={{display:'flex',alignItems:'center',gap:'0.25rem'}}>
                        <button
                          className="config-action-btn config-action-edit"
                          onClick={() => startEditCategoria(c)}
                          data-tooltip="Editar nombre"
                          style={{fontSize:'0.7rem',padding:'0.1rem 0.25rem',opacity:0.5}}
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => onDeleteCategoria(c.id, c.nombre)}
                          data-tooltip="Eliminar categoría"
                          style={{fontSize:'0.72rem',padding:'0.15rem 0.5rem'}}
                        >
                          <IconTrash size={11} />
                        </button>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
          <section className="catalog-section">
            <h3 style={{color:'var(--text-muted)',fontSize:'0.9rem'}}>Vista previa</h3>
            <p style={{fontSize:'0.82rem',color:'var(--text-muted)',fontStyle:'italic'}}>
              Las categorías aparecen como etiquetas junto al nombre de los platillos en la pestaña Platillos.
              También puedes seleccionar la categoría al crear un platillo.
            </p>
            <div style={{marginTop:'1rem',display:'flex',flexWrap:'wrap',gap:'0.4rem'}}>
              {['🍳 Desayuno','🥪 Refacción','🍽️ Almuerzo','🌙 Cena'].map((item, i) => (
                <span key={i} style={{fontSize:'0.78rem',padding:'0.25rem 0.6rem',borderRadius:'var(--radius-full)',background:'var(--primary-bg)',color:'var(--primary)',fontWeight:600}}>
                  {item}
                </span>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ════════ TAB: MENÚS ════════ */}
      {activeTab === 'menus' && (
        <div className="catalog-grid" style={{ gridTemplateColumns: selectedMenu ? '320px 1fr' : '1fr 1fr' }}>
          {/* Lista de menús */}
          <section className="catalog-section">
            <h3><IconMenu size={16} /> Menús</h3>
            <form onSubmit={onAddMenu}>
              <input 
                placeholder="Nombre del menú (ej: Menú Ejecutivo)" 
                value={newMenu.nombre_menu} 
                onChange={e => setNewMenu({...newMenu, nombre_menu: e.target.value})} 
                required 
              />
              <textarea 
                placeholder="Descripción opcional..." 
                value={newMenu.descripcion} 
                onChange={e => setNewMenu({...newMenu, descripcion: e.target.value})}
              />
              <select
                value={newMenu.categoria_id || ''}
                onChange={e => setNewMenu({...newMenu, categoria_id: e.target.value ? Number(e.target.value) : null})}
                style={{marginBottom:'0.5rem'}}
              >
                <option value="">Sin categoría</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <button type="submit" className="btn-primary"><IconPlus size={15} /> Crear Menú</button>
            </form>

            <div style={{position:'relative',margin:'0.75rem 0'}}>
              <IconSearch size={13} style={{position:'absolute',left:'0.5rem',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none'}} />
              <input
                type="text" placeholder="Buscar menú..."
                value={searchMenus}
                onChange={e => setSearchMenus(e.target.value)}
                style={{paddingLeft:'1.6rem',fontSize:'0.82rem',width:'100%'}}
              />
              {searchMenus && (
                <button
                  onClick={() => setSearchMenus('')}
                  style={{position:'absolute',right:'0.3rem',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'0.2rem',lineHeight:1}}
                >
                  <IconX size={13} />
                </button>
              )}
            </div>
            <ul className="item-list" style={{ marginTop: '1rem' }}>
              {menusFiltrados.length === 0 ? (
                <p style={{color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem', fontSize: '0.9rem', textAlign: 'center'}}>
                  {searchMenus ? 'Sin resultados' : 'No hay menús aún. ¡Crea el primero!'}
                </p>
              ) : (
                menusFiltrados.map(m => {
                  if (editingMenuId === m.id) {
                    return (
                      <li key={m.id} className="config-item-edit" style={{display:'flex',flexDirection:'column',gap:'0.35rem',padding:'0.4rem',background:'var(--bg-input)',borderRadius:'var(--radius-sm)',border:'1px solid var(--primary)'}}>
                        <input
                          type="text" value={editMenuName}
                          onChange={e => setEditMenuName(e.target.value)}
                          autoFocus
                          placeholder="Nombre del menú"
                          onKeyDown={e => { if (e.key === 'Enter') saveEditMenu(); if (e.key === 'Escape') setEditingMenuId(null); }}
                          style={{fontSize:'0.85rem'}}
                        />
                        <textarea
                          value={editMenuDesc}
                          onChange={e => setEditMenuDesc(e.target.value)}
                          placeholder="Descripción (opcional)"
                          rows={2}
                          style={{fontSize:'0.82rem',resize:'vertical'}}
                        />
                        <select
                          value={editMenuCategoriaId || ''}
                          onChange={e => setEditMenuCategoriaId(e.target.value ? Number(e.target.value) : null)}
                          style={{fontSize:'0.85rem'}}
                        >
                          <option value="">Sin categoría</option>
                          {categorias.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                        <div style={{display:'flex',gap:'0.35rem'}}>
                          <button className="btn-primary btn-sm" onClick={saveEditMenu} data-tooltip="Guardar">✓ Guardar</button>
                          <button className="btn-secondary btn-sm" onClick={() => setEditingMenuId(null)} data-tooltip="Cancelar">✕ Cancelar</button>
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li key={m.id} onClick={() => handleMenuSelect(m)} className={selectedMenu?.id === m.id ? 'selected' : ''}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',gap:'0.5rem'}}>
                        <span onClick={e => e.stopPropagation()} onDoubleClick={() => startEditMenu(m)}>{m.nombre_menu}</span>
                        <div style={{display:'flex',alignItems:'center',gap:'0.35rem'}}>
                          {m.categoria_nombre && (
                            <span style={{fontSize:'0.68rem',padding:'0.1rem 0.4rem',borderRadius:'var(--radius-full)',background:'var(--primary-bg)',color:'var(--primary)',fontWeight:600,whiteSpace:'nowrap'}}>
                              {m.categoria_nombre}
                            </span>
                          )}
                          <button
                            className="config-action-btn config-action-edit"
                            onClick={e => { e.stopPropagation(); startEditMenu(m); }}
                            data-tooltip="Editar nombre"
                            style={{fontSize:'0.75rem',padding:'0.1rem 0.3rem',opacity:0.5}}
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          {/* Composición del menú seleccionado */}
          {selectedMenu && (
            <section className="catalog-section">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Composición: <span style={{fontWeight: 400, fontSize: '0.9rem', color: 'var(--primary)'}}>{selectedMenu.nombre_menu}</span>
              </h3>
              {selectedMenu.descripcion && (
                <p style={{fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '1rem'}}>
                  {selectedMenu.descripcion}
                </p>
              )}
              <p style={{fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem'}}>
                Selecciona los ingredientes que componen este menú.
              </p>

              {loading ? (
                <p className="status-message">Cargando...</p>
              ) : menuDetalle ? (
                <div className="sug-tipo-grid">
                  {TIPO_OPTS.map(tipo => {
                    const cfg = TIPO_LABELS[tipo] || TIPO_LABELS.otros;
                    const disponibles = (ingredientes || []).filter(i => i.tipo === tipo || 
                      (tipo === 'tortilla_pan' && i.tipo === 'tortilla_pan') ||
                      (tipo === 'guarnicion' && i.tipo === 'guarnición'));
                    if (disponibles.length === 0) return null;
                    return (
                      <div key={tipo} className="sug-tipo-section">
                        <div className="sug-tipo-header" style={{ borderLeftColor: cfg.color }}>
                          <span className="sug-tipo-icon">{cfg.icon}</span>
                          <span className="sug-tipo-label">{cfg.label}</span>
                          <span className="sug-tipo-count">{(menuDetalle.items || []).filter(i => i.ingrediente_tipo === tipo).length}/{disponibles.length}</span>
                        </div>
                        <div className="sug-tipo-items">
                          {disponibles.map(ing => {
                            const sel = (menuDetalle.items || []).find(i => i.ingrediente_id === ing.id);
                            return (
                              <div key={ing.id} className={`sug-item ${sel ? 'sug-item-selected' : ''}`}>
                                <button
                                  className="sug-item-btn"
                                  onClick={() => onToggleMenuItem(ing, tipo)}
                                  data-tooltip={sel ? 'Quitar del menú' : 'Añadir al menú'}
                                >
                                  <span className="sug-item-check">{sel ? <IconCheckCircle size={14} /> : <span className="sug-item-circle" />}</span>
                                  <span className="sug-item-name">{ing.nombre}</span>
                                </button>
                                {sel && menuDetalle.opciones_por_ingrediente[ing.id]?.length > 0 && (
                                  <select
                                    className="sug-item-opcion"
                                    value={sel.opcion_id || ''}
                                    onChange={e => onOpcionMenuChange(ing.id, e.target.value ? Number(e.target.value) : null)}
                                  >
                                    <option value="">Sin opción</option>
                                    {menuDetalle.opciones_por_ingrediente[ing.id].map(op => (
                                      <option key={op.id} value={op.id}>{op.nombre_opcion}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="status-message">Selecciona un menú para ver su composición</p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
