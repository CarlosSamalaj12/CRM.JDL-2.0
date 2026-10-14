import React, { useState, useEffect, useRef } from 'react';
import { Bed, Calendar, DollarSign, User, Building2, Phone, Mail, FileText, Check, X, Sparkles, Star, AlertCircle } from 'lucide-react';
import { getHuespedHistorialApi } from '../../services/habitacionesService';
import authService from '../../services/authService';
import { toast } from '../../utils/toast';
import './habitaciones.css';

function calculateDays(inStr, outStr) {
  if (!inStr || !outStr) return 1;
  const inD = new Date(inStr + 'T00:00:00');
  const outD = new Date(outStr + 'T00:00:00');
  const diff = Math.round((outD.getTime() - inD.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Number.isNaN(diff) ? 1 : diff);
}

function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + Math.max(1, Number(days || 1)));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function HabitacionModal({
  isOpen,
  onClose,
  initialData = null,
  onSave,
  catalogos = {},
  sellers = [],
  companies = []
}) {
  const currentUser = authService.getCurrentUser() || {};

  const [formData, setFormData] = useState({
    nombre_huesped: '',
    telefono: '',
    correo: '',
    id_vendedor: currentUser.id || '',
    vendedor_nombre: currentUser.name || '',
    id_medio_contacto: '',
    medio_contacto_nombre: '',
    fecha_check_in: getTodayStr(),
    fecha_check_out: getTomorrowStr(),
    noches: 1,
    cantidad_habitaciones: 1,
    no_folio: '',
    id_tipo_cliente: '',
    tipo_cliente_nombre: '',
    id_tipo_habitacion: '',
    tipo_habitacion_nombre: '',
    modulo: '',
    tarifa_diaria: 0,
    monto_total: 0,
    isManualTotal: false,
    id_empresa: '',
    empresa_nombre: '',
    id_forma_pago: '',
    forma_pago_nombre: '',
    estado: 'Confirmada',
    observaciones: ''
  });

  // Historial Huésped Frecuente
  const [huespedHistorial, setHuespedHistorial] = useState(null);
  const [showHistorialDetails, setShowHistorialDetails] = useState(false);

  // Autocompletado de Empresa
  const [companySearch, setCompanySearch] = useState('');
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showCompanyList, setShowCompanyList] = useState(false);

  // Estado de validaciones no nativas con diseño y feedback reactivo
  const [errors, setErrors] = useState({});

  const clearError = (field) => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Inicialización
  useEffect(() => {
    setErrors({});
    if (initialData) {
      const noches = Number(initialData.noches) || calculateDays(initialData.fecha_check_in, initialData.fecha_check_out);
      const habs = Number(initialData.cantidad_habitaciones || 1);
      const tarifa = Number(initialData.tarifa_diaria || 0);
      const autoTotal = noches * habs * tarifa;
      const currentTotal = Number(initialData.monto_total || 0);
      const isManual = Math.abs(currentTotal - autoTotal) > 0.05;

      setFormData({
        id: initialData.id,
        nombre_huesped: initialData.nombre_huesped ?? '',
        telefono: initialData.telefono ?? '',
        correo: initialData.correo ?? '',
        id_vendedor: initialData.id_vendedor ?? currentUser.id ?? '',
        vendedor_nombre: initialData.vendedor_nombre ?? currentUser.name ?? '',
        id_medio_contacto: initialData.id_medio_contacto ?? '',
        medio_contacto_nombre: initialData.medio_contacto_nombre ?? '',
        fecha_check_in: initialData.fecha_check_in ? String(initialData.fecha_check_in).split('T')[0] : getTodayStr(),
        fecha_check_out: initialData.fecha_check_out ? String(initialData.fecha_check_out).split('T')[0] : getTomorrowStr(),
        noches,
        cantidad_habitaciones: habs,
        no_folio: initialData.no_folio ?? '',
        id_tipo_cliente: initialData.id_tipo_cliente ?? '',
        tipo_cliente_nombre: initialData.tipo_cliente_nombre ?? '',
        id_tipo_habitacion: initialData.id_tipo_habitacion ?? '',
        tipo_habitacion_nombre: initialData.tipo_habitacion_nombre ?? '',
        modulo: initialData.modulo ?? '',
        tarifa_diaria: tarifa,
        monto_total: currentTotal,
        isManualTotal: isManual,
        id_empresa: initialData.id_empresa ?? '',
        empresa_nombre: initialData.empresa_nombre ?? '',
        id_forma_pago: initialData.id_forma_pago ?? '',
        forma_pago_nombre: initialData.forma_pago_nombre ?? '',
        estado: initialData.estado || 'Confirmada',
        observaciones: initialData.observaciones ?? ''
      });
      setCompanySearch(initialData.empresa_nombre ?? '');

      if (initialData.telefono || initialData.correo) {
        checkGuestHistory(initialData.telefono || initialData.correo);
      } else {
        setHuespedHistorial(null);
      }
    } else {
      const defaultCheckIn = getTodayStr();
      const defaultCheckOut = getTomorrowStr();
      const defaultNoches = 1;

      // Precargar primer tipo de habitacion y medio si existen
      const defaultTipoHab = (catalogos.tiposHabitacion || [])[0] || {};
      const defaultMedio = (catalogos.mediosContacto || [])[0] || {};
      const defaultCliente = (catalogos.tiposCliente || [])[0] || {};
      const defaultPago = (catalogos.formasPago || [])[0] || {};
      const defaultModulo = (catalogos.modulos || [])[0]?.nombre || '';

      const tarifa = Number(defaultTipoHab.tarifa_base || 450);

      setFormData({
        nombre_huesped: '',
        telefono: '',
        correo: '',
        id_vendedor: currentUser.id || '',
        vendedor_nombre: currentUser.name || '',
        id_medio_contacto: defaultMedio.id || '',
        medio_contacto_nombre: defaultMedio.nombre || '',
        fecha_check_in: defaultCheckIn,
        fecha_check_out: defaultCheckOut,
        noches: defaultNoches,
        cantidad_habitaciones: 1,
        no_folio: '',
        id_tipo_cliente: defaultCliente.id || '',
        tipo_cliente_nombre: defaultCliente.nombre || '',
        id_tipo_habitacion: defaultTipoHab.id || '',
        tipo_habitacion_nombre: defaultTipoHab.nombre || '',
        modulo: defaultModulo,
        tarifa_diaria: tarifa,
        monto_total: defaultNoches * 1 * tarifa,
        isManualTotal: false,
        id_empresa: '',
        empresa_nombre: '',
        id_forma_pago: defaultPago.id || '',
        forma_pago_nombre: defaultPago.nombre || '',
        estado: 'Confirmada',
        observaciones: ''
      });
      setCompanySearch('');
      setHuespedHistorial(null);
    }
  }, [initialData, catalogos, isOpen]);

  // Recálculo reactivo de total si no está en modo manual
  const recalculateTotal = (noches, habs, tarifa, isManual, currentManualTotal) => {
    // Si está en modo manual pero el monto manual es 0 o vacío, recalcular automáticamente
    if (isManual && currentManualTotal !== 0 && currentManualTotal !== '0' && currentManualTotal !== '' && !isNaN(Number(currentManualTotal))) {
      return currentManualTotal;
    }
    const n = Math.max(0, Number(noches || 0));
    const h = Math.max(0, Number(habs || 0));
    const t = Math.max(0, Number(tarifa || 0));
    return n * h * t;
  };

  // Manejo de Noches (permite borrar libremente para ingresar la cantidad deseada)
  const handleNochesChange = (val) => {
    clearError('noches');
    clearError('fecha_check_out');
    if (val === '') {
      setFormData(prev => ({
        ...prev,
        noches: '',
        monto_total: recalculateTotal(0, prev.cantidad_habitaciones, prev.tarifa_diaria, prev.isManualTotal, prev.monto_total)
      }));
      return;
    }
    let cleanVal = val;
    if (cleanVal.length > 1 && cleanVal.startsWith('0')) {
      cleanVal = cleanVal.replace(/^0+/, '');
      if (cleanVal === '') cleanVal = '0';
    }
    const n = parseInt(cleanVal, 10);
    const newOut = formData.fecha_check_in && n > 0 ? addDays(formData.fecha_check_in, n) : formData.fecha_check_out;
    setFormData(prev => ({
      ...prev,
      noches: cleanVal,
      fecha_check_out: newOut,
      monto_total: recalculateTotal(n > 0 ? n : 0, prev.cantidad_habitaciones, prev.tarifa_diaria, prev.isManualTotal, prev.monto_total)
    }));
  };

  const handleNochesBlur = () => {
    const parsed = parseInt(formData.noches, 10);
    const fallback = isNaN(parsed) || parsed < 1 ? (calculateDays(formData.fecha_check_in, formData.fecha_check_out) || 1) : parsed;
    const newOut = formData.fecha_check_in ? addDays(formData.fecha_check_in, fallback) : formData.fecha_check_out;
    setFormData(prev => ({
      ...prev,
      noches: fallback,
      fecha_check_out: newOut,
      monto_total: recalculateTotal(fallback, prev.cantidad_habitaciones, prev.tarifa_diaria, prev.isManualTotal, prev.monto_total)
    }));
    if (fallback >= 1) {
      clearError('noches');
      clearError('fecha_check_out');
    }
  };

  // Manejo de Cantidad de Habitaciones (permite borrar libremente)
  const handleCantidadHabitacionesChange = (val) => {
    clearError('cantidad_habitaciones');
    if (val === '') {
      setFormData(prev => ({
        ...prev,
        cantidad_habitaciones: '',
        monto_total: recalculateTotal(prev.noches, 0, prev.tarifa_diaria, prev.isManualTotal, prev.monto_total)
      }));
      return;
    }
    let cleanVal = val;
    if (cleanVal.length > 1 && cleanVal.startsWith('0')) {
      cleanVal = cleanVal.replace(/^0+/, '');
      if (cleanVal === '') cleanVal = '0';
    }
    const c = parseInt(cleanVal, 10);
    setFormData(prev => ({
      ...prev,
      cantidad_habitaciones: cleanVal,
      monto_total: recalculateTotal(prev.noches, c > 0 ? c : 0, prev.tarifa_diaria, prev.isManualTotal, prev.monto_total)
    }));
  };

  const handleCantidadHabitacionesBlur = () => {
    const parsed = parseInt(formData.cantidad_habitaciones, 10);
    const fallback = isNaN(parsed) || parsed < 1 ? 1 : parsed;
    setFormData(prev => ({
      ...prev,
      cantidad_habitaciones: fallback,
      monto_total: recalculateTotal(prev.noches, fallback, prev.tarifa_diaria, prev.isManualTotal, prev.monto_total)
    }));
    if (fallback >= 1) {
      clearError('cantidad_habitaciones');
    }
  };

  // Manejo de Tarifa Diaria (permite borrar libremente sin prefijos '0450')
  const handleTarifaDiariaChange = (val) => {
    clearError('tarifa_diaria');
    if (val === '') {
      setFormData(prev => ({
        ...prev,
        tarifa_diaria: '',
        monto_total: recalculateTotal(prev.noches, prev.cantidad_habitaciones, 0, prev.isManualTotal, prev.monto_total)
      }));
      return;
    }
    let cleanVal = val;
    if (cleanVal.length > 1 && cleanVal.startsWith('0') && !cleanVal.startsWith('0.')) {
      cleanVal = cleanVal.replace(/^0+/, '');
      if (cleanVal === '') cleanVal = '0';
    }
    const t = parseFloat(cleanVal);
    const numTarifa = isNaN(t) ? 0 : t;
    setFormData(prev => ({
      ...prev,
      tarifa_diaria: cleanVal,
      monto_total: recalculateTotal(prev.noches, prev.cantidad_habitaciones, numTarifa, prev.isManualTotal, prev.monto_total)
    }));
  };

  const handleTarifaDiariaBlur = () => {
    if (formData.tarifa_diaria === '' || isNaN(Number(formData.tarifa_diaria))) {
      setFormData(prev => ({
        ...prev,
        tarifa_diaria: 0,
        monto_total: recalculateTotal(prev.noches, prev.cantidad_habitaciones, 0, prev.isManualTotal, prev.monto_total)
      }));
    } else {
      const cleanNum = Number(formData.tarifa_diaria);
      setFormData(prev => ({
        ...prev,
        tarifa_diaria: cleanNum,
        monto_total: recalculateTotal(prev.noches, prev.cantidad_habitaciones, cleanNum, prev.isManualTotal, prev.monto_total)
      }));
    }
    clearError('tarifa_diaria');
  };

  // Manejo de Monto Total (permite borrar y escribir cantidad manual deseada)
  const handleMontoTotalChange = (val) => {
    clearError('monto_total');
    if (val === '') {
      setFormData(prev => ({
        ...prev,
        monto_total: '',
        isManualTotal: true
      }));
      return;
    }
    let cleanVal = val;
    if (cleanVal.length > 1 && cleanVal.startsWith('0') && !cleanVal.startsWith('0.')) {
      cleanVal = cleanVal.replace(/^0+/, '');
      if (cleanVal === '') cleanVal = '0';
    }
    setFormData(prev => ({
      ...prev,
      monto_total: cleanVal,
      isManualTotal: true
    }));
  };

  const handleMontoTotalBlur = () => {
    if (formData.monto_total === '' || isNaN(Number(formData.monto_total))) {
      const auto = (Number(formData.noches) || 1) * (Number(formData.cantidad_habitaciones) || 1) * (Number(formData.tarifa_diaria) || 0);
      setFormData(prev => ({
        ...prev,
        monto_total: auto,
        isManualTotal: false
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        monto_total: Number(formData.monto_total)
      }));
    }
    clearError('monto_total');
  };

  // Manejo de Fechas
  const handleDateChange = (field, val) => {
    const updated = { ...formData, [field]: val };
    const inD = field === 'fecha_check_in' ? val : formData.fecha_check_in;
    let outD = field === 'fecha_check_out' ? val : formData.fecha_check_out;

    if (field === 'fecha_check_in' && outD && outD <= val) {
      outD = addDays(val, Math.max(1, parseInt(updated.noches, 10) || 1));
      updated.fecha_check_out = outD;
    }

    const computedNoches = calculateDays(inD, outD);
    updated.noches = computedNoches;
    updated.monto_total = recalculateTotal(
      computedNoches,
      updated.cantidad_habitaciones,
      updated.tarifa_diaria,
      updated.isManualTotal,
      updated.monto_total
    );
    setFormData(updated);
    clearError(field);
    clearError('noches');
    clearError('fecha_check_out');
  };

  // Manejo de Tipo de Habitación
  const handleTipoHabitacionChange = (id) => {
    const selected = (catalogos.tiposHabitacion || []).find(t => t.id === id);
    const tarifa = selected ? Number(selected.tarifa_base || 0) : formData.tarifa_diaria;
    const updated = {
      ...formData,
      id_tipo_habitacion: id,
      tipo_habitacion_nombre: selected ? selected.nombre : '',
      tarifa_diaria: tarifa,
    };
    updated.monto_total = recalculateTotal(
      updated.noches,
      updated.cantidad_habitaciones,
      tarifa,
      updated.isManualTotal,
      updated.monto_total
    );
    setFormData(updated);
  };

  // Búsqueda de Historial de Huésped al cambiar teléfono o correo
  const checkGuestHistory = async (val) => {
    if (!val || val.length < 4) return;
    try {
      const res = await getHuespedHistorialApi(val);
      if (res && res.totalEstancias > 0) {
        setHuespedHistorial(res);
        if (res.huesped) {
          if (!formData.nombre_huesped && res.huesped.nombre) {
            setFormData(prev => ({ ...prev, nombre_huesped: res.huesped.nombre }));
          }
          if (!formData.empresa_nombre && res.huesped.empresa_nombre) {
            setFormData(prev => ({
              ...prev,
              id_empresa: res.huesped.id_empresa,
              empresa_nombre: res.huesped.empresa_nombre
            }));
            setCompanySearch(res.huesped.empresa_nombre);
          }
        }
      }
    } catch (err) {
      console.warn('Error verificando historial:', err);
    }
  };

  // Manejo de Empresa
  const handleCompanySearchChange = (text) => {
    setCompanySearch(text);
    setFormData(prev => ({ ...prev, empresa_nombre: text, id_empresa: '' }));
    if (!text.trim()) {
      setCompanySuggestions([]);
      setShowCompanyList(false);
      return;
    }
    const q = text.toLowerCase();
    const matches = (companies || []).filter(c => (c.name || c.nombre || '').toLowerCase().includes(q));
    setCompanySuggestions(matches.slice(0, 5));
    setShowCompanyList(true);
  };

  const handleSelectCompany = (comp) => {
    const compName = comp.name || comp.nombre;
    setCompanySearch(compName);
    setFormData(prev => ({
      ...prev,
      id_empresa: comp.id,
      empresa_nombre: compName
    }));
    setShowCompanyList(false);
  };

  // Validaciones no nativas con diseño y feedback reactivo
  const validateForm = () => {
    const newErrors = {};

    // 1. Nombre del Huésped
    if (!formData.nombre_huesped || !formData.nombre_huesped.trim()) {
      newErrors.nombre_huesped = 'El nombre del huésped es obligatorio';
    }

    // 2. Fechas de Check-In y Check-Out
    if (!formData.fecha_check_in) {
      newErrors.fecha_check_in = 'La fecha de check-in es obligatoria';
    }
    if (!formData.fecha_check_out) {
      newErrors.fecha_check_out = 'La fecha de check-out es obligatoria';
    }
    if (formData.fecha_check_in && formData.fecha_check_out && formData.fecha_check_out <= formData.fecha_check_in) {
      newErrors.fecha_check_out = 'El check-out debe ser posterior al check-in';
      newErrors.noches = 'La reserva debe tener al menos 1 noche';
    }

    // 3. Al menos 1 noche requerida
    const numNoches = parseInt(formData.noches, 10);
    if (formData.noches === '' || isNaN(numNoches) || numNoches < 1) {
      newErrors.noches = 'La reserva debe tener al menos 1 noche';
    }

    // 4. Cantidad de Habitaciones (al menos 1)
    const numHabs = parseInt(formData.cantidad_habitaciones, 10);
    if (formData.cantidad_habitaciones === '' || isNaN(numHabs) || numHabs < 1) {
      newErrors.cantidad_habitaciones = 'Debe registrar al menos 1 habitación';
    }

    // 5. Tarifa diaria (no negativa)
    const numTarifa = parseFloat(formData.tarifa_diaria);
    if (formData.tarifa_diaria === '' || isNaN(numTarifa) || numTarifa < 0) {
      newErrors.tarifa_diaria = 'La tarifa diaria no puede ser negativa';
    }

    // 6. Monto total (no negativo)
    const numTotal = parseFloat(formData.monto_total);
    if (formData.monto_total === '' || isNaN(numTotal) || numTotal < 0) {
      newErrors.monto_total = 'El monto total no puede ser negativo';
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);

      // Feedback prioritario mediante toast corporativo
      if (validationErrors.nombre_huesped) {
        toast.error(validationErrors.nombre_huesped);
      } else if (validationErrors.fecha_check_in) {
        toast.error(validationErrors.fecha_check_in);
      } else if (validationErrors.fecha_check_out) {
        toast.error(validationErrors.fecha_check_out);
      } else if (validationErrors.noches) {
        toast.error(validationErrors.noches);
      } else if (validationErrors.cantidad_habitaciones) {
        toast.error(validationErrors.cantidad_habitaciones);
      } else if (validationErrors.tarifa_diaria) {
        toast.error(validationErrors.tarifa_diaria);
      } else if (validationErrors.monto_total) {
        toast.error(validationErrors.monto_total);
      } else {
        toast.error('Por favor completa los campos requeridos');
      }

      // Auto-enfoque al primer campo con error
      setTimeout(() => {
        const firstInvalid = document.querySelector('.hab-modal-card .is-invalid');
        if (firstInvalid && typeof firstInvalid.focus === 'function') {
          firstInvalid.focus();
        }
      }, 50);
      return;
    }

    const nochesFinal = Math.max(1, parseInt(formData.noches, 10) || calculateDays(formData.fecha_check_in, formData.fecha_check_out) || 1);
    const habsFinal = Math.max(1, parseInt(formData.cantidad_habitaciones, 10) || 1);
    const tarifaFinal = Math.max(0, parseFloat(formData.tarifa_diaria) || 0);
    const autoTotal = nochesFinal * habsFinal * tarifaFinal;
    const montoFinal = formData.isManualTotal && formData.monto_total !== '' && !isNaN(Number(formData.monto_total))
      ? Math.max(0, Number(formData.monto_total))
      : autoTotal;

    const payload = {
      ...formData,
      noches: nochesFinal,
      cantidad_habitaciones: habsFinal,
      tarifa_diaria: tarifaFinal,
      monto_total: montoFinal
    };

    onSave(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="hab-modal-backdrop" onClick={onClose}>
      <div className="hab-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="hab-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bed size={22} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                {initialData ? 'Editar Reserva de Habitación' : '+ Nueva Reserva de Habitación'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Registro comercial y financiero de estancia en Jardines del Lago
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <form noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="hab-modal-body">
            {/* Banner Huésped Frecuente */}
            {huespedHistorial && huespedHistorial.totalEstancias > 0 && (
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 12,
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Star size={18} color="#d97706" fill="#f59e0b" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#92400e' }}>
                      ⭐ Huésped Frecuente: {huespedHistorial.totalEstancias} estancia(s) previas · Total gastado: Q {Number(huespedHistorial.totalGastado || 0).toFixed(2)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHistorialDetails(!showHistorialDetails)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#b45309',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    {showHistorialDetails ? 'Ocultar estancias' : 'Ver estancias anteriores'}
                  </button>
                </div>

                {showHistorialDetails && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(huespedHistorial.estancias || []).map((est, i) => (
                      <div
                        key={est.id || i}
                        style={{
                          fontSize: 11,
                          color: '#78350f',
                          background: '#fef3c7',
                          padding: '4px 8px',
                          borderRadius: 6,
                          display: 'flex',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span>📅 Del {est.fecha_check_in} al {est.fecha_check_out} ({est.noches} noches) - {est.tipo_habitacion_nombre}</span>
                        <span style={{ fontWeight: 800 }}>Q {Number(est.monto_total || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SECCIÓN 1: DATOS DEL HUÉSPED Y EMPRESA */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={15} color="#059669" />
                <span>Información del Huésped & Empresa</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Nombre del Huésped *
                  </label>
                  <input
                    type="text"
                    className={`hab-input ${errors.nombre_huesped ? 'is-invalid' : ''}`}
                    style={{ width: '100%' }}
                    placeholder="Ej. Juan Pérez"
                    value={formData.nombre_huesped ?? ''}
                    onChange={e => {
                      setFormData({ ...formData, nombre_huesped: e.target.value });
                      clearError('nombre_huesped');
                    }}
                  />
                  {errors.nombre_huesped && (
                    <div className="hab-field-error">
                      <AlertCircle size={12} strokeWidth={2.4} />
                      <span>{errors.nombre_huesped}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    className="hab-input"
                    style={{ width: '100%' }}
                    placeholder="Ej. 55554444"
                    value={formData.telefono ?? ''}
                    onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                    onBlur={e => checkGuestHistory(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    className="hab-input"
                    style={{ width: '100%' }}
                    placeholder="Ej. cliente@correo.com"
                    value={formData.correo ?? ''}
                    onChange={e => setFormData({ ...formData, correo: e.target.value })}
                    onBlur={e => checkGuestHistory(e.target.value)}
                  />
                </div>

                {/* Empresa con autocompletado y creación al vuelo */}
                <div style={{ position: 'relative' }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Empresa / Organización (Opcional)
                  </label>
                  <input
                    type="text"
                    className="hab-input"
                    style={{ width: '100%' }}
                    placeholder="Escribe o selecciona empresa..."
                    value={companySearch ?? ''}
                    onChange={e => handleCompanySearchChange(e.target.value)}
                    onFocus={() => { if (companySuggestions.length > 0) setShowCompanyList(true); }}
                  />
                  {showCompanyList && companySuggestions.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      boxShadow: '0 8px 16px rgba(15,23,42,0.1)',
                      zIndex: 10,
                      maxHeight: 160,
                      overflowY: 'auto'
                    }}>
                      {companySuggestions.map(c => (
                        <div
                          key={c.id}
                          className="hab-company-item"
                          onClick={() => handleSelectCompany(c)}
                        >
                          🏢 {c.name || c.nombre}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: FECHAS, HABITACIÓN Y TARIFA */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={15} color="#059669" />
                <span>Estancia, Habitaciones & Cálculos Financieros</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Fecha Check-In *
                  </label>
                  <input
                    type="date"
                    className={`hab-input ${errors.fecha_check_in ? 'is-invalid' : ''}`}
                    style={{ width: '100%' }}
                    value={formData.fecha_check_in ?? ''}
                    onChange={e => handleDateChange('fecha_check_in', e.target.value)}
                  />
                  {errors.fecha_check_in && (
                    <div className="hab-field-error">
                      <AlertCircle size={12} strokeWidth={2.4} />
                      <span>{errors.fecha_check_in}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Fecha Check-Out *
                  </label>
                  <input
                    type="date"
                    className={`hab-input ${errors.fecha_check_out ? 'is-invalid' : ''}`}
                    style={{ width: '100%' }}
                    min={formData.fecha_check_in ?? ''}
                    value={formData.fecha_check_out ?? ''}
                    onChange={e => handleDateChange('fecha_check_out', e.target.value)}
                  />
                  {errors.fecha_check_out && (
                    <div className="hab-field-error">
                      <AlertCircle size={12} strokeWidth={2.4} />
                      <span>{errors.fecha_check_out}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Noches *
                  </label>
                  <input
                    type="number"
                    min="1"
                    className={`hab-input ${errors.noches ? 'is-invalid' : ''}`}
                    style={{ width: '100%' }}
                    value={formData.noches ?? ''}
                    onFocus={e => e.target.select()}
                    onChange={e => handleNochesChange(e.target.value)}
                    onBlur={handleNochesBlur}
                  />
                  {errors.noches && (
                    <div className="hab-field-error">
                      <AlertCircle size={12} strokeWidth={2.4} />
                      <span>{errors.noches}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Cant. Habitaciones *
                  </label>
                  <input
                    type="number"
                    min="1"
                    className={`hab-input ${errors.cantidad_habitaciones ? 'is-invalid' : ''}`}
                    style={{ width: '100%' }}
                    value={formData.cantidad_habitaciones ?? ''}
                    onFocus={e => e.target.select()}
                    onChange={e => handleCantidadHabitacionesChange(e.target.value)}
                    onBlur={handleCantidadHabitacionesBlur}
                  />
                  {errors.cantidad_habitaciones && (
                    <div className="hab-field-error">
                      <AlertCircle size={12} strokeWidth={2.4} />
                      <span>{errors.cantidad_habitaciones}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12, alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 20, minHeight: 20, marginBottom: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', margin: 0, lineHeight: 1 }}>
                      Tipo de Habitación
                    </label>
                  </div>
                  <select
                    className="hab-select"
                    style={{ width: '100%', height: 38 }}
                    value={formData.id_tipo_habitacion ?? ''}
                    onChange={e => handleTipoHabitacionChange(e.target.value)}
                  >
                    {(catalogos.tiposHabitacion || []).map(th => (
                      <option key={th.id} value={th.id}>
                        {th.nombre} (Q {Number(th.tarifa_base || 0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 20, minHeight: 20, marginBottom: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', margin: 0, lineHeight: 1 }}>
                      Tarifa Diaria (Q)
                    </label>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`hab-input ${errors.tarifa_diaria ? 'is-invalid' : ''}`}
                    style={{ width: '100%', height: 38 }}
                    value={formData.tarifa_diaria ?? ''}
                    onFocus={e => e.target.select()}
                    onChange={e => handleTarifaDiariaChange(e.target.value)}
                    onBlur={handleTarifaDiariaBlur}
                  />
                  {errors.tarifa_diaria && (
                    <div className="hab-field-error">
                      <AlertCircle size={12} strokeWidth={2.4} />
                      <span>{errors.tarifa_diaria}</span>
                    </div>
                  )}
                </div>

                {/* Monto Total Dinámico con opción manual */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 20, minHeight: 20, marginBottom: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', margin: 0, lineHeight: 1 }}>
                      Monto Total (Q)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const nextManual = !formData.isManualTotal;
                        const auto = (Number(formData.noches) || 1) * (Number(formData.cantidad_habitaciones) || 1) * (Number(formData.tarifa_diaria) || 0);
                        setFormData({
                          ...formData,
                          isManualTotal: nextManual,
                          monto_total: nextManual ? (formData.monto_total !== '' && !isNaN(Number(formData.monto_total)) ? Number(formData.monto_total) : auto) : auto
                        });
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        fontSize: 10,
                        fontWeight: 800,
                        lineHeight: 1,
                        color: formData.isManualTotal ? '#d97706' : '#059669',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2
                      }}
                    >
                      {formData.isManualTotal ? '✏️ Manual (Auto)' : '⚡ Auto (Editar)'}
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`hab-input hab-input-total ${formData.isManualTotal ? 'is-manual' : 'is-auto'} ${errors.monto_total ? 'is-invalid' : ''}`}
                    style={{
                      width: '100%',
                      height: 38,
                      fontSize: 14,
                      fontWeight: 800
                    }}
                    value={formData.monto_total ?? ''}
                    onFocus={e => e.target.select()}
                    onChange={e => handleMontoTotalChange(e.target.value)}
                    onBlur={handleMontoTotalBlur}
                  />
                  {errors.monto_total && (
                    <div className="hab-field-error">
                      <AlertCircle size={12} strokeWidth={2.4} />
                      <span>{errors.monto_total}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: DETALLES OPERATIVOS, FOLIO Y VENDEDOR */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={15} color="#059669" />
                <span>Control Comercial, Recepción y Folios</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    No. Folio
                  </label>
                  <input
                    type="text"
                    className="hab-input"
                    style={{ width: '100%', height: 38 }}
                    placeholder="Ej. F-10492"
                    value={formData.no_folio ?? ''}
                    onChange={e => setFormData({ ...formData, no_folio: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Vendedor Asignado
                  </label>
                  <select
                    className="hab-select"
                    style={{ width: '100%', height: 38 }}
                    value={formData.id_vendedor ?? ''}
                    onChange={e => {
                      const u = (sellers || []).find(s => String(s.id) === e.target.value);
                      setFormData({
                        ...formData,
                        id_vendedor: e.target.value,
                        vendedor_nombre: u ? u.name : ''
                      });
                    }}
                  >
                    {(sellers || []).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Medio de Contacto
                  </label>
                  <select
                    className="hab-select"
                    style={{ width: '100%', height: 38 }}
                    value={formData.id_medio_contacto ?? ''}
                    onChange={e => {
                      const m = (catalogos.mediosContacto || []).find(mc => mc.id === e.target.value);
                      setFormData({
                        ...formData,
                        id_medio_contacto: e.target.value,
                        medio_contacto_nombre: m ? m.nombre : ''
                      });
                    }}
                  >
                    {(catalogos.mediosContacto || []).map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Tipo de Cliente
                  </label>
                  <select
                    className="hab-select"
                    style={{ width: '100%', height: 38 }}
                    value={formData.id_tipo_cliente ?? ''}
                    onChange={e => {
                      const tc = (catalogos.tiposCliente || []).find(c => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        id_tipo_cliente: e.target.value,
                        tipo_cliente_nombre: tc ? tc.nombre : ''
                      });
                    }}
                  >
                    {(catalogos.tiposCliente || []).map(tc => (
                      <option key={tc.id} value={tc.id}>{tc.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Forma de Pago
                  </label>
                  <select
                    className="hab-select"
                    style={{ width: '100%', height: 38 }}
                    value={formData.id_forma_pago ?? ''}
                    onChange={e => {
                      const fp = (catalogos.formasPago || []).find(p => p.id === e.target.value);
                      setFormData({
                        ...formData,
                        id_forma_pago: e.target.value,
                        forma_pago_nombre: fp ? fp.nombre : ''
                      });
                    }}
                  >
                    {(catalogos.formasPago || []).map(fp => (
                      <option key={fp.id} value={fp.id}>{fp.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Módulo / Sector
                  </label>
                  <select
                    className="hab-select"
                    style={{ width: '100%', height: 38 }}
                    value={formData.modulo ?? ''}
                    onChange={e => setFormData({ ...formData, modulo: e.target.value })}
                  >
                    <option value="">Seleccione módulo / sector...</option>
                    {(catalogos.modulos || []).map(m => (
                      <option key={m.id} value={m.nombre}>
                        {m.nombre}
                      </option>
                    ))}
                    {formData.modulo && !(catalogos.modulos || []).some(m => m.nombre === formData.modulo) && (
                      <option value={formData.modulo}>{formData.modulo}</option>
                    )}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Observaciones Internas
                </label>
                <textarea
                  rows={2}
                  className="hab-input"
                  style={{ width: '100%', fontFamily: 'inherit' }}
                  placeholder="Notas adicionales sobre la reserva..."
                  value={formData.observaciones ?? ''}
                  onChange={e => setFormData({ ...formData, observaciones: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="hab-modal-footer">
            <button
              type="button"
              className="hab-btn-cancel"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '10px 20px',
                borderRadius: 11,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="hab-btn-submit"
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                backgroundColor: '#059669',
                color: '#ffffff',
                border: '1px solid #059669',
                borderRadius: 11,
                padding: '10px 24px',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 3px 14px rgba(5, 150, 105, 0.38)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <Check size={16} strokeWidth={2.4} />
              <span>{initialData ? 'Guardar Cambios' : 'Registrar Reserva'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
