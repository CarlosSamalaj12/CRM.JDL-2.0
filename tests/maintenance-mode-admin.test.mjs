import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('Sistema de Mantenimiento y Acceso de Administrador JDL-ADMIN-2026', () => {
  const rootDir = process.cwd();

  it('server.cjs define los endpoints /api/maintenance/disable y /api/maintenance/verify-code con validación de JDL-ADMIN-2026', () => {
    const serverCode = fs.readFileSync(path.join(rootDir, 'server.cjs'), 'utf-8');

    // Validación del endpoint /api/maintenance/disable
    assert.ok(serverCode.includes('app.post("/api/maintenance/disable"'), 'server.cjs debe incluir POST /api/maintenance/disable');
    assert.ok(serverCode.includes('MAINTENANCE_ADMIN_CODE = "JDL-ADMIN-2026"'), 'server.cjs debe definir MAINTENANCE_ADMIN_CODE como JDL-ADMIN-2026');
    assert.ok(serverCode.includes("INSERT INTO app_state_kv (clave, valor_json)"), 'Debe actualizar app_state_kv');
    assert.ok(serverCode.includes("maintenance-status-changed"), 'Debe emitir maintenance-status-changed vía Socket.IO');

    // Validación del endpoint /api/maintenance/verify-code
    assert.ok(serverCode.includes('app.post("/api/maintenance/verify-code"'), 'server.cjs debe incluir POST /api/maintenance/verify-code');
  });

  it('MaintenancePage.jsx implementa modal interactivo, llamada atómica a /api/maintenance/disable y bypass seguro', () => {
    const pageCode = fs.readFileSync(path.join(rootDir, 'src/components/MaintenancePage.jsx'), 'utf-8');

    assert.ok(pageCode.includes("const ADMIN_CODE = 'JDL-ADMIN-2026';"), 'MaintenancePage debe definir ADMIN_CODE = JDL-ADMIN-2026');
    assert.ok(pageCode.includes('/api/maintenance/disable'), 'MaintenancePage debe invocar /api/maintenance/disable');
    assert.ok(pageCode.includes('handleDisableMaintenance'), 'Debe contar con la función handleDisableMaintenance');
    assert.ok(pageCode.includes('handleBypassOnly'), 'Debe contar con la función handleBypassOnly');
    assert.ok(pageCode.includes('crm_maintenance_bypass'), 'Debe persistir crm_maintenance_bypass en sessionStorage');
    assert.ok(pageCode.includes('Acceso de Administrador'), 'Debe renderizar modal de Acceso de Administrador');
    assert.ok(pageCode.includes('Quitar Modo Mantenimiento'), 'Debe incluir botón de Quitar Modo Mantenimiento');
  });

  it('App.jsx previene bloqueo de administradores y permite bypass cuando mantenimiento está activo', () => {
    const appCode = fs.readFileSync(path.join(rootDir, 'src/App.jsx'), 'utf-8');

    assert.ok(appCode.includes('sessionStorage.getItem(\'crm_maintenance_bypass\')'), 'App.jsx debe leer crm_maintenance_bypass');
    assert.ok(appCode.includes('isBlocked = maintenance && !isAdmin && !bypassActive'), 'App.jsx no debe bloquear administradores ni usuarios con bypass');
    assert.ok(appCode.includes('MODO MANTENIMIENTO ACTIVO'), 'App.jsx debe mostrar banner informativo para administradores');
    assert.ok(appCode.includes('maintenanceStatusChanged'), 'App.jsx debe escuchar evento maintenanceStatusChanged');
  });

  it('stateService.js exporta disableMaintenanceApi', () => {
    const stateServiceCode = fs.readFileSync(path.join(rootDir, 'src/services/stateService.js'), 'utf-8');

    assert.ok(stateServiceCode.includes('export async function disableMaintenanceApi'), 'stateService debe exportar disableMaintenanceApi');
    assert.ok(stateServiceCode.includes('/api/maintenance/disable'), 'disableMaintenanceApi debe llamar a /api/maintenance/disable');
  });
});
