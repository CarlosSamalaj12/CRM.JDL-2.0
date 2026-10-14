import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Mail,
  Send,
  X,
  ExternalLink,
  Sparkles,
  Tag,
  Megaphone,
  Image as ImageIcon,
  Copy,
  Check,
  Share2,
  Calendar,
  Percent
} from 'lucide-react';
import { registrarContactoApi, uploadPromocionImagenApi } from '../../services/habitacionesService';
import { toast } from '../../utils/toast';

function replaceTokens(template, reserva, promo = {}) {
  if (!template || !reserva) return template || '';
  return template
    .replace(/{nombre_huesped}/g, reserva.nombre_huesped || '')
    .replace(/{check_in}/g, reserva.fecha_check_in || '')
    .replace(/{check_out}/g, reserva.fecha_check_out || '')
    .replace(/{noches}/g, String(reserva.noches || 1))
    .replace(/{tipo_habitacion}/g, reserva.tipo_habitacion_nombre || 'Habitación')
    .replace(/{cantidad_habitaciones}/g, String(reserva.cantidad_habitaciones || 1))
    .replace(/{monto_total}/g, Number(reserva.monto_total || 0).toFixed(2))
    .replace(/{no_reserva}/g, reserva.no_folio || 'S/N')
    .replace(/{no_folio}/g, reserva.no_folio || 'S/N')
    .replace(/{segmento}/g, reserva.tipo_cliente_nombre || promo.segmento || 'Clientes Selectos')
    .replace(/{descuento}/g, promo.descuento || '20')
    .replace(/{vigencia}/g, promo.vigencia || 'Fin de mes')
    .replace(/{enlace_promo}/g, promo.enlace_promo || '');
}

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  if (cleaned.length === 8) cleaned = '502' + cleaned;
  return cleaned;
}

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

    // Convertir a image/png si es necesario para compatibilidad estricta con ClipboardItem
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
    console.warn('No se pudo copiar la imagen al portapapeles:', err);
    return false;
  }
}

