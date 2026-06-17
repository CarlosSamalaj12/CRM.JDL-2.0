const fs = require('fs');

const filePath = 'src/modules/informes/styles.css';
let content = fs.readFileSync(filePath, 'utf8');

// Remove all \r characters for consistent processing
const clean = content.replace(/\r/g, '');

// Count brace depth across the file
// We need to be smart about strings and comments
let depth = 0;
let inComment = false;
let inString = false;
let stringChar = '';
let unclosedAt = -1;

for (let i = 0; i < clean.length; i++) {
  const ch = clean[i];
  const prev = i > 0 ? clean[i-1] : '';
  
  if (inComment) {
    if (ch === '/' && prev === '*') inComment = false;
    continue;
  }
  if (inString) {
    if (ch === stringChar && prev !== '\\') inString = false;
    continue;
  }
  
  if (ch === '/' && clean[i+1] === '*') { inComment = true; i++; continue; }
  if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
  
  if (ch === '{') depth++;
  if (ch === '}') depth--;
  
  if (depth < 0) {
    console.log(`Warning: Extra closing brace at position ${i}`);
    depth = 0;
  }
}

console.log(`Brace depth at end of file: ${depth}`);

if (depth > 0) {
  // Add missing closing braces
  const closingBraces = '\n'.repeat(depth).split('').map(() => '}').join('\n') + '\n';
  content = content + closingBraces;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Added ${depth} missing closing brace(s)`);
} else if (depth === 0) {
  console.log('✅ All blocks properly closed');
} else {
  console.log(`⚠️ Negative depth: ${depth} (unexpected)`);
}
