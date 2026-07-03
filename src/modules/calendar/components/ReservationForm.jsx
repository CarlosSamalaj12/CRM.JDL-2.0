import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { STATUS_META_LIST, isAutoStatus } from '../constants';
import authService from '../../../services/authService';
import historyService from '../../../services/historyService';
import conflictService from '../../../services/conflictService';
import { loadState as loadCrmState } from '../../../services/stateService';
import AppointmentModal from './AppointmentModal';
import HistoryPanel from './HistoryPanel';
import QuoteModal from './QuoteModal';
import ConfirmModal from '../../../components/ConfirmModal';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';
import TimeSelect from '../../../components/TimeSelect';
import LoadingSpinner from '../../../components/LoadingSpinner';

const pastEventEditAuthorizedKeys = new Set();

function reservationKeyFromEvent(ev) {
  if (!ev) return "";
  return String(ev.groupId || ev.id || "").trim();
}

function getSeriesForEvent(events = [], eventId = '') {
  const target = events.find(ev => String(ev.id) === String(eventId));
  if (!target) return [];
  const groupId = String(target.groupId || '').trim();
  if (!groupId) return [target];
  const series = events.filter(ev => String(ev.groupId || '').trim() === groupId);
  return series.length ? series : [target];
}

function isEventSeriesInPast(events = [], eventId = '', graceDays = 0) {
  const series = getSeriesForEvent(events, eventId);
  if (!series.length) return false;
  const lastDate = series.reduce((max, ev) => {
    const d = String(ev.date || ev.eventDateEnd || ev.eventDateStart || '');
    return d > max ? d : max;
  }, '');
  if (!lastDate) return false;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  if (graceDays <= 0) {
    return lastDate < todayIso;
  }

  const graceDate = new Date(now);
  graceDate.setDate(graceDate.getDate() - graceDays);
  const graceDateIso = `${graceDate.getFullYear()}-${pad(graceDate.getMonth() + 1)}-${pad(graceDate.getDate())}`;

  return lastDate < graceDateIso;
}

