const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/modules/calendar/components/QuoteModal.jsx');
let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// ─── Fix 1: Stabilize loadState useCallback ───
// Remove quote.code from deps, use functional setState
const oldLoadState = 'const loadState = useCallback(async () => {\r\n    try {\r\n      const data = await loadCrmState();\r\n      setCompanies(data?.companies || []);\r\n      setCatalogServices(data?.services || []);\r\n      setQuickTemplates(data?.quoteServiceTemplates || data?.quickTemplates || []);\r\n      setContractTemplates(Array.isArray(data?.contractTemplates) ? data.contractTemplates : []);\r\n      if (!quote.code) {\r\n        const evs = data?.events || [];\r\n        let maxCOT = 0;\r\n        evs.forEach(ev => {\r\n          if (ev.quote?.code) {\r\n            const m = ev.quote.code.match(/^COT-(\\d+)$/);\r\n            if (m) maxCOT = Math.max(maxCOT, parseInt(m[1], 10));\r\n          }\r\n\r\n        });\r\n        setQuote(prev => ({ ...prev, code: `COT-${String(maxCOT + 1).padStart(3, \'0\')}` }));\r\n      }\r\n    } catch (err) { console.error(\'Error:\', err); }\r\n  }, [quote.code, setQuote]);';

const newLoadState = 'const loadState = useCallback(async () => {\r\n    try {\r\n      const data = await loadCrmState();\r\n      setCompanies(data?.companies || []);\r\n      setCatalogServices(data?.services || []);\r\n      setQuickTemplates(data?.quoteServiceTemplates || data?.quickTemplates || []);\r\n      setContractTemplates(Array.isArray(data?.contractTemplates) ? data.contractTemplates : []);\r\n      setQuote(prev => {\r\n        if (prev.code) return prev;\r\n        const evs = data?.events || [];\r\n        let maxCOT = 0;\r\n        evs.forEach(ev => {\r\n          if (ev.quote?.code) {\r\n            const m = ev.quote.code.match(/^COT-(\\d+)$/);\r\n            if (m) maxCOT = Math.max(maxCOT, parseInt(m[1], 10));\r\n          }\r\n        });\r\n        return { ...prev, code: `COT-${String(maxCOT + 1).padStart(3, \'0\')}` };\r\n      });\r\n    } catch (err) { console.error(\'Error:\', err); }\r\n  }, [setQuote]);';

if (content.includes(oldLoadState)) {
  content = content.replace(oldLoadState, newLoadState);
  changes++;
  console.log('✓ Fix 1: Stabilized loadState useCallback (removed quote.code dep)');
} else {
  console.log('⚠ Fix 1: Could not find exact loadState pattern, trying fuzzy...');
  // Try to find the loadState function and replace it
  const loadStateMatch = content.match(/const loadState = useCallback\(async\s*\(\)\s*=>\s*\{[\s\S]*?\},\s*\[quote\.code,\s*setQuote\]\);/);
  if (loadStateMatch) {
    const replacement = loadStateMatch[0].replace(
      /if \(!quote\.code\) \{[\s\S]*?setQuote\(prev => \(\{\s*\.\.\.prev,\s*code:\s*`COT-\$\{String\(maxCOT \+ 1\)\.padStart\(3, '0'\)\}`\s*\}\)\);\s*\}/,
      `setQuote(prev => {\n        if (prev.code) return prev;\n        const evs = data?.events || [];\n        let maxCOT = 0;\n        evs.forEach(ev => {\n          if (ev.quote?.code) {\n            const m = ev.quote.code.match(/^COT-(\\d+)$/);\n            if (m) maxCOT = Math.max(maxCOT, parseInt(m[1], 10));\n          }\n        });\n        return { ...prev, code: \`COT-\${String(maxCOT + 1).padStart(3, '0')}\` };\n      })`
    ).replace(/\[quote\.code,\s*setQuote\]\);\s*$/, '[setQuote]);');
    content = content.replace(loadStateMatch[0], replacement);
    changes++;
    console.log('✓ Fix 1 (fuzzy): Stabilized loadState useCallback');
  } else {
    console.log('⚠ Fix 1: Could not find loadState at all');
  }
}

// ─── Fix 2: Change mount useEffect to only run once ───
// Change }, [loadState]); to }, []);
const mountEffectClose = '}, [loadState]);\r\n\r\n// ─── Restore draft';
if (content.includes(mountEffectClose)) {
  content = content.replace(mountEffectClose, '}, []);\r\n\r\n// ─── Restore draft');
  changes++;
  console.log('✓ Fix 2: Mount useEffect now runs only once (deps [])');
} else {
  console.log('⚠ Fix 2: Could not find mount useEffect close');
}

