import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('ReportInfo.jsx y reports.css blindan el botón (i) con diseño perfectamente circular y color ejecutivo', () => {
  const reportInfoPath = path.join(ROOT_DIR, 'src/modules/reports/components/ReportInfo.jsx');
  const reportInfoContent = fs.readFileSync(reportInfoPath, 'utf8');

  const cssPath = path.join(ROOT_DIR, 'src/modules/reports/reports.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // Verifica que ReportInfo usa la clase dedicada y renderiza un SVG vectorial en lugar de texto desfigurado
  assert.ok(reportInfoContent.includes('className="report-info-btn"'), 'ReportInfo debe tener className="report-info-btn"');
  assert.ok(reportInfoContent.includes('<svg'), 'ReportInfo debe renderizar icono SVG vectorial para (i)');
  assert.ok(reportInfoContent.includes("import '../reports.css';"), 'ReportInfo debe importar reports.css');

  // Verifica que reports.css blinda la geometría circular estricta contra botones globales inflados
  assert.ok(cssContent.includes('.report-info-btn'), 'reports.css debe definir regla .report-info-btn');
  assert.ok(cssContent.includes('border-radius: 50% !important;'), 'report-info-btn debe tener border-radius: 50% !important');
  assert.ok(cssContent.includes('aspect-ratio: 1 / 1 !important;'), 'report-info-btn debe tener aspect-ratio: 1 / 1 !important');
  assert.ok(cssContent.includes('padding: 0 !important;'), 'report-info-btn debe tener padding: 0 !important');
  assert.ok(cssContent.includes('width: 32px !important;'), 'report-info-btn debe tener width: 32px !important');
  assert.ok(cssContent.includes('height: 32px !important;'), 'report-info-btn debe tener height: 32px !important');
  assert.ok(cssContent.includes('background: #eff6ff !important;'), 'report-info-btn debe tener fondo azul hielo');
  assert.ok(cssContent.includes('color: #2563eb !important;'), 'report-info-btn debe tener icono azul real');
});

test('ReportsVentas y reports.css implementan botón de retorno de alta visibilidad con icono y borde', () => {
  const ventasPath = path.join(ROOT_DIR, 'src/modules/reports/ReportsVentas.jsx');
  const ventasContent = fs.readFileSync(ventasPath, 'utf8');

  const cssPath = path.join(ROOT_DIR, 'src/modules/reports/reports.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // Verifica botón en ReportsVentas
  assert.ok(ventasContent.includes('className="reports-btn-back"'), 'ReportsVentas debe usar className="reports-btn-back"');
  assert.ok(ventasContent.includes('Volver al Dashboard'), 'ReportsVentas debe tener texto Volver al Dashboard');
  assert.ok(ventasContent.includes('<svg'), 'ReportsVentas debe renderizar flecha vectorial en botón volver');

  // Verifica diseño en reports.css para .reports-btn-back y .btn-exit
  assert.ok(cssContent.includes('button.reports-btn-back'), 'reports.css debe definir button.reports-btn-back');
  assert.ok(cssContent.includes('.reports-page-header button.btn-exit'), 'reports.css debe estilizar .btn-exit en headers de reportes');
  assert.ok(cssContent.includes('background: #ffffff !important;'), 'Botón volver debe tener fondo blanco visible');
  assert.ok(cssContent.includes('border: 1.5px solid #cbd5e1 !important;'), 'Botón volver debe tener borde ejecutivo');
  assert.ok(cssContent.includes('color: #2563eb !important;'), 'Flecha debe tener color azul');
  assert.ok(cssContent.includes('transform: translateX(-2px) !important;'), 'Debe incluir micro-animación en hover');
});

test('ReportsModule y reports.css implementan chips de categorías con colores pastel, iconos e insignia de conteo', () => {
  const modulePath = path.join(ROOT_DIR, 'src/modules/reports/ReportsModule.jsx');
  const moduleContent = fs.readFileSync(modulePath, 'utf8');

  const cssPath = path.join(ROOT_DIR, 'src/modules/reports/reports.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // Chips definidos
  assert.ok(moduleContent.includes("id: 'all',       label: 'Todos'"), 'Debe definir chip Todos');
  assert.ok(moduleContent.includes("id: 'Ventas',    label: 'Ventas'"), 'Debe definir chip Ventas');
  assert.ok(moduleContent.includes("id: 'Finanzas',  label: 'Finanzas'"), 'Debe definir chip Finanzas');
  assert.ok(moduleContent.includes("id: 'Operación', label: 'Operación'"), 'Debe definir chip Operación');
  assert.ok(moduleContent.includes("id: 'KPIs',      label: 'KPIs'"), 'Debe definir chip KPIs');
  assert.ok(moduleContent.includes("id: 'Clientes',  label: 'Clientes'"), 'Debe definir chip Clientes');
  assert.ok(moduleContent.includes("id: 'Calidad',   label: 'Calidad'"), 'Debe definir chip Calidad');
  assert.ok(moduleContent.includes("id: 'Pipeline',  label: 'Pipeline'"), 'Debe definir chip Pipeline');

  // Elementos estructurales
  assert.ok(moduleContent.includes('categoryCounts'), 'ReportsModule debe calcular conteos por categoría');
  assert.ok(moduleContent.includes('reports-hub-chip-icon-box'), 'ReportsModule debe renderizar cajita de icono');
  assert.ok(moduleContent.includes('reports-hub-chip-label'), 'ReportsModule debe renderizar etiqueta de categoría');
  assert.ok(moduleContent.includes('reports-hub-chip-badge'), 'ReportsModule debe renderizar insignia numérica de conteo');

  // CSS de categorías
  assert.ok(cssContent.includes('.reports-hub-chip-icon-box'), 'reports.css debe definir .reports-hub-chip-icon-box');
  assert.ok(cssContent.includes('.reports-hub-chip-badge'), 'reports.css debe definir .reports-hub-chip-badge');
  assert.ok(cssContent.includes('.reports-hub-chip--ventas'), 'reports.css debe definir estilos de Ventas (#ecfdf5)');
  assert.ok(cssContent.includes('.reports-hub-chip--finanzas'), 'reports.css debe definir estilos de Finanzas (#fffbeb)');
  assert.ok(cssContent.includes('.reports-hub-chip--operacion'), 'reports.css debe definir estilos de Operación (#f0f9ff)');
  assert.ok(cssContent.includes('.reports-hub-chip--kpis'), 'reports.css debe definir estilos de KPIs (#eef2ff)');
  assert.ok(cssContent.includes('.reports-hub-chip--clientes'), 'reports.css debe definir estilos de Clientes (#f5f3ff)');
  assert.ok(cssContent.includes('.reports-hub-chip--calidad'), 'reports.css debe definir estilos de Calidad (#fff1f2)');
  assert.ok(cssContent.includes('.reports-hub-chip--pipeline'), 'reports.css debe definir estilos de Pipeline (#ecfeff)');
  assert.ok(cssContent.includes('.reports-hub-chip--active'), 'reports.css debe definir estilo activo dark slate (#0f172a)');
});
