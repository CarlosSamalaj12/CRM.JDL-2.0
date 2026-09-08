import { useEffect, useState, useCallback, useMemo, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { fetchEvents, fetchEventById, fetchWeeklyServices, getTareasSemanaMerged } from '../services/api.js';
import EventCard from '../components/EventCard.jsx';
import { useDataSyncMulti } from '../../../hooks/useDataSync.js';
import { InformeActionsContext } from '../components/ReportsLayout.jsx';

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

// Helper para normalizar el ID base de eventos multi-slot (ej. "evt_123_s2_20260728" -> "evt_123")
const getEventGroupId = (idOcupacion) =>
  String(idOcupacion || '').replace(/_s\d+_\d{6,}$/, '');

// Obtener cantidades de comida por evento+fecha desde weeklyServices
const getServiceCounts = (services, idOcupacion, fecha) => {
  const baseId = getEventGroupId(idOcupacion);
  const dayServices = services.filter(s => {
    const rawDate = String(s.FechaServicio || '');
    const cleanDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate.slice(0, 10);
    const sBaseId = getEventGroupId(s.Idocupacion);
    return cleanDate === fecha && (String(s.Idocupacion) === String(idOcupacion) || sBaseId === baseId);
  });
  if (dayServices.length === 0) return null;
  const result = { desayunos: 0, refacciones_am: 0, almuerzos: 0, refacciones_pm: 0, cenas: 0 };
  for (const s of dayServices) {
    const tipo = s.TipoServicio;
    const cantidad = Number(s.cantidad) || 0;
    if (tipo in result) result[tipo] += cantidad;
  }
  return result;
};

const kanbanMemoryCache = {};

export default function Kanban() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setInformeActions } = useContext(InformeActionsContext) || {};

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
    if (setInformeActions) setInformeActions(kanbanActionsEl);
    return () => {
      if (setInformeActions) setInformeActions(null);
    };
  }, [kanbanActionsEl, setInformeActions]);

  return (
    <section className="kanban-shell">
      {!loading && !error && isMobileView && (viewMode === 'kanban' || viewMode === 'tareas' || viewMode === 'tabla') && (
        <div className="kanban-header">
          <div className="kanban-day-selector">
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
        </div>
      )}

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
                        tareasCount={taskCountsMap[event.Idocupacion] || 0}
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
          initialTareas={weeklyTasks.length > 0 ? weeklyTasks : null}
        />
      )}

      {!loading && !error && viewMode === 'tabla' && (
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

                      const foodKey = `${groupId}_${day.isoDate}`;
                      const canReceiveFood = !seenFoodTable.has(foodKey);
                      if (canReceiveFood) seenFoodTable.add(foodKey);

                      const svc = (canReceiveFood && weeklyServices.length > 0)
                        ? getServiceCounts(weeklyServices, ev.Idocupacion, day.isoDate)
                        : null;
                      const evDes = svc ? svc.desayunos : (canReceiveFood ? (Number(ev.cant_desayunos) || 0) : 0);
                      const evRefAm = svc ? svc.refacciones_am : (canReceiveFood ? (Number(ev.cant_refacciones_am) || 0) : 0);
                      const evAlm = svc ? svc.almuerzos : (canReceiveFood ? (Number(ev.cant_almuerzos) || 0) : 0);
                      const evRefPm = svc ? svc.refacciones_pm : (canReceiveFood ? (Number(ev.cant_refacciones_pm) || 0) : 0);
                      const evCen = svc ? svc.cenas : (canReceiveFood ? (Number(ev.cant_cenas) || 0) : 0);
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
                        <td className="col-pax" style={{fontSize:'0.75rem',fontWeight:800,textAlign:'center',padding:'4px 8px',borderBottom:'1px solid var(--border)',color:'#4f46e5'}}>
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
                      <td style={{fontSize:'0.82rem',fontWeight:900,textAlign:'center',padding:'6px 8px',borderTop:'2px solid #6366f1',color:'#4338ca'}}>
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
                  ) : null
                );
              })()}
            </tbody></table>
          </div>
        </div>
      )}
      {pdfLoading && <LoadingSpinner mensaje="Generando PDF..." />}
      <SettingsChecklist />
    </section>
  );
}
