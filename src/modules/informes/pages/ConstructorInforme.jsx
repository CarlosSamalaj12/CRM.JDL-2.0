import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  createInforme, createInformeDia, saveDiaMenuDetalle,
  getPlatillos, getPlatilloDetalle, fetchEventById,
  getIngredientes, getMenus, getOpcionesIngrediente, getCategorias,
  createIngrediente,
  getHistorial,
  getInformesByOcupacion, getInformeById,
  getImagenes, createImagen, uploadImagen, updateImagen, deleteImagen, imagenUrl,
  getEquipos, getSillas, getMesas,
  saveMetadatosEvento
} from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import {
  IconFileText, IconPlus, IconSearch, IconCheckCircle,
  IconArrowLeft, IconX, IconGripVertical,
  IconHistory
} from '../components/Icons.jsx';
import SettingsChecklist from '../../settings/SettingsChecklist';
import { emitOpenEventChecklist } from '../../../utils/appEvents';
import OrdenTiemposEditor from '../components/OrdenTiemposEditor.jsx';
import { TIEMPOS_COMIDA, TIEMPO_COMIDA_ORDER } from '../constants/tiemposComida.js';
import { loadState as loadCrmState } from '../../../services/stateService.js';
import '../styles.css';

// ═══════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════

const CATEGORIAS = [
  { id: 'menus',      label: 'Menús',       icon: '📋', color: '#6366f1' },
  { id: 'platillos',  label: 'Platillos',   icon: '🍽️', color: '#ec4899' },
  { id: 'entradas',   label: 'Entradas',    icon: '🍲', color: '#f97316' },
  { id: 'carnes',     label: 'Carnes',      icon: '🥩', color: '#ef4444' },
  { id: 'guarniciones', label: 'Guarniciones', icon: '🥗', color: '#10b981' },
  { id: 'salsas',     label: 'Salsas',      icon: '🫗', color: '#f59e0b' },
  { id: 'postres',    label: 'Postres',     icon: '🍰', color: '#ec4899' },
  { id: 'bebidas',    label: 'Bebidas',     icon: '🥤', color: '#06b6d4' },
  { id: 'refacciones', label: 'Refacciones', icon: '🥪', color: '#8b5cf6' },
  { id: 'boquitas',   label: 'Boquitas',    icon: '🍿', color: '#f43f5e' },
  { id: 'desayunos',  label: 'Desayunos',   icon: '🌅', color: '#f59e0b' },
  { id: 'alertas',    label: 'Alertas',     icon: '⚠️', color: '#ef4444' },
  { id: 'montaje',    label: 'Montaje',     icon: '🔧', color: '#64748b' },
  { id: 'imagenes',    label: 'Imágenes',    icon: '🖼️', color: '#06b6d4' },
];

const TIPO_LABELS = {
  carne: 'CARNES', guarnición: 'GUARNICIONES', guarnicion: 'GUARNICIONES', guarniciones: 'GUARNICIONES',
  salsa: 'SALSAS', salsas: 'SALSAS', postre: 'POSTRES', postres: 'POSTRES', bebida: 'BEBIDAS', bebidas: 'BEBIDAS',
  proteina: 'PROTEÍNA', proteína: 'PROTEÍNA', proteinas: 'PROTEÍNAS', proteínas: 'PROTEÍNAS',
  entradas: 'ENTRADAS', entrada: 'ENTRADAS',
  refacción: 'REFACCIONES', refaccion: 'REFACCIONES', refacciones: 'REFACCIONES',
  boquita: 'BOQUITAS', boquitas: 'BOQUITAS',
  desayuno: 'DESAYUNOS', desayunos: 'DESAYUNOS',
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



const buildCustomTiempoComidaOrder = (customOrder) => {
  if (Array.isArray(customOrder) && customOrder.length > 0) {
    const map = {};
    customOrder.forEach((id, idx) => { map[id] = idx + 1; });
    return map;
  }
  return TIEMPO_COMIDA_ORDER;
};

const sortItemsByTiempoComida = (items, customOrder) => {
  const order = buildCustomTiempoComidaOrder(customOrder);
  return [...items].sort((a, b) => {
    const aTc = order[a.tiempoComida] || 99;
    const bTc = order[b.tiempoComida] || 99;
    if (aTc !== bTc) return aTc - bTc;
    // Mismo tiempo de comida: mantener orden de inserción
    return 0;
  });
};

const TC_ITEM = TIEMPOS_COMIDA; // alias for per-item use

const MONTAJE_CAMPOS = [
  { key: 'tipo_montaje', label: 'Tipo de montaje', type: 'select', options: TIPOS_MONTAJE },
  { key: 'num_personas', label: 'Número de personas', type: 'number' },
  { key: 'horario', label: 'Horario', type: 'text' },
  { key: 'equipo_necesario', label: 'Equipo necesario', type: 'config-equipo' },
  { key: 'manteleria', label: 'Mantelería', type: 'text' },
  { key: 'mesas', label: 'Mesas', type: 'config-mesa' },
  { key: 'sillas', label: 'Sillas', type: 'config-silla' },
  { key: 'observaciones', label: 'Comentarios', type: 'textarea' },
];

const compressImage = (file, maxW = 600, maxH = 600) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Canvas compression failed'));
            }
          },
          'image/jpeg',
          0.5
        );
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
};

