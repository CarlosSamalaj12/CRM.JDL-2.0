const fs = require('fs');
const c = fs.readFileSync('src/modules/informes/styles.css', 'utf8');

// Find the main .pos-elem-grid block (not scrollbar styles)
const mainGridIdx = c.indexOf('.pos-elem-grid {\n');
if (mainGridIdx > -1) {
  const end = c.indexOf('}\n', mainGridIdx);
  console.log('=== pos-elem-grid main block ===');
  console.log(c.substring(mainGridIdx, end + 2));
} else {
  // Try with different spacing
  const altIdx = c.indexOf('.pos-elem-grid {');
  if (altIdx > -1) {
    console.log('Found at index:', altIdx);
    const before = c.substring(Math.max(0, altIdx - 200), altIdx);
    console.log('Context before:', before.substring(before.length - 200));
    const after = c.substring(altIdx, altIdx + 300);
    console.log('After:', after);
  } else {
    console.log('pos-elem-grid main block NOT found');
    
    // Check if it might use different formatting
    const allMatches = [];
    const regex = /\.pos-elem-grid[^}]*\}/g;
    let match;
    while ((match = regex.exec(c)) !== null) {
      allMatches.push(match[0]);
    }
    console.log(`Found ${allMatches.length} pos-elem-grid matches`);
    allMatches.forEach((m, i) => console.log(`Match ${i}:`, m));
  }
}
