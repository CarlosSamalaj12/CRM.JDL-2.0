const fs = require('fs');
let filePath = 'src/modules/reports/ReportsContabilidad.jsx';
let c = fs.readFileSync(filePath, 'utf8');
let modified = c;

function replaceSafe(str, search, replacement, label) {
  let result = str.replace(search, replacement);
  if (result !== str) {
    console.log('✅ ' + label);
    return result;
  }
  let searchCRLF = search.replace(/\n/g, '\r\n');
  let replacementCRLF = replacement.replace(/\n/g, '\r\n');
  result = str.replace(searchCRLF, replacementCRLF);
  if (result !== str) {
    console.log('✅ ' + label + ' (CRLF)');
    return result;
  }
  console.log('FAILED: ' + label);
  console.log('First 100 chars: ' + JSON.stringify(search.substring(0, 100)));
  process.exit(1);
}

// 1. Add states after the event tooltip states
let r1 = replaceSafe(modified,
  "  const [hoveredEventData, setHoveredEventData] = useState(null);\n\n  const fetchHistorial",
  "  const [hoveredEventData, setHoveredEventData] = useState(null);\n  const [hoveredLedgerPos, setHoveredLedgerPos] = useState(null);\n  const [hoveredLedgerData, setHoveredLedgerData] = useState(null);\n\n  const fetchHistorial",
  'r1: Ledger tooltip states'
);
modified = r1;

// 2. Replace the ledger row concept td with mouse handlers (inside Statement Modal)
// This is the second occurrence of buildAccountingLedgerEntries (inside modal)
let ledgerConceptSearch =
  "<td style={{ padding: '8px 12px', color: '#475569', fontSize: '10px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.concept}</td>\n" +
  "                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: entry.debit > 0 ? 800 : 400, color: entry.debit > 0 ? '#dc2626' : '#cbd5e1' }}>{entry.debit > 0 ? formatMoney(entry.debit) : '-'}</td>";

let ledgerConceptReplace =
  "<td\n" +
  "                              style={{ padding: '8px 12px', color: '#475569', fontSize: '10px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}\n" +
  "                              onMouseEnter={e => {\n" +
  "                                const rect = e.currentTarget.getBoundingClientRect();\n" +
  "                                setHoveredLedgerPos({ x: rect.left + rect.width / 2, y: rect.top });\n" +
  "                                setHoveredLedgerData(entry);\n" +
  "                              }}\n" +
  "                              onMouseLeave={() => {\n" +
  "                                setHoveredLedgerPos(null);\n" +
  "                                setHoveredLedgerData(null);\n" +
  "                              }}\n" +
  "                            >{entry.concept}</td>\n" +
  "                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: entry.debit > 0 ? 800 : 400, color: entry.debit > 0 ? '#dc2626' : '#cbd5e1' }}>{entry.debit > 0 ? formatMoney(entry.debit) : '-'}</td>";

let r2 = replaceSafe(modified, ledgerConceptSearch, ledgerConceptReplace, 'r2: Ledger concept td');
modified = r2;

// 3. Add third tooltip before the Statement Modal (after the event tooltip)
let existingEventTooltipEnd =
  "      })()}\n\n" +
  "      {/* ── Statement Modal premium ── */}";

