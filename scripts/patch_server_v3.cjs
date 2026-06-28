/**
 * Patch server.cjs with contractTemplates using line-based insertion.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'server.cjs'));
const lines = fs.readFileSync(filePath, 'utf8').split('\n');

let applied = [];

// Fix broken newlines from earlier PowerShell attempt
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('quickTemplates: [],n') || lines[i].includes('quoteServiceTemplates: [],n') || lines[i].includes('contractTemplates: [],n')) {
    lines[i] = lines[i].replace(/,\\s*n\\s*/, ',\n');
    console.log(`Fixed broken newline at line ${i + 1}`);
  }
}

// 1. SQL query - already applied, check
let sqlQueryFixed = lines.some(l => l.includes("'contractTemplates','disabledCompanies'"));
console.log(`SQL query: ${sqlQueryFixed ? '✓ already applied' : '✗ NOT applied'}`);
if (!sqlQueryFixed) applied.push('SQL query missing');

// 2. Default state - check
let defaultStateFixed = lines.some(l => l.trim() === 'contractTemplates: [],');
console.log(`Default state: ${defaultStateFixed ? '✓ already applied' : '✗ NOT applied'}`);
if (!defaultStateFixed) applied.push('Default state missing');

// 3. contractTemplatesRow finder - check
let finderFixed = lines.some(l => l.includes('contractTemplatesRow = appStateRows'));
console.log(`Row finder: ${finderFixed ? '✓ already applied' : '✗ NOT applied'}`);
if (!finderFixed) applied.push('Row finder missing');

// 4. Add contractTemplates parsing after quoteServiceTemplates parsing
let parsingFixed = lines.some(l => l.includes('state.contractTemplates = Array.isArray(parsed)'));
if (!parsingFixed) {
  // Find the closing brace of quoteServiceTemplates parsing block
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('if (quoteServiceTemplatesRow?.valor_json)')) {
      // Find the closing brace after this block
      let braceDepth = 1;
      let startIdx = i;
      // Count braces from this line
      let j = i;
      while (j < lines.length && braceDepth > 0) {
        braceDepth += (lines[j].match(/{/g) || []).length;
        braceDepth -= (lines[j].match(/}/g) || []).length;
        if (braceDepth <= 0) break;
        j++;
      }
      // Now j is at the closing brace line
      const indent = lines[j].substring(0, lines[j].length - lines[j].trimStart().length);
      const newLines = [
        `${indent}if (contractTemplatesRow?.valor_json) {`,
        `${indent}  try {`,
        `${indent}    const parsed = JSON.parse(contractTemplatesRow.valor_json);`,
        `${indent}    state.contractTemplates = Array.isArray(parsed) ? parsed : [];`,
        `${indent}  } catch (_) {`,
        `${indent}    state.contractTemplates = [];`,
        `${indent}  }`,
        `${indent}}`,
      ];
      lines.splice(j + 1, 0, ...newLines);
      console.log(`✓ Applied parsing block after line ${j + 1}`);
      parsingFixed = true;
      break;
    }
  }
}
if (parsingFixed) console.log('Parsing: ✓ already applied');
else console.log('Parsing: ✗ could not apply');
if (!parsingFixed) applied.push('Parsing block missing');

// 5. Add contractTemplates const in writeStateToTables
let constFixed = lines.some(l => l.includes('const contractTemplates = Array.isArray(state.contractTemplates)'));
if (!constFixed) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const quoteServiceTemplates = Array.isArray(state.quoteServiceTemplates)')) {
      const indent = lines[i].substring(0, lines[i].length - lines[i].trimStart().length);
      lines.splice(i + 1, 0, `${indent}const contractTemplates = Array.isArray(state.contractTemplates) ? state.contractTemplates : [];`);
      console.log(`✓ Applied const after line ${i + 1}`);
      constFixed = true;
      break;
    }
  }
}
if (constFixed) console.log('Write const: ✓ already applied');
else console.log('Write const: ✗ could not apply');
if (!constFixed) applied.push('Write const missing');

// 6. Add INSERT for contractTemplates
let insertFixed = lines.some(l => l.includes("VALUES ('contractTemplates', ?)"));
if (!insertFixed) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("VALUES ('quoteServiceTemplates', ?)")) {
      // Find the closing of this INSERT block
      // Look for the line with `[JSON.stringify(quoteServiceTemplates)]` followed by `);`
      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        if (lines[j].includes('JSON.stringify(quoteServiceTemplates)')) {
          // The next line should be `    );`
          // We need to insert after that line
          let insertAfter = j + 1;
          if (insertAfter < lines.length && lines[insertAfter].trim() === ');') {
            insertAfter++;
          }
          const indent = lines[j].substring(0, lines[j].length - lines[j].trimStart().length);
          const newLines = [
            `${indent}await conn.query(`,
            `${indent}  \``,
            `${indent}    INSERT INTO app_state_kv (clave, valor_json)`,
            `${indent}    VALUES ('contractTemplates', ?)`,
            `${indent}    ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)`,
            `${indent}  \`,`,
            `${indent}  [JSON.stringify(contractTemplates)]`,
            `${indent});`,
          ];
          lines.splice(insertAfter, 0, ...newLines);
          console.log(`✓ Applied INSERT after line ${insertAfter}`);
          insertFixed = true;
          break;
        }
      }
      if (insertFixed) break;
    }
  }
}
if (insertFixed) console.log('INSERT: ✓ already applied');
else console.log('INSERT: ✗ could not apply');
if (!insertFixed) applied.push('INSERT missing');

// Write back
fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

if (applied.length === 0) {
  console.log('\n✅ All 6 changes applied successfully!');
} else {
  console.log(`\n⚠️ ${applied.length} issue(s): ${applied.join(', ')}`);
}
