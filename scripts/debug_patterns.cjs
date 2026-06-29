const fs = require('fs');
const path = require('path');

// Check QuoteModal
const qmPath = path.resolve(__dirname, '..', 'src/modules/calendar/components/QuoteModal.jsx');
let qm = fs.readFileSync(qmPath, 'utf8');

// Find template selector
let idx = qm.indexOf('Plantilla contrato');
console.log('=== QuoteModal ===');
console.log('Plantilla contrato at position:', idx);
if (idx >= 0) {
  // Show raw chars around this area
  const chunk = qm.substring(idx, idx + 400);
  console.log('Raw context:');
  console.log(JSON.stringify(chunk));
  console.log('---');
  console.log(chunk);
}

// Find finalQuote
idx = qm.indexOf('const finalQuote');
console.log('\nconst finalQuote at position:', idx);
if (idx >= 0) {
  const chunk = qm.substring(idx, idx + 200);
  console.log('Raw context:');
  console.log(JSON.stringify(chunk));
}

// Check printUtils
const puPath = path.resolve(__dirname, '..', 'src/utils/printUtils.js');
let pu = fs.readFileSync(puPath, 'utf8');

idx = pu.indexOf('quote.templateId && printOption');
console.log('\n=== printUtils ===');
console.log('quote.templateId at position:', idx);
if (idx >= 0) {
  const chunk = pu.substring(idx, idx + 120);
  console.log('Raw start context:');
  console.log(JSON.stringify(chunk));
}

// Find the end marker
idx = pu.indexOf('\n    let mmContentHtml = "";');
console.log('\nmmContentHtml marker at position:', idx);
