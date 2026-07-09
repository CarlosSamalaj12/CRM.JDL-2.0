import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { fetchEvents, fetchEventById, fetchWeeklyServices } from '../services/api.js';
import EventCard from '../components/EventCard.jsx';
import { useDataSyncMulti } from '../../../hooks/useDataSync.js';

import { IconGrid, IconTag, IconBuilding, IconCheckCircle, IconClock, IconAlertCircle, IconX, IconPrinter, IconFileText, IconMapPin, IconUser, IconDownload, IconClipboardList } from '../components/Icons.jsx';
import LoadingSpinner from '../../../components/LoadingSpinner';
import SettingsChecklist from '../../settings/SettingsChecklist';
import WeeklyTasks from '../components/WeeklyTasks.jsx';

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const statusMap = {
  4: { label: 'Confirmado', color: 'green' },
  7: { label: 'Pre-reserva', color: 'fucsia' },
  8: { label: 'Mantenimiento', color: 'purple' },
};
const mobileStatusMap = {
  4: { label: 'C', color: 'green' },
  7: { label: 'PR', color: 'fucsia' },
  8: { label: 'MNT', color: 'purple' },
};

function formatDateShort(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { day:'numeric', month:'short' });
}
const fmtTime = (t) => (t || '').slice(0, 5) || '??:??';

// Obtener cantidades de comida por evento+fecha desde weeklyServices
const getServiceCounts = (services, idOcupacion, fecha) => {
  const dayServices = services.filter(s =>
    String(s.FechaServicio) === fecha && String(s.Idocupacion) === String(idOcupacion)
  );
  if (dayServices.length === 0) return null;
  const result = { desayunos: 0, refacciones_am: 0, almuerzos: 0, refacciones_pm: 0, cenas: 0 };
  for (const s of dayServices) {
    const tipo = s.TipoServicio;
    const cantidad = Number(s.cantidad) || 0;
    if (tipo in result) result[tipo] += cantidad;
  }
  return result;
};

