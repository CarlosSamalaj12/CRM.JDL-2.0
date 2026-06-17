const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/kevin/Documents/WEB25/CRM.migrate/react/Informes Eventos orgn/frontend/src';
const destDir = 'c:/Users/kevin/Documents/WEB25/CRM.migrate/react/CRM.JDL/src/modules/informes';

function getFiles(dir, base = '') {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (file === 'node_modules' || file === '.git') return;
    
    const filePath = path.join(dir, file);
    const relativePath = base ? path.join(base, file) : file;
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath, relativePath));
    } else {
      results.push({
        relativePath,
        absolutePath: filePath,
        size: stat.size
      });
    }
  });
  return results;
}

try {
  const srcFiles = getFiles(srcDir);
  const destFiles = getFiles(destDir);
  
  console.log(`Source files count: ${srcFiles.length}`);
  console.log(`Dest files count: ${destFiles.length}`);
  
  const destMap = new Map(destFiles.map(f => [f.relativePath, f]));
  
  console.log('\n--- Differences analysis ---');
  let hasDiff = false;
  
  for (const srcFile of srcFiles) {
    if (srcFile.relativePath === 'App.jsx' || srcFile.relativePath === 'main.jsx') {
      continue;
    }
    
    const destFile = destMap.get(srcFile.relativePath);
    
    if (!destFile) {
      console.log(`[MISSING IN DEST]: ${srcFile.relativePath}`);
      hasDiff = true;
    } else if (srcFile.size !== destFile.size) {
      console.log(`[SIZE MISMATCH]: ${srcFile.relativePath} (Source: ${srcFile.size} B vs Dest: ${destFile.size} B)`);
      
      const srcText = fs.readFileSync(srcFile.absolutePath, 'utf8').replace(/\r\n/g, '\n');
      const destText = fs.readFileSync(destFile.absolutePath, 'utf8').replace(/\r\n/g, '\n');
      
      if (srcText !== destText) {
        console.log(`  -> CONTENT DIFFERS!`);
        hasDiff = true;
      } else {
        console.log(`  -> Content is identical (only CRLF difference)`);
      }
    }
  }
  
  for (const destFile of destFiles) {
    if (destFile.relativePath === 'components/ReportsLayout.jsx' || destFile.relativePath === 'styles.scss') {
      continue;
    }
    const srcFile = srcFiles.find(f => f.relativePath === destFile.relativePath);
    if (!srcFile) {
      console.log(`[EXTRA IN DEST]: ${destFile.relativePath}`);
      hasDiff = true;
    }
  }
  
  if (!hasDiff) {
    console.log('No significant differences found in modular files!');
  }
} catch (err) {
  console.error('Error during comparison:', err);
}
