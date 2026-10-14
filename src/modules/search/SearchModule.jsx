import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Filter,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Printer,
  Plus,
  Calendar,
  User,
  DollarSign,
  X,
  Check,
  Eye,
  Edit2,
  Trash2,
  MoreVertical,
  FileText,
  ChevronDown,
  MapPin,
  LayoutList,
  Table
} from 'lucide-react';
import { STATUS_META } from '../calendar/constants';
import './search.css';

const STATUS_DESCRIPTIONS = {
  'Reserva sin Cotizacion': 'Cliente potencial recién agregado, sin cotización creada',
  '1er Cotizacion': 'Se generó la primera cotización, pendiente de revisión',
  'Seguimiento': 'Cotización enviada, en proceso de seguimiento con el cliente',
  'Lista de Espera': 'Cliente interesado pero sin fecha confirmada, en espera',
  'Pre reserva': 'Apartado provisional, pendiente de confirmación final',
  'Perdido': 'Oportunidad cerrada, el cliente no concretó',
  'Confirmado': 'Reserva confirmada y asegurada',
  'Cancelado': 'Reserva cancelada por el cliente o el sistema',
  'Mantenimiento': 'Salón en mantenimiento programado',
  'Mantenimiento Realizado': 'Mantenimiento completado',
};

const ALL_STATUS_KEYS = Object.keys(STATUS_META);

// Helpers para sincronizar con sessionStorage
const readSetFromSession = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw || raw === 'all' || raw === '') return new Set();
    if (raw.startsWith('[')) {
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    }
    return new Set([raw]);
  } catch {
    return new Set();
  }
};

const writeSetToSession = (key, set) => {
  if (!set || set.size === 0) sessionStorage.removeItem(key);
  else sessionStorage.setItem(key, JSON.stringify([...set]));
};

