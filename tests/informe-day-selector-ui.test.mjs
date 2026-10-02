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

  // Estructura de barra ejecutiva slim
  assert.match(content, /iv-dia-selector-bar/);
  assert.match(content, /iv-dia-label-side/);
  assert.match(content, /iv-dia-icon-box/);
  assert.match(content, /iv-dia-dropdown-wrap/);
  assert.match(content, /iv-dia-trigger-btn/);
  assert.match(content, /iv-dia-menu-popover/);
  assert.match(content, /iv-dia-popover-item/);
});

test('styles.css contiene los estilos ejecutivos y responsivos del selector de días', async () => {
  const css = await readFile(stylesCssPath, 'utf8');

  assert.match(css, /\.iv-dia-selector-bar/);
  assert.match(css, /\.iv-dia-label-side/);
  assert.match(css, /\.iv-dia-trigger-btn/);
  assert.match(css, /\.iv-dia-trigger-btn\.open/);
  assert.match(css, /\.iv-dia-menu-popover/);
  assert.match(css, /\.iv-dia-popover-item\.selected/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.iv-dia-selector-bar/);
});

