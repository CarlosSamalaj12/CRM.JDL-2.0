const fs = require('fs');
const path = require('path');

// ─── 1. QuoteModal: Replace single template select with multi-select checkboxes ───
const qmPath = path.resolve(__dirname, '..', 'src/modules/calendar/components/QuoteModal.jsx');
let qm = fs.readFileSync(qmPath, 'utf8');

// Change 1a: Replace the select with checkboxes
const oldSelect = `              <label style={fieldLabel}>Plantilla contrato</label>
              <select style={fieldSelect} value={quote.templateId} onChange={e => setQuote(p => ({ ...p, templateId: e.target.value }))}>
                <option value="">\u2014 Sin plantilla \u2014</option>
                {contractTemplates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.filename})</option>
                ))}
              </select>`;

const newCheckboxes = `              <label style={fieldLabel}>Plantillas contrato</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0', maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', background: '#fff' }}>
                {contractTemplates.length === 0 ? (
                  <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                    Sin plantillas configuradas
                  </span>
                ) : (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b', cursor: 'pointer', padding: '3px 4px', borderRadius: 4 }}>
                      <input
                        type="checkbox"
                        checked={quote.templateIds.length === 0}
                        onChange={() => setQuote(p => ({ ...p, templateIds: [] }))}
                        style={{ accentColor: '#64748b' }}
                      />
                      <span>\u2014 Ninguna \u2014</span>
                    </label>
                    <div style={{ borderTop: '1px solid #f1f5f9', margin: '2px 0' }} />
                    {contractTemplates.map(tpl => {
                      const checked = quote.templateIds.includes(tpl.id);
                      return (
                        <label key={tpl.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          fontSize: 11, color: '#334155', cursor: 'pointer',
                          padding: '4px 4px', borderRadius: 4,
                          background: checked ? '#f0fdf4' : 'transparent',
                        }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setQuote(p => ({
                              ...p,
                              templateIds: checked
                                ? p.templateIds.filter(id => id !== tpl.id)
                                : [...p.templateIds, tpl.id]
                            }))}
                            style={{ accentColor: '#16a34a' }}
                          />
                          <span style={{ fontWeight: checked ? 700 : 400 }}>{tpl.name}</span>
                          <span style={{ fontSize: 9, color: '#94a3b8' }}>({tpl.filename})</span>
                        </label>
                      );
                    })}
                  </>
                )}
              </div>`;

if (qm.includes(oldSelect)) {
  qm = qm.replace(oldSelect, newCheckboxes);
  console.log('✅ [1a] Replaced single select with multi-select checkboxes');
} else {
  console.log('❌ [1a] Could not find template select pattern');
}

// Change 1b: Add templateIds to finalQuote
const oldFinalQuote = `      const finalQuote = {
        ...quote,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        total: totals.total,
        quotedAt: new Date().toISOString(),
      };`;

const newFinalQuote = `      const finalQuote = {
        ...quote,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        total: totals.total,
        quotedAt: new Date().toISOString(),
        templateIds: Array.isArray(quote.templateIds) ? quote.templateIds : (quote.templateId ? [quote.templateId] : []),
      };`;

if (qm.includes(oldFinalQuote)) {
  qm = qm.replace(oldFinalQuote, newFinalQuote);
  console.log('✅ [1b] Added templateIds to finalQuote');
} else {
  console.log('❌ [1b] Could not find finalQuote pattern');
}

fs.writeFileSync(qmPath, qm, 'utf8');
console.log('✅ QuoteModal saved');

// ─── 2. printUtils.js: Multi-template loop ───
const puPath = path.resolve(__dirname, '..', 'src/utils/printUtils.js');
let pu = fs.readFileSync(puPath, 'utf8');

// Read the exact block to replace
// From line 203 to the end of the template attachment (before let mmContentHtml)
const startMarker = '    if (quote.templateId && printOption !== "sin_precios") {\n';
const endMarker = '\n    let mmContentHtml = "";';

const startIdx = pu.indexOf(startMarker);
const endIdx = pu.indexOf(endMarker, startIdx);

