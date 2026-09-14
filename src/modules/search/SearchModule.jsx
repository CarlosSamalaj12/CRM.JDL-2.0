import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { STATUS_META } from '../calendar/constants';
import './search.css';
import '../../styles/tooltips.css';

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

// Helpers para sincronizar Set con sessionStorage
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

export default function SearchModule() {
  const navigate = useNavigate();
  const outlet = useOutletContext() || {};
  const { events = [], users = [], salones = [] } = outlet;

  // Responsividad móvil
  const [isMobileView, setIsMobileView] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Estados de filtros
  const [query, setQuery] = useState(() => sessionStorage.getItem('search_query') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(() => sessionStorage.getItem('search_query') || '');
  const [statusFilter, setStatusFilter] = useState(() => readSetFromSession('search_status'));
  const [salonFilter, setSalonFilter] = useState(() => sessionStorage.getItem('search_salon_val') || 'all');
  const [userFilter, setUserFilter] = useState(() => sessionStorage.getItem('search_user_val') || 'all');
  const [dateFrom, setDateFrom] = useState(() => sessionStorage.getItem('search_date_from') || '');
  const [dateTo, setDateTo] = useState(() => sessionStorage.getItem('search_date_to') || '');

  // UI & Paginación (en móvil por defecto cards/grid si no hay preferencia en sesión)
  const [viewMode, setViewMode] = useState(() => {
    const saved = sessionStorage.getItem('search_view_mode');
    if (saved) return saved;
    return (typeof window !== 'undefined' && window.innerWidth <= 768) ? 'grid' : 'list';
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc'
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Popover de Estados
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [tempStatusFilter, setTempStatusFilter] = useState(() => new Set(statusFilter));
  const statusPopoverRef = useRef(null);
  const searchInputRef = useRef(null);

  // Menú flotante de acciones por fila
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
        setIsStatusOpen(false);
        setActiveActionMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cerrar popovers al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (statusPopoverRef.current && !statusPopoverRef.current.contains(e.target)) {
        setIsStatusOpen(false);
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setActiveActionMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce en búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      sessionStorage.setItem('search_query', query);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Persistencia de filtros
  useEffect(() => {
    writeSetToSession('search_status', statusFilter);
    setCurrentPage(1);
  }, [statusFilter]);

  useEffect(() => {
    sessionStorage.setItem('search_salon_val', salonFilter);
    setCurrentPage(1);
  }, [salonFilter]);

  useEffect(() => {
    sessionStorage.setItem('search_user_val', userFilter);
    setCurrentPage(1);
  }, [userFilter]);

  useEffect(() => {
    sessionStorage.setItem('search_date_from', dateFrom);
    setCurrentPage(1);
  }, [dateFrom]);

  useEffect(() => {
    sessionStorage.setItem('search_date_to', dateTo);
    setCurrentPage(1);
  }, [dateTo]);

  useEffect(() => {
    sessionStorage.setItem('search_view_mode', viewMode);
  }, [viewMode]);

  // Agrupación de eventos (reserva multi-slot unificada)
  const mergedEvents = useMemo(() => {
    if (!events || !events.length) return [];

    const groups = new Map();
    for (const ev of events) {
      const key = ev.groupId || ev.id;
      if (!groups.has(key)) {
        groups.set(key, { main: ev, subs: [] });
      }
      groups.get(key).subs.push(ev);
    }

    const result = [];
    for (const group of groups.values()) {
      const subs = group.subs.sort((a, b) => {
        const byDate = String(a?.date || '').localeCompare(String(b?.date || ''));
        if (byDate !== 0) return byDate;
        return String(a?.salon || '').localeCompare(String(b?.salon || ''));
      });
      const main = subs[0];
      result.push({
        ...main,
        _subEvents: subs,
        _salonList: [...new Set(subs.map(s => s.salon).filter(Boolean))],
        _dateStart: subs[0]?.date || '',
        _dateEnd: subs[subs.length - 1]?.date || '',
      });
    }

    return result;
  }, [events]);

  // Conteo de eventos por cada estado para el popover
  const statusCounts = useMemo(() => {
    const counts = {};
    ALL_STATUS_KEYS.forEach(s => { counts[s] = 0; });
    for (const ev of mergedEvents) {
      if (ev.status && counts[ev.status] !== undefined) {
        counts[ev.status]++;
      }
    }
    return counts;
  }, [mergedEvents]);

  // Filtrado de eventos
  const filteredEvents = useMemo(() => {
    let list = mergedEvents;

    if (debouncedQuery) {
      const term = debouncedQuery.toLowerCase().trim();
      list = list.filter(ev =>
        ev.name?.toLowerCase().includes(term) ||
        ev.clientName?.toLowerCase().includes(term) ||
        ev.clientPhone?.toLowerCase().includes(term) ||
        ev.notes?.toLowerCase().includes(term) ||
        ev.id?.toLowerCase().includes(term) ||
        ev.quote?.code?.toLowerCase().includes(term) ||
        ev._salonList.some(s => s.toLowerCase().includes(term))
      );
    }

    if (statusFilter.size > 0) {
      list = list.filter(ev => statusFilter.has(ev.status));
    }

    if (salonFilter && salonFilter !== 'all') {
      list = list.filter(ev => ev._salonList.includes(salonFilter));
    }

    if (userFilter && userFilter !== 'all') {
      list = list.filter(ev => String(ev.userId) === String(userFilter));
    }

    if (dateFrom) {
      list = list.filter(ev => ev._dateEnd >= dateFrom);
    }

    if (dateTo) {
      list = list.filter(ev => ev._dateStart <= dateTo);
    }

    // Ordenamiento por fecha
    return list.sort((a, b) => {
      const dateA = a._dateStart || '';
      const dateB = b._dateStart || '';
      return sortOrder === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    });
  }, [mergedEvents, debouncedQuery, statusFilter, salonFilter, userFilter, dateFrom, dateTo, sortOrder]);

  // Paginación
  const totalItems = filteredEvents.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  // Abrir modal de estados sincronizando el estado temporal
  const handleOpenStatusModal = () => {
    setTempStatusFilter(new Set(statusFilter));
    setIsStatusOpen(!isStatusOpen);
  };

  const handleToggleTempStatus = (st) => {
    const next = new Set(tempStatusFilter);
    if (next.has(st)) next.delete(st);
    else next.add(st);
    setTempStatusFilter(next);
  };

  const handleSelectAllStatuses = () => {
    if (tempStatusFilter.size === ALL_STATUS_KEYS.length) {
      setTempStatusFilter(new Set());
    } else {
      setTempStatusFilter(new Set(ALL_STATUS_KEYS));
    }
  };

  const handleApplyStatusFilter = () => {
    setStatusFilter(new Set(tempStatusFilter));
    setIsStatusOpen(false);
  };

  const handleClearStatusFilter = () => {
    setTempStatusFilter(new Set());
    setStatusFilter(new Set());
    setIsStatusOpen(false);
  };

  // Limpiar todos los filtros
  const clearAllFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setStatusFilter(new Set());
    setSalonFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
    sessionStorage.removeItem('search_query');
    sessionStorage.removeItem('search_status');
    sessionStorage.removeItem('search_salon_val');
    sessionStorage.removeItem('search_user_val');
    sessionStorage.removeItem('search_date_from');
    sessionStorage.removeItem('search_date_to');
  };

  const removeStatusChip = (st) => {
    const next = new Set(statusFilter);
    next.delete(st);
    setStatusFilter(next);
  };

  // Exportar a Excel
  // Exportar a Excel con encabezados estilizados, bordes y formato profesional
  const handleExportExcel = async () => {
    if (!filteredEvents.length) return;

    const now = new Date();
    const nowStr = now.toISOString().split('T')[0];

    try {
      // Carga dinámica de ExcelJS para optimizar rendimiento de carga inicial
      let ExcelJSModule;
      try {
        ExcelJSModule = await import('exceljs');
      } catch {
        ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
      }
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Jardines EMS';
      workbook.created = now;

      const worksheet = workbook.addWorksheet('Eventos', {
        views: [{ showGridLines: true }]
      });

      // ── 1. Banner Superior de Título ──
      worksheet.mergeCells('A1:K1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'JARDINES EMS — REPORTE DE EVENTOS Y RESERVAS';
      titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' } // Slate 800
      };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 32;

      // ── 2. Metadatos del Reporte ──
      worksheet.mergeCells('A2:K2');
      const subCell = worksheet.getCell('A2');
      const fechaGen = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const filterSegments = [];
      if (query) filterSegments.push(`Búsqueda: "${query}"`);
      if (statusFilter.size > 0) filterSegments.push(`Estados: ${[...statusFilter].join(', ')}`);
      if (salonFilter !== 'all') filterSegments.push(`Salón: ${salonFilter}`);
      if (userFilter !== 'all') {
        const u = users?.find(user => String(user.id) === String(userFilter));
        filterSegments.push(`Vendedor: ${u?.fullName || u?.name || 'Vendedor'}`);
      }
      if (dateFrom || dateTo) filterSegments.push(`Fechas: ${dateFrom || 'Inicio'} a ${dateTo || 'Fin'}`);
      const filtrosStr = filterSegments.length > 0 ? filterSegments.join('  |  ') : 'Todos los eventos (sin filtros)';

      subCell.value = `Generado el: ${fechaGen}   •   Total de registros: ${filteredEvents.length}   •   ${filtrosStr}`;
      subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF475569' } };
      subCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' } // Slate 100
      };
      subCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 20;

      // Fila 3 en blanco
      worksheet.getRow(3).height = 8;

      // ── 3. Encabezados de Columnas ──
      const columnsDef = [
        { header: 'No. Doc', key: 'doc', width: 16, align: 'center' },
        { header: 'Nombre del Evento', key: 'name', width: 34, align: 'left' },
        { header: 'Cliente', key: 'client', width: 28, align: 'left' },
        { header: 'Teléfono', key: 'phone', width: 15, align: 'center' },
        { header: 'Vendedor / Responsable', key: 'seller', width: 26, align: 'left' },
        { header: 'Salón(es)', key: 'salon', width: 26, align: 'left' },
        { header: 'Fecha Inicio', key: 'dateStart', width: 14, align: 'center' },
        { header: 'Fecha Fin', key: 'dateEnd', width: 14, align: 'center' },
        { header: 'Horario', key: 'time', width: 18, align: 'center' },
        { header: 'Estado', key: 'status', width: 22, align: 'center' },
        { header: 'Total Cotización (Q)', key: 'total', width: 22, align: 'right' }
      ];

      const headerRow = worksheet.getRow(4);
      headerRow.height = 28;

      columnsDef.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = col.header;
        cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2563EB' } // Azul corporativo JDL
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

      // ── 4. Filas de Datos con Bordes y Colores ──
      const thinCellBorder = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      filteredEvents.forEach((ev, rowIdx) => {
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

          if (colNumber === 1) { // No. Doc
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF2563EB' } };
          } else if (colNumber === 2) { // Nombre Evento
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          } else if (colNumber === 10) { // Estado
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF334155' } };
          } else if (colNumber === 11) { // Total (Q)
            cell.numFmt = '"Q"#,##0.00';
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          }
        });
      });

      // ── 5. Fila de Total General ──
      const totalRowIndex = 4 + filteredEvents.length + 1;
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

      // ── 6. Autofiltros en Encabezados ──
      worksheet.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4, column: 11 }
      };

      // ── 7. Descarga directa en navegador ──
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = downloadUrl;
      downloadAnchor.download = `Eventos_EMS_JDL_${nowStr}.xlsx`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.warn('Error al exportar con ExcelJS, usando fallback básico:', err);
      // Fallback de seguridad con XLSX tradicional
      const data = filteredEvents.map(ev => {
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
      XLSX.writeFile(wb, `Eventos_EMS_JDL_${nowStr}.xlsx`);
    }
  };

  const getStatusColor = (status) => STATUS_META[status]?.color || '#64748b';

  // Verificar si hay algún filtro activo
  const hasActiveFilters = query || statusFilter.size > 0 || salonFilter !== 'all' || userFilter !== 'all' || dateFrom || dateTo;
  const activeFiltersCount = (statusFilter.size > 0 ? 1 : 0) + (salonFilter !== 'all' ? 1 : 0) + (userFilter !== 'all' ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);

  return (
    <div className="search-page-saas">
      <div className="search-saas-container">

        {/* ── 1. HEADER SAAS ── */}
        <header className="search-saas-header">
          <div className="search-header-left">
            <div className="search-brand-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m16 16 4 4" />
              </svg>
            </div>
            <div className="search-title-group">
              <div className="search-title-row">
                <h1 className="search-main-title">Buscar Eventos</h1>
              </div>
              <p className="search-subtitle-saas">
                Encuentra y gestiona reservas por nombre, cliente, salón, No. Doc y más
              </p>
            </div>
          </div>

          <div className="search-header-actions">
            <button
              type="button"
              className="search-btn-export"
              onClick={handleExportExcel}
              title="Descargar eventos filtrados a Excel"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Exportar</span>
            </button>

            <button
              type="button"
              className="search-btn-new-quote"
              onClick={() => navigate('/nueva-reserva')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Nueva Cotización</span>
            </button>
          </div>
        </header>

        {/* ── 2. FILTERS CARD ── */}
        <section className={`search-filters-card ${isMobileView && !showMobileFilters ? 'mobile-filters-collapsed' : ''}`}>
          <div className="search-filters-grid">

            {/* Input Buscador con Ctrl+K */}
            <div className={`search-bar-wrap ${isSearchFocused ? 'is-focused' : ''}`}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={isSearchFocused ? '#2563eb' : '#94a3b8'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="search-bar-icon">
                <circle cx="11" cy="11" r="7" />
                <path d="m16 16 4 4" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="search-input-naked"
                placeholder="Buscar por cliente, cotización, folio, salón..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  className="search-bar-clear"
                  onClick={() => setQuery('')}
                  title="Limpiar texto"
                >
                  ✕
                </button>
              )}
              <span className="search-ctrl-badge" title="Presiona Ctrl + K para enfocar">Ctrl K</span>
            </div>

            {/* Botón de alternancia de filtros avanzados en móvil */}
            {isMobileView && (
              <div className="search-mobile-filter-bar">
                <button
                  type="button"
                  className={`btn-toggle-mobile-filters ${showMobileFilters ? 'is-active' : ''} ${activeFiltersCount > 0 ? 'has-active' : ''}`}
                  onClick={() => setShowMobileFilters(prev => !prev)}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  <span>{showMobileFilters ? 'Ocultar filtros avanzados' : 'Filtros avanzados'}</span>
                  {activeFiltersCount > 0 && (
                    <span className="mobile-filter-count-badge">{activeFiltersCount}</span>
                  )}
                </button>
              </div>
            )}

            {/* Dropdown ESTADO (Popover) */}
            <div className="search-filter-field" ref={statusPopoverRef}>
              <span className="search-field-caption">ESTADO</span>
              <button
                type="button"
                className={`search-dropdown-trigger ${statusFilter.size > 0 ? 'has-value' : ''}`}
                onClick={handleOpenStatusModal}
              >
                {statusFilter.size === 0 ? (
                  <span className="search-trigger-placeholder">Todos los estados</span>
                ) : (
                  <span className="search-trigger-badge">
                    <span className="badge-count">{statusFilter.size}</span> Seleccionados
                  </span>
                )}
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isStatusOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Ventana Popover interactiva de Estados */}
              {isStatusOpen && (
                <div className="search-status-popover">
                  <div className="status-popover-header">
                    <div className="status-popover-title">
                      <span>FILTRAR ESTADOS</span>
                      <span className="status-total-badge">{ALL_STATUS_KEYS.length} estados</span>
                    </div>
                    <button
                      type="button"
                      className="status-popover-link-btn"
                      onClick={handleSelectAllStatuses}
                    >
                      {tempStatusFilter.size === ALL_STATUS_KEYS.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    </button>
                  </div>

                  <div className="status-popover-list">
                    {ALL_STATUS_KEYS.map((st) => {
                      const isChecked = tempStatusFilter.has(st);
                      const count = statusCounts[st] || 0;
                      const dotColor = getStatusColor(st);
                      return (
                        <label key={st} className={`status-popover-item ${isChecked ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTempStatus(st)}
                          />
                          <span className="status-custom-check">
                            {isChecked && (
                              <svg viewBox="0 0 14 14" width="10" height="10" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="2.5 7 5.5 10 11.5 4" />
                              </svg>
                            )}
                          </span>
                          <span className="status-dot-indicator" style={{ background: dotColor }} />
                          <span className="status-label-text">{st}</span>
                          <span className="status-count-tag">{count}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="status-popover-footer">
                    <button
                      type="button"
                      className="status-btn-clean"
                      onClick={handleClearStatusFilter}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      <span>Limpiar</span>
                    </button>
                    <button
                      type="button"
                      className="status-btn-apply"
                      onClick={handleApplyStatusFilter}
                    >
                      Aplicar {tempStatusFilter.size > 0 ? `(${tempStatusFilter.size})` : ''}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Dropdown SALÓN */}
            <div className="search-filter-field">
              <span className="search-field-caption">SALÓN</span>
              <div className="search-select-wrap">
                <select
                  value={salonFilter}
                  onChange={(e) => setSalonFilter(e.target.value)}
                  className="search-saas-select"
                >
                  <option value="all">Todos los salones</option>
                  {[...(salones || [])]
                    .sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' }))
                    .map(room => (
                      <option key={room} value={room}>{room}</option>
                    ))}
                </select>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="select-arrow">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {/* Dropdown VENDEDOR */}
            <div className="search-filter-field">
              <span className="search-field-caption">VENDEDOR</span>
              <div className="search-select-wrap">
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="search-saas-select"
                >
                  <option value="all">Todos los vendedores</option>
                  {[...(users || [])]
                    .sort((a, b) => String(a.fullName || a.name || '').localeCompare(String(b.fullName || b.name || ''), 'es'))
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.fullName || u.name}</option>
                    ))}
                </select>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="select-arrow">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {/* RANGO DE FECHAS */}
            <div className="search-filter-field date-range-field">
              <span className="search-field-caption">RANGO DE FECHAS</span>
              <div className="date-inputs-pair">
                <div className="date-single-wrap">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="search-saas-date-input"
                    title="Fecha Desde"
                  />
                </div>
                <span className="date-separator">—</span>
                <div className="date-single-wrap">
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="search-saas-date-input"
                    title="Fecha Hasta"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* ── 3. ACTIVE FILTERS & CONTADOR ── */}
          <div className="search-subbar-row">
            <div className="search-applied-filters">
              <span className="applied-label">Filtros aplicados:</span>
              <div className="applied-chips-list">
                {statusFilter.size === 0 && salonFilter === 'all' && userFilter === 'all' && !dateFrom && !dateTo && !query && (
                  <span className="applied-none-hint">Ninguno (mostrando todos)</span>
                )}

                {/* Chips de Estado */}
                {[...statusFilter].map((st) => (
                  <span key={st} className="applied-chip status-chip">
                    <span className="chip-dot" style={{ background: getStatusColor(st) }} />
                    <span className="chip-text">{st}</span>
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => removeStatusChip(st)}
                      title={`Quitar filtro ${st}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}

                {/* Chip de Salón */}
                {salonFilter !== 'all' && (
                  <span className="applied-chip info-chip">
                    <span>🏢 {salonFilter}</span>
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => setSalonFilter('all')}
                      title="Quitar filtro de salón"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Chip de Vendedor */}
                {userFilter !== 'all' && (
                  <span className="applied-chip info-chip">
                    <span>👤 {users?.find(u => String(u.id) === String(userFilter))?.fullName || 'Vendedor'}</span>
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => setUserFilter('all')}
                      title="Quitar filtro de vendedor"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Chip de Fechas */}
                {(dateFrom || dateTo) && (
                  <span className="applied-chip info-chip">
                    <span>📅 {dateFrom || 'Inicio'} a {dateTo || 'Fin'}</span>
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => { setDateFrom(''); setDateTo(''); }}
                      title="Quitar filtro de fechas"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Chip de búsqueda por texto */}
                {query && (
                  <span className="applied-chip info-chip">
                    <span>🔍 "{query}"</span>
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => setQuery('')}
                      title="Quitar búsqueda de texto"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Botón Borrar Todo */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="applied-clear-all"
                    onClick={clearAllFilters}
                  >
                    Limpiar todo
                  </button>
                )}
              </div>
            </div>

            {/* Contador de resultados y alternador de vista */}
            <div className="search-view-controls">
              <span className="search-counter-text">
                <strong>{totalItems.toLocaleString()}</strong> resultados encontrados
              </span>

              <div className="search-view-toggle">
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="Vista de lista (tabla)"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Vista de cuadrícula (tarjetas)"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. CONTENT AREA (TABLA O CUADRÍCULA) ── */}
        <main className="search-content-area">
          {filteredEvents.length === 0 ? (
            <div className="search-empty-state-saas">
              <div className="empty-icon-wrap">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#94a3b8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </div>
              <h3 className="empty-title">No se encontraron eventos</h3>
              <p className="empty-subtitle">
                Intenta ajustar o limpiar tus filtros de búsqueda para encontrar lo que necesitas.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="empty-reset-btn"
                  onClick={clearAllFilters}
                >
                  Restablecer todos los filtros
                </button>
              )}
            </div>
          ) : viewMode === 'list' ? (
            /* ── VISTA LISTA (TABLA ESTILO REFERENCIA) ── */
            <div className="search-table-scroll-container">
              {isMobileView && (
                <div className="search-table-mobile-hint">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                    <polyline points="9 18 3 12 9 6" />
                  </svg>
                  <span>Desliza para ver más columnas (Fecha, Salón, Estado...)</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                    <polyline points="15 18 21 12 15 6" />
                  </svg>
                </div>
              )}
              <table className="search-saas-table">
                <thead>
                  <tr>
                    <th
                      className="th-sortable"
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                      title="Ordenar por fecha"
                    >
                      <div className="th-content">
                        <span>NO. DOC</span>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sortOrder === 'asc' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <polyline points="19 12 12 19 5 12" />
                        </svg>
                      </div>
                    </th>
                    <th>EVENTO Y RESPONSABLE</th>
                    <th>SALÓN</th>
                    <th>FECHA Y HORARIO</th>
                    <th>ESTADO</th>
                    <th className="th-actions">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEvents.map((ev) => {
                    const assignedUser = users?.find(u => String(u.id) === String(ev.userId));
                    const docCode = ev.quote?.code || ev.id?.substring(0, 12) || '-';
                    const isMultiSalon = ev._subEvents?.length > 1;
                    const statusColor = getStatusColor(ev.status);

                    return (
                      <tr key={ev.id} className="search-row-saas">
                        {/* No. Doc */}
                        <td className="td-doc">
                          <span
                            className="doc-pill-badge"
                            onClick={() => navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`, { state: { from: 'search' } })}
                            title="Ver detalles de la reserva"
                          >
                            {docCode}
                          </span>
                        </td>

                        {/* Evento y Responsable */}
                        <td className="td-event">
                          <div className="event-primary-name">{ev.name || 'Sin Título'}</div>
                          <div className="event-assignee-row">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                            <span>{assignedUser?.fullName || assignedUser?.name || 'Sin vendedor asignado'}</span>
                            {ev.clientName && ev.clientName !== ev.name && (
                              <span className="client-subtag">• {ev.clientName}</span>
                            )}
                          </div>
                        </td>

                        {/* Salón */}
                        <td className="td-salon">
                          {isMultiSalon ? (
                            <div className="salon-multitags">
                              {ev._salonList.map((s, idx) => (
                                <span key={idx} className="salon-pill-badge">
                                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                  </svg>
                                  {s}
                                </span>
                              ))}
                            </div>
                          ) : ev.salon ? (
                            <div className="salon-single-name">
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              <span>{ev.salon}</span>
                            </div>
                          ) : (
                            <span className="salon-pending-pill">Según Disponibilidad</span>
                          )}
                        </td>

                        {/* Fecha y Horario */}
                        <td className="td-datetime">
                          <div className="datetime-date">
                            {ev._dateStart}{ev._dateStart !== ev._dateEnd && ev._dateEnd ? ` al ${ev._dateEnd}` : ''}
                          </div>
                          <div className="datetime-hours">
                            {ev.startTime || '00:00'} - {ev.endTime || '00:00'}
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="td-status">
                          <span
                            className="status-pill-saas"
                            style={{
                              background: `${statusColor}14`,
                              color: statusColor,
                              borderColor: `${statusColor}33`
                            }}
                            title={STATUS_DESCRIPTIONS[ev.status] || ev.status}
                          >
                            <span className="pill-dot" style={{ background: statusColor }} />
                            <span>{ev.status}</span>
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="td-actions">
                          <div className="actions-cell-wrap">
                            <button
                              type="button"
                              className="btn-action-view"
                              onClick={() => navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`, { state: { from: 'search' } })}
                            >
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                              <span>Ver</span>
                            </button>

                            {/* Menú de 3 puntos */}
                            <div className="action-menu-relative" ref={activeActionMenu === ev.id ? actionMenuRef : null}>
                              <button
                                type="button"
                                className={`btn-action-dots ${activeActionMenu === ev.id ? 'is-active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionMenu(activeActionMenu === ev.id ? null : ev.id);
                                }}
                                title="Más opciones"
                                aria-label="Más opciones"
                              >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                  <circle cx="12" cy="5" r="2.2" />
                                  <circle cx="12" cy="12" r="2.2" />
                                  <circle cx="12" cy="19" r="2.2" />
                                </svg>
                              </button>

                              {activeActionMenu === ev.id && (
                                <div className="action-dropdown-popover">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenu(null);
                                      navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`);
                                    }}
                                  >
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                    <span>Editar Reserva</span>
                                  </button>
                                  {ev.quote?.id && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveActionMenu(null);
                                        navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}?tab=quote`);
                                      }}
                                    >
                                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
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
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                    <span>Copiar No. Doc</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── VISTA CUADRÍCULA (CARDS) ── */
            <div className="search-grid-container">
              {paginatedEvents.map((ev) => {
                const assignedUser = users?.find(u => String(u.id) === String(ev.userId));
                const docCode = ev.quote?.code || ev.id?.substring(0, 12) || '-';
                const statusColor = getStatusColor(ev.status);
                const paxCount = ev.pax || ev.Pax || ev.guests || 0;
                const totalNum = typeof ev.quote?.total === 'number'
                  ? ev.quote.total
                  : Number(String(ev.quote?.total || '0').replace(/[^0-9.-]+/g, '')) || 0;

                return (
                  <div key={ev.id} className="search-card-item">
                    <div className="card-top-row">
                      <span
                        className="doc-pill-badge"
                        onClick={() => navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`, { state: { from: 'search' } })}
                        style={{ cursor: 'pointer' }}
                        title="Ver detalles de la reserva"
                      >
                        {docCode}
                      </span>
                      <span
                        className="status-pill-saas"
                        style={{
                          background: `${statusColor}14`,
                          color: statusColor,
                          borderColor: `${statusColor}33`
                        }}
                      >
                        <span className="pill-dot" style={{ background: statusColor }} />
                        <span>{ev.status}</span>
                      </span>
                    </div>

                    <h4 className="card-event-name">{ev.name || 'Sin Título'}</h4>

                    {ev.clientName && ev.clientName !== ev.name && (
                      <div className="card-client-row">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span>{ev.clientName}</span>
                      </div>
                    )}

                    <div className="card-meta-list">
                      <div className="card-meta-item">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#94a3b8" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span>{assignedUser?.fullName || assignedUser?.name || 'Sin vendedor'}</span>
                      </div>

                      <div className="card-meta-item">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#94a3b8" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{ev._salonList.join(', ') || ev.salon || 'Según Disponibilidad'}</span>
                      </div>

                      <div className="card-meta-item">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#94a3b8" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>{ev._dateStart}{ev._dateStart !== ev._dateEnd && ev._dateEnd ? ` al ${ev._dateEnd}` : ''} ({ev.startTime || '00:00'} - {ev.endTime || '00:00'})</span>
                      </div>

                      {paxCount > 0 && (
                        <div className="card-meta-item">
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#94a3b8" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          <span><strong>{paxCount}</strong> personas</span>
                        </div>
                      )}

                      {totalNum > 0 && (
                        <div className="card-meta-item card-meta-amount">
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#16a34a" strokeWidth="2">
                            <line x1="12" y1="1" x2="12" y2="23" />
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                          </svg>
                          <span className="card-amount-val">Total: <strong>{formatCurrency(totalNum)}</strong></span>
                        </div>
                      )}
                    </div>

                    <div className="card-footer-row">
                      <div className="card-actions-row">
                        <button
                          type="button"
                          className="btn-card-view"
                          onClick={() => navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`, { state: { from: 'search' } })}
                        >
                          <span>Ver Reserva</span>
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>

                        <div className="action-menu-relative" ref={activeActionMenu === `card-${ev.id}` ? actionMenuRef : null}>
                          <button
                            type="button"
                            className={`btn-action-dots ${activeActionMenu === `card-${ev.id}` ? 'is-active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMenu(activeActionMenu === `card-${ev.id}` ? null : `card-${ev.id}`);
                            }}
                            title="Más opciones"
                            aria-label="Más opciones"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                              <circle cx="12" cy="5" r="2.2" />
                              <circle cx="12" cy="12" r="2.2" />
                              <circle cx="12" cy="19" r="2.2" />
                            </svg>
                          </button>

                          {activeActionMenu === `card-${ev.id}` && (
                            <div className="action-dropdown-popover">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenu(null);
                                  navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}`);
                                }}
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                <span>Editar Reserva</span>
                              </button>
                              {ev.quote?.id && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenu(null);
                                    navigate(`/reserva/${ev._subEvents[0]?.id || ev.id}?tab=quote`);
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
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
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                <span>Copiar No. Doc</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* ── 5. FOOTER & PAGINACIÓN ── */}
        {filteredEvents.length > 0 && (
          <footer className="search-saas-footer">
            <div className="footer-left">
              <span>Mostrando</span>
              <div className="footer-select-wrap">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="footer-page-select"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              <span>de <strong>{totalItems.toLocaleString()}</strong> eventos</span>
            </div>

            <div className="footer-pagination-nav">
              <button
                type="button"
                className="page-nav-btn prev-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                ‹
              </button>

              {/* Generar páginas */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) {
                    acc.push('ellipsis-' + p);
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item) => {
                  if (typeof item === 'string') {
                    return <span key={item} className="page-ellipsis">...</span>;
                  }
                  return (
                    <button
                      key={item}
                      type="button"
                      className={`page-num-btn ${currentPage === item ? 'active' : ''}`}
                      onClick={() => setCurrentPage(item)}
                    >
                      {item}
                    </button>
                  );
                })}

              <button
                type="button"
                className="page-nav-btn next-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                ›
              </button>
            </div>
          </footer>
        )}

      </div>
    </div>
  );
}

