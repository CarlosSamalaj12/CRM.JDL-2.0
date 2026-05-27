import authService from '../services/authService';
import { modernAlert } from './toast';

function escapeHtml(unsafe) {
  return String(unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildTemplatePrintContextFromQuoteData(quote, user) {
  const d = quote.date ? new Date(`${quote.date}T00:00:00`) : new Date();
  const monthName = d.toLocaleDateString("es-GT", { month: "long" });
  
  return {
    VENDEDOR_NOMBRE: user?.name || "Vendedor",
    CLIENTE_NOMBRE: quote?.contact || "",
    CLIENTE_EMPRESA: quote?.companyName || "",
    VENDEDOR_FIRMA_URL: user?.signatureDataUrl || "",
    NO_DOC: quote?.code || "",
    LUGAR: quote?.venue || "Panajachel, Sololá",
    FECHA: d.toLocaleDateString("es-GT"),
    DIA: String(d.getDate()),
    MES: monthName,
    ANIO: String(d.getFullYear())
  };
}

function fillTemplateHtmlTokens(htmlText, contextMap) {
  let out = String(htmlText || "");
  const pairs = Object.entries(contextMap || {});
  for (const [key, rawValue] of pairs) {
    const token = "{{" + String(key) + "}}";
    const textValue = String(rawValue || "");
    // Si es URL (como la firma) no la escapamos
    const value = /_URL$/i.test(String(key)) ? textValue : escapeHtml(textValue);
    out = out.split(token).join(value);
  }
  return out;
}

export const generateQuotePrintDocument = async (quote, user) => {
  const printWin = window.open('', '_blank');
  if (!printWin) {
    modernAlert({ icon: 'warning', title: 'Bloqueador activo', text: 'Bloqueador de ventanas emergentes activado. Habilítalo para ver la cotización.' });
    return false;
  }
  printWin.document.open();
  printWin.document.write(`<!doctype html><html><head><title>Preparando cotizacion</title></head><body style="font-family:Arial,sans-serif;padding:24px;">Preparando vista previa de cotizacion...</body></html>`);
  printWin.document.close();

  try {
    let htmlContent = '';
    let isServiHospTemplate = false;

    // 1. Determinar si usa plantilla de contrato y descargarla
    if (quote.templateId) {
      let fileName = '';
      if (quote.templateId === 'contrato_corp' || quote.templateId === 'contrato_social') {
        fileName = 'Jardines.html';
      } else if (quote.templateId === 'contrato_hosp') {
        fileName = 'ServiHosp.html';
        isServiHospTemplate = true;
      }

      if (fileName) {
        const res = await fetch(`/templates/${fileName}`);
        if (res.ok) {
          let tplHtml = await res.text();
          
          // Reemplazar rutas de imágenes locales de la plantilla
          tplHtml = tplHtml.replace(/src="([a-zA-Z0-9_.-]+)"/g, 'src="/templates/$1"');

          const contextMap = buildTemplatePrintContextFromQuoteData(quote, user);
          tplHtml = fillTemplateHtmlTokens(tplHtml, contextMap);

          const parser = new DOMParser();
          const tplDoc = parser.parseFromString(tplHtml, "text/html");

          // Limpiar estilos originales de impresión que causan conflicto
          const rawTplStyleText = tplDoc.head
            ? Array.from(tplDoc.head.querySelectorAll("style"))
                .map((node) => node.textContent || "")
                .join("\n")
            : "";
          const tplStyleText = rawTplStyleText
            .replace(/@media print\s*\{[\s\S]*?\}(?=\.[a-zA-Z0-9_-]+\{|[a-z]+\{|$)/g, "")
            .replace(/@page\s*\{[\s\S]*?\}/g, "")
            .replace(/html,body\{[\s\S]*?\}/g, "");

          let tplBody = tplDoc.body ? tplDoc.body.innerHTML : tplHtml;

          if (tplDoc.body) {
            // Extraer encabezados y pies de página
            const headerImg = tplDoc.body.querySelector(".contract-header img, .contract-header-print img");
            const footerImg = isServiHospTemplate ? null : tplDoc.body.querySelector(".contract-footer img, .contract-footer-print img");
            
            // Eliminar los originales del body
            tplDoc.body
              .querySelectorAll(".contract-header, .contract-header-print, .contract-footer, .contract-footer-print, script")
              .forEach((node) => node.remove());

            if (headerImg || footerImg) {
              const repeatFrameStyles = `<style>
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
              </style>`;

              const repeatHead = headerImg ? `<tr class="contractPrintHead"><td class="contractPrintCell">${headerImg.outerHTML}</td></tr>` : "";
              const repeatFoot = footerImg ? `<tr class="contractPrintFoot"><td class="contractPrintCell">${footerImg.outerHTML}</td></tr>` : "";
              const bodyRows = Array.from(tplDoc.body.children)
                .map((node) => `<tr class="contractPrintRow"><td class="contractPrintContent">${node.outerHTML}</td></tr>`)
                .join("");

              tplBody = `${repeatFrameStyles}<table class="contractPrintFrame"><thead>${repeatHead}</thead><tfoot>${repeatFoot}</tfoot><tbody>${bodyRows}</tbody></table>`;
            } else {
              tplBody = tplDoc.body.innerHTML;
            }
          }

          htmlContent = `
            <style>${tplStyleText}</style>
            <div class="templateAttachBody">
              <div class="templateAttach" style="margin-top:20px; font-family:Arial,sans-serif;">
                ${tplBody}
              </div>
            </div>`;
        }
      }
    }

    // 2. Construir la tabla de cotización
    let itemsTableRows = '';
    (quote.items || []).forEach(item => {
      const qty = Number(item.qty ?? item.quantity ?? 0);
      const price = Number(item.price || 0);
      const total = Number(item.total ?? (qty * price));
      itemsTableRows += `
        <tr>
          <td style="text-align:center;">${qty.toFixed(0)}</td>
          <td>
            <div style="font-weight:bold;">${escapeHtml(item.name)}</div>
            ${item.description ? `<div style="font-size:10px;color:#666;">${escapeHtml(item.description)}</div>` : ''}
          </td>
          <td style="text-align:right;">Q ${price.toFixed(2)}</td>
          <td style="text-align:right;">Q ${total.toFixed(2)}</td>
        </tr>
      `;
    });

    const quoteTableHtml = `
      <div style="font-family:Arial,sans-serif; max-width:800px; margin:0 auto; padding:20px;">
        <h2 style="text-align:center; margin-bottom:20px; color:#1f3b4d;">Cotización de Evento</h2>
        
        <table style="width:100%; margin-bottom:20px; border-collapse:collapse;">
          <tr>
            <td style="width:50%; vertical-align:top;">
              <strong>Empresa:</strong> ${escapeHtml(quote.companyName)}<br/>
              <strong>Contacto:</strong> ${escapeHtml(quote.contact)}<br/>
              <strong>Teléfono:</strong> ${escapeHtml(quote.phone)}<br/>
              <strong>Email:</strong> ${escapeHtml(quote.email)}<br/>
            </td>
            <td style="width:50%; vertical-align:top; text-align:right;">
              <strong>Fecha Emisión:</strong> ${escapeHtml(quote.docDate || quote.quotedAt?.split('T')[0] || new Date().toISOString().split('T')[0])}<br/>
              <strong>Fecha Evento:</strong> ${escapeHtml(quote.eventDate || '')}<br/>
              <strong>Tipo de Evento:</strong> ${escapeHtml(quote.eventType)}<br/>
              <strong>Lugar/Salón:</strong> ${escapeHtml(quote.venue)}<br/>
              <strong>Código:</strong> <span style="color:#d97706; font-weight:bold;">${escapeHtml(quote.code)}</span>
            </td>
          </tr>
        </table>

        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;" border="1">
          <thead>
            <tr style="background:#e5f5f6; color:#1f3b4d;">
              <th style="padding:8px;">CANT.</th>
              <th style="padding:8px;">SERVICIO</th>
              <th style="padding:8px;">PRECIO U.</th>
              <th style="padding:8px;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsTableRows}
          </tbody>
        </table>

        <div style="text-align:right; margin-bottom:30px;">
          <p><strong>Subtotal:</strong> Q ${Number(quote.subtotal || 0).toFixed(2)}</p>
          <p><strong>Descuento:</strong> Q ${Number(quote.discountAmount || 0).toFixed(2)}</p>
          <h3 style="color:#1f3b4d;">Total: Q ${Number(quote.total || 0).toFixed(2)}</h3>
        </div>
      </div>
    `;

    // 3. Juntar todo y abrir ventana
    const finalHtml = `
      <html>
        <head>
          <title>Cotización ${quote.code}</title>
          <style>
            body { font-family: Arial, sans-serif; margin:0; padding:0; }
            table { width:100%; border-collapse:collapse; }
            th, td { padding:8px; }
            @media print {
              html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none !important; }
              .page-break { break-before: page; page-break-before: always; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="background:#f1f5f9; padding:15px; text-align:center; border-bottom:1px solid #cbd5e1;">
            <button onclick="window.print()" style="background:#10b981; color:white; border:none; padding:10px 20px; font-size:16px; border-radius:4px; cursor:pointer; font-weight:bold;">Imprimir Documento</button>
          </div>
          
          ${quoteTableHtml}
          ${htmlContent ? `<div class="page-break"></div>${htmlContent}` : ''}
          
        </body>
      </html>
    `;

    // La ventana se abre al inicio para evitar bloqueadores de popups.
    if (false) {
      modernAlert({ icon: 'warning', title: 'Bloqueador activo', text: 'Bloqueador de ventanas emergentes activado. Habilítalo para ver la cotización.' });
      return false;
    }

    printWin.document.open();
    printWin.document.write(finalHtml);
    printWin.document.close();
    
    // Auto imprimir
    setTimeout(() => {
      if(printWin) printWin.print();
    }, 500);

    return true;
  } catch (err) {
    console.error("Error generating print document:", err);
    try {
      printWin.document.open();
      printWin.document.write(`<!doctype html><html><body style="font-family:Arial,sans-serif;padding:24px;"><h2>No se pudo generar la cotizacion</h2><p>Revise los datos de la cotizacion e intente nuevamente.</p></body></html>`);
      printWin.document.close();
    } catch (_) {}
    return false;
  }
};
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

