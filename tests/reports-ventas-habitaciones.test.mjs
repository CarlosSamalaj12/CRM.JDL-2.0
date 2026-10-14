import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('ReportsVentasHabitaciones.jsx implementa la arquitectura Bento de 5 bloques según la maqueta de referencia', () => {
  const compPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsVentasHabitaciones.jsx');
  const code = fs.readFileSync(compPath, 'utf8');

  // 1. Header Institucional Bento con Casita Verde y Live
  assert.ok(code.includes('className="rhab-container"'), 'Debe usar el contenedor principal rhab-container');
  assert.ok(code.includes('className="rhab-header-card"'), 'Debe tener la cabecera institucional rhab-header-card');
  assert.ok(code.includes('className="rhab-header-icon-box"'), 'Debe tener caja de icono de casita rhab-header-icon-box');
  assert.ok(code.includes('<Home'), 'Debe utilizar el icono Home de Lucide');
  assert.ok(code.includes('className="rhab-badge-live"'), 'Debe incluir el badge verde Live');
  assert.ok(code.includes('className="rhab-btn-back"'), 'Debe incluir el botón Volver a Reportes');
  assert.ok(code.includes('className="rhab-btn-excel"'), 'Debe incluir el botón Exportar a Excel');

  // 2. Cuadrícula de 4 KPI Cards Bento
  assert.ok(code.includes('className="rhab-kpi-grid"'), 'Debe tener la grilla de 4 KPIs rhab-kpi-grid');
  assert.ok(code.includes('Ingresos Totales Hospedaje'), 'Debe incluir la KPI de Ingresos Totales Hospedaje');
  assert.ok(code.includes('Noches Vendidas'), 'Debe incluir la KPI de Noches Vendidas');
  assert.ok(code.includes('Habitaciones Reservadas'), 'Debe incluir la KPI de Habitaciones Reservadas');
  assert.ok(code.includes('Ticket Promedio / Noche'), 'Debe incluir la KPI de Ticket Promedio / Noche');
  assert.ok(code.includes('100% cobrado'), 'Debe incluir el badge de cobro');

  // 3. Barra de 4 Filtros Bento
  assert.ok(code.includes('className="rhab-filters-card"'), 'Debe tener la tarjeta rhab-filters-card');
  assert.ok(code.includes('className="rhab-month-picker-wrap"'), 'Debe incluir el selector Bento de período fiscal');
  assert.ok(code.includes('className="rhab-month-native-input"'), 'Debe incluir el input nativo transparente para selección ágil de mes');
  assert.ok(code.includes('formatMonthLabel'), 'Debe formatear el mes a español legible');
  assert.ok(code.includes('className="rhab-search-wrap"'), 'Debe incluir contenedor de búsqueda rápida');
  assert.ok(code.includes('className="rhab-search-clear"'), 'Debe incluir botón para limpiar búsqueda');

  // 4. Paneles de Desglose Analítico
  assert.ok(code.includes('className="rhab-split-grid"'), 'Debe tener la grilla de 2 paneles rhab-split-grid');
  assert.ok(code.includes('Ingresos por Tipo de Habitación'), 'Debe incluir panel de desglose por tipo de habitación');
  assert.ok(code.includes('Rendimiento por Vendedor'), 'Debe incluir panel de rendimiento por vendedor');
  assert.ok(code.includes('rhab-progress-bar-fill-green'), 'Debe incluir barras de progreso verdes para tipos de habitación');
  assert.ok(code.includes('rhab-progress-bar-fill-blue'), 'Debe incluir barras de progreso azules para vendedores');

  // 5. Tabla de Transacciones Bento y Paginación
  assert.ok(code.includes('className="rhab-table-card"'), 'Debe tener la tarjeta de tabla rhab-table-card');
  assert.ok(code.includes('Transacciones de Hospedaje'), 'Debe incluir el título de Transacciones de Hospedaje');
  assert.ok(code.includes('rhab-folio-pill'), 'Debe usar pastillas de folio rhab-folio-pill');
  assert.ok(code.includes('rhab-avatar-guest'), 'Debe usar avatares de iniciales para huéspedes');
  assert.ok(code.includes('rhab-avatar-seller'), 'Debe usar avatares de iniciales para vendedores');
  assert.ok(code.includes('rhab-company-pill'), 'Debe usar pastillas de empresa');
  assert.ok(code.includes('rhab-nights-pill'), 'Debe usar pastillas de noches de estancia');
  assert.ok(code.includes('rhab-amount-mono'), 'Debe usar tipografía monospace en montos');
  assert.ok(code.includes('rhab-pagination-controls'), 'Debe incluir controles de paginación');
  assert.ok(code.includes('rhab-page-num-btn'), 'Debe incluir botones numéricos de página');
});