let ledgerTooltipBlock =
  "      })()}\n\n" +
  "      {/* ── Premium Tooltip Ledger (fixed) ── */}\n" +
  "      {hoveredLedgerPos && hoveredLedgerData && (() => {\n" +
  "        const tooltipWidth = 340;\n" +
  "        const left = Math.min(hoveredLedgerPos.x, window.innerWidth - tooltipWidth - 10);\n" +
  "        const top = Math.max(10, hoveredLedgerPos.y - 10);\n" +
  "        const ed = hoveredLedgerData;\n" +
  "        const balanceType = ed.runningBalance > 0 ? 'Deudor' : ed.runningBalance < 0 ? 'Acreedor' : 'Saldado';\n" +
  "        const balanceColor = ed.runningBalance > 0 ? '#f87171' : ed.runningBalance < 0 ? '#60a5fa' : '#4ade80';\n" +
  "        return (\n" +
  "          <div style={{\n" +
  "            position: 'fixed', left: `${left}px`, top: `${top}px`,\n" +
  "            transform: 'translate(-50%, -100%)', zIndex: 99997,\n" +
  "            pointerEvents: 'none',\n" +
  "          }}>\n" +
  "            <div style={{\n" +
  "              background: '#0f172a', color: '#fff',\n" +
  "              borderRadius: '10px', padding: '14px 16px',\n" +
  "              width: `${tooltipWidth}px`,\n" +
  "              boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.2)',\n" +
  "              animation: 'tooltipFadeIn 0.15s ease-out both',\n" +
  "            }}>\n" +
  "              {/* Header */}\n" +
  "              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>\n" +
  "                <span style={{\n" +
  "                  width: '10px', height: '10px', borderRadius: '3px', flexShrink: 0,\n" +
  "                  background: ed.debit > 0 ? '#dc2626' : '#16a34a',\n" +
  "                  boxShadow: ed.debit > 0 ? '0 0 0 2px rgba(220,38,38,0.4)' : '0 0 0 2px rgba(22,163,74,0.4)',\n" +
  "                }} />\n" +
  "                <strong style={{ fontSize: '12px', fontWeight: 800 }}>{ed.type || 'Movimiento'}</strong>\n" +
  "                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginLeft: 'auto' }}>{ed.refId || '-'}</span>\n" +
  "              </div>\n\n" +
  "              {/* Concepto completo (sin truncar) */}\n" +
  "              <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '8px', padding: '6px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>\n" +
  "                {ed.concept || 'Sin descripcion'}\n" +
  "              </div>\n\n" +
  "              {/* Data grid */}\n" +
  "              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px', fontSize: '11px' }}>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Fecha</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{ed.date || '-'}</span>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Cargo</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: ed.debit > 0 ? '#f87171' : '#94a3b8' }}>{ed.debit > 0 ? formatMoney(ed.debit) : '-'}</span>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Abono</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: ed.credit > 0 ? '#4ade80' : '#94a3b8' }}>{ed.credit > 0 ? formatMoney(ed.credit) : '-'}</span>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Saldo</span>\n" +
  "                <span style={{ fontWeight: 800, textAlign: 'right', color: balanceColor }}>{formatMoney(ed.runningBalance)}</span>\n" +
  "              </div>\n\n" +
  "              {/* Balance type badge */}\n" +
  "              <div style={{ marginTop: '8px', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>\n" +
  "                <span style={{ fontSize: '9px', fontWeight: 700, color: balanceColor, background: `${balanceColor}15`, padding: '2px 8px', borderRadius: '999px', border: `1px solid ${balanceColor}30` }}>{balanceType}</span>\n" +
  "              </div>\n\n" +
  "              {/* Flecha triangular */}\n" +
  "              <div style={{\n" +
  "                position: 'absolute', bottom: '-6px', left: '50%',\n" +
  "                transform: 'translateX(-50%)',\n" +
  "                width: '0', height: '0',\n" +
  "                borderLeft: '6px solid transparent',\n" +
  "                borderRight: '6px solid transparent',\n" +
  "                borderTop: '6px solid #0f172a',\n" +
  "              }} />\n" +
  "            </div>\n" +
  "          </div>\n" +
  "        );\n" +
  "      })()}\n\n" +
  "      {/* ── Statement Modal premium ── */}";

let r3 = replaceSafe(modified, existingEventTooltipEnd, ledgerTooltipBlock, 'r3: Ledger tooltip block');
modified = r3;

fs.writeFileSync(filePath, modified, 'utf8');
console.log('✅ All changes applied successfully!');
process.exit(0);
