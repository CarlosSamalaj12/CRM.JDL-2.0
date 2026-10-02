import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const informeViewPath = new URL('../src/modules/informes/pages/InformeView.jsx', import.meta.url);
const stylesCssPath = new URL('../src/modules/informes/styles.css', import.meta.url);

test('InformeView.jsx implementa selector de días ejecutivo y minimalista sin emojis', async () => {
  const content = await readFile(informeViewPath, 'utf8');

  // Erradicación de emojis del sistema operativo en el selector de días
  assert.ok(!content.includes('📅 DÍA DEL EVENTO'), 'No debe incluir el emoji 📅 en DÍA DEL EVENTO');
  assert.ok(!content.includes('📋 Ver todos los días'), 'No debe incluir el emoji 📋 en Ver todos los días');
  assert.ok(!content.includes('<select'), 'No debe usar el elemento <select> nativo para el selector de días');

  // Iconos vectoriales minimalistas SVG
  assert.match(content, /IconCalendar/);
  assert.match(content, /IconLayers/);
  assert.match(content, /IconBuilding/);
  assert.match(content, /IconChevronDown/);
  assert.match(content, /IconCheck/);

  // Estructura de barra ejecutiva
  assert.match(content, /iv-dia-selector-bar/);
  assert.match(content, /iv-dia-badge-block/);
  assert.match(content, /iv-dia-segmented-pills/);
  assert.match(content, /iv-dia-pill-btn/);
  assert.match(content, /iv-dia-custom-dropdown-wrap/);
  assert.match(content, /iv-dia-dropdown-trigger/);
  assert.match(content, /iv-dia-dropdown-menu/);
});

test('styles.css contiene los estilos ejecutivos y responsivos del selector de días', async () => {
  const css = await readFile(stylesCssPath, 'utf8');

  assert.match(css, /\.iv-dia-selector-bar/);
  assert.match(css, /\.iv-dia-badge-icon/);
  assert.match(css, /\.iv-dia-segmented-pills/);
  assert.match(css, /\.iv-dia-pill-btn\.active/);
  assert.match(css, /\.iv-dia-dropdown-trigger/);
  assert.match(css, /\.iv-dia-dropdown-menu/);
  assert.match(css, /\.iv-dia-menu-item\.is-selected/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.iv-dia-selector-bar/);
});
