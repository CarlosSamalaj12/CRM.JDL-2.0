const fs = require('fs');

const filePath = 'src/modules/informes/styles.css';
let content = fs.readFileSync(filePath, 'utf8');

// Find the unclosed @media (max-width: 900px) block
const mediaIdx = content.indexOf('@media (max-width: 900px) {');
if (mediaIdx === -1) {
  console.log('WARN: Could not find the unclosed @media block');
  process.exit(0);
}

// Find where this block ends - look for the next @media or end of file
const afterMedia = content.substring(mediaIdx);
const nextMedia = afterMedia.indexOf('@media', 30);
const endIdx = nextMedia > 0 ? mediaIdx + nextMedia : content.length;

// Count brace depth from the start of the @media block
let depth = 0;
let started = false;
let unclosedEnd = mediaIdx;

for (let i = mediaIdx; i < content.length; i++) {
  const ch = content[i];
  if (ch === '{') { depth++; started = true; }
  if (ch === '}') { depth--; }
  if (started && depth === 0) {
    unclosedEnd = i + 1;
    break;
  }
}

if (started && depth > 0) {
  // Block is unclosed - add the necessary closing braces
  const insertAt = content.length;
  const needClose = '}\n'.repeat(depth);
  content = content.substring(0, insertAt) + needClose;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Added ${depth} missing closing brace(s) at end of file`);
} else if (depth === 0 && started) {
  console.log('✅ @media block already properly closed');
} else {
  console.log('Could not determine block structure');
}
