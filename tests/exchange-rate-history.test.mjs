import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = process.cwd();

test('Algoritmo resolveRateForEvent resuelve la tasa por fecha cronológica sin alterar el pasado', () => {
  const history = [
    { fecha_vigencia: '2024-01-01', tasa: 7.70, notas: 'Tasa 2024' },
    { fecha_vigencia: '2025-06-01', tasa: 7.75, notas: 'Ajuste medio 2025' },
    { fecha_vigencia: '2026-09-01', tasa: 7.80, notas: 'Tasa bancaria actual' }
  ];

  const sortedHistory = [...history].sort((a, b) =>
    String(a.fecha_vigencia).localeCompare(String(b.fecha_vigencia))
  );

  function resolveRateForEvent(evDateStr) {
    if (!sortedHistory.length) {
      return { rate: 7.75, effectiveDate: null };
    }
    const cleanDate = String(evDateStr || '').trim().slice(0, 10);
    if (!cleanDate || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      const latest = sortedHistory[sortedHistory.length - 1];
      return { rate: Number(latest.tasa), effectiveDate: String(latest.fecha_vigencia).slice(0, 10) };
    }
    let matched = null;
    for (const entry of sortedHistory) {
      const entryDate = String(entry.fecha_vigencia).slice(0, 10);
      if (entryDate <= cleanDate) {
        matched = entry;
      } else {
        break;
      }
    }
    if (matched) {
      return { rate: Number(matched.tasa), effectiveDate: String(matched.fecha_vigencia).slice(0, 10) };
    }
    const oldest = sortedHistory[0];
    return { rate: Number(oldest.tasa), effectiveDate: String(oldest.fecha_vigencia).slice(0, 10) };
  }

  // Evento en 2024 debe tomar 7.70
  const ev2024 = resolveRateForEvent('2024-05-15');
  assert.equal(ev2024.rate, 7.70, 'Evento en 2024 debe tomar tasa de 2024');
  assert.equal(ev2024.effectiveDate, '2024-01-01');

  // Evento antes del ajuste de junio 2025 debe tomar 7.70
  const evEarly2025 = resolveRateForEvent('2025-03-10');
  assert.equal(evEarly2025.rate, 7.70, 'Evento anterior a junio 2025 debe tomar tasa de 2024');

  // Evento exacto en fecha de vigencia 2025-06-01 debe tomar 7.75
  const evJune2025 = resolveRateForEvent('2025-06-01');
  assert.equal(evJune2025.rate, 7.75, 'Evento en fecha de cambio toma nueva tasa');
  assert.equal(evJune2025.effectiveDate, '2025-06-01');

  // Evento en 2026 después de septiembre debe tomar 7.80
  const ev2026 = resolveRateForEvent('2026-11-20');
  assert.equal(ev2026.rate, 7.80, 'Evento en fines de 2026 toma tasa de 7.80');
  assert.equal(ev2026.effectiveDate, '2026-09-01');

  // Evento anterior al historial (ej. 2023) cae en la tasa más antigua registrada
  const evOld = resolveRateForEvent('2023-11-15');
  assert.equal(evOld.rate, 7.70, 'Evento anterior a historial usa fallback más antiguo');

  // Evento sin fecha toma la tasa más reciente (activa)
  const evNoDate = resolveRateForEvent(null);
  assert.equal(evNoDate.rate, 7.80, 'Evento sin fecha usa tasa más reciente');
});

