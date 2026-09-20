import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('informeController.js blinda fechas de informes y provee endpoints checkEventInformes y reassignInformeSlot', () => {
  const controllerPath = path.join(projectRoot, 'backend', 'src', 'controllers', 'informeController.js');
  assert.ok(fs.existsSync(controllerPath), 'informeController.js debe existir');
  const content = fs.readFileSync(controllerPath, 'utf8');

  // Verificar que se eliminó la sobreescritura ciega de fecha_evento en fetchInformeWithDias
  assert.ok(
    !content.includes("UPDATE informe_dias_detalle SET fecha_evento = ? WHERE id_informe = ?"),
    'fetchInformeWithDias no debe mutar silenciosamente las fechas de informe_dias_detalle'
  );

  // Verificar existencia de checkEventInformes y reassignInformeSlot
  assert.ok(content.includes('export async function checkEventInformes'), 'Debe exportar checkEventInformes');
  assert.ok(content.includes('export async function reassignInformeSlot'), 'Debe exportar reassignInformeSlot');
  assert.ok(content.includes('UPDATE informes_eventos SET id_ocupacion = ?'), 'reassignInformeSlot debe actualizar id_ocupacion');
  assert.ok(content.includes('UPDATE informe_dias_detalle'), 'reassignInformeSlot debe actualizar salón y horario de días');
});

test('informeRoutes.js registra endpoints para chequeo de informes de evento y reasignación de slot', () => {
  const routesPath = path.join(projectRoot, 'backend', 'src', 'routes', 'informeRoutes.js');
  assert.ok(fs.existsSync(routesPath), 'informeRoutes.js debe existir');
  const content = fs.readFileSync(routesPath, 'utf8');

  assert.ok(content.includes('/check-event/:eventId'), 'Debe registrar GET /check-event/:eventId');
  assert.ok(content.includes('/:id/reassign-slot'), 'Debe registrar POST /:id/reassign-slot');
});

test('server.cjs elimina el desfase ciego de fechas y protege enlaces id_ocupacion de informes_eventos', () => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  assert.ok(fs.existsSync(serverPath), 'server.cjs debe existir');
  const content = fs.readFileSync(serverPath, 'utf8');

  // Verificar eliminación del trigger destructivo de intervalo de días
  assert.ok(
    !content.includes('DATE_ADD(idd.fecha_evento, INTERVAL ? DAY)'),
    'server.cjs no debe correr DATE_ADD con desfase ciego en informe_dias_detalle'
  );

  // Verificar protección de id_ocupacion para que no desvincule salones secundarios con informe activo
  assert.ok(
    content.includes('AND id_ocupacion NOT IN (SELECT id FROM eventos)'),
    'server.cjs debe proteger id_ocupacion para que no sobreescriba slots válidos existentes'
  );

  // Verificar migración ensureRepairDesyncedInformes
  assert.ok(
    content.includes('ensureRepairDesyncedInformes'),
    'server.cjs debe registrar y ejecutar la migración ensureRepairDesyncedInformes'
  );
});

test('ReservationForm.jsx integra detección de informes afectados y modal InformeTransferModal', () => {
  const formPath = path.join(projectRoot, 'src', 'modules', 'calendar', 'components', 'ReservationForm.jsx');
  assert.ok(fs.existsSync(formPath), 'ReservationForm.jsx debe existir');
  const content = fs.readFileSync(formPath, 'utf8');

  assert.ok(content.includes('InformeTransferModal'), 'ReservationForm debe importar InformeTransferModal');
  assert.ok(content.includes('checkEventInformes'), 'ReservationForm debe importar checkEventInformes');
  assert.ok(content.includes('informeTransferModal'), 'ReservationForm debe gestionar informeTransferModal');
  assert.ok(content.includes('handleConfirmInformeTransfer'), 'ReservationForm debe implementar handleConfirmInformeTransfer');
});

test('InformeTransferModal.jsx provee interfaz ejecutiva de transferencia de informe entre salones', () => {
  const modalPath = path.join(projectRoot, 'src', 'modules', 'calendar', 'components', 'InformeTransferModal.jsx');
  assert.ok(fs.existsSync(modalPath), 'InformeTransferModal.jsx debe existir');
  const content = fs.readFileSync(modalPath, 'utf8');

  assert.ok(content.includes('Guardar y Transferir Informe'), 'Debe incluir botón principal Guardar y Transferir Informe');
  assert.ok(content.includes('Guardar sin Transferir'), 'Debe incluir botón Guardar sin Transferir');
  assert.ok(content.includes('affectedInformes'), 'Debe recibir y procesar affectedInformes');
  assert.ok(content.includes('availableSlots'), 'Debe recibir y listar availableSlots');
});

test('ReassignSalonModal.jsx permite reasignación de salón desde vistas de informe', () => {
  const modalPath = path.join(projectRoot, 'src', 'modules', 'informes', 'components', 'ReassignSalonModal.jsx');
  assert.ok(fs.existsSync(modalPath), 'ReassignSalonModal.jsx debe existir');
  const content = fs.readFileSync(modalPath, 'utf8');

  assert.ok(content.includes('Reasignar Salón u Ocupación'), 'Debe titular Reasignar Salón u Ocupación');
  assert.ok(content.includes('reassignInformeSlot'), 'Debe llamar reassignInformeSlot');
  assert.ok(content.includes('updateDayContent'), 'Debe permitir conmutar actualización de contenido del día');
});

test('ConstructorInforme.jsx e InformeView.jsx integran botón Reasignar Salón y sincronización fiel por fecha', () => {
  const constructorPath = path.join(projectRoot, 'src', 'modules', 'informes', 'pages', 'ConstructorInforme.jsx');
  assert.ok(fs.existsSync(constructorPath), 'ConstructorInforme.jsx debe existir');
  const constructorContent = fs.readFileSync(constructorPath, 'utf8');

  assert.ok(constructorContent.includes('ReassignSalonModal'), 'ConstructorInforme debe incluir ReassignSalonModal');
  assert.ok(constructorContent.includes('Reasignar Salón'), 'ConstructorInforme debe mostrar botón Reasignar Salón');
  assert.ok(
    constructorContent.includes('crmDays.find(cd => cd.fecha === md.fecha)'),
    'ConstructorInforme debe sincronizar salón/horario por fecha exacta sin desfasar menús de comida'
  );

  const viewPath = path.join(projectRoot, 'src', 'modules', 'informes', 'pages', 'InformeView.jsx');
  assert.ok(fs.existsSync(viewPath), 'InformeView.jsx debe existir');
  const viewContent = fs.readFileSync(viewPath, 'utf8');

  assert.ok(viewContent.includes('ReassignSalonModal'), 'InformeView debe incluir ReassignSalonModal');
  assert.ok(viewContent.includes('Reasignar Salón'), 'InformeView debe mostrar botón Reasignar Salón en acciones');
});
