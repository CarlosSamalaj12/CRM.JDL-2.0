const fs = require('fs');

const content = fs.readFileSync('src/modules/informes/styles.css', 'utf8');
const lines = content.split('\n');
console.log('=== search actions-bar in styles.css ===');
lines.forEach((line, i) => {
  if (line.includes('actions-bar')) {
    console.log(`Line ${i+1}: ${line.trim()}`);
    // print 5 lines after
    for (let j = i+1; j < Math.min(lines.length, i+6); j++) {
      console.log(`  ${j+1}: ${lines[j]}`);
    }
  }
});
