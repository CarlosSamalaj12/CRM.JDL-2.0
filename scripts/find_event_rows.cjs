const fs = require('fs');
const c = fs.readFileSync('src/modules/reports/ReportsContabilidad.jsx', 'utf8');
const lines = c.split('\n');

// Find the event rows inside expanded details
for(let i = 0; i < lines.length; i++) {
  if(lines[i].includes('acc.rows.map') && lines[i].includes('idx')) {
    console.log('=== Event rows start (acc.rows.map) ===');
    for(let j = Math.max(0,i-2); j < Math.min(i+50, lines.length); j++) {
      console.log('L'+(j+1)+': '+JSON.stringify(lines[j]));
    }
    break;
  }
}
