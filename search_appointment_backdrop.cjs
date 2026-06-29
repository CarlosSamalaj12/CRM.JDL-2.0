const fs = require('fs');

const content = fs.readFileSync('src/modules/calendar/Calendar.jsx', 'utf8');
const lines = content.split('\n');
console.log('=== search AppointmentModal in Calendar.jsx ===');
lines.forEach((line, i) => {
  if (line.includes('AppointmentModal')) {
    console.log(`Line ${i+1}: ${line.trim()}`);
    // print 5 lines before and after
    for (let j = Math.max(0, i-5); j < Math.min(lines.length, i+10); j++) {
      console.log(`  ${j+1}: ${lines[j]}`);
    }
  }
});
