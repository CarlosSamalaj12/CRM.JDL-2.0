import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const proyeccionPath = path.join(repoRoot, 'src', 'modules', 'reports', 'ReportsProyeccionMetas.jsx');
const reportsCssPath = path.join(repoRoot, 'src', 'modules', 'reports', 'reports.css');

test('ReportsProyeccionMetas.jsx implementa conmutador de modos con iconos vectoriales y botones de color ejecutivo', () => {
  const code = fs.readFileSync(proyeccionPath, 'utf8');

  // Verifica iconos vectoriales
  assert.ok(code.includes('function IconLayers'), 'Debe definir IconLayers para el modo Consolidado');
  assert.ok(code.includes('function IconEventSparkles'), 'Debe definir IconEventSparkles para Solo Eventos');
  assert.ok(code.includes('function IconBed'), 'Debe definir IconBed para Solo Habitaciones');

  // Verifica presencia de los 3 modos en el conmutador segmentado
  assert.ok(code.includes("setProjectionMode('consolidado')"), 'Debe permitir activar modo consolidado');
  assert.ok(code.includes("setProjectionMode('eventos')"), 'Debe permitir activar modo solo eventos');
  assert.ok(code.includes("setProjectionMode('habitaciones')"), 'Debe permitir activar modo solo habitaciones');

  // Verifica clases dedicadas
  assert.ok(code.includes('proyeccion-segmented-container'), 'Debe tener contenedor segmentado proyeccion-segmented-container');
  assert.ok(code.includes('proyeccion-segmented-btn--consolidado'), 'Debe incluir clase específica consolidado');
  assert.ok(code.includes('proyeccion-segmented-btn--eventos'), 'Debe incluir clase específica eventos');
  assert.ok(code.includes('proyeccion-segmented-btn--habitaciones'), 'Debe incluir clase específica habitaciones');
});

test('ReportsProyeccionMetas.jsx reactividad de filtros y evaluación de metas de habitaciones', () => {
  const code = fs.readFileSync(proyeccionPath, 'utf8');

  // Normalización de estados entre eventos y habitaciones
  assert.ok(code.includes('function isHabitacionInStatusFilter'), 'Debe incluir helper isHabitacionInStatusFilter');

  // Llamada a API de habitaciones sin hardcoded Confirmada
  assert.ok(
    code.includes('getHabitacionesApi({ desde: fromDate, hasta: toDate })'),
    'getHabitacionesApi no debe forzar estado Confirmada para permitir filtrar por Pre reserva u otros'
  );

  // projectionData debe reaccionar a projectionMode, habitacionesList y habitacionesMetasMap
  assert.ok(
    code.includes('projectionMode, habitacionesList, habitacionesMetasMap'),
    'projectionData y computeTeamData deben incluir projectionMode, habitacionesList y habitacionesMetasMap en sus dependencias'
  );

  // En modo habitaciones, debe evaluar la meta específica de habitacionesMetasMap
  assert.ok(
    code.includes("projectionMode === 'habitaciones' && habitacionesMetasMap.has(userId)"),
    'En modo habitaciones debe evaluar contra la meta de habitaciones si está configurada'
  );
});

test('ReportsProyeccionMetas.jsx y reports.css estructuran toolbar de 2 filas alineadas y estilos ejecutivos', () => {
  const jsxCode = fs.readFileSync(proyeccionPath, 'utf8');
  const cssCode = fs.readFileSync(reportsCssPath, 'utf8');

  // Estructura de 2 filas
  assert.ok(jsxCode.includes('reports-toolbar--proyeccion'), 'Toolbar debe tener clase reports-toolbar--proyeccion');
  assert.ok(jsxCode.includes('proyeccion-btn-pdf'), 'Botón PDF debe tener clase proyeccion-btn-pdf');
  assert.ok(jsxCode.includes('proyeccion-btn-csv'), 'Botón CSV debe tener clase proyeccion-btn-csv');

  // Scoped CSS
  assert.ok(cssCode.includes('.reports-toolbar--proyeccion'), 'reports.css debe estilizar .reports-toolbar--proyeccion');
  assert.ok(cssCode.includes('.proyeccion-segmented-btn--consolidado.active'), 'CSS debe definir azul corporativo para consolidado activo');
  assert.ok(cssCode.includes('.proyeccion-segmented-btn--eventos.active'), 'CSS debe definir violeta/indigo para solo eventos activo');
  assert.ok(cssCode.includes('.proyeccion-segmented-btn--habitaciones.active'), 'CSS debe definir verde esmeralda para solo habitaciones activo');
  assert.ok(cssCode.includes('.proyeccion-btn-pdf'), 'CSS debe definir estilo rojo ejecutivo para botón PDF');
  assert.ok(cssCode.includes('.proyeccion-btn-csv'), 'CSS debe definir estilo verde ejecutivo para botón CSV');
});

test('ReportsProyeccionMetas y reports.css implementan arquitectura responsiva móvil completa', () => {
  const jsxCode = fs.readFileSync(proyeccionPath, 'utf8');
  const cssCode = fs.readFileSync(reportsCssPath, 'utf8');

  // Clases semánticas responsivas en JSX
  assert.ok(jsxCode.includes('proyeccion-row-1'), 'JSX debe contener proyeccion-row-1');
  assert.ok(jsxCode.includes('proyeccion-presets-group'), 'JSX debe contener proyeccion-presets-group');
  assert.ok(jsxCode.includes('proyeccion-modes-dates-wrap'), 'JSX debe contener proyeccion-modes-dates-wrap');
  assert.ok(jsxCode.includes('proyeccion-desktop-prefix'), 'JSX debe contener proyeccion-desktop-prefix para ocultar "Solo " en móvil');
  assert.ok(jsxCode.includes('proyeccion-desktop-divider'), 'JSX debe contener proyeccion-desktop-divider para ocultar barra vertical en móvil');
  assert.ok(jsxCode.includes('proyeccion-dates-row'), 'JSX debe contener proyeccion-dates-row');
  assert.ok(jsxCode.includes('proyeccion-date-field'), 'JSX debe contener proyeccion-date-field');
  assert.ok(jsxCode.includes('proyeccion-row-2'), 'JSX debe contener proyeccion-row-2');
  assert.ok(jsxCode.includes('proyeccion-filters-group'), 'JSX debe contener proyeccion-filters-group');
  assert.ok(jsxCode.includes('proyeccion-filter-item'), 'JSX debe contener proyeccion-filter-item');
  assert.ok(jsxCode.includes('proyeccion-export-group'), 'JSX debe contener proyeccion-export-group');

  // Reglas CSS responsivas (@media max-width: 768px)
  assert.ok(cssCode.includes('@media (max-width: 768px)'), 'reports.css debe tener media query para móvil');
  assert.ok(cssCode.includes('.proyeccion-desktop-prefix') && cssCode.includes('display: none !important;'), 'Debe ocultar proyeccion-desktop-prefix en móvil');
  assert.ok(cssCode.includes('.proyeccion-desktop-divider') && cssCode.includes('display: none !important;'), 'Debe ocultar divisor vertical en móvil');
  assert.ok(cssCode.includes('grid-template-columns: repeat(3, 1fr) !important;'), 'Conmutador de modos debe dividirse en 3 columnas iguales');
  assert.ok(cssCode.includes('grid-template-columns: repeat(2, 1fr) !important;'), 'Presets rápidos deben organizarse en cuadrícula 2x2');
  assert.ok(cssCode.includes('.proyeccion-filter-item .multiselect-wrapper') && cssCode.includes('width: 100% !important;'), 'Dropdowns de filtros deben expandirse al 100%');
});
