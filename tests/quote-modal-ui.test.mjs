import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const quoteModalPath = new URL('../src/modules/calendar/components/QuoteModal.jsx', import.meta.url);
const searchModulePath = new URL('../src/modules/search/SearchModule.jsx', import.meta.url);

test('la exportación usa un único import de ExcelJS compatible con navegador', async () => {
  const source = await readFile(searchModulePath, 'utf8');

  assert.match(source, /await import\('exceljs\/dist\/exceljs\.min\.js'\)/);
  assert.doesNotMatch(source, /await import\('exceljs'\)/);
});

test('cada servicio ofrece solamente el icono rojo para eliminar', async () => {
  const source = await readFile(quoteModalPath, 'utf8');
  const rowActionButtons = source.match(/className="qp-row-action-btn(?: btn-del)?"/g) ?? [];

  assert.equal(rowActionButtons.length, 1);
  assert.match(source, /\.qp-row-action-btn \{[\s\S]{0,350}color: #ef4444;/);
  assert.match(source, /className="qp-row-action-btn btn-del"[\s\S]{0,500}aria-label=\{`Eliminar servicio[\s\S]{0,300}<Trash2 className="qp-delete-icon"/);
  assert.match(source, /#qp-root \.qp-row-action-btn\.btn-del::after \{ display: none !important; \}/);
  assert.match(source, /#qp-root \.qp-row-action-btn \.qp-delete-icon \{[\s\S]{0,400}stroke: #dc2626 !important;[\s\S]{0,150}visibility: visible !important;/);
  assert.doesNotMatch(source, /<span>Eliminar<\/span>/);
  assert.doesNotMatch(source, /onClick=\{\(\) => handleMoveSingle\(item\.rowId/);
  assert.doesNotMatch(source, /onClick=\{\(\) => handleDuplicateSingle\(item\.rowId\)\}/);
});

test('la fila seleccionada muestra una marca independiente dentro del cuadro', async () => {
  const source = await readFile(quoteModalPath, 'utf8');

  assert.match(source, /aria-selected=\{selectedItemIds\.has\(item\.rowId\)\}/);
  assert.match(source, /aria-label=\{`Seleccionar servicio \$\{item\.name/);
  assert.match(source, /tr\.sel td \{ background: #dbeafe !important;/);
  assert.match(source, /tr\.sel td:first-child \{ box-shadow: inset 4px 0 #2563eb !important;/);
  assert.match(source, /\.qp-checkbox-control\.is-checked \.qp-checkbox-indicator \{[\s\S]{0,150}background: #10b981;/);
  assert.match(source, /className=\{`qp-checkbox-control \$\{selectedItemIds\.has\(item\.rowId\) \? 'is-checked' : ''\}`\}/);
  assert.match(source, /selectedItemIds\.has\(item\.rowId\) && <Check className="qp-checkbox-check"/);
});

test('el encabezado no repite las acciones disponibles en la barra flotante', async () => {
  const source = await readFile(quoteModalPath, 'utf8');
  const headerStart = source.indexOf('className="qp-cart-sticky-header"');
  const headerEnd = source.indexOf('{menuMontajeSummary.count > 0', headerStart);
  const header = source.slice(headerStart, headerEnd);

  assert.ok(headerStart >= 0 && headerEnd > headerStart);
  assert.doesNotMatch(header, /selectedItemIds|Duplicar|Subir|Bajar|Limpiar|Deseleccionar/);
  assert.match(source, /className="qp-floating-selection-bar"/);
});
