const fs = require('fs');
const path = require('path');

// ─── 1. Patch QuoteModal.jsx ───
const qmPath = path.resolve(__dirname, '..', 'src/modules/calendar/components/QuoteModal.jsx');
let qm = fs.readFileSync(qmPath, 'utf8');
let qmChanged = 0;

// 1a. Add templateIds to initial quote state (after templateId line)
const oldInitState = `    templateId: event?.quote?.templateId || '',`;
const newInitState = `    templateId: event?.quote?.templateId || '',\n    templateIds: Array.isArray(event?.quote?.templateIds)\n      ? event?.quote?.templateIds\n      : (event?.quote?.templateId ? [event?.quote?.templateId] : []),`;

if (qm.includes(oldInitState)) {
  qm = qm.replace(oldInitState, newInitState);
  console.log('✅ [1a] Added templateIds to initial quote state');
  qmChanged++;
} else {
  console.log('❌ [1a] Could not find templateId initial state line');
}

// 1b. Replace the single template select with checkboxes
const oldSelect = `<label style={fieldLabel}>Plantilla contrato</label>
              <select style={fieldSelect} value={quote.templateId} onChange={e => setQuote(p => ({ ...p, templateId: e.target.value }))}>
                <option value="">— Sin plantilla —</option>
                {contractTemplates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.filename})</option>
                ))}
              </select>`;

const newCheckboxes = `<label style={fieldLabel}>Plantillas contrato</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
                {contractTemplates.length === 0 ? (
                  <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                    Sin plantillas configuradas — ve a Configuración
                  </span>
                ) : (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#475569', cursor: 'pointer', padding: '2px 0' }}>
                      <input
                        type="checkbox"
                        checked={quote.templateIds.length === 0}
                        onChange={() => setQuote(p => ({ ...p, templateIds: [] }))}
                        style={{ accentColor: '#2563eb' }}
                      />
                      — Sin plantilla —
                    </label>
                    {contractTemplates.map(tpl => {
                      const checked = quote.templateIds.includes(tpl.id);
                      return (
                        <label key={tpl.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          fontSize: 11, color: '#334155', cursor: 'pointer',
                          padding: '3px 0', borderRadius: 4,
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
                          <span>{tpl.name}</span>
                          <span style={{ fontSize: 9, color: '#94a3b8' }}>({tpl.filename})</span>
                        </label>
                      );
                    })}
                  </>
                )}
              </div>`;

if (qm.includes(oldSelect)) {
  qm = qm.replace(oldSelect, newCheckboxes);
  console.log('✅ [1b] Replaced single select with multi-select checkboxes');
  qmChanged++;
} else {
  console.log('❌ [1b] Could not find template select — trying alternative...');
  // Try without indentation
  const alt = qm.indexOf('Plantilla contrato');
  if (alt >= 0) {
    console.log('   Found "Plantilla contrato" at char', alt, 'context:', qm.substring(alt, alt + 250));
  }
}

// 1c. Add templateIds to finalQuote in handleSaveQuote
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
  console.log('✅ [1c] Added templateIds to finalQuote');
  qmChanged++;
} else {
  console.log('❌ [1c] Could not find finalQuote block');
}

if (qmChanged > 0) fs.writeFileSync(qmPath, qm, 'utf8');
console.log(`📝 QuoteModal: ${qmChanged} changes applied`);


// ─── 2. Patch printUtils.js ───
const puPath = path.resolve(__dirname, '..', 'src/utils/printUtils.js');
let pu = fs.readFileSync(puPath, 'utf8');
let puChanged = 0;

// Replace the single template resolution block with multi-template loop
const oldTemplateBlock = `    if (quote.templateId && printOption !== "sin_precios") {
      // Resolve template filename from contractTemplates config (if available)
      let fileName = "";
      const ctpls = Array.isArray(quote.contractTemplates) ? quote.contractTemplates : [];
      const matched = ctpls.find(t => String(t.id) === String(quote.templateId));
      if (matched) {
        fileName = matched.filename;
        if (matched.filename && /serv/i.test(matched.filename)) {
          isServiHospTemplate = true;
        }
      }
      // Legacy fallback for quotes saved before contractTemplates config
      if (!fileName) {
        if (quote.templateId === "contrato_corp" || quote.templateId === "contrato_social") {
          fileName = "Jardines.html";
        } else if (quote.templateId === "contrato_hosp") {
          fileName = "ServiHosp.html";
          isServiHospTemplate = true;
        }
      }

      if (fileName) {
        const res = await fetch(\`/templates/\${fileName}\`);
        if (res.ok) {
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
            const footerImg = isServiHospTemplate ? null : tplDoc.body.querySelector(".contract-footer img, .contract-footer-print img");

            tplDoc.body
              .querySelectorAll(".contract-header, .contract-header-print, .contract-footer, .contract-footer-print, script")
              .forEach((node) => node.remove());

            // Remove ANY trailing empty element (handles Google Docs extra tables, paragraphs, etc.)
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

          htmlContent = \`
            <style>\${tplStyleText}</style>
            <div class="templateAttachBody">
              <div class="templateAttach" style="margin-top:20px; font-family:Arial,sans-serif;">
                \${tplBody}
              </div>
            </div>
          \`;
        }
      }
    }`;

const newTemplateBlock = `    // Collect selected template IDs (support both legacy single and new multi)
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

      // Set isServiHospTemplate based on first template (for header image)
      if (allHtmlParts.length > 0) {
        const firstTplId = selectedIds[0];
        const firstMatched = ctpls.find(t => String(t.id) === String(firstTplId));
        if (firstMatched && firstMatched.filename && /serv/i.test(firstMatched.filename)) {
          isServiHospTemplate = true;
        } else if (firstTplId === "contrato_hosp") {
          isServiHospTemplate = true;
        }
      }

      htmlContent = allHtmlParts.join('<div class="page-break"></div>');
    }`;

if (pu.includes(oldTemplateBlock)) {
  pu = pu.replace(oldTemplateBlock, newTemplateBlock);
  console.log('✅ [2a] Replaced single template resolution with multi-template loop');
  puChanged++;
} else {
  console.log('❌ [2a] Could not find template resolution block in printUtils');
  // Find context
  const idx = pu.indexOf('quote.templateId');
  if (idx >= 0) {
    console.log('   Found "quote.templateId" at char', idx, 'context:', pu.substring(idx, idx + 120));
  }
}

if (puChanged > 0) fs.writeFileSync(puPath, pu, 'utf8');
console.log(`📝 printUtils: ${puChanged} changes applied`);

console.log('\n✅ Done! Summary:');
console.log(`  QuoteModal: ${qmChanged}/3 changes`);
console.log(`  printUtils: ${puChanged}/1 changes`);
