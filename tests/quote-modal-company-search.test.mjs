import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('QuoteModal.jsx elimina el bucle de companySearchQuery al borrar y busca solo con Enter', () => {
  const file = path.resolve('src/modules/calendar/components/QuoteModal.jsx');
  const content = fs.readFileSync(file, 'utf8');

  // 1. Debe haber eliminado el useEffect problemático que restauraba la empresa cuando companySearchQuery estaba vacío
  assert.strictEqual(
    content.includes('if (quote?.companyName && !companySearchQuery)'),
    false,
    'QuoteModal.jsx no debe tener el useEffect que restaura quote.companyName cuando companySearchQuery está vacío'
  );

  // 2. Debe implementar búsqueda bajo demanda (Enter) usando companySearchSubmitted
  assert.match(
    content,
    /const \[companySearchSubmitted,\s*setCompanySearchSubmitted\]\s*=\s*useState/,
    'QuoteModal.jsx debe tener un estado companySearchSubmitted para no buscar letra por letra'
  );

  assert.match(
    content,
    /const filteredCompanies\s*=\s*useMemo\(\(\)\s*=>\s*\{[\s\S]*?companySearchSubmitted\.trim\(\)/,
    'filteredCompanies debe filtrar basado en el término enviado con Enter (companySearchSubmitted)'
  );

  assert.match(
    content,
    /handleCompanySearchKeyDown/,
    'QuoteModal.jsx debe escuchar la tecla Enter en onKeyDown'
  );

  assert.match(
    content,
    /executeCompanySearch/,
    'QuoteModal.jsx debe definir executeCompanySearch para buscar bajo demanda'
  );

  // 3. Debe definir handleUnlinkCompany
  assert.match(
    content,
    /const handleUnlinkCompany\s*=/,
    'QuoteModal.jsx debe definir handleUnlinkCompany para desvincular una empresa de la cotización'
  );

  // 4. Los botones [Editar] deben llamar a openEditCompanyModal con selectedQuoteCompany
  assert.match(
    content,
    /openEditCompanyModal\(selectedQuoteCompany\)/,
    'Los botones Editar en móvil y desktop deben invocar openEditCompanyModal(selectedQuoteCompany)'
  );

  // 5. Los inputs de búsqueda deben tener botón para limpiar búsqueda (✕) y botón de búsqueda (Enter)
  assert.match(
    content,
    /title="Limpiar búsqueda"/,
    'QuoteModal.jsx debe ofrecer botón rápido para limpiar búsqueda en el buscador de empresa'
  );

  assert.match(
    content,
    /title="Buscar en catálogo \(Enter\)"/,
    'QuoteModal.jsx debe ofrecer botón para disparar la búsqueda'
  );

  // 6. Debe haber botón/acción de desvincular empresa en la UI
  assert.match(
    content,
    /title="Desvincular institución de esta cotización"/,
    'QuoteModal.jsx debe ofrecer opción visual para desvincular la institución asignada'
  );
});
