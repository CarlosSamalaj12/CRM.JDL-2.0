import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('SearchModule.jsx implementa la arquitectura Data Grid moderna según la imagen de referencia', () => {
  const compPath = path.join(projectRoot, 'src', 'modules', 'search', 'SearchModule.jsx');
  const code = fs.readFileSync(compPath, 'utf8');

  // 1. Barra Superior con Buscador, Atajo Ctrl+K, Año y Botones de Herramienta
  assert.ok(code.includes('className="datagrid-topbar"'), 'Debe incluir la barra superior datagrid-topbar');
  assert.ok(code.includes('placeholder="Buscar cliente, evento o no. doc..."'), 'Debe tener el placeholder en español');
  assert.ok(!code.includes('>Data Grid</span>'), 'No debe incluir la insignia Data Grid');
  assert.ok(code.includes('datagrid-search-kbd'), 'Debe mostrar el atajo Ctrl+K');
  assert.ok(code.includes('className="datagrid-year-select"'), 'Debe incluir el selector de año');
  assert.ok(code.includes('datagrid-tool-btn'), 'Debe incluir botones de herramientas');
  assert.ok(code.includes('datagrid-tool-btn--excel'), 'Debe incluir botón de Excel con clase verde');
  assert.ok(code.includes('datagrid-tool-btn--print'), 'Debe incluir botón de Imprimir con clase roja');
  assert.ok(code.includes('className="search-btn-new-quote"'), 'Debe incluir el botón de Nueva Cotización');

  // 2. Barra de Filtros Activos con Pastillas Carbón y Botón Limpiar Todo
  assert.ok(code.includes('className="datagrid-active-filters-bar"'), 'Debe incluir la barra de filtros activos');
  assert.ok(code.includes('className="datagrid-chip"'), 'Debe incluir pastillas de filtros activos datagrid-chip');
  assert.ok(code.includes('className="datagrid-btn-clear-all"'), 'Debe incluir el botón ámbar datagrid-btn-clear-all');
  assert.ok(code.includes('Limpiar Todo'), 'Debe incluir el texto Limpiar Todo en español');

  // 3. Encabezados Data Grid con Ordenación y Popover de Filtro por Columna
  assert.ok(code.includes('className="datagrid-table"'), 'Debe definir la tabla datagrid-table');
  assert.ok(code.includes('className="datagrid-th"'), 'Debe tener celdas de encabezado datagrid-th');
  assert.ok(code.includes('className="datagrid-th-btn"'), 'Debe tener botones de acción en encabezados');
  assert.ok(code.includes('handleToggleSort'), 'Debe implementar ordenación dinámica');
  assert.ok(code.includes('className="datagrid-popover-portal"'), 'Debe incluir popovers de filtrado por columna');
  assert.ok(code.includes('createPortal(') && code.includes('document.body'), 'Debe portaler los popovers a document.body para evitar recortes');
  assert.ok(code.includes('className="datagrid-popover-btn-clear"'), 'Debe incluir botón Limpiar en el popover');
  assert.ok(code.includes('className="datagrid-popover-btn-apply"'), 'Debe incluir botón Aplicar en el popover');

  // 4. Filas y Botones de Acción Rápida (Lupa azul, Lápiz verde, Basurero rojo) y Tarjetas Móviles
  assert.ok(code.includes('className="datagrid-action-btn btn-view"'), 'Debe incluir botón Ver (Lupa azul)');
  assert.ok(code.includes('className="datagrid-action-btn btn-edit"'), 'Debe incluir botón Editar (Lápiz verde)');
  assert.ok(code.includes('className="datagrid-action-btn btn-delete"'), 'Debe incluir botón Eliminar (Basurero rojo)');
  assert.ok(code.includes('className="search-mobile-card"'), 'Debe incluir vista de tarjetas móviles');
  assert.ok(code.includes('className="datagrid-mobile-view-toggle"'), 'Debe incluir conmutador de vista móvil');

  // 5. Paginación Data Grid al Pie en Español
  assert.ok(code.includes('className="datagrid-pagination-footer"'), 'Debe incluir el footer de paginación');
  assert.ok(code.includes('className="datagrid-page-btn"'), 'Debe incluir botones de Anterior y Siguiente');
  assert.ok(code.includes('Anterior'), 'Debe incluir botón Anterior');
  assert.ok(code.includes('Siguiente'), 'Debe incluir botón Siguiente');
  assert.ok(code.includes('datagrid-page-num'), 'Debe incluir botones numéricos de página');
  assert.ok(code.includes('className="datagrid-per-page-select"'), 'Debe incluir selector de Por página');
  assert.ok(code.includes('Por página:'), 'Debe incluir texto Por página:');
  assert.ok(code.includes('Mostrando'), 'Debe incluir contador Mostrando X a Y de Z');
  assert.ok(code.includes('className="datagrid-goto-input"'), 'Debe incluir input para salto directo de página');
  assert.ok(code.includes('className="datagrid-goto-btn"'), 'Debe incluir botón Ir');
  assert.ok(/className="datagrid-goto-btn"[^>]*>\s*Ir\s*<\/button>/.test(code), 'Debe incluir texto de botón Ir');
});

