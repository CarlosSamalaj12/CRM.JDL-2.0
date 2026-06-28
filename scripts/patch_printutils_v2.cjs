/**
 * Patch printUtils.js - dynamic contract template filename resolution.
 * Uses exact content from the file.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(process.argv[2] || 'src/utils/printUtils.js');
let content = fs.readFileSync(filePath, 'utf8');

let changes = 0;

// 1. Replace the hardcoded template resolution with dynamic lookup
const oldTemplateResolution = `    let htmlContent = "";
      let isServiHospTemplate = false;

    if (quote.templateId && printOption !== "sin_precios") {
      let fileName = "";
      if (quote.templateId === "contrato_corp" || quote.templateId === "contrato_social") {
        fileName = "Jardines.html";
      } else if (quote.templateId === "contrato_hosp") {
        fileName = "ServiHosp.html";
        isServiHospTemplate = true;
      }`;

const newTemplateResolution = `    let htmlContent = "";
      let isServiHospTemplate = false;

    if (quote.templateId && printOption !== "sin_precios") {
      // Resolve template filename from contractTemplates config (if available)
      let fileName = "";
      const ctpls = Array.isArray(quote.contractTemplates) ? quote.contractTemplates : [];
      const matched = ctpls.find(t => String(t.id) === String(quote.templateId));
      if (matched) {
        fileName = matched.filename;
        // Flag ServiHosp templates for header image selection
        if (matched.filename && /serv/i.test(matched.filename)) {
          isServiHospTemplate = true;
        }
      }
      // Legacy fallback for quotes saved before contractTemplates config
      if (!fileName) {
        if (quote.templateId === "contrato_corp" || quote.templateId === "contrato_social") {
          fileName = "Jardines.html";
        } else if (quote.templateId === "contrato_hosp") {
          fileName = "ServiHosp.html";
          isServiHospTemplate = true;
        }
      }`;

if (content.includes(oldTemplateResolution)) {
  content = content.replace(oldTemplateResolution, newTemplateResolution);
  console.log('✓ Updated template resolution logic');
  changes++;
} else {
  console.log('✗ Could not find template resolution pattern');
}

// 2. Add contractTemplates loading from state after companies/users loading
const oldStateLoad = `    try {
      const crmState = await loadState();
      companies = Array.isArray(crmState?.companies) ? crmState.companies : [];
      users = Array.isArray(crmState?.users) ? crmState.users : [];
    } catch (err) {
      console.error("Error loading CRM state for print:", err);
    }`;

const newStateLoad = `    let ctplsFromState = [];
    try {
      const crmState = await loadState();
      companies = Array.isArray(crmState?.companies) ? crmState.companies : [];
      users = Array.isArray(crmState?.users) ? crmState.users : [];
      ctplsFromState = Array.isArray(crmState?.contractTemplates) ? crmState.contractTemplates : [];
    } catch (err) {
      console.error("Error loading CRM state for print:", err);
    }
    // Use contractTemplates from state if not already on quote
    if (!Array.isArray(quote.contractTemplates) || !quote.contractTemplates.length) {
      quote.contractTemplates = ctplsFromState;
    }`;

if (content.includes(oldStateLoad)) {
  content = content.replace(oldStateLoad, newStateLoad);
  console.log('✓ Added contractTemplates loading from state');
  changes++;
} else {
  console.log('✗ Could not find loadState pattern');
}

// Write back
if (changes > 0) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`\n✅ printUtils.js patched (${changes} change(s))`);
} else {
  console.log('\n❌ No changes applied to printUtils.js');
}
