import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { loadState } from '../../services/stateService';
import ReportInfo from './components/ReportInfo';

// ─── Rating Levels Configuration ───
const RATING_LEVELS = [
  { value: 'excelente', label: 'Excelente', score: 10, color: '#10b981', dot: '#10b981', bg: '#ecfdf5', text: '#059669' },
  { value: 'bueno', label: 'Bueno', score: 7.5, color: '#06b6d4', dot: '#06b6d4', bg: '#ecfeff', text: '#0891b2' },
  { value: 'regular', label: 'Regular', score: 5, color: '#f59e0b', dot: '#f59e0b', bg: '#fffbeb', text: '#d97706' },
  { value: 'malo', label: 'Malo', score: 2.5, color: '#ef4444', dot: '#ef4444', bg: '#fef2f2', text: '#dc2626' },
  { value: 'muy_malo', label: 'Muy malo', score: 1, color: '#b91c1c', dot: '#b91c1c', bg: '#fef2f2', text: '#991b1b' },
  { value: 'no_aplica', label: 'N/A', score: 0, color: '#94a3b8', dot: '#94a3b8', bg: '#f8fafc', text: '#64748b' },
];

const OPERATIVA_STATUS = {
  cumplido: { label: 'Cumplido', color: '#10b981', dot: '#10b981', bg: '#ecfdf5', text: '#059669' },
  en_proceso: { label: 'En proceso', color: '#f59e0b', dot: '#f59e0b', bg: '#fffbeb', text: '#d97706' },
  pendiente: { label: 'Pendiente', color: '#94a3b8', dot: '#94a3b8', bg: '#f8fafc', text: '#64748b' },
  no_aplica: { label: 'N/A', color: '#64748b', dot: '#64748b', bg: '#f1f5f9', text: '#475569' },
};

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getRatingColor(avg) {
  if (avg >= 8.75) return '#10b981';
  if (avg >= 7.0) return '#06b6d4';
  if (avg >= 5.0) return '#f59e0b';
  return '#ef4444';
}

function getRatingLabel(avg) {
  if (avg >= 8.75) return 'Excelente';
  if (avg >= 7.0) return 'Bueno';
  if (avg >= 5.0) return 'Regular';
  return 'Malo';
}

function fmtMonth(yyyymm) {
  if (!yyyymm || !yyyymm.includes('-')) return yyyymm;
  const [y, m] = yyyymm.split('-');
  return `${MONTH_SHORT[parseInt(m, 10) - 1]} '${y.slice(2)}`;
}

function IconAlertTriangle({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ─── Helper: Generar PDF individual por evento ───
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
    doc.setFontSize(9);
    doc.setTextColor(37, 99, 235);
    doc.text('JARDINES DEL LAGO', margin, y);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('EMS Reservas · Auditoría & Calidad de Servicio', pageW - margin, y, { align: 'right' });
    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(isOperativa ? 'Auditoría de Check List Operativo' : 'Informe de Satisfacción del Cliente', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text(ev.eventName || 'Evento', margin, y);
    y += 5;
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const meta = [];
    if (ev.date) meta.push(`Fecha: ${ev.date}`);
    if (ev.salon) meta.push(`Salón: ${ev.salon}`);
    if (ev.status) meta.push(`Estado: ${ev.status}`);
    doc.text(meta.join('  ·  '), margin, y);
    y += 7;

    // Resumen
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentW, 22, 2, 2, 'FD');
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('RESUMEN DE AUDITORÍA', margin + 4, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const cols = contentW / 3;
    if (isOperativa) {
      doc.text(`Ítems Auditados: ${ev.total}`, margin + 4, y);
      doc.text(`Avance: ${(ev.completionPct || 0).toFixed(0)}%`, margin + 4 + cols, y);
      doc.text(`Cumplidos: ${ev.completed || 0}`, margin + 4 + cols * 2, y);
    } else {
      doc.text(`Calificación: ${(ev.avg || 0).toFixed(1)} / 10  (${getRatingLabel(ev.avg || 0)})`, margin + 4, y);
      doc.text(`Puntos Calificados: ${ev.total}`, margin + 4 + cols, y);
      const extra = `${ev.notApplicableCount || 0} N/A · ${ev.unratedCount || 0} sin calificar`;
      doc.text(extra, margin + 4 + cols * 2, y);
    }
    y += 6;
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Generado: ' + new Date().toLocaleString('es-GT'), margin + 4, y);
    y += 12;

    // Tabla de ítems
    const colWidths = [8, 38, 62, 28, contentW - 8 - 38 - 62 - 28];
    const headers = isOperativa
      ? ['#', 'Sección', 'Punto / Actividad', 'Estado', 'Comentario']
      : ['#', 'Sección', 'Punto Evaluado', 'Calificación', 'Comentario'];

    const drawHeader = () => {
      doc.setFillColor(37, 99, 235);
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

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let rowIdx = 0;
    const items = ev.items || [];
    for (const it of items) {
      const sectionText = (it.sectionName || '—').substring(0, 60);
      const mainText = (it.text || '(sin texto)').substring(0, 200);
      const commentText = (it.comment || '').substring(0, 300);
      const lineH = 4;
      const linesMain = doc.splitTextToSize(mainText, colWidths[2] - 4);
      const linesComment = doc.splitTextToSize(commentText || '—', colWidths[4] - 4);
      const linesSection = doc.splitTextToSize(sectionText, colWidths[1] - 4);
      const rowH = Math.max(
        lineH * linesMain.length + 4,
        lineH * Math.max(1, linesComment.length) + 4,
        lineH * linesSection.length + 4,
        10
      );

      if (y + rowH > pageH - margin) {
        doc.addPage();
        y = margin;
        drawHeader();
      }

      if (rowIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentW, rowH, 'F');
      }

      doc.setTextColor(148, 163, 184);
      doc.text(String(rowIdx + 1), margin + 2, y + 4.5);

      doc.setTextColor(37, 99, 235);
      doc.setFont('helvetica', 'bold');
      let sy = y + 4.5;
      linesSection.forEach(ln => { doc.text(ln, margin + colWidths[0] + 2, sy); sy += lineH; });
      doc.setFont('helvetica', 'normal');

      doc.setTextColor(15, 23, 42);
      let ty = y + 4.5;
      linesMain.forEach(ln => { doc.text(ln, margin + colWidths[0] + colWidths[1] + 2, ty); ty += lineH; });

      const chipX = margin + colWidths[0] + colWidths[1] + colWidths[2] + 2;
      if (isOperativa) {
        const st = OPERATIVA_STATUS[it.status] || OPERATIVA_STATUS.pendiente;
        doc.setTextColor(st.color);
        doc.setFont('helvetica', 'bold');
        doc.text(st.label, chipX, y + 4.5);
        doc.setFont('helvetica', 'normal');
      } else {
        const rl = RATING_LEVELS.find(r => r.value === it.rating);
        doc.setTextColor(rl?.color || '#475569');
        doc.setFont('helvetica', 'bold');
        doc.text(`${rl?.label || it.rating} (${(it.score || 0).toFixed(1)})`, chipX, y + 4.5);
        doc.setFont('helvetica', 'normal');
      }

      doc.setTextColor(71, 85, 105);
      let cy = y + 4.5;
      linesComment.forEach(ln => { doc.text(ln, margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, cy); cy += lineH; });

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + rowH, margin + contentW, y + rowH);
      y += rowH;
      rowIdx++;
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
      doc.text('EMS Reservas · Jardines del Lago · Reporte generado automáticamente', margin, pageH - 6);
    }

    const fileName = `${(ev.eventName || 'evento').replace(/[^\w\d-]+/g, '_')}_satisfaccion.pdf`;
    doc.save(fileName);
  } catch (err) {
    console.error('Error generando PDF:', err);
    alert('Error al generar el PDF del evento.');
  }
}

