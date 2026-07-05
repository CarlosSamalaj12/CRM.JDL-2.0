const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/modules/calendar/components/QuoteModal.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const markerRestore = "// ─── Restore draft from localStorage on mount ───";
const markerLoadDiscount = "  // Load discount auth";
const returnStmt = "return () => document.body.classList.remove('quoteModeOpen');";

const restoreIdx = content.indexOf(markerRestore);
const loadDiscIdx = content.indexOf(markerLoadDiscount);
const returnIdx = content.lastIndexOf(returnStmt, restoreIdx);

if (restoreIdx === -1 || loadDiscIdx === -1 || returnIdx === -1) {
  console.error('Markers not found');
  process.exit(1);
}

// Find the end of the restore useEffect block.
// It ends with "  }, []);" (or similar) followed by "  }, [loadState]);"
// Since the restore was injected inside the mount useEffect, we need to find
// the ", [loadState]);" that closes the mount useEffect. It should be
// between the restore block end and the "// Load discount auth" marker.

const section = content.substring(restoreIdx, loadDiscIdx);
// The restore useEffect ends with }, []); (possibly with \r\n)
// Then the mount useEffect closes with }, [loadState]); 

// Find the closing }, []); of restore useEffect
const restoreCloseMatch = section.match(/},\s*\[\]\);/);
if (!restoreCloseMatch) {
  console.error('Could not find restore useEffect closing');
  process.exit(1);
}

const restoreCloseIdx = restoreIdx + restoreCloseMatch.index + restoreCloseMatch[0].length;

// Now find the }, [loadState]); that comes after restoreCloseIdx
const afterRestore = content.substring(restoreCloseIdx);
const loadStateCloseMatch = afterRestore.match(/},\s*\[loadState\]\);/);
if (!loadStateCloseMatch) {
  console.error('Could not find loadState closing');
  process.exit(1);
}

const loadStateCloseIdx = restoreCloseIdx + loadStateCloseMatch.index + loadStateCloseMatch[0].length;

// Extract parts:
// 1. Before and including the return statement
const beforeReturn = content.substring(0, returnIdx + returnStmt.length);
// 2. The mount useEffect closing (}, [loadState]);)
const mountClose = content.substring(
  content.lastIndexOf("},", loadStateCloseIdx), 
  loadStateCloseIdx
);
// 3. The restore useEffect block (everything from markerRestore to restoreCloseIdx)
const restoreBlock = content.substring(restoreIdx, restoreCloseIdx);
// 4. After the mount useEffect close
const afterMountClose = content.substring(loadStateCloseIdx);

// Reconstruct: before + mountClose + restoreBlock + after
const fixedContent = beforeReturn + '\r\n' + mountClose + '\r\n\r\n' + restoreBlock + afterMountClose;

// Quick sanity: count useEffects and their closings
const useEffects = fixedContent.match(/useEffect\(/g);
const closings = fixedContent.match(/},\s*\[.*?\]\);/g);
console.log(`useEffect calls: ${useEffects?.length || 0}`);
console.log(`useEffect closings: ${closings?.length || 0}`);

fs.writeFileSync(filePath, fixedContent, 'utf8');
console.log('✓ Done');
