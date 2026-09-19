import test from 'node:test';
import assert from 'node:assert/strict';
import { getQuoteFinancialAmounts, getQuoteTotalGtq } from '../src/modules/reports/components/eventSeriesUtils.js';

test('getQuoteFinancialAmounts resuelve fielmente el total contratado cuando totalGtq es 0 o indefinido en la raíz', () => {
  // Caso exacto reportado por el usuario: POLLO CAMPERO
  const quoteWithZeroRootTotals = {
    companyName: 'POLLO CAMPERO',
    currency: 'GTQ',
    people: 10,
    totalGtq: 0,
    subtotalGtq: 0,
    total: undefined,
    subtotal: undefined,
    discountAmount: 0,
    items: [
      { name: 'DESAYUNO BUFFET CERRO DE ORO', qty: 10, price: 65, total: 650 },
      { name: 'COFFEE BREAK P.M.', qty: 10, price: 45, total: 450 },
      { name: 'ALQUILER DE SALON', qty: 1, price: 500, total: 500 }
    ],
    versions: [
      {
        total: 1600,
        subtotal: 1600,
        items: []
      }
    ]
  };

  const fin = getQuoteFinancialAmounts(quoteWithZeroRootTotals);

  assert.equal(fin.totalGtq, 1600, 'El totalGtq debe ser 1600 y no ser anulado por el 0');
  assert.equal(fin.subtotalGtq, 1600, 'El subtotalGtq debe ser 1600');
  assert.equal(fin.rawTotal, 1600, 'El rawTotal debe ser 1600');

  // Simulación del cálculo de estado de cuenta con Q 800 abonados
  const advances = [{ amount: 150 }, { amount: 500 }, { amount: 150 }];
  const advancesTotal = advances.reduce((sum, a) => sum + a.amount, 0); // 800
  const delta = fin.totalGtq - advancesTotal; // 1600 - 800 = 800
  const balancePending = Math.max(0, delta);
  const creditBalance = Math.max(0, -delta);

  assert.equal(advancesTotal, 800, 'El total abonado debe ser Q 800.00');
  assert.equal(balancePending, 800, 'El saldo pendiente debe ser Q 800.00 (NO 0)');
  assert.equal(creditBalance, 0, 'El saldo a favor debe ser Q 0.00 (NO Q 800.00)');
});

test('getQuoteFinancialAmounts calcula la suma desde ítems cuando no hay versiones ni total de raíz', () => {
  const quoteWithItemsOnly = {
    currency: 'GTQ',
    totalGtq: 0,
    items: [
      { name: 'Servicio A', qty: 2, price: 500 },
      { name: 'Servicio B', qty: 1, price: 250 }
    ]
  };

  const fin = getQuoteFinancialAmounts(quoteWithItemsOnly);
  assert.equal(fin.totalGtq, 1250, 'Debe sumar 2*500 + 1*250 = 1250');
  assert.equal(getQuoteTotalGtq(quoteWithItemsOnly), 1250);
});
