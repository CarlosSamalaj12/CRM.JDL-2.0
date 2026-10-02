import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('eventsController.js implementa toIsoDate, DATE_FORMAT y filtrado por última versión activa de informes', () => {
  const filePath = path.join(projectRoot, 'backend', 'src', 'controllers', 'eventsController.js');
  assert.ok(fs.existsSync(filePath), 'eventsController.js debe existir');
  const content = fs.readFileSync(filePath, 'utf8');

  // toIsoDate helper
  assert.ok(content.includes('const toIsoDate = (val) =>'), 'Debe definir toIsoDate');

  // Query solo a la última versión activa de cada informe/ocupación
  assert.ok(content.includes('ORDER BY i2.version DESC, i2.id DESC'), 'Debe filtrar por la versión más reciente en informesActivos');
  assert.ok(content.includes('LIMIT 1'), 'Debe limitar la subconsulta de versión a 1');

  // Consulta de días con DATE_FORMAT
  assert.ok(content.includes("DATE_FORMAT(idd.fecha_evento, '%Y-%m-%d') AS fecha_evento"), 'Debe formatear fecha_evento con DATE_FORMAT');

  // Comparación de fechas usando toIsoDate
  assert.ok(content.includes('const diaFecha = toIsoDate(d.fecha_evento);'), 'Debe normalizar diaFecha con toIsoDate');
  assert.ok(content.includes('toIsoDate(s.dateStart'), 'Debe normalizar sStart con toIsoDate');
});

test('informeController.js implementa toIsoDate, DATE_FORMAT y filtrado por versión en checkEventInformes', () => {
  const filePath = path.join(projectRoot, 'backend', 'src', 'controllers', 'informeController.js');
  assert.ok(fs.existsSync(filePath), 'informeController.js debe existir');
  const content = fs.readFileSync(filePath, 'utf8');

  // toIsoDate helper
  assert.ok(content.includes('function toIsoDate(value)'), 'Debe definir toIsoDate');

  // checkEventInformes solo toma la última versión activa
  assert.ok(content.includes('ORDER BY i2.version DESC, i2.id DESC'), 'checkEventInformes debe filtrar por última versión');

  // Consulta con DATE_FORMAT y toIsoDate
  assert.ok(content.includes("DATE_FORMAT(idd.fecha_evento, '%Y-%m-%d') AS fecha_evento"), 'checkEventInformes debe usar DATE_FORMAT');
  assert.ok(content.includes('fecha: toIsoDate(d.fecha_evento)'), 'checkEventInformes debe formatear fecha con toIsoDate');
});

test('ReservationForm.jsx guarda cotizaciones atómicamente sin gatillar handleAddEvent innecesario para eventos existentes', () => {
  const filePath = path.join(projectRoot, 'src', 'modules', 'calendar', 'components', 'ReservationForm.jsx');
  assert.ok(fs.existsSync(filePath), 'ReservationForm.jsx debe existir');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.ok(content.includes('await eventService.saveQuote(targetId, quoteData, newStatus)'), 'Debe llamar a eventService.saveQuote');
  assert.ok(content.includes('refreshData(true)'), 'Debe refrescar datos en segundo plano');
  
  // Verificar que dentro de if (typeof eventService?.saveQuote... ) NO se llame a handleAddEvent
  const saveQuoteBlockMatch = content.match(/if \(typeof eventService\?\.saveQuote === 'function' && \(id \|\| currentEvent\.id\)\) \{([\s\S]*?)\} else \{/);
  assert.ok(saveQuoteBlockMatch, 'Debe existir el bloque if para saveQuote');
  assert.ok(!saveQuoteBlockMatch[1].includes('handleAddEvent'), 'El bloque atómico de saveQuote no debe invocar handleAddEvent redundante');
});

test('eventsController.js protege actualizaciones parciales con hasExplicitMultiSlots y slotsForCoverageCheck', () => {
  const filePath = path.join(projectRoot, 'backend', 'src', 'controllers', 'eventsController.js');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.ok(content.includes('const hasExplicitMultiSlots ='), 'Debe detectar si es una actualización multi-slot explícita');
  assert.ok(content.includes('let slotsForCoverageCheck = expanded;'), 'Debe inicializar slotsForCoverageCheck');
  assert.ok(content.includes('if (!hasExplicitMultiSlots) {'), 'Debe consultar slots existentes de BD si no es multi-slot');
  assert.ok(content.includes('if (hasExplicitMultiSlots && expanded.length > 0) {'), 'Solo debe borrar slots huérfanos si es multi-slot explícito');
});

test('server.cjs asegura nulabilidad de id_empresa e id_encargado en cotizaciones_evento', () => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  const content = fs.readFileSync(serverPath, 'utf8');

  assert.ok(content.includes('ALTER TABLE cotizaciones_evento MODIFY COLUMN id_empresa VARCHAR(200) NULL DEFAULT NULL'), 'Debe incluir migración para id_empresa NULL');
  assert.ok(content.includes('MODIFY COLUMN id_encargado VARCHAR(200) NULL DEFAULT NULL'), 'Debe incluir migración para id_encargado NULL');
});

