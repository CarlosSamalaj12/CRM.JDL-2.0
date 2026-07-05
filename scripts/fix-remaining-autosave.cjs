const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/modules/calendar/components/QuoteModal.jsx');
let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// Fix 1: Add clearDraft(event) after savedQuoteSnapshotRef.current = quoteSnapshot(finalQuote);
const saveTarget = "lastSavedQuoteRef.current = { ...finalQuote, versions: undefined };";
const saveReplacement = "lastSavedQuoteRef.current = { ...finalQuote, versions: undefined };\n      clearDraft(event);";
if (content.includes(saveTarget) && !content.includes('clearDraft(event)')) {
  content = content.replace(saveTarget, saveReplacement);
  changes++;
  console.log('✓ Added clearDraft(event) after save');
}

// Fix 2: Add toast.success to restore effect
const toastTarget = "savedQuoteSnapshotRef.current = JSON.stringify(restored);\n      }, 100);";
const toastReplacement = "savedQuoteSnapshotRef.current = JSON.stringify(restored);\n        toast.success('🔄 Borrador recuperado: el carrito se restauró desde tu último progreso');\n      }, 100);";
if (content.includes(toastTarget) && !content.includes("toast.success('🔄 Borrador")) {
  content = content.replace(toastTarget, toastReplacement);
  changes++;
  console.log('✓ Added toast.success to restore effect');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone. ${changes} change(s) applied.`);
