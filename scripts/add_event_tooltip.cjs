const fs = require('fs');
let filePath = 'src/modules/reports/ReportsContabilidad.jsx';
let c = fs.readFileSync(filePath, 'utf8');
let modified = c;

function replaceSafe(str, search, replacement, label) {
  // Try with \r\n and \n variations
  let result;
  // Try searching with \n (will match both \n and \r\n since JS treats them the same)
  result = str.replace(search, replacement);
  if (result !== str) {
    console.log('✅ ' + label);
    return result;
  }
  // If search contains \n, try replacing \n with \r\n
  let searchCRLF = search.replace(/\n/g, '\r\n');
  let replacementCRLF = replacement.replace(/\n/g, '\r\n');
  result = str.replace(searchCRLF, replacementCRLF);
  if (result !== str) {
    console.log('✅ ' + label + ' (CRLF)');
    return result;
  }
  console.log('FAILED: ' + label);
  console.log('First 100 chars of search: ' + JSON.stringify(search.substring(0, 100)));
  process.exit(1);
}

// 1. Add states after the existing tooltip states
let r1 = replaceSafe(modified,
  "  const [hoveredTooltipAccount, setHoveredTooltipAccount] = useState(null);\n\n  const fetchHistorial",
  "  const [hoveredTooltipAccount, setHoveredTooltipAccount] = useState(null);\n  const [hoveredEventPos, setHoveredEventPos] = useState(null);\n  const [hoveredEventData, setHoveredEventData] = useState(null);\n\n  const fetchHistorial",
  'r1: Event tooltip states'
);
modified = r1;

// 2. Replace the event row status td with mouse handlers
let eventRowSearch = 
  '                                    <td>\n' +
  '                                      <span className="reports-table-status" style={{\n' +
  "                                        background: `${r.statusColor}18`, color: r.statusColor,\n" +
  "                                        border: `1px solid ${r.statusColor}30`, fontSize: '10px', fontWeight: 700,\n" +
  '                                      }}>\n' +
  '                                        {r.status || \'-\'}\n' +
  '                                      </span>\n' +
  '                                    </td>\n' +
  '                                    <td style={{ fontWeight: 700, fontSize: \'12px\' }}>{r.refId}</td>';

let eventRowReplace =
  '                                    <td\n' +
  "                                      style={{ cursor: 'pointer' }}\n" +
  "                                      onMouseEnter={e => {\n" +
  "                                        const rect = e.currentTarget.getBoundingClientRect();\n" +
  "                                        setHoveredEventPos({ x: rect.left + rect.width / 2, y: rect.top });\n" +
  "                                        setHoveredEventData(r);\n" +
  "                                      }}\n" +
  "                                      onMouseLeave={() => {\n" +
  "                                        setHoveredEventPos(null);\n" +
  "                                        setHoveredEventData(null);\n" +
  "                                      }}\n" +
  '                                    >\n' +
  '                                      <span className="reports-table-status" style={{\n' +
  "                                        background: `${r.statusColor}18`, color: r.statusColor,\n" +
  "                                        border: `1px solid ${r.statusColor}30`, fontSize: '10px', fontWeight: 700,\n" +
  '                                      }}>\n' +
  '                                        {r.status || \'-\'}\n' +
  '                                      </span>\n' +
  '                                    </td>\n' +
  '                                    <td style={{ fontWeight: 700, fontSize: \'12px\' }}>{r.refId}</td>';

let r2 = replaceSafe(modified, eventRowSearch, eventRowReplace, 'r2: Event row status td');
modified = r2;

// 3. Add the second tooltip before the Statement Modal (after the first tooltip)
let existingTooltipEnd = 
  "      })()}\n\n      {/* ── Statement Modal premium ── */}";

let eventTooltipBlock = 
  "      })()}\n\n" +
  "      {/* ── Premium Tooltip Evento (fixed) ── */}\n" +
  "      {hoveredEventPos && hoveredEventData && (() => {\n" +
  "        const tooltipWidth = 280;\n" +
  "        const left = Math.min(hoveredEventPos.x, window.innerWidth - tooltipWidth - 10);\n" +
  "        const top = Math.max(10, hoveredEventPos.y - 10);\n" +
  "        const evData = hoveredEventData;\n" +
  "        const statusColor = evData.statusColor || '#64748b';\n" +
  "        return (\n" +
  "          <div style={{\n" +
  "            position: 'fixed', left: `${left}px`, top: `${top}px`,\n" +
  "            transform: 'translate(-50%, -100%)', zIndex: 99998,\n" +
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
  "                  background: statusColor,\n" +
  "                  boxShadow: `0 0 0 2px ${statusColor}40`,\n" +
  "                }} />\n" +
  "                <strong style={{ fontSize: '12px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evData.name || evData.refId || 'Evento'}</strong>\n" +
  "              </div>\n\n" +
  "              {/* Status + Ref */}\n" +
  "              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>\n" +
  "                <span style={{ fontSize: '10px', color: statusColor, fontWeight: 700, background: `${statusColor}20`, padding: '2px 8px', borderRadius: '4px' }}>{evData.status || '-'}</span>\n" +
  "                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{evData.refId || ''}</span>\n" +
  "              </div>\n\n" +
  "              {/* Data grid */}\n" +
  "              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px', fontSize: '11px' }}>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Total</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{formatMoney(evData.total)}</span>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Cobrado</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: '#4ade80' }}>{formatMoney(evData.advancesTotal)}</span>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Pendiente</span>\n" +
  "                <span style={{ fontWeight: 800, textAlign: 'right', color: evData.balancePending > 0 ? '#f87171' : '#4ade80' }}>{formatMoney(evData.balancePending)}</span>\n" +
  "              </div>\n\n" +
  "              {/* Divider */}\n" +
  "              <div style={{ margin: '8px 0', height: '1px', background: 'rgba(255,255,255,0.08)' }} />\n\n" +
  "              {/* Details */}\n" +
  "              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '10px' }}>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Salón</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evData.salon || '-'}</span>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Fecha</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{evData.eventDate || '-'}</span>\n" +
  "                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Vendedor</span>\n" +
  "                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evData.userName || 'Sin asignar'}</span>\n" +
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

let r3 = replaceSafe(modified, existingTooltipEnd, eventTooltipBlock, 'r3: Event tooltip block');
modified = r3;

fs.writeFileSync(filePath, modified, 'utf8');
console.log('✅ All changes applied successfully!');
process.exit(0);
