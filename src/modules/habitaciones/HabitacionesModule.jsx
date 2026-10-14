import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bed,
  Plus,
  Search,
  Calendar,
  User,
  Phone,
  Mail,
  DollarSign,
  TrendingUp,
  MessageSquare,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  Star,
  FileSpreadsheet,
  X,
  SlidersHorizontal,
  PieChart,
  Building2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Check,
  ExternalLink,
  ChevronDown,
  Megaphone
} from 'lucide-react';
import {
  getHabitacionesApi,
  createHabitacionApi,
  updateHabitacionApi,
  deleteHabitacionApi,
  getCatalogosHabitacionesApi
} from '../../services/habitacionesService';
import { loadState } from '../../services/stateService';
import socketService from '../../services/socketService';
import authService from '../../services/authService';
import { toast } from '../../utils/toast';
import HabitacionModal from './HabitacionModal';
import HabitacionContactModal from './HabitacionContactModal';
import HabitacionCampanaModal from './HabitacionCampanaModal';
import './habitaciones.css';

// Generador armónico de iniciales y paleta para avatar
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'H';
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

function formatTimeAMPM(d = new Date()) {
  const hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `Hoy, ${h12}:${mins} ${ampm}`;
}

export default function HabitacionesModule() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({
    totalReservas: 0,
    totalNoches: 0,
    totalHabitaciones: 0,
    totalMonto: 0
  });

  // Socket.IO & Sync
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(() => formatTimeAMPM());

  // Filtros de barra principal
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [filterMes, setFilterMes] = useState(currentMonth);
  const [filterVendedor, setFilterVendedor] = useState('');
  const [filterTipoHab, setFilterTipoHab] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtros avanzados (Modal emergente)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');
  const [filterModulo, setFilterModulo] = useState('');
  const [filterFormaPago, setFilterFormaPago] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterSegmento, setFilterSegmento] = useState('');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Catálogos y datos auxiliares
  const [catalogos, setCatalogos] = useState({
    mediosContacto: [],
    tiposHabitacion: [],
    tiposCliente: [],
    formasPago: [],
    plantillas: [],
    modulos: []
  });
  const [sellers, setSellers] = useState([]);
  const [companies, setCompanies] = useState([]);

  // Modales de Reserva, Contacto y Campaña de Marketing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReserva, setEditingReserva] = useState(null);

  const [isContactOpen, setIsContactOpen] = useState(false);
  const [contactReserva, setContactReserva] = useState(null);
  const [contactMedium, setContactMedium] = useState('whatsapp');

  const [isCampanaModalOpen, setIsCampanaModalOpen] = useState(false);

  const [cancelModal, setCancelModal] = useState({
    isOpen: false,
    reserva: null,
    loading: false
  });

  // Carga inicial de datos auxiliares
  useEffect(() => {
    loadAuxData();
  }, []);

  // Sincronización en Tiempo Real con Socket.IO
  useEffect(() => {
    socketService.connect();
    setIsLiveConnected(Boolean(socketService.socket?.connected));

    const handleConnect = () => setIsLiveConnected(true);
    const handleDisconnect = () => setIsLiveConnected(false);

    const handleEntityChange = (payload) => {
      if (payload?.entity === 'habitaciones' || payload?.entity === 'habitacion_catalogos') {
        fetchReservas();
        loadAuxData();
        setLastSyncTime(formatTimeAMPM());
      }
    };

    const handleStateUpdated = (payload) => {
      if (!payload?.entity || payload.entity === 'habitaciones') {
        fetchReservas();
        setLastSyncTime(formatTimeAMPM());
      }
    };

    const unsubConnect = socketService.on('connect', handleConnect);
    const unsubDisconnect = socketService.on('disconnect', handleDisconnect);
    const unsubEntity = socketService.on('entity:changed', handleEntityChange);
    const unsubState = socketService.on('state-updated', handleStateUpdated);

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubEntity();
      unsubState();
    };
  }, []);

  // Carga de reservas filtradas
  const fetchReservas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getHabitacionesApi({
        mes: filterMes || undefined,
        vendedor: filterVendedor || undefined,
        tipo_habitacion: filterTipoHab || undefined,
        estado: filterEstado || undefined,
        desde: filterDesde || undefined,
        hasta: filterHasta || undefined,
        search: searchQuery.trim() || undefined
      });
      setReservas(res?.reservas || []);
      setMetricas(res?.metricas || {
        totalReservas: 0,
        totalNoches: 0,
        totalHabitaciones: 0,
        totalMonto: 0
      });
      setLastSyncTime(formatTimeAMPM());
    } catch (err) {
      console.error('Error cargando reservas de habitaciones:', err);
      toast.error('Error al consultar reservas de habitaciones');
    } finally {
      setLoading(false);
    }
  }, [filterMes, filterVendedor, filterTipoHab, filterEstado, filterDesde, filterHasta, searchQuery]);

  useEffect(() => {
    fetchReservas();
  }, [fetchReservas]);

  // Restablecer a página 1 al cambiar filtros o búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMes, filterVendedor, filterTipoHab, filterEstado, filterDesde, filterHasta, filterModulo, filterFormaPago, filterEmpresa, searchQuery]);

  const loadAuxData = async () => {
    try {
      const [medios, tiposH, tiposC, formasP, plantillas, modulosData, stateData] = await Promise.all([
        getCatalogosHabitacionesApi('medios_contacto').catch(() => []),
        getCatalogosHabitacionesApi('tipos_habitacion').catch(() => []),
        getCatalogosHabitacionesApi('tipos_cliente').catch(() => []),
        getCatalogosHabitacionesApi('formas_pago').catch(() => []),
        getCatalogosHabitacionesApi('plantillas').catch(() => []),
        getCatalogosHabitacionesApi('modulos').catch(() => []),
        loadState().catch(() => ({}))
      ]);

      setCatalogos({
        mediosContacto: Array.isArray(medios) ? medios : [],
        tiposHabitacion: Array.isArray(tiposH) ? tiposH : [],
        tiposCliente: Array.isArray(tiposC) ? tiposC : [],
        formasPago: Array.isArray(formasP) ? formasP : [],
        plantillas: Array.isArray(plantillas) ? plantillas : [],
        modulos: Array.isArray(modulosData) ? modulosData : []
      });

      const users = (stateData?.users || []).filter(u => {
        const r = String(u.role || '').toLowerCase();
        return r === 'vendedor' || r === 'admin' || r === 'recepcionista';
      });
      setSellers(users);
      setCompanies(stateData?.companies || []);
    } catch (err) {
      console.warn('Error cargando catálogos auxiliares:', err);
    }
  };

  // Filtrado en memoria de filtros avanzados adicionales (módulo, forma de pago, empresa, segmento)
  const reservasFiltradas = useMemo(() => {
    return reservas.filter(r => {
      if (filterModulo && (r.modulo !== filterModulo && r.modulo !== filterModulo)) return false;
      if (filterFormaPago && (r.id_forma_pago !== filterFormaPago && r.forma_pago_nombre !== filterFormaPago)) return false;
      if (filterEmpresa) {
        if (filterEmpresa === 'particular' && r.empresa_nombre) return false;
        if (filterEmpresa !== 'particular' && r.id_empresa !== filterEmpresa && r.empresa_nombre !== filterEmpresa) return false;
      }
      if (filterSegmento && (r.id_tipo_cliente !== filterSegmento && r.tipo_cliente_nombre !== filterSegmento)) return false;
      return true;
    });
  }, [reservas, filterModulo, filterFormaPago, filterEmpresa, filterSegmento]);

  // Contadores de estado para leyenda superior
  const estadoStats = useMemo(() => {
    let confirmadas = 0;
    let enCasa = 0;
    let completadas = 0;
    reservasFiltradas.forEach(r => {
      const st = String(r.estado || 'Confirmada').toLowerCase();
      if (st.includes('confirmada')) confirmadas++;
      else if (st.includes('casa') || st.includes('check-in')) enCasa++;
      else if (st.includes('completada') || st.includes('check-out')) completadas++;
    });
    return { confirmadas, enCasa, completadas };
  }, [reservasFiltradas]);

  // Paginación
  const totalItems = reservasFiltradas.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedReservas = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return reservasFiltradas.slice(start, start + pageSize);
  }, [reservasFiltradas, currentPage, pageSize]);

  // Huéspedes frecuentes (Directorio VIP)
  const huespedesFrecuentesCount = useMemo(() => {
    const guestMap = new Map();
    reservas.forEach(r => {
      const key = (r.telefono || r.correo || r.nombre_huesped || '').trim().toLowerCase();
      if (key) guestMap.set(key, (guestMap.get(key) || 0) + 1);
    });
    let count = 0;
    guestMap.forEach(times => {
      if (times > 1) count++;
    });
    return count;
  }, [reservas]);

  // Suites vendidas
  const suitesCount = useMemo(() => {
    return reservas.filter(r => String(r.tipo_habitacion_nombre || '').toLowerCase().includes('suite')).length;
  }, [reservas]);

  // Cálculos de Tasa de Ocupación (Capacidad estándar: 24 habitaciones)
  const metricasAvanzadas = useMemo(() => {
    let diasEnMes = 30;
    if (filterMes) {
      const [y, m] = filterMes.split('-').map(Number);
      if (y && m) diasEnMes = new Date(y, m, 0).getDate();
    }
    const capacidadInstaladaTotal = 24 * diasEnMes;
    const nochesVendidas = Number(metricas.totalNoches || 0);
    const tasaOcupacion = Math.min(100, (nochesVendidas / Math.max(1, capacidadInstaladaTotal)) * 100);
    const adr = nochesVendidas > 0 ? Number(metricas.totalMonto || 0) / nochesVendidas : 0;
    const metaMonto = 50000;
    const porcentajeMeta = Math.min(100, Math.round((Number(metricas.totalMonto || 0) / metaMonto) * 100));

    return {
      tasaOcupacion: tasaOcupacion.toFixed(1),
      adr: adr.toFixed(2),
      porcentajeMeta: Math.max(12, porcentajeMeta)
    };
  }, [metricas, filterMes]);

  // Contador de filtros avanzados activos
  const activeAdvancedFiltersCount = useMemo(() => {
    let cnt = 0;
    if (filterDesde) cnt++;
    if (filterHasta) cnt++;
    if (filterModulo) cnt++;
    if (filterFormaPago) cnt++;
    if (filterEmpresa) cnt++;
    if (filterSegmento) cnt++;
    return cnt;
  }, [filterDesde, filterHasta, filterModulo, filterFormaPago, filterEmpresa, filterSegmento]);

  // Manejo de Modales
  const handleOpenCreate = () => {
    setEditingReserva(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (reserva) => {
    setEditingReserva(reserva);
    setIsModalOpen(true);
  };

  const handleSaveReserva = async (formData) => {
    try {
      if (editingReserva?.id) {
        await updateHabitacionApi(editingReserva.id, formData);
        toast.success('Reserva actualizada exitosamente ✓');
      } else {
        await createHabitacionApi(formData);
        toast.success('Reserva de habitación registrada exitosamente ✓');
      }
      setIsModalOpen(false);
      fetchReservas();
    } catch (err) {
      console.error('Error guardando reserva:', err);
      toast.error('Error al guardar reserva: ' + (err.message || ''));
    }
  };

  const handleOpenCancelModal = (reserva) => {
    setCancelModal({
      isOpen: true,
      reserva,
      loading: false
    });
  };

  const handleCloseCancelModal = () => {
    if (cancelModal.loading) return;
    setCancelModal({ isOpen: false, reserva: null, loading: false });
  };

  const handleConfirmCancelReserva = async () => {
    if (!cancelModal.reserva) return;
    setCancelModal(prev => ({ ...prev, loading: true }));
    try {
      await deleteHabitacionApi(cancelModal.reserva.id);
      toast.success('Reserva cancelada exitosamente');
      handleCloseCancelModal();
      fetchReservas();
    } catch (err) {
      console.error('Error cancelando reserva:', err);
      toast.error('Error al cancelar reserva: ' + (err.message || ''));
      setCancelModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleOpenContact = (reserva, med) => {
    setContactReserva(reserva);
    setContactMedium(med);
    setIsContactOpen(true);
  };

  // Exportar a Excel
  const handleExportExcel = async () => {
    if (reservasFiltradas.length === 0) {
      toast.error('No hay reservas para exportar');
      return;
    }

    try {
      const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Reservas de Habitaciones');

      worksheet.columns = [
        { header: 'No. Folio', key: 'no_folio', width: 16 },
        { header: 'Huésped', key: 'nombre_huesped', width: 26 },
        { header: 'Teléfono', key: 'telefono', width: 16 },
        { header: 'Correo', key: 'correo', width: 24 },
        { header: 'Empresa', key: 'empresa_nombre', width: 22 },
        { header: 'Check-In', key: 'fecha_check_in', width: 14 },
        { header: 'Check-Out', key: 'fecha_check_out', width: 14 },
        { header: 'Noches', key: 'noches', width: 10 },
        { header: 'Habitaciones', key: 'cantidad_habitaciones', width: 14 },
        { header: 'Tipo Habitación', key: 'tipo_habitacion_nombre', width: 22 },
        { header: 'Módulo', key: 'modulo', width: 16 },
        { header: 'Tarifa Diaria (Q)', key: 'tarifa_diaria', width: 16 },
        { header: 'Total (Q)', key: 'monto_total', width: 16 },
        { header: 'Forma de Pago', key: 'forma_pago_nombre', width: 20 },
        { header: 'Vendedor', key: 'vendedor_nombre', width: 20 },
        { header: 'Medio Contacto', key: 'medio_contacto_nombre', width: 20 },
        { header: 'Estado', key: 'estado', width: 14 },
        { header: 'Último Contacto', key: 'ultimo_contacto', width: 20 }
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF059669' }
      };

      reservasFiltradas.forEach(r => {
        worksheet.addRow({
          no_folio: r.no_folio || '—',
          nombre_huesped: r.nombre_huesped,
          telefono: r.telefono || '—',
          correo: r.correo || '—',
          empresa_nombre: r.empresa_nombre || '—',
          fecha_check_in: r.fecha_check_in,
          fecha_check_out: r.fecha_check_out,
          noches: r.noches,
          cantidad_habitaciones: r.cantidad_habitaciones,
          tipo_habitacion_nombre: r.tipo_habitacion_nombre || '—',
          modulo: r.modulo || '—',
          tarifa_diaria: Number(r.tarifa_diaria || 0),
          monto_total: Number(r.monto_total || 0),
          forma_pago_nombre: r.forma_pago_nombre || '—',
          vendedor_nombre: r.vendedor_nombre || '—',
          medio_contacto_nombre: r.medio_contacto_nombre || '—',
          estado: r.estado || 'Confirmada',
          ultimo_contacto: r.ultimo_contacto ? new Date(r.ultimo_contacto).toLocaleString() : '—'
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reservas_Habitaciones_${filterMes || 'general'}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Archivo Excel exportado exitosamente');
    } catch (err) {
      console.error('Error exportando Excel:', err);
      toast.error('Error al generar archivo Excel');
    }
  };

  // Formato de nombre de mes para paginador
  const nombreMesAno = useMemo(() => {
    if (!filterMes) return 'período actual';
    const [y, m] = filterMes.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleString('es-GT', { month: 'long', year: 'numeric' });
  }, [filterMes]);

  return (
    <div className="hab-container">
      {/* ─────────────────────────────────────────────────────────────
          1. Header Institucional con Estado En Vivo
          ───────────────────────────────────────────────────────────── */}
      <div className="hab-header">
        <div className="hab-brand-box">
          <div className="hab-brand-icon">
            <Bed size={26} strokeWidth={2.4} />
          </div>
          <div className="hab-brand-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 className="hab-brand-title">Registro comercial y financiero de hospedaje</h1>
              <span className="hab-sync-badge" title="Sincronización en tiempo real con Socket.IO">
                <span className="hab-sync-dot" />
                <span>{isLiveConnected ? 'En Vivo · Sincronizado' : 'Conectado a Socket'}</span>
              </span>
            </div>
            <p className="hab-brand-sub">
              Check-in, tarifas en tiempo real y seguimiento detallado de huéspedes e ingresos diarios.
            </p>
          </div>
        </div>

        <div className="hab-header-right">
          <div className="hab-last-update">
            <Clock size={13} strokeWidth={2.2} />
            <span>Última actualización: {lastSyncTime}</span>
          </div>

          <div className="hab-header-actions">
            <button
              type="button"
              className="hab-btn-campana"
              onClick={() => setIsCampanaModalOpen(true)}
              title="Lanzar ofertas y promociones segmentadas por sector a clientes y empresas"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
                backgroundColor: '#7c3aed',
                color: '#ffffff',
                border: '1px solid #6d28d9',
                boxShadow: '0 3px 12px rgba(124, 58, 237, 0.32)'
              }}
            >
              <Megaphone size={16} strokeWidth={2.4} />
              <span className="hab-btn-label-desktop">Lanzar Promoción</span>
              <span className="hab-btn-label-mobile">Promoción</span>
            </button>

            <button
              type="button"
              className="hab-btn-excel"
              onClick={handleExportExcel}
              title="Exportar listado a hoja de cálculo Excel"
              style={{
                background: 'linear-gradient(135deg, #107c41 0%, #059669 100%)',
                backgroundColor: '#107c41',
                color: '#ffffff',
                border: '1px solid #0f723c',
                boxShadow: '0 3px 10px rgba(16, 124, 65, 0.3)'
              }}
            >
              <FileSpreadsheet size={16} strokeWidth={2.4} />
              <span>Exportar a Excel</span>
            </button>

            <button
              type="button"
              className="hab-btn-primary"
              onClick={handleOpenCreate}
              title="Registrar una nueva reserva de habitación"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: '1px solid #0284c7',
                boxShadow: '0 3px 12px rgba(2, 132, 199, 0.35)'
              }}
            >
              <Plus size={16} strokeWidth={2.6} />
              <span className="hab-btn-label-desktop">Nueva Reserva de Habitación</span>
              <span className="hab-btn-label-mobile">Nueva Reserva</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. 5 Tarjetas KPI Bento Superiores
          ───────────────────────────────────────────────────────────── */}
      <div className="hab-kpi-grid-5">
        {/* KPI 1: Ingresos de Habitaciones */}
        <div className="hab-kpi-card-bento">
          <div className="hab-kpi-card-top">
            <div className="hab-kpi-icon emerald" style={{ width: 38, height: 38, borderRadius: 10 }}>
              <DollarSign size={20} strokeWidth={2.5} />
            </div>
            <span className="hab-kpi-pill-badge green">
              <TrendingUp size={11} strokeWidth={2.6} />
              +14.2%
            </span>
          </div>
          <div>
            <div className="hab-kpi-label-bento">Ingresos de Habitaciones</div>
            <div className="hab-kpi-val-bento">
              Q {Number(metricas.totalMonto || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="hab-kpi-sub-bento">
              <span>Total facturado en el período</span>
              <span style={{ fontWeight: 800, color: '#059669' }}>Meta: {metricasAvanzadas.porcentajeMeta}%</span>
            </div>
            <div className="hab-kpi-progress-track">
              <div
                className="hab-kpi-progress-bar"
                style={{ width: `${metricasAvanzadas.porcentajeMeta}%`, background: 'linear-gradient(90deg, #059669, #10b981)' }}
              />
            </div>
          </div>
        </div>

        {/* KPI 2: Habitaciones Vendidas */}
        <div className="hab-kpi-card-bento">
          <div className="hab-kpi-card-top">
            <div className="hab-kpi-icon blue" style={{ width: 38, height: 38, borderRadius: 10 }}>
              <Bed size={20} strokeWidth={2.5} />
            </div>
            <span className="hab-kpi-pill-badge blue">
              100% Confirmado
            </span>
          </div>
          <div>
            <div className="hab-kpi-label-bento">Habitaciones Vendidas</div>
            <div className="hab-kpi-val-bento">{metricas.totalHabitaciones}</div>
            <div className="hab-kpi-sub-bento">
              <span>{metricas.totalReservas} reserva(s) registradas</span>
              <span style={{ fontWeight: 800, color: '#2563eb' }}>{suitesCount} Suites</span>
            </div>
            <div className="hab-kpi-progress-track">
              <div
                className="hab-kpi-progress-bar"
                style={{ width: `${Math.min(100, (metricas.totalHabitaciones / 24) * 100)}%`, background: 'linear-gradient(90deg, #2563eb, #38bdf8)' }}
              />
            </div>
          </div>
        </div>

        {/* KPI 3: Total Noches Vendidas */}
        <div className="hab-kpi-card-bento">
          <div className="hab-kpi-card-top">
            <div className="hab-kpi-icon purple" style={{ width: 38, height: 38, borderRadius: 10 }}>
              <Calendar size={20} strokeWidth={2.5} />
            </div>
            <span className="hab-kpi-pill-badge purple">
              {metricas.totalNoches > 3 ? 'Estancia Media' : 'Estancia Corta'}
            </span>
          </div>
          <div>
            <div className="hab-kpi-label-bento">Total Noches Vendidas</div>
            <div className="hab-kpi-val-bento">{metricas.totalNoches}</div>
            <div className="hab-kpi-sub-bento">
              <span>Ticket prom: Q {metricas.totalNoches > 0 ? (metricas.totalMonto / metricas.totalNoches).toFixed(2) : '0.00'} / noche</span>
            </div>
            <div className="hab-kpi-progress-track">
              <div
                className="hab-kpi-progress-bar"
                style={{ width: `${Math.min(100, metricas.totalNoches * 4)}%`, background: 'linear-gradient(90deg, #7c3aed, #a855f7)' }}
              />
            </div>
          </div>
        </div>

        {/* KPI 4: Huéspedes Recurrentes */}
        <div className="hab-kpi-card-bento">
          <div className="hab-kpi-card-top">
            <div className="hab-kpi-icon amber" style={{ width: 38, height: 38, borderRadius: 10 }}>
              <Star size={20} strokeWidth={2.5} />
            </div>
            <span className="hab-kpi-pill-badge amber">
              Directorio VIP
            </span>
          </div>
          <div>
            <div className="hab-kpi-label-bento">Huéspedes Recurrentes</div>
            <div className="hab-kpi-val-bento">{huespedesFrecuentesCount}</div>
            <div className="hab-kpi-sub-bento">
              <span>Detectados por directorio inteligente</span>
            </div>
            <div className="hab-kpi-progress-track">
              <div
                className="hab-kpi-progress-bar"
                style={{ width: `${Math.min(100, huespedesFrecuentesCount * 25)}%`, background: 'linear-gradient(90deg, #d97706, #f59e0b)' }}
              />
            </div>
          </div>
        </div>

        {/* KPI 5: Tasa de Ocupación */}
        <div className="hab-kpi-card-bento">
          <div className="hab-kpi-card-top">
            <div className="hab-kpi-icon" style={{ width: 38, height: 38, borderRadius: 10, background: '#ecfeff', color: '#0891b2' }}>
              <PieChart size={20} strokeWidth={2.5} />
            </div>
            <span className="hab-kpi-pill-badge cyan">
              Capacidad: 24 Hab
            </span>
          </div>
          <div>
            <div className="hab-kpi-label-bento">Tasa de Ocupación</div>
            <div className="hab-kpi-val-bento">{metricasAvanzadas.tasaOcupacion}%</div>
            <div className="hab-kpi-sub-bento">
              <span>ADR: Q {metricasAvanzadas.adr} / hab</span>
            </div>
            <div className="hab-kpi-progress-track">
              <div
                className="hab-kpi-progress-bar"
                style={{ width: `${metricasAvanzadas.tasaOcupacion}%`, background: 'linear-gradient(90deg, #0891b2, #06b6d4)' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. Barra de Filtros y Búsqueda (Sin Botón Restablecer)
          ───────────────────────────────────────────────────────────── */}
      <div className="hab-filters-container">
        <div className="hab-filters-shelf">
          {/* Período */}
          <div className="hab-filter-item">
            <label className="hab-filter-label">Período de Análisis</label>
            <div className="hab-month-picker-wrap">
              <Calendar size={15} color="#059669" strokeWidth={2.4} style={{ flexShrink: 0 }} />
              <span className="hab-month-picker-text">
                {nombreMesAno.charAt(0).toUpperCase() + nombreMesAno.slice(1)}
              </span>
              <ChevronDown size={14} color="#64748b" style={{ marginLeft: 'auto', flexShrink: 0 }} />
              <input
                type="month"
                className="hab-month-native-input"
                value={filterMes}
                onChange={e => setFilterMes(e.target.value)}
                title="Seleccionar mes y año"
              />
            </div>
          </div>

          {/* Vendedor */}
          <div className="hab-filter-item">
            <label className="hab-filter-label">Vendedor</label>
            <select
              className="hab-select"
              value={filterVendedor}
              onChange={e => setFilterVendedor(e.target.value)}
              style={{ height: 38, fontSize: 13, fontWeight: 600 }}
            >
              <option value="">Todos los Vendedores</option>
              {sellers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Tipo de Habitación */}
          <div className="hab-filter-item">
            <label className="hab-filter-label">Tipo de Habitación</label>
            <select
              className="hab-select"
              value={filterTipoHab}
              onChange={e => setFilterTipoHab(e.target.value)}
              style={{ height: 38, fontSize: 13, fontWeight: 600 }}
            >
              <option value="">Todos los Tipos</option>
              {(catalogos.tiposHabitacion || []).map(th => (
                <option key={th.id} value={th.id}>{th.nombre}</option>
              ))}
            </select>
          </div>

          {/* Estado de Reserva */}
          <div className="hab-filter-item">
            <label className="hab-filter-label">Estado de Reserva</label>
            <select
              className="hab-select"
              value={filterEstado}
              onChange={e => setFilterEstado(e.target.value)}
              style={{ height: 38, fontSize: 13, fontWeight: 600 }}
            >
              <option value="">Todos los Estados</option>
              <option value="Confirmada">Confirmada</option>
              <option value="En Casa">En Casa (Check-in)</option>
              <option value="Completada">Completada (Check-out)</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </div>

          {/* Botón Filtros Avanzados */}
          <div className="hab-filter-item" style={{ alignSelf: 'flex-end' }}>
            <button
              type="button"
              className="hab-btn-filter-trigger"
              onClick={() => setIsFilterModalOpen(true)}
              title="Abrir filtros avanzados"
            >
              <SlidersHorizontal size={14} strokeWidth={2.4} />
              <span>Filtros</span>
              {activeAdvancedFiltersCount > 0 && (
                <span style={{
                  background: '#059669',
                  color: '#ffffff',
                  fontSize: 10,
                  fontWeight: 800,
                  borderRadius: '50%',
                  width: 17,
                  height: 17,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 2
                }}>
                  {activeAdvancedFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Buscador de Ancho Completo */}
        <div className="hab-search-wrap" style={{ width: '100%' }}>
          <input
            type="text"
            className="hab-input hab-search-input"
            placeholder="Buscar por huésped, folio, empresa o teléfono..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              backgroundColor: '#ffffff',
              color: '#0f172a',
              paddingLeft: 46,
              height: 40,
              fontSize: 13
            }}
          />
          <span className="hab-search-icon" style={{ left: 16 }}>
            <Search size={16} strokeWidth={2.4} />
          </span>
          {searchQuery && (
            <button
              type="button"
              className="hab-search-clear"
              onClick={() => setSearchQuery('')}
              title="Limpiar búsqueda"
            >
              <X size={14} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. Tabla Desktop Ejecutiva con Colores Bento
          ───────────────────────────────────────────────────────────── */}
      <div className="hab-table-card">
        {/* Cabecera de la Tarjeta */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid #f1f5f9',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Listado de Reservas y Ventas
            </h2>
            <span style={{
              background: '#e0f2fe',
              color: '#0369a1',
              padding: '3px 9px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 800
            }}>
              {reservasFiltradas.length} activas en pantalla
            </span>
          </div>

          {/* Leyenda de Estados */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, fontWeight: 700 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#059669' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
              {estadoStats.confirmadas} Confirmadas
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563eb' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />
              {estadoStats.enCasa} En Casa
            </span>
            {estadoStats.completadas > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#7c3aed' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed' }} />
                {estadoStats.completadas} Completadas
              </span>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div className="hab-table-wrap">
          <table className="hab-table">
            <thead>
              <tr>
                <th>No. Folio</th>
                <th>Huésped & Contacto</th>
                <th>Empresa</th>
                <th>Fechas (In / Out)</th>
                <th>Habitación</th>
                <th>Vendedor & Canal</th>
                <th>Total / Pago</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                    Cargando reservas de habitaciones...
                  </td>
                </tr>
              ) : paginatedReservas.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 44, color: '#94a3b8' }}>
                    No se encontraron reservas con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedReservas.map(r => {
                  const palette = getAvatarPalette(r.nombre_huesped);
                  const isRecurrente = (r.telefono && reservas.filter(x => x.telefono === r.telefono).length > 1);
                  const st = String(r.estado || 'Confirmada').toLowerCase();

                  return (
                    <tr key={r.id}>
                      {/* No. Folio */}
                      <td>
                        <span className="hab-folio-pill">
                          #{r.no_folio || r.id.substring(4, 9)}
                        </span>
                      </td>

                      {/* Huésped & Contacto */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            className="hab-avatar"
                            style={{
                              background: palette.bg,
                              color: palette.text,
                              borderColor: palette.border
                            }}
                          >
                            {getInitials(r.nombre_huesped)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{r.nombre_huesped}</span>
                              {isRecurrente && (
                                <span style={{
                                  background: '#fffbeb',
                                  color: '#d97706',
                                  border: '1px solid #fde68a',
                                  fontSize: 9,
                                  fontWeight: 800,
                                  padding: '1px 5px',
                                  borderRadius: 5
                                }}>
                                  VIP
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                              {r.telefono && (
                                <a
                                  href={`tel:${r.telefono}`}
                                  style={{ color: '#64748b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                                >
                                  <Phone size={11} />
                                  <span>{r.telefono}</span>
                                </a>
                              )}
                              {r.correo && (
                                <a
                                  href={`mailto:${r.correo}`}
                                  style={{ color: '#64748b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                                >
                                  <Mail size={11} />
                                  <span>{r.correo}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Empresa */}
                      <td>
                        {r.empresa_nombre ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: '#f5f3ff',
                            color: '#7c3aed',
                            border: '1px solid #ddd6fe',
                            padding: '3px 8px',
                            borderRadius: 7,
                            fontSize: 11,
                            fontWeight: 800
                          }}>
                            {r.empresa_nombre}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#f8fafc',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                            padding: '3px 8px',
                            borderRadius: 7,
                            fontSize: 11,
                            fontWeight: 700
                          }}>
                            Particular
                          </span>
                        )}
                      </td>

                      {/* Fechas (In / Out) */}
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span>{r.fecha_check_in}</span>
                          <ArrowRight size={12} color="#94a3b8" />
                          <span>{r.fecha_check_out}</span>
                        </div>
                        <div style={{ marginTop: 3 }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: '#ecfdf5',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                            padding: '2px 7px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 800
                          }}>
                            {r.noches} noche(s)
                          </span>
                        </div>
                      </td>

                      {/* Habitación */}
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Bed size={14} color="#0284c7" />
                          <span>{r.cantidad_habitaciones}x {r.tipo_habitacion_nombre || 'Habitación'}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {r.modulo || 'Hotel Principal'}
                        </div>
                      </td>

                      {/* Vendedor & Canal */}
                      <td>
                        <div style={{ fontWeight: 800, color: '#1e293b' }}>
                          {r.vendedor_nombre || 'Sin asignar'}
                        </div>
                        <div style={{ marginTop: 2 }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            padding: '2px 7px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 700
                          }}>
                            {r.medio_contacto_nombre || 'Recepción Directa'}
                          </span>
                        </div>
                      </td>

                      {/* Total / Pago */}
                      <td>
                        <div style={{ fontWeight: 900, color: '#059669', fontSize: 14 }}>
                          Q {Number(r.monto_total || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ marginTop: 2 }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            padding: '2px 7px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 700
                          }}>
                            {r.forma_pago_nombre || 'Efectivo'}
                          </span>
                        </div>
                      </td>

                      {/* Acciones Bento */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div className="hab-action-group">
                          {/* WhatsApp */}
                          <button
                            type="button"
                            className="hab-action-btn whatsapp"
                            title="Enviar WhatsApp al huésped"
                            onClick={() => handleOpenContact(r, 'whatsapp')}
                          >
                            <MessageSquare size={15} strokeWidth={2.4} />
                          </button>

                          {/* Correo */}
                          <button
                            type="button"
                            className="hab-action-btn email"
                            title="Enviar Correo Electrónico"
                            onClick={() => handleOpenContact(r, 'email')}
                          >
                            <Mail size={15} strokeWidth={2.4} />
                          </button>

                          {/* Editar */}
                          <button
                            type="button"
                            className="hab-action-btn edit"
                            title="Editar detalles de la reserva"
                            onClick={() => handleOpenEdit(r)}
                          >
                            <Edit2 size={14} strokeWidth={2.4} />
                          </button>

                          {/* Cancelar / Eliminar */}
                          <button
                            type="button"
                            className="hab-action-btn delete"
                            title="Cancelar o eliminar reserva"
                            onClick={() => handleOpenCancelModal(r)}
                          >
                            <Trash2 size={14} strokeWidth={2.4} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Barra de Paginación Numérica */}
        {totalItems > 0 && (
          <div className="hab-pagination-container">
            <div className="hab-pagination-info">
              Mostrando {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalItems)} de {totalItems} reservas registradas en {nombreMesAno}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Selector de Tamaño */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
                <span>Mostrar:</span>
                <select
                  className="hab-select"
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{ height: 30, padding: '0 8px', fontSize: 12 }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Botones Numéricos */}
              <div className="hab-pagination-nav">
                <button
                  type="button"
                  className="hab-page-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  title="Página anterior"
                >
                  <ChevronLeft size={14} />
                </button>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const pNum = i + 1;
                  // Si hay muchas páginas, mostrar sólo las relevantes
                  if (totalPages > 7) {
                    if (pNum !== 1 && pNum !== totalPages && Math.abs(pNum - currentPage) > 1) {
                      if (pNum === 2 || pNum === totalPages - 1) {
                        return <span key={pNum} style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>;
                      }
                      return null;
                    }
                  }

                  return (
                    <button
                      key={pNum}
                      type="button"
                      className={`hab-page-btn ${currentPage === pNum ? 'active' : ''}`}
                      onClick={() => setCurrentPage(pNum)}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className="hab-page-btn"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  title="Página siguiente"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. Vista Móvil Automática (< 768px): Bento Folios Activos
          ───────────────────────────────────────────────────────────── */}
      <div className="hab-mobile-folios-card">
        <div className="hab-mobile-header-box">
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Folios Activos
            </h2>
            <span style={{ fontSize: 11, color: '#64748b' }}>Ordenado por fecha · {reservasFiltradas.length} reservas</span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <span className="hab-status-pill confirmada">
              {estadoStats.confirmadas} Conf.
            </span>
            <span className="hab-status-pill encasa">
              {estadoStats.enCasa} En Casa
            </span>
          </div>
        </div>

        {paginatedReservas.length === 0 ? (
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 30, textAlign: 'center', color: '#94a3b8' }}>
            No hay folios registrados con estos filtros.
          </div>
        ) : (
          paginatedReservas.map(r => {
            const palette = getAvatarPalette(r.nombre_huesped);
            const st = String(r.estado || 'Confirmada').toLowerCase();
            const isEnCasa = st.includes('casa') || st.includes('check-in');

            return (
              <div key={r.id} className="hab-mobile-item-card">
                {/* Fila 1: Folio, Estado y Monto */}
                <div className="hab-mobile-card-row1">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="hab-folio-pill" style={{ fontSize: 11, padding: '3px 8px' }}>
                      #{r.no_folio || r.id.substring(4, 9)}
                    </span>
                    <span className={`hab-status-pill ${isEnCasa ? 'encasa' : 'confirmada'}`}>
                      ● {r.estado || 'Confirmada'}
                    </span>
                  </div>

                  <div style={{ fontWeight: 900, color: '#059669', fontSize: 15 }}>
                    Q {Number(r.monto_total || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Fila 2: Huésped con Avatar y Botones de Acción Directa */}
                <div className="hab-mobile-card-row2">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      className="hab-avatar"
                      style={{
                        background: palette.bg,
                        color: palette.text,
                        borderColor: palette.border,
                        width: 36,
                        height: 36
                      }}
                    >
                      {getInitials(r.nombre_huesped)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13 }}>
                        {r.nombre_huesped}
                      </div>
                      {r.telefono && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                          {r.telefono}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acciones directas (Llamar, WhatsApp) */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {r.telefono && (
                      <a
                        href={`tel:${r.telefono}`}
                        className="hab-action-btn edit"
                        style={{ width: 32, height: 32, minWidth: 32, minHeight: 32 }}
                        title="Llamar al huésped"
                      >
                        <Phone size={14} />
                      </a>
                    )}
                    <button
                      type="button"
                      className="hab-action-btn whatsapp"
                      style={{ width: 32, height: 32, minWidth: 32, minHeight: 32 }}
                      title="Enviar WhatsApp"
                      onClick={() => handleOpenContact(r, 'whatsapp')}
                    >
                      <MessageSquare size={14} strokeWidth={2.4} />
                    </button>
                  </div>
                </div>

                {/* Fila 3: Habitación y Fechas */}
                <div className="hab-mobile-card-row3">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Bed size={13} color="#0284c7" />
                      {r.cantidad_habitaciones}x {r.tipo_habitacion_nombre || 'Habitación'}
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      {r.modulo || 'Ppal.'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} color="#64748b" />
                      {r.fecha_check_in} → {r.fecha_check_out}
                    </span>
                    <span style={{
                      background: '#ecfdf5',
                      color: '#059669',
                      border: '1px solid #a7f3d0',
                      padding: '1px 6px',
                      borderRadius: 5,
                      fontSize: 10,
                      fontWeight: 800
                    }}>
                      {r.noches} noche(s)
                    </span>
                  </div>
                </div>

                {/* Fila 4: Footer de Tarjeta (Vendedor, Forma de Pago, Botón Detalles) */}
                <div className="hab-mobile-card-footer">
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    <span>{r.vendedor_nombre || 'Recepción'} · </span>
                    <span style={{ fontWeight: 700, color: '#334155' }}>{r.forma_pago_nombre || 'Efectivo'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(r)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: '#eff6ff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      borderRadius: 7,
                      padding: '5px 10px',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    <span>Detalles</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Paginación Mobile */}
        {totalItems > pageSize && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="hab-page-btn"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, alignSelf: 'center', color: '#475569' }}>
              Pág. {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              className="hab-page-btn"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          6. Modal Bento de Filtros Avanzados
          ───────────────────────────────────────────────────────────── */}
      {isFilterModalOpen && (
        <div className="hab-modal-backdrop" onClick={() => setIsFilterModalOpen(false)}>
          <div
            className="hab-modal-card"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 540 }}
          >
            <div className="hab-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <SlidersHorizontal size={20} color="#059669" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                  Filtros Avanzados de Búsqueda
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="hab-modal-body" style={{ gap: 16 }}>
              {/* Rango de Fechas Específico */}
              <div>
                <label className="hab-label">Rango Específico de Check-In / Check-Out</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Desde:</span>
                    <input
                      type="date"
                      className="hab-input"
                      value={filterDesde}
                      onChange={e => setFilterDesde(e.target.value)}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Hasta:</span>
                    <input
                      type="date"
                      className="hab-input"
                      value={filterHasta}
                      onChange={e => setFilterHasta(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Módulo / Sector */}
              <div>
                <label className="hab-label">Módulo / Sector</label>
                <select
                  className="hab-select"
                  value={filterModulo}
                  onChange={e => setFilterModulo(e.target.value)}
                >
                  <option value="">Todos los Módulos</option>
                  {(catalogos.modulos || []).map(m => (
                    <option key={m.id} value={m.nombre}>{m.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Forma de Pago */}
              <div>
                <label className="hab-label">Forma de Pago</label>
                <select
                  className="hab-select"
                  value={filterFormaPago}
                  onChange={e => setFilterFormaPago(e.target.value)}
                >
                  <option value="">Todas las Formas de Pago</option>
                  {(catalogos.formasPago || []).map(fp => (
                    <option key={fp.id} value={fp.nombre}>{fp.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Empresa o Razón Social */}
              <div>
                <label className="hab-label">Empresa</label>
                <select
                  className="hab-select"
                  value={filterEmpresa}
                  onChange={e => setFilterEmpresa(e.target.value)}
                >
                  <option value="">Todas las Empresas</option>
                  <option value="particular">Solo Huéspedes Particulares</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.name || c.nombre}>{c.name || c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Segmento de Cliente (Bancos, ONGs, etc.) */}
              <div>
                <label className="hab-label">Segmento de Cliente</label>
                <select
                  className="hab-select"
                  value={filterSegmento}
                  onChange={e => setFilterSegmento(e.target.value)}
                >
                  <option value="">Todos los Segmentos</option>
                  {(catalogos.tiposCliente || []).map(tc => (
                    <option key={tc.id} value={tc.id}>{tc.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="hab-modal-footer">
              <button
                type="button"
                className="hab-btn-cancel"
                onClick={() => {
                  setFilterDesde('');
                  setFilterHasta('');
                  setFilterModulo('');
                  setFilterFormaPago('');
                  setFilterEmpresa('');
                  setFilterSegmento('');
                }}
              >
                Limpiar Filtros
              </button>

              <button
                type="button"
                className="hab-btn-submit"
                onClick={() => setIsFilterModalOpen(false)}
              >
                <Check size={16} strokeWidth={2.4} />
                <span>Aplicar Filtros</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. Modales de Reserva, Contacto y Cancelación
          ───────────────────────────────────────────────────────────── */}
      {/* Modal de Registro / Edición */}
      <HabitacionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editingReserva}
        onSave={handleSaveReserva}
        catalogos={catalogos}
        sellers={sellers}
        companies={companies}
      />

      {/* Modal de Contacto WhatsApp / Correo */}
      <HabitacionContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        reserva={contactReserva}
        initialMedium={contactMedium}
        plantillas={catalogos.plantillas}
        onContactSent={fetchReservas}
      />

      {/* Modal de Campaña Promocional por Segmento */}
      <HabitacionCampanaModal
        isOpen={isCampanaModalOpen}
        onClose={() => setIsCampanaModalOpen(false)}
        catalogos={catalogos}
        onCampanaFinalizada={fetchReservas}
      />

      {/* Modal Diseñado de Cancelación de Reserva */}
      {cancelModal.isOpen && cancelModal.reserva && (
        <div className="hab-modal-backdrop" onClick={handleCloseCancelModal}>
          <div
            className="hab-modal-card"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 460,
              borderRadius: 20,
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{
              background: 'linear-gradient(180deg, #fef2f2 0%, #ffffff 100%)',
              padding: '24px 24px 16px',
              borderBottom: '1px solid #fee2e2',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Trash2 size={22} strokeWidth={2.2} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#991b1b' }}>
                  ¿Cancelar esta reserva?
                </h3>
                <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#7f1d1d', lineHeight: 1.4 }}>
                  La reserva del huésped <strong>{cancelModal.reserva.nombre_huesped}</strong> (Folio: <strong>#{cancelModal.reserva.no_folio || 'S/N'}</strong>) será cancelada y las habitaciones quedarán liberadas.
                </p>
              </div>
            </div>

            <div style={{ padding: '16px 24px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
                <span>Habitación:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{cancelModal.reserva.tipo_habitacion_nombre}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
                <span>Estancia:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{cancelModal.reserva.fecha_check_in} al {cancelModal.reserva.fecha_check_out} ({cancelModal.reserva.noches} noches)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
                <span>Monto Total:</span>
                <span style={{ fontWeight: 800, color: '#059669' }}>Q {Number(cancelModal.reserva.monto_total || 0).toFixed(2)}</span>
              </div>
            </div>

            <div style={{
              padding: '14px 24px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10
            }}>
              <button
                type="button"
                className="hab-btn-cancel"
                onClick={handleCloseCancelModal}
                disabled={cancelModal.loading}
              >
                No cancelar
              </button>
              <button
                type="button"
                className="hab-action-btn delete"
                onClick={handleConfirmCancelReserva}
                disabled={cancelModal.loading}
                style={{
                  width: 'auto',
                  height: 38,
                  padding: '0 18px',
                  borderRadius: 11,
                  fontWeight: 800,
                  fontSize: 13,
                  gap: 6
                }}
              >
                <Trash2 size={15} />
                <span>{cancelModal.loading ? 'Cancelando...' : 'Sí, cancelar reserva'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