if (startIdx >= 0 && endIdx > startIdx) {
  const oldBlock = pu.substring(startIdx, endIdx);
  
  const newBlock = `    // Collect selected template IDs (support both legacy single and new multi)
    const selectedIds = [];
    if (Array.isArray(quote.templateIds) && quote.templateIds.length > 0) {
      selectedIds.push(...quote.templateIds);
    } else if (quote.templateId) {
      selectedIds.push(quote.templateId);
    }

    if (selectedIds.length > 0 && printOption !== "sin_precios") {
      const ctpls = Array.isArray(quote.contractTemplates) ? quote.contractTemplates : [];
      const allHtmlParts = [];

      for (const tplId of selectedIds) {
        // Resolve template filename
        let fileName = "";
        let tplIsServiHosp = false;
        const matched = ctpls.find(t => String(t.id) === String(tplId));
        if (matched) {
          fileName = matched.filename;
          if (matched.filename && /serv/i.test(matched.filename)) {
            tplIsServiHosp = true;
          }
        }
        // Legacy fallback for quotes saved before contractTemplates config
        if (!fileName) {
          if (tplId === "contrato_corp" || tplId === "contrato_social") {
            fileName = "Jardines.html";
          } else if (tplId === "contrato_hosp") {
            fileName = "ServiHosp.html";
            tplIsServiHosp = true;
          }
        }

        if (!fileName) continue;

        try {
          const res = await fetch(\`/templates/\${fileName}\`);
          if (!res.ok) continue;
          let tplHtml = await res.text();
          tplHtml = tplHtml.replace(/src="([a-zA-Z0-9_.-]+)"/g, 'src="/templates/$1"');

          const contextMap = buildTemplatePrintContextFromQuoteData(quote, user);
          tplHtml = fillTemplateHtmlTokens(tplHtml, contextMap);

          const parser = new DOMParser();
          const tplDoc = parser.parseFromString(tplHtml, "text/html");
          const rawTplStyleText = tplDoc.head
            ? Array.from(tplDoc.head.querySelectorAll("style")).map((node) => node.textContent || "").join("\\n")
            : "";
          const tplStyleText = rawTplStyleText
            .replace(/@media print\\s*\\{[\\s\\S]*?\\}(?=\\.[a-zA-Z0-9_-]+\\{|[a-z]+\\{|$)/g, "")
            .replace(/@page\\s*\\{[\\s\\S]*?\\}/g, "")
            .replace(/html,body\\{[\\s\\S]*?\\}/g, "");

          let tplBody = tplDoc.body ? tplDoc.body.innerHTML : tplHtml;

          if (tplDoc.body) {
            const headerImg = tplDoc.body.querySelector(".contract-header img, .contract-header-print img");
            const footerImg = tplIsServiHosp ? null : tplDoc.body.querySelector(".contract-footer img, .contract-footer-print img");

            tplDoc.body
              .querySelectorAll(".contract-header, .contract-header-print, .contract-footer, .contract-footer-print, script")
              .forEach((node) => node.remove());

            function _isTplElEmpty(el) {
              if (el.textContent.trim()) return false;
              if (el.querySelector('img, svg, canvas, video, iframe')) return false;
              return true;
            }
            let lastChild = tplDoc.body.lastElementChild;
            while (lastChild && _isTplElEmpty(lastChild)) {
              const prev = lastChild.previousElementSibling;
              lastChild.remove();
              lastChild = prev;
            }

            if (headerImg || footerImg) {
              const repeatHead = headerImg ? \`<tr class="contractPrintHead"><td class="contractPrintCell">\${headerImg.outerHTML}</td></tr>\` : "";
              const repeatFoot = footerImg ? \`<tr class="contractPrintFoot"><td class="contractPrintCell">\${footerImg.outerHTML}</td></tr>\` : "";
              const bodyRows = Array.from(tplDoc.body.children)
                .map((node) => \`<tr class="contractPrintRow"><td class="contractPrintContent">\${node.outerHTML}</td></tr>\`)
                .join("");

              tplBody = \`
                <style>
                  .contractPrintFrame{ width:100%; border-collapse:collapse; table-layout:fixed; }
                  .contractPrintHead,.contractPrintFoot{ display:table-row; }
                  .contractPrintCell{ padding:0; }
                  .contractPrintRow{ break-inside:auto; page-break-inside:auto; }
                  .contractPrintContent{ padding:0; }
                  @media print{
                    .contractPrintFrame thead{ display:table-header-group; }
                    .contractPrintFrame tfoot{ display:table-footer-group; }
                    .contractPrintHead .contractPrintCell{ padding:0 0 4mm; }
                    .contractPrintFoot .contractPrintCell{ padding:4mm 0 0; }
                    .contractPrintHead img{ display:block; width:100%; object-position:center top; }
                    .contractPrintFoot img{ display:block; width:100%; object-position:center bottom; }
                  }
                </style>
                <table class="contractPrintFrame"><thead>\${repeatHead}</thead><tfoot>\${repeatFoot}</tfoot><tbody>\${bodyRows}</tbody></table>
              \`;
            } else {
              tplBody = tplDoc.body.innerHTML;
            }
          }

          allHtmlParts.push(\`
            <style>\${tplStyleText}</style>
            <div class="templateAttachBody">
              <div class="templateAttach" style="margin-top:20px; font-family:Arial,sans-serif;">
                \${tplBody}
              </div>
            </div>
          \`);
        } catch (e) {
          console.warn("Error loading contract template:", fileName, e);
        }
      }

      // Determine header image based on first selected template
      if (allHtmlParts.length > 0) {
        const firstTplId = selectedIds[0];
        const firstMatched = ctpls.find(t => String(t.id) === String(firstTplId));
        if (firstMatched && firstMatched.filename && /serv/i.test(firstMatched.filename)) {
          isServiHospTemplate = true;
        } else if (firstTplId === "contrato_hosp") {
          isServiHospTemplate = true;
        }
      }

      htmlContent = allHtmlParts.join('<div class=\"page-break\"></div>');
    }`;

  pu = pu.substring(0, startIdx) + newBlock + pu.substring(endIdx);
  fs.writeFileSync(puPath, pu, 'utf8');
  console.log('✅ [2] Replaced single template resolution with multi-template loop');
} else {
  console.log('❌ [2] Could not find template resolution block');
  if (startIdx < 0) console.log('   startMarker not found');
  if (startIdx >= 0 && endIdx <= startIdx) console.log('   endMarker not found after startIdx');
}

console.log('\n✅ Done! All changes applied.');
