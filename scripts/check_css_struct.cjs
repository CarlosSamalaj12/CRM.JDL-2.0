const fs = require('fs');
const content = fs.readFileSync('src/modules/informes/styles.css', 'utf8');

function readBlock(startIdx, maxLen) {
  let depth = 0;
  let started = false;
  const end = Math.min(startIdx + maxLen, content.length);
  for (let i = startIdx; i < end; i++) {
    if (content[i] === '{') { depth++; started = true; }
    if (content[i] === '}') { depth--; }
    if (started && depth === 0) return content.substring(startIdx, i + 1);
  }
  return content.substring(startIdx, startIdx + maxLen);
}

// Find main sections (after line 4700)
const sections = [
  { label: 'pos-page (main)', marker: '.pos-page {\n' },
  { label: 'pos-body-3col (main)', marker: '.pos-body-3col {\n' },
  { label: 'pos-elementos (main)', marker: '.pos-elementos {\n' },
  { label: 'pos-ticket (main)', marker: '.pos-ticket {\n' },
  { label: 'pos-topbar (main)', marker: '.pos-topbar {\n' },
  { label: 'pos-tabs (main)', marker: '.pos-tabs {\n' },
];

for (const s of sections) {
  // Find the LAST occurrence (the main one)
  let idx = content.lastIndexOf(s.marker);
  if (idx === -1) {
    // Try with different spacing
    idx = content.lastIndexOf(s.marker.trim());
  }
  if (idx > -1) {
    const lineNum = content.substring(0, idx).split('\n').length;
    const block = readBlock(idx, 1500);
    console.log(`=== ${s.label} (line ${lineNum}) ===`);
    console.log(block);
    console.log('');
  }
}

// Also check if there are any duplicate definitions
console.log('=== COUNT OF EACH STRUCTURAL CLASS ===');
const classes = ['pos-page', 'pos-body-3col', 'pos-elementos', 'pos-ticket', 'pos-topbar', 'pos-tabs', 'pos-categorias', 'pos-elem-grid', 'pos-elem-btn', 'pos-bottom-actions'];
for (const cls of classes) {
  const regex = new RegExp(`\\.${cls}\\s*\\{`, 'g');
  const matches = content.match(regex);
  console.log(`${cls}: ${matches ? matches.length : 0} definition(s)`);
}
