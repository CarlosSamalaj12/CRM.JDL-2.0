const fs = require('fs');

const content = fs.readFileSync('src/modules/calendar/components/AppointmentModal.jsx', 'utf8');
const lines = content.split('\n');
console.log('=== search AppointmentModal.jsx ===');
lines.forEach((line, i) => {
  if (line.includes('Citas') || line.includes('Recordatorios') || line.includes('programadas') || line.includes('Agregar Nueva Cita') || line.includes('Agregar nueva cita')) {
    console.log(`Line ${i+1}: ${line.trim()}`);
  }
});