// ─── Componente Principal: ReportsSatisfaccion ───
export default function ReportsSatisfaccion({ onClose }) {
  const { events } = useOutletContext();

  // Estados de filtro y navegación
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [viewTab, setViewTab] = useState('satisfaccion'); // 'satisfaccion' | 'operativa'
  const [selectedTplId, setSelectedTplId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');

  // Modales
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedEventForComments, setSelectedEventForComments] = useState(null);

  // Alertas configuradas en localStorage
  const [alertConfig, setAlertConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_satisfaction_alerts');
      return saved ? JSON.parse(saved) : { minScore: 8.5, emailAlerts: true, criticalIncidents: true, notifyTo: 'calidad@jardinesdellago.com' };
    } catch {
      return { minScore: 8.5, emailAlerts: true, criticalIncidents: true, notifyTo: 'calidad@jardinesdellago.com' };
    }
  });

  // Datos del backend
  const [checklists, setChecklists] = useState({});
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const state = await loadState({ cacheBust: true });
        setChecklists((state.eventChecklists && typeof state.eventChecklists === 'object') ? state.eventChecklists : {});
        setTemplates(Array.isArray(state.checklistTemplates) ? state.checklistTemplates : []);
      } catch (err) {
        console.error('Error cargando estado:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Cálculo de Satisfacción (Tab: Satisfacción) ──
  const rawSatisfactionData = useMemo(() => {
    if (loading || !events) return [];

    const results = [];
    for (const [evtId, chk] of Object.entries(checklists)) {
      const ev = Array.isArray(events) ? events.find(e => String(e.id) === evtId) : null;
      if (!ev) continue;
      const date = ev.date || ev.eventDate || '';
      if (date < fromDate || date > toDate) continue;

      const evTplIds = (Array.isArray(chk?.evaluacion?.templateIds) ? chk.evaluacion.templateIds
        : (chk?.evaluacion?.templateId ? [chk.evaluacion.templateId] : [])
      ).map(id => String(id));

      if (selectedTplId && !evTplIds.includes(selectedTplId)) continue;

      const items = Array.isArray(chk?.evaluacion?.items)
        ? chk.evaluacion.items
        : (Array.isArray(chk?.items) ? chk.items.filter(i => i.sectionType === 'evaluacion') : []);

      const ratedItems = items.filter(i => i.rating !== null && i.rating !== undefined && i.rating !== 'no_aplica');
      const notApplicableCount = items.filter(i => i.rating === 'no_aplica').length;
      const unratedCount = items.filter(i => i.rating === null || i.rating === undefined).length;
      if (ratedItems.length === 0) continue;

      const totalScore = ratedItems.reduce((sum, i) => sum + (RATING_LEVELS.find(r => r.value === i.rating)?.score || 0), 0);
      const avg = totalScore / ratedItems.length;

      const dist = { muy_malo: 0, malo: 0, regular: 0, bueno: 0, excelente: 0 };
      ratedItems.forEach(i => { if (dist[i.rating] !== undefined) dist[i.rating]++; });

      const evTplNames = evTplIds.map(id => {
        const t = (templates || []).find(t => String(t.id) === id);
        return t ? t.name : `Plantilla #${id}`;
      });

      const commentsList = ratedItems
        .filter(i => (i.comment || i.comentario || '').trim().length > 0)
        .map(i => ({
          text: (i.comment || i.comentario).trim(),
          rating: i.rating,
          section: i.sectionName || 'General',
          itemText: i.text,
        }));

      results.push({
        eventId: evtId,
        eventName: ev.eventName || ev.client || ev.name || 'Evento',
        client: ev.client || ev.institucion || ev.companyName || '',
        date,
        salon: ev.salon || 'Salón Principal',
        status: ev.status || 'Confirmado',
        avg,
        total: ratedItems.length,
        notApplicableCount,
        unratedCount,
        distribution: dist,
        templateIds: evTplIds,
        templateNames: evTplNames,
        comments: commentsList,
        items: ratedItems.map(i => ({
          text: i.text,
          sectionName: i.sectionName || 'General',
          rating: i.rating,
          score: RATING_LEVELS.find(r => r.value === i.rating)?.score || 0,
          comment: (i.comment || i.comentario || '').trim(),
        })),
      });
    }

    return results.sort((a, b) => b.date.localeCompare(a.date));
  }, [checklists, events, templates, fromDate, toDate, loading, selectedTplId]);

  // Filtrado reactivo en vivo por texto de búsqueda
  const satisfactionData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rawSatisfactionData;
    return rawSatisfactionData.filter(ev => {
      const matchHeader = (ev.eventName || '').toLowerCase().includes(q)
        || (ev.client || '').toLowerCase().includes(q)
        || (ev.salon || '').toLowerCase().includes(q);
      if (matchHeader) return true;
      const matchItem = ev.items.some(it =>
        (it.text || '').toLowerCase().includes(q)
        || (it.sectionName || '').toLowerCase().includes(q)
        || (it.comment || '').toLowerCase().includes(q)
      );
      return matchItem;
    });
  }, [rawSatisfactionData, searchQuery]);

  // ── Cálculo de Operativa (Tab: Operativa) ──
  const rawOperativaData = useMemo(() => {
    if (loading || !events) return [];
    const results = [];
    for (const [evtId, chk] of Object.entries(checklists)) {
      const ev = Array.isArray(events) ? events.find(e => String(e.id) === evtId) : null;
      if (!ev) continue;
      const date = ev.date || ev.eventDate || '';
      if (date < fromDate || date > toDate) continue;

      const opTplIds = (Array.isArray(chk?.operativa?.templateIds) ? chk.operativa.templateIds
        : (chk?.operativa?.templateId ? [chk.operativa.templateId] : [])
      ).map(id => String(id));

      if (selectedTplId && !opTplIds.includes(selectedTplId)) continue;

      const items = Array.isArray(chk?.operativa?.items) ? chk.operativa.items : [];
      if (items.length === 0) continue;

      const dist = { pendiente: 0, en_proceso: 0, cumplido: 0, no_aplica: 0 };
      items.forEach(i => { if (dist[i.status] !== undefined) dist[i.status]++; });
      const completed = dist.cumplido + dist.no_aplica;
      const completionPct = items.length > 0 ? (completed / items.length) * 100 : 0;

      const opTplNames = opTplIds.map(id => {
        const t = (templates || []).find(t => String(t.id) === id);
        return t ? t.name : `Plantilla #${id}`;
      });

      const commentsList = items
        .filter(i => (i.comment || i.comentario || '').trim().length > 0)
        .map(i => ({
          text: (i.comment || i.comentario).trim(),
          status: i.status,
          section: i.sectionName || 'Operativa',
          itemText: i.text,
        }));

      results.push({
        eventId: evtId,
        eventName: ev.eventName || ev.client || ev.name || 'Evento',
        client: ev.client || ev.institucion || '',
        date,
        salon: ev.salon || 'Salón Principal',
        status: ev.status || 'Confirmado',
        total: items.length,
        completed,
        completionPct,
        distribution: dist,
        templateIds: opTplIds,
        templateNames: opTplNames,
        comments: commentsList,
        items: items.map(i => ({
          text: i.text,
          sectionName: i.sectionName || 'General',
          status: i.status || 'pendiente',
          comment: (i.comment || i.comentario || '').trim(),
        })),
      });
    }

    return results.sort((a, b) => b.date.localeCompare(a.date));
  }, [checklists, events, templates, fromDate, toDate, loading, selectedTplId]);

  const operativaData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rawOperativaData;
    return rawOperativaData.filter(ev => {
      const matchHeader = (ev.eventName || '').toLowerCase().includes(q)
        || (ev.client || '').toLowerCase().includes(q)
        || (ev.salon || '').toLowerCase().includes(q);
      if (matchHeader) return true;
      return ev.items.some(it =>
        (it.text || '').toLowerCase().includes(q)
        || (it.sectionName || '').toLowerCase().includes(q)
        || (it.comment || '').toLowerCase().includes(q)
      );
    });
  }, [rawOperativaData, searchQuery]);

  // ── Métricas Agregadas de Satisfacción ──
  const metrics = useMemo(() => {
    if (!satisfactionData || satisfactionData.length === 0) return null;

    const totalRatings = satisfactionData.reduce((sum, ev) => sum + ev.total, 0);
    const allScores = satisfactionData.flatMap(ev => ev.items.map(i => i.score));
    const globalAvg = totalRatings > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

    const totalDist = { muy_malo: 0, malo: 0, regular: 0, bueno: 0, excelente: 0 };
    let notApplicableTotal = 0;
    satisfactionData.forEach(ev => {
      Object.entries(ev.distribution).forEach(([k, v]) => { if (totalDist[k] !== undefined) totalDist[k] += v; });
      notApplicableTotal += (ev.notApplicableCount || 0);
    });

    const recentAvg = satisfactionData.slice(0, 10).reduce((sum, ev) => sum + ev.avg, 0) / Math.min(10, satisfactionData.length);
    const positiveCount = totalDist.excelente + totalDist.bueno;
    const positivePct = totalRatings > 0 ? (positiveCount / totalRatings) * 100 : 0;
    const incidentsCount = totalDist.malo + totalDist.muy_malo;
    const incidentsPct = totalRatings > 0 ? (incidentsCount / totalRatings) * 100 : 0;

    return {
      totalEvents: satisfactionData.length,
      totalRatings,
      globalAvg,
      recentAvg,
      totalDist,
      notApplicableTotal,
      positiveCount,
      positivePct,
      incidentsCount,
      incidentsPct,
      excellentPct: totalRatings > 0 ? (totalDist.excelente / totalRatings) * 100 : 0,
      goodPct: totalRatings > 0 ? (totalDist.bueno / totalRatings) * 100 : 0,
      regularPct: totalRatings > 0 ? (totalDist.regular / totalRatings) * 100 : 0,
      badPct: totalRatings > 0 ? (incidentsCount / totalRatings) * 100 : 0,
    };
  }, [satisfactionData]);

  // ── Tendencia Mensual (Line Chart) ──
  const monthlyTrend = useMemo(() => {
    if (!satisfactionData || satisfactionData.length === 0) return [];
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

  // ── Desglose por Sección de Checklist ──
  const satisfaccionBySection = useMemo(() => {
    if (!satisfactionData || satisfactionData.length === 0) return [];
    const bySection = {};
    satisfactionData.forEach(ev => {
      (ev.items || []).forEach(it => {
        const sec = (it.sectionName || 'General').trim();
        if (!bySection[sec]) bySection[sec] = { sum: 0, count: 0 };
        bySection[sec].sum += (it.score || 0);
        bySection[sec].count += 1;
      });
    });
    return Object.entries(bySection)
      .map(([section, d]) => ({
        section,
        avg: d.sum / d.count,
        count: d.count,
        approvalPct: Math.min(100, Math.round((d.sum / d.count) * 10)),
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [satisfactionData]);

  // ── Métricas Agregadas de Operativa ──
  const operativaMetrics = useMemo(() => {
    if (!operativaData || operativaData.length === 0) return null;
    const totalItems = operativaData.reduce((sum, ev) => sum + ev.total, 0);
    const totalDist = { pendiente: 0, en_proceso: 0, cumplido: 0, no_aplica: 0 };
    operativaData.forEach(ev => { Object.entries(ev.distribution).forEach(([k, v]) => { totalDist[k] += v; }); });
    const completed = totalDist.cumplido + totalDist.no_aplica;
    const completionPct = totalItems > 0 ? (completed / totalItems) * 100 : 0;
    return { totalItems, totalDist, completed, completionPct, eventsCount: operativaData.length };
  }, [operativaData]);

  const operativaBySection = useMemo(() => {
    if (!operativaData || operativaData.length === 0) return [];
    const bySection = {};
    operativaData.forEach(ev => {
      (ev.items || []).forEach(it => {
        const sec = (it.sectionName || 'General').trim();
        if (!bySection[sec]) bySection[sec] = { total: 0, done: 0 };
        bySection[sec].total += 1;
        if (it.status === 'cumplido' || it.status === 'no_aplica') bySection[sec].done += 1;
      });
    });
    return Object.entries(bySection)
      .map(([section, d]) => ({
        section,
        total: d.total,
        done: d.done,
        completionPct: d.total > 0 ? (d.done / d.total) * 100 : 0,
      }))
      .sort((a, b) => b.completionPct - a.completionPct);
  }, [operativaData]);

  // ── Exportar a Excel (.xlsx) ──
  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Hoja 1: Resumen
      const resumenRows = [
        { Métrica: 'Módulo', Valor: 'Reporte Ejecutivo de Auditoría y Satisfacción' },
        { Métrica: 'Período', Valor: `${fromDate} al ${toDate}` },
        { Métrica: 'Filtro Checklist', Valor: selectedTplId ? (templates.find(t => String(t.id) === selectedTplId)?.name || selectedTplId) : 'Todas' },
        { Métrica: 'Eventos Evaluados', Valor: viewTab === 'satisfaccion' ? (satisfactionData?.length || 0) : (operativaData?.length || 0) },
        { Métrica: 'Calificación Global', Valor: metrics ? `${metrics.globalAvg.toFixed(2)} / 10.0` : 'N/A' },
        { Métrica: 'Satisfacción Positiva (%)', Valor: metrics ? `${metrics.positivePct.toFixed(1)}%` : 'N/A' },
        { Métrica: 'Total Calificaciones', Valor: metrics ? metrics.totalRatings : 0 },
        { Métrica: 'Incidencias (Malo/Muy Malo)', Valor: metrics ? metrics.incidentsCount : 0 },
      ];
      const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Ejecutivo');

      // Hoja 2: Eventos
      if (viewTab === 'satisfaccion') {
        const rowsEventos = satisfactionData.map((ev, idx) => ({
          '#': idx + 1,
          Evento: ev.eventName,
          Fecha: ev.date,
          Salón: ev.salon,
          Estado: ev.status,
          Checklist: ev.templateNames.join(', ') || 'Check Satisfacción',
          Promedio: Number(ev.avg.toFixed(1)),
          Calificación: getRatingLabel(ev.avg),
          Excelente: ev.distribution.excelente,
          Bueno: ev.distribution.bueno,
          Regular: ev.distribution.regular,
          Malo: ev.distribution.malo,
          'Muy Malo': ev.distribution.muy_malo,
          'N/A': ev.notApplicableCount,
          Total: ev.total,
          Comentarios: ev.comments.map(c => `[${c.rating}] ${c.text}`).join(' | '),
        }));
        const wsEventos = XLSX.utils.json_to_sheet(rowsEventos);
        XLSX.utils.book_append_sheet(wb, wsEventos, 'Eventos Evaluados');

        // Hoja 3: Todos los comentarios
        const allComments = satisfactionData.flatMap(ev =>
          ev.comments.map(c => ({
            Evento: ev.eventName,
            Fecha: ev.date,
            Salón: ev.salon,
            Sección: c.section,
            Nivel: c.rating,
            Punto: c.itemText,
            Comentario: c.text,
          }))
        );
        if (allComments.length > 0) {
          const wsComments = XLSX.utils.json_to_sheet(allComments);
          XLSX.utils.book_append_sheet(wb, wsComments, 'Comentarios de Clientes');
        }
      } else {
        const rowsOperativa = operativaData.map((ev, idx) => ({
          '#': idx + 1,
          Evento: ev.eventName,
          Fecha: ev.date,
          Salón: ev.salon,
          Checklist: ev.templateNames.join(', ') || 'Operativa',
          'Avance (%)': Number(ev.completionPct.toFixed(0)),
          Cumplidos: ev.distribution.cumplido,
          'En Proceso': ev.distribution.en_proceso,
          Pendientes: ev.distribution.pendiente,
          'No Aplica': ev.distribution.no_aplica,
          'Total Ítems': ev.total,
        }));
        const wsOperativa = XLSX.utils.json_to_sheet(rowsOperativa);
        XLSX.utils.book_append_sheet(wb, wsOperativa, 'Eventos Operativos');
      }

      XLSX.writeFile(wb, `auditoria-satisfaccion-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Error exportando Excel:', err);
      alert('Error al exportar el archivo Excel.');
    }
  };

  // ── Exportar a PDF (Reporte Ejecutivo Consolidado) ──
  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentW = pageW - margin * 2;
      let y = margin;

      // Header Banner Azul
      doc.setFillColor(30, 58, 138); // Blue 900
      doc.rect(0, 0, pageW, 26, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text('JARDINES DEL LAGO', margin, 12);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Auditoría & Calidad de Servicio  ·  Reporte Ejecutivo Consolidado', margin, 18);
      doc.setFont('helvetica', 'bold');
      doc.text(`Período: ${fromDate} al ${toDate}`, pageW - margin, 15, { align: 'right' });
      y = 34;

      // KPIs Box
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, contentW, 24, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('CALIFICACIÓN GLOBAL', margin + 6, y + 6);
      doc.text('EVENTOS EVALUADOS', margin + 6 + contentW / 4, y + 6);
      doc.text('SATISFACCIÓN POSITIVA', margin + 6 + (contentW / 4) * 2, y + 6);
      doc.text('INCIDENCIAS', margin + 6 + (contentW / 4) * 3, y + 6);

      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(metrics ? `${metrics.globalAvg.toFixed(1)} / 10` : '—', margin + 6, y + 14);
      doc.text(metrics ? String(metrics.totalEvents) : '0', margin + 6 + contentW / 4, y + 14);
      doc.text(metrics ? `${metrics.positivePct.toFixed(1)}%` : '—', margin + 6 + (contentW / 4) * 2, y + 14);
      doc.text(metrics ? `${metrics.incidentsCount} (${metrics.incidentsPct.toFixed(1)}%)` : '0', margin + 6 + (contentW / 4) * 3, y + 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`Nivel: ${metrics ? getRatingLabel(metrics.globalAvg) : '—'}`, margin + 6, y + 19);
      doc.text('Auditorías completadas', margin + 6 + contentW / 4, y + 19);
      doc.text(`Excelente + Bueno (${metrics ? metrics.positiveCount : 0})`, margin + 6 + (contentW / 4) * 2, y + 19);
      doc.text('Casos en revisión', margin + 6 + (contentW / 4) * 3, y + 19);
      y += 30;

      // Tabla de Eventos
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('Detalle Operativo por Evento', margin, y);
      y += 5;

      const colWidths = [8, 55, 30, 24, 25, contentW - 8 - 55 - 30 - 24 - 25];
      const headers = ['#', 'Evento & Fecha', 'Salón', 'Score', 'Nivel', 'Comentarios Clave'];

      const drawHeader = () => {
        doc.setFillColor(37, 99, 235);
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

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      let rowIdx = 0;
      const list = viewTab === 'satisfaccion' ? satisfactionData : operativaData;

      for (const ev of list) {
        const commentsStr = ev.comments.map(c => c.text).slice(0, 2).join(' · ') || '—';
        const lineH = 4;
        const linesComment = doc.splitTextToSize(commentsStr, colWidths[5] - 4);
        const rowH = Math.max(10, lineH * linesComment.length + 4);

        if (y + rowH > pageH - margin) {
          doc.addPage();
          y = margin;
          drawHeader();
        }

        if (rowIdx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, contentW, rowH, 'F');
        }

        doc.setTextColor(148, 163, 184);
        doc.text(String(rowIdx + 1), margin + 2, y + 4.5);

        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text(ev.eventName.substring(0, 32), margin + colWidths[0] + 2, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(ev.date, margin + colWidths[0] + 2, y + 7.5);
        doc.setFontSize(8);

        doc.setTextColor(51, 65, 85);
        doc.text((ev.salon || '—').substring(0, 18), margin + colWidths[0] + colWidths[1] + 2, y + 4.5);

        doc.setFont('helvetica', 'bold');
        if (viewTab === 'satisfaccion') {
          doc.setTextColor(getRatingColor(ev.avg));
          doc.text(`${ev.avg.toFixed(1)} / 10`, margin + colWidths[0] + colWidths[1] + colWidths[2] + 2, y + 4.5);
          doc.text(getRatingLabel(ev.avg), margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, y + 4.5);
        } else {
          doc.setTextColor(37, 99, 235);
          doc.text(`${ev.completionPct.toFixed(0)}%`, margin + colWidths[0] + colWidths[1] + colWidths[2] + 2, y + 4.5);
          doc.text(`${ev.completed}/${ev.total}`, margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, y + 4.5);
        }
        doc.setFont('helvetica', 'normal');

        doc.setTextColor(71, 85, 105);
        let cy = y + 4.5;
        linesComment.forEach(ln => {
          doc.text(ln, margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, cy);
          cy += lineH;
        });

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y + rowH, margin + contentW, y + rowH);
        y += rowH;
        rowIdx++;
      }

      // Footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
        doc.text('EMS Reservas · Jardines del Lago · Sistema de Calidad y Auditoría Operacional', margin, pageH - 6);
      }

      doc.save(`auditoria-satisfaccion-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Error generando PDF ejecutivo:', err);
      alert('Error al generar el PDF del reporte.');
    }
  };

  const handleReset3Months = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    setFromDate(d.toISOString().split('T')[0]);
    setToDate(new Date().toISOString().split('T')[0]);
    setSelectedTplId('');
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div className="reports-page-container" style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{ width: '44px', height: '44px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 14px' }} />
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Cargando Auditoría & Calidad de Servicio...</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>Sincronizando checklists y percepciones de clientes</div>
        </div>
      </div>
    );
  }

  // Si se selecciona un evento para inspección en pantalla completa
  if (selectedEventId) {
    const ev = viewTab === 'satisfaccion'
      ? satisfactionData.find(e => e.eventId === selectedEventId)
      : operativaData.find(e => e.eventId === selectedEventId);
    return (
      <SingleEventInspectionView
        event={ev}
        isOperativa={viewTab === 'operativa'}
        onBack={() => setSelectedEventId('')}
      />
    );
  }

  return (
    <div className="reports-page-container" style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '60px' }}>
      {/* ── BARRA SUPERIOR INSTITUCIONAL ── */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Lado Izquierdo: Icono + Título + Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 2px 6px rgba(37,99,235,0.3)',
            flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Auditoría & Calidad de Servicio
              </span>
              <span style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#059669',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '9999px',
                lineHeight: 1.2,
              }}>
                Producción
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
              Métricas consolidadas de servicio en sitio y percepción de clientes
            </div>
          </div>
        </div>

        {/* Lado Derecho: Acciones Rápidas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportPDF}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Exportar PDF
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Descargar Excel
          </button>

          <button
            type="button"
            onClick={() => setShowAlertModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: '#0f172a',
              border: '1px solid #0f172a',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 4px rgba(15,23,42,0.15)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
            onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Configurar Alertas
          </button>

          <ReportInfo reportKey="satisfaccion" />

          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '7px 12px',
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: '8px',
              color: '#64748b',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            <svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 4 7 9l6 5" />
            </svg>
            Volver
          </button>
        </div>
      </header>

      {/* ── CUERPO PRINCIPAL DEL DASHBOARD ── */}
      <main style={{ maxWidth: '1260px', margin: '0 auto', padding: '24px 24px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

        {/* ── TÍTULO Y SELECTOR SEGMENTADO ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
              Reporte Ejecutivo de Auditoría y Satisfacción
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Supervisión integral de checklists operacionales y percepción directa del cliente
            </p>
          </div>

          {/* Selector de Pestañas Tipo Cápsula */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '9999px',
            padding: '3px',
            display: 'inline-flex',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <button
              type="button"
              onClick={() => { setViewTab('satisfaccion'); setSelectedEventId(''); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '9999px',
                border: viewTab === 'satisfaccion' ? '1.5px solid #2563eb' : '1.5px solid transparent',
                background: viewTab === 'satisfaccion' ? '#eff6ff' : 'transparent',
                color: viewTab === 'satisfaccion' ? '#1d4ed8' : '#64748b',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Satisfacción
              <span style={{
                background: viewTab === 'satisfaccion' ? '#dbeafe' : '#f1f5f9',
                color: viewTab === 'satisfaccion' ? '#1d4ed8' : '#64748b',
                padding: '1px 7px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 700,
              }}>
                {rawSatisfactionData.length} eventos
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setViewTab('operativa'); setSelectedEventId(''); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '9999px',
                border: viewTab === 'operativa' ? '1.5px solid #2563eb' : '1.5px solid transparent',
                background: viewTab === 'operativa' ? '#eff6ff' : 'transparent',
                color: viewTab === 'operativa' ? '#1d4ed8' : '#64748b',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Operativa
              <span style={{
                background: viewTab === 'operativa' ? '#dbeafe' : '#f1f5f9',
                color: viewTab === 'operativa' ? '#1d4ed8' : '#64748b',
                padding: '1px 7px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 700,
              }}>
                {rawOperativaData.length} eventos
              </span>
            </button>
          </div>
        </div>

        {/* ── TARJETA UNIFICADA: BÚSQUEDA RÁPIDA EN VIVO + FILTROS ── */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '18px 22px',
          boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {/* Fila 1: Búsqueda Rápida en Vivo */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                BÚSQUEDA RÁPIDA EN VIVO
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                Indexación reactiva activa
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre del evento, cliente, salón o cualquier ítem del checklist..."
                style={{
                  width: '100%',
                  height: '42px',
                  paddingLeft: '40px',
                  paddingRight: searchQuery ? '40px' : '14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={e => e.target.style.borderColor = '#2563eb'}
                onBlur={e => e.target.style.borderColor = '#cbd5e1'}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '4px',
                  }}
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Fila 2: Filtros de Período y Muestreo */}
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '8px' }}>
              FILTROS DE PERÍODO Y MUESTREO
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '0 0 150px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Desde</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  style={{
                    height: '38px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#0f172a',
                    outline: 'none',
                    background: '#ffffff',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '0 0 150px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Hasta</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  style={{
                    height: '38px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#0f172a',
                    outline: 'none',
                    background: '#ffffff',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 240px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Tipo de Checklist</span>
                <select
                  value={selectedTplId}
                  onChange={e => setSelectedTplId(e.target.value)}
                  style={{
                    height: '38px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#0f172a',
                    outline: 'none',
                    background: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Check Satisfacción del Cliente (Todas)</option>
                  {(templates || []).filter(t => t.active !== false).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                style={{
                  height: '38px',
                  padding: '0 18px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                Filtrar
              </button>

              <button
                type="button"
                onClick={handleReset3Months}
                style={{
                  height: '38px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#94a3b8'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
              >
                Últimos 3 meses
              </button>
            </div>
          </div>
        </div>

        {/* ── CONTENIDO SEGÚN LA PESTAÑA ACTIVA ── */}
        {viewTab === 'satisfaccion' ? (
          <>
            {/* ── RESUMEN GENERAL & KPIS CLAVE ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  RESUMEN GENERAL & KPIS CLAVE
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  Actualizado con {satisfactionData.length} registros confirmados
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                {/* KPI 1: Calificación Global */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '18px 20px',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: '3px solid #10b981',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        CALIFICACIÓN GLOBAL
                      </span>
                      <span style={{
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        color: '#059669',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} />
                        {metrics ? getRatingLabel(metrics.globalAvg) : '—'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '10px' }}>
                      <span style={{ fontSize: '36px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                        {metrics ? metrics.globalAvg.toFixed(1) : '0.0'}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>/ 10.0</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '12px', fontWeight: 600 }}>
                      <span>Rendimiento Período</span>
                      <span style={{ color: '#059669', fontWeight: 800 }}>
                        {metrics ? Math.round(metrics.globalAvg * 10) : 0}%
                      </span>
                    </div>
                    <div style={{ height: '5px', borderRadius: '9999px', background: '#f1f5f9', overflow: 'hidden', marginTop: '4px' }}>
                      <div style={{ height: '100%', background: '#10b981', width: `${metrics ? metrics.globalAvg * 10 : 0}%`, borderRadius: '9999px' }} />
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    Basado en <strong>{metrics ? metrics.totalRatings : 0}</strong> calificaciones de <strong>{metrics ? metrics.totalEvents : 0}</strong> eventos.
                  </div>
                </div>

                {/* KPI 2: Eventos Evaluados */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '18px 20px',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: '3px solid #3b82f6',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        EVENTOS EVALUADOS
                      </span>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '10px' }}>
                      <span style={{ fontSize: '36px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                        {metrics ? metrics.totalEvents : 0}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>en el período</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '12px', fontWeight: 600 }}>
                      <span>Cumplimiento Auditorías</span>
                      <span style={{ color: '#2563eb', fontWeight: 800 }}>100%</span>
                    </div>
                    <div style={{ height: '5px', borderRadius: '9999px', background: '#f1f5f9', overflow: 'hidden', marginTop: '4px' }}>
                      <div style={{ height: '100%', background: '#3b82f6', width: '100%', borderRadius: '9999px' }} />
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    100% de checklists recibidos y validados.
                  </div>
                </div>

                {/* KPI 3: Promedio Últimos 10 */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '18px 20px',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: '3px solid #8b5cf6',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        PROMEDIO ÚLTIMOS 10
                      </span>
                      {metrics && (
                        <span style={{
                          background: metrics.recentAvg >= metrics.globalAvg ? '#ecfdf5' : '#fef2f2',
                          border: `1px solid ${metrics.recentAvg >= metrics.globalAvg ? '#a7f3d0' : '#fecaca'}`,
                          color: metrics.recentAvg >= metrics.globalAvg ? '#059669' : '#dc2626',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                        }}>
                          {metrics.recentAvg >= metrics.globalAvg ? '↗ +' : '↘ '}
                          {Math.abs(metrics.recentAvg - metrics.globalAvg).toFixed(1)}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '10px' }}>
                      <span style={{ fontSize: '36px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                        {metrics ? metrics.recentAvg.toFixed(1) : '0.0'}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>/ 10.0</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '12px', fontWeight: 600 }}>
                      <span>Comparativo vs Global</span>
                      <span style={{ color: '#7c3aed', fontWeight: 800 }}>
                        vs {metrics ? metrics.globalAvg.toFixed(1) : '0.0'} ref
                      </span>
                    </div>
                    <div style={{ height: '5px', borderRadius: '9999px', background: '#f1f5f9', overflow: 'hidden', marginTop: '4px' }}>
                      <div style={{ height: '100%', background: '#8b5cf6', width: `${metrics ? metrics.recentAvg * 10 : 0}%`, borderRadius: '9999px' }} />
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    {metrics && metrics.recentAvg >= metrics.globalAvg
                      ? 'Tendencia favorable en los cierres de eventos.'
                      : 'Oportunidad de refuerzo en los últimos cierres.'}
                  </div>
                </div>

                {/* KPI 4: Satisfacción Positiva */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '18px 20px',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: '3px solid #06b6d4',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        SATISFACCIÓN POSITIVA
                      </span>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                      </svg>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '10px' }}>
                      <span style={{ fontSize: '36px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                        {metrics ? metrics.positivePct.toFixed(1) : '0.0'}%
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '12px', fontWeight: 600 }}>
                      <span>Excelente + Bueno</span>
                      <span style={{ color: '#0891b2', fontWeight: 800 }}>
                        {metrics ? metrics.positiveCount : 0} de {metrics ? metrics.totalRatings : 0}
                      </span>
                    </div>
                    {/* Barra multi-segmento */}
                    <div style={{ height: '5px', borderRadius: '9999px', background: '#f1f5f9', overflow: 'hidden', marginTop: '4px', display: 'flex' }}>
                      <div style={{ height: '100%', background: '#10b981', width: `${metrics ? metrics.excellentPct : 0}%` }} />
                      <div style={{ height: '100%', background: '#06b6d4', width: `${metrics ? metrics.goodPct : 0}%` }} />
                      <div style={{ height: '100%', background: '#f59e0b', width: `${metrics ? metrics.regularPct : 0}%` }} />
                      <div style={{ height: '100%', background: '#ef4444', width: `${metrics ? metrics.badPct : 0}%` }} />
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    Solo <strong>{metrics ? metrics.incidentsCount : 0} incidencias</strong> ({metrics ? metrics.incidentsPct.toFixed(1) : 0}%) bajo revisión.
                  </div>
                </div>
              </div>
            </div>

            {/* ── FILA DE GRÁFICOS: DONUT + TENDENCIA MENSUAL (50% / 50%) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
              {/* Gráfico 1: Desglose de Calificaciones */}
              <div style={{
                background: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                padding: '20px 24px',
                boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                      DISTRIBUCIÓN & PROPORCIÓN
                    </span>
                    <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
                      {metrics ? metrics.totalRatings : 0} total
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 16px 0' }}>
                    Desglose de Calificaciones
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '20px', flexWrap: 'wrap' }}>
                    {/* Donut Chart SVG */}
                    <ExecutiveDonutChart
                      dist={metrics ? metrics.totalDist : {}}
                      total={metrics ? metrics.totalRatings : 0}
                    />

                    {/* Leyenda con porcentajes */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 180px' }}>
                      {RATING_LEVELS.filter(r => r.value !== 'no_aplica').map(r => {
                        const cnt = metrics ? (metrics.totalDist[r.value] || 0) : 0;
                        const pct = metrics && metrics.totalRatings > 0 ? (cnt / metrics.totalRatings) * 100 : 0;
                        return (
                          <div key={r.value} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.dot }} />
                              <span style={{ fontWeight: 600, color: '#334155' }}>{r.label}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontWeight: 800, color: '#0f172a' }}>{cnt}</span>
                              <span style={{ fontSize: '11px', color: '#94a3b8', minWidth: '32px', textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#64748b', marginTop: '18px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <span>Proporción de excelencia: <strong>{metrics ? metrics.excellentPct.toFixed(1) : 0}%</strong></span>
                  <span>N/A: {metrics ? metrics.notApplicableTotal : 0}</span>
                </div>
              </div>

              {/* Gráfico 2: Tendencia Mensual del Promedio */}
              <div style={{
                background: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                padding: '20px 24px',
                boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                      HISTÓRICO DE SERVICIO
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#2563eb', fontWeight: 700 }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb' }} />
                      Promedio mensual
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 2px 0' }}>
                    Tendencia Mensual del Promedio
                  </h3>
                  <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 16px 0' }}>
                    Evolución longitudinal del score medio por mes de operación
                  </p>

                  <ExecutiveTrendChart data={monthlyTrend} globalAvg={metrics ? metrics.globalAvg : 0} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#64748b', marginTop: '18px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <span>Rango de estabilidad: <strong>Óptimo (≥ 9.0)</strong></span>
                  <span style={{ color: metrics && metrics.globalAvg >= 9.0 ? '#16a34a' : '#ea580c', fontWeight: 700 }}>
                    ↗ Desempeño sobre estándar
                  </span>
                </div>
              </div>
            </div>

            {/* ── POR SECCIÓN DEL CHECKLIST: PROGRESO Y METAS ── */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '22px 24px',
              boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
                <div>
                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                    POR SECCIÓN DEL CHECKLIST
                  </span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 0 0' }}>
                    Calificación promedio por sección
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Identificación de fortalezas operativas y áreas con potencial de optimización
                  </p>
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>
                  Meta Corporativa: <strong>9.0 / 10.0</strong>
                </span>
              </div>

              {satisfaccionBySection.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  Sin datos clasificados por sección en este período.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {satisfaccionBySection.map((sec, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 180px) 1fr minmax(110px, 140px)', alignItems: 'center', gap: '18px' }}>
                      {/* Nombre y subtítulo */}
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>{sec.section}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>Evaluación agregada</div>
                      </div>

                      {/* Barra de progreso */}
                      <div>
                        <div style={{ position: 'relative', height: '22px', borderRadius: '9999px', background: '#f1f5f9', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${sec.approvalPct}%`,
                            background: 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)',
                            borderRadius: '9999px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: '8px',
                            transition: 'width 0.5s ease',
                          }}>
                            {sec.approvalPct >= 20 && (
                              <span style={{ fontSize: '10px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.4px' }}>
                                {sec.approvalPct}% APROBACIÓN
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Escala */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginTop: '4px', padding: '0 4px' }}>
                          <span>0.0</span>
                          <span>5.0</span>
                          <span>7.5</span>
                          <span>10.0</span>
                        </div>
                      </div>

                      {/* Score y Total */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px' }}>
                          <span style={{ fontSize: '17px', fontWeight: 900, color: '#0f172a' }}>{sec.avg.toFixed(1)}</span>
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#94a3b8' }}>/ 10</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                          ({sec.count} calificaciones)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── DETALLE OPERATIVO: TABLA DE EVENTOS ── */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '22px 24px',
              boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                    DETALLE OPERATIVO
                  </span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 0 0' }}>
                    Puntos evaluados por evento
                  </h3>
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  Mostrando {satisfactionData.length} de {rawSatisfactionData.length} eventos registrados
                </span>
              </div>

              {satisfactionData.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13.5px' }}>
                  No se encontraron evaluaciones con los filtros actuales.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #e2e8f0', background: '#f8fafc' }}>
                        <th style={{ padding: '10px 8px', textAlign: 'left', width: '32px', color: '#64748b', fontWeight: 800 }}>#</th>
                        <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>EVENTO & FECHA</th>
                        <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>SALÓN</th>
                        <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>CHECK LIST</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center', color: '#64748b', fontWeight: 800 }}>PROMEDIO</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center', color: '#64748b', fontWeight: 800 }}>CALIFICACIÓN</th>
                        <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>DISTRIBUCIÓN</th>
                        <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>COMENTARIOS DE CLIENTES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {satisfactionData.map((ev, idx) => {
                        const scoreColor = getRatingColor(ev.avg);
                        const label = getRatingLabel(ev.avg);
                        const criticalComment = ev.comments.find(c => c.rating === 'malo' || c.rating === 'muy_malo');

                        return (
                          <tr
                            key={ev.eventId}
                            onClick={() => setSelectedEventId(ev.eventId)}
                            style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.12s ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {/* # */}
                            <td style={{ padding: '12px 8px', color: '#94a3b8', fontWeight: 700 }}>{idx + 1}</td>

                            {/* Evento & Fecha */}
                            <td style={{ padding: '12px 10px' }}>
                              <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                                {ev.eventName}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                {ev.date} · {ev.salon}
                              </div>
                            </td>

                            {/* Salón */}
                            <td style={{ padding: '12px 10px', color: '#334155', fontWeight: 600 }}>
                              {ev.salon}
                            </td>

                            {/* Checklist */}
                            <td style={{ padding: '12px 10px' }}>
                              <span style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1d4ed8',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: 800,
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase',
                                display: 'inline-block',
                              }}>
                                {ev.templateNames[0] || 'CHECK SATISFACCION DEL CLIENTE'}
                              </span>
                            </td>

                            {/* Promedio */}
                            <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                              <span style={{ fontSize: '13.5px', fontWeight: 900, color: scoreColor }}>
                                {ev.avg.toFixed(1)}
                              </span>
                              <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 600 }}> /10.0</span>
                            </td>

                            {/* Calificación (Pill) */}
                            <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                              <span style={{
                                background: label === 'Excelente' ? '#ecfdf5' : label === 'Bueno' ? '#eff6ff' : '#fef2f2',
                                border: `1px solid ${label === 'Excelente' ? '#a7f3d0' : label === 'Bueno' ? '#bfdbfe' : '#fecaca'}`,
                                color: label === 'Excelente' ? '#059669' : label === 'Bueno' ? '#2563eb' : '#dc2626',
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                display: 'inline-block',
                              }}>
                                {label}
                              </span>
                            </td>

                            {/* Distribución (Chips) */}
                            <td style={{ padding: '12px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                {ev.distribution.excelente > 0 && (
                                  <span style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981' }} />
                                    Excelente {ev.distribution.excelente}
                                  </span>
                                )}
                                {ev.distribution.bueno > 0 && (
                                  <span style={{ background: '#ecfeff', border: '1px solid #a5f3fc', color: '#0891b2', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#06b6d4' }} />
                                    Bueno {ev.distribution.bueno}
                                  </span>
                                )}
                                {ev.distribution.regular > 0 && (
                                  <span style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f59e0b' }} />
                                    Regular {ev.distribution.regular}
                                  </span>
                                )}
                                {ev.distribution.malo > 0 && (
                                  <span style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ef4444' }} />
                                    Malo {ev.distribution.malo}
                                  </span>
                                )}
                                {ev.distribution.muy_malo > 0 && (
                                  <span style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#b91c1c' }} />
                                    Muy malo {ev.distribution.muy_malo}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Comentarios de Clientes */}
                            <td style={{ padding: '12px 10px', maxWidth: '300px' }}>
                              {criticalComment ? (
                                <span style={{
                                  background: '#fff7ed',
                                  border: '1px solid #fed7aa',
                                  color: '#c2410c',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}>
                                  <IconAlertTriangle size={13} color="#c2410c" />
                                  <span>"{criticalComment.text.length > 40 ? criticalComment.text.substring(0, 40) + '…' : criticalComment.text}"</span>
                                </span>
                              ) : ev.comments.length > 0 ? (
                                <div>
                                  <div style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>
                                    "{ev.comments[0].text.length > 38 ? ev.comments[0].text.substring(0, 38) + '…' : ev.comments[0].text}"
                                  </div>
                                  {ev.comments.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEventForComments(ev);
                                        setShowCommentsModal(true);
                                      }}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#2563eb',
                                        fontSize: '10.5px',
                                        fontWeight: 700,
                                        padding: 0,
                                        cursor: 'pointer',
                                        marginTop: '2px',
                                        display: 'inline-block',
                                      }}
                                    >
                                      + {ev.comments.length - 1} comentario(s) más — click para ver
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#cbd5e1' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer de Tabla */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                <span>Total puntos evaluados: <strong>{metrics ? metrics.totalRatings : 0} ítems auditados</strong></span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#15803d', fontWeight: 700 }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                  Todos los eventos completados según SLA
                </span>
              </div>
            </div>

            {/* ── NARRACIÓN EJECUTIVA DE SATISFACCIÓN ── */}
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '14px',
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
              }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                    NARRACIÓN EJECUTIVA DE SATISFACCIÓN
                  </span>
                  <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px' }}>
                    Resumen Periódico
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: '#1e293b', margin: 0, lineHeight: 1.5 }}>
                  En el período analizado, se evaluaron <strong>{metrics ? metrics.totalEvents : 0} eventos</strong> con un total de <strong>{metrics ? metrics.totalRatings : 0} puntos calificados</strong>.
                  La satisfacción global promedio es de <strong style={{ color: '#059669' }}>{metrics ? metrics.globalAvg.toFixed(1) : '0.0'} / 10.0</strong>, lo que corresponde a un nivel de calificación <strong style={{ color: '#059669' }}>{metrics ? getRatingLabel(metrics.globalAvg) : '—'}</strong>.
                  El <strong>{metrics ? metrics.excellentPct.toFixed(0) : 0}%</strong> de las valoraciones fueron <strong style={{ color: '#059669' }}>Excelente</strong>, mientras que el <strong style={{ color: metrics && metrics.badPct > 0 ? '#dc2626' : '#64748b' }}>{metrics ? metrics.badPct.toFixed(0) : 0}%</strong> restante se ubicó en el rango <strong style={{ color: metrics && metrics.badPct > 0 ? '#dc2626' : '#64748b' }}>Malo / Muy Malo</strong>.
                </p>
              </div>
            </div>
          </>
        ) : (
          /* ── PESTAÑA OPERATIVA ── */
          <OperativaView
            operativaData={operativaData}
            operativaMetrics={operativaMetrics}
            operativaBySection={operativaBySection}
            onSelectEvent={id => setSelectedEventId(id)}
          />
        )}
      </main>

      {/* ── MODAL: CONFIGURAR ALERTAS ── */}
      {showAlertModal && (
        <AlertConfigModal
          config={alertConfig}
          onSave={newCfg => {
            setAlertConfig(newCfg);
            localStorage.setItem('crm_satisfaction_alerts', JSON.stringify(newCfg));
            setShowAlertModal(false);
          }}
          onClose={() => setShowAlertModal(false)}
        />
      )}

      {/* ── MODAL: COMENTARIOS DEL CLIENTE ── */}
      {showCommentsModal && selectedEventForComments && (
        <CustomerCommentsModal
          event={selectedEventForComments}
          onClose={() => {
            setShowCommentsModal(false);
            setSelectedEventForComments(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Pestaña Operativa con Estética Ejecutiva ───
function OperativaView({ operativaData, operativaMetrics, operativaBySection, onSelectEvent }) {
  if (!operativaMetrics || operativaMetrics.totalItems === 0) {
    return (
      <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>No hay check lists operativos en el período seleccionado.</div>
        <div style={{ fontSize: '12.5px' }}>Asigna plantillas operativas a eventos para supervisar el cumplimiento.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* KPIs Operativos */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '10px' }}>
          RESUMEN GENERAL & KPIS OPERATIVOS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px', borderTop: '3px solid #2563eb' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>ÍTEMS TOTALES AUDITADOS</span>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#0f172a', marginTop: '10px' }}>{operativaMetrics.totalItems}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>En {operativaMetrics.eventsCount} eventos registrados</div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px', borderTop: '3px solid #10b981' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>CUMPLIMIENTO GLOBAL</span>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#059669', marginTop: '10px' }}>{operativaMetrics.completionPct.toFixed(0)}%</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{operativaMetrics.completed} de {operativaMetrics.totalItems} completados</div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px', borderTop: '3px solid #f59e0b' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>EN PROCESO</span>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#d97706', marginTop: '10px' }}>{operativaMetrics.totalDist.en_proceso}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Actividades en seguimiento operativo</div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px', borderTop: '3px solid #ef4444' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>PENDIENTES</span>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#dc2626', marginTop: '10px' }}>{operativaMetrics.totalDist.pendiente}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Puntos pendientes antes de apertura</div>
          </div>
        </div>
      </div>

      {/* Gráficos Operativos: Donut y Barras por Sección */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 24px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>DISTRIBUCIÓN OPERACIONAL</span>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '4px 0 16px 0' }}>Estado de Ítems Auditados</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '20px', flexWrap: 'wrap' }}>
            <ExecutiveDonutChart
              dist={operativaMetrics.totalDist}
              total={operativaMetrics.totalItems}
              customLevels={[
                { value: 'cumplido', color: '#10b981' },
                { value: 'en_proceso', color: '#f59e0b' },
                { value: 'pendiente', color: '#94a3b8' },
                { value: 'no_aplica', color: '#64748b' },
              ]}
              centerSubLabel="ítems"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 180px' }}>
              {Object.entries(OPERATIVA_STATUS).map(([key, st]) => {
                const cnt = operativaMetrics.totalDist[key] || 0;
                const pct = operativaMetrics.totalItems > 0 ? (cnt / operativaMetrics.totalItems) * 100 : 0;
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: st.dot }} />
                      <span style={{ fontWeight: 600, color: '#334155' }}>{st.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 800, color: '#0f172a' }}>{cnt}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', minWidth: '32px', textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 24px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>CUMPLIMIENTO POR ÁREA</span>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '4px 0 16px 0' }}>Avance por Sección</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {operativaBySection.map((sec, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  <span>{sec.section}</span>
                  <span style={{ color: '#059669' }}>{sec.completionPct.toFixed(0)}% ({sec.done}/{sec.total})</span>
                </div>
                <div style={{ height: '6px', borderRadius: '9999px', background: '#f1f5f9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#10b981', width: `${sec.completionPct}%`, borderRadius: '9999px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla de Eventos Operativos */}
      <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '22px 24px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 16px 0' }}>
          Seguimiento de Checklists por Evento
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #e2e8f0', background: '#f8fafc' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left', width: '32px', color: '#64748b', fontWeight: 800 }}>#</th>
                <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>EVENTO & FECHA</th>
                <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>SALÓN</th>
                <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>CHECK LIST</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', color: '#64748b', fontWeight: 800 }}>AVANCE</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', color: '#64748b', fontWeight: 800 }}>DISTRIBUCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {operativaData.map((ev, idx) => (
                <tr
                  key={ev.eventId}
                  onClick={() => onSelectEvent(ev.eventId)}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 8px', color: '#94a3b8', fontWeight: 700 }}>{idx + 1}</td>
                  <td style={{ padding: '12px 10px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>{ev.eventName}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{ev.date} · {ev.salon}</div>
                  </td>
                  <td style={{ padding: '12px 10px', color: '#334155', fontWeight: 600 }}>{ev.salon}</td>
                  <td style={{ padding: '12px 10px' }}>
                    <span style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800 }}>
                      {ev.templateNames[0] || 'CHECK OPERATIVO'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                      <div style={{ width: '80px', height: '6px', borderRadius: '9999px', background: '#f1f5f9', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#10b981', width: `${ev.completionPct}%` }} />
                      </div>
                      <span style={{ fontWeight: 800, color: '#059669' }}>{ev.completionPct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <span style={{ background: '#ecfdf5', color: '#059669', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                        ✓ {ev.distribution.cumplido}
                      </span>
                      <span style={{ background: '#fffbeb', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                        ● {ev.distribution.en_proceso}
                      </span>
                      <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                        ● {ev.distribution.pendiente}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Executive Donut Chart SVG ───
function ExecutiveDonutChart({ dist, total, customLevels, centerSubLabel }) {
  const size = 150;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const levels = customLevels || [
    { value: 'excelente', color: '#10b981' },
    { value: 'bueno', color: '#06b6d4' },
    { value: 'regular', color: '#f59e0b' },
    { value: 'malo', color: '#ef4444' },
    { value: 'muy_malo', color: '#b91c1c' },
  ];

  if (!total || total === 0) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        </svg>
        <span style={{ position: 'absolute', fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>Sin datos</span>
      </div>
    );
  }

  let offset = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {levels.map(lv => {
          const cnt = dist[lv.value] || 0;
          if (cnt === 0) return null;
          const len = (cnt / total) * circumference;
          const circleSeg = (
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
              strokeLinecap="round"
            />
          );
          offset += len;
          return circleSeg;
        })}
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>TOTAL</span>
        <span style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{total}</span>
        <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{centerSubLabel || 'calificaciones'}</span>
      </div>
    </div>
  );
}

// ─── Executive Trend Chart SVG ───
function ExecutiveTrendChart({ data, globalAvg }) {
  const W = 460;
  const H = 160;
  const padL = 28;
  const padR = 24;
  const padT = 24;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // Si no hay suficientes meses, simulamos o mostramos el punto actual
  const pointsData = (data && data.length > 0) ? data : [{ month: new Date().toISOString().slice(0, 7), avg: globalAvg || 9.2 }];

  const yLabels = [0, 5, 10];
  const pts = pointsData.map((d, i) => {
    const x = pointsData.length === 1 ? padL + innerW / 2 : padL + (i / (pointsData.length - 1)) * innerW;
    const y = padT + (1 - Math.max(0, Math.min(10, d.avg)) / 10) * innerH;
    return { x, y, d };
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)} ${padT + innerH} L${pts[0].x.toFixed(1)} ${padT + innerH} Z`;

  const lastPt = pts[pts.length - 1];

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Ejes Y con líneas discontinuas */}
        {yLabels.map(val => {
          const y = padT + (1 - val / 10) * innerH;
          return (
            <g key={val}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeDasharray="3 4" />
              <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="10" fontWeight="700" fill="#94a3b8">{val}</text>
            </g>
          );
        })}

        {/* Área sombreada */}
        <path d={areaPath} fill="url(#trendGradient)" />

        {/* Línea Verde Curvada */}
        <path d={linePath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Nodos de puntos */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4.5" fill="#ffffff" stroke="#10b981" strokeWidth="2.5" />
            {/* Texto del mes en X */}
            <text x={p.x} y={H - 6} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#64748b">
              {fmtMonth(p.d.month)}
            </text>
          </g>
        ))}

        {/* Badge destacado sobre el último punto */}
        {lastPt && (
          <g transform={`translate(${lastPt.x - 18}, ${lastPt.y - 24})`}>
            <rect width="36" height="18" rx="4" fill="#0f172a" />
            <text x="18" y="12" textAnchor="middle" fontSize="10.5" fontWeight="900" fill="#ffffff">
              {lastPt.d.avg.toFixed(1)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ─── Vista de Inspección Individual del Evento ───
function SingleEventInspectionView({ event, isOperativa, onBack }) {
  if (!event) return null;

  return (
    <div className="reports-page-container" style={{ background: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Header de retorno */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← Volver al Reporte Ejecutivo
          </button>

          <button
            type="button"
            onClick={() => downloadEventDetailPdf(event, isOperativa)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#2563eb',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Descargar PDF del Evento
          </button>
        </div>

        {/* Tarjeta de Resumen del Evento */}
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                DETALLE DE AUDITORÍA
              </span>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{event.eventName}</h2>
              <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                {event.date} · {event.salon} · Estado: <strong>{event.status}</strong>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                {isOperativa ? 'AVANCE CUMPLIDO' : 'CALIFICACIÓN OBTENIDA'}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: isOperativa ? '#10b981' : getRatingColor(event.avg) }}>
                {isOperativa ? `${event.completionPct.toFixed(0)}%` : `${event.avg.toFixed(1)} / 10`}
              </div>
            </div>
          </div>
        </div>

        {/* Tabla Punto por Punto */}
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 14px 0' }}>
            Auditoría Punto por Punto ({event.items.length} ítems)
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #e2e8f0', background: '#f8fafc' }}>
                <th style={{ padding: '8px', textAlign: 'left', width: '32px', color: '#64748b' }}>#</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#64748b' }}>Sección</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#64748b' }}>Punto Evaluado</th>
                <th style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{isOperativa ? 'Estado' : 'Nivel'}</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#64748b' }}>Comentario</th>
              </tr>
            </thead>
            <tbody>
              {event.items.map((it, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 8px', color: '#94a3b8' }}>{idx + 1}</td>
                  <td style={{ padding: '10px 8px', color: '#2563eb', fontWeight: 700 }}>{it.sectionName}</td>
                  <td style={{ padding: '10px 8px', color: '#0f172a', fontWeight: 600 }}>{it.text}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: '#f1f5f9',
                      color: '#334155',
                    }}>
                      {isOperativa ? it.status : it.rating}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', color: '#64748b', fontStyle: it.comment ? 'italic' : 'normal' }}>
                    {it.comment || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Configurar Alertas ───
function AlertConfigModal({ config, onSave, onClose }) {
  const [minScore, setMinScore] = useState(config.minScore || 8.5);
  const [emailAlerts, setEmailAlerts] = useState(config.emailAlerts ?? true);
  const [criticalIncidents, setCriticalIncidents] = useState(config.criticalIncidents ?? true);
  const [notifyTo, setNotifyTo] = useState(config.notifyTo || 'calidad@jardinesdellago.com');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(15,23,42,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0',
        width: '100%', maxWidth: '480px', padding: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🔔</span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Configurar Alertas de Calidad</h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>

        <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 16px 0' }}>
          Define los umbrales de alerta para recibir notificaciones cuando la calificación o incidencias requieran atención inmediata.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Umbral mínimo de calificación aceptable
            </label>
            <input
              type="number"
              min="1"
              max="10"
              step="0.1"
              value={minScore}
              onChange={e => setMinScore(parseFloat(e.target.value) || 8.0)}
              style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px' }}
            />
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Eventos con score menor a este valor dispararán alerta.</span>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Correo(s) de notificación
            </label>
            <input
              type="text"
              value={notifyTo}
              onChange={e => setNotifyTo(e.target.value)}
              style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px' }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={criticalIncidents}
              onChange={e => setCriticalIncidents(e.target.checked)}
            />
            Notificar automáticamente al registrar calificación "Malo" o "Muy Malo"
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={e => setEmailAlerts(e.target.checked)}
            />
            Enviar resumen semanal a gerencia general
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave({ minScore, emailAlerts, criticalIncidents, notifyTo })}
            style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#ffffff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
          >
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Comentarios de Clientes del Evento ───
function CustomerCommentsModal({ event, onClose }) {
  if (!event) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(15,23,42,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0',
        width: '100%', maxWidth: '580px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>COMENTARIOS DEL CLIENTE</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{event.eventName}</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>

        <div style={{ padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {event.comments.length === 0 ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>Sin comentarios registrados en este evento.</div>
          ) : (
            event.comments.map((c, i) => (
              <div key={i} style={{ padding: '12px 14px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563eb' }}>{c.section}</span>
                  <span style={{
                    padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                    background: c.rating === 'malo' || c.rating === 'muy_malo' ? '#fef2f2' : '#ecfdf5',
                    color: c.rating === 'malo' || c.rating === 'muy_malo' ? '#dc2626' : '#059669',
                  }}>
                    {c.rating}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#0f172a', fontStyle: 'italic', lineHeight: 1.4 }}>
                  “{c.text}”
                </div>
                {c.itemText && (
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                    Referente a: {c.itemText}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
