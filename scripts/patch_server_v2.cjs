/**
 * Patch server.cjs to add contractTemplates support.
 * Uses line-by-line approach for reliability.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'server.cjs'));
let content = fs.readFileSync(filePath, 'utf8');

// Fix broken newlines from earlier attempt
content = content.replace(/quickTemplates: \[\],n\s+/g, 'quickTemplates: [],\n      ');
content = content.replace(/quoteServiceTemplates: \[\],n\s+/g, 'quoteServiceTemplates: [],\n      ');
content = content.replace(/contractTemplates: \[\],n\s+/g, 'contractTemplates: [],\n      ');

let changes = 0;

// 1. Verify SQL query already has contractTemplates (change #1 already applied)
if (content.includes("'contractTemplates','disabledCompanies'")) {
  console.log('✓ Change #1 already applied (SQL query)');
} else {
  content = content.replace(
    "clave IN ('services','serviceCategories','quickTemplates','quoteServiceTemplates','disabledCompanies'",
    "clave IN ('services','serviceCategories','quickTemplates','quoteServiceTemplates','contractTemplates','disabledCompanies'"
  );
  console.log('✓ Applied change #1 (SQL query)');
  changes++;
}

// 2. Verify default state already has contractTemplates
if (content.includes('contractTemplates: [],')) {
  console.log('✓ Change #2 already applied (default state)');
} else {
  // Add after quoteServiceTemplates: [],
  content = content.replace(
    'quoteServiceTemplates: [],\n',
    'quoteServiceTemplates: [],\n      contractTemplates: [],\n'
  );
  console.log('✓ Applied change #2 (default state)');
  changes++;
}

// 3. Add contractTemplatesRow finder + parsing
if (content.includes('const contractTemplatesRow = appStateRows')) {
  console.log('✓ Change #3 already applied (contractTemplatesRow)');
} else {
  // Add contractTemplatesRow finder before quickTemplatesRow
  const finderPattern = 'const quickTemplatesRow = appStateRows.find((r) => str(r.clave) === "quickTemplates");';
  if (content.includes(finderPattern)) {
    content = content.replace(
      finderPattern,
      'const contractTemplatesRow = appStateRows.find((r) => str(r.clave) === "contractTemplates");\n    ' + finderPattern
    );
    console.log('✓ Applied change #3 (contractTemplatesRow finder)');
    changes++;
  }
}

// 4. Add contractTemplates parsing after quoteServiceTemplates parsing
if (content.includes('state.contractTemplates = Array.isArray(parsed) ? parsed : []')) {
  console.log('✓ Change #4 already applied (contractTemplates parsing)');
} else {
  const parsingEndPattern = `    if (quoteServiceTemplatesRow?.valor_json) {\n      try {\n        const parsed = JSON.parse(quoteServiceTemplatesRow.valor_json);\n        state.quoteServiceTemplates = Array.isArray(parsed) ? parsed : [];\n      } catch (_) {\n        state.quoteServiceTemplates = [];\n      }\n    }\n    const disabledCompaniesRow = appStateRows.find((r) => str(r.clave) === "disabledCompanies");`;
  
  if (content.includes(parsingEndPattern)) {
    const newBlock = `    if (quoteServiceTemplatesRow?.valor_json) {\n      try {\n        const parsed = JSON.parse(quoteServiceTemplatesRow.valor_json);\n        state.quoteServiceTemplates = Array.isArray(parsed) ? parsed : [];\n      } catch (_) {\n        state.quoteServiceTemplates = [];\n      }\n    }\n    if (contractTemplatesRow?.valor_json) {\n      try {\n        const parsed = JSON.parse(contractTemplatesRow.valor_json);\n        state.contractTemplates = Array.isArray(parsed) ? parsed : [];\n      } catch (_) {\n        state.contractTemplates = [];\n      }\n    }\n    const disabledCompaniesRow = appStateRows.find((r) => str(r.clave) === "disabledCompanies");`;
    content = content.replace(parsingEndPattern, newBlock);
    console.log('✓ Applied change #4 (contractTemplates parsing)');
    changes++;
  } else {
    console.log('✗ Could not apply change #4 - pattern not found');
  }
}

// 5. Add contractTemplates const in writeStateToTables
if (content.includes('const contractTemplates = Array.isArray(state.contractTemplates)')) {
  console.log('✓ Change #5 already applied (writeStateToTables const)');
} else {
  const constPattern = 'const quoteServiceTemplates = Array.isArray(state.quoteServiceTemplates) ? state.quoteServiceTemplates : [];\n    const disabledCompanies = Array.isArray(state.disabledCompanies) ? state.disabledCompanies : [];';
  if (content.includes(constPattern)) {
    content = content.replace(
      constPattern,
      'const quoteServiceTemplates = Array.isArray(state.quoteServiceTemplates) ? state.quoteServiceTemplates : [];\n    const contractTemplates = Array.isArray(state.contractTemplates) ? state.contractTemplates : [];\n    const disabledCompanies = Array.isArray(state.disabledCompanies) ? state.disabledCompanies : [];'
    );
    console.log('✓ Applied change #5 (writeStateToTables const)');
    changes++;
  } else {
    console.log('✗ Could not apply change #5 - pattern not found');
  }
}

// 6. Add INSERT for contractTemplates
if (content.includes("VALUES ('contractTemplates', ?)")) {
  console.log('✓ Change #6 already applied (INSERT statement)');
} else {
  const insertPattern = `      [JSON.stringify(quoteServiceTemplates)]\n    );\n    await conn.query(\n      \`\n        INSERT INTO app_state_kv (clave, valor_json)\n        VALUES ('disabledCompanies', ?)`;
  if (content.includes(insertPattern)) {
    const newInsert = `      [JSON.stringify(quoteServiceTemplates)]\n    );\n    await conn.query(\n      \`\n        INSERT INTO app_state_kv (clave, valor_json)\n        VALUES ('contractTemplates', ?)\n        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)\n      \`,\n      [JSON.stringify(contractTemplates)]\n    );\n    await conn.query(\n      \`\n        INSERT INTO app_state_kv (clave, valor_json)\n        VALUES ('disabledCompanies', ?)`;
    content = content.replace(insertPattern, newInsert);
    console.log('✓ Applied change #6 (INSERT statement)');
    changes++;
  } else {
    console.log('✗ Could not apply change #6 - pattern not found');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✅ Patched server.cjs with ${changes} new change(s)`);
