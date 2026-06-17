const fs = require('fs');

const filePath = 'src/modules/informes/styles.css';
let content = fs.readFileSync(filePath, 'utf8');

// Find the POS CONSTRUCTOR section
const sectionMarker = 'POS CONSTRUCTOR — 3 PANEL LAYOUT';
const sectionIdx = content.indexOf(sectionMarker);
if (sectionIdx === -1) {
  console.log('ERROR: Could not find POS CONSTRUCTOR section');
  process.exit(1);
}

// Check if pos-page already exists
if (content.includes('.pos-page {\n')) {
  console.log('pos-page already exists - checking definition...');
  // Verify it has the right properties
  const ppIdx = content.indexOf('.pos-page {\n');
  const blockEnd = content.indexOf('}\n', ppIdx);
  const block = content.substring(ppIdx, blockEnd + 2);
  if (block.includes('display: flex') || block.includes('display:grid')) {
    console.log('pos-page has display property - OK');
    process.exit(0);
  }
}

// Find the start of the .pos-topbar block (first one in the POS section)
const posTopbarIdx = content.indexOf('.pos-topbar {\n', sectionIdx);
if (posTopbarIdx === -1) {
  console.log('ERROR: Could not find .pos-topbar in POS section');
  process.exit(1);
}

// Insert pos-page BEFORE pos-topbar
const insertionPoint = content.lastIndexOf('\n', posTopbarIdx - 2);
const posPageBlock = `.pos-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  gap: 0.6rem;
  padding: 0.5rem;
  background: var(--bg-app);
}

`;

content = content.substring(0, insertionPoint) + '\n' + posPageBlock + content.substring(insertionPoint + 1);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ pos-page block restored');
