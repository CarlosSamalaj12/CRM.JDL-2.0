const fs = require('fs');

const content = fs.readFileSync('src/modules/calendar/components/QuoteModal.jsx', 'utf8');
const lines = content.split('\n');
console.log('=== lines 3480-3530 ===');
for (let i = 3480; i < 3530; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
console.log('=== lines 3750-3780 ===');
for (let i = 3750; i < 3780; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
