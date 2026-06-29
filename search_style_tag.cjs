const fs = require('fs');

const content = fs.readFileSync('src/modules/calendar/components/QuoteModal.jsx', 'utf8');
const lines = content.split('\n');
console.log('=== search style tags in QuoteModal.jsx ===');
let inStyle = false;
lines.forEach((line, i) => {
  if (line.includes('<style')) {
    inStyle = true;
    console.log(`\nStyle block starts at line ${i+1}: ${line}`);
  }
  if (inStyle) {
    if (line.includes('qp-') || line.includes('header')) {
      console.log(`  Line ${i+1}: ${line.trim()}`);
    }
    if (line.includes('</style>')) {
      inStyle = false;
      console.log(`Style block ends at line ${i+1}`);
    }
  }
});