test('reports.css contiene estilos dedicados y blindaje de especificidad para el Reporte de Ventas de Habitaciones', () => {
  const cssPath = path.join(projectRoot, 'src', 'modules', 'reports', 'reports.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.rhab-container'), 'reports.css debe definir .rhab-container');
  assert.ok(css.includes('.rhab-header-card'), 'reports.css debe definir .rhab-header-card');
  assert.ok(css.includes('.rhab-kpi-grid'), 'reports.css debe definir .rhab-kpi-grid');
  assert.ok(css.includes('.rhab-filters-card'), 'reports.css debe definir .rhab-filters-card');
  assert.ok(css.includes('.rhab-split-grid'), 'reports.css debe definir .rhab-split-grid');
  assert.ok(css.includes('.rhab-table-card'), 'reports.css debe definir .rhab-table-card');

  // Blindaje contra design-system-scoped.css
  assert.ok(css.includes('body:not(.informes-theme) button.rhab-btn-excel'), 'Debe blindar button.rhab-btn-excel con body:not(.informes-theme)');
  assert.ok(css.includes('body:not(.informes-theme) button.rhab-btn-back'), 'Debe blindar button.rhab-btn-back con body:not(.informes-theme)');
  assert.ok(css.includes('body:not(.informes-theme) button.rhab-page-num-btn'), 'Debe blindar button.rhab-page-num-btn');
  assert.ok(css.includes('body:not(.informes-theme) select.rhab-select'), 'Debe blindar select.rhab-select');
  assert.ok(css.includes('body:not(.informes-theme) input.rhab-search-input'), 'Debe blindar input.rhab-search-input');
});

test('ReportsVentasHabitaciones.jsx genera exportación Excel institucional idéntica al reporte de eventos', () => {
  const compPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsVentasHabitaciones.jsx');
  const code = fs.readFileSync(compPath, 'utf8');

  // ExcelJS y escritura de buffer sin error en worksheet
  assert.ok(code.includes("await import('exceljs/dist/exceljs.min.js')"), 'Debe importar ExcelJS con versión para navegador');
  assert.ok(code.includes('workbook.xlsx.writeBuffer()'), 'Debe invocar writeBuffer en workbook y no en ws');
  assert.ok(!code.includes('ws.xlsx.writeBuffer()'), 'No debe invocar writeBuffer en ws (error previo)');

  // Banner institucional y metadatos
  assert.ok(code.includes('JARDINES DEL LAGO — REPORTE DE VENTAS DE HABITACIONES'), 'Debe incluir banner superior institucional');
  assert.ok(code.includes('Generado el:'), 'Debe incluir marca de fecha y hora de generación');
  assert.ok(code.includes('Total de transacciones:'), 'Debe incluir conteo de transacciones');

  // Fila de Total General y fórmulas
  assert.ok(code.includes('TOTAL GENERAL:'), 'Debe incluir fila de TOTAL GENERAL');
  assert.ok(code.includes('formula: `SUM(I5:I${totalRowIndex - 1})`'), 'Debe calcular suma de noches');
  assert.ok(code.includes('formula: `SUM(N5:N${totalRowIndex - 1})`'), 'Debe calcular suma de montos');

  // Descarga limpia y fallback a SheetJS
  assert.ok(code.includes('document.body.appendChild(downloadAnchor)'), 'Debe adjuntar enlace de descarga al DOM para compatibilidad');
  assert.ok(code.includes("import('xlsx')"), 'Debe proveer fallback de respaldo con XLSX');
});

