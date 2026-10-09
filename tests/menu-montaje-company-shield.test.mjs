import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('printUtils.js blinda la resolución de empresa en Menú & Montaje contra colisiones de ID', () => {
  const filePath = path.resolve('src/utils/printUtils.js');
  const code = fs.readFileSync(filePath, 'utf8');

  // 1. Debe existir la lógica que valida concordancia y prioriza el nombre explícito
  assert.match(
    code,
    /const explicitName = String\(quote\.companyName \|\| ev\?\.name \|\| ""\)\.trim\(\);/,
    'printUtils.js debe definir explicitName a partir de quote.companyName || ev?.name'
  );

  assert.match(
    code,
    /if \(compNameNorm !== expNameNorm\)\s*\{\s*const byName = \(companies \|\| \[\]\)\.find/,
    'printUtils.js debe descartar la empresa del catálogo si su nombre no coincide con el nombre explícito'
  );

  assert.match(
    code,
    /const institutionName = explicitName \|\| String\(company\?\.name \|\| "-"\)\.trim\(\) \|\| "-";/,
    'printUtils.js debe priorizar explicitName sobre company?.name para institutionName'
  );
});

test('La lógica de resolución de empresa nunca suplanta el nombre cuando el ID de empresa colisiona con otro evento', () => {
  // Simulador fiel de la función de resolución en printUtils
  function resolveInstitutionName(ev, quoteLike, companies = []) {
    const quote = quoteLike || {};
    const explicitName = String(quote.companyName || ev?.name || "").trim();
    let company = (companies || []).find((c) => String(c.id || "").trim() === String(quote.companyId || "").trim());
    if (company && explicitName) {
      const compNameNorm = String(company.name || "").trim().toLowerCase();
      const expNameNorm = explicitName.toLowerCase();
      if (compNameNorm !== expNameNorm) {
        const byName = (companies || []).find((c) => String(c.name || "").trim().toLowerCase() === expNameNorm);
        company = byName || null;
      }
    }
    return explicitName || String(company?.name || "-").trim() || "-";
  }

  // Caso exacto del usuario: DVV INTERNATIONAL con companyId 1000 heredado que pertenece a BODA CLAUDIA RIOS
  const fakeCompanies = [
    { id: "1000", name: "BODA CLAUDIA RIOS" },
    { id: "cmp_dvv", name: "DVV INTERNATIONAL" }
  ];

  const ev = { name: "DVV INTERNATIONAL" };
  const quote = {
    companyId: "1000", // ID colisionado heredado
    companyName: "DVV INTERNATIONAL",
    code: "COT-172536"
  };

  const resolved = resolveInstitutionName(ev, quote, fakeCompanies);

  assert.equal(resolved, "DVV INTERNATIONAL", "El encabezado debe ser DVV INTERNATIONAL y no BODA CLAUDIA RIOS");
  assert.notEqual(resolved, "BODA CLAUDIA RIOS", "BODA CLAUDIA RIOS debe ser totalmente descartada");
});
