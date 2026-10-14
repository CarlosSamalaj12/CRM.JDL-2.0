import React, { useState, useEffect, useMemo } from 'react';
import {
  Megaphone,
  X,
  Users,
  Send,
  MessageSquare,
  Mail,
  Copy,
  Check,
  Search,
  Sparkles,
  Calendar,
  Percent,
  Link as LinkIcon,
  Upload,
  Image as ImageIcon,
  Building2,
  ExternalLink,
  Phone,
  Clock,
  History,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  getCampanaClientesPorSegmentoApi,
  uploadPromocionImagenApi
} from '../../services/habitacionesService';
import { toast } from '../../utils/toast';

// Armonizador de avatares
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'C';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarPalette(name = '') {
  const palettes = [
    { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' }, // Blue
    { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' }, // Emerald
    { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' }, // Purple
    { bg: '#fffbeb', text: '#d97706', border: '#fde68a' }, // Amber
    { bg: '#fdf2f8', text: '#db2777', border: '#fbcfe8' }, // Rose
    { bg: '#ecfeff', text: '#0891b2', border: '#a5f3fc' }, // Cyan
    { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' }  // Slate
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const idx = Math.abs(hash) % palettes.length;
  return palettes[idx];
}

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  if (cleaned.length === 8) cleaned = '502' + cleaned;
  return cleaned;
}

// Función robusta para copiar imágenes al portapapeles (Ctrl+V en WhatsApp Web)
async function copyImageToClipboard(imageUrl) {
  try {
    if (!imageUrl) return false;
    let blob;
    if (imageUrl.startsWith('data:')) {
      const parts = imageUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      blob = new Blob([u8arr], { type: mime });
    } else {
      const response = await fetch(imageUrl);
      blob = await response.blob();
    }

    if (blob.type !== 'image/png') {
      const img = new Image();
      const loadPromise = new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      img.src = URL.createObjectURL(blob);
      await loadPromise;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    }

    if (navigator?.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[copyImageToClipboard] Error:', err);
    return false;
  }
}

export default function HabitacionCampanaModal({
  isOpen,
  onClose,
  catalogos = {},
  onCampanaFinalizada
}) {
  const [selectedSegmentoId, setSelectedSegmentoId] = useState('');
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Configuración de la promoción y plantilla
  const [selectedPlantillaId, setSelectedPlantillaId] = useState('');
  const [descuento, setDescuento] = useState('20% OFF');
  const [vigencia, setVigencia] = useState('31 de Octubre');
  const [enlacePromo, setEnlacePromo] = useState('https://jardinesdelago.com/promociones');
  const [flyerUrl, setFlyerUrl] = useState('');
  const [uploadingFlyer, setUploadingFlyer] = useState(false);

  // Modo de canal: 'whatsapp' | 'email'
  const [activeChannel, setActiveChannel] = useState('whatsapp');

  // Textos editables generados
  const [customWhatsappText, setCustomWhatsappText] = useState('');
  const [customCorreoAsunto, setCustomCorreoAsunto] = useState('');
  const [customCorreoCuerpo, setCustomCorreoCuerpo] = useState('');

  // Registro en memoria de clientes contactados en esta sesión
  const [contactados, setContactados] = useState(new Set());
  const [copiedFlyer, setCopiedFlyer] = useState(false);

  const segmentos = catalogos.tiposCliente || [];
  const plantillas = catalogos.plantillas || [];

  // Plantillas sugeridas de promoción
  const plantillasPromo = useMemo(() => {
    const promos = plantillas.filter(p => p.tipo_plantilla === 'promocion');
    return promos.length > 0 ? promos : plantillas;
  }, [plantillas]);

  // Selección inicial automática al abrir
  useEffect(() => {
    if (isOpen) {
      if (segmentos.length > 0 && !selectedSegmentoId) {
        setSelectedSegmentoId(segmentos[0].id || segmentos[0].nombre);
      }
      if (plantillasPromo.length > 0 && !selectedPlantillaId) {
        const defaultPl = plantillasPromo[0];
        setSelectedPlantillaId(defaultPl.id);
        setCustomWhatsappText(defaultPl.plantilla_whatsapp || '');
        setCustomCorreoAsunto(defaultPl.plantilla_correo_asunto || '');
        setCustomCorreoCuerpo(defaultPl.plantilla_correo_cuerpo || '');
        if (defaultPl.imagen_url) setFlyerUrl(defaultPl.imagen_url);
      }
      setContactados(new Set());
    }
  }, [isOpen, segmentos, plantillasPromo]);

  // Cargar clientes al cambiar de segmento
  useEffect(() => {
    if (!isOpen || !selectedSegmentoId) return;

    let isMounted = true;
    async function fetchSegmentoClientes() {
      setLoadingClientes(true);
      try {
        const data = await getCampanaClientesPorSegmentoApi(selectedSegmentoId);
        if (isMounted) {
          setClientes(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Error cargando clientes del segmento:', err);
        toast.error('No se pudieron obtener los clientes del segmento');
      } finally {
        if (isMounted) setLoadingClientes(false);
      }
    }

    fetchSegmentoClientes();
    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedSegmentoId]);

  // Manejar cambio de plantilla
  const handleSelectPlantilla = (id) => {
    setSelectedPlantillaId(id);
    const pl = plantillasPromo.find(p => p.id === id);
    if (pl) {
      setCustomWhatsappText(pl.plantilla_whatsapp || '');
      setCustomCorreoAsunto(pl.plantilla_correo_asunto || '');
      setCustomCorreoCuerpo(pl.plantilla_correo_cuerpo || '');
      if (pl.imagen_url) setFlyerUrl(pl.imagen_url);
    }
  };

  // Subir un nuevo flyer dinámico para la campaña
  const handleUploadFlyer = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 5MB');
      return;
    }

    setUploadingFlyer(true);
    try {
      const res = await uploadPromocionImagenApi(file);
      if (res?.url) {
        setFlyerUrl(res.url);
        toast.success('¡Flyer promocional cargado con éxito!');
      }
    } catch (err) {
      console.error('Error subiendo flyer:', err);
      toast.error('Error al subir imagen promocional');
    } finally {
      setUploadingFlyer(false);
    }
  };

  // Función de reemplazo de variables dinámicas por cliente
  const resolveTemplateText = (template, cliente = {}) => {
    if (!template) return '';
    const segNombre = segmentos.find(s => s.id === selectedSegmentoId)?.nombre || 'Estimado Cliente';
    return template
      .replace(/{nombre_huesped}/g, cliente.nombre_huesped || 'Estimado Huésped')
      .replace(/{empresa}/g, cliente.empresa_nombre || '')
      .replace(/{segmento}/g, segNombre)
      .replace(/{descuento}/g, descuento || 'Oferta Especial')
      .replace(/{vigencia}/g, vigencia || 'Por tiempo limitado')
      .replace(/{enlace_promo}/g, enlacePromo || '');
  };

  // Clientes filtrados por búsqueda rápida
  const clientesFiltrados = useMemo(() => {
    if (!searchFilter.trim()) return clientes;
    const q = searchFilter.toLowerCase().trim();
    return clientes.filter(c =>
      (c.nombre_huesped || '').toLowerCase().includes(q) ||
      (c.empresa_nombre || '').toLowerCase().includes(q) ||
      (c.telefono || '').toLowerCase().includes(q) ||
      (c.correo || '').toLowerCase().includes(q)
    );
  }, [clientes, searchFilter]);

  // Copiar flyer al portapapeles global
  const handleCopyFlyer = async () => {
    if (!flyerUrl) {
      toast.error('No hay flyer asignado para copiar');
      return;
    }
    const success = await copyImageToClipboard(flyerUrl);
    if (success) {
      setCopiedFlyer(true);
      toast.success('¡Flyer copiado! Puedes pegarlo con Ctrl+V en WhatsApp Web');
      setTimeout(() => setCopiedFlyer(false), 3000);
    } else {
      toast.error('Tu navegador no permitió copiar la imagen directamente');
    }
  };

  // Lanzar WhatsApp para un cliente
  const handleSendWhatsAppCliente = async (cliente) => {
    const rawPhone = cleanPhoneNumber(cliente.telefono);
    if (!rawPhone) {
      toast.error(`El cliente ${cliente.nombre_huesped} no tiene un teléfono válido registrado`);
      return;
    }

    // Copiar flyer automáticamente si existe para agilizar al asesor
    if (flyerUrl) {
      const copied = await copyImageToClipboard(flyerUrl);
      if (copied) {
        toast.info('Flyer copiado al portapapeles: pulsa Ctrl+V en WhatsApp para adjuntarlo');
      }
    }

    const textoFinal = resolveTemplateText(customWhatsappText, cliente);
    const waUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(textoFinal)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    // Marcar como contactado
    setContactados(prev => new Set([...prev, cliente.telefono]));
    toast.success(`Mensaje enviado a ${cliente.nombre_huesped}`);
  };

  // Lanzar Correo para un cliente
  const handleSendCorreoCliente = (cliente) => {
    if (!cliente.correo || !cliente.correo.includes('@')) {
      toast.error(`El cliente ${cliente.nombre_huesped} no tiene un correo electrónico válido`);
      return;
    }

    const asunto = resolveTemplateText(customCorreoAsunto, cliente) || 'Oferta Especial Exclusiva';
    const cuerpo = resolveTemplateText(customCorreoCuerpo, cliente);
    const mailtoUrl = `mailto:${cliente.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    window.open(mailtoUrl, '_blank');

    setContactados(prev => new Set([...prev, cliente.telefono]));
    toast.success(`Correo abierto para ${cliente.nombre_huesped}`);
  };

  if (!isOpen) return null;

  const currentSegmentObj = segmentos.find(s => s.id === selectedSegmentoId || s.nombre === selectedSegmentoId);
  const porcentajeContactados = clientes.length > 0
    ? Math.round((contactados.size / clientes.length) * 100)
    : 0;

  // Cliente de muestra para preview
  const sampleCliente = clientes[0] || {
    nombre_huesped: 'Lic. Carlos Morales',
    empresa_nombre: 'Banco Industrial',
    telefono: '50255551234',
    correo: 'cmorales@empresa.com'
  };

  return (
    <div className="hab-modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="hab-modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 960,
          width: '95vw',
          maxHeight: '92vh',
          borderRadius: 22,
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)',
          border: '1px solid #cbd5e1'
        }}
      >
        {/* ─────────────────────────────────────────────────────────────
            1. Cabecera Bento con Gradiente Ejecutivo Violeta/Índigo
            ───────────────────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)',
          color: '#ffffff',
          padding: '20px 26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <Megaphone size={22} color="#ffffff" strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' }}>
                  Lanzar Ofertas y Promociones por Segmento
                </h3>
                <span style={{
                  background: 'rgba(255, 255, 255, 0.25)',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 20,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  Marketing CRM
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#e0e7ff', opacity: 0.95 }}>
                Envío dirigido y personalizado por WhatsApp y Correo a clientes de un sector específico.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="hab-campana-close-btn"
            title="Cerrar panel de promociones"
            aria-label="Cerrar modal"
            style={{
              width: 36,
              minWidth: 36,
              maxWidth: 36,
              height: 36,
              minHeight: 36,
              maxHeight: 36,
              padding: 0,
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              borderRadius: 11,
              color: '#ffffff',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <X size={20} strokeWidth={2.5} color="#ffffff" style={{ pointerEvents: 'none', display: 'block' }} />
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. Contenido Principal Scrollable con Bento Grid
            ───────────────────────────────────────────────────────────── */}
        <div style={{
          padding: '20px 24px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          background: '#f8fafc'
        }}>

          {/* Bloque 1: Configuración de la Campaña Bento */}
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            alignItems: 'flex-start'
          }}>
            {/* Selector de Segmento */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                <Users size={14} color="#7c3aed" strokeWidth={2.5} />
                <span>1. Segmento de Clientes Objetivo</span>
              </label>
              <select
                className="hab-select"
                value={selectedSegmentoId}
                onChange={e => setSelectedSegmentoId(e.target.value)}
                style={{ height: 40, fontWeight: 700, fontSize: 13, borderColor: '#c4b5fd' }}
              >
                {segmentos.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={12} color="#059669" />
                <span>
                  {loadingClientes ? 'Buscando clientes...' : `${clientes.length} cliente(s) registrados en ${currentSegmentObj?.nombre || 'este segmento'}`}
                </span>
              </div>
            </div>

            {/* Selector de Plantilla */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                <Sparkles size={14} color="#d97706" strokeWidth={2.5} />
                <span>2. Plantilla de Promoción</span>
              </label>
              <select
                className="hab-select"
                value={selectedPlantillaId}
                onChange={e => handleSelectPlantilla(e.target.value)}
                style={{ height: 40, fontWeight: 700, fontSize: 13 }}
              >
                {plantillasPromo.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} {p.tipo_plantilla === 'promocion' ? '★ (Promo)' : ''}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Variables activas: <code>{'{nombre_huesped}'}</code>, <code>{'{descuento}'}</code>, <code>{'{vigencia}'}</code>
              </div>
            </div>

            {/* Canal y Variables */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                3. Canal Principal
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setActiveChannel('whatsapp')}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 10,
                    border: activeChannel === 'whatsapp' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    background: activeChannel === 'whatsapp' ? '#ecfdf5' : '#ffffff',
                    color: activeChannel === 'whatsapp' ? '#15803d' : '#475569',
                    fontWeight: 800,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer'
                  }}
                >
                  <MessageSquare size={14} />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChannel('email')}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 10,
                    border: activeChannel === 'email' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: activeChannel === 'email' ? '#eff6ff' : '#ffffff',
                    color: activeChannel === 'email' ? '#1d4ed8' : '#475569',
                    fontWeight: 800,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer'
                  }}
                >
                  <Mail size={14} />
                  <span>Correo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bloque 2: Parámetros de la Oferta + Flyer Upload & Preview */}
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            alignItems: 'center'
          }}>
            {/* Parámetro: Descuento */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                <Percent size={13} color="#059669" />
                <span>Descuento u Oferta</span>
              </label>
              <input
                type="text"
                className="hab-input"
                value={descuento}
                onChange={e => setDescuento(e.target.value)}
                placeholder="Ej. 20% OFF, 2x1 Noches"
                style={{ height: 36, fontSize: 12, fontWeight: 700 }}
              />
            </div>

            {/* Parámetro: Vigencia */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                <Calendar size={13} color="#0284c7" />
                <span>Vigencia</span>
              </label>
              <input
                type="text"
                className="hab-input"
                value={vigencia}
                onChange={e => setVigencia(e.target.value)}
                placeholder="Ej. 31 de Octubre"
                style={{ height: 36, fontSize: 12, fontWeight: 700 }}
              />
            </div>

            {/* Parámetro: Enlace Promo */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                <LinkIcon size={13} color="#7c3aed" />
                <span>Enlace Web (Opcional)</span>
              </label>
              <input
                type="text"
                className="hab-input"
                value={enlacePromo}
                onChange={e => setEnlacePromo(e.target.value)}
                placeholder="https://jardinesdelago.com/..."
                style={{ height: 36, fontSize: 12 }}
              />
            </div>

            {/* Flyer Promocional Bento Box */}
            <div style={{
              background: '#f1f5f9',
              borderRadius: 12,
              padding: '10px 14px',
              border: '1px dashed #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {flyerUrl ? (
                  <img
                    src={flyerUrl}
                    alt="Flyer Promo"
                    style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid #cbd5e1' }}
                  />
                ) : (
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b'
                  }}>
                    <ImageIcon size={20} />
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {flyerUrl ? 'Flyer Adjunto' : 'Sin Flyer'}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    {flyerUrl ? 'Listo para pegar en WhatsApp' : 'JPG o PNG hasta 5MB'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {flyerUrl && (
                  <button
                    type="button"
                    onClick={handleCopyFlyer}
                    title="Copiar imagen al portapapeles"
                    style={{
                      height: 32,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: '1px solid #a7f3d0',
                      background: copiedFlyer ? '#16a34a' : '#ecfdf5',
                      color: copiedFlyer ? '#ffffff' : '#059669',
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer'
                    }}
                  >
                    {copiedFlyer ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedFlyer ? 'Copiado' : 'Copiar'}</span>
                  </button>
                )}

                <label
                  style={{
                    height: 32,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: uploadingFlyer ? 'wait' : 'pointer'
                  }}
                >
                  <Upload size={12} />
                  <span>{uploadingFlyer ? 'Subiendo...' : 'Cambiar'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadFlyer}
                    style={{ display: 'none' }}
                    disabled={uploadingFlyer}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Tarjeta Explicativa: Cómo funciona el envío del flyer por WhatsApp */}
          {flyerUrl && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 14,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 12,
              color: '#065f46',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.08)'
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: '#d1fae5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Sparkles size={16} strokeWidth={2.4} />
              </div>
              <div style={{ lineHeight: 1.45 }}>
                <strong style={{ color: '#047857' }}>¿Cómo se envía la imagen/flyer por WhatsApp?</strong><br />
                Por políticas de seguridad de Meta, los enlaces web de WhatsApp solo transmiten texto. Por ello, al presionar <strong>"WhatsApp"</strong>, el sistema <strong>copia automáticamente el flyer a tu portapapeles</strong>. Al abrirse el chat en WhatsApp Web, solo presiona <strong>Ctrl + V</strong> (o Pegar) y la foto se adjuntará lista para enviar junto al mensaje.
              </div>
            </div>
          )}

          {/* Bloque 3: Previsualizador del Mensaje En Vivo */}
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: '16px 20px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: '#1e293b' }}>
                <Sparkles size={14} color="#7c3aed" />
                <span>Previsualización del Mensaje para: <strong style={{ color: '#059669' }}>{sampleCliente.nombre_huesped}</strong></span>
              </div>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                Texto editable abajo
              </span>
            </div>

            {activeChannel === 'whatsapp' ? (
              <textarea
                className="hab-textarea"
                rows={4}
                value={customWhatsappText}
                onChange={e => setCustomWhatsappText(e.target.value)}
                placeholder="Escribe el texto de la promoción por WhatsApp..."
                style={{ fontSize: 12, fontFamily: 'inherit', lineHeight: 1.5, background: '#f8fafc' }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="text"
                  className="hab-input"
                  value={customCorreoAsunto}
                  onChange={e => setCustomCorreoAsunto(e.target.value)}
                  placeholder="Asunto del correo promocional..."
                  style={{ height: 36, fontSize: 12, fontWeight: 700 }}
                />
                <textarea
                  className="hab-textarea"
                  rows={4}
                  value={customCorreoCuerpo}
                  onChange={e => setCustomCorreoCuerpo(e.target.value)}
                  placeholder="Cuerpo del correo promocional..."
                  style={{ fontSize: 12, fontFamily: 'inherit', lineHeight: 1.5, background: '#f8fafc' }}
                />
              </div>
            )}
          </div>

          {/* Bloque 4: Barra de Progreso y Buscador de Clientes */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}>
            {/* Progreso de la Campaña */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>
                Progreso: {contactados.size} de {clientes.length} contactados ({porcentajeContactados}%)
              </div>
              <div style={{
                width: 140,
                height: 8,
                borderRadius: 4,
                background: '#e2e8f0',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${porcentajeContactados}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #10b981, #059669)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* Buscador Bento dentro del segmento */}
            <div
              className="hab-search-wrap hab-campana-search-wrap"
              style={{
                width: 320,
                minWidth: 260,
                maxWidth: 360,
                flex: '1 1 280px',
                position: 'relative'
              }}
            >
              <span className="hab-search-icon" style={{ left: 14 }}>
                <Search size={15} strokeWidth={2.4} />
              </span>
              <input
                type="text"
                className="hab-input hab-search-input"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Buscar cliente, empresa o teléfono..."
                style={{
                  height: 38,
                  paddingLeft: 42,
                  paddingRight: searchFilter ? 34 : 14,
                  fontSize: 12.5,
                  borderRadius: 11,
                  boxSizing: 'border-box'
                }}
              />
              {searchFilter && (
                <button
                  type="button"
                  className="hab-search-clear"
                  onClick={() => setSearchFilter('')}
                  title="Limpiar búsqueda"
                  aria-label="Limpiar búsqueda"
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>

          {/* Bloque 5: Listado de Clientes del Segmento */}
          {loadingClientes ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#64748b' }}>
              <Clock size={28} className="hab-spin" style={{ margin: '0 auto 10px', color: '#7c3aed' }} />
              <div style={{ fontWeight: 700, fontSize: 14 }}>Cargando clientes del segmento {currentSegmentObj?.nombre}...</div>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: '36px 20px',
              textAlign: 'center',
              border: '1px dashed #cbd5e1'
            }}>
              <AlertCircle size={32} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontWeight: 800, fontSize: 15, color: '#334155' }}>
                No se encontraron clientes en el segmento "{currentSegmentObj?.nombre || 'Seleccionado'}"
              </div>
              <p style={{ fontSize: 13, color: '#64748b', maxWidth: 440, margin: '6px auto 0' }}>
                Para agrupar clientes en este sector, asigna el "Segmento de Cliente" al crear o editar reservas de habitaciones.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: 12
            }}>
              {clientesFiltrados.map((cliente, idx) => {
                const palette = getAvatarPalette(cliente.nombre_huesped || 'H');
                const isContacted = contactados.has(cliente.telefono);

                return (
                  <div
                    key={cliente.telefono || idx}
                    style={{
                      background: '#ffffff',
                      borderRadius: 14,
                      padding: '14px 16px',
                      border: isContacted ? '1px solid #86efac' : '1px solid #e2e8f0',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      position: 'relative',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}
                  >
                    {/* Fila Superior: Avatar + Nombre + Estado */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: palette.bg,
                        color: palette.text,
                        border: `1px solid ${palette.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 13,
                        flexShrink: 0
                      }}>
                        {getInitials(cliente.nombre_huesped)}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {cliente.nombre_huesped}
                        </div>
                        {cliente.empresa_nombre && (
                          <div style={{
                            fontSize: 11,
                            color: '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            <Building2 size={11} color="#64748b" />
                            <span>{cliente.empresa_nombre}</span>
                          </div>
                        )}
                      </div>

                      {isContacted && (
                        <span style={{
                          background: '#ecfdf5',
                          color: '#059669',
                          border: '1px solid #a7f3d0',
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          flexShrink: 0
                        }}>
                          <Check size={10} strokeWidth={2.8} />
                          <span>Listo</span>
                        </span>
                      )}
                    </div>

                    {/* Fila Media: Teléfono, Correo, Estancias */}
                    <div style={{ fontSize: 11, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Phone size={12} color="#059669" />
                        <span style={{ fontWeight: 700, color: '#334155' }}>{cliente.telefono || 'Sin teléfono'}</span>
                        <span style={{ margin: '0 4px', color: '#cbd5e1' }}>•</span>
                        <span>{cliente.total_estancias || 1} estancia(s)</span>
                      </div>
                      {cliente.correo && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Mail size={12} color="#0284c7" />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cliente.correo}</span>
                        </div>
                      )}
                    </div>

                    {/* Fila Inferior: Botones de Acción Rápida */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => handleSendWhatsAppCliente(cliente)}
                        title="Enviar promoción por WhatsApp (abre chat con mensaje y copia flyer)"
                        style={{
                          flex: 1,
                          height: 34,
                          borderRadius: 9,
                          border: '1px solid #a7f3d0',
                          background: isContacted ? '#f0fdf4' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: isContacted ? '#047857' : '#ffffff',
                          fontSize: 12,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          boxShadow: isContacted ? 'none' : '0 2px 6px rgba(16, 185, 129, 0.25)'
                        }}
                      >
                        <MessageSquare size={13} strokeWidth={2.4} />
                        <span>{isContacted ? 'Re-enviar WhatsApp' : 'WhatsApp'}</span>
                      </button>

                      {cliente.correo && (
                        <button
                          type="button"
                          onClick={() => handleSendCorreoCliente(cliente)}
                          title="Enviar promoción por Correo Electrónico"
                          style={{
                            width: 36,
                            height: 34,
                            borderRadius: 9,
                            border: '1px solid #bfdbfe',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Mail size={14} strokeWidth={2.4} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            3. Pie de Página del Modal
            ───────────────────────────────────────────────────────────── */}
        <div style={{
          padding: '14px 24px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Segmento activo: <strong style={{ color: '#0f172a' }}>{currentSegmentObj?.nombre}</strong> • {contactados.size} de {clientes.length} contactados
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="hab-btn-cancel"
              onClick={onClose}
              style={{
                height: 38,
                padding: '0 20px',
                borderRadius: 11,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              Cerrar Panel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
