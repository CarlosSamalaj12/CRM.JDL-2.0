import React, { useState, useEffect, useRef } from 'react';
import { Bed, Calendar, DollarSign, User, Building2, Phone, Mail, FileText, Check, X, Sparkles, Star } from 'lucide-react';
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

  // Inicialización
  useEffect(() => {
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
    if (isManual) return currentManualTotal;
    return Math.max(0, Number(noches || 1) * Number(habs || 1) * Number(tarifa || 0));
  };

  // Manejo de Fechas
  const handleDateChange = (field, val) => {
    const updated = { ...formData, [field]: val };
    const inD = field === 'fecha_check_in' ? val : formData.fecha_check_in;
    const outD = field === 'fecha_check_out' ? val : formData.fecha_check_out;

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nombre_huesped.trim()) {
      toast.error('El nombre del huésped es obligatorio');
      return;
    }
    if (!formData.fecha_check_in || !formData.fecha_check_out) {
      toast.error('Las fechas de check-in y check-out son obligatorias');
      return;
    }

    onSave(formData);
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
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                    className="hab-input"
                    style={{ width: '100%' }}
                    placeholder="Ej. Juan Pérez"
                    value={formData.nombre_huesped ?? ''}
                    onChange={e => setFormData({ ...formData, nombre_huesped: e.target.value })}
                    required
                  />
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
                    className="hab-input"
                    style={{ width: '100%' }}
                    value={formData.fecha_check_in ?? ''}
                    onChange={e => handleDateChange('fecha_check_in', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Fecha Check-Out *
                  </label>
                  <input
                    type="date"
                    className="hab-input"
                    style={{ width: '100%' }}
                    min={formData.fecha_check_in ?? ''}
                    value={formData.fecha_check_out ?? ''}
                    onChange={e => handleDateChange('fecha_check_out', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Noches
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="hab-input"
                    style={{ width: '100%' }}
                    value={formData.noches ?? 1}
                    onChange={e => {
                      const n = Math.max(1, parseInt(e.target.value) || 1);
                      const updated = { ...formData, noches: n };
                      updated.monto_total = recalculateTotal(n, updated.cantidad_habitaciones, updated.tarifa_diaria, updated.isManualTotal, updated.monto_total);
                      setFormData(updated);
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Cant. Habitaciones
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="hab-input"
                    style={{ width: '100%' }}
                    value={formData.cantidad_habitaciones ?? 1}
                    onChange={e => {
                      const c = Math.max(1, parseInt(e.target.value) || 1);
                      const updated = { ...formData, cantidad_habitaciones: c };
                      updated.monto_total = recalculateTotal(updated.noches, c, updated.tarifa_diaria, updated.isManualTotal, updated.monto_total);
                      setFormData(updated);
                    }}
                  />
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
                    className="hab-input"
                    style={{ width: '100%', height: 38 }}
                    value={formData.tarifa_diaria ?? 0}
                    onChange={e => {
                      const t = parseFloat(e.target.value) || 0;
                      const updated = { ...formData, tarifa_diaria: t };
                      updated.monto_total = recalculateTotal(updated.noches, updated.cantidad_habitaciones, t, updated.isManualTotal, updated.monto_total);
                      setFormData(updated);
                    }}
                  />
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
                        const auto = (formData.noches || 1) * (formData.cantidad_habitaciones || 1) * (formData.tarifa_diaria || 0);
                        setFormData({
                          ...formData,
                          isManualTotal: nextManual,
                          monto_total: nextManual ? (formData.monto_total ?? auto) : auto
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
                    className={`hab-input hab-input-total ${formData.isManualTotal ? 'is-manual' : 'is-auto'}`}
                    style={{
                      width: '100%',
                      height: 38,
                      fontSize: 14,
                      fontWeight: 800
                    }}
                    value={formData.monto_total ?? 0}
                    onChange={e => {
                      setFormData({
                        ...formData,
                        monto_total: parseFloat(e.target.value) || 0,
                        isManualTotal: true
                      });
                    }}
                  />
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
