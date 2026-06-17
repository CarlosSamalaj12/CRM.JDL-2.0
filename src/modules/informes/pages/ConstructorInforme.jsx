import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  createInforme, createInformeDia, saveDiaMenuDetalle,
  getPlatillos, getPlatilloDetalle, fetchEventById,
  getIngredientes, getMenus, getOpcionesIngrediente, getCategorias,
  getComentarios, createComentario, getDestacados, toggleDestacado,
  getHistorial, getUsuarios, getTiposMontaje, saveMontaje, getMontaje,
  getInformesByOcupacion, getInformeById,
  deleteInformeDias,
  getImagenes, createImagen, uploadImagen, deleteImagen, imagenUrl,
  toggleReaccionComentario,
  getEquipos, getSillas, getMesas,
  saveMetadatosEvento
} from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import {
  IconFileText, IconPlus, IconSearch, IconCheckCircle,
  IconArrowLeft, IconX,
  IconMessageCircle, IconStar, IconHistory
} from '../components/Icons.jsx';
import ReactionTooltip from '../components/ReactionTooltip.jsx';

// ═══════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════

const CATEGORIAS = [
  { id: 'menus',      label: 'Menús',       icon: '📋', color: '#6366f1' },
  { id: 'platillos',  label: 'Platillos',   icon: '🍽️', color: '#ec4899' },
  { id: 'carnes',     label: 'Carnes',      icon: '🥩', color: '#ef4444' },
  { id: 'guarniciones', label: 'Guarniciones', icon: '🥗', color: '#10b981' },
  { id: 'salsas',     label: 'Salsas',      icon: '🫗', color: '#f59e0b' },
  { id: 'postres',    label: 'Postres',     icon: '🍰', color: '#ec4899' },
  { id: 'bebidas',    label: 'Bebidas',     icon: '🥤', color: '#06b6d4' },
  { id: 'alertas',    label: 'Alertas',     icon: '⚠️', color: '#ef4444' },
  { id: 'montaje',    label: 'Montaje',     icon: '🔧', color: '#64748b' },
  { id: 'comentarios', label: 'Comentarios', icon: '💬', color: '#8b5cf6' },
  { id: 'destacados',  label: 'Destacados',  icon: '⭐', color: '#f59e0b' },
  { id: 'imagenes',    label: 'Imágenes',    icon: '🖼️', color: '#06b6d4' },
];

const TIPO_LABELS = {
  carne: 'CARNES', guarnición: 'GUARNICIONES', guarnicion: 'GUARNICIONES',
  salsa: 'SALSAS', postre: 'POSTRES', bebida: 'BEBIDAS',
  proteina: 'PROTEÍNA', tortilla_pan: 'TORTILLA/PAN', otros: 'OTROS',
};

const METODOS_PREPARACION = [
  'A la plancha', 'Al vapor', 'Frito', 'Parrilla', 'Horneado',
  'Salteado', 'Guisado', 'Crudo/Fresco', 'Término medio', 'Bien cocido', 'Otro'
];

const ALERTAS_PREDEFINIDAS = [
  { label: 'Sin Gluten', emoji: '🌾' },
  { label: 'Sin Lactosa', emoji: '🥛' },
  { label: 'Vegano', emoji: '🌱' },
  { label: 'Vegetariano', emoji: '🥗' },
  { label: 'Alérgeno', emoji: '⚠️' },
  { label: 'Sin Azúcar', emoji: '🍬' },
  { label: 'Bajo en Sodio', emoji: '🧂' },
];

const TIPOS_MONTAJE = [
  'Escuela', 'Imperial', 'Banquete', 'Cóctel', 'Auditorio',
  'Mesa redonda', 'Buffet', 'U', 'Presidencial', 'Personalizado'
];

const MONTAJE_CAMPOS = [
  { key: 'tipo_montaje', label: 'Tipo de montaje', type: 'select', options: TIPOS_MONTAJE },
  { key: 'num_personas', label: 'Número de personas', type: 'number' },
  { key: 'horario', label: 'Horario', type: 'text' },
  { key: 'equipo_necesario', label: 'Equipo necesario', type: 'config-equipo' },
  { key: 'manteleria', label: 'Mantelería', type: 'text' },
  { key: 'cristaleria', label: 'Cristalería', type: 'text' },
  { key: 'mesas', label: 'Mesas', type: 'config-mesa' },
  { key: 'sillas', label: 'Sillas', type: 'config-silla' },
  { key: 'observaciones', label: 'Observaciones', type: 'textarea' },
];

