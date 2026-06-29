/**
 * Patch printUtils.js to dynamically look up contract template filenames.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(process.argv[2] || 'src/utils/printUtils.js');
let content = fs.readFileSync(filePath, 'utf8');

// Update the template resolution to dynamically look up filename from contractTemplates
const oldCode = `    if (quote.templateId && printOption !== \"sin_precios\") {
      let fileName = \"\";
      if (quote.templateId === \"contrato_corp\" || quote.templateId === \"contrato_social\") {
        fileName = \"Jardines.html\";
      } else if (quote.templateId === \"contrato_hosp\") {
        fileName = \"ServiHosp.html\";
        isServiHospTemplate = true;
      }`;

const newCode = `    if (quote.templateId && printOption !== \"sin_precios\") {
      let fileName = \"\";
      // Look up filename from contractTemplates config
      const ctpls = Array.isArray(quote.contractTemplates) ? quote.contractTemplates : [];
      const matched = ctpls.find(t => String(t.id) === String(quote.templateId));
      if (matched) {
        fileName = matched.filename;
      }
      // Fallback: if the saved quote didn't include contractTemplates, try loading from state
      if (!fileName) {
        try {
          const { loadState } = require('./stateService');
          // Can't use require in ESM, will try dynamic import pattern below
        } catch (_) {}
      }
      // Legacy fallback (backward compatibility for existing quotes)
      if (!fileName) {
        if (quote.templateId === \"contrato_corp\" || quote.templateId === \"contrato_social\") {
          fileName = \"Jardines.html\";
        } else if (quote.templateId === \"contrato_hosp\") {
          fileName = \"ServiHosp.html\";
          isServiHospTemplate = true;
        }
      }`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  console.log('✓ Updated template resolution in printUtils.js');
} else {
  // Try with different indentation
  const altOldCode = oldCode.replace(/    /g, '  ');
  if (content.includes(altOldCode)) {
    content = content.replace(altOldCode, newCode.replace(/    /g, '  '));
    console.log('✓ Updated template resolution in printUtils.js (alt indent)');
  } else {
    console.log('✗ Could not find the template resolution code pattern');
  }
}

// Add contractTemplates to the call site where it's passed to generateQuotePrintDocument
// We can't easily patch this here since it's in QuoteModal.jsx, but we'll handle it differently.
// Instead, we'll make printUtils load contractTemplates from the quote's parent data or from loadState.

// Find where loadState is called and add contractTemplates loading
const loadStateCall = `    try {
      const crmState = await loadState();
      companies = Array.isArray(crmState?.companies) ? crmState.companies : [];
      users = Array.isArray(crmState?.users) ? crmState.users : [];
    } catch (err) {
      console.error(\"Error loading CRM state for print:\", err);
    }`;

const loadStateReplacement = `    let ctplsLookup = [];
    try {
      const crmState = await loadState();
      companies = Array.isArray(crmState?.companies) ? crmState.companies : [];
      users = Array.isArray(crmState?.users) ? crmState.users : [];
      ctplsLookup = Array.isArray(crmState?.contractTemplates) ? crmState.contractTemplates : [];
    } catch (err) {
      console.error(\"Error loading CRM state for print:\", err);
    }
    // Use loaded contractTemplates if quote didn't have them
    if (!Array.isArray(quote.contractTemplates) || !quote.contractTemplates.length) {
      quote.contractTemplates = ctplsLookup;
    }`;

if (content.includes(loadStateCall)) {
  content = content.replace(loadStateCall, loadStateReplacement);
  console.log('✓ Added contractTemplates loading in printUtils.js');
} else {
  console.log('✗ Could not find loadState call pattern');
}

// Don't write if no changes were made
if (content.includes('ctpls') || content.includes('contractTemplates')) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ printUtils.js patched successfully');
} else {
  console.log('❌ No changes were applied to printUtils.js');
}
