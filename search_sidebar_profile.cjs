const fs = require('fs');

const content = fs.readFileSync('src/layouts/MainLayout/components/Sidebar.jsx', 'utf8');
const lines = content.split('\n');
console.log('=== search profile code in Sidebar.jsx ===');
lines.forEach((line, i) => {
  if (line.includes('role') || line.includes('profile') || line.includes('avatar') || line.includes('user') || line.includes('Administrador') || line.includes('@')) {
    if (line.includes('class') || line.includes('className') || line.includes('src') || line.includes('style=')) {
      console.log(`Line ${i+1}: ${line.trim()}`);
    }
  }
});
