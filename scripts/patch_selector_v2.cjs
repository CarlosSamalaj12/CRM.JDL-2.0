const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'src/modules/calendar/components/QuoteModal.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldStr = `{contractTemplates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))}`;

const newStr = `{contractTemplates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.filename})</option>
                ))}`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Replaced: now showing filename in parentheses after template name');
} else {
  console.log('❌ Pattern not found — checking actual content...');
  const idx = content.indexOf('contractTemplates.map');
  if (idx >= 0) {
    console.log('Found contractTemplates.map at position', idx);
    console.log('Context:', content.substring(idx, idx + 150));
  } else {
    console.log('contractTemplates.map not found either');
    // Try searching around
    const idx2 = content.indexOf('Plantilla contrato');
    if (idx2 >= 0) {
      console.log('Found "Plantilla contrato" at position', idx2);
      console.log('Context:', content.substring(idx2, idx2 + 300));
    }
  }
}
