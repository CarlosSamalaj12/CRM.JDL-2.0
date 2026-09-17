import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = process.cwd();

test('server.cjs expone endpoints atómicos para exchange-rate (GET, PUT, POST)', () => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  assert.ok(serverCode.includes('app.get("/api/exchange-rate"'), 'Debe exponer GET /api/exchange-rate');
  assert.ok(serverCode.includes('app.put("/api/exchange-rate"'), 'Debe exponer PUT /api/exchange-rate');
  assert.ok(serverCode.includes('app.post("/api/exchange-rate"'), 'Debe exponer POST /api/exchange-rate');
  assert.ok(serverCode.includes("clave = 'exchangeRate'"), 'Debe consultar o guardar con clave exchangeRate');
  assert.ok(serverCode.includes("INSERT INTO app_state_kv"), 'Debe hacer upsert en app_state_kv');
});

test('server.cjs expone endpoints atómicos para configuraciones genéricas (/api/settings/:key)', () => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  assert.ok(serverCode.includes('app.get("/api/settings/:key"'), 'Debe exponer GET /api/settings/:key');
  assert.ok(serverCode.includes('app.put("/api/settings/:key"'), 'Debe exponer PUT /api/settings/:key');
  assert.ok(serverCode.includes('ALLOWED_SETTINGS_KEYS'), 'Debe tener lista blanca de claves seguras');
});

test('stateService.js exporta getExchangeRateApi y saveExchangeRateApi', () => {
  const stateServicePath = path.join(projectRoot, 'src', 'services', 'stateService.js');
  const stateServiceCode = fs.readFileSync(stateServicePath, 'utf8');

  assert.ok(stateServiceCode.includes('export async function getExchangeRateApi'), 'Debe exportar getExchangeRateApi');
  assert.ok(stateServiceCode.includes('export async function saveExchangeRateApi'), 'Debe exportar saveExchangeRateApi');
  assert.ok(stateServiceCode.includes('getExchangeRateApi,'), 'Debe incluirse en default export');
  assert.ok(stateServiceCode.includes('saveExchangeRateApi,'), 'Debe incluirse en default export');
  assert.ok(stateServiceCode.includes("api.put('/api/exchange-rate'"), 'Debe llamar al endpoint atómico PUT /api/exchange-rate');
});

test('stateService.js exporta getSettingApi y saveSettingApi', () => {
  const stateServicePath = path.join(projectRoot, 'src', 'services', 'stateService.js');
  const stateServiceCode = fs.readFileSync(stateServicePath, 'utf8');

  assert.ok(stateServiceCode.includes('export async function getSettingApi'), 'Debe exportar getSettingApi');
  assert.ok(stateServiceCode.includes('export async function saveSettingApi'), 'Debe exportar saveSettingApi');
  assert.ok(stateServiceCode.includes('getSettingApi,'), 'Debe incluirse en default export');
  assert.ok(stateServiceCode.includes('saveSettingApi,'), 'Debe incluirse en default export');
});

test('SettingsTipoCambio.jsx utiliza saveExchangeRateApi y no llama a saveCrmState', () => {
  const tipoCambioPath = path.join(projectRoot, 'src', 'modules', 'settings', 'SettingsTipoCambio.jsx');
  const tipoCambioCode = fs.readFileSync(tipoCambioPath, 'utf8');

  assert.ok(tipoCambioCode.includes('saveExchangeRateApi'), 'Debe importar y usar saveExchangeRateApi');
  assert.ok(tipoCambioCode.includes('getExchangeRateApi'), 'Debe importar y usar getExchangeRateApi');
  assert.ok(!tipoCambioCode.includes('saveCrmState'), 'NO debe usar saveCrmState para evitar error 413');
  assert.ok(!tipoCambioCode.includes('saveState'), 'NO debe invocar saveState');
});

