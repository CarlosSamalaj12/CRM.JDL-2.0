const fs = require('fs');
let filePath = 'src/modules/reports/ReportsContabilidad.jsx';
let c = fs.readFileSync(filePath, 'utf8');
let modified = c;

function replaceSafe(str, search, replacement, label) {
  // Try with \r\n and \n variations
  let result;
  // Try searching with \r\n
  result = str.replace(search, replacement);
  if (result !== str) {
    console.log('✅ ' + label + ' (matched with CRLF)');
    return result;
  }
  // If search contains \n, try replacing \n with \r\n
  let searchCRLF = search.replace(/\n/g, '\r\n');
  result = str.replace(searchCRLF, replacement);
  if (result !== str) {
    console.log('✅ ' + label + ' (matched after CRLF conversion)');
    return result;
  }
  console.log('FAILED: ' + label);
  console.log('Search was: ' + JSON.stringify(search.substring(0, 80)));
  process.exit(1);
}

// 1. Add states after historialOpen
let r1 = replaceSafe(modified,
  "const [historialOpen, setHistorialOpen] = useState(false);\n\n  const fetchHistorial",
  "const [historialOpen, setHistorialOpen] = useState(false);\n  const [hoveredTooltipPos, setHoveredTooltipPos] = useState(null);\n  const [hoveredTooltipAccount, setHoveredTooltipAccount] = useState(null);\n\n  const fetchHistorial",
  'r1: States'
);
modified = r1;

// 2. Add style tag
let r2 = replaceSafe(modified,
  '<div className="reports-page-container">\n      {/* Header */}\n      <div className="reports-page-header">',
  '<div className="reports-page-container">\n      <style>{`@keyframes tooltipFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>\n      {/* Header */}\n      <div className="reports-page-header">',
  'r2: Style tag'
);
modified = r2;

// 3. Add onMouseEnter/onMouseLeave to the status td
let r3 = replaceSafe(modified,
  '                    <td>\n                      <div style={{ display: \'flex\', alignItems: \'center\', gap: \'6px\' }}>\n                        <span style={{\n                          width: \'8px\', height: \'8px\', borderRadius: \'50%\', flexShrink: 0,\n                          background: acc.collectionTone === \'overdue\' ? \'#dc2626\' : acc.collectionTone === \'due\' ? \'#eab308\' : acc.collectionTone === \'ok\' ? \'#22c55e\' : acc.collectionTone === \'credit\' ? \'#0ea5e9\' : \'#94a3b8\',\n                          boxShadow: `0 0 0 2px ${acc.collectionTone === \'overdue\' ? \'#dc2626\' : acc.collectionTone === \'due\' ? \'#eab308\' : acc.collectionTone === \'ok\' ? \'#22c55e\' : acc.collectionTone === \'credit\' ? \'#0ea5e9\' : \'#94a3b8\'}20`,\n                        }} />\n                        <span className={`reports-collection-status reports-collection-status--${acc.collectionTone}`} style={{ fontSize: \'10px\', fontWeight: 700 }}>\n                          {acc.collectionLabel}\n                        </span>\n                      </div>\n                    </td>',
  '                    <td\n                      style={{ cursor: \'pointer\' }}\n                      onMouseEnter={e => {\n                        const rect = e.currentTarget.getBoundingClientRect();\n                        setHoveredTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });\n                        setHoveredTooltipAccount(acc);\n                      }}\n                      onMouseLeave={() => {\n                        setHoveredTooltipPos(null);\n                        setHoveredTooltipAccount(null);\n                      }}\n                    >\n                      <div style={{ display: \'flex\', alignItems: \'center\', gap: \'6px\' }}>\n                        <span style={{\n                          width: \'8px\', height: \'8px\', borderRadius: \'50%\', flexShrink: 0,\n                          background: acc.collectionTone === \'overdue\' ? \'#dc2626\' : acc.collectionTone === \'due\' ? \'#eab308\' : acc.collectionTone === \'ok\' ? \'#22c55e\' : acc.collectionTone === \'credit\' ? \'#0ea5e9\' : \'#94a3b8\',\n                          boxShadow: `0 0 0 2px ${acc.collectionTone === \'overdue\' ? \'#dc2626\' : acc.collectionTone === \'due\' ? \'#eab308\' : acc.collectionTone === \'ok\' ? \'#22c55e\' : acc.collectionTone === \'credit\' ? \'#0ea5e9\' : \'#94a3b8\'}20`,\n                        }} />\n                        <span className={`reports-collection-status reports-collection-status--${acc.collectionTone}`} style={{ fontSize: \'10px\', fontWeight: 700 }}>\n                          {acc.collectionLabel}\n                        </span>\n                      </div>\n                    </td>',
  'r3: Status td'
);
modified = r3;

