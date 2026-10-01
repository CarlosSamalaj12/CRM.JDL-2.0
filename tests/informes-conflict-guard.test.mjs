import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('server.cjs define y registra la migración ensureInformeConflictGuardStructure con tablas y columnas de blindaje', () => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  assert.ok(fs.existsSync(serverPath), 'server.cjs debe existir');
  const content = fs.readFileSync(serverPath, 'utf8');

  assert.ok(content.includes('async function ensureInformeConflictGuardStructure'), 'Debe definir ensureInformeConflictGuardStructure');
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS reserva_salones_fechas'), 'Debe crear tabla reserva_salones_fechas');
  assert.ok(content.includes('id_reserva_origen'), 'Debe agregar columna id_reserva_origen en informes_eventos');
  assert.ok(content.includes('deleted_at'), 'Debe agregar soporte para deleted_at en informes_eventos');
  assert.ok(content.includes('deleted_by'), 'Debe agregar soporte para deleted_by en informes_eventos');
  assert.ok(content.includes('slot_detalle_id'), 'Debe agregar slot_detalle_id en informe_dias_detalle');
  assert.ok(content.includes('rol_usuario'), 'Debe registrar rol_usuario en informe_historial');

  assert.ok(content.includes("{ name: 'InformeConflictGuardStructure', fn: ensureInformeConflictGuardStructure }"), 'Debe registrarse en MIGRATIONS');
  assert.ok(content.includes("'ensureInformeConflictGuardStructure'"), 'Debe registrarse en CANONICAL_MIGRATIONS');
});

test('informeController.js implementa applyInformeResolutionsInternal y resolveInformeConflicts con reassign, archive y delete', () => {
  const controllerPath = path.join(projectRoot, 'backend', 'src', 'controllers', 'informeController.js');
  assert.ok(fs.existsSync(controllerPath), 'informeController.js debe existir');
  const content = fs.readFileSync(controllerPath, 'utf8');

  assert.ok(content.includes('export async function applyInformeResolutionsInternal'), 'Debe exportar applyInformeResolutionsInternal');
  assert.ok(content.includes('export async function resolveInformeConflicts'), 'Debe exportar resolveInformeConflicts');

  // Acciones
  assert.ok(content.includes('action === \'reassign\''), 'Debe manejar acción reassign');
  assert.ok(content.includes('action === \'archive\''), 'Debe manejar acción archive');
  assert.ok(content.includes('action === \'delete\''), 'Debe manejar acción delete');

  // Archivar: estado = archivado y id_ocupacion = NULL
  assert.ok(content.includes('estado = "archivado"'), 'Archivar debe marcar estado archivado');
  assert.ok(content.includes('id_ocupacion = NULL'), 'Archivar debe limpiar id_ocupacion');

  // Eliminar: Soft delete con deleted_at = NOW()
  assert.ok(content.includes('estado = "eliminado"'), 'Eliminar debe marcar estado eliminado');
  assert.ok(content.includes('deleted_at = NOW()'), 'Eliminar debe ejecutar soft delete con deleted_at');

  // Auditoría obligatoria
  assert.ok(content.includes('INSERT INTO informe_historial'), 'Debe registrar cada acción en informe_historial');
  assert.ok(content.includes('rol_usuario'), 'Debe almacenar el rol del usuario en la auditoría');
});

test('informeRoutes.js registra POST /resolve-conflicts para resolución de conflictos', () => {
  const routesPath = path.join(projectRoot, 'backend', 'src', 'routes', 'informeRoutes.js');
  assert.ok(fs.existsSync(routesPath), 'informeRoutes.js debe existir');
  const content = fs.readFileSync(routesPath, 'utf8');

  assert.ok(content.includes('/resolve-conflicts'), 'Debe registrar ruta /resolve-conflicts');
  assert.ok(content.includes('resolveInformeConflicts'), 'Debe vincular a informeController.resolveInformeConflicts');
});

