import { modernAlert } from './toast';
import { loadState } from '../services/stateService';
import { numberToWords } from './numberToWords';

function escapeHtml(unsafe) {
  return String(unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildTemplatePrintContextFromQuoteData(quote, user) {
  const rawDate = quote.date || quote.docDate || quote.eventDate;
  let d = new Date();
  if (rawDate) {
    let dateStr = String(rawDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      dateStr = `${dateStr}T00:00:00`;
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    }
  }

  let monthName = "";
  try {
    monthName = d.toLocaleDateString("es-GT", { month: "long" });
  } catch {
    monthName = "";
  }

  let formattedDate = "";
  try {
    formattedDate = d.toLocaleDateString("es-GT");
  } catch {
    formattedDate = "";
  }

  return {
    VENDEDOR_NOMBRE: user?.name || "Vendedor",
    CLIENTE_NOMBRE: quote?.contact || "",
    CLIENTE_EMPRESA: quote?.companyName || "",
    VENDEDOR_FIRMA_URL: user?.signatureDataUrl || "",
    NO_DOC: quote?.code || "",
    LUGAR: quote?.venue || "Panajachel, Sololá",
    FECHA: formattedDate,
    DIA: String(d.getDate() || ""),
    MES: monthName,
    ANIO: String(d.getFullYear() || "")
  };
}

function fillTemplateHtmlTokens(htmlText, contextMap) {
  let out = String(htmlText || "");
  const pairs = Object.entries(contextMap || {});
  for (const [key, rawValue] of pairs) {
    const token = "{{" + String(key) + "}}";
    const textValue = String(rawValue || "");
    const value = /_URL$/i.test(String(key)) ? textValue : escapeHtml(textValue);
    out = out.split(token).join(value);
  }
  return out;
}

function quoteMoney(value, currency = 'GTQ') {
  const sym = currency === 'USD' ? '$' : 'Q';
  return `${sym} ${Number(value || 0).toFixed(2)}`;
}

function normalizeDocDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

function formatAdvanceDetail(advanceLike) {
  const advance = advanceLike || {};
  const parts = [];
  if (advance.paymentType) parts.push(String(advance.paymentType));
  if (advance.voucherNumber) parts.push(`Ref. ${advance.voucherNumber}`);
  if (advance.description) parts.push(String(advance.description));
  return parts.join(" · ") || "Anticipo";
}

function classifyQuoteItem(item) {
  const haystack = [
    item?.category,
    item?.subcategory,
    item?.name,
    item?.description
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (haystack.includes("hospedaje terceros")) return "Hospedaje terceros";
  if (haystack.includes("hospedaje")) return "Hospedaje jdl";
  if (
    haystack.includes("alimento") ||
    haystack.includes("bebida") ||
    haystack.includes("menu") ||
    haystack.includes("coffee") ||
    haystack.includes("desayuno") ||
    haystack.includes("almuerzo") ||
    haystack.includes("cena")
  ) {
    return "Alimentos y bebidas";
  }
  return "Miscelaneos";
}

function buildQuoteRowsHtml(items, docCurrency = 'GTQ') {
  const grouped = new Map();
  items.forEach((item) => {
    const dateKey = normalizeDocDate(item?.serviceDate || item?.date || item?.eventDate || "") || "Servicios";
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey).push(item);
  });

  return Array.from(grouped.keys())
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map((dateKey, index, keys) => {
      const dayItems = grouped.get(dateKey) || [];
      const showDayHeader = keys.length > 1 || dateKey !== "Servicios";
      const rows = [];

      if (showDayHeader) {
        rows.push(`
          <tr class="dayHeaderRow">
            <td colspan="4">${escapeHtml(dateKey)}</td>
          </tr>
        `);
      }

      let daySubtotal = 0;
      dayItems.forEach((item) => {
        const qty = Number(item?.qty ?? item?.quantity ?? 0);
        const price = Number(item?.price || 0);
        const total = Number(item?.total ?? qty * price);
        daySubtotal += total;
        rows.push(`
          <tr>
            <td>${qty.toFixed(0)}</td>
            <td>
              <div style="font-weight:700;">${escapeHtml(item?.name || "")}</div>
              ${item?.description ? `<div style="font-size:10px;color:#577082;margin-top:2px;">${escapeHtml(item.description)}</div>` : ""}
            </td>
            <td>${quoteMoney(price, docCurrency)}</td>
            <td>${quoteMoney(total, docCurrency)}</td>
          </tr>
        `);
      });

      if (showDayHeader && dayItems.length > 1) {
        rows.push(`
          <tr class="daySubtotalRow">
            <td colspan="2">Subtotal ${escapeHtml(dateKey)}</td>
            <td colspan="2" style="text-align:right;">${quoteMoney(daySubtotal, docCurrency)}</td>
          </tr>
        `);
      }

      return rows.join("");
    })
    .join("");
}

export const generateQuotePrintDocument = async (quote, user, printOption = "standard", event = null) => {
  const printWin = window.open("", "_blank");
  if (!printWin) {
    modernAlert({ icon: "warning", title: "Bloqueador activo", text: "Bloqueador de ventanas emergentes activado. Habilítalo para ver la cotización." });
    return false;
  }

  printWin.document.open();
  printWin.document.write(`<!doctype html><html><head><title>Preparando cotizacion</title></head><body style="font-family:Arial,sans-serif;padding:24px;">Preparando vista previa de cotizacion...</body></html>`);
  printWin.document.close();

  try {
    let htmlContent = "";
      let isServiHospTemplate = false;

    if (quote.templateId && printOption !== "sin_precios") {
      let fileName = "";
      if (quote.templateId === "contrato_corp" || quote.templateId === "contrato_social") {
        fileName = "Jardines.html";
      } else if (quote.templateId === "contrato_hosp") {
        fileName = "ServiHosp.html";
        isServiHospTemplate = true;
      }

      if (fileName) {
        const res = await fetch(`/templates/${fileName}`);
        if (res.ok) {
          let tplHtml = await res.text();
          tplHtml = tplHtml.replace(/src="([a-zA-Z0-9_.-]+)"/g, 'src="/templates/$1"');

          const contextMap = buildTemplatePrintContextFromQuoteData(quote, user);
          tplHtml = fillTemplateHtmlTokens(tplHtml, contextMap);

          const parser = new DOMParser();
          const tplDoc = parser.parseFromString(tplHtml, "text/html");
          const rawTplStyleText = tplDoc.head
            ? Array.from(tplDoc.head.querySelectorAll("style")).map((node) => node.textContent || "").join("\n")
            : "";
          const tplStyleText = rawTplStyleText
            .replace(/@media print\s*\{[\s\S]*?\}(?=\.[a-zA-Z0-9_-]+\{|[a-z]+\{|$)/g, "")
            .replace(/@page\s*\{[\s\S]*?\}/g, "")
            .replace(/html,body\{[\s\S]*?\}/g, "");

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
              const repeatHead = headerImg ? `<tr class="contractPrintHead"><td class="contractPrintCell">${headerImg.outerHTML}</td></tr>` : "";
              const repeatFoot = footerImg ? `<tr class="contractPrintFoot"><td class="contractPrintCell">${footerImg.outerHTML}</td></tr>` : "";
              const bodyRows = Array.from(tplDoc.body.children)
                .map((node) => `<tr class="contractPrintRow"><td class="contractPrintContent">${node.outerHTML}</td></tr>`)
                .join("");

              tplBody = `
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
                <table class="contractPrintFrame"><thead>${repeatHead}</thead><tfoot>${repeatFoot}</tfoot><tbody>${bodyRows}</tbody></table>
              `;
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
            </div>
          `;
        }
      }
    }

    let companies = [];
    let users = [];
    try {
      const crmState = await loadState();
      companies = Array.isArray(crmState?.companies) ? crmState.companies : [];
      users = Array.isArray(crmState?.users) ? crmState.users : [];
    } catch (err) {
      console.error("Error loading CRM state for print:", err);
    }

    let mmContentHtml = "";
    if (printOption === "completa" || printOption === "sin_precios") {
      let quoteWithMm = quote;
      if (!quote.menuMontajeEntries?.length) {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        let info = null;
        const tryFetch = async (url) => {
          const res = await fetch(url, { headers });
          if (res.ok) return await res.json();
          return null;
        };
        try {
          const occId = quote.id || event?.id;
          if (occId) {
            info = await tryFetch(`${apiBase}/api/informes/${occId}`);
          }
          if (!info) {
            // Try stripping slot suffix from occId (evt_xxx_s1_20260620 -> evt_xxx)
            if (occId) {
              const baseId = String(occId).replace(/_(s|slot)\d+_\d{6,}$/, '');
              if (baseId !== String(occId)) {
                info = await tryFetch(`${apiBase}/api/informes/${baseId}`);
              }
            }
          }
          if (!info) {
            const nombre = event?.name || quote.companyName;
            const fecha = event?.date || quote.eventDate;
            const salon = event?.salon || quote.venue;
            if (fecha) {
              const params = new URLSearchParams({ fecha });
              if (nombre) params.set('nombre', nombre);
              if (salon) params.set('salon', salon);
              info = await tryFetch(`${apiBase}/api/informes/por-evento?${params}`);
            }
          }
        } catch (e) {
          console.warn("No se pudieron cargar menus del POS:", e);
        }
        if (info?.dias?.length) {
          const eventSalon = info.Salon || quote.salon || event?.salon || 'Salón';
          const entries = info.dias.map(d => {
            const itemsList = Array.isArray(d.items) ? d.items : [];
            const menuText = itemsList.map(item =>
              [item.ingrediente_nombre,
               item.cantidad_total ? `x${item.cantidad_total}` : '',
               item.opcion_nombre ? `(${item.opcion_nombre})` : '',
               item.notas ? `- ${item.notas}` : ''
              ].filter(Boolean).join(' ')
            ).join('\n') || 'Sin platillo asignado';
            let montajeText = '';
            if (d.descripcion_montaje) {
              try {
                const parsed = typeof d.descripcion_montaje === 'string'
                  ? JSON.parse(d.descripcion_montaje)
                  : d.descripcion_montaje;
                if (parsed?._v === 2) {
                  const mjs = Array.isArray(parsed.montajes) ? parsed.montajes : [];
                  const LABEL_MAP = { salon: 'Salón', tipo_montaje: 'Tipo de montaje', num_personas: 'No. Personas', horario: 'Horario', equipo_necesario: 'Equipo necesario', manteleria: 'Mantelería', cristaleria: 'Cristalería', mesas: 'Mesas', sillas: 'Sillas' };
                  montajeText = mjs.map(m => {
                    const raw = m?.descripcion ?? m ?? '';
                    if (typeof raw === 'string') return raw;
                    if (typeof raw === 'object' && raw !== null) {
                      if (raw.text) return raw.text;
                      if (Array.isArray(raw.partes)) return raw.partes.map(p => typeof p === 'object' ? (p.text || p.nombre || '') : String(p)).filter(Boolean).join(', ');
                      const lines = [];
                      for (const [key, val] of Object.entries(raw)) {
                        if (val === null || val === undefined || val === '') continue;
                        const label = LABEL_MAP[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
                        lines.push(`${label}: ${String(val)}`);
                      }
                      return lines.join('\n');
                    }
                    return String(raw);
                  }).filter(Boolean).join('\n');
                  if (parsed.alertaCustom?.trim()) {
                    montajeText += `\n[Alertas]\n${parsed.alertaCustom}`;
                  }
                  if (Array.isArray(parsed.alertas) && parsed.alertas.length) {
                    montajeText += `\n[Alertas]\n${parsed.alertas.join(', ')}`;
                  }
                }
              } catch { /* ignore */ }
            }
            return {
              date: d.fecha_evento ? d.fecha_evento.slice(0, 10) : '',
              salon: eventSalon,
              menuDescription: menuText,
              montajeDescription: montajeText || 'Sin montaje asignado',
            };
          }).filter(e => e.date);
          if (entries.length) {
            quoteWithMm = { ...quote, menuMontajeEntries: entries };
          }
        }
      }
      if (quoteWithMm.menuMontajeEntries?.length) {
        mmContentHtml = buildMenuMontajeSectionHtmlOnly(event, quoteWithMm, "full", { companies, users });
      }
    }

    const items = Array.isArray(quote.items) ? quote.items : [];
    const subtotalDoc = Number(quote.subtotal || items.reduce((sum, item) => {
      const qty = Number(item?.qty ?? item?.quantity ?? 0);
      const price = Number(item?.price || 0);
      return sum + Number(item?.total ?? qty * price);
    }, 0));
    const discountDoc = Number(quote.discountAmount || 0);
    const totalDoc = Number(quote.total || Math.max(0, subtotalDoc - discountDoc));
    const docCurrency = quote.currency || 'GTQ';
    const wordsVal = numberToWords(totalDoc);
    const currencyName = docCurrency === 'USD' ? 'DÓLARES' : 'QUETZALES';
    const totalInWords = `${wordsVal} ${currencyName}`;
    const advances = Array.isArray(quote.advances) ? quote.advances : [];
    const totalAnticiposDoc = advances.reduce((sum, advance) => sum + Number(advance?.amount || 0), 0);
    const saldoDoc = Math.max(0, totalDoc - totalAnticiposDoc);
    const docDate = normalizeDocDate(quote.docDate || quote.quotedAt?.split("T")[0] || new Date().toISOString().slice(0, 10));
    const quoteHeaderSrc = isServiHospTemplate ? "/templates/EncabezadoServ.jpg" : "/templates/Encabezadojdl.png";
    const quoteDocLabel = `COTIZACION ${String(quote.companyName || "JARDINES DEL LAGO").toUpperCase()}`;
    const discountLabel = Number(discountDoc) > 0 && quote.discountType === "PERCENT" && Number(quote.discountValue || 0) > 0
      ? `DESCUENTO (${Number(quote.discountValue).toFixed(2)}%)`
      : "DESCUENTO";
    const itemsRowsHtml = buildQuoteRowsHtml(items, docCurrency);
    const sellerSignatureUrl = user?.signatureDataUrl || (user?.id ? users.find(u => String(u.id) === String(user.id))?.signatureDataUrl : null) || (user?.email ? users.find(u => String(u.email || '').toLowerCase() === String(user.email).toLowerCase())?.signatureDataUrl : null);
    const sellerSignatureHtml = sellerSignatureUrl
      ? `<img class="signatureImage" src="${escapeHtml(sellerSignatureUrl)}" alt="Firma vendedor" />`
      : "";
    const groupedSummary = items.reduce((acc, item) => {
      const key = classifyQuoteItem(item);
      const qty = Number(item?.qty ?? item?.quantity ?? 0);
      const price = Number(item?.price || 0);
      const total = Number(item?.total ?? qty * price);
      acc[key] = (acc[key] || 0) + total;
      return acc;
    }, {});
    const summaryRows = [
      { label: "Alimentos y bebidas", amount: groupedSummary["Alimentos y bebidas"] || 0 },
      { label: "Hospedaje jdl", amount: groupedSummary["Hospedaje jdl"] || 0 },
      { label: "Hospedaje terceros", amount: groupedSummary["Hospedaje terceros"] || 0 },
      { label: "Miscelaneos", amount: groupedSummary["Miscelaneos"] || 0 }
    ];

    const printNoPricesStyles = printOption === "sin_precios" ? `
      .quoteItemsTablePrint col.priceCol,
      .quoteItemsTablePrint col.totalCol,
      .quoteItemsTablePrint th:nth-child(3),
      .quoteItemsTablePrint th:nth-child(4),
      .quoteItemsTablePrint td:nth-child(3),
      .quoteItemsTablePrint td:nth-child(4),
      .quoteItemsTablePrint tfoot,
      .daySubtotalRow,
      .cargoSummarySection {
        display: none !important;
      }
      .quoteItemsTablePrint col.qtyCol { width: 15% !important; }
      .quoteItemsTablePrint col.descCol { width: 85% !important; }
    ` : "";

    const mmStyles = mmContentHtml ? `
      .mmReportWrap {
        --ink:#0f172a;
        --line:#d0c8b0;
        --line2:#e5dfd4;
        --soft:#f7f5f0;
        --brand:#1e3a5f;
        --brand2:#2a4b6e;
        --gold:#c9a961;
        --gold-light:#e8dcc4;
        padding: 0;
        margin-top: 20px;
      }
      .mmReportCard {
        width: 100%;
        margin: 0 auto 20px;
        border: 1px solid var(--line);
        border-radius: 10px;
        overflow: hidden;
        background: #ffffff;
        box-shadow: 0 6px 24px rgba(30,58,95,0.10);
      }
      .mmReportCard::before {
        content: "";
        display: block;
        height: 4px;
        background: linear-gradient(90deg, var(--brand), var(--gold), var(--brand));
      }
      .mmReportHead {
        background: linear-gradient(135deg, var(--brand), var(--brand2));
        color: #fff;
        padding: 14px 16px;
        font-size: 18px;
        font-weight: 800;
        letter-spacing: .6px;
        text-transform: uppercase;
        border-bottom: 2px solid var(--gold);
      }
      .mmReportMeta {
        display: grid;
        grid-template-columns: repeat(2, minmax(200px, 1fr));
        gap: 6px 14px;
        padding: 12px 16px;
        background: var(--soft);
        border-bottom: 1px solid var(--line2);
        font-size: 12.5px;
        line-height: 1.5;
      }
      .mmReportMeta b {
        color: var(--brand);
        font-weight: 700;
      }
      .mmReportBlock {
        padding: 14px 16px;
        border-bottom: 1px solid var(--line2);
      }
      .mmReportBlock:last-child { border-bottom: none; }
      .mmReportTitle {
        margin: 0 0 8px;
        font-size: 15px;
        line-height: 1.2;
        font-weight: 800;
        color: var(--brand);
        text-transform: uppercase;
        letter-spacing: .4px;
        border-bottom: 1px solid var(--gold-light);
        padding-bottom: 6px;
      }
      .mmReportText {
        margin: 0;
        white-space: pre-wrap;
        font-size: 12px;
        line-height: 1.4;
        color: var(--ink);
      }
      .mmReportSection {
        margin-top: 8px;
      }
      .mmReportSection:first-child {
        margin-top: 0;
      }
      .mmReportSubtitle {
        margin: 0 0 5px;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: .3px;
        color: var(--brand);
        text-transform: uppercase;
        border-left: 3px solid var(--gold);
        padding-left: 8px;
      }
      .mmReportStack {
        display: grid;
        gap: 5px;
        margin-left: 10px;
      }
      .mmReportInlineFlow {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 14px;
        margin-left: 10px;
        align-items: baseline;
      }
      .mmReportInlinePair {
        display: inline-flex;
        align-items: baseline;
        gap: 3px;
        white-space: nowrap;
      }
      .mmReportInlineLabel {
        font-size: 12px;
        line-height: 1.4;
        font-weight: 800;
        letter-spacing: .15px;
        text-transform: uppercase;
        color: var(--brand);
        white-space: nowrap;
      }
      .mmReportMiniValue {
        font-size: 12px;
        line-height: 1.4;
        color: #0f172a;
        white-space: nowrap;
      }
      .mmReportSectionLine {
        margin: 0 0 6px 12px;
        font-size: 12px;
        line-height: 1.4;
        color: #0f172a;
      }
      .mmReportHr {
        margin: 8px 0;
        border: none;
        border-top: 1px solid var(--gold-light);
      }
      @media print {
        .mmReportGrid {
          grid-template-columns: repeat(2, minmax(260px, 1fr));
        }
        article.mmReportCard {
          box-shadow: none;
          margin: 0 0 10mm 0;
          page-break-after: always;
        }
        article.mmReportCard:last-of-type {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
      }
    ` : "";

    const finalHtml = `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Cotización ${escapeHtml(quote.code || "")}</title>
          <style>
            :root{
              --paper:#ffffff;
              --surface:#fcfcfd;
              --line:#d5dce3;
              --zebra:#f5f7fa;
              --brand:#1e3a5f;
              --brand-deep:#142c47;
              --brand-muted:#eef1f5;
              --title:#1a2b3d;
            }
            *{ box-sizing:border-box; }
            html,body{ margin:0; padding:0; }
            body{
              font-family:Arial,sans-serif;
              background:#f1f3f6;
              color:#1f3b4d;
              -webkit-print-color-adjust:exact;
              print-color-adjust:exact;
            }
            .doc{
              width:min(1080px,100%);
              margin:0 auto;
              background:var(--paper);
              box-shadow:0 10px 28px rgba(15,23,42,.12);
            }
            .quoteContractHeader img{
              display:block;
              width:100%;
              height:auto;
              max-height:92px;
              object-fit:contain;
              object-position:center top;
            }
            .head{
              background:var(--brand);
              color:#fff;
              padding:11px 16px;
              font-weight:800;
              font-size:13px;
              letter-spacing:.42px;
              text-transform:uppercase;
            }
            .quoteMetaTable{
              width:100%;
              border-collapse:collapse;
              table-layout:fixed;
              margin:0 0 10px;
              border-top:3px solid rgba(30,58,95,.25);
              border-left:1px solid var(--line);
              border-right:1px solid var(--line);
              background:var(--surface);
            }
            .quoteMetaTable col.metaLabel{ width:13%; }
            .quoteMetaTable col.metaValue{ width:20.333%; }
            .quoteMetaTable td{
              border-bottom:1px solid var(--line);
              border-right:1px solid var(--line);
              padding:6px 8px;
              font-size:12px;
              color:#274152;
              vertical-align:middle;
              background:var(--surface);
            }
            .quoteMetaTable tr td:last-child{ border-right:none; }
            .quoteMetaTable td.metaLabel{ background:#eef1f5; color:var(--title); font-weight:700; }
            .quoteMetaTable td.metaValue{ font-weight:600; }
            .quoteMetaTable tr.metaDivider td{ border-top:2px solid rgba(30,58,95,.28); }
            .quoteMetaTable tr.metaGap td{ padding:0; height:9px; border:none; background:#f5f7fa; }
            table{ width:100%; border-collapse:collapse; }
            .quoteItemsTablePrint{ table-layout:fixed; }
            .quoteItemsTablePrint col.qtyCol{ width:11%; }
            .quoteItemsTablePrint col.descCol{ width:57%; }
            .quoteItemsTablePrint col.priceCol{ width:16%; }
            .quoteItemsTablePrint col.totalCol{ width:16%; }
            thead th{
              background:#eef1f5;
              border:1px solid #d5dce3;
              padding:6px 8px;
              text-align:center;
              font-size:11.5px;
              font-weight:800;
              color:var(--title);
              text-transform:uppercase;
            }
            tbody td{
              border:1px solid var(--line);
              padding:7px 9px;
              font-size:12px;
              background:var(--surface);
              color:#1f3b4d;
            }
            .quoteItemsTablePrint tbody td:nth-child(1){ text-align:center; border-right:2px solid #d5dce3; }
            .quoteItemsTablePrint tbody td:nth-child(3),
            .quoteItemsTablePrint tbody td:nth-child(4){ text-align:right; font-variant-numeric:tabular-nums; }
            tbody tr:nth-child(even):not(.dayHeaderRow):not(.daySubtotalRow) td{ background:var(--zebra); }
            .dayHeaderRow td{
              background:var(--brand);
              color:#fff !important;
              font-weight:800;
              text-transform:uppercase;
              text-align:center;
              padding:6px 9px;
            }
            .daySubtotalRow td{
              background:var(--brand-muted) !important;
              color:var(--title);
              font-weight:700;
            }
            tfoot td{ border:1px solid #d5dce3; padding:6px 8px; font-size:11px; background:#eef1f5; color:var(--title); }
            .sumLabel{ text-align:right; font-weight:700; color:var(--title); background:#edf0f4; }
            .sumValue{ text-align:right; font-weight:800; color:var(--title); background:#edf0f4; }
            .sumTotal .sumLabel,.sumTotal .sumValue{ background:var(--brand-deep); color:#fff; font-size:12.2px; }
            .policyTitle{
              margin-top:9px;
              background:var(--brand);
              color:#fff;
              font-weight:800;
              text-align:center;
              padding:4px 8px;
              text-transform:uppercase;
            }
            .policyBox{
              border:1px solid #c5ced7;
              border-top:none;
              padding:7px 9px;
              font-size:10.4px;
              line-height:1.4;
              background:#fafbfc;
            }
            .policyBox p{ margin:0 0 6px; }
            .policyBox p:last-child{ margin-bottom:0; }
            .cargoSummaryWrap{
              margin:0 0 11px;
              border:1px solid #cdd5dd;
              border-top:none;
              border-radius:0 0 12px 12px;
              overflow:hidden;
              background:var(--surface);
            }
            .cargoTable{ width:100%; border-collapse:collapse; table-layout:fixed; font-size:12px; }
            .cargoTable col:first-child{ width:72%; }
            .cargoTable col:last-child{ width:28%; }
            .cargoTable th,.cargoTable td{ padding:9px 10px; border-bottom:1px solid var(--line); }
            .cargoTable thead th{ background:#eef1f5; color:var(--title); font-size:11px; font-weight:800; text-transform:uppercase; }
            .cargoTable thead th:first-child{ text-align:left; border-right:1px solid var(--line); }
            .cargoTable thead th:last-child,.cargoAmount{ text-align:right; }
            .cargoTable tbody td:first-child{ border-right:1px solid var(--line); }
            .cargoLabel{ font-weight:700; color:#1f3b4d; }
            .cargoAmount{ white-space:nowrap; font-weight:800; color:var(--title); }
            .cargoEm{ font-weight:800; background:#edf0f4 !important; }
            .cargoEmFinal{ background:var(--brand-deep) !important; }
            .cargoEmFinal .cargoLabel,.cargoEmFinal .cargoAmount{ color:#fff; }
            .signatureSection{
              margin:10px 12px 0;
              padding:14px 10px 8px;
              border:1px solid #d5dce3;
              border-radius:12px;
              background:#fff;
            }
            .signatureGrid{ display:grid; grid-template-columns:1fr 1fr; gap:24px; }
            .signatureCard{ padding:6px 10px; min-height:120px; display:flex; flex-direction:column; align-items:center; text-align:center; }
            .signatureSignArea{
              width:100%;
              min-height:72px;
              display:flex;
              align-items:flex-end;
              justify-content:center;
              margin-bottom:8px;
              background:#fff;
              border:1px solid #dfe5ec;
              border-radius:6px;
            }
            .signatureImage{ max-height:68px; width:auto; max-width:320px; object-fit:contain; display:block; padding:2px 6px; }
            .signatureLine{ width:78%; max-width:320px; border-top:2px solid #8a9aaa; margin:0 auto; }
            .signatureRole{ font-weight:800; color:var(--title); text-transform:uppercase; font-size:11px; margin:6px 0; }
            .signatureData{ margin:2px 0; font-size:11px; color:#1f3b4d; line-height:1.35; width:100%; }
            .templateAttach{ border-top:1px solid var(--line); background:#f5f7fa; padding:12px 12px 0; }
            .templateAttachBody{ background:var(--surface); border:1px solid var(--line); border-radius:12px; overflow:visible; font-size:10px; line-height:1.15; }
            .actions{
              padding:12px;
              display:flex;
              justify-content:flex-end;
              gap:8px;
              border-top:1px solid var(--line);
              background:#f3f5f8;
            }
            .actions button{
              border:1px solid rgba(30,58,95,.25);
              background:#fff;
              color:var(--title);
              border-radius:10px;
              padding:7px 12px;
              font-weight:700;
              cursor:pointer;
            }
            @page {
              size: letter;
              margin: 10mm;
            }
            @media print{
              html,body{ -webkit-print-color-adjust:exact; print-color-adjust:exact; background:#fff; margin:0; padding:0; }
              .actions{ display:none !important; }
              .page-break{ break-before:page; page-break-before:always; }
              .doc{ box-shadow:none; margin:0; padding:0; background:transparent; }
              
              /* Optimize heights and paddings on print to avoid page overflows */
              .quoteContractHeader img {
                max-height: 70px !important;
              }
              .head {
                padding: 6px 12px !important;
                font-size: 11.5px !important;
              }
              .quoteMetaTable {
                margin: 0 0 6px !important;
              }
              .quoteMetaTable td {
                padding: 4px 6px !important;
                font-size: 10.5px !important;
              }
              .quoteMetaTable tr.metaGap td {
                height: 5px !important;
              }
              thead th {
                padding: 4px 6px !important;
                font-size: 10.5px !important;
              }
              tbody td {
                padding: 4px 6px !important;
                font-size: 10.5px !important;
              }
              tfoot td {
                padding: 4px 6px !important;
                font-size: 10px !important;
              }
              .policyTitle {
                margin-top: 6px !important;
                padding: 3px 6px !important;
                font-size: 10.5px !important;
              }
              .policyBox {
                padding: 4px 6px !important;
                font-size: 9.5px !important;
                line-height: 1.25 !important;
              }
              .policyBox p {
                margin: 0 0 3px !important;
              }
              .cargoTable th, .cargoTable td {
                padding: 4px 6px !important;
              }
              .cargoSummaryWrap {
                margin: 0 0 6px !important;
              }
              .signatureSection {
                margin: 6px 0 0 !important;
                padding: 8px 10px 4px !important;
              }
              .signatureCard {
                min-height: 90px !important;
                padding: 2px 6px !important;
              }
              .signatureSignArea {
                min-height: 48px !important;
                margin-bottom: 4px !important;
              }
              .signatureImage {
                max-height: 44px !important;
              }
              
              /* Keep sections together */
              .policyBox,
              .cargoSummarySection,
              .signatureSection {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              
              .templateAttachBody{ border:none !important; background:transparent !important; }
              .templateAttach{ border:none !important; background:transparent !important; padding:0 !important; margin:0 !important; }
            }
            ${printNoPricesStyles}
            ${mmStyles}
          </style>
        </head>
        <body>
          <div class="doc">
            <div class="quoteContractHeader">
              <img src="${escapeHtml(quoteHeaderSrc)}" alt="Encabezado cotización" />
            </div>
            <div class="head">${escapeHtml(quoteDocLabel)}</div>

            <table class="quoteMetaTable">
              <colgroup>
                <col class="metaLabel" />
                <col class="metaValue" />
                <col class="metaValue" />
                <col class="metaLabel" />
                <col class="metaValue" />
                <col class="metaValue" />
              </colgroup>
              <tbody>
                <tr>
                  <td class="metaLabel">Codigo</td>
                  <td class="metaValue" colspan="2">${escapeHtml(quote.code || "")}</td>
                  <td class="metaLabel">Fecha Doc</td>
                  <td class="metaValue" colspan="2">${escapeHtml(docDate)}</td>
                </tr>
                <tr>
                  <td class="metaLabel">Encargado</td>
                  <td class="metaValue" colspan="2">${escapeHtml(quote.contact || "")}</td>
                  <td class="metaLabel">Contacto</td>
                  <td class="metaValue" colspan="2">${escapeHtml(quote.contact || "")}</td>
                </tr>
                <tr>
                  <td class="metaLabel">Email</td>
                  <td class="metaValue" colspan="2">${escapeHtml(quote.email || "")}</td>
                  <td class="metaLabel">Telefono</td>
                  <td class="metaValue" colspan="2">${escapeHtml(quote.phone || "")}</td>
                </tr>
                <tr>
                  <td class="metaLabel">Institucion</td>
                  <td class="metaValue" colspan="2">${escapeHtml(quote.companyName || "")}</td>
                  <td class="metaLabel">Facturar A</td>
                  <td class="metaValue" colspan="2">${escapeHtml(quote.billTo || quote.companyName || "")}</td>
                </tr>
                <tr>
                  <td class="metaLabel">Nit</td>
                  <td class="metaValue" colspan="2">${escapeHtml(quote.nit || "")}</td>
                  <td class="metaLabel">Direccion</td>
                  <td class="metaValue" colspan="2">${escapeHtml(quote.address || "")}</td>
                </tr>
                <tr class="metaDivider">
                  <td class="metaLabel">Forma de Pago</td>
                  <td class="metaValue" colspan="2">${escapeHtml(quote.paymentType || "")}</td>
                  <td class="metaLabel">Fecha maximo Pago</td>
                  <td class="metaValue" colspan="2">${escapeHtml(normalizeDocDate(quote.dueDate || ""))}</td>
                </tr>
                <tr class="metaGap"><td colspan="6"></td></tr>
                <tr>
                  <td class="metaLabel">Salon</td>
                  <td class="metaValue">${escapeHtml(quote.venue || "")}</td>
                  <td class="metaLabel">Horario</td>
                  <td class="metaValue">${escapeHtml(quote.schedule || "")}</td>
                  <td class="metaLabel">No Personas</td>
                  <td class="metaValue">${escapeHtml(String(quote.people || ""))}</td>
                </tr>
                <tr>
                  <td class="metaLabel">Tipo de Evento</td>
                  <td class="metaValue" colspan="2">${escapeHtml(quote.eventType || "")}</td>
                  <td class="metaLabel">Folio No</td>
                  <td class="metaValue" colspan="2">${escapeHtml(quote.folio || "")}</td>
                </tr>
                <tr>
                  <td class="metaLabel">Fecha Inicio</td>
                  <td class="metaValue" colspan="2">${escapeHtml(normalizeDocDate(quote.eventDate || ""))}</td>
                  <td class="metaLabel">Fecha Fin</td>
                  <td class="metaValue" colspan="2">${escapeHtml(normalizeDocDate(quote.endDate || quote.eventDate || ""))}</td>
                </tr>
              </tbody>
            </table>

            <table class="quoteItemsTablePrint">
              <colgroup>
                <col class="qtyCol" />
                <col class="descCol" />
                <col class="priceCol" />
                <col class="totalCol" />
              </colgroup>
              <thead>
                <tr>
                  <th>Cantidad</th>
                  <th>Descripcion</th>
                  <th>Precio</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>${itemsRowsHtml}</tbody>
              <tfoot>
                <tr>
                  <td colspan="2"></td>
                  <td class="sumLabel">SUBTOTAL EVENTO</td>
                  <td class="sumValue">${quoteMoney(subtotalDoc, docCurrency)}</td>
                </tr>
                <tr>
                  <td colspan="2"></td>
                  <td class="sumLabel">${escapeHtml(discountLabel)}</td>
                  <td class="sumValue">${quoteMoney(discountDoc, docCurrency)}</td>
                </tr>
                <tr class="sumTotal">
                  <td colspan="2"></td>
                  <td class="sumLabel">TOTAL EVENTO</td>
                  <td class="sumValue">${quoteMoney(totalDoc, docCurrency)}</td>
                </tr>
                <tr class="sumTotalWords">
                  <td colspan="4" style="text-align: left; font-size: 11px; font-weight: 700; color: var(--title); background: var(--brand-muted); padding: 8px 10px; border: 1px solid var(--line); border-top: 2px solid var(--brand-deep);">
                    CANTIDAD EN LETRAS: ${totalInWords}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div class="policyTitle">NOTAS</div>
            <div class="policyBox">
              <p>Incrementos en menos de 24 horas de servicios y/o productos tendran cargo adicional del 10% en relacion con el excedente.</p>
              <p>El monto de anticipo para asegurar el evento depende de las clausulas de formalizacion.</p>
              <p>Estamos sujetos a pagos trimestrales. Aplicamos Clausula de No Show.</p>
              <p>Esta propuesta se formaliza al tener la firma del asesor de ventas y del cliente, junto a comprobante de anticipo y/o orden de compra.</p>
              <p>No se reembolsa el anticipo si no realiza su evento por cualquier causa.</p>
            </div>

            <div class="cargoSummarySection">
              <div class="policyTitle">RESUMEN DE CARGOS</div>
              <div class="cargoSummaryWrap">
                <table class="cargoTable">
                  <colgroup><col /><col /></colgroup>
                  <thead>
                    <tr>
                      <th>Descripcion</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${summaryRows.map((row) => `
                      <tr>
                        <td class="cargoLabel">${escapeHtml(row.label)}</td>
                        <td class="cargoAmount">${row.amount > 0 ? escapeHtml(quoteMoney(row.amount, docCurrency)) : "-"}</td>
                      </tr>
                    `).join("")}
                    <tr class="cargoEm">
                      <td class="cargoLabel">Total contratado</td>
                      <td class="cargoAmount">${totalDoc > 0 ? escapeHtml(quoteMoney(totalDoc, docCurrency)) : "-"}</td>
                    </tr>
                    ${advances.length ? advances.map((advance) => `
                      <tr>
                        <td class="cargoLabel">${escapeHtml(`${normalizeDocDate(advance?.date || "")} - ${formatAdvanceDetail(advance)}`)}</td>
                        <td class="cargoAmount">${Number(advance?.amount || 0) > 0 ? escapeHtml(quoteMoney(advance.amount, docCurrency)) : "-"}</td>
                      </tr>
                    `).join("") : `
                      <tr>
                        <td class="cargoLabel">Anticipos: sin registros</td>
                        <td class="cargoAmount">-</td>
                      </tr>
                    `}
                    <tr class="cargoEm">
                      <td class="cargoLabel">Total anticipos</td>
                      <td class="cargoAmount">${totalAnticiposDoc > 0 ? escapeHtml(quoteMoney(totalAnticiposDoc, docCurrency)) : "-"}</td>
                    </tr>
                    <tr class="cargoEm cargoEmFinal">
                      <td class="cargoLabel">Saldo</td>
                      <td class="cargoAmount">${saldoDoc > 0 ? escapeHtml(quoteMoney(saldoDoc, docCurrency)) : "-"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <section class="signatureSection">
              <div class="signatureGrid">
                <div class="signatureCard">
                  <div class="signatureSignArea">${sellerSignatureHtml}</div>
                  <div class="signatureLine"></div>
                  <div class="signatureRole">Firma Vendedor</div>
                  <div class="signatureData">${escapeHtml(user?.name || "Vendedor")}</div>
                  <div class="signatureData">${escapeHtml(user?.email || "")}</div>
                  <div class="signatureData">${escapeHtml(user?.phone || "")}</div>
                </div>
                <div class="signatureCard">
                  <div class="signatureSignArea"></div>
                  <div class="signatureLine"></div>
                  <div class="signatureRole">Firma Encargado Evento</div>
                  <div class="signatureData">${escapeHtml(quote.contact || "")}</div>
                  <div class="signatureData">${escapeHtml(quote.email || "")}</div>
                  <div class="signatureData">${escapeHtml(quote.phone || "")}</div>
                </div>
              </div>
            </section>

            ${mmContentHtml ? `<div class="page-break mmReportWrap">${mmContentHtml}</div>` : ""}

            ${htmlContent ? `<div class="page-break templateAttachWrap">${htmlContent}</div>` : ""}

            <section class="signatureSection">
              <div class="signatureGrid">
                <div class="signatureCard">
                  <div class="signatureSignArea">${sellerSignatureHtml}</div>
                  <div class="signatureLine"></div>
                  <div class="signatureRole">Firma Vendedor</div>
                  <div class="signatureData">${escapeHtml(user?.name || "Vendedor")}</div>
                  <div class="signatureData">${escapeHtml(user?.email || "")}</div>
                  <div class="signatureData">${escapeHtml(user?.phone || "")}</div>
                </div>
                <div class="signatureCard">
                  <div class="signatureSignArea"></div>
                  <div class="signatureLine"></div>
                  <div class="signatureRole">Firma Encargado Evento</div>
                  <div class="signatureData">${escapeHtml(quote.contact || "")}</div>
                  <div class="signatureData">${escapeHtml(quote.email || "")}</div>
                  <div class="signatureData">${escapeHtml(quote.phone || "")}</div>
                </div>
              </div>
            </section>

            <div class="actions">
              <button onclick="window.print()">Imprimir</button>
            </div>
          </div>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(finalHtml);
    printWin.document.close();
    return true;
  } catch (err) {
    console.error("Error generating print document:", err);
    try {
      printWin.document.open();
      printWin.document.write(`<!doctype html><html><body style="font-family:Arial,sans-serif;padding:24px;"><h2>No se pudo generar la cotizacion</h2><p>Revise los datos de la cotizacion e intente nuevamente.</p></body></html>`);
      printWin.document.close();
    } catch {
      // ignore
    }
    return false;
  }
};

export function renderMenuMontajeRichText(rawText) {
  const value = String(rawText || "").trim();
  if (!value) return `<p class="mmReportText">-</p>`;
  const lines = String(rawText || "").split(/\r?\n/);
  const htmlParts = [];
  let paragraphBuffer = [];
  let sectionTitle = "";
  let sectionItems = [];
  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const chunk = paragraphBuffer.join("\n");
    htmlParts.push(`<p class="mmReportText">${escapeHtml(chunk)}</p>`);
    paragraphBuffer = [];
  };
  const flushSection = () => {
    if (!sectionTitle) return;
    if (/^PLATO\s+\d+$/i.test(sectionTitle) && sectionItems.length) {
      const compactSegments = sectionItems
        .flatMap((item) => String(item || "").split(/\s+\|\s+/))
        .map((item) => String(item || "").trim())
        .filter(Boolean);
      const rows = compactSegments.map((segment) => {
        const match = segment.match(/^([^()]+?)\s*\((.*)\)$/);
        if (match) {
          return {
            label: String(match[1] || "").trim().toUpperCase(),
            value: String(match[2] || "").trim() || "-",
          };
        }
        return { label: "DETALLE", value: segment };
      });
      htmlParts.push(`
        <section class="mmReportSection">
          <div class="mmReportSubtitle">${escapeHtml(sectionTitle)}</div>
          <div class="mmReportInlineFlow">
            ${rows.map((row) => `
              <span class="mmReportInlinePair"><span class="mmReportInlineLabel">[${escapeHtml(row.label)}]</span> <span class="mmReportMiniValue">${escapeHtml(row.value)}</span></span>
            `).join("")}
          </div>
        </section>
      `);
      sectionTitle = "";
      sectionItems = [];
      return;
    }
    if (/^MONTAJE$/i.test(sectionTitle) && sectionItems.length) {
      const compactSegments = sectionItems
        .flatMap((item) => String(item || "").split(/\s+\|\s+/))
        .map((item) => String(item || "").trim())
        .filter(Boolean);
      const rows = compactSegments.map((segment) => {
        const match = segment.match(/^([^()]+?)\s*\((.*)\)$/);
        if (match) {
          return {
            label: String(match[1] || "").trim().toUpperCase(),
            value: String(match[2] || "").trim() || "-",
          };
        }
        const pair = segment.match(/^([^:]+):\s*(.*)$/);
        if (pair) {
          return {
            label: String(pair[1] || "").trim().toUpperCase(),
            value: String(pair[2] || "").trim() || "-",
          };
        }
        return { label: "DETALLE", value: segment };
      });
      htmlParts.push(`
        <section class="mmReportSection">
          <div class="mmReportSubtitle">${escapeHtml(sectionTitle)}</div>
          <div class="mmReportInlineFlow">
            ${rows.map((row) => `
              <span class="mmReportInlinePair"><span class="mmReportInlineLabel">[${escapeHtml(row.label)}]</span> <span class="mmReportMiniValue">${escapeHtml(row.value)}</span></span>
            `).join("")}
          </div>
        </section>
      `);
      sectionTitle = "";
      sectionItems = [];
      return;
    }
    const textValue = sectionItems.length ? sectionItems.join(" | ") : "-";
    const itemsHtml = `<p class="mmReportSectionLine">${escapeHtml(textValue)}</p>`;
    htmlParts.push(`
      <section class="mmReportSection">
        <div class="mmReportSubtitle">${escapeHtml(sectionTitle)}</div>
        ${itemsHtml}
      </section>
    `);
    sectionTitle = "";
    sectionItems = [];
  };
  for (const line of lines) {
    const normalized = String(line || "").trim();
    if (/^<hr\s*\/?>$/i.test(normalized) || /^[-_]{6,}$/.test(normalized) || /^\[\[HR\]\]$/i.test(normalized)) {
      flushParagraph();
      flushSection();
      htmlParts.push(`<hr class="mmReportHr" />`);
      continue;
    }
    const sectionMatch = normalized.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      flushParagraph();
      flushSection();
      sectionTitle = String(sectionMatch[1] || "").trim();
      continue;
    }
    if (!normalized) {
      flushParagraph();
      flushSection();
      continue;
    }
    if (sectionTitle) {
      const content = normalized.replace(/^-+\s*/, "");
      if (content) sectionItems.push(content);
      continue;
    }
    paragraphBuffer.push(line);
  }
  flushParagraph();
  flushSection();
  return htmlParts.join("") || `<p class="mmReportText">-</p>`;
}

export function buildMenuMontajeSectionHtmlOnly(ev, quoteLike, reportMode = "full", { companies = [], users = [] } = {}) {
  const quote = quoteLike || {};
  const entries = (Array.isArray(quote?.menuMontajeEntries) ? quote.menuMontajeEntries : [])
    .filter((x) => String(x?.date || "").trim() && String(x?.salon || "").trim());
  if (!entries.length) return "";
  const company = (companies || []).find((c) => String(c.id || "") === String(quote.companyId || ""));
  const institutionName = String(company?.name || quote.companyName || "-").trim() || "-";
  const manager = company?.managers?.find((m) => String(m.id || "") === String(quote.managerId || ""));
  const seller = (users || []).find((u) => String(u.id || "") === String(ev?.userId || ""));

  const byDate = new Map();
  for (const row of entries) {
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(row);
  }
  const orderedDates = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b));

  return orderedDates.map((date, idx) => {
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

    const isLast = idx === orderedDates.length - 1;
    const pageBreakStyle = isLast ? "" : "page-break-after: always;";

    return `
      <article class="mmReportCard" style="${pageBreakStyle}">
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
}

export function buildMenuMontajeReportHtml(ev, quoteLike, reportMode = "full", { companies = [], users = [] } = {}) {
  const quote = quoteLike || {};
  const company = (companies || []).find((c) => String(c.id || "") === String(quote.companyId || ""));
  const institutionName = String(company?.name || quote.companyName || "-").trim() || "-";

  const sectionHtml = buildMenuMontajeSectionHtmlOnly(ev, quoteLike, reportMode, { companies, users });

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
      --line:#d0c8b0;
      --line2:#e5dfd4;
      --soft:#f7f5f0;
      --brand:#1e3a5f;
      --brand2:#2a4b6e;
      --gold:#c9a961;
      --gold-light:#e8dcc4;
    }
    *{ box-sizing:border-box; }
    html,body{ margin:0; padding:0; }
    body{
      font-family:"Segoe UI", Arial, sans-serif;
      background:#f1f3f6;
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
      border-radius:10px;
      overflow:hidden;
      background:#ffffff;
      box-shadow:0 6px 24px rgba(30,58,95,0.10);
    }
    .mmReportCard::before{
      content:"";
      display:block;
      height:4px;
      background:linear-gradient(90deg, var(--brand), var(--gold), var(--brand));
    }
    .mmReportHead{
      background:linear-gradient(135deg, var(--brand), var(--brand2));
      color:#fff;
      padding:14px 16px;
      font-size:18px;
      font-weight:800;
      letter-spacing:.6px;
      text-transform:uppercase;
      border-bottom:2px solid var(--gold);
    }
    .mmReportMeta{
      display:grid;
      grid-template-columns:repeat(2, minmax(200px, 1fr));
      gap:6px 14px;
      padding:12px 16px;
      background:var(--soft);
      border-bottom:1px solid var(--line2);
      font-size:12.5px;
      line-height:1.5;
    }
    .mmReportMeta b{
      color:var(--brand);
      font-weight:700;
    }
    .mmReportBlock{
      padding:14px 16px;
      border-bottom:1px solid var(--line2);
    }
    .mmReportBlock:last-child{ border-bottom:none; }
    .mmReportTitle{
      margin:0 0 8px;
      font-size:15px;
      line-height:1.2;
      font-weight:800;
      color:var(--brand);
      text-transform:uppercase;
      letter-spacing:.4px;
      border-bottom:1px solid var(--gold-light);
      padding-bottom:6px;
    }
    .mmReportText{
      margin:0;
      white-space:pre-wrap;
      font-size:12px;
      line-height:1.4;
      color:var(--ink);
    }
    .mmReportSection{
      margin-top:8px;
    }
    .mmReportSection:first-child{
      margin-top:0;
    }
    .mmReportSubtitle{
      margin:0 0 5px;
      font-size:13px;
      font-weight:800;
      letter-spacing:.3px;
      color:var(--brand);
      text-transform:uppercase;
      border-left:3px solid var(--gold);
      padding-left:8px;
    }
    .mmReportStack{
      display:grid;
      gap:5px;
      margin-left:10px;
    }
    .mmReportInlineFlow{
      display:flex;
      flex-wrap:wrap;
      gap:6px 14px;
      margin-left:10px;
      align-items:baseline;
    }
    .mmReportInlinePair{
      display:inline-flex;
      align-items:baseline;
      gap:3px;
      white-space:nowrap;
    }
    .mmReportInlineLabel{
      font-size:12px;
      line-height:1.4;
      font-weight:800;
      letter-spacing:.15px;
      text-transform:uppercase;
      color:var(--brand);
      white-space:nowrap;
    }
    .mmReportMiniValue{
      font-size:12px;
      line-height:1.4;
      color:#0f172a;
      white-space:nowrap;
    }
    @media print {
      .mmReportGrid{
        grid-template-columns: repeat(2, minmax(260px, 1fr));
      }
    }
    .mmReportSectionLine{
      margin:0 0 6px 12px;
      font-size:12px;
      line-height:1.4;
      color:#0f172a;
    }
    .mmReportHr{
      margin:8px 0;
      border:none;
      border-top:1px solid var(--gold-light);
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
      } catch {
        // Ignore stylesheets that are not readable due to browser security rules.
      }
    }
    return cssText.trim();
  } catch {
    return "";
  }
}
