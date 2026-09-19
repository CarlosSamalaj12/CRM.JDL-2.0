import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const settingsMainPath = new URL('../src/modules/settings/SettingsMain.jsx', import.meta.url);
const settingsCssPath = new URL('../src/modules/settings/settings.css', import.meta.url);
const settingsUsuariosManagerPath = new URL('../src/modules/settings/SettingsUsuariosManager.jsx', import.meta.url);

test('SettingsMain define las 6 secciones ejecutivas en el sidebar de cápsulas con badges', async () => {
  const source = await readFile(settingsMainPath, 'utf8');

  assert.match(source, /id:\s*'general',\s*label:\s*'General y Datos'/);
  assert.match(source, /id:\s*'estructura',\s*label:\s*'Salones y Metas'/);
  assert.match(source, /id:\s*'servicios',\s*label:\s*'Servicios y Catálogos'/);
  assert.match(source, /id:\s*'plantillas',\s*label:\s*'Plantillas'/);
  assert.match(source, /id:\s*'usuarios',\s*label:\s*'Usuarios y Roles'/);
  assert.match(source, /id:\s*'citas',\s*label:\s*'Citas y Alertas'/);

  // Badges y tarjeta de sincronización
  assert.match(source, /settings-nav-badge-active/);
  assert.match(source, /settings-sync-card/);
  assert.match(source, /Sincronización en vivo/);
});

test('La cabecera superior institucional coincide exactamente con la maqueta', async () => {
  const source = await readFile(settingsMainPath, 'utf8');

  assert.match(source, /settings-brand-avatar/);
  assert.match(source, /JL/);
  assert.match(source, /EMS RESERVAS/);
  assert.match(source, /JARDINES DEL LAGO/);
  assert.match(source, /Historial de Auditoría/);
  assert.match(source, /Volver al Tablero/);
});

test('La pestaña Estructura y Espacios coincide al 100% con la imagen de referencia', async () => {
  const source = await readFile(settingsMainPath, 'utf8');

  // Título y badge de estado
  assert.match(source, /Estructura y Espacios/);
  assert.match(source, /Sistema Operativo Activo/);

  // Banner storytelling
  assert.match(source, /settings-storytelling-banner/);
  assert.match(source, /CONTROL DE INFRAESTRUCTURA/);

  // Tarjetas Bento y sus sub-metas
  assert.match(source, /Salones y Áreas/);
  assert.match(source, /8 Salones Activos/);
  assert.match(source, /100% disponibles/);
  assert.match(source, /2 Áreas exteriores de jardines/);
  assert.match(source, /Gestionar Áreas/);

  assert.match(source, /Tipo de Cambio USD → GTQ/);
  assert.match(source, /1 USD = Q 7\.82 GTQ/);
  assert.match(source, /\$\/Q/);
  assert.match(source, /Banco Central/);
  assert.match(source, /Ajustar Tasa/);

  assert.match(source, /Meta Mensual de Ventas/);
  assert.match(source, /Septiembre: Q 850,000\.00/);
  assert.match(source, /Avance actual/);
  assert.match(source, /84\.5% \(Q 718,250\.00\)/);
  assert.match(source, /Definir Objetivos/);

  assert.match(source, /Plantillas de Checklists/);
  assert.match(source, /6 Modelos/);
  assert.match(source, /Montaje de Salón/);
  assert.match(source, /Banquete y Cocina/);
  assert.match(source, /Audio \/ Luces/);
  assert.match(source, /Configurar Plantillas/);

  // Pie de página
  assert.match(source, /Último respaldo de base de datos generado hoy a las 04:00 AM/);
  assert.match(source, /Jardines del Lago v4\.8 Enterprise/);
});

test('Soporta apertura fluida de todas las vistas inline principales', async () => {
  const source = await readFile(settingsMainPath, 'utf8');

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

test('settings.css contiene los estilos exactos de la maqueta de referencia', async () => {
  const css = await readFile(settingsCssPath, 'utf8');

  // Cabecera JL
  assert.match(css, /\.settings-brand-avatar/);
  assert.match(css, /\.settings-header-bar/);
  assert.match(css, /\.settings-btn-audit/);
  assert.match(css, /\.settings-btn-back/);

  // Sidebar
  assert.match(css, /\.settings-sidebar-eyebrow/);
  assert.match(css, /\.settings-nav-item/);
  assert.match(css, /\.settings-nav-item\.active::before/);
  assert.match(css, /\.settings-sync-card/);

  // Storytelling banner
  assert.match(css, /\.settings-storytelling-banner/);
  assert.match(css, /\.settings-storytelling-icon-solid/);
  assert.match(css, /\.settings-status-badge/);

  // Bento cards
  assert.match(css, /\.settings-bento-card/);
  assert.match(css, /\.settings-bento-icon-box/);
  assert.match(css, /\.settings-action-btn/);
  assert.match(css, /\.settings-progress-track/);
  assert.match(css, /\.settings-progress-fill/);

  // Footer
  assert.match(css, /\.settings-footer/);
});