function getAdminCode() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${dd}${mm}`;
}

async function requestPastEventEditAuthorization(ev, onAuth) {
  const key = reservationKeyFromEvent(ev);
  if (!key) return false;
  if (pastEventEditAuthorizedKeys.has(key)) return true;

  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  await new Promise(resolve => setTimeout(resolve, 0));
  const result = await Swal.fire({
    icon: "warning",
    title: "Evento de fecha pasada",
    text: "Para editar este evento ingresa codigo de administrador.",
    input: "password",
    inputPlaceholder: "Codigo admin",
    showCancelButton: true,
    confirmButtonText: "Autorizar",
    cancelButtonText: "Cancelar",
    background: "#f8fbff",
    color: "#10243b",
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#94a3b8",
    inputValidator: (value) => {
      if (!String(value || "").trim()) return "Ingresa el codigo.";
      return null;
    },
    didOpen: () => {
      const c = Swal.getContainer();
      if (c) c.style.setProperty('z-index', '10000001', 'important');
    },
  });

  if (!result.isConfirmed) return false;
  const code = String(result.value || "").trim();

  if (code !== getAdminCode()) {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    await new Promise(resolve => setTimeout(resolve, 0));
    await Swal.fire({
      icon: "error",
      title: "Codigo invalido",
      text: "No tienes autorizacion para editar eventos de fechas pasadas.",
      background: "#f8fbff",
      color: "#10243b",
      confirmButtonColor: "#2563eb",
      didOpen: () => {
        const c = Swal.getContainer();
        if (c) c.style.setProperty('z-index', '10000001', 'important');
      },
    });
    return false;
  }

  pastEventEditAuthorizedKeys.add(key);
  if (onAuth) onAuth(key);
  return true;
}

const HOUR_START = 0;
const HOUR_END = 23;

function timeToMinutes(time) {
  if (!time || typeof time !== 'string') return 0;
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || 0, 10);
}

function compareTime(a, b) {
  const am = timeToMinutes(a);
  const bm = timeToMinutes(b);
  return am - bm;
}

function isValidClockTime(time) {
  if (!time || typeof time !== 'string') return false;
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  return hh >= HOUR_START && hh <= HOUR_END && mm >= 0 && mm < 60;
}

function normalizeSlotDateRange(slot, fallbackStart = "", fallbackEnd = "") {
  const rawStart = String(slot?.dateStart || fallbackStart || "").trim();
  const rawEnd = String(slot?.dateEnd || fallbackEnd || rawStart).trim();
  if (!rawStart && !rawEnd) return { start: "", end: "" };
  if (!rawStart) return { start: rawEnd, end: rawEnd };
  if (!rawEnd) return { start: rawStart, end: rawStart };
  return rawStart <= rawEnd ? { start: rawStart, end: rawEnd } : { start: rawEnd, end: rawStart };
}

const MAINTENANCE_STATUSES = ['Mantenimiento', 'Mantenimiento Realizado'];

function isMaintenanceStatus(status) {
  return MAINTENANCE_STATUSES.includes(status);
}

function slotsFromEventSeries(series = [], fallbackEvent = null) {
  if (fallbackEvent?.slots?.length) return fallbackEvent.slots;
  const source = series.length ? series : (fallbackEvent ? [fallbackEvent] : []);
  const grouped = new Map();
  for (const ev of source) {
    const key = [
      ev.salon || '',
      ev.startTime || '',
      ev.endTime || '',
      ev.status || '',
      ev.slotPax ?? ev.pax ?? '',
    ].join('|');
    const date = ev.date || ev.eventDateStart || '';
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        salon: ev.salon || '',
        pax: ev.slotPax ?? ev.pax ?? '',
        dateStart: date,
        dateEnd: ev.endDate || ev.eventDateEnd || date,
        startTime: ev.startTime || '10:00',
        endTime: ev.endTime || '12:00',
        status: ev.status || 'Reserva sin Cotizacion'
      });
    } else {
      if (date && (!existing.dateStart || date < existing.dateStart)) existing.dateStart = date;
      if (date && (!existing.dateEnd || date > existing.dateEnd)) existing.dateEnd = date;
    }
  }
  return Array.from(grouped.values());
}

function normalizeReservationSnapshot({ formData = {}, slots = [] }) {
  const cleanedSlots = (slots || []).map(slot => ({
    salon: String(slot?.salon || '').trim(),
    pax: String(slot?.pax || '').trim(),
    dateStart: String(slot?.dateStart || '').trim(),
    dateEnd: String(slot?.dateEnd || '').trim(),
    startTime: String(slot?.startTime || '').trim(),
    endTime: String(slot?.endTime || '').trim(),
  })).sort((a, b) => (
    a.dateStart.localeCompare(b.dateStart)
    || a.salon.localeCompare(b.salon)
    || a.startTime.localeCompare(b.startTime)
    || a.endTime.localeCompare(b.endTime)
  ));

  return JSON.stringify({
    name: String(formData?.name || '').trim(),
    date: String(formData?.date || '').trim(),
    endDate: String(formData?.endDate || '').trim(),
    pax: String(formData?.pax || '').trim(),
    notes: String(formData?.notes || '').trim(),
    userId: String(formData?.userId || '').trim(),
    slots: cleanedSlots,
  });
}

function shouldMoveEditedReservationToSeguimiento(existingEvent, series, nextFormData, nextSlots) {
  const currentStatus = String(existingEvent?.status || '').trim();
  const nextStatus = String(nextFormData?.status || '').trim();
  const commercialFollowUpStatuses = ['Reserva sin Cotizacion', '1er Cotizacion'];

  if (!existingEvent || !commercialFollowUpStatuses.includes(currentStatus)) return false;
  if (nextStatus && nextStatus !== currentStatus) return false;
  if (currentStatus === 'Reserva sin Cotizacion' && !existingEvent.quote) return false;

  const oldSlots = slotsFromEventSeries(series, existingEvent);
  const firstSlot = oldSlots[0] || {};
  const firstDate = (series || []).reduce((min, ev) => {
    const date = String(ev?.date || '');
    return date && (!min || date < min) ? date : min;
  }, existingEvent.date || '');
  const lastDate = (series || []).reduce((max, ev) => {
    const date = String(ev?.date || '');
    return date && (!max || date > max) ? date : max;
  }, existingEvent.endDate || existingEvent.eventDateEnd || existingEvent.date || '');

  const oldFormData = {
    name: existingEvent.name || '',
    date: existingEvent.eventDateStart || firstDate || existingEvent.date || '',
    endDate: existingEvent.eventDateEnd || lastDate || existingEvent.endDate || existingEvent.date || '',
    pax: oldSlots.reduce((acc, slot) => acc + Math.max(0, Number(slot?.pax || 0)), 0) || existingEvent.pax || '',
    notes: existingEvent.notes || '',
    userId: existingEvent.userId || '',
    salon: firstSlot.salon || existingEvent.salon || '',
    startTime: firstSlot.startTime || existingEvent.startTime || '',
    endTime: firstSlot.endTime || existingEvent.endTime || '',
  };

  return normalizeReservationSnapshot({ formData: oldFormData, slots: oldSlots })
    !== normalizeReservationSnapshot({ formData: nextFormData, slots: nextSlots });
}

const StatusSelectCustom = ({ value, options, onChange, disabled, size = 'sm' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const insideButton = containerRef.current && containerRef.current.contains(event.target);
      const insideMenu = menuRef.current && menuRef.current.contains(event.target);
      if (!insideButton && !insideMenu) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeMenu = (event) => {
      const insideMenu = menuRef.current && menuRef.current.contains(event.target);
      if (!insideMenu) setIsOpen(false);
    };
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [isOpen]);

  const selectedOption = options.find(o => o.key === value) || options[0];
  const isSm = size === 'sm';
  const fontSize = isSm ? '12.5px' : '15px';
  const padding = isSm ? '6px 8px' : '10px 14px';
  const dotSize = isSm ? '8px' : '12px';
  const openMenu = () => {
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = Math.max(rect.width, 220);
    const estimatedHeight = Math.min(260, Math.max(148, options.length * 38 + 12));
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
    const spaceBelow = viewportHeight - rect.bottom;
    const shouldOpenAbove = spaceBelow < estimatedHeight && rect.top > spaceBelow;
    const maxHeight = shouldOpenAbove
      ? Math.min(260, Math.max(140, rect.top - 12))
      : Math.min(260, Math.max(140, viewportHeight - rect.bottom - 12));

    setMenuPosition({
      width: menuWidth,
      left: Math.max(8, Math.min(rect.left, viewportWidth - menuWidth - 8)),
      top: shouldOpenAbove
        ? Math.max(8, rect.top - maxHeight - 6)
        : Math.min(rect.bottom + 6, viewportHeight - maxHeight - 8),
      maxHeight
    });
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', fontSize, userSelect: 'none' }}>
      <div
        onClick={openMenu}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isSm ? '6px' : '10px',
          padding,
          background: disabled ? '#f1f5f9' : (isSm ? 'white' : `${selectedOption?.color || '#cbd5e1'}10`),
          border: '1px solid',
          borderColor: disabled ? '#cbd5e1' : (isSm ? '#cbd5e1' : `${selectedOption?.color || '#cbd5e1'}80`),
          borderRadius: isSm ? '6px' : '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: disabled ? '#94a3b8' : (isSm ? '#0f172a' : selectedOption?.color),
          fontWeight: isSm ? '700' : '800'
        }}
      >
        <span style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: selectedOption?.color || '#cbd5e1',
          boxShadow: `0 0 0 2px ${disabled ? '#f1f5f9' : (isSm ? 'white' : 'transparent')}, 0 0 0 3px ${selectedOption?.color || '#cbd5e1'}80`
        }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption?.key}
        </span>
        <span style={{ opacity: 0.5, fontSize: isSm ? '9px' : '12px' }}>▼</span>
      </div>

      {isOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          onWheel={(event) => event.stopPropagation()}
          style={{
          position: 'fixed',
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
          background: 'white',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.22)',
          zIndex: 9999999,
          maxHeight: menuPosition.maxHeight,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: '6px'
        }}>
          {options.map(option => {
            const isAuto = isAutoStatus(option.key);
            const isSelected = value === option.key;
            return (
              <div
                key={option.key}
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (!isAuto) {
                    onChange(option.key);
                    setIsOpen(false);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  cursor: isAuto ? 'not-allowed' : 'pointer',
                  background: isSelected ? '#eff6ff' : 'transparent',
                  opacity: isAuto ? 0.5 : 1,
                  transition: 'background 0.15s'
                }}
                onMouseOver={(e) => {
                  if (!isAuto && !isSelected) e.currentTarget.style.background = '#f8fafc';
                }}
                onMouseOut={(e) => {
                  if (!isAuto && !isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: '50%',
                  background: option.color,
                  boxShadow: `0 0 0 2px ${isSelected ? '#eff6ff' : 'white'}, 0 0 0 3px ${option.color}60`,
                  flexShrink: 0
                }} />
                <span style={{ fontWeight: '600', color: '#334155', fontSize: '12px' }}>
                  {option.key}
                </span>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

export default function ReservationForm() {
  const { events, salones, users, handleAddEvent, refreshData } = useOutletContext();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [slotConflicts, setSlotConflicts] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, type: null, message: '', title: '', isDanger: true });
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const [isCloseActive, setIsCloseActive] = useState(false);
  const [pastEventEditGraceDays, setPastEventEditGraceDays] = useState(0);
  const [graceDaysLoaded, setGraceDaysLoaded] = useState(false);
  const [authKey, setAuthKey] = useState(null);

  useEffect(() => {
    const loadGraceDays = async () => {
      try {
        const state = await loadCrmState();
        setPastEventEditGraceDays(Number(state.pastEventEditGraceDays || 0));
        setGraceDaysLoaded(true);
      } catch (err) {
        console.error('Error loading pastEventEditGraceDays:', err);
        setGraceDaysLoaded(true);
      }
    };
    loadGraceDays();
    const handleStateUpdate = () => loadGraceDays();
    window.addEventListener('stateUpdated', handleStateUpdate);
    return () => window.removeEventListener('stateUpdated', handleStateUpdate);
  }, []);

  const handlePastEventAuth = useCallback((key) => {
    pastEventEditAuthorizedKeys.add(key);
    setAuthKey(key);
  }, []);

  const urlDate = searchParams.get('date');
  const urlEndDate = searchParams.get('endDate') || urlDate;
  const urlStart = searchParams.get('start');
  const urlEnd = searchParams.get('end');
  const urlOpenAdvances = searchParams.get('openAdvances') === 'true';

  const getDefaultDate = useCallback(() => urlDate || new Date().toISOString().split('T')[0], [urlDate]);
  const getDefaultEndDate = useCallback(() => urlEndDate || getDefaultDate(), [urlEndDate, getDefaultDate]);

  const getCurrentUserId = () => {
    const currentUser = authService.getCurrentUser();
    return currentUser?.id || '';
  };

  const [formData, setFormData] = useState({
    name: '',
    salon: '',
    status: 'Reserva sin Cotizacion',
    date: getDefaultDate(),
    endDate: getDefaultEndDate(),
    startTime: urlStart || '10:00',
    endTime: urlEnd || '12:00',
    pax: '',
    notes: '',
    userId: getCurrentUserId(),
    quote: null
  });

  const [slots, setSlots] = useState([
    { salon: '', pax: '', dateStart: getDefaultDate(), dateEnd: getDefaultEndDate(), startTime: urlStart || '10:00', endTime: urlEnd || '12:00', status: 'Reserva sin Cotizacion' }
  ]);

  const [saving, setSaving] = useState(false);
  const [savingMsg, setSavingMsg] = useState('');

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  };

  const inputStyle = {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    background: '#ffffff',
    color: '#0f172a',
    boxSizing: 'border-box',
  };

  useEffect(() => {
    let active = true;
    const checkPastEvent = async () => {
      if (!graceDaysLoaded) return;
      if (id && events && events.length > 0) {
        const existingEvent = events.find(ev => String(ev.id) === String(id));
        if (existingEvent && isEventSeriesInPast(events, id, pastEventEditGraceDays)) {
          const key = reservationKeyFromEvent(existingEvent);
          if (key && !pastEventEditAuthorizedKeys.has(key)) {
            const auth = await requestPastEventEditAuthorization(existingEvent, handlePastEventAuth);
            if (!auth && active) {
              navigate('/calendar');
            }
          }
        }
      }
    };
    checkPastEvent();
    return () => {
      active = false;
    };
  }, [id, events, navigate, pastEventEditGraceDays, authKey, handlePastEventAuth, graceDaysLoaded]);

  const comparableEvents = useMemo(() => {
    if (!id) return events || [];
    const current = events?.find(ev => String(ev.id) === String(id));
    const groupId = String(current?.groupId || '').trim();
    return (events || []).filter(ev => String(ev.id) !== String(id) && (!groupId || String(ev.groupId || '').trim() !== groupId));
  }, [events, id]);

  useEffect(() => {
    if (salones?.length > 0 && !formData.salon && slots[0].salon === '') {
      const newSlots = slots.map((s, i) => i === 0 ? { ...s, salon: salones[0] } : s);
      setSlots(newSlots);
      setFormData(prev => ({ ...prev, salon: salones[0] }));
    }
  }, [salones, formData.salon, slots]);

  useEffect(() => {
    if (events && slots.length > 0) {
      const conflicts = conflictService.checkAllSlots(slots, comparableEvents, id);
      setSlotConflicts(conflicts.filter(r => !r.ok));
    }
  }, [slots, events, id, comparableEvents]);


  useEffect(() => {
    if (id && events) {
      const existingEvent = events.find(ev => String(ev.id) === String(id));
      if (existingEvent) {
        const series = getSeriesForEvent(events, id);
        const seriesSlots = slotsFromEventSeries(series, existingEvent);
        const firstSlot = seriesSlots[0] || {};
        const firstDate = series.reduce((min, ev) => {
          const date = String(ev.date || '');
          return date && (!min || date < min) ? date : min;
        }, existingEvent.date || getDefaultDate());
        const lastDate = series.reduce((max, ev) => {
          const date = String(ev.date || '');
          return date && (!max || date > max) ? date : max;
        }, existingEvent.endDate || existingEvent.eventDateEnd || existingEvent.date || getDefaultDate());
        const totalPaxFromSlots = seriesSlots.reduce((acc, slot) => acc + Math.max(0, Number(slot?.pax || 0)), 0);
        setFormData({
          name: existingEvent.name || '',
          salon: firstSlot.salon || existingEvent.salon || '',
          status: existingEvent.status || 'Reserva sin Cotizacion',
          date: existingEvent.eventDateStart || firstDate || getDefaultDate(),
          endDate: existingEvent.eventDateEnd || lastDate || existingEvent.date || getDefaultDate(),
          startTime: firstSlot.startTime || existingEvent.startTime || '10:00',
          endTime: firstSlot.endTime || existingEvent.endTime || '12:00',
          pax: totalPaxFromSlots || existingEvent.pax || '',
          notes: existingEvent.notes || '',
          userId: existingEvent.userId || '',
          quote: existingEvent.quote || null
        });

        if (seriesSlots.length > 0) {
          setSlots(seriesSlots);
        } else {
          setSlots([{
            salon: existingEvent.salon || (salones?.length > 0 ? salones[0] : ''),
            pax: existingEvent.pax || '',
            dateStart: existingEvent.date || getDefaultDate(),
            dateEnd: existingEvent.endDate || existingEvent.date || getDefaultDate(),
            startTime: existingEvent.startTime || '10:00',
            endTime: existingEvent.endTime || '12:00',
            status: existingEvent.status || 'Reserva sin Cotizacion'
          }]);
        }
      }
    } else {
      setFormData({
        name: '',
        salon: salones?.length > 0 ? salones[0] : '',
        status: 'Reserva sin Cotizacion',
        date: getDefaultDate(),
        endDate: getDefaultEndDate(),
        startTime: urlStart || '10:00',
        endTime: urlEnd || '12:00',
        pax: '',
        notes: '',
        userId: getCurrentUserId(),
        quote: null
      });
      setSlots([{
        salon: salones?.length > 0 ? salones[0] : '',
        pax: '',
        dateStart: getDefaultDate(),
        dateEnd: getDefaultEndDate(),
        startTime: urlStart || '10:00',
        endTime: urlEnd || '12:00',
        status: 'Reserva sin Cotizacion'
      }]);
    }
  }, [id, events, salones, urlDate, urlEndDate, urlStart, urlEnd, getDefaultDate, getDefaultEndDate]);

  useEffect(() => {
    if (urlOpenAdvances && id) {
      setShowQuoteModal(true);
    }
  }, [urlOpenAdvances, id]);

  const showNotification = (message, type = 'success') => {
    document.activeElement?.blur();
    if (type === 'error') toast.error(message, { duration: 3000 });
    else if (type === 'warning') toast(message, { duration: 3000, icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> });
    else toast.success(message, { duration: 3000 });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'date' || name === 'endDate') {
      const dateVal = name === 'date' ? value : formData.date;
      const endVal = name === 'endDate' ? value : formData.endDate;
      const newSlots = slots.map(s => ({
        ...s,
        dateStart: s.dateStart || dateVal,
        dateEnd: s.dateEnd || endVal
      }));
      setSlots(newSlots);
    }
  };

  const syncEventPaxFromSlots = useCallback(() => {
    const total = slots.reduce((acc, slot) => acc + Math.max(0, Number(slot?.pax || 0)), 0);
    setFormData(prev => ({ ...prev, pax: total > 0 ? total : '' }));
    return total;
  }, [slots]);

  const syncHiddenTimesFromFirstSlot = useCallback(() => {
    if (slots.length > 0) {
      setFormData(prev => ({
        ...prev,
        startTime: slots[0].startTime || prev.startTime,
        endTime: slots[0].endTime || prev.endTime,
        salon: slots[0].salon || prev.salon
      }));
    }
  }, [slots]);

  const addSlotRow = () => {
    const newSlot = {
      salon: salones?.length > 0 ? salones[0] : '',
      pax: '',
      dateStart: formData.date,
      dateEnd: formData.endDate,
      startTime: '10:00',
      endTime: '12:00',
      status: formData.status
    };
    setSlots([...slots, newSlot]);
  };

  const removeSlotRow = (index) => {
    if (slots.length <= 1) {
      showNotification('Debe existir al menos un bloque', 'error');
      return;
    }
    const newSlots = slots.filter((_, i) => i !== index);
    setSlots(newSlots);
    syncEventPaxFromSlots();
    syncHiddenTimesFromFirstSlot();
  };

  const handleSlotChange = (index, field, value) => {
    let val = value;
    if (field === 'pax') {
      val = value.replace(/\D/g, '');
    }
    const newSlots = slots.map((s, i) => i === index ? { ...s, [field]: val } : s);
    setSlots(newSlots);
    if (field === 'pax') {
      const total = newSlots.reduce((acc, slot) => acc + Math.max(0, Number(slot?.pax || 0)), 0);
      setFormData(prev => ({ ...prev, pax: total > 0 ? total : '' }));
    }
    if (field === 'salon' || field === 'startTime' || field === 'endTime') {
      if (index === 0 && newSlots.length > 0) {
        setFormData(prev => ({
          ...prev,
          startTime: newSlots[0].startTime || prev.startTime,
          endTime: newSlots[0].endTime || prev.endTime,
          salon: newSlots[0].salon || prev.salon
        }));
      }
    }
  };

  const applyEventStatus = (statusKey) => {
    const nextName = statusKey === 'Mantenimiento'
      ? 'MANTENIMIENTO'
      : statusKey === 'Mantenimiento Realizado' && formData.name === 'MANTENIMIENTO'
        ? 'MANTENIMIENTO REALIZADO'
        : formData.name;
    setFormData(prev => ({ ...prev, status: statusKey, name: nextName }));
    setSlots(prev => prev.map(slot => ({ ...slot, status: statusKey })));
    showNotification(`Estado cambiado a ${statusKey}`, 'info');
  };

  const validateReservationRequiredFields = useCallback(() => {
    const issues = [];

    const name = formData.name.trim();
    if (!name) issues.push('Nombre del evento es requerido');

    const dateStart = formData.date.trim();
    if (!dateStart) issues.push('Fecha inicial es requerida');

    const dateEnd = formData.endDate.trim();
    if (!dateEnd) issues.push('Fecha final es requerida');

    if (dateStart && dateEnd && dateStart > dateEnd) {
      issues.push('La fecha inicial no puede ser mayor a la fecha final');
    }

    // Validación: No permitir eventos en el pasado al crear (solo aplica para eventos nuevos)
    if (!id) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const currentDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      if (dateStart && dateStart < currentDate) {
        issues.push('La fecha inicial no puede estar en el pasado');
      } else if (dateStart === currentDate) {
        slots.forEach((s, i) => {
          if (s.startTime && timeToMinutes(s.startTime) < currentMinutes) {
            const salonLabel = s.salon ? `"${s.salon}"` : `Nº ${i + 1}`;
            issues.push(`La hora de inicio en el salón ${salonLabel} ya pasó`);
          }
        });
      }
    }

    const userId = formData.userId.trim();
    if (!userId) issues.push('Usuario (quien bloquea) es requerido');

    const isMaintenanceMode = isMaintenanceStatus(formData.status);

    if (!isMaintenanceMode) {
      const totalPax = syncEventPaxFromSlots();
      if (!totalPax || totalPax <= 0) issues.push('PAX total debe ser mayor a 0');
    }

    if (!slots.length) issues.push('Debes seleccionar al menos un salón y horario');

    slots.forEach((s, i) => {
      const idx = i + 1;
      const salonLabel = s.salon ? `"${s.salon}"` : `Nº ${idx}`;
      
      if (!s.salon) {
        issues.push(`Debes seleccionar un salón en el horario Nº ${idx}`);
      }
      
      const slotMaintenanceMode = isMaintenanceStatus(s.status || formData.status);

      if (!slotMaintenanceMode) {
        if (!s.pax || Number(s.pax) <= 0) {
          issues.push(`El salón ${salonLabel} debe tener un PAX mayor a 0`);
        }
      }
      
      const slotRange = normalizeSlotDateRange(s, dateStart, dateEnd);
      if (!slotRange.start) issues.push(`Fecha de inicio requerida para el salón ${salonLabel}`);
      if (!slotRange.end) issues.push(`Fecha final requerida para el salón ${salonLabel}`);

      if (slotRange.start && slotRange.end) {
        if (slotRange.start > slotRange.end) {
          issues.push(`La fecha inicial no puede ser mayor a la fecha final para el salón ${salonLabel}`);
        }
        if (dateStart && dateEnd) {
          const eventRange = normalizeSlotDateRange({ dateStart, dateEnd });
          if (slotRange.start < eventRange.start || slotRange.end > eventRange.end) {
            issues.push(`Las fechas del salón ${salonLabel} están fuera del rango general del evento`);
          }
        }
      }

      if (!s.startTime || !isValidClockTime(s.startTime)) {
        issues.push(`Hora de inicio requerida para el salón ${salonLabel}`);
      }
      if (!s.endTime || !isValidClockTime(s.endTime)) {
        issues.push(`Hora de fin requerida para el salón ${salonLabel}`);
      }
      
      if (s.startTime && s.endTime && compareTime(s.endTime, s.startTime) <= 0) {
        issues.push(`La hora de inicio no puede ser mayor o igual a la hora de fin para el salón ${salonLabel}`);
      }
    });

    setValidationErrors(issues);
    return { ok: issues.length === 0, issues };
  }, [formData, slots, syncEventPaxFromSlots, id]);

  const handleMaintenance = async () => {
    if (saving) return;

    // Validación rápida solo de campos esenciales
    const issues = [];
    const firstSlot = slots[0] || {};
    if (!formData.date.trim()) issues.push('Fecha requerida');
    if (!firstSlot.salon) issues.push('Salón requerido');
    if (!firstSlot.startTime || !isValidClockTime(firstSlot.startTime)) issues.push('Hora de inicio requerida');
    if (!firstSlot.endTime || !isValidClockTime(firstSlot.endTime)) issues.push('Hora de fin requerida');
    if (firstSlot.startTime && firstSlot.endTime && compareTime(firstSlot.endTime, firstSlot.startTime) <= 0) {
      issues.push('La hora de inicio debe ser menor a la hora de fin');
    }
    if (!formData.userId.trim()) issues.push('Usuario (quien bloquea) requerido');

    if (issues.length > 0) {
      showNotification(`Completa: ${issues[0]}${issues.length > 1 ? ` (+${issues.length - 1} pendientes)` : ''}`, 'error');
      return;
    }

    // Revisar conflictos con eventos Confirmado/Pre reserva
    const conflictCheck = conflictService.checkAllSlots(
      slots.map(s => ({ ...s, status: 'Mantenimiento' })),
      comparableEvents,
      id
    );
    const hardConflicts = conflictCheck.filter(r => r.type === 'conflict' && !r.ok);
    if (hardConflicts.length > 0) {
      showNotification(`Conflicto: ${hardConflicts[0].message}`, 'error');
      return;
    }

    setSavingMsg('Guardando mantenimiento...');
    setSaving(true);
    try {
      const existingEvent = id ? events.find(ev => String(ev.id) === String(id)) : null;
      const newName = 'MANTENIMIENTO';
      
      setFormData(prev => ({ ...prev, status: 'Mantenimiento', name: newName }));
      const updatedSlots = slots.map(s => ({ ...s, status: 'Mantenimiento' }));
      setSlots(updatedSlots);

      const eventData = {
        ...formData,
        name: newName,
        status: 'Mantenimiento',
        id: id || undefined,
        groupId: existingEvent?.groupId || undefined,
        pax: null,
        slots: updatedSlots,
        salon: updatedSlots.map(s => s.salon).join(', '),
        quote: existingEvent?.quote || undefined
      };

      const savedEvent = await handleAddEvent(eventData);

      if (id && existingEvent) {
        await historyService.addDetailed(id, existingEvent, eventData);
      } else {
        await historyService.add(savedEvent.id, 'Mantenimiento programado');
      }

      showNotification('Mantenimiento guardado', 'success');
      setTimeout(() => navigate('/calendar'), 1000);
    } catch {
      showNotification('Error al guardar mantenimiento', 'error');
      setSaving(false);
    }
  };

  const handleReleaseMaintenance = async () => {
    if (saving) return;
    setSavingMsg('Liberando mantenimiento...');
    setSaving(true);
    try {
      const existingEvent = id ? events.find(ev => String(ev.id) === String(id)) : null;
      const updatedFormData = {
        ...formData,
        status: 'Mantenimiento Realizado',
        name: formData.name === 'MANTENIMIENTO' ? 'MANTENIMIENTO REALIZADO' : formData.name
      };
      const updatedSlots = slots.map(s => ({ ...s, status: 'Mantenimiento Realizado' }));
      
      const eventData = {
        ...updatedFormData,
        id: id || undefined,
        groupId: events.find(ev => String(ev.id) === String(id))?.groupId || undefined,
        pax: formData.pax ? parseInt(formData.pax) : null,
        slots: updatedSlots,
        salon: updatedSlots.map(s => s.salon).join(', '),
        quote: existingEvent?.quote || undefined
      };

      const savedEvent = await handleAddEvent(eventData);

      if (id) {
        if (existingEvent) {
          await historyService.addDetailed(id, existingEvent, eventData);
        }
      } else {
        await historyService.add(savedEvent.id, 'Mantenimiento realizado y liberado');
      }

      showNotification('Mantenimiento liberado: salón disponible', 'success');
      setTimeout(() => navigate('/calendar'), 1000);
    } catch {
      showNotification('Error al liberar mantenimiento', 'error');
      setSaving(false);
    }
  };

  const handleStepClick = (statusKey) => {
    applyEventStatus(statusKey);
  };

  const handleCancelEventClick = () => {
    if (!id) {
      showNotification('Solo se pueden cancelar eventos existentes', 'error');
      return;
    }
    setConfirmConfig({
      isOpen: true,
      type: 'cancel',
      title: 'Cancelar Reserva',
      message: '¿Deseas cambiar el estado a "Cancelado"?',
      isDanger: true
    });
  };

  const executeCancelEvent = async () => {
    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    setSavingMsg('Cancelando evento...');
    setSaving(true);
    try {
      const existingEvent = id ? events.find(ev => String(ev.id) === String(id)) : null;
      await handleAddEvent({
        ...formData,
        id,
        status: 'Cancelado',
        slots: slots.map(slot => ({ ...slot, status: 'Cancelado' })),
        quote: existingEvent?.quote || undefined
      });
      showNotification('Evento cancelado');
      setTimeout(() => navigate('/calendar'), 1000);
    } catch {
      showNotification('Error al cancelar', 'error');
      setSaving(false);
    }
  };

  const onConfirmAction = () => {
    if (confirmConfig.type === 'cancel') {
      executeCancelEvent();
    }
  };

  const handleOpenAppointments = () => {
    if (!id) {
      showNotification('Guarda la reserva primero para agregar citas', 'error');
      return;
    }
    setShowAppointmentModal(true);
  };

  const handleOpenHistory = () => {
    if (!id) {
      showNotification('Guarda la reserva primero para ver el historial', 'error');
      return;
    }
    setShowHistoryModal(true);
  };

  const handleOpenQuote = () => {
    if (!id) {
      showNotification('Guarda la reserva primero para crear una cotización', 'error');
      return;
    }
    setShowQuoteModal(true);
  };

  const handleQuoteSave = async (quoteData, options = {}) => {
    setSavingMsg('Guardando cotización...');
    setSaving(true);
    try {
      const currentEvent = events.find(ev => String(ev.id) === String(id));
      const previousQuote = currentEvent?.quote || null;
      const quoteChanged = JSON.stringify(previousQuote || null) !== JSON.stringify(quoteData || null);
      const shouldFollowUp = previousQuote
        && quoteChanged
        && ['Reserva sin Cotizacion', '1er Cotizacion'].includes(currentEvent?.status);
      
      const updatedEvent = {
        ...currentEvent,
        quote: quoteData,
        status: shouldFollowUp
          ? 'Seguimiento'
          : currentEvent?.status === 'Reserva sin Cotizacion'
          ? '1er Cotizacion'
          : (currentEvent?.status || formData.status)
      };

      await handleAddEvent(updatedEvent);

      setFormData(prev => ({
        ...prev,
        quote: quoteData,
        status: updatedEvent.status
      }));

      showNotification(shouldFollowUp ? 'Cotizacion actualizada. Estado a Seguimiento.' : 'Cotizacion guardada');
      if (!options?.keepOpen) setShowQuoteModal(false);
    } catch {
      showNotification('Error al guardar cotizacion', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;

    const existingEvent = id ? events.find(ev => String(ev.id) === String(id)) : null;
    if (existingEvent && isEventSeriesInPast(events, id, pastEventEditGraceDays)) {
      const key = reservationKeyFromEvent(existingEvent);
      if (!pastEventEditAuthorizedKeys.has(key)) {
        showNotification("Evento de fecha pasada bloqueado. Solicita codigo de administrador.", "error");
        return;
      }
    }

    const validation = validateReservationRequiredFields();
    if (!validation.ok) {
      showNotification(`Completa: ${validation.issues[0]}${validation.issues.length > 1 ? ` (+${validation.issues.length - 1} pendientes)` : ''}`, 'error');
      return;
    }

    const conflictCheck = conflictService.checkAllSlots(slots, comparableEvents, id);
    const hasConflicts = conflictCheck.some(r => !r.ok);
    const hardConflicts = conflictCheck.filter(r => r.type === 'conflict' && !r.ok);
    
    if (hardConflicts.length > 0) {
      showNotification(`Conflicto: ${hardConflicts[0].message}`, 'error');
      setSlotConflicts(conflictCheck);
      return;
    }

    if (hasConflicts) {
      const warningMsg = conflictCheck.find(r => r.hint)?.hint || 'Hay conflictos de horario';
      setSlotConflicts(conflictCheck);
      showNotification(warningMsg, 'error');
      return;
    }

    setSavingMsg('Guardando reserva...');
    setSaving(true);
    try {
      const existingEvent = id ? events.find(ev => String(ev.id) === String(id)) : null;
      const existingSeries = id ? getSeriesForEvent(events, id) : [];
      const moveToFollowUp = id && shouldMoveEditedReservationToSeguimiento(existingEvent, existingSeries, formData, slots);
      const finalStatus = moveToFollowUp ? 'Seguimiento' : formData.status;
      const finalSlots = moveToFollowUp
        ? slots.map(slot => ({
          ...slot,
          status: ['Reserva sin Cotizacion', '1er Cotizacion'].includes(slot.status || existingEvent?.status)
            ? 'Seguimiento'
            : slot.status
        }))
        : slots;
      const eventData = {
        ...formData,
        status: finalStatus,
        id: id || undefined,
        groupId: existingEvent?.groupId || undefined,
        pax: formData.pax ? parseInt(formData.pax) : null,
        slots: finalSlots,
        salon: finalSlots.map(s => s.salon).join(', '),
        quote: formData.quote || existingEvent?.quote || undefined
      };

      const savedEvent = await handleAddEvent(eventData);

      if (id) {
        const existingEvent = events.find(ev => String(ev.id) === String(id));
        if (existingEvent) {
          await historyService.addDetailed(id, existingEvent, eventData);
        }
      } else {
        await historyService.add(savedEvent.id, 'Reserva creada');
      }

      showNotification(moveToFollowUp ? 'Cambios guardados. Estado a Seguimiento.' : (id ? 'Cambios guardados' : 'Reserva creada'));
      setTimeout(() => navigate('/calendar'), 1000);
    } catch {
      showNotification('Error al guardar', 'error');
      setSaving(false);
    }
  };

  const PIPELINE_STEPS = [
    { key: 'Reserva sin Cotizacion', label: 'Contacto Inicial' },
    { key: '1er Cotizacion', label: 'Cotizado' },
    { key: 'Seguimiento', label: 'Seguimiento' },
    { key: 'Pre reserva', label: 'Pre-Reserva' },
    { key: 'Confirmado', label: 'Confirmado' }
  ];

  const currentIdx = PIPELINE_STEPS.findIndex(s => s.key === formData.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minWidth: 0, background: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
      {/* Header bar with title and Cerrar button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 24px 0 24px',
        background: '#f8fafc'
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            {id ? 'Editar Reserva' : 'Nueva Reserva'}
          </h1>
          {id && (
            <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px', fontWeight: '600' }}>
              {slots[0]?.salon || 'Sin salón'} • {formData.date} • {slots[0]?.startTime || '10:00'} - {slots[0]?.endTime || '12:00'}
            </div>
          )}
        </div>
        
        <button
          onClick={() => navigate('/calendar')}
          onMouseEnter={() => setIsCloseHovered(true)}
          onMouseLeave={() => { setIsCloseHovered(false); setIsCloseActive(false); }}
          onMouseDown={() => setIsCloseActive(true)}
          onMouseUp={() => setIsCloseActive(false)}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            background: isCloseHovered ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
            color: isCloseHovered ? '#ef4444' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            padding: 0,
            boxShadow: 'none',
            outline: 'none',
            transform: isCloseActive ? 'scale(0.88)' : 'none',
          }}
          aria-label="Cerrar"
        >
          <svg
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            width="18"
            height="18"
            style={{
              transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: isCloseHovered ? 'rotate(90deg) scale(1.15)' : 'none',
              flexShrink: 0,
            }}
          >
            <path d="M4 4l10 10M14 4l-10 10" />
          </svg>
        </button>
      </div>

      <div className="form-stepper-card" style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '12px 16px 8px 16px',
              margin: '16px 24px 16px 24px',
              position: 'relative',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
            }}>
              {/* Línea de fondo del Stepper */}
              <div style={{
                position: 'absolute',
                top: '23px',
                left: '10%',
                right: '10%',
                height: '2px',
                background: '#f1f5f9',
                borderRadius: '1px',
                zIndex: 1
              }} />

              {/* Línea de progreso rellenada */}
              <div style={{
                position: 'absolute',
                top: '23px',
                left: '10%',
                width: `${currentIdx === 0 ? 0 : (currentIdx / (PIPELINE_STEPS.length - 1)) * 80}%`,
                height: '2px',
                background: 'linear-gradient(90deg, #00A3FF 0%, #00CC66 100%)',
                borderRadius: '1px',
                zIndex: 2,
                transition: 'all 0.4s ease-out'
              }} />

              {/* Nodos del Stepper */}
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 3 }}>
                {PIPELINE_STEPS.map((step, idx) => {
                  const isCompleted = idx < currentIdx;
                  const isActive = idx === currentIdx;
                  
                  // Definir estilos según el estado
                  let nodeBg = '#ffffff';
                  let nodeBorder = '2px solid #cbd5e1';
                  let nodeColor = '#94a3b8';
                  let nodeShadow = 'none';

                  if (isCompleted) {
                    nodeBg = '#00CC66';
                    nodeBorder = '2px solid #00CC66';
                    nodeColor = '#ffffff';
                    nodeShadow = '0 2px 6px rgba(0, 204, 102, 0.2)';
                  } else if (isActive) {
                    nodeBg = '#00A3FF';
                    nodeBorder = '3px solid #ffffff';
                    nodeColor = '#ffffff';
                    nodeShadow = '0 0 0 2px #00A3FF, 0 4px 8px rgba(0, 163, 255, 0.25)';
                  }

                  return (
                    <div
                      key={step.key}
                      onClick={() => handleStepClick(step.key)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer',
                        flex: 1
                      }}
                    >
                      {/* Círculo */}
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: nodeBg,
                        border: nodeBorder,
                        color: nodeColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: '900',
                        boxShadow: nodeShadow,
                        transition: 'all 0.3s ease',
                        transform: isActive ? 'scale(1.1)' : 'none'
                      }}>
                        {isCompleted ? '✓' : idx + 1}
                      </div>

                      {/* Etiqueta */}
                      <span style={{
                        marginTop: '6px',
                        fontSize: '10px',
                        fontWeight: '800',
                        color: isActive ? '#00A3FF' : isCompleted ? '#0f172a' : '#94a3b8',
                        transition: 'color 0.3s ease',
                        textAlign: 'center'
                      }}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
        <div className="form-scroll-wrapper" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '0 24px 24px 24px' }}>
          {validationErrors.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ color: '#dc2626', fontWeight: '700', marginBottom: '8px' }}>⚠️ Faltan datos por completar:</div>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#991b1b', fontSize: '13px' }}>
                {validationErrors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                {validationErrors.length > 5 && <li>...y {validationErrors.length - 5} más</li>}
              </ul>
            </div>
          )}
          <div className="reservation-form-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: '16px', alignItems: 'start' }}>
          {/* Columna Izquierda: Información de Reserva y Salones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
            <div className="form-main-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ ...labelStyle, fontSize: '13.5px', color: '#475569', fontWeight: '700' }}>Nombre del evento *</label>
                <input name="name" value={formData.name} onChange={handleChange} placeholder="Ej: Boda, Corporativo, Cena" style={{ ...inputStyle, fontSize: '15px', padding: '10px 14px' }} />
              </div>

              {(formData.status === '__hidden__') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '13.5px', color: '#475569', fontWeight: '700' }}>Nombre de quien reserva (Cliente)</label>
                    <input name="clientName" value={formData.clientName} onChange={handleChange} placeholder="Ej: Carlos Samalaj" style={{ ...inputStyle, padding: '8px 12px' }} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '13.5px', color: '#475569', fontWeight: '700' }}>Teléfono del Cliente</label>
                    <input name="clientPhone" value={formData.clientPhone} onChange={handleChange} placeholder="Ej: +502 5555-5555" style={{ ...inputStyle, padding: '8px 12px' }} />
                  </div>
                </div>
              )}

              {/* Sección de salones y horarios */}
              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#475569', marginBottom: '12px' }}>Salones y horarios</label>
                
                <button
                  onClick={addSlotRow}
                  style={{
                    background: '#005954',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    marginBottom: '16px',
                    transition: 'background-color 0.15s'
                  }}
                >
                  Agregar salon
                </button>

                {slotConflicts.length > 0 && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px', fontSize: '11px', marginBottom: '12px' }}>
                    <div style={{ fontWeight: '700', color: '#dc2626', marginBottom: '4px' }}>⚠️ Conflictos detectados:</div>
                    {slotConflicts.map((r, i) => (
                      <div key={i} style={{ color: '#991b1b', marginBottom: '2px' }}>
                        Salon {r.index + 1}: {r.message || r.hint}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ overflowX: 'auto', width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}>
                  <div style={{ minWidth: '720px' }}>
                    {/* Encabezado de la tabla */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1.5fr) minmax(45px, 0.5fr) minmax(105px, 1fr) minmax(105px, 1fr) minmax(80px, 0.8fr) minmax(100px, 0.9fr) minmax(120px, 1.2fr)', gap: '6px', padding: '8px 12px', background: '#eff6ff', borderBottom: '1px solid #cbd5e1' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e40af', letterSpacing: '0.5px' }}>SALÓN</span>
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e40af', letterSpacing: '0.5px' }}>PAX</span>
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e40af', letterSpacing: '0.5px' }}>DESDE</span>
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e40af', letterSpacing: '0.5px' }}>HASTA</span>
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e40af', letterSpacing: '0.5px' }}>INICIO</span>
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e40af', letterSpacing: '0.5px' }}>FIN</span>
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e40af', letterSpacing: '0.5px' }}>ESTADO</span>
                    </div>

                    {/* Contenido de la tabla con scroll vertical */}
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 0', gap: '6px', maxHeight: '220px', overflowY: 'auto', overflowX: 'hidden' }}>
                      {slots.map((slot, index) => (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1.5fr) minmax(45px, 0.5fr) minmax(105px, 1fr) minmax(105px, 1fr) minmax(80px, 0.8fr) minmax(100px, 0.9fr) minmax(120px, 1.2fr)', gap: '6px', alignItems: 'center', background: 'white', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                          <select value={slot.salon} onChange={e => handleSlotChange(index, 'salon', e.target.value)} style={{ ...inputStyle, padding: '6px 4px', fontSize: '12.5px' }}>
                            <option value="">Selecciona salon</option>
                            {salones?.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <input 
                            type="text" 
                            inputMode="numeric"
                            pattern="[0-9]*"
                            disabled={isMaintenanceStatus(slot.status || formData.status)}
                            value={isMaintenanceStatus(slot.status || formData.status) ? 'N/A' : slot.pax}
                            onChange={e => handleSlotChange(index, 'pax', e.target.value)} 
                            placeholder="PAX" 
                            style={{ 
                              ...inputStyle, 
                              padding: '6px 4px',
                              fontSize: '12.5px',
                              background: isMaintenanceStatus(slot.status || formData.status) ? '#f1f5f9' : 'white',
                              color: isMaintenanceStatus(slot.status || formData.status) ? '#94a3b8' : '#000',
                              textAlign: 'center'
                            }} 
                          />
                          <input type="date" value={slot.dateStart} onChange={e => handleSlotChange(index, 'dateStart', e.target.value)} style={{ ...inputStyle, padding: '6px 4px', fontSize: '12.5px' }} />
                          <input type="date" value={slot.dateEnd} onChange={e => handleSlotChange(index, 'dateEnd', e.target.value)} style={{ ...inputStyle, padding: '6px 4px', fontSize: '12.5px' }} />
                          <TimeSelect value={slot.startTime} onChange={val => handleSlotChange(index, 'startTime', val)} style={{ padding: '4px 2px', fontSize: '12.5px', height: '28px' }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', width: '100%' }}>
                            <TimeSelect value={slot.endTime} onChange={val => handleSlotChange(index, 'endTime', val)} style={{ padding: '4px 2px', fontSize: '12.5px', height: '28px' }} />
                            {slots.length > 1 && (
                              <button onClick={() => removeSlotRow(index)} style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: '14px', cursor: 'pointer', padding: '0 2px', fontWeight: 'bold' }}>×</button>
                            )}
                          </div>
                          <StatusSelectCustom
                            size="sm"
                            value={slot.status || formData.status}
                            onChange={val => handleSlotChange(index, 'status', val)}
                            options={isMaintenanceStatus(formData.status) ? STATUS_META_LIST.filter(s => isMaintenanceStatus(s.key)) : STATUS_META_LIST}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '12px', padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #bfdbfe' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#1e40af' }}>PAX TOTAL:</span>
                  <span style={{ fontSize: '16.5px', fontWeight: '900', color: '#1e40af' }}>{isMaintenanceStatus(formData.status) ? 'N/A' : (formData.pax || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Controles de Configuración */}
          <div className="reservation-side-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
            {/* Fecha inicial */}
            <div className="form-side-card" style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <label style={{ ...labelStyle, fontSize: '12px', color: '#475569', fontWeight: '700' }}>Fecha inicial *</label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} style={{ ...inputStyle, fontSize: '14px', padding: '10px' }} />
            </div>

            {/* Fecha final */}
            <div className="form-side-card" style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <label style={{ ...labelStyle, fontSize: '12px', color: '#475569', fontWeight: '700' }}>Fecha final *</label>
              <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} style={{ ...inputStyle, fontSize: '14px', padding: '10px' }} />
            </div>

            {/* Estado */}
            <div className="form-side-card" style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <label style={{ ...labelStyle, fontSize: '12px', color: '#475569', fontWeight: '700' }}>Estado *</label>
              {(() => {
                return (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <StatusSelectCustom
                       size="md"
                       value={formData.status}
                       onChange={(val) => applyEventStatus(val)}
                       options={STATUS_META_LIST}
                    />
                    {isMaintenanceStatus(formData.status) && (
                      <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                        En mantenimiento, cada salon solo puede quedar como Mantenimiento o Mantenimiento Realizado.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Usuario */}
            <div className="form-side-card" style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <label style={{ ...labelStyle, fontSize: '12px', color: '#475569', fontWeight: '700' }}>Usuario (quien bloquea) *</label>
              <select name="userId" value={formData.userId} onChange={handleChange} style={{ ...inputStyle, fontSize: '14px', padding: '10px', marginBottom: '8px' }}>
                <option value="">-- Sin Encargado --</option>
                {users?.map(u => (
                  <option key={u.id} value={u.id}>👤 {u.fullName || u.name}</option>
                ))}
              </select>

            </div>

            {/* Notas */}
            <div className="form-side-card" style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <label style={{ ...labelStyle, fontSize: '12px', color: '#475569', fontWeight: '700' }}>Notas</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Detalles u observaciones..." style={{ ...inputStyle, height: '70px', padding: '10px', resize: 'none' }} />
            </div>
          </div>
        </div>
      </div>


      <div className="reservation-form-footer" style={{ background: '#eff6ff', borderTop: '1px solid #bfdbfe', padding: '14px 24px', display: 'flex', alignItems: 'center', minHeight: '72px', gap: '12px', flexWrap: 'wrap' }}>
        {formData.status === 'Mantenimiento' ? (
          <button onClick={handleReleaseMaintenance} className="btn-mantenimiento">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
            Liberar
          </button>
        ) : (
          <button onClick={handleMaintenance} className="btn-mantenimiento">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            Mantenimiento
          </button>
        )}

        {id && (
          <button onClick={handleOpenAppointments} className="btn-agregar-cita">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="12" y1="14" x2="12" y2="18" />
              <line x1="10" y1="16" x2="14" y2="16" />
            </svg>
            + Cita
          </button>
        )}

        {id && (
          <button onClick={handleOpenQuote} className="btn-cotizar">
            <span style={{ marginRight: '5px', fontWeight: 'bold' }}>Q</span>
            Cotizar
          </button>
        )}

        {id && (
          <button onClick={handleOpenHistory} className="btn-historial">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Historial
          </button>
        )}

        {id && (
          <button onClick={handleCancelEventClick} className="btn-cancelar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            Cancelar
          </button>
        )}
        
        <button onClick={handleSave} disabled={saving} className="btn-guardar" style={{ marginLeft: 'auto' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Guardar
        </button>
      </div>

      <style>{`
        button:hover { filter: brightness(0.95); transform: translateY(-1px); }
        button:active { transform: translateY(0); }

        /* Overrides para superar el !important de design-system.css */
        .btn-mantenimiento {
          background: #ffffff !important;
          border: 1.5px solid #cbd5e1 !important;
          color: #475569 !important;
          padding: 8px 14px !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s ease !important;
        }
        .btn-mantenimiento:hover {
          background: #f8fafc !important;
          color: #1e293b !important;
          border-color: #94a3b8 !important;
        }

        .btn-historial {
          background: #ffffff !important;
          border: 1.5px solid #cbd5e1 !important;
          color: #475569 !important;
          padding: 8px 14px !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s ease !important;
        }
        .btn-historial:hover {
          background: #f8fafc !important;
          color: #1e293b !important;
          border-color: #94a3b8 !important;
        }

        .btn-agregar-cita {
          background: #ffffff !important;
          border: 1.5px solid #cbd5e1 !important;
          color: #475569 !important;
          padding: 8px 14px !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s ease !important;
        }
        .btn-agregar-cita:hover {
          background: #f8fafc !important;
          color: #1e293b !important;
          border-color: #94a3b8 !important;
        }

        .btn-cancelar {
          background: #ffffff !important;
          border: 1.5px solid #fecdd3 !important;
          color: #e11d48 !important;
          padding: 8px 14px !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s ease !important;
        }
        .btn-cancelar:hover {
          background: #fff1f2 !important;
          color: #be123c !important;
          border-color: #fda4af !important;
        }

        .btn-cotizar {
          background: #ffffff !important;
          border: 1.5px solid #bfdbfe !important;
          color: #2563eb !important;
          padding: 8px 14px !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s ease !important;
        }
        .btn-cotizar:hover {
          background: #eff6ff !important;
          color: #1d4ed8 !important;
          border-color: #93c5fd !important;
        }

        .btn-guardar {
          background: #005954 !important;
          border: 1.5px solid #005954 !important;
          color: white !important;
          padding: 10px 28px !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          font-size: 14px !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 4px 10px rgba(0, 89, 84, 0.2) !important;
          transition: all 0.2s ease !important;
        }
        .btn-guardar:hover {
          background: #004440 !important;
          border-color: #004440 !important;
          box-shadow: 0 6px 14px rgba(0, 89, 84, 0.3) !important;
        }

        @media (max-width: 1080px) {
          .reservation-form-grid {
            grid-template-columns: 1fr !important;
          }
          .reservation-side-panel {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          .reservation-side-panel {
            grid-template-columns: 1fr !important;
          }
          .form-stepper-card {
            margin: 8px 12px 12px 12px !important;
            padding: 10px 8px !important;
            border-radius: 8px !important;
            border-color: #e2e8f0 !important;
          }
          .form-scroll-wrapper {
            padding: 0 12px 12px 12px !important;
          }
          .form-main-card {
            padding: 12px !important;
            border-radius: 8px !important;
            border-color: #e2e8f0 !important;
          }
          .form-side-card {
            padding: 12px !important;
            border-radius: 8px !important;
            border-color: #e2e8f0 !important;
          }
          body:not(.informes-theme) #appShell.lum-calendar .reservation-form-footer {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            justify-content: flex-start !important;
            padding: 8px !important;
            min-height: auto !important;
            gap: 6px !important;
          }
          body:not(.informes-theme) #appShell.lum-calendar .reservation-form-footer > button {
            width: auto !important;
            height: 34px !important;
            padding: 4px 6px !important;
            font-size: 11px !important;
            border-radius: 8px !important;
            margin: 0 !important;
            flex: 1 1 calc(33.33% - 6px) !important;
            min-width: 80px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          body:not(.informes-theme) #appShell.lum-calendar .reservation-form-footer > button.btn-guardar {
            margin-left: 0 !important;
          }
        }
      `}</style>

      {showAppointmentModal && id && (
        <div id="appointmentBackdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}>
            <AppointmentModal eventId={id} eventName={formData.name} onClose={() => setShowAppointmentModal(false)} onSaved={refreshData} />
          </div>
        </div>
      )}

      {showHistoryModal && id && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowHistoryModal(false)}>
          <div onClick={e => e.stopPropagation()}>
            <HistoryPanel eventId={id} eventName={formData.name} onClose={() => setShowHistoryModal(false)} />
          </div>
        </div>
      )}

      {showQuoteModal && id && (urlOpenAdvances ? (
        <QuoteModal
          event={{
            ...(events.find(ev => String(ev.id) === String(id)) || { ...formData, id, slots }),
            quote: formData.quote || events.find(ev => String(ev.id) === String(id))?.quote || null
          }}
          eventData={formData}
          slots={slots}
          onClose={() => { setShowQuoteModal(false); }}
          onSave={handleQuoteSave}
          openAdvancesOnMount={true}
          inlineMode={true}
        />
      ) : createPortal(
        <div id="appShell" className="lum-calendar" style={{ position: 'absolute', zIndex: 9999999, top: 0, left: 0 }}>
          <QuoteModal
            event={{
              ...(events.find(ev => String(ev.id) === String(id)) || { ...formData, id, slots }),
              quote: formData.quote || events.find(ev => String(ev.id) === String(id))?.quote || null
            }}
            eventData={formData}
            slots={slots}
            onClose={() => setShowQuoteModal(false)}
            onSave={handleQuoteSave}
          />
        </div>,
        document.body
      ))}

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        isDanger={confirmConfig.isDanger}
        onConfirm={onConfirmAction}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {saving && createPortal(
        <LoadingSpinner mensaje={savingMsg} />,
        document.body
      )}
    </div>
  );
}

