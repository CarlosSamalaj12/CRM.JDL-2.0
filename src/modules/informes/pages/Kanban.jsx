import { useEffect, useState, useCallback, useMemo, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { fetchEvents, fetchEventById, fetchWeeklyServices, getTareasSemanaMerged } from '../services/api.js';
import EventCard from '../components/EventCard.jsx';
import { useDataSyncMulti } from '../../../hooks/useDataSync.js';
import { InformeActionsContext } from '../components/ReportsLayout.jsx';

import {
  IconGrid, IconTag, IconBuilding, IconCheckCircle, IconClock,
  IconAlertCircle, IconX, IconPrinter, IconFileText, IconMapPin,
  IconUser, IconDownload, IconClipboardList, IconLayers, IconSearch,
  IconCalendar,
} from '../components/Icons.jsx';
import LoadingSpinner from '../../../components/LoadingSpinner';
import SettingsChecklist from '../../settings/SettingsChecklist';
import WeeklyTasks from '../components/WeeklyTasks.jsx';
import { emitOpenEventChecklist } from '../../../utils/appEvents';

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const dayShortNames = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

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

const getDayLabelFull = (isoDate) => {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T12:00:00');
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  const weekday = cap(d.toLocaleDateString('es-ES', { weekday: 'long' }));
  const day = d.getDate();
  const month = d.toLocaleDateString('es-ES', { month: 'long' });
  return `${weekday}, ${day} de ${month}`;
};

// Helper para normalizar el ID base de eventos multi-slot (ej. "evt_123_s2_20260728" -> "evt_123")
const getEventGroupId = (idOcupacion) =>
  String(idOcupacion || '').replace(/_s\d+_\d{6,}$/, '');

// Obtener cantidades de comida por evento+fecha desde weeklyServices
const getServiceCounts = (services, idOcupacion, fecha) => {
  if (!services || services.length === 0 || !idOcupacion || !fecha) return null;
  const baseId = getEventGroupId(idOcupacion);
  const dayServices = services.filter(s => {
    const rawDate = String(s.FechaServicio || '');
    const cleanDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate.slice(0, 10);
    const sBaseId = getEventGroupId(s.Idocupacion);
    return cleanDate === fecha && (String(s.Idocupacion) === String(idOcupacion) || sBaseId === baseId);
  });
  if (dayServices.length === 0) return null;
  const result = {
    desayunos: 0,
    refacciones_am: 0,
    ref_am: 0,
    almuerzos: 0,
    refacciones_pm: 0,
    ref_pm: 0,
    cenas: 0,
  };
  for (const s of dayServices) {
    const tipo = s.TipoServicio;
    const cantidad = Number(s.cantidad) || 0;
    if (tipo === 'desayunos') {
      result.desayunos += cantidad;
    } else if (tipo === 'refacciones_am' || tipo === 'ref_am') {
      result.refacciones_am += cantidad;
      result.ref_am += cantidad;
    } else if (tipo === 'almuerzos') {
      result.almuerzos += cantidad;
    } else if (tipo === 'refacciones_pm' || tipo === 'ref_pm') {
      result.refacciones_pm += cantidad;
      result.ref_pm += cantidad;
    } else if (tipo === 'cenas') {
      result.cenas += cantidad;
    } else if (tipo in result) {
      result[tipo] += cantidad;
    }
  }
  return result;
};

function MobileTablaCard({
  event,
  dayNum,
  dayIso,
  highlighted,
  navigate,
  weeklyServices,
}) {
  const status = statusMap[event.Estatuscotizacion] || { label: 'Confirmado', color: 'green' };
  const statusLabel = status.label.toUpperCase();
  const isConfirmado = event.Estatuscotizacion === 4;
  const isPrereserva = event.Estatuscotizacion === 7;
  const isMantenimiento = event.Estatuscotizacion === 8;

  const statusBg = isConfirmado ? '#ecfdf5' : isPrereserva ? '#fdf2f8' : isMantenimiento ? '#f5f3ff' : '#f1f5f9';
  const statusColor = isConfirmado ? '#059669' : isPrereserva ? '#db2777' : isMantenimiento ? '#7c3aed' : '#475569';
  const statusBorder = isConfirmado ? '#a7f3d0' : isPrereserva ? '#fbcfe8' : isMantenimiento ? '#ddd6fe' : '#cbd5e1';

  // Obtener conteos de alimentos de weeklyServices o del evento
  const targetDate = dayIso || (event.FechaEvento ? String(event.FechaEvento).slice(0, 10) : (event.displayDate || ''));
  const sCounts = (weeklyServices && weeklyServices.length > 0)
    ? getServiceCounts(weeklyServices, event.Idocupacion, targetDate)
    : null;

  const des = sCounts ? (Number(sCounts.desayunos) || 0) : (Number(event.cant_desayunos) || 0);
  const alm = sCounts ? (Number(sCounts.almuerzos) || 0) : (Number(event.cant_almuerzos) || 0);
  const cen = sCounts ? (Number(sCounts.cenas) || 0) : (Number(event.cant_cenas) || 0);
  const refAm = sCounts ? (Number(sCounts.refacciones_am || sCounts.ref_am) || 0) : (Number(event.cant_refacciones_am) || 0);
  const refPm = sCounts ? (Number(sCounts.refacciones_pm || sCounts.ref_pm) || 0) : (Number(event.cant_refacciones_pm) || 0);

  const hasAlertas = (event.tiene_alertas === 1 || event.tiene_alertas === true);
  const hasFood = (des > 0 || alm > 0 || cen > 0 || refAm > 0 || refPm > 0);

  const dateQs = event.FechaEvento ? `?date=${String(event.FechaEvento).slice(0, 10)}` : '';

  return (
    <div
      id={`evento-${event.Idocupacion}`}
      onClick={() => navigate(`/informe/${event.Idocupacion}${dateQs}`)}
      style={{
        background: '#ffffff',
        border: highlighted ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '14px 16px',
        boxShadow: highlighted ? '0 0 16px rgba(139, 92, 246, 0.25)' : '0 2px 6px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '9px',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Top Row: Estado pill + Día + Pax */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              background: statusBg,
              color: statusColor,
              border: `1px solid ${statusBorder}`,
              borderRadius: '999px',
              padding: '2px 8px',
              fontSize: '10.5px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              letterSpacing: '0.02em',
            }}
          >
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusColor }} />
            {statusLabel}
          </span>

          <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b' }}>
            Día {dayNum}
          </span>
        </div>

        <div>
          <span style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
            {event.Pax || 0}
          </span>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', marginLeft: '3px' }}>
            PAX
          </span>
        </div>
      </div>

      {/* Middle: Institución en negrita */}
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: '15px',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            lineHeight: 1.25,
          }}
        >
          {event.Institucion || event.NombreEvento || 'Evento sin nombre'}
        </h3>
      </div>

      {/* Bottom: Salón con badge + Horario */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: '#eef2ff',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconBuilding size={13} color="#4f46e5" strokeWidth={2.3} />
          </div>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1e293b' }}>
            {event.Salon || 'Sin salón'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b', fontSize: '12px', fontWeight: 600 }}>
          <IconClock size={13} color="#64748b" strokeWidth={2.3} />
          <span>{fmtTime(event.HoraI)} - {fmtTime(event.HoraF)}</span>
        </div>
      </div>

      {/* Alimentos / Alertas si aplican - Badges independientes sin 0 suelto */}
      {(hasFood || hasAlertas) ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px',
            paddingTop: '6px',
            borderTop: '1px dashed #f1f5f9',
          }}
        >
          {des > 0 ? (
            <span style={{ fontSize: '11px', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 7px', borderRadius: '6px', fontWeight: 700 }}>
              🍳 {des} Des
            </span>
          ) : null}

          {refAm > 0 ? (
            <span style={{ fontSize: '11px', color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 7px', borderRadius: '6px', fontWeight: 700 }}>
              ☕ {refAm} Ref.AM
            </span>
          ) : null}

          {alm > 0 ? (
            <span style={{ fontSize: '11px', color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '2px 7px', borderRadius: '6px', fontWeight: 700 }}>
              🍽️ {alm} Alm
            </span>
          ) : null}

          {refPm > 0 ? (
            <span style={{ fontSize: '11px', color: '#7c3aed', background: '#faf5ff', border: '1px solid #e9d5ff', padding: '2px 7px', borderRadius: '6px', fontWeight: 700 }}>
              🍪 {refPm} Ref.PM
            </span>
          ) : null}

          {cen > 0 ? (
            <span style={{ fontSize: '11px', color: '#be123c', background: '#fff1f2', border: '1px solid #fecdd3', padding: '2px 7px', borderRadius: '6px', fontWeight: 700 }}>
              🍲 {cen} Cen
            </span>
          ) : null}

          {hasAlertas ? (
            <span
              style={{
                fontSize: '10.5px',
                color: '#b45309',
                background: '#fef3c7',
                border: '1px solid #fde68a',
                padding: '2px 7px',
                borderRadius: '6px',
                fontWeight: 700,
              }}
            >
              ⚠️ Alertas
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const kanbanMemoryCache = {};

export default function Kanban() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setInformeActions } = useContext(InformeActionsContext) || {};

  const [mobileSearch, setMobileSearch] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Función para obtener la fecha inicial (URL param > localStorage > hoy)
  const getInitialDate = () => {
    const dateParam = searchParams.get('date');
    if (dateParam) return dateParam;
    const saved = localStorage.getItem('kanban_selectedDate');
    return saved || new Date().toLocaleDateString('en-CA');
  };

  const getInitialMobileDayIndex = () => {
    const savedIdx = localStorage.getItem('kanban_mobileDayIndex');
    if (savedIdx !== null) return parseInt(savedIdx, 10);
    return (new Date().getDay() + 6) % 7;
  };

  const [events, setEvents] = useState([]);
  const [eventsTotal, setEventsTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedDate, setSelectedDate] = useState(getInitialDate());
  const [filterExiting, setFilterExiting] = useState(false);
  const [eventoResaltado, setEventoResaltado] = useState(null);
  const [mobileDayIndex, setMobileDayIndex] = useState(getInitialMobileDayIndex());
  const [isMobileView, setIsMobileView] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [weeklyServices, setWeeklyServices] = useState([]);
  const [weeklyTasks, setWeeklyTasks] = useState([]);
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
    if (selectedDate) {
      localStorage.setItem('kanban_selectedDate', selectedDate.slice(0, 10));
    }
  }, [selectedDate]);

  // Guardar mobileDayIndex seleccionado en localStorage
  useEffect(() => {
    localStorage.setItem('kanban_mobileDayIndex', String(mobileDayIndex));
  }, [mobileDayIndex]);

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
    // Si ya tenemos tarjetas en memoria para esta fecha, NO bloquear con pantalla de carga
    const cached = kanbanMemoryCache[selectedDate];
    if (cached && cached.length > 0) {
      setEvents(cached);
      setEventsTotal(cached.length);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetchEvents(selectedDate)
      .then((eventsData) => {
        const mapped = (eventsData || []).map(e => {
          const fecha = String(e.FechaEvento || '').slice(0, 10);
          const d = new Date(fecha + 'T12:00:00');
          return {
            ...e,
            displayDate: fecha,
            cant_desayunos: Number(e.cant_desayunos) || 0,
            cant_refacciones_am: Number(e.cant_refacciones_am) || 0,
            cant_almuerzos: Number(e.cant_almuerzos) || 0,
            cant_refacciones_pm: Number(e.cant_refacciones_pm) || 0,
            cant_cenas: Number(e.cant_cenas) || 0,
            dayIndex: d.getDay(),
            dayLabel: `${dayNames[d.getDay()]} ${fecha}`,
          };
        });

        kanbanMemoryCache[selectedDate] = mapped;
        setEvents(mapped);
        setEventsTotal(mapped.length);
      })
      .catch((err) => setError(err.message || 'Error desconocido'))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  const loadWeeklyTasks = useCallback(() => {
    const monday = getMonday(selectedDate);
    // Filtrar por usuario/equipo para que el contador del badge en EventCard
    // muestre solo las tareas que de verdad puede ver el usuario actual
    // (si no, "tareas pendientes" incluye tareas de otros equipos que no
    // aparecen al hacer click, causando confusión).
    const params = {};
    if (currentUser?.id) params.usuario_id = currentUser.id;
    if (currentUser?.teamId) params.equipo_id = currentUser.teamId;
    getTareasSemanaMerged(monday, params)
      .then(setWeeklyTasks)
      .catch(() => {});
  }, [selectedDate, currentUser?.id, currentUser?.teamId]);

  useEffect(() => {
    loadEvents();
    loadWeeklyTasks();
  }, [loadEvents, loadWeeklyTasks]);

  // Cargar servicios semanales con desglose por fecha
  useEffect(() => {
    fetchWeeklyServices(selectedDate)
      .then(data => setWeeklyServices(data))
      .catch(() => { /* fallback: usar datos de eventos */ });
  }, [selectedDate]);

  useDataSyncMulti(['evento_status', 'evento', 'tarea_semanal', 'tarea_evento'], () => {
    loadEvents();
    loadWeeklyTasks();
  });

  const taskCountsMap = useMemo(() => {
    const map = {};
    if (Array.isArray(weeklyTasks)) {
      weeklyTasks.forEach(t => {
        if (t.completada) return;
        const key = String(t.id_ocupacion || '');
        if (key) {
          map[key] = (map[key] || 0) + 1;
        }
      });
    }
    return map;
  }, [weeklyTasks]);

  const selectedDateObj = new Date(selectedDate + 'T12:00:00');
  const fallbackDate = isNaN(selectedDateObj.getTime()) ? new Date() : selectedDateObj;
  const day = fallbackDate.getDay();
  const diff = fallbackDate.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(fallbackDate);
  monday.setDate(diff);

  const weekMeta = useMemo(() => {
    const sun = new Date(monday);
    sun.setDate(monday.getDate() + 6);

    const getWeekNum = (date) => {
      const target = new Date(date.valueOf());
      const dayNr = (date.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      return 1 + Math.ceil((firstThursday - target) / 604800000);
    };

    const wNum = getWeekNum(monday);
    const mes1 = monday.toLocaleDateString('es-ES', { month: 'long' });
    const mes2 = sun.toLocaleDateString('es-ES', { month: 'long' });
    const anio1 = monday.getFullYear();
    const anio2 = sun.getFullYear();

    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
    const mesCap1 = cap(mes1);
    const mesCap2 = cap(mes2);

    const mesLabel = (mes1 === mes2 && anio1 === anio2)
      ? `${mesCap1.toUpperCase()} ${anio1}`
      : `${mesCap1.toUpperCase()} - ${mesCap2.toUpperCase()} ${anio2}`;

    const rangoSemana = (mes1 === mes2 && anio1 === anio2)
      ? `Semana ${wNum} • Del ${monday.getDate()} al ${sun.getDate()} de ${mes1} de ${anio1}`
      : `Semana ${wNum} • Del ${monday.getDate()} de ${mes1} al ${sun.getDate()} de ${mes2} de ${anio2}`;

    return { weekNumber: wNum, mesLabel, rangoSemana, monday, sunday: sun };
  }, [monday]);

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
      if (mobileSearch && mobileSearch.trim()) {
        const q = mobileSearch.toLowerCase().trim();
        const match = (e.Institucion || '').toLowerCase().includes(q) ||
                      (e.Salon || '').toLowerCase().includes(q) ||
                      (e.Vendedor || '').toLowerCase().includes(q) ||
                      (e.NombreEvento || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    }),
  }));

  const totalEvents = filteredColumns.reduce((sum, col) => sum + col.items.length, 0);

  const mobileWeekLabel = useMemo(() => {
    const sun = new Date(monday);
    sun.setDate(monday.getDate() + 6);
    const wNum = weekMeta.weekNumber;
    const mesSun = sun.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    const d1 = String(monday.getDate()).padStart(2, '0');
    const d2 = String(sun.getDate()).padStart(2, '0');
    return `Semana ${wNum} · ${d1} al ${d2} ${cap(mesSun)}`;
  }, [monday, weekMeta]);

  const formattedPickerDate = useMemo(() => {
    const dd = String(monday.getDate()).padStart(2, '0');
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const yyyy = monday.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }, [monday]);

  const currentCol = filteredColumns[mobileDayIndex] || filteredColumns[0];
  const dayEvents = currentCol?.items || [];

  const dayPax = useMemo(() => {
    return (currentCol?.items || []).reduce((acc, ev) => acc + (Number(ev.Pax || ev.pax || 0) || 0), 0);
  }, [currentCol]);



  const days = dayNames.map((_, index) => {
    const currentDay = new Date(monday);
    currentDay.setDate(monday.getDate() + index);
    const isoDate = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
    const label = currentDay.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const realDayIndex = currentDay.getDay();
    const rawDayEvents = events.filter((e) => e.dayIndex === realDayIndex);

    // Para la Tabla Semanal: Si un evento es COMPARTIDO (PaxCompartido === 1 o true),
    // se consolida en una sola fila pero concatenando todos los salones ocupados separados por coma.
    // Si NO es compartido (PaxCompartido === 0), cada salón sale por separado.
    const consolidatedMap = new Map();
    for (const ev of rawDayEvents) {
      const isShared = (ev.PaxCompartido === 1 || ev.PaxCompartido === true);
      const groupId = getEventGroupId(ev.Idocupacion);

      if (!isShared) {
        // No compartido: cada salón es una fila independiente
        consolidatedMap.set(ev.Idocupacion, { ...ev });
      } else {
        // Compartido: agrupar por reserva (groupId) para ese día
        const key = `shared_${groupId}_${isoDate}`;
        const isPrincipal = (ev.SalonPrincipal && String(ev.Salon || '').trim() === String(ev.SalonPrincipal || '').trim())
          || (ev.Idocupacion === groupId)
          || (!String(ev.Idocupacion || '').includes('_s'));

        if (!consolidatedMap.has(key)) {
          consolidatedMap.set(key, {
            ...ev,
            _isPrincipal: isPrincipal,
            _slots: [{ salon: ev.Salon, horaI: ev.HoraI, horaF: ev.HoraF, isPrincipal, idOcupacion: ev.Idocupacion }],
            cant_desayunos: Number(ev.cant_desayunos) || 0,
            cant_refacciones_am: Number(ev.cant_refacciones_am) || 0,
            cant_almuerzos: Number(ev.cant_almuerzos) || 0,
            cant_refacciones_pm: Number(ev.cant_refacciones_pm) || 0,
            cant_cenas: Number(ev.cant_cenas) || 0,
          });
        } else {
          const prev = consolidatedMap.get(key);
          prev._slots.push({ salon: ev.Salon, horaI: ev.HoraI, horaF: ev.HoraF, isPrincipal, idOcupacion: ev.Idocupacion });

          // Ordenar slots cronológicamente por hora de inicio
          prev._slots.sort((a, b) => String(a.horaI || '').localeCompare(String(b.horaI || '')));

          // Concatenar todos los salones únicos separados por coma
          const uniqueSalones = Array.from(new Set(prev._slots.map(s => String(s.salon || '').trim()).filter(Boolean)));
          prev.Salon = uniqueSalones.join(', ');

          // Ajustar horario que cubra el rango completo (desde el inicio más temprano hasta el fin más tardío)
          const validHorasI = prev._slots.map(s => s.horaI).filter(Boolean).sort();
          const validHorasF = prev._slots.map(s => s.horaF).filter(Boolean).sort();
          if (validHorasI.length > 0) prev.HoraI = validHorasI[0];
          if (validHorasF.length > 0) prev.HoraF = validHorasF[validHorasF.length - 1];

          if (isPrincipal && !prev._isPrincipal) {
            prev._isPrincipal = true;
            prev.Idocupacion = ev.Idocupacion;
            prev.SalonPrincipal = ev.SalonPrincipal;
          }

          // Sumar servicios de alimentación del día
          prev.cant_desayunos = (Number(prev.cant_desayunos) || 0) + (Number(ev.cant_desayunos) || 0);
          prev.cant_refacciones_am = (Number(prev.cant_refacciones_am) || 0) + (Number(ev.cant_refacciones_am) || 0);
          prev.cant_almuerzos = (Number(prev.cant_almuerzos) || 0) + (Number(ev.cant_almuerzos) || 0);
          prev.cant_refacciones_pm = (Number(prev.cant_refacciones_pm) || 0) + (Number(ev.cant_refacciones_pm) || 0);
          prev.cant_cenas = (Number(prev.cant_cenas) || 0) + (Number(ev.cant_cenas) || 0);
          prev.cant_notas = Math.max(Number(prev.cant_notas) || 0, Number(ev.cant_notas) || 0);
          if (ev.tiene_alertas == 1) prev.tiene_alertas = 1;
        }
      }
    }

    const tableEvents = Array.from(consolidatedMap.values()).filter((e) => {
      if (filterStatus && e.Estatuscotizacion !== Number(filterStatus)) return false;
      if (filterTipo && e.TipoEvento !== filterTipo) return false;
      if (filterSalon) {
        if (e._slots?.length) {
          if (!e._slots.some(s => s.salon === filterSalon)) return false;
        } else if (e.Salon !== filterSalon) {
          return false;
        }
      }
      if (filterAlertas && !(e.tiene_alertas == 1 || e.tiene_alertas === true)) return false;
      return true;
    });

    return { isoDate, label, events: tableEvents, shortDate: formatDateShort(isoDate) };
  }).filter((d) => d.events.length > 0);
  
  // En mobile vista tabla, filtrar por el día seleccionado en el selector de días
  const filteredDays = (isMobileView && viewMode === 'tabla' && columns[mobileDayIndex])
    ? days.filter(d => d.isoDate === columns[mobileDayIndex].isoDate)
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
    const seenFoodExcel = new Set();
    for (const day of days) {
      for (const e of day.events) {
        const groupId = getEventGroupId(e.Idocupacion);
        const foodKey = `${groupId}_${day.isoDate}`;
        const canReceiveFood = !seenFoodExcel.has(foodKey);
        if (canReceiveFood) seenFoodExcel.add(foodKey);

        const svcX = (canReceiveFood && weeklyServices.length > 0)
          ? getServiceCounts(weeklyServices, e.Idocupacion, day.isoDate)
          : null;
        rows.push({
          'Fecha': day.isoDate || e.displayDate || '',
          'Institución': e.Institucion || '',
          'Salón': e.Salon || '',
          'Horario': `${fmtTime(e.HoraI)} - ${fmtTime(e.HoraF)}`,
          'Pax': e.Pax || 0,
          'Des': svcX ? svcX.desayunos : (canReceiveFood ? (e.cant_desayunos || 0) : 0),
          'Ref. AM': svcX ? svcX.refacciones_am : (canReceiveFood ? (e.cant_refacciones_am || 0) : 0),
          'Alm.': svcX ? svcX.almuerzos : (canReceiveFood ? (e.cant_almuerzos || 0) : 0),
          'Ref. PM': svcX ? svcX.refacciones_pm : (canReceiveFood ? (e.cant_refacciones_pm || 0) : 0),
          'Cenas': svcX ? svcX.cenas : (canReceiveFood ? (e.cant_cenas || 0) : 0),
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
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const getWeekNum = (date) => {
      const target = new Date(date.valueOf());
      const dayNr = (date.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      return 1 + Math.ceil((firstThursday - target) / 604800000);
    };

    const weekNumber = getWeekNum(monday);
    const mes1 = monday.toLocaleDateString('es-ES', { month: 'long' });
    const mes2 = sunday.toLocaleDateString('es-ES', { month: 'long' });
    const anio1 = monday.getFullYear();
    const anio2 = sunday.getFullYear();

    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
    const mesCap1 = cap(mes1);
    const mesCap2 = cap(mes2);

    const mesLabel = (mes1 === mes2 && anio1 === anio2)
      ? `${mesCap1.toUpperCase()} ${anio1}`
      : `${mesCap1.toUpperCase()} - ${mesCap2.toUpperCase()} ${anio2}`;

    const rangoSemanaTexto = (mes1 === mes2 && anio1 === anio2)
      ? `Semana ${weekNumber} • Del ${monday.getDate()} al ${sunday.getDate()} de ${mes1} de ${anio1}`
      : `Semana ${weekNumber} • Del ${monday.getDate()} de ${mes1} al ${sunday.getDate()} de ${mes2} de ${anio2}`;

    const fmtShort = (date) => date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

    const now = new Date();
    const printTimestamp = now.toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const currentDay = new Date(monday);
      currentDay.setDate(monday.getDate() + i);
      const isoDate = currentDay.toISOString().slice(0, 10);
      const label = currentDay.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
      const realDayIndex = currentDay.getDay();
      const dayEvents = events.filter((e) => e.dayIndex === realDayIndex);
      return { isoDate, label, events: dayEvents };
    });

    let tableRows = '';
    const weeklyTotalsPrint = { pax: 0, desayunos: 0, ref_am: 0, almuerzos: 0, ref_pm: 0, cenas: 0 };
    for (const day of weekDays) {
      const hasEvents = day.events.length > 0;
      tableRows += `<tr class="dia-header${hasEvents ? '' : ' sin-eventos'}"><td colspan="13" style="background:#f5f3ff;color:#3730a3;font-weight:800;padding:7px 12px;font-size:12.5px;border-bottom:1.5px solid #c7d2fe;border-left:4px solid #6366f1;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${day.label}</td></tr>`;
      if (!hasEvents) {
        tableRows += `<tr><td colspan="13" style="text-align:center;padding:8px;color:#94a3b8;font-style:italic;border:none;">Sin eventos</td></tr>`;
      } else {
        const dayTotals = { pax: 0, desayunos: 0, ref_am: 0, almuerzos: 0, ref_pm: 0, cenas: 0 };
        const seenSharedPaxPrint = new Set();
        const seenFoodPrint = new Set();
        for (const ev of day.events) {
          const paxVal = Number(ev.Pax) || 0;
          const groupId = getEventGroupId(ev.Idocupacion);
          const isShared = (ev.PaxCompartido === 1 || ev.PaxCompartido === true);
          if (isShared) {
            const key = `${groupId}_${day.isoDate}`;
            if (!seenSharedPaxPrint.has(key)) {
              seenSharedPaxPrint.add(key);
              dayTotals.pax += paxVal;
            }
          } else {
            dayTotals.pax += paxVal;
          }

          const foodKey = `${groupId}_${day.isoDate}`;
          const canReceiveFood = !seenFoodPrint.has(foodKey);
          if (canReceiveFood) seenFoodPrint.add(foodKey);

          const svcP = (canReceiveFood && weeklyServices.length > 0)
            ? getServiceCounts(weeklyServices, ev.Idocupacion, day.isoDate)
            : null;
          const evDes = svcP ? svcP.desayunos : (canReceiveFood ? (Number(ev.cant_desayunos) || 0) : 0);
          const evRefAm = svcP ? svcP.refacciones_am : (canReceiveFood ? (Number(ev.cant_refacciones_am) || 0) : 0);
          const evAlm = svcP ? svcP.almuerzos : (canReceiveFood ? (Number(ev.cant_almuerzos) || 0) : 0);
          const evRefPm = svcP ? svcP.refacciones_pm : (canReceiveFood ? (Number(ev.cant_refacciones_pm) || 0) : 0);
          const evCen = svcP ? svcP.cenas : (canReceiveFood ? (Number(ev.cant_cenas) || 0) : 0);
          dayTotals.desayunos += evDes;
          dayTotals.ref_am += evRefAm;
          dayTotals.almuerzos += evAlm;
          dayTotals.ref_pm += evRefPm;
          dayTotals.cenas += evCen;
          const st = statusMap[ev.Estatuscotizacion] || { label: '—', color: 'gray' };
          const alerta = (ev.tiene_alertas == 1 || ev.tiene_alertas === true) ? '⚠' : '';
          tableRows += `<tr>
            <td style="padding:5px 6px;font-size:11px;white-space:nowrap;border-bottom:1px solid #e2e8f0;">${fmtShort(new Date(ev.displayDate + 'T12:00:00'))}</td>
            <td style="padding:5px 6px;font-size:11px;border-bottom:1px solid #e2e8f0;"><span class="tag tag-${st.color}">${st.label}</span></td>
            <td style="padding:5px 6px;font-size:11px;font-weight:600;border-bottom:1px solid #e2e8f0;line-height:1.25;">${ev.Institucion || '—'}</td>
            <td style="padding:5px 6px;font-size:11px;border-bottom:1px solid #e2e8f0;line-height:1.25;">${ev.Salon || '—'}</td>
            <td style="padding:5px 6px;font-size:11px;white-space:nowrap;border-bottom:1px solid #e2e8f0;">${fmtTime(ev.HoraI)} - ${fmtTime(ev.HoraF)}</td>
            <td style="padding:5px 6px;font-size:11px;text-align:center;border-bottom:1px solid #e2e8f0;font-weight:600;">${paxVal || '—'}</td>
            <td style="padding:5px 6px;font-size:11px;text-align:center;border-bottom:1px solid #e2e8f0;">${evDes || '—'}</td>
            <td style="padding:5px 6px;font-size:11px;text-align:center;border-bottom:1px solid #e2e8f0;">${evRefAm || '—'}</td>
            <td style="padding:5px 6px;font-size:11px;text-align:center;border-bottom:1px solid #e2e8f0;">${evAlm || '—'}</td>
            <td style="padding:5px 6px;font-size:11px;text-align:center;border-bottom:1px solid #e2e8f0;">${evRefPm || '—'}</td>
            <td style="padding:5px 6px;font-size:11px;text-align:center;border-bottom:1px solid #e2e8f0;">${evCen || '—'}</td>
            <td style="padding:5px 6px;font-size:11px;text-align:center;border-bottom:1px solid #e2e8f0;">${alerta}</td>
            <td style="padding:5px 6px;font-size:11px;border-bottom:1px solid #e2e8f0;line-height:1.2;">${ev.Vendedor || '—'}</td>
          </tr>`;
        }
        weeklyTotalsPrint.pax += dayTotals.pax;
        weeklyTotalsPrint.desayunos += dayTotals.desayunos;
        weeklyTotalsPrint.ref_am += dayTotals.ref_am;
        weeklyTotalsPrint.almuerzos += dayTotals.almuerzos;
        weeklyTotalsPrint.ref_pm += dayTotals.ref_pm;
        weeklyTotalsPrint.cenas += dayTotals.cenas;
        const shortDate = day.events[0]?.displayDate ? new Date(day.events[0].displayDate + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
        tableRows += `<tr style="background:#f8fafc;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
          <td colspan="5" style="font-size:11px;font-weight:700;text-align:right;padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#475569;">Total ${shortDate}</td>
          <td style="font-size:11px;font-weight:800;text-align:center;padding:5px 6px;border-bottom:1px solid #e2e8f0;color:#4f46e5;">${dayTotals.pax}</td>
          <td style="font-size:11px;font-weight:700;text-align:center;padding:5px 6px;border-bottom:1px solid #e2e8f0;color:#475569;">${dayTotals.desayunos}</td>
          <td style="font-size:11px;font-weight:700;text-align:center;padding:5px 6px;border-bottom:1px solid #e2e8f0;color:#475569;">${dayTotals.ref_am}</td>
          <td style="font-size:11px;font-weight:700;text-align:center;padding:5px 6px;border-bottom:1px solid #e2e8f0;color:#475569;">${dayTotals.almuerzos}</td>
          <td style="font-size:11px;font-weight:700;text-align:center;padding:5px 6px;border-bottom:1px solid #e2e8f0;color:#475569;">${dayTotals.ref_pm}</td>
          <td style="font-size:11px;font-weight:700;text-align:center;padding:5px 6px;border-bottom:1px solid #e2e8f0;color:#475569;">${dayTotals.cenas}</td>
          <td colspan="2" style="border-bottom:1px solid #e2e8f0;"></td>
        </tr>`;
      }
    }
    if (weekDays.length > 0) {
      tableRows += `<tr style="background:#e0e7ff;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <td colspan="5" style="font-size:11.5px;font-weight:800;text-align:right;padding:6px 8px;border-top:2px solid #6366f1;color:#312e81;">TOTAL SEMANA</td>
        <td style="font-size:12px;font-weight:900;text-align:center;padding:6px 6px;border-top:2px solid #6366f1;color:#4338ca;">${weeklyTotalsPrint.pax}</td>
        <td style="font-size:11.5px;font-weight:800;text-align:center;padding:6px 6px;border-top:2px solid #6366f1;color:#3730a3;">${weeklyTotalsPrint.desayunos}</td>
        <td style="font-size:11.5px;font-weight:800;text-align:center;padding:6px 6px;border-top:2px solid #6366f1;color:#3730a3;">${weeklyTotalsPrint.ref_am}</td>
        <td style="font-size:11.5px;font-weight:800;text-align:center;padding:6px 6px;border-top:2px solid #6366f1;color:#3730a3;">${weeklyTotalsPrint.almuerzos}</td>
        <td style="font-size:11.5px;font-weight:800;text-align:center;padding:6px 6px;border-top:2px solid #6366f1;color:#3730a3;">${weeklyTotalsPrint.ref_pm}</td>
        <td style="font-size:11.5px;font-weight:800;text-align:center;padding:6px 6px;border-top:2px solid #6366f1;color:#3730a3;">${weeklyTotalsPrint.cenas}</td>
        <td colspan="2" style="border-top:2px solid #6366f1;"></td>
      </tr>`;
    }

    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Ocupación Semanal — ${mesLabel}</title>
<style>
  @page { margin: 10mm 10mm; size: portrait; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 10px 12px; background: #ffffff; }
  .print-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 2.5px solid #4f46e5;
  }
  .print-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .print-logo-circle {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 6px;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .print-logo-img {
    max-width: 32px;
    max-height: 32px;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .print-title-group {
    display: flex;
    flex-direction: column;
  }
  .print-main-title {
    font-family: 'Cinzel', 'Playfair Display', 'Segoe UI', serif;
    font-size: 16px;
    font-weight: 800;
    color: #312e81;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin: 0;
    line-height: 1.15;
  }
  .print-sub-title {
    font-size: 9.5px;
    font-weight: 700;
    color: #6366f1;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin: 2px 0 0 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .print-period-badge {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
  }
  .print-month-pill {
    background: #f5f3ff;
    border: 1.5px solid #ddd6fe;
    color: #4f46e5;
    font-weight: 800;
    font-size: 12px;
    padding: 3px 12px;
    border-radius: 6px;
    letter-spacing: 0.04em;
    white-space: nowrap;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .print-week-range {
    font-size: 10px;
    font-weight: 600;
    color: #475569;
    margin-top: 3px;
  }
  .print-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding: 7px 12px;
    background: #faf5ff;
    border: 1px solid #e0e7ff;
    border-left: 3.5px solid #6366f1;
    border-radius: 6px;
    font-size: 10.5px;
    color: #475569;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .print-meta strong { color: #1e1b4b; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid !important; break-inside: avoid !important; }
  .dia-header { page-break-after: avoid !important; break-after: avoid !important; }
  th, td { word-break: break-word; overflow-wrap: break-word; vertical-align: middle; }
  th {
    background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
    color: #ffffff;
    padding: 7px 5px;
    text-align: left;
    font-weight: 700;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  th:first-child { border-radius: 6px 0 0 0; }
  th:last-child { border-radius: 0 6px 0 0; }
  .tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700; white-space: nowrap; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .tag-green { background: #dcfce7; color: #16a34a; }
  .tag-fucsia { background: #fdf2f8; color: #d946ef; }
  .tag-gray { background: #f1f5f9; color: #64748b; }
  .tag-purple { background: #f3e8ff; color: #a855f7; }
  tr.sin-eventos td { background: #fafafa; }
  .print-footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
</style></head>
<body>
  <div class="print-header">
    <div class="print-brand">
      <div class="print-logo-circle">
        <img src="/logo.png" alt="JDL" class="print-logo-img" onerror="this.src='/Oficial_JDL_acua.png'" />
      </div>
      <div class="print-title-group">
        <h1 class="print-main-title">INFORME DE OCUPACIÓN SEMANAL</h1>
        <p class="print-sub-title">CONTROL OPERATIVO Y SERVICIOS • JARDINES DEL LAGO</p>
      </div>
    </div>
    <div class="print-period-badge">
      <div class="print-month-pill">${mesLabel}</div>
      <div class="print-week-range">${rangoSemanaTexto}</div>
    </div>
  </div>
  <div class="print-meta">
    <span>📅 <strong>Período:</strong> ${rangoSemanaTexto}</span>
    <span>👤 <strong>Impreso por:</strong> ${userName}</span>
    <span>🕒 <strong>Fecha y hora:</strong> ${printTimestamp}</span>
  </div>
  <table>
    <colgroup>
      <col style="width: 78px;" />
      <col style="width: 82px;" />
      <col style="width: 250px;" />
      <col style="width: 130px;" />
      <col style="width: 95px;" />
      <col style="width: 48px;" />
      <col style="width: 42px;" />
      <col style="width: 48px;" />
      <col style="width: 42px;" />
      <col style="width: 48px;" />
      <col style="width: 42px;" />
      <col style="width: 38px;" />
      <col style="width: 145px;" />
    </colgroup>
    <thead><tr>
      <th>Día</th>
      <th>Estado</th>
      <th>Institución</th>
      <th>Salón</th>
      <th>Horario</th>
      <th style="text-align:center;">Pax</th>
      <th style="text-align:center;" title="Cantidad Desayunos">Des.</th>
      <th style="text-align:center;" title="Cantidad Refacciones AM">Ref.AM</th>
      <th style="text-align:center;" title="Cantidad Almuerzos">Alm.</th>
      <th style="text-align:center;" title="Cantidad Refacciones PM">Ref.PM</th>
      <th style="text-align:center;" title="Cantidad Cenas">Cenas</th>
      <th style="text-align:center;">Alertas</th>
      <th>Vendedor</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="print-footer">Documento generado por Jardines EMS • ${mesLabel} — ${printTimestamp}</div>
</body></html>`;
  };

  const exportToPdf = async () => {
    setPdfLoading(true);
    const html = buildPrintHtml();

    // Crear un contenedor oculto para renderizar el HTML
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:1100px;background:#fff;z-index:-1;padding:0;margin:0;';
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      // Esperar a que se carguen las imágenes
      const imgs = container.querySelectorAll('img');
      await Promise.all(Array.from(imgs).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
      }));

      const scale = 2;
      const canvas = await html2canvas(container, {
        scale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: 1100,
        logging: false,
      });

      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();  // 210 mm
      const pageH = pdf.internal.pageSize.getHeight(); // 297 mm
      const marginMm = 10; // 10 mm de margen uniforme en todos los bordes
      const usableW = pageW - marginMm * 2;  // 190 mm
      const usableH = pageH - marginMm * 2;  // 277 mm

      const mmPerPx = usableW / canvas.width;
      const maxPageCanvasH = usableH / mmPerPx; // altura máxima en px de canvas por hoja

      // Medir coordenadas de elementos sobre el contenedor para cortes limpios entre filas
      const containerRect = container.getBoundingClientRect();
      const cTop = containerRect.top;
      const canvasRatio = canvas.height / containerRect.height;

      // Medir thead para poder repetirlo en páginas 2+
      const theadEl = container.querySelector('thead');
      let theadTop = 0;
      let theadBottom = 0;
      let theadH = 0;
      if (theadEl) {
        const thRect = theadEl.getBoundingClientRect();
        theadTop = Math.max(0, Math.round((thRect.top - cTop) * canvasRatio));
        theadBottom = Math.min(canvas.height, Math.round((thRect.bottom - cTop) * canvasRatio));
        theadH = theadBottom - theadTop;
      }

      // Medir cada fila (tr) de tbody
      const trEls = Array.from(container.querySelectorAll('tbody tr'));
      const rowBounds = trEls.map(tr => {
        const r = tr.getBoundingClientRect();
        return {
          isDayHeader: tr.classList.contains('dia-header'),
          top: Math.round((r.top - cTop) * canvasRatio),
          bottom: Math.round((r.bottom - cTop) * canvasRatio),
          height: Math.round(r.height * canvasRatio),
        };
      }).filter(r => r.height > 0);

      let isFirstPage = true;
      let currentRowIdx = 0;

      if (rowBounds.length === 0) {
        const imgData = canvas.toDataURL('image/png');
        const sliceH = Math.min(canvas.height, maxPageCanvasH);
        pdf.addImage(imgData, 'PNG', marginMm, marginMm, usableW, sliceH * mmPerPx);
      } else {
        while (currentRowIdx < rowBounds.length) {
          if (!isFirstPage) {
            pdf.addPage();
          }

          if (isFirstPage) {
            // Página 1: incluye el encabezado institucional, metadata, thead y las primeras filas
            const startCanvasY = 0;
            let endRowIdx = currentRowIdx;

            while (endRowIdx < rowBounds.length) {
              const nextRow = rowBounds[endRowIdx];
              if (nextRow.bottom - startCanvasY > maxPageCanvasH) {
                break;
              }
              endRowIdx++;
            }

            // Si no cupo ninguna fila (caso extremo), forzar al menos la primera
            if (endRowIdx <= currentRowIdx) {
              endRowIdx = currentRowIdx + 1;
            } else if (endRowIdx < rowBounds.length) {
              // Si la última fila que cabe es un título de día (dia-header), moverlo a la página siguiente
              if (rowBounds[endRowIdx - 1]?.isDayHeader && (endRowIdx - 1 > currentRowIdx)) {
                endRowIdx--;
              }
            }

            const isLastBatch = (endRowIdx >= rowBounds.length);
            const cutY = isLastBatch ? canvas.height : rowBounds[endRowIdx - 1].bottom;
            const sliceH = cutY - startCanvasY;

            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = sliceH;
            const ctx = pageCanvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(canvas, 0, startCanvasY, canvas.width, sliceH, 0, 0, pageCanvas.width, sliceH);

            const imgData = pageCanvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', marginMm, marginMm, usableW, sliceH * mmPerPx);

            currentRowIdx = endRowIdx;
            isFirstPage = false;
          } else {
            // Páginas 2+: repetimos thead arriba y continuamos con las siguientes filas
            const availCanvasH = maxPageCanvasH - theadH;
            const startRowTop = (currentRowIdx > 0) ? rowBounds[currentRowIdx - 1].bottom : rowBounds[currentRowIdx].top;

            let endRowIdx = currentRowIdx;
            while (endRowIdx < rowBounds.length) {
              const nextRow = rowBounds[endRowIdx];
              if (nextRow.bottom - startRowTop > availCanvasH) {
                break;
              }
              endRowIdx++;
            }

            if (endRowIdx <= currentRowIdx) {
              endRowIdx = currentRowIdx + 1;
            } else if (endRowIdx < rowBounds.length) {
              if (rowBounds[endRowIdx - 1]?.isDayHeader && (endRowIdx - 1 > currentRowIdx)) {
                endRowIdx--;
              }
            }

            const isLastBatch = (endRowIdx >= rowBounds.length);
            const cutY = isLastBatch ? canvas.height : rowBounds[endRowIdx - 1].bottom;
            const dataH = cutY - startRowTop;
            const totalSliceH = theadH + dataH;

            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = totalSliceH;
            const ctx = pageCanvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

            // 1. Dibujar thead arriba
            if (theadH > 0) {
              ctx.drawImage(canvas, 0, theadTop, canvas.width, theadH, 0, 0, canvas.width, theadH);
            }

            // 2. Dibujar las filas de datos debajo del thead
            ctx.drawImage(canvas, 0, startRowTop, canvas.width, dataH, 0, theadH, canvas.width, dataH);

            const imgData = pageCanvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', marginMm, marginMm, usableW, totalSliceH * mmPerPx);

            currentRowIdx = endRowIdx;
          }
        }
      }

      const filename = `ocupacion-semana-${selectedDate}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
      setPdfLoading(false);
    }
  };

  const handlePrint = () => {
    const html = buildPrintHtml();

    // Agregar estilos @media print y controles de impresión
    const printHtml = html
      .replace('</style>', `
  @media print {
    @page { margin: 10mm; size: portrait; }
    body { padding: 0; }
    .no-print { display: none; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    thead { display: table-header-group !important; }
    .dia-header { page-break-after: avoid !important; break-after: avoid !important; }
  }
</style>`)
      .replace('</body>', `
  <div class="no-print" style="text-align:center;margin-top:20px;">
    <button onclick="window.print()" style="padding:10px 28px;background:linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(99,102,241,0.3);">Imprimir / PDF</button>
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

  const kanbanActionsEl = useMemo(() => (
    <div className="kanban-filter" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', minWidth: 0, width: '100%' }}>
      <div className="kanban-header-meta">
        <span className="kanban-header-meta-title">
          {viewMode === 'kanban' ? <><IconGrid size={15} /> Ocupación</> : viewMode === 'tabla' ? <><IconFileText size={15} /> Tabla</> : <><IconClipboardList size={15} /> Tareas</>}
        </span>
        <span className="kanban-header-meta-count">
          {totalEvents} eventos{hasFilter ? ' filtrados' : ''}
        </span>
      </div>
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
        style={filterAlertas ? { background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)', color: '#d97706' } : {}}
      >
        Alertas
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
  ), [viewMode, filterAlertas, searchParams, setSearchParams, selectedDate, pdfLoading, totalEvents, hasFilter]);

  useEffect(() => {
    if (setInformeActions) {
      if (isMobileView) {
        setInformeActions(null);
      } else {
        setInformeActions(kanbanActionsEl);
      }
    }
    return () => {
      if (setInformeActions) setInformeActions(null);
    };
  }, [kanbanActionsEl, setInformeActions, isMobileView]);

  return (
    <section className="kanban-shell">
      {/* ─── VISTA MÓVIL: ENCABEZADO Y CONTROLES DE ALTA FIDELIDAD ─── */}
      {isMobileView && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', boxSizing: 'border-box', marginBottom: '8px' }}>
          {/* 1. Header Bar: Logo JDL + Título + Búsqueda + Alertas + Exportar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '4px 2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                flexShrink: 0,
              }}>
                <IconLayers size={20} color="#ffffff" strokeWidth={2.3} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 650, color: '#4f46e5', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  JARDINES DEL LAGO
                </span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                  Ocupación Semanal
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setShowMobileSearch(s => !s)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: showMobileSearch ? '#f1f5f9' : '#ffffff',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Buscar eventos"
              >
                <IconSearch size={15} color="#475569" strokeWidth={2.2} />
              </button>

              <button
                type="button"
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  if (filterAlertas) {
                    newParams.delete('alertas');
                  } else {
                    newParams.set('alertas', '1');
                  }
                  setSearchParams(newParams);
                }}
                style={{
                  height: '34px',
                  padding: '0 8px',
                  borderRadius: '8px',
                  border: filterAlertas ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                  background: filterAlertas ? '#fef3c7' : '#ffffff',
                  color: filterAlertas ? '#b45309' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Filtrar por alertas"
              >
                <span>⚠️</span>
              </button>

              <button
                type="button"
                onClick={() => setShowExportMenu(true)}
                style={{
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <IconDownload size={13} color="#475569" strokeWidth={2.3} />
                Exportar
              </button>
            </div>
          </div>

          {/* 2. Barra de búsqueda rápida en móvil */}
          {showMobileSearch && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#ffffff',
              padding: '6px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}>
              <IconSearch size={14} color="#64748b" strokeWidth={2.2} />
              <input
                type="text"
                placeholder="Buscar por institución, salón o asesor..."
                value={mobileSearch}
                onChange={e => setMobileSearch(e.target.value)}
                autoFocus
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', background: 'transparent', color: '#0f172a' }}
              />
              {mobileSearch && (
                <button
                  type="button"
                  onClick={() => setMobileSearch('')}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', fontSize: '12px' }}
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* 3. Conmutador de Vistas: Cápsula [ Ocupación | Lista/Tabla | Tareas ] */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '3px',
            gap: '3px',
            width: '100%',
            boxSizing: 'border-box',
          }}>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              style={{
                flex: 1,
                padding: '6px 4px',
                borderRadius: '9px',
                border: 'none',
                background: viewMode === 'kanban' ? '#ffffff' : 'transparent',
                color: viewMode === 'kanban' ? '#4f46e5' : '#64748b',
                fontWeight: viewMode === 'kanban' ? 700 : 500,
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                cursor: 'pointer',
                boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(79,70,229,0.12), 0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <IconGrid size={13} strokeWidth={2.2} />
              Ocupación
            </button>

            <button
              type="button"
              onClick={() => setViewMode('tabla')}
              style={{
                flex: 1,
                padding: '6px 4px',
                borderRadius: '9px',
                border: 'none',
                background: viewMode === 'tabla' ? '#ffffff' : 'transparent',
                color: viewMode === 'tabla' ? '#4f46e5' : '#64748b',
                fontWeight: viewMode === 'tabla' ? 700 : 500,
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                cursor: 'pointer',
                boxShadow: viewMode === 'tabla' ? '0 1px 3px rgba(79,70,229,0.12), 0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <IconFileText size={13} strokeWidth={2.2} />
              Lista / Tabla
            </button>

            <button
              type="button"
              onClick={() => setViewMode('tareas')}
              style={{
                flex: 1,
                padding: '6px 4px',
                borderRadius: '9px',
                border: 'none',
                background: viewMode === 'tareas' ? '#ffffff' : 'transparent',
                color: viewMode === 'tareas' ? '#4f46e5' : '#64748b',
                fontWeight: viewMode === 'tareas' ? 700 : 500,
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                cursor: 'pointer',
                boxShadow: viewMode === 'tareas' ? '0 1px 3px rgba(79,70,229,0.12), 0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <IconClipboardList size={13} strokeWidth={2.2} />
              Tareas
            </button>
          </div>

          {/* 4. Barra de Navegación de Semana: Mes/Semana + Stepper de Fecha */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2px 2px',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
            <div>
              <div style={{
                fontSize: '9.5px',
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                {weekMeta.mesLabel}
              </div>
              <div style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.01em',
                marginTop: '1px',
              }}>
                {mobileWeekLabel}
              </div>
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '2px',
              gap: '2px',
              position: 'relative',
            }}>
              <button
                type="button"
                onClick={handlePrevWeek}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: '#475569',
                  fontSize: '16px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Semana anterior"
              >
                ‹
              </button>

              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '0 6px',
                fontSize: '11px',
                fontWeight: 650,
                color: '#1e293b',
              }}>
                <span>{formattedPickerDate}</span>
                <IconCalendar size={13} color="#64748b" strokeWidth={2.3} />
                <input
                  type="date"
                  value={selectedDate ? getMonday(selectedDate.slice(0, 10)) : ''}
                  onChange={(e) => {
                    if (e.target.value) setSelectedDate(getMonday(e.target.value));
                  }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleNextWeek}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: '#475569',
                  fontSize: '16px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Semana siguiente"
              >
                ›
              </button>
            </div>
          </div>

          {/* 5. Carrusel de 7 Días con Tarjetas de Alta Fidelidad */}
          <div style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: '6px',
            overflowX: 'auto',
            padding: '2px 0 4px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            width: '100%',
          }}>
            {filteredColumns.map((col, i) => {
              const isSelected = mobileDayIndex === i;
              const dayNum = col.isoDate.split('-')[2];
              const shortDay = dayShortNames[i];
              const count = viewMode === 'tareas' ? (taskCounts[col.isoDate] || 0) : col.items.length;

              return (
                <button
                  key={col.isoDate}
                  type="button"
                  onClick={() => setMobileDayIndex(i)}
                  style={{
                    flex: '1 0 42px',
                    minWidth: '42px',
                    height: '62px',
                    padding: '5px 2px',
                    borderRadius: '11px',
                    border: isSelected ? '1.5px solid #4338ca' : '1px solid #e2e8f0',
                    background: isSelected
                      ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                      : '#ffffff',
                    color: isSelected ? '#ffffff' : '#0f172a',
                    boxShadow: isSelected
                      ? '0 3px 10px rgba(79, 70, 229, 0.3)'
                      : '0 1px 2px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    color: isSelected ? 'rgba(255,255,255,0.9)' : '#64748b',
                  }}>
                    {shortDay}
                  </span>

                  <span style={{
                    fontSize: '13.5px',
                    fontWeight: 700,
                    lineHeight: 1,
                    color: isSelected ? '#ffffff' : '#0f172a',
                  }}>
                    {dayNum}
                  </span>

                  <span style={{
                    background: isSelected ? '#ffffff' : '#f1f5f9',
                    color: isSelected ? '#4338ca' : '#475569',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '999px',
                    lineHeight: 1.2,
                    minWidth: '15px',
                    textAlign: 'center',
                  }}>
                    {isSelected ? `${count} ev` : count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra de Filtro Activo (si hay filtros aplicados) */}
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

      {/* ─── VISTA PRINCIPAL DE OCUPACIÓN (KANBAN) ─── */}
      {!loading && !error && viewMode === 'kanban' && (
        <div className={`kanban-board ${isMobileView ? 'kanban-board--mobile' : ''}`}>
          {filteredColumns
            .filter((_, i) => !isMobileView || i === mobileDayIndex)
            .map((column, ci) => {
              return (
                <div key={column.name} id={`kcol-${ci}`} className="kanban-column" style={isMobileView ? { width: '100%', margin: 0 } : {}}>
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
                          tareasCount={taskCountsMap[event.Idocupacion] || 0}
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
        <WeeklyTasks
          selectedDate={selectedDate}
events={events}
          onDateChange={setSelectedDate}
          mobileDayIndex={mobileDayIndex}
          setMobileDayIndex={setMobileDayIndex}
          setTaskCounts={setTaskCounts}
          targetEventId={targetEventId}
          onTargetEventProcessed={() => setTargetEventId(null)}
          initialTareas={weeklyTasks.length > 0 ? weeklyTasks : null}
        />
      )}

      {!loading && !error && viewMode === 'tabla' && (
        isMobileView ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', paddingBottom: '95px' }}>
            {/* Header del Día Seleccionado: Programación del día + Eventos + Pax */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 2px',
              flexWrap: 'wrap',
              gap: '8px',
              marginTop: '2px',
            }}>
              <div>
                <div style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  color: '#64748b',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  PROGRAMACIÓN DEL DÍA
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.01em',
                  marginTop: '1px',
                }}>
                  {getDayLabelFull(currentCol?.isoDate)}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                  borderRadius: '999px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#059669' }} />
                  {currentCol?.items.length || 0} Eventos
                </span>

                <span style={{
                  background: '#eef2ff',
                  color: '#4f46e5',
                  border: '1px solid #c7d2fe',
                  borderRadius: '999px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}>
                  {dayPax}+ Pax
                </span>
              </div>
            </div>

            {/* ─── BARRA INFERIOR DE ACCIONES EN MÓVIL (PORTAL AL BODY) ─── */}
            {typeof document !== 'undefined' && createPortal(
              <div
                className="iv-mobile-bottom-bar kanban-mobile-bottom-bar no-print"
                style={{
                  position: 'fixed',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  width: '100%',
                  maxWidth: '100%',
                  zIndex: 99995,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.97)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderTop: '1px solid rgba(226, 232, 240, 0.95)',
                  boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.12)',
                  paddingTop: '6px',
                  paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))',
                  paddingLeft: 'max(12px, env(safe-area-inset-left, 12px))',
                  paddingRight: 'max(12px, env(safe-area-inset-right, 12px))',
                  boxSizing: 'border-box',
                  transform: 'translateZ(0)',
                  WebkitTransform: 'translateZ(0)',
                  willChange: 'transform',
                }}
              >
                {/* 1. Descargar PDF */}
                <button
                  type="button"
                  onClick={exportToPdf}
                  disabled={pdfLoading}
                  className="iv-mob-btn iv-mob-btn-pdf"
                  title="Descargar PDF"
                  style={{
                    flex: '1 1 0',
                    minWidth: 0,
                    height: '42px',
                    borderRadius: '10px',
                    border: '1px solid rgba(79, 70, 229, 0.25)',
                    background: 'rgba(79, 70, 229, 0.08)',
                    color: '#4338ca',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    cursor: pdfLoading ? 'wait' : 'pointer',
                    padding: '2px 0',
                    opacity: pdfLoading ? 0.7 : 1,
                    touchAction: 'manipulation',
                  }}
                >
                  <IconFileText size={17} color="#4338ca" strokeWidth={2.2} />
                  <span className="iv-mob-label" style={{ color: '#4338ca', fontWeight: 700 }}>
                    {pdfLoading ? 'PDF...' : 'Descargar PDF'}
                  </span>
                </button>

                {/* 2. Exportar Excel */}
                <button
                  type="button"
                  onClick={exportToExcel}
                  className="iv-mob-btn"
                  title="Exportar Excel"
                  style={{
                    flex: '1 1 0',
                    minWidth: 0,
                    height: '42px',
                    borderRadius: '10px',
                    border: '1px solid rgba(5, 150, 105, 0.25)',
                    background: 'rgba(5, 150, 105, 0.08)',
                    color: '#065f46',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    cursor: 'pointer',
                    padding: '2px 0',
                    touchAction: 'manipulation',
                  }}
                >
                  <IconDownload size={17} color="#065f46" strokeWidth={2.2} />
                  <span className="iv-mob-label" style={{ color: '#065f46', fontWeight: 700 }}>
                    Exportar Excel
                  </span>
                </button>

                {/* 3. Imprimir */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="iv-mob-btn iv-mob-btn-print"
                  title="Imprimir"
                  style={{
                    flex: '1 1 0',
                    minWidth: 0,
                    height: '42px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    cursor: 'pointer',
                    padding: '2px 0',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
                    touchAction: 'manipulation',
                  }}
                >
                  <IconPrinter size={17} color="#ffffff" strokeWidth={2.2} />
                  <span className="iv-mob-label" style={{ color: '#ffffff', fontWeight: 700 }}>
                    Imprimir
                  </span>
                </button>
              </div>,
              document.body
            )}

            {/* Lista de Tarjetas Estilo Referencia para Lista/Tabla en Móvil */}
            {dayEvents.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: '#64748b',
                padding: '40px 20px',
                background: '#ffffff',
                borderRadius: '14px',
                border: '1px dashed #cbd5e1',
                margin: '8px 0',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#475569' }}>
                  Sin eventos programados este día
                </div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                  Selecciona otro día en el carrusel para ver sus eventos
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {dayEvents.map(event => (
                  <MobileTablaCard
                    key={`${event.Idocupacion}-${event.displayDate}`}
                    event={event}
                    dayNum={currentCol?.isoDate?.split('-')[2] || ''}
                    dayIso={currentCol?.isoDate}
                    highlighted={eventoResaltado === String(event.Idocupacion)}
                    navigate={navigate}
                    weeklyServices={weeklyServices}
                  />
                ))}
              </div>
            )}

            {/* Resumen y Totales del Día en Móvil */}
            {dayEvents.length > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(79, 70, 229, 0.02) 100%)',
                border: '1px solid #e0e7ff',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '4px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#3730a3', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Total Día {currentCol?.isoDate?.split('-')[2]}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#4338ca' }}>
                    {dayPax} PAX
                  </span>
                </div>
                {/* Desglose de Alimentos del Día si existen */}
                {(() => {
                  let totalDes = 0, totalRefAm = 0, totalAlm = 0, totalRefPm = 0, totalCen = 0;
                  dayEvents.forEach(ev => {
                    const sc = (weeklyServices && weeklyServices.length > 0)
                      ? getServiceCounts(weeklyServices, ev.Idocupacion, currentCol?.isoDate)
                      : null;
                    totalDes += sc ? (Number(sc.desayunos) || 0) : (Number(ev.cant_desayunos) || 0);
                    totalRefAm += sc ? (Number(sc.refacciones_am || sc.ref_am) || 0) : (Number(ev.cant_refacciones_am) || 0);
                    totalAlm += sc ? (Number(sc.almuerzos) || 0) : (Number(ev.cant_almuerzos) || 0);
                    totalRefPm += sc ? (Number(sc.refacciones_pm || sc.ref_pm) || 0) : (Number(ev.cant_refacciones_pm) || 0);
                    totalCen += sc ? (Number(sc.cenas) || 0) : (Number(ev.cant_cenas) || 0);
                  });
                  const hasDayFood = (totalDes > 0 || totalRefAm > 0 || totalAlm > 0 || totalRefPm > 0 || totalCen > 0);
                  if (!hasDayFood) return null;
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '4px', borderTop: '1px dashed #c7d2fe' }}>
                      {totalDes > 0 ? <span style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: '5px' }}>🍳 {totalDes} Desayunos</span> : null}
                      {totalRefAm > 0 ? <span style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 6px', borderRadius: '5px' }}>☕ {totalRefAm} Ref.AM</span> : null}
                      {totalAlm > 0 ? <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '2px 6px', borderRadius: '5px' }}>🍽️ {totalAlm} Almuerzos</span> : null}
                      {totalRefPm > 0 ? <span style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', background: '#faf5ff', border: '1px solid #e9d5ff', padding: '2px 6px', borderRadius: '5px' }}>🍪 {totalRefPm} Ref.PM</span> : null}
                      {totalCen > 0 ? <span style={{ fontSize: '11px', fontWeight: 700, color: '#be123c', background: '#fff1f2', border: '1px solid #fecdd3', padding: '2px 6px', borderRadius: '5px' }}>🍲 {totalCen} Cenas</span> : null}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className="tabla-eventos-container">
          <div className="tabla-header-banner" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '0.75rem 1.2rem',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(79, 70, 229, 0.03) 100%)',
            border: '1px solid #e0e7ff',
            borderLeft: '4px solid #6366f1',
            borderRadius: '10px',
            marginBottom: '0.75rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
                padding: '4px',
                flexShrink: 0
              }}>
                <img src="/logo.png" alt="JDL" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#312e81', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  Control de Ocupación Semanal
                </h2>
                <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: '#6366f1', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  JARDINES DEL LAGO • VISTA TABULAR DE EVENTOS
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{
                background: '#f5f3ff',
                border: '1.5px solid #ddd6fe',
                color: '#4f46e5',
                fontWeight: 800,
                fontSize: '0.8rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '6px',
                letterSpacing: '0.04em'
              }}>
                {weekMeta.mesLabel}
              </span>
              <span style={{
                background: '#ffffff',
                border: '1px solid #c7d2fe',
                color: '#3730a3',
                fontWeight: 700,
                fontSize: '0.8rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '6px'
              }}>
                {weekMeta.rangoSemana}
              </span>
            </div>
          </div>
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
                    const seenSharedPaxTable = new Set();
                    const seenFoodTable = new Set();
                    day.events.forEach((ev, ei) => {
                      const paxVal = Number(ev.Pax) || 0;
                      const groupId = getEventGroupId(ev.Idocupacion);
                      const isShared = (ev.PaxCompartido === 1 || ev.PaxCompartido === true);
                      if (isShared) {
                        const key = `${groupId}_${day.isoDate}`;
                        if (!seenSharedPaxTable.has(key)) {
                          seenSharedPaxTable.add(key);
                          dayTotals.pax += paxVal;
                        }
                      } else {
                        dayTotals.pax += paxVal;
                      }

                      const rowId = `${day.isoDate}-${ev.Idocupacion}-${ei}`;
                      const isExpanded = expandedRows.has(rowId);
                      const st = statusMap[ev.Estatuscotizacion] || { label: 'Desconocido', color: 'gray' };
                      const sCounts = getServiceCounts(weeklyServices, ev.Idocupacion, day.isoDate);
                      let dVal, raVal, aVal, rpVal, cVal;
                      if (sCounts) {
                        dVal = Number(sCounts.desayunos) || 0;
                        raVal = Number(sCounts.refacciones_am ?? sCounts.ref_am) || 0;
                        aVal = Number(sCounts.almuerzos) || 0;
                        rpVal = Number(sCounts.refacciones_pm ?? sCounts.ref_pm) || 0;
                        cVal = Number(sCounts.cenas) || 0;
                      } else {
                        dVal = Number(ev.cant_desayunos) || 0;
                        raVal = Number(ev.cant_refacciones_am) || 0;
                        aVal = Number(ev.cant_almuerzos) || 0;
                        rpVal = Number(ev.cant_refacciones_pm) || 0;
                        cVal = Number(ev.cant_cenas) || 0;
                      }
                      if (isShared) {
                        const foodKey = `${groupId}_${day.isoDate}`;
                        if (!seenFoodTable.has(foodKey)) {
                          seenFoodTable.add(foodKey);
                          dayTotals.desayunos += Number(dVal) || 0;
                          dayTotals.ref_am += Number(raVal) || 0;
                          dayTotals.almuerzos += Number(aVal) || 0;
                          dayTotals.ref_pm += Number(rpVal) || 0;
                          dayTotals.cenas += Number(cVal) || 0;
                        }
                      } else {
                        dayTotals.desayunos += Number(dVal) || 0;
                        dayTotals.ref_am += Number(raVal) || 0;
                        dayTotals.almuerzos += Number(aVal) || 0;
                        dayTotals.ref_pm += Number(rpVal) || 0;
                        dayTotals.cenas += Number(cVal) || 0;
                      }
                      const hasAlerts = ev.tiene_alertas == 1 || ev.tiene_alertas === true;
                      rows.push(
                        <tr
                          key={rowId}
                          onClick={() => {
                            if (isMobileView) {
                              setExpandedRows((prev) => {
                                const next = new Set(prev);
                                if (next.has(rowId)) next.delete(rowId);
                                else next.add(rowId);
                                return next;
                              });
                            }
                          }}
                          style={{
                            cursor: isMobileView ? 'pointer' : 'default',
                            background: isExpanded ? 'var(--surface-2, #f8fafc)' : 'transparent',
                          }}
                        >
                          <td className="col-dia">{isMobileView ? day.isoDate.slice(8) : day.shortDate}</td>
                          <td className="col-estado">
                            <span className={`event-tag event-tag-${st.color}`} style={{fontSize:'0.65rem',padding:'0.15rem 0.4rem'}}>
                              {st.label}
                            </span>
                          </td>
                          <td className="col-inst" style={{fontWeight:600}} title={ev.Institucion || ev.NombreEvento || '—'}>
                            {ev.Institucion || ev.NombreEvento || '—'}
                          </td>
                          <td className="col-salon" title={ev.Salon || '—'}>{ev.Salon || '—'}</td>
                          <td className="col-horario">{fmtTime(ev.HoraI)} - {fmtTime(ev.HoraF)}</td>
                          <td className="col-pax" style={{fontWeight:700}}>{ev.Pax || 0}</td>
                          <td className="col-food">{dVal || 0}</td>
                          <td className="col-food">{raVal || 0}</td>
                          <td className="col-food">{aVal || 0}</td>
                          <td className="col-food">{rpVal || 0}</td>
                          <td className="col-food">{cVal || 0}</td>
                          <td className="col-alertas" style={{textAlign:'center'}}>
                            {hasAlerts ? <span className="event-tag event-tag-warning" style={{fontSize:'0.65rem',padding:'0.1rem 0.35rem'}}>⚠️ Alertas</span> : '—'}
                          </td>
                          <td className="col-vendedor" title={ev.Vendedor || '—'}>{ev.Vendedor || '—'}</td>
                        </tr>
                      );
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
                                    <span className="detail-food-item"><span className="food-title">Des.</span> {dVal || 0}</span>
                                    <span className="detail-food-item"><span className="food-title">Ref.AM</span> {raVal || 0}</span>
                                    <span className="detail-food-item"><span className="food-title">Alm.</span> {aVal || 0}</span>
                                    <span className="detail-food-item"><span className="food-title">Ref.PM</span> {rpVal || 0}</span>
                                    <span className="detail-food-item"><span className="food-title">Cenas</span> {cVal || 0}</span>
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
                        <td colSpan={5} className="col-dia col-estado col-inst col-salon col-horario" style={{fontSize:'0.72rem',fontWeight:700,textAlign:'right',padding:'4px 12px',borderBottom:'1px solid var(--border)',color:'#475569'}}>
                          {isMobileView ? 'Total' : `Total ${day.shortDate}`}
                        </td>
                        <td className="col-pax" style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid var(--border)',color:'#4f46e5'}}>
                          {dayTotals.pax}
                        </td>
                        <td className="col-food" style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid var(--border)',color:'#475569'}}>{dayTotals.desayunos}</td>
                        <td className="col-food" style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid var(--border)',color:'#475569'}}>{dayTotals.ref_am}</td>
                        <td className="col-food" style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid var(--border)',color:'#475569'}}>{dayTotals.almuerzos}</td>
                        <td className="col-food" style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid var(--border)',color:'#475569'}}>{dayTotals.ref_pm}</td>
                        <td className="col-food" style={{fontSize:'0.72rem',fontWeight:700,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid var(--border)',color:'#475569'}}>{dayTotals.cenas}</td>
                        <td colSpan={2} className="col-alertas col-vendedor" style={{borderBottom:'1px solid var(--border)'}}></td>
                      </tr>
                    );
                  }
                  return rows;
                }).concat(
                  filteredDays.length > 0 && !(isMobileView && viewMode === 'tabla') ? (
                    <tr key="semana-total" style={{background:'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(79, 70, 229, 0.06) 100%)'}}>
                      <td colSpan={5} style={{fontSize:'0.78rem',fontWeight:800,textAlign:'right',padding:'6px 12px',borderTop:'2px solid #6366f1',color:'#3730a3',letterSpacing:'0.03em'}}>
                        TOTAL SEMANA
                      </td>
                      <td style={{fontSize:'0.82rem',fontWeight:900,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#4338ca'}}>
                        {weeklyTotals.pax}
                      </td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.desayunos}</td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.ref_am}</td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.almuerzos}</td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.ref_pm}</td>
                      <td style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#3730a3'}}>{weeklyTotals.cenas}</td>
                      <td colSpan={2} style={{borderTop:'2px solid #6366f1'}}></td>
                    </tr>
                  ) : null
                );
              })()}
            </tbody></table>
          </div>
        </div>
        )
      )}
      {pdfLoading && <LoadingSpinner mensaje="Generando PDF..." />}
      <SettingsChecklist />


      {/* Menú Flotante de Exportación en Móvil */}
      {showExportMenu && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setShowExportMenu(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              padding: '20px 20px 30px',
              width: '100%',
              maxWidth: '500px',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconDownload size={16} strokeWidth={2.3} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Exportar Ocupación</h4>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>{mobileWeekLabel}</span>
                </div>
              </div>
              <button
                onClick={() => setShowExportMenu(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowExportMenu(false);
                  exportToExcel();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '18px' }}>📊</span>
                <div>
                  <div>Descargar Excel (.xlsx)</div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Tabla con todos los eventos y desglose de servicios</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowExportMenu(false);
                  exportToPdf();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '18px' }}>📄</span>
                <div>
                  <div>Descargar PDF institucional</div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Formato formal con logo y control por día</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowExportMenu(false);
                  handlePrint();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '18px' }}>🖨️</span>
                <div>
                  <div>Imprimir vista semanal</div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Abre el diálogo directo de impresión</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
