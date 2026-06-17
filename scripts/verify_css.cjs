const fs = require('fs');
const c = fs.readFileSync('src/modules/informes/styles.css', 'utf8');

// Find responsive overrides at the bottom
const mediaIdxs = [];
let idx = -1;
while ((idx = c.indexOf('@media', idx + 1)) !== -1) mediaIdxs.push(idx);

console.log('Total @media blocks:', mediaIdxs.length);

// Show the last @media block
if (mediaIdxs.length > 0) {
  const last = mediaIdxs[mediaIdxs.length - 1];
  const end = Math.min(last + 600, c.length);
  console.log('\n=== Last @media block ===');
  console.log(c.substring(last, end));
}

// Find responsive overrides in the FIRST section (may be duplicate)
if (mediaIdxs.length > 1) {
  const first = mediaIdxs[0];
  const end = Math.min(first + 400, c.length);
  console.log('\n=== First @media block (may be in old duplicate section) ===');
  console.log(c.substring(first, end));
}

// Check CSS variables used in pos-* section
const posSection = c.substring(c.lastIndexOf('.pos-page'));
const usedVars = new Set();
const varRegex = /var\(--([a-z-]+)\)/g;
let m;
while ((m = varRegex.exec(posSection)) !== null) usedVars.add(m[1]);
console.log('\n=== CSS custom properties used in POS section ===');
console.log([...usedVars].sort().join('\n'));

// Check if they exist in design-system.css
try {
  const ds = fs.readFileSync('src/styles/design-system.css', 'utf8');
  const definedVars = new Set();
  const defRegex = /--([a-z-]+)\s*:/g;
  let d;
  while ((d = defRegex.exec(ds)) !== null) definedVars.add(d[1]);
  
  const missing = [...usedVars].filter(v => !definedVars.has(v));
  if (missing.length > 0) {
    console.log('\n=== ⚠️ Variables NOT found in design-system.css ===');
    console.log(missing.join('\n'));
  } else {
    console.log('\n✅ All CSS variables are defined in design-system.css');
  }
} catch(e) {
  console.log('\n⚠️ Could not read design-system.css:', e.message);
  console.log('Checking global.css instead...');
  try {
    const gc = fs.readFileSync('src/styles/global.css', 'utf8');
    const definedVars = new Set();
    const defRegex = /--([a-z-]+)\s*:/g;
    let d;
    while ((d = defRegex.exec(gc)) !== null) definedVars.add(d[1]);
    
    const missing = [...usedVars].filter(v => !definedVars.has(v));
    if (missing.length > 0) {
      console.log('⚠️ Variables NOT found in global.css:');
      console.log(missing.join('\n'));
    } else {
      console.log('✅ All CSS variables are defined in global.css');
    }
  } catch(e2) {
    console.log('⚠️ Could not read global.css either:', e2.message);
  }
}

// Check if pos-body-3col grid children need min-width: 0
if (c.includes('min-width: 0')) {
  console.log('\n✅ min-width: 0 found in CSS (helps prevent grid overflow)');
} else {
  console.log('\n⚠️ min-width: 0 NOT found in CSS - grid items may overflow and cause overlapping');
}
