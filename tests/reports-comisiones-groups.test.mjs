import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

test('ReportsComisiones.jsx integra venta de habitaciones individuales y conmutador segmentado de grupos', () => {
  const code = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/ReportsComisiones.jsx'), 'utf8');

  // 1. Verificación de imports requeridos
  assert.ok(code.includes('getHabitacionesApi'), 'Debe importar getHabitacionesApi');
  assert.ok(code.includes('getEquipos'), 'Debe importar getEquipos');

  // 2. Conmutador segmentado en JSX
  assert.ok(code.includes('comisiones-segmented-container'), 'Debe contener contenedor segmentado comisiones-segmented-container');
  assert.ok(code.includes('comisiones-segmented-btn--todos'), 'Debe incluir botón Todos');
  assert.ok(code.includes('comisiones-segmented-btn--vendedores'), 'Debe incluir botón Vendedores');
  assert.ok(code.includes('comisiones-segmented-btn--recepcion'), 'Debe incluir botón Recepcionistas');

  // 3. Estados de habitación válidos y filtrado por fecha_check_in
  assert.ok(code.includes('VALID_ROOM_STATUSES'), 'Debe definir conjunto de estados válidos de habitaciones');
  assert.ok(code.includes('fecha_check_in'), 'Debe evaluar habitaciones por fecha_check_in');

  // 4. Acumulación y suma de venta de habitaciones
  assert.ok(code.includes('roomSalesByUser'), 'Debe acumular ventas de habitaciones por vendedor');
  assert.ok(code.includes('totalSalesAmount = eventSales + roomSales'), 'Debe sumar ventas de eventos + habitaciones para la comisión');

  // 5. Desglose en tabla detallada y tooltip
  assert.ok(code.includes('Eventos:'), 'Debe mostrar el desglose de Eventos');
  assert.ok(code.includes('Hab:'), 'Debe mostrar el desglose de Habitaciones');

  // 6. Clasificación de grupos
  assert.ok(code.includes('isReceptionistUser'), 'Debe implementar clasificador isReceptionistUser');
  // 7. Alineación estandarizada de controles del toolbar (36px inline)
  assert.ok(code.includes('comisiones-filter-colaborador'), 'Debe incluir clase comisiones-filter-colaborador');
  assert.ok(code.includes('comisiones-filter-colaborador-label'), 'Debe incluir label inline para colaborador');
  assert.ok(code.includes('hideLabel'), 'MultiSelect debe incluir hideLabel para evitar desfase vertical');
});

test('reports.css define estilos del conmutador segmentado de comisiones y alineación del toolbar', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'src/modules/reports/reports.css'), 'utf8');

  assert.ok(css.includes('.comisiones-segmented-container'), 'reports.css debe tener .comisiones-segmented-container');
  assert.ok(css.includes('.comisiones-segmented-btn'), 'reports.css debe tener .comisiones-segmented-btn');
  assert.ok(css.includes('.comisiones-segmented-btn--todos.active'), 'reports.css debe tener estilo activo para Todos');
  assert.ok(css.includes('.comisiones-segmented-btn--vendedores.active'), 'reports.css debe tener estilo activo para Vendedores');
  assert.ok(css.includes('.comisiones-segmented-btn--recepcion.active'), 'reports.css debe tener estilo activo para Recepcionistas');
  assert.ok(css.includes('.comisiones-filter-colaborador'), 'reports.css debe tener .comisiones-filter-colaborador');
  assert.ok(css.includes('.comisiones-filter-colaborador-label'), 'reports.css debe tener .comisiones-filter-colaborador-label');
});

