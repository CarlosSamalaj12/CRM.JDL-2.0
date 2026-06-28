/**
 * Patch QuoteModal.jsx to use dynamic contract templates from state.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(process.argv[2] || 'src/modules/calendar/components/QuoteModal.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add contractTemplates state variable after quickTemplates state
content = content.replace(
  'const [quickTemplates, setQuickTemplates] = useState([]);',
  'const [quickTemplates, setQuickTemplates] = useState([]);\n  const [contractTemplates, setContractTemplates] = useState([]);'
);

// 2. Load contractTemplates in loadState
content = content.replace(
  "setQuickTemplates(data?.quoteServiceTemplates || data?.quickTemplates || []);",
  "setQuickTemplates(data?.quoteServiceTemplates || data?.quickTemplates || []);\n      setContractTemplates(Array.isArray(data?.contractTemplates) ? data.contractTemplates : []);"
);

// 3. Replace hardcoded template options in the main selector (line ~3383-3386)
content = content.replace(
  `                <option value="">— Sin plantilla —</option>
                <option value="contrato_corp">Jardines (Corporativo)</option>
                <option value="contrato_hosp">Servicios de Hospitalidad</option>`,
  `                <option value="">— Sin plantilla —</option>
                {contractTemplates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))}`
);

// 4. Replace hardcoded template options in the "Aplicar plantilla" section (line ~3819-3820)
content = content.replace(
  `                  <option value="">— Seleccionar —</option>
                </select>`,
  `                  <option value="">— Seleccionar —</option>
                  {contractTemplates.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </select>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Patched QuoteModal.jsx successfully');