export default function HabitacionContactModal({
  isOpen,
  onClose,
  reserva,
  initialMedium = 'whatsapp',
  plantillas = [],
  onContactSent
}) {
  const [purpose, setPurpose] = useState('confirmacion'); // 'confirmacion' | 'promocion'
  const [medium, setMedium] = useState(initialMedium); // 'whatsapp' | 'email'
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customText, setCustomText] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedFlyer, setCopiedFlyer] = useState(false);

  // Parámetros de promoción
  const [promoValues, setPromoValues] = useState({
    descuento: '20',
    vigencia: 'Fin de mes',
    segmento: reserva?.tipo_cliente_nombre || 'Clientes Selectos',
    enlace_promo: ''
  });

  // Flyer / Imagen
  const [activeFlyerUrl, setActiveFlyerUrl] = useState('');

  useEffect(() => {
    setMedium(initialMedium);
  }, [initialMedium]);

  // Actualizar valores de promo cuando cambia la reserva
  useEffect(() => {
    if (reserva) {
      setPromoValues(prev => ({
        ...prev,
        segmento: reserva.tipo_cliente_nombre || 'Clientes Selectos'
      }));
    }
  }, [reserva]);

  // Filtrar plantillas según el propósito seleccionado
  const availableTemplates = plantillas.filter(p => {
    if (purpose === 'promocion') {
      return p.tipo_plantilla === 'promocion';
    }
    return p.tipo_plantilla !== 'promocion';
  });

  // Seleccionar plantilla inicial según el propósito
  useEffect(() => {
    if (!reserva) return;

    const list = availableTemplates.length > 0 ? availableTemplates : plantillas;

    if (list.length > 0) {
      const tmpl = list[0];
      setSelectedTemplateId(tmpl.id);
      setActiveFlyerUrl(tmpl.imagen_url || '');

      if (medium === 'whatsapp') {
        setCustomText(replaceTokens(tmpl.plantilla_whatsapp, reserva, promoValues));
      } else {
        setEmailSubject(replaceTokens(tmpl.plantilla_correo_asunto, reserva, promoValues));
        setCustomText(replaceTokens(tmpl.plantilla_correo_cuerpo, reserva, promoValues));
      }
    } else {
      setSelectedTemplateId('');
      setActiveFlyerUrl('');
      if (purpose === 'promocion') {
        if (medium === 'whatsapp') {
          setCustomText(`¡Hola ${reserva.nombre_huesped}! Te saludamos de Jardines del Lago con una tarifa especial para el sector ${promoValues.segmento}: ${promoValues.descuento}% de descuento en estadías. ¡Válido hasta ${promoValues.vigencia}!`);
        } else {
          setEmailSubject(`Oferta Especial Exclusiva (${promoValues.segmento}) - Jardines del Lago`);
          setCustomText(`Estimado/a ${reserva.nombre_huesped},\n\nLe enviamos una cordial invitación con tarifa promocional exclusiva para ${promoValues.segmento}.`);
        }
      } else {
        if (medium === 'whatsapp') {
          setCustomText(`¡Hola ${reserva.nombre_huesped}! Te saludamos de Jardines del Lago respecto a tu reservación Folio #${reserva.no_folio || ''}.`);
        } else {
          setEmailSubject(`Información de su reservación Folio #${reserva.no_folio || ''} - Jardines del Lago`);
          setCustomText(`Estimado/a ${reserva.nombre_huesped},\n\nLe contactamos de Jardines del Lago respecto a su estadía.`);
        }
      }
    }
  }, [purpose, medium, reserva, plantillas]);

  if (!isOpen || !reserva) return null;

  const handleTemplateChange = (tmplId) => {
    setSelectedTemplateId(tmplId);
    const tmpl = plantillas.find(p => p.id === tmplId);
    if (!tmpl) return;

    setActiveFlyerUrl(tmpl.imagen_url || '');

    if (medium === 'whatsapp') {
      setCustomText(replaceTokens(tmpl.plantilla_whatsapp, reserva, promoValues));
    } else {
      setEmailSubject(replaceTokens(tmpl.plantilla_correo_asunto, reserva, promoValues));
      setCustomText(replaceTokens(tmpl.plantilla_correo_cuerpo, reserva, promoValues));
    }
  };

  const handlePromoParamChange = (field, val) => {
    const updated = { ...promoValues, [field]: val };
    setPromoValues(updated);
    const tmpl = plantillas.find(p => p.id === selectedTemplateId);
    if (tmpl) {
      if (medium === 'whatsapp') {
        setCustomText(replaceTokens(tmpl.plantilla_whatsapp, reserva, updated));
      } else {
        setEmailSubject(replaceTokens(tmpl.plantilla_correo_asunto, reserva, updated));
        setCustomText(replaceTokens(tmpl.plantilla_correo_cuerpo, reserva, updated));
      }
    }
  };

  const handleCopyFlyer = async () => {
    if (!activeFlyerUrl) return;
    const ok = await copyImageToClipboard(activeFlyerUrl);
    if (ok) {
      setCopiedFlyer(true);
      toast.success('Flyer copiado al portapapeles. ¡En WhatsApp Web solo presiona Ctrl+V!');
      setTimeout(() => setCopiedFlyer(false), 3000);
    } else {
      toast.info('No se pudo copiar automáticamente la imagen. Puedes abrirla directamente con el botón "Ver".');
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      if (medium === 'whatsapp') {
        const phone = cleanPhoneNumber(reserva.telefono);
        if (!phone) {
          toast.error('El huésped no tiene un número de teléfono registrado');
          setSending(false);
          return;
        }

        // Si hay flyer activo, intentar copiarlo al portapapeles para facilitar el Ctrl+V en WhatsApp Web
        if (activeFlyerUrl) {
          copyImageToClipboard(activeFlyerUrl).then(ok => {
            if (ok) toast.info('Flyer copiado al portapapeles. Pégalo en WhatsApp Web con Ctrl+V ✓');
          }).catch(() => {});
        }

        const encoded = encodeURIComponent(customText);
        window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
        await registrarContactoApi(reserva.id, { tipo: 'WhatsApp' });
        toast.success(`Contacto por WhatsApp registrado (${purpose === 'promocion' ? 'Promoción' : 'Confirmación'}) ✓`);
      } else {
        const email = String(reserva.correo || '').trim();
        if (!email) {
          toast.error('El huésped no tiene un correo electrónico registrado');
          setSending(false);
          return;
        }
        const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(customText)}`;
        window.location.href = mailtoUrl;
        await registrarContactoApi(reserva.id, { tipo: 'Correo' });
        toast.success(`Contacto por Correo registrado (${purpose === 'promocion' ? 'Promoción' : 'Confirmación'}) ✓`);
      }

      if (onContactSent) onContactSent();
      onClose();
    } catch (err) {
      console.error('Error registrando contacto:', err);
      toast.error('Error al registrar la interacción de contacto');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="hab-modal-backdrop" onClick={onClose}>
      <div className="hab-modal-card" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        {/* Cabecera */}
        <div className="hab-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: medium === 'whatsapp' ? '#dcfce7' : '#dbeafe',
              color: medium === 'whatsapp' ? '#16a34a' : '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {medium === 'whatsapp' ? <MessageSquare size={20} /> : <Mail size={20} />}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                Contactar a {reserva.nombre_huesped}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Folio #{reserva.no_folio || 'S/N'} · {reserva.tipo_habitacion_nombre || 'Habitación'}
                {reserva.tipo_cliente_nombre && (
                  <span style={{ marginLeft: 6, fontWeight: 800, color: '#d97706' }}>
                    · Sector: {reserva.tipo_cliente_nombre}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="hab-modal-body" style={{ gap: 14 }}>
          {/* Selector de Propósito del Mensaje */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 6 }}>
              Propósito de la Comunicación
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                onClick={() => setPurpose('confirmacion')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 9,
                  border: purpose === 'confirmacion' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                  background: purpose === 'confirmacion' ? '#f0f9ff' : '#ffffff',
                  color: purpose === 'confirmacion' ? '#0369a1' : '#64748b',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Tag size={14} />
                <span>Confirmar Reserva</span>
              </button>

              <button
                type="button"
                onClick={() => setPurpose('promocion')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 9,
                  border: purpose === 'promocion' ? '2px solid #e11d48' : '1px solid #cbd5e1',
                  background: purpose === 'promocion' ? '#fff1f2' : '#ffffff',
                  color: purpose === 'promocion' ? '#be123c' : '#64748b',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Megaphone size={14} />
                <span>Oferta / Promoción</span>
              </button>
            </div>
          </div>

          {/* Selector de Canal */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setMedium('whatsapp')}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 10,
                border: medium === 'whatsapp' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                background: medium === 'whatsapp' ? '#f0fdf4' : '#ffffff',
                color: medium === 'whatsapp' ? '#16a34a' : '#475569',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <MessageSquare size={16} />
              <span>WhatsApp ({reserva.telefono || 'Sin teléfono'})</span>
            </button>

            <button
              type="button"
              onClick={() => setMedium('email')}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 10,
                border: medium === 'email' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: medium === 'email' ? '#eff6ff' : '#ffffff',
                color: medium === 'email' ? '#2563eb' : '#475569',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <Mail size={16} />
              <span>Correo ({reserva.correo || 'Sin correo'})</span>
            </button>
          </div>

          {/* Selector de Plantilla */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
              Plantilla Predefinida ({purpose === 'promocion' ? 'Promociones' : 'Confirmaciones'})
            </label>
            <select
              className="hab-select"
              style={{ width: '100%', height: 38 }}
              value={selectedTemplateId}
              onChange={e => handleTemplateChange(e.target.value)}
            >
              {(availableTemplates.length > 0 ? availableTemplates : plantillas).map(p => (
                <option key={p.id} value={p.id}>
                  {p.tipo_plantilla === 'promocion' ? '📢 ' : '✓ '}
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Parámetros de Promoción (Si está en modo Promoción) */}
          {purpose === 'promocion' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '10px 12px'
            }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 3 }}>
                  % Descuento
                </label>
                <input
                  type="text"
                  className="hab-input"
                  style={{ width: '100%', height: 32, fontSize: 12 }}
                  placeholder="Ej. 20"
                  value={promoValues.descuento}
                  onChange={e => handlePromoParamChange('descuento', e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 3 }}>
                  Vigencia
                </label>
                <input
                  type="text"
                  className="hab-input"
                  style={{ width: '100%', height: 32, fontSize: 12 }}
                  placeholder="Ej. 31 de Octubre"
                  value={promoValues.vigencia}
                  onChange={e => handlePromoParamChange('vigencia', e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 3 }}>
                  Segmento / Sector
                </label>
                <input
                  type="text"
                  className="hab-input"
                  style={{ width: '100%', height: 32, fontSize: 12 }}
                  placeholder="Ej. Bancos / ONG"
                  value={promoValues.segmento}
                  onChange={e => handlePromoParamChange('segmento', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Flyer / Fotografía Promocional */}
          {activeFlyerUrl && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 10,
              padding: '8px 12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img
                  src={activeFlyerUrl}
                  alt="Flyer promocional"
                  style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid #86efac' }}
                />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#065f46', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ImageIcon size={13} />
                    <span>Flyer Promocional Listo</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#047857' }}>
                    Puedes copiarlo al portapapeles y pegarlo con Ctrl+V en WhatsApp Web
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyFlyer}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: copiedFlyer ? '#059669' : '#ffffff',
                  color: copiedFlyer ? '#ffffff' : '#065f46',
                  border: '1px solid #a7f3d0',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {copiedFlyer ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedFlyer ? '¡Copiado!' : 'Copiar Imagen'}</span>
              </button>
            </div>
          )}

          {/* Tip explicativo para WhatsApp cuando hay flyer */}
          {activeFlyerUrl && medium === 'whatsapp' && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 11,
              color: '#065f46',
              lineHeight: 1.45
            }}>
              <Sparkles size={15} color="#059669" style={{ flexShrink: 0 }} />
              <div>
                <strong>Envío del Flyer:</strong> Al hacer clic en <em>"Enviar por WhatsApp"</em>, la imagen se <strong>copia automáticamente a tu portapapeles</strong>. En la ventana de WhatsApp Web, solo presiona <strong>Ctrl + V</strong> (o Pegar) para adjuntarla junto al texto.
              </div>
            </div>
          )}

          {/* Asunto (para correo) */}
          {medium === 'email' && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                Asunto del Correo
              </label>
              <input
                type="text"
                className="hab-input"
                style={{ width: '100%', height: 38 }}
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
              />
            </div>
          )}

          {/* Vista previa / editor de mensaje */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#475569' }}>
                Mensaje Dinámico (puedes personalizarlo antes de enviar)
              </label>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>
                Registrará fecha/hora de último contacto
              </span>
            </div>
            <textarea
              rows={purpose === 'promocion' ? 5 : 6}
              className="hab-input"
              style={{ width: '100%', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }}
              value={customText}
              onChange={e => setCustomText(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="hab-modal-footer">
          <button
            type="button"
            className="hab-btn-cancel"
            onClick={onClose}
            disabled={sending}
            style={{
              background: '#f1f5f9',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              padding: '10px 18px',
              borderRadius: 11,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="hab-btn-primary"
            style={{
              background: medium === 'whatsapp'
                ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              backgroundColor: medium === 'whatsapp' ? '#16a34a' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: 11,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: medium === 'whatsapp'
                ? '0 3px 12px rgba(22, 163, 74, 0.35)'
                : '0 3px 12px rgba(37, 99, 235, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8
            }}
            onClick={handleSend}
            disabled={sending}
          >
            <Send size={15} />
            <span>
              {sending
                ? 'Registrando...'
                : medium === 'whatsapp'
                ? (purpose === 'promocion' ? 'Enviar Promoción por WhatsApp' : 'Enviar por WhatsApp')
                : (purpose === 'promocion' ? 'Enviar Promoción por Correo' : 'Abrir Correo')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

