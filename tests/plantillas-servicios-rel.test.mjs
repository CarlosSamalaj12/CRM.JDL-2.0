import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('server.cjs define la migración ensurePlantillasStructure con tablas relacionales y claves foráneas', () => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  assert.ok(serverCode.includes('function ensurePlantillasStructure'), 'Debe definir ensurePlantillasStructure()');
  assert.ok(serverCode.includes('CREATE TABLE IF NOT EXISTS plantillas_cotizacion'), 'Debe crear tabla plantillas_cotizacion');
  assert.ok(serverCode.includes('CREATE TABLE IF NOT EXISTS plantillas_cotizacion_items'), 'Debe crear tabla plantillas_cotizacion_items');
  assert.ok(serverCode.includes('fk_pci_plantilla'), 'Debe tener clave foránea hacia plantillas_cotizacion');
  assert.ok(serverCode.includes('fk_pci_servicio'), 'Debe tener clave foránea hacia servicios');
  assert.ok(serverCode.includes('PlantillasStructure'), 'Debe estar registrado en MIGRATIONS');
  assert.ok(serverCode.includes('ensurePlantillasStructure'), 'Debe estar en CANONICAL_MIGRATIONS');
});

test('server.cjs consulta plantillas con JOIN hacia servicios para reflejar nombres y precios actualizados', () => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  assert.ok(serverCode.includes('function readPlantillasFromTables'), 'Debe definir readPlantillasFromTables()');
  assert.ok(serverCode.includes('LEFT JOIN servicios s ON s.id = i.id_servicio'), 'Debe hacer JOIN con servicios');
  assert.ok(serverCode.includes('s.nombre AS servicio_nombre'), 'Debe obtener el nombre maestro del servicio');
  assert.ok(serverCode.includes('s.precio AS servicio_precio'), 'Debe obtener el precio maestro del servicio');
});

test('server.cjs sincroniza plantillas y emite eventos al actualizar o eliminar un servicio', () => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  assert.ok(serverCode.includes("emitServerChange('plantilla', 'updated'"), 'Debe emitir cambio de plantilla al actualizar servicio');
  assert.ok(serverCode.includes("UPDATE plantillas_cotizacion_items"), 'Debe sincronizar plantillas_cotizacion_items');
});

test('server.cjs expone endpoints atómicos para plantillas', () => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  assert.ok(serverCode.includes('app.get("/api/plantillas"'), 'Debe tener endpoint GET /api/plantillas');
  assert.ok(serverCode.includes('app.post("/api/plantillas"'), 'Debe tener endpoint POST /api/plantillas');
  assert.ok(serverCode.includes('app.delete("/api/plantillas/:id"'), 'Debe tener endpoint DELETE /api/plantillas/:id');
});

test('stateService.js exporta métodos atómicos para plantillas', () => {
  const stateServicePath = path.join(projectRoot, 'src', 'services', 'stateService.js');
  const stateServiceCode = fs.readFileSync(stateServicePath, 'utf8');

  assert.ok(stateServiceCode.includes('export async function getPlantillasApi'), 'Debe exportar getPlantillasApi');
  assert.ok(stateServiceCode.includes('export async function savePlantillaApi'), 'Debe exportar savePlantillaApi');
  assert.ok(stateServiceCode.includes('export async function deletePlantillaApi'), 'Debe exportar deletePlantillaApi');
  assert.ok(stateServiceCode.includes('getPlantillasApi,'), 'Debe incluirse en el default export');
  assert.ok(stateServiceCode.includes('savePlantillaApi,'), 'Debe incluirse en el default export');
  assert.ok(stateServiceCode.includes('deletePlantillaApi,'), 'Debe incluirse en el default export');
});

test('SettingsPlantillas.jsx resuelve ítems dinámicamente contra el catálogo y usa endpoints atómicos', () => {
  const plantillasPath = path.join(projectRoot, 'src', 'modules', 'settings', 'SettingsPlantillas.jsx');
  const plantillasCode = fs.readFileSync(plantillasPath, 'utf8');

  assert.ok(plantillasCode.includes('getResolvedItem'), 'Debe implementar resolución de ítems contra catálogo');
  assert.ok(plantillasCode.includes('savePlantillaApi'), 'Debe usar savePlantillaApi');
  assert.ok(plantillasCode.includes('deletePlantillaApi'), 'Debe usar deletePlantillaApi');
  assert.ok(!plantillasCode.includes('stateService.saveState'), 'No debe serializar todo el estado con saveState');
  assert.ok(plantillasCode.includes('Sincronizado con catálogo'), 'Debe indicar que el ítem está sincronizado con el catálogo');
});

test('QuoteModal.jsx resuelve ítems de plantilla dinámicamente con catalogServices', () => {
  const quoteModalPath = path.join(projectRoot, 'src', 'modules', 'calendar', 'components', 'QuoteModal.jsx');
  const quoteModalCode = fs.readFileSync(quoteModalPath, 'utf8');

  assert.ok(quoteModalCode.includes('handleApplyTemplate'), 'Debe contener handleApplyTemplate');
  assert.ok(quoteModalCode.includes('catalogServices.find'), 'Debe resolver dinámicamente contra catalogServices al aplicar');
});
