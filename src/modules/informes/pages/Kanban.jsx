import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { fetchEvents } from '../services/api.js';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../../services/stateService';
import EventCard from '../components/EventCard.jsx';

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

function formatDateShort(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' });
}
const fmtTime = (t) => (t || '').slice(0, 5) || '??:??';

function getWeekMonday(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

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

  const handlePrevWeek = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleNextWeek = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    setSelectedDate(d.toISOString().slice(0, 10));
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
    if (highlightEventoId && events.length > 0) {
      // Buscar el evento en la lista
      const evento = events.find(e => String(e.Idocupacion) === String(highlightEventoId));
      if (evento) {
        setEventoResaltado(highlightEventoId);
        // Navegar a la semana del evento
        setSelectedDate((evento.FechaEvento || evento.displayDate || '').slice(0, 10));
        
        // Hacer scroll al evento después de un breve delay
        setTimeout(() => {
          const elemento = document.getElementById(`evento-${highlightEventoId}`);
          if (elemento) {
            elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
        
        // Quitar el resaltado después de 5 segundos
        setTimeout(() => {
          setEventoResaltado(null);
          // Limpiar los parámetros de la URL
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('highlightEvento');
          newParams.delete('comentarioId');
          newParams.delete('notaId');
          setSearchParams(newParams);
        }, 5000);
      }
    }
  }, [searchParams, events]);

  const [viewMode, setViewMode] = useState(() => {
    const vm = searchParams.get('viewMode');
    if (vm && ['kanban', 'tabla', 'tareas'].includes(vm)) return vm;
    return 'kanban';
  });
  const [occupancyOps, setOccupancyOps] = useState({});
  const [editingDay, setEditingDay] = useState(null);
  const [editDes, setEditDes] = useState(0);
  const [editHab, setEditHab] = useState(0);
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
  const isOccupancyEditable = currentUser && ['Admin', 'Vendedor', 'FrontOffice'].includes(currentUser.rol);

  useEffect(() => {
    const loadOcc = () => {
      loadCrmState().then(state => {
        setOccupancyOps(state?.occupancyWeeklyOps || {});
      }).catch(() => {});
    };
    loadOcc();
    window.addEventListener('stateUpdated', loadOcc);
    return () => window.removeEventListener('stateUpdated', loadOcc);
  }, []);

  const handleOccupancySave = async (isoDate) => {
    if (!isoDate) return;
    const weekStart = getWeekMonday(isoDate);
    if (!weekStart) return;
    setEditingDay(null);
    try {
      const state = await loadCrmState();
      const serverWeekly = state?.occupancyWeeklyOps || {};
      const currentWeekly = serverWeekly[weekStart] || {};
      const merged = {
        ...serverWeekly,
        [weekStart]: { ...currentWeekly, [isoDate]: { breakfasts: Math.max(0, Number(editDes) || 0), rooms: Math.max(0, Number(editHab) || 0) } }
      };
      await saveCrmState({ ...state, occupancyWeeklyOps: merged });
      setOccupancyOps(merged);
      window.dispatchEvent(new Event('stateUpdated'));
    } catch { toast?.error?.('Error al guardar ocupación') || console.error('Error saving occupancy'); }
  };

  const filterStatus = searchParams.get('status');
  const filterTipo = searchParams.get('tipo');
  const filterSalon = searchParams.get('salon');
  const filterAlertas = searchParams.get('alertas');
  const hasFilter = filterStatus || filterTipo || filterSalon || filterAlertas;

  useEffect(() => {
    setLoading(true);
    fetchEvents(selectedDate)
      .then((eventsData) => {
        // La BD ya entrega una fila por día (cada día con su propio Idocupacion).
        // NO expandir por día — solo asignar displayDate y dayIndex desde FechaEvento.
        const mapped = eventsData.map(e => {
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
  const clearFilters = () => {
    if (filterExiting) return;
    setFilterExiting(true);
    setTimeout(() => {
      setSearchParams({});
      setFilterExiting(false);
    }, 250);
  };

  const exportToExcel = () => {
    const rows = events.map(e => {
      const dateStr = e.displayDate || '';
      const dayOps = dateStr ? (occupancyOps[getWeekMonday(dateStr)]?.[dateStr]) || { breakfasts: 0, rooms: 0 } : { breakfasts: 0, rooms: 0 };
      return {
        'Fecha': dateStr,
        'Institución': e.Institucion || '',
        'Salón': e.Salon || '',
        'Horario': `${fmtTime(e.HoraI)} - ${fmtTime(e.HoraF)}`,
        'Pax': e.Pax || 0,
        'Des': dayOps.breakfasts,
        'Hab': dayOps.rooms,
        'Tipo': e.TipoEvento || '',
        'Estado': statusMap[e.Estatuscotizacion]?.label || '',
        'Vendedor': e.Vendedor || '',
        'Alertas': (e.tiene_alertas == 1 || e.tiene_alertas === true) ? 'Sí' : 'No',
      };
    });
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
      tableRows += `<tr class="dia-header${hasEvents ? '' : ' sin-eventos'}"><td colspan="15" style="background:#f0f4ff;font-weight:700;padding:8px 12px;font-size:13px;border-bottom:1px solid #d1d9e6;">${day.label}</td></tr>`;
      if (!hasEvents) {
        tableRows += `<tr><td colspan="15" style="text-align:center;padding:8px;color:#94a3b8;font-style:italic;border:none;">Sin eventos</td></tr>`;
      } else {
        const dayTotals = { pax: 0, desayunos: 0, ref_am: 0, almuerzos: 0, ref_pm: 0, cenas: 0 };
        for (const ev of day.events) {
          const paxVal = Number(ev.Pax) || 0;
          const dVal = Number(ev.cant_desayunos) || 0;
          const raVal = Number(ev.cant_refacciones_am) || 0;
          const aVal = Number(ev.cant_almuerzos) || 0;
          const rpVal = Number(ev.cant_refacciones_pm) || 0;
          const cVal = Number(ev.cant_cenas) || 0;
          dayTotals.pax += paxVal;
          dayTotals.desayunos += dVal;
          dayTotals.ref_am += raVal;
          dayTotals.almuerzos += aVal;
          dayTotals.ref_pm += rpVal;
          dayTotals.cenas += cVal;
          const st = statusMap[ev.Estatuscotizacion] || { label: '—', color: 'gray' };
          const dateStr = ev.displayDate || '';
          const dayOps = dateStr ? (occupancyOps[getWeekMonday(dateStr)]?.[dateStr]) || { breakfasts: 0, rooms: 0 } : { breakfasts: 0, rooms: 0 };
          const alerta = (ev.tiene_alertas == 1 || ev.tiene_alertas === true) ? '⚠' : '';
          tableRows += `<tr>
            <td style="padding:6px 10px;font-size:12px;white-space:nowrap;border-bottom:1px solid #e2e8f0;">${fmtShort(new Date(ev.displayDate + 'T12:00:00'))}</td>
            <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #e2e8f0;"><span class="tag tag-${st.color}">${st.label}</span></td>
            <td style="padding:6px 10px;font-size:12px;font-weight:600;border-bottom:1px solid #e2e8f0;">${ev.Institucion || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #e2e8f0;">${ev.Salon || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;white-space:nowrap;border-bottom:1px solid #e2e8f0;">${fmtTime(ev.HoraI)} - ${fmtTime(ev.HoraF)}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">${paxVal || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">${dVal || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">${raVal || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">${aVal || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">${rpVal || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">${cVal || '—'}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;font-weight:600;color:#16a34a;">${dayOps.breakfasts}</td>
            <td style="padding:6px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;font-weight:600;color:#2563eb;">${dayOps.rooms}</td>
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
          <td colspan="4" style="border-bottom:1px solid #e2e8f0;"></td>
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
        <td colspan="4" style="border-top:2px solid #6366f1;"></td>
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
      <th>Día</th><th>Estado</th><th>Institución</th><th>Salón</th><th>Horario</th><th>Pax</th><th title="Cantidad Desayunos">Des.</th><th title="Cantidad Refacciones AM">Ref.AM</th><th title="Cantidad Almuerzos">Alm.</th><th title="Cantidad Refacciones PM">Ref.PM</th><th title="Cantidad Cenas">Cenas</th><th>Des</th><th>Hab</th><th>Alertas</th><th>Vendedor</th>
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
                value={selectedDate ? selectedDate.slice(0, 10) : ''} 
                onChange={(e) => setSelectedDate(e.target.value)}
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

      {/* Day selector — visible en mobile */}
      {!loading && !error && viewMode === 'kanban' && (
        <div className="kanban-day-selector">
          {filteredColumns.map((col, i) => (
            <button
              key={col.isoDate}
              className={`kanban-day-pill ${mobileDayIndex === i ? 'active' : ''}`}
              onClick={() => setMobileDayIndex(i)}
            >
              <span className="pill-day">{col.name.slice(0, 3).replace('.','')}</span>
              <span className="pill-date">{col.isoDate.slice(5)}</span>
              <span className="pill-count">{col.items.length}</span>
            </button>
          ))}
        </div>
      )}

      {loading && <p className="status-message">Cargando eventos...</p>}
      {error && <p className="status-message status-error">{error}</p>}

      {!loading && !error && viewMode === 'kanban' && (
        <div className={`kanban-board ${isMobileView ? 'kanban-board--mobile' : ''}`}>
          {filteredColumns
            .filter((_, i) => !isMobileView || i === mobileDayIndex)
            .map((column, ci) => {
            const dayOps = (occupancyOps[getWeekMonday(column.isoDate)]?.[column.isoDate]) || { breakfasts: 0, rooms: 0 };
            const isEditing = editingDay === column.isoDate;
            return (
            <div key={column.name} id={`kcol-${ci}`} className="kanban-column">
              <div className="kanban-column-header">
                <div style={{display:'flex',flexDirection:'column',gap:'2px',width:'100%'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',flexWrap:'wrap',gap:'4px'}}>
                    <span style={{textTransform:'capitalize'}}>{column.name}</span>
                    <span className="kanban-column-count">{column.items.length}</span>
                  </div>
                  {!isEditing ? (
                    <div style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'0.6rem',fontWeight:600}}>
                      <span style={{padding:'1px 5px',borderRadius:'4px',background:'#f0fdf4',color:'#16a34a'}}>Des {dayOps.breakfasts}</span>
                      <span style={{padding:'1px 5px',borderRadius:'4px',background:'#eff6ff',color:'#2563eb'}}>Hab {dayOps.rooms}</span>
                      {isOccupancyEditable && (
                        <button type="button" onClick={() => { setEditingDay(column.isoDate); setEditDes(dayOps.breakfasts); setEditHab(dayOps.rooms); }}
                          style={{padding:'0 5px',border:'1px solid #d1d9e6',borderRadius:'4px',background:'#fff',cursor:'pointer',fontSize:'10px',lineHeight:'18px',color:'#6366f1'}}>
                          {'\u270F\uFE0F'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'0.6rem'}}>
                      <span style={{fontWeight:600,color:'#16a34a'}}>Des</span>
                      <input type="number" min="0" value={editDes} onChange={e => setEditDes(Number(e.target.value))}
                        style={{width:'44px',padding:'1px 4px',border:'1px solid #d1d9e6',borderRadius:'4px',fontSize:'0.65rem',fontWeight:600,textAlign:'center'}} />
                      <span style={{fontWeight:600,color:'#2563eb'}}>Hab</span>
                      <input type="number" min="0" value={editHab} onChange={e => setEditHab(Number(e.target.value))}
                        style={{width:'44px',padding:'1px 4px',border:'1px solid #d1d9e6',borderRadius:'4px',fontSize:'0.65rem',fontWeight:600,textAlign:'center'}} />
                      <button type="button" onClick={() => handleOccupancySave(column.isoDate)}
                        style={{padding:'0 6px',border:'none',borderRadius:'4px',background:'#10b981',color:'#fff',cursor:'pointer',fontSize:'10px',fontWeight:700,lineHeight:'18px'}}>OK</button>
                      <button type="button" onClick={() => setEditingDay(null)}
                        style={{padding:'0 6px',border:'1px solid #d1d9e6',borderRadius:'4px',background:'#fff',cursor:'pointer',fontSize:'10px',lineHeight:'18px',color:'#94a3b8'}}>X</button>
                    </div>
                  )}
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
                        onNavigateToTareas={() => setViewMode('tareas')}
                        highlightNotaId={searchParams.get('notaId')}
                      />
                  ))
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}

      {!loading && !error && viewMode === 'tareas' && (
        <WeeklyTasks selectedDate={selectedDate} events={events} onDateChange={setSelectedDate} />
      )}

      {!loading && !error && viewMode === 'tabla' && (
        <div style={{overflowX:'auto'}}>
          <table className="tabla-eventos"><thead><tr>
                <th>Día</th>
                <th>Estado</th>
                <th>Institución</th>
                <th>Salón</th>
                <th>Horario</th>
                <th>Pax</th>
                <th title="Cantidad Desayunos">Des.</th>
                <th title="Cantidad Refacciones AM">Ref. AM</th>
                <th title="Cantidad Almuerzos">Alm.</th>
                <th title="Cantidad Refacciones PM">Ref. PM</th>
                <th title="Cantidad Cenas">Cenas</th>
                <th>Des</th>
                <th>Hab</th>
                <th>Alertas</th>
                <th>Vendedor</th>
              </tr></thead><tbody>
              {days.length === 0 ? (
                <tr>
                <td colSpan={15} style={{textAlign:'center',padding:'2rem',color:'var(--text-muted)'}}>
                  No hay eventos esta semana
                </td>
                </tr>
              ) : (() => {
                let weeklyTotals = { pax: 0, desayunos: 0, ref_am: 0, almuerzos: 0, ref_pm: 0, cenas: 0 };
                return days.flatMap((day) => {
                  const rows = [];
                  rows.push(
                    <tr key={day.isoDate} className="tabla-dia-header">
                      <td colSpan={15}><div className="tabla-dia-inner">
                        <span className="tabla-dia-label">{day.label}</span>
                      </div></td>
                    </tr>
                  );
                  if (day.events.length === 0) {
                    rows.push(
                      <tr key={`${day.isoDate}-empty`}>
                        <td style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{day.shortDate}</td>
                        <td colSpan={14} style={{color:'var(--text-muted)',fontSize:'0.82rem',textAlign:'center'}}>
                          Sin eventos este día
                        </td>
                      </tr>
                    );
                  } else {
                    const dayOps = (occupancyOps[getWeekMonday(day.isoDate)]?.[day.isoDate]) || { breakfasts: 0, rooms: 0 };
                    const dayTotals = { pax: 0, desayunos: 0, ref_am: 0, almuerzos: 0, ref_pm: 0, cenas: 0 };
                    day.events.forEach((ev, ei) => {
                      const paxVal = Number(ev.Pax) || 0;
                      const dVal = Number(ev.cant_desayunos) || 0;
                      const raVal = Number(ev.cant_refacciones_am) || 0;
                      const aVal = Number(ev.cant_almuerzos) || 0;
                      const rpVal = Number(ev.cant_refacciones_pm) || 0;
                      const cVal = Number(ev.cant_cenas) || 0;
                      dayTotals.pax += paxVal;
                      dayTotals.desayunos += dVal;
                      dayTotals.ref_am += raVal;
                      dayTotals.almuerzos += aVal;
                      dayTotals.ref_pm += rpVal;
                      dayTotals.cenas += cVal;
                      const st = statusMap[ev.Estatuscotizacion] || { label: 'Desconocido', color: 'gray' };
                      rows.push(
                        <tr key={`${day.isoDate}-${ev.Idocupacion}-${ei}`}>
                          <td style={{fontSize:'0.75rem',color:'var(--text-muted)',whiteSpace:'nowrap'}}>{day.shortDate}</td>
                          <td><span className={`event-tag event-tag-${st.color}`} style={{fontSize:'0.65rem',padding:'0.1rem 0.35rem'}}>{st.label}</span></td>
                          <td style={{fontWeight:500}}>{ev.Institucion || '—'}</td>
                          <td><IconMapPin size={13} /> {ev.Salon || '—'}</td>
                          <td><IconClock size={13} /> {fmtTime(ev.HoraI)} - {fmtTime(ev.HoraF)}</td>
                          <td>{paxVal || '—'}</td>
                          <td style={{fontSize:'0.72rem',fontWeight:600,textAlign:'center'}}>{dVal || '—'}</td>
                          <td style={{fontSize:'0.72rem',fontWeight:600,textAlign:'center'}}>{raVal || '—'}</td>
                          <td style={{fontSize:'0.72rem',fontWeight:600,textAlign:'center'}}>{aVal || '—'}</td>
                          <td style={{fontSize:'0.72rem',fontWeight:600,textAlign:'center'}}>{rpVal || '—'}</td>
                          <td style={{fontSize:'0.72rem',fontWeight:600,textAlign:'center'}}>{cVal || '—'}</td>
                          <td style={{fontSize:'0.75rem',fontWeight:600,color:'#16a34a',textAlign:'center'}}>{dayOps.breakfasts}</td>
                          <td style={{fontSize:'0.75rem',fontWeight:600,color:'#2563eb',textAlign:'center'}}>{dayOps.rooms}</td>
                          <td>{(ev.tiene_alertas == 1 || ev.tiene_alertas === true) ? <span className="event-tag event-tag-warning" style={{fontSize:'0.65rem',padding:'0.1rem 0.35rem'}}>⚠️ Alertas</span> : '—'}</td>
                          <td><IconUser size={13} /> {ev.Vendedor || '—'}</td>
                        </tr>
                      );
                    });
                    weeklyTotals.pax += dayTotals.pax;
                    weeklyTotals.desayunos += dayTotals.desayunos;
                    weeklyTotals.ref_am += dayTotals.ref_am;
                    weeklyTotals.almuerzos += dayTotals.almuerzos;
                    weeklyTotals.ref_pm += dayTotals.ref_pm;
                    weeklyTotals.cenas += dayTotals.cenas;
                    rows.push(
                      <tr key={`${day.isoDate}-total`} style={{background:'#f1f5f9'}}>
                        <td colSpan={5} style={{fontSize:'0.72rem',fontWeight:700,textAlign:'right',padding:'4px 12px',borderBottom:'1px solid #e2e8f0',color:'#475569'}}>
                          Total {day.shortDate}
                        </td>
                        <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid #e2e8f0',color:'#1e40af'}}>
                          {dayTotals.pax}
                        </td>
                        <td style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid #e2e8f0',color:'#475569'}}>{dayTotals.desayunos}</td>
                        <td style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid #e2e8f0',color:'#475569'}}>{dayTotals.ref_am}</td>
                        <td style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid #e2e8f0',color:'#475569'}}>{dayTotals.almuerzos}</td>
                        <td style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid #e2e8f0',color:'#475569'}}>{dayTotals.ref_pm}</td>
                        <td style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid #e2e8f0',color:'#475569'}}>{dayTotals.cenas}</td>
                        <td colSpan={4} style={{borderBottom:'1px solid #e2e8f0'}}></td>
                      </tr>
                    );
                  }
                  return rows;
                }).concat(
                  days.length > 0 ? (
                    <tr key="semana-total" style={{background:'#e0e7ff'}}>
                      <td colSpan={5} style={{fontSize:'0.75rem',fontWeight:800,textAlign:'right',padding:'6px 12px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>
                        TOTAL SEMANA
                      </td>
                      <td style={{fontSize:'0.82rem',fontWeight:900,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#1e40af'}}>
                        {weeklyTotals.pax}
                      </td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.desayunos}</td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.ref_am}</td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.almuerzos}</td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.ref_pm}</td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.cenas}</td>
                      <td colSpan={4} style={{borderTop:'2px solid #6366f1'}}></td>
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
