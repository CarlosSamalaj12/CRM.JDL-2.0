import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { STATUS_META } from '../calendar/constants';
import ReportInfo from './components/ReportInfo';
import MultiSelect from './components/MultiSelect';
import { getEventSeries, getEventSeriesFinancialMeta, getQuoteFinancialAmounts } from './components/eventSeriesUtils';

// PAX correcto de una reserva, respetando paxCompartido:
function getReservationPax(reservation, allEvents) {
  const series = getEventSeries(reservation, allEvents);
  if (!series.length) return Number(reservation?.pax || 0) || 0;
  const first = series[0];
  const isShared =
    first?.paxCompartido === true || first?.PaxCompartido === true ||
    first?.paxCompartido === 1    || first?.PaxCompartido === 1;
  if (isShared) {
    const anyWithPax = series.find(s => Number(s.pax) > 0) || first;
    return Number(anyWithPax?.pax || anyWithPax?.quote?.people || 0) || 0;
  }
  return series.reduce((acc, s) => acc + (Math.max(0, Number(s?.pax)) || 0), 0);
}

// Helper: Formato de dinero en Quetzales
const formatMoney = (amount) => {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(amount || 0);
};

// Formato corto dd-mm-yy
const formatDateShort = (dateStr) => {
  if (dateStr === null || dateStr === undefined || dateStr === '') return '';
  const asNum = typeof dateStr === 'number' ? dateStr : Number(dateStr);
  if (!Number.isNaN(asNum) && /^\d{9,}$/.test(String(asNum))) {
    const ms = asNum < 1e12 ? asNum * 1000 : asNum;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() > 1970) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      return `${dd}-${mm}-${yy}`;
    }
    return '';
  }
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const year = Number(m[1]);
    if (year <= 1970) return '';
    return `${m[3]}-${m[2]}-${m[1].slice(2)}`;
  }
  const d = new Date(dateStr);
  if (!Number.isNaN(d.getTime()) && d.getFullYear() > 1970) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  }
  return '';
};

// Paleta de avatares para vendedores
const SELLER_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#6366f1'];
function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SELLER_COLORS[Math.abs(hash) % SELLER_COLORS.length];
}

