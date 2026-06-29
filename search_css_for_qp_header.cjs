const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath, query);
    } else if (file.endsWith('.css') || file.endsWith('.scss')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(query)) {
        console.log(`Found in: ${fullPath}`);
        // print matching lines
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (line.includes(query)) {
            console.log(`  Line ${i+1}: ${line.trim()}`);
          }
        });
      }
    }
  });
}

console.log('=== search for qp-header in css/scss ===');
searchDir('src', 'qp-header');
