const fs = require('fs');

const filePath = 'src/modules/reports/ReportsContabilidad.jsx';
let content = fs.readFileSync(filePath, 'utf8');
let modified = content;

// 1. Add state variables after historialOpen
modified = modified.replace(
  'const [historialOpen, setHistorialOpen] = useState(false);\n\n  const fetchHistorial',
  'const [historialOpen, setHistorialOpen] = useState(false);\n  const [hoveredTooltipPos, setHoveredTooltipPos] = useState(null);\n  const [hoveredTooltipAccount, setHoveredTooltipAccount] = useState(null);\n\n  const fetchHistorial'
);

// 2. Add style tag at start of return
modified = modified.replace(
  '    <div className="reports-page-container">\n      {/* Header */}\n      <div className="reports-page-header">',
  '    <div className="reports-page-container">\n      <style>{`@keyframes tooltipFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>\n      {/* Header */}\n      <div className="reports-page-header">'
);

// 3. Add onMouseEnter/onMouseLeave to the status indicator td
const oldTd = `                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                          background: acc.collectionTone === 'overdue' ? '#dc2626' : acc.collectionTone === 'due' ? '#eab308' : acc.collectionTone === 'ok' ? '#22c55e' : acc.collectionTone === 'credit' ? '#0ea5e9' : '#94a3b8',
                          boxShadow: \`0 0 0 2px \${acc.collectionTone === 'overdue' ? '#dc2626' : acc.collectionTone === 'due' ? '#eab308' : acc.collectionTone === 'ok' ? '#22c55e' : acc.collectionTone === 'credit' ? '#0ea5e9' : '#94a3b8'}20\`,
                        }} />
                        <span className={\`reports-collection-status reports-collection-status--\${acc.collectionTone}\`} style={{ fontSize: '10px', fontWeight: 700 }}>
                          {acc.collectionLabel}
                        </span>
                      </div>
                    </td>`;

const newTd = `                    <td
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                        setHoveredTooltipAccount(acc);
                      }}
                      onMouseLeave={() => {
                        setHoveredTooltipPos(null);
                        setHoveredTooltipAccount(null);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                          background: acc.collectionTone === 'overdue' ? '#dc2626' : acc.collectionTone === 'due' ? '#eab308' : acc.collectionTone === 'ok' ? '#22c55e' : acc.collectionTone === 'credit' ? '#0ea5e9' : '#94a3b8',
                          boxShadow: \`0 0 0 2px \${acc.collectionTone === 'overdue' ? '#dc2626' : acc.collectionTone === 'due' ? '#eab308' : acc.collectionTone === 'ok' ? '#22c55e' : acc.collectionTone === 'credit' ? '#0ea5e9' : '#94a3b8'}20\`,
                        }} />
                        <span className={\`reports-collection-status reports-collection-status--\${acc.collectionTone}\`} style={{ fontSize: '10px', fontWeight: 700 }}>
                          {acc.collectionLabel}
                        </span>
                      </div>
                    </td>`;

modified = modified.replace(oldTd, newTd);

// 4. Add premium tooltip before Statement Modal
const tooltipCode = `      </div>

      {/* ── Premium Tooltip (fixed) ── */}
      {hoveredTooltipPos && hoveredTooltipAccount && (() => {
        const tooltipWidth = 260;
        const left = Math.min(hoveredTooltipPos.x, window.innerWidth - tooltipWidth - 10);
        const top = Math.max(10, hoveredTooltipPos.y - 10);
        const colTone = hoveredTooltipAccount.collectionTone;
        const toneColors = {
          overdue: '#dc2626',
          due: '#eab308',
          ok: '#22c55e',
          credit: '#0ea5e9',
          neutral: '#94a3b8',
        };
        const toneColor = toneColors[colTone] || '#94a3b8';
        return (
          <div style={{
            position: 'fixed', left: \`\${left}px\`, top: \`\${top}px\`,
            transform: 'translate(-50%, -100%)', zIndex: 99999,
            pointerEvents: 'none',
          }}>
            <div style={{
              background: '#0f172a', color: '#fff',
              borderRadius: '10px', padding: '14px 16px',
              width: \`\${tooltipWidth}px\`,
              boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.2)',
              animation: 'tooltipFadeIn 0.15s ease-out both',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{
                  width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                  background: toneColor,
                  boxShadow: \`0 0 0 2px \${toneColor}40\`,
                }} />
                <strong style={{ fontSize: '12px', fontWeight: 800 }}>{hoveredTooltipAccount.companyName}</strong>
              </div>

              {/* Status */}
              <div style={{ fontSize: '10px', color: toneColor, fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: toneColor, display: 'inline-block' }} />
                {hoveredTooltipAccount.collectionLabel}
              </div>

              {/* Data grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '11px' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Venta Neta</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{formatMoney(hoveredTooltipAccount.netAmount)}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Cobrado</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#4ade80' }}>{formatMoney(hoveredTooltipAccount.collectedAmount)}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Pendiente</span>
                <span style={{ fontWeight: 800, textAlign: 'right', color: hoveredTooltipAccount.pendingAmount > 0 ? '#f87171' : '#4ade80' }}>{formatMoney(hoveredTooltipAccount.pendingAmount)}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Sdo. Favor</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#60a5fa' }}>{formatMoney(hoveredTooltipAccount.creditAmount)}</span>
              </div>

              {/* Divider */}
              <div style={{ margin: '8px 0', height: '1px', background: 'rgba(255,255,255,0.08)' }} />

              {/* Eventos & Dueño */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '10px' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Eventos</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{hoveredTooltipAccount.eventsCount}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Pendientes</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: hoveredTooltipAccount.pendingEventsCount > 0 ? '#f87171' : '#4ade80' }}>{hoveredTooltipAccount.pendingEventsCount}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Vendedor</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hoveredTooltipAccount.primarySeller || 'Sin asignar'}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Vto.</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{hoveredTooltipAccount.collectionDueLabel || '-'}</span>
              </div>

              {/* Flecha triangular */}
              <div style={{
                position: 'absolute', bottom: '-6px', left: '50%',
                transform: 'translateX(-50%)',
                width: '0', height: '0',
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid #0f172a',
              }} />
            </div>
          </div>
        );
      })()}

      {/* ── Statement Modal premium ── */}`;

modified = modified.replace(
  '      </div>\n\n      {/* ── Statement Modal premium ── */}',
  tooltipCode
);

if (content === modified) {
  console.log('⚠️ No changes were made!');
  process.exit(1);
}

fs.writeFileSync(filePath, modified, 'utf8');
console.log('✅ Changes applied successfully!');
console.log('File size:', Buffer.byteLength(modified, 'utf8'), 'bytes');
process.exit(0);