export default function Kanban() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Función para obtener la fecha inicial (URL param > localStorage > hoy)
  const getInitialDate = () => {
    const dateParam = searchParams.get('date');
    if (dateParam) return dateParam;
    const saved = localStorage.getItem('kanban_selectedDate');
    return saved || new Date().toLocaleDateString('en-CA');
  };

  const [events, setEvents] = useState([]);
  const [eventsTotal, setEventsTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedDate, setSelectedDate] = useState(getInitialDate());
  const [filterExiting, setFilterExiting] = useState(false);
  const [eventoResaltado, setEventoResaltado] = useState(null);
  const [mobileDayIndex, setMobileDayIndex] = useState(() => ((new Date().getDay() + 6) % 7));
  const [isMobileView, setIsMobileView] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [weeklyServices, setWeeklyServices] = useState([]);
  const [taskCounts, setTaskCounts] = useState({});
  const [targetEventId, setTargetEventId] = useState(null);

  const toggleRow = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getMonday = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().slice(0, 10);
  };

  const handlePrevWeek = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    setSelectedDate(getMonday(d.toISOString().slice(0, 10)));
  };

  const handleNextWeek = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    setSelectedDate(getMonday(d.toISOString().slice(0, 10)));
  };

  const handlePrevDay = () => {
    setMobileDayIndex(prev => (prev > 0 ? prev - 1 : 6));
  };

  const handleNextDay = () => {
    setMobileDayIndex(prev => (prev < 6 ? prev + 1 : 0));
  };

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobileView(mq.matches);
    const handler = (e) => setIsMobileView(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Guardar fecha seleccionada en localStorage
  useEffect(() => {
    localStorage.setItem('kanban_selectedDate', selectedDate.slice(0, 10));
  }, [selectedDate]);

  // Efecto para resaltar evento desde notificación
  useEffect(() => {
    const highlightEventoId = searchParams.get('highlightEvento');
    if (!highlightEventoId) return;
    
    let scrollTimer;
    let clearTimer;

    const handleHighlight = async () => {
      // Buscar el evento en la lista actual
      const evento = events.find(e => String(e.Idocupacion) === String(highlightEventoId));
      
      let fechaEvento = null;
      if (evento) {
        fechaEvento = (evento.FechaEvento || evento.displayDate || '').slice(0, 10);
      } else {
        // Si el evento no está en la semana actual, obtener su fecha llamando a la API
        try {
          const eventData = await fetchEventById(highlightEventoId);
          if (eventData && (eventData.FechaEvento || eventData.fecha)) {
            fechaEvento = String(eventData.FechaEvento || eventData.fecha || '').slice(0, 10);
          }
        } catch {
          // No se pudo obtener el evento
        }
      }
      
      if (fechaEvento) {
        setEventoResaltado(highlightEventoId);
        setSelectedDate(fechaEvento);

        // Sincronizar automáticamente el carrusel de días móviles al día correspondiente
        try {
          const d = new Date(fechaEvento + 'T12:00:00');
          const day = d.getDay();
          const dayIdx = day === 0 ? 6 : day - 1;
          setMobileDayIndex(dayIdx);
        } catch (err) {
          console.warn('[Kanban] Error al calcular el index móvil del día:', err);
        }
        
        // Hacer scroll al evento después de un breve delay
        scrollTimer = setTimeout(() => {
          const elemento = document.getElementById(`evento-${highlightEventoId}`);
          if (elemento) {
            elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
      }
      
      // Quitar el resaltado después de 5 segundos y limpiar parámetros
      clearTimer = setTimeout(() => {
        setEventoResaltado(null);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('highlightEvento');
        newParams.delete('comentarioId');
        newParams.delete('notaId');
        setSearchParams(newParams);
      }, 5000);
    };
    
    handleHighlight();
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [searchParams, events]);

  const [viewMode, setViewMode] = useState(() => {
    const vm = searchParams.get('viewMode');
    if (vm && ['kanban', 'tabla', 'tareas'].includes(vm)) return vm;
    return 'kanban';
  });
  const currentUser = (() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      const r = String(u.role || '').trim().toLowerCase();
      let rol = r;
      if (r === 'admin') rol = 'Admin';
      else if (r === 'frontoffice' || r === 'front_office' || r === 'recepcionista') rol = 'FrontOffice';
      else if (r === 'vendedor' || r === 'sales') rol = 'Vendedor';
      else if (r === 'coordinador') rol = 'Coordinador';
      else if (r === 'eventos') rol = 'Eventos';
      return { ...u, rol };
    } catch { return null; }
  })();
  const filterStatus = searchParams.get('status');
  const filterTipo = searchParams.get('tipo');
  const filterSalon = searchParams.get('salon');
  const filterAlertas = searchParams.get('alertas');
  const hasFilter = filterStatus || filterTipo || filterSalon || filterAlertas;

  const loadEvents = useCallback(() => {
    setLoading(true);
    fetchEvents(selectedDate)
      .then((eventsData) => {
        const seenIds = new Set();
        const unicos = eventsData.filter(e => {
          if (seenIds.has(e.Idocupacion)) return false;
          seenIds.add(e.Idocupacion);
          return true;
        });
        const mapped = unicos.map(e => {
          const fecha = String(e.FechaEvento || '').slice(0, 10);
          const d = new Date(fecha + 'T12:00:00');
          return {
            ...e,
            displayDate: fecha,
            dayIndex: d.getDay(),
            dayLabel: `${dayNames[d.getDay()]} ${fecha}`,
          };
        });
        setEvents(mapped);
        setEventsTotal(mapped.length);

      })
      .catch((err) => setError(err.message || 'Error desconocido'))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Cargar servicios semanales con desglose por fecha
  useEffect(() => {
    fetchWeeklyServices(selectedDate)
      .then(data => setWeeklyServices(data))
      .catch(() => { /* fallback: usar datos de eventos */ });
  }, [selectedDate]);

  useDataSyncMulti(['evento_status', 'evento'], () => loadEvents());

  const selectedDateObj = new Date(selectedDate + 'T12:00:00');
  const fallbackDate = isNaN(selectedDateObj.getTime()) ? new Date() : selectedDateObj;
  const day = fallbackDate.getDay();
  const diff = fallbackDate.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(fallbackDate);
  monday.setDate(diff);

  const columns = dayNames.map((name, index) => {
    const currentDay = new Date(monday);
    currentDay.setDate(monday.getDate() + index);
    const formattedHeader = isMobileView
      ? currentDay.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
      : currentDay.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const yyyy = currentDay.getFullYear();
    const mm = String(currentDay.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDay.getDate()).padStart(2, '0');
    const isoDate = `${yyyy}-${mm}-${dd}`;
    const realDayIndex = currentDay.getDay();
    return { dayIndex: realDayIndex, name: formattedHeader, isoDate, items: events.filter((e) => e.dayIndex === realDayIndex) };
  });

  const filteredColumns = columns.map((col) => ({
    ...col,
    items: col.items.filter((e) => {
      if (filterStatus && e.Estatuscotizacion !== Number(filterStatus)) return false;
      if (filterTipo && e.TipoEvento !== filterTipo) return false;
      if (filterSalon && e.Salon !== filterSalon) return false;
      if (filterAlertas && !(e.tiene_alertas == 1 || e.tiene_alertas === true)) return false;
      return true;
    }),
  }));

  const totalEvents = filteredColumns.reduce((sum, col) => sum + col.items.length, 0);



  const days = dayNames.map((_, index) => {
    const currentDay = new Date(monday);
    currentDay.setDate(monday.getDate() + index);
    const isoDate = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
    const label = currentDay.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const realDayIndex = currentDay.getDay();
    const dayEvents = events.filter((e) => e.dayIndex === realDayIndex);
    return { isoDate, label, events: dayEvents, shortDate: formatDateShort(isoDate) };
  }).filter((d) => d.events.length > 0);
  
  // En mobile vista tabla, filtrar por día seleccionado
  const filteredDays = (isMobileView && viewMode === 'tabla' && columns[mobileDayIndex])
    ? days.filter(d => d.events.some(e => e.dayIndex === columns[mobileDayIndex].dayIndex))
    : days;
  const clearFilters = () => {
    if (filterExiting) return;
    setFilterExiting(true);
    setTimeout(() => {
      setSearchParams({});
      setFilterExiting(false);
    }, 250);
  };

  const exportToExcel = () => {
    const rows = [];
    for (const day of days) {
      for (const e of day.events) {
        const svcX = weeklyServices.length > 0 ? getServiceCounts(weeklyServices, e.Idocupacion, day.isoDate) : null;
        rows.push({
          'Fecha': day.isoDate || e.displayDate || '',
          'Institución': e.Institucion || '',
          'Salón': e.Salon || '',
          'Horario': `${fmtTime(e.HoraI)} - ${fmtTime(e.HoraF)}`,
          'Pax': e.Pax || 0,
          'Des': svcX ? svcX.desayunos : (e.cant_desayunos || 0),
          'Ref. AM': svcX ? svcX.refacciones_am : (e.cant_refacciones_am || 0),
          'Alm.': svcX ? svcX.almuerzos : (e.cant_almuerzos || 0),
          'Ref. PM': svcX ? svcX.refacciones_pm : (e.cant_refacciones_pm || 0),
          'Cenas': svcX ? svcX.cenas : (e.cant_cenas || 0),
          'Tipo': e.TipoEvento || '',
          'Estado': statusMap[e.Estatuscotizacion]?.label || '',
          'Vendedor': e.Vendedor || '',
          'Alertas': (e.tiene_alertas == 1 || e.tiene_alertas === true) ? 'Sí' : 'No',
        });
      }
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Eventos');
    XLSX.writeFile(wb, `eventos-semana-${selectedDate}.xlsx`);
  };

  const buildPrintHtml = () => {
    const user = currentUser;
    const userName = user?.name || user?.nombre || user?.username || '—';

    const d = new Date(selectedDate + 'T12:00:00');
    const dayOfWeek = d.getDay();
    const diffToMon = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diffToMon);

    const fmtShort = (date) => date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

    const now = new Date();
    const printTimestamp = now.toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    let tableRows = '';
    let weeklyTotalsPrint = { pax: 0, desayunos: 0, ref_am: 0, almuerzos: 0, ref_pm: 0, cenas: 0 };
    const weekDays = dayNames.map((_, i) => {
      const currentDay = new Date(monday);
      currentDay.setDate(monday.getDate() + i);
      const isoDate = currentDay.toISOString().slice(0, 10);
      const label = currentDay.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
      const realDayIndex = currentDay.getDay();
      const dayEvents = events.filter((e) => e.dayIndex === realDayIndex);
      return { isoDate, label, events: dayEvents };
    });

    for (const day of weekDays) {
      const hasEvents = day.events.length > 0;
      tableRows += `<tr class="dia-header${hasEvents ? '' : ' sin-eventos'}"><td colspan="13" style="background:#f0f4ff;font-weight:700;padding:8px 12px;font-size:13px;border-bottom:1px solid #d1d9e6;">${day.label}</td></tr>`;
      if (!hasEvents) {
        tableRows += `<tr><td colspan="13" style="text-align:center;padding:8px;color:#94a3b8;font-style:italic;border:none;">Sin eventos</td></tr>`;
      } else {
        const dayTotals = { pax: 0, desayunos: 0, ref_am: 0, almuerzos: 0, ref_pm: 0, cenas: 0 };
        for (const ev of day.events) {
          const paxVal = Number(ev.Pax) || 0;
          dayTotals.pax += paxVal;
          const svcP = weeklyServices.length > 0 ? getServiceCounts(weeklyServices, ev.Idocupacion, day.isoDate) : null;
          const evDes = svcP ? svcP.desayunos : (Number(ev.cant_desayunos) || 0);
          const evRefAm = svcP ? svcP.refacciones_am : (Number(ev.cant_refacciones_am) || 0);
          const evAlm = svcP ? svcP.almuerzos : (Number(ev.cant_almuerzos) || 0);
          const evRefPm = svcP ? svcP.refacciones_pm : (Number(ev.cant_refacciones_pm) || 0);
          const evCen = svcP ? svcP.cenas : (Number(ev.cant_cenas) || 0);
          dayTotals.desayunos += evDes;
          dayTotals.ref_am += evRefAm;
          dayTotals.almuerzos += evAlm;
          dayTotals.ref_pm += evRefPm;
          dayTotals.cenas += evCen;
          const st = statusMap[ev.Estatuscotizacion] || { label: '—', color: 'gray' };
          const alerta = (ev.tiene_alertas == 1 || ev.tiene_alertas === true) ? '⚠' : '';
          tableRows += `<tr>
            <td style="padding:6px 10px;font-size:12px;white-space:nowrap;border-bottom:1px solid #e2e8f0;">${fmtShort(new Date(ev.displayDate + 'T12:00:00'))}</td>
            <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #e2e8f0;"><span class="tag tag-${st.color}">${st.label}</span></td>
            <td style="padding:6px 10px;font-size:12px;font-weight:600;border-bottom:1px solid #e2e8f0;">${ev.Institucion || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #e2e8f0;">${ev.Salon || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;white-space:nowrap;border-bottom:1px solid #e2e8f0;">${fmtTime(ev.HoraI)} - ${fmtTime(ev.HoraF)}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">${paxVal || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">${evDes || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">${evRefAm || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">${evAlm || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">${evRefPm || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">${evCen || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">${alerta}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">${ev.Vendedor || '—'}</td>
          </tr>`;
        }
        weeklyTotalsPrint.pax += dayTotals.pax;
        weeklyTotalsPrint.desayunos += dayTotals.desayunos;
        weeklyTotalsPrint.ref_am += dayTotals.ref_am;
        weeklyTotalsPrint.almuerzos += dayTotals.almuerzos;
        weeklyTotalsPrint.ref_pm += dayTotals.ref_pm;
        weeklyTotalsPrint.cenas += dayTotals.cenas;
        const shortDate = day.events[0]?.displayDate ? new Date(day.events[0].displayDate + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
        tableRows += `<tr style="background:#f1f5f9;">
          <td colspan="5" style="font-size:11px;font-weight:700;text-align:right;padding:4px 12px;border-bottom:1px solid #e2e8f0;color:#475569;">Total ${shortDate}</td>
          <td style="font-size:12px;font-weight:800;text-align:center;padding:4px 8px;border-bottom:1px solid #e2e8f0;color:#1e40af;">${dayTotals.pax}</td>
          <td style="font-size:11px;font-weight:700;text-align:center;padding:4px 8px;border-bottom:1px solid #e2e8f0;color:#475569;">${dayTotals.desayunos}</td>
          <td style="font-size:11px;font-weight:700;text-align:center;padding:4px 8px;border-bottom:1px solid #e2e8f0;color:#475569;">${dayTotals.ref_am}</td>
          <td style="font-size:11px;font-weight:700;text-align:center;padding:4px 8px;border-bottom:1px solid #e2e8f0;color:#475569;">${dayTotals.almuerzos}</td>
          <td style="font-size:11px;font-weight:700;text-align:center;padding:4px 8px;border-bottom:1px solid #e2e8f0;color:#475569;">${dayTotals.ref_pm}</td>
          <td style="font-size:11px;font-weight:700;text-align:center;padding:4px 8px;border-bottom:1px solid #e2e8f0;color:#475569;">${dayTotals.cenas}</td>
          <td colspan="2" style="border-bottom:1px solid #e2e8f0;"></td>
        </tr>`;
      }
    }
    if (weekDays.length > 0) {
      tableRows += `<tr style="background:#e0e7ff;">
        <td colspan="5" style="font-size:12px;font-weight:800;text-align:right;padding:6px 12px;border-top:2px solid #6366f1;color:#3730a3;">TOTAL SEMANA</td>
        <td style="font-size:13px;font-weight:900;text-align:center;padding:6px 8px;border-top:2px solid #6366f1;color:#1e40af;">${weeklyTotalsPrint.pax}</td>
        <td style="font-size:12px;font-weight:800;text-align:center;padding:6px 8px;border-top:2px solid #6366f1;color:#3730a3;">${weeklyTotalsPrint.desayunos}</td>
        <td style="font-size:12px;font-weight:800;text-align:center;padding:6px 8px;border-top:2px solid #6366f1;color:#3730a3;">${weeklyTotalsPrint.ref_am}</td>
        <td style="font-size:12px;font-weight:800;text-align:center;padding:6px 8px;border-top:2px solid #6366f1;color:#3730a3;">${weeklyTotalsPrint.almuerzos}</td>
        <td style="font-size:12px;font-weight:800;text-align:center;padding:6px 8px;border-top:2px solid #6366f1;color:#3730a3;">${weeklyTotalsPrint.ref_pm}</td>
        <td style="font-size:12px;font-weight:800;text-align:center;padding:6px 8px;border-top:2px solid #6366f1;color:#3730a3;">${weeklyTotalsPrint.cenas}</td>
        <td colspan="2" style="border-top:2px solid #6366f1;"></td>
      </tr>`;
    }

    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Ocupación Semanal</title>
<style>
  @page { margin: 15mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; }
  .print-header { display: flex; align-items: center; justify-content: center; margin-bottom: 4px; padding: 0; border: none; }
  .print-header img { height: 30px; width: auto; opacity: 0.6; }
  .print-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; color: #475569; }
  .print-meta strong { color: #0f172a; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
  th, td { word-break: break-word; overflow-wrap: break-word; }
  th { background: #1e40af; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  th:first-child { border-radius: 6px 0 0 0; }
  th:last-child { border-radius: 0 6px 0 0; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
  .tag-green { background: #dcfce7; color: #16a34a; }
  .tag-fucsia { background: #fdf2f8; color: #d946ef; }
  .tag-gray { background: #f1f5f9; color: #64748b; }
  .tag-purple { background: #f3e8ff; color: #a855f7; }
  tr.sin-eventos td { background: #fafafa; }
  .print-footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
</style></head>
<body>
  <div class="print-header">
    <img src="/Oficial_JDL_acua.png" alt="Logo" onerror="this.style.display='none'" />
  </div>
  <div class="print-meta">
    <span>Impreso por: <strong>${userName}</strong></span>
    <span>Fecha y hora: <strong>${printTimestamp}</strong></span>
  </div>
  <table>
    <thead><tr>
      <th>Día</th><th>Estado</th><th>Institución</th><th>Salón</th><th>Horario</th><th>Pax</th><th title="Cantidad Desayunos">Des.</th><th title="Cantidad Refacciones AM">Ref.AM</th><th title="Cantidad Almuerzos">Alm.</th><th title="Cantidad Refacciones PM">Ref.PM</th><th title="Cantidad Cenas">Cenas</th><th>Alertas</th><th>Vendedor</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="print-footer">Documento generado por Jardines EMS — ${printTimestamp}</div>
</body></html>`;
  };

  const exportToPdf = async () => {
    setPdfLoading(true);
    const html = buildPrintHtml();

    // Crear un contenedor oculto para renderizar el HTML
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:1200px;background:#fff;z-index:-1;';
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      // Esperar a que se carguen las imágenes
      const imgs = container.querySelectorAll('img');
      await Promise.all(Array.from(imgs).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
      }));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: 1200,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Primera página
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      // Páginas adicionales si el contenido es más largo que una hoja
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const filename = `ocupacion-semana-${selectedDate}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      document.body.removeChild(container);
      setPdfLoading(false);
    }
  };

  const handlePrint = () => {
    const html = buildPrintHtml();

    // Agregar estilos @media print y controles de impresión
    const printHtml = html
      .replace('</style>', `
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>`)
      .replace('</body>', `
  <div class="no-print" style="text-align:center;margin-top:20px;">
    <button onclick="window.print()" style="padding:10px 28px;background:#1e40af;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;">Imprimir / PDF</button>
    <button onclick="window.close()" style="padding:10px 28px;background:#e2e8f0;color:#475569;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;margin-left:8px;">Cerrar</button>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };</script>
</body>`);

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
    }
  };

  let filterLabel = '';
  if (filterStatus === '4') filterLabel = 'Confirmados';
  else if (filterStatus === '7') filterLabel = 'Pre-reservas';
  else if (filterStatus === '8') filterLabel = 'Mantenimiento';
  else if (filterTipo) filterLabel = `Tipo: ${filterTipo}`;
  else if (filterSalon) filterLabel = `Salón: ${filterSalon}`;
  else if (filterAlertas) filterLabel = '⚠️ Alertas';

  return (
    <section className="kanban-shell">
      <div className="kanban-header">
        <div className="kanban-title">
          <h2>{viewMode === 'kanban' ? <><IconGrid size={20} /> Ocupación</> : viewMode === 'tabla' ? <><IconFileText size={20} /> Tabla Semanal</> : <><IconClipboardList size={20} /> Tareas Semanales</>}</h2>
          <p>{totalEvents} eventos en la semana{hasFilter ? ' (filtrados)' : ''}</p>
        </div>
        <div className="kanban-filter" style={{display:'flex',alignItems:'center',gap:'0.35rem',flexWrap:'wrap',minWidth:0,overflow:'hidden'}}>
          <div className="view-toggle">
            <button className={`view-toggle-btn${viewMode === 'kanban' ? ' active' : ''}`} onClick={() => setViewMode('kanban')}>
              <IconGrid size={13} /> Ocupación
            </button>
            <button className={`view-toggle-btn${viewMode === 'tabla' ? ' active' : ''}`} onClick={() => setViewMode('tabla')}>
              <IconFileText size={13} /> Tabla
            </button>
            <button className={`view-toggle-btn${viewMode === 'tareas' ? ' active' : ''}`} onClick={() => setViewMode('tareas')}>
              <IconClipboardList size={13} /> Tareas
            </button>
          </div>
          <button
            className={`btn-ghost btn-sm ${filterAlertas ? 'active' : ''}`}
            onClick={() => {
              const newParams = new URLSearchParams(searchParams);
              if (filterAlertas) {
                newParams.delete('alertas');
              } else {
                newParams.set('alertas', '1');
              }
              setSearchParams(newParams);
            }}
            data-tooltip={filterAlertas ? 'Quitar filtro de alertas' : 'Mostrar solo eventos con alertas'}
            style={filterAlertas ? {background:'rgba(245,158,11,0.15)',borderColor:'rgba(245,158,11,0.4)',color:'#d97706'} : {}}
          >
            ⚠️ Alertas
          </button>
          <button className="btn-ghost btn-sm" onClick={exportToExcel} data-tooltip="Exportar a Excel">
            <IconDownload size={14} /> Excel
          </button>
          {viewMode === 'tabla' && (
            <button className="btn-ghost btn-sm" onClick={exportToPdf} data-tooltip="Exportar PDF sin abrir ventana">
              <IconFileText size={14} /> PDF
            </button>
          )}
          {viewMode === 'tabla' && (
            <button className="btn-ghost btn-sm" onClick={handlePrint} data-tooltip="Imprimir / PDF">
              <IconPrinter size={14} /> Imprimir
            </button>
          )}
          <div className="week-filter-container">
            <button 
              type="button" 
              className="btn-ghost btn-sm" 
              onClick={handlePrevWeek} 
              data-tooltip="Semana anterior"
            >
              ‹
            </button>
            <div className="week-filter-input-wrap">
              <input 
                id="week-filter" 
                type="date" 
                value={selectedDate ? getMonday(selectedDate.slice(0, 10)) : ''} 
                onChange={(e) => setSelectedDate(getMonday(e.target.value))}
              />
            </div>
            <button 
              type="button" 
              className="btn-ghost btn-sm" 
              onClick={handleNextWeek} 
              data-tooltip="Semana siguiente"
            >
              ›
            </button>
          </div>
        </div>
        
        {/* Day selector — visible en mobile (colocado dentro de kanban-header para que sea sticky junto con él) */}
        {!loading && !error && isMobileView && (viewMode === 'kanban' || viewMode === 'tareas') && (
          <div className="kanban-day-selector" style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>
            <button onClick={handlePrevDay} className="kanban-day-arrow">‹</button>
            <div className="kanban-day-pills-wrap">
              {filteredColumns.map((col, i) => (
                <button
                  key={col.isoDate}
                  onClick={() => setMobileDayIndex(i)}
                  className={`kanban-day-pill ${mobileDayIndex === i ? 'active' : ''}`}
                >
                  <span className="pill-day">{col.name.slice(0, 3).replace('.','')}</span>
                  <span className="pill-date">{col.isoDate.slice(5)}</span>
                  <span className="pill-count">
                    {viewMode === 'tareas' ? (taskCounts[col.isoDate] || 0) : col.items.length}
                  </span>
                </button>
              ))}
            </div>
            <button onClick={handleNextDay} className="kanban-day-arrow">›</button>
          </div>
        )}
      </div>

      {(hasFilter || filterExiting) && (
        <div className={`kanban-filter-bar ${filterExiting ? 'filter-exit' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="kanban-filter-badge">
              {filterStatus === '4' && <><IconCheckCircle size={14} /> {filterLabel}</>}
              {filterStatus === '7' && <><IconClock size={14} /> {filterLabel}</>}
              {filterStatus === '8' && <><IconAlertCircle size={14} /> {filterLabel}</>}
              {filterTipo && <><IconTag size={14} /> {filterLabel}</>}
              {filterSalon && <><IconBuilding size={14} /> {filterLabel}</>}
              {filterAlertas && <><span style={{fontSize:'1rem'}}>⚠️</span> Alertas</>}
            </span>
            <span className="kanban-filter-count">
              {totalEvents} de {eventsTotal} eventos
            </span>
          </div>
          <button className="btn-ghost btn-sm" onClick={clearFilters} data-tooltip="Quitar filtros">
            <IconX size={14} /> Limpiar filtros
          </button>
        </div>
      )}

      {loading && <p className="status-message">Cargando eventos...</p>}
      {error && <p className="status-message status-error">{error}</p>}

      {!loading && !error && viewMode === 'kanban' && (
        <>
          <div className={`kanban-board ${isMobileView ? 'kanban-board--mobile' : ''}`}>
          {filteredColumns
            .filter((_, i) => !isMobileView || i === mobileDayIndex)
            .map((column, ci) => {
            return (
            <div key={column.name} id={`kcol-${ci}`} className="kanban-column">
              <div className="kanban-column-header">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',flexWrap:'wrap',gap:'4px'}}>
                  <span style={{textTransform:'capitalize'}}>{column.name}</span>
                  <span className="kanban-column-count">{column.items.length}</span>
                </div>
              </div>
              <div className="kanban-column-body">
                {column.items.length === 0 ? (
                  <p className="kanban-empty">Sin eventos este día</p>
                ) : (
                  column.items.map((event) => (
                      <EventCard 
                        key={`${event.Idocupacion}-${event.displayDate}`} 
                        event={event} 
                        highlighted={eventoResaltado === String(event.Idocupacion)}
                        onNavigateToTareas={(id) => {
                          setTargetEventId(id);
                          setViewMode('tareas');
                        }}
                        highlightNotaId={searchParams.get('notaId')}
                      />
                  ))
                )}
              </div>
            </div>
          );
        })}
        </div>
        </>
      )}

      {!loading && !error && viewMode === 'tareas' && (
        <WeeklyTasks
          selectedDate={selectedDate}
          events={events}
          onDateChange={setSelectedDate}
          mobileDayIndex={mobileDayIndex}
          setMobileDayIndex={setMobileDayIndex}
          setTaskCounts={setTaskCounts}
          targetEventId={targetEventId}
          onTargetEventProcessed={() => setTargetEventId(null)}
        />
      )}

      {!loading && !error && viewMode === 'tabla' && (
        <div className="tabla-eventos-wrapper">
          <table className="tabla-eventos"><thead><tr>
                <th className="col-dia">Día</th>
                <th className="col-estado">Estado</th>
                <th className="col-inst">Institución</th>
                <th className="col-salon">Salón</th>
                <th className="col-horario">Horario</th>
                <th className="col-pax">Pax</th>
                <th className="col-food" title="Cantidad Desayunos">Des.</th>
                <th className="col-food" title="Cantidad Refacciones AM">Ref. AM</th>
                <th className="col-food" title="Cantidad Almuerzos">Alm.</th>
                <th className="col-food" title="Cantidad Refacciones PM">Ref. PM</th>
                <th className="col-food" title="Cantidad Cenas">Cenas</th>
                <th className="col-alertas">Alertas</th>
                <th className="col-vendedor">Vendedor</th>
              </tr></thead><tbody>
              {filteredDays.length === 0 ? (
                <tr>
                <td colSpan={13} style={{textAlign:'center',padding:'2rem',color:'var(--text-muted)'}}>
                  {isMobileView && viewMode === 'tabla' ? 'Sin eventos este día' : 'No hay eventos esta semana'}
                </td>
                </tr>
              ) : (() => {
                let weeklyTotals = { pax: 0, desayunos: 0, ref_am: 0, almuerzos: 0, ref_pm: 0, cenas: 0 };
                return filteredDays.flatMap((day) => {
                  const rows = [];
                  rows.push(
                    <tr key={day.isoDate} className="tabla-dia-header">
                      <td colSpan={13}><div className="tabla-dia-inner">
                        <span className="tabla-dia-label">{day.label}</span>
                      </div></td>
                    </tr>
                  );
                  if (day.events.length === 0) {
                    rows.push(
                      <tr key={`${day.isoDate}-empty`}>
                        <td style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{isMobileView ? day.isoDate.slice(8) : day.shortDate}</td>
                        <td colSpan={12} style={{color:'var(--text-muted)',fontSize:'0.82rem',textAlign:'center'}}>
                          {isMobileView ? 'Sin eventos' : 'Sin eventos este día'}
                        </td>
                      </tr>
                    );
                  } else {
                    const dayTotals = { pax: 0, desayunos: 0, ref_am: 0, almuerzos: 0, ref_pm: 0, cenas: 0 };
                    day.events.forEach((ev, ei) => {
                      const paxVal = Number(ev.Pax) || 0;
                      dayTotals.pax += paxVal;
                      const svc = weeklyServices.length > 0 ? getServiceCounts(weeklyServices, ev.Idocupacion, day.isoDate) : null;
                      const evDes = svc ? svc.desayunos : (Number(ev.cant_desayunos) || 0);
                      const evRefAm = svc ? svc.refacciones_am : (Number(ev.cant_refacciones_am) || 0);
                      const evAlm = svc ? svc.almuerzos : (Number(ev.cant_almuerzos) || 0);
                      const evRefPm = svc ? svc.refacciones_pm : (Number(ev.cant_refacciones_pm) || 0);
                      const evCen = svc ? svc.cenas : (Number(ev.cant_cenas) || 0);
                      dayTotals.desayunos += evDes;
                      dayTotals.ref_am += evRefAm;
                      dayTotals.almuerzos += evAlm;
                      dayTotals.ref_pm += evRefPm;
                      dayTotals.cenas += evCen;
                      const st = statusMap[ev.Estatuscotizacion] || { label: 'Desconocido', color: 'gray' };
                      const rowId = `${day.isoDate}-${ev.Idocupacion}-${ei}`;
                      const isExpanded = expandedRows.has(rowId);
                      const hasAlerts = (ev.tiene_alertas == 1 || ev.tiene_alertas === true);
                      rows.push(
                        <tr
                          key={rowId}
                          className={`tabla-eventos-row${isExpanded ? ' row-expanded' : ''}`}
                          onClick={() => { if (isMobileView) toggleRow(rowId); }}
                        >
                          <td className="col-dia">{isMobileView ? day.isoDate.slice(8) : day.shortDate}</td>
                          <td className="col-estado"><span className={`event-tag event-tag-${st.color}`} style={{fontSize: isMobileView ? '0.55rem' : '0.65rem',padding:'0.1rem 0.2rem'}}>{isMobileView ? (mobileStatusMap[ev.Estatuscotizacion]?.label || st.label) : st.label}</span></td>
                          <td className="col-inst" style={{fontWeight:500,fontSize: isMobileView ? '0.6rem' : 'inherit'}}>{ev.Institucion || '—'}</td>
                          <td className="col-salon">{isMobileView ? '' : <IconMapPin size={13} />} {ev.Salon || '—'}</td>
                          <td className="col-horario">{isMobileView ? '' : <IconClock size={13} />} {fmtTime(ev.HoraI)} - {fmtTime(ev.HoraF)}</td>
                          <td className="col-pax">{paxVal || '—'}</td>
                          <td className="col-food" style={{fontSize:'0.72rem',fontWeight:600,textAlign:'center'}}>{evDes || '—'}</td>
                          <td className="col-food" style={{fontSize:'0.72rem',fontWeight:600,textAlign:'center'}}>{evRefAm || '—'}</td>
                          <td className="col-food" style={{fontSize:'0.72rem',fontWeight:600,textAlign:'center'}}>{evAlm || '—'}</td>
                          <td className="col-food" style={{fontSize:'0.72rem',fontWeight:600,textAlign:'center'}}>{evRefPm || '—'}</td>
                          <td className="col-food" style={{fontSize:'0.72rem',fontWeight:600,textAlign:'center'}}>{evCen || '—'}</td>
                          <td className="col-alertas">
                            {hasAlerts
                              ? <span className="event-tag event-tag-warning" style={{fontSize: isMobileView ? '0.55rem' : '0.65rem',padding:'0.1rem 0.2rem'}}>⚠️</span>
                              : <span className="mobile-only mob-no-alertas">—</span>
                            }
                          </td>
                          <td className="col-vendedor">{isMobileView ? '' : <IconUser size={13} />} {ev.Vendedor || '—'}</td>
                        </tr>
                      );
                      /* ─── Expandable detail row (mobile) ─── */
                      if (isExpanded) {
                        rows.push(
                          <tr key={`${rowId}-detail`} className="tabla-detail-row">
                            <td colSpan={13}>
                              <div className="tabla-detail-content">
                                <div className="detail-section">
                                  <span className="detail-label">Fecha</span>
                                  <div className="detail-info-row">
                                    <span>{new Date(day.isoDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</span>
                                    <span>{fmtTime(ev.HoraI)} - {fmtTime(ev.HoraF)}</span>
                                  </div>
                                </div>
                                <div className="detail-section">
                                  <span className="detail-label">Estado</span>
                                  <div className="detail-info-row">
                                    <span className={`event-tag event-tag-${st.color}`} style={{fontSize:'0.6rem',padding:'0.1rem 0.35rem'}}>{st.label}</span>
                                    <span>Salón: {ev.Salon || '—'}</span>
                                  </div>
                                </div>
                                <div className="detail-section">
                                  <span className="detail-label">Alimentos</span>
                                  <div className="detail-food-grid">
                                    <span className="detail-food-item"><span className="food-title">Des.</span> {evDes || 0}</span>
                                    <span className="detail-food-item"><span className="food-title">Ref.AM</span> {evRefAm || 0}</span>
                                    <span className="detail-food-item"><span className="food-title">Alm.</span> {evAlm || 0}</span>
                                    <span className="detail-food-item"><span className="food-title">Ref.PM</span> {evRefPm || 0}</span>
                                    <span className="detail-food-item"><span className="food-title">Cenas</span> {evCen || 0}</span>
                                  </div>
                                </div>
                                <div className="detail-section">
                                  <span className="detail-label">Información</span>
                                  <div className="detail-info-row">
                                    <span>Vendedor: {ev.Vendedor || '—'}</span>
                                    {hasAlerts && <span className="event-tag event-tag-warning" style={{fontSize:'0.55rem',padding:'0.08rem 0.25rem'}}>⚠️ Alertas</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    });
                    weeklyTotals.pax += dayTotals.pax;
                    weeklyTotals.desayunos += dayTotals.desayunos;
                    weeklyTotals.ref_am += dayTotals.ref_am;
                    weeklyTotals.almuerzos += dayTotals.almuerzos;
                    weeklyTotals.ref_pm += dayTotals.ref_pm;
                    weeklyTotals.cenas += dayTotals.cenas;
                    rows.push(
                      <tr key={`${day.isoDate}-total`} className="tabla-total-row" style={{background:'var(--surface-2, #f1f5f9)'}}>
                        {isMobileView ? (
                          <td colSpan={5} className="col-dia col-estado col-inst col-salon col-horario" style={{fontSize:'0.72rem',fontWeight:700,textAlign:'right',padding:'4px 12px',borderBottom:'1px solid #e2e8f0',color:'#475569'}}>
                            Total
                          </td>
                        ) : (
                          <>
                            <td className="col-dia" style={{borderBottom:'1px solid var(--border)'}}></td>
                            <td className="col-estado" style={{borderBottom:'1px solid var(--border)'}}></td>
                            <td className="col-inst" style={{borderBottom:'1px solid var(--border)'}}></td>
                            <td className="col-salon" style={{borderBottom:'1px solid var(--border)'}}></td>
                            <td className="col-horario" style={{fontSize:'0.72rem',fontWeight:700,textAlign:'right',padding:'4px 12px',borderBottom:'1px solid var(--border)',color:'#475569'}}>
                              Total {day.shortDate}
                            </td>
                          </>
                        )}
                        <td className="col-pax" style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid var(--border)',color:'#1e40af'}}>
                          {dayTotals.pax}
                        </td>
                        <td className="col-food" style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid var(--border)',color:'#475569'}}>{dayTotals.desayunos}</td>
                        <td className="col-food" style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid var(--border)',color:'#475569'}}>{dayTotals.ref_am}</td>
                        <td className="col-food" style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid var(--border)',color:'#475569'}}>{dayTotals.almuerzos}</td>
                        <td className="col-food" style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid var(--border)',color:'#475569'}}>{dayTotals.ref_pm}</td>
                        <td className="col-food" style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid var(--border)',color:'#475569'}}>{dayTotals.cenas}</td>
                        {isMobileView ? (
                          <td colSpan={2} className="col-alertas col-vendedor" style={{borderBottom:'1px solid var(--border)'}}></td>
                        ) : (
                          <>
                            <td className="col-alertas" style={{borderBottom:'1px solid var(--border)'}}></td>
                            <td className="col-vendedor" style={{borderBottom:'1px solid var(--border)'}}></td>
                          </>
                        )}
                      </tr>
                    );
                  }
                  return rows;
                }).concat(
                  filteredDays.length > 0 && !(isMobileView && viewMode === 'tabla') ? (
                    <tr key="semana-total" style={{background:'#e0e7ff'}}>
                      {isMobileView ? (
                        <td colSpan={5} style={{fontSize:'0.75rem',fontWeight:800,textAlign:'right',padding:'6px 12px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>
                          TOTAL SEMANA
                        </td>
                      ) : (
                        <>
                          <td className="col-dia" style={{borderTop:'2px solid #6366f1'}}></td>
                          <td className="col-estado" style={{borderTop:'2px solid #6366f1'}}></td>
                          <td className="col-inst" style={{borderTop:'2px solid #6366f1'}}></td>
                          <td className="col-salon" style={{borderTop:'2px solid #6366f1'}}></td>
                          <td className="col-horario" style={{fontSize:'0.75rem',fontWeight:800,textAlign:'right',padding:'6px 12px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>
                            TOTAL SEMANA
                          </td>
                        </>
                      )}
                      <td style={{fontSize:'0.82rem',fontWeight:900,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#1e40af'}}>
                        {weeklyTotals.pax}
                      </td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.desayunos}</td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.ref_am}</td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.almuerzos}</td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.ref_pm}</td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.cenas}</td>
                      {isMobileView ? (
                        <td colSpan={2} style={{borderTop:'2px solid #6366f1'}}></td>
                      ) : (
                        <>
                          <td className="col-alertas" style={{borderTop:'2px solid #6366f1'}}></td>
                          <td className="col-vendedor" style={{borderTop:'2px solid #6366f1'}}></td>
                        </>
                      )}
                    </tr>
                  ) : []
                );
              })()}</tbody></table>
        </div>
      )}
      {pdfLoading && <LoadingSpinner mensaje="Generando PDF..." />}
      <SettingsChecklist />
    </section>
  );
}
