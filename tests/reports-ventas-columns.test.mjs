import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('ReportsVentas.jsx define estructura moderna de columnas visibles sin inputs de checkbox desfigurados', () => {
  const ventasPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsVentas.jsx');
  const code = fs.readFileSync(ventasPath, 'utf8');

  // Verifica que existe la lista de definiciones enriquecida
  assert.ok(code.includes('COLUMN_DEFINITIONS = ['), 'Debe definir COLUMN_DEFINITIONS');
  assert.ok(code.includes('DEFAULT_VISIBLE_COLUMNS = {'), 'Debe definir DEFAULT_VISIBLE_COLUMNS');
  assert.ok(code.includes('STORAGE_KEY_VENTAS_COLUMNS'), 'Debe persistir en localStorage con clave dedicada');

  // Verifica que NO se usan inputs checkbox crudos en el modal que sufran distorsión global
  assert.ok(!code.includes('type="checkbox"\n                    checked={visibleColumns'), 'NO debe usar input checkbox crudo vulnerable a distorsión de CSS');

  // Verifica acciones rápidas
  assert.ok(code.includes('handleSelectAllColumns'), 'Debe tener acción para mostrar todas');
  assert.ok(code.includes('handleSelectMinimalColumns'), 'Debe tener acción para columnas esenciales');
  assert.ok(code.includes('handleResetColumns'), 'Debe tener acción para restablecer');

  // Verifica protección contra deseleccionar todas
  assert.ok(code.includes('currentActiveCount <= 1'), 'Debe proteger para evitar dejar la tabla sin columnas');

  // Verifica insignia de conteo dinámico en el botón de la tabla
  assert.ok(code.includes('{visibleCount}/{totalColumns}'), 'Debe mostrar el conteo de columnas activas en el botón de la tabla');

  // Verifica soporte de tecla Escape
  assert.ok(code.includes("e.key === 'Escape'"), 'Debe cerrar el modal al presionar Escape');
});

test('ReportsVentas.jsx y reports.css definen chips de estado compactos blindados contra botones inflados', () => {
  const ventasPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsVentas.jsx');
  const code = fs.readFileSync(ventasPath, 'utf8');

  // Verifica que los chips de estado, vendedor y salón usen rpt-filter-chip y rpt-filter-chip-btn
  assert.ok(code.includes('className="rpt-filter-chip"'), 'Debe aplicar rpt-filter-chip a los chips');
  assert.ok(code.includes('className="rpt-filter-chip-btn"'), 'Debe aplicar rpt-filter-chip-btn al botón de remoción');
  assert.ok(code.includes('className="rpt-filter-chip-dot"'), 'Debe aplicar rpt-filter-chip-dot al indicador de color');

  const cssPath = path.join(projectRoot, 'src', 'modules', 'reports', 'reports.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.rpt-filter-chip'), 'reports.css debe definir .rpt-filter-chip');
  assert.ok(css.includes('height: 25px !important'), 'reports.css debe forzar altura compacta de 25px en chips');
  assert.ok(css.includes('button.rpt-filter-chip-btn'), 'reports.css debe blindar button.rpt-filter-chip-btn con alta especificidad');
  assert.ok(css.includes('width: 15px !important'), 'reports.css debe restringir ancho del botón de remoción');

  // Verifica que el MultiSelect de estados oculte el label duplicado que desalinea la fila
  assert.ok(code.includes('selected={statusFilter}') && code.includes('hideLabel'), 'MultiSelect de statusFilter debe tener hideLabel para alineación perfecta con los chips');
});

test('ReportsVentas.jsx y reports.css implementan botón rojo Imprimir / PDF y reporte institucional sin hojas en blanco', () => {
  const ventasPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsVentas.jsx');
  const code = fs.readFileSync(ventasPath, 'utf8');

  // Verifica botón rojo en JSX y botón Excel al lado de Columnas con el mismo tamaño
  assert.ok(code.includes('className="rv-btn-print"'), 'Debe asignar la clase rv-btn-print al botón de imprimir');
  assert.ok(code.includes('className="rv-btn-excel"'), 'Debe asignar la clase rv-btn-excel al botón de Excel');
  assert.ok(code.includes('#dc2626'), 'Debe usar color rojo carmesí #dc2626 en el botón');
  assert.ok(code.includes('Imprimir / PDF'), 'Debe contener la etiqueta Imprimir / PDF');
  assert.ok(code.includes('Exportar Excel'), 'Debe contener la etiqueta Exportar Excel');

  // Verifica que los botones estén agrupados al lado de Columnas
  assert.ok(code.includes('rv-btn-print') && code.includes('rv-btn-excel') && code.includes('setShowColModal(true)'), 'Los botones deben estar agrupados con el botón de Columnas');

  // Verifica que handlePrint arme el documento HTML institucional completo con las 12 columnas exactas de Excel
  assert.ok(code.includes('report-header'), 'handlePrint debe armar el encabezado institucional');
  assert.ok(code.includes('Oficial_JDL_acua.png'), 'handlePrint debe incluir el logo de Jardines del Lago');
  assert.ok(code.includes('filters-bar') || code.includes('filter-chip'), 'handlePrint debe incluir los filtros activos');
  assert.ok(code.includes('kpi-grid') || code.includes('kpi-card'), 'handlePrint debe incluir las tarjetas KPI');
  assert.ok(code.includes('FECHA INICIO') && code.includes('FECHA FIN') && code.includes('EVENTO') && code.includes('SALÓN PRINCIPAL'), 'handlePrint debe incluir las 12 columnas idénticas al reporte de Excel');
  assert.ok(code.includes('total-row') || code.includes('TOTAL GENERAL'), 'handlePrint debe incluir fila de totales contables');
  assert.ok(code.includes('iframe') && code.includes('printFrame'), 'handlePrint debe incluir fallback por iframe contra bloqueadores de popups');

  const cssPath = path.join(projectRoot, 'src', 'modules', 'reports', 'reports.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verifica que no haya blanket body * { visibility: hidden !important; } que deje todo en blanco
  assert.ok(!css.includes('@media print {\n  body * {\n    visibility: hidden !important;\n  }'), 'NO debe ocultar incondicionalmente body * en @media print');
  assert.ok(css.includes('body:has(.printable-event-statement-modal) *') || !css.includes('body * {\n    visibility: hidden !important;'), 'El aislamiento de impresión debe estar condicionado');

  // Verifica estilos blindados y mismo tamaño de 34px para ambos botones
  assert.ok(css.includes('button.rv-btn-print'), 'reports.css debe blindar button.rv-btn-print con alta especificidad');
  assert.ok(css.includes('button.rv-btn-excel'), 'reports.css debe blindar button.rv-btn-excel con alta especificidad');
  assert.ok(css.includes('#dc2626 !important'), 'reports.css debe forzar fondo rojo #dc2626 en rv-btn-print');
  assert.ok(css.includes('#059669 !important'), 'reports.css debe forzar fondo verde #059669 en rv-btn-excel');
  assert.ok(css.includes('height: 34px !important'), 'reports.css debe forzar altura estandarizada de 34px en ambos botones');
});

