import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const settingsMainPath = new URL('../src/modules/settings/SettingsMain.jsx', import.meta.url);
const settingsCssPath = new URL('../src/modules/settings/settings.css', import.meta.url);
const settingsUsuariosManagerPath = new URL('../src/modules/settings/SettingsUsuariosManager.jsx', import.meta.url);

test('SettingsMain define las 6 secciones ejecutivas en el sidebar de cápsulas', async () => {
  const source = await readFile(settingsMainPath, 'utf8');

  assert.match(source, /id:\s*'general',\s*label:\s*'General y Datos'/);
  assert.match(source, /id:\s*'estructura',\s*label:\s*'Salones y Metas'/);
  assert.match(source, /id:\s*'servicios',\s*label:\s*'Servicios y Catálogos'/);
  assert.match(source, /id:\s*'plantillas',\s*label:\s*'Plantillas'/);
  assert.match(source, /id:\s*'usuarios',\s*label:\s*'Usuarios y Roles'/);
  assert.match(source, /id:\s*'citas',\s*label:\s*'Citas y Alertas'/);
});

test('La pestaña Estructura y Espacios coincide exactamente con la maqueta de referencia', async () => {
  const source = await readFile(settingsMainPath, 'utf8');

  assert.match(source, /Estructura y Espacios/);
  assert.match(source, /Control de Infraestructura/i);
  assert.match(source, /Salones y Áreas/);
  assert.match(source, /Tipo de Cambio USD — GTQ/);
  assert.match(source, /Meta Mensual de Ventas/);
  assert.match(source, /Plantillas de Checklists/);

  // Colores de las tarjetas bento en la sección de estructura
  assert.match(source, /openView\('salones'\)[\s\S]{0,400}Salones y Áreas/);
  assert.match(source, /openView\('tipo-cambio'\)[\s\S]{0,400}Tipo de Cambio USD — GTQ/);
  assert.match(source, /openView\('metas'\)[\s\S]{0,400}Meta Mensual de Ventas/);
  assert.match(source, /openView\('checklist'\)[\s\S]{0,400}Plantillas de Checklists/);
});

test('Todas las tarjetas Bento cuentan con botón "Abrir →" y transiciones inline', async () => {
  const source = await readFile(settingsMainPath, 'utf8');

  // Comprueba que los botones tienen "Abrir →"
  const bentoButtons = source.match(/Abrir →/g) ?? [];
  assert.ok(bentoButtons.length >= 15, `Se esperaban al menos 15 botones 'Abrir →', encontrados ${bentoButtons.length}`);

  // Comprueba soporte para abrir todas las vistas inline principales
  assert.match(source, /activeInlineView === 'empresas'/);
  assert.match(source, /activeInlineView === 'usuarios'/);
  assert.match(source, /activeInlineView === 'equipos'/);
  assert.match(source, /activeInlineView === 'salones'/);
  assert.match(source, /activeInlineView === 'tipo-cambio'/);
  assert.match(source, /activeInlineView === 'metas'/);
  assert.match(source, /activeInlineView === 'checklist'/);
  assert.match(source, /activeInlineView === 'servicios'/);
  assert.match(source, /activeInlineView === 'formas-pago'/);
  assert.match(source, /activeInlineView === 'plantillas'/);
  assert.match(source, /activeInlineView === 'plantillas-contrato'/);
  assert.match(source, /activeInlineView === 'citas'/);
  assert.match(source, /activeInlineView === 'export'/);
  assert.match(source, /activeInlineView === 'import'/);
  assert.match(source, /activeInlineView === 'mantenimiento'/);
  assert.match(source, /activeInlineView === 'actualizaciones'/);
});

test('SettingsUsuariosManager acepta initialTab para aterrizar en usuarios o equipos', async () => {
  const source = await readFile(settingsUsuariosManagerPath, 'utf8');

  assert.match(source, /function SettingsUsuariosManager\(\{[^}]*initialTab\s*=\s*'usuarios'[^}]*\}\)/);
  assert.match(source, /useState\(initialTab/);
});

test('settings.css contiene los estilos del nuevo diseño ejecutivo (bento cards, banner, tags)', async () => {
  const css = await readFile(settingsCssPath, 'utf8');

  // Bento cards
  assert.match(css, /\.settings-bento-card/);
  assert.match(css, /\.settings-bento-card\.is-blue\s*\{\s*border-top-color:\s*#2563eb/);
  assert.match(css, /\.settings-bento-card\.is-green\s*\{\s*border-top-color:\s*#16a34a/);
  assert.match(css, /\.settings-bento-card\.is-amber\s*\{\s*border-top-color:\s*#f59e0b/);
  assert.match(css, /\.settings-bento-card\.is-purple\s*\{\s*border-top-color:\s*#8b5cf6/);

  // Storytelling banner
  assert.match(css, /\.settings-storytelling-card/);
  assert.match(css, /\.settings-storytelling-tag::before/);
  assert.match(css, /width:\s*3\.5px/);

  // Botón Abrir
  assert.match(css, /\.settings-bento-btn/);

  // Sidebar en cápsula
  assert.match(css, /\.settings-nav-item/);
  assert.match(css, /\.settings-nav-item\.active/);
});
