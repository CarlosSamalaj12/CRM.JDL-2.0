import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const settingsServiciosPath = new URL('../src/modules/settings/SettingsServicios.jsx', import.meta.url);
const quoteModalPath = new URL('../src/modules/calendar/components/QuoteModal.jsx', import.meta.url);
const stateServicePath = new URL('../src/services/stateService.js', import.meta.url);
const serverPath = new URL('../server.cjs', import.meta.url);
const swPath = new URL('../public/sw.js', import.meta.url);

test('SettingsServicios usa endpoints atómicos y no serializa el estado completo', async () => {
  const source = await readFile(settingsServiciosPath, 'utf8');

  assert.match(source, /saveServiceApi/);
  assert.match(source, /deleteServiceApi/);
  assert.match(source, /batchImportServicesApi/);
  assert.match(source, /saveCategoryApi/);
  assert.match(source, /deleteCategoryApi/);
  assert.match(source, /saveSubcategoryApi/);
  assert.match(source, /deleteSubcategoryApi/);
  assert.doesNotMatch(source, /saveCrmState/);
});

test('Los modales en SettingsServicios no se cierran al hacer clic en el backdrop', async () => {
  const source = await readFile(settingsServiciosPath, 'utf8');

  // El backdrop (div con fixed/inset: 0) no debe tener el handler onClick que cerraba el modal
  assert.doesNotMatch(source, /<div[^>]*onClick=\{\(\) => setShowServiceModal\(false\)\}[^>]*inset:\s*0/s);
  assert.doesNotMatch(source, /<div[^>]*onClick=\{\(\) => setShowCategoryModal\(false\)\}[^>]*inset:\s*0/s);
  assert.doesNotMatch(source, /<div[^>]*onClick=\{\(\) => setShowSubcategoryModal\(false\)\}[^>]*inset:\s*0/s);

  // Botón de cierre ✕ presente en los modales
  assert.ok(source.includes('aria-label="Cerrar modal"'));
  assert.ok(source.includes('setShowServiceModal(false)'));
});

test('QuoteModal usa saveServiceApi para guardar servicios de catálogo de forma atómica', async () => {
  const source = await readFile(quoteModalPath, 'utf8');

  assert.match(source, /saveServiceApi\(savedService\)/);
  assert.doesNotMatch(source, /await saveCrmState\(\{\s*\.\.\.currentState,\s*services:\s*nextServices\s*\}\)/);
});

test('stateService exporta métodos atómicos de servicios, categorías y subcategorías', async () => {
  const source = await readFile(stateServicePath, 'utf8');

  assert.match(source, /export async function saveServiceApi/);
  assert.match(source, /export async function deleteServiceApi/);
  assert.match(source, /export async function batchImportServicesApi/);
  assert.match(source, /export async function saveCategoryApi/);
  assert.match(source, /export async function deleteCategoryApi/);
  assert.match(source, /export async function saveSubcategoryApi/);
  assert.match(source, /export async function deleteSubcategoryApi/);
});

test('server.cjs implementa endpoints atómicos de batch, subcategorías y resolución de relaciones', async () => {
  const source = await readFile(serverPath, 'utf8');

  assert.match(source, /app\.post\("\/api\/servicios\/batch"/);
  assert.match(source, /app\.delete\("\/api\/subcategorias-servicio\/:id"/);
  assert.match(source, /resolveCategoryAndSubcategoryIds/);
  assert.match(source, /ALTER TABLE servicios MODIFY COLUMN id VARCHAR\(255\)/);
});

test('public/sw.js maneja excepciones devolviendo Response garantizado en catch de assets', async () => {
  const source = await readFile(swPath, 'utf8');

  assert.match(source, /\.catch\(async \(\) => \{/);
  assert.match(source, /return new Response\('Offline'/);
});
