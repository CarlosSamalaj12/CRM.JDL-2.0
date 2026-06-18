const fs = require('fs');
const c = fs.readFileSync('src/modules/reports/ReportsContabilidad.jsx', 'utf8');
const lines = c.split('\n');

// Count occurrences of buildAccountingLedgerEntries
let count = 0;
for(let i = 0; i < lines.length; i++) {
  if(lines[i].includes('buildAccountingLedgerEntries') && lines[i].includes('.map')) {
    count++;
    console.log('=== Occurrence #' + count + ' at line ' + (i+1) + ' ===');
    // Show context: look upwards for a comment or section marker
    for(let j = Math.max(0,i-15); j < Math.min(i+25, lines.length); j++) {
      if(lines[j].includes('Ledger') || lines[j].includes('Movimientos') || lines[j].includes('Expanded') || lines[j].includes('Resumen') || j >= i-2) {
        console.log('L'+(j+1)+': '+JSON.stringify(lines[j]));
      }
    }
    console.log('---');
  }
}
