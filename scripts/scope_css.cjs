const fs = require('fs');

const cssPath = 'c:/Users/kevin/Documents/WEB25/CRM.migrate/react/Informes Eventos orgn/frontend/src/styles.css';
const scssPath = 'c:/Users/kevin/Documents/WEB25/CRM.migrate/react/CRM.JDL/src/modules/informes/styles.scss';

try {
  let css = fs.readFileSync(cssPath, 'utf8');

  // 1. Extract imports
  const importRegex = /@import\s+url\([^)]+\);?/g;
  let imports = [];
  let match;
  while ((match = importRegex.exec(css)) !== null) {
    imports.push(match[0]);
  }
  let cssWithoutImports = css.replace(importRegex, '');

  // 2. Parse blocks
  let blocks = [];
  let braceCount = 0;
  let currentBlock = '';
  let currentSelector = '';
  
  for (let i = 0; i < cssWithoutImports.length; i++) {
    const char = cssWithoutImports[i];
    
    if (char === '{' && braceCount === 0) {
      currentSelector = currentBlock.trim();
      currentBlock = '';
      braceCount++;
    } else if (char === '{') {
      braceCount++;
      currentBlock += char;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0) {
        blocks.push({
          selector: currentSelector,
          content: currentBlock.trim()
        });
        currentBlock = '';
        currentSelector = '';
      } else {
        currentBlock += char;
      }
    } else {
      currentBlock += char;
    }
  }

  let lightVars = '';
  let darkVars = '';
  let baseBody = '';
  let darkClassOverrides = '';
  let globals = '';
  let restScss = '';

  for (const block of blocks) {
    let rawSel = block.selector.trim();
    // Clean comments from selector
    let sel = rawSel.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    let content = block.content.trim();

    // Extract any @page blocks from the content
    if (content.includes('@page')) {
      const pageRegex = /@page\s*\{[^}]+\}/g;
      let pageMatch;
      while ((pageMatch = pageRegex.exec(content)) !== null) {
        if (sel.startsWith('@media')) {
          globals += `${sel} {\n  ${pageMatch[0]}\n}\n\n`;
        } else {
          globals += `${pageMatch[0]}\n\n`;
        }
      }
      content = content.replace(pageRegex, '').trim();
    }

    if (sel === ':root') {
      lightVars += content + '\n';
    } else if (sel === '[data-theme="dark"]') {
      darkVars += content + '\n';
    } else if (sel === '[data-theme="dark"] body' || sel === 'body [data-theme="dark"]') {
      darkVars += content + '\n';
    } else if (sel.startsWith('[data-theme="dark"]')) {
      let subSel = sel.replace('[data-theme="dark"]', '').trim();
      darkClassOverrides += `  ${subSel} {\n    ${content.replace(/\n/g, '\n    ')}\n  }\n`;
    } else if (sel === 'body') {
      baseBody += content + '\n';
    } else if (sel.startsWith('@page') || sel.startsWith('@keyframes')) {
      globals += `${rawSel} {\n  ${content.replace(/\n/g, '\n  ')}\n}\n\n`;
    } else {
      let finalSel = rawSel;
      if (sel === 'html' || sel === 'html, body' || sel === 'body, html') {
        finalSel = '.reports-root';
      }
      restScss += `${finalSel} {\n  ${content.replace(/\n/g, '\n  ')}\n}\n\n`;
    }
  }

  let finalScss = `/* Scoped stylesheet for CRM Reports Module */
${imports.join('\n')}

${globals}

/* ==========================================================================
   GLOBAL THEME VARIABLE INJECTION & BODY RESETS (To override CRM !important rules)
   ========================================================================== */
.informes-theme-root {
  ${lightVars.replace(/\n/g, '\n  ')}
}

[data-theme="dark"].informes-theme-root {
  ${darkVars.replace(/\n/g, '\n  ')}
}

body.informes-theme {
  font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
  background-color: var(--bg-app) !important;
  background-image:
    radial-gradient(ellipse at 20% 50%, rgba(99, 102, 241, 0.04) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(16, 185, 129, 0.03) 0%, transparent 50%) !important;
  color: var(--text-main) !important;
}

[data-theme="dark"] body.informes-theme {
  background-color: var(--bg-app) !important;
  background-image: none !important;
  color: var(--text-main) !important;
}

/* ==========================================================================
   DESIGN SYSTEM & VARIABLES (Light Theme & Base Styles Backup)
   ========================================================================== */
.reports-root {
  ${lightVars.replace(/\n/g, '\n  ')}
  
  /* Base Body Styles */
  ${baseBody.replace(/\n/g, '\n  ')}
}

/* ==========================================================================
   DESIGN SYSTEM & VARIABLES (Dark Theme Backup)
   ========================================================================== */
[data-theme="dark"] .reports-root {
  ${darkVars.replace(/\n/g, '\n  ')}
}

/* ==========================================================================
   DARK THEME CLASS OVERRIDES
   ========================================================================== */
[data-theme="dark"] .reports-root {
${darkClassOverrides}
}

/* ==========================================================================
   SCOPED STYLES & COMPONENTS
   ========================================================================== */
.reports-root {
  ${restScss.replace(/\n/g, '\n  ')}
}
`;

  fs.writeFileSync(scssPath, finalScss, 'utf8');
  console.log('Successfully completed scoped CSS conversion with root variables and body resets mapped!');
} catch (err) {
  console.error('Error during CSS scoping conversion:', err);
}
