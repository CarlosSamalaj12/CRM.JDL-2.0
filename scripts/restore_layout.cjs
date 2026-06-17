const fs = require('fs');

const filePath = 'src/modules/informes/styles.css';
let content = fs.readFileSync(filePath, 'utf8');

let changes = 0;

// ─── Restore pos-body-3col (missing!) ───
// Find where to insert: before the .pos-ticket block (which is inside the 3col section)
const ticketIdx = content.indexOf('.pos-ticket {\n');
if (ticketIdx > -1) {
  // Check if pos-body-3col already has a definition
  const hasBody3col = content.includes('.pos-body-3col {');
  if (!hasBody3col) {
    // Find a good insertion point - after the .pos-tabs block and before .pos-ticket
    const posTabsEnd = content.lastIndexOf('}\n\n', ticketIdx);
    const insertionPoint = posTabsEnd > 0 ? posTabsEnd + 1 : ticketIdx;
    
    const body3colBlock = `.pos-body-3col {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-columns: 220px 1fr 300px;
  gap: 0.5rem;
  padding: 0 0.5rem;
}

`;
    content = content.substring(0, insertionPoint) + body3colBlock + content.substring(insertionPoint);
    console.log('✅ Restored pos-body-3col block');
    changes++;
  } else {
    console.log('⚠️ pos-body-3col already exists');
  }
} else {
  console.log('ERROR: Could not find .pos-ticket to anchor insertion');
  process.exit(1);
}

// ─── Restore pos-page (missing!) ───
// Find the main POS section - look for the comment marker
const posCommentIdx = content.indexOf('POS CONSTRUCTOR — 3 PANEL LAYOUT');
if (posCommentIdx === -1) {
  // Try another approach - look for .pos-topbar
  const topbarIdx = content.indexOf('.pos-topbar {\n');
  if (topbarIdx > -1) {
    const hasPosPage = content.includes('.pos-page {\n');
    if (!hasPosPage) {
      // Find insertion point - before .pos-topbar
      const before = content.lastIndexOf('}\n\n', topbarIdx);
      const insertionPoint = before > 0 ? before + 1 : topbarIdx;
      
      const posPageBlock = `.pos-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  gap: 0.6rem;
  padding: 0.75rem;
  background: var(--bg-app);
}

`;
      content = content.substring(0, insertionPoint) + posPageBlock + content.substring(insertionPoint);
      console.log('✅ Restored pos-page block');
      changes++;
    } else {
      console.log('⚠️ pos-page already exists');
    }
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✅ Done. Total changes: ${changes}`);