test('eventsController.js ejecuta blindaje antidesfase retornando HTTP 409 Conflict si hay desfasamiento no resuelto', () => {
  const eventsCtrlPath = path.join(projectRoot, 'backend', 'src', 'controllers', 'eventsController.js');
  assert.ok(fs.existsSync(eventsCtrlPath), 'eventsController.js debe existir');
  const content = fs.readFileSync(eventsCtrlPath, 'utf8');

  assert.ok(content.includes('applyInformeResolutionsInternal'), 'eventsController debe importar applyInformeResolutionsInternal');
  assert.ok(content.includes('INFORMES_DESYNC_BLOCKED'), 'Debe emitir código INFORMES_DESYNC_BLOCKED ante desfasamiento');
  assert.ok(content.includes('res.status(409)'), 'Debe bloquear con HTTP 409 Conflict');
  assert.ok(content.includes('applyInformeResolutionsInternal(conn, baseId, informeResolutions'), 'Debe aplicar resoluciones en la misma transacción atómica');
});

test('eventService.js envía informeResolutions y no silencia errores 409 en el fallback', () => {
  const servicePath = path.join(projectRoot, 'src', 'services', 'eventService.js');
  assert.ok(fs.existsSync(servicePath), 'eventService.js debe existir');
  const content = fs.readFileSync(servicePath, 'utf8');

  assert.ok(content.includes('informeResolutions'), 'eventService debe incluir informeResolutions en el payload de update');
  assert.ok(content.includes('apiErr?.status === 409'), 'eventService debe verificar status 409');
  assert.ok(content.includes('throw apiErr'), 'eventService debe relanzar errores 409 para el guard de la interfaz');
});

test('InformeTransferModal.jsx implementa la UI moderna con Bento cards, SVG minimalistas y Pills Tri-Estado', () => {
  const modalPath = path.join(projectRoot, 'src', 'modules', 'calendar', 'components', 'InformeTransferModal.jsx');
  assert.ok(fs.existsSync(modalPath), 'InformeTransferModal.jsx debe existir');
  const content = fs.readFileSync(modalPath, 'utf8');

  // Pills de acciones tri-estado
  assert.ok(content.includes('Reasignar'), 'Debe incluir opción Reasignar');
  assert.ok(content.includes('Archivar'), 'Debe incluir opción Archivar');
  assert.ok(content.includes('Eliminar'), 'Debe incluir opción Eliminar');

  // Iconos minimalistas SVG (no librerías externas)
  assert.ok(content.includes('IconSwap'), 'Debe incluir IconSwap');
  assert.ok(content.includes('IconArchive'), 'Debe incluir IconArchive');
  assert.ok(content.includes('IconTrash'), 'Debe incluir IconTrash');
  assert.ok(content.includes('IconShieldAlert'), 'Debe incluir IconShieldAlert');

  // Botones y confirmación
  assert.ok(content.includes('Confirmar y Guardar Reserva'), 'Debe incluir botón Confirmar y Guardar Reserva');
  assert.ok(content.includes('Cancelar Modificación'), 'Debe incluir botón Cancelar');
});

test('ReservationForm.jsx ejecuta chequeo granular y maneja tanto pre-validación como respuesta 409 del backend', () => {
  const formPath = path.join(projectRoot, 'src', 'modules', 'calendar', 'components', 'ReservationForm.jsx');
  assert.ok(fs.existsSync(formPath), 'ReservationForm.jsx debe existir');
  const content = fs.readFileSync(formPath, 'utf8');

  assert.ok(content.includes('checkEventInformes'), 'Debe consultar informes activos');
  assert.ok(content.includes('conflicts'), 'Debe identificar conflictos granulares');
  assert.ok(content.includes('informeResolutions'), 'Debe incluir informeResolutions en la llamada de guardado');
  assert.ok(content.includes('err?.status === 409'), 'Debe capturar respuesta 409 y activar el modal');
});
