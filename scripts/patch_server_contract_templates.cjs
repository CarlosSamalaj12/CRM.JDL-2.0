/**
 * Patch server.cjs to add contractTemplates support in app_state_kv.
 * Uses exact line content for reliable matching.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'server.cjs');
let content = fs.readFileSync(filePath, 'utf8');

const changes = [
  // 1. Add 'contractTemplates' to the SQL query (line ~837)
  {
    from: "clave IN ('services','serviceCategories','quickTemplates','quoteServiceTemplates','disabledCompanies','disabledServices','disabledManagers','disabledSalones','globalMonthlyGoals','checklistTemplates','checklistTemplateItems','checklistTemplateSections','menuMontajeSections','menuMontajeBebidas','eventChecklists','occupancyWeeklyOps','salonCapacities','salonOccupancyEnabled')",
    to: "clave IN ('services','serviceCategories','quickTemplates','quoteServiceTemplates','contractTemplates','disabledCompanies','disabledServices','disabledManagers','disabledSalones','globalMonthlyGoals','checklistTemplates','checklistTemplateItems','checklistTemplateSections','menuMontajeSections','menuMontajeBebidas','eventChecklists','occupancyWeeklyOps','salonCapacities','salonOccupancyEnabled')",
  },
  // 2. Add default empty array (after quoteServiceTemplates: [],)
  {
    from: "      quickTemplates: [],\n      quoteServiceTemplates: [],\n      disabledCompanies: [],",
    to: "      quickTemplates: [],\n      quoteServiceTemplates: [],\n      contractTemplates: [],\n      disabledCompanies: [],",
  },
  // 3. Add contractTemplates row finder and parsing
  {
    from: "    const quickTemplatesRow = appStateRows.find((r) => str(r.clave) === \"quickTemplates\");\n    const quoteServiceTemplatesRow = appStateRows.find((r) => str(r.clave) === \"quoteServiceTemplates\");\n    if (quickTemplatesRow?.valor_json) {\n      try {\n        const parsed = JSON.parse(quickTemplatesRow.valor_json);\n        state.quickTemplates = Array.isArray(parsed) ? parsed : [];\n      } catch (_) {\n        state.quickTemplates = [];\n      }\n    }\n    if (quoteServiceTemplatesRow?.valor_json) {\n      try {\n        const parsed = JSON.parse(quoteServiceTemplatesRow.valor_json);\n        state.quoteServiceTemplates = Array.isArray(parsed) ? parsed : [];\n      } catch (_) {\n        state.quoteServiceTemplates = [];\n      }\n    }",
    to: "    const contractTemplatesRow = appStateRows.find((r) => str(r.clave) === \"contractTemplates\");\n    const quickTemplatesRow = appStateRows.find((r) => str(r.clave) === \"quickTemplates\");\n    const quoteServiceTemplatesRow = appStateRows.find((r) => str(r.clave) === \"quoteServiceTemplates\");\n    if (quickTemplatesRow?.valor_json) {\n      try {\n        const parsed = JSON.parse(quickTemplatesRow.valor_json);\n        state.quickTemplates = Array.isArray(parsed) ? parsed : [];\n      } catch (_) {\n        state.quickTemplates = [];\n      }\n    }\n    if (quoteServiceTemplatesRow?.valor_json) {\n      try {\n        const parsed = JSON.parse(quoteServiceTemplatesRow.valor_json);\n        state.quoteServiceTemplates = Array.isArray(parsed) ? parsed : [];\n      } catch (_) {\n        state.quoteServiceTemplates = [];\n      }\n    }\n    if (contractTemplatesRow?.valor_json) {\n      try {\n        const parsed = JSON.parse(contractTemplatesRow.valor_json);\n        state.contractTemplates = Array.isArray(parsed) ? parsed : [];\n      } catch (_) {\n        state.contractTemplates = [];\n      }\n    }",
  },
  // 4. Add contractTemplates const in writeStateToTables (after quoteServiceTemplates)
  {
    from: "    const quoteServiceTemplates = Array.isArray(state.quoteServiceTemplates) ? state.quoteServiceTemplates : [];\n    const disabledCompanies = Array.isArray(state.disabledCompanies) ? state.disabledCompanies : [];",
    to: "    const quoteServiceTemplates = Array.isArray(state.quoteServiceTemplates) ? state.quoteServiceTemplates : [];\n    const contractTemplates = Array.isArray(state.contractTemplates) ? state.contractTemplates : [];\n    const disabledCompanies = Array.isArray(state.disabledCompanies) ? state.disabledCompanies : [];",
  },
  // 5. Add INSERT for contractTemplates after quoteServiceTemplates write
  {
    from: "      [JSON.stringify(quoteServiceTemplates)]\n    );\n    await conn.query(\n      `\n        INSERT INTO app_state_kv (clave, valor_json)\n        VALUES ('disabledCompanies', ?)",
    to: "      [JSON.stringify(quoteServiceTemplates)]\n    );\n    await conn.query(\n      `\n        INSERT INTO app_state_kv (clave, valor_json)\n        VALUES ('contractTemplates', ?)\n        ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)\n      `,\n      [JSON.stringify(contractTemplates)]\n    );\n    await conn.query(\n      `\n        INSERT INTO app_state_kv (clave, valor_json)\n        VALUES ('disabledCompanies', ?)",
  },
];

let modified = content;
let success = true;

for (const change of changes) {
  if (modified.includes(change.from)) {
    modified = modified.split(change.from).join(change.to);
    console.log(`✓ Applied change #${changes.indexOf(change) + 1}`);
  } else {
    console.log(`✗ NOT FOUND: change #${changes.indexOf(change) + 1}`);
    success = false;
  }
}

if (success) {
  fs.writeFileSync(filePath, modified, 'utf8');
  console.log('\n✅ All changes applied successfully to server.cjs');
} else {
  console.log('\n❌ Some changes could not be applied. Check above.');
}
