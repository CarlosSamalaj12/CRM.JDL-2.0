import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

test('Cálculo matemático de propinas: porcentaje sobre subtotal neto (subtotal - descuento)', () => {
  // Caso 1: Subtotal Q10,000, Descuento Q1,000 -> Subtotal Neto Q9,000. Propina 10% = Q900
  const subtotal = 10000;
  const discount = 1000;
  const netSubtotal = Math.max(0, subtotal - discount);
  const tipPercent = 10;
  const tipAmount = Math.round((netSubtotal * (tipPercent / 100)) * 100) / 100;
  const companyTotal = netSubtotal; // Ventas e ingresos de la empresa
  const clientTotal = netSubtotal + tipAmount; // Total a liquidar por el cliente

  assert.equal(netSubtotal, 9000);
  assert.equal(tipAmount, 900);
  assert.equal(companyTotal, 9000, 'El total computable de la empresa debe ser estrictamente neto de propinas');
  assert.equal(clientTotal, 9900, 'El total del cliente incluye la propina de los empleados');

  // Caso 2: Monto fijo de propina
  const fixedTip = 350;
  const clientTotalFixed = netSubtotal + fixedTip;
  assert.equal(clientTotalFixed, 9350);

  // Caso 3: Sin propina
  const zeroTip = 0;
  assert.equal(netSubtotal + zeroTip, 9000);
});

test('eventSeriesUtils.js aisla las propinas sin inflar ventas ni metas de la empresa', async () => {
  const utilsPath = path.join(projectRoot, 'src', 'modules', 'reports', 'components', 'eventSeriesUtils.js');
  const { getQuoteFinancialAmounts, getQuoteTotalGtq } = await import(pathToFileURL(path.resolve(utilsPath)).href);

  // Cotización con descuento y propina en Quetzales
  const quoteWithTip = {
    currency: 'GTQ',
    subtotal: 15000,
    discountAmount: 2000,
    tipType: 'percentage',
    tipValue: 10,
    tipAmount: 1300 // 10% de (15,000 - 2,000 = 13,000)
  };

  const fin = getQuoteFinancialAmounts(quoteWithTip);

  assert.equal(fin.subtotalGtq, 15000, 'Subtotal en GTQ debe ser 15,000');
  assert.equal(fin.discountGtq, 2000, 'Descuento en GTQ debe ser 2,000');
  assert.equal(fin.tipGtq, 1300, 'Propina de personal debe ser 1,300');
  assert.equal(fin.companyTotalGtq, 13000, 'Total de la empresa debe ser 13,000');
  assert.equal(fin.totalGtq, 13000, 'totalGtq para reportes/metas debe ser estrictamente 13,000 sin propina');
  assert.equal(fin.clientTotalGtq, 14300, 'clientTotalGtq debe reflejar los 14,300 a pagar por el cliente');
  assert.equal(fin.hasTip, true, 'hasTip debe ser true');

  // getQuoteTotalGtq debe coincidir con totalGtq (empresa)
  assert.equal(getQuoteTotalGtq(quoteWithTip), 13000);

  // Cotización sin propina
  const quoteNoTip = {
    currency: 'GTQ',
    subtotal: 8000,
    discountAmount: 500,
    tipAmount: 0
  };
  const finNoTip = getQuoteFinancialAmounts(quoteNoTip);
  assert.equal(finNoTip.totalGtq, 7500);
  assert.equal(finNoTip.clientTotalGtq, 7500);
  assert.equal(finNoTip.hasTip, false);
});

test('server.cjs y eventsController.js definen columnas MariaDB y endpoints atómicos para propinas', () => {
  const serverCode = fs.readFileSync(path.join(projectRoot, 'server.cjs'), 'utf8');
  const controllerCode = fs.readFileSync(path.join(projectRoot, 'backend', 'src', 'controllers', 'eventsController.js'), 'utf8');

  // Migraciones MariaDB
  assert.ok(serverCode.includes('propina_tipo'), 'server.cjs debe incluir columna propina_tipo');
  assert.ok(serverCode.includes('propina_valor'), 'server.cjs debe incluir columna propina_valor');
  assert.ok(serverCode.includes('propina_monto'), 'server.cjs debe incluir columna propina_monto');
  assert.ok(serverCode.includes('tipConfig'), 'server.cjs debe incluir tipConfig en ALLOWED_SETTINGS_KEYS');

  // Endpoints atómicos
  assert.ok(serverCode.includes('/api/settings/propina'), 'server.cjs debe exponer /api/settings/propina');
  assert.ok(serverCode.includes('normalizeTipType'), 'server.cjs debe normalizar tipos de propina');
  assert.ok(serverCode.includes('calculateQuoteTotals'), 'server.cjs debe calcular totales de cotización con propina');

  // eventsController sincronizado
  assert.ok(controllerCode.includes('propina_tipo'), 'eventsController.js debe incluir propina_tipo');
  assert.ok(controllerCode.includes('propina_valor'), 'eventsController.js debe incluir propina_valor');
  assert.ok(controllerCode.includes('propina_monto'), 'eventsController.js debe incluir propina_monto');
});

