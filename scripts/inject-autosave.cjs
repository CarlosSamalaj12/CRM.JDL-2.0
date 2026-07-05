const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/modules/calendar/components/QuoteModal.jsx');
let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// 1. Add import for useAutoSave, loadDraft, clearDraft
const importLine = "import { useAutoSave, loadDraft, clearDraft } from '../../../hooks/useAutoSave';";
if (!content.includes('useAutoSave')) {
  content = content.replace(
    "import socketService from '../../../services/socketService';",
    "import socketService from '../../../services/socketService';\n" + importLine
  );
  changes++;
  console.log('✓ Added import');
}

// 2. Add useAutoSave hook call after the quote snapshot ref
const autoSaveCall = "\n  // ─── Auto-save draft to localStorage ───\n  useAutoSave(event, quote);\n";
if (!content.includes('useAutoSave(event')) {
  content = content.replace(
    'const savedQuoteSnapshotRef = useRef(quoteSnapshot(quote));',
    'const savedQuoteSnapshotRef = useRef(quoteSnapshot(quote));' + autoSaveCall
  );
  changes++;
  console.log('✓ Added useAutoSave hook call');
}

// 3. Add restore-on-mount effect after the mount useEffect cleanup
const restoreEffect = `
  // ─── Restore draft from localStorage on mount ───
  useEffect(() => {
    const draft = loadDraft(event);
    if (draft && draft.items && draft.items.length > 0) {
      const timer = setTimeout(() => {
        const restored = {
          ...quote,
          ...draft,
          items: draft.items.map(item => ({
            ...item,
            rowId: item.rowId || 'row_' + Math.random().toString(36).substr(2, 8)
          }))
        };
        setQuote(restored);
        savedQuoteSnapshotRef.current = JSON.stringify(restored);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);
`;

if (!content.includes('loadDraft(event)')) {
  content = content.replace(
    "return () => document.body.classList.remove('quoteModeOpen');",
    "return () => document.body.classList.remove('quoteModeOpen');" + restoreEffect
  );
  changes++;
  console.log('✓ Added restore-on-mount effect');
}

// 4. Add clearDraft after successful save in handleSaveQuote
if (!content.includes('clearDraft(event)')) {
  content = content.replace(
    "savedQuoteSnapshotRef.current = quoteSnapshot(finalQuote);\n      lastSavedQuoteRef.current = { ...finalQuote, versions: undefined };\n\n      if (typeof onSave === 'function'",
    "savedQuoteSnapshotRef.current = quoteSnapshot(finalQuote);\n      lastSavedQuoteRef.current = { ...finalQuote, versions: undefined };\n      clearDraft(event);\n\n      if (typeof onSave === 'function'"
  );
  changes++;
  console.log('✓ Added clearDraft after save');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone. ${changes} change(s) applied.`);
