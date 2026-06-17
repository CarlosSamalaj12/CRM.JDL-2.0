const fs = require('fs');

const filePath = 'src/modules/informes/styles.css';
let content = fs.readFileSync(filePath, 'utf8');

// Find the beginning of the main POS section (last occurrence of .pos-page)
const posPageIdx = content.lastIndexOf('.pos-page {');
if (posPageIdx === -1) {
  console.log('ERROR: Could not find .pos-page { in file');
  process.exit(1);
}

// Find the line before this section to insert the variable definitions
const lineBefore = content.lastIndexOf('\n', posPageIdx - 2);
const insertionPoint = lineBefore > 0 ? lineBefore : posPageIdx;

// Build the variable definition block
// These map shorthand names used in the POS CSS to the actual design system variables
const varBlock = `
/* ─── POS CSS Variable Definitions ───
   These map shorthand variable names used by .pos-* classes
   to the project's design system (--ui-*) and global.css variables.
   Without these, all POS backgrounds, borders, shadows, and colors
   would silently fall through to defaults. */
body.informes-theme .pos-page,
body.informes-theme [class*=" pos-"],
body.informes-theme [class^="pos-"] {
  --bg-card: var(--panel, #ffffff);
  --bg-elevated: var(--ui-surface, #f8fafd);
  --border: var(--stroke, var(--ui-border, #d8e2ee));
  --border-light: var(--ui-border, #d8e2ee);
  --text-secondary: var(--muted, var(--ui-text-muted, #475569));
  --primary-dark: var(--accent-strong, var(--ui-primary-strong, #0b3b64));
  --primary-light: var(--accent-soft, var(--ui-primary-soft, #e8f1fb));
  --primary-glow: color-mix(in srgb, var(--ui-primary, #0f4c81) 20%, transparent);
  --primary-bg: var(--accent-soft, var(--ui-primary-soft, #e8f1fb));
  --success-color: var(--success, #16a34a);
  --success-bg: var(--ui-success-bg, #dcfce7);
  --radius-sm: var(--ui-radius-sm, 8px);
  --radius-md: var(--ui-radius-md, 10px);
  --radius-lg: var(--ui-radius-lg, 12px);
  --radius-full: 9999px;
  --shadow-sm: var(--ui-shadow-sm, 0 1px 2px rgba(15,23,42,0.05));
  --shadow-md: var(--ui-shadow-md, 0 8px 24px rgba(15,23,42,0.09));
  --duration-fast: 0.15s;
  --ease: ease;
}

`;

// Insert the variable definitions before the main POS section
content = content.substring(0, insertionPoint) + varBlock + content.substring(insertionPoint + 1);

fs.writeFileSync(filePath, content, 'utf8');

// Count how many var() references in the POS section now resolve
const posSection = content.substring(content.lastIndexOf('.pos-page'));
const varRefs = posSection.match(/var\(--[a-z-]+\)/g) || [];
console.log(`Total var() references in POS section: ${varRefs.length}`);
console.log(`Unique vars: ${[...new Set(varRefs)].join(', ')}`);
console.log('\nDone. Variable definitions inserted.');
