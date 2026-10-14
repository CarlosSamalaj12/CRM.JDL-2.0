import React, { useState, useEffect } from 'react';
import {
  Bed,
  PhoneCall,
  Users,
  CreditCard,
  MessageSquare,
  Target,
  Layers,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Save,
  RotateCcw,
  Sparkles,
  Info,
  ShieldAlert,
  AlertTriangle,
  Lock,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Tag,
  Megaphone,
  Upload,
  Link,
  Trash
} from 'lucide-react';
import {
  getCatalogosHabitacionesApi,
  getCatalogoItemUsageApi,
  createCatalogoHabitacionApi,
  updateCatalogoHabitacionApi,
  deleteCatalogoHabitacionApi,
  getMetasHabitacionesApi,
  updateMetasHabitacionesApi,
  uploadPromocionImagenApi
} from '../../services/habitacionesService';
import { loadState } from '../../services/stateService';
import { toast } from '../../utils/toast';
import '../habitaciones/habitaciones.css';

const TABS = [
  {
    id: 'medios_contacto',
    label: 'Medios de Contacto',
    icon: PhoneCall,
    color: '#0284c7', // Sky Blue
    bgActive: '#f0f9ff',
    borderActive: '#38bdf8',
    bgBadge: '#e0f2fe',
    badgeColor: '#0369a1'
  },
  {
    id: 'tipos_habitacion',
    label: 'Tipos de Habitación',
    icon: Bed,
    color: '#059669', // Emerald
    bgActive: '#ecfdf5',
    borderActive: '#34d399',
    bgBadge: '#d1fae5',
    badgeColor: '#047857'
  },
  {
    id: 'modulos',
    label: 'Módulos / Sectores',
    icon: Layers,
    color: '#7c3aed', // Purple / Violet
    bgActive: '#f5f3ff',
    borderActive: '#a78bfa',
    bgBadge: '#ede9fe',
    badgeColor: '#6d28d9'
  },
  {
    id: 'tipos_cliente',
    label: 'Segmentos de Cliente',
    icon: Users,
    color: '#d97706', // Amber
    bgActive: '#fffbeb',
    borderActive: '#fbbf24',
    bgBadge: '#fef3c7',
    badgeColor: '#b45309'
  },
  {
    id: 'formas_pago',
    label: 'Formas de Pago',
    icon: CreditCard,
    color: '#0d9488', // Teal
    bgActive: '#f0fdfa',
    borderActive: '#2dd4bf',
    bgBadge: '#ccfbf1',
    badgeColor: '#0f766e'
  },
  {
    id: 'plantillas',
    label: 'Plantillas Mensajes',
    icon: MessageSquare,
    color: '#e11d48', // Rose
    bgActive: '#fff1f2',
    borderActive: '#fb7185',
    bgBadge: '#ffe4e6',
    badgeColor: '#be123c'
  },
  {
    id: 'metas',
    label: 'Metas de Habitaciones',
    icon: Target,
    color: '#4f46e5', // Indigo
    bgActive: '#eef2ff',
    borderActive: '#818cf8',
    bgBadge: '#e0e7ff',
    badgeColor: '#4338ca'
  },
];

const TEMPLATE_VARIABLES_CONFIRMACION = [
  '{nombre_huesped}',
  '{no_folio}',
  '{check_in}',
  '{check_out}',
  '{noches}',
  '{tipo_habitacion}',
  '{cantidad_habitaciones}',
  '{monto_total}'
];

const TEMPLATE_VARIABLES_PROMOCION = [
  '{nombre_huesped}',
  '{segmento}',
  '{descuento}',
  '{vigencia}',
  '{enlace_promo}',
  '{tipo_habitacion}'
];

