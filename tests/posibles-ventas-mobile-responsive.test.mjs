import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const jsxPath = path.join(repoRoot, 'src', 'modules', 'posiblesVentas', 'PosiblesVentasModule.jsx');
const cssPath = path.join(repoRoot, 'src', 'modules', 'posiblesVentas', 'posiblesVentas.css');

test('PosiblesVentasModule.jsx importa su hoja de estilos y define clases semánticas responsivas', () => {
  const jsxCode = fs.readFileSync(jsxPath, 'utf8');

  // Import de CSS
  assert.ok(jsxCode.includes("import './posiblesVentas.css';"), 'Debe importar posiblesVentas.css');

  // Clases semánticas en tarjeta LeadCard
  assert.ok(jsxCode.includes('pv-lead-card'), 'Debe incluir clase pv-lead-card');
  assert.ok(jsxCode.includes('pv-lead-content'), 'Debe incluir clase pv-lead-content');
  assert.ok(jsxCode.includes('pv-lead-header'), 'Debe incluir clase pv-lead-header');
  assert.ok(jsxCode.includes('pv-lead-title'), 'Debe incluir clase pv-lead-title');
  assert.ok(jsxCode.includes('pv-lead-assignment'), 'Debe incluir clase pv-lead-assignment');
  assert.ok(jsxCode.includes('pv-lead-meta-row'), 'Debe incluir clase pv-lead-meta-row');
  assert.ok(jsxCode.includes('pv-lead-meta-item'), 'Debe incluir clase pv-lead-meta-item');
  assert.ok(jsxCode.includes('pv-lead-notes'), 'Debe incluir clase pv-lead-notes');
  assert.ok(jsxCode.includes('pv-lead-actions'), 'Debe incluir clase pv-lead-actions');
  assert.ok(jsxCode.includes('pv-lead-actions-row-1'), 'Debe incluir clase pv-lead-actions-row-1');
  assert.ok(jsxCode.includes('pv-lead-actions-row-2'), 'Debe incluir clase pv-lead-actions-row-2');

  // Clases estructurales de cabecera y toolbar
  assert.ok(jsxCode.includes('pv-header-container'), 'Debe incluir clase pv-header-container');
  assert.ok(jsxCode.includes('pv-header-wrap'), 'Debe incluir clase pv-header-wrap');
  assert.ok(jsxCode.includes('pv-header-actions'), 'Debe incluir clase pv-header-actions');
  assert.ok(jsxCode.includes('pv-kpis-grid'), 'Debe incluir clase pv-kpis-grid');
  assert.ok(jsxCode.includes('pv-toolbar-container'), 'Debe incluir clase pv-toolbar-container');
  assert.ok(jsxCode.includes('pv-status-tabs-wrap'), 'Debe incluir clase pv-status-tabs-wrap');
  assert.ok(jsxCode.includes('pv-status-tabs-track'), 'Debe incluir clase pv-status-tabs-track');
  assert.ok(jsxCode.includes('pv-filter-controls'), 'Debe incluir clase pv-filter-controls');
  assert.ok(jsxCode.includes('pv-filter-dropdowns-row'), 'Debe incluir clase pv-filter-dropdowns-row');
  assert.ok(jsxCode.includes('pv-search-wrap'), 'Debe incluir clase pv-search-wrap');
  assert.ok(jsxCode.includes('pv-leads-scroll-container'), 'Debe incluir clase pv-leads-scroll-container');
});

test('posiblesVentas.css implementa reglas responsivas móviles completas para Eventos Asignados', () => {
  const cssCode = fs.readFileSync(cssPath, 'utf8');

  // Media query móvil
  assert.ok(cssCode.includes('@media (max-width: 768px)'), 'Debe definir media query <= 768px');

  // Tarjeta: apilamiento vertical y fin de compresión de texto
  assert.ok(
    cssCode.includes('.pv-lead-card') && cssCode.includes('flex-direction: column !important;'),
    'La tarjeta debe apilar contenido y botones verticalmente en móvil'
  );
  assert.ok(
    cssCode.includes('.pv-lead-content') && cssCode.includes('width: 100% !important;'),
    'El contenido del cliente debe tener 100% de ancho en móvil'
  );
  assert.ok(
    cssCode.includes('.pv-lead-actions') && cssCode.includes('width: 100% !important;'),
    'La barra de acciones debe expandirse al 100% en el pie de la tarjeta'
  );
  assert.ok(
    cssCode.includes('.pv-lead-title') && cssCode.includes('word-break: break-word !important;'),
    'El nombre del cliente debe tener word-break para no desbordar'
  );
  assert.ok(
    cssCode.includes('.pv-lead-notes') && cssCode.includes('word-break: break-word !important;'),
    'Las notas del cliente deben tener word-break para no desbordar'
  );

  // Tabs de estado con scroll táctil suave
  assert.ok(
    cssCode.includes('.pv-status-tabs-wrap') && cssCode.includes('overflow-x: auto !important;'),
    'Los tabs deben tener scroll horizontal en móvil'
  );

  // KPIs en cuadrícula simétrica de 3 columnas
  assert.ok(
    cssCode.includes('.pv-kpis-grid') && cssCode.includes('grid-template-columns: repeat(3, 1fr) !important;'),
    'Los KPIs deben organizarse en 3 columnas en móvil'
  );

  // Acciones de cabecera adaptadas
  assert.ok(
    cssCode.includes('.pv-header-actions') && cssCode.includes('grid-template-columns: 1fr 1fr 1.3fr !important;'),
    'Los botones de cabecera deben distribuirse en cuadrícula en móvil'
  );
});
