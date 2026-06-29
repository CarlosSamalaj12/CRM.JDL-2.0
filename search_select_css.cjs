const fs = require('fs');

const content = fs.readFileSync('src/modules/calendar/components/QuoteModal.jsx', 'utf8');
const lines = content.split('\n');
console.log('=== search select styles ===');
lines.forEach((line, i) => {
  if (line.includes('select') && (line.includes('padding') || line.includes('height') || line.includes('font-size') || line.includes('{'))) {
    console.log(`Line ${i+1}: ${line.trim()}`);
  }
});
