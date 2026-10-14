import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Reporte Dashboard: Unificación de título a "Dashboard"', () => {
  const dashboardFile = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsDashboard.jsx'), 'utf8');
  const reportInfoFile = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/components/ReportInfo.jsx'), 'utf8');
  const reportsModuleFile = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsModule.jsx'), 'utf8');
  const moduleContainerFile = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsModuleContainer.jsx'), 'utf8');

  // ReportsDashboard.jsx <h1> must be "Dashboard" (not "Dashboard Ejecutivo" nor "Dashboard Principal")
  assert.ok(dashboardFile.includes('Dashboard'), 'ReportsDashboard.jsx debe contener "Dashboard"');
  assert.ok(!dashboardFile.includes('Dashboard Ejecutivo'), 'ReportsDashboard.jsx no debe tener "Dashboard Ejecutivo"');
  assert.ok(!dashboardFile.includes('Dashboard Principal'), 'ReportsDashboard.jsx no debe tener "Dashboard Principal"');

  // ReportInfo.jsx key 'dashboard' title must be 'Dashboard'
  assert.ok(reportInfoFile.includes("title: 'Dashboard'"), 'ReportInfo.jsx debe definir el título "Dashboard" para dashboard');

  // ReportsModule.jsx card title must be 'Dashboard'
  assert.ok(reportsModuleFile.includes("id: 'dashboard', title: 'Dashboard'"), 'ReportsModule.jsx debe titular la tarjeta como "Dashboard"');

  // ReportsModuleContainer.jsx must label the report as 'Dashboard'
  assert.ok(moduleContainerFile.includes("label: 'Dashboard'"), 'ReportsModuleContainer.jsx debe listar el reporte como "Dashboard"');
});

test('Gráfico PAX por Día: Margen superior (headroom) y visibilidad de valores máximos sin truncamiento', () => {
  const dashboardFile = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsDashboard.jsx'), 'utf8');

  // Cálculo de yAxisMax con 20% de margen superior para evitar recorte en el techo del contenedor
  assert.ok(
    dashboardFile.includes('yAxisMax = maxDayPax > 0 ? Math.ceil(maxDayPax * 1.2) : 100'),
    'Debe calcular yAxisMax con margen superior del 20% (Math.ceil(maxDayPax * 1.2))'
  );

  // El porcentaje de altura de la barra debe calcularse con respecto a yAxisMax
  assert.ok(
    dashboardFile.includes('(pax / paxDayChartData.yAxisMax) * 100'),
    'pct de la barra debe calcularse contra paxDayChartData.yAxisMax'
  );

  // Contenedor con overflowX debe tener paddingTop para que las etiquetas no se recorten
  assert.ok(
    dashboardFile.includes("paddingTop: '16px'"),
    'El contenedor con scroll horizontal debe tener paddingTop para proteger las etiquetas'
  );

  // Escala del eje Y debe usar yAxisMax
  assert.ok(
    dashboardFile.includes('{paxDayChartData.yAxisMax}'),
    'El eje Y debe mostrar el tope superior yAxisMax'
  );
});

test('Gráfico PAX por Día: Muestra "0" en días sin PAX en lugar de ocultar la etiqueta', () => {
  const dashboardFile = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsDashboard.jsx'), 'utf8');

  // Debe renderizar {pax} incondicionalmente
  assert.ok(
    dashboardFile.includes('{pax}'),
    'Debe renderizar {pax} directamente sobre la barra'
  );

  // No debe existir condición que oculte la etiqueta cuando pax <= 0
  assert.ok(
    !dashboardFile.includes('{pax > 0 && <span') && !dashboardFile.includes('{pax > 0 && (\n                                <span'),
    'No debe condicionar la etiqueta del número de pax a {pax > 0}'
  );

  // Debe contar con diferenciación cromática entre pax > 0 y 0
  assert.ok(
    dashboardFile.includes("color: pax > 0 ? '#2563eb' : '#94a3b8'"),
    'Debe mostrar color azul (#2563eb) cuando pax > 0 y color slate (#94a3b8) cuando pax === 0'
  );
});
