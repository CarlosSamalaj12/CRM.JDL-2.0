import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Home,
  Bed,
  Calendar,
  DollarSign,
  Download,
  ArrowLeft,
  Search,
  User,
  TrendingUp,
  Clock,
  X,
  ChevronsUpDown,
  Building2,
  Layers
} from 'lucide-react';
import { getHabitacionesApi, getCatalogosHabitacionesApi } from '../../services/habitacionesService';
import { loadState } from '../../services/stateService';
import { toast } from '../../utils/toast';
import './reports.css';

export default function ReportsVentasHabitaciones({ onClose }) {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [mes, setMes] = useState(currentMonth);
  const [vendedorFilter, setVendedorFilter] = useState('');
  const [tipoHabFilter, setTipoHabFilter] = useState('');
  const [search, setSearch] = useState('');

  const [reservas, setReservas] = useState([]);
  const [metricas, setMetricas] = useState({
    totalReservas: 0,
    totalNoches: 0,
    totalHabitaciones: 0,
    totalMonto: 0
  });
  const [loading, setLoading] = useState(true);

  const [sellers, setSellers] = useState([]);
  const [tiposHab, setTiposHab] = useState([]);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Formateador de mes legible estilo "octubre de 2026"
  const formatMonthLabel = (mesStr) => {
    if (!mesStr) return 'Todos los períodos';
    try {
      const [year, month] = mesStr.split('-');
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const monthName = date.toLocaleDateString('es-GT', { month: 'long' });
      return `${monthName} de ${year}`;
    } catch {
      return mesStr;
    }
  };

  // Obtener iniciales para avatares Bento
  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return '—';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '—';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Cargar datos
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, tiposData, stateData] = await Promise.all([
        getHabitacionesApi({
          mes: mes || undefined,
          vendedor: vendedorFilter || undefined,
          tipo_habitacion: tipoHabFilter || undefined,
          search: search.trim() || undefined
        }),
        getCatalogosHabitacionesApi('tipos_habitacion').catch(() => []),
        loadState().catch(() => ({}))
      ]);

      setReservas(res?.reservas || []);
      setMetricas(res?.metricas || {
        totalReservas: 0,
        totalNoches: 0,
        totalHabitaciones: 0,
        totalMonto: 0
      });
      setTiposHab(Array.isArray(tiposData) ? tiposData : []);

      const users = (stateData?.users || []).filter(u => {
        const r = String(u.role || '').toLowerCase();
        return r === 'vendedor' || r === 'admin' || r === 'recepcionista';
      });
      setSellers(users);
    } catch (err) {
      console.error('Error cargando reporte de ventas de habitaciones:', err);
      toast.error('Error al consultar ventas de habitaciones');
    } finally {
      setLoading(false);
    }
  }, [mes, vendedorFilter, tipoHabFilter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Desgloses analíticos
  const desgloseTipoHab = useMemo(() => {
    const map = new Map();
    reservas.forEach(r => {
      const name = r.tipo_habitacion_nombre || 'Sin clasificar';
      const cur = map.get(name) || { nombre: name, reservas: 0, noches: 0, total: 0 };
      cur.reservas += 1;
      cur.noches += Number(r.noches || 0);
      cur.total += Number(r.monto_total || 0);
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [reservas]);

  const desgloseVendedor = useMemo(() => {
    const map = new Map();
    reservas.forEach(r => {
      const name = r.vendedor_nombre || 'Sin asignar';
      const cur = map.get(name) || { nombre: name, reservas: 0, noches: 0, total: 0 };
      cur.reservas += 1;
      cur.noches += Number(r.noches || 0);
      cur.total += Number(r.monto_total || 0);
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [reservas]);

  // Paginación calculada
  const totalPages = Math.max(1, Math.ceil(reservas.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedReservas = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return reservas.slice(start, start + pageSize);
  }, [reservas, validCurrentPage, pageSize]);

  // Exportar Excel profesional con diseño institucional (.xlsx)
  const handleExportExcel = async () => {
    if (reservas.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const now = new Date();
    const nowStr = now.toISOString().slice(0, 10);
    const fechaGen = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    try {
      const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'CRM Jardines del Lago';
      workbook.created = now;

      const worksheet = workbook.addWorksheet('Ventas de Habitaciones', {
        views: [{ showGridLines: true }]
      });

      // ── 1. Banner Superior Institucional ──
      worksheet.mergeCells('A1:N1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'JARDINES DEL LAGO — REPORTE DE VENTAS DE HABITACIONES';
      titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF065F46' } // Verde esmeralda corporativo JDL Hospedaje
      };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 34;

      // ── 2. Metadatos del Reporte y Filtros ──
      worksheet.mergeCells('A2:N2');
      const subCell = worksheet.getCell('A2');

      const filterSegments = [];
      if (mes) filterSegments.push(`Período: ${formatMonthLabel(mes)}`);
      if (vendedorFilter) {
        const selObj = sellers.find(s => String(s.id) === String(vendedorFilter));
        filterSegments.push(`Vendedor: ${selObj?.name || vendedorFilter}`);
      }
      if (tipoHabFilter) {
        const thObj = tiposHab.find(t => String(t.id) === String(tipoHabFilter));
        filterSegments.push(`Tipo Habitación: ${thObj?.nombre || tipoHabFilter}`);
      }
      if (search.trim()) filterSegments.push(`Búsqueda: "${search.trim()}"`);

      const filtrosStr = filterSegments.length > 0 ? filterSegments.join('  |  ') : 'Todos los registros (sin filtros)';

      subCell.value = `Generado el: ${fechaGen}   •   Total de transacciones: ${reservas.length}   •   ${filtrosStr}`;
      subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF334155' } };
      subCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0FDF4' } // Menta suave
      };
      subCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 22;

      // Fila 3 en blanco
      worksheet.getRow(3).height = 8;

      // ── 3. Encabezados de Columnas ──
      const columnsDef = [
        { header: '#', width: 6, align: 'center' },
        { header: 'No. Folio', width: 16, align: 'center' },
        { header: 'Estado', width: 16, align: 'center' },
        { header: 'Huésped', width: 30, align: 'left' },
        { header: 'Teléfono / Correo', width: 24, align: 'left' },
        { header: 'Empresa / Razón Social', width: 26, align: 'left' },
        { header: 'Check-In', width: 14, align: 'center' },
        { header: 'Check-Out', width: 14, align: 'center' },
        { header: 'Noches', width: 10, align: 'center' },
        { header: 'Cant. Hab', width: 12, align: 'center' },
        { header: 'Tipo de Habitación', width: 26, align: 'left' },
        { header: 'Vendedor Asignado', width: 22, align: 'left' },
        { header: 'Forma de Pago', width: 18, align: 'center' },
        { header: 'Monto Total (GTQ)', width: 22, align: 'right' }
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
          fgColor: { argb: 'FF059669' } // Verde esmeralda JDL
        };
        cell.alignment = { vertical: 'middle', horizontal: col.align };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF047857' } },
          bottom: { style: 'medium', color: { argb: 'FF047857' } },
          left: { style: 'thin', color: { argb: 'FFA7F3D0' } },
          right: { style: 'thin', color: { argb: 'FFA7F3D0' } }
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

      reservas.forEach((r, rowIdx) => {
        const contactInfo = [r.telefono, r.correo].filter(Boolean).join(' • ') || '—';
        const row = worksheet.addRow([
          rowIdx + 1,
          r.no_folio ? `#${r.no_folio}` : 'S/N',
          r.estado || 'Confirmada',
          r.nombre_huesped || '—',
          contactInfo,
          r.empresa_nombre || 'Particular',
          r.fecha_check_in || '—',
          r.fecha_check_out || '—',
          Number(r.noches || 0),
          Number(r.cantidad_habitaciones || 0),
          r.tipo_habitacion_nombre || '—',
          r.vendedor_nombre || 'Sin asignar',
          r.forma_pago_nombre || '—',
          Number(r.monto_total || 0)
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

          if (colNumber === 1) { // #
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF64748B' } };
          } else if (colNumber === 2) { // No. Folio
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF334155' } };
          } else if (colNumber === 3) { // Estado con pastilla tematica
            const stLower = String(r.estado || 'confirmada').toLowerCase();
            let stBg = 'FFF1F5F9';
            let stColor = 'FF475569';
            let stBorder = 'FFCBD5E1';

            if (stLower.includes('confirm')) {
              stBg = 'FFECFDF5';
              stColor = 'FF059669';
              stBorder = 'FFA7F3D0';
            } else if (stLower.includes('cancel')) {
              stBg = 'FFFEF2F2';
              stColor = 'FFDC2626';
              stBorder = 'FFFECACA';
            } else if (stLower.includes('pre') || stLower.includes('pend')) {
              stBg = 'FFFFFBEB';
              stColor = 'FFD97706';
              stBorder = 'FFFDE68A';
            }

            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stBg } };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: stColor } };
            cell.border = {
              top: { style: 'thin', color: { argb: stBorder } },
              bottom: { style: 'thin', color: { argb: stBorder } },
              left: { style: 'thin', color: { argb: stBorder } },
              right: { style: 'thin', color: { argb: stBorder } }
            };
          } else if (colNumber === 9) { // Noches
            cell.numFmt = '#,##0';
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF059669' } };
          } else if (colNumber === 10) { // Cant. Hab
            cell.numFmt = '#,##0';
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          } else if (colNumber === 14) { // Monto Total
            cell.numFmt = '"Q"#,##0.00';
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF059669' } };
          }
        });
      });

      // ── 5. Fila de Total General ──
      const totalRowIndex = 4 + reservas.length + 1;
      const totalRow = worksheet.getRow(totalRowIndex);
      totalRow.height = 26;

      worksheet.mergeCells(`A${totalRowIndex}:H${totalRowIndex}`);
      const totalLabelCell = worksheet.getCell(`A${totalRowIndex}`);
      totalLabelCell.value = 'TOTAL GENERAL:';
      totalLabelCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      totalLabelCell.alignment = { vertical: 'middle', horizontal: 'right' };
      totalLabelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }
      };

      for (let c = 1; c <= 8; c++) {
        worksheet.getCell(totalRowIndex, c).border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'double', color: { argb: 'FF0F172A' } }
        };
      }

      // Total Noches
      const totalNochesCell = worksheet.getCell(`I${totalRowIndex}`);
      totalNochesCell.value = reservas.length > 0 ? { formula: `SUM(I5:I${totalRowIndex - 1})` } : 0;
      totalNochesCell.numFmt = '#,##0';
      totalNochesCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF059669' } };
      totalNochesCell.alignment = { vertical: 'middle', horizontal: 'center' };
      totalNochesCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFF6FF' }
      };
      totalNochesCell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF2563EB' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      // Total Cant. Hab
      const totalHabCell = worksheet.getCell(`J${totalRowIndex}`);
      totalHabCell.value = reservas.length > 0 ? { formula: `SUM(J5:J${totalRowIndex - 1})` } : 0;
      totalHabCell.numFmt = '#,##0';
      totalHabCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      totalHabCell.alignment = { vertical: 'middle', horizontal: 'center' };
      totalHabCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFF6FF' }
      };
      totalHabCell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF2563EB' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      // Celdas intermedias vacías (K, L, M)
      for (let c = 11; c <= 13; c++) {
        const midCell = worksheet.getCell(totalRowIndex, c);
        midCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        midCell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'double', color: { argb: 'FF0F172A' } }
        };
      }

      // Total Monto
      const totalMontoCell = worksheet.getCell(`N${totalRowIndex}`);
      totalMontoCell.value = reservas.length > 0 ? { formula: `SUM(N5:N${totalRowIndex - 1})` } : 0;
      totalMontoCell.numFmt = '"Q"#,##0.00';
      totalMontoCell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF059669' } };
      totalMontoCell.alignment = { vertical: 'middle', horizontal: 'right' };
      totalMontoCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFECFDF5' }
      };
      totalMontoCell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF059669' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      // ── 6. Autofiltros en Encabezados ──
      worksheet.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4, column: 14 }
      };

      // ── 7. Descarga Segura en el Navegador ──
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = downloadUrl;
      downloadAnchor.download = `Reporte_Ventas_Habitaciones_${mes || nowStr}.xlsx`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Reporte exportado exitosamente a Excel');
    } catch (err) {
      console.warn('Error al exportar con ExcelJS, ejecutando fallback XLSX:', err);
      try {
        const XLSX = await import('xlsx');
        const wsData = reservas.map((r, i) => ({
          '#': i + 1,
          'No. Folio': r.no_folio ? `#${r.no_folio}` : 'S/N',
          'Estado': r.estado || 'Confirmada',
          'Huésped': r.nombre_huesped || '—',
          'Teléfono / Correo': [r.telefono, r.correo].filter(Boolean).join(' • ') || '—',
          'Empresa': r.empresa_nombre || 'Particular',
          'Check-In': r.fecha_check_in || '—',
          'Check-Out': r.fecha_check_out || '—',
          'Noches': Number(r.noches || 0),
          'Habitaciones': Number(r.cantidad_habitaciones || 0),
          'Tipo Habitación': r.tipo_habitacion_nombre || '—',
          'Vendedor': r.vendedor_nombre || 'Sin asignar',
          'Forma de Pago': r.forma_pago_nombre || '—',
          'Total Facturado (GTQ)': Number(r.monto_total || 0)
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ventas de Habitaciones');
        XLSX.writeFile(wb, `Reporte_Ventas_Habitaciones_${mes || nowStr}.xlsx`);
        toast.success('Reporte exportado exitosamente a Excel');
      } catch (fallbackErr) {
        console.error('Error generando archivo Excel fallback:', fallbackErr);
        toast.error('Error al generar archivo Excel');
      }
    }
  };

  return (
    <div className="rhab-container">
      {/* 1. Header Institucional Bento */}
      <div className="rhab-header-card">
        <div className="rhab-header-left">
          <div className="rhab-header-icon-box">
            <Home size={26} strokeWidth={2.4} color="#ffffff" />
          </div>
          <div>
            <div className="rhab-header-title-row">
              <h1 className="rhab-header-title">
                Reporte de Ventas de Habitaciones
              </h1>
              <span className="rhab-badge-live">Live</span>
            </div>
            <p className="rhab-header-subtitle">
              Análisis financiero y comercial de hospedaje · Ingresos, noches, tipos de habitación y vendedores
            </p>
          </div>
        </div>

        <div className="rhab-header-actions">
          {onClose && (
            <button
              type="button"
              className="rhab-btn-back"
              onClick={onClose}
              title="Volver a la selección de reportes"
            >
              <ArrowLeft size={16} strokeWidth={2.2} />
              <span>Volver a Reportes</span>
            </button>
          )}

          <button
            type="button"
            className="rhab-btn-excel"
            onClick={handleExportExcel}
            title="Exportar reporte a Excel"
          >
            <Download size={16} strokeWidth={2.4} />
            <span>Exportar a Excel</span>
          </button>
        </div>
      </div>

      {/* 2. Cuadrícula de 4 KPI Bento Cards */}
      <div className="rhab-kpi-grid">
        {/* KPI 1: Ingresos Totales Hospedaje */}
        <div className="rhab-kpi-card">
          <div className="rhab-kpi-top">
            <div className="rhab-kpi-label">Ingresos Totales Hospedaje</div>
            <div className="rhab-kpi-icon-wrap is-green">
              <DollarSign size={20} strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <div className="rhab-kpi-value">
              Q {Number(metricas.totalMonto || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="rhab-kpi-sub">
              <span className="rhab-kpi-badge-green">100% cobrado</span>
              <span>En el período seleccionado</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Noches Vendidas */}
        <div className="rhab-kpi-card">
          <div className="rhab-kpi-top">
            <div className="rhab-kpi-label">Noches Vendidas</div>
            <div className="rhab-kpi-icon-wrap is-blue">
              <Calendar size={20} strokeWidth={2.2} />
            </div>
          </div>
          <div>
            <div className="rhab-kpi-value">
              {metricas.totalNoches || 0}
            </div>
            <div className="rhab-kpi-sub">
              <span>Estancias acumuladas</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Habitaciones Reservadas */}
        <div className="rhab-kpi-card">
          <div className="rhab-kpi-top">
            <div className="rhab-kpi-label">Habitaciones Reservadas</div>
            <div className="rhab-kpi-icon-wrap is-purple">
              <Bed size={20} strokeWidth={2.2} />
            </div>
          </div>
          <div>
            <div className="rhab-kpi-value">
              {metricas.totalHabitaciones || 0}
            </div>
            <div className="rhab-kpi-sub">
              <span>En {metricas.totalReservas || 0} reservas</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Ticket Promedio / Noche */}
        <div className="rhab-kpi-card">
          <div className="rhab-kpi-top">
            <div className="rhab-kpi-label">Ticket Promedio / Noche</div>
            <div className="rhab-kpi-icon-wrap is-amber">
              <TrendingUp size={20} strokeWidth={2.4} />
            </div>
          </div>
          <div>
            <div className="rhab-kpi-value">
              Q {metricas.totalNoches > 0 ? (metricas.totalMonto / metricas.totalNoches).toFixed(2) : '0.00'}
            </div>
            <div className="rhab-kpi-sub">
              <span>Ingreso medio por noche</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Barra de Filtros Bento (4 Columnas) */}
      <div className="rhab-filters-card">
        {/* Columna 1: Período Fiscal */}
        <div className="rhab-filter-group">
          <label className="rhab-filter-label">Período Fiscal</label>
          <div className="rhab-month-picker-wrap">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Calendar size={16} color="#64748b" style={{ flexShrink: 0 }} />
              <span className="rhab-month-picker-text">{formatMonthLabel(mes)}</span>
            </div>
            <ChevronsUpDown size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
            <input
              type="month"
              className="rhab-month-native-input"
              value={mes}
              onChange={e => {
                setMes(e.target.value);
                setCurrentPage(1);
              }}
              title="Seleccionar mes y año"
            />
          </div>
        </div>

        {/* Columna 2: Vendedor */}
        <div className="rhab-filter-group">
          <label className="rhab-filter-label">Vendedor</label>
          <select
            className="rhab-select"
            value={vendedorFilter}
            onChange={e => {
              setVendedorFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Todos los Vendedores</option>
            {sellers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Columna 3: Tipo de Habitación */}
        <div className="rhab-filter-group">
          <label className="rhab-filter-label">Tipo de Habitación</label>
          <select
            className="rhab-select"
            value={tipoHabFilter}
            onChange={e => {
              setTipoHabFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Todos los Tipos de Habitación</option>
            {tiposHab.map(th => (
              <option key={th.id} value={th.id}>{th.nombre}</option>
            ))}
          </select>
        </div>

        {/* Columna 4: Búsqueda Rápida */}
        <div className="rhab-filter-group">
          <label className="rhab-filter-label">Búsqueda Rápida</label>
          <div className="rhab-search-wrap">
            <span className="rhab-search-icon">
              <Search size={16} strokeWidth={2.2} />
            </span>
            <input
              type="text"
              className="rhab-search-input"
              placeholder="Buscar por huésped, voucher, folio..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
            {search && (
              <button
                type="button"
                className="rhab-search-clear"
                onClick={() => {
                  setSearch('');
                  setCurrentPage(1);
                }}
                title="Limpiar búsqueda"
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Grilla de 2 Paneles de Desglose Analítico */}
      <div className="rhab-split-grid">
        {/* Panel Izquierdo: Ingresos por Tipo de Habitación */}
        <div className="rhab-panel-card">
          <div>
            <div className="rhab-panel-header">
              <div className="rhab-panel-title-wrap">
                <div className="rhab-panel-icon is-green">
                  <Layers size={17} strokeWidth={2.4} />
                </div>
                <h3 className="rhab-panel-title">Ingresos por Tipo de Habitación</h3>
              </div>
              <span className="rhab-panel-badge">
                {desgloseTipoHab.length} {desgloseTipoHab.length === 1 ? 'categoría' : 'categorías'}
              </span>
            </div>

            <div className="rhab-panel-list">
              {desgloseTipoHab.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 13, padding: '12px 0' }}>
                  No hay datos registrados en el período.
                </div>
              ) : (
                desgloseTipoHab.map(item => {
                  const pct = metricas.totalMonto > 0 ? (item.total / metricas.totalMonto) * 100 : 0;
                  return (
                    <div key={item.nombre} className="rhab-panel-row">
                      <div className="rhab-panel-row-top">
                        <span className="rhab-panel-row-name">
                          {item.nombre}
                          <span className="rhab-panel-pill">
                            ({item.reservas} res • {item.noches} n)
                          </span>
                        </span>
                        <span className="rhab-panel-amount-green">
                          Q {item.total.toFixed(2)}
                          <span className="rhab-panel-pct">({pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="rhab-progress-bar-bg">
                        <div
                          className="rhab-progress-bar-fill-green"
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rhab-panel-footer">
            <span className="rhab-panel-footer-label">Participación sobre facturación neta</span>
            <span className="rhab-panel-footer-total">
              Total: Q {Number(metricas.totalMonto || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Panel Derecho: Rendimiento por Vendedor */}
        <div className="rhab-panel-card">
          <div>
            <div className="rhab-panel-header">
              <div className="rhab-panel-title-wrap">
                <div className="rhab-panel-icon is-blue">
                  <User size={17} strokeWidth={2.4} />
                </div>
                <h3 className="rhab-panel-title">Rendimiento por Vendedor</h3>
              </div>
              <span className="rhab-panel-badge">
                {desgloseVendedor.length} {desgloseVendedor.length === 1 ? 'ejecutivo' : 'ejecutivos'}
              </span>
            </div>

            <div className="rhab-panel-list">
              {desgloseVendedor.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 13, padding: '12px 0' }}>
                  No hay ventas registradas por vendedor.
                </div>
              ) : (
                desgloseVendedor.map(item => {
                  const pct = metricas.totalMonto > 0 ? (item.total / metricas.totalMonto) * 100 : 0;
                  return (
                    <div key={item.nombre} className="rhab-panel-row">
                      <div className="rhab-panel-row-top">
                        <span className="rhab-panel-row-name">
                          {item.nombre}
                          <span className="rhab-panel-pill">
                            ({item.reservas} {item.reservas === 1 ? 'reserva' : 'reservas'})
                          </span>
                        </span>
                        <span className="rhab-panel-amount-blue">
                          Q {item.total.toFixed(2)}
                          <span className="rhab-panel-pct">({pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="rhab-progress-bar-bg">
                        <div
                          className="rhab-progress-bar-fill-blue"
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rhab-panel-footer">
            <span className="rhab-panel-footer-label">Comisión y cierre de ventas</span>
            <span className="rhab-panel-footer-total">
              Total: Q {Number(metricas.totalMonto || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Tabla Bento de Transacciones de Hospedaje */}
      <div className="rhab-table-card">
        <div className="rhab-table-header">
          <div className="rhab-table-title">
            <span className="rhab-dot-green" />
            <span>Transacciones de Hospedaje</span>
          </div>
          <span className="rhab-table-badge">
            {reservas.length} {reservas.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        <div className="rhab-table-wrap">
          <table className="rhab-table">
            <thead>
              <tr>
                <th className="rhab-th">No. Folio</th>
                <th className="rhab-th">Huésped</th>
                <th className="rhab-th">Empresa</th>
                <th className="rhab-th">Fechas</th>
                <th className="rhab-th">Habitación</th>
                <th className="rhab-th">Vendedor</th>
                <th className="rhab-th">Total Facturado</th>
                <th className="rhab-th">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    Cargando transacciones de hospedaje...
                  </td>
                </tr>
              ) : paginatedReservas.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                    No hay transacciones registradas en este período.
                  </td>
                </tr>
              ) : (
                paginatedReservas.map(r => {
                  const isConfirmed = !r.estado || r.estado.toLowerCase() === 'confirmada' || r.estado.toLowerCase() === 'confirmado';
                  return (
                    <tr key={r.id}>
                      {/* No. Folio */}
                      <td className="rhab-td">
                        <span className="rhab-folio-pill">
                          #{r.no_folio || 'S/N'}
                        </span>
                      </td>

                      {/* Huésped */}
                      <td className="rhab-td">
                        <div className="rhab-user-cell">
                          <div className="rhab-avatar-guest">
                            {getInitials(r.nombre_huesped)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>
                              {r.nombre_huesped}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                              {r.telefono || r.correo || '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Empresa */}
                      <td className="rhab-td">
                        <span className="rhab-company-pill">
                          {r.empresa_nombre || 'Particular'}
                        </span>
                      </td>

                      {/* Fechas y Noches */}
                      <td className="rhab-td">
                        <div style={{ fontWeight: 600, color: '#334155', fontSize: 12 }}>
                          {r.fecha_check_in} — {r.fecha_check_out}
                        </div>
                        <div>
                          <span className="rhab-nights-pill">
                            <Clock size={11} strokeWidth={2.5} />
                            {r.noches} noche(s)
                          </span>
                        </div>
                      </td>

                      {/* Habitación */}
                      <td className="rhab-td">
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>
                          <span style={{ fontWeight: 900 }}>{r.cantidad_habitaciones}x</span> {r.tipo_habitacion_nombre || 'Habitación'}
                        </span>
                      </td>

                      {/* Vendedor */}
                      <td className="rhab-td">
                        <div className="rhab-user-cell">
                          <div className="rhab-avatar-seller">
                            {getInitials(r.vendedor_nombre)}
                          </div>
                          <span style={{ fontWeight: 600, color: '#334155' }}>
                            {r.vendedor_nombre || 'Sin asignar'}
                          </span>
                        </div>
                      </td>

                      {/* Total Facturado */}
                      <td className="rhab-td">
                        <span className="rhab-amount-mono">
                          Q {Number(r.monto_total || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="rhab-td">
                        <span className={isConfirmed ? 'rhab-status-pill-confirmed' : 'rhab-status-pill-other'}>
                          <span style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: isConfirmed ? '#10b981' : '#94a3b8',
                            display: 'inline-block'
                          }} />
                          {r.estado || 'Confirmada'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pie de Tabla y Paginador */}
        <div className="rhab-table-footer">
          <div className="rhab-page-info">
            Mostrando{' '}
            <strong>
              {reservas.length === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1}
            </strong>{' '}
            a{' '}
            <strong>
              {Math.min(validCurrentPage * pageSize, reservas.length)}
            </strong>{' '}
            de <strong>{reservas.length}</strong> {reservas.length === 1 ? 'resultado registrado' : 'resultados registrados'}
          </div>

          <div className="rhab-pagination-controls">
            <button
              type="button"
              className="rhab-page-nav-btn"
              disabled={validCurrentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              Anterior
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                type="button"
                className={`rhab-page-num-btn ${pageNum === validCurrentPage ? 'is-active' : ''}`}
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              className="rhab-page-nav-btn"
              disabled={validCurrentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
