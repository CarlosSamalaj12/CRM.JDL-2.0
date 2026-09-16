import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const kanbanPath = new URL('../src/modules/informes/pages/Kanban.jsx', import.meta.url);
const eventCardPath = new URL('../src/modules/informes/components/EventCard.jsx', import.meta.url);
const searchCssPath = new URL('../src/modules/search/search.css', import.meta.url);
const webPushHelperPath = new URL('../backend/src/helpers/webPushHelper.js', import.meta.url);
const webPushServicePath = new URL('../src/services/webPushService.js', import.meta.url);
const swPath = new URL('../public/sw.js', import.meta.url);

test('Kanban.jsx solo pasa highlightNotaId a la tarjeta del evento mencionado', async () => {
  const source = await readFile(kanbanPath, 'utf8');

  // Verifica que highlightNotaId esté condicionado al evento específico
  assert.match(source, /highlightNotaId=\{\s*\(\s*eventoResaltado === String\(event\.Idocupacion\)\s*\|\|\s*searchParams\.get\('highlightEvento'\) === String\(event\.Idocupacion\)\s*\)\s*\?\s*searchParams\.get\('notaId'\)\s*:\s*null\s*\}/);
  // Asegura que no se pase indiscriminadamente a todas las tarjetas
  assert.doesNotMatch(source, /highlightNotaId=\{searchParams\.get\('notaId'\)\}/);
});

test('EventCard.jsx reacciona a highlightNotaId abriendo su cajón de notas', async () => {
  const source = await readFile(eventCardPath, 'utf8');

  assert.match(source, /useEffect\(\(\) => \{\s*if \(highlightNotaId\) \{\s*setNotasOpen\(true\);\s*\}\s*\}, \[highlightNotaId\]\);/);
});

test('search.css no tiene selectores descontextualizados que arruinen los view-toggle-btn de Kanban', async () => {
  const source = await readFile(searchCssPath, 'utf8');

  // No debe tener .view-toggle-btn desnudo
  assert.doesNotMatch(source, /(?:^|\n)\.view-toggle-btn\s*\{/);
  assert.doesNotMatch(source, /,\s*\.view-toggle-btn\s*\{/);
  assert.match(source, /\.search-view-toggle \.view-toggle-btn/);
});

test('webPushHelper.js incluye objeto data con url en el payload push y usa pool compartido', async () => {
  const source = await readFile(webPushHelperPath, 'utf8');

  assert.match(source, /import pool from '\.\.\/config\/db\.js';/);
  assert.match(source, /data:\s*\{\s*\.\.\.data,\s*url:\s*targetUrl\s*\}/);
  assert.doesNotMatch(source, /err\.statusCode === 401/);
});

test('webPushService.js consulta clave VAPID dinámica en el backend y no usa clave legacy de firebase', async () => {
  const source = await readFile(webPushServicePath, 'utf8');

  assert.match(source, /\/api\/push\/vapid-public-key/);
  assert.match(source, /existingSub\.unsubscribe\(\)/);
  assert.doesNotMatch(source, /VITE_FIREBASE_VAPID_KEY/);
});

test('public/sw.js protege la propiedad vibrate para compatibilidad con iOS Safari/PWA', async () => {
  const source = await readFile(swPath, 'utf8');

  assert.match(source, /'vibrate' in navigator/);
  assert.match(source, /data\.data\?\.url \|\| data\.url/);
});
