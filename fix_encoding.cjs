const fs = require('fs');

const file = 'src/modules/reports/ReportsContabilidad.jsx';
let content = fs.readFileSync(file, 'utf8');

const map = {
  'Ã¡': 'á',
  'Ã©': 'é',
  'Ã­': 'í',
  'Ã³': 'ó',
  'Ãº': 'ú',
  'Ã±': 'ñ',
  'Ã ': 'Á',
  'Ã‰': 'É',
  'Ã“': 'Ó',
  'Ãš': 'Ú',
  'Ã‘': 'Ñ',
  'Â¿': '¿',
  'Â¡': '¡',
  'Ã¼': 'ü',
  'Ã—': '×'
};

// also handle \xad logic if any
for (const k in map) {
  content = content.split(k).join(map[k]);
}
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed ReportsContabilidad.jsx');
