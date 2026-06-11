export function buildMenuMontajeReportHtml(ev, quoteLike, reportMode = "full") {
  const quote = quoteLike || {};
  const entries = (Array.isArray(quote?.menuMontajeEntries) ? quote.menuMontajeEntries : [])
    .filter((x) => String(x?.date || "").trim() && String(x?.salon || "").trim());
  if (!entries.length) return "";
  const company = (state.companies || []).find((c) => String(c.id || "") === String(quote.companyId || ""));
  const institutionName = String(company?.name || quote.companyName || "-").trim() || "-";
  const manager = company?.managers?.find((m) => String(m.id || "") === String(quote.managerId || ""));
  const seller = (state.users || []).find((u) => String(u.id || "") === String(ev?.userId || ""));

  const byDate = new Map();
  for (const row of entries) {
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(row);
  }
  const orderedDates = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b));

  const sectionHtml = orderedDates.map((date) => {
    const rows = byDate.get(date) || [];
    rows.sort((a, b) => String(a.salon || "").localeCompare(String(b.salon || "")));
    const blocks = rows.map((r) => `
      <div class="mmReportBlock">
        <h2 class="mmReportTitle">MENU - ${escapeHtml(String(r.salon || "").toUpperCase())} - ${escapeHtml(date)}</h2>
        ${renderMenuMontajeRichText(String(r.menuDescription || ""))}
      </div>
      ${reportMode === "menu_only" ? "" : `
      <div class="mmReportBlock">
        <h2 class="mmReportTitle">MONTAJE - ${escapeHtml(String(r.salon || "").toUpperCase())} - ${escapeHtml(date)}</h2>
        ${renderMenuMontajeRichText(String(r.montajeDescription || ""))}
      </div>`}
    `).join("");
    return `
      <article class="mmReportCard" style="page-break-after: always;">
        <div class="mmReportHead">${escapeHtml(institutionName)} - MENU & MONTAJE - ${escapeHtml(date)}</div>
        <div class="mmReportMeta">
          <div><b>Encargado evento:</b> ${escapeHtml(String(manager?.name || quote.contact || "-"))}</div>
          <div><b>No cotizacion:</b> ${escapeHtml(String(quote.code || "-"))}</div>
          <div><b>Tipo evento:</b> ${escapeHtml(String(quote.eventType || ev?.name || "-"))}</div>
          <div><b>Fecha cotizacion:</b> ${escapeHtml(String(quote.docDate || "-"))}</div>
          <div><b>Horario:</b> ${escapeHtml(String(quote.schedule || `${ev?.startTime || ""} a ${ev?.endTime || ""}`.trim() || "-"))}</div>
          <div><b>Telefono:</b> ${escapeHtml(String(quote.phone || manager?.phone || "-"))}</div>
          <div><b>Fecha evento:</b> ${escapeHtml(date)}</div>
          <div><b>No Pax:</b> ${escapeHtml(String(quote.people || ev?.pax || "-"))}</div>
          <div><b>No Folio:</b> ${escapeHtml(String(quote.folio || "0"))}</div>
          <div><b>Vendedor:</b> ${escapeHtml(String(seller?.fullName || seller?.name || "-"))}</div>
        </div>
        ${blocks}
      </article>
    `;
  }).join("");

  const liveStyles = collectCurrentDocumentStyles();
  const docTitle = reportMode === "menu_only"
    ? `${institutionName} - INFORME MENU`
    : `${institutionName} - MENU & MONTAJE`;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(docTitle)}</title>
  ${liveStyles ? `<style data-mm-live-styles>${liveStyles}</style>` : ""}
  <style>
    :root{
      --ink:#0f172a;
      --line:#bdd0e9;
      --line2:#d9e2f2;
      --soft:#edf5ff;
      --brand:#0f3c67;
      --brand2:#165d90;
    }
    *{ box-sizing:border-box; }
    html,body{ margin:0; padding:0; }
    body{
      font-family:"Segoe UI", Arial, sans-serif;
      background:#eef3fb;
      color:var(--ink);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .mmReportWrap{
      padding:18px;
    }
    .mmReportCard{
      max-width:1100px;
      margin:0 auto 16px;
      border:1px solid var(--line);
      border-radius:12px;
      overflow:hidden;
      background:#ffffff;
      box-shadow:0 10px 28px rgba(15,23,42,0.12);
    }
    .mmReportHead{
      background:linear-gradient(135deg, var(--brand), var(--brand2));
      color:#fff;
      padding:12px 14px;
      font-size:20px;
      font-weight:900;
      letter-spacing:.3px;
      text-transform:uppercase;
    }
    .mmReportMeta{
      display:grid;
      grid-template-columns:repeat(2, minmax(240px, 1fr));
      gap:8px 12px;
      padding:12px 14px;
      background:var(--soft);
      border-top:1px solid #c9d8ee;
      border-bottom:1px solid #c9d8ee;
      font-size:14px;
    }
    .mmReportBlock{
      padding:14px;
      border-bottom:1px solid var(--line2);
    }
    .mmReportBlock:last-child{ border-bottom:none; }
    .mmReportTitle{
      margin:0 0 8px;
      font-size:18px;
      line-height:1.1;
      font-weight:900;
      color:#0a3f67;
      text-transform:uppercase;
    }
    .mmReportText{
      margin:0;
      white-space:pre-wrap;
      font-size:12.5px;
      line-height:1.35;
      color:var(--ink);
    }
    .mmReportSection{
      margin-top:10px;
    }
    .mmReportSection:first-child{
      margin-top:0;
    }
    .mmReportSubtitle{
      margin:0 0 6px;
      font-size:15px;
      font-weight:900;
      letter-spacing:.45px;
      color:#0a3f67;
      text-transform:uppercase;
      border-left:4px solid #0a5a92;
      padding-left:8px;
    }
    .mmReportStack{
      display:grid;
      gap:6px;
      margin-left:10px;
    }
    .mmReportInlineFlow{
      display:flex;
      flex-wrap:wrap;
      gap:8px 18px;
      margin-left:10px;
      align-items:baseline;
    }
    .mmReportInlinePair{
      display:inline-flex;
      align-items:baseline;
      gap:4px;
      white-space:nowrap;
    }
    .mmReportInlineLabel{
      font-size:12.5px;
      line-height:1.45;
      font-weight:900;
      letter-spacing:.2px;
      text-transform:uppercase;
      color:#0a4b80;
      white-space:nowrap;
    }
    .mmReportMiniValue{
      font-size:12.5px;
      line-height:1.45;
      color:#0f172a;
      white-space:nowrap;
    }
    @media print {
      .mmReportGrid{
        grid-template-columns: repeat(2, minmax(260px, 1fr));
      }
    }
    .mmReportSectionLine{
      margin:0 0 8px 12px;
      font-size:12.5px;
      line-height:1.45;
      color:#0f172a;
    }
    .mmReportHr{
      margin:10px 0;
      border:none;
      border-top:1px solid #9ab4d6;
    }
    @page { size: auto; margin: 10mm; }
    @media print {
      body{ background:#ffffff; }
      .mmReportWrap{ padding:0; }
      article.mmReportCard{
        box-shadow:none;
        margin:0 0 10mm 0;
        page-break-after:always;
      }
    }
  </style>
</head>
<body>
  <div class="mmReportWrap">
    ${sectionHtml}
  </div>
</body>
</html>`;
}

function collectCurrentDocumentStyles() {
  try {
    const sheets = Array.from(document.styleSheets || []);
    let cssText = "";
    for (const sheet of sheets) {
      try {
        const rules = Array.from(sheet.cssRules || []);
        cssText += rules.map((r) => r.cssText).join("\n");
      } catch (_) {
        // Ignore stylesheets that are not readable due to browser security rules.
      }
    }
    return cssText.trim();
  } catch (_) {
    return "";
  }
}