const formatCurrency = (val) => {
  const num = Number(val || 0);
  return 'Q ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function SearchModule() {
  const navigate = useNavigate();
  const outlet = useOutletContext() || {};
  const { events = [], users = [], salones = [] } = outlet;

  // Responsividad móvil
  const [isMobileView, setIsMobileView] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));
  const [mobileViewMode, setMobileViewMode] = useState('cards'); // 'cards' | 'table'

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── 1. Filtros Principales (Data Grid) ──
  const [query, setQuery] = useState(() => sessionStorage.getItem('search_query') || '');
  const [yearFilter, setYearFilter] = useState(() => sessionStorage.getItem('search_year_val') || 'all');
  const [statusFilter, setStatusFilter] = useState(() => readSetFromSession('search_status'));
  const [salonFilter, setSalonFilter] = useState(() => sessionStorage.getItem('search_salon_val') || 'all');
  const [userFilter, setUserFilter] = useState(() => sessionStorage.getItem('search_user_val') || 'all');
  const [dateFrom, setDateFrom] = useState(() => sessionStorage.getItem('search_date_from') || '');
  const [dateTo, setDateTo] = useState(() => sessionStorage.getItem('search_date_to') || '');

  // Filtros específicos por columna
  const [colFilterDoc, setColFilterDoc] = useState('');
  const [colFilterEvent, setColFilterEvent] = useState('');
  const [colFilterClient, setColFilterClient] = useState('');
  const [colFilterMinTotal, setColFilterMinTotal] = useState('');
  const [colFilterMaxTotal, setColFilterMaxTotal] = useState('');

  // ── 2. Popover de Filtro por Columna ──
  // 'doc' | 'event' | 'client' | 'user' | 'salon' | 'date' | 'total' | 'status' | null
  const [openColumnFilter, setOpenColumnFilter] = useState(null);
  const [tempStatusFilter, setTempStatusFilter] = useState(() => new Set(statusFilter));
  const [tempUserFilter, setTempUserFilter] = useState(userFilter);
  const [tempSalonFilter, setTempSalonFilter] = useState(salonFilter);
  const [tempDateFrom, setTempDateFrom] = useState(dateFrom);
  const [tempDateTo, setTempDateTo] = useState(dateTo);
  const [tempDocQuery, setTempDocQuery] = useState(colFilterDoc);
  const [tempEventQuery, setTempEventQuery] = useState(colFilterEvent);
  const [tempClientQuery, setTempClientQuery] = useState(colFilterClient);
  const [tempMinTotal, setTempMinTotal] = useState(colFilterMinTotal);
  const [tempMaxTotal, setTempMaxTotal] = useState(colFilterMaxTotal);

  const columnFilterPopRef = useRef(null);
  const popoverAnchorRef = useRef(null);
  const [popoverCoords, setPopoverCoords] = useState(null);
  const searchInputRef = useRef(null);

  // ── 3. Ordenación Dinámica por Columna ──
  // sortField: 'doc' | 'event' | 'client' | 'user' | 'salon' | 'date' | 'total' | 'status' | null
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  // ── 4. Paginación ──
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [gotoPageInput, setGotoPageInput] = useState('');

  // ── 5. Menú de Acciones por Fila ──
  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const actionMenuRef = useRef(null);

  // Atajo Ctrl+K / Cmd+K y tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === 'Escape') {
        setOpenColumnFilter(null);
        setActiveActionMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cerrar popover y menú de acciones al hacer clic fuera
  useEffect(() => {
    const handleDocClick = (e) => {
      if (columnFilterPopRef.current && !columnFilterPopRef.current.contains(e.target)) {
        if (!e.target.closest('.datagrid-th-btn')) {
          setOpenColumnFilter(null);
          setPopoverCoords(null);
          popoverAnchorRef.current = null;
        }
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        if (!e.target.closest('.datagrid-action-btn') && !e.target.closest('.search-mcard-btn-more')) {
          setActiveActionMenu(null);
        }
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  // Persistir filtros principales en sessionStorage
  useEffect(() => {
    if (query) sessionStorage.setItem('search_query', query);
    else sessionStorage.removeItem('search_query');

    if (yearFilter && yearFilter !== 'all') sessionStorage.setItem('search_year_val', yearFilter);
    else sessionStorage.removeItem('search_year_val');

    writeSetToSession('search_status', statusFilter);

    if (salonFilter && salonFilter !== 'all') sessionStorage.setItem('search_salon_val', salonFilter);
    else sessionStorage.removeItem('search_salon_val');

    if (userFilter && userFilter !== 'all') sessionStorage.setItem('search_user_val', userFilter);
    else sessionStorage.removeItem('search_user_val');

    if (dateFrom) sessionStorage.setItem('search_date_from', dateFrom);
    else sessionStorage.removeItem('search_date_from');

    if (dateTo) sessionStorage.setItem('search_date_to', dateTo);
    else sessionStorage.removeItem('search_date_to');
  }, [query, yearFilter, statusFilter, salonFilter, userFilter, dateFrom, dateTo]);

  // Años disponibles calculados
  const availableYears = useMemo(() => {
    const years = new Set();
    const currentYear = new Date().getFullYear();
    years.add(String(currentYear));
    events.forEach(ev => {
      const rawDate = ev._dateStart || ev.start || ev.date;
      if (rawDate && typeof rawDate === 'string') {
        const y = rawDate.slice(0, 4);
        if (/^\d{4}$/.test(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [events]);

  // Procesar y consolidar eventos por reserva completa (evitando duplicar días o slots de la misma reserva)
  const processedEvents = useMemo(() => {
    if (!events || !events.length) return [];

    const getReservationKey = (ev) => {
      if (!ev) return '';
      const gId = String(ev.groupId || ev.id_grupo || ev.idGroup || '').trim();
      if (gId) return `group_${gId}`;

      const qCode = String(ev.quote?.code || '').trim();
      if (qCode) return `quote_${qCode}`;

      const pId = String(ev.parent_id || ev.parentId || '').trim();
      if (pId) return `event_${pId}`;

      return `event_${ev.id}`;
    };

    const extractEventDate = (e) => {
      if (!e) return '';
      const raw = e.start || e.date || e.eventDateStart || e.FechaEvento || '';
      if (typeof raw === 'string' && raw.length >= 10) {
        return raw.slice(0, 10);
      }
      return '';
    };

    const extractEventEndDate = (e) => {
      if (!e) return '';
      const raw = e.end || e.endDate || e.eventDateEnd || e.FechaSalida || e.date || e.start || '';
      if (typeof raw === 'string' && raw.length >= 10) {
        return raw.slice(0, 10);
      }
      return '';
    };

    // Agrupar todos los eventos que pertenecen a la misma reserva
    const groups = new Map();
    events.forEach(ev => {
      const key = getReservationKey(ev);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(ev);
    });

    const consolidated = [];

    groups.forEach((seriesEvents) => {
      // Ordenar cronológicamente
      seriesEvents.sort((a, b) => {
        const dA = extractEventDate(a);
        const dB = extractEventDate(b);
        if (dA !== dB) return dA.localeCompare(dB);
        return String(a.startTime || '').localeCompare(String(b.startTime || ''));
      });

      // Evento canónico o principal
      const primaryEvent = seriesEvents.find(e => e.isPrincipal || e.is_principal)
        || seriesEvents.find(e => e.quote && (e.quote.code || e.quote.total))
        || seriesEvents[0];

      // Fechas y cálculo de jornadas
      const dateSet = new Set();
      let minDate = '';
      let maxDate = '';

      seriesEvents.forEach(e => {
        const dStart = extractEventDate(e);
        const dEnd = extractEventEndDate(e) || dStart;
        if (dStart) {
          dateSet.add(dStart);
          if (!minDate || dStart < minDate) minDate = dStart;
          if (!maxDate || dStart > maxDate) maxDate = dStart;
        }
        if (dEnd) {
          dateSet.add(dEnd);
          if (!minDate || dEnd < minDate) minDate = dEnd;
          if (!maxDate || dEnd > maxDate) maxDate = dEnd;
        }
      });

      const jornadas = Math.max(1, dateSet.size);

      // Salones únicos utilizados en la serie
      const salonSet = new Set();
      seriesEvents.forEach(e => {
        if (Array.isArray(e.salones)) {
          e.salones.forEach(s => {
            if (s && String(s).trim()) salonSet.add(String(s).trim());
          });
        }
        if (e.salon && String(e.salon).trim()) {
          salonSet.add(String(e.salon).trim());
        }
      });
      const uniqueSalones = Array.from(salonSet);
      const explicitMain = String(primaryEvent.mainSalon || primaryEvent.salon || '').trim();
      const mainSalon = explicitMain || uniqueSalones[0] || 'Según Disponibilidad';
      const additionalSalons = uniqueSalones.filter(s => s !== mainSalon);

      // Cotización y Monto canónico
      const quote = primaryEvent.quote || seriesEvents.find(e => e.quote)?.quote || {};
      const totalNum = typeof quote.total === 'number'
        ? quote.total
        : Number(String(quote.total || '0').replace(/[^0-9.-]+/g, '')) || 0;

      // Horarios canónicos
      const startTime = primaryEvent.startTime || seriesEvents[0]?.startTime || '00:00';
      const endTime = primaryEvent.endTime || seriesEvents[seriesEvents.length - 1]?.endTime || '00:00';

      consolidated.push({
        ...primaryEvent,
        _subEvents: seriesEvents,
        _salonList: uniqueSalones.length ? uniqueSalones : [mainSalon],
        salon: mainSalon,
        _additionalSalonsCount: additionalSalons.length,
        _additionalSalonsList: additionalSalons,
        _dateStart: minDate || extractEventDate(primaryEvent),
        _dateEnd: maxDate || extractEventEndDate(primaryEvent) || minDate,
        _jornadas: jornadas,
        startTime,
        endTime,
        quote,
        _totalNum: totalNum
      });
    });

    return consolidated;
  }, [events]);

  // Conteo de eventos por estado
  const statusCounts = useMemo(() => {
    const counts = {};
    ALL_STATUS_KEYS.forEach(k => { counts[k] = 0; });
    processedEvents.forEach(ev => {
      if (counts[ev.status] !== undefined) counts[ev.status]++;
    });
    return counts;
  }, [processedEvents]);

  // Vendedores disponibles
  const sellerUsers = useMemo(() => {
    return (users || []).filter(u => {
      const r = String(u.role || '').toLowerCase();
      return r === 'vendedor' || r === 'admin' || r === 'gerente';
    });
  }, [users]);

  // ── Filtrado Completo del Data Grid ──
  const filteredEvents = useMemo(() => {
    const qLower = query.trim().toLowerCase();

    return processedEvents.filter(ev => {
      const assignedUser = users?.find(u => String(u.id) === String(ev.userId));
      const docCode = ev.quote?.code || ev.id || '';
      const totalNum = typeof ev.quote?.total === 'number'
        ? ev.quote.total
        : Number(String(ev.quote?.total || '0').replace(/[^0-9.-]+/g, '')) || 0;

      // 1. Buscador General por palabra clave
      if (qLower) {
        const matchesQuery =
          String(ev.name || '').toLowerCase().includes(qLower) ||
          String(ev.clientName || '').toLowerCase().includes(qLower) ||
          String(ev.salon || '').toLowerCase().includes(qLower) ||
          String(ev._salonList?.join(' ') || '').toLowerCase().includes(qLower) ||
          String(docCode).toLowerCase().includes(qLower) ||
          String(ev.folio || '').toLowerCase().includes(qLower) ||
          String(assignedUser?.fullName || assignedUser?.name || '').toLowerCase().includes(qLower) ||
          String(ev.clientPhone || '').toLowerCase().includes(qLower);

        if (!matchesQuery) return false;
      }

      // 2. Filtro de Año
      if (yearFilter !== 'all') {
        const startYear = ev._dateStart ? ev._dateStart.slice(0, 4) : '';
        const endYear = ev._dateEnd ? ev._dateEnd.slice(0, 4) : '';
        if (startYear !== yearFilter && endYear !== yearFilter) return false;
      }

      // 3. Filtro de Estados
      if (statusFilter.size > 0 && !statusFilter.has(ev.status)) {
        return false;
      }

      // 4. Filtro de Salón
      if (salonFilter !== 'all') {
        const inSalon = ev._salonList?.includes(salonFilter) || ev.salon === salonFilter;
        if (!inSalon) return false;
      }

      // 5. Filtro de Vendedor
      if (userFilter !== 'all' && String(ev.userId) !== String(userFilter)) {
        return false;
      }

      // 6. Rango de Fechas
      if (dateFrom && ev._dateEnd && ev._dateEnd < dateFrom) return false;
      if (dateTo && ev._dateStart && ev._dateStart > dateTo) return false;

      // 7. Filtros específicos por columna
      if (colFilterDoc.trim() && !String(docCode).toLowerCase().includes(colFilterDoc.trim().toLowerCase())) {
        return false;
      }
      if (colFilterEvent.trim() && !String(ev.name || '').toLowerCase().includes(colFilterEvent.trim().toLowerCase())) {
        return false;
      }
      if (colFilterClient.trim() && !String(ev.clientName || '').toLowerCase().includes(colFilterClient.trim().toLowerCase())) {
        return false;
      }
      if (colFilterMinTotal !== '' && totalNum < Number(colFilterMinTotal)) {
        return false;
      }
      if (colFilterMaxTotal !== '' && totalNum > Number(colFilterMaxTotal)) {
        return false;
      }

      return true;
    });
  }, [
    processedEvents,
    query,
    yearFilter,
    statusFilter,
    salonFilter,
    userFilter,
    dateFrom,
    dateTo,
    colFilterDoc,
    colFilterEvent,
    colFilterClient,
    colFilterMinTotal,
    colFilterMaxTotal,
    users
  ]);

  // ── Ordenación Dinámica por Columna ──
  const sortedEvents = useMemo(() => {
    if (!sortField) return filteredEvents;

    return [...filteredEvents].sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortField === 'doc') {
        valA = String(a.quote?.code || a.id || '').toLowerCase();
        valB = String(b.quote?.code || b.id || '').toLowerCase();
      } else if (sortField === 'event') {
        valA = String(a.name || '').toLowerCase();
        valB = String(b.name || '').toLowerCase();
      } else if (sortField === 'client') {
        valA = String(a.clientName || '').toLowerCase();
        valB = String(b.clientName || '').toLowerCase();
      } else if (sortField === 'user') {
        const uA = users?.find(u => String(u.id) === String(a.userId));
        const uB = users?.find(u => String(u.id) === String(b.userId));
        valA = String(uA?.fullName || uA?.name || '').toLowerCase();
        valB = String(uB?.fullName || uB?.name || '').toLowerCase();
      } else if (sortField === 'salon') {
        valA = String(a._salonList?.join(', ') || a.salon || '').toLowerCase();
        valB = String(b._salonList?.join(', ') || b.salon || '').toLowerCase();
      } else if (sortField === 'date') {
        valA = a._dateStart || '';
        valB = b._dateStart || '';
      } else if (sortField === 'total') {
        const numA = typeof a.quote?.total === 'number' ? a.quote.total : Number(String(a.quote?.total || '0').replace(/[^0-9.-]+/g, '')) || 0;
        const numB = typeof b.quote?.total === 'number' ? b.quote.total : Number(String(b.quote?.total || '0').replace(/[^0-9.-]+/g, '')) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      } else if (sortField === 'status') {
        valA = String(a.status || '').toLowerCase();
        valB = String(b.status || '').toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEvents, sortField, sortDirection, users]);

  // Paginación
  const totalItems = sortedEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedEvents = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return sortedEvents.slice(start, start + pageSize);
  }, [sortedEvents, validCurrentPage, pageSize]);

  // Alternar ordenamiento por columna
  const handleToggleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'date' || field === 'total' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  // Limpiar absolutamente todos los filtros
  const clearAllFilters = useCallback(() => {
    setQuery('');
    setYearFilter('all');
    setStatusFilter(new Set());
    setSalonFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
    setColFilterDoc('');
    setColFilterEvent('');
    setColFilterClient('');
    setColFilterMinTotal('');
    setColFilterMaxTotal('');
    setCurrentPage(1);
    setOpenColumnFilter(null);
  }, []);

  // Verificar si hay filtros activos
  const hasActiveFilters = Boolean(
    query ||
    yearFilter !== 'all' ||
    statusFilter.size > 0 ||
    salonFilter !== 'all' ||
    userFilter !== 'all' ||
    dateFrom ||
    dateTo ||
    colFilterDoc ||
    colFilterEvent ||
    colFilterClient ||
    colFilterMinTotal !== '' ||
    colFilterMaxTotal !== ''
  );

  // Calcular posición del popover respecto a la ventana del navegador
  const calculatePopoverCoords = (buttonEl, colKey) => {
    if (!buttonEl) return null;
    const rect = buttonEl.getBoundingClientRect();
    const popoverWidth = colKey === 'status' ? 300 : (colKey === 'user' || colKey === 'salon' ? 290 : 310);

    // Posición horizontal calculada respecto a la ventana (evita desbordes)
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = Math.max(16, rect.right - popoverWidth);
    }
    if (left < 16) left = 16;

    let top = rect.bottom + 6;
    // Si no cabe hacia abajo en la pantalla, abrir hacia arriba
    const estimatedHeight = colKey === 'status' ? 380 : (colKey === 'date' ? 240 : 200);
    if (top + estimatedHeight > window.innerHeight && rect.top > estimatedHeight) {
      top = Math.max(10, rect.top - estimatedHeight - 6);
    }

    return { top, left };
  };

  // Abrir popover de columna inicializando estados temporales
  const handleOpenColFilter = (colKey, e) => {
    if (openColumnFilter === colKey) {
      setOpenColumnFilter(null);
      setPopoverCoords(null);
      popoverAnchorRef.current = null;
      return;
    }

    const buttonEl = e?.currentTarget || null;
    popoverAnchorRef.current = buttonEl;
    if (buttonEl) {
      setPopoverCoords(calculatePopoverCoords(buttonEl, colKey));
    }

    if (colKey === 'status') setTempStatusFilter(new Set(statusFilter));
    if (colKey === 'user') setTempUserFilter(userFilter);
    if (colKey === 'salon') setTempSalonFilter(salonFilter);
    if (colKey === 'date') {
      setTempDateFrom(dateFrom);
      setTempDateTo(dateTo);
    }
    if (colKey === 'doc') setTempDocQuery(colFilterDoc);
    if (colKey === 'event') setTempEventQuery(colFilterEvent);
    if (colKey === 'client') setTempClientQuery(colFilterClient);
    if (colKey === 'total') {
      setTempMinTotal(colFilterMinTotal);
      setTempMaxTotal(colFilterMaxTotal);
    }
    setOpenColumnFilter(colKey);
  };

  // Reposicionar el popover dinámicamente si el usuario hace scroll o cambia de tamaño la pantalla
  useEffect(() => {
    if (!openColumnFilter || !popoverAnchorRef.current) return;
    const handleReposition = () => {
      const coords = calculatePopoverCoords(popoverAnchorRef.current, openColumnFilter);
      if (coords) setPopoverCoords(coords);
    };

    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [openColumnFilter]);

  // Salto rápido a página
  const handleGoToPage = () => {
    const target = parseInt(gotoPageInput, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      setCurrentPage(target);
      setGotoPageInput('');
    }
  };

  // Imprimir vista del Data Grid
  const handlePrint = () => {
    window.print();
  };

  // Exportar Excel profesional (.xlsx)
  const handleExportExcel = async () => {
    const now = new Date();
    const nowStr = now.toISOString().slice(0, 10);
    const fechaGen = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    try {
      const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'CRM Jardines del Lago';
      workbook.created = now;

      const worksheet = workbook.addWorksheet('Eventos DataGrid', {
        views: [{ showGridLines: true }]
      });

      // ── 1. Banner Superior Institucional ──
      worksheet.mergeCells('A1:K1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'JARDINES DEL LAGO — EXPLORADOR DE EVENTOS';
      titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1D4ED8' } // Azul corporativo DataGrid
      };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 34;

      // ── 2. Metadatos del Reporte ──
      worksheet.mergeCells('A2:K2');
      const subCell = worksheet.getCell('A2');

      const filterSegments = [];
      if (query) filterSegments.push(`Keywords: "${query}"`);
      if (yearFilter !== 'all') filterSegments.push(`Año: ${yearFilter}`);
      if (statusFilter.size > 0) filterSegments.push(`Estados: ${[...statusFilter].join(', ')}`);
      if (salonFilter !== 'all') filterSegments.push(`Salón: ${salonFilter}`);
      if (userFilter !== 'all') {
        const uObj = users?.find(u => String(u.id) === String(userFilter));
        filterSegments.push(`Vendedor: ${uObj?.fullName || uObj?.name || userFilter}`);
      }
      if (dateFrom || dateTo) filterSegments.push(`Fechas: ${dateFrom || 'Inicio'} a ${dateTo || 'Fin'}`);

      const filtrosStr = filterSegments.length > 0 ? filterSegments.join('  |  ') : 'Todos los registros (sin filtros)';
      subCell.value = `Generado el: ${fechaGen}   •   Total de registros: ${sortedEvents.length}   •   ${filtrosStr}`;
      subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF475569' } };
      subCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }
      };
      subCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 20;

      // Fila 3 en blanco
      worksheet.getRow(3).height = 8;

      // ── 3. Encabezados de Columnas ──
      const columnsDef = [
        { header: 'No. Doc', width: 16, align: 'center' },
        { header: 'Nombre del Evento', width: 34, align: 'left' },
        { header: 'Cliente / Empresa', width: 28, align: 'left' },
        { header: 'Teléfono', width: 16, align: 'center' },
        { header: 'Vendedor Responsable', width: 24, align: 'left' },
        { header: 'Salón(es)', width: 22, align: 'left' },
        { header: 'Fecha Inicio', width: 14, align: 'center' },
        { header: 'Fecha Fin', width: 14, align: 'center' },
        { header: 'Horario', width: 16, align: 'center' },
        { header: 'Estado', width: 18, align: 'center' },
        { header: 'Total Cotización (GTQ)', width: 22, align: 'right' }
      ];

      const headerRow = worksheet.getRow(4);
      headerRow.height = 28;

      columnsDef.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = col.header;
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2563EB' }
        };
        cell.alignment = { vertical: 'middle', horizontal: col.align };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF1D4ED8' } },
          bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
          left: { style: 'thin', color: { argb: 'FF93C5FD' } },
          right: { style: 'thin', color: { argb: 'FF93C5FD' } }
        };
        worksheet.getColumn(idx + 1).width = col.width;
      });

      // ── 4. Filas de Datos ──
      const thinCellBorder = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      sortedEvents.forEach((ev, rowIdx) => {
        const assignedUser = users?.find(u => String(u.id) === String(ev.userId));
        const docCode = ev.quote?.code || ev.id || '-';
        const totalNum = typeof ev.quote?.total === 'number'
          ? ev.quote.total
          : Number(String(ev.quote?.total || '0').replace(/[^0-9.-]+/g, '')) || 0;

        const row = worksheet.addRow([
          docCode,
          ev.name || '',
          ev.clientName || '',
          ev.clientPhone || '',
          assignedUser?.fullName || assignedUser?.name || 'Sin asignar',
          ev._salonList?.join(', ') || ev.salon || 'Según Disponibilidad',
          ev._dateStart || '',
          ev._dateEnd || '',
          `${ev.startTime || ''} - ${ev.endTime || ''}`,
          ev.status || '',
          totalNum
        ]);

        row.height = 22;
        const isEven = rowIdx % 2 === 0;
        const bgArgb = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.border = thinCellBorder;
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgArgb }
          };
          cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF0F172A' } };

          const colDef = columnsDef[colNumber - 1];
          cell.alignment = { vertical: 'middle', horizontal: colDef?.align || 'left' };

          if (colNumber === 1) {
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF2563EB' } };
          } else if (colNumber === 11) {
            cell.numFmt = '"Q"#,##0.00';
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF059669' } };
          }
        });
      });

      // ── 5. Total General ──
      const totalRowIndex = 4 + sortedEvents.length + 1;
      const totalRow = worksheet.getRow(totalRowIndex);
      totalRow.height = 26;

      worksheet.mergeCells(`A${totalRowIndex}:J${totalRowIndex}`);
      const totalLabelCell = worksheet.getCell(`A${totalRowIndex}`);
      totalLabelCell.value = 'TOTAL GENERAL:';
      totalLabelCell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
      totalLabelCell.alignment = { vertical: 'middle', horizontal: 'right' };
      totalLabelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }
      };

      for (let c = 1; c <= 10; c++) {
        worksheet.getCell(totalRowIndex, c).border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'double', color: { argb: 'FF0F172A' } }
        };
      }

      const totalValCell = worksheet.getCell(`K${totalRowIndex}`);
      totalValCell.value = { formula: `SUM(K5:K${totalRowIndex - 1})` };
      totalValCell.numFmt = '"Q"#,##0.00';
      totalValCell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF1D4ED8' } };
      totalValCell.alignment = { vertical: 'middle', horizontal: 'right' };
      totalValCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFF6FF' }
      };
      totalValCell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF1D4ED8' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      // ── 6. Autofiltros ──
      worksheet.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4, column: 11 }
      };

      // ── 7. Descarga segura ──
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = downloadUrl;
      downloadAnchor.download = `Eventos_DataGrid_JDL_${nowStr}.xlsx`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.warn('Error al exportar con ExcelJS, ejecutando fallback básico:', err);
      const data = sortedEvents.map(ev => {
        const assignedUser = users?.find(u => String(u.id) === String(ev.userId));
        const docCode = ev.quote?.code || ev.id || '-';
        return {
          'No. Doc': docCode,
          'Nombre del Evento': ev.name || '',
          'Cliente': ev.clientName || '',
          'Teléfono': ev.clientPhone || '',
          'Vendedor / Responsable': assignedUser?.fullName || assignedUser?.name || 'Sin asignar',
          'Salón(es)': ev._salonList?.join(', ') || ev.salon || 'Según Disponibilidad',
          'Fecha Inicio': ev._dateStart || '',
          'Fecha Fin': ev._dateEnd || '',
          'Horario': `${ev.startTime || ''} - ${ev.endTime || ''}`,
          'Estado': ev.status || '',
          'Total Cotización (Q)': ev.quote?.total || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Eventos');
      XLSX.writeFile(wb, `Eventos_DataGrid_JDL_${nowStr}.xlsx`);
    }
  };

  const getStatusColor = (status) => STATUS_META[status]?.color || '#64748b';

  return (
    <div className="search-page-saas">
      <div className="search-saas-container">

        {/* ── 1. COMPONENTE PRINCIPAL DATAGRID ── */}
        <div className="datagrid-wrapper">

          {/* ── TOPBAR SUPERIOR (Fiel a la referencia) ── */}
          <div className="datagrid-topbar">
            <div className="datagrid-topbar-title-wrap">
              <h2 className="datagrid-title">Búsqueda de Eventos</h2>
            </div>

            <div className="datagrid-topbar-actions">
              {/* Buscador General por palabra clave */}
              <div className="datagrid-search-box">
                <Search size={15} className="datagrid-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="datagrid-search-input"
                  placeholder="Buscar cliente, evento o no. doc..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  autoComplete="off"
                />
                {!query && (
                  <kbd className="datagrid-search-kbd">Ctrl K</kbd>
                )}
                {query && (
                  <button
                    type="button"
                    className="datagrid-search-clear"
                    onClick={() => {
                      setQuery('');
                      setCurrentPage(1);
                    }}
                    title="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Selector de Año / Período */}
              <select
                className="datagrid-year-select"
                value={yearFilter}
                onChange={(e) => {
                  setYearFilter(e.target.value);
                  setCurrentPage(1);
                }}
                title="Filtrar por año"
              >
                <option value="all">Todos los años</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {/* Botón Exportar a Excel (Verde) */}
              <button
                type="button"
                className="datagrid-tool-btn datagrid-tool-btn--excel"
                onClick={handleExportExcel}
                title="Exportar a Excel (.xlsx)"
              >
                <Download size={16} strokeWidth={2.4} />
              </button>

              {/* Botón Imprimir (Rojo) */}
              <button
                type="button"
                className="datagrid-tool-btn datagrid-tool-btn--print"
                onClick={handlePrint}
                title="Imprimir vista de la tabla"
              >
                <Printer size={16} strokeWidth={2.4} />
              </button>

              {/* Botón Nueva Cotización */}
              <button
                type="button"
                className="search-btn-new-quote"
                onClick={() => navigate('/nueva-reserva')}
                title="Crear nueva reserva / cotización"
                style={{ height: 38 }}
              >
                <Plus size={18} strokeWidth={2.6} />
                <span className="search-btn-new-quote-label">Nueva Cotización</span>
              </button>
            </div>
          </div>

          {/* Conmutador de vista en versión móvil */}
          {isMobileView && (
            <div className="datagrid-mobile-controls-bar">
              <div className="datagrid-mobile-view-toggle">
                <button
                  type="button"
                  className={`datagrid-view-toggle-btn ${mobileViewMode === 'cards' ? 'is-active' : ''}`}
                  onClick={() => setMobileViewMode('cards')}
                  title="Vista en tarjetas"
                >
                  <LayoutList size={14} />
                  <span>Tarjetas</span>
                </button>
                <button
                  type="button"
                  className={`datagrid-view-toggle-btn ${mobileViewMode === 'table' ? 'is-active' : ''}`}
                  onClick={() => setMobileViewMode('table')}
                  title="Vista en tabla"
                >
                  <Table size={14} />
                  <span>Tabla</span>
                </button>
              </div>
              <div className="datagrid-mobile-count-pill">
                <strong>{totalItems}</strong> {totalItems === 1 ? 'evento' : 'eventos'}
              </div>
            </div>
          )}

          {/* ── BARRA DE CHIPS DE FILTROS ACTIVOS CON BOTÓN LIMPIAR TODO ── */}
          {hasActiveFilters && (
            <div className="datagrid-active-filters-bar">
              <div className="datagrid-filters-label">
                <Filter size={14} strokeWidth={2.5} />
                <span>Filtros</span>
              </div>

              <div className="datagrid-chips-wrap">
                {/* Chip de Búsqueda Global */}
                {query && (
                  <span className="datagrid-chip">
                    <span>Búsqueda : {query}</span>
                    <button
                      type="button"
                      className="datagrid-chip-remove"
                      onClick={() => { setQuery(''); setCurrentPage(1); }}
                      title="Quitar filtro de texto"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Chip de Año */}
                {yearFilter !== 'all' && (
                  <span className="datagrid-chip">
                    <span>Año : {yearFilter}</span>
                    <button
                      type="button"
                      className="datagrid-chip-remove"
                      onClick={() => { setYearFilter('all'); setCurrentPage(1); }}
                      title="Quitar filtro de año"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Chips de Estados */}
                {statusFilter.size > 0 && (
                  <span className="datagrid-chip">
                    <span>Estado : {Array.from(statusFilter).join(', ')}</span>
                    <button
                      type="button"
                      className="datagrid-chip-remove"
                      onClick={() => { setStatusFilter(new Set()); setCurrentPage(1); }}
                      title="Quitar filtro de estados"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Chip de Salón */}
                {salonFilter !== 'all' && (
                  <span className="datagrid-chip">
                    <span>Salón : {salonFilter}</span>
                    <button
                      type="button"
                      className="datagrid-chip-remove"
                      onClick={() => { setSalonFilter('all'); setCurrentPage(1); }}
                      title="Quitar filtro de salón"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Chip de Vendedor */}
                {userFilter !== 'all' && (
                  <span className="datagrid-chip">
                    <span>
                      Vendedor : {users?.find(u => String(u.id) === String(userFilter))?.fullName || userFilter}
                    </span>
                    <button
                      type="button"
                      className="datagrid-chip-remove"
                      onClick={() => { setUserFilter('all'); setCurrentPage(1); }}
                      title="Quitar filtro de vendedor"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Chip de Fechas */}
                {(dateFrom || dateTo) && (
                  <span className="datagrid-chip">
                    <span>Fechas : {dateFrom || 'Inicio'} a {dateTo || 'Fin'}</span>
                    <button
                      type="button"
                      className="datagrid-chip-remove"
                      onClick={() => { setDateFrom(''); setDateTo(''); setCurrentPage(1); }}
                      title="Quitar filtro de fechas"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Chip de Columna: No. Doc */}
                {colFilterDoc && (
                  <span className="datagrid-chip">
                    <span>No. Doc : {colFilterDoc}</span>
                    <button
                      type="button"
                      className="datagrid-chip-remove"
                      onClick={() => { setColFilterDoc(''); setCurrentPage(1); }}
                      title="Quitar filtro de documento"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Chip de Columna: Evento */}
                {colFilterEvent && (
                  <span className="datagrid-chip">
                    <span>Evento : {colFilterEvent}</span>
                    <button
                      type="button"
                      className="datagrid-chip-remove"
                      onClick={() => { setColFilterEvent(''); setCurrentPage(1); }}
                      title="Quitar filtro de evento"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Chip de Columna: Cliente */}
                {colFilterClient && (
                  <span className="datagrid-chip">
                    <span>Cliente : {colFilterClient}</span>
                    <button
                      type="button"
                      className="datagrid-chip-remove"
                      onClick={() => { setColFilterClient(''); setCurrentPage(1); }}
                      title="Quitar filtro de cliente"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Chip de Columna: Monto Total */}
                {(colFilterMinTotal !== '' || colFilterMaxTotal !== '') && (
                  <span className="datagrid-chip">
                    <span>Total : Q {colFilterMinTotal || '0'} a Q {colFilterMaxTotal || '∞'}</span>
                    <button
                      type="button"
                      className="datagrid-chip-remove"
                      onClick={() => { setColFilterMinTotal(''); setColFilterMaxTotal(''); setCurrentPage(1); }}
                      title="Quitar filtro de monto"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Botón Dorado Ámbar Limpiar Todo */}
                <button
                  type="button"
                  className="datagrid-btn-clear-all"
                  onClick={clearAllFilters}
                  title="Limpiar todos los filtros aplicados"
                >
                  Limpiar Todo
                </button>
              </div>
            </div>
          )}

          {/* ── 2. VISTA DE DATOS (MÓVIL EN TARJETAS O TABLA DATA GRID) ── */}
          {isMobileView && mobileViewMode === 'cards' ? (
            <div className="datagrid-mobile-cards-container">
              {paginatedEvents.length === 0 ? (
                <div className="datagrid-mobile-empty">
                  <Search size={32} color="#94a3b8" />
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    No se encontraron eventos
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    Intenta ajustar o limpiar tus filtros de búsqueda.
                  </div>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      className="datagrid-btn-clear-all"
                      onClick={clearAllFilters}
                      style={{ marginTop: 6 }}
                    >
                      Restablecer todos los filtros
                    </button>
                  )}
                </div>
              ) : (
                paginatedEvents.map(ev => {
                  const assignedUser = users?.find(u => String(u.id) === String(ev.userId));
                  const docCode = ev.quote?.code || ev.id?.substring(0, 12) || '-';
                  const isMultiSalon = ev._subEvents?.length > 1;
                  const statusColor = getStatusColor(ev.status);
                  const totalNum = typeof ev.quote?.total === 'number'
                    ? ev.quote.total
                    : Number(String(ev.quote?.total || '0').replace(/[^0-9.-]+/g, '')) || 0;

                  return (
                    <div key={ev.id} className="search-mobile-card">
                      {/* Cabecera de la tarjeta: No. Doc + Estado + Total */}
                      <div className="search-mcard-topbar">
                        <div className="search-mcard-tags">
                          <span
                            className="datagrid-doc-pill"
                            onClick={() => navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`, { state: { from: 'search' } })}
                            title="Ver detalles de la reserva"
                          >
                            {docCode}
                          </span>
                          <span
                            className="datagrid-status-pill"
                            style={{
                              background: `${statusColor}18`,
                              color: statusColor,
                              borderColor: `${statusColor}40`
                            }}
                            title={STATUS_DESCRIPTIONS[ev.status] || ev.status}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                            <span>{ev.status}</span>
                          </span>
                        </div>
                        <div className="search-mcard-total">
                          {formatCurrency(totalNum)}
                        </div>
                      </div>

                      {/* Nombre del Evento */}
                      <h4
                        className="search-mcard-title"
                        onClick={() => navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`, { state: { from: 'search' } })}
                      >
                        {ev.name || 'Sin Título'}
                      </h4>

                      {/* Metadatos */}
                      <div className="search-mcard-meta-list">
                        <div className="search-mcard-meta-item">
                          <User size={13} className="search-mcard-icon" />
                          <span className="search-mcard-meta-val">{ev.clientName || 'Particular'}</span>
                        </div>

                        <div className="search-mcard-meta-item">
                          <Calendar size={13} className="search-mcard-icon" />
                          <span className="search-mcard-meta-val">
                            {ev._dateStart || '—'}{ev._dateStart !== ev._dateEnd && ev._dateEnd ? ` al ${ev._dateEnd}` : ''}
                            {ev._jornadas > 1 && (
                              <span className="datagrid-jornadas-badge" style={{ marginLeft: 6 }}>
                                {ev._jornadas} Jornadas
                              </span>
                            )}
                            <span className="search-mcard-time"> • {ev.startTime || '00:00'} - {ev.endTime || '00:00'}</span>
                          </span>
                        </div>

                        <div className="search-mcard-meta-item">
                          <MapPin size={13} className="search-mcard-icon" />
                          <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span className="datagrid-salon-pill">{ev.salon || 'Según Disponibilidad'}</span>
                            {ev._additionalSalonsCount > 0 && (
                              <span
                                className="datagrid-salon-more-pill"
                                title={`Otros espacios: ${ev._additionalSalonsList.join(', ')}`}
                              >
                                +{ev._additionalSalonsCount} más
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="search-mcard-meta-item">
                          <div className="datagrid-user-cell" style={{ margin: 0 }}>
                            <div className="datagrid-user-avatar" style={{ width: 22, height: 22, fontSize: 10 }}>
                              {getInitials(assignedUser?.fullName || assignedUser?.name || 'Sin asignar')}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                              {assignedUser?.fullName || assignedUser?.name || 'Sin asignar'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Acciones al pie */}
                      <div className="search-mcard-actions">
                        <button
                          type="button"
                          className="search-mcard-btn-view"
                          onClick={() => navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`, { state: { from: 'search' } })}
                        >
                          <Eye size={14} />
                          <span>Ver Detalle</span>
                        </button>

                        <button
                          type="button"
                          className="search-mcard-btn-edit"
                          onClick={() => navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`, { state: { from: 'search', edit: true } })}
                          title="Editar reserva"
                        >
                          <Edit2 size={13} />
                          <span>Editar</span>
                        </button>

                        <div style={{ position: 'relative' }} ref={activeActionMenu === `m-${ev.id}` ? actionMenuRef : null}>
                          <button
                            type="button"
                            className="search-mcard-btn-more"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMenu(activeActionMenu === `m-${ev.id}` ? null : `m-${ev.id}`);
                            }}
                            title="Más opciones"
                          >
                            <MoreVertical size={15} />
                          </button>

                          {activeActionMenu === `m-${ev.id}` && (
                            <div className="action-dropdown-popover" style={{ right: 0, bottom: '100%', marginBottom: 6, zIndex: 100 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenu(null);
                                  navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`);
                                }}
                              >
                                <FileText size={14} />
                                <span>Ver Detalles</span>
                              </button>
                              {ev.quote?.id && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenu(null);
                                    navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}?tab=quote`);
                                  }}
                                >
                                  <DollarSign size={14} />
                                  <span>Ver Cotización</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenu(null);
                                  navigator.clipboard.writeText(docCode);
                                }}
                              >
                                <Check size={14} />
                                <span>Copiar No. Doc</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="datagrid-table-container">
              <table className="datagrid-table">
              <thead style={{ backgroundColor: '#2563eb' }}>
                <tr style={{ backgroundColor: '#2563eb' }}>
                  {/* 1. NO. DOC */}
                  <th className="datagrid-th" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>
                    <div className="datagrid-th-inner">
                      <span className="datagrid-th-title">No. Doc</span>
                      <div className="datagrid-th-actions">
                        <button
                          type="button"
                          className="datagrid-th-btn"
                          onClick={() => handleToggleSort('doc')}
                          title="Ordenar por No. Doc"
                        >
                          {sortField === 'doc' ? (
                            sortDirection === 'asc' ? <ArrowUp size={11} strokeWidth={2.6} /> : <ArrowDown size={11} strokeWidth={2.6} />
                          ) : (
                            <ArrowUpDown size={11} strokeWidth={2.2} />
                          )}
                        </button>
                        <button
                          type="button"
                          className={`datagrid-th-btn ${colFilterDoc ? 'is-active' : ''}`}
                          onClick={(e) => handleOpenColFilter('doc', e)}
                          title="Filtrar por No. Doc"
                        >
                          <Filter size={11} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                  </th>

                  {/* 2. EVENTO */}
                  <th className="datagrid-th" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>
                    <div className="datagrid-th-inner">
                      <span className="datagrid-th-title">Evento</span>
                      <div className="datagrid-th-actions">
                        <button
                          type="button"
                          className="datagrid-th-btn"
                          onClick={() => handleToggleSort('event')}
                          title="Ordenar por Nombre de Evento"
                        >
                          {sortField === 'event' ? (
                            sortDirection === 'asc' ? <ArrowUp size={11} strokeWidth={2.6} /> : <ArrowDown size={11} strokeWidth={2.6} />
                          ) : (
                            <ArrowUpDown size={11} strokeWidth={2.2} />
                          )}
                        </button>
                        <button
                          type="button"
                          className={`datagrid-th-btn ${colFilterEvent ? 'is-active' : ''}`}
                          onClick={(e) => handleOpenColFilter('event', e)}
                          title="Filtrar por Nombre de Evento"
                        >
                          <Filter size={11} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                  </th>

                  {/* 3. CLIENTE / EMPRESA */}
                  <th className="datagrid-th" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>
                    <div className="datagrid-th-inner">
                      <span className="datagrid-th-title">Cliente / Empresa</span>
                      <div className="datagrid-th-actions">
                        <button
                          type="button"
                          className="datagrid-th-btn"
                          onClick={() => handleToggleSort('client')}
                          title="Ordenar por Cliente"
                        >
                          {sortField === 'client' ? (
                            sortDirection === 'asc' ? <ArrowUp size={11} strokeWidth={2.6} /> : <ArrowDown size={11} strokeWidth={2.6} />
                          ) : (
                            <ArrowUpDown size={11} strokeWidth={2.2} />
                          )}
                        </button>
                        <button
                          type="button"
                          className={`datagrid-th-btn ${colFilterClient ? 'is-active' : ''}`}
                          onClick={(e) => handleOpenColFilter('client', e)}
                          title="Filtrar por Cliente"
                        >
                          <Filter size={11} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                  </th>

                  {/* 4. VENDEDOR */}
                  <th className="datagrid-th" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>
                    <div className="datagrid-th-inner">
                      <span className="datagrid-th-title">Vendedor</span>
                      <div className="datagrid-th-actions">
                        <button
                          type="button"
                          className="datagrid-th-btn"
                          onClick={() => handleToggleSort('user')}
                          title="Ordenar por Vendedor"
                        >
                          {sortField === 'user' ? (
                            sortDirection === 'asc' ? <ArrowUp size={11} strokeWidth={2.6} /> : <ArrowDown size={11} strokeWidth={2.6} />
                          ) : (
                            <ArrowUpDown size={11} strokeWidth={2.2} />
                          )}
                        </button>
                        <button
                          type="button"
                          className={`datagrid-th-btn ${userFilter !== 'all' ? 'is-active' : ''}`}
                          onClick={(e) => handleOpenColFilter('user', e)}
                          title="Filtrar por Vendedor"
                        >
                          <Filter size={11} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                  </th>

                  {/* 5. SALÓN */}
                  <th className="datagrid-th" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>
                    <div className="datagrid-th-inner">
                      <span className="datagrid-th-title">Salón</span>
                      <div className="datagrid-th-actions">
                        <button
                          type="button"
                          className="datagrid-th-btn"
                          onClick={() => handleToggleSort('salon')}
                          title="Ordenar por Salón"
                        >
                          {sortField === 'salon' ? (
                            sortDirection === 'asc' ? <ArrowUp size={11} strokeWidth={2.6} /> : <ArrowDown size={11} strokeWidth={2.6} />
                          ) : (
                            <ArrowUpDown size={11} strokeWidth={2.2} />
                          )}
                        </button>
                        <button
                          type="button"
                          className={`datagrid-th-btn ${salonFilter !== 'all' ? 'is-active' : ''}`}
                          onClick={(e) => handleOpenColFilter('salon', e)}
                          title="Filtrar por Salón"
                        >
                          <Filter size={11} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                  </th>

                  {/* 6. FECHAS */}
                  <th className="datagrid-th" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>
                    <div className="datagrid-th-inner">
                      <span className="datagrid-th-title">Fechas</span>
                      <div className="datagrid-th-actions">
                        <button
                          type="button"
                          className="datagrid-th-btn"
                          onClick={() => handleToggleSort('date')}
                          title="Ordenar por Fecha"
                        >
                          {sortField === 'date' ? (
                            sortDirection === 'asc' ? <ArrowUp size={11} strokeWidth={2.6} /> : <ArrowDown size={11} strokeWidth={2.6} />
                          ) : (
                            <ArrowUpDown size={11} strokeWidth={2.2} />
                          )}
                        </button>
                        <button
                          type="button"
                          className={`datagrid-th-btn ${(dateFrom || dateTo) ? 'is-active' : ''}`}
                          onClick={(e) => handleOpenColFilter('date', e)}
                          title="Filtrar por Rango de Fechas"
                        >
                          <Filter size={11} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                  </th>

                  {/* 7. TOTAL COTIZACIÓN */}
                  <th className="datagrid-th" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>
                    <div className="datagrid-th-inner">
                      <span className="datagrid-th-title">Total (Q)</span>
                      <div className="datagrid-th-actions">
                        <button
                          type="button"
                          className="datagrid-th-btn"
                          onClick={() => handleToggleSort('total')}
                          title="Ordenar por Monto"
                        >
                          {sortField === 'total' ? (
                            sortDirection === 'asc' ? <ArrowUp size={11} strokeWidth={2.6} /> : <ArrowDown size={11} strokeWidth={2.6} />
                          ) : (
                            <ArrowUpDown size={11} strokeWidth={2.2} />
                          )}
                        </button>
                        <button
                          type="button"
                          className={`datagrid-th-btn ${(colFilterMinTotal !== '' || colFilterMaxTotal !== '') ? 'is-active' : ''}`}
                          onClick={(e) => handleOpenColFilter('total', e)}
                          title="Filtrar por Rango de Monto"
                        >
                          <Filter size={11} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                  </th>

                  {/* 8. ESTADO */}
                  <th className="datagrid-th" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>
                    <div className="datagrid-th-inner">
                      <span className="datagrid-th-title">Estado</span>
                      <div className="datagrid-th-actions">
                        <button
                          type="button"
                          className="datagrid-th-btn"
                          onClick={() => handleToggleSort('status')}
                          title="Ordenar por Estado"
                        >
                          {sortField === 'status' ? (
                            sortDirection === 'asc' ? <ArrowUp size={11} strokeWidth={2.6} /> : <ArrowDown size={11} strokeWidth={2.6} />
                          ) : (
                            <ArrowUpDown size={11} strokeWidth={2.2} />
                          )}
                        </button>
                        <button
                          type="button"
                          className={`datagrid-th-btn ${statusFilter.size > 0 ? 'is-active' : ''}`}
                          onClick={(e) => handleOpenColFilter('status', e)}
                          title="Filtrar por Estados"
                        >
                          <Filter size={11} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                  </th>

                  {/* 9. ACCIÓN */}
                  <th className="datagrid-th" style={{ textAlign: 'center', width: 110, backgroundColor: '#2563eb', color: '#ffffff' }}>
                    <span className="datagrid-th-title">Acción</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginatedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <Search size={32} color="#94a3b8" />
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                          No se encontraron eventos
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>
                          Intenta ajustar o limpiar tus filtros de búsqueda.
                        </div>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            className="datagrid-btn-clear-all"
                            onClick={clearAllFilters}
                            style={{ marginTop: 6 }}
                          >
                            Restablecer todos los filtros
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedEvents.map((ev, idx) => {
                    const assignedUser = users?.find(u => String(u.id) === String(ev.userId));
                    const docCode = ev.quote?.code || ev.id?.substring(0, 12) || '-';
                    const isMultiSalon = ev._subEvents?.length > 1;
                    const statusColor = getStatusColor(ev.status);
                    const totalNum = typeof ev.quote?.total === 'number'
                      ? ev.quote.total
                      : Number(String(ev.quote?.total || '0').replace(/[^0-9.-]+/g, '')) || 0;

                    return (
                      <tr key={ev.id} className="datagrid-row">
                        {/* No. Doc */}
                        <td className="datagrid-td">
                          <span
                            className="datagrid-doc-pill"
                            onClick={() => navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`, { state: { from: 'search' } })}
                            title="Ver detalles de la reserva"
                          >
                            {docCode}
                          </span>
                        </td>

                        {/* Nombre del Evento */}
                        <td className="datagrid-td">
                          <div className="datagrid-event-name">{ev.name || 'Sin Título'}</div>
                        </td>

                        {/* Cliente / Empresa */}
                        <td className="datagrid-td">
                          <div className="datagrid-client-text">
                            {ev.clientName || 'Particular'}
                          </div>
                        </td>

                        {/* Vendedor */}
                        <td className="datagrid-td">
                          <div className="datagrid-user-cell">
                            <div className="datagrid-user-avatar">
                              {getInitials(assignedUser?.fullName || assignedUser?.name || 'Sin asignar')}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                              {assignedUser?.fullName || assignedUser?.name || 'Sin asignar'}
                            </span>
                          </div>
                        </td>

                        {/* Salón */}
                        <td className="datagrid-td">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span className="datagrid-salon-pill">
                              {ev.salon || 'Según Disponibilidad'}
                            </span>
                            {ev._additionalSalonsCount > 0 && (
                              <span
                                className="datagrid-salon-more-pill"
                                title={`Otros espacios asignados: ${ev._additionalSalonsList.join(', ')}`}
                              >
                                +{ev._additionalSalonsCount} más
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Fechas */}
                        <td className="datagrid-td">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: 12, color: '#1e293b' }}>
                              {ev._dateStart || '—'}{ev._dateStart !== ev._dateEnd && ev._dateEnd ? ` al ${ev._dateEnd}` : ''}
                            </span>
                            {ev._jornadas > 1 && (
                              <span className="datagrid-jornadas-badge" title={`Reserva consolidada de ${ev._jornadas} jornadas`}>
                                {ev._jornadas} Jornadas
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {ev.startTime || '00:00'} - {ev.endTime || '00:00'}
                          </div>
                        </td>

                        {/* Total Cotización */}
                        <td className="datagrid-td">
                          <span className="datagrid-amount-mono">
                            {formatCurrency(totalNum)}
                          </span>
                        </td>

                        {/* Estado */}
                        <td className="datagrid-td">
                          <span
                            className="datagrid-status-pill"
                            style={{
                              background: `${statusColor}18`,
                              color: statusColor,
                              borderColor: `${statusColor}40`
                            }}
                            title={STATUS_DESCRIPTIONS[ev.status] || ev.status}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                            <span>{ev.status}</span>
                          </span>
                        </td>

                        {/* Acciones directas (3 Botones como en la imagen) */}
                        <td className="datagrid-td" style={{ textAlign: 'center' }}>
                          <div className="datagrid-actions-wrap" style={{ justifyContent: 'center' }}>
                            {/* Botón 1: Ver (Azul) */}
                            <button
                              type="button"
                              className="datagrid-action-btn btn-view"
                              onClick={() => navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`, { state: { from: 'search' } })}
                              title="Ver reserva"
                            >
                              <Search size={14} strokeWidth={2.4} />
                            </button>

                            {/* Botón 2: Editar (Verde) */}
                            <button
                              type="button"
                              className="datagrid-action-btn btn-edit"
                              onClick={() => navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`, { state: { from: 'search', edit: true } })}
                              title="Editar reserva"
                            >
                              <Edit2 size={13} strokeWidth={2.4} />
                            </button>

                            {/* Botón 3: Menú / Opciones (Rojo) */}
                            <div style={{ position: 'relative' }} ref={activeActionMenu === ev.id ? actionMenuRef : null}>
                              <button
                                type="button"
                                className="datagrid-action-btn btn-delete"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionMenu(activeActionMenu === ev.id ? null : ev.id);
                                }}
                                title="Más opciones"
                              >
                                <MoreVertical size={14} strokeWidth={2.4} />
                              </button>

                              {activeActionMenu === ev.id && (
                                <div
                                  className="action-dropdown-popover"
                                  style={{
                                    right: 0,
                                    ...(idx >= paginatedEvents.length - 2 && paginatedEvents.length > 2
                                      ? { bottom: '100%', top: 'auto', marginBottom: 4 }
                                      : { top: '100%' }),
                                    zIndex: 100
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenu(null);
                                      navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`);
                                    }}
                                  >
                                    <FileText size={14} />
                                    <span>Ver Detalles</span>
                                  </button>
                                  {ev.quote?.id && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveActionMenu(null);
                                        navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}?tab=quote`);
                                      }}
                                    >
                                      <DollarSign size={14} />
                                      <span>Ver Cotización</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenu(null);
                                      navigator.clipboard.writeText(docCode);
                                    }}
                                  >
                                    <Check size={14} />
                                    <span>Copiar No. Doc</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

          {/* Popover Flotante Portaleado a document.body — Aparece libremente por encima de la tabla sin recortes ni scroll */}
          {openColumnFilter && popoverCoords && typeof document !== 'undefined' && createPortal(
            <div
              className="datagrid-popover-portal"
              ref={columnFilterPopRef}
              style={{
                position: 'fixed',
                top: `${popoverCoords.top}px`,
                left: `${popoverCoords.left}px`,
                zIndex: 999999
              }}
            >
              {/* 1. Popover No. Doc */}
              {openColumnFilter === 'doc' && (
                <>
                  <div className="datagrid-popover-header">
                    <span className="datagrid-popover-title">Filtrar No. Doc</span>
                    <button type="button" onClick={() => { setOpenColumnFilter(null); setPopoverCoords(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
                  </div>
                  <input
                    type="text"
                    className="datagrid-popover-search"
                    placeholder="Buscar código o ID..."
                    value={tempDocQuery}
                    onChange={(e) => setTempDocQuery(e.target.value)}
                    style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                    autoFocus
                  />
                  <div className="datagrid-popover-footer">
                    <button
                      type="button"
                      className="datagrid-popover-btn-clear"
                      onClick={() => {
                        setTempDocQuery('');
                        setColFilterDoc('');
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      className="datagrid-popover-btn-apply"
                      onClick={() => {
                        setColFilterDoc(tempDocQuery);
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Aplicar
                    </button>
                  </div>
                </>
              )}

              {/* 2. Popover Evento */}
              {openColumnFilter === 'event' && (
                <>
                  <div className="datagrid-popover-header">
                    <span className="datagrid-popover-title">Filtrar Evento</span>
                    <button type="button" onClick={() => { setOpenColumnFilter(null); setPopoverCoords(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
                  </div>
                  <input
                    type="text"
                    className="datagrid-popover-search"
                    placeholder="Nombre del evento..."
                    value={tempEventQuery}
                    onChange={(e) => setTempEventQuery(e.target.value)}
                    style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                    autoFocus
                  />
                  <div className="datagrid-popover-footer">
                    <button
                      type="button"
                      className="datagrid-popover-btn-clear"
                      onClick={() => {
                        setTempEventQuery('');
                        setColFilterEvent('');
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      className="datagrid-popover-btn-apply"
                      onClick={() => {
                        setColFilterEvent(tempEventQuery);
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Aplicar
                    </button>
                  </div>
                </>
              )}

              {/* 3. Popover Cliente */}
              {openColumnFilter === 'client' && (
                <>
                  <div className="datagrid-popover-header">
                    <span className="datagrid-popover-title">Filtrar Cliente</span>
                    <button type="button" onClick={() => { setOpenColumnFilter(null); setPopoverCoords(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
                  </div>
                  <input
                    type="text"
                    className="datagrid-popover-search"
                    placeholder="Nombre del cliente o empresa..."
                    value={tempClientQuery}
                    onChange={(e) => setTempClientQuery(e.target.value)}
                    style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                    autoFocus
                  />
                  <div className="datagrid-popover-footer">
                    <button
                      type="button"
                      className="datagrid-popover-btn-clear"
                      onClick={() => {
                        setTempClientQuery('');
                        setColFilterClient('');
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      className="datagrid-popover-btn-apply"
                      onClick={() => {
                        setColFilterClient(tempClientQuery);
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Aplicar
                    </button>
                  </div>
                </>
              )}

              {/* 4. Popover Vendedor */}
              {openColumnFilter === 'user' && (
                <>
                  <div className="datagrid-popover-header">
                    <span className="datagrid-popover-title">Filtrar Vendedor</span>
                    <button type="button" onClick={() => { setOpenColumnFilter(null); setPopoverCoords(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
                  </div>
                  <div className="datagrid-popover-list">
                    <label className="datagrid-popover-item">
                      <input
                        type="radio"
                        name="popover-user"
                        checked={tempUserFilter === 'all'}
                        onChange={() => setTempUserFilter('all')}
                      />
                      <span>Todos los Vendedores</span>
                    </label>
                    {sellerUsers.map(u => (
                      <label key={u.id} className="datagrid-popover-item">
                        <input
                          type="radio"
                          name="popover-user"
                          checked={String(tempUserFilter) === String(u.id)}
                          onChange={() => setTempUserFilter(String(u.id))}
                        />
                        <span>{u.fullName || u.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="datagrid-popover-footer">
                    <button
                      type="button"
                      className="datagrid-popover-btn-clear"
                      onClick={() => {
                        setUserFilter('all');
                        setTempUserFilter('all');
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      className="datagrid-popover-btn-apply"
                      onClick={() => {
                        setUserFilter(tempUserFilter);
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Aplicar
                    </button>
                  </div>
                </>
              )}

              {/* 5. Popover Salón */}
              {openColumnFilter === 'salon' && (
                <>
                  <div className="datagrid-popover-header">
                    <span className="datagrid-popover-title">Filtrar Salón</span>
                    <button type="button" onClick={() => { setOpenColumnFilter(null); setPopoverCoords(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
                  </div>
                  <div className="datagrid-popover-list">
                    <label className="datagrid-popover-item">
                      <input
                        type="radio"
                        name="popover-salon"
                        checked={tempSalonFilter === 'all'}
                        onChange={() => setTempSalonFilter('all')}
                      />
                      <span>Todos los Salones</span>
                    </label>
                    {(salones || []).map(s => (
                      <label key={s} className="datagrid-popover-item">
                        <input
                          type="radio"
                          name="popover-salon"
                          checked={tempSalonFilter === s}
                          onChange={() => setTempSalonFilter(s)}
                        />
                        <span>{s}</span>
                      </label>
                    ))}
                  </div>
                  <div className="datagrid-popover-footer">
                    <button
                      type="button"
                      className="datagrid-popover-btn-clear"
                      onClick={() => {
                        setSalonFilter('all');
                        setTempSalonFilter('all');
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      className="datagrid-popover-btn-apply"
                      onClick={() => {
                        setSalonFilter(tempSalonFilter);
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Aplicar
                    </button>
                  </div>
                </>
              )}

              {/* 6. Popover Fechas */}
              {openColumnFilter === 'date' && (
                <>
                  <div className="datagrid-popover-header">
                    <span className="datagrid-popover-title">Rango de Fechas</span>
                    <button type="button" onClick={() => { setOpenColumnFilter(null); setPopoverCoords(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                    <div className="datagrid-date-field-wrap">
                      <span className="datagrid-date-label">Desde:</span>
                      <input
                        type="date"
                        className="datagrid-popover-date-input"
                        value={tempDateFrom}
                        onChange={(e) => setTempDateFrom(e.target.value)}
                        style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                      />
                    </div>
                    <div className="datagrid-date-field-wrap">
                      <span className="datagrid-date-label">Hasta:</span>
                      <input
                        type="date"
                        className="datagrid-popover-date-input"
                        value={tempDateTo}
                        onChange={(e) => setTempDateTo(e.target.value)}
                        style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                      />
                    </div>
                  </div>
                  <div className="datagrid-popover-footer">
                    <button
                      type="button"
                      className="datagrid-popover-btn-clear"
                      onClick={() => {
                        setDateFrom('');
                        setDateTo('');
                        setTempDateFrom('');
                        setTempDateTo('');
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      className="datagrid-popover-btn-apply"
                      onClick={() => {
                        setDateFrom(tempDateFrom);
                        setDateTo(tempDateTo);
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Aplicar
                    </button>
                  </div>
                </>
              )}

              {/* 7. Popover Total */}
              {openColumnFilter === 'total' && (
                <>
                  <div className="datagrid-popover-header">
                    <span className="datagrid-popover-title">Rango de Monto (Q)</span>
                    <button type="button" onClick={() => { setOpenColumnFilter(null); setPopoverCoords(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <input
                      type="number"
                      className="datagrid-popover-search"
                      placeholder="Mínimo (Q)"
                      value={tempMinTotal}
                      onChange={(e) => setTempMinTotal(e.target.value)}
                      style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                    />
                    <input
                      type="number"
                      className="datagrid-popover-search"
                      placeholder="Máximo (Q)"
                      value={tempMaxTotal}
                      onChange={(e) => setTempMaxTotal(e.target.value)}
                      style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                    />
                  </div>
                  <div className="datagrid-popover-footer">
                    <button
                      type="button"
                      className="datagrid-popover-btn-clear"
                      onClick={() => {
                        setColFilterMinTotal('');
                        setColFilterMaxTotal('');
                        setTempMinTotal('');
                        setTempMaxTotal('');
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      className="datagrid-popover-btn-apply"
                      onClick={() => {
                        setColFilterMinTotal(tempMinTotal);
                        setColFilterMaxTotal(tempMaxTotal);
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Aplicar
                    </button>
                  </div>
                </>
              )}

              {/* 8. Popover Estados */}
              {openColumnFilter === 'status' && (
                <>
                  <div className="datagrid-popover-header">
                    <span className="datagrid-popover-title">Filtrar Estados</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (tempStatusFilter.size === ALL_STATUS_KEYS.length) {
                          setTempStatusFilter(new Set());
                        } else {
                          setTempStatusFilter(new Set(ALL_STATUS_KEYS));
                        }
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#2563eb' }}
                    >
                      {tempStatusFilter.size === ALL_STATUS_KEYS.length ? 'Deseleccionar' : 'Todos'}
                    </button>
                  </div>
                  <div className="datagrid-popover-list" style={{ maxHeight: 240 }}>
                    {ALL_STATUS_KEYS.map(st => {
                      const isChecked = tempStatusFilter.has(st);
                      const count = statusCounts[st] || 0;
                      const dotColor = getStatusColor(st);
                      return (
                        <label key={st} className="datagrid-popover-item">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const next = new Set(tempStatusFilter);
                              if (next.has(st)) next.delete(st);
                              else next.add(st);
                              setTempStatusFilter(next);
                            }}
                          />
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{count}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="datagrid-popover-footer">
                    <button
                      type="button"
                      className="datagrid-popover-btn-clear"
                      onClick={() => {
                        setStatusFilter(new Set());
                        setTempStatusFilter(new Set());
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      className="datagrid-popover-btn-apply"
                      onClick={() => {
                        setStatusFilter(new Set(tempStatusFilter));
                        setOpenColumnFilter(null);
                        setPopoverCoords(null);
                        setCurrentPage(1);
                      }}
                    >
                      Aplicar ({tempStatusFilter.size})
                    </button>
                  </div>
                </>
              )}
            </div>,
            document.body
          )}

          {/* ── 3. PAGINACIÓN DATAGRID AL PIE (Fiel a la Referencia) ── */}
          <div className="datagrid-pagination-footer">
            {/* Izquierda: Anterior, Páginas numéricas, Siguiente */}
            <div className="datagrid-pagination-left">
              <button
                type="button"
                className="datagrid-page-btn"
                disabled={validCurrentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Anterior
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 7).map(pageNum => (
                <button
                  key={pageNum}
                  type="button"
                  className={`datagrid-page-num ${pageNum === validCurrentPage ? 'is-active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              ))}

              {totalPages > 7 && (
                <span style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>
              )}

              <button
                type="button"
                className="datagrid-page-btn"
                disabled={validCurrentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </button>
            </div>

            {/* Derecha: Por Página, Contador, Ir a */}
            <div className="datagrid-pagination-right">
              {/* Selector Por Página */}
              <div className="datagrid-per-page-wrap">
                <span>Por página:</span>
                <select
                  className="datagrid-per-page-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={5}>05</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Contador de resultados */}
              <div>
                Mostrando{' '}
                <strong>
                  {totalItems === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1}
                </strong>{' '}
                a{' '}
                <strong>
                  {Math.min(validCurrentPage * pageSize, totalItems)}
                </strong>{' '}
                de <strong>{totalItems}</strong>
              </div>

              {/* Salto a Página con Ir */}
              <div className="datagrid-goto-wrap">
                <input
                  type="number"
                  className="datagrid-goto-input"
                  placeholder={String(validCurrentPage)}
                  value={gotoPageInput}
                  onChange={(e) => setGotoPageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGoToPage()}
                  min={1}
                  max={totalPages}
                />
                <button
                  type="button"
                  className="datagrid-goto-btn"
                  onClick={handleGoToPage}
                >
                  Ir
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
