const fs = require('fs');

const filePath = 'src/modules/informes/styles.css';
let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// ─── REVERT 1: Remove the scoped CSS variable block added by fix_pos_vars.cjs ───
const varBlockMarker = '/* ─── POS CSS Variable Definitions ───';
const varBlockEnd = '--ease: ease;\n}\n\n';

const varBlockStartIdx = content.indexOf(varBlockMarker);
if (varBlockStartIdx !== -1) {
  // Find the end of this block
  const afterBlock = content.indexOf('\n\n', varBlockStartIdx + 2000);
  const endIdx = afterBlock > varBlockStartIdx ? afterBlock : content.indexOf('\n/*', varBlockStartIdx + 100);
  if (endIdx > varBlockStartIdx) {
    content = content.substring(0, varBlockStartIdx) + content.substring(endIdx);
    console.log('✅ REVERT 1: Removed scoped CSS variable block');
    changes++;
  } else {
    console.log('⚠️ REVERT 1: Could not find end of variable block');
  }
} else {
  console.log('⚠️ REVERT 1: Variable block not found (already removed?)');
}

// ─── REVERT 2: pos-categorias - revert to minimal styling ───
const newCategorias = `.pos-categorias {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  box-shadow: var(--shadow-sm);
}`;

const oldCategorias = `.pos-categorias {
  overflow-y: auto;
}`;

// Check which version exists
if (content.includes(newCategorias)) {
  content = content.replace(newCategorias, oldCategorias);
  console.log('✅ REVERT 2: Restored pos-categorias to minimal styling');
  changes++;
} else if (content.includes(newCategorias.replace(/\n/g, '\r\n'))) {
  content = content.replace(newCategorias.replace(/\n/g, '\r\n'), oldCategorias);
  console.log('✅ REVERT 2: Restored pos-categorias (CRLF)');
  changes++;
} else {
  console.log('⚠️ REVERT 2: Could not find pos-categorias new block');
}

// ─── REVERT 3: pos-elem-btn - revert to original styling ───
const newElemBtn = `.pos-elem-btn {
  display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
  padding: 0.6rem 0.35rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease);
  min-height: 58px;
  position: relative;
  overflow: visible !important;
  font-family: inherit;
}

.pos-elem-btn::after { display: none !important; }

.pos-elem-btn:hover {
  border-color: var(--primary-light);
  background: var(--primary-bg);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}

.pos-elem-btn:active { transform: scale(0.95); }

.pos-elem-btn-active {
  background: linear-gradient(135deg, var(--primary), var(--primary-dark)) !important;
  border-color: transparent !important;
  color: white !important;
  box-shadow: 0 4px 14px var(--primary-glow);
}

.pos-elem-btn-active:hover {
  box-shadow: 0 6px 20px var(--primary-glow);
  transform: translateY(-2px);
}

.pos-elem-btn-selected {
  background: var(--success-bg) !important;
  border-color: rgba(16,185,129,0.4) !important;
  color: var(--success-color) !important;
}

.pos-elem-btn-selected:hover {
  border-color: var(--success) !important;
  box-shadow: 0 2px 8px rgba(16,185,129,0.2);
}`;

// We'll remove the enhanced hover/active states by checking for gradient
const gradientActive = 'background: linear-gradient(135deg, var(--primary), var(--primary-dark)) !important;';
if (content.includes(gradientActive)) {
  // Replace the entire enhanced block back to simpler version
  if (content.includes(newElemBtn)) {
    const oldElemBtn = newElemBtn
      .replace('gap: 0.25rem;', 'gap: 0.2rem;')
      .replace('padding: 0.6rem 0.35rem;', 'padding: 0.55rem 0.35rem;')
      .replace('min-height: 58px;', 'min-height: 55px;')
      .replace('font-family: inherit;\n}', '}')
      .replace(`.pos-elem-btn:hover {\n  border-color: var(--primary-light);\n  background: var(--primary-bg);\n  transform: translateY(-2px);\n  box-shadow: 0 4px 12px rgba(0,0,0,0.06);\n}`, `.pos-elem-btn:hover {\n  border-color: var(--primary-light);\n  background: var(--primary-bg);\n  transform: translateY(-1px);\n  box-shadow: var(--shadow-sm);\n}`)
      .replace('.pos-elem-btn:active { transform: scale(0.95); }', '.pos-elem-btn:active { transform: scale(0.96); }')
      .replace(`.pos-elem-btn-active {\n  background: linear-gradient(135deg, var(--primary), var(--primary-dark)) !important;\n  border-color: transparent !important;\n  color: white !important;\n  box-shadow: 0 4px 14px var(--primary-glow);\n}`, `.pos-elem-btn-active {\n  background: var(--primary) !important;\n  border-color: var(--primary-dark) !important;\n  color: white !important;\n  box-shadow: 0 2px 8px var(--primary-glow);\n}`)
      .replace(`.pos-elem-btn-active:hover {\n  box-shadow: 0 6px 20px var(--primary-glow);\n  transform: translateY(-2px);\n}`, '')
      .replace(`.pos-elem-btn-selected:hover {\n  border-color: var(--success) !important;\n  box-shadow: 0 2px 8px rgba(16,185,129,0.2);\n}`, '')
      .replace(/\n\n/g, '\n');
    
    content = content.replace(newElemBtn, oldElemBtn);
    console.log('✅ REVERT 3: Restored pos-elem-btn styling');
    changes++;
  } else {
    console.log('⚠️ REVERT 3: Could not find pos-elem-btn new block (trying CRLF)');
  }
} else {
  console.log('⚠️ REVERT 3: Gradient not found, may already be reverted');
}

