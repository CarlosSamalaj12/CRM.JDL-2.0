const fs = require('fs');

const content = fs.readFileSync('src/layouts/MainLayout/components/Sidebar.jsx', 'utf8');
const lines = content.split('\n');
console.log('=== lines 1125-1200 ===');
for (let i = 1125; i < 1200; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
