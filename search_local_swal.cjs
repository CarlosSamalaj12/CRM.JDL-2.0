const fs = require('fs');

const content = fs.readFileSync('src/modules/calendar/components/QuoteModal.jsx', 'utf8');
const lines = content.split('\n');
console.log('=== search localSwal in QuoteModal.jsx ===');
lines.forEach((line, i) => {
  if (line.includes('localSwal')) {
    console.log(`Line ${i+1}: ${line.trim()}`);
  }
});
