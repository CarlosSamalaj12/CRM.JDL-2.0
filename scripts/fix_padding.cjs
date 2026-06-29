const fs = require('fs');
const path = require('path');

const qmPath = path.resolve(__dirname, '..', 'src/modules/calendar/components/QuoteModal.jsx');
let qm = fs.readFileSync(qmPath, 'utf8');

// Fix: remove duplicate padding
const old = `padding: '4px 0', maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px'`;
const fixed = `maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px'`;

if (qm.includes(old)) {
  qm = qm.replace(old, fixed);
  fs.writeFileSync(qmPath, qm, 'utf8');
  console.log('✅ Fixed duplicate padding');
} else {
  console.log('❌ Could not find duplicate padding pattern');
}
