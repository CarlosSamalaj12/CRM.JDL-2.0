const fs = require('fs');

const filePath = 'src/modules/informes/styles.css';
let content = fs.readFileSync(filePath, 'utf8');
const original = content;

// Clases a deduplicar - queremos mantener la ÚLTIMA ocurrencia (la principal)
// y las responsive overrides (dentro de @media queries) al final del archivo
const classesToDedup = [
  'pos-page',
  'pos-body-3col', 
  'pos-elem-grid',
  'pos-topbar',
  'pos-tabs',
  'pos-ticket',
  'pos-bottom-actions',
];

// Find and classify all definitions for each class
for (const cls of classesToDedup) {
  const regex = new RegExp(`\\.${cls}\\s*\\{`, 'g');
  const matches = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    // Check if inside a @media block
    const beforeMatch = content.substring(0, match.index);
    const lastMedia = beforeMatch.lastIndexOf('@media');
    const lastOpenBrace = beforeMatch.lastIndexOf('{');
    const isInsideMedia = lastMedia > lastOpenBrace;
    
    // Determine the block boundaries
    let braceDepth = 0;
    let started = false;
    let blockEnd = match.index;
    for (let i = match.index; i < content.length; i++) {
      if (content[i] === '{') { braceDepth++; started = true; }
      if (content[i] === '}') { braceDepth--; }
      if (started && braceDepth === 0) { blockEnd = i + 1; break; }
    }
    
    matches.push({
      index: match.index,
      end: blockEnd,
      lineNum,
      isInsideMedia,
      block: content.substring(match.index, blockEnd),
    });
  }
  
  if (matches.length <= 1) continue;
  
  console.log(`${cls}: ${matches.length} definitions found`);
  
  // Sort: non-media first, then media (responsive overrides)
  const nonMedia = matches.filter(m => !m.isInsideMedia);
  const media = matches.filter(m => m.isInsideMedia);
  
  if (nonMedia.length > 1) {
    // Keep only the LAST non-media definition (the main section)
    const toRemove = nonMedia.slice(0, -1);
    // Sort by index descending so we remove from end to start (safest)
    toRemove.sort((a, b) => b.index - a.index);
    for (const rem of toRemove) {
      console.log(`  Removing duplicate at line ${rem.lineNum} (non-media)`);
      content = content.substring(0, rem.index) + content.substring(rem.end);
    }
  }
}

const removed = original.length - content.length;
console.log(`\n=== Summary: removed ${removed} bytes ===`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('File saved.');
