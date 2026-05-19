const fs = require('fs');

try {
  const css = fs.readFileSync('src/styles/global.css', 'utf8');
  let openBraces = 0;
  let line = 1;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '\n') line++;
    if (css[i] === '{') openBraces++;
    if (css[i] === '}') openBraces--;
    
    if (openBraces < 0) {
      console.error(`Syntax Error: Unexpected '}' at line ${line}`);
      process.exit(1);
    }
  }
  if (openBraces > 0) {
    console.error(`Syntax Error: Unclosed '{' (found ${openBraces} missing '}')`);
    process.exit(1);
  }
  console.log('CSS basic brace structure is valid.');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
