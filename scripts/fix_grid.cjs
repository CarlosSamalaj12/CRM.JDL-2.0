const fs = require('fs');

const filePath = 'src/modules/informes/styles.css';
let content = fs.readFileSync(filePath, 'utf8');

// The pos-elem-grid main block is MISSING (deleted by dedup script).
// We need to add it back right before the scrollbar styles.
// Find the scrollbar styles
const scrollbarIdx = content.indexOf('.pos-elem-grid::-webkit-scrollbar');
if (scrollbarIdx === -1) {
  console.log('ERROR: Could not find pos-elem-grid scrollbar styles');
  process.exit(1);
}

// Find the start of the line where scrollbar styles begin
const lineStart = content.lastIndexOf('\n', scrollbarIdx - 1);
const insertionPoint = lineStart > 0 ? lineStart : scrollbarIdx;

// The original pos-elem-grid block (from before CSS changes)
const gridBlock = `.pos-elem-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.35rem;
  align-content: start;
  padding: 0.15rem;
}

`;

content = content.substring(0, insertionPoint) + gridBlock + content.substring(insertionPoint + 1);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ pos-elem-grid block restored');