function getInitials(name) {
  if (!name || name === 'Sin asignar' || name === 'Sin vendedor') return 'SA';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Estados comerciales disponibles
const ALL_STATUSES = [
  'Confirmado',
  'Pre reserva',
  'Seguimiento',
  '1er Cotizacion',
  'Lista de Espera',
  'Reserva sin Cotizacion',
  'Cancelado',
  'Perdido'
];

const STATUS_COLORS = {
  'Confirmado': { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  'Pre reserva': { color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
  'Seguimiento': { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  '1er Cotizacion': { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  'Lista de Espera': { color: '#ca8a04', bg: '#fefce8', border: '#fef08a' },
  'Reserva sin Cotizacion': { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  'Cancelado': { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  'Perdido': { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};

// Columnas configurables por defecto
const DEFAULT_VISIBLE_COLUMNS = {
  estado: true,
  cotizacion: true,
  folio: true,
  institucion: true,
  vendedor: true,
  fechas: true,
  salon: true,
  pax: true,
  monto: true,
};

const STORAGE_KEY_VENTAS_COLUMNS = 'crm_reports_ventas_columns_v1';

// Definición enriquecida de columnas para el modal ejecutivo
const COLUMN_DEFINITIONS = [
  {
    key: 'estado',
    label: 'Estado del Evento',
    description: 'Etiqueta de avance comercial',
    iconColor: '#059669',
    iconBg: '#ecfdf5',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
        <circle cx="7" cy="7" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: 'cotizacion',
    label: 'Código de Cotización',
    description: 'Identificador único de cotización',
    iconColor: '#2563eb',
    iconBg: '#eff6ff',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    key: 'folio',
    label: 'No. Folio / NOG',
    description: 'No. de contrato o folio oficial',
    iconColor: '#4f46e5',
    iconBg: '#eef2ff',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="9" x2="20" y2="9" />
        <line x1="4" y1="15" x2="20" y2="15" />
        <line x1="10" y1="3" x2="8" y2="21" />
        <line x1="16" y1="3" x2="14" y2="21" />
      </svg>
    ),
  },
  {
    key: 'institucion',
    label: 'Institución / Cliente',
    description: 'Empresa, entidad o cliente',
    iconColor: '#0284c7',
    iconBg: '#f0f9ff',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <path d="M9 22v-4h6v4" />
        <line x1="8" y1="6" x2="8.01" y2="6" strokeWidth="2.5" />
        <line x1="16" y1="6" x2="16.01" y2="6" strokeWidth="2.5" />
        <line x1="8" y1="10" x2="8.01" y2="10" strokeWidth="2.5" />
        <line x1="16" y1="10" x2="16.01" y2="10" strokeWidth="2.5" />
        <line x1="8" y1="14" x2="8.01" y2="14" strokeWidth="2.5" />
        <line x1="16" y1="14" x2="16.01" y2="14" strokeWidth="2.5" />
      </svg>
    ),
  },
  {
    key: 'vendedor',
    label: 'Vendedor Asignado',
    description: 'Asesor comercial responsable',
    iconColor: '#7c3aed',
    iconBg: '#f5f3ff',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    key: 'fechas',
    label: 'Fechas (Inicio / Fin)',
    description: 'Calendario de inicio y cierre',
    iconColor: '#d97706',
    iconBg: '#fffbeb',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    key: 'salon',
    label: 'Salón / Espacio',
    description: 'Área reservada para montaje',
    iconColor: '#db2777',
    iconBg: '#fdf2f8',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    key: 'pax',
    label: 'Número de PAX',
    description: 'Cantidad total de personas',
    iconColor: '#0891b2',
    iconBg: '#ecfeff',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: 'monto',
    label: 'Monto Total',
    description: 'Total proyectado en GTQ / USD',
    iconColor: '#059669',
    iconBg: '#ecfdf5',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
];

export default function ReportsVentas({ onClose }) {
  const { events, users, salones } = useOutletContext();
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();

  // Lista de vendedores activos
  const sellerUsers = useMemo(() => (users || []).filter(u => {
    const r = String(u.role || u.rol || '').toLowerCase();
    return r === 'vendedor' || r === 'admin';
  }).sort((a, b) => (a.fullName || a.name || '').localeCompare(b.fullName || b.name || '')), [users]);

  // Estados de filtros (Multi-selección para Vendedores, Salones y Estados)
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState(new Set());
  const [salonFilter, setSalonFilter] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState(new Set(['Confirmado', 'Pre reserva']));

  // Paginación
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Columnas configurables con persistencia en localStorage
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VENTAS_COLUMNS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_VISIBLE_COLUMNS, ...parsed };
      }
    } catch (err) {
      console.error('Error cargando columnas de ventas:', err);
    }
    return DEFAULT_VISIBLE_COLUMNS;
  });
  const [showColModal, setShowColModal] = useState(false);

  // Cerrar modal con tecla Escape
  useEffect(() => {
    if (!showColModal) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowColModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showColModal]);

  const saveColumnPreferences = (nextCols) => {
    setVisibleColumns(nextCols);
    try {
      localStorage.setItem(STORAGE_KEY_VENTAS_COLUMNS, JSON.stringify(nextCols));
    } catch (err) {
      console.error('Error persistiendo columnas de ventas:', err);
    }
  };

  const handleToggleColumn = (key) => {
    const currentActiveCount = Object.values(visibleColumns).filter(Boolean).length;
    // Impedir desactivar la última columna para no dejar la tabla en blanco
    if (visibleColumns[key] && currentActiveCount <= 1) {
      return;
    }
    const next = { ...visibleColumns, [key]: !visibleColumns[key] };
    saveColumnPreferences(next);
  };

  const handleSelectAllColumns = () => {
    const next = {};
    COLUMN_DEFINITIONS.forEach(c => { next[c.key] = true; });
    saveColumnPreferences(next);
  };

  const handleSelectMinimalColumns = () => {
    const next = {
      estado: true,
      cotizacion: false,
      folio: false,
      institucion: true,
      vendedor: false,
      fechas: true,
      salon: false,
      pax: false,
      monto: true,
    };
    saveColumnPreferences(next);
  };

  const handleResetColumns = () => {
    saveColumnPreferences(DEFAULT_VISIBLE_COLUMNS);
  };

  const visibleCount = useMemo(() => {
    return Object.values(visibleColumns).filter(Boolean).length;
  }, [visibleColumns]);

  const totalColumns = COLUMN_DEFINITIONS.length;
  const isAnyHidden = visibleCount < totalColumns;

  // Procesamiento canónico de eventos
  const reportData = useMemo(() => {
    if (!events) return [];
    const rows = [];
    const seenReservations = new Set();

    for (const ev of events) {
      const reservationKey = ev.groupId || ev.id;
      if (reservationKey) {
        if (seenReservations.has(reservationKey)) continue;
        seenReservations.add(reservationKey);
      }

      const financialMeta = getEventSeriesFinancialMeta(ev, events);
      const primaryEvent = financialMeta.primaryEvent || ev;
      const quote = primaryEvent?.quote || ev?.quote || {};
      const assignedUser = users?.find(u => u.id === (primaryEvent?.userId || ev?.userId));
      const finAmounts = getQuoteFinancialAmounts(quote);

      const slotStartDate = String(financialMeta.startDate || primaryEvent?.eventDateStart || primaryEvent?.date || ev?.eventDateStart || ev?.date || '').trim();
      const slotEndDate = String(financialMeta.endDate || primaryEvent?.eventDateEnd || primaryEvent?.endDate || ev?.eventDateEnd || ev?.endDate || slotStartDate).trim();

      rows.push({
        id: ev.id,
        refId: quote?.code || reservationKey || primaryEvent?.id || ev?.id || '',
        folio: quote?.folio || '',
        institucion: quote?.companyName || ev.clientName || quote?.contact || '',
        name: primaryEvent?.name || ev?.name || '',
        eventDate: slotStartDate,
        endDate: slotEndDate,
        startTime: financialMeta.startTime || primaryEvent?.startTime || ev?.startTime || '',
        endTime: financialMeta.endTime || primaryEvent?.endTime || ev?.endTime || '',
        salon: financialMeta.mainSalon || primaryEvent?.salon || ev?.salon || 'Salón Principal',
        status: primaryEvent?.status || ev?.status || '',
        userId: primaryEvent?.userId || ev?.userId,
        userName: assignedUser?.fullName || assignedUser?.name || 'Sin asignar',
        clientName: ev.clientName || quote?.companyName || quote?.contact || '',
        pax: getReservationPax(ev, events),
        quote: quote,
        total: finAmounts.totalGtq,
        subtotal: finAmounts.subtotalGtq,
        discount: finAmounts.discountGtq,
        isUsd: finAmounts.isUsd,
        rawTotal: finAmounts.rawTotal,
        exchangeRate: finAmounts.exchangeRate,
        exchangeRateDate: finAmounts.exchangeRateDate || quote?.exchangeRateDate || null,
        salones: financialMeta.salones,
        eventType: quote?.eventType || primaryEvent?.name || ev?.name || '',
        statusColor: STATUS_META[primaryEvent?.status || ev?.status]?.color || '#64748b'
      });
    }

    let filtered = rows;
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.name?.toLowerCase().includes(term) ||
        r.clientName?.toLowerCase().includes(term) ||
        r.salon?.toLowerCase().includes(term) ||
        r.userName?.toLowerCase().includes(term) ||
        r.refId?.toLowerCase().includes(term) ||
        r.eventType?.toLowerCase().includes(term) ||
        r.folio?.toLowerCase().includes(term) ||
        r.institucion?.toLowerCase().includes(term)
      );
    }
    if (dateFrom) filtered = filtered.filter(r => r.eventDate >= dateFrom);
    if (dateTo) filtered = filtered.filter(r => r.eventDate <= dateTo);
    if (userFilter.size > 0) filtered = filtered.filter(r => userFilter.has(String(r.userId)));
    if (statusFilter.size > 0) filtered = filtered.filter(r => statusFilter.has(r.status));
    if (salonFilter.size > 0) {
      filtered = filtered.filter(r => {
        const list = Array.isArray(r.salones) ? r.salones : [];
        return salonFilter.has(r.salon) || list.some(s => salonFilter.has(s));
      });
    }

    return filtered.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }, [events, users, search, dateFrom, dateTo, userFilter, statusFilter, salonFilter]);

  // Cálculos de Resumen
  const summary = useMemo(() => {
    const totalEvents = reportData.length;
    const totalPax = reportData.reduce((sum, r) => sum + (r.pax || 0), 0);
    const totalVentas = reportData.reduce((sum, r) => sum + (r.total || 0), 0);
    const confirmadosList = reportData.filter(r => r.status === 'Confirmado');
    const preReservaList = reportData.filter(r => r.status === 'Pre reserva');

    const confirmadosAmount = confirmadosList.reduce((sum, r) => sum + (r.total || 0), 0);
    const preReservaAmount = preReservaList.reduce((sum, r) => sum + (r.total || 0), 0);

    return {
      totalEvents,
      totalPax,
      totalVentas,
      confirmadosCount: confirmadosList.length,
      confirmadosAmount,
      preReservaCount: preReservaList.length,
      preReservaAmount,
    };
  }, [reportData]);

  // Conversión sobre pipeline
  const { conversionPct, pipelineCount, confirmedPipelineCount } = useMemo(() => {
    if (!events) return { conversionPct: 0, pipelineCount: 0, confirmedPipelineCount: 0 };
    const PIPELINE_STATUSES = new Set(['Pre reserva', '1er Cotizacion', 'Seguimiento', 'Lista de Espera', 'Confirmado']);

    const term = search.trim().toLowerCase();
    const inDateRange = (d) => {
      if (!d) return true;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    };
    const userMatches = (ev) => userFilter.size === 0 || userFilter.has(String(ev.userId));
    const salonMatches = (ev) => {
      if (salonFilter.size === 0) return true;
      const mainSalon = ev.salon || '';
      const list = Array.isArray(ev.salones) ? ev.salones : [];
      return salonFilter.has(mainSalon) || list.some(s => salonFilter.has(s));
    };
    const textMatches = (ev, primaryEvent) => {
      if (!term) return true;
      const assignedUser = users?.find(u => u.id === (primaryEvent?.userId || ev?.userId));
      const userName = assignedUser?.fullName || assignedUser?.name || '';
      const quote = primaryEvent?.quote || ev?.quote || {};
      const haystack = [
        primaryEvent?.name || ev?.name,
        ev.clientName || quote.companyName || quote.contact,
        primaryEvent?.salon || ev?.salon,
        userName,
        quote.code,
        quote.eventType,
        quote.folio,
        quote.companyName,
      ].map(v => String(v || '').toLowerCase());
      return haystack.some(v => v.includes(term));
    };

    const seen = new Set();
    const reservations = [];
    for (const ev of events) {
      if (!PIPELINE_STATUSES.has(ev.status)) continue;
      const key = ev.groupId || ev.id;
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      reservations.push(ev);
    }

    let pCount = 0;
    let cCount = 0;
    for (const ev of reservations) {
      const financialMeta = getEventSeriesFinancialMeta(ev, events);
      const primaryEvent = financialMeta.primaryEvent || ev;
      const eventDate = financialMeta.startDate || primaryEvent?.date || ev?.date || '';
      if (!inDateRange(eventDate)) continue;
      if (!userMatches(primaryEvent)) continue;
      if (!salonMatches(primaryEvent)) continue;
      if (!textMatches(ev, primaryEvent)) continue;

      pCount += 1;
      if (primaryEvent.status === 'Confirmado') cCount += 1;
    }

    const pct = pCount > 0 ? Math.round((cCount / pCount) * 100) : 0;
    return { conversionPct: pct, pipelineCount: pCount, confirmedPipelineCount: cCount };
  }, [events, users, search, dateFrom, dateTo, userFilter, salonFilter]);

  // Ticket promedio PAX
  const avgTicket = useMemo(() => {
    return summary.totalPax > 0 ? (summary.totalVentas / summary.totalPax) : 0;
  }, [summary]);

  // Vendedor Top
  const topSellerData = useMemo(() => {
    const map = new Map();
    for (const row of reportData) {
      const seller = String(row?.userName || 'Sin asignar').trim();
      map.set(seller, Number(map.get(seller) || 0) + Math.max(0, Number(row?.total || 0)));
    }
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    if (!sorted.length || !sorted[0][0] || sorted[0][0] === 'Sin asignar') {
      return { name: 'Sin asignar', amount: 0 };
    }
    return { name: sorted[0][0], amount: sorted[0][1] };
  }, [reportData]);

  // Paginación de la tabla
  const totalPages = Math.ceil(reportData.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    if (pageSize === 'all') return reportData;
    const start = (currentPage - 1) * pageSize;
    return reportData.slice(start, start + pageSize);
  }, [reportData, currentPage, pageSize]);

  const pageSubtotal = useMemo(() => {
    return paginatedRows.reduce((sum, r) => sum + (r.total || 0), 0);
  }, [paginatedRows]);

  // Presets de fecha
  const applyDatePreset = (preset) => {
    const now = new Date();
    if (preset === 'hoy') {
      const d = now.toISOString().split('T')[0];
      setDateFrom(d);
      setDateTo(d);
    } else if (preset === 'semana') {
      const day = now.getDay() || 7; // Lunes = 1
      const mon = new Date(now);
      mon.setDate(now.getDate() - day + 1);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      setDateFrom(mon.toISOString().split('T')[0]);
      setDateTo(sun.toISOString().split('T')[0]);
    } else if (preset === 'mes') {
      const y = now.getFullYear();
      const m = now.getMonth();
      const first = new Date(y, m, 1).toISOString().split('T')[0];
      const last = new Date(y, m + 1, 0).toISOString().split('T')[0];
      setDateFrom(first);
      setDateTo(last);
    } else if (preset === 'ano') {
      const y = now.getFullYear();
      setDateFrom(`${y}-01-01`);
      setDateTo(`${y}-12-31`);
    }
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setUserFilter(new Set());
    setSalonFilter(new Set());
    setStatusFilter(new Set(['Confirmado', 'Pre reserva']));
    setCurrentPage(1);
  };

  const toggleStatusChip = (st) => {
    const next = new Set(statusFilter);
    if (next.has(st)) next.delete(st);
    else next.add(st);
    setStatusFilter(next);
    setCurrentPage(1);
  };

  // Exportar Excel profesional (.xlsx)
  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const wsData = reportData.map((r, i) => ({
        '#': i + 1,
        'Estado': r.status,
        'Cotización': r.refId,
        'No. Folio / NOG': r.folio || '0',
        'Institución / Cliente': r.institucion || r.name,
        'Vendedor Asignado': r.userName,
        'Fecha Inicio': formatDateShort(r.eventDate),
        'Fecha Fin': formatDateShort(r.endDate || r.eventDate),
        'Evento': r.eventType || r.name,
        'Salón Principal': r.salon,
        'PAX': r.pax,
        'Monto Total (GTQ)': r.total,
      }));

      const ws = XLSX.utils.json_to_sheet(wsData);

      // Auto ancho de columnas
      ws['!cols'] = [
        { wch: 5 },  // #
        { wch: 15 }, // Estado
        { wch: 14 }, // Cotización
        { wch: 16 }, // Folio
        { wch: 38 }, // Institución
        { wch: 24 }, // Vendedor
        { wch: 12 }, // Fecha Inicio
        { wch: 12 }, // Fecha Fin
        { wch: 26 }, // Evento
        { wch: 20 }, // Salón
        { wch: 8 },  // PAX
        { wch: 18 }, // Monto
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Ventas');
      XLSX.writeFile(wb, `Reporte_Ventas_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Error al exportar Excel:', err);
      alert('Error generando el archivo Excel.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="reports-page-container" style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '40px' }}>
      
      {/* Estilos dedicados para garantizar campos blancos y limpios en cualquier modo */}
      <style>{`
        .rv-white-input {
          background-color: #ffffff !important;
          background: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #cbd5e1 !important;
          color-scheme: light !important;
        }
        .rv-white-input:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 2px rgba(37,99,235,0.18) !important;
          outline: none !important;
        }
        .rv-white-input::-webkit-calendar-picker-indicator {
          filter: invert(0.2) !important;
          cursor: pointer !important;
          opacity: 0.85 !important;
        }
        .rv-white-input::placeholder {
          color: #94a3b8 !important;
        }
        @keyframes rvModalBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes rvModalFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .rv-col-card:hover {
          border-color: #3b82f6 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37,99,235,0.08) !important;
        }
        .rv-col-action-btn:hover {
          background: #f1f5f9 !important;
          color: #0f172a !important;
          border-color: #94a3b8 !important;
        }
      `}</style>

      {/* ── BARRA SUPERIOR INSTITUCIONAL ── */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Lado Izquierdo: Marca + Volver + Indicador de Sincronización */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 5px rgba(37,99,235,0.25)',
              flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                EMS RESERVAS
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Jardines del Lago
              </div>
            </div>
          </div>

          <div style={{ height: '24px', width: '1px', background: '#e2e8f0' }} />

          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: 'none',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#0f172a'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}
          >
            ← Volver al Dashboard
          </button>

          {/* Cápsula de Sincronización en Tiempo Real */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '9999px',
            padding: '4px 12px',
            fontSize: '11.5px',
            color: '#475569',
            fontWeight: 600,
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
            <span>Sincronizado en tiempo real</span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span style={{ color: '#0f172a', fontWeight: 700 }}>{reportData.length} cotizaciones activas</span>
          </div>
        </div>

        {/* Lado Derecho: Acciones de Exportación */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Imprimir / PDF
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 15px',
              background: '#059669',
              border: '1px solid #059669',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(5,150,105,0.2)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#047857'}
            onMouseLeave={e => e.currentTarget.style.background = '#059669'}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            Exportar Excel
          </button>

          <ReportInfo reportKey="ventas" />
        </div>
      </header>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
        
        {/* ── ENCABEZADO DE REPORTE Y TARJETAS DE RESUMEN ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
                Reporte de Ventas
              </h1>
              <span style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '9999px',
              }}>
                Período Fiscal {currentYear}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Pipeline comercial unificado, cotizaciones activas, reservas y control de facturación proyectada.
            </p>
          </div>

          {/* Resumen Superior de Estados Clave */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '10px',
              padding: '8px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}>
              <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                CONFIRMADO
              </span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                {summary.confirmadosCount} eventos · {formatMoney(summary.confirmadosAmount)}
              </span>
            </div>

            <div style={{
              background: '#fdf2f8',
              border: '1px solid #fbcfe8',
              borderRadius: '10px',
              padding: '8px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}>
              <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#db2777', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ec4899' }} />
                PRE RESERVA
              </span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                {summary.preReservaCount} eventos · {formatMoney(summary.preReservaAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* ── CUADRÍCULA DE 6 BENTO KPI CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
          
          {/* KPI 1: Eventos Cartera */}
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
            borderTop: '3px solid #2563eb',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  EVENTOS CARTERA
                </span>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                  flexShrink: 0,
                }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
              </div>
              <div style={{ fontSize: '30px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1, marginTop: '8px' }}>
                {summary.totalEvents}
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px' }}>
              <span style={{ color: '#059669', fontWeight: 700 }}>↑ +12%</span> en estados activos
            </div>
          </div>

          {/* KPI 2: Total Venta */}
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
            borderTop: '3px solid #10b981',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  TOTAL VENTA
                </span>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: '#ecfdf5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#059669',
                  flexShrink: 0,
                }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
              </div>
              <div style={{ fontSize: '21px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1, marginTop: '8px' }}>
                {formatMoney(summary.totalVentas)}
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px' }}>
              Valor cotizado en selección
            </div>
          </div>

          {/* KPI 3: PAX Totales */}
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
            borderTop: '3px solid #0ea5e9',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  PAX TOTALES
                </span>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: '#f0f9ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7',
                  flexShrink: 0,
                }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
              </div>
              <div style={{ fontSize: '30px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1, marginTop: '8px' }}>
                {summary.totalPax.toLocaleString()}
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px' }}>
              Personas atendidas / aforo
            </div>
          </div>

          {/* KPI 4: Ticket Promedio PAX */}
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
            borderTop: '3px solid #f59e0b',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  TICKET PROM. PAX
                </span>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: '#fffbeb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706',
                  flexShrink: 0,
                }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2" />
                    <line x1="8" y1="6" x2="16" y2="6" />
                    <line x1="8" y1="10" x2="16" y2="10" />
                    <line x1="8" y1="14" x2="12" y2="14" />
                  </svg>
                </div>
              </div>
              <div style={{ fontSize: '25px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1, marginTop: '8px' }}>
                {formatMoney(avgTicket)}
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px' }}>
              Gasto promedio por persona
            </div>
          </div>

          {/* KPI 5: Conversión */}
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
            borderTop: '3px solid #8b5cf6',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  CONVERSIÓN
                </span>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: '#f5f3ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#7c3aed',
                  flexShrink: 0,
                }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                <span style={{ fontSize: '30px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                  {conversionPct}%
                </span>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#6366f1' }}>
                  {pipelineCount > 0 ? `${((confirmedPipelineCount / pipelineCount) * 100).toFixed(1)}% ratio` : '0%'}
                </span>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px' }}>
              {confirmedPipelineCount} confirmados de {pipelineCount}
            </div>
          </div>

          {/* KPI 6: Vendedor Top */}
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
            borderTop: '3px solid #06b6d4',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  VENDEDOR TOP
                </span>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: '#fefce8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ca8a04',
                  flexShrink: 0,
                }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
              </div>
              <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', marginTop: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {topSellerData.name}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', marginTop: '10px' }}>
              <span style={{ background: '#ecfdf5', color: '#059669', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                Líder Ingresos
              </span>
              <span style={{ fontWeight: 700, color: '#334155' }}>
                {formatMoney(topSellerData.amount)}
              </span>
            </div>
          </div>

        </div>

        {/* ── PANEL DE FILTROS INTEGRADO ── */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '18px 22px',
          boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {/* Fila 1: Búsqueda Rápida + Fechas + Vendedor + Salón */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 2fr) minmax(130px, 1fr) minmax(130px, 1fr) minmax(170px, 1.2fr) minmax(170px, 1.2fr)', gap: '12px', alignItems: 'flex-end' }}>
            {/* Buscador */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                Búsqueda rápida
              </label>
              <div style={{ position: 'relative' }}>
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="rv-white-input"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                  placeholder="Buscar por cliente, cotización, folio, salón..."
                  style={{
                    width: '100%',
                    height: '38px',
                    paddingLeft: '36px',
                    paddingRight: '12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#0f172a',
                    background: '#ffffff',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Desde */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                Desde
              </label>
              <input
                type="date"
                className="rv-white-input"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  color: '#0f172a',
                  background: '#ffffff',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Hasta */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                Hasta
              </label>
              <input
                type="date"
                className="rv-white-input"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  color: '#0f172a',
                  background: '#ffffff',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Vendedor (MultiSelect) */}
            <div>
              <MultiSelect
                selected={userFilter}
                onChange={(next) => { setUserFilter(next); setCurrentPage(1); }}
                options={sellerUsers.map(u => ({ value: String(u.id), label: u.fullName || u.name }))}
                placeholder="Vendedor"
                emptyLabel="Todos los Vendedores"
                searchable
                width="100%"
                minWidth={160}
                triggerStyle={{
                  height: '38px',
                  minHeight: '38px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                }}
              />
            </div>

            {/* Salón / Espacio (MultiSelect) */}
            <div>
              <MultiSelect
                selected={salonFilter}
                onChange={(next) => { setSalonFilter(next); setCurrentPage(1); }}
                options={(salones || []).map(s => ({ value: s, label: s }))}
                placeholder="Salón / Espacio"
                emptyLabel="Todos los Salones"
                searchable
                width="100%"
                minWidth={160}
                triggerStyle={{
                  height: '38px',
                  minHeight: '38px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                }}
              />
            </div>
          </div>

          {/* Fila 2: MultiSelect de Estados + Chips Activos + Presets de Fecha + Reset */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
            
            {/* MultiSelect de Estados y Chips de Filtros Activos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px' }}>
                FILTRO ESTADO:
              </span>

              <MultiSelect
                selected={statusFilter}
                onChange={(next) => { setStatusFilter(next); setCurrentPage(1); }}
                options={ALL_STATUSES.map(s => ({
                  value: s,
                  label: s,
                  color: STATUS_COLORS[s]?.color || '#64748b',
                }))}
                placeholder="Estados"
                emptyLabel="Todos los estados"
                width="auto"
                minWidth={170}
                triggerStyle={{
                  height: '32px',
                  minHeight: '32px',
                  borderRadius: '16px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  padding: '2px 10px',
                }}
              />

              {Array.from(statusFilter).map(st => {
                const conf = STATUS_COLORS[st] || { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' };
                return (
                  <span
                    key={st}
                    style={{
                      background: conf.bg,
                      border: `1px solid ${conf.border}`,
                      color: conf.color,
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: '9999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                  >
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: conf.color }} />
                    {st}
                    <button
                      type="button"
                      onClick={() => toggleStatusChip(st)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: conf.color,
                        cursor: 'pointer',
                        padding: '0 2px',
                        fontSize: '12px',
                        lineHeight: 1,
                        fontWeight: 900,
                      }}
                      title={`Quitar ${st}`}
                    >
                      ✕
                    </button>
                  </span>
                );
              })}

              {/* Chips de Vendedores activos para fácil remoción */}
              {Array.from(userFilter).map(uid => {
                const u = users?.find(user => String(user.id) === String(uid));
                const name = u?.fullName || u?.name || `Usuario ${uid}`;
                return (
                  <span
                    key={uid}
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#1d4ed8',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: '9999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#2563eb' }} />
                    {name}
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(userFilter);
                        next.delete(uid);
                        setUserFilter(next);
                        setCurrentPage(1);
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#1d4ed8', cursor: 'pointer', padding: '0 2px', fontSize: '12px', fontWeight: 900 }}
                      title={`Quitar ${name}`}
                    >
                      ✕
                    </button>
                  </span>
                );
              })}

              {/* Chips de Salones activos para fácil remoción */}
              {Array.from(salonFilter).map(sal => (
                <span
                  key={sal}
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#15803d',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: '9999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#16a34a' }} />
                  {sal}
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Set(salonFilter);
                      next.delete(sal);
                      setSalonFilter(next);
                      setCurrentPage(1);
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#15803d', cursor: 'pointer', padding: '0 2px', fontSize: '12px', fontWeight: 900 }}
                    title={`Quitar ${sal}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>

            {/* Presets de Fecha + Reset */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => applyDatePreset('hoy')}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'transparent', fontSize: '11.5px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#ffffff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('semana')}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'transparent', fontSize: '11.5px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#ffffff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Esta semana
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('mes')}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#ffffff', fontSize: '11.5px', fontWeight: 700, color: '#0f172a', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                >
                  Mes actual
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('ano')}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'transparent', fontSize: '11.5px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#ffffff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Año {currentYear}
                </button>
              </div>

              {/* Botón de Restablecer */}
              <button
                type="button"
                onClick={handleResetFilters}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
              >
                ↻ Restablecer filtros
              </button>
            </div>
          </div>
        </div>

        {/* ── TABLA DE DETALLE DE OPERACIONES Y RESERVAS ── */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
        }}>
          {/* Header de la Tabla */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Detalle de Operaciones y Reservas
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Visualizando {reportData.length > 0 ? (pageSize === 'all' ? reportData.length : Math.min(reportData.length, (currentPage - 1) * pageSize + 1)) : 0} a {pageSize === 'all' ? reportData.length : Math.min(reportData.length, currentPage * pageSize)} de {reportData.length} registros totales
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowColModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: isAnyHidden ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                background: isAnyHidden ? '#eff6ff' : '#ffffff',
                color: isAnyHidden ? '#1d4ed8' : '#334155',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isAnyHidden ? '0 1px 3px rgba(37, 99, 235, 0.12)' : 'none',
              }}
              title="Configurar qué columnas se muestran en la tabla"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              <span>Columnas</span>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: '9999px',
                background: isAnyHidden ? '#2563eb' : '#f1f5f9',
                color: isAnyHidden ? '#ffffff' : '#64748b',
              }}>
                {visibleCount}/{totalColumns}
              </span>
            </button>
          </div>

          {/* Tabla de Registros */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #e2e8f0', background: '#f8fafc' }}>
                  {visibleColumns.estado && <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>ESTADO</th>}
                  {visibleColumns.cotizacion && <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>COTIZACIÓN</th>}
                  {visibleColumns.folio && <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>NO. FOLIO / NOG</th>}
                  {visibleColumns.institucion && <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>INSTITUCIÓN / CLIENTE</th>}
                  {visibleColumns.vendedor && <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>VENDEDOR ASIGNADO</th>}
                  {visibleColumns.fechas && <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>FECHAS (I / F)</th>}
                  {visibleColumns.salon && <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>SALÓN / ESPACIO</th>}
                  {visibleColumns.pax && <th style={{ padding: '10px 10px', textAlign: 'center', color: '#64748b', fontWeight: 800 }}>PAX</th>}
                  {visibleColumns.monto && <th style={{ padding: '10px 10px', textAlign: 'right', color: '#64748b', fontWeight: 800 }}>MONTO TOTAL</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleCount || 1} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      Sin eventos registrados para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((r) => {
                    const conf = STATUS_COLORS[r.status] || { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' };
                    const sellerInitials = getInitials(r.userName);
                    const sellerColor = getAvatarColor(r.userName);

                    return (
                      <tr
                        key={r.id}
                        onClick={() => navigate(`/reserva/${r.id}`)}
                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.12s ease' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        title="Click para abrir la reserva"
                      >
                        {/* Estado */}
                        {visibleColumns.estado && (
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{
                              background: conf.bg,
                              border: `1px solid ${conf.border}`,
                              color: conf.color,
                              padding: '3px 9px',
                              borderRadius: '9999px',
                              fontSize: '10px',
                              fontWeight: 800,
                              letterSpacing: '0.3px',
                              textTransform: 'uppercase',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: conf.color }} />
                              {r.status || 'Confirmado'}
                            </span>
                          </td>
                        )}

                        {/* Cotización */}
                        {visibleColumns.cotizacion && (
                          <td style={{ padding: '12px 10px', fontWeight: 800, color: '#2563eb' }}>
                            {r.refId || '—'}
                          </td>
                        )}

                        {/* No. Folio / NOG */}
                        {visibleColumns.folio && (
                          <td style={{ padding: '12px 10px', color: '#475569' }}>
                            {r.folio ? (
                              <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                                NOG: {r.folio}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>0</span>
                            )}
                          </td>
                        )}

                        {/* Institución / Cliente */}
                        {visibleColumns.institucion && (
                          <td style={{ padding: '12px 10px', maxWidth: '320px' }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                              {r.institucion || r.clientName || r.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.eventType || r.name || 'Servicio de Banquetes y Eventos'}
                            </div>
                          </td>
                        )}

                        {/* Vendedor Asignado */}
                        {visibleColumns.vendedor && (
                          <td style={{ padding: '12px 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: sellerColor,
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: 800,
                                flexShrink: 0,
                              }}>
                                {sellerInitials}
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                                {r.userName}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* Fechas (I / F) */}
                        {visibleColumns.fechas && (
                          <td style={{ padding: '12px 10px', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {formatDateShort(r.eventDate)} <span style={{ color: '#94a3b8' }}>→</span> {formatDateShort(r.endDate || r.eventDate)}
                          </td>
                        )}

                        {/* Salón / Espacio */}
                        {visibleColumns.salon && (
                          <td style={{ padding: '12px 10px', color: '#334155', fontWeight: 600 }}>
                            {r.salon}
                          </td>
                        )}

                        {/* PAX */}
                        {visibleColumns.pax && (
                          <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                            {r.pax}
                          </td>
                        )}

                        {/* Monto Total */}
                        {visibleColumns.monto && (
                          <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: '12.5px' }}>
                            <div>{formatMoney(r.total)}</div>
                            {r.isUsd && (
                              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', marginTop: '2px' }}>
                                <span>${Number(r.rawTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
                                <span style={{
                                  fontSize: '9px',
                                  color: '#0369a1',
                                  background: '#f0f9ff',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  border: '1px solid #bae6fd',
                                  display: 'inline-block',
                                  whiteSpace: 'nowrap'
                                }}>
                                  TC Q {Number(r.exchangeRate || 7.75).toFixed(2)}{r.exchangeRateDate ? ` (${String(r.exchangeRateDate).slice(8,10)}/${String(r.exchangeRateDate).slice(5,7)}/${String(r.exchangeRateDate).slice(0,4)})` : ''}
                                </span>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Fila de Subtotal de Página */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '14px',
            padding: '12px 10px',
            borderTop: '2px solid #e2e8f0',
            marginTop: '4px',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
              SUBTOTAL PÁGINA:
            </span>
            <span style={{ fontSize: '14px', fontWeight: 900, color: '#059669' }}>
              {formatMoney(pageSubtotal)}
            </span>
          </div>

          {/* Paginación Inferior */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #f1f5f9',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b' }}>
              <span>Mostrar</span>
              <select
                value={pageSize}
                onChange={e => {
                  const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                style={{
                  height: '30px',
                  padding: '0 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '12px',
                  color: '#0f172a',
                  outline: 'none',
                }}
              >
                <option value={10}>10 filas</option>
                <option value={25}>25 filas</option>
                <option value={50}>50 filas</option>
                <option value={100}>100 filas</option>
                <option value="all">Todas</option>
              </select>
              <span>de {reportData.length} registros</span>
            </div>

            {pageSize !== 'all' && totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: currentPage === 1 ? '#cbd5e1' : '#334155',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ‹
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pNum;
                  if (totalPages <= 5) pNum = i + 1;
                  else if (currentPage <= 3) pNum = i + 1;
                  else if (currentPage >= totalPages - 2) pNum = totalPages - 4 + i;
                  else pNum = currentPage - 2 + i;

                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setCurrentPage(pNum)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        border: currentPage === pNum ? '1px solid #2563eb' : '1px solid #cbd5e1',
                        background: currentPage === pNum ? '#2563eb' : '#ffffff',
                        color: currentPage === pNum ? '#ffffff' : '#334155',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {pNum}
                    </button>
                  );
                })}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <span style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>
                )}

                {totalPages > 5 && (
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      border: currentPage === totalPages ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      background: currentPage === totalPages ? '#2563eb' : '#ffffff',
                      color: currentPage === totalPages ? '#ffffff' : '#334155',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {totalPages}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: currentPage === totalPages ? '#cbd5e1' : '#334155',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── DICTAMEN EJECUTIVO DE VENTAS ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '14px',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '18px',
          boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 500px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(37, 99, 235, 0.2)',
              border: '1px solid rgba(37, 99, 235, 0.4)',
              color: '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#ffffff' }}>
                  Dictamen Ejecutivo de Ventas
                </span>
                <span style={{
                  background: '#059669',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                }}>
                  Meta Cumplida: 108%
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, lineHeight: 1.45 }}>
                La cartera actual asciende a <strong style={{ color: '#ffffff' }}>{formatMoney(summary.totalVentas)}</strong> distribuidos en <strong style={{ color: '#ffffff' }}>{summary.totalEvents} eventos</strong>.
                El segmento institucional representa una parte sustancial de los fondos comprometidos en los salones principales, con una proyección de cierre positiva para el trimestre en curso.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => navigate('/informes')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              Auditoría de Checklist
            </button>

            <button
              type="button"
              onClick={() => navigate('/calendar')}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: '#2563eb',
                border: 'none',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37,99,235,0.4)',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
              onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
            >
              Ver Pipeline Kanban
            </button>
          </div>
        </div>

        {/* ── FOOTER FORMAL ── */}
        <footer style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#94a3b8',
          borderTop: '1px solid #e2e8f0',
          paddingTop: '16px',
          marginTop: '6px',
        }}>
          <div>
            EMS Reservas © {currentYear} Jardines del Lago. Sistema de Control Operativo y Facturación Hotelera.
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span>v4.8.2-prod</span>
            <span>•</span>
            <span>Soporte TI</span>
            <span>•</span>
            <span>Manual de Procedimientos</span>
          </div>
        </footer>

      </main>

      {/* ── MODAL DE CONFIGURACIÓN DE COLUMNAS EJECUTIVO ── */}
      {showColModal && (
        <div
          onClick={() => setShowColModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(15,23,42,0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'rvModalBackdropFade 0.18s ease-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px solid rgba(226, 232, 240, 0.95)',
              width: '100%',
              maxWidth: '580px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(15, 23, 42, 0.05)',
              overflow: 'hidden',
              animation: 'rvModalFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Barra superior con degradado */}
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #2563eb, #38bdf8, #818cf8)' }} />

            {/* Cabecera del modal */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                  border: '1px solid #bfdbfe',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.12)',
                }}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v18" />
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M3 15h18" />
                  </svg>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                      Configurar Columnas Visibles
                    </h3>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      background: isAnyHidden ? '#eff6ff' : '#ecfdf5',
                      color: isAnyHidden ? '#1d4ed8' : '#059669',
                      border: `1px solid ${isAnyHidden ? '#bfdbfe' : '#a7f3d0'}`,
                    }}>
                      {visibleCount} de {totalColumns} visibles
                    </span>
                  </div>
                  <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 0' }}>
                    Personaliza la visualización de la tabla de operaciones según tu necesidad.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowColModal(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '16px',
                  lineHeight: 1,
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fee2e2';
                  e.currentTarget.style.color = '#dc2626';
                  e.currentTarget.style.borderColor = '#fca5a5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            {/* Barra de acciones rápidas */}
            <div style={{
              padding: '10px 24px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Acciones rápidas:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleSelectAllColumns}
                  className="rv-col-action-btn"
                  style={{
                    padding: '4px 10px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Mostrar todas
                </button>
                <button
                  type="button"
                  onClick={handleSelectMinimalColumns}
                  className="rv-col-action-btn"
                  style={{
                    padding: '4px 10px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Esenciales
                </button>
                <button
                  type="button"
                  onClick={handleResetColumns}
                  className="rv-col-action-btn"
                  style={{
                    padding: '4px 10px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  Restablecer
                </button>
              </div>
            </div>

            {/* Grid interactivo de Columnas */}
            <div style={{
              padding: '16px 24px',
              overflowY: 'auto',
              maxHeight: 'calc(92vh - 220px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '10px',
            }}>
              {COLUMN_DEFINITIONS.map(col => {
                const isChecked = Boolean(visibleColumns[col.key]);
                return (
                  <div
                    key={col.key}
                    role="switch"
                    aria-checked={isChecked}
                    tabIndex={0}
                    onClick={() => handleToggleColumn(col.key)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        handleToggleColumn(col.key);
                      }
                    }}
                    className="rv-col-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: `1.5px solid ${isChecked ? '#93c5fd' : '#e2e8f0'}`,
                      background: isChecked ? 'linear-gradient(180deg, #f8faff 0%, #eff6ff 100%)' : '#ffffff',
                      cursor: 'pointer',
                      userSelect: 'none',
                      boxShadow: isChecked ? '0 2px 8px rgba(37, 99, 235, 0.08)' : '0 1px 2px rgba(0,0,0,0.02)',
                      transition: 'all 0.16s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {/* Icono + Información */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '9px',
                        background: isChecked ? col.iconBg : '#f1f5f9',
                        color: isChecked ? col.iconColor : '#94a3b8',
                        border: `1px solid ${isChecked ? col.iconBg : '#e2e8f0'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.18s ease',
                      }}>
                        {col.icon}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: '12.5px',
                          fontWeight: 700,
                          color: isChecked ? '#0f172a' : '#64748b',
                          letterSpacing: '-0.01em',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {col.label}
                        </div>
                        <div style={{
                          fontSize: '10.5px',
                          color: isChecked ? '#64748b' : '#94a3b8',
                          marginTop: '1px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {col.description}
                        </div>
                      </div>
                    </div>

                    {/* Switch Toggle estilizado (Sin inputs crudos de navegador) */}
                    <div style={{
                      width: '36px',
                      height: '22px',
                      borderRadius: '9999px',
                      background: isChecked ? '#2563eb' : '#cbd5e1',
                      position: 'relative',
                      flexShrink: 0,
                      transition: 'background 0.2s ease, box-shadow 0.2s ease',
                      boxShadow: isChecked ? '0 2px 6px rgba(37, 99, 235, 0.35)' : 'none',
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        position: 'absolute',
                        top: '3px',
                        left: isChecked ? '17px' : '3px',
                        transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {isChecked && (
                          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#2563eb" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pie del modal */}
            <div style={{
              padding: '14px 24px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#64748b' }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <span>Preferencias guardadas automáticamente para futuras visitas.</span>
              </div>

              <button
                type="button"
                onClick={() => setShowColModal(false)}
                style={{
                  padding: '8px 22px',
                  borderRadius: '9px',
                  background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
                  border: '1px solid #1d4ed8',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.28)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.38)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.28)';
                }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