test('SettingsCitas, SettingsMantenimiento y SettingsGlobalGoals usan guardado atómico', () => {
  const citasPath = path.join(projectRoot, 'src', 'modules', 'settings', 'SettingsCitas.jsx');
  const citasCode = fs.readFileSync(citasPath, 'utf8');
  assert.ok(citasCode.includes('saveSettingApi'), 'SettingsCitas debe usar saveSettingApi');
  assert.ok(!citasCode.includes('saveCrmState'), 'SettingsCitas NO debe usar saveCrmState');

  const mantPath = path.join(projectRoot, 'src', 'modules', 'settings', 'SettingsMantenimiento.jsx');
  const mantCode = fs.readFileSync(mantPath, 'utf8');
  assert.ok(mantCode.includes('saveSettingApi'), 'SettingsMantenimiento debe usar saveSettingApi');
  assert.ok(!mantCode.includes('saveCrmState'), 'SettingsMantenimiento NO debe usar saveCrmState');

  const goalsPath = path.join(projectRoot, 'src', 'modules', 'settings', 'SettingsGlobalGoals.jsx');
  const goalsCode = fs.readFileSync(goalsPath, 'utf8');
  assert.ok(goalsCode.includes('saveSettingApi'), 'SettingsGlobalGoals debe usar saveSettingApi');
  assert.ok(!goalsCode.includes('saveCrmState'), 'SettingsGlobalGoals NO debe usar saveCrmState');
});

test('server.cjs enriquece automáticamente cotizaciones en USD con totalGtq y subtotalGtq', () => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  assert.ok(serverCode.includes("quote.currency || \"\").trim().toUpperCase() === \"USD\""), 'Debe detectar moneda USD');
  assert.ok(serverCode.includes("quote.totalGtq = Math.round(Number(quote.total || 0) * rate * 100) / 100"), 'Debe calcular totalGtq con rate');
  assert.ok(serverCode.includes("quote.subtotalGtq = Math.round(Number(quote.subtotal || 0) * rate * 100) / 100"), 'Debe calcular subtotalGtq con rate');
});

test('QuoteModal.jsx calcula y guarda totalGtq y exchangeRate al guardar cotizaciones en USD', () => {
  const quoteModalPath = path.join(projectRoot, 'src', 'modules', 'calendar', 'components', 'QuoteModal.jsx');
  const quoteModalCode = fs.readFileSync(quoteModalPath, 'utf8');

  assert.ok(quoteModalCode.includes('getExchangeRateApi'), 'Debe importar getExchangeRateApi');
  assert.ok(quoteModalCode.includes('totalGtq'), 'Debe persistir totalGtq');
  assert.ok(quoteModalCode.includes('subtotalGtq'), 'Debe persistir subtotalGtq');
  assert.ok(quoteModalCode.includes('exchangeRate: isUsd ? effectiveRate : undefined'), 'Debe guardar exchangeRate en cotizaciones USD');
});

test('eventSeriesUtils.js exporta getQuoteFinancialAmounts y getQuoteTotalGtq con conversión matemática precisa', async () => {
  const utilsPath = path.join(projectRoot, 'src', 'modules', 'reports', 'components', 'eventSeriesUtils.js');
  const { getQuoteFinancialAmounts, getQuoteTotalGtq } = await import(pathToFileURL(path.resolve(utilsPath)).href);

  // Prueba cotización en USD a tasa 7.75
  const usdQuote = { currency: 'USD', total: 1000, subtotal: 1200, discountAmount: 200, exchangeRate: 7.75 };
  const usdAmounts = getQuoteFinancialAmounts(usdQuote);
  assert.equal(usdAmounts.totalGtq, 7750, '1000 USD a 7.75 debe ser 7750 GTQ');
  assert.equal(usdAmounts.subtotalGtq, 9300, '1200 USD a 7.75 debe ser 9300 GTQ');
  assert.equal(usdAmounts.discountGtq, 1550, '200 USD a 7.75 debe ser 1550 GTQ');
  assert.equal(usdAmounts.isUsd, true);

  // Prueba cotización en USD a tasa personalizada (ej. 7.80)
  const usdQuoteCustom = { currency: 'USD', total: 250.50, exchangeRate: 7.80 };
  assert.equal(getQuoteTotalGtq(usdQuoteCustom), 1953.90, '250.50 USD a 7.80 debe ser 1953.90 GTQ');

  // Prueba cotización en Quetzales (no debe multiplicar)
  const gtqQuote = { currency: 'GTQ', total: 5000 };
  assert.equal(getQuoteTotalGtq(gtqQuote), 5000, 'Cotización GTQ debe mantener su total');

  // Prueba cotización vacía o nula
  assert.equal(getQuoteTotalGtq(null), 0, 'Quote nula debe devolver 0');
});

