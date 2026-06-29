const fs = require('fs');
const path = require('path');

const puPath = path.resolve(__dirname, '..', 'src/utils/printUtils.js');
let pu = fs.readFileSync(puPath, 'utf8');

// Fix: replace the broken ".join(" + newline + ")" with proper ".join("\\n")"
const brokenPattern = '.join("\n")';
const fixedStr = '.join("\\n")';

if (pu.includes(brokenPattern)) {
  pu = pu.replace(brokenPattern, fixedStr);
  fs.writeFileSync(puPath, pu, 'utf8');
  console.log('✅ Fixed broken .join("") - replaced literal newline with \\\\n');
} else {
  // Try CRLF variant
  const brokenCrlf = '.join("\r\n")';
  if (pu.includes(brokenCrlf)) {
    pu = pu.replace(brokenCrlf, fixedStr);
    fs.writeFileSync(puPath, pu, 'utf8');
    console.log('✅ Fixed CRLF variant of broken .join()');
  } else {
    console.log('❌ Could not find broken .join() pattern');
    // Show context around line 252
    const lines = pu.split('\n');
    for (let i = 248; i <= 256 && i < lines.length; i++) {
      console.log(`Line ${i+1}:`, JSON.stringify(lines[i]));
    }
  }
}