const dataURLtoFile = (dataurl, filename) => {
  try {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (err) {
    console.error('Error converting base64 to file:', err);
    return null;
  }
};

function crearDiaVacio(fecha) {
  return {
    id: null, fecha: fecha || new Date().toISOString().slice(0, 10),
    platillo: null, platilloDetalle: null,
    selectedItems: [], menuAsignado: null, montaje: [], alertas: [], alertaCustom: '', comentarioMenu: '',
    tiempoComida: null,
  };
}

function mapCategoriaToTiempoComida(categoriaNombre) {
  if (!categoriaNombre) return null;
  const n = categoriaNombre.toLowerCase().trim();
  if (n.includes('desayuno')) return 'desayuno';
  if (n.includes('refacción') || n.includes('refaccion')) return 'refaccion_am';
  if (n.includes('almuerzo')) return 'almuerzo';
  if (n.includes('cena')) return 'cena';
  return null;
}

function sumarDias(fechaStr, dias) {
  if (!fechaStr) return new Date().toISOString().slice(0, 10);
  const d = new Date(fechaStr + 'T12:00:00');
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function ConstructorInforme() {
  const { id_ocupacion } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { connected: socketConnected, joinRoom, leaveRoom, onEvent } = useSocket();

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
  const [historial, setHistorial] = useState([]);

  // Config (equipos, sillas, mesas, salones, tipos de montaje)
  const [configEquipos, setConfigEquipos] = useState([]);
  const [configSillas, setConfigSillas] = useState([]);
  const [configMesas, setConfigMesas] = useState([]);
  const [configTiposMontaje, setConfigTiposMontaje] = useState([]);
  const [salonesList, setSalonesList] = useState([]);

  // Modales
  const [modalOpciones, setModalOpciones] = useState(null);
  const [modalMontaje, setModalMontaje] = useState(false);
  const [modalHistorial, setModalHistorial] = useState(false);
  const [montajeData, setMontajeData] = useState({});
  const [montajeEditIdx, setMontajeEditIdx] = useState(null);
  const [modalPrep, setModalPrep] = useState('');
  const [modalOpc, setModalOpc] = useState('');
  const [modalQty, setModalQty] = useState(1);
  const [modalNotas, setModalNotas] = useState('');
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Imágenes
  const [imagenes, setImagenes] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [imagenDesc, setImagenDesc] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  // Quick-create ingrediente
  const [showNewIngModal, setShowNewIngModal] = useState(false);
  const [newIngNombre, setNewIngNombre] = useState('');
  const [newIngTipo, setNewIngTipo] = useState('proteina');
  const [creatingIng, setCreatingIng] = useState(false);

  // Orden personalizado de tiempos de comida
  const [customTiempoComidaOrder, setCustomTiempoComidaOrder] = useState(null);
  const [showOrdenModal, setShowOrdenModal] = useState(false);
  const [openTcPopover, setOpenTcPopover] = useState(null);

  // Cargar orden personalizado de tiempos
  useEffect(() => {
    const loadOrder = async () => {
      try {
        const state = await loadCrmState();
        setCustomTiempoComidaOrder(state?.informe_tiempos_orden || null);
      } catch (err) {
        console.error('Error cargando orden de tiempos:', err);
      }
    };
    loadOrder();
    const handleStateUpdate = () => loadOrder();
    window.addEventListener('stateUpdated', handleStateUpdate);
    return () => window.removeEventListener('stateUpdated', handleStateUpdate);
  }, []);

  // Cargar tipos de montaje personalizados
  useEffect(() => {
    const loadTipos = async (opts = {}) => {
      try {
        const state = await loadCrmState(opts);
        const saved = state?.informe_tipos_montaje;
        if (Array.isArray(saved) && saved.length > 0) {
          setConfigTiposMontaje(saved.filter(t => t.activo !== 0));
        } else {
          setConfigTiposMontaje(TIPOS_MONTAJE.map(nombre => ({ id: nombre, nombre, activo: 1 })));
        }
      } catch (err) {
        console.error('Error cargando tipos de montaje:', err);
        setConfigTiposMontaje(TIPOS_MONTAJE.map(nombre => ({ id: nombre, nombre, activo: 1 })));
      }
    };
    loadTipos();
    const handleStateUpdate = () => loadTipos({ cacheBust: true });
    window.addEventListener('stateUpdated', handleStateUpdate);
    const unsubscribeSocket = onEvent ? onEvent('state-updated', () => loadTipos({ cacheBust: true })) : () => {};
    const handleVisibility = () => {
      if (!document.hidden) loadTipos({ cacheBust: true });
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('stateUpdated', handleStateUpdate);
      unsubscribeSocket();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [onEvent]);

  // Cerrar popover de tiempo de comida al hacer click fuera
  useEffect(() => {
    if (!openTcPopover) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.pos-ticket-item-tc-popover-wrapper')) {
        setOpenTcPopover(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openTcPopover]);

  const handleCreateIngrediente = async () => {
    const nombre = newIngNombre.trim();
    if (!nombre || creatingIng) return;
    // Validación local de duplicado
    if (ingredientes.some(i => i.nombre.toLowerCase() === nombre.toLowerCase())) {
      toast.error(`Ya existe un ingrediente llamado "${nombre}"`);
      setShowNewIngModal(false);
      setNewIngNombre('');
      return;
    }
    // Cerrar el modal inmediatamente para evitar overlocks
    setShowNewIngModal(false);
    setCreatingIng(true);
    try {
      await createIngrediente({ nombre, tipo: newIngTipo });
      toast.success(`✅ "${nombre}" creado`);
      const updated = await getIngredientes();
      setIngredientes(updated);
      setNewIngNombre('');
      setNewIngTipo('proteina');
    } catch (err) {
      toast.error('Error al crear: ' + (err.message || ''));
    } finally {
      setCreatingIng(false);
    }
  };

  // Búsqueda en elementos
  const [searchElemento, setSearchElemento] = useState('');
  const loadedRef = useRef(false);

  useEffect(() => { if (!loadedRef.current) { loadedRef.current = true; if (id_ocupacion) loadAll(); } }, []);

  useEffect(() => {
    if (evento?.FechaEvento && dias.length > 0 && !dias[0].id) {
      const eventDate = String(evento.FechaEvento).slice(0, 10);
      if (eventDate && eventDate !== dias[0].fecha) {
        setDias(prev => {
          const next = [...prev];
          next[0] = { ...next[0], fecha: eventDate };
          return next;
        });
      }
    }
  }, [evento]);

  useEffect(() => {
    if (!socketConnected || !id_ocupacion) return;
    const room = `evento:${id_ocupacion}`;
    joinRoom(room);
    return () => { leaveRoom(room); };
  }, [socketConnected, id_ocupacion, joinRoom, leaveRoom]);

  useEffect(() => {
    if (!informeId) { setImagenes([]); return; }
    getImagenes(informeId)
      .then(imgs => setImagenes(imgs))
      .catch(() => toast.error('Error al cargar imágenes'));
  }, [informeId]);

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
      case 'carnes': return filtrar(ingredientes.filter(i => {
        const tipo = (i.tipo || '').toLowerCase();
        return tipo === 'carne' || tipo === 'proteina' || tipo === 'proteínas' || tipo === 'proteinas';
      })).map(i => ({ ...i, _tipo: 'ingrediente', _nombre: i.nombre }));
      case 'entradas': return filtrar(ingredientes.filter(i => {
        const tipo = (i.tipo || '').toLowerCase();
        return tipo === 'entradas' || tipo === 'entrada';
      })).map(i => ({ ...i, _tipo: 'ingrediente', _nombre: i.nombre }));
      case 'guarniciones': return filtrar(ingredientes.filter(i => {
        const tipo = (i.tipo || '').toLowerCase();
        return tipo === 'guarnición' || tipo === 'guarnicion' || tipo === 'guarniciones';
      })).map(i => ({ ...i, _tipo: 'ingrediente', _nombre: i.nombre }));
      case 'salsas': return filtrar(ingredientes.filter(i => {
        const tipo = (i.tipo || '').toLowerCase();
        return tipo === 'salsa' || tipo === 'salsas';
      })).map(i => ({ ...i, _tipo: 'ingrediente', _nombre: i.nombre }));
      case 'postres': return filtrar(ingredientes.filter(i => {
        const tipo = (i.tipo || '').toLowerCase();
        return tipo === 'postre' || tipo === 'postres';
      })).map(i => ({ ...i, _tipo: 'ingrediente', _nombre: i.nombre }));
      case 'bebidas': return filtrar(ingredientes.filter(i => {
        const tipo = (i.tipo || '').toLowerCase();
        return tipo === 'bebida' || tipo === 'bebidas';
      })).map(i => ({ ...i, _tipo: 'ingrediente', _nombre: i.nombre }));
      case 'refacciones': return filtrar(ingredientes.filter(i => {
        const tipo = (i.tipo || '').toLowerCase();
        return tipo === 'refacción' || tipo === 'refaccion' || tipo === 'refacciones';
      })).map(i => ({ ...i, _tipo: 'ingrediente', _nombre: i.nombre }));
      case 'boquitas': return filtrar(ingredientes.filter(i => {
        const tipo = (i.tipo || '').toLowerCase();
        return tipo === 'boquita' || tipo === 'boquitas';
      })).map(i => ({ ...i, _tipo: 'ingrediente', _nombre: i.nombre }));
      case 'desayunos': return filtrar(ingredientes.filter(i => {
        const tipo = (i.tipo || '').toLowerCase();
        return tipo === 'desayuno' || tipo === 'desayunos';
      })).map(i => ({ ...i, _tipo: 'ingrediente', _nombre: i.nombre }));
      default: return [];
    }
  }, [categoriaActiva, searchElemento, menus, platillos, ingredientes, menuCategoriaFiltro, platilloCategoriaFiltro]);

  if (!id_ocupacion) {
    return <div className="pos-page"><p className="status-message status-error">Error: No se especificó una ocupación.</p></div>;
  }

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

      // Mostrar UI inmediatamente con datos esenciales
      setLoading(false);

      // Cargar datos secundarios en segundo plano (sin bloquear la UI)
      (async () => {
        // Opciones de ingredientes
        try {
          const opsResults = await Promise.all(
            ingredientesData.map(ing =>
              getOpcionesIngrediente(ing.id).catch(() => [])
            )
          );
          const opsMap = {};
          for (let i = 0; i < ingredientesData.length; i++) {
            opsMap[ingredientesData[i].id] = opsResults[i];
          }
          setOpcionesIng(opsMap);
        } catch { /* */ }

        // Configuraciones y versiones
        try {
          const [eq, si, me, sal, vers] = await Promise.all([
            getEquipos().catch(() => []), getSillas().catch(() => []), getMesas().catch(() => []),
            fetch('/api/salones').then(r => r.json()).then(d => d.salones || []).catch(() => []),
            getInformesByOcupacion(id_ocupacion).catch(err => {
              if (err.status === 404 || err.message?.includes('no encontrado')) {
                toast.info('No hay versiones previas, comenzando desde cero');
              } else {
                toast.error('Error al buscar versiones: ' + err.message);
              }
              return null;
            }),
          ]);
          setConfigEquipos(eq.filter(e => e.activo));
          setConfigSillas(si.filter(s => s.activo));
          setConfigMesas(me.filter(m => m.activo));
          setSalonesList(sal);

          if (vers && vers.length > 0) {
            setVersiones(vers);
            // Cargar versión en segundo plano (sin loading spinner)
            try {
              const data = await getInformeById(vers[0].id);
              setInformeId(data.id);
              setVersionActiva(data.version || 1);
              if (data.dias && data.dias.length > 0) {
                setDias(data.dias.map(d => {
                  let mont = [], alertas = [], alertaCustom = '', tiempoComida = null;
                  let parsed = null;
                  try {
                    parsed = typeof d.descripcion_montaje === 'string' ? JSON.parse(d.descripcion_montaje) : (d.descripcion_montaje || []);
                    if (parsed && parsed._v === 2) {
                      mont = parsed.montajes || [];
                      alertas = parsed.alertas || [];
                      alertaCustom = parsed.alertaCustom || '';
                      tiempoComida = parsed.tiempo_comida || null;
                    } else {
                      mont = Array.isArray(parsed) ? parsed : (parsed && Object.keys(parsed).length > 0 ? [parsed] : []);
                    }
                  } catch { mont = []; }
                  const loadedItems = (d.items || []).map(item => ({
                    comp_id: Date.now() + Math.random(),
                    dbId: item.id || null,
                    ingrediente_id: item.ingrediente_id,
                    ingrediente_nombre: item.ingrediente_nombre,
                    opcion_id: item.opcion_id, opcion_nombre: item.opcion_nombre,
                    tipo: item.ingrediente_tipo,
                    metodo_preparacion: item.metodo_preparacion || '',
                    cantidad: item.cantidad_total || 1,
                    notas: item.notas || '',
                    tiempoComida: null,
                  }));
                  const itemsTc = parsed?.items_tiempo_comida;
                  if (itemsTc && loadedItems.length > 0) {
                    loadedItems.forEach((it, idx) => { if (idx < itemsTc.length) it.tiempoComida = itemsTc[idx]; });
                  }
                  return {
                    id: d.id,
                    fecha: d.fecha_evento ? d.fecha_evento.slice(0, 10) : new Date().toISOString().slice(0, 10),
                    platillo: null, platilloDetalle: null,
                    selectedItems: sortItemsByTiempoComida(loadedItems, customTiempoComidaOrder),
                    menuAsignado: d.menu_id ? { id: d.menu_id, nombre_menu: d.nombre_menu, categoria_nombre: d.categoria_nombre } : null,
                    montaje: mont, alertas, alertaCustom, comentarioMenu: d.comentario_menu || '',
                    tiempoComida,
                  };
                }));
              }
            } catch (err) {
              if (err.status === 404 || err.message?.includes('no encontrado')) {
                toast.error('La versión seleccionada ya no existe');
              } else {
                toast.error('Error al cargar la versión: ' + err.message);
              }
            }
          }
        } catch { /* */ }
      })();
    } catch (err) {
      setError('Error al cargar datos: ' + err.message);
      toast.error('Error al cargar datos');
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
          let tiempoComida = null;
          let itemsTc = null;
          try {
            const parsed = typeof d.descripcion_montaje === 'string' ? JSON.parse(d.descripcion_montaje) : (d.descripcion_montaje || []);
            if (parsed && parsed._v === 2) {
              mont = parsed.montajes || [];
              alertas = parsed.alertas || [];
              alertaCustom = parsed.alertaCustom || '';
              tiempoComida = parsed.tiempo_comida || null;
              itemsTc = parsed.items_tiempo_comida || null;
            } else {
              mont = Array.isArray(parsed) ? parsed : (parsed && Object.keys(parsed).length > 0 ? [parsed] : []);
            }
          } catch { mont = []; }
          const loadedItems = (d.items || []).map(item => ({
            comp_id: Date.now() + Math.random(),
            dbId: item.id || null,
            ingrediente_id: item.ingrediente_id,
            ingrediente_nombre: item.ingrediente_nombre,
            opcion_id: item.opcion_id,
            opcion_nombre: item.opcion_nombre,
            tipo: item.ingrediente_tipo,
            metodo_preparacion: item.metodo_preparacion || '',
            cantidad: item.cantidad_total || 1,
            notas: item.notas || '',
            tiempoComida: null,
          }));
          if (itemsTc && loadedItems.length > 0) {
            loadedItems.forEach((it, idx) => { if (idx < itemsTc.length) it.tiempoComida = itemsTc[idx]; });
          }
          return {
            id: d.id,
            fecha: d.fecha_evento ? d.fecha_evento.slice(0, 10) : new Date().toISOString().slice(0, 10),
            platillo: null,
            platilloDetalle: null,
            selectedItems: sortItemsByTiempoComida(loadedItems, customTiempoComidaOrder),
            menuAsignado: d.menu_id ? { id: d.menu_id, nombre_menu: d.nombre_menu, categoria_nombre: d.categoria_nombre } : null,
            montaje: mont,
            alertas: alertas,
            alertaCustom: alertaCustom,
            comentarioMenu: d.comentario_menu || '',
            tiempoComida,
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
      // Cada guardado crea una nueva versión (la anterior se conserva intacta)
      const res = await createInforme(id_ocupacion);
      const targetId = res.id;
      const oldInformeId = informeId;
      setInformeId(targetId);
      setVersionActiva(res.version || 1);

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
            tiempo_comida: dia.tiempoComida || null,
            items_tiempo_comida: (dia.selectedItems || []).map(it => it.tiempoComida || null),
          }),
          comentario_menu: dia.comentarioMenu || null,
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
        const tiene_alertas = dias.some(d => (d.alertas || []).length > 0 || d.alertaCustom?.trim());
        const allAlertas = new Set();
        for (const d of dias) {
          (d.alertas || []).forEach(a => allAlertas.add(a));
          if (d.alertaCustom?.trim()) allAlertas.add(d.alertaCustom.trim());
        }
        const alertas_text = allAlertas.size > 0 ? [...allAlertas].join(', ') : null;
        await saveMetadatosEvento(id_ocupacion, { tiene_alertas, alertas_text });
      } catch (err) {
        console.error('Error al guardar metadatos de alertas:', err);
        toast.warning('Las alertas se guardaron en el informe pero no se marcaron en la vista general');
      }

      // Re-asignar imágenes del informe anterior al nuevo
      if (oldInformeId && Number(oldInformeId) !== Number(targetId)) {
        try {
          const oldImgs = await getImagenes(oldInformeId);
          if (oldImgs.length > 0) {
            for (const img of oldImgs) {
              await createImagen(targetId, { url: img.url, descripcion: img.descripcion || '' });
            }
          }
        } catch (imgErr) {
          console.error('Error al copiar imágenes al nuevo informe:', imgErr);
        }
      }

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
    try {
      if (!ingrediente || !ingrediente.id) {
        console.error('agregarItem: ingrediente inválido', ingrediente);
        return;
      }
      const newDias = [...dias];
      if (!newDias[activeDay]) {
        console.error('agregarItem: activeDay sin día', { activeDay, diasLength: newDias.length });
        toast.error('Error interno: día activo no disponible');
        return;
      }
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
          tiempoComida: null,
          dbId: null,
        });
      }
      newDias[activeDay].selectedItems = sortItemsByTiempoComida(items, customTiempoComidaOrder);
      setDias(newDias);
    } catch (err) {
      console.error('Error en agregarItem:', err);
      toast.error('Error al agregar item: ' + (err.message || ''));
    }
  };

  const eliminarItem = (compId) => {
    try {
      if (!dias[activeDay]) { console.error('eliminarItem: activeDay sin día'); return; }
      const newDias = [...dias];
      newDias[activeDay].selectedItems = newDias[activeDay].selectedItems.filter(i => i.comp_id !== compId);
      setDias(newDias);
    } catch (err) {
      console.error('Error en eliminarItem:', err);
    }
  };

  const cambiarItem = (compId, field, value) => {
    const newDias = [...dias];
    const item = newDias[activeDay].selectedItems.find(i => i.comp_id === compId);
    if (item) { item[field] = value; setDias(newDias); }
  };

  const handleDragStart = (idx) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const nd = [...dias];
    const items = [...nd[activeDay].selectedItems];
    const [moved] = items.splice(dragIdx, 1);
    items.splice(dragOverIdx, 0, moved);
    nd[activeDay].selectedItems = items;
    setDias(nd);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleItemTiempoComida = (compId, value) => {
    const nd = [...dias];
    const item = nd[activeDay].selectedItems.find(i => i.comp_id === compId);
    if (!item) return;
    item.tiempoComida = value || null;
    // No ordenamos automáticamente para que el ítem no se mueva mientras editas
    setDias(nd);
  };

  // ─── Seleccionar platillo │ menú │ ingrediente ───
  const seleccionarPlatillo = async (platillo) => {
    const newDias = [...dias];
    newDias[activeDay].platillo = { id: platillo.id, nombre_platillo: platillo.nombre_platillo, categoria_nombre: platillo.categoria_nombre };
    newDias[activeDay].selectedItems = [];
    if (!newDias[activeDay].tiempoComida && platillo.categoria_nombre) {
      newDias[activeDay].tiempoComida = mapCategoriaToTiempoComida(platillo.categoria_nombre);
    }
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
        tiempoComida: null, dbId: null,
      }));
      upd[activeDay].selectedItems = sortItemsByTiempoComida(upd[activeDay].selectedItems, customTiempoComidaOrder);
      setDias(upd);
    } catch { /* */ }
  };

  const seleccionarMenu = (menu) => {
    const newDias = [...dias];
    newDias[activeDay].menuAsignado = menu;
    if (!newDias[activeDay].tiempoComida && menu.categoria_nombre) {
      newDias[activeDay].tiempoComida = mapCategoriaToTiempoComida(menu.categoria_nombre);
    }
    setDias(newDias);
  };

  const toggleIngrediente = (ing) => {
    try {
      if (!ing || !dias[activeDay]) {
        console.error('toggleIngrediente: estado inválido', { ing, activeDay, diasLen: dias.length });
        return;
      }
      const exists = dias[activeDay].selectedItems.find(i => i.ingrediente_id === ing.id);
      if (exists) { eliminarItem(exists.comp_id); return; }

      const tipo = (ing.tipo || '').toLowerCase();
      if (tipo === 'carne' || tipo === 'proteina' || tipo === 'proteína' || tipo === 'proteinas' || tipo === 'proteínas') {
        // Si hay un modal de nuevo ingrediente abierto, cerrarlo para evitar overlays bloqueantes
        if (showNewIngModal) setShowNewIngModal(false);
        setModalOpciones(ing);
        setModalPrep('');
        setModalOpc('');
        setModalQty(1);
        setModalNotas('');
      } else {
        agregarItem(ing, null, '', 1, '');
      }
    } catch (err) {
      console.error('Error en toggleIngrediente:', err);
      toast.error('Error al seleccionar: ' + (err.message || ''));
    }
  };

  // ─── Días ───
  const addDia = () => {
    const ultimaFecha = dias[dias.length - 1]?.fecha;
    setDias([...dias, crearDiaVacio(sumarDias(ultimaFecha, 1))]);
    setActiveDay(dias.length);
  };
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

      // Si es un base64, convertir a archivo y subirlo
      if (urlInput.trim().startsWith('data:image/')) {
        setUploadingImg(true);
        try {
          const file = dataURLtoFile(urlInput.trim(), "imagen_pegada.jpg");
          if (!file) throw new Error('No se pudo convertir base64 a archivo');
          const compressed = await compressImage(file);
          await uploadImagen(targetId, compressed, imagenDesc || null);
          toast.success('Imagen base64 subida y optimizada');
        } finally {
          setUploadingImg(false);
        }
      } else {
        await createImagen(targetId, { url: urlInput, descripcion: imagenDesc || null });
        toast.success('Imagen agregada');
      }

      setUrlInput('');
      setImagenDesc('');
      loadImagenes();
    } catch (err) {
      console.error(err);
      toast.error('Error al agregar imagen');
    }
  };

  const handleDeleteImagen = async (imgId) => {
    try {
      await deleteImagen(imgId);
      loadImagenes();
    } catch { toast.error('Error al eliminar imagen'); }
  };

  const handleUpdateImagenDescripcion = async (imgId, descripcion) => {
    try {
      await updateImagen(imgId, { descripcion: descripcion || null });
      setImagenes(prev => prev.map(img => img.id === imgId ? { ...img, descripcion } : img));
    } catch {
      toast.error('Error al guardar descripción');
    }
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
      const compressed = await compressImage(file);
      await uploadImagen(informeId, compressed, imagenDesc || null);
      setImagenDesc('');
      setSelectedFile(null);
      toast.success('Imagen subida y optimizada ✓');
      loadImagenes();
    } catch (err) {
      console.error(err);
      toast.error('Error al subir imagen');
    }
    setUploadingImg(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Historial ───
  const loadHistorial = async () => {
    if (!informeId) return;
    try {
      const h = await getHistorial(informeId);
      setHistorial(h);
    } catch { /* */ }
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
            {evento?.Vendedor && <span> · {evento.Vendedor}</span>}
            {evento?.HoraI && <span> · {evento.HoraI}{evento.HoraF ? `-${evento.HoraF}` : ''}</span>}
            {evento?.NoDoc && <span> · {evento.NoDoc}</span>}
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
            {d.fecha && <span style={{ color: '#a855f7', fontWeight: 800, fontSize: '0.85rem' }}>{(() => { const cf = String(d.fecha).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(cf)) return ''; const dt = new Date(cf + 'T12:00:00'); return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }); })()}</span>}
            <span style={{ fontSize: '0.65rem', opacity: 0.6, display: 'block' }}>Día {i + 1}</span>
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
                    tiempoComida: source.tiempoComida || null,
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
              <div className="pos-ticket-dia-tag">DÍA {activeDay + 1}</div>
              <button
                type="button"
                onClick={() => setShowOrdenModal(true)}
                title="Ordenar tiempos de comida"
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ⚙️ Orden
              </button>
            </div>

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
                {diaActivo.selectedItems.map((item, idx) => {
                  const tipoItem = (item.tipo || '').toLowerCase();
                  const esSimple = tipoItem !== 'carne' && tipoItem !== 'proteina' && tipoItem !== 'proteína' && tipoItem !== 'proteinas' && tipoItem !== 'proteínas';
                  return (
                    <div
                      key={item.comp_id}
                      className={`pos-ticket-item ${dragIdx === idx ? 'pos-ticket-item-dragging' : ''} ${dragOverIdx === idx ? 'pos-ticket-item-drag-over' : ''}`}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="pos-ticket-item-top">
                        <span className="pos-ticket-item-drag" data-tooltip="Arrastrar para reordenar">
                          <IconGripVertical size={14} />
                        </span>
                        <span className="pos-ticket-item-nombre">{item.ingrediente_nombre}</span>
                        {!esSimple && <span className="pos-ticket-item-qty">×{item.cantidad}</span>}
                        <div className="pos-ticket-item-tc-popover-wrapper">
                          <button
                            type="button"
                            className={`pos-ticket-item-tc-badge ${item.tiempoComida ? '' : 'pos-ticket-item-tc-badge--none'}`}
                            onClick={() => setOpenTcPopover(openTcPopover === item.comp_id ? null : item.comp_id)}
                            title={TC_ITEM.find(tc => tc.id === item.tiempoComida)?.label || 'Sin tiempo de comida'}
                            style={item.tiempoComida ? {
                              '--tc-color': TC_ITEM.find(tc => tc.id === item.tiempoComida)?.color,
                              '--tc-bg': `${TC_ITEM.find(tc => tc.id === item.tiempoComida)?.color}15`,
                            } : {}}
                          >
                            {item.tiempoComida
                              ? TC_ITEM.find(tc => tc.id === item.tiempoComida)?.icon
                              : '⏱️'}
                          </button>

                          {openTcPopover === item.comp_id && (
                            <div className="pos-ticket-item-tc-popover">
                              <div className="pos-ticket-item-tc-popover-title">Tiempo de comida</div>
                              {TC_ITEM.map(tc => {
                                const selected = item.tiempoComida === tc.id;
                                return (
                                  <button
                                    key={tc.id}
                                    type="button"
                                    className={`pos-ticket-item-tc-popover-option ${selected ? 'selected' : ''}`}
                                    onClick={() => {
                                      handleItemTiempoComida(item.comp_id, selected ? '' : tc.id);
                                      setOpenTcPopover(null);
                                    }}
                                    style={{
                                      '--tc-color': tc.color,
                                      '--tc-bg': `${tc.color}15`,
                                    }}
                                  >
                                    <span className="pos-ticket-item-tc-popover-icon">{tc.icon}</span>
                                    <span className="pos-ticket-item-tc-popover-label">{tc.label}</span>
                                    {selected && <span className="pos-ticket-item-tc-popover-check">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <button className="pos-ticket-item-del" onClick={() => eliminarItem(item.comp_id)}>
                          <IconX size={11} />
                        </button>
                      </div>
                      {(item.metodo_preparacion || item.opcion_nombre || item.notas) && (
                        <div className="pos-ticket-item-opts">
                          {item.metodo_preparacion && <span className="pos-ticket-item-prep">Prep: {item.metodo_preparacion}</span>}
                          {item.opcion_nombre && <span className="pos-ticket-item-opc">{item.opcion_nombre}</span>}
                          {item.notas && <span className="pos-ticket-item-notes">📝 {item.notas}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
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

            {/* Comentarios del Menú */}
            <div className="pos-ticket-comentario-menu">
              <label style={{fontSize:'0.72rem',fontWeight:600,color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>
                💬 Comentarios del Menú
              </label>
              <textarea
                value={diaActivo.comentarioMenu || ''}
                onChange={e => {
                  const nd = [...dias];
                  nd[activeDay] = {...nd[activeDay], comentarioMenu: e.target.value};
                  setDias(nd);
                }}
                placeholder="Notas, observaciones o comentarios sobre el menú..."
                rows={2}
                style={{
                  width:'100%', padding:'0.4rem 0.5rem',
                  border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
                  fontSize:'0.78rem', resize:'vertical',
                  background:'var(--bg-elevated)',
                  color:'var(--text-primary)',
                  boxSizing:'border-box',
                }}
              />
            </div>
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
            {['entradas', 'carnes', 'guarniciones', 'salsas', 'postres', 'bebidas', 'refacciones', 'boquitas', 'desayunos'].includes(categoriaActiva) && (
              <button
                className="pos-elem-add-btn"
                onClick={() => {
                              const tipoMap = { entradas:'entradas', carnes:'proteina', guarniciones:'guarnicion', salsas:'salsa', postres:'postre', bebidas:'bebida', refacciones:'refaccion', boquitas:'boquita', desayunos:'desayuno' };
                              setShowNewIngModal(true);
                              setNewIngNombre('');
                              setNewIngTipo(tipoMap[categoriaActiva] || 'proteina');
                            }}
                title="Agregar nuevo ingrediente"
              >
                <IconPlus size={13} /> Nvo
              </button>
            )}
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
            {['entradas', 'carnes', 'guarniciones', 'salsas', 'postres', 'bebidas', 'refacciones', 'boquitas', 'desayunos'].includes(categoriaActiva) && elementosFiltrados.map(ing => {
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

                  {/* Campo Salón con autocompletado */}
                  <div className="pos-montaje-campo">
                    <label>Salón *</label>
                    <input
                      type="text" value={montajeData.salon || ''}
                      onChange={e => setMontajeData({...montajeData, salon: e.target.value})}
                      placeholder="Escribe o selecciona un salón..."
                      list="salones-list"
                    />
                    <datalist id="salones-list">
                      {salonesList.map(s => <option key={s} value={s} />)}
                    </datalist>
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
                            {(campo.key === 'tipo_montaje' && configTiposMontaje.length > 0
                              ? configTiposMontaje.map(t => t.nombre)
                              : campo.options
                            ).map(o => <option key={o} value={o}>{o}</option>)}
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
                      width:'250px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
                      background:'var(--bg-card)', position:'relative', display:'flex', flexDirection:'column'
                    }}>
                      {/* Contenedor cuadrado fijo 250x250 — imagen completa sin recorte */}
                      <div style={{width:'250px', height:'250px', borderRadius:'var(--radius-sm) var(--radius-sm) 0 0', overflow:'hidden', background:'var(--bg-elevated)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                        <img src={imagenUrl(img.url)} alt={img.descripcion || ''}
                          style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain', display:'block'}}
                          onError={e => { e.target.style.display='none'; }}
                        />
                      </div>
                      <div style={{padding:'0.4rem'}}>
                        <textarea
                          defaultValue={img.descripcion || ''}
                          placeholder="Agregar descripción..."
                          rows={Math.max(2, (img.descripcion || '').split('\n').length + 1)}
                          onInput={e => {
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                          onBlur={e => handleUpdateImagenDescripcion(img.id, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur(); } }}
                          style={{
                            width: '100%',
                            minHeight: '80px',
                            fontSize: '0.75rem',
                            color: 'var(--text)',
                            textAlign: 'center',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-elevated)',
                            padding: '0.5rem',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            lineHeight: 1.5,
                            overflow: 'auto',
                            boxSizing: 'border-box',
                          }}
                          onFocus={e => {
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                        />
                      </div>
                      <button onClick={() => handleDeleteImagen(img.id)}
                        style={{position:'absolute',top:'4px',right:'4px',background:'rgba(0,0,0,0.5)',color:'white',border:'none',borderRadius:'50%',width:'22px',height:'22px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px'}}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'0.4rem',marginTop:'0.5rem'}}>
                  <div style={{fontSize:'0.72rem',fontWeight:600,color:'var(--text-muted)',marginBottom:'0.15rem'}}>Subir archivo</div>
                  {previewUrl && (
                    <div style={{ position: 'relative', width: '120px', height: '90px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '0.4rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                      <img src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Vista previa" />
                      <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                        ✕
                      </button>
                    </div>
                  )}
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
                  <div style={{display:'flex',gap:'0.35rem',flexWrap:'wrap'}}>
                    <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                      placeholder="https://..." style={{flex:1,minWidth:'150px'}} />
                    <input type="text" value={imagenDesc} onChange={e => setImagenDesc(e.target.value)}
                      placeholder="Descripción" style={{width:'140px',fontSize:'0.78rem'}} />
                    <button className="btn-primary btn-sm" onClick={handleAddImagen} disabled={!urlInput.trim()}>
                      Agregar URL
                    </button>
                  </div>
                </div>
              </div>
            )}

            {elementosFiltrados.length === 0 && !['montaje', 'imagenes'].includes(categoriaActiva) && (
              <div className="pos-empty-msg">Sin resultados</div>
            )}
          </div>
        </div>
      </div>

      {/* ─── BOTTOM ACTIONS ─── */}
      <div className="pos-bottom-actions" style={{paddingLeft: '5rem'}}>
        <button className="pos-bottom-btn" onClick={async () => {
          if (!informeId) { toast.info('Guarda primero el informe'); return; }
          await loadHistorial();
          setModalHistorial(true);
        }}>
          <IconHistory size={15} /> Historial
        </button>
        <button className="pos-bottom-btn pos-bottom-btn-primary" onClick={handleSaveFullInforme} disabled={loading}>
          <IconFileText size={15} /> {loading ? 'Guardando...' : (informeId ? 'Guardar' : 'Crear Informe')}
        </button>
      </div>

      {/* ─── MODAL CREAR INGREDIENTE RÁPIDO ─── */}
      {showNewIngModal && (
        <div className="pos-modal-overlay">
          <div className="pos-modal" onClick={e => e.stopPropagation()} style={{maxWidth:'380px'}}>
            <div className="pos-modal-header">
              <h3>📦 Nuevo Ingrediente</h3>
              <button onClick={() => setShowNewIngModal(false)}><IconX size={16} /></button>
            </div>
            <div className="pos-modal-body">
              <label>Nombre del ingrediente</label>
              <input
                type="text"
                value={newIngNombre}
                onChange={e => setNewIngNombre(e.target.value)}
                placeholder="Ej: Pechuga de pollo, Arroz, Frijol..."
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateIngrediente();
                  if (e.key === 'Escape') setShowNewIngModal(false);
                }}
              />
              <label>Tipo</label>
              <select value={newIngTipo} onChange={e => setNewIngTipo(e.target.value)}>
                <option value="entradas">🍲 Entradas</option>
                <option value="proteina">🥩 Proteína</option>
                <option value="guarnicion">🥗 Guarnición</option>
                <option value="salsa">🫗 Salsa</option>
                <option value="postre">🍰 Postre</option>
                <option value="tortilla_pan">🌮 Tortilla/Pan</option>
                <option value="bebida">🥤 Bebida</option>
                <option value="refaccion">🥪 Refacción</option>
                <option value="boquita">🍿 Boquita</option>
                <option value="desayuno">🌅 Desayuno</option>
                <option value="otros">📦 Otros</option>
              </select>
            </div>
            <div className="pos-modal-footer">
              <button className="btn-secondary" onClick={() => setShowNewIngModal(false)}>Cancelar</button>
              <button
                className="btn-primary"
                disabled={!newIngNombre.trim() || creatingIng}
                onClick={handleCreateIngrediente}
              >
                {creatingIng ? 'Creando...' : <><IconCheckCircle size={14} /> Crear Ingrediente</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL OPCIONES ─── */}
      {modalOpciones && (
        <div className="pos-modal-overlay">
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

              {/* Opciones de ingrediente */}
              {opcionesIng[modalOpciones.id]?.length > 0 && (
                <>
                  <label>Opción</label>
                  <select value={modalOpc} onChange={e => setModalOpc(e.target.value)}>
                    <option value="">Sin especificar</option>
                    {opcionesIng[modalOpciones.id].map(o => (
                      <option key={o.id} value={o.id}>{o.nombre_opcion}</option>
                    ))}
                  </select>
                </>
              )}

              <label>Cantidad</label>
              <input type="number" min="0.5" step="0.5" value={modalQty} onChange={e => setModalQty(e.target.value)} />

              <label>Notas</label>
              <input type="text" value={modalNotas} onChange={e => setModalNotas(e.target.value)} placeholder="Ej: Sin cebolla, bien cocido..." />
            </div>
            <div className="pos-modal-footer">
              <button className="btn-secondary" onClick={() => setModalOpciones(null)}>Cancelar</button>
              <button className="btn-primary" onClick={() => {
                agregarItem(modalOpciones, modalOpc || null, modalPrep, parseFloat(modalQty) || 1, modalNotas);
                setModalOpciones(null);
              }}><IconCheckCircle size={14} /> Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL SELECCIÓN DE VERSIÓN ─── */}
      {showVersionSelector && (
        <div className="pos-modal-overlay" style={{padding:'1rem', overflowY:'auto'}}>
          <div className="pos-modal" onClick={e => e.stopPropagation()} style={{maxWidth:'480px', maxHeight:'85vh', display:'flex', flexDirection:'column'}}>
            <div className="pos-modal-header">
              <h3><IconFileText size={16} /> Versiones del Informe</h3>
              <button onClick={() => setShowVersionSelector(false)}><IconX size={16} /></button>
            </div>
            <div className="pos-modal-body" style={{overflowY:'auto'}}>
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
        <div className="pos-modal-overlay">
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

      {/* ─── MODAL ORDEN DE TIEMPOS DE COMIDA ─── */}
      {showOrdenModal && (
        <OrdenTiemposEditor
          onClose={() => setShowOrdenModal(false)}
          onSaved={(newOrder) => setCustomTiempoComidaOrder(newOrder)}
        />
      )}

      <SettingsChecklist />
    </div>
  );
}

