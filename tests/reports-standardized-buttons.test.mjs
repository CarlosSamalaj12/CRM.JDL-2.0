import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('reports.css: Definición blindada de clases globales para botones y filtros', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/reports.css'), 'utf8');

  // 1. PDF / Imprimir (Rojo Ejecutivo)
  assert.ok(css.includes('.reports-btn-pdf'), 'reports.css debe definir .reports-btn-pdf');
  assert.ok(css.includes('#dc2626'), 'reports.css debe usar rojo #dc2626 para PDF');

  // 2. Excel / CSV (Verde Esmeralda)
  assert.ok(css.includes('.reports-btn-excel'), 'reports.css debe definir .reports-btn-excel');
  assert.ok(css.includes('#059669'), 'reports.css debe usar verde #059669 para Excel');

  // 3. Pipeline Kanban (Índigo Ejecutivo)
  assert.ok(css.includes('.reports-btn-kanban'), 'reports.css debe definir .reports-btn-kanban');
  assert.ok(css.includes('#4f46e5'), 'reports.css debe usar índigo #4f46e5 para Pipeline Kanban');

  // 4. Configurar Alertas (Violeta Ejecutivo)
  assert.ok(css.includes('.reports-btn-alertas'), 'reports.css debe definir .reports-btn-alertas');
  assert.ok(css.includes('#7c3aed'), 'reports.css debe usar violeta #7c3aed para Configurar Alertas');

  // 5. Presets Rápidos
  assert.ok(css.includes('.reports-preset-btn'), 'reports.css debe definir .reports-preset-btn');
  assert.ok(css.includes('#2563eb'), 'reports.css debe usar azul #2563eb para preset activo');

  // 6. Limpiar Filtros
  assert.ok(css.includes('.reports-btn-clear'), 'reports.css debe definir .reports-btn-clear');
  assert.ok(css.includes('#fff7ed') && css.includes('#c2410c'), 'reports.css debe usar tono ámbar/coral para Limpiar Filtros');

  // 7. Input Wrap
  assert.ok(css.includes('.reports-filter-input-wrap'), 'reports.css debe definir .reports-filter-input-wrap');
});

test('Reportes: Adopción consistente de botones de exportación y acción rápida', () => {
  const satisfaccion = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsSatisfaccion.jsx'), 'utf8');
  assert.ok(satisfaccion.includes('reports-btn-pdf'), 'ReportsSatisfaccion debe usar reports-btn-pdf');
  assert.ok(satisfaccion.includes('reports-btn-excel'), 'ReportsSatisfaccion debe usar reports-btn-excel');
  assert.ok(satisfaccion.includes('reports-btn-alertas'), 'ReportsSatisfaccion debe usar reports-btn-alertas');

  const comisiones = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsComisiones.jsx'), 'utf8');
  assert.ok(comisiones.includes('reports-btn-pdf'), 'ReportsComisiones debe usar reports-btn-pdf');
  assert.ok(comisiones.includes('reports-btn-excel'), 'ReportsComisiones debe usar reports-btn-excel');
  assert.ok(comisiones.includes('reports-filter-input-wrap'), 'ReportsComisiones debe usar reports-filter-input-wrap');
  assert.ok(comisiones.includes('reports-preset-btn'), 'ReportsComisiones debe usar reports-preset-btn');
  assert.ok(comisiones.includes('reports-btn-clear'), 'ReportsComisiones debe incluir reports-btn-clear');

  const dashboard = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsDashboard.jsx'), 'utf8');
  assert.ok(dashboard.includes('reports-btn-kanban'), 'ReportsDashboard debe usar reports-btn-kanban');
  assert.ok(dashboard.includes('reports-btn-pdf'), 'ReportsDashboard debe usar reports-btn-pdf');
  assert.ok(dashboard.includes('reports-btn-clear'), 'ReportsDashboard debe usar reports-btn-clear');

  const contabilidad = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsContabilidad.jsx'), 'utf8');
  assert.ok(contabilidad.includes('reports-btn-excel'), 'ReportsContabilidad debe usar reports-btn-excel');

  const institucion = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsInstitucion.jsx'), 'utf8');
  assert.ok(institucion.includes('reports-btn-excel'), 'ReportsInstitucion debe usar reports-btn-excel');

  const ocupacionBarras = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsOcupacionBarras.jsx'), 'utf8');
  assert.ok(ocupacionBarras.includes('reports-btn-excel'), 'ReportsOcupacionBarras debe usar reports-btn-excel');
  assert.ok(ocupacionBarras.includes('reports-preset-btn'), 'ReportsOcupacionBarras debe usar reports-preset-btn');

  const eficienciaEventos = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsEficenciaEventos.jsx'), 'utf8');
  assert.ok(eficienciaEventos.includes('reports-preset-btn'), 'ReportsEficenciaEventos debe usar reports-preset-btn');

  const eficienciaConf = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsEficenciaConfirmacion.jsx'), 'utf8');
  assert.ok(eficienciaConf.includes('reports-preset-btn'), 'ReportsEficenciaConfirmacion debe usar reports-preset-btn');

  const ingresosCat = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsIngresosCategorias.jsx'), 'utf8');
  assert.ok(ingresosCat.includes('reports-preset-btn'), 'ReportsIngresosCategorias debe usar reports-preset-btn');

  const seguimientos = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsSeguimientosPendientes.jsx'), 'utf8');
  assert.ok(seguimientos.includes('reports-preset-btn'), 'ReportsSeguimientosPendientes debe usar reports-preset-btn');

  const ocupacion = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsOcupacion.jsx'), 'utf8');
  assert.ok(ocupacion.includes('reports-preset-btn'), 'ReportsOcupacion debe usar reports-preset-btn');

  const eventosAsignados = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsEventosAsignados.jsx'), 'utf8');
  assert.ok(eventosAsignados.includes('reports-btn-pdf'), 'ReportsEventosAsignados debe usar reports-btn-pdf');
});
