const fs = require('fs');
const content = fs.readFileSync('src/styles/global.css', 'utf8');
// Eliminar cualquier carácter invisible o BOM
const cleanContent = content.replace(/\r\n/g, '\n').replace(/\uFEFF/g, '');
fs.writeFileSync('src/styles/global.css', cleanContent, 'utf8');
console.log('global.css cleaned and rewritten as UTF-8.');