// 4. Add premium tooltip before Statement Modal
let tooltipBlock = 
  '      </div>\n\n' +
  '      {/* ── Premium Tooltip (fixed) ── */}\n' +
  '      {hoveredTooltipPos && hoveredTooltipAccount && (() => {\n' +
  "        const tooltipWidth = 260;\n" +
  "        const left = Math.min(hoveredTooltipPos.x, window.innerWidth - tooltipWidth - 10);\n" +
  "        const top = Math.max(10, hoveredTooltipPos.y - 10);\n" +
  "        const colTone = hoveredTooltipAccount.collectionTone;\n" +
  "        const toneColors = {\n" +
  "          overdue: '#dc2626',\n" +
  "          due: '#eab308',\n" +
  "          ok: '#22c55e',\n" +
  "          credit: '#0ea5e9',\n" +
  "          neutral: '#94a3b8',\n" +
  "        };\n" +
  "        const toneColor = toneColors[colTone] || '#94a3b8';\n" +
  "        return (\n" +
  "          <div style={{\n" +
  "            position: 'fixed', left: `${left}px`, top: `${top}px`,\n" +
  "            transform: 'translate(-50%, -100%)', zIndex: 99999,\n" +
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
  "              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>\n" +
  "                <span style={{\n" +
  "                  width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,\n" +
  "                  background: toneColor,\n" +
  "                  boxShadow: `0 0 0 2px ${toneColor}40`,\n" +
  "                }} />\n" +
  "                <strong style={{ fontSize: '12px', fontWeight: 800 }}>{hoveredTooltipAccount.companyName}</strong>\n" +
  "              </div>\n\n" +
  "              {/* Status */}\n" +
  "              <div style={{ fontSize: '10px', color: toneColor, fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>\n" +
  "                <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: toneColor, display: 'inline-block' }} />\n" +
  "                {hoveredTooltipAccount.collectionLabel}\n" +
  "              </div>\n\n" +
  "              {/* Data grid */}\n" +
  "              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '11px' }}>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Venta Neta</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{formatMoney(hoveredTooltipAccount.netAmount)}</span>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Cobrado</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: '#4ade80' }}>{formatMoney(hoveredTooltipAccount.collectedAmount)}</span>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Pendiente</span>\n" +
  "                <span style={{ fontWeight: 800, textAlign: 'right', color: hoveredTooltipAccount.pendingAmount > 0 ? '#f87171' : '#4ade80' }}>{formatMoney(hoveredTooltipAccount.pendingAmount)}</span>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Sdo. Favor</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: '#60a5fa' }}>{formatMoney(hoveredTooltipAccount.creditAmount)}</span>\n" +
  "              </div>\n\n" +
  "              {/* Divider */}\n" +
  "              <div style={{ margin: '8px 0', height: '1px', background: 'rgba(255,255,255,0.08)' }} />\n\n" +
  "              {/* Eventos & Dueño */}\n" +
  "              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '10px' }}>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Eventos</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{hoveredTooltipAccount.eventsCount}</span>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Pendientes</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: hoveredTooltipAccount.pendingEventsCount > 0 ? '#f87171' : '#4ade80' }}>{hoveredTooltipAccount.pendingEventsCount}</span>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Vendedor</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hoveredTooltipAccount.primarySeller || 'Sin asignar'}</span>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Vto.</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{hoveredTooltipAccount.collectionDueLabel || '-'}</span>\n" +
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

let r4 = replaceSafe(modified,
  '      </div>\n\n      {/* ── Statement Modal premium ── */}',
  tooltipBlock,
  'r4: Tooltip block'
);
modified = r4;

fs.writeFileSync(filePath, modified, 'utf8');
console.log('✅ All changes applied successfully!');
process.exit(0);