test('stateService.js exporta métodos atómicos getTipConfigApi y saveTipConfigApi', () => {
  const stateServiceCode = fs.readFileSync(path.join(projectRoot, 'src', 'services', 'stateService.js'), 'utf8');
  assert.ok(stateServiceCode.includes('getTipConfigApi'), 'stateService debe exportar getTipConfigApi');
  assert.ok(stateServiceCode.includes('saveTipConfigApi'), 'stateService debe exportar saveTipConfigApi');
});

test('printUtils.js imprime propinas SOLO en cotización + contrato (completa) y las omite en estándar', () => {
  const printUtilsCode = fs.readFileSync(path.join(projectRoot, 'src', 'utils', 'printUtils.js'), 'utf8');

  // Verificación de tokens de contrato
  assert.ok(printUtilsCode.includes('PROPINA'), 'printUtils.js debe definir token PROPINA');
  assert.ok(printUtilsCode.includes('MONTO_PROPINA'), 'printUtils.js debe definir token MONTO_PROPINA');

  // Aislamiento: propina se imprime solo en 'completa' y con monto > 0
  assert.ok(
    printUtilsCode.includes('printOption === "completa"') || printUtilsCode.includes("printOption === 'completa'"),
    'printUtils.js debe condicionar la propina a printOption === "completa"'
  );
  assert.ok(
    printUtilsCode.includes('rawTipDoc > 0'),
    'printUtils.js debe validar que rawTipDoc > 0'
  );
  assert.ok(
    printUtilsCode.includes('TOTAL A PAGAR'),
    'printUtils.js debe mostrar TOTAL A PAGAR cuando hay propina en formato completo'
  );
});

test('QuoteModal.jsx integra soporte de propinas en UI desktop y mobile con base en subtotal neto', () => {
  const quoteModalCode = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'calendar', 'components', 'QuoteModal.jsx'), 'utf8');

  assert.ok(quoteModalCode.includes('getTipConfigApi'), 'QuoteModal debe consultar la configuración de propinas');
  assert.ok(quoteModalCode.includes('tipType'), 'QuoteModal debe manejar tipType');
  assert.ok(quoteModalCode.includes('tipValue'), 'QuoteModal debe manejar tipValue');
  assert.ok(quoteModalCode.includes('tipAmount'), 'QuoteModal debe calcular tipAmount');
  assert.ok(quoteModalCode.includes('netSubtotal'), 'QuoteModal debe calcular netSubtotal (subtotal - descuento)');
  assert.ok(quoteModalCode.includes('companyTotal'), 'QuoteModal debe calcular companyTotal');
});

test('SettingsMain.jsx y SettingsPropinas.jsx conectan el panel de configuración de propinas', () => {
  const settingsMainCode = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'settings', 'SettingsMain.jsx'), 'utf8');
  const settingsPropinasCode = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'settings', 'SettingsPropinas.jsx'), 'utf8');

  assert.ok(settingsMainCode.includes('SettingsPropinas'), 'SettingsMain debe importar SettingsPropinas');
  assert.ok(settingsMainCode.includes("activeInlineView === 'propinas'"), 'SettingsMain debe manejar inline view propinas');
  assert.ok(settingsMainCode.includes('<h3 className="settings-bento-title">Propina</h3>'), 'SettingsMain debe mostrar tarjeta Bento de propina');

  assert.ok(settingsPropinasCode.includes('defaultPercent'), 'SettingsPropinas debe gestionar defaultPercent');
  assert.ok(settingsPropinasCode.includes('saveTipConfigApi'), 'SettingsPropinas debe persistir configuración');
});

test('Reportería (ReportsVentas y ReportsContabilidad) identifica propinas sin inflar metas de la empresa', () => {
  const ventasCode = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsVentas.jsx'), 'utf8');
  const contaCode = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsContabilidad.jsx'), 'utf8');

  assert.ok(ventasCode.includes('totalPropinas'), 'ReportsVentas debe totalizar propinas del personal por separado');
  assert.ok(ventasCode.includes('Propina (periodo)'), 'ReportsVentas debe mostrar indicador de propinas en barra de resumen');

  assert.ok(contaCode.includes('⭐ Propina:'), 'ReportsContabilidad debe mostrar banner de observación en modal de estado');
  assert.ok(contaCode.includes('+ Propina:'), 'ReportsContabilidad debe mostrar badge en tabla');
});
