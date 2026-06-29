const fs = require('fs');

const content = fs.readFileSync('src/modules/informes/styles.css', 'utf8');
const lines = content.split('\n');
console.log('=== all occurrences of actions-bar in styles.css ===');
lines.forEach((line, i) => {
  if (line.includes('actions-bar')) {
    console.log(`Line ${i+1}: ${line.trim()}`);
  }
});
