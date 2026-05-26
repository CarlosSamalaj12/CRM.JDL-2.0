const fs = require('fs');
const file = 'src/modules/reports/ReportsContabilidad.jsx';
let content = fs.readFileSync(file, 'utf8');

const map = {
  'Ã¡': 'á',
  'Ã©': 'é',
  'Ã\xad': 'í',
  'Ã­': 'í',
  'Ã³': 'ó',
  'Ãº': 'ú',
  'Ã±': 'ñ',
  'Ã\x81': 'Á',
  'Ã\x89': 'É',
  'Ã\x8d': 'Í',
  'Ã\x93': 'Ó',
  'Ã\x9a': 'Ú',
  'Ã\x91': 'Ñ',
  'Ãš': 'Ú',
  'dÃa': 'día',
  'gestiÃ³n': 'gestión',
  'acciÃ³n': 'acción',
  'instituciÃ³n': 'institución',
  'SalÃ³n': 'Salón',
  'crÃ©dito': 'crédito',
  'depÃ³sito': 'depósito',
  'VisiÃ³n': 'Visión',
  'cotizaciÃ³n': 'cotización',
  'al dÃa': 'al día',
  'Ãšltimo': 'Último'
};

for (const [bad, good] of Object.entries(map)) {
  content = content.split(bad).join(good);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Encoding fixed.');
