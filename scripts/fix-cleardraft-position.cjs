const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/modules/calendar/components/QuoteModal.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Current pattern: clearDraft BEFORE onSave
// Fix: move clearDraft AFTER onSave
const oldPattern = "lastSavedQuoteRef.current = { ...finalQuote, versions: undefined };\n      clearDraft(event);\n\n      if (typeof onSave === 'function') {\n        await onSave(finalQuote, { keepOpen: true });\n      }";
const newPattern = "lastSavedQuoteRef.current = { ...finalQuote, versions: undefined };\n\n      if (typeof onSave === 'function') {\n        await onSave(finalQuote, { keepOpen: true });\n      }\n      clearDraft(event);";

if (content.includes(oldPattern)) {
  content = content.replace(oldPattern, newPattern);
  console.log('✓ Moved clearDraft(event) after onSave');
} else {
  console.error('Pattern not found - checking alternatives...');
  // Try with different whitespace
  const altPatterns = [
    /lastSavedQuoteRef\.current = \{ \.\.\.finalQuote, versions: undefined \};\s+clearDraft\(event\);\s+if \(typeof onSave === 'function'\)/,
  ];
  for (const pat of altPatterns) {
    const match = content.match(pat);
    if (match) {
      console.log('Found with regex');
      const replacement = "lastSavedQuoteRef.current = { ...finalQuote, versions: undefined };\n\n      if (typeof onSave === 'function') {\n        await onSave(finalQuote, { keepOpen: true });\n      }\n      clearDraft(event);";
      content = content.replace(pat, replacement);
      console.log('✓ Fixed via regex');
      break;
    }
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');