// ─── Fix 3: Use api service for formasPago fetch instead of raw fetch ───
// Replace the raw fetch with api.get
const oldFormasFetch = "    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;\r\n    const token = localStorage.getItem('token');\r\n    fetch(`${apiUrl}/api/config/formas-pago`, {\r\n      headers: token ? { Authorization: `Bearer ${token}` } : {}\r\n    })\r\n      .then(r => r.json())\r\n      .then(data => setFormasPago(Array.isArray(data) ? data.filter(fp => fp.activo !== 0) : []))\r\n      .catch(() => {});";

const newFormasFetch = "    api.get('/api/config/formas-pago')\r\n      .then(data => setFormasPago(Array.isArray(data) ? data.filter(fp => fp.activo !== 0) : []))\r\n      .catch(err => {\r\n        console.warn('Error cargando formas de pago:', err);\r\n        // Fallback: intentar una vez más después de 2 segundos\r\n        setTimeout(() => {\r\n          api.get('/api/config/formas-pago')\r\n            .then(data => setFormasPago(Array.isArray(data) ? data.filter(fp => fp.activo !== 0) : []))\r\n            .catch(() => {});\r\n        }, 2000);\r\n      });";

if (content.includes(oldFormasFetch)) {
  content = content.replace(oldFormasFetch, newFormasFetch);
  changes++;
  console.log('✓ Fix 3: Using api service for formasPago (with retry)');
} else {
  console.log('⚠ Fix 3: Could not find old formasPago fetch pattern');
}

// ─── Fix 4: Fix handleSaveQuote duplicate code ───
// The current broken code:
//   lastSavedQuoteRef.current = { ...finalQuote, versions: undefined };
// 
//   if (typeof onSave === 'function') {
//     await onSave(finalQuote, { keepOpen: true });
//   }
//   clearDraft(event); {
//     await onSave(finalQuote, { keepOpen: true });
//   }
//
// Should be:
//   lastSavedQuoteRef.current = { ...finalQuote, versions: undefined };
// 
//   if (typeof onSave === 'function') {
//     await onSave(finalQuote, { keepOpen: true });
//   }
//   clearDraft(event);

const brokenSavePattern = "      lastSavedQuoteRef.current = { ...finalQuote, versions: undefined };\n\n      if (typeof onSave === 'function') {\n        await onSave(finalQuote, { keepOpen: true });\n      }\n      clearDraft(event); {\n        await onSave(finalQuote, { keepOpen: true });\n      }";

const fixedSavePattern = "      lastSavedQuoteRef.current = { ...finalQuote, versions: undefined };\n\n      if (typeof onSave === 'function') {\n        await onSave(finalQuote, { keepOpen: true });\n      }\n      clearDraft(event);";

if (content.includes(brokenSavePattern)) {
  content = content.replace(brokenSavePattern, fixedSavePattern);
  changes++;
  console.log('✓ Fix 4: Fixed duplicate onSave call in handleSaveQuote');
} else {
  console.log('⚠ Fix 4: Could not find broken save pattern, trying alt...');
  // Try with \r\n line endings
  const brokenSavePattern2 = "      lastSavedQuoteRef.current = { ...finalQuote, versions: undefined };\r\n\r\n      if (typeof onSave === 'function') {\r\n        await onSave(finalQuote, { keepOpen: true });\r\n      }\r\n      clearDraft(event); {\r\n        await onSave(finalQuote, { keepOpen: true });\r\n      }";
  const fixedSavePattern2 = "      lastSavedQuoteRef.current = { ...finalQuote, versions: undefined };\r\n\r\n      if (typeof onSave === 'function') {\r\n        await onSave(finalQuote, { keepOpen: true });\r\n      }\r\n      clearDraft(event);";
  if (content.includes(brokenSavePattern2)) {
    content = content.replace(brokenSavePattern2, fixedSavePattern2);
    changes++;
    console.log('✓ Fix 4: Fixed duplicate onSave call in handleSaveQuote');
  } else {
    console.log('⚠ Fix 4: Could not find broken save pattern at all');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✅ Done. ${changes} change(s) applied.`);

if (changes === 0) {
  console.log('No changes were applied. The patterns may have already been fixed or the file structure is different.');
  process.exit(1);
}