export default function SettingsHabitaciones({ inline, onBack }) {
  const [activeTab, setActiveTab] = useState('medios_contacto');
  const currentTab = TABS.find(t => t.id === activeTab) || TABS[0];
  const [catalogItems, setCatalogItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Modal / Edición de Catálogo
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: null,
    nombre: '',
    descripcion: '',
    tarifa_base: 0,
    orden: 0,
    activo: 1,
    tipo_plantilla: 'confirmacion',
    plantilla_whatsapp: '',
    plantilla_correo_asunto: '',
    plantilla_correo_cuerpo: '',
    imagen_url: ''
  });

  // Modal de Eliminación con Verificación de Integridad
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    item: null,
    loading: false,
    checkingUsage: false,
    usageCount: 0
  });

  // Metas
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [globalMonto, setGlobalMonto] = useState(0);
  const [vendedoresMetas, setVendedoresMetas] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [savingMetas, setSavingMetas] = useState(false);

  useEffect(() => {
    if (activeTab === 'metas') {
      loadMetasData();
    } else {
      loadCatalogData(activeTab);
    }
  }, [activeTab, selectedMonth]);

  const loadCatalogData = async (cat) => {
    setLoading(true);
    try {
      const data = await getCatalogosHabitacionesApi(cat);
      setCatalogItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando catálogo:', err);
      toast.error('Error al cargar elementos del catálogo');
    } finally {
      setLoading(false);
    }
  };

  const loadMetasData = async () => {
    setLoading(true);
    try {
      const [metasRes, stateData] = await Promise.all([
        getMetasHabitacionesApi(selectedMonth),
        loadState()
      ]);

      const users = (stateData?.users || []).filter(u => {
        const role = String(u.role || '').toLowerCase();
        return role === 'vendedor' || role === 'admin' || role === 'recepcionista';
      });
      setAllUsers(users);

      setGlobalMonto(Number(metasRes?.globalMonto || 0));

      const vMap = new Map();
      (metasRes?.vendedores || []).forEach(v => {
        vMap.set(String(v.id_usuario), Number(v.monto || 0));
      });

      const initialVendedores = users.map(u => ({
        id_usuario: String(u.id),
        nombre: u.name,
        monto: vMap.get(String(u.id)) || 0
      }));
      setVendedoresMetas(initialVendedores);
    } catch (err) {
      console.error('Error cargando metas:', err);
      toast.error('Error al cargar metas de habitaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditFormData({
      id: null,
      nombre: '',
      descripcion: '',
      tarifa_base: 0,
      orden: (catalogItems.length + 1) * 10,
      activo: 1,
      tipo_plantilla: 'confirmacion',
      plantilla_whatsapp: '',
      plantilla_correo_asunto: '',
      plantilla_correo_cuerpo: '',
      imagen_url: ''
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (item) => {
    setEditFormData({
      id: item.id,
      nombre: item.nombre || '',
      descripcion: item.descripcion || '',
      tarifa_base: Number(item.tarifa_base || 0),
      orden: Number(item.orden || 0),
      activo: item.activo !== 0 && item.activo !== false ? 1 : 0,
      tipo_plantilla: item.tipo_plantilla || 'confirmacion',
      plantilla_whatsapp: item.plantilla_whatsapp || '',
      plantilla_correo_asunto: item.plantilla_correo_asunto || '',
      plantilla_correo_cuerpo: item.plantilla_correo_cuerpo || '',
      imagen_url: item.imagen_url || ''
    });
    setIsEditing(true);
  };

  const handleUploadFlyer = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const res = await uploadPromocionImagenApi(file);
      const url = res?.url || res?.data?.url;
      if (url) {
        setEditFormData(prev => ({ ...prev, imagen_url: url }));
        toast.success('Flyer promocional cargado exitosamente ✓');
      }
    } catch (err) {
      console.error('Error subiendo imagen:', err);
      toast.error('Error al subir la imagen');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSaveCatalogItem = async (e) => {
    e.preventDefault();
    if (!editFormData.nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    try {
      const payload = {
        ...editFormData,
        tarifa_base: parseFloat(editFormData.tarifa_base) || 0,
        orden: parseInt(editFormData.orden, 10) || 0
      };
      if (editFormData.id) {
        await updateCatalogoHabitacionApi(activeTab, editFormData.id, payload);
        toast.success('Elemento actualizado correctamente');
      } else {
        await createCatalogoHabitacionApi(activeTab, payload);
        toast.success('Elemento agregado al catálogo');
      }
      setIsEditing(false);
      loadCatalogData(activeTab);
    } catch (err) {
      console.error('Error guardando elemento:', err);
      toast.error('Error al guardar el elemento');
    }
  };

  const handleOpenDeleteModal = async (item) => {
    const directUsage = Number(item.usage_count || 0);
    setDeleteModal({
      isOpen: true,
      item,
      loading: false,
      checkingUsage: true,
      usageCount: directUsage
    });

    try {
      const res = await getCatalogoItemUsageApi(activeTab, item.id);
      const usageRes = res?.data || res;
      const serverUsage = Number(usageRes?.usageCount !== undefined ? usageRes.usageCount : directUsage);
      setDeleteModal(prev => ({
        ...prev,
        checkingUsage: false,
        usageCount: serverUsage
      }));
    } catch {
      setDeleteModal(prev => ({
        ...prev,
        checkingUsage: false
      }));
    }
  };

  const handleCloseDeleteModal = () => {
    if (deleteModal.loading) return;
    setDeleteModal({
      isOpen: false,
      item: null,
      loading: false,
      checkingUsage: false,
      usageCount: 0
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.item) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await deleteCatalogoHabitacionApi(activeTab, deleteModal.item.id);
      toast.success(`"${deleteModal.item.nombre}" eliminado exitosamente`);
      handleCloseDeleteModal();
      loadCatalogData(activeTab);
    } catch (err) {
      console.error('Error desactivando elemento:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Error al eliminar el elemento del catálogo';
      toast.error(errMsg);
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSaveMetas = async (e) => {
    e.preventDefault();
    setSavingMetas(true);
    try {
      await updateMetasHabitacionesApi({
        mes: selectedMonth,
        globalMonto: Number(globalMonto || 0),
        vendedoresMetas: vendedoresMetas.map(v => ({
          id_usuario: v.id_usuario,
          monto: Number(v.monto || 0)
        }))
      });
      toast.success('Metas de habitaciones guardadas exitosamente');
    } catch (err) {
      console.error('Error guardando metas:', err);
      toast.error('Error al guardar metas');
    } finally {
      setSavingMetas(false);
    }
  };

  const handleInsertVariable = (varName, field) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: (prev[field] || '') + ' ' + varName
    }));
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        padding: '24px 28px',
        boxShadow: '0 4px 20px -2px rgba(15,23,42,0.06)'
      }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18, borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: currentTab.bgActive,
              color: currentTab.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 2px 8px ${currentTab.color}25`,
              transition: 'all 0.2s ease'
            }}>
              {React.createElement(currentTab.icon, { size: 22, strokeWidth: 2.4 })}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Centro de Configuración de Habitaciones
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Administra los catálogos comerciales, tarifas, plantillas de contacto y metas mensuales de hospedaje
              </div>
            </div>
          </div>
          {inline && onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              Volver
            </button>
          )}
        </div>

        {/* Sub-Pestañas Bento con Colores Temáticos Diferenciados */}
        <div style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          padding: '16px 4px 20px 4px',
          borderBottom: '1px solid #f1f5f9',
          scrollbarWidth: 'thin',
          WebkitOverflowScrolling: 'touch'
        }}>
          {TABS.map(tab => {
            const IconComp = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); setIsEditing(false); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 18px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: '-0.01em',
                  lineHeight: '1.2',
                  border: isActive ? `2px solid ${tab.color}` : '1px solid #e2e8f0',
                  background: isActive ? tab.bgActive : '#ffffff',
                  color: isActive ? tab.color : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  boxShadow: isActive ? `0 3px 12px ${tab.color}25` : '0 1px 2px rgba(15,23,42,0.03)',
                  outline: 'none'
                }}
              >
                <div style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: isActive ? tab.bgBadge : '#f1f5f9',
                  color: isActive ? tab.color : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.18s ease'
                }}>
                  <IconComp size={15} strokeWidth={2.4} />
                </div>
                <span style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Contenido Pestaña */}
        <div style={{ marginTop: 20 }}>
          {activeTab !== 'metas' ? (
            <div>
              {/* Barra de acción de catálogo */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>
                  {catalogItems.length} elementos registrados en {currentTab.label}
                </span>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: currentTab.color,
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '9px 18px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: `0 2px 8px ${currentTab.color}35`
                  }}
                >
                  <Plus size={15} />
                  <span>+ Agregar a {currentTab.label}</span>
                </button>
              </div>

              {/* Formulario de Alta / Edición Inline */}
              {isEditing && (
                <form
                  onSubmit={handleSaveCatalogItem}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 12,
                    padding: 18,
                    marginBottom: 20
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>
                    {editFormData.id ? 'Editar Elemento' : 'Nuevo Elemento del Catálogo'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Nombre *
                      </label>
                      <input
                        type="text"
                        className="hab-input"
                        value={editFormData.nombre}
                        onChange={e => setEditFormData({ ...editFormData, nombre: e.target.value })}
                        required
                        style={{ width: '100%' }}
                      />
                    </div>

                    {activeTab === 'tipos_habitacion' && (
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                          Tarifa Base Sugerida (Q)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="hab-input"
                          value={editFormData.tarifa_base ?? ''}
                          onFocus={e => e.target.select()}
                          onChange={e => setEditFormData({ ...editFormData, tarifa_base: e.target.value })}
                          onBlur={e => setEditFormData({ ...editFormData, tarifa_base: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                          style={{ width: '100%' }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Orden
                      </label>
                      <input
                        type="number"
                        className="hab-input"
                        value={editFormData.orden ?? ''}
                        onFocus={e => e.target.select()}
                        onChange={e => setEditFormData({ ...editFormData, orden: e.target.value })}
                        onBlur={e => setEditFormData({ ...editFormData, orden: e.target.value === '' ? 0 : (parseInt(e.target.value, 10) || 0) })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Descripción
                    </label>
                    <input
                      type="text"
                      className="hab-input"
                      value={editFormData.descripcion}
                      onChange={e => setEditFormData({ ...editFormData, descripcion: e.target.value })}
                      placeholder="Breve nota interna o descripción..."
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Campos específicos para plantillas */}
                  {activeTab === 'plantillas' && (
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Tipo de Plantilla (Confirmación vs Promoción) */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 6 }}>
                          Propósito de la Plantilla *
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <button
                            type="button"
                            onClick={() => setEditFormData({ ...editFormData, tipo_plantilla: 'confirmacion' })}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 10,
                              border: editFormData.tipo_plantilla === 'confirmacion' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                              background: editFormData.tipo_plantilla === 'confirmacion' ? '#f0f9ff' : '#ffffff',
                              color: editFormData.tipo_plantilla === 'confirmacion' ? '#0369a1' : '#64748b',
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6
                            }}
                          >
                            <Tag size={15} />
                            <span>Confirmación de Reserva</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditFormData({ ...editFormData, tipo_plantilla: 'promocion' })}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 10,
                              border: editFormData.tipo_plantilla === 'promocion' ? '2px solid #e11d48' : '1px solid #cbd5e1',
                              background: editFormData.tipo_plantilla === 'promocion' ? '#fff1f2' : '#ffffff',
                              color: editFormData.tipo_plantilla === 'promocion' ? '#be123c' : '#64748b',
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6
                            }}
                          >
                            <Megaphone size={15} />
                            <span>Oferta / Promoción de Marketing</span>
                          </button>
                        </div>
                      </div>

                      {/* Fotografía / Flyer Promocional */}
                      <div style={{
                        background: '#f8fafc',
                        border: '1px dashed #cbd5e1',
                        borderRadius: 12,
                        padding: '12px 16px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <ImageIcon size={14} color="#e11d48" />
                              <span>Flyer / Imagen Promocional Asociada</span>
                            </span>
                            <span style={{ fontSize: 10, color: '#64748b' }}>
                              Para compartir con el cliente por WhatsApp y correo electrónico
                            </span>
                          </div>

                          <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#334155',
                            cursor: 'pointer'
                          }}>
                            <Upload size={13} />
                            <span>{uploadingImage ? 'Cargando...' : 'Subir Imagen / Flyer'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleUploadFlyer}
                              disabled={uploadingImage}
                              style={{ display: 'none' }}
                            />
                          </label>
                        </div>

                        {editFormData.imagen_url ? (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: '8px 12px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <img
                                src={editFormData.imagen_url}
                                alt="Flyer preview"
                                style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1' }}
                              />
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>
                                  ✓ Flyer cargado correctamente
                                </div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>
                                  Se incluirá enlace y opción de copiar al portapapeles
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setEditFormData({ ...editFormData, imagen_url: '' })}
                              style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#ef4444',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: 10,
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <Trash size={12} />
                              <span>Quitar</span>
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
                            No hay flyer adjunto. Puedes subir una imagen JPG, PNG o WebP.
                          </div>
                        )}
                      </div>

                      {/* Variables Disponibles */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6 }}>
                          Variables dinámicas disponibles (haz clic para insertar):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          {(editFormData.tipo_plantilla === 'promocion'
                            ? TEMPLATE_VARIABLES_PROMOCION
                            : TEMPLATE_VARIABLES_CONFIRMACION
                          ).map(v => (
                            <span
                              key={v}
                              onClick={() => handleInsertVariable(v, 'plantilla_whatsapp')}
                              title="Haz clic para agregar a WhatsApp"
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                background: editFormData.tipo_plantilla === 'promocion' ? '#fff1f2' : '#e0f2fe',
                                color: editFormData.tipo_plantilla === 'promocion' ? '#be123c' : '#0284c7',
                                border: editFormData.tipo_plantilla === 'promocion' ? '1px solid #fecdd3' : '1px solid #bae6fd',
                                padding: '3px 8px',
                                borderRadius: 6,
                                cursor: 'pointer'
                              }}
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                          Mensaje WhatsApp
                        </label>
                        <textarea
                          rows={4}
                          className="hab-input"
                          value={editFormData.plantilla_whatsapp}
                          onChange={e => setEditFormData({ ...editFormData, plantilla_whatsapp: e.target.value })}
                          placeholder={editFormData.tipo_plantilla === 'promocion'
                            ? '¡Hola {nombre_huesped}! En Jardines del Lago tenemos una tarifa especial exclusiva para {segmento}: {descuento}% de descuento...'
                            : 'Hola {nombre_huesped}, te confirmamos tu reserva...'}
                          style={{
                            width: '100%',
                            fontFamily: 'inherit'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                          Asunto de Correo Electrónico
                        </label>
                        <input
                          type="text"
                          className="hab-input"
                          value={editFormData.plantilla_correo_asunto}
                          onChange={e => setEditFormData({ ...editFormData, plantilla_correo_asunto: e.target.value })}
                          placeholder={editFormData.tipo_plantilla === 'promocion'
                            ? 'Oferta Especial Exclusiva ({segmento}) - Jardines del Lago'
                            : 'Confirmación de Reserva Folio #{no_folio}'}
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                          Cuerpo del Correo Electrónico
                        </label>
                        <textarea
                          rows={5}
                          className="hab-input"
                          value={editFormData.plantilla_correo_cuerpo}
                          onChange={e => setEditFormData({ ...editFormData, plantilla_correo_cuerpo: e.target.value })}
                          placeholder="Estimado/a {nombre_huesped}..."
                          style={{
                            width: '100%',
                            fontFamily: 'inherit'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: '7px 18px',
                        borderRadius: 8,
                        background: currentTab.color,
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 800,
                        color: '#ffffff',
                        cursor: 'pointer',
                        boxShadow: `0 2px 8px ${currentTab.color}35`
                      }}
                    >
                      Guardar Elemento
                    </button>
                  </div>
                </form>
              )}

              {/* Tabla de Catálogos */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 800 }}>Nombre</th>
                      {activeTab === 'tipos_habitacion' && (
                        <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 800 }}>Tarifa Base</th>
                      )}
                      <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 800 }}>Descripción</th>
                      <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 800 }}>Orden</th>
                      <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 800 }}>Estado</th>
                      <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 800, textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                          No hay elementos en este catálogo. Haz clic en "+ Agregar Elemento" para crear el primero.
                        </td>
                      </tr>
                    ) : (
                      catalogItems.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', color: '#0f172a' }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{item.nombre}</div>
                            {activeTab === 'plantillas' && (
                              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: 5,
                                  background: item.tipo_plantilla === 'promocion' ? '#fff1f2' : '#eff6ff',
                                  color: item.tipo_plantilla === 'promocion' ? '#be123c' : '#2563eb',
                                  border: item.tipo_plantilla === 'promocion' ? '1px solid #fecdd3' : '1px solid #bfdbfe'
                                }}>
                                  {item.tipo_plantilla === 'promocion' ? <Megaphone size={10} /> : <Tag size={10} />}
                                  <span>{item.tipo_plantilla === 'promocion' ? 'Promoción / Marketing' : 'Confirmación'}</span>
                                </span>
                                {item.imagen_url && (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 10,
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    borderRadius: 5,
                                    background: '#ecfdf5',
                                    color: '#059669',
                                    border: '1px solid #a7f3d0'
                                  }}>
                                    <ImageIcon size={10} />
                                    <span>Flyer Adjunto</span>
                                  </span>
                                )}
                              </div>
                            )}
                            {Number(item.usage_count) > 0 && (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 3,
                                fontSize: 10,
                                fontWeight: 800,
                                color: '#0369a1',
                                background: '#f0f9ff',
                                border: '1px solid #bae6fd',
                                padding: '1px 6px',
                                borderRadius: 4
                              }}>
                                <Lock size={10} strokeWidth={2.4} />
                                <span>{item.usage_count} reserva(s) vinculadas</span>
                              </div>
                            )}
                          </td>
                          {activeTab === 'tipos_habitacion' && (
                            <td style={{ padding: '10px 14px', fontWeight: 800, color: '#059669' }}>
                              Q {Number(item.tarifa_base || 0).toFixed(2)}
                            </td>
                          )}
                          <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>
                            {item.descripcion || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>
                            {item.orden || 0}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: item.activo ? '#ecfdf5' : '#f1f5f9',
                              color: item.activo ? '#059669' : '#64748b'
                            }}>
                              {item.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', marginRight: 8, padding: 4 }}
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(item)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: Number(item.usage_count) > 0 ? '#64748b' : '#ef4444',
                                cursor: 'pointer',
                                padding: 4
                              }}
                              title={Number(item.usage_count) > 0 ? `Protegido: utilizado en ${item.usage_count} reserva(s)` : 'Eliminar elemento'}
                            >
                              {Number(item.usage_count) > 0 ? <ShieldAlert size={15} /> : <Trash2 size={14} />}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Pestaña: Metas Mensuales de Habitaciones */
            <form onSubmit={handleSaveMetas} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Selector de Mes */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
                padding: '14px 18px',
                borderRadius: 12,
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Mes de Facturación</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Selecciona el período para consultar y fijar metas</div>
                </div>
                <input
                  type="month"
                  className="hab-input"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  style={{ fontWeight: 700 }}
                />
              </div>

              {/* Meta Global de Habitaciones */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '18px 20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Target size={18} color="#059669" />
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                    Meta Global Mensual de Hospedaje (Habitaciones)
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px 0' }}>
                  Este objetivo suma al total global consolidado del recinto junto con la meta tradicional de eventos.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#64748b' }}>Q</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="hab-input"
                    value={globalMonto ?? ''}
                    onFocus={e => e.target.select()}
                    onChange={e => setGlobalMonto(e.target.value)}
                    onBlur={e => setGlobalMonto(e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))}
                    style={{
                      width: 220,
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#059669'
                    }}
                  />
                </div>
              </div>

              {/* Metas por Vendedor */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '18px 20px'
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                  Metas Individuales de Habitaciones por Vendedor
                </div>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px 0' }}>
                  Asigna las metas de ventas de hospedaje a cada vendedor del equipo.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {vendedoresMetas.map((vm, idx) => (
                    <div
                      key={vm.id_usuario}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #f1f5f9'
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                        {vm.nombre}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>Q</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="hab-input"
                          value={vm.monto ?? ''}
                          onFocus={e => e.target.select()}
                          onChange={e => {
                            const val = e.target.value;
                            setVendedoresMetas(prev => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], monto: val };
                              return next;
                            });
                          }}
                          onBlur={e => {
                            const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                            setVendedoresMetas(prev => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], monto: val };
                              return next;
                            });
                          }}
                          style={{
                            width: 140,
                            fontWeight: 700,
                            textAlign: 'right'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botón Guardar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={savingMetas}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 24px',
                    borderRadius: 10,
                    background: currentTab.color,
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: savingMetas ? 'not-allowed' : 'pointer',
                    boxShadow: `0 2px 8px ${currentTab.color}35`
                  }}
                >
                  <Save size={16} />
                  <span>{savingMetas ? 'Guardando Metas...' : 'Guardar Metas del Mes'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Modal Diseñado de Eliminación y Protección de Integridad */}
      {deleteModal.isOpen && deleteModal.item && (
        <div
          className="hab-modal-backdrop"
          onClick={handleCloseDeleteModal}
          style={{ animation: 'habModalFadeIn 0.15s ease-out' }}
        >
          <div
            className="hab-modal-card"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 480,
              borderRadius: 20,
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              border: '1px solid #e2e8f0'
            }}
          >
            {/* Si está protegido por tener uso en reservas */}
            {deleteModal.usageCount > 0 ? (
              <div>
                {/* Cabecera de Alerta de Integridad */}
                <div style={{
                  background: 'linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)',
                  padding: '24px 24px 16px',
                  borderBottom: '1px solid #fecdd3',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16
                }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: '#fee2e2',
                    color: '#e11d48',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(225, 29, 72, 0.15)'
                  }}>
                    <ShieldAlert size={26} strokeWidth={2.4} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: '#fee2e2',
                      color: '#be123c',
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6
                    }}>
                      <Lock size={10} strokeWidth={2.6} /> Protección de Integridad
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.01em', lineHeight: 1.25 }}>
                      No es posible eliminar este elemento
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                      El registro cuenta con dependencias activas en el CRM
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseDeleteModal}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: 4,
                      borderRadius: 6
                    }}
                    title="Cerrar"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Contenido Informativo */}
                <div style={{ padding: '20px 24px' }}>
                  {/* Ficha del registro */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '14px 16px',
                    marginBottom: 16
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {TABS.find(t => t.id === activeTab)?.label || 'Catálogo'}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                      {deleteModal.item.nombre}
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 8,
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      fontSize: 12,
                      fontWeight: 800
                    }}>
                      <Lock size={12} strokeWidth={2.4} />
                      <span>Vinculado a {deleteModal.usageCount} reserva(s) de habitación</span>
                    </div>
                  </div>

                  {/* Explicación de seguridad */}
                  <p style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.55, margin: '0 0 12px 0' }}>
                    Para proteger la consistencia de los datos históricos, trazabilidad contable y reportes de ventas, <strong>los registros que ya han sido utilizados no pueden eliminarse</strong> del sistema.
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    fontSize: 12,
                    color: '#166534'
                  }}>
                    <span style={{ fontSize: 14 }}>💡</span>
                    <span>
                      <strong>Sugerencia:</strong> Si no deseas ofrecer más este elemento, puedes usar el botón de <strong>Editar</strong> para modificar su descripción o nombre.
                    </span>
                  </div>
                </div>

                {/* Pie de acción */}
                <div style={{
                  padding: '14px 24px 20px',
                  background: '#f8fafc',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    type="button"
                    onClick={handleCloseDeleteModal}
                    style={{
                      width: '100%',
                      padding: '11px 18px',
                      borderRadius: 10,
                      background: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(15,23,42,0.15)',
                      transition: 'background 0.2s'
                    }}
                  >
                    Entendido, conservar registro
                  </button>
                </div>
              </div>
            ) : (
              /* Si está libre de dependencias y es seguro eliminar */
              <div>
                {/* Cabecera de Confirmación */}
                <div style={{
                  background: 'linear-gradient(180deg, #fef2f2 0%, #ffffff 100%)',
                  padding: '24px 24px 16px',
                  borderBottom: '1px solid #fee2e2',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16
                }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: '#fee2e2',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
                  }}>
                    <Trash2 size={24} strokeWidth={2.4} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: '#ecfdf5',
                      color: '#059669',
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6
                    }}>
                      <CheckCircle2 size={10} strokeWidth={2.6} /> Sin dependencias
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.01em', lineHeight: 1.25 }}>
                      ¿Eliminar elemento del catálogo?
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                      Esta acción removerá el registro de las opciones de selección
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseDeleteModal}
                    disabled={deleteModal.loading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: 4,
                      borderRadius: 6
                    }}
                    title="Cerrar"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Contenido */}
                <div style={{ padding: '20px 24px' }}>
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '14px 16px',
                    marginBottom: 16
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {TABS.find(t => t.id === activeTab)?.label || 'Catálogo'}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                      {deleteModal.item.nombre}
                    </div>
                    {deleteModal.item.descripcion && (
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        {deleteModal.item.descripcion}
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                    ¿Confirmas que deseas eliminar este elemento? El registro no cuenta con reservas asociadas, por lo que su eliminación es segura para el sistema.
                  </p>
                </div>

                {/* Pie con botones */}
                <div style={{
                  padding: '14px 24px 20px',
                  background: '#f8fafc',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  gap: 12,
                  justifyContent: 'flex-end'
                }}>
                  <button
                    type="button"
                    onClick={handleCloseDeleteModal}
                    disabled={deleteModal.loading}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: deleteModal.loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={deleteModal.loading}
                    style={{
                      flex: 1,
                      padding: '10px 18px',
                      borderRadius: 10,
                      background: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: deleteModal.loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)'
                    }}
                  >
                    <Trash2 size={15} />
                    <span>{deleteModal.loading ? 'Eliminando...' : 'Eliminar Elemento'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
