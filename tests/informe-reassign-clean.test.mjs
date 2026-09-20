import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('informeController.js: fetchInformeWithDias prioriza slot exacto y seriesSlots busca por id_ocupacion', () => {
  const controllerPath = path.join(projectRoot, 'backend', 'src', 'controllers', 'informeController.js');
  assert.ok(fs.existsSync(controllerPath), 'informeController.js debe existir');
  const content = fs.readFileSync(controllerPath, 'utf8');

  // Verificar que fetchInformeWithDias busca primero el slot exacto en tbl_seguimientocotizaciones
  assert.ok(
    content.includes('WHERE e.Idocupacion = ? OR e.Idocupacion = ? OR REPLACE(e.Idocupacion, \'#\', \'\') = ?'),
    'fetchInformeWithDias debe consultar coincidencia exacta con el slot asignado'
  );

  // Verificar que no sobreescribe ciegamente con el slot principal
  assert.ok(
    content.includes('Preservar Salon, Pax, FechaEvento, HoraI, HoraF del slot específico'),
    'fetchInformeWithDias debe preservar los datos específicos del slot asignado'
  );

  // Verificar que seriesSlots busca por coincidencia exacta con el slot asignado
  assert.ok(
    content.includes('sClean === cleanOcupacionId'),
    'seriesSlots debe buscar primero por el slot asignado para no confundir salones que comparten fecha'
  );

  // Verificar reassignInformeSlot con limpieza de ID y actualización de montajes
  assert.ok(
    content.includes("const cleanSlotId = String(targetSlotId).replace(/^#/, '').trim();"),
    'reassignInformeSlot debe limpiar prefijo # del ID del slot'
  );
  assert.ok(
    content.includes('parsed.montajes.forEach(m => {'),
    'reassignInformeSlot debe actualizar todos los montajes dentro del día'
  );
  assert.ok(
    content.includes("req.io.emit('informe:reassigned'"),
    'reassignInformeSlot debe emitir evento informe:reassigned'
  );
});

test('InformeView.jsx: erradica concatenación con comas y actualiza ruta al reasignar', () => {
  const viewPath = path.join(projectRoot, 'src', 'modules', 'informes', 'pages', 'InformeView.jsx');
  assert.ok(fs.existsSync(viewPath), 'InformeView.jsx debe existir');
  const content = fs.readFileSync(viewPath, 'utf8');

  // Verificar que montajesSalones reemplazó a salonesDelDia y no concatena dia.slot_salon con montajes
  assert.ok(
    !content.includes('const salonesDelDia = ['),
    'InformeView.jsx no debe usar salonesDelDia que concatenaba salones con comas'
  );
  assert.ok(
    content.includes('const montajesSalones = Array.from(new Set('),
    'InformeView.jsx debe usar montajesSalones con jerarquía estricta'
  );

  // Verificar ReassignSalonModal props y navegación
  assert.ok(
    content.includes('informeId={informe?.id || id}'),
    'InformeView.jsx debe pasar informeId limpio'
  );
  assert.ok(
    content.includes('currentOcupacionId={informe?.id_ocupacion || id}'),
    'InformeView.jsx debe pasar currentOcupacionId limpio'
  );
  assert.ok(
    content.includes('navigate(`/informe/${newInfo.targetSlotId}`'),
    'InformeView.jsx debe navegar a la nueva ruta del informe reasignado'
  );
});

test('ReassignSalonModal.jsx: evalúa isCurrent con ID normalizado y bloquea reasignación al mismo salón', () => {
  const modalPath = path.join(projectRoot, 'src', 'modules', 'informes', 'components', 'ReassignSalonModal.jsx');
  assert.ok(fs.existsSync(modalPath), 'ReassignSalonModal.jsx debe existir');
  const content = fs.readFileSync(modalPath, 'utf8');

  // Verificar normalización de IDs y evaluación de isCurrent
  assert.ok(
    content.includes('isCurrent: sId === normId'),
    'isCurrent debe basarse estrictamente en la igualdad del ID normalizado del slot'
  );
  assert.ok(
    !content.includes('sSalon.toLowerCase() === currentSalon.toLowerCase()'),
    'isCurrent no debe marcar positivo solo por coincidencia de nombre de salón'
  );

  // Verificar badges
  assert.ok(
    content.includes('● Salón Actual'),
    'ReassignSalonModal debe mostrar badge ● Salón Actual'
  );
  assert.ok(
    content.includes('Disponible'),
    'ReassignSalonModal debe mostrar badge Disponible para los demás salones'
  );

  // Verificar validación de mismo salón
  assert.ok(
    content.includes('El informe ya está asignado a este salón'),
    'ReassignSalonModal debe evitar reasignar al mismo salón actual'
  );
});

test('ConstructorInforme.jsx: incluye slotId en crmDays y busca por slotId asignado', () => {
  const constructorPath = path.join(projectRoot, 'src', 'modules', 'informes', 'pages', 'ConstructorInforme.jsx');
  assert.ok(fs.existsSync(constructorPath), 'ConstructorInforme.jsx debe existir');
  const content = fs.readFileSync(constructorPath, 'utf8');

  assert.ok(
    content.includes('slotId: cleanSlot'),
    'ConstructorInforme debe almacenar slotId en crmDays'
  );
  assert.ok(
    content.includes('cd.slotId === cleanOcupId'),
    'ConstructorInforme debe priorizar coincidencia por slotId para no sobreescribir salones en la misma fecha'
  );
});

test('server.cjs: normaliza prefijo # en la sincronización de informes_eventos con salón principal', () => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  assert.ok(fs.existsSync(serverPath), 'server.cjs debe existir');
  const content = fs.readFileSync(serverPath, 'utf8');

  assert.ok(
    content.includes("REPLACE(id_ocupacion, '#', '') NOT IN (SELECT REPLACE(id, '#', '') FROM eventos)"),
    'server.cjs debe normalizar # para no desvincular slots válidos existentes'
  );
});