test('search.css define estilos del Data Grid y blindaje de especificidad contra botones inflados', () => {
  const cssPath = path.join(projectRoot, 'src', 'modules', 'search', 'search.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Clases principales del contenedor y barra superior
  assert.ok(css.includes('.datagrid-wrapper'), 'Debe definir .datagrid-wrapper');
  assert.ok(css.includes('.datagrid-topbar'), 'Debe definir .datagrid-topbar');
  assert.ok(css.includes('.datagrid-search-box'), 'Debe definir .datagrid-search-box');
  assert.ok(css.includes('.datagrid-year-select'), 'Debe definir .datagrid-year-select');

  // Barra de Chips Activos
  assert.ok(css.includes('.datagrid-active-filters-bar'), 'Debe definir .datagrid-active-filters-bar');
  assert.ok(css.includes('.datagrid-chip'), 'Debe definir .datagrid-chip');
  assert.ok(css.includes('.datagrid-btn-clear-all'), 'Debe definir .datagrid-btn-clear-all');

  // Encabezados Azules y Popovers
  assert.ok(css.includes('.datagrid-th'), 'Debe definir .datagrid-th');
  assert.ok(css.includes('.datagrid-popover-portal'), 'Debe definir .datagrid-popover-portal');
  assert.ok(css.includes('position: fixed'), 'Popover debe tener position: fixed para flotar sobre todo');
  assert.ok(css.includes('min-height: 380px'), 'datagrid-table-container debe definir min-height para espacio adecuado');

  // Acciones por fila
  assert.ok(css.includes('.datagrid-action-btn'), 'Debe definir .datagrid-action-btn');
  assert.ok(css.includes('btn-view'), 'Debe definir estilos para botón Ver');
  assert.ok(css.includes('btn-edit'), 'Debe definir estilos para botón Editar');
  assert.ok(css.includes('btn-delete'), 'Debe definir estilos para botón Eliminar');

  // Paginador al pie
  assert.ok(css.includes('.datagrid-pagination-footer'), 'Debe definir .datagrid-pagination-footer');
  assert.ok(css.includes('.datagrid-page-btn'), 'Debe definir .datagrid-page-btn');
  assert.ok(css.includes('.datagrid-page-num'), 'Debe definir .datagrid-page-num');
  assert.ok(css.includes('.datagrid-goto-btn'), 'Debe definir .datagrid-goto-btn');

  // Blindaje de especificidad
  assert.ok(css.includes('body:not(.informes-theme) button.datagrid-btn-clear-all'), 'Debe blindar button.datagrid-btn-clear-all');
  assert.ok(css.includes('body:not(.informes-theme) button.datagrid-action-btn'), 'Debe blindar button.datagrid-action-btn');
  assert.ok(css.includes('body:not(.informes-theme) button.datagrid-page-btn'), 'Debe blindar button.datagrid-page-btn');
  assert.ok(css.includes('body:not(.informes-theme) button.datagrid-goto-btn'), 'Debe blindar button.datagrid-goto-btn');
});

test('SearchModule.jsx incluye exportación ejecutiva a Excel con ExcelJS y fallback a XLSX', () => {
  const compPath = path.join(projectRoot, 'src', 'modules', 'search', 'SearchModule.jsx');
  const code = fs.readFileSync(compPath, 'utf8');

  // Importación para navegador
  assert.ok(code.includes("await import('exceljs/dist/exceljs.min.js')"), 'Debe importar ExcelJS con versión para navegador');
  assert.ok(code.includes('workbook.xlsx.writeBuffer()'), 'Debe invocar writeBuffer en workbook');

  // Banner y totales
  assert.ok(code.includes('JARDINES DEL LAGO — EXPLORADOR DE EVENTOS'), 'Debe incluir banner superior');
  assert.ok(code.includes('TOTAL GENERAL:'), 'Debe incluir fila de TOTAL GENERAL');
  assert.ok(code.includes("formula: `SUM(K5:K${totalRowIndex - 1})`"), 'Debe incluir fórmula SUM para el total en Excel');

  // Fallback con XLSX
  assert.ok(code.includes("XLSX.writeFile"), 'Debe proveer fallback de respaldo con XLSX.writeFile');
  assert.ok(code.includes("XLSX.utils"), 'Debe utilizar utilidades de XLSX en el fallback');
});

test('SearchModule.jsx y search.css garantizan ancho completo al 100% y encabezados en azul real', () => {
  const cssPath = path.join(projectRoot, 'src', 'modules', 'search', 'search.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const compPath = path.join(projectRoot, 'src', 'modules', 'search', 'SearchModule.jsx');
  const jsx = fs.readFileSync(compPath, 'utf8');

  // Ancho completo sin márgenes laterales desperdiciados
  assert.ok(css.includes('max-width: 100% !important'), 'search-saas-container debe usar max-width: 100% !important');
  assert.ok(css.includes('width: 100% !important'), 'Debe expandirse al 100% de la pantalla');

  // Thead y th en azul marino mate con texto blanco
  assert.ok(css.includes('.datagrid-table thead'), 'Debe blindar .datagrid-table thead');
  assert.ok(css.includes('background: #1e3a8a !important') || css.includes('background-color: #1e3a8a !important'), 'Debe forzar fondo azul marino #1e3a8a');
  assert.ok(jsx.includes("backgroundColor: '#1e3a8a'"), 'JSX debe tener backgroundColor azul marino inline');
  assert.ok(jsx.includes("color: '#ffffff'"), 'JSX debe tener color blanco inline');
});

test('SearchModule.jsx y search.css consolidan reservas multi-día/multi-salón en un único registro', () => {
  const compPath = path.join(projectRoot, 'src', 'modules', 'search', 'SearchModule.jsx');
  const jsx = fs.readFileSync(compPath, 'utf8');
  const cssPath = path.join(projectRoot, 'src', 'modules', 'search', 'search.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Lógica de consolidación por groupId, quote.code y parentId
  assert.ok(jsx.includes('getReservationKey'), 'Debe definir getReservationKey para consolidar series');
  assert.ok(jsx.includes('group_${gId}') || jsx.includes('group_'), 'Debe agrupar por groupId');
  assert.ok(jsx.includes('quote_${qCode}') || jsx.includes('quote_'), 'Debe agrupar por quote.code');
  assert.ok(jsx.includes('_jornadas'), 'Debe calcular el número de jornadas');

  // Renderizado de badge de jornadas y salones adicionales
  assert.ok(jsx.includes('datagrid-jornadas-badge'), 'Debe renderizar la insignia de jornadas');
  assert.ok(jsx.includes('datagrid-salon-more-pill'), 'Debe renderizar la pastilla de salones adicionales (+N más)');

  // Clases CSS presentes
  assert.ok(css.includes('.datagrid-jornadas-badge'), 'search.css debe definir .datagrid-jornadas-badge');
  assert.ok(css.includes('.datagrid-salon-more-pill'), 'search.css debe definir .datagrid-salon-more-pill');
});