test('Módulos de reportes integran getQuoteTotalGtq / getQuoteFinancialAmounts para montos en Quetzales', () => {
  const reportsDir = path.join(projectRoot, 'src', 'modules', 'reports');

  const comisiones = fs.readFileSync(path.join(reportsDir, 'ReportsComisiones.jsx'), 'utf8');
  assert.ok(comisiones.includes('getQuoteTotalGtq'), 'ReportsComisiones debe usar getQuoteTotalGtq');

  const contabilidad = fs.readFileSync(path.join(reportsDir, 'ReportsContabilidad.jsx'), 'utf8');
  assert.ok(contabilidad.includes('getQuoteFinancialAmounts'), 'ReportsContabilidad debe usar getQuoteFinancialAmounts');

  const ventas = fs.readFileSync(path.join(reportsDir, 'ReportsVentas.jsx'), 'utf8');
  assert.ok(ventas.includes('getQuoteFinancialAmounts'), 'ReportsVentas debe usar getQuoteFinancialAmounts');

  const dashboard = fs.readFileSync(path.join(reportsDir, 'ReportsDashboard.jsx'), 'utf8');
  assert.ok(dashboard.includes('getQuoteTotalGtq'), 'ReportsDashboard debe usar getQuoteTotalGtq');

  const institucion = fs.readFileSync(path.join(reportsDir, 'ReportsInstitucion.jsx'), 'utf8');
  assert.ok(institucion.includes('getQuoteFinancialAmounts'), 'ReportsInstitucion debe usar getQuoteFinancialAmounts');

  const proyeccion = fs.readFileSync(path.join(reportsDir, 'ReportsProyeccionMetas.jsx'), 'utf8');
  assert.ok(proyeccion.includes('getQuoteTotalGtq'), 'ReportsProyeccionMetas debe usar getQuoteTotalGtq');

  const seguimientos = fs.readFileSync(path.join(reportsDir, 'ReportsSeguimientosPendientes.jsx'), 'utf8');
  assert.ok(seguimientos.includes('getQuoteTotalGtq'), 'ReportsSeguimientosPendientes debe usar getQuoteTotalGtq');

  const eficiencia = fs.readFileSync(path.join(reportsDir, 'ReportsEficenciaConfirmacion.jsx'), 'utf8');
  assert.ok(eficiencia.includes('getQuoteTotalGtq'), 'ReportsEficenciaConfirmacion debe usar getQuoteTotalGtq');

  const categorias = fs.readFileSync(path.join(reportsDir, 'ReportsIngresosCategorias.jsx'), 'utf8');
  assert.ok(categorias.includes('getQuoteTotalGtq'), 'ReportsIngresosCategorias debe usar getQuoteTotalGtq');

  const ocupacion = fs.readFileSync(path.join(reportsDir, 'ReportsOcupacion.jsx'), 'utf8');
  assert.ok(ocupacion.includes('getQuoteTotalGtq'), 'ReportsOcupacion debe usar getQuoteTotalGtq');

  const customers = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'customers', 'CustomersModule.jsx'), 'utf8');
  assert.ok(customers.includes('getQuoteTotalGtq'), 'CustomersModule debe usar getQuoteTotalGtq');
});

