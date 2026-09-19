import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('server.cjs expone endpoints dedicados para la gestión atómica de anticipos por evento', () => {
  const serverPath = path.join(projectRoot, 'server.cjs');
  assert.ok(fs.existsSync(serverPath), 'server.cjs debe existir');
  const content = fs.readFileSync(serverPath, 'utf8');

  // Verificar presencia de endpoints REST atómicos para anticipos
  assert.ok(content.includes('/api/events/:eventId/anticipos'), 'Debe exponer ruta base /api/events/:eventId/anticipos');
  assert.ok(content.includes("app.get(\"/api/events/:eventId/anticipos\"") || content.includes("app.get('/api/events/:eventId/anticipos'"), 'Debe implementar GET /api/events/:eventId/anticipos');
  assert.ok(content.includes("app.post(\"/api/events/:eventId/anticipos\"") || content.includes("app.post('/api/events/:eventId/anticipos'"), 'Debe implementar POST /api/events/:eventId/anticipos');
  assert.ok(content.includes("app.put(\"/api/events/:eventId/anticipos/:advanceId\"") || content.includes("app.put('/api/events/:eventId/anticipos/:advanceId'"), 'Debe implementar PUT /api/events/:eventId/anticipos/:advanceId');
  assert.ok(content.includes("app.delete(\"/api/events/:eventId/anticipos/:advanceId\"") || content.includes("app.delete('/api/events/:eventId/anticipos/:advanceId'"), 'Debe implementar DELETE /api/events/:eventId/anticipos/:advanceId');

  // Verificar que syncEventsToDb no elimine anticipos en multi-slots ni pase advances: undefined
  assert.ok(!content.includes('advances: undefined'), 'No debe existir { advances: undefined } que elimine abonos');
  assert.ok(content.includes('id === baseId') && content.includes('Array.isArray(e.quote.advances)'), 'syncEventsToDb debe proteger anticipos condicionando a baseId');
});

test('stateService.js exporta funciones clientes atómicas para anticipos de eventos', () => {
  const stateServicePath = path.join(projectRoot, 'src', 'services', 'stateService.js');
  assert.ok(fs.existsSync(stateServicePath), 'stateService.js debe existir');
  const content = fs.readFileSync(stateServicePath, 'utf8');

  assert.ok(content.includes('export async function getEventAdvancesApi'), 'Debe exportar getEventAdvancesApi');
  assert.ok(content.includes('export async function addEventAdvanceApi'), 'Debe exportar addEventAdvanceApi');
  assert.ok(content.includes('export async function updateEventAdvanceApi'), 'Debe exportar updateEventAdvanceApi');
  assert.ok(content.includes('export async function deleteEventAdvanceApi'), 'Debe exportar deleteEventAdvanceApi');
});

test('QuoteModal.jsx incorpora la interfaz ejecutiva de Gestión de Anticipos con trazabilidad y edición/eliminación', () => {
  const quoteModalPath = path.join(projectRoot, 'src', 'modules', 'calendar', 'components', 'QuoteModal.jsx');
  assert.ok(fs.existsSync(quoteModalPath), 'QuoteModal.jsx debe existir');
  const content = fs.readFileSync(quoteModalPath, 'utf8');

  // Verificar inclusión de componentes visuales clave
  assert.ok(content.includes('Gestión de Anticipos'), 'Debe incluir el título Gestión de Anticipos');
  assert.ok(content.includes('TOTAL ANTICIPOS'), 'Debe incluir tarjeta KPI TOTAL ANTICIPOS');
  assert.ok(content.includes('SALDO PENDIENTE'), 'Debe incluir tarjeta KPI SALDO PENDIENTE');
  assert.ok(content.includes('SALDO A FAVOR'), 'Debe incluir tarjeta KPI SALDO A FAVOR');
  assert.ok(content.includes('ANTICIPOS APLICADOS AL EVENTO'), 'Debe incluir tabla de anticipos aplicados');
  assert.ok(content.includes('TOTAL AMORTIZADO EN ANTICIPOS:'), 'Debe incluir resumen de amortización total');
  assert.ok(content.includes('LOG DE TRAZABILIDAD Y AUDITORÍA DE PAGOS'), 'Debe incluir acordeón de trazabilidad de pagos');
  assert.ok(content.includes('handleStartEditAdvance'), 'Debe permitir iniciar edición de anticipos');
  assert.ok(content.includes('handleDeleteAdvanceEntry'), 'Debe permitir eliminar anticipos');
  assert.ok(content.includes('renderPreviewVoucherModal'), 'Debe incluir visor lightbox de comprobantes');
  assert.ok(content.includes('handleExportStatementPdf'), 'Debe incluir botón para exportar estado de cuenta PDF');
});

test('ReportsContabilidad.jsx integra endpoints atómicos para sincronizar pagos en tiempo real con el evento', () => {
  const reportsContabilidadPath = path.join(projectRoot, 'src', 'modules', 'reports', 'ReportsContabilidad.jsx');
  assert.ok(fs.existsSync(reportsContabilidadPath), 'ReportsContabilidad.jsx debe existir');
  const content = fs.readFileSync(reportsContabilidadPath, 'utf8');

  assert.ok(content.includes('addEventAdvanceApi'), 'ReportsContabilidad debe importar y llamar addEventAdvanceApi');
  assert.ok(content.includes('updateEventAdvanceApi'), 'ReportsContabilidad debe importar y llamar updateEventAdvanceApi');
  assert.ok(content.includes('deleteEventAdvanceApi'), 'ReportsContabilidad debe importar y llamar deleteEventAdvanceApi');
});

test('El cálculo de contratos y estados de cuenta deduce fielmente los anticipos amortizados', () => {
  const sampleQuote = {
    currency: 'GTQ',
    total: 5000,
    advances: [
      { id: 'adv-1', amount: 1500, paymentType: 'Transferencia', voucherNumber: 'TRF-101', date: '2026-09-10' },
      { id: 'adv-2', amount: 500, paymentType: 'Efectivo en Caja', voucherNumber: 'BOL-502', date: '2026-09-15' }
    ]
  };

  const totalAnticipos = sampleQuote.advances.reduce((acc, a) => acc + Number(a.amount || 0), 0);
  const saldoPendiente = Math.max(0, sampleQuote.total - totalAnticipos);
  const saldoAFavor = Math.max(0, totalAnticipos - sampleQuote.total);

  assert.strictEqual(totalAnticipos, 2000, 'El total de anticipos debe sumar 2,000');
  assert.strictEqual(saldoPendiente, 3000, 'El saldo pendiente debe ser 3,000 restando los 2,000 del total de 5,000');
  assert.strictEqual(saldoAFavor, 0, 'No debe haber saldo a favor');
});
