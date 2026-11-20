import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('BentoSelect.jsx y bentoSelect.css existen y cumplen con la arquitectura Stitch MCP', () => {
  const compPath = path.join(projectRoot, 'src', 'components', 'BentoSelect.jsx');
  const cssPath = path.join(projectRoot, 'src', 'components', 'bentoSelect.css');

  assert.ok(fs.existsSync(compPath), 'BentoSelect.jsx debe existir en src/components');
  assert.ok(fs.existsSync(cssPath), 'bentoSelect.css debe existir en src/components');

  const compCode = fs.readFileSync(compPath, 'utf8');
  assert.ok(compCode.includes('createPortal'), 'BentoSelect debe usar createPortal para evitar cortes de overflow');
  assert.ok(compCode.includes('searchQuery'), 'BentoSelect debe contar con búsqueda reactiva en tiempo real');
  assert.ok(compCode.includes('search-input-naked'), 'BentoSelect debe usar clase inmune search-input-naked');
  assert.ok(compCode.includes('bento-sel-popover'), 'BentoSelect debe renderizar clase bento-sel-popover');
  assert.ok(compCode.includes("kind === 'room'"), 'BentoSelect debe soportar variante especializada de habitaciones');
  assert.ok(compCode.includes("kind === 'user'"), 'BentoSelect debe soportar variante especializada de usuarios');
  assert.ok(compCode.includes('isMulti'), 'BentoSelect debe soportar prop isMulti para multiselección');
  assert.ok(compCode.includes('bento-sel-checkbox'), 'BentoSelect debe incluir checkboxes para multiselección');

  const cssCode = fs.readFileSync(cssPath, 'utf8');
  assert.ok(cssCode.includes('.bento-sel-trigger'), 'Debe definir clase .bento-sel-trigger');
  assert.ok(cssCode.includes('.bento-sel-popover'), 'Debe definir clase .bento-sel-popover');
  assert.ok(cssCode.includes('.bento-sel-checkbox'), 'Debe definir clase .bento-sel-checkbox');
  assert.ok(cssCode.includes('background: #ffffff !important'), 'Debe forzar fondo blanco puro');
});

test('ReportsVentasHabitaciones.jsx integra BentoSelect en modo Multi-Select para Vendedor y Tipo de Habitación', () => {
  const rhabPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsVentasHabitaciones.jsx');
  const rhabCode = fs.readFileSync(rhabPath, 'utf8');

  assert.ok(rhabCode.includes("import BentoSelect from '../../components/BentoSelect'"), 'Debe importar BentoSelect');
  assert.ok(rhabCode.includes('isMulti={true}'), 'Debe habilitar isMulti en el selector');
  assert.ok(rhabCode.includes('popoverWidth={380}'), 'Debe proveer ancho amplio de 380px para nombres completos');
  assert.ok(rhabCode.includes('value={vendedorFilter}'), 'Debe controlar vendedorFilter con BentoSelect');
  assert.ok(rhabCode.includes('value={tipoHabFilter}'), 'Debe controlar tipoHabFilter con BentoSelect');
  assert.ok(rhabCode.includes("kind=\"user\""), 'Vendedor debe usar kind="user"');
  assert.ok(rhabCode.includes("kind=\"room\""), 'Tipo de habitación debe usar kind="room"');
  assert.ok(rhabCode.includes('u.active !== false'), 'Debe filtrar usuarios inactivos en el reporte de ventas de habitaciones');
});

test('Backend habitacionesController.js soporta múltiples vendedores y tipos de habitación por comas', () => {
  const backendPath = path.join(projectRoot, 'backend', 'src', 'controllers', 'habitacionesController.js');
  const backCode = fs.readFileSync(backendPath, 'utf8');

  assert.ok(backCode.includes("split(',')"), 'Debe soportar lista de vendedores separados por comas');
  assert.ok(backCode.includes('sellerParts.push'), 'Debe acumular condiciones de vendedor dinámicamente');
});

test('HabitacionesModule.jsx integra BentoSelect para Vendedor, Tipo de Habitación y Estado', () => {
  const habPath = path.join(projectRoot, 'src', 'modules', 'habitaciones', 'HabitacionesModule.jsx');
  const habCode = fs.readFileSync(habPath, 'utf8');

  assert.ok(habCode.includes("import BentoSelect from '../../components/BentoSelect'"), 'Debe importar BentoSelect');
  assert.ok(habCode.includes('value={filterVendedor}'), 'Debe controlar filterVendedor con BentoSelect');
  assert.ok(habCode.includes('value={filterTipoHab}'), 'Debe controlar filterTipoHab con BentoSelect');
  assert.ok(habCode.includes('value={filterEstado}'), 'Debe controlar filterEstado con BentoSelect');
});

test('ReportsSeguimientosPendientes.jsx y ReportsContabilidad.jsx integran BentoSelect', () => {
  const segPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsSeguimientosPendientes.jsx');
  const segCode = fs.readFileSync(segPath, 'utf8');
  assert.ok(segCode.includes("import BentoSelect from '../../components/BentoSelect'"), 'Seguimientos debe importar BentoSelect');
  assert.ok(segCode.includes('value={userIdFilter || \'\'}'), 'Seguimientos debe usar BentoSelect');

  const contPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsContabilidad.jsx');
  const contCode = fs.readFileSync(contPath, 'utf8');
  assert.ok(contCode.includes("import BentoSelect from '../../components/BentoSelect'"), 'Contabilidad debe importar BentoSelect');
  assert.ok(contCode.includes('value={sellerFilter}'), 'Contabilidad debe usar BentoSelect');
});