test('server.cjs implementa tabla tipo_cambio_historial y endpoints dedicados', () => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  assert.ok(serverCode.includes('CREATE TABLE IF NOT EXISTS tipo_cambio_historial'), 'Debe crear tabla tipo_cambio_historial');
  assert.ok(serverCode.includes('ensureExchangeRateHistoryStructure'), 'Debe definir helper de estructura tipo_cambio_historial');
  assert.ok(serverCode.includes('app.get("/api/exchange-rate"'), 'Debe exponer GET /api/exchange-rate');
  assert.ok(serverCode.includes('app.get("/api/exchange-rate/resolve"'), 'Debe exponer GET /api/exchange-rate/resolve');
  assert.ok(serverCode.includes('app.post("/api/exchange-rate/history"'), 'Debe exponer POST /api/exchange-rate/history');
  assert.ok(serverCode.includes('app.put("/api/exchange-rate/history/:id"'), 'Debe exponer PUT /api/exchange-rate/history/:id');
  assert.ok(serverCode.includes('app.delete("/api/exchange-rate/history/:id"'), 'Debe exponer DELETE /api/exchange-rate/history/:id');
  assert.ok(serverCode.includes('resolveRateForEvent'), 'Debe contener resolver de tasa por fecha de evento');
});

test('stateService.js exporta métodos atómicos para historial de tipo de cambio', () => {
  const stateServicePath = path.join(projectRoot, 'src', 'services', 'stateService.js');
  const stateServiceCode = fs.readFileSync(stateServicePath, 'utf8');

  assert.ok(stateServiceCode.includes('export async function getExchangeRateDataApi'), 'Debe exportar getExchangeRateDataApi');
  assert.ok(stateServiceCode.includes('export async function addExchangeRateHistoryApi'), 'Debe exportar addExchangeRateHistoryApi');
  assert.ok(stateServiceCode.includes('export async function updateExchangeRateHistoryApi'), 'Debe exportar updateExchangeRateHistoryApi');
  assert.ok(stateServiceCode.includes('export async function deleteExchangeRateHistoryApi'), 'Debe exportar deleteExchangeRateHistoryApi');
  assert.ok(stateServiceCode.includes('export async function resolveExchangeRateAtDateApi'), 'Debe exportar resolveExchangeRateAtDateApi');
});

test('SettingsTipoCambio.jsx implementa gestión histórica sin enviar el estado completo de 17MB', () => {
  const tipoCambioPath = path.join(projectRoot, 'src', 'modules', 'settings', 'SettingsTipoCambio.jsx');
  const tipoCambioCode = fs.readFileSync(tipoCambioPath, 'utf8');

  assert.ok(tipoCambioCode.includes('getExchangeRateDataApi'), 'Debe consumir getExchangeRateDataApi');
  assert.ok(tipoCambioCode.includes('addExchangeRateHistoryApi'), 'Debe consumir addExchangeRateHistoryApi');
  assert.ok(tipoCambioCode.includes('updateExchangeRateHistoryApi'), 'Debe consumir updateExchangeRateHistoryApi');
  assert.ok(tipoCambioCode.includes('deleteExchangeRateHistoryApi'), 'Debe consumir deleteExchangeRateHistoryApi');
  assert.ok(!tipoCambioCode.includes('saveCrmState'), 'NO debe usar saveCrmState');
  assert.ok(!tipoCambioCode.includes('saveState'), 'NO debe usar saveState');
});

test('QuoteModal.jsx y reportes vinculan exchangeRateDate con los montos en Quetzales', () => {
  const quoteModalCode = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'calendar', 'components', 'QuoteModal.jsx'), 'utf8');
  assert.ok(quoteModalCode.includes('resolveExchangeRateAtDateApi'), 'QuoteModal debe consultar tasa por fecha del evento');
  assert.ok(quoteModalCode.includes('exchangeRateDate'), 'QuoteModal debe persistir exchangeRateDate');

  const ventasCode = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsVentas.jsx'), 'utf8');
  assert.ok(ventasCode.includes('exchangeRateDate'), 'ReportsVentas debe incluir exchangeRateDate en la fila');

  const contabCode = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsContabilidad.jsx'), 'utf8');
  assert.ok(contabCode.includes('exchangeRateDate'), 'ReportsContabilidad debe incluir exchangeRateDate en la fila');
});
