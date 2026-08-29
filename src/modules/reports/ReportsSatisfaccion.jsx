import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { loadState } from '../../services/stateService';
import ReportInfo from './components/ReportInfo';

const RATING_LEVELS = [
  { value: 'excelente', label: 'Excelente', score: 10, color: '#7c3aed', dot: '#7c3aed' },
  { value: 'bueno', label: 'Bueno', score: 7.5, color: '#16a34a', dot: '#16a34a' },
  { value: 'regular', label: 'Regular', score: 5, color: '#d97706', dot: '#d97706' },
  { value: 'malo', label: 'Malo', score: 2.5, color: '#dc2626', dot: '#dc2626' },
  { value: 'no_aplica', label: 'N/A', score: 0, color: '#94a3b8', dot: '#94a3b8' },
];

const OPERATIVA_STATUS = {
  pendiente: { label: 'Pendiente', color: '#94a3b8', dot: '#94a3b8' },
  en_proceso: { label: 'En proceso', color: '#d97706', dot: '#d97706' },
  cumplido: { label: 'Cumplido', color: '#16a34a', dot: '#16a34a' },
  no_aplica: { label: 'N/A', color: '#64748b', dot: '#64748b' },
};

// ── Helper: genera un PDF con el detalle por punto de un evento ──
async function downloadEventDetailPdf(ev, isOperativa) {
  if (!ev) return;
  try {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageW - margin * 2;
    let y = margin;

    // Header del hotel
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('JARDINES DEL LAGO', margin, y);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('EMS Reservas', pageW - margin, y, { align: 'right' });
    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(isOperativa ? 'Detalle de Check List Operativo' : 'Detalle de Check List de Satisfacción', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    doc.text(ev.eventName || 'Evento', margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const meta = [];
    if (ev.date) meta.push(`Fecha: ${ev.date}`);
    if (ev.salon) meta.push(`Salón: ${ev.salon}`);
    if (ev.status) meta.push(`Status: ${ev.status}`);
    if (ev.client) meta.push(`Cliente: ${ev.client}`);
    doc.text(meta.join('  ·  '), margin, y);
    y += 6;

    // Resumen (caja)
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentW, 24, 2, 2, 'FD');
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('RESUMEN', margin + 4, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const cols = contentW / 3;
    if (isOperativa) {
      doc.text(`Items: ${ev.total}`, margin + 4, y);
      doc.text(`Avance: ${(ev.completionPct || 0).toFixed(0)}%`, margin + 4 + cols, y);
      doc.text(`Completados: ${ev.completed || 0}`, margin + 4 + cols * 2, y);
    } else {
      doc.text(`Calificación: ${(ev.avg || 0).toFixed(1)} / 10  (${getRatingLabel(ev.avg || 0)})`, margin + 4, y);
      doc.text(`Puntos: ${ev.total}`, margin + 4 + cols, y);
      const extra = `${ev.notApplicableCount || 0} N/A · ${ev.unratedCount || 0} sin calificar`;
      doc.text(extra, margin + 4 + cols * 2, y);
    }
    y += 6;
    doc.text('Generado: ' + new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }), margin + 4, y);
    y += 12;

    // Título de la tabla
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Detalle por punto', margin, y);
    y += 5;

    // Encabezado de la tabla
    const colWidths = isOperativa
      ? [8, 42, 60, 30, contentW - 8 - 42 - 60 - 30]
      : [8, 42, 60, 30, contentW - 8 - 42 - 60 - 30];
    const headers = isOperativa
      ? ['#', 'Sección', 'Punto / Actividad', 'Status', 'Comentario']
      : ['#', 'Sección', 'Punto evaluado', 'Calificación', 'Comentario'];
    const drawHeader = () => {
      doc.setFillColor(99, 102, 241);
      doc.rect(margin, y, contentW, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      let x = margin + 2;
      headers.forEach((h, i) => {
        doc.text(h, x, y + 5);
        x += colWidths[i];
      });
      y += 7;
    };
    drawHeader();

    // Filas
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let rowIdx = 0;
    const items = ev.items || [];
    for (const it of items) {
      // Calcular alto de fila en función del text
      const sectionText = (it.sectionName || '—').substring(0, 60);
      const mainText = (it.text || '(sin texto)').substring(0, 200);
      const commentText = (it.comment || '').substring(0, 300);
      doc.setFontSize(8);
      const lineH = 4;
      const linesMain = doc.splitTextToSize(mainText, colWidths[2] - 4);
      const linesComment = doc.splitTextToSize(commentText || '—', colWidths[4] - 4);
      const linesSection = doc.splitTextToSize(sectionText, colWidths[1] - 4);
      const rowH = Math.max(
        lineH * (linesMain.length + 1) + 2,
        lineH * Math.max(1, linesComment.length) + 4,
        lineH * linesSection.length + 4,
        12
      );
      // Si la fila no entra, nueva página
      if (y + rowH > pageH - margin) {
        doc.addPage();
        y = margin;
        drawHeader();
      }
      // Zebra
      if (rowIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentW, rowH, 'F');
      }
      // #
      doc.setTextColor(148, 163, 184);
      doc.text(String(rowIdx + 1), margin + 2, y + 4);
      // Sección (con wrap si es muy larga)
      doc.setTextColor(99, 102, 241);
      doc.setFont('helvetica', 'bold');
      const sectionLines = doc.splitTextToSize(sectionText, colWidths[1] - 4);
      let sy = y + 4;
      sectionLines.forEach(ln => { doc.text(ln, margin + colWidths[0] + 2, sy); sy += lineH; });
      doc.setFont('helvetica', 'normal');
      // Punto
      doc.setTextColor(15, 23, 42);
      let ty = y + 4;
      linesMain.forEach(ln => { doc.text(ln, margin + colWidths[0] + colWidths[1] + 2, ty); ty += lineH; });
      // Rating/Status (chip)
      const chipX = margin + colWidths[0] + colWidths[1] + colWidths[2] + 2;
      if (isOperativa) {
        const st = OPERATIVA_STATUS[it.status] || OPERATIVA_STATUS.pendiente;
        const rgb = hexToRgb(st.color);
        const pastel = hexToPastelRgb(st.color);
        doc.setFillColor(pastel.r, pastel.g, pastel.b);
        doc.setDrawColor(rgb.r, rgb.g, rgb.b);
        doc.setTextColor(rgb.r, rgb.g, rgb.b);
        doc.setFont('helvetica', 'bold');
        doc.roundedRect(chipX, y + 2, colWidths[3] - 2, 5, 1, 1, 'FD');
        doc.text(st.label, chipX + 2, y + 5.5);
        doc.setFont('helvetica', 'normal');
      } else {
        const rl = RATING_LEVELS.find(r => r.value === it.rating);
        const rgb = hexToRgb(rl?.color || '#475569');
        const pastel = hexToPastelRgb(rl?.color || '#475569');
        doc.setFillColor(pastel.r, pastel.g, pastel.b);
        doc.setDrawColor(rgb.r, rgb.g, rgb.b);
        doc.setTextColor(rgb.r, rgb.g, rgb.b);
        doc.setFont('helvetica', 'bold');
        doc.roundedRect(chipX, y + 2, colWidths[3] - 2, 5, 1, 1, 'FD');
        doc.text(`${(rl?.label || it.rating)} ${(it.score || 0).toFixed(1)}`, chipX + 2, y + 5.5);
        doc.setFont('helvetica', 'normal');
      }
      // Comentario
      doc.setTextColor(71, 85, 105);
      let cy = y + 4;
      const commentLines = doc.splitTextToSize(it.comment ? `"${it.comment}"` : '—', colWidths[4] - 4);
      commentLines.forEach(ln => { doc.text(ln, margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, cy); cy += lineH; });
      // Border inferior
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + rowH, margin + contentW, y + rowH);
      y += rowH;
      rowIdx++;
    }

    // Footer con paginación
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
      doc.text('Jardines del Lago · Reporte generado automáticamente', margin, pageH - 6);
    }

    // Descargar
    const fileName = `${(ev.eventName || 'evento').replace(/[^\w\d-]+/g, '_')}_detalle.pdf`;
    doc.save(fileName);
  } catch (err) {
    console.error('Error generando PDF:', err);
    alert('Error al generar el PDF. Revisá la consola para más detalles.');
  }
}