function crearDiaVacio() {
  return {
    id: null, fecha: new Date().toISOString().slice(0, 10),
    platillo: null, platilloDetalle: null,
    selectedItems: [], menuAsignado: null, montaje: [], alertas: [], alertaCustom: '',
  };
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function ConstructorInforme() {
  const { id_ocupacion } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const socket = useSocket();

  // State principal
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [informeId, setInformeId] = useState(null);
  const [evento, setEvento] = useState(null);
  const [dias, setDias] = useState([crearDiaVacio()]);
  const [activeDay, setActiveDay] = useState(0);
  const [categoriaActiva, setCategoriaActiva] = useState('menus');

  // Catálogos
  const [platillos, setPlatillos] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [opcionesIng, setOpcionesIng] = useState({});
  const [categorias, setCategorias] = useState([]);
  const [menuCategoriaFiltro, setMenuCategoriaFiltro] = useState(null);
  const [platilloCategoriaFiltro, setPlatilloCategoriaFiltro] = useState(null);

  // Versiones
  const [versiones, setVersiones] = useState([]);
  const [versionActiva, setVersionActiva] = useState(null);
  const [showVersionSelector, setShowVersionSelector] = useState(false);

  // Colaboración
  const [comentarios, setComentarios] = useState([]);
  const [destacados, setDestacados] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  // Config (equipos, sillas, mesas)
  const [configEquipos, setConfigEquipos] = useState([]);
  const [configSillas, setConfigSillas] = useState([]);
  const [configMesas, setConfigMesas] = useState([]);

  // Modales
  const [modalOpciones, setModalOpciones] = useState(null);
  const [modalComentario, setModalComentario] = useState(false);
  const [modalDestacado, setModalDestacado] = useState(false);
  const [modalMontaje, setModalMontaje] = useState(false);
  const [modalHistorial, setModalHistorial] = useState(false);
  const [comentarioTexto, setComentarioTexto] = useState('');
  const [destacadoRazon, setDestacadoRazon] = useState('');
  const [montajeData, setMontajeData] = useState({});
  const [montajeEditIdx, setMontajeEditIdx] = useState(null);
  const [modalPrep, setModalPrep] = useState('');
  const [modalOpc, setModalOpc] = useState('');
  const [modalQty, setModalQty] = useState(1);
  const [modalNotas, setModalNotas] = useState('');

  // Reacciones
  const userMap = useMemo(() => {
    const map = {};
    usuarios.forEach(u => { map[u.id] = u.nombre; });
    return map;
  }, [usuarios]);
  const currentUserId = (() => {
    try { const t = localStorage.getItem('token'); if (!t) return null; return JSON.parse(atob(t.split('.')[1])).id; } catch { return null; }
  })();
  const REACCIONES = [
    { emoji: '❤️', label: 'Me encanta' },
    { emoji: '😡', label: 'Enojado' },
    { emoji: '😂', label: 'Me divierte' },
    { emoji: '👍', label: 'Ok' },
  ];

  // Reacción popover
  const [reactingTo, setReactingTo] = useState(null);
  const [hoveredTooltip, setHoveredTooltip] = useState(null);

  // Imágenes
  const [imagenes, setImagenes] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [imagenDesc, setImagenDesc] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Búsqueda en elementos
  const [searchElemento, setSearchElemento] = useState('');
  const loadedRef = useRef(false);

  if (!id_ocupacion) {
    return <div className="pos-page"><p className="status-message status-error">Error: No se especificó una ocupación.</p></div>;
  }

  useEffect(() => { if (!loadedRef.current) { loadedRef.current = true; loadAll(); } }, []);

  useEffect(() => {
    if (!socket || !id_ocupacion) return;
    socket.joinRoom(`evento:${id_ocupacion}`);
    return () => { socket.leaveRoom(`evento:${id_ocupacion}`); };
  }, [socket, id_ocupacion]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [platillosData, eventoData, ingredientesData, menusData, categoriasData] = await Promise.all([
        getPlatillos(), fetchEventById(id_ocupacion),
        getIngredientes(), getMenus(), getCategorias(),
      ]);
      setPlatillos(platillosData);
      setEvento(eventoData);
      setIngredientes(ingredientesData);
      setMenus(menusData);
      setCategorias(categoriasData);

      // Cargar opciones de ingredientes
      const opsMap = {};
      for (const ing of ingredientesData) {
        try {
          const ops = await getOpcionesIngrediente(ing.id);
          opsMap[ing.id] = ops;
        } catch { opsMap[ing.id] = []; }
      }
      setOpcionesIng(opsMap);

      // Cargar configuraciones (equipos, sillas, mesas)
      try {
        const [eq, si, me] = await Promise.all([
          getEquipos(), getSillas(), getMesas()
        ]);
        setConfigEquipos(eq.filter(e => e.activo));
        setConfigSillas(si.filter(s => s.activo));
        setConfigMesas(me.filter(m => m.activo));
      } catch { /* */ }

      // Verificar versiones existentes para esta ocupación
      try {
        const vers = await getInformesByOcupacion(id_ocupacion);
        if (vers && vers.length > 0) {
          setVersiones(vers);
          await cargarVersion(vers[0]);
        }
      } catch (err) {
        if (err.status === 404 || err.message?.includes('no encontrado')) {
          toast.info('No hay versiones previas, comenzando desde cero');
        } else {
          toast.error('Error al buscar versiones: ' + err.message);
        }
      }
    } catch (err) {
      setError('Error al cargar datos: ' + err.message);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  // ─── Cargar versión existente para editar ───
  const cargarVersion = async (versionInfo) => {
    setShowVersionSelector(false);
    setLoading(true);
    try {
      const data = await getInformeById(versionInfo.id);
      setInformeId(data.id);
      setVersionActiva(data.version || 1);

      if (data.dias && data.dias.length > 0) {
        const diasCargados = data.dias.map(d => {
          let mont = [];
          let alertas = [];
          let alertaCustom = '';
          try {
            const parsed = typeof d.descripcion_montaje === 'string' ? JSON.parse(d.descripcion_montaje) : (d.descripcion_montaje || []);
            if (parsed && parsed._v === 2) {
              mont = parsed.montajes || [];
              alertas = parsed.alertas || [];
              alertaCustom = parsed.alertaCustom || '';
            } else {
              mont = Array.isArray(parsed) ? parsed : (parsed && Object.keys(parsed).length > 0 ? [parsed] : []);
            }
          } catch { mont = []; }
          return {
            id: d.id,
            fecha: d.fecha_evento ? d.fecha_evento.slice(0, 10) : new Date().toISOString().slice(0, 10),
            platillo: null,
            platilloDetalle: null,
            selectedItems: (d.items || []).map(item => ({
              comp_id: Date.now() + Math.random(),
              ingrediente_id: item.ingrediente_id,
              ingrediente_nombre: item.ingrediente_nombre,
              opcion_id: item.opcion_id,
              opcion_nombre: item.opcion_nombre,
              tipo: item.ingrediente_tipo,
              metodo_preparacion: item.metodo_preparacion || '',
              cantidad: item.cantidad_total || 1,
              notas: item.notas || '',
            })),
            menuAsignado: d.menu_id ? { id: d.menu_id, nombre_menu: d.nombre_menu, categoria_nombre: d.categoria_nombre } : null,
            montaje: mont,
            alertas: alertas,
            alertaCustom: alertaCustom,
          };
        });
        setDias(diasCargados.length > 0 ? diasCargados : [crearDiaVacio()]);
      }
      toast.success(`Editando versión ${data.version || 1}`);
    } catch (err) {
      if (err.status === 404 || err.message?.includes('no encontrado')) {
        toast.error('La versión seleccionada ya no existe');
      } else {
        toast.error('Error al cargar la versión: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Crear / Guardar informe ───
  const handleSaveFullInforme = async () => {
    setLoading(true);
    try {
      let targetId = informeId;
      if (!targetId) {
        const res = await createInforme(id_ocupacion);
        targetId = res.id;
        setInformeId(targetId);
        setVersionActiva(res.version || 1);
      } else {
        // Editar versión existente: limpiar días anteriores antes de recrearlos
        await deleteInformeDias(targetId);
      }

      let diasGuardados = 0;
      for (let i = 0; i < dias.length; i++) {
        const dia = dias[i];
        if (!dia.fecha) continue;

        const diaRes = await createInformeDia({
          informe_id: targetId, fecha_evento: dia.fecha,
          menu_id: dia.menuAsignado?.id || null,
          descripcion_montaje: JSON.stringify({
            _v: 2,
            montajes: dia.montaje || [],
            alertas: dia.alertas || [],
            alertaCustom: dia.alertaCustom || '',
          }),
        });
        diasGuardados++;

        if (dia.selectedItems.length > 0) {
          await saveDiaMenuDetalle(diaRes.id, dia.selectedItems.map(item => ({
            menu_item_id: null, ingrediente_id: item.ingrediente_id,
            opcion_id: item.opcion_id,
            metodo_preparacion: item.metodo_preparacion,
            cantidad_total: item.cantidad, notas: item.notas || '',
          })));
        }
      }

      // Actualizar metadata del evento si hay alertas
      try {
        const tieneAlertas = dias.some(d => (d.alertas || []).length > 0 || d.alertaCustom?.trim());
        const allAlertas = new Set();
        for (const d of dias) {
          (d.alertas || []).forEach(a => allAlertas.add(a));
          if (d.alertaCustom?.trim()) allAlertas.add(d.alertaCustom.trim());
        }
        const alertas_text = allAlertas.size > 0 ? [...allAlertas].join(', ') : null;
        await saveMetadatosEvento(id_ocupacion, { tiene_alertas, alertas_text });
      } catch { /* no crítico */ }

      const versionStr = versionActiva ? ` v${versionActiva}` : '';
      toast.success(`¡Informe${versionStr} guardado! (${diasGuardados} día(s))`, {
        action: { label: 'Ver', onClick: () => navigate(`/informe/${targetId}`) }
      });
      navigate(`/informe/${targetId}`);
    } catch (err) {
      toast.error('Error al guardar: ' + (err.message || ''));
      setError('Error al guardar: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // ─── Agregar ítem al día activo ───
  const agregarItem = (ingrediente, opcionId, metodo, cantidad = 1, notas = '') => {
    const newDias = [...dias];
    const items = [...newDias[activeDay].selectedItems];
    const exists = items.find(i => i.ingrediente_id === ingrediente.id && i.opcion_id === (opcionId || null));
    if (exists) {
      exists.cantidad = (exists.cantidad || 0) + cantidad;
      if (notas) exists.notas = notas;
    } else {
      const opc = opcionId ? opcionesIng[ingrediente.id]?.find(o => o.id === opcionId) : null;
      items.push({
        comp_id: Date.now(),
        ingrediente_id: ingrediente.id,
        ingrediente_nombre: ingrediente.nombre,
        opcion_id: opcionId || null,
        opcion_nombre: opc?.nombre_opcion || null,
        tipo: ingrediente.tipo,
        metodo_preparacion: metodo || '',
        cantidad,
        notas,
      });
    }
    newDias[activeDay].selectedItems = items;
    setDias(newDias);
  };

  const eliminarItem = (compId) => {
    const newDias = [...dias];
    newDias[activeDay].selectedItems = newDias[activeDay].selectedItems.filter(i => i.comp_id !== compId);
    setDias(newDias);
  };

  const cambiarItem = (compId, field, value) => {
    const newDias = [...dias];
    const item = newDias[activeDay].selectedItems.find(i => i.comp_id === compId);
    if (item) { item[field] = value; setDias(newDias); }
  };

  // ─── Seleccionar platillo │ menú │ ingrediente ───
  const seleccionarPlatillo = async (platillo) => {
    const newDias = [...dias];
    newDias[activeDay].platillo = { id: platillo.id, nombre_platillo: platillo.nombre_platillo, categoria_nombre: platillo.categoria_nombre };
    newDias[activeDay].selectedItems = [];
    setDias(newDias);
    try {
      const det = await getPlatilloDetalle(platillo.id);
      const upd = [...newDias];
      upd[activeDay].platilloDetalle = det;
      upd[activeDay].selectedItems = (det.componentes || []).map(c => ({
        comp_id: c.id, ingrediente_id: c.ingrediente_id,
        ingrediente_nombre: c.ingrediente_nombre, opcion_id: c.opcion_id,
        opcion_nombre: c.opcion_nombre, tipo: c.tipo_componente,
        metodo_preparacion: '', cantidad: 1, notas: '',
      }));
      setDias(upd);
    } catch { /* */ }
  };

  const seleccionarMenu = (menu) => {
    const newDias = [...dias];
    newDias[activeDay].menuAsignado = menu;
    setDias(newDias);
  };

  const toggleIngrediente = (ing) => {
    const exists = dias[activeDay].selectedItems.find(i => i.ingrediente_id === ing.id);
    if (exists) { eliminarItem(exists.comp_id); return; }

    // Solo carnes/proteínas abren modal con preparación, opciones y cantidad
    if (ing.tipo === 'carne' || ing.tipo === 'proteina') {
      setModalOpciones(ing);
      setModalPrep('');
      setModalOpc('');
      setModalQty(1);
      setModalNotas('');
    } else {
      // Salsas, guarniciones, postres, bebidas → se agregan directo
      agregarItem(ing, null, '', 1, '');
    }
  };

  // ─── Días ───
  const addDia = () => { setDias([...dias, crearDiaVacio()]); setActiveDay(dias.length); };
  const removeDia = (i) => {
    const nd = dias.filter((_, idx) => idx !== i);
    setDias(nd);
    if (activeDay >= nd.length) setActiveDay(Math.max(0, nd.length - 1));
  };

  // ─── Imágenes ───
  const loadImagenes = async () => {
    if (!informeId) { setImagenes([]); return; }
    try {
      const imgs = await getImagenes(informeId);
      setImagenes(imgs);
    } catch { toast.error('Error al cargar imágenes'); }
  };

  useEffect(() => { loadImagenes(); }, [informeId]);

  const handleAddImagen = async () => {
    if (!urlInput.trim()) return;
    try {
      let targetId = informeId;
      if (!targetId) {
        const res = await createInforme(id_ocupacion);
        targetId = res.id;
        setInformeId(targetId);
        setVersionActiva(res.version || 1);
      }
      await createImagen(targetId, { url: urlInput, descripcion: imagenDesc || null });
      setUrlInput('');
      setImagenDesc('');
      toast.success('Imagen agregada');
      loadImagenes();
    } catch { toast.error('Error al agregar imagen'); }
  };

  const handleDeleteImagen = async (imgId) => {
    try {
      await deleteImagen(imgId);
      loadImagenes();
    } catch { toast.error('Error al eliminar imagen'); }
  };

  const handleUploadImagen = async () => {
    const file = selectedFile;
    if (!file) return;
    if (!informeId) {
      try {
        const res = await createInforme(id_ocupacion);
        setInformeId(res.id);
        setVersionActiva(res.version || 1);
      } catch { toast.error('Error al crear informe'); return; }
    }
    setUploadingImg(true);
    try {
      await uploadImagen(informeId, file, imagenDesc || null);
      setImagenDesc('');
      setSelectedFile(null);
      toast.success('Imagen subida');
      loadImagenes();
    } catch { toast.error('Error al subir imagen'); }
    setUploadingImg(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Colaboración ───
  const loadColaboracion = async () => {
    if (!informeId) return;
    try {
      const [c, d, h, u] = await Promise.all([
        getComentarios(informeId), getDestacados(informeId), getHistorial(informeId), getUsuarios()
      ]);
      setComentarios(c); setDestacados(d); setHistorial(h); setUsuarios(u);
    } catch { /* */ }
  };

  const handleAddComentario = async () => {
    if (!comentarioTexto.trim() || !informeId) return;
    try {
      await createComentario(informeId, { contenido: comentarioTexto, dia_id: dias[activeDay]?.id || null });
      setComentarioTexto('');
      toast.success('Comentario agregado');
      loadColaboracion();
    } catch { toast.error('Error al agregar comentario'); }
  };

  const handleToggleDestacado = async () => {
    if (!informeId) return;
    try {
      await toggleDestacado(informeId, { dia_id: dias[activeDay]?.id || null, razon: destacadoRazon || null });
      setDestacadoRazon('');
      toast.success('Destacado actualizado');
      loadColaboracion();
    } catch { toast.error('Error'); }
  };

  const handleGuardarMontaje = () => {
    const newDias = [...dias];
    if (!montajeData.salon?.trim()) { toast.info('Indica el nombre del salón'); return; }
    const entry = { ...montajeData, salon: montajeData.salon.trim() };
    if (montajeEditIdx !== null) {
      newDias[activeDay].montaje[montajeEditIdx] = entry;
    } else {
      newDias[activeDay].montaje = [...(newDias[activeDay].montaje || []), entry];
    }
    setDias(newDias);
    setMontajeData({});
    setMontajeEditIdx(null);
    toast.success(montajeEditIdx !== null ? 'Montaje actualizado' : 'Montaje agregado');
  };

  const editarMontaje = (idx) => {
    setMontajeData({ ...(dias[activeDay].montaje[idx] || {}) });
    setMontajeEditIdx(idx);
  };

  const eliminarMontaje = (idx) => {
    const newDias = [...dias];
    newDias[activeDay].montaje = (newDias[activeDay].montaje || []).filter((_, i) => i !== idx);
    setDias(newDias);
    if (montajeEditIdx === idx) { setMontajeData({}); setMontajeEditIdx(null); }
    toast.success('Montaje eliminado');
  };

  // ─── Elementos filtrados por categoría ───
  const elementosFiltrados = useMemo(() => {
    const q = searchElemento.toLowerCase();
    const filtrar = (arr) => q ? arr.filter(e => (e.nombre || e.nombre_platillo || e.nombre_menu || '').toLowerCase().includes(q)) : arr;

    switch (categoriaActiva) {
      case 'menus': {
        let base = menus;
        if (menuCategoriaFiltro) {
          base = menus.filter(m => m.categoria_nombre === menuCategoriaFiltro);
        }
        return filtrar(base).map(m => ({ ...m, _tipo: 'menu', _nombre: m.nombre_menu }));
      }
      case 'platillos': {
        let base = platillos;
        if (platilloCategoriaFiltro) {
          base = platillos.filter(p => p.categoria_nombre === platilloCategoriaFiltro);
        }
        return filtrar(base).map(p => ({ ...p, _tipo: 'platillo', _nombre: p.nombre_platillo }));
      }
      case 'carnes': return filtrar(ingredientes.filter(i => i.tipo === 'carne' || i.tipo === 'proteina')).map(i => ({ ...i, _tipo: 'ingrediente', _nombre: i.nombre }));
      case 'guarniciones': return filtrar(ingredientes.filter(i => i.tipo === 'guarnición' || i.tipo === 'guarnicion')).map(i => ({ ...i, _tipo: 'ingrediente', _nombre: i.nombre }));
      case 'salsas': return filtrar(ingredientes.filter(i => i.tipo === 'salsa')).map(i => ({ ...i, _tipo: 'ingrediente', _nombre: i.nombre }));
      case 'postres': return filtrar(ingredientes.filter(i => i.tipo === 'postre')).map(i => ({ ...i, _tipo: 'ingrediente', _nombre: i.nombre }));
      case 'bebidas': return filtrar(ingredientes.filter(i => i.tipo === 'bebida')).map(i => ({ ...i, _tipo: 'ingrediente', _nombre: i.nombre }));
      default: return [];
    }
  }, [categoriaActiva, searchElemento, menus, platillos, ingredientes, menuCategoriaFiltro, platilloCategoriaFiltro]);

  const diaActivo = dias[activeDay] || dias[0];

  if (loading) return <p className="status-message">Cargando...</p>;
  if (error && !informeId) return <p className="status-message status-error">{error}</p>;

  return (
    <div className="pos-page">
      {/* ─── TOP BAR ─── */}
      <div className="pos-topbar">
        <button onClick={() => navigate(-1)} className="btn-ghost" data-tooltip="Volver"><IconArrowLeft size={16} /></button>
        <div className="pos-topbar-info">
          <span className="pos-topbar-inst">{evento?.Institucion || 'Cargando...'}</span>
          <span className="pos-topbar-meta">
            <strong>{evento?.Pax || '?'}</strong> pax · {evento?.Salon || '?'} · {evento?.TipoEvento || '?'}
          </span>
          <span className="pos-topbar-meta" style={{fontSize:'0.72rem',marginTop:'0.1rem',opacity:0.85}}>
            {(() => {
              const parts = [];
              if (evento?.Vendedor) parts.push(<><strong>Vendedor:</strong> {evento.Vendedor}</>);
              if (evento?.EncargadoEvento) parts.push(<><strong>Encargado:</strong> {evento.EncargadoEvento}</>);
              if (evento?.HoraI) parts.push(<><strong>Horario:</strong> {evento.HoraI}{evento.HoraF ? ` - ${evento.HoraF}` : ''}</>);
              if (evento?.NoDoc) parts.push(<><strong>No. Cotización:</strong> {evento.NoDoc}</>);
              if (parts.length === 0) parts.push(<span>Sin datos adicionales</span>);
              return parts.map((p, i) => (
                <span key={i}>{i > 0 && <span> · </span>}{p}</span>
              ));
            })()}
          </span>
        </div>
        <div className="pos-topbar-right">
          <span className="pos-topbar-user">{user?.nombre || user?.email}</span>
          <span className="pos-topbar-ocup">#{id_ocupacion}</span>
          {versionActiva && (
            <button className="pos-topbar-badge" onClick={() => setShowVersionSelector(true)}
              style={{background:'var(--success)',color:'white',cursor:'pointer',border:'none',fontSize:'inherit'}}
              title="Cambiar de versión">
              v{versionActiva} ▼
            </button>
          )}
          {informeId && <span className="pos-topbar-badge">#{informeId}</span>}
        </div>
      </div>

      {/* ─── DAY TABS ─── */}
      <div className="pos-tabs">
        {dias.map((d, i) => (
          <button key={i} className={`pos-tab ${activeDay === i ? 'pos-tab-active' : ''}`} onClick={() => setActiveDay(i)}>
            Día {i + 1}
            {d.fecha && <span className="pos-tab-sub">{(() => { const dt = d.fecha.length <= 10 ? new Date(d.fecha + 'T12:00:00') : new Date(d.fecha); return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }); })()}</span>}
            {dias.length > 0 && (
              <span onClick={(e) => {
                e.stopPropagation();
                const source = dias[i];
                const idx = dias.length;
                const dup = {
                  ...crearDiaVacio(),
                  fecha: source.fecha || new Date().toISOString().slice(0, 10),
                  platillo: source.platillo ? { ...source.platillo } : null,
                  platilloDetalle: source.platilloDetalle ? JSON.parse(JSON.stringify(source.platilloDetalle)) : null,
                  selectedItems: source.selectedItems.map(it => ({ ...it, comp_id: Date.now() + Math.random() })),
                  menuAsignado: source.menuAsignado ? { ...source.menuAsignado } : null,
                  montaje: JSON.parse(JSON.stringify(source.montaje || [])),
                  alertas: [...(source.alertas || [])],
                  alertaCustom: source.alertaCustom || '',
                };
                const nd = [...dias, dup];
                setDias(nd);
                setActiveDay(idx);
              }} title="Duplicar día" style={{
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                width:'16px', height:'16px', borderRadius:'50%', cursor:'pointer',
                color:'var(--text-muted)', fontSize:'0.7rem', lineHeight:1,
                transition:'all 0.15s ease', marginLeft:'0.1rem', marginRight:'0.1rem',
              }}
              onMouseEnter={e => { e.currentTarget.style.background='var(--primary-bg)'; e.currentTarget.style.color='var(--primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-muted)'; }}
              >
                📋
              </span>
            )}
            {dias.length > 1 && <span className="pos-tab-close" onClick={(e) => { e.stopPropagation(); removeDia(i); }}><IconX size={12} /></span>}
          </button>
        ))}
        <button className="pos-tab pos-tab-add" onClick={addDia}><IconPlus size={14} /> Día</button>
      </div>

      {/* ─── CUERPO: 3 COLUMNAS ─── */}
      <div className="pos-body-3col">
        {/* COLUMNA IZQUIERDA: TICKET */}
        <div className="pos-ticket">
          <div className="pos-ticket-header">
            <IconFileText size={14} />
            Informe {informeId ? `#${informeId}` : '—'}
          </div>
          <div className="pos-ticket-body">
            <div className="pos-ticket-dia-tag">DÍA {activeDay + 1}</div>

{/* Menú asignado */}
            {diaActivo.menuAsignado && (
              <div className="pos-ticket-menu">
                <span>
                  📋 {diaActivo.menuAsignado.nombre_menu}
                  {diaActivo.menuAsignado.categoria_nombre && (
                    <span style={{
                      fontSize:'0.6rem',padding:'0.05rem 0.3rem',
                      borderRadius:'var(--radius-full)',background:'var(--primary-bg)',
                      color:'var(--primary)',fontWeight:600,marginLeft:'0.3rem',
                      verticalAlign:'middle'
                    }}>
                      {diaActivo.menuAsignado.categoria_nombre}
                    </span>
                  )}
                </span>
                <button className="pos-ticket-remove" onClick={() => {
                  const nd = [...dias]; nd[activeDay].menuAsignado = null; setDias(nd);
                }}><IconX size={12} /></button>
              </div>
            )}

            {/* Platillo seleccionado */}
            {diaActivo.platillo && (
              <div className="pos-ticket-platillo">
                <span>
                  🍽️ {diaActivo.platillo.nombre_platillo}
                  {diaActivo.platillo.categoria_nombre && (
                    <span style={{
                      fontSize:'0.6rem',padding:'0.05rem 0.3rem',
                      borderRadius:'var(--radius-full)',background:'var(--primary-bg)',
                      color:'var(--primary)',fontWeight:600,marginLeft:'0.3rem',
                      verticalAlign:'middle'
                    }}>
                      {diaActivo.platillo.categoria_nombre}
                    </span>
                  )}
                </span>
                <button className="pos-ticket-remove" onClick={() => {
                  const nd = [...dias]; nd[activeDay].platillo = null; nd[activeDay].platilloDetalle = null; nd[activeDay].selectedItems = []; setDias(nd);
                }}><IconX size={12} /></button>
              </div>
            )}

            {/* Items seleccionados */}
            {diaActivo.selectedItems.length > 0 ? (
              <div className="pos-ticket-items">
                {Object.entries(agruparItems(diaActivo.selectedItems)).map(([tipo, items]) => (
                  <div key={tipo} className="pos-ticket-grupo">
                    <span className="pos-ticket-tipo">{TIPO_LABELS[tipo] || tipo.toUpperCase()}</span>
                    {items.map(item => {
                      const esSimple = item.tipo !== 'carne' && item.tipo !== 'proteina';
                      return (
                        <div key={item.comp_id} className="pos-ticket-item">
                          <div className="pos-ticket-item-top">
                            <span className="pos-ticket-item-nombre">{item.ingrediente_nombre}</span>
                            {!esSimple && <span className="pos-ticket-item-qty">×{item.cantidad}</span>}
                            <button className="pos-ticket-item-del" onClick={() => eliminarItem(item.comp_id)}>
                              <IconX size={11} />
                            </button>
                          </div>
                          {(item.metodo_preparacion || item.opcion_nombre) && (
                            <div className="pos-ticket-item-opts">
                              {item.metodo_preparacion && <span className="pos-ticket-item-prep">Prep: {item.metodo_preparacion}</span>}
                              {item.opcion_nombre && <span className="pos-ticket-item-opc">{item.opcion_nombre}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="pos-ticket-empty">Selecciona un platillo o ingrediente</div>
            )}

            {/* Montaje resumido */}
            {(diaActivo.montaje || []).length > 0 && (
              <div className="pos-ticket-montaje">
                <span>🔧 {diaActivo.montaje.length} montaje(s)</span>
                <div style={{fontSize:'0.68rem',color:'var(--text-muted)',marginTop:'0.15rem'}}>
                  {diaActivo.montaje.map((m, i) => (
                    <div key={i}>• {m.salon || 'Salón ' + (i+1)}{m.tipo_montaje ? ` — ${m.tipo_montaje}` : ''}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="pos-ticket-footer">
            {diaActivo.selectedItems.length} ítem(s) · Día {activeDay + 1}
          </div>
        </div>

        {/* COLUMNA CENTRO: CATEGORÍAS */}
        <div className="pos-categorias">
          <div className="pos-cat-grid">
            {CATEGORIAS.map(cat => (
              <button
                key={cat.id}
                className={`pos-cat-btn ${categoriaActiva === cat.id ? 'pos-cat-btn-active' : ''}`}
                style={categoriaActiva === cat.id ? { background: cat.color, borderColor: cat.color } : {}}
                onClick={() => setCategoriaActiva(cat.id)}
              >
                <span className="pos-cat-icon">{cat.icon}</span>
                <span className="pos-cat-label">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* COLUMNA DERECHA: ELEMENTOS */}
        <div className="pos-elementos">
          <div className="pos-elem-search">
            <IconSearch size={14} />
            <input
              type="text" placeholder={`Buscar en ${CATEGORIAS.find(c => c.id === categoriaActiva)?.label || 'elementos'}...`}
              value={searchElemento} onChange={e => setSearchElemento(e.target.value)}
            />
            {searchElemento && <button className="pos-elem-clear" onClick={() => setSearchElemento('')}><IconX size={14} /></button>}
          </div>

          <div className="pos-elem-grid">
            {/* Categoría: Menús */}
            {categoriaActiva === 'menus' && (
              <>
                {elementosFiltrados.map(menu => {
                  const selected = diaActivo.menuAsignado?.id === menu.id;
                  return (
                    <button
                      key={menu.id}
                      className={`pos-elem-btn ${selected ? 'pos-elem-btn-selected' : ''}`}
                      onClick={() => seleccionarMenu(menu)}
                    >
                      <span className="pos-elem-icon">📋</span>
                      <span className="pos-elem-name">
                        {menu.nombre_menu}
                      </span>
                      {selected && <span className="pos-elem-check"><IconCheckCircle size={14} /></span>}
                    </button>
                  );
                })}
              </>
            )}

            {/* Categoría: Platillos */}
            {categoriaActiva === 'platillos' && (
              <>
                {elementosFiltrados.map(p => {
                  const selected = diaActivo.platillo?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      className={`pos-elem-btn ${selected ? 'pos-elem-btn-selected' : ''}`}
                      onClick={() => seleccionarPlatillo(p)}
                    >
                      <span className="pos-elem-icon">🍽️</span>
                      <span className="pos-elem-name">
                        {p.nombre_platillo}
                      </span>
                      {selected && <span className="pos-elem-check"><IconCheckCircle size={14} /></span>}
                    </button>
                  );
                })}
              </>
            )}

            {/* Categorías: Ingredientes */}
            {['carnes', 'guarniciones', 'salsas', 'postres', 'bebidas'].includes(categoriaActiva) && elementosFiltrados.map(ing => {
              const selected = diaActivo.selectedItems.some(i => i.ingrediente_id === ing.id);
              return (
                <button
                  key={ing.id}
                  className={`pos-elem-btn ${selected ? 'pos-elem-btn-selected' : ''}`}
                  onClick={() => toggleIngrediente(ing)}
                >
                  <span className="pos-elem-icon">{CATEGORIAS.find(c => c.id === categoriaActiva)?.icon || '📦'}</span>
                  <span className="pos-elem-name">{ing.nombre}</span>
                  {selected && <span className="pos-elem-check"><IconCheckCircle size={14} /></span>}
                </button>
              );
            })}

            {/* Categoría: Alertas */}
            {categoriaActiva === 'alertas' && (
              <div className="pos-alertas-form">
                <h4>Alertas / Restricciones</h4>
                <p className="pos-alertas-desc">
                  Marca las alertas importantes para que todos las vean en el informe.
                </p>
                <div className="pos-alertas-grid">
                  {ALERTAS_PREDEFINIDAS.map(a => {
                    const active = (diaActivo.alertas || []).includes(a.label);
                    return (
                      <button
                        key={a.label}
                        type="button"
                        className={`pos-alerta-btn ${active ? 'active' : ''}`}
                        onClick={() => {
                          const current = diaActivo.alertas || [];
                          const updated = active
                            ? current.filter(x => x !== a.label)
                            : [...current, a.label];
                          const nd = [...dias];
                          nd[activeDay].alertas = updated;
                          setDias(nd);
                        }}
                      >
                        <span className="pos-alerta-emoji">{a.emoji}</span>
                        <span className="pos-alerta-label">{a.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Alerta personalizada */}
                <div className="pos-alerta-custom">
                  <label>Alerta personalizada</label>
                  <div className="pos-alerta-custom-row">
                    <input
                      type="text"
                      placeholder="Ej: Alérgico al maní, Diabetes, Hipertensión..."
                      value={diaActivo.alertaCustom || ''}
                      onChange={e => {
                        const nd = [...dias];
                        nd[activeDay].alertaCustom = e.target.value;
                        setDias(nd);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Categoría: Montaje — multi-salón */}
            {categoriaActiva === 'montaje' && (
              <div className="pos-montaje-form">
                <h4>Configuración de Montaje</h4>

                {/* ─── LISTA DE MONTAJES EXISTENTES ─── */}
                {(diaActivo.montaje || []).length > 0 && (
                  <div className="pos-montaje-list">
                    {(diaActivo.montaje || []).map((m, i) => (
                      <div key={i} className={`pos-montaje-list-item ${montajeEditIdx === i ? 'active' : ''}`}>
                        <div className="pos-montaje-list-info" onClick={() => editarMontaje(i)}>
                          <span className="pos-montaje-list-icon">🏛️</span>
                          <div>
                            <span className="pos-montaje-list-name">{m.salon || 'Sin salón'}</span>
                            {m.tipo_montaje && <span className="pos-montaje-list-meta">{m.tipo_montaje}</span>}
                          </div>
                        </div>
                        <button className="pos-montaje-list-del" onClick={() => eliminarMontaje(i)} title="Eliminar">✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* ─── NUEVO/EDITAR FORMULARIO ─── */}
                <div className="pos-montaje-form-card">
                  <div className="pos-montaje-form-header">
                    {montajeEditIdx !== null ? `Editando: ${montajeData.salon || ''}` : 'Nuevo montaje'}
                  </div>

                  {/* Campo Salón */}
                  <div className="pos-montaje-campo">
                    <label>Salón *</label>
                    <input
                      type="text" value={montajeData.salon || ''}
                      onChange={e => setMontajeData({...montajeData, salon: e.target.value})}
                      placeholder="Ej: Salón Principal, Terraza, Jardín..."
                    />
                  </div>

                  {MONTAJE_CAMPOS.map(campo => {
                    // Helper para renderizar toggle buttons de config con input de texto sincronizado
                    if (campo.type === 'config-equipo' || campo.type === 'config-silla' || campo.type === 'config-mesa') {
                      const items = campo.type === 'config-equipo' ? configEquipos
                        : campo.type === 'config-silla' ? configSillas : configMesas;
                      const current = montajeData[campo.key] || '';
                      const selected = current ? current.split(',').map(s => s.trim()).filter(Boolean) : [];
                      const toggle = (nombre) => {
                        const exists = selected.includes(nombre);
                        const updated = exists
                          ? selected.filter(s => s !== nombre)
                          : [...selected, nombre];
                        setMontajeData({...montajeData, [campo.key]: updated.join(', ')});
                      };
                      const handleTextChange = (val) => {
                        setMontajeData({...montajeData, [campo.key]: val});
                      };
                      return (
                        <div key={campo.key} className="pos-montaje-campo">
                          <label>{campo.label}</label>
                          <div className="pos-montaje-config-btns">
                            {items.map(item => (
                              <button
                                key={item.id}
                                type="button"
                                className={`pos-montaje-config-btn ${selected.includes(item.nombre) ? 'active' : ''}`}
                                onClick={() => toggle(item.nombre)}
                              >
                                {item.nombre}
                              </button>
                            ))}
                            {items.length === 0 && (
                              <span className="pos-montaje-config-empty">
                                Sin opciones configuradas. Ve a Configuración para agregar.
                              </span>
                            )}
                          </div>
                          <div className="pos-montaje-config-input-row">
                            <input
                              type="text"
                              className="pos-montaje-config-input"
                              placeholder="Selecciona arriba o escribe aquí..."
                              value={current}
                              onChange={e => handleTextChange(e.target.value)}
                            />
                            {current && (
                              <button
                                type="button"
                                className="pos-montaje-config-clear"
                                onClick={() => setMontajeData({...montajeData, [campo.key]: ''})}
                                title="Limpiar selección"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={campo.key} className="pos-montaje-campo">
                        <label>{campo.label}</label>
                        {campo.type === 'select' ? (
                          <select value={montajeData[campo.key] || ''} onChange={e => setMontajeData({...montajeData, [campo.key]: e.target.value})}>
                            <option value="">Seleccionar...</option>
                            {campo.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : campo.type === 'textarea' ? (
                          <textarea value={montajeData[campo.key] || ''} onChange={e => setMontajeData({...montajeData, [campo.key]: e.target.value})} rows={2} />
                        ) : (
                          <input type={campo.type} value={montajeData[campo.key] || ''} onChange={e => setMontajeData({...montajeData, [campo.key]: e.target.value})} />
                        )}
                      </div>
                    );
                  })}

                  <div style={{display:'flex', gap:'0.4rem', marginTop:'0.5rem'}}>
                    {montajeEditIdx !== null && (
                      <button className="btn-secondary" onClick={() => { setMontajeData({}); setMontajeEditIdx(null); }} style={{flex:1}}>
                        Cancelar
                      </button>
                    )}
                    <button className="btn-primary" onClick={handleGuardarMontaje} style={{flex:1}}>
                      <IconCheckCircle size={14} /> {montajeEditIdx !== null ? 'Actualizar' : 'Agregar Montaje'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Categoría: Imágenes */}
            {categoriaActiva === 'imagenes' && (
              <div className="pos-comentarios-panel">
                {imagenes.length === 0 && <p className="pos-empty-msg">Sin imágenes de referencia aún</p>}
                <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem'}}>
                  {imagenes.map(img => (
                    <div key={img.id} style={{
                      width:'180px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
                      overflow:'hidden', background:'var(--bg-card)', position:'relative'
                    }}>
                      <img src={imagenUrl(img.url)} alt={img.descripcion || ''}
                        style={{width:'100%',height:'120px',objectFit:'cover',display:'block'}}
                        onError={e => { e.target.style.display='none'; }}
                      />
                      {img.descripcion && (
                        <div style={{padding:'0.25rem 0.4rem',fontSize:'0.72rem',color:'var(--text-muted)',textAlign:'center'}}>
                          {img.descripcion}
                        </div>
                      )}
                      <button onClick={() => handleDeleteImagen(img.id)}
                        style={{position:'absolute',top:'4px',right:'4px',background:'rgba(0,0,0,0.5)',color:'white',border:'none',borderRadius:'50%',width:'22px',height:'22px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px'}}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'0.4rem',marginTop:'0.5rem'}}>
                  <div style={{fontSize:'0.72rem',fontWeight:600,color:'var(--text-muted)',marginBottom:'0.15rem'}}>Subir archivo</div>
                  <div style={{display:'flex',gap:'0.35rem',alignItems:'center',flexWrap:'wrap'}}>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                      style={{display:'none'}} />
                    <button className="btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} style={{whiteSpace:'nowrap'}}>
                      📁 Seleccionar
                    </button>
                    <span style={{fontSize:'0.75rem',color:'var(--text-muted)',flex:1,minWidth:'100px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {selectedFile?.name || 'Ningún archivo'}
                    </span>
                    <input type="text" value={imagenDesc} onChange={e => setImagenDesc(e.target.value)}
                      placeholder="Descripción" style={{width:'120px',fontSize:'0.78rem'}} />
                    <button className="btn-primary btn-sm" onClick={handleUploadImagen}
                      disabled={!selectedFile || uploadingImg}>
                      {uploadingImg ? 'Subiendo...' : 'Subir'}
                    </button>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginTop:'0.15rem'}}>
                    <span style={{flex:1,height:'1px',background:'var(--border)'}} />
                    <span style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>o pegar URL</span>
                    <span style={{flex:1,height:'1px',background:'var(--border)'}} />
                  </div>
                  <div style={{display:'flex',gap:'0.35rem'}}>
                    <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                      placeholder="https://..." style={{flex:1}} />
                    <button className="btn-primary btn-sm" onClick={handleAddImagen} disabled={!urlInput.trim()}>
                      Agregar URL
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Categoría: Comentarios */}
            {categoriaActiva === 'comentarios' && (
              <div className="pos-comentarios-panel">
                {comentarios.length === 0 && <p className="pos-empty-msg">Sin comentarios aún</p>}
                {comentarios.map(c => (
                  <div key={c.id} className="pos-comentario-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                      <strong>{c.usuario_nombre || 'Usuario'}</strong>
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                          {new Date(c.created_at).toLocaleString()}
                        </small>
                        {/* Reaction chips inline with timestamp */}
                        {REACCIONES.map(r => {
                          const users = (c.reacciones || {})[r.emoji] || [];
                          if (users.length === 0) return null;
                          const isActive = users.includes(currentUserId);
                          return (
                            <button
                              key={r.emoji}
                              onClick={async () => {
                                try { await toggleReaccionComentario(informeId, c.id, r.emoji); loadColaboracion(); } catch {}
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.1rem',
                                fontSize: '0.6rem', padding: '0.03rem 0.22rem',
                                borderRadius: 'var(--radius-full)',
                                border: '1px solid',
                                borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                                background: isActive ? 'var(--primary-bg)' : 'transparent',
                                cursor: 'pointer', lineHeight: 1.2,
                              }}
                              title={r.label}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredTooltip({ x: rect.left + rect.width / 2, y: rect.top, emoji: r.emoji, label: r.label, userIds: users });
                              }}
                              onMouseLeave={() => setHoveredTooltip(null)}
                            >
                              <span style={{ fontSize: '0.68rem' }}>{r.emoji}</span>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.55rem' }}>{users.length}</span>
                            </button>
                          );
                        })}
                        {/* Floating add reaction button */}
                        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setReactingTo(reactingTo === c.id ? null : c.id); }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.58rem', width: '14px', height: '14px',
                              borderRadius: '50%', border: 'none',
                              background: reactingTo === c.id ? 'var(--primary-bg)' : 'transparent',
                              cursor: 'pointer', lineHeight: 1, padding: 0,
                              opacity: 0.5,
                            }}
                            title="Reaccionar"
                          >
                            +
                          </button>
                          {reactingTo === c.id && (
                            <div
                              style={{
                                position: 'absolute', top: '1.4rem', right: '-0.15rem',
                                display: 'flex', gap: '0.15rem',
                                background: 'var(--bg-card)', border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-full)',
                                padding: '0.15rem 0.3rem',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                                zIndex: 100, whiteSpace: 'nowrap',
                              }}
                            >
                              {REACCIONES.map(r => (
                                <button
                                  key={r.emoji}
                                  onClick={async () => {
                                    try { await toggleReaccionComentario(informeId, c.id, r.emoji); } catch {}
                                    setReactingTo(null);
                                    loadColaboracion();
                                  }}
                                  style={{
                                    fontSize: '1.05rem', padding: '0.08rem 0.12rem',
                                    border: 'none', background: 'transparent',
                                    cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                                    transition: 'transform 0.12s', lineHeight: 1,
                                  }}
                                  title={r.label}
                                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                  {r.emoji}
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Backdrop to close popover */}
                          {reactingTo === c.id && (
                            <div onClick={() => setReactingTo(null)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                          )}
                        </div>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem' }}>{c.contenido}</p>
                  </div>
                ))}
                {informeId ? (
                  <div className="pos-comentario-input">
                    <textarea value={comentarioTexto} onChange={e => setComentarioTexto(e.target.value)} placeholder="Escribe un comentario..." rows={2} />
                    <button className="btn-primary btn-sm" onClick={handleAddComentario} disabled={!comentarioTexto.trim()}>
                      <IconMessageCircle size={13} /> Comentar
                    </button>
                  </div>
                ) : <p className="pos-empty-msg">Guarda el informe para comentar</p>}
              </div>
            )}

            {/* Categoría: Destacados */}
            {categoriaActiva === 'destacados' && (
              <div className="pos-destacados-panel">
                {destacados.length === 0 && <p className="pos-empty-msg">Sin destacados</p>}
                {destacados.map(d => (
                  <div key={d.id} className="pos-destacado-item">
                    <IconStar size={14} style={{color:'var(--warning)'}} />
                    <div>
                      <strong>{d.usuario_nombre}</strong>
                      {d.razon && <p>{d.razon}</p>}
                      <small>{new Date(d.created_at).toLocaleString()}</small>
                    </div>
                  </div>
                ))}
                {informeId && (
                  <div className="pos-destacado-input">
                    <input value={destacadoRazon} onChange={e => setDestacadoRazon(e.target.value)} placeholder="Razón del destacado..." />
                    <button className="btn-warning btn-sm" onClick={handleToggleDestacado} disabled={!destacadoRazon.trim()}>
                      <IconStar size={13} /> Destacar
                    </button>
                  </div>
                )}
              </div>
            )}

            {elementosFiltrados.length === 0 && !['montaje', 'comentarios', 'destacados', 'imagenes'].includes(categoriaActiva) && (
              <div className="pos-empty-msg">Sin resultados</div>
            )}
          </div>
        </div>
      </div>

      {/* ─── BOTTOM ACTIONS ─── */}
      <div className="pos-bottom-actions">
        <button className="pos-bottom-btn" onClick={() => navigate('/kanban')}>
          <IconSearch size={15} /> Buscar
        </button>
        <button className="pos-bottom-btn" onClick={addDia}>
          <IconPlus size={15} /> Día
        </button>
        <button className="pos-bottom-btn" onClick={() => setCategoriaActiva('montaje')}>
          🔧 Montaje
        </button>
        <button className="pos-bottom-btn" onClick={() => setCategoriaActiva('comentarios')}>
          <IconMessageCircle size={15} /> Comentar
        </button>
        <button className="pos-bottom-btn" onClick={() => setCategoriaActiva('destacados')}>
          <IconStar size={15} /> Destacar
        </button>
        <button className="pos-bottom-btn" onClick={async () => {
          if (!informeId) { toast.info('Guarda primero el informe'); return; }
          await loadColaboracion();
          setModalHistorial(true);
        }}>
          <IconHistory size={15} /> Historial
        </button>
        <button className="pos-bottom-btn pos-bottom-btn-primary" onClick={handleSaveFullInforme} disabled={loading}>
          <IconFileText size={15} /> {loading ? 'Guardando...' : (informeId ? 'Guardar' : 'Crear Informe')}
        </button>
      </div>

      {/* ─── MODAL OPCIONES ─── */}
      {modalOpciones && (
        <div className="pos-modal-overlay" onClick={() => setModalOpciones(null)}>
          <div className="pos-modal" onClick={e => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h3>🍽️ {modalOpciones.nombre}</h3>
              <button onClick={() => setModalOpciones(null)}><IconX size={16} /></button>
            </div>
            <div className="pos-modal-body">
              <label>Método de preparación</label>
              <select value={modalPrep} onChange={e => setModalPrep(e.target.value)}>
                <option value="">Sin especificar</option>
                {METODOS_PREPARACION.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              <label>Cantidad</label>
              <input type="number" min="0.5" step="0.5" value={modalQty} onChange={e => setModalQty(parseFloat(e.target.value) || 1)} />

              <label>Notas</label>
              <input type="text" value={modalNotas} onChange={e => setModalNotas(e.target.value)} placeholder="Ej: Sin cebolla, bien cocido..." />
            </div>
            <div className="pos-modal-footer">
              <button className="btn-secondary" onClick={() => setModalOpciones(null)}>Cancelar</button>
              <button className="btn-primary" onClick={() => {
                agregarItem(modalOpciones, null, modalPrep, modalQty, modalNotas);
                setModalOpciones(null);
              }}><IconCheckCircle size={14} /> Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL SELECCIÓN DE VERSIÓN ─── */}
      {showVersionSelector && (
        <div className="pos-modal-overlay" onClick={() => setShowVersionSelector(false)}>
          <div className="pos-modal" onClick={e => e.stopPropagation()} style={{maxWidth:'480px'}}>
            <div className="pos-modal-header">
              <h3><IconFileText size={16} /> Versiones del Informe</h3>
              <button onClick={() => setShowVersionSelector(false)}><IconX size={16} /></button>
            </div>
            <div className="pos-modal-body">
              <p style={{fontSize:'0.85rem',color:'var(--text-secondary)',marginBottom:'0.5rem'}}>
                Ya existen {versiones.length} versión(es) de informe para esta ocupación.
                ¿Qué deseas hacer?
              </p>
              {versiones.map((v, i) => (
                <button
                  key={v.id}
                  className="pos-bottom-btn"
                  style={{
                    width:'100%', justifyContent:'flex-start', padding:'0.7rem 1rem',
                    border: '1px solid var(--primary)', marginBottom:'0.35rem'
                  }}
                  onClick={() => cargarVersion(v)}
                >
                  <span style={{
                    background:'var(--primary)', color:'white', borderRadius:'var(--radius-full)',
                    padding:'0.1rem 0.5rem', fontSize:'0.72rem', fontWeight:700, marginRight:'0.5rem'
                  }}>v{v.version}</span>
                  <span style={{flex:1, textAlign:'left'}}>
                    <strong>{new Date(v.fecha_creacion).toLocaleDateString('es-ES', {
                      day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
                    })}</strong>
                    {i === 0 && (
                      <span style={{
                        background:'var(--success)', color:'white',
                        borderRadius:'var(--radius-full)',
                        padding:'0.05rem 0.5rem', fontSize:'0.65rem', fontWeight:700,
                        marginLeft:'0.4rem', verticalAlign:'middle'
                      }}>Última</span>
                    )}
                    <br />
                    <small style={{color:'var(--text-muted)'}}>{v.total_dias} día(s)</small>
                  </span>
                </button>
              ))}
              <button
                className="pos-bottom-btn pos-bottom-btn-primary"
                style={{width:'100%', justifyContent:'center', marginTop:'0.5rem'}}
                onClick={() => setShowVersionSelector(false)}
              >
                <IconPlus size={15} /> Crear Nueva Versión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL HISTORIAL ─── */}
      {modalHistorial && (
        <div className="pos-modal-overlay" onClick={() => setModalHistorial(false)}>
          <div className="pos-modal" onClick={e => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h3><IconHistory size={16} /> Historial</h3>
              <button onClick={() => setModalHistorial(false)}><IconX size={16} /></button>
            </div>
            <div className="pos-modal-body">
              {historial.length === 0 && <p className="pos-empty-msg">Sin historial</p>}
              {historial.map(h => (
                <div key={h.id} className="pos-historial-item">
                  <strong>{h.usuario_nombre}</strong> {h.accion}
                  {h.descripcion && <p>{h.descripcion}</p>}
                  <small>{new Date(h.created_at).toLocaleString()}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {hoveredTooltip && (
        <ReactionTooltip
          emoji={hoveredTooltip.emoji}
          label={hoveredTooltip.label}
          userIds={hoveredTooltip.userIds}
          userMap={userMap}
          x={hoveredTooltip.x}
          y={hoveredTooltip.y}
          onClose={() => setHoveredTooltip(null)}
        />
      )}
    </div>
  );
}

// ─── Helper: agrupar items por tipo ───
function agruparItems(items) {
  const grupos = {};
  for (const item of items) {
    const tipo = item.tipo || 'otros';
    if (!grupos[tipo]) grupos[tipo] = [];
    grupos[tipo].push(item);
  }
  return grupos;
}