// ─── REVERT 4: pos-ticket-header - revert padding ───
const newTicketHeader = `  padding: 0.55rem 0.75rem;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: white;
  font-weight: 700;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  letter-spacing: 0.01em;`;

const oldTicketHeader = `  padding: 0.5rem 0.65rem;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: white;
  font-weight: 700;
  font-size: 0.78rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;`;

if (content.includes(newTicketHeader)) {
  content = content.replace(newTicketHeader, oldTicketHeader);
  console.log('✅ REVERT 4: Restored pos-ticket-header');
  changes++;
} else {
  console.log('⚠️ REVERT 4: Could not find pos-ticket-header new block');
}

// ─── REVERT 5: pos-ticket-body - remove background ───
const newTicketBody = `  padding: 0.5rem;
  font-size: 0.75rem;
  background: var(--bg-card);`;

const oldTicketBody = `  padding: 0.4rem;
  font-size: 0.75rem;`;

if (content.includes(newTicketBody)) {
  content = content.replace(newTicketBody, oldTicketBody);
  console.log('✅ REVERT 5: Restored pos-ticket-body');
  changes++;
} else {
  console.log('⚠️ REVERT 5: Could not find pos-ticket-body new block');
}

// ─── REVERT 6: pos-ticket - remove box-shadow ───
const newTicketShadow = `  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-sm);`;

const oldTicketShadow = `  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;`;

if (content.includes(newTicketShadow)) {
  content = content.replace(newTicketShadow, oldTicketShadow);
  console.log('✅ REVERT 6: Restored pos-ticket (removed box-shadow)');
  changes++;
} else {
  console.log('⚠️ REVERT 6: Could not find pos-ticket box-shadow');
}

// ─── REVERT 7: pos-elem-grid - remove background/border ───
const newElemGrid = `.pos-elem-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.4rem;
  align-content: start;
  padding: 0.35rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}`;

const oldElemGrid = `.pos-elem-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.35rem;
  align-content: start;
  padding: 0.15rem;
}`;

if (content.includes(newElemGrid)) {
  content = content.replace(newElemGrid, oldElemGrid);
  console.log('✅ REVERT 7: Restored pos-elem-grid');
  changes++;
} else {
  console.log('⚠️ REVERT 7: Could not find pos-elem-grid new block');
}

// ─── REVERT 8: pos-elem-search - revert transition ───
const newElemSearch = 'transition: border-color var(--duration-normal) var(--ease), box-shadow var(--duration-normal) var(--ease);';
const oldElemSearch = 'transition: border-color var(--duration-normal) var(--ease);';

if (content.includes(newElemSearch)) {
  content = content.replace(newElemSearch, oldElemSearch);
  console.log('✅ REVERT 8: Restored pos-elem-search transition');
  changes++;
} else {
  console.log('⚠️ REVERT 8: Could not find new search transition');
}

// ─── REVERT 9: pos-ticket-item - remove hover state ───
const newTicketItem = `.pos-ticket-item {
  padding: 0.25rem 0.3rem;
  border-bottom: 1px solid var(--border);
  transition: background var(--duration-fast) var(--ease);
}

.pos-ticket-item:hover {
  background: var(--bg-elevated);
}`;

const oldTicketItem = `.pos-ticket-item {
  padding: 0.2rem 0.25rem;
  border-bottom: 1px solid var(--border);
}`;

if (content.includes(newTicketItem)) {
  content = content.replace(newTicketItem, oldTicketItem);
  console.log('✅ REVERT 9: Restored pos-ticket-item');
  changes++;
} else {
  console.log('⚠️ REVERT 9: Could not find pos-ticket-item new block');
}

// ─── REVERT 11: pos-bottom-actions - remove border-top/margin-top ───
const newBottomActions = `  border-top: 1px solid var(--border);
  margin-top: 0.15rem;`;

// This is harder to revert precisely since it's inline. Let's check if it exists.
if (content.includes('border-top: 1px solid var(--border);\n  margin-top: 0.15rem;')) {
  content = content.replace('border-top: 1px solid var(--border);\n  margin-top: 0.15rem;', '');
  console.log('✅ REVERT 11: Restored pos-bottom-actions');
  changes++;
} else {
  console.log('⚠️ REVERT 11: Could not find pos-bottom-actions border-top');
}

// ─── REVERT 12: Remove the extra empty section at top of POS section ───
// The fix_pos_vars insertion may have left extra blank lines
content = content.replace(/\n{4,}/g, '\n\n\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✅ All reverts applied! Total changes: ${changes}`);