// Helper: convierte hex color a RGB
function hexToRgb(hex) {
  const h = (hex || '#475569').replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

// Helper: devuelve un color pastel mezclando con blanco (85% blanco + 15% color)
function hexToPastelRgb(hex) {
  const { r, g, b } = hexToRgb(hex);
  return {
    r: Math.round(255 - (255 - r) * 0.15),
    g: Math.round(255 - (255 - g) * 0.15),
    b: Math.round(255 - (255 - b) * 0.15),
  };
}

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getRatingColor(avg) {
  if (avg >= 8.75) return '#22c55e';
  if (avg >= 6.25) return '#eab308';
  if (avg >= 3.75) return '#f97316';
  return '#ef4444';
}

function getRatingEmoji(avg) {
  if (avg >= 8.75) return getRatingLabel(avg);
  if (avg >= 6.25) return getRatingLabel(avg);
  if (avg >= 3.75) return getRatingLabel(avg);
  return getRatingLabel(avg);
}

function getRatingLabel(avg) {
  if (avg >= 8.75) return 'Excelente';
  if (avg >= 6.25) return 'Bueno';
  if (avg >= 3.75) return 'Regular';
  return 'Malo';
}

function fmtMonth(yyyymm) {
  const [y, m] = yyyymm.split('-');
  return `${MONTH_SHORT[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export default function ReportsSatisfaccion({ onClose }) {
  const { events } = useOutletContext();
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [viewTab, setViewTab] = useState('satisfaccion');
  const [selectedEventId, setSelectedEventId] = useState(''); // '' = todos

  // Buscador de eventos (modal)
  const [showEventSearch, setShowEventSearch] = useState(false);
  const [searchFromDate, setSearchFromDate] = useState('');
  const [searchToDate, setSearchToDate] = useState('');
  const [searchCompany, setSearchCompany] = useState('');
  const [searchText, setSearchText] = useState('');

  // Búsqueda rápida (siempre visible, arriba de los filtros)
  const [quickDate, setQuickDate] = useState('');
  const [quickText, setQuickText] = useState('');

  // ── Load satisfaction data ──
  const [checklists, setChecklists] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const state = await loadState({ cacheBust: true });
        setChecklists((state.eventChecklists && typeof state.eventChecklists === 'object') ? state.eventChecklists : {});
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  // ── Compute satisfaction data ──
  const satisfactionData = useMemo(() => {
    if (loading || !events) return null;

    const results = [];
    for (const [evtId, chk] of Object.entries(checklists)) {
      const ev = Array.isArray(events) ? events.find(e => String(e.id) === evtId) : null;
      if (!ev) continue;
      const date = ev.date || ev.eventDate || '';
      if (date < fromDate || date > toDate) continue;

      const items = Array.isArray(chk?.evaluacion?.items)
        ? chk.evaluacion.items
        : (Array.isArray(chk?.items) ? chk.items.filter(i => i.sectionType === 'evaluacion') : []);
      // N/A (rating === 'no_aplica') se excluye del numerador Y del denominador.
      const ratedItems = items.filter(i => i.rating !== null && i.rating !== undefined && i.rating !== 'no_aplica');
      const notApplicableCount = items.filter(i => i.rating === 'no_aplica').length;
      const unratedCount = items.filter(i => i.rating === null || i.rating === undefined).length;
      if (ratedItems.length === 0) continue;

      const totalScore = ratedItems.reduce((sum, i) => sum + (RATING_LEVELS.find(r => r.value === i.rating)?.score || 0), 0);
      const avg = totalScore / ratedItems.length;

      const dist = { malo: 0, regular: 0, bueno: 0, excelente: 0 };
      ratedItems.forEach(i => { if (dist[i.rating] !== undefined) dist[i.rating]++; });

      results.push({
        eventId: evtId,
        eventName: ev.eventName || ev.client || ev.name || 'Evento',
        date,
        salon: ev.salon || '',
        status: ev.status || '',
        avg,
        total: ratedItems.length,
        notApplicableCount,
        unratedCount,
        distribution: dist,
        items: ratedItems.map(i => ({
          text: i.text,
          sectionName: i.sectionName,
          rating: i.rating,
          score: RATING_LEVELS.find(r => r.value === i.rating)?.score || 0,
          comment: i.comment || i.comentario || '',
        })),
      });
    }

    results.sort((a, b) => b.date.localeCompare(a.date));
    return results;
  }, [checklists, events, fromDate, toDate, loading]);

  // ── Operativa data (status de cada item por evento) ──
  const operativaData = useMemo(() => {
    if (loading || !events) return null;
    const results = [];
    for (const [evtId, chk] of Object.entries(checklists)) {
      const ev = Array.isArray(events) ? events.find(e => String(e.id) === evtId) : null;
      if (!ev) continue;
      const date = ev.date || ev.eventDate || '';
      if (date < fromDate || date > toDate) continue;
      const items = Array.isArray(chk?.operativa?.items) ? chk.operativa.items : [];
      if (items.length === 0) continue;
      const dist = { pendiente: 0, en_proceso: 0, cumplido: 0, no_aplica: 0 };
      items.forEach(i => { if (dist[i.status] !== undefined) dist[i.status]++; });
      const completed = dist.cumplido + dist.no_aplica;
      const completionPct = items.length > 0 ? (completed / items.length) * 100 : 0;
      results.push({
        eventId: evtId,
        eventName: ev.eventName || ev.client || ev.name || 'Evento',
        date,
        salon: ev.salon || '',
        status: ev.status || '',
        total: items.length,
        completed,
        completionPct,
        distribution: dist,
        items: items.map(i => ({
          text: i.text,
          sectionName: i.sectionName,
          status: i.status || 'pendiente',
          comment: i.comment || i.comentario || '',
        })),
      });
    }
    results.sort((a, b) => b.date.localeCompare(a.date));
    return results;
  }, [checklists, events, fromDate, toDate, loading]);

  // ── Operativa metrics ──
  const operativaMetrics = useMemo(() => {
    if (!operativaData || operativaData.length === 0) return null;
    const totalItems = operativaData.reduce((sum, ev) => sum + ev.total, 0);
    const totalDist = { pendiente: 0, en_proceso: 0, cumplido: 0, no_aplica: 0 };
    operativaData.forEach(ev => { Object.entries(ev.distribution).forEach(([k, v]) => { totalDist[k] += v; }); });
    const completed = totalDist.cumplido + totalDist.no_aplica;
    const completionPct = totalItems > 0 ? (completed / totalItems) * 100 : 0;
    return { totalItems, totalDist, completed, completionPct, eventsCount: operativaData.length };
  }, [operativaData]);

  // ── Satisfacción agrupada por sección del checklist ──
  const satisfaccionBySection = useMemo(() => {
    if (!satisfactionData || satisfactionData.length === 0) return [];
    const bySection = {};
    satisfactionData.forEach(ev => {
      (ev.items || []).forEach(it => {
        const sec = (it.sectionName || 'Sin sección').trim();
        if (!bySection[sec]) bySection[sec] = { sum: 0, count: 0 };
        bySection[sec].sum += (it.score || 0);
        bySection[sec].count += 1;
      });
    });
    return Object.entries(bySection)
      .map(([section, data]) => ({ section, avg: data.sum / data.count, count: data.count }))
      .sort((a, b) => b.avg - a.avg);
  }, [satisfactionData]);

  // ── Operativa agrupada por sección del checklist ──
  const operativaBySection = useMemo(() => {
    if (!operativaData || operativaData.length === 0) return [];
    const bySection = {};
    operativaData.forEach(ev => {
      (ev.items || []).forEach(it => {
        const sec = (it.sectionName || 'Sin sección').trim();
        if (!bySection[sec]) bySection[sec] = { total: 0, done: 0, dist: { pendiente: 0, en_proceso: 0, cumplido: 0, no_aplica: 0 } };
        bySection[sec].total += 1;
        if (it.status === 'cumplido' || it.status === 'no_aplica') bySection[sec].done += 1;
        if (bySection[sec].dist[it.status] !== undefined) bySection[sec].dist[it.status] += 1;
      });
    });
    return Object.entries(bySection)
      .map(([section, data]) => ({
        section,
        total: data.total,
        done: data.done,
        completionPct: data.total > 0 ? (data.done / data.total) * 100 : 0,
        dist: data.dist,
      }))
      .sort((a, b) => b.completionPct - a.completionPct);
  }, [operativaData]);

  // ── Datos para el buscador de eventos: incluye TODOS los eventos con checklist
  //    (evaluación u operativa) sin filtrar por el rango Desde/Hasta principal,
  //    para que la búsqueda rápida pueda encontrar cualquier evento por fecha o nombre
  //    sin depender de los filtros de periodo. Combina el texto de los items para que
  //    la búsqueda encuentre "Tigo" en cualquier item del checklist. ──
  const searchableEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];
    const out = [];
    for (const ev of events) {
      const evtId = String(ev.id);
      const chk = checklists[evtId];
      if (!chk) continue;
      const evalItems = Array.isArray(chk?.evaluacion?.items) ? chk.evaluacion.items : [];
      const opItems = Array.isArray(chk?.operativa?.items) ? chk.operativa.items : [];
      if (evalItems.length === 0 && opItems.length === 0) continue;
      const date = ev.date || ev.eventDate || '';
      const itemText = [...evalItems, ...opItems]
        .map(i => [i.text, i.sectionName, i.comment, i.comentario].filter(Boolean).join(' '))
        .join(' | ');
      out.push({
        id: evtId,
        eventName: ev.eventName || ev.client || ev.name || 'Evento',
        client: ev.client || ev.institucion || ev.companyName || ev.company || '',
        salon: ev.salon || '',
        date,
        status: ev.status || '',
        itemText,
        hasEval: evalItems.length > 0,
        hasOperativa: opItems.length > 0,
      });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [events, checklists]);

  // ── Empresas disponibles para el buscador ──
  const availableCompanies = useMemo(() => {
    const set = new Set();
    if (Array.isArray(searchableEvents)) {
      searchableEvents.forEach(ev => { if (ev.client) set.add(String(ev.client)); });
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [searchableEvents]);

  // ── Resultados del buscador: filtra por fechas + empresa + texto (incluye items) ──
  const eventSearchResults = useMemo(() => {
    if (!showEventSearch) return [];
    if (!Array.isArray(searchableEvents)) return [];
    const q = searchText.trim().toLowerCase();
    return searchableEvents.filter(ev => {
      const date = ev.date || ev.eventDate || '';
      if (searchFromDate && date < searchFromDate) return false;
      if (searchToDate && date > searchToDate) return false;
      if (searchCompany && String(ev.client || '') !== searchCompany) return false;
      if (q) {
        const haystack = [ev.eventName, ev.client, ev.salon, ev.itemText]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [searchableEvents, showEventSearch, searchFromDate, searchToDate, searchCompany, searchText]);

  // ── Handlers del buscador ──
  const openEventSearch = () => {
    setSearchFromDate(fromDate);
    setSearchToDate(toDate);
    setSearchCompany('');
    setSearchText('');
    setShowEventSearch(true);
  };
  const closeEventSearch = () => setShowEventSearch(false);
  const handleSelectEvent = (eventId) => {
    const ev = searchableEvents.find(e => e.id === eventId);
    setSelectedEventId(eventId);
    // Expandir el rango principal para incluir la fecha del evento seleccionado.
    if (ev && ev.date) {
      if (!fromDate || ev.date < fromDate) setFromDate(ev.date);
      if (!toDate || ev.date > toDate) setToDate(ev.date);
      if (ev.hasEval) setViewTab('satisfaccion');
      else if (ev.hasOperativa) setViewTab('operativa');
    }
    setShowEventSearch(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const clearSearchFilters = () => {
    setSearchFromDate('');
    setSearchToDate('');
    setSearchCompany('');
    setSearchText('');
  };

  // ESC para cerrar el buscador
  useEffect(() => {
    if (!showEventSearch) return;
    const onKey = (e) => { if (e.key === 'Escape') closeEventSearch(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showEventSearch]);

  // ── Búsqueda rápida: filtra eventos por una fecha específica + texto. ──
  const quickSearchResults = useMemo(() => {
    if (!Array.isArray(searchableEvents)) return [];
    if (!quickDate && !quickText.trim()) return [];
    const q = quickText.trim().toLowerCase();
    return searchableEvents.filter(ev => {
      const date = ev.date || '';
      if (quickDate && date !== quickDate) return false;
      if (q) {
        const haystack = [ev.eventName, ev.client, ev.salon, ev.itemText]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).slice(0, 8);
  }, [searchableEvents, quickDate, quickText]);

  const clearQuickSearch = () => { setQuickDate(''); setQuickText(''); };

  // ── Aggregate metrics ──
  const metrics = useMemo(() => {
    if (!satisfactionData || satisfactionData.length === 0) return null;

    const totalRatings = satisfactionData.reduce((sum, ev) => sum + ev.total, 0);
    const allScores = satisfactionData.flatMap(ev => ev.items.map(i => i.score));
    const globalAvg = totalRatings > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

    const totalDist = { malo: 0, regular: 0, bueno: 0, excelente: 0 };
    satisfactionData.forEach(ev => {
      Object.entries(ev.distribution).forEach(([k, v]) => { totalDist[k] += v; });
    });

    const eventsWithRating = satisfactionData.length;
    const recentAvg = satisfactionData.slice(0, 10).reduce((sum, ev) => sum + ev.avg, 0) / Math.min(10, satisfactionData.length);

    return {
      totalEvents: eventsWithRating,
      totalRatings,
      globalAvg,
      recentAvg,
      totalDist,
      excellentPct: totalRatings > 0 ? (totalDist.excelente / totalRatings) * 100 : 0,
      goodPct: totalRatings > 0 ? (totalDist.bueno / totalRatings) * 100 : 0,
      regularPct: totalRatings > 0 ? (totalDist.regular / totalRatings) * 100 : 0,
      badPct: totalRatings > 0 ? (totalDist.malo / totalRatings) * 100 : 0,
    };
  }, [satisfactionData]);

  // ── Trends by month ──
  const monthlyTrend = useMemo(() => {
    if (!satisfactionData) return [];
    const byMonth = {};
    satisfactionData.forEach(ev => {
      const mk = ev.date.substring(0, 7);
      if (!byMonth[mk]) byMonth[mk] = { scores: [], count: 0, events: 0 };
      byMonth[mk].scores.push(ev.avg);
      byMonth[mk].count += ev.total;
      byMonth[mk].events++;
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        avg: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        total: data.count,
        events: data.events,
      }));
  }, [satisfactionData]);

  const handleReset = () => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    setFromDate(d.toISOString().split('T')[0]);
    setToDate(new Date().toISOString().split('T')[0]);
    setViewTab('general');
  };

  if (loading) {
    return (
      <div className="reports-page-container">
        <div className="reports-page-header">
          <div className="reports-brand-header">
            <div className="reports-brand-badge">
              <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
            </div>
            <div>
              <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
              <div className="reports-title">Satisfacción del Cliente</div>
              <div className="reports-subtitle">Cargando datos de evaluación...</div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={onClose}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        </div>
        <div className="reports-page-body" style={{ alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
          <div style={{ fontSize: '14px', color: '#94a3b8' }}>⏳ Cargando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-page-container">
      {/* Header */}
      <div className="reports-page-header">
        <div className="reports-brand-header">
          <div className="reports-brand-badge">
            <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
          </div>
          <div>
            <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
            <div className="reports-title">Satisfacción del Cliente</div>
            <div className="reports-subtitle">Evaluación de servicio por evento — escala sobre 10</div>
          </div>
        </div>
        <ReportInfo reportKey="satisfaccion" />
        <button className="btn-exit" type="button" onClick={onClose}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver
        </button>
      </div>

      {/* Tabs: Satisfacción / Operativa */}
      <div style={{ display: 'flex', gap: '4px', padding: '0 24px', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
        <button
          type="button"
          onClick={() => { setViewTab('satisfaccion'); setSelectedEventId(''); }}
          style={{
            padding: '12px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '14px', fontWeight: 700, color: viewTab === 'satisfaccion' ? '#0f172a' : '#64748b',
            borderBottom: viewTab === 'satisfaccion' ? '3px solid #6366f1' : '3px solid transparent',
            marginBottom: '-1px', transition: 'all 0.15s ease',
          }}
        >
          Satisfacción
          <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
            ({satisfactionData?.length || 0} eventos)
          </span>
        </button>
        <button
          type="button"
          onClick={() => { setViewTab('operativa'); setSelectedEventId(''); }}
          style={{
            padding: '12px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '14px', fontWeight: 700, color: viewTab === 'operativa' ? '#0f172a' : '#64748b',
            borderBottom: viewTab === 'operativa' ? '3px solid #6366f1' : '3px solid transparent',
            marginBottom: '-1px', transition: 'all 0.15s ease',
          }}
        >
          Operativa
          <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
            ({operativaData?.length || 0} eventos)
          </span>
        </button>
      </div>

      <div className="reports-page-body">
        {/* ── Búsqueda rápida: fecha específica + texto libre ── */}
        <section className="reports-hero-panel" style={{ gap: '10px' }}>
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Búsqueda rápida</span>
              <h3 className="reports-section-title">Encuentra un evento por fecha o nombre</h3>
              <p className="reports-section-text" style={{ marginTop: '2px' }}>
                Escribe una fecha específica o parte del nombre del evento, cliente, salón o cualquier item del checklist. La búsqueda es en vivo.
              </p>
            </div>
          </div>
          <div className="reports-toolbar" style={{ gap: '12px', padding: '12px 20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: '0 0 180px' }}>
              <span>Fecha específica</span>
              <input
                type="date"
                value={quickDate}
                onChange={e => setQuickDate(e.target.value)}
              />
            </label>
            <label className="field" style={{ flex: '1 1 280px', minWidth: '220px' }}>
              <span>Buscar (nombre, cliente, salón, item)</span>
              <input
                type="text"
                value={quickText}
                onChange={e => setQuickText(e.target.value)}
                placeholder="ej. Tigo, Boda, cumple..."
              />
            </label>
            {(quickDate || quickText) ? (
              <button
                type="button"
                onClick={clearQuickSearch}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#ffffff', color: '#475569', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Limpiar
              </button>
            ) : null}
          </div>
          {quickSearchResults.length > 0 && (
            <div style={{ padding: '0 20px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {quickSearchResults.length} resultado(s) — click para abrir
              </div>
              {quickSearchResults.map(ev => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => {
                    setSelectedEventId(ev.id);
                    // Expandir el rango de fechas del filtro principal para incluir este evento,
                    // así el detalle (que se renderiza desde satisfactionData/operativaData filtrados) lo encuentra.
                    if (ev.date) {
                      if (!fromDate || ev.date < fromDate) setFromDate(ev.date);
                      if (!toDate || ev.date > toDate) setToDate(ev.date);
                    }
                    // Cambiar al tab que tenga el check list del evento
                    if (ev.hasEval) setViewTab('satisfaccion');
                    else if (ev.hasOperativa) setViewTab('operativa');
                    setQuickDate('');
                    setQuickText('');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', borderRadius: '8px',
                    border: '1px solid #e2e8f0', background: '#ffffff',
                    textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#6366f1'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{ev.eventName}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                      {ev.date}{ev.salon ? ` · ${ev.salon}` : ''}{ev.client ? ` · ${ev.client}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {ev.hasEval ? <span style={{ fontSize: '10px', fontWeight: 700, color: '#7c3aed', padding: '2px 6px', borderRadius: '4px', background: '#7c3aed14' }}>EVAL</span> : null}
                    {ev.hasOperativa ? <span style={{ fontSize: '10px', fontWeight: 700, color: '#d97706', padding: '2px 6px', borderRadius: '4px', background: '#d9770614' }}>OPER</span> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
          {(quickDate || quickText) && quickSearchResults.length === 0 && (
            <div style={{ padding: '12px 20px 16px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
              Sin resultados para esa búsqueda.
            </div>
          )}
        </section>

        {/* ── Filters ── */}
        <section className="reports-hero-panel">
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Filtros de periodo</span>
              <h3 className="reports-section-title">Análisis de satisfacción</h3>
              <p className="reports-section-text">Evalúa la percepción del cliente sobre el servicio recibido en cada evento.</p>
            </div>
          </div>
          <div className="reports-toolbar" style={{ gap: '16px', padding: '16px 20px', flexWrap: 'wrap' }}>
            <label className="field" style={{ flex: '0 0 148px', maxWidth: '148px' }}>
              <span>Desde</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '0 0 148px', maxWidth: '148px' }}>
              <span>Hasta</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </label>
            <div className="reports-actions" style={{ marginLeft: '0', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={openEventSearch}
                style={{ background: '#6366f1', color: '#ffffff', borderColor: '#6366f1' }}
              >
                Buscar evento
              </button>
              <button type="button" onClick={handleReset}>Últimos 3 meses</button>
            </div>
          </div>
        </section>

        {/* ── Vista según tab ── */}
        {viewTab === 'satisfaccion' && (
          (!satisfactionData || satisfactionData.length === 0) ? (
            <div className="reports-hero-panel" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', border: '1px dashed #e2e8f0', borderRadius: '16px' }}>
              <div style={{ width: '40px', height: '40px', margin: '0 auto 12px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#cbd5e1', display: 'inline-block' }} />
              </div>
              <p style={{ fontWeight: 600, color: '#475569' }}>No hay evaluaciones de satisfacción en el periodo seleccionado.</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Crea secciones de tipo "Evaluación" en las plantillas de checklist y asígnalas a eventos para ver los resultados aquí.</p>
            </div>
          ) : selectedEventId ? (
            <SingleEventDetail eventData={satisfactionData.find(e => e.eventId === selectedEventId)} onBack={() => setSelectedEventId('')} />
          ) : (
          <>
            {/* ── Hero KPI Cards (4 columnas) ── */}
            <section className="reports-hero-panel" style={{ gap: '12px' }}>
              <div className="reports-section-intro">
                <div>
                  <span className="reports-eyebrow">Resumen general</span>
                  <h3 className="reports-section-title">KPIs de satisfacción</h3>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                {/* Calificación global */}
                <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: getRatingColor(metrics.globalAvg), gridColumn: 'span 2', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: '-10px', top: '-10px', fontSize: '90px', opacity: 0.08 }}>{getRatingEmoji(metrics.globalAvg)}</div>
                  <span className="reports-eyebrow">Calificación global</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '4px' }}>
                    <strong style={{ fontSize: '2.4rem', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
                      {metrics.globalAvg.toFixed(1)}
                    </strong>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: getRatingColor(metrics.globalAvg) }}>
                      / 10.0
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '20px' }}>{getRatingEmoji(metrics.globalAvg)}</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: getRatingColor(metrics.globalAvg), textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {getRatingLabel(metrics.globalAvg)}
                    </span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden', marginTop: '8px' }}>
                    <div style={{ height: '100%', borderRadius: '999px', background: `linear-gradient(90deg, ${getRatingColor(metrics.globalAvg)}, ${getRatingColor(metrics.globalAvg)}cc)`, width: `${(metrics.globalAvg / 10) * 100}%`, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                    Basado en <strong>{metrics.totalRatings}</strong> calificaciones de <strong>{metrics.totalEvents}</strong> eventos
                  </div>
                </div>

                {/* Eventos evaluados */}
                <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#6366f1', gap: '4px' }}>
                  <span className="reports-eyebrow">Eventos evaluados</span>
                  <strong style={{ fontSize: '2rem', fontWeight: '900', color: '#0f172a', lineHeight: 1, marginTop: '4px' }}>{metrics.totalEvents}</strong>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>en el periodo</span>
                </div>

                {/* Tendencia reciente */}
                <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#3b82f6', gap: '4px' }}>
                  <span className="reports-eyebrow">Prom. últimos 10</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                    <strong style={{ fontSize: '2rem', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>{metrics.recentAvg.toFixed(1)}</strong>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: metrics.recentAvg >= metrics.globalAvg ? '#16a34a' : '#dc2626' }}>
                      {metrics.recentAvg >= metrics.globalAvg ? '↑' : '↓'}
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>vs global {metrics.globalAvg.toFixed(1)}</span>
                </div>
              </div>
            </section>

            {/* ── Distribution (donut) + Monthly Trend (line chart) ── */}
            <section className="reports-hero-panel" style={{ gap: '12px' }}>
              <div className="reports-section-intro">
                <div>
                  <span className="reports-eyebrow">Distribución y tendencia</span>
                  <h3 className="reports-section-title">Calificaciones y evolución</h3>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: '14px' }}>
                {/* Donut de distribución */}
                <div className="bento-tile" style={{ padding: '20px', gap: '16px' }}>
                  <div>
                    <div className="reports-eyebrow">Proporción de ratings</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>{metrics.totalRatings} calificaciones en total</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    <DonutChart dist={metrics.totalDist} total={metrics.totalRatings} />
                    <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {RATING_LEVELS.map(r => {
                        const count = metrics.totalDist[r.value] || 0;
                        const pct = metrics.totalRatings > 0 ? (count / metrics.totalRatings) * 100 : 0;
                        return (
                          <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: r.color, flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: r.color, flex: 1 }}>{r.emoji} {r.label}</span>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{count}</span>
                            <span style={{ fontSize: '11px', color: '#94a3b8', minWidth: '38px', textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Tendencia mensual (line chart) */}
                <div className="bento-tile" style={{ padding: '20px', gap: '12px' }}>
                  <div>
                    <div className="reports-eyebrow">Tendencia mensual</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>Evolución del promedio por mes</div>
                  </div>
                  <TrendChart data={monthlyTrend} />
                </div>
              </div>
            </section>

            {/* ── Calificación por sección del checklist ── */}
            {satisfaccionBySection.length > 0 && (
              <section className="reports-hero-panel" style={{ gap: '12px' }}>
                <div className="reports-section-intro">
                  <div>
                    <span className="reports-eyebrow">Por sección del checklist</span>
                    <h3 className="reports-section-title">Calificación promedio por sección</h3>
                    <p className="reports-section-text" style={{ marginTop: '2px' }}>
                      Qué áreas del servicio tienen mejor y peor percepción. Útil para priorizar mejoras.
                    </p>
                  </div>
                </div>
                <div className="bento-tile" style={{ padding: '20px' }}>
                  <BarChart
                    data={satisfaccionBySection}
                    valueKey="avg"
                    valueLabel="Calificación"
                    valueMax={10}
                    colorOf={(it) => getRatingColor(it.avg)}
                    valueFormatter={(it) => `${it.avg.toFixed(1)} / 10  (${it.count})`}
                  />
                </div>
              </section>
            )}

            {/* ── Per-event detail ── */}
            <section className="reports-hero-panel" style={{ gap: '12px' }}>
              <div className="reports-section-intro">
                <div>
                  <span className="reports-eyebrow">Detalle</span>
                  <h3 className="reports-section-title">Puntos evaluados por evento</h3>
                </div>
              </div>
              <div className="reports-table-wrap">
                <table className="reports-table" style={{ minWidth: '900px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '36px' }}>#</th>
                      <th>Evento</th>
                      <th>Salón</th>
                      <th style={{ textAlign: 'center' }}>Promedio</th>
                      <th style={{ textAlign: 'center' }}>Calificación</th>
                      <th style={{ textAlign: 'center', width: '180px' }}>Distribución</th>
                      <th>Comentarios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {satisfactionData.map((ev, idx) => {
                      const commentsList = (ev.items || []).filter(i => i.comment).map(i => i.comment);
                      return (
                        <tr key={ev.eventId} onClick={() => setSelectedEventId(ev.eventId)} style={{ cursor: 'pointer' }}>
                          <td style={{ color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                          <td>
                            <strong style={{ color: '#0f172a' }}>{ev.eventName}</strong>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>{ev.date} {ev.salon ? `· ${ev.salon}` : ''}</div>
                          </td>
                          <td style={{ color: '#475569' }}>{ev.salon || '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '16px', fontWeight: 800, color: getRatingColor(ev.avg) }}>
                              {ev.avg.toFixed(1)}
                            </span>
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}> / 10.0</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
                              fontSize: '11px', fontWeight: 700,
                              background: `${getRatingColor(ev.avg)}14`, color: getRatingColor(ev.avg),
                            }}>
                              {getRatingLabel(ev.avg)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                              {RATING_LEVELS.map(r => {
                                const cnt = ev.distribution[r.value] || 0;
                                if (cnt === 0) return null;
                                return (
                                  <span key={r.value} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                    padding: '2px 6px', borderRadius: '4px',
                                    background: `${r.color}14`, color: r.color,
                                    fontSize: '10px', fontWeight: 700,
                                  }}>
                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: r.dot }} />
                                    {r.label} {cnt}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td style={{ fontSize: '11px', color: '#475569', maxWidth: '320px' }}>
                            {commentsList.length === 0 ? (
                              <span style={{ color: '#cbd5e1' }}>—</span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {commentsList.slice(0, 2).map((c, i) => (
                                  <span key={i} style={{ fontStyle: 'italic', color: '#475569' }}>
                                    “{c.length > 80 ? c.substring(0, 80) + '…' : c}”
                                  </span>
                                ))}
                                {commentsList.length > 2 ? (
                                  <span style={{ color: '#6366f1', fontWeight: 700, fontSize: '10px' }}>
                                    + {commentsList.length - 2} comentario(s) más — click para ver
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Storytelling ── */}
            <div className="reports-storytelling-card">
              <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Narración de satisfacción</span>
              <p className="reports-story-text">
                En el periodo analizado, se evaluaron <strong className="highlight-blue">{metrics.totalEvents} eventos</strong> con un total de <strong className="highlight-blue">{metrics.totalRatings} puntos</strong> calificados.
                La satisfacción global promedio es de <strong className="highlight-green">{metrics.globalAvg.toFixed(1)} / 10.0</strong>, lo que corresponde a un nivel <strong className={metrics.globalAvg >= 8.75 ? 'highlight-green' : metrics.globalAvg >= 6.25 ? 'highlight-orange' : 'highlight-slate'}>{getRatingLabel(metrics.globalAvg)}</strong>.
                El <strong className="highlight-green">{metrics.excellentPct.toFixed(0)}%</strong> de las calificaciones fueron <strong className="highlight-green">Excelente 💎</strong>, mientras que el <strong className={metrics.badPct > 0 ? 'highlight-orange' : 'highlight-slate'}>{metrics.badPct.toFixed(0)}%</strong> fueron <strong className={metrics.badPct > 0 ? 'highlight-orange' : 'highlight-slate'}>Malo 🔴</strong>.
                {monthlyTrend.length >= 2 && (
                  <> La tendencia mensual muestra {monthlyTrend[monthlyTrend.length - 1].avg >= monthlyTrend[0].avg ? 'una mejora' : 'una disminución'} en el último periodo evaluado.</>
                )}
              </p>
            </div>
          </>
          )
        )}

        {/* ── Tab Operativa ── */}
        {viewTab === 'operativa' && (
          (!operativaData || operativaData.length === 0) ? (
            <div className="reports-hero-panel" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', border: '1px dashed #e2e8f0', borderRadius: '16px' }}>
              <div style={{ width: '40px', height: '40px', margin: '0 auto 12px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#cbd5e1', display: 'inline-block' }} />
              </div>
              <p style={{ fontWeight: 600, color: '#475569' }}>No hay check lists operativos en el periodo seleccionado.</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Crea secciones de tipo "Operativa" en las plantillas y asígnalas a eventos para ver el avance aquí.</p>
            </div>
          ) : selectedEventId ? (
            <OperativaEventDetail eventData={operativaData.find(e => e.eventId === selectedEventId)} onBack={() => setSelectedEventId('')} />
          ) : (
            <>
              {/* KPIs Operativa */}
              <section className="reports-hero-panel" style={{ gap: '12px' }}>
                <div className="reports-section-intro">
                  <div>
                    <span className="reports-eyebrow">Resumen general</span>
                    <h3 className="reports-section-title">KPIs operativos</h3>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                  <div className="bento-tile" style={{ borderTopColor: '#16a34a' }}>
                    <span className="reports-eyebrow">Items totales</span>
                    <strong style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a' }}>{operativaMetrics.totalItems}</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>en {operativaMetrics.eventsCount} evento(s)</span>
                  </div>
                  <div className="bento-tile" style={{ borderTopColor: '#16a34a' }}>
                    <span className="reports-eyebrow">Cumplidos</span>
                    <strong style={{ fontSize: '2rem', fontWeight: 900, color: '#16a34a' }}>{operativaMetrics.totalDist.cumplido}</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                      {((operativaMetrics.totalDist.cumplido / operativaMetrics.totalItems) * 100 || 0).toFixed(0)}% del total
                    </span>
                  </div>
                  <div className="bento-tile" style={{ borderTopColor: '#d97706' }}>
                    <span className="reports-eyebrow">En proceso</span>
                    <strong style={{ fontSize: '2rem', fontWeight: 900, color: '#d97706' }}>{operativaMetrics.totalDist.en_proceso}</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                      {((operativaMetrics.totalDist.en_proceso / operativaMetrics.totalItems) * 100 || 0).toFixed(0)}% del total
                    </span>
                  </div>
                  <div className="bento-tile" style={{ borderTopColor: '#dc2626' }}>
                    <span className="reports-eyebrow">Pendientes</span>
                    <strong style={{ fontSize: '2rem', fontWeight: 900, color: '#dc2626' }}>{operativaMetrics.totalDist.pendiente}</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                      {((operativaMetrics.totalDist.pendiente / operativaMetrics.totalItems) * 100 || 0).toFixed(0)}% del total
                    </span>
                  </div>
                </div>
              </section>

              {/* ── Distribución de status (donut) + Avance por sección (bar) ── */}
              <section className="reports-hero-panel" style={{ gap: '12px' }}>
                <div className="reports-section-intro">
                  <div>
                    <span className="reports-eyebrow">Visualización</span>
                    <h3 className="reports-section-title">Distribución y avance por sección</h3>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: '14px' }}>
                  <div className="bento-tile" style={{ padding: '20px', gap: '16px' }}>
                    <div>
                      <div className="reports-eyebrow">Proporción de status</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>{operativaMetrics.totalItems} items en total</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                      <DonutChart
                        dist={operativaMetrics.totalDist}
                        total={operativaMetrics.totalItems}
                        levels={Object.entries(OPERATIVA_STATUS).map(([k, st]) => ({ value: k, color: st.color }))}
                        levelsOrder={['cumplido', 'en_proceso', 'pendiente', 'no_aplica']}
                        centerLabel="Items"
                        centerSubLabel="totales"
                      />
                      <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.entries(OPERATIVA_STATUS).map(([k, st]) => {
                          const cnt = operativaMetrics.totalDist[k] || 0;
                          const pct = operativaMetrics.totalItems > 0 ? (cnt / operativaMetrics.totalItems) * 100 : 0;
                          return (
                            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: st.color, flexShrink: 0 }} />
                              <span style={{ fontSize: '12px', fontWeight: 700, color: st.color, flex: 1 }}>{st.label}</span>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{cnt}</span>
                              <span style={{ fontSize: '11px', color: '#94a3b8', minWidth: '38px', textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="bento-tile" style={{ padding: '20px', gap: '12px' }}>
                    <div>
                      <div className="reports-eyebrow">Avance por sección del checklist</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>
                        % de items completados (Cumplido + N/A) por sección
                      </div>
                    </div>
                    {operativaBySection.length > 0 ? (
                      <BarChart
                        data={operativaBySection}
                        valueKey="completionPct"
                        valueLabel="Avance"
                        valueMax={100}
                        colorOf={(it) => it.completionPct >= 80 ? '#16a34a' : it.completionPct >= 50 ? '#d97706' : '#dc2626'}
                        valueFormatter={(it) => `${it.completionPct.toFixed(0)}%  (${it.done}/${it.total})`}
                      />
                    ) : (
                      <div style={{ padding: '20px', color: '#94a3b8', fontWeight: 700, textAlign: 'center' }}>Sin datos por sección.</div>
                    )}
                  </div>
                </div>
              </section>

              {/* Distribución de status por evento */}
              <section className="reports-hero-panel" style={{ gap: '12px' }}>
                <div className="reports-section-intro">
                  <div>
                    <span className="reports-eyebrow">Detalle por evento</span>
                    <h3 className="reports-section-title">Avance de check list operativo</h3>
                  </div>
                </div>
                <div className="reports-table-wrap">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Evento</th>
                        <th>Salón</th>
                        <th style={{ textAlign: 'center' }}>Items</th>
                        <th style={{ textAlign: 'center' }}>Avance</th>
                        <th style={{ textAlign: 'center' }}>Distribución</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operativaData.map(ev => (
                        <tr
                          key={ev.eventId}
                          onClick={() => setSelectedEventId(ev.eventId)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <strong style={{ color: '#0f172a' }}>{ev.eventName}</strong>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>{ev.date} {ev.salon ? `· ${ev.salon}` : ''}</div>
                          </td>
                          <td style={{ color: '#475569' }}>{ev.salon || '—'}</td>
                          <td style={{ textAlign: 'center' }}>{ev.total}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                              <div style={{ flex: 1, maxWidth: '120px', height: '6px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
                                <div style={{ height: '100%', background: '#16a34a', width: `${ev.completionPct}%` }} />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>{ev.completionPct.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                              {Object.entries(OPERATIVA_STATUS).map(([k, st]) => {
                                const cnt = ev.distribution[k] || 0;
                                if (cnt === 0) return null;
                                return (
                                  <span key={k} style={{
                                    padding: '2px 8px', borderRadius: '4px',
                                    background: `${st.color}14`, color: st.color,
                                    fontSize: '10px', fontWeight: 700,
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: st.dot }} />
                                    {st.label} {cnt}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )
        )}
      </div>

      {/* Modal de búsqueda de eventos */}
      {showEventSearch && (
        <EventSearchModal
          events={searchableEvents}
          availableCompanies={availableCompanies}
          results={eventSearchResults}
          filters={{ searchFromDate, searchToDate, searchCompany, searchText }}
          setters={{ setSearchFromDate, setSearchToDate, setSearchCompany, setSearchText }}
          onClear={clearSearchFilters}
          onSelect={handleSelectEvent}
          onClose={closeEventSearch}
        />
      )}
    </div>
  );
}

// ─── SingleEventDetail: vista de detalle de un evento con items y comentarios ───
function SingleEventDetail({ eventData, onBack }) {
  if (!eventData) {
    return (
      <div className="reports-hero-panel" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
        <p>No se encontró el evento.</p>
        <button type="button" onClick={onBack} style={{ marginTop: '12px', padding: '8px 16px', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>Volver</button>
      </div>
    );
  }
  const ev = eventData;
  const color = getRatingColor(ev.avg);
  return (
    <>
      <section className="reports-hero-panel" style={{ gap: '12px' }}>
        <div className="reports-section-intro" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="reports-eyebrow">Detalle del evento</span>
            <h3 className="reports-section-title">{ev.eventName}</h3>
            <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
              {ev.date}{ev.salon ? ` · ${ev.salon}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onBack} style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#ffffff', color: '#475569', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              ← Volver al listado
            </button>
            <button
              type="button"
              onClick={() => downloadEventDetailPdf(ev, false)}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #6366f1', background: '#6366f1', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3v9" />
                <path d="M5 8l4 4 4-4" />
                <path d="M3 14h12" />
              </svg>
              Descargar PDF
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          <div className="bento-tile" style={{ borderTopColor: color }}>
            <span className="reports-eyebrow">Calificación</span>
            <strong style={{ fontSize: '2.4rem', fontWeight: 900, color: '#0f172a' }}>{ev.avg.toFixed(1)}</strong>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>/ 10.0 — {getRatingLabel(ev.avg)}</span>
          </div>
          <div className="bento-tile" style={{ borderTopColor: '#6366f1' }}>
            <span className="reports-eyebrow">Puntos calificados</span>
            <strong style={{ fontSize: '2.4rem', fontWeight: 900, color: '#0f172a' }}>{ev.total}</strong>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
              {ev.notApplicableCount > 0 ? `${ev.notApplicableCount} N/A · ` : ''}{ev.unratedCount > 0 ? `${ev.unratedCount} sin calificar` : 'todos calificados'}
            </span>
          </div>
          <div className="bento-tile" style={{ borderTopColor: '#16a34a', display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px' }}>
            <DonutChart
              dist={ev.distribution}
              total={ev.total}
              levelsOrder={['excelente', 'bueno', 'regular', 'malo']}
              centerLabel="Items"
              centerSubLabel="calificados"
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {RATING_LEVELS.map(r => {
                const cnt = ev.distribution[r.value] || 0;
                if (cnt === 0) return null;
                return (
                  <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: r.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: r.color, flex: 1 }}>{r.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Calificación por sección (de este evento) */}
      {(() => {
        const bySection = {};
        (ev.items || []).forEach(it => {
          const sec = (it.sectionName || 'Sin sección').trim();
          if (!bySection[sec]) bySection[sec] = { sum: 0, count: 0 };
          bySection[sec].sum += (it.score || 0);
          bySection[sec].count += 1;
        });
        const rows = Object.entries(bySection)
          .map(([section, d]) => ({ section, avg: d.sum / d.count, count: d.count }))
          .sort((a, b) => b.avg - a.avg);
        if (rows.length === 0) return null;
        return (
          <section className="reports-hero-panel" style={{ gap: '12px' }}>
            <div className="reports-section-intro">
              <div>
                <span className="reports-eyebrow">Por sección del checklist</span>
                <h3 className="reports-section-title">Calificación por sección de este evento</h3>
              </div>
            </div>
            <div className="bento-tile" style={{ padding: '20px' }}>
              <BarChart
                data={rows}
                valueKey="avg"
                valueLabel="Calificación"
                valueMax={10}
                colorOf={(it) => getRatingColor(it.avg)}
                valueFormatter={(it) => `${it.avg.toFixed(1)} / 10  (${it.count})`}
              />
            </div>
          </section>
        );
      })()}

      <section className="reports-hero-panel" style={{ gap: '12px' }}>
        <div className="reports-section-intro">
          <div>
            <span className="reports-eyebrow">Detalle por punto</span>
            <h3 className="reports-section-title">{ev.items.length} punto(s) calificados</h3>
          </div>
        </div>
        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Sección</th>
                <th>Punto evaluado</th>
                <th style={{ textAlign: 'center', width: '120px' }}>Calificación</th>
                <th style={{ textAlign: 'right', width: '80px' }}>Puntaje</th>
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
              {ev.items.map((it, idx) => {
                const rl = RATING_LEVELS.find(r => r.value === it.rating);
                return (
                  <tr key={idx}>
                    <td style={{ color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ color: '#6366f1', fontSize: '11px', fontWeight: 600 }}>{it.sectionName || '—'}</td>
                    <td><span style={{ color: '#0f172a', fontWeight: 500 }}>{it.text || '(sin texto)'}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '3px 10px', borderRadius: '999px',
                        background: `${rl?.color}14`, color: rl?.color,
                        fontSize: '12px', fontWeight: 700,
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: rl?.dot }} />
                        {rl?.label || it.rating}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ color: '#0f172a', fontWeight: 800 }}>{it.score.toFixed(1)}</strong>
                    </td>
                    <td style={{ fontSize: '12px', color: '#475569', maxWidth: '360px' }}>
                      {it.comment ? <span style={{ fontStyle: 'italic' }}>“{it.comment}”</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ─── OperativaEventDetail: detalle de un evento con sus items de Operativa ───
function OperativaEventDetail({ eventData, onBack }) {
  if (!eventData) {
    return (
      <div className="reports-hero-panel" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
        <p>No se encontró el evento.</p>
        <button type="button" onClick={onBack} style={{ marginTop: '12px', padding: '8px 16px', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>Volver</button>
      </div>
    );
  }
  const ev = eventData;
  return (
    <>
      <section className="reports-hero-panel" style={{ gap: '12px' }}>
        <div className="reports-section-intro" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="reports-eyebrow">Detalle del evento</span>
            <h3 className="reports-section-title">{ev.eventName}</h3>
            <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
              {ev.date}{ev.salon ? ` · ${ev.salon}` : ''}
            </p>
          </div>
          <button type="button" onClick={onBack} style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#ffffff', color: '#475569', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
            ← Volver al listado
          </button>
          <button
            type="button"
            onClick={() => downloadEventDetailPdf(ev, true)}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #6366f1', background: '#6366f1', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3v9" />
              <path d="M5 8l4 4 4-4" />
              <path d="M3 14h12" />
            </svg>
            Descargar PDF
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          <div className="bento-tile" style={{ borderTopColor: '#16a34a' }}>
            <span className="reports-eyebrow">Avance</span>
            <strong style={{ fontSize: '2.4rem', fontWeight: 900, color: '#16a34a' }}>{ev.completionPct.toFixed(0)}%</strong>
            <div style={{ height: '6px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden', marginTop: '6px' }}>
              <div style={{ height: '100%', background: '#16a34a', width: `${ev.completionPct}%` }} />
            </div>
          </div>
          <div className="bento-tile" style={{ borderTopColor: '#6366f1' }}>
            <span className="reports-eyebrow">Items totales</span>
            <strong style={{ fontSize: '2.4rem', fontWeight: 900, color: '#0f172a' }}>{ev.total}</strong>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>{ev.completed} completados (Cumplido + N/A)</span>
          </div>
          <div className="bento-tile" style={{ borderTopColor: '#16a34a', display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px' }}>
            <DonutChart
              dist={ev.distribution}
              total={ev.total}
              levels={Object.entries(OPERATIVA_STATUS).map(([k, st]) => ({ value: k, color: st.color }))}
              levelsOrder={['cumplido', 'en_proceso', 'pendiente', 'no_aplica']}
              centerLabel="Items"
              centerSubLabel="del evento"
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {Object.entries(OPERATIVA_STATUS).map(([k, st]) => {
                const cnt = ev.distribution[k] || 0;
                if (cnt === 0) return null;
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: st.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: st.color, flex: 1 }}>{st.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Avance por sección (de este evento) */}
      {(() => {
        const bySection = {};
        (ev.items || []).forEach(it => {
          const sec = (it.sectionName || 'Sin sección').trim();
          if (!bySection[sec]) bySection[sec] = { total: 0, done: 0 };
          bySection[sec].total += 1;
          if (it.status === 'cumplido' || it.status === 'no_aplica') bySection[sec].done += 1;
        });
        const rows = Object.entries(bySection)
          .map(([section, d]) => ({
            section, total: d.total, done: d.done,
            completionPct: d.total > 0 ? (d.done / d.total) * 100 : 0,
          }))
          .sort((a, b) => b.completionPct - a.completionPct);
        if (rows.length === 0) return null;
        return (
          <section className="reports-hero-panel" style={{ gap: '12px' }}>
            <div className="reports-section-intro">
              <div>
                <span className="reports-eyebrow">Por sección del checklist</span>
                <h3 className="reports-section-title">Avance por sección de este evento</h3>
              </div>
            </div>
            <div className="bento-tile" style={{ padding: '20px' }}>
              <BarChart
                data={rows}
                valueKey="completionPct"
                valueLabel="Avance"
                valueMax={100}
                colorOf={(it) => it.completionPct >= 80 ? '#16a34a' : it.completionPct >= 50 ? '#d97706' : '#dc2626'}
                valueFormatter={(it) => `${it.completionPct.toFixed(0)}%  (${it.done}/${it.total})`}
              />
            </div>
          </section>
        );
      })()}

      <section className="reports-hero-panel" style={{ gap: '12px' }}>
        <div className="reports-section-intro">
          <div>
            <span className="reports-eyebrow">Detalle por punto</span>
            <h3 className="reports-section-title">{ev.items.length} item(s) del check list</h3>
          </div>
        </div>
        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Sección</th>
                <th>Punto / Actividad</th>
                <th style={{ textAlign: 'center', width: '140px' }}>Status</th>
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
              {ev.items.map((it, idx) => {
                const st = OPERATIVA_STATUS[it.status] || OPERATIVA_STATUS.pendiente;
                return (
                  <tr key={idx}>
                    <td style={{ color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ color: '#6366f1', fontSize: '11px', fontWeight: 600 }}>{it.sectionName || '—'}</td>
                    <td><span style={{ color: '#0f172a', fontWeight: 500 }}>{it.text || '(sin texto)'}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '3px 10px', borderRadius: '999px',
                        background: `${st.color}14`, color: st.color,
                        fontSize: '12px', fontWeight: 700,
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: st.dot }} />
                        {st.label}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#475569', maxWidth: '360px' }}>
                      {it.comment ? <span style={{ fontStyle: 'italic' }}>“{it.comment}”</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ─── EventSearchModal ───
function EventSearchModal({ events, availableCompanies, results, filters, setters, onClear, onSelect, onClose }) {
  const { searchFromDate, searchToDate, searchCompany, searchText } = filters;
  const { setSearchFromDate, setSearchToDate, setSearchCompany, setSearchText } = setters;
  const textInputRef = useRef(null);

  useEffect(() => {
    if (textInputRef.current) textInputRef.current.focus();
  }, []);

  const statusColor = (s) => {
    const v = String(s || '').toLowerCase();
    if (v.includes('confirm')) return '#16a34a';
    if (v.includes('seguimiento')) return '#3b82f6';
    if (v.includes('pre')) return '#d97706';
    if (v.includes('cancel')) return '#dc2626';
    return '#94a3b8';
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000001,
        background: 'rgba(15,23,42,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        style={{
          background: '#ffffff', borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 16px 40px rgba(15,23,42,0.25)',
          width: '100%', maxWidth: '920px', height: 'min(90vh, 720px)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Buscar evento</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Filtra por fecha, empresa o texto. La búsqueda también revisa el contenido de los items del checklist.</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1, padding: '4px 10px' }}>×</button>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '10px', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', background: '#ffffff', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="field" style={{ flex: '0 0 140px' }}>
            <span>Desde</span>
            <input type="date" value={searchFromDate} onChange={e => setSearchFromDate(e.target.value)} />
          </label>
          <label className="field" style={{ flex: '0 0 140px' }}>
            <span>Hasta</span>
            <input type="date" value={searchToDate} onChange={e => setSearchToDate(e.target.value)} />
          </label>
          <label className="field" style={{ flex: '0 0 180px' }}>
            <span>Empresa</span>
            <select value={searchCompany} onChange={e => setSearchCompany(e.target.value)}>
              <option value="">Todas las empresas</option>
              {availableCompanies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field" style={{ flex: '1 1 220px', minWidth: '200px' }}>
            <span>Búsqueda</span>
            <input
              ref={textInputRef}
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Nombre del evento, cliente, o texto del item..."
            />
          </label>
          <button
            type="button"
            onClick={onClear}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#ffffff', color: '#475569', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Limpiar
          </button>
        </div>

        {/* Resultados */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
          {results.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Sin resultados</div>
              <div style={{ fontSize: '0.78rem' }}>Probá ampliando el rango de fechas o quitando algún filtro.</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '10px 6px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Evento</th>
                  <th style={{ textAlign: 'left', padding: '10px 6px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Cliente</th>
                  <th style={{ textAlign: 'left', padding: '10px 6px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Fecha</th>
                  <th style={{ textAlign: 'center', padding: '10px 6px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '10px 6px', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Check</th>
                </tr>
              </thead>
              <tbody>
                {results.map(ev => (
                  <tr
                    key={ev.id}
                    onClick={() => onSelect(ev.id)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 6px', color: '#0f172a', fontWeight: 600 }}>{ev.eventName}</td>
                    <td style={{ padding: '10px 6px', color: '#475569' }}>{ev.client || '—'}</td>
                    <td style={{ padding: '10px 6px', color: '#475569' }}>{ev.date}</td>
                    <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
                        background: `${statusColor(ev.status)}14`, color: statusColor(ev.status),
                        fontSize: '10px', fontWeight: 700,
                      }}>
                        {ev.status || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                      {ev.hasEval ? <span style={{ fontSize: '10px', fontWeight: 700, color: '#7c3aed', marginRight: '4px' }}>EVAL</span> : null}
                      {ev.hasOperativa ? <span style={{ fontSize: '10px', fontWeight: 700, color: '#d97706' }}>OPER</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
            {results.length === 0 ? 'Sin resultados' : results.length + ' evento(s) encontrado(s)'}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#ffffff', color: '#475569', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bar Chart (SVG horizontal) ───
function BarChart({ data, valueKey, valueLabel, valueMax, colorOf, valueFormatter }) {
  // data: [{ section, value, ... }]
  // valueKey: propiedad a graficar
  // valueLabel: texto del eje (ej. "Calificación")
  // valueMax: valor máximo (ej. 10)
  // colorOf: (item) => color hex
  // valueFormatter: (item) => string para mostrar al final
  if (!data || data.length === 0) {
    return <div style={{ padding: '20px', color: '#94a3b8', fontWeight: 700, textAlign: 'center' }}>Sin datos.</div>;
  }
  const labelW = 140;       // ancho reservado para el label
  const valueW = 80;        // ancho reservado para el valor
  const barAreaW = 100;     // ancho del area de la barra (% del espacio)
  const rowH = 32;          // alto por fila
  const padT = 8;
  const padB = 8;
  const labelOffset = 12;   // baseline del texto
  const W = 600;
  const H = padT + padB + data.length * rowH;
  const barX = labelW;
  const barW = W - labelW - valueW;
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', minWidth: '420px' }}>
        {data.map((it, i) => {
          const v = it[valueKey];
          const pct = valueMax > 0 ? Math.max(0, Math.min(1, v / valueMax)) : 0;
          const color = colorOf ? colorOf(it) : '#6366f1';
          const y = padT + i * rowH;
          return (
            <g key={i}>
              <text x={labelW - 8} y={y + rowH / 2 + labelOffset / 2 - 4} textAnchor="end" fontSize="11" fontWeight="700" fill="#475569">
                {it.section.length > 18 ? it.section.substring(0, 18) + '…' : it.section}
              </text>
              <rect x={barX} y={y + 8} width={barW} height={rowH - 16} rx="6" fill="#f1f5f9" />
              <rect x={barX} y={y + 8} width={barW * pct} height={rowH - 16} rx="6" fill={color} />
              <text x={barX + barW + 8} y={y + rowH / 2 + 4} textAnchor="start" fontSize="12" fontWeight="800" fill={color}>
                {valueFormatter ? valueFormatter(it) : (typeof v === 'number' ? v.toFixed(1) : v)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Donut Chart (SVG) ───
function DonutChart({ dist, total, levels, levelsOrder, centerLabel, centerSubLabel }) {
  const size = 160;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const order = levelsOrder || (levels ? levels.map(l => l.value) : ['excelente', 'bueno', 'regular', 'malo']);
  const useLevels = levels || order.map(v => RATING_LEVELS.find(r => r.value === v));

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      </svg>
    );
  }

  let offset = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {useLevels.map(lv => {
          const cnt = dist[lv.value] || 0;
          if (cnt === 0) return null;
          const len = (cnt / total) * circumference;
          const seg = (
            <circle
              key={lv.value}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={lv.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${circumference - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return seg;
        })}
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{centerLabel || 'Total'}</span>
        <span style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{total}</span>
        <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{centerSubLabel || 'calificaciones'}</span>
      </div>
    </div>
  );
}

// ─── Line / Area Chart (SVG) ───
function TrendChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ padding: '20px', color: '#94a3b8', fontWeight: 700, textAlign: 'center' }}>Sin datos para graficar.</div>;
  }

  const W = 560;
  const H = 200;
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const yMax = 10;
  const yMin = 0;
  const points = data.map((d, i) => {
    const x = data.length === 1 ? padL + innerW / 2 : padL + (i / (data.length - 1)) * innerW;
    const y = padT + (1 - (d.avg - yMin) / (yMax - yMin)) * innerH;
    return { x, y, d };
  });

  // Smooth path with Catmull-Rom-ish line
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)} ${padT + innerH} L${points[0].x.toFixed(1)} ${padT + innerH} Z`;

  const lastAvg = data[data.length - 1]?.avg || 0;
  const lineColor = getRatingColor(lastAvg);

  // Y axis labels (0, 5, 10)
  const yLabels = [0, 5, 10];

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines + Y labels */}
        {yLabels.map(v => {
          const y = padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;
          return (
            <g key={v}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" strokeDasharray="3 4" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fontWeight="700" fill="#94a3b8">{v}</text>
            </g>
          );
        })}

        {/* Area */}
        <path d={areaPath} fill="url(#trendFill)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke={lineColor} strokeWidth="2.5" />
            <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f172a">{p.d.avg.toFixed(1)}</text>
          </g>
        ))}

        {/* X labels */}
        {points.map((p, i) => (
          <text key={`x${i}`} x={p.x} y={H - padB + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#64748b">
            {fmtMonth(p.d.month)}
          </text>
        ))}
      </svg>
    </div>
  );
}
