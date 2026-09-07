import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Trophy,
  Building2,
  Award,
  Search,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Phone,
  Mail,
  FileText,
  ExternalLink
} from 'lucide-react';
import { loadState as loadCrmState } from '../../services/stateService';
import { STATUS_META } from '../calendar/constants';
import { getEventSeriesFinancialMeta } from './components/eventSeriesUtils';
import ReportInfo from './components/ReportInfo';

const API = '';

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const money = (value) => `Q ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Compara nombres de empresas de manera inteligente.
 * Soporta igualdad exacta y coincidencias de acrónimos o alias (ej. "INCAP - Instituto...", "PDH (Procuraduría...)").
 * Evita falsos positivos con palabras genéricas comunes como "Boda", "Evento", etc.
 */
function isMatchingCompanyName(nameA, nameB) {
  const a = normalizeText(nameA);
  const b = normalizeText(nameB);
  if (!a || !b) return false;
  if (a === b) return true;

  // Si uno de los dos tiene acrónimo o alias entre paréntesis o guiones
  const partsA = a.split(/[\(\)\-\/–]/).map((s) => s.trim()).filter((s) => s.length >= 3);
  const partsB = b.split(/[\(\)\-\/–]/).map((s) => s.trim()).filter((s) => s.length >= 3);

  if (partsA.some((p) => p === b) || partsB.some((p) => p === a)) return true;

  return false;
}

/**
 * Resuelve la empresa legítima de una reserva.
 * PREVIENE la contaminación producida por companyId residual/heredado de plantillas duplicadas
 * (ej. eventos sociales o ministerios con companyId: 10 de INCAP).
 */
function resolveEventCompany(companies, quote, event, primary) {
  const rawCompanyId = quote.companyId || event.companyId || primary?.companyId || '';
  const explicitName = String(
    quote.companyName || quote.company || quote.billTo || ''
  ).trim();
  const fallbackClientName = String(
    event.clientName || primary?.clientName || ''
  ).trim();

  let matched = null;

  // 1. Si hay un nombre de empresa explícito escrito en la cotización:
  if (explicitName) {
    // Si tiene un companyId, verificar si ESE companyId realmente corresponde al nombre
    if (rawCompanyId) {
      const candidateById = companies.find((c) => String(c.id || '') === String(rawCompanyId));
      if (candidateById && isMatchingCompanyName(candidateById.name, explicitName)) {
        matched = candidateById;
      }
    }

    // Si candidateById no coincidió (fue un ID huérfano o clonado de otra empresa),
    // buscamos en el catálogo de empresas por nombre
    if (!matched) {
      matched = companies.find((c) => isMatchingCompanyName(c.name, explicitName)) || null;
    }

    const finalName = matched ? matched.name : explicitName;
    const finalToken = matched ? `id:${matched.id}` : `name:${normalizeText(explicitName)}`;

    return {
      matchedCompany: matched,
      companyId: matched ? matched.id : '',
      companyName: finalName,
      companyToken: finalToken,
      nit: matched?.nit || quote.nit || '',
    };
  }

  // 2. Si no hay explicitName pero sí rawCompanyId:
  if (rawCompanyId) {
    const candidate = companies.find((c) => String(c.id || '') === String(rawCompanyId));
    if (candidate) {
      return {
        matchedCompany: candidate,
        companyId: candidate.id,
        companyName: candidate.name,
        companyToken: `id:${candidate.id}`,
        nit: candidate.nit || quote.nit || '',
      };
    }
  }

  // 3. Si solo hay clientName:
  if (fallbackClientName) {
    const candidate = companies.find((c) => isMatchingCompanyName(c.name, fallbackClientName));
    if (candidate) {
      return {
        matchedCompany: candidate,
        companyId: candidate.id,
        companyName: candidate.name,
        companyToken: `id:${candidate.id}`,
        nit: candidate.nit || quote.nit || '',
      };
    }

    return {
      matchedCompany: null,
      companyId: '',
      companyName: fallbackClientName,
      companyToken: `name:${normalizeText(fallbackClientName)}`,
      nit: quote.nit || '',
    };
  }

  return {
    matchedCompany: null,
    companyId: '',
    companyName: 'Consumidor Final / Sin Empresa',
    companyToken: 'none',
    nit: quote.nit || '',
  };
}

/**
 * Resuelve el contacto/encargado del evento.
 * CRÍTICO: Siempre prioriza el contacto explícito del evento antes de cualquier default del catálogo.
 * NUNCA asigna el primer encargado de una empresa si el evento ya especifica a su propio contacto
 * o si la empresa fue un falso match.
 */
function resolveEventContact(quote, event, primary, matchedCompany) {
  const explicitName = String(
    quote.managerName || quote.contact || primary?.contact || event?.contact || ''
  ).trim();
  const explicitPhone = String(
    quote.phone || quote.contactPhone || primary?.phone || event?.phone || ''
  ).trim();
  const explicitEmail = String(
    quote.email || quote.contactEmail || primary?.email || event?.email || ''
  ).trim();

  // Si hay un contacto explícito escrito en el evento/cotización, es el legítimo
  if (explicitName) {
    let managerPhone = explicitPhone;
    let managerEmail = explicitEmail;
    if (matchedCompany?.managers?.length) {
      const matchedMgr = matchedCompany.managers.find(
        (m) =>
          String(m.id || '') === String(quote.managerId || '') ||
          normalizeText(m.name) === normalizeText(explicitName)
      );
      if (matchedMgr) {
        if (!managerPhone) managerPhone = matchedMgr.phone || '';
        if (!managerEmail) managerEmail = matchedMgr.email || '';
      }
    }

    return {
      contact: explicitName,
      contactPhone: managerPhone || matchedCompany?.phone || '',
      contactEmail: managerEmail || matchedCompany?.email || '',
    };
  }

  // Si no hay contacto explícito pero sí una empresa del catálogo válidamente vinculada:
  if (matchedCompany) {
    const specificMgr = quote.managerId
      ? matchedCompany.managers?.find((m) => String(m.id || '') === String(quote.managerId))
      : null;
    const fallbackMgr = specificMgr || matchedCompany.managers?.[0];

    const contactName = fallbackMgr?.name || matchedCompany.owner || matchedCompany.name || '';
    if (contactName) {
      return {
        contact: contactName,
        contactPhone: fallbackMgr?.phone || matchedCompany.phone || '',
        contactEmail: fallbackMgr?.email || matchedCompany.email || '',
      };
    }
  }

  const fallbackClient = String(primary?.clientName || event?.clientName || '').trim();
  return {
    contact: fallbackClient || 'Sin encargado',
    contactPhone: explicitPhone,
    contactEmail: explicitEmail,
  };
}

// ─── Exportar Ranking a Excel estructurado ───
function exportRankingToExcel(rankingRows, periodLabel, statusLabel) {
  if (!rankingRows.length) return;
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });

  const totalCartera = rankingRows.reduce((acc, r) => acc + r.totalAmount, 0);
  const totalVisitas = rankingRows.reduce((acc, r) => acc + r.eventsCount, 0);
  const totalPax = rankingRows.reduce((acc, r) => acc + r.totalPax, 0);

  const rowsHtml = rankingRows.map((r, i) => `
    <tr style="background:${i % 2 === 1 ? '#f8fafc' : '#ffffff'};">
      <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:center;font-weight:bold;color:#1e293b;">${r.rank}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;font-weight:bold;color:#0f172a;">${r.companyName}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;color:#475569;">${r.nit || '-'}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;color:#475569;">${r.contact || '-'}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;color:#475569;">${r.contactPhone || '-'}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:center;font-weight:bold;color:#2563eb;">${r.eventsCount}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:center;color:#16a34a;">${r.confirmedCount}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:center;font-weight:bold;">${r.totalPax.toLocaleString()}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:right;font-weight:bold;color:#0f172a;">Q ${r.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:right;color:#16a34a;">Q ${r.advancesAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:right;color:${r.pendingAmount > 0 ? '#dc2626' : '#16a34a'};font-weight:bold;">Q ${r.pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:right;">Q ${r.avgTicket.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:center;color:#475569;">${r.lastVisit || '-'}</td>
    </tr>
  `).join('');

  const tableHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Ranking Empresas</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      </head>
      <body style="font-family:Calibri,Arial,sans-serif;">
        <table style="border-collapse:collapse;width:100%;">
          <tr>
            <td colspan="13" style="font-size:16pt;font-weight:bold;color:#0f172a;padding:12px 0;">JARDINES DEL LAGO — RANKING DE EMPRESAS E INSTITUCIONES</td>
          </tr>
          <tr>
            <td colspan="13" style="font-size:10pt;color:#475569;padding-bottom:12px;">
              Período: <strong>${periodLabel}</strong> | Filtro de Estado: <strong>${statusLabel}</strong> | Generado: ${dateStr} ${timeStr}
            </td>
          </tr>
          <thead>
            <tr style="background:#0f172a;color:#ffffff;font-size:10pt;font-weight:bold;text-align:center;">
              <th style="padding:10px;border:1px solid #0f172a;">#</th>
              <th style="padding:10px;border:1px solid #0f172a;text-align:left;">Empresa / Institución</th>
              <th style="padding:10px;border:1px solid #0f172a;">NIT</th>
              <th style="padding:10px;border:1px solid #0f172a;text-align:left;">Contacto Principal</th>
              <th style="padding:10px;border:1px solid #0f172a;">Teléfono</th>
              <th style="padding:10px;border:1px solid #0f172a;">Eventos</th>
              <th style="padding:10px;border:1px solid #0f172a;">Confirmados</th>
              <th style="padding:10px;border:1px solid #0f172a;">Total PAX</th>
              <th style="padding:10px;border:1px solid #0f172a;text-align:right;">Facturación Total</th>
              <th style="padding:10px;border:1px solid #0f172a;text-align:right;">Abonado</th>
              <th style="padding:10px;border:1px solid #0f172a;text-align:right;">Saldo Pendiente</th>
              <th style="padding:10px;border:1px solid #0f172a;text-align:right;">Ticket Promedio</th>
              <th style="padding:10px;border:1px solid #0f172a;">Última Visita</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background:#f1f5f9;font-weight:bold;border-top:2px solid #0f172a;">
              <td colspan="5" style="padding:10px;border:1px solid #d1d5db;text-align:right;">TOTALES GENERALES:</td>
              <td style="padding:10px;border:1px solid #d1d5db;text-align:center;color:#2563eb;">${totalVisitas}</td>
              <td style="padding:10px;border:1px solid #d1d5db;text-align:center;">-</td>
              <td style="padding:10px;border:1px solid #d1d5db;text-align:center;">${totalPax.toLocaleString()}</td>
              <td style="padding:10px;border:1px solid #d1d5db;text-align:right;color:#0f172a;">Q ${totalCartera.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td colspan="4" style="padding:10px;border:1px solid #d1d5db;"></td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ranking_Empresas_JDL_${now.toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Componentes de Gráficos Vectoriales SVG Profesionales ───

// Gráfico de Área Suave (Bezier + Gradient)
function SmoothAreaChart({ data, height = 210 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '36px', border: '1px dashed #cbd5e1', borderRadius: '14px', color: '#64748b', background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>
        Sin registros de consumo en el rango de fechas.
      </div>
    );
  }

  const W = 620;
  const H = height;
  const padL = 60;
  const padR = 24;
  const padT = 24;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxVal = Math.max(1, ...data.map((d) => d.amount));
  const points = data.map((d, i) => {
    const x = data.length === 1 ? padL + innerW / 2 : padL + (i / (data.length - 1)) * innerW;
    const y = padT + (1 - d.amount / maxVal) * innerH;
    return { x, y, d, i };
  });

  // Curva Bézier cúbica suave
  const createSmoothPath = (pts) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return path;
  };

  const linePath = createSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padT + innerH} L ${points[0].x} ${padT + innerH} Z`;

  // Gridlines Y
  const gridSteps = [0, 0.5, 1];

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="instAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Líneas horizontales de guía */}
        {gridSteps.map((pct) => {
          const y = padT + (1 - pct) * innerH;
          const val = maxVal * pct;
          return (
            <g key={pct}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1" />
              <text x={padL - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="600">
                {val >= 1000 ? `Q ${(val / 1000).toFixed(0)}k` : `Q ${val.toFixed(0)}`}
              </text>
            </g>
          );
        })}

        {/* Área sombreada */}
        <path d={areaPath} fill="url(#instAreaGrad)" />

        {/* Línea principal */}
        <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />

        {/* Puntos y etiquetas X */}
        {points.map((pt) => {
          const isHovered = hoveredIdx === pt.i;
          return (
            <g key={pt.i} onMouseEnter={() => setHoveredIdx(pt.i)} onMouseLeave={() => setHoveredIdx(null)} style={{ cursor: 'pointer' }}>
              {/* Etiqueta X (mes) */}
              <text x={pt.x} y={padT + innerH + 18} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight={isHovered ? '800' : '600'}>
                {pt.d.label}
              </text>

              {/* Punto circular interactivo */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 6 : 3.5}
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth={isHovered ? 3 : 2}
                style={{ transition: 'all 0.15s ease' }}
              />

              {/* Tooltip flotante al pasar el cursor */}
              {isHovered && (
                <g>
                  <rect
                    x={Math.max(10, Math.min(W - 120, pt.x - 55))}
                    y={Math.max(4, pt.y - 42)}
                    width="110"
                    height="32"
                    rx="8"
                    fill="#0f172a"
                    filter="drop-shadow(0 4px 6px rgba(0,0,0,0.15))"
                  />
                  <text x={Math.max(10, Math.min(W - 120, pt.x - 55)) + 55} y={Math.max(4, pt.y - 42) + 14} textAnchor="middle" fontSize="10" fontWeight="700" fill="#94a3b8">
                    {pt.d.count} evento(s)
                  </text>
                  <text x={Math.max(10, Math.min(W - 120, pt.x - 55)) + 55} y={Math.max(4, pt.y - 42) + 26} textAnchor="middle" fontSize="11" fontWeight="800" fill="#38bdf8">
                    {money(pt.d.amount)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Gráfico Donut de Estados
function InteractiveDonutChart({ statusData, totalEvents }) {
  const size = 170;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  if (!statusData.length || totalEvents === 0) {
    return (
      <div style={{ padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '14px', color: '#64748b', background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>
        Sin eventos para mostrar.
      </div>
    );
  }

  let cumulativePercent = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
          {statusData.map((item) => {
            const pct = item.count / totalEvents;
            const strokeDasharray = `${pct * circumference} ${circumference}`;
            const strokeDashoffset = -cumulativePercent * circumference;
            cumulativePercent += pct;
            return (
              <circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 0.4s ease' }}
              />
            );
          })}
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</span>
          <span style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{totalEvents}</span>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>reservas</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '180px' }}>
        {statusData.map((item) => {
          const pct = Math.round((item.count / totalEvents) * 100);
          return (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, color: '#1e293b' }}>{item.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <strong style={{ color: '#0f172a' }}>{item.count}</strong>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Barras Horizontales con Porcentajes
function HorizontalBarRanking({ items, maxVal, showAmount = true, emptyText = 'Sin datos disponibles.' }) {
  if (!items.length) {
    return (
      <div style={{ padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '14px', color: '#64748b', background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>
        {emptyText}
      </div>
    );
  }

  const computedMax = maxVal || Math.max(1, ...items.map((i) => i.amount || i.count));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {items.map((item, idx) => {
        const val = item.amount !== undefined ? item.amount : item.count;
        const pct = Math.max(4, Math.min(100, (val / computedMax) * 100));
        return (
          <div key={item.label || idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '70%', overflow: 'hidden' }}>
                <span style={{ fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
                {item.subtitle && (
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{item.subtitle}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>{item.count} evento(s)</span>
                {showAmount && item.amount !== undefined && (
                  <strong style={{ color: '#0f172a', fontWeight: 800 }}>{money(item.amount)}</strong>
                )}
              </div>
            </div>
            <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: item.color || 'linear-gradient(90deg, #2563eb, #3b82f6)',
                borderRadius: '999px',
                transition: 'width 0.4s cubic-bezier(0.2, 0, 0, 1)',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente Principal ───
export default function ReportsInstitucion({ onClose }) {
  const navigate = useNavigate();
  const outletContext = useOutletContext();
  const events = useMemo(() => outletContext?.events || [], [outletContext?.events]);
  const users = useMemo(() => outletContext?.users || [], [outletContext?.users]);

  const currentYear = String(new Date().getFullYear());

  // ── Estados de Control & Filtros ──
  const [activeTab, setActiveTab] = useState('ranking'); // 'ranking' | 'institucion'
  const [timePreset, setTimePreset] = useState('year'); // 'year' | 'last12' | 'all' | 'custom'
  const [statusScope, setStatusScope] = useState('confirmed'); // 'confirmed' | 'pipeline' | 'all'
  const [fromDate, setFromDate] = useState(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState(`${currentYear}-12-31`);

  // Búsqueda y ordenamiento en ranking
  const [rankingSearch, setRankingSearch] = useState('');
  const [sortField, setSortField] = useState('total'); // 'total' | 'events' | 'pax' | 'ticket' | 'lastVisit' | 'name'
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'

  // Empresa seleccionada para la Ficha Institucional
  const [selectedCompanyToken, setSelectedCompanyToken] = useState('all');

  // Datos externos (Catálogo de empresas y servicios)
  const [companies, setCompanies] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);
  const [menuRankings, setMenuRankings] = useState(null);
  const [menuLoading, setMenuLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadCrmState()
      .then((response) => {
        if (!mounted) return;
        setCompanies(Array.isArray(response?.companies) ? response.companies : []);
        setCatalogServices(Array.isArray(response?.services) ? response.services : []);
      })
      .catch(() => {
        if (mounted) { setCompanies([]); setCatalogServices([]); }
      });
    return () => { mounted = false; };
  }, []);

  // ── Manejo de Períodos Rápidos ──
  const handlePresetChange = (preset) => {
    setTimePreset(preset);
    const now = new Date();
    if (preset === 'year') {
      setFromDate(`${now.getFullYear()}-01-01`);
      setToDate(`${now.getFullYear()}-12-31`);
    } else if (preset === 'last12') {
      const past = new Date();
      past.setFullYear(now.getFullYear() - 1);
      setFromDate(past.toISOString().slice(0, 10));
      setToDate(now.toISOString().slice(0, 10));
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    }
  };

  // ── Normalización de Filas de Reservas (Canónico: Deduplicación → FinancialMeta) ──
  const allReservationRows = useMemo(() => {
    const seen = new Set();
    const output = [];

    for (const event of events || []) {
      const reservationKey = String(event.groupId || event.id || '');
      if (reservationKey && seen.has(reservationKey)) continue;
      if (reservationKey) seen.add(reservationKey);

      const financialMeta = getEventSeriesFinancialMeta(event, events);
      const primary = financialMeta.primaryEvent || event;
      const quote = primary?.quote || event?.quote || {};

      const startDate = String(financialMeta.startDate || primary?.eventDateStart || primary?.date || event?.date || '').trim();
      const endDate = String(financialMeta.endDate || primary?.eventDateEnd || primary?.endDate || startDate).trim();

      const salones = financialMeta.salones && financialMeta.salones.length ? financialMeta.salones : [financialMeta.mainSalon || primary?.salon || event?.salon || ''];
      const seller = users.find((user) => String(user.id || '') === String(primary?.userId || event?.userId || ''));

      // Resolución de empresa y encargado (libre de contaminación por plantillas clonadas)
      const compInfo = resolveEventCompany(companies, quote, event, primary);
      const contactInfo = resolveEventContact(quote, event, primary, compInfo.matchedCompany);

      const total = Number(quote.totalGtq || quote.total || 0);
      const advancesList = Array.isArray(quote.advances) ? quote.advances : [];
      const advancesSum = advancesList.reduce((sum, adv) => sum + Math.max(0, Number(adv.amount || 0)), 0);

      output.push({
        id: primary?.id || event?.id || reservationKey,
        primaryId: primary?.id || event?.id || '',
        reservationKey,
        companyToken: compInfo.companyToken,
        companyId: compInfo.companyId,
        companyName: compInfo.companyName,
        companyRaw: compInfo.matchedCompany || null,
        nit: compInfo.nit,
        contact: contactInfo.contact,
        contactPhone: contactInfo.contactPhone,
        contactEmail: contactInfo.contactEmail,
        status: primary?.status || event?.status || 'Sin estado',
        statusColor: STATUS_META[primary?.status || event?.status]?.color || '#64748b',
        name: primary?.name || event?.name || 'Evento sin nombre',
        eventDate: startDate,
        endDate,
        schedule: `${financialMeta.startTime || primary?.startTime || ''} - ${financialMeta.endTime || primary?.endTime || ''}`.trim(),
        salon: salones.filter(Boolean).join(', ') || 'Sin salón',
        userName: seller?.fullName || seller?.name || 'Sin asignar',
        pax: Number(primary?.pax || event?.pax || quote.people || 0),
        total,
        subtotal: Number(quote.subtotalGtq || quote.subtotal || 0),
        advances: advancesList,
        advancesSum,
        pendingAmount: Math.max(0, total - advancesSum),
        items: Array.isArray(quote.items) ? quote.items : [],
        lastVisit: endDate || startDate || '',
      });
    }

    return output;
  }, [events, users, companies]);

  // ── Filtrado Global por Fechas y Alcance de Estado ──
  const filteredRows = useMemo(() => {
    return allReservationRows.filter((row) => {
      // Filtro de fecha
      if (fromDate && row.eventDate && row.eventDate < fromDate) return false;
      if (toDate && row.eventDate && row.eventDate > toDate) return false;

      // Filtro de estado
      if (statusScope === 'confirmed') {
        if (row.status !== 'Confirmado' && row.status !== 'Realizado') return false;
      } else if (statusScope === 'pipeline') {
        const pipelineStatuses = ['Confirmado', 'Realizado', 'Pre reserva', '1er Cotizacion', 'Seguimiento', 'Lista de Espera'];
        if (!pipelineStatuses.includes(row.status)) return false;
      }
      return true;
    });
  }, [allReservationRows, fromDate, toDate, statusScope]);

  // ── Agrupación y Cálculo del Ranking de Empresas ──
  const companyRanking = useMemo(() => {
    const map = new Map();

    filteredRows.forEach((row) => {
      // Ignorar eventos sin nombre de empresa si son exclusivamente anónimos
      if (row.companyToken === 'none') return;

      const current = map.get(row.companyToken) || {
        companyToken: row.companyToken,
        companyName: row.companyName,
        nit: row.nit,
        contact: row.contact,
        contactPhone: row.contactPhone,
        contactEmail: row.contactEmail,
        eventsCount: 0,
        confirmedCount: 0,
        totalAmount: 0,
        advancesAmount: 0,
        pendingAmount: 0,
        totalPax: 0,
        lastVisit: '',
        salonsFreq: new Map(),
        events: [],
      };

      current.eventsCount += 1;
      if (row.status === 'Confirmado' || row.status === 'Realizado') {
        current.confirmedCount += 1;
      }
      current.totalAmount += row.total;
      current.advancesAmount += row.advancesSum;
      current.pendingAmount += row.pendingAmount;
      current.totalPax += row.pax;

      if (!current.lastVisit || String(row.lastVisit).localeCompare(current.lastVisit) > 0) {
        current.lastVisit = row.lastVisit;
      }

      if (row.nit && !current.nit) current.nit = row.nit;
      if (row.contact && !current.contact) current.contact = row.contact;
      if (row.contactPhone && !current.contactPhone) current.contactPhone = row.contactPhone;

      row.salon.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => {
        current.salonsFreq.set(s, (current.salonsFreq.get(s) || 0) + 1);
      });

      current.events.push(row);
      map.set(row.companyToken, current);
    });

    const list = Array.from(map.values()).map((comp) => ({
      ...comp,
      avgTicket: comp.eventsCount > 0 ? comp.totalAmount / comp.eventsCount : 0,
    }));

    // Ordenamiento
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'total') { valA = a.totalAmount; valB = b.totalAmount; }
      if (sortField === 'events') { valA = a.eventsCount; valB = b.eventsCount; }
      if (sortField === 'pax') { valA = a.totalPax; valB = b.totalPax; }
      if (sortField === 'ticket') { valA = a.avgTicket; valB = b.avgTicket; }
      if (sortField === 'lastVisit') { valA = a.lastVisit; valB = b.lastVisit; }
      if (sortField === 'name') { valA = a.companyName; valB = b.companyName; }

      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });

    return list.map((item, index) => ({ ...item, rank: index + 1 }));
  }, [filteredRows, sortField, sortDir]);

  // Ranking filtrado por buscador
  const filteredRanking = useMemo(() => {
    if (!rankingSearch.trim()) return companyRanking;
    const term = normalizeText(rankingSearch);
    return companyRanking.filter((item) => (
      normalizeText(item.companyName).includes(term) ||
      normalizeText(item.contact).includes(term) ||
      normalizeText(item.nit).includes(term) ||
      normalizeText(item.contactEmail).includes(term)
    ));
  }, [companyRanking, rankingSearch]);

  // Podio Top 3
  const podiumTop3 = useMemo(() => companyRanking.slice(0, 3), [companyRanking]);

  // Macro KPIs para el tab de Ranking
  const macroKpis = useMemo(() => {
    const totalCompanies = companyRanking.length;
    const totalPortfolio = companyRanking.reduce((sum, c) => sum + c.totalAmount, 0);
    const totalPaxPortfolio = companyRanking.reduce((sum, c) => sum + c.totalPax, 0);
    const totalEventsPortfolio = companyRanking.reduce((sum, c) => sum + c.eventsCount, 0);
    const leader = companyRanking[0] || null;

    return { totalCompanies, totalPortfolio, totalPaxPortfolio, totalEventsPortfolio, leader };
  }, [companyRanking]);

  // ── Datos para la Ficha Institucional (Empresa Seleccionada) ──
  const selectedCompanyRows = useMemo(() => {
    if (selectedCompanyToken === 'all') return filteredRows;
    return filteredRows.filter((r) => r.companyToken === selectedCompanyToken);
  }, [filteredRows, selectedCompanyToken]);

  const selectedCompanyInfo = useMemo(() => {
    if (selectedCompanyToken === 'all') return null;
    return companyRanking.find((c) => c.companyToken === selectedCompanyToken)
      || allReservationRows.find((r) => r.companyToken === selectedCompanyToken)
      || null;
  }, [companyRanking, allReservationRows, selectedCompanyToken]);

  // Tendencia mensual para la Ficha Institucional
  const monthlyTrendData = useMemo(() => {
    const map = new Map();
    selectedCompanyRows.forEach((r) => {
      const key = r.eventDate ? r.eventDate.slice(0, 7) : 'Sin fecha';
      const current = map.get(key) || { label: key, count: 0, amount: 0 };
      current.count += 1;
      current.amount += r.total;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedCompanyRows]);

  // Estados de reservas para Donut Chart
  const statusDistribution = useMemo(() => {
    const map = new Map();
    selectedCompanyRows.forEach((r) => {
      const label = r.status || 'Sin estado';
      const color = STATUS_META[label]?.color || '#64748b';
      const current = map.get(label) || { label, color, count: 0 };
      current.count += 1;
      map.set(label, current);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [selectedCompanyRows]);

  // Salones preferidos
  const salonRankingData = useMemo(() => {
    const map = new Map();
    selectedCompanyRows.forEach((r) => {
      r.salon.split(',').map((s) => s.trim()).filter(Boolean).forEach((salon) => {
        const current = map.get(salon) || { label: salon, count: 0, color: '#2563eb' };
        current.count += 1;
        map.set(salon, current);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 7);
  }, [selectedCompanyRows]);

  // Subcategorías de servicios
  const subcategoryRankingData = useMemo(() => {
    const map = new Map();
    selectedCompanyRows.forEach((r) => {
      r.items.forEach((it) => {
        const service = catalogServices.find((s) => String(s.id) === String(it.serviceId));
        const subcat = service?.subcategory || '';
        if (!subcat) return;
        const current = map.get(subcat) || { label: subcat, count: 0, amount: 0, color: '#10b981' };
        current.count += Number(it.qty || 1);
        current.amount += Number(it.qty || 1) * Number(it.price || 0);
        map.set(subcat, current);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 7);
  }, [selectedCompanyRows, catalogServices]);

  // Menú más pedido (llamado API)
  useEffect(() => {
    if (!selectedCompanyRows.length) { setMenuRankings(null); return; }
    const eventIds = selectedCompanyRows.map((r) => r.id).filter(Boolean);
    if (!eventIds.length) { setMenuRankings(null); return; }
    setMenuLoading(true);
    fetch(`${API}/api/reportes/menu-items?ids=${eventIds.join(',')}`)
      .then((r) => r.json())
      .then((data) => { setMenuRankings(data); setMenuLoading(false); })
      .catch(() => { setMenuRankings(null); setMenuLoading(false); });
  }, [selectedCompanyRows]);

  // Encargados con más actividad
  const managersRanking = useMemo(() => {
    const map = new Map();
    selectedCompanyRows.forEach((r) => {
      const contactName = r.contact || 'Sin encargado';
      const current = map.get(contactName) || { label: contactName, count: 0, amount: 0 };
      current.count += 1;
      current.amount += r.total;
      map.set(contactName, current);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [selectedCompanyRows]);

  // Resumen de la Ficha
  const companySummary = useMemo(() => {
    const total = selectedCompanyRows.reduce((acc, r) => acc + r.total, 0);
    const pax = selectedCompanyRows.reduce((acc, r) => acc + r.pax, 0);
    const confirmed = selectedCompanyRows.filter((r) => r.status === 'Confirmado' || r.status === 'Realizado').length;
    const advances = selectedCompanyRows.reduce((acc, r) => acc + r.advancesSum, 0);
    const pending = Math.max(0, total - advances);
    const lastVisit = selectedCompanyRows.map((r) => r.lastVisit).filter(Boolean).sort().pop() || '-';
    return { total, pax, confirmed, advances, pending, lastVisit };
  }, [selectedCompanyRows]);

  // ── Interacciones de Ordenamiento ──
  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const openCompanyProfile = (token) => {
    setSelectedCompanyToken(token);
    setActiveTab('institucion');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenReservation = (row) => {
    const targetId = row.primaryId || row.id || row.reservationKey;
    if (!targetId) return;
    onClose?.();
    navigate(`/reserva/${targetId}`);
  };

  const periodLabel = fromDate && toDate ? `${fromDate} al ${toDate}` : fromDate ? `Desde ${fromDate}` : 'Histórico Total';
  const statusLabel = statusScope === 'confirmed' ? 'Confirmados y Realizados' : statusScope === 'pipeline' ? 'Pipeline Activo' : 'Todos los estados';

  return (
    <div className="reports-page-container">
      {/* ── Header Principal ── */}
      <div className="reports-page-header">
        <div className="reports-brand-header">
          <div className="reports-brand-badge">
            <img src="/Oficial_JDL_acua.png" alt="Logo Jardines del Lago" className="reports-brand-logo" />
          </div>
          <div>
            <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
            <div className="reports-title">Reporte por Institución y Ranking Corporativo</div>
            <div className="reports-subtitle">Analítica comercial de clientes corporativos, fidelidad y hábitos de consumo</div>
          </div>
        </div>
        <ReportInfo reportKey="institucion" />
        <button className="btn-exit" type="button" onClick={() => onClose?.()}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 4 7 9l6 5" />
          </svg>
          Volver
        </button>
      </div>

      <div className="reports-page-body">
        {/* ── Pestañas de Navegación Superiores ── */}
        <div className="inst-main-tabs-bar">
          <button
            type="button"
            className={`inst-main-tab-btn ${activeTab === 'ranking' ? 'inst-main-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('ranking')}
          >
            <Trophy size={16} strokeWidth={2.2} style={{ color: activeTab === 'ranking' ? '#2563eb' : '#64748b' }} />
            Ranking de Empresas
            <span className="inst-tab-counter-badge">{companyRanking.length}</span>
          </button>
          <button
            type="button"
            className={`inst-main-tab-btn ${activeTab === 'institucion' ? 'inst-main-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('institucion')}
          >
            <Building2 size={16} strokeWidth={2.2} style={{ color: activeTab === 'institucion' ? '#2563eb' : '#64748b' }} />
            Ficha Institucional
            {selectedCompanyInfo && (
              <span className="inst-tab-counter-badge" style={{ background: '#2563eb', color: '#fff' }}>
                {selectedCompanyInfo.companyName.substring(0, 15)}…
              </span>
            )}
          </button>
        </div>

        {/* ── Toolbar de Filtros Globales ── */}
        <section className="reports-hero-panel" style={{ padding: '16px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            {/* Período Rápido */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <Calendar size={14} strokeWidth={2.2} style={{ color: '#64748b' }} />
                <span>Período:</span>
              </div>
              <div className="inst-pill-group">
                <button
                  type="button"
                  className={`inst-pill-btn ${timePreset === 'year' ? 'inst-pill-btn--active' : ''}`}
                  onClick={() => handlePresetChange('year')}
                >
                  Este Año ({currentYear})
                </button>
                <button
                  type="button"
                  className={`inst-pill-btn ${timePreset === 'last12' ? 'inst-pill-btn--active' : ''}`}
                  onClick={() => handlePresetChange('last12')}
                >
                  Últimos 12 Meses
                </button>
                <button
                  type="button"
                  className={`inst-pill-btn ${timePreset === 'all' ? 'inst-pill-btn--active' : ''}`}
                  onClick={() => handlePresetChange('all')}
                >
                  Histórico Completo
                </button>
              </div>
            </div>

            {/* Fechas personalizadas con fondo blanco forzado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                Desde:
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setTimePreset('custom'); }}
                  className="inst-date-input"
                  style={{ background: '#ffffff', color: '#0f172a', colorScheme: 'light', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', outline: 'none' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                Hasta:
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setTimePreset('custom'); }}
                  className="inst-date-input"
                  style={{ background: '#ffffff', color: '#0f172a', colorScheme: 'light', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', outline: 'none' }}
                />
              </label>
            </div>

            {/* Selector de Estado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <Filter size={14} strokeWidth={2.2} style={{ color: '#64748b' }} />
                <span>Estados:</span>
              </div>
              <select
                value={statusScope}
                onChange={(e) => setStatusScope(e.target.value)}
                className="inst-select-input"
                style={{ padding: '6px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700, background: '#ffffff', color: '#0f172a', colorScheme: 'light' }}
              >
                <option value="confirmed">Confirmados y Realizados (Ventas Reales)</option>
                <option value="pipeline">Pipeline Activo (Cotizaciones + Confirmados)</option>
                <option value="all">Todos los Estados (Sin excepción)</option>
              </select>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            PESTAÑA 1: RANKING DE EMPRESAS
           ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'ranking' && (
          <div>
            {/* Bento KPIs Globales del Ranking */}
            <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '24px' }}>
              <div className="bento-tile reports-kpi-tile" style={{ borderTop: '4px solid #2563eb' }}>
                <span className="reports-eyebrow">Instituciones Activas</span>
                <strong>{macroKpis.totalCompanies}</strong>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>con visitas en el período</span>
              </div>
              <div className="bento-tile reports-kpi-tile" style={{ borderTop: '4px solid #10b981' }}>
                <span className="reports-eyebrow">Facturación Cartera</span>
                <strong>{money(macroKpis.totalPortfolio)}</strong>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>ingresos generados</span>
              </div>
              <div className="bento-tile reports-kpi-tile" style={{ borderTop: '4px solid #f59e0b' }}>
                <span className="reports-eyebrow">PAX Atendidos</span>
                <strong>{macroKpis.totalPaxPortfolio.toLocaleString()}</strong>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>invitados totales</span>
              </div>
              <div className="bento-tile reports-kpi-tile" style={{ borderTop: '4px solid #8b5cf6' }}>
                <span className="reports-eyebrow">Visitas / Eventos</span>
                <strong>{macroKpis.totalEventsPortfolio}</strong>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>reservas corporativas</span>
              </div>
              <div className="bento-tile reports-kpi-tile" style={{ borderTop: '4px solid #ec4899' }}>
                <span className="reports-eyebrow">Empresa Líder (#1)</span>
                <strong style={{ fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {macroKpis.leader ? macroKpis.leader.companyName : 'Sin datos'}
                </strong>
                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                  {macroKpis.leader ? money(macroKpis.leader.totalAmount) : '-'}
                </span>
              </div>
            </div>

            {/* ── Podio Top 3 (Minimalist & Sleek) ── */}
            {podiumTop3.length > 0 && (
              <div className="inst-podium-grid">
                {podiumTop3.map((comp, idx) => {
                  const rankClass = idx === 0 ? 'inst-podium-rank-1' : idx === 1 ? 'inst-podium-rank-2' : 'inst-podium-rank-3';
                  const rankLabel = idx === 0 ? 'Top 1' : idx === 1 ? 'Top 2' : 'Top 3';
                  return (
                    <div
                      key={comp.companyToken}
                      className={`inst-podium-card ${rankClass}`}
                      onClick={() => openCompanyProfile(comp.companyToken)}
                      title="Haz clic para ver la ficha detallada"
                    >
                      <div className="inst-podium-header">
                        <span className="inst-podium-badge">
                          <Award size={13} strokeWidth={2.2} />
                          {rankLabel}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                          {comp.eventsCount} eventos
                        </span>
                      </div>
                      <div className="inst-podium-title" title={comp.companyName}>
                        {comp.companyName}
                      </div>
                      <div className="inst-podium-amount">
                        {money(comp.totalAmount)}
                      </div>
                      <div className="inst-podium-footer">
                        <span>PAX: <strong>{comp.totalPax.toLocaleString()}</strong></span>
                        <span>Ticket Prom: <strong>{money(comp.avgTicket)}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Gráficas de Cartera (Top Empresas + Estados) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {/* Top 8 Empresas por Facturación */}
              <div className="inst-chart-card">
                <div className="inst-chart-head">
                  <div>
                    <div className="inst-chart-title">Top Empresas por Facturación</div>
                    <div className="inst-chart-subtitle">Participación proporcional sobre los ingresos de la cartera</div>
                  </div>
                </div>
                <HorizontalBarRanking
                  items={companyRanking.slice(0, 8).map((c) => ({
                    label: c.companyName,
                    amount: c.totalAmount,
                    count: c.eventsCount,
                  }))}
                  maxVal={companyRanking[0]?.totalAmount || 1}
                  emptyText="Sin empresas con facturación en el período."
                />
              </div>

              {/* Distribución por Estado de Reservas */}
              <div className="inst-chart-card">
                <div className="inst-chart-head">
                  <div>
                    <div className="inst-chart-title">Distribución por Estado de Reservas</div>
                    <div className="inst-chart-subtitle">Eventos totales de empresas registrados en el sistema</div>
                  </div>
                </div>
                <InteractiveDonutChart
                  statusData={statusDistribution}
                  totalEvents={filteredRows.length}
                />
              </div>
            </div>

            {/* ── Tabla Interactiva de Ranking de Empresas ── */}
            <div className="inst-chart-card" style={{ padding: '20px' }}>
              <div className="inst-table-toolbar">
                <div className="inst-search-wrapper">
                  <Search size={15} strokeWidth={2} className="inst-search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar empresa por nombre, contacto o NIT..."
                    value={rankingSearch}
                    onChange={(e) => setRankingSearch(e.target.value)}
                    style={{ background: '#ffffff', color: '#0f172a', colorScheme: 'light' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    className="inst-btn-excel"
                    onClick={() => exportRankingToExcel(filteredRanking, periodLabel, statusLabel)}
                    title="Exportar tabla completa a Excel"
                  >
                    <FileSpreadsheet size={15} strokeWidth={2} />
                    Exportar Excel
                  </button>
                </div>
              </div>

              {/* Tabla con ordenamiento */}
              <div className="reports-table-wrap" style={{ maxHeight: '520px', overflowY: 'auto' }}>
                <table className="reports-table" style={{ minWidth: '940px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '45px', textAlign: 'center' }}>Pos.</th>
                      <th className="inst-th-sortable" onClick={() => toggleSort('name')}>
                        <div className="inst-th-content">
                          Empresa / Institución
                          {sortField === 'name' ? (
                            sortDir === 'asc' ? <ArrowUp size={12} strokeWidth={2.5} style={{ color: '#2563eb' }} /> : <ArrowDown size={12} strokeWidth={2.5} style={{ color: '#2563eb' }} />
                          ) : (
                            <ArrowUpDown size={11} strokeWidth={1.8} style={{ color: '#94a3b8' }} />
                          )}
                        </div>
                      </th>
                      <th className="inst-th-sortable" onClick={() => toggleSort('total')} style={{ textAlign: 'right' }}>
                        <div className="inst-th-content" style={{ justifyContent: 'flex-end' }}>
                          Facturación Total
                          {sortField === 'total' ? (
                            sortDir === 'asc' ? <ArrowUp size={12} strokeWidth={2.5} style={{ color: '#2563eb' }} /> : <ArrowDown size={12} strokeWidth={2.5} style={{ color: '#2563eb' }} />
                          ) : (
                            <ArrowUpDown size={11} strokeWidth={1.8} style={{ color: '#94a3b8' }} />
                          )}
                        </div>
                      </th>
                      <th className="inst-th-sortable" onClick={() => toggleSort('events')} style={{ textAlign: 'center' }}>
                        <div className="inst-th-content" style={{ justifyContent: 'center' }}>
                          Visitas / Eventos
                          {sortField === 'events' ? (
                            sortDir === 'asc' ? <ArrowUp size={12} strokeWidth={2.5} style={{ color: '#2563eb' }} /> : <ArrowDown size={12} strokeWidth={2.5} style={{ color: '#2563eb' }} />
                          ) : (
                            <ArrowUpDown size={11} strokeWidth={1.8} style={{ color: '#94a3b8' }} />
                          )}
                        </div>
                      </th>
                      <th className="inst-th-sortable" onClick={() => toggleSort('pax')} style={{ textAlign: 'right' }}>
                        <div className="inst-th-content" style={{ justifyContent: 'flex-end' }}>
                          Total PAX
                          {sortField === 'pax' ? (
                            sortDir === 'asc' ? <ArrowUp size={12} strokeWidth={2.5} style={{ color: '#2563eb' }} /> : <ArrowDown size={12} strokeWidth={2.5} style={{ color: '#2563eb' }} />
                          ) : (
                            <ArrowUpDown size={11} strokeWidth={1.8} style={{ color: '#94a3b8' }} />
                          )}
                        </div>
                      </th>
                      <th className="inst-th-sortable" onClick={() => toggleSort('ticket')} style={{ textAlign: 'right' }}>
                        <div className="inst-th-content" style={{ justifyContent: 'flex-end' }}>
                          Ticket Promedio
                          {sortField === 'ticket' ? (
                            sortDir === 'asc' ? <ArrowUp size={12} strokeWidth={2.5} style={{ color: '#2563eb' }} /> : <ArrowDown size={12} strokeWidth={2.5} style={{ color: '#2563eb' }} />
                          ) : (
                            <ArrowUpDown size={11} strokeWidth={1.8} style={{ color: '#94a3b8' }} />
                          )}
                        </div>
                      </th>
                      <th className="inst-th-sortable" onClick={() => toggleSort('lastVisit')} style={{ textAlign: 'center' }}>
                        <div className="inst-th-content" style={{ justifyContent: 'center' }}>
                          Última Visita
                          {sortField === 'lastVisit' ? (
                            sortDir === 'asc' ? <ArrowUp size={12} strokeWidth={2.5} style={{ color: '#2563eb' }} /> : <ArrowDown size={12} strokeWidth={2.5} style={{ color: '#2563eb' }} />
                          ) : (
                            <ArrowUpDown size={11} strokeWidth={1.8} style={{ color: '#94a3b8' }} />
                          )}
                        </div>
                      </th>
                      <th style={{ width: '110px', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRanking.length ? filteredRanking.map((row) => {
                      const pillClass = row.rank === 1 ? 'inst-rank-pill--gold' : row.rank === 2 ? 'inst-rank-pill--silver' : row.rank === 3 ? 'inst-rank-pill--bronze' : 'inst-rank-pill--default';
                      return (
                        <tr key={row.companyToken} style={{ cursor: 'pointer' }} onClick={() => openCompanyProfile(row.companyToken)}>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`inst-rank-pill ${pillClass}`}>
                              {row.rank}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>{row.companyName}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {row.contact ? `Contacto: ${row.contact}` : row.nit ? `NIT: ${row.nit}` : 'Sin contacto registrado'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a', fontSize: '13px' }}>
                            {money(row.totalAmount)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 800, color: '#2563eb' }}>{row.eventsCount}</span>
                            <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>({row.confirmedCount} conf.)</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                            {row.totalPax.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                            {money(row.avgTicket)}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '12px', color: '#475569' }}>
                            {row.lastVisit || '-'}
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="inst-btn-profile"
                              onClick={() => openCompanyProfile(row.companyToken)}
                            >
                              Ver Ficha
                              <ArrowRight size={12} strokeWidth={2.2} />
                            </button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                          No se encontraron empresas con los filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PESTAÑA 2: FICHA INSTITUCIONAL (PERFIL 360°)
           ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'institucion' && (
          <div>
            {/* Banner de Identidad Corporativa */}
            <div className="inst-company-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '280px' }}>
                <div className="inst-company-avatar">
                  {selectedCompanyInfo ? selectedCompanyInfo.companyName.substring(0, 2).toUpperCase() : <Building2 size={24} strokeWidth={1.8} />}
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Perfil Institucional
                  </div>
                  <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff', margin: '2px 0 6px' }}>
                    {selectedCompanyInfo?.companyName || 'Todas las instituciones'}
                  </h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedCompanyInfo?.nit && <span className="inst-meta-tag"><FileText size={11} /> NIT: {selectedCompanyInfo.nit}</span>}
                    {selectedCompanyInfo?.contact && <span className="inst-meta-tag"><Phone size={11} /> Contacto: {selectedCompanyInfo.contact}</span>}
                    {selectedCompanyInfo?.contactPhone && <span className="inst-meta-tag"><Phone size={11} /> Tel: {selectedCompanyInfo.contactPhone}</span>}
                    {selectedCompanyInfo?.contactEmail && <span className="inst-meta-tag"><Mail size={11} /> {selectedCompanyInfo.contactEmail}</span>}
                  </div>
                </div>
              </div>

              {/* Selector de Empresa y Retorno */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <select
                  value={selectedCompanyToken}
                  onChange={(e) => setSelectedCompanyToken(e.target.value)}
                  className="inst-select-input"
                  style={{ padding: '9px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: '#1e293b', color: '#fff', fontSize: '13px', fontWeight: 700 }}
                >
                  <option value="all">Todas las instituciones (General)</option>
                  {companyRanking.map((comp) => (
                    <option key={comp.companyToken} value={comp.companyToken}>
                      #{comp.rank} - {comp.companyName} ({money(comp.totalAmount)})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="inst-btn-back"
                  onClick={() => setActiveTab('ranking')}
                >
                  <ArrowLeft size={14} strokeWidth={2.2} />
                  Volver al Ranking
                </button>
              </div>
            </div>

            {/* KPIs de la Institución */}
            <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '24px' }}>
              <div className="bento-tile reports-kpi-tile" style={{ borderTop: '4px solid #2563eb' }}>
                <span className="reports-eyebrow">Eventos Registrados</span>
                <strong>{selectedCompanyRows.length}</strong>
                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                  {companySummary.confirmed} confirmados
                </span>
              </div>
              <div className="bento-tile reports-kpi-tile" style={{ borderTop: '4px solid #10b981' }}>
                <span className="reports-eyebrow">Facturación Total</span>
                <strong>{money(companySummary.total)}</strong>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  Abonado {money(companySummary.advances)}
                </span>
              </div>
              <div className="bento-tile reports-kpi-tile" style={{ borderTop: companySummary.pending > 0 ? '4px solid #dc2626' : '4px solid #16a34a' }}>
                <span className="reports-eyebrow">Saldo Pendiente</span>
                <strong style={{ color: companySummary.pending > 0 ? '#dc2626' : '#16a34a' }}>
                  {money(companySummary.pending)}
                </strong>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  {companySummary.pending > 0 ? 'por cobrar' : 'al día'}
                </span>
              </div>
              <div className="bento-tile reports-kpi-tile" style={{ borderTop: '4px solid #f59e0b' }}>
                <span className="reports-eyebrow">PAX Totales</span>
                <strong>{companySummary.pax.toLocaleString()}</strong>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  Promedio: {selectedCompanyRows.length ? Math.round(companySummary.pax / selectedCompanyRows.length) : 0} pax
                </span>
              </div>
            </div>

            {/* ── Gráficos de la Institución ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {/* Consumo Mensual (Área suave SVG) */}
              <div className="inst-chart-card">
                <div className="inst-chart-head">
                  <div>
                    <div className="inst-chart-title">Evolución de Consumo Mensual</div>
                    <div className="inst-chart-subtitle">Historial de montos facturados por mes</div>
                  </div>
                </div>
                <SmoothAreaChart data={monthlyTrendData} height={220} />
              </div>

              {/* Distribución por Estado (Donut SVG) */}
              <div className="inst-chart-card">
                <div className="inst-chart-head">
                  <div>
                    <div className="inst-chart-title">Estado de las Reservas</div>
                    <div className="inst-chart-subtitle">Confirmadas vs Cotizaciones en negociación</div>
                  </div>
                </div>
                <InteractiveDonutChart statusData={statusDistribution} totalEvents={selectedCompanyRows.length} />
              </div>
            </div>

            {/* ── Salones y Subcategorías ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {/* Salones Preferidos */}
              <div className="inst-chart-card">
                <div className="inst-chart-head">
                  <div>
                    <div className="inst-chart-title">Salones Más Utilizados</div>
                    <div className="inst-chart-subtitle">Espacios preferidos para sus eventos</div>
                  </div>
                </div>
                <HorizontalBarRanking
                  items={salonRankingData}
                  showAmount={false}
                  emptyText="Sin salones registrados."
                />
              </div>

              {/* Servicios por Subcategoría */}
              <div className="inst-chart-card">
                <div className="inst-chart-head">
                  <div>
                    <div className="inst-chart-title">Servicios por Subcategoría</div>
                    <div className="inst-chart-subtitle">Desayunos, almuerzos, refacciones y coffee breaks</div>
                  </div>
                </div>
                <HorizontalBarRanking
                  items={subcategoryRankingData}
                  showAmount={true}
                  emptyText="Sin consumo de alimentos o servicios catalogados."
                />
              </div>
            </div>

            {/* ── Menú Preferido (Bento Cards) ── */}
            <div className="inst-chart-card" style={{ marginBottom: '24px' }}>
              <div className="inst-chart-head">
                <div>
                  <div className="inst-chart-title">Menú Preferido de la Institución</div>
                  <div className="inst-chart-subtitle">Proteínas, guarniciones, bebidas y postres más solicitados en sus eventos</div>
                </div>
              </div>
              {menuLoading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
                  Cargando preferencias culinarias...
                </div>
              ) : menuRankings && Object.keys(menuRankings).length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  {Object.entries(menuRankings).map(([tipo, items]) => (
                    <div key={tipo} style={{ background: '#f8fafc', borderRadius: '14px', padding: '14px', border: '1px solid #e2e8f0' }}>
                      <span className="reports-eyebrow" style={{ textTransform: 'capitalize', color: '#2563eb', display: 'block', marginBottom: '8px' }}>
                        {tipo}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {items.slice(0, 5).map((it) => (
                          <div key={it.nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{it.nombre}</span>
                            <span style={{ fontWeight: 800, color: '#2563eb' }}>{it.total}x</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b', background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>
                  No se registran elecciones específicas de menú para esta institución.
                </div>
              )}
            </div>

            {/* ── Encargados Principales ── */}
            {managersRanking.length > 0 && (
              <div className="inst-chart-card" style={{ marginBottom: '24px' }}>
                <div className="inst-chart-head">
                  <div>
                    <div className="inst-chart-title">Encargados con Más Actividad</div>
                    <div className="inst-chart-subtitle">Quién gestiona las reservas dentro de esta institución</div>
                  </div>
                </div>
                <HorizontalBarRanking items={managersRanking} showAmount={true} />
              </div>
            )}

            {/* ── Historial de Eventos de la Institución ── */}
            <div className="inst-chart-card">
              <div className="inst-chart-head" style={{ marginBottom: '4px' }}>
                <div>
                  <div className="inst-chart-title">Historial Detallado de Eventos</div>
                  <div className="inst-chart-subtitle">Listado de reservas correspondientes a la institución</div>
                </div>
              </div>
              <div className="reports-table-wrap" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <table className="reports-table" style={{ minWidth: '880px' }}>
                  <thead>
                    <tr>
                      <th>Estado</th>
                      <th>Reserva</th>
                      <th>Fecha</th>
                      <th>Nombre del Evento</th>
                      <th>Salón</th>
                      <th>Encargado</th>
                      <th style={{ textAlign: 'right' }}>PAX</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'center', width: '105px' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCompanyRows.length ? selectedCompanyRows.map((row) => {
                      const color = STATUS_META[row.status]?.color || '#64748b';
                      return (
                        <tr
                          key={row.reservationKey || row.id}
                          className="inst-clickable-row"
                          onClick={() => handleOpenReservation(row)}
                          title="Haga clic para abrir los detalles de esta reserva en el calendario"
                        >
                          <td>
                            <span style={{ color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 900, whiteSpace: 'nowrap' }}>
                              {row.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: '#2563eb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span>#{row.reservationKey || row.id}</span>
                              <ExternalLink size={12} strokeWidth={2.2} style={{ opacity: 0.7 }} />
                            </div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', color: '#475569', fontSize: '12px' }}>{row.eventDate || '-'}</td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>{row.name}</td>
                          <td style={{ fontSize: '12px' }}>{row.salon}</td>
                          <td style={{ color: '#475569', fontSize: '12px' }}>{row.contact || row.userName}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.pax}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{money(row.total)}</td>
                          <td style={{ textAlign: 'center' }} onClick={(e) => { e.stopPropagation(); handleOpenReservation(row); }}>
                            <button
                              type="button"
                              className="inst-btn-profile"
                              style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '8px' }}
                              title="Abrir reserva en Calendario"
                            >
                              Ver Reserva
                              <ArrowRight size={11} strokeWidth={2.2} />
                            </button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                          Sin eventos registrados para los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}