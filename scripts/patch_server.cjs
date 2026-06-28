const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server.cjs');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the broken newlines from previous PowerShell attempt
content = content.replace(
  /quickTemplates: \[\],n\s+quoteServiceTemplates: \[\],n\s+contractTemplates: \[\],n\s+disabledCompanies: \[\]/g,
  'quickTemplates: [],\n      quoteServiceTemplates: [],\n      contractTemplates: [],\n      disabledCompanies: []'
);

// 1. Add 'contractTemplates' to SQL query
content = content.replace(
  "clave IN ('services','serviceCategories','quickTemplates','quoteServiceTemplates','disabledCompanies'",
  "clave IN ('services','serviceCategories','quickTemplates','quoteServiceTemplates','contractTemplates','disabledCompanies'"
);

// 2. Add contractTemplates const in state defaults (already done above)

// 3. Add contractTemplates row finder + parsing
const finderBlock = `    const quickTemplatesRow = appStateRows.find((r) => str(r.clave) === "quickTemplates");\n    const quoteServiceTemplatesRow = appStateRows.find((r) => str(r.clave) === "quoteServiceTemplates");`;
const finderReplacement = `    const contractTemplatesRow = appStateRows.find((r) => str(r.clave) === "contractTemplates");\n    const quickTemplatesRow = appStateRows.find((r) => str(r.clave) === "quickTemplates");\n    const quoteServiceTemplatesRow = appStateRows.find((r) => str(r.clave) === "quoteServiceTemplates");`;

if (content.includes(finderBlock)) {
  content = content.replace(finderBlock, finderReplacement);
  console.log('✓ Added contractTemplatesRow finder');
} else {
  console.log('✗ Could not find quickTemplatesRow/quoteServiceTemplatesRow block');
}

// 4. Add contractTemplates parsing after quoteServiceTemplates parsing
const parsingEndBlock = `    if (quoteServiceTemplatesRow?.valor_json) {\n      try {\n        const parsed = JSON.parse(quoteServiceTemplatesRow.valor_json);\n        state.quoteServiceTemplates = Array.isArray(parsed) ? parsed : [];\n      } catch (_) {\n        state.quoteServiceTemplates = [];\n      }\n    }`;
const parsingReplacement = `    if (quoteServiceTemplatesRow?.valor_json) {\n      try {\n        const parsed = JSON.parse(quoteServiceTemplatesRow.valor_json);\n        state.quoteServiceTemplates = Array.isArray(parsed) ? parsed : [];\n      } catch (_) {\n        state.quoteServiceTemplates = [];\n      }\n    }\n    if (contractTemplatesRow?.valor_json) {\n      try {\n        const parsed = JSON.parse(contractTemplatesRow.valor_json);\n        state.contractTemplates = Array.isArray(parsed) ? parsed : [];\n      } catch (_) {\n        state.contractTemplates = [];\n      }\n    }`;

if (content.includes(parsingEndBlock)) {
  content = content.replace(parsingEndBlock, parsingReplacement);
  console.log('✓ Added contractTemplates parsing');
} else {
  console.log('✗ Could not find quoteServiceTemplates parsing block');
}

// 5. Add contractTemplates const in writeStateToTables
const writeConstBlock = `    const quoteServiceTemplates = Array.isArray(state.quoteServiceTemplates) ? state.quoteServiceTemplates : [];\n    const disabledCompanies = Array.isArray(state.disabledCompanies) ? state.disabledCompanies : [];`;
const writeConstReplacement = `    const quoteServiceTemplates = Array.isArray(state.quoteServiceTemplates) ? state.quoteServiceTemplates : [];\n    const contractTemplates = Array.isArray(state.contractTemplates) ? state.contractTemplates : [];\n    const disabledCompanies = Array.isArray(state.disabledCompanies) ? state.disabledCompanies : [];`;

if (content.includes(writeConstBlock)) {
  content = content.replace(writeConstBlock, writeConstReplacement);
  console.log('✓ Added contractTemplates const in writeStateToTables');
} else {
  console.log('✗ Could not find writeStateToTables const block');
}

// 6. Add INSERT for contractTemplates
const insertBlock = `      [JSON.stringify(quoteServiceTemplates)]\n    );\n    await conn.query(\n      \`\n        INSERT INTO app_state_kv (clave, valor_json)\n        VALUES ('disabledCompanies', ?)`;
const insertReplacement = `      [JSON.stringify(quoteServiceTemplates)]\n    );\n    await conn.query(\n      \`\n        INSERT INTO app_state_kv (clave, valor_json)\n        VALUES ('contractTemplates', ?)\n        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)\n      \`,\n      [JSON.stringify(contractTemplates)]\n    );\n    await conn.query(\n      \`\n        INSERT INTO app_state_kv (clave, valor_json)\n        VALUES ('disabledCompanies', ?)`;

if (content.includes(insertBlock)) {
  content = content.replace(insertBlock, insertReplacement);
  console.log('✓ Added contractTemplates INSERT');
} else {
  console.log('✗ Could not find INSERT block for quoteServiceTemplates');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ server.cjs patched successfully');
