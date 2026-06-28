/**
 * Fix QuoteModal.jsx - replace hardcoded template options with dynamic ones.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(process.argv[2] || 'src/modules/calendar/components/QuoteModal.jsx');
let content = fs.readFileSync(filePath, 'utf8');

let changed = 0;

// 1. Replace the default templateId from 'contrato_corp' to ''
const defaultPattern = `templateId: event?.quote?.templateId || 'contrato_corp'`;
if (content.includes(defaultPattern)) {
  content = content.replace(defaultPattern, `templateId: event?.quote?.templateId || ''`);
  console.log('✓ Changed default templateId to empty string');
  changed++;
}

// 2. Replace the main template selector (Plantilla contrato section)
const mainSelectorSingle = `                <option value="contrato_corp">Jardines (Corporativo)</option>
                <option value="contrato_hosp">Servicios de Hospitalidad</option>`;
const mainSelectorDynamic = `                {contractTemplates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))}`;

if (content.includes(mainSelectorSingle)) {
  content = content.replace(mainSelectorSingle, mainSelectorDynamic);
  console.log('✓ Replaced main template selector options');
  changed++;
} else {
  console.log('✗ Main selector pattern not found, trying alternative...');
  // Try with more whitespace tolerance
  const altPattern = /<option value="contrato_corp">Jardines \(Corporativo\)<\/option>\s*\n\s*<option value="contrato_hosp">Servicios de Hospitalidad<\/option>/;
  if (altPattern.test(content)) {
    content = content.replace(altPattern, `{contractTemplates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))}`);
    console.log('✓ Replaced main template selector options (alt)');
    changed++;
  }
}

// 3. Replace the "Aplicar plantilla" section selector
// This one just has "-- Seleccionar --" option and then the hardcoded ones
const aplicarSelectorSingle = `                  <option value="">— Seleccionar —</option>
                  <option value="contrato_corp">Jardines (Corporativo)</option>
                  <option value="contrato_hosp">Servicios de Hospitalidad</option>
                </select>`;
const aplicarSelectorDynamic = `                  <option value="">— Seleccionar —</option>
                  {contractTemplates.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </select>`;

if (content.includes(aplicarSelectorSingle)) {
  content = content.replace(aplicarSelectorSingle, aplicarSelectorDynamic);
  console.log('✓ Replaced "Aplicar plantilla" selector options');
  changed++;
} else {
  console.log('✗ Aplicar selector pattern not found');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✅ Applied ${changed} change(s) to QuoteModal.jsx`);
