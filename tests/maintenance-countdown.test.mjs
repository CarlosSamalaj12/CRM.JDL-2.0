import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

test('Modo Mantenimiento: Conteo Regresivo de 30 Segundos y Sincronización', async (t) => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  const serverContent = fs.readFileSync(serverPath, 'utf8');

  const appPath = path.join(projectRoot, 'src/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  const bannerPath = path.join(projectRoot, 'src/components/MaintenanceCountdownBanner.jsx');
  const bannerContent = fs.readFileSync(bannerPath, 'utf8');

  const settingsMantenimientoPath = path.join(projectRoot, 'src/modules/settings/SettingsMantenimiento.jsx');
  const settingsMantenimientoContent = fs.readFileSync(settingsMantenimientoPath, 'utf8');

  await t.test('server.cjs almacena maintenanceStartsAt y sincroniza startsAt en endpoints y sockets', () => {
    assert.match(
      serverContent,
      /clave IN \('maintenanceMode', 'maintenanceStartsAt'\)/,
      'GET /api/maintenance-status debe consultar maintenanceMode y maintenanceStartsAt'
    );
    assert.match(
      serverContent,
      /res\.json\(\{\s*maintenanceMode,\s*startsAt\s*\}\)/,
      'GET /api/maintenance-status debe retornar { maintenanceMode, startsAt }'
    );
    assert.match(
      serverContent,
      /io\.emit\("maintenance-status-changed",\s*\{\s*maintenanceMode:\s*isEnabled,\s*startsAt,\s*duration:\s*30\s*\}\)/,
      'Socket debe emitir maintenance-status-changed con startsAt y duration 30'
    );
  });

  await t.test('MaintenanceCountdownBanner implementa barra superior fija con cuenta regresiva y audio', () => {
    assert.match(
      bannerContent,
      /export default function MaintenanceCountdownBanner/,
      'Componente MaintenanceCountdownBanner debe estar exportado'
    );
    assert.match(
      bannerContent,
      /secondsLeft/,
      'Debe gestionar el estado reactivo secondsLeft'
    );
    assert.match(
      bannerContent,
      /AudioCtx/,
      'Debe incluir aviso sonoro autónomo con Web Audio API'
    );
    assert.match(
      bannerContent,
      /AVISO: MODO MANTENIMIENTO EN/,
      'Debe mostrar el mensaje visible de advertencia para guardar datos'
    );
  });

  await t.test('App.jsx monta el banner durante el período de gracia sin bloquear la navegación', () => {
    assert.match(
      appContent,
      /import MaintenanceCountdownBanner from '\.\/components\/MaintenanceCountdownBanner'/,
      'App.jsx debe importar MaintenanceCountdownBanner'
    );
    assert.match(
      appContent,
      /const isGracePeriod = maintenance && maintenanceStartsAt && \(maintenanceStartsAt > now\) && !gracePeriodExpired;/,
      'App.jsx debe calcular el período de gracia activo'
    );
    assert.match(
      appContent,
      /<MaintenanceCountdownBanner/,
      'App.jsx debe renderizar el banner de conteo durante el período de gracia'
    );
  });

  await t.test('App.jsx inicializa socketService globalmente, polling de 6s y storage sync para Kanban e Informes', () => {
    assert.match(
      appContent,
      /socketService\.connect\(\)/,
      'App.jsx debe conectar socketService globalmente para todas las rutas (Kanban, Informes, etc.)'
    );
    assert.match(
      appContent,
      /crm_maintenance_sync/,
      'App.jsx debe sincronizar eventos de mantenimiento inter-pestañas mediante storage event'
    );
    assert.match(
      appContent,
      /setInterval\(checkMaintenance,\s*6000\)/,
      'App.jsx debe implementar sondeo de respaldo periódico cada 6s'
    );
  });

  await t.test('SettingsMantenimiento permite iniciar conteo de 30s, sincronización local y bloqueo inmediato', () => {
    assert.match(
      settingsMantenimientoContent,
      /saveSettingApi\('maintenanceMode',\s*\{\s*enabled:\s*true,\s*immediate:\s*false,\s*duration:\s*30\s*\}\)/,
      'SettingsMantenimiento debe iniciar mantenimiento con conteo de 30s'
    );
    assert.match(
      settingsMantenimientoContent,
      /saveSettingApi\('maintenanceMode',\s*\{\s*enabled:\s*true,\s*immediate:\s*true\s*\}\)/,
      'SettingsMantenimiento debe permitir forzar bloqueo inmediato'
    );
    assert.match(
      settingsMantenimientoContent,
      /crm_maintenance_sync/,
      'SettingsMantenimiento debe propagar crm_maintenance_sync a otras pestañas del navegador'
    );
    assert.match(
      settingsMantenimientoContent,
      /Forzar Bloqueo Inmediato/,
      'Debe incluir botón para forzar bloqueo inmediato'
    );
  });
});
