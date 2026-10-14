import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { STATUS_META_LIST, STATUS_META, isAutoStatus } from '../constants';
import authService from '../../../services/authService';
import historyService from '../../../services/historyService';
import eventService from '../../../services/eventService';
import conflictService from '../../../services/conflictService';
import api from '../../../services/api';
import { loadState as loadCrmState } from '../../../services/stateService';
import { reservationKeyFromEvent, isEventSeriesInPast, getSeriesForEvent } from '../../../utils/eventSeriesInPast';
import AppointmentModal from './AppointmentModal';
import HistoryPanel from './HistoryPanel';
import QuoteModal from './QuoteModal';
import ConfirmModal from '../../../components/ConfirmModal';
import InformeTransferModal from './InformeTransferModal';
import { checkEventInformes, reassignInformeSlot } from '../../informes/services/api';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';
import TimeSelect from '../../../components/TimeSelect';
import LoadingSpinner from '../../../components/LoadingSpinner';
import './reservationMobile.css';
import './reservationBento.css';

const pastEventEditAuthorizedKeys = new Set();

async function requestPastEventEditAuthorization(ev) {
  const key = reservationKeyFromEvent(ev);
  if (!key) return false;
  if (pastEventEditAuthorizedKeys.has(key)) return true;

  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  await new Promise(resolve => setTimeout(resolve, 0));

  const root = document.getElementById('root');
  const prevRootAria = root ? root.getAttribute('aria-hidden') : null;
  if (root) root.removeAttribute('aria-hidden');

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
    target: document.querySelector('.reservation-modal-overlay') || document.body,
    didOpen: (popup) => {
      if (popup?.parentElement) popup.parentElement.style.zIndex = '9999999';
    }
  });

  if (root && prevRootAria !== null) root.setAttribute('aria-hidden', prevRootAria);

  if (!result.isConfirmed) return false;
  const code = String(result.value || "").trim();

  if (code !== "JDL-ADMIN-2026") {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    await new Promise(resolve => setTimeout(resolve, 0));

    const root2 = document.getElementById('root');
    const prevRootAria2 = root2 ? root2.getAttribute('aria-hidden') : null;
    if (root2) root2.removeAttribute('aria-hidden');

    await Swal.fire({
      icon: "error",
      title: "Codigo invalido",
      text: "No tienes autorizacion para editar eventos de fechas pasadas.",
      background: "#f8fbff",
      color: "#10243b",
      confirmButtonColor: "#2563eb",
      target: document.querySelector('.reservation-modal-overlay') || document.body,
      didOpen: (popup) => {
        if (popup?.parentElement) popup.parentElement.style.zIndex = '9999999';
      }
    });

    if (root2 && prevRootAria2 !== null) root2.setAttribute('aria-hidden', prevRootAria2);
    return false;
  }

  pastEventEditAuthorizedKeys.add(key);
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
  // Resolver el salon principal designado para esta serie:
  //   1) explicit mainSalon en cualquier item de la serie
  //   2) salon del item cuyo salon === mainSalon
  //   3) primer salon unico
  const explicitMainSalon = source.map((item) => String(item?.mainSalon || '').trim()).find(Boolean) || '';
  const allSalones = Array.from(new Set(source.map((ev) => String(ev?.salon || '').trim()).filter(Boolean)));
  const mainSalon = explicitMainSalon || allSalones[0] || '';
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
        status: ev.status || 'Reserva sin Cotizacion',
        isPrincipal: String(ev?.salon || '').trim() === mainSalon
      });
    } else {
      if (date && (!existing.dateStart || date < existing.dateStart)) existing.dateStart = date;
      if (date && (!existing.dateEnd || date > existing.dateEnd)) existing.dateEnd = date;
    }
  }
  const arr = Array.from(grouped.values());
  // Garantizar que exactamente un slot sea el principal
  if (!arr.some((s) => s.isPrincipal)) {
    if (arr.length) arr[0].isPrincipal = true;
  } else {
    let kept = false;
    for (const s of arr) {
      if (s.isPrincipal) {
        if (kept) s.isPrincipal = false;
        else kept = true;
      }
    }
  }
  return arr;
}

function normalizeReservationSnapshot({ formData = {}, slots = [] }) {
  const cleanedSlots = (slots || []).map(slot => ({
    salon: String(slot?.salon || '').trim(),
    pax: String(slot?.pax || '').trim(),
    dateStart: String(slot?.dateStart || '').trim(),
    dateEnd: String(slot?.dateEnd || '').trim(),
    startTime: String(slot?.startTime || '').trim(),
    endTime: String(slot?.endTime || '').trim(),
    status: String(slot?.status || '').trim(),
    isPrincipal: slot?.isPrincipal === true,
  })).sort((a, b) => (
    a.dateStart.localeCompare(b.dateStart)
    || a.salon.localeCompare(b.salon)
    || a.startTime.localeCompare(b.startTime)
    || a.endTime.localeCompare(b.endTime)
  ));

  return JSON.stringify({
    name: String(formData?.name || '').trim(),
    salon: String(formData?.salon || '').trim(),
    status: String(formData?.status || '').trim(),
    date: String(formData?.date || '').trim(),
    endDate: String(formData?.endDate || '').trim(),
    startTime: String(formData?.startTime || '').trim(),
    endTime: String(formData?.endTime || '').trim(),
    pax: String(formData?.pax || '').trim(),
    paxCompartido: (formData?.paxCompartido === 'principal' || formData?.paxCompartido === 2)
      ? 'principal'
      : (formData?.paxCompartido === true ? true : (formData?.paxCompartido === false ? false : null)),
    notes: String(formData?.notes || '').trim(),
    userId: String(formData?.userId || '').trim(),
    clientName: String(formData?.clientName || '').trim(),
    clientPhone: String(formData?.clientPhone || '').trim(),
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
    date: firstDate || existingEvent.eventDateStart || existingEvent.date || '',
    endDate: lastDate || existingEvent.eventDateEnd || existingEvent.endDate || existingEvent.date || '',
    pax: (existingEvent.paxCompartido === 2 || existingEvent.paxCompartido === 'principal' || existingEvent.pax_compartido === 2)
      ? (oldSlots.find(s => s.isPrincipal === true)?.pax || oldSlots.find(s => s.salon === existingEvent.mainSalon)?.pax || existingEvent.pax || '')
      : ((existingEvent.paxCompartido === true || existingEvent.paxCompartido === 1 || existingEvent.pax_compartido === 1)
        ? (oldSlots.find(s => Number(s.pax) > 0)?.pax || existingEvent.pax || '')
        : (oldSlots.reduce((acc, slot) => acc + Math.max(0, Number(slot?.pax || 0)), 0) || existingEvent.pax || '')),
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
          padding: isSm ? '4px 10px' : padding,
          background: disabled ? '#f1f5f9' : `${selectedOption?.color || '#cbd5e1'}14`,
          border: '1.5px solid',
          borderColor: disabled ? '#cbd5e1' : `${selectedOption?.color || '#cbd5e1'}55`,
          borderRadius: isSm ? '20px' : '9px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: disabled ? '#94a3b8' : (selectedOption?.color || '#0f172a'),
          fontWeight: '700'
        }}
      >
        <span style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: selectedOption?.color || '#cbd5e1',
          boxShadow: `0 0 0 2px white, 0 0 0 3px ${selectedOption?.color || '#cbd5e1'}80`
        }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption?.key}
        </span>
        <span style={{ opacity: 0.7, fontSize: isSm ? '9px' : '11px', color: selectedOption?.color || '#0f172a' }}>▼</span>
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
  const { events, salones, users, handleAddEvent, refreshData, salonConflictDisabled } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: paramId } = useParams();
  const [createdEventId, setCreatedEventId] = useState(null);
  const id = paramId || createdEventId;
  const [searchParams] = useSearchParams();

  const handleBack = useCallback(() => {
    const fromSearch = location.state?.from === 'search';
    navigate(fromSearch ? '/search' : '/calendar');
  }, [navigate, location]);

  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [slotConflicts, setSlotConflicts] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, type: null, message: '', title: '', isDanger: true });
  const [informeTransferModal, setInformeTransferModal] = useState({
    isOpen: false,
    affectedInformes: [],
    availableSlots: [],
    pendingSave: null,
  });
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const [isCloseActive, setIsCloseActive] = useState(false);

  const urlDate = searchParams.get('date');
  const urlEndDate = searchParams.get('endDate') || urlDate;
  const urlStart = searchParams.get('start');
  const urlEnd = searchParams.get('end');
  const urlSalon = searchParams.get('salon') || '';
  const urlOpenAdvances = searchParams.get('openAdvances') === 'true';
  const urlPv = searchParams.get('pv'); // id de posible venta a convertir en reserva

  const getDefaultDate = useCallback(() => urlDate || new Date().toISOString().split('T')[0], [urlDate]);
  const getDefaultEndDate = useCallback(() => urlEndDate || getDefaultDate(), [urlEndDate, getDefaultDate]);

  const getCurrentUserId = () => {
    const currentUser = authService.getCurrentUser();
    return currentUser?.id || '';
  };

  const [formData, setFormData] = useState(() => ({
    name: '',
    salon: urlSalon,
    status: 'Reserva sin Cotizacion',
    date: getDefaultDate(),
    endDate: getDefaultEndDate(),
    startTime: urlStart || '10:00',
    endTime: urlEnd || '12:00',
    pax: '',
    paxCompartido: null,
    notes: '',
    userId: getCurrentUserId(),
    quote: null,
    clientName: '',
    clientPhone: ''
  }));

  const [slots, setSlots] = useState(() => [
    { salon: urlSalon, pax: '', dateStart: getDefaultDate(), dateEnd: getDefaultEndDate(), startTime: urlStart || '10:00', endTime: urlEnd || '12:00', status: 'Reserva sin Cotizacion', isPrincipal: true }
  ]);

  const [saving, setSaving] = useState(false);

  const [salonCapacities, setSalonCapacities] = useState({});
  const [pastEventEditGraceDays, setPastEventEditGraceDays] = useState(null);
  const [pastEventCheckDone, setPastEventCheckDone] = useState(false);

  // Responsividad Móvil
  const [isMobileView, setIsMobileView] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDatePreset = (preset) => {
    if (!formData.date) return;
    const start = new Date(formData.date + 'T00:00:00');
    if (isNaN(start.getTime())) return;

    if (preset === 'same_day') {
      setFormData(prev => ({ ...prev, endDate: prev.date }));
      setSlots(prev => prev.map(s => ({ ...s, dateStart: formData.date, dateEnd: formData.date })));
    } else if (preset === 'weekend') {
      const end = new Date(start);
      end.setDate(end.getDate() + 2);
      const endStr = end.toISOString().slice(0, 10);
      setFormData(prev => ({ ...prev, endDate: endStr }));
      setSlots(prev => prev.map(s => ({ ...s, dateStart: formData.date, dateEnd: endStr })));
    } else if (preset === 'teardown') {
      const curEnd = formData.endDate ? new Date(formData.endDate + 'T00:00:00') : new Date(start);
      curEnd.setDate(curEnd.getDate() + 1);
      const endStr = curEnd.toISOString().slice(0, 10);
      setFormData(prev => ({ ...prev, endDate: endStr }));
    }
  };

  const getDurationHours = (start, end) => {
    if (!start || !end) return null;
    const [sh, sm] = String(start).split(':').map(Number);
    const [eh, em] = String(end).split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;
    let diffMin = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMin < 0) diffMin += 24 * 60;
    const hours = Math.round((diffMin / 60) * 10) / 10;
    return hours;
  };

  const getShiftLabel = (startTime) => {
    if (!startTime) return 'Turno General';
    const [h] = String(startTime).split(':').map(Number);
    if (isNaN(h)) return 'Turno General';
    if (h < 12) return 'Turno Matutino';
    if (h < 17) return 'Turno Vespertino';
    return 'Turno Vespertino / Nocturno';
  };

  // Datos de la posible venta a convertir (solo para reservas nuevas)
  const [pvLead, setPvLead] = useState(null);
  const pvAppliedRef = useRef(false);

  useEffect(() => {
    if (!urlPv || id) return;
    let active = true;
    api.get(`/api/posibles-ventas/${urlPv}`)
      .then((lead) => { if (active) setPvLead(lead || null); })
      .catch(() => { if (active) setPvLead(null); });
    return () => { active = false; };
  }, [urlPv, id]);

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

  const stateLoadedRef = useRef(false);
  const checkedEventIdRef = useRef(null);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const data = await loadCrmState();
        if (data?.salonCapacities) {
          setSalonCapacities(data.salonCapacities);
        }
        const graceDays = data?.pastEventEditGraceDays !== undefined ? Number(data.pastEventEditGraceDays) : 0;
        setPastEventEditGraceDays(graceDays);
        stateLoadedRef.current = true;
      } catch (err) {
        console.error("Error loading capacities:", err);
      }
    };
    fetchState();
  }, []);

  useEffect(() => {
    let active = true;
    const checkPastEvent = async () => {
      if (checkedEventIdRef.current === id) {
        if (active) setPastEventCheckDone(true);
        return;
      }
      setPastEventCheckDone(false);
      if (!stateLoadedRef.current) {
        if (active) setPastEventCheckDone(true);
        return;
      }
      if (id && events && events.length > 0) {
        const existingEvent = events.find(ev => String(ev.id) === String(id));
        if (existingEvent) {
          if (isEventSeriesInPast(events, id, pastEventEditGraceDays)) {
            const key = reservationKeyFromEvent(existingEvent);
            if (key && !pastEventEditAuthorizedKeys.has(key)) {
              const auth = await requestPastEventEditAuthorization(existingEvent);
              if (!auth && active) {
                navigate('/calendar');
                return;
              }
            }
          }
          if (active) {
            checkedEventIdRef.current = id;
          }
        }
      }
      if (active) setPastEventCheckDone(true);
    };
    checkPastEvent();
    return () => { active = false; };
  }, [id, events, navigate, pastEventEditGraceDays]);

  const comparableEvents = useMemo(() => {
    if (!id) return events || [];
    const current = events?.find(ev => String(ev.id) === String(id));
    const targetGroupId = String(current?.groupId || formData.groupId || id || '').trim();
    return (events || []).filter(ev => {
      const evId = String(ev.id || '').trim();
      const evGroupId = String(ev.groupId || '').trim();
      if (evId === String(id)) return false;
      if (targetGroupId && (evGroupId === targetGroupId || evId === targetGroupId)) return false;
      return true;
    });
  }, [events, id, formData.groupId]);

  useEffect(() => {
    if (!id && salones?.length > 0 && !formData.salon && slots?.[0]?.salon === '') {
      const newSlots = slots.map((s, i) => i === 0 ? { ...s, salon: salones[0] } : s);
      setSlots(newSlots);
      setFormData(prev => ({ ...prev, salon: salones[0] }));
    }
  }, [id, salones, formData.salon, slots]);

  useEffect(() => {
    if (events && slots.length > 0) {
      const conflicts = conflictService.checkAllSlots(slots, comparableEvents, id, salonConflictDisabled);
      setSlotConflicts(conflicts.filter(r => !r.ok));
    }
  }, [slots, events, id, comparableEvents, salonConflictDisabled]);


  const initialSnapshotRef = useRef('');
  const initializedIdRef = useRef(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Si ya se prellenó desde la posible venta, no volver a tocar el formulario:
    if (pvLead && pvAppliedRef.current) return;

    // Si es una reserva nueva (!id): solo inicializar UNA VEZ al montar el componente.
    // Nunca sobrescribir lo que el usuario está escribiendo cuando 'events' se recarga en background.
    if (!id) {
      // Si la URL pide convertir una posible venta pero aún no ha respondido la API, esperamos
      if (urlPv && !pvLead) {
        return;
      }

      if (isInitializedRef.current && !urlPv) return;
      isInitializedRef.current = true;
      let initialFData = {
        name: '',
        salon: salones?.length > 0 ? salones[0] : '',
        status: 'Reserva sin Cotizacion',
        date: getDefaultDate(),
        endDate: getDefaultEndDate(),
        startTime: urlStart || '10:00',
        endTime: urlEnd || '12:00',
        pax: '',
        paxCompartido: null,
        notes: '',
        userId: getCurrentUserId(),
        quote: null,
        clientName: '',
        clientPhone: ''
      };
      let initialSData = [{
        salon: salones?.length > 0 ? salones[0] : '',
        pax: '',
        dateStart: getDefaultDate(),
        dateEnd: getDefaultEndDate(),
        startTime: urlStart || '10:00',
        endTime: urlEnd || '12:00',
        status: 'Reserva sin Cotizacion',
        isPrincipal: true
      }];

      if (pvLead) {
        const leadDate = pvLead.fechaEvento || getDefaultDate();
        const leadSalon = Array.isArray(pvLead.salones) && pvLead.salones.length > 0
          ? pvLead.salones[0]
          : (salones?.length > 0 ? salones[0] : '');
        const serviciosText = Array.isArray(pvLead.servicios) && pvLead.servicios.length > 0
          ? `Servicios requeridos: ${pvLead.servicios.join(', ')}`
          : '';
        const notasTexto = [pvLead.notas || '', serviciosText].filter(Boolean).join('\n');

        initialFData = {
          name: pvLead.nombreCliente || pvLead.notas || '',
          salon: leadSalon,
          status: 'Reserva sin Cotizacion',
          date: leadDate,
          endDate: leadDate,
          startTime: urlStart || '10:00',
          endTime: urlEnd || '12:00',
          pax: pvLead.pax || '',
          paxCompartido: null,
          notes: notasTexto,
          userId: pvLead.vendedorId || getCurrentUserId(),
          quote: null,
          clientName: pvLead.nombreCliente || '',
          clientPhone: pvLead.telefono || ''
        };
        initialSData = [{
          salon: leadSalon,
          pax: pvLead.pax || '',
          dateStart: leadDate,
          dateEnd: leadDate,
          startTime: urlStart || '10:00',
          endTime: urlEnd || '12:00',
          status: 'Reserva sin Cotizacion',
          isPrincipal: true
        }];
        pvAppliedRef.current = true;
      }

      setFormData(initialFData);
      setSlots(initialSData);
      initialSnapshotRef.current = normalizeReservationSnapshot({ formData: initialFData, slots: initialSData });
      return;
    }

    // Si ya inicializamos este evento 'id', no volver a sobrescribir los datos
    if (initializedIdRef.current === id) return;

    if (events && events.length > 0) {
      const existingEvent = events.find(ev => String(ev.id) === String(id));
      if (existingEvent) {
        initializedIdRef.current = id;
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
        const isPrincipal = existingEvent.paxCompartido === 2 || existingEvent.paxCompartido === 'principal' || existingEvent.paxTipo === 'principal' || existingEvent.pax_compartido === 2;
        const isShared = !isPrincipal && (existingEvent.paxCompartido === true || existingEvent.paxCompartido === 1 || existingEvent.pax_compartido === 1);
        const paxModeValue = isPrincipal ? 'principal' : (isShared ? true : (existingEvent.paxCompartido === false || existingEvent.pax_compartido === 0 ? false : null));
        const totalPaxFromSlots = isPrincipal
          ? (seriesSlots.find(s => s.isPrincipal === true)?.pax || seriesSlots.find(s => s.salon === existingEvent.mainSalon)?.pax || existingEvent.pax || '')
          : (isShared
            ? (seriesSlots.find(s => Number(s.pax) > 0)?.pax || existingEvent.pax || '')
            : seriesSlots.reduce((acc, slot) => acc + Math.max(0, Number(slot?.pax || 0)), 0));

        const loadedFData = {
          name: existingEvent.name || '',
          salon: firstSlot.salon || existingEvent.salon || '',
          status: existingEvent.status || 'Reserva sin Cotizacion',
          date: firstDate || existingEvent.eventDateStart || existingEvent.date || getDefaultDate(),
          endDate: lastDate || existingEvent.eventDateEnd || existingEvent.date || getDefaultDate(),
          startTime: firstSlot.startTime || existingEvent.startTime || '10:00',
          endTime: firstSlot.endTime || existingEvent.endTime || '12:00',
          pax: totalPaxFromSlots || existingEvent.pax || '',
          paxCompartido: paxModeValue,
          notes: existingEvent.notes || '',
          userId: existingEvent.userId || '',
          quote: existingEvent.quote || null,
          clientName: existingEvent.clientName || '',
          clientPhone: existingEvent.clientPhone || ''
        };

        const loadedSData = seriesSlots.length > 0
          ? seriesSlots
          : [{
            salon: existingEvent.salon || (salones?.length > 0 ? salones[0] : ''),
            pax: existingEvent.pax || '',
            dateStart: existingEvent.date || getDefaultDate(),
            dateEnd: existingEvent.endDate || existingEvent.date || getDefaultDate(),
            startTime: existingEvent.startTime || '10:00',
            endTime: existingEvent.endTime || '12:00',
            status: existingEvent.status || 'Reserva sin Cotizacion',
            isPrincipal: true
          }];

        setFormData(loadedFData);
        setSlots(loadedSData);
        initialSnapshotRef.current = normalizeReservationSnapshot({ formData: loadedFData, slots: loadedSData });
        return;
      }
    }
  }, [id, events, salones, urlDate, urlEndDate, urlStart, urlEnd, getDefaultDate, getDefaultEndDate, pvLead]);

  const hasChanges = useMemo(() => {
    const current = normalizeReservationSnapshot({ formData, slots });
    return current !== initialSnapshotRef.current;
  }, [formData, slots]);

  useEffect(() => {
    if (urlOpenAdvances && id) {
      setShowQuoteModal(true);
    }
  }, [urlOpenAdvances, id]);

  const showNotification = (message, type = 'success') => {
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
    let total;
    if (formData.paxCompartido === 'principal' || formData.paxCompartido === 2) {
      const principalSlot = slots.find(s => s.isPrincipal === true) || slots[0];
      total = principalSlot ? Number(principalSlot.pax || 0) : Number(formData.pax || 0);
    } else if (formData.paxCompartido === true) {
      const firstWithVal = slots.find(s => Number(s.pax) > 0);
      total = firstWithVal ? Number(firstWithVal.pax) : Number(formData.pax || 0);
    } else {
      total = slots.reduce((acc, slot) => acc + Math.max(0, Number(slot?.pax || 0)), 0);
    }
    setFormData(prev => ({ ...prev, pax: total > 0 ? total : '' }));
    return total;
  }, [slots, formData.paxCompartido, formData.pax]);

  const addSlotRow = () => {
    const newSlot = {
      salon: salones?.length > 0 ? salones[0] : '',
      pax: formData.paxCompartido === true ? formData.pax : '',
      dateStart: formData.date,
      dateEnd: formData.endDate,
      startTime: '10:00',
      endTime: '12:00',
      status: formData.status,
      isPrincipal: false
    };
    setSlots([...slots, newSlot]);
  };

  const removeSlotRow = (index) => {
    if (slots.length <= 1) {
      showNotification('Debe existir al menos un bloque', 'error');
      return;
    }
    const wasPrincipal = slots[index]?.isPrincipal === true;
    const newSlots = slots.filter((_, i) => i !== index);
    // Si elimino el principal, promuevo el primero de los restantes
    if (wasPrincipal && newSlots.length) {
      newSlots[0] = { ...newSlots[0], isPrincipal: true };
    }
    setSlots(newSlots);
    syncEventPaxFromSlots();
    syncPrincipalFromSlots(newSlots);
  };

  /**
   * Designa el slot en `index` como el salon principal. El resto se desmarca.
   * Tambien sincroniza formData.salon/date/times con el slot principal para
   * que el resumen del evento coincida.
   */
  const setPrincipalSlot = (index) => {
    if (index < 0 || index >= slots.length) return;
    if (slots[index]?.isPrincipal === true) return;
    const newSlots = slots.map((s, i) => ({ ...s, isPrincipal: i === index }));
    setSlots(newSlots);
    syncPrincipalFromSlots(newSlots);
    if (formData.paxCompartido === 'principal' || formData.paxCompartido === 2) {
      const pPax = Number(newSlots[index]?.pax || 0);
      setFormData(prev => ({ ...prev, pax: pPax > 0 ? pPax : '' }));
    }
  };

  /**
   * Sincroniza formData.salon / date / endDate / startTime / endTime con el slot principal.
   * Se usa tras addSlotRow, removeSlotRow, setPrincipalSlot o cambios que afecten al principal.
   * Siempre recibe la lista actualizada como argumento para evitar stale closures.
   */
  const syncPrincipalFromSlots = (currentSlots) => {
    const list = currentSlots || slots;
    const principal = list.find((s) => s.isPrincipal === true) || list[0];
    if (!principal) return;
    const allStartDates = list.map(s => String(s.dateStart || '').trim()).filter(Boolean).sort();
    const allEndDates = list.map(s => String(s.dateEnd || s.dateStart || '').trim()).filter(Boolean).sort();
    const minStart = allStartDates[0];
    const maxEnd = allEndDates[allEndDates.length - 1];

    setFormData((prev) => ({
      ...prev,
      salon: principal.salon || prev.salon,
      date: minStart || prev.date,
      endDate: maxEnd || minStart || prev.endDate,
      startTime: principal.startTime || prev.startTime,
      endTime: principal.endTime || prev.endTime,
    }));
  };

  const handleSlotChange = (index, field, value) => {
    let val = value;
    if (field === 'pax') {
      val = value.replace(/\D/g, '');
    }
    let newSlots;
    if (field === 'pax' && formData.paxCompartido === true) {
      newSlots = slots.map(s => ({ ...s, pax: val }));
    } else {
      newSlots = slots.map((s, i) => i === index ? { ...s, [field]: val } : s);
    }
    setSlots(newSlots);
    if (field === 'pax') {
      if (formData.paxCompartido === true) {
        setFormData(prev => ({ ...prev, pax: val }));
      } else if (formData.paxCompartido === 'principal' || formData.paxCompartido === 2) {
        const principalSlot = newSlots.find(s => s.isPrincipal === true) || newSlots[0];
        const pPax = principalSlot ? Number(principalSlot.pax || 0) : 0;
        setFormData(prev => ({ ...prev, pax: pPax > 0 ? pPax : '' }));
      } else {
        const total = newSlots.reduce((acc, slot) => acc + Math.max(0, Number(slot?.pax || 0)), 0);
        setFormData(prev => ({ ...prev, pax: total > 0 ? total : '' }));
      }
    }
    if (field === 'salon' || field === 'startTime' || field === 'endTime' || field === 'dateStart' || field === 'dateEnd') {
      // Sincronizar formData con el slot marcado como principal (no solo con el index 0)
      const principal = newSlots.find((s) => s.isPrincipal === true) || newSlots[0];
      if (principal) {
        setFormData(prev => ({
          ...prev,
          startTime: principal.startTime || prev.startTime,
          endTime: principal.endTime || prev.endTime,
          salon: principal.salon || prev.salon,
          date: principal.dateStart || prev.date,
          endDate: principal.dateEnd || principal.dateStart || prev.endDate,
        }));
      }
    }
  };

  const applyEventStatus = (statusKey) => {
    if (formData.status === statusKey) return;
    const nextName = statusKey === 'Mantenimiento'
      ? 'MANTENIMIENTO'
      : statusKey === 'Mantenimiento Realizado' && formData.name === 'MANTENIMIENTO'
        ? 'MANTENIMIENTO REALIZADO'
        : formData.name;
    setFormData(prev => ({ ...prev, status: statusKey, name: nextName }));
    setSlots(prev => prev.map(slot => ({ ...slot, status: statusKey })));
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
      if (formData.paxCompartido === null) issues.push('Tipo PAX: selecciona Compartido, No Compartido o Salón Principal');
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
  }, [formData, slots, syncEventPaxFromSlots, id, salonCapacities]);

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
      id,
      salonConflictDisabled
    );
    const hardConflicts = conflictCheck.filter(r => r.type === 'conflict' && !r.ok);
    if (hardConflicts.length > 0) {
      showNotification(`Conflicto: ${hardConflicts[0].message}`, 'error');
      return;
    }

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
        mainSalon: updatedSlots.find((s) => s.isPrincipal === true)?.salon || updatedSlots[0]?.salon || formData.salon || '',
        salon: updatedSlots.find((s) => s.isPrincipal === true)?.salon || updatedSlots.map(s => s.salon).join(', '),
        quote: existingEvent?.quote || undefined
      };

      const savedEvent = await handleAddEvent(eventData);

      if (id && existingEvent) {
        await historyService.addDetailed(id, existingEvent, eventData);
      } else {
        await historyService.add(savedEvent.id, 'Mantenimiento programado');
      }

      showNotification('Mantenimiento guardado', 'success');
      setTimeout(handleBack, 1000);
    } catch {
      showNotification('Error al guardar mantenimiento', 'error');
      setSaving(false);
    }
  };

  const handleReleaseMaintenance = async () => {
    if (saving) return;
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
        mainSalon: updatedSlots.find((s) => s.isPrincipal === true)?.salon || updatedSlots[0]?.salon || formData.salon || '',
        salon: updatedSlots.find((s) => s.isPrincipal === true)?.salon || updatedSlots.map(s => s.salon).join(', '),
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
      setTimeout(handleBack, 1000);
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
      setTimeout(handleBack, 1000);
    } catch {
      showNotification('Error al cancelar', 'error');
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
    try {
      setSaving(true);
      const currentEvent = events.find(ev => String(ev.id) === String(id))
        || formData
        || { id, ...formData };
      const previousQuote = currentEvent?.quote || formData.quote || null;
      const quoteChanged = JSON.stringify(previousQuote || null) !== JSON.stringify(quoteData || null);
      const shouldFollowUp = previousQuote
        && quoteChanged
        && ['Reserva sin Cotizacion', '1er Cotizacion'].includes(currentEvent?.status);
      
      const newStatus = shouldFollowUp
        ? 'Seguimiento'
        : currentEvent?.status === 'Reserva sin Cotizacion'
        ? '1er Cotizacion'
        : (currentEvent?.status || formData.status);

      const updatedEvent = {
        ...formData,
        ...currentEvent,
        id: id || currentEvent.id,
        slots: Array.isArray(slots) && slots.length > 0 ? slots : currentEvent?.slots,
        quote: quoteData,
        status: newStatus
      };

      // Guardar con eventService.saveQuote (atómico rápido) o handleAddEvent para reservas nuevas
      if (typeof eventService?.saveQuote === 'function' && (id || currentEvent.id)) {
        const targetId = id || currentEvent.id;
        await eventService.saveQuote(targetId, quoteData, newStatus);
        if (typeof refreshData === 'function') {
          try { refreshData(true); } catch (_) {}
        }
      } else {
        await handleAddEvent(updatedEvent);
      }

      setFormData(prev => ({
        ...prev,
        quote: quoteData,
        status: updatedEvent.status
      }));

      if (quoteChanged) {
        const symbol = quoteData?.currency === 'USD' ? '$' : 'Q';
        const formattedTotal = `${symbol} ${Number(quoteData?.total || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        let logMsg = '';
        if (!previousQuote) {
          logMsg = `Cotización creada (Versión ${quoteData?.version || 1}) • Total: ${formattedTotal}`;
        } else {
          logMsg = `Cotización actualizada (Versión ${quoteData?.version || 1}) • Total: ${formattedTotal}`;
        }

        if (shouldFollowUp) {
          logMsg += ' • Estado cambiado a "Seguimiento"';
        } else if (currentEvent?.status === 'Reserva sin Cotizacion') {
          logMsg += ' • Estado cambiado a "1er Cotizacion"';
        }

        // Historial no bloqueante (desacoplado para evitar colisiones y deadlocks en MariaDB)
        historyService.add(id || currentEvent.id, logMsg).catch(histErr => {
          console.warn('[handleQuoteSave] Advertencia registrando en historial:', histErr);
        });
      }

      setSaving(false);
      showNotification(shouldFollowUp ? 'Cotizacion actualizada. Estado a Seguimiento.' : 'Cotizacion guardada');
      if (!options?.keepOpen) setShowQuoteModal(false);
    } catch (err) {
      showNotification('Error al guardar cotizacion', 'error');
      setSaving(false);
      throw err;
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

    const conflictCheck = conflictService.checkAllSlots(slots, comparableEvents, id, salonConflictDisabled);
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

    setSaving(true);
    const isNew = !id;

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
      // Garantizar que exactamente un slot sea el principal al guardar
      const cleanedSlots = (() => {
        const hasPrincipal = finalSlots.some((s) => s.isPrincipal === true);
        if (hasPrincipal) {
          let kept = false;
          return finalSlots.map((s) => {
            if (s.isPrincipal === true) {
              if (kept) return { ...s, isPrincipal: false };
              kept = true;
            }
            return s;
          });
        }
        return finalSlots.map((s, i) => i === 0 ? { ...s, isPrincipal: true } : { ...s, isPrincipal: false });
      })();
      const principalSlot = cleanedSlots.find((s) => s.isPrincipal === true) || cleanedSlots[0];
      const eventData = {
        ...formData,
        status: finalStatus,
        id: id || undefined,
        groupId: existingEvent?.groupId || undefined,
        pax: formData.pax ? parseInt(formData.pax) : null,
        paxCompartido: (formData.paxCompartido === 'principal' || formData.paxCompartido === 2)
          ? 'principal'
          : formData.paxCompartido,
        paxTipo: (formData.paxCompartido === 'principal' || formData.paxCompartido === 2)
          ? 'principal'
          : (formData.paxCompartido === true ? 'compartido' : 'no_compartido'),
        slots: cleanedSlots,
        mainSalon: principalSlot?.salon || formData.salon || '',
        salon: principalSlot?.salon || cleanedSlots.map(s => s.salon).join(', '),
        quote: formData.quote || existingEvent?.quote || undefined
      };

      // Si es una edición y existen informes activos, verificar granularmente si algún día/informe fue afectado
      if (id) {
        try {
          const infCheck = await checkEventInformes(id);
          if (infCheck?.hasInformes && Array.isArray(infCheck.informes) && infCheck.informes.length > 0) {
            const conflicts = [];
            for (const inf of infCheck.informes) {
              const days = Array.isArray(inf.dias) && inf.dias.length > 0
                ? inf.dias
                : [{
                    id: null,
                    fecha: existingEvent?.date ? String(existingEvent.date).slice(0, 10) : '',
                    salon: existingEvent?.salon || '',
                    menu_nombre: 'Menú programado',
                    horario: `${existingEvent?.startTime || ''} - ${existingEvent?.endTime || ''}`
                  }];

              for (const day of days) {
                // Si el día está vacío de contenido culinario y montajes, se limpiará automáticamente sin interrumpir
                if (day.isEmpty) continue;

                const dayDate = day.fecha;
                const daySalon = (day.salon || existingEvent?.salon || '').trim().toLowerCase();

                // Comprobar si algún slot nuevo tiene exactamente el mismo salón y cubre la fecha
                const matchingNewSlot = cleanedSlots.find(s => {
                  const sStart = String(s.dateStart || formData.date || '').slice(0, 10);
                  const sEnd = String(s.dateEnd || sStart).slice(0, 10);
                  const coversDate = dayDate ? (dayDate >= sStart && dayDate <= sEnd) : true;
                  const sameSalon = daySalon ? (String(s.salon || '').trim().toLowerCase() === daySalon) : true;
                  return coversDate && sameSalon;
                });

                if (!matchingNewSlot) {
                  conflicts.push({
                    informeId: inf.id,
                    diaId: day.id,
                    fecha: dayDate,
                    salon: day.salon || existingEvent?.salon || 'No especificado',
                    menuNombre: day.menu_nombre || 'Servicio programado',
                    horario: day.horario || '',
                    version: inf.version || 1
                  });
                }
              }
            }

            if (conflicts.length > 0) {
              setInformeTransferModal({
                isOpen: true,
                conflicts,
                affectedInformes: conflicts,
                availableSlots: cleanedSlots,
                pendingSave: { eventData, cleanedSlots, moveToFollowUp, isNew }
              });
              setSaving(false);
              return;
            }
          }
        } catch (checkErr) {
          console.warn('[checkEventInformes error]', checkErr);
        }
      }

      await executeSaveReservation(eventData, cleanedSlots, moveToFollowUp, isNew);
    } catch (err) {
      console.error('[handleSave] Error crítico al guardar:', err);
      showNotification(`Error al guardar: ${err?.message || 'Error del servidor'}`, 'error');
      setSaving(false);
    }
  };

  const executeSaveReservation = async (eventData, cleanedSlots, moveToFollowUp, isNew, resolutionsToApply = null) => {
    setSaving(true);
    try {
      // Formatear resoluciones si vienen en formato lista o mapa
      let formattedResolutions = undefined;
      if (Array.isArray(resolutionsToApply)) {
        formattedResolutions = resolutionsToApply;
      } else if (resolutionsToApply && typeof resolutionsToApply === 'object') {
        formattedResolutions = Object.entries(resolutionsToApply).map(([infId, slotIdxStr]) => {
          const slotIdx = Number(slotIdxStr);
          const targetSlot = cleanedSlots[slotIdx];
          return {
            informeId: Number(infId),
            action: slotIdxStr === 'none' ? 'archive' : 'reassign',
            targetSlotId: targetSlot?.id || id,
            targetSalon: targetSlot?.salon || '',
            targetFecha: targetSlot?.dateStart || null,
            targetHorario: targetSlot ? `${targetSlot.startTime || '10:00'} - ${targetSlot.endTime || '12:00'}` : null
          };
        });
      }

      const payload = {
        ...eventData,
        informeResolutions: formattedResolutions
      };

      const savedEvent = await handleAddEvent(payload);
      const newId = savedEvent?.id || id;

      // Actualizar estado local del formulario de inmediato
      if (newId) {
        initializedIdRef.current = newId;
        setCreatedEventId(newId);
        try {
          window.history.replaceState(null, '', `/reserva/${newId}`);
        } catch (navErr) {
          console.warn('[Reserva] Navegación silenciada (bloqueo por extensión de navegador):', navErr);
        }
      }

      const nextFormData = { ...formData, ...eventData, id: newId };
      initialSnapshotRef.current = normalizeReservationSnapshot({ formData: nextFormData, slots: cleanedSlots });
      setFormData(nextFormData);
      setSlots(cleanedSlots);
      setSaving(false);

      // Notificación de éxito asegurada
      showNotification(moveToFollowUp ? 'Cambios guardados. Estado a Seguimiento.' : (isNew ? 'Reserva creada' : 'Cambios guardados'), 'success');

      // Tareas secundarias en segundo plano (completamente aisladas)
      try {
        if (id) {
          const prevEvent = events.find(ev => String(ev.id) === String(id));
          if (prevEvent) historyService.addDetailed(id, prevEvent, eventData).catch(() => {});
        } else if (newId) {
          const leadToLink = urlPv || pvLead?.id;
          if (leadToLink) {
            const clienteInfo = pvLead?.nombreCliente ? ` (${pvLead.nombreCliente})` : '';
            historyService.add(newId, `Reserva creada desde evento asignado #${leadToLink}${clienteInfo}`).catch(() => {});
            api.patch(`/api/posibles-ventas/${leadToLink}`, { eventoId: newId }).catch(() => {});
          } else {
            historyService.add(newId, 'Reserva creada directamente desde el calendario').catch(() => {});
          }
        }
      } catch {}

    } catch (err) {
      // Bloqueo HTTP 409 Conflict: backend detectó informes desfasados no resueltos
      if (err?.status === 409 || err?.responseBody?.conflict) {
        const body = err.responseBody || {};
        const backendConflicts = body.conflicts || [];
        setInformeTransferModal({
          isOpen: true,
          conflicts: backendConflicts,
          affectedInformes: backendConflicts,
          availableSlots: body.availableSlots || cleanedSlots,
          pendingSave: { eventData, cleanedSlots, moveToFollowUp, isNew }
        });
        setSaving(false);
        showNotification(err.message || 'Se requiere resolver el destino de los informes activos.', 'warning');
        return;
      }

      console.error('[handleSave] Error crítico al guardar:', err);
      showNotification(`Error al guardar: ${err?.message || 'Error del servidor'}`, 'error');
      setSaving(false);
    }
  };

  const handleConfirmInformeTransfer = async (resolutionsList) => {
    if (!informeTransferModal.pendingSave) return;
    const { eventData, cleanedSlots, moveToFollowUp, isNew } = informeTransferModal.pendingSave;
    setInformeTransferModal(prev => ({ ...prev, isOpen: false }));
    await executeSaveReservation(eventData, cleanedSlots, moveToFollowUp, isNew, resolutionsList);
  };

  const handleProceedWithoutInformeTransfer = async () => {
    if (!informeTransferModal.pendingSave) return;
    const { eventData, cleanedSlots, moveToFollowUp, isNew } = informeTransferModal.pendingSave;
    const conflicts = informeTransferModal.conflicts || [];
    // Descartar y eliminar limpiamente de la tabla de días únicamente los días huérfanos que el usuario decidió no transferir
    const discardResolutions = conflicts.map(c => ({
      informeId: c.informeId,
      diaId: c.diaId,
      action: 'delete_day'
    }));
    setInformeTransferModal(prev => ({ ...prev, isOpen: false }));
    await executeSaveReservation(eventData, cleanedSlots, moveToFollowUp, isNew, discardResolutions);
  };

  const PIPELINE_STEPS = [
    { key: 'Reserva sin Cotizacion', label: '1. Contacto', stageNumber: 1, stageName: 'ETAPA 1' },
    { key: '1er Cotizacion', label: '2. Cotizado', stageNumber: 2, stageName: 'ETAPA 2' },
    { key: 'Seguimiento', label: '3. Seguimiento', stageNumber: 3, stageName: 'ETAPA 3' },
    { key: 'Pre reserva', label: '4. Pre-Reserva', stageNumber: 4, stageName: 'ETAPA 4' },
    { key: 'Confirmado', label: '5. Confirmado', stageNumber: 5, stageName: 'ETAPA 5' }
  ];

  const currentIdx = PIPELINE_STEPS.findIndex(s => s.key === formData.status);

  const assignedUser = useMemo(() => {
    return (users || []).find(u => String(u.id) === String(formData.userId)) || null;
  }, [users, formData.userId]);

  const getUserInitials = (name) => {
    if (!name) return 'SE';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const calculatedJornadas = useMemo(() => {
    if (!formData.date) return 1;
    const end = formData.endDate || formData.date;
    const d1 = new Date(formData.date + 'T00:00:00');
    const d2 = new Date(end + 'T00:00:00');
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, isNaN(diff) ? 1 : diff);
  }, [formData.date, formData.endDate]);

  const principalSlot = useMemo(() => {
    return slots.find(s => s.isPrincipal === true) || slots[0] || null;
  }, [slots]);

  const sumaPaxSalones = useMemo(() => {
    return slots.reduce((acc, slot) => acc + Math.max(0, Number(slot?.pax || 0)), 0);
  }, [slots]);

  const formattedHeaderDate = useMemo(() => {
    if (!formData.date) return 'Sin fecha';
    const parts = String(formData.date).split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return formData.date;
  }, [formData.date]);

  const handleConfirmAllSlots = () => {
    setSlots(prev => prev.map(s => ({ ...s, status: 'Confirmado' })));
    setFormData(prev => ({ ...prev, status: 'Confirmado' }));
    toast.success('Todos los salones cambiados a Confirmado');
  };

  const renderStageIcon = (stageNumber) => {
    switch (stageNumber) {
      case 1:
        // Etapa 1: Contacto (usuarios)
        return (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case 2:
        // Etapa 2: Cotizado (edificio / cotización)
        return (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <line x1="9" y1="22" x2="9" y2="18" />
            <line x1="15" y1="22" x2="15" y2="18" />
            <line x1="18" y1="18" x2="6" y2="18" />
            <line x1="8" y1="6" x2="8.01" y2="6" />
            <line x1="16" y1="6" x2="16.01" y2="6" />
            <line x1="12" y1="6" x2="12.01" y2="6" />
            <line x1="8" y1="10" x2="8.01" y2="10" />
            <line x1="12" y1="10" x2="12.01" y2="10" />
            <line x1="16" y1="10" x2="16.01" y2="10" />
          </svg>
        );
      case 3:
        // Etapa 3: Seguimiento (chat / mensaje)
        return (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        );
      case 4:
        // Etapa 4: Pre-Reserva (reloj)
        return (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      case 5:
      default:
        // Etapa 5: Confirmado (check ✓)
        return (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
    }
  };

  if (!pastEventCheckDone) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', background: '#f8fafc' }}>
        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Verificando...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minWidth: 0, background: isMobileView ? '#f8fafc' : 'transparent', position: 'relative', overflow: isMobileView ? 'hidden' : 'visible' }}>
      {saving && <LoadingSpinner mensaje={!id && !createdEventId ? "Creando reserva..." : "Guardando cambios..."} />}

      {isMobileView ? (
        <div className="res-mobile-root">
          {/* 1. Header */}
          <header className="res-mobile-header">
            <div className="res-mobile-header-left">
              <button
                type="button"
                className="res-mobile-btn-close"
                onClick={handleBack}
                aria-label="Cerrar"
                title="Cerrar"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div className="res-mobile-title-block">
                <span className="res-mobile-brand-tag">
                  {slots[0]?.salon || 'TRES VOLCANES'}
                </span>
                <h1 className="res-mobile-main-title">
                  {id ? 'Editar Reserva' : 'Nueva Reserva'}
                </h1>
              </div>
            </div>

            <div className="res-mobile-header-actions">
              {id && (
                <button
                  type="button"
                  className="res-mobile-header-icon-btn"
                  onClick={handleOpenHistory}
                  title="Historial de cambios"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </button>
              )}
              {id && (
                <button
                  type="button"
                  className="res-mobile-header-icon-btn"
                  onClick={handleOpenAppointments}
                  title="Agendar Cita / Visita Técnica"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>
              )}
            </div>
          </header>

          {/* 2. Scrollable Body */}
          <div className="res-mobile-scroll-body">
            {/* Validation errors alert */}
            {validationErrors.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px', fontSize: '12px' }}>
                <div style={{ color: '#dc2626', fontWeight: '800', marginBottom: '4px' }}>⚠️ Faltan datos por completar:</div>
                <ul style={{ margin: 0, paddingLeft: '18px', color: '#991b1b', lineHeight: 1.4 }}>
                  {validationErrors.slice(0, 4).map((err, i) => <li key={i}>{err}</li>)}
                  {validationErrors.length > 4 && <li>...y {validationErrors.length - 4} más</li>}
                </ul>
              </div>
            )}

            {/* A. Hero Event Card */}
            <div className="res-mobile-hero-card">
              <div className="res-mobile-hero-top-row">
                <div className="res-mobile-hero-badges">
                  <span
                    className="res-mobile-status-pill"
                    style={{
                      color: STATUS_META[formData.status]?.color || '#0f4c81',
                      background: `${STATUS_META[formData.status]?.color || '#0f4c81'}14`,
                      borderColor: `${STATUS_META[formData.status]?.color || '#0f4c81'}30`
                    }}
                  >
                    <span className="dot" />
                    {formData.status}
                  </span>
                  <span className="res-mobile-id-pill">
                    ID #{id ? String(id).slice(-8).toUpperCase() : 'NUEVA'}
                  </span>
                </div>
                <div className="res-mobile-type-icon-badge" title="Tipo de evento">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0f4c81" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
                  </svg>
                </div>
              </div>

              {/* Event Title input */}
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Nombre del evento (ej. Boda Cabrera Szejner) *"
                className="res-mobile-hero-title-input"
              />

              {/* Client Name & Phone if present */}
              {(formData.clientName || formData.clientPhone) && (
                <div className="res-mobile-hero-meta-row" style={{ color: '#475569', fontSize: 12 }}>
                  {formData.clientName && (
                    <span className="res-mobile-hero-meta-item">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      {formData.clientName}
                    </span>
                  )}
                  {formData.clientPhone && (
                    <span className="res-mobile-hero-meta-item">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      {formData.clientPhone}
                    </span>
                  )}
                </div>
              )}

              {/* Metadata row */}
              <div className="res-mobile-hero-meta-row">
                <span className="res-mobile-hero-meta-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  {slots[0]?.salon || 'Sin salón asignado'}
                </span>
                <span>•</span>
                <span className="res-mobile-hero-meta-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {formData.date || 'Sin fecha'}
                </span>
                <span>•</span>
                <span className="res-mobile-hero-meta-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {slots[0]?.startTime || formData.startTime || '10:00'} - {slots[0]?.endTime || formData.endTime || '12:00'} hrs
                </span>
              </div>

              {/* Seller / Encargado chip bar */}
              <div className="res-mobile-hero-seller-bar">
                <div className="res-mobile-seller-chip">
                  <span className="res-mobile-seller-label-wrap">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Vendedor:
                  </span>
                  <select
                    name="userId"
                    value={formData.userId}
                    onChange={handleChange}
                    className="res-mobile-seller-select"
                  >
                    <option value="">-- Sin Encargado --</option>
                    {users?.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName || u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* B. Stepper del Proceso */}
            <div className="res-mobile-stepper-card">
              <div className="res-mobile-stepper-header">
                <span className="res-mobile-stepper-label">Etapa del Proceso</span>
                <span className="res-mobile-stepper-count">
                  Paso {currentIdx + 1} de {PIPELINE_STEPS.length}
                </span>
              </div>

              <div className="res-mobile-stepper-track">
                <div className="res-mobile-stepper-line-bg" />
                <div
                  className="res-mobile-stepper-line-fill"
                  style={{
                    width: `${currentIdx === 0 ? 0 : (currentIdx / (PIPELINE_STEPS.length - 1)) * 80}%`
                  }}
                />

                {PIPELINE_STEPS.map((step, idx) => {
                  const isCompleted = idx < currentIdx;
                  const isActive = idx === currentIdx;
                  return (
                    <div
                      key={step.key}
                      onClick={() => handleStepClick(step.key)}
                      className={`res-mobile-stepper-step ${isCompleted ? 'is-completed' : ''} ${isActive ? 'is-active' : ''}`}
                    >
                      <div className="res-mobile-step-node">
                        {isCompleted ? '✓' : idx + 1}
                      </div>
                      <span className="res-mobile-step-text">
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* C. Salones y Horarios */}
            <div className="res-mobile-section-header">
              <span className="res-mobile-section-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f4c81" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                  <line x1="9" y1="22" x2="9" y2="2"/>
                  <line x1="15" y1="22" x2="15" y2="2"/>
                  <line x1="4" y1="12" x2="20" y2="12"/>
                </svg>
                Salones y Horarios
              </span>
              <button
                type="button"
                className="res-mobile-btn-add-salon"
                onClick={addSlotRow}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Agregar Salón
              </button>
            </div>

            {slotConflicts.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px', fontSize: '11.5px' }}>
                <div style={{ fontWeight: '800', color: '#dc2626', marginBottom: '4px' }}>⚠️ Conflictos de salón detectados:</div>
                {slotConflicts.map((r, i) => (
                  <div key={i} style={{ color: '#991b1b', marginBottom: '2px' }}>
                    Salón {r.index + 1}: {r.message || r.hint}
                  </div>
                ))}
              </div>
            )}

            {/* Tarjetas de Salón */}
            {slots.map((slot, index) => {
              const isPrincipal = slot.isPrincipal === true;
              const durationHours = getDurationHours(slot.startTime, slot.endTime);
              const shiftLabel = getShiftLabel(slot.startTime);

              return (
                <div
                  key={index}
                  className={`res-mobile-salon-card ${isPrincipal ? 'is-principal' : ''}`}
                >
                  <div className="res-mobile-salon-card-header">
                    <div className="res-mobile-salon-card-left">
                      <button
                        type="button"
                        onClick={() => setPrincipalSlot(index)}
                        className={`res-mobile-btn-star ${isPrincipal ? 'is-active' : ''}`}
                        title={isPrincipal ? 'Salón principal asignado' : 'Marcar como salón principal'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={isPrincipal ? '#d97706' : 'none'} stroke={isPrincipal ? '#d97706' : '#94a3b8'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                      <select
                        value={slot.salon}
                        onChange={e => handleSlotChange(index, 'salon', e.target.value)}
                        className="res-mobile-salon-select"
                      >
                        <option value="">Seleccionar salón</option>
                        {salones?.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    {slots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSlotRow(index)}
                        className="res-mobile-btn-delete-slot"
                        title="Eliminar salón"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>

                  {/* Cuadrícula 2x2 táctil */}
                  <div className="res-mobile-salon-grid-2x2">
                    <div className="res-mobile-field-cell">
                      <span className="res-mobile-field-cell-label">Invitados (PAX)</span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <input
                          type="number"
                          inputMode="numeric"
                          disabled={isMaintenanceStatus(slot.status || formData.status)}
                          value={isMaintenanceStatus(slot.status || formData.status) ? '' : slot.pax}
                          onChange={e => handleSlotChange(index, 'pax', e.target.value)}
                          placeholder="150"
                          className="res-mobile-field-cell-input"
                        />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>pers.</span>
                      </div>
                    </div>

                    <div className="res-mobile-field-cell">
                      <span className="res-mobile-field-cell-label">Horario Bloqueado</span>
                      <div className="res-mobile-time-range-row">
                        <input
                          type="time"
                          value={slot.startTime || '10:00'}
                          onChange={e => handleSlotChange(index, 'startTime', e.target.value)}
                          className="res-mobile-time-native-input"
                          title="Hora de inicio"
                        />
                        <span className="res-mobile-time-sep">–</span>
                        <input
                          type="time"
                          value={slot.endTime || '12:00'}
                          onChange={e => handleSlotChange(index, 'endTime', e.target.value)}
                          className="res-mobile-time-native-input"
                          title="Hora de finalización"
                        />
                      </div>
                    </div>

                    <div className="res-mobile-field-cell">
                      <span className="res-mobile-field-cell-label">Desde</span>
                      <input
                        type="date"
                        value={slot.dateStart}
                        onChange={e => handleSlotChange(index, 'dateStart', e.target.value)}
                        className="res-mobile-field-cell-input"
                      />
                    </div>

                    <div className="res-mobile-field-cell">
                      <span className="res-mobile-field-cell-label">Hasta</span>
                      <input
                        type="date"
                        value={slot.dateEnd}
                        onChange={e => handleSlotChange(index, 'dateEnd', e.target.value)}
                        className="res-mobile-field-cell-input"
                      />
                    </div>
                  </div>

                  {/* Footer del salón: Horas + Turno */}
                  <div className="res-mobile-salon-footer-row">
                    <span className="res-mobile-salon-footer-item">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0f4c81" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {durationHours ? `${durationHours} Horas contratadas` : 'Horario asignado'}
                    </span>
                    <span className="res-mobile-turn-pill">{shiftLabel}</span>
                  </div>
                </div>
              );
            })}

            {/* D. Configuración de Capacidad (PAX) */}
            <div className="res-mobile-pax-card">
              <div className="res-mobile-pax-top-row">
                <div className="res-mobile-pax-count-block">
                  <span className="res-mobile-pax-label">Configuración de Capacidad</span>
                  <div className="res-mobile-pax-number">
                    {isMaintenanceStatus(formData.status) ? 'N/A' : (formData.pax || 0)}
                    <span>PAX Total Acumulado</span>
                  </div>
                </div>
                <div className="res-mobile-pax-icon-wrap">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
              </div>

              {/* Conmutador segmentado */}
              <div className="res-mobile-pax-toggle-bar">
                <button
                  type="button"
                  className={`res-mobile-pax-toggle-btn ${formData.paxCompartido === true ? 'is-active-shared' : ''}`}
                  onClick={() => {
                    const defaultPax = slots.find(s => Number(s.pax) > 0)?.pax || formData.pax || '';
                    setFormData(prev => ({ ...prev, paxCompartido: true, pax: defaultPax }));
                    setSlots(prev => prev.map(s => ({ ...s, pax: defaultPax })));
                  }}
                >
                  {formData.paxCompartido === true && '✓ '}
                  Compartido
                </button>
                <button
                  type="button"
                  className={`res-mobile-pax-toggle-btn ${formData.paxCompartido === false ? 'is-active-individual' : ''}`}
                  onClick={() => {
                    const total = slots.reduce((acc, slot) => acc + Math.max(0, Number(slot?.pax || 0)), 0);
                    setFormData(prev => ({ ...prev, paxCompartido: false, pax: total > 0 ? total : '' }));
                  }}
                >
                  {formData.paxCompartido === false && '✓ '}
                  No Compartido
                </button>
                <button
                  type="button"
                  className={`res-mobile-pax-toggle-btn ${formData.paxCompartido === 'principal' ? 'is-active-principal' : ''}`}
                  style={formData.paxCompartido === 'principal' ? { background: '#d97706', color: 'white', borderColor: '#b45309' } : {}}
                  onClick={() => {
                    const principalSlot = slots.find(s => s.isPrincipal === true) || slots[0];
                    const principalPax = principalSlot ? (Number(principalSlot.pax) > 0 ? principalSlot.pax : '') : (formData.pax || '');
                    setFormData(prev => ({ ...prev, paxCompartido: 'principal', pax: principalPax }));
                  }}
                >
                  {formData.paxCompartido === 'principal' ? '⭐ ' : ''}
                  Salón Principal
                </button>
              </div>

              {/* Callout explicativo */}
              <div className="res-mobile-pax-info-callout">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div>
                  <strong>{formData.paxCompartido === 'principal' ? 'Modo Salón Principal' : (formData.paxCompartido === false ? 'Modo No Compartido' : 'Modo Compartido')}: </strong>
                  {formData.paxCompartido === 'principal'
                    ? 'Cada salón asignado cuenta con su propio cupo independiente. El PAX total del evento y reportes se toma únicamente del salón principal (⭐).'
                    : (formData.paxCompartido === false
                      ? 'Cada salón asignado cuenta con su propio cupo de comensales y se suman para el total del evento.'
                      : `El cupo de ${formData.pax || 'comensales'} aplica a todos los salones asignados al evento y unifica la cotización del banquete.`)}
                </div>
              </div>
            </div>

            {/* E. Vigencia y Límites de la Reserva */}
            <div className="res-mobile-vigencia-card">
              <span className="res-mobile-section-title" style={{ fontSize: 13, marginBottom: 2 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f4c81" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                  <path d="m9 16 2 2 4-4"/>
                </svg>
                Vigencia y Límites de la Reserva
              </span>

              <div className="res-mobile-date-input-wrap">
                <span className="res-mobile-date-input-label">Fecha Inicial del Evento *</span>
                <div className="res-mobile-date-input-box">
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="res-mobile-date-native-input"
                  />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, pointerEvents: 'none' }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
              </div>

              <div className="res-mobile-date-input-wrap">
                <span className="res-mobile-date-input-label">Fecha Final del Evento *</span>
                <div className="res-mobile-date-input-box">
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                    className="res-mobile-date-native-input"
                  />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, pointerEvents: 'none' }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* F. Notas y Requerimientos */}
            <div className="res-mobile-notes-card">
              <div className="res-mobile-notes-header">
                <span className="res-mobile-section-title" style={{ fontSize: 13 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f4c81" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  Notas y Requerimientos
                </span>
                <span className="res-mobile-private-tag">Privado interno</span>
              </div>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Requieren montaje, requerimientos especiales, pruebas de degustación..."
                className="res-mobile-notes-textarea"
              />
              <div className="res-mobile-notes-footer">
                <span className="res-mobile-notes-auto-save">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                    <polyline points="9 15 12 18 15 15"/>
                  </svg>
                  Autoguardado interno
                </span>
              </div>
            </div>

            {/* G. Tarjetas de Acceso Rápido (Citas y Cotización) */}
            {id && (
              <div className="res-mobile-action-cards-grid">
                <div
                  className="res-mobile-action-card is-appointment"
                  onClick={handleOpenAppointments}
                >
                  <div className="res-mobile-action-card-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div className="res-mobile-action-card-info">
                    <span className="res-mobile-action-card-title">Agendar Cita</span>
                    <span className="res-mobile-action-card-subtitle">Visita técnica</span>
                  </div>
                </div>

                <div
                  className="res-mobile-action-card is-quote"
                  onClick={handleOpenQuote}
                >
                  <div className="res-mobile-action-card-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                  <div className="res-mobile-action-card-info">
                    <span className="res-mobile-action-card-title">Cotización</span>
                    <span className="res-mobile-action-card-subtitle">Ver / PDF</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Barra Inferior Fija de Acciones */}
          <div className="res-mobile-bottom-bar">
            {/* Popover Más Opciones */}
            {showMobileMoreMenu && (
              <div className="res-mobile-more-popover" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMoreMenu(false);
                    if (formData.status === 'Mantenimiento') handleReleaseMaintenance();
                    else handleMaintenance();
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  {formData.status === 'Mantenimiento' ? 'Liberar Mantenimiento' : 'Poner en Mantenimiento'}
                </button>
                {id && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileMoreMenu(false);
                      handleOpenQuote();
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    Abrir Cotización
                  </button>
                )}
                {id && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileMoreMenu(false);
                      handleOpenHistory();
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Ver Historial
                  </button>
                )}
                {id && (
                  <button
                    type="button"
                    className="is-delete"
                    onClick={() => {
                      setShowMobileMoreMenu(false);
                      handleCancelEventClick();
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    Cancelar / Eliminar Reserva
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMoreMenu(false);
                    handleBack();
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  Descartar y Volver
                </button>
              </div>
            )}

            <div className="res-mobile-bottom-main-row">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="res-mobile-btn-save-cta"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {saving ? 'Guardando cambios...' : 'Guardar Cambios'}
              </button>

              <button
                type="button"
                className="res-mobile-btn-more-dots"
                onClick={() => setShowMobileMoreMenu(prev => !prev)}
                title="Más opciones"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2.2" />
                  <circle cx="12" cy="12" r="2.2" />
                  <circle cx="12" cy="19" r="2.2" />
                </svg>
              </button>
            </div>

            <div className="res-mobile-bottom-sub-row">
              <button
                type="button"
                className="res-mobile-sub-action-btn is-maintenance"
                onClick={formData.status === 'Mantenimiento' ? handleReleaseMaintenance : handleMaintenance}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                {formData.status === 'Mantenimiento' ? 'Liberar' : 'Mantenimiento'}
              </button>
              {id && (
                <button
                  type="button"
                  className="res-mobile-sub-action-btn is-quote"
                  onClick={handleOpenQuote}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  Cotización
                </button>
              )}
              <button
                type="button"
                className="res-mobile-sub-action-btn is-danger"
                onClick={handleBack}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                Descartar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="res-bento-window">
          {/* 1. Header Bar */}
          <div className="res-bento-header">
            <div className="res-bento-header-left">
              <div className="res-bento-title-row">
                <h1 className="res-bento-title">
                  {id ? 'Editar Reserva' : 'Nueva Reserva'}
                </h1>
                <span
                  className="res-bento-status-pill"
                  style={{
                    color: STATUS_META[formData.status]?.color || '#00CC66',
                    background: `${STATUS_META[formData.status]?.color || '#00CC66'}14`,
                    borderColor: `${STATUS_META[formData.status]?.color || '#00CC66'}40`
                  }}
                >
                  <span
                    className="res-bento-status-dot"
                    style={{ background: STATUS_META[formData.status]?.color || '#00CC66' }}
                  />
                  {formData.status}
                </span>
                <span className="res-bento-divider">|</span>
                <span className="res-bento-id-badge">
                  ID: #{id ? `RES-${String(id).slice(-8).toUpperCase()}` : 'NUEVA'}
                </span>
              </div>
              <div className="res-bento-subtitle">
                <span style={{ color: '#eab308' }}>★</span>
                <span style={{ fontWeight: 700, color: '#334155' }}>
                  Principal: {principalSlot?.salon || slots[0]?.salon || 'Sin salón'}
                </span>
                <span>·</span>
                <span>📅 {formattedHeaderDate}</span>
                <span>·</span>
                <span>🕒 {principalSlot?.startTime || slots[0]?.startTime || '10:00'} - {principalSlot?.endTime || slots[0]?.endTime || '12:00'}</span>
                <span>·</span>
                <span>👥 Total: <strong>{formData.pax || 0} PAX</strong></span>
                <span style={{ color: '#64748b' }}>
                  ({formData.paxCompartido === true ? 'Compartido' : formData.paxCompartido === false ? 'No Compartido' : 'Principal'})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleBack}
              className="res-bento-close-btn"
              title="Cerrar ventana"
              aria-label="Cerrar"
              style={{
                width: '32px',
                height: '32px',
                minHeight: '32px',
                maxHeight: '32px',
                minWidth: '32px',
                maxWidth: '32px',
                padding: 0,
                margin: 0,
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* 2. Pipeline Stepper (Chevron Bar con colores exactos de estado del CRM) */}
          <div className="res-bento-stepper-wrap">
            <div className="res-bento-stepper">
              {PIPELINE_STEPS.map((step, idx) => {
                const stepColor = STATUS_META[step.key]?.color || '#00A3FF';
                const isCompleted = idx < currentIdx;
                const isActive = idx === currentIdx;

                const itemBg = (isActive || isCompleted) ? stepColor : `${stepColor}14`;
                const itemColor = (isActive || isCompleted) ? '#ffffff' : stepColor;
                const nodeBg = (isActive || isCompleted) ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.85)';
                const nodeColor = (isActive || isCompleted) ? '#ffffff' : stepColor;
                const nodeBorder = (isActive || isCompleted) ? '1px solid rgba(255, 255, 255, 0.5)' : `1.5px solid ${stepColor}60`;

                return (
                  <div
                    key={step.key}
                    onClick={() => handleStepClick(step.key)}
                    className="res-bento-chevron-item"
                    style={{
                      background: itemBg,
                      color: itemColor,
                      boxShadow: isActive ? `0 3px 12px ${stepColor}45` : 'none',
                      zIndex: PIPELINE_STEPS.length - idx
                    }}
                    title={`Cambiar etapa a: ${step.label}`}
                  >
                    <div className="res-bento-chevron-content">
                      <span className="res-bento-chevron-stage" style={{ color: itemColor, opacity: (isActive || isCompleted) ? 0.9 : 0.8 }}>
                        {step.stageName}
                      </span>
                      <span className="res-bento-chevron-label" style={{ color: itemColor }}>
                        {step.label}
                      </span>
                    </div>

                    <div
                      className="res-bento-chevron-node"
                      style={{
                        background: nodeBg,
                        color: nodeColor,
                        border: nodeBorder
                      }}
                    >
                      {renderStageIcon(step.stageNumber)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Scrollable Bento Body */}
          <div className="res-bento-body-scroll">
            {/* Validation errors alert */}
            {validationErrors.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px' }}>
                <div style={{ color: '#dc2626', fontWeight: '800', marginBottom: '4px', fontSize: '13px' }}>
                  ⚠️ Faltan datos por completar:
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', color: '#991b1b', fontSize: '12.5px', lineHeight: 1.5 }}>
                  {validationErrors.slice(0, 4).map((err, i) => <li key={i}>{err}</li>)}
                  {validationErrors.length > 4 && <li>...y {validationErrors.length - 4} más</li>}
                </ul>
              </div>
            )}

            <div className="res-bento-grid">
              {/* Columna Izquierda: Nombre del Evento y Salones */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
                {/* Bento Card: Nombre del Evento */}
                <div className="res-bento-card">
                  <div className="res-bento-card-header">
                    <label className="res-bento-card-title">
                      Nombre del Evento *
                    </label>
                    <span className="res-bento-badge">
                      {formData.clientName ? `Cliente: ${formData.clientName}` : 'Categoría: Convención Corporativa'}
                    </span>
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Ej. Boda Cabrera Szejner, Convención Corporativa, Almuerzo Empresarial..."
                    className="res-bento-name-input"
                    style={{ background: '#ffffff', color: '#0f172a' }}
                  />
                  {(formData.clientName || formData.clientPhone) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px', fontSize: '12px', color: '#64748b' }}>
                      {formData.clientName && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          👤 <strong>{formData.clientName}</strong>
                        </span>
                      )}
                      {formData.clientPhone && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          📞 {formData.clientPhone}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bento Card: Salones y Horarios */}
                <div className="res-bento-card res-bento-salones-card">
                  <div className="res-bento-salones-header">
                    <div className="res-bento-salones-title-box">
                      <div className="res-bento-salones-main-title">
                        <span style={{ fontSize: '16px' }}>🏢</span>
                        <span>Salones y Horarios</span>
                        <span className="res-bento-badge">
                          {slots.length} {slots.length === 1 ? 'espacio asignado' : 'espacios asignados'}
                        </span>
                      </div>
                      <p className="res-bento-salones-sub">
                        Gestión multi-espacio independiente de fechas, cupos y estado individual
                      </p>
                    </div>

                    <div className="res-bento-salones-actions">
                      <button
                        type="button"
                        onClick={handleConfirmAllSlots}
                        className="res-bento-btn-confirm-all"
                        title="Cambiar todos los salones a Confirmado"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Confirmar Todos</span>
                      </button>

                      <button
                        type="button"
                        onClick={addSlotRow}
                        className="res-bento-btn-add-salon"
                      >
                        <span>+</span>
                        <span>Agregar Salón</span>
                      </button>
                    </div>
                  </div>

                  {slotConflicts.length > 0 && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', fontSize: '11.5px' }}>
                      <div style={{ fontWeight: '800', color: '#dc2626', marginBottom: '3px' }}>⚠️ Conflictos detectados en horarios:</div>
                      {slotConflicts.map((r, i) => (
                        <div key={i} style={{ color: '#991b1b' }}>
                          • Salón {r.index + 1}: {r.message || r.hint}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tabla de Salones */}
                  <div className="res-bento-table-wrap">
                    <div className="res-bento-table-inner">
                      <div className="res-bento-table-head">
                        <span style={{ textAlign: 'center' }} title="Salón Principal">★</span>
                        <span>Salón / Espacio</span>
                        <span style={{ textAlign: 'center' }}>PAX</span>
                        <span>Fechas (Desde - Hasta)</span>
                        <span>Horario (Inicio - Fin)</span>
                        <span>Estado Individual</span>
                        <span style={{ textAlign: 'center' }}>Acción</span>
                      </div>

                      <div className="res-bento-table-rows">
                        {slots.map((slot, index) => {
                          const isPrincipal = slot.isPrincipal === true;
                          return (
                            <div
                              key={index}
                              className={`res-bento-table-row ${isPrincipal ? 'is-principal' : ''}`}
                            >
                              {/* 1. Estrella Principal */}
                              <button
                                type="button"
                                onClick={() => setPrincipalSlot(index)}
                                className={`res-bento-star-btn ${isPrincipal ? 'is-principal' : ''}`}
                                title={isPrincipal ? 'Salón principal asignado' : 'Marcar como salón principal'}
                                aria-label="Marcar como salón principal"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  minHeight: '28px',
                                  maxHeight: '28px',
                                  minWidth: '28px',
                                  maxWidth: '28px',
                                  padding: 0,
                                  margin: 0,
                                  background: 'transparent',
                                  border: 'none',
                                  boxShadow: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill={isPrincipal ? '#eab308' : 'none'} stroke={isPrincipal ? '#ca8a04' : '#cbd5e1'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              </button>

                              {/* 2. Selector de Salón */}
                              <div className="res-bento-cell-salon">
                                <select
                                  value={slot.salon}
                                  onChange={e => handleSlotChange(index, 'salon', e.target.value)}
                                  className="res-bento-select-salon"
                                  style={{ background: '#ffffff', color: '#0f172a' }}
                                >
                                  <option value="">Selecciona salón...</option>
                                  {salones?.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <span className={`res-bento-salon-tag ${isPrincipal ? 'principal' : 'paralelo'}`}>
                                  {isPrincipal ? 'Principal' : 'Sesión paralela'}
                                </span>
                              </div>

                              {/* 3. PAX */}
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                disabled={isMaintenanceStatus(slot.status || formData.status)}
                                value={isMaintenanceStatus(slot.status || formData.status) ? 'N/A' : (slot.pax ?? '')}
                                onChange={e => handleSlotChange(index, 'pax', e.target.value)}
                                placeholder="PAX"
                                className="res-bento-input-pax"
                                style={{ background: '#ffffff', color: '#0f172a' }}
                              />

                              {/* 4. Fechas (Desde - Hasta) */}
                              <div className="res-bento-cell-range">
                                <input
                                  type="date"
                                  value={slot.dateStart || ''}
                                  onChange={e => handleSlotChange(index, 'dateStart', e.target.value)}
                                  className="res-bento-range-input"
                                  style={{ background: '#ffffff', color: '#0f172a' }}
                                />
                                <span className="res-bento-range-sep">→</span>
                                <input
                                  type="date"
                                  value={slot.dateEnd || slot.dateStart || ''}
                                  onChange={e => handleSlotChange(index, 'dateEnd', e.target.value)}
                                  className="res-bento-range-input"
                                  style={{ background: '#ffffff', color: '#0f172a' }}
                                />
                              </div>

                              {/* 5. Horario (Inicio - Fin) */}
                              <div className="res-bento-cell-range">
                                <TimeSelect
                                  value={slot.startTime || '10:00'}
                                  onChange={val => handleSlotChange(index, 'startTime', val)}
                                  style={{ height: '32px', fontSize: '11.5px', padding: '2px 4px', borderRadius: '8px', background: '#ffffff', color: '#0f172a' }}
                                />
                                <span className="res-bento-range-sep">-</span>
                                <TimeSelect
                                  value={slot.endTime || '12:00'}
                                  onChange={val => handleSlotChange(index, 'endTime', val)}
                                  style={{ height: '32px', fontSize: '11.5px', padding: '2px 4px', borderRadius: '8px', background: '#ffffff', color: '#0f172a' }}
                                />
                              </div>

                              {/* 6. Estado Individual del Salón */}
                              <StatusSelectCustom
                                size="sm"
                                value={slot.status || formData.status}
                                onChange={val => handleSlotChange(index, 'status', val)}
                                options={isMaintenanceStatus(formData.status) ? STATUS_META_LIST.filter(s => isMaintenanceStatus(s.key)) : STATUS_META_LIST}
                              />

                              {/* 7. Eliminar */}
                              <button
                                type="button"
                                onClick={() => removeSlotRow(index)}
                                disabled={slots.length <= 1}
                                className="res-bento-btn-trash"
                                title={slots.length <= 1 ? 'Debe existir al menos un salón' : 'Eliminar salón'}
                                aria-label="Eliminar salón"
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  minHeight: '30px',
                                  maxHeight: '30px',
                                  minWidth: '30px',
                                  maxWidth: '30px',
                                  padding: 0,
                                  margin: 0,
                                  background: 'transparent',
                                  border: 'none',
                                  boxShadow: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: slots.length <= 1 ? 'not-allowed' : 'pointer',
                                  opacity: slots.length <= 1 ? 0.3 : 1
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Aforo Total y Segmented Controls */}
                  <div className="res-bento-aforo-footer">
                    <div className="res-bento-aforo-top-row">
                      <div className="res-bento-aforo-total-box">
                        <div className="res-bento-aforo-icon">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            AFORO TOTAL:
                          </span>
                          <span className="res-bento-aforo-num" style={{ marginLeft: '6px' }}>
                            {isMaintenanceStatus(formData.status) ? 'N/A' : (formData.pax || 0)} PAX
                          </span>
                          <span className="res-bento-aforo-sub">
                            (Suma por salón: {sumaPaxSalones} PAX)
                          </span>
                        </div>
                      </div>

                      <div className="res-bento-calculo-wrap">
                        <span className="res-bento-calculo-label">Cálculo:</span>
                        <div className="res-bento-segmented-pills">
                          {/* Compartido */}
                          <div
                            onClick={() => {
                              const defaultPax = slots.find(s => Number(s.pax) > 0)?.pax || formData.pax || '';
                              setFormData(prev => ({ ...prev, paxCompartido: true, pax: defaultPax }));
                              setSlots(prev => prev.map(s => ({ ...s, pax: defaultPax })));
                            }}
                            className={`res-bento-seg-pill ${formData.paxCompartido === true ? 'active-compartido' : ''}`}
                          >
                            {formData.paxCompartido === true && <span>✓</span>}
                            <span>Compartido ({formData.pax || 0})</span>
                          </div>

                          {/* No Compartido */}
                          <div
                            onClick={() => {
                              const total = slots.reduce((acc, slot) => acc + Math.max(0, Number(slot?.pax || 0)), 0);
                              setFormData(prev => ({ ...prev, paxCompartido: false, pax: total > 0 ? total : '' }));
                            }}
                            className={`res-bento-seg-pill ${formData.paxCompartido === false ? 'active-no-compartido' : ''}`}
                          >
                            {formData.paxCompartido === false && <span>✓</span>}
                            <span>No Compartido ({sumaPaxSalones})</span>
                          </div>

                          {/* Principal */}
                          <div
                            onClick={() => {
                              const pSlot = slots.find(s => s.isPrincipal === true) || slots[0];
                              const principalPax = pSlot ? (Number(pSlot.pax) > 0 ? pSlot.pax : '') : (formData.pax || '');
                              setFormData(prev => ({ ...prev, paxCompartido: 'principal', pax: principalPax }));
                            }}
                            className={`res-bento-seg-pill ${formData.paxCompartido === 'principal' || formData.paxCompartido === 2 ? 'active-principal' : ''}`}
                          >
                            {(formData.paxCompartido === 'principal' || formData.paxCompartido === 2) && <span>★</span>}
                            <span>Principal ({principalSlot?.pax || 0})</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="res-bento-aforo-note">
                      <span style={{ fontSize: '13px' }}>ℹ</span>
                      <span>
                        {formData.paxCompartido === true && 'Modo Compartido: Aforo unificado del evento. Si cambias de estado a un salón individual, la facturación desglosa cada tarifa por separado manteniendo el cupo.'}
                        {formData.paxCompartido === false && 'Modo No Compartido: Cada salón tiene su propio cupo independiente y se suman para el aforo total del evento.'}
                        {(formData.paxCompartido === 'principal' || formData.paxCompartido === 2) && 'Modo Salón Principal: Cada salón cuenta con su propio cupo independiente, y el aforo total del evento y reportes se toma únicamente del salón principal (marcado con ⭐).'}
                        {formData.paxCompartido === null && 'Por favor selecciona el tipo de cálculo de aforo (Compartido, No Compartido o Salón Principal).'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Periodo, Estado, Encargado y Notas */}
              <div className="res-bento-side-column">
                {/* 1. Periodo Global del Evento */}
                <div className="res-bento-card">
                  <div className="res-bento-card-header">
                    <div className="res-bento-card-title-group">
                      <span style={{ fontSize: '14px' }}>📅</span>
                      <span className="res-bento-card-title">Periodo Global del Evento</span>
                    </div>
                    <span className="res-bento-badge green">
                      {calculatedJornadas} {calculatedJornadas === 1 ? 'Jornada' : 'Jornadas'}
                    </span>
                  </div>
                  <div className="res-bento-periodo-grid">
                    <div className="res-bento-periodo-field">
                      <label className="res-bento-field-label">Fecha Inicial *</label>
                      <input
                        type="date"
                        name="date"
                        value={formData.date || ''}
                        onChange={handleChange}
                        className="res-bento-date-input"
                        style={{ background: '#ffffff', color: '#0f172a' }}
                      />
                    </div>
                    <div className="res-bento-periodo-field">
                      <label className="res-bento-field-label">Fecha Final *</label>
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate || formData.date || ''}
                        onChange={handleChange}
                        className="res-bento-date-input"
                        style={{ background: '#ffffff', color: '#0f172a' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Estado General Consolidado */}
                <div className="res-bento-card">
                  <div className="res-bento-card-header">
                    <span className="res-bento-card-title">Estado General Consolidado *</span>
                    <span className="res-bento-badge green">Sincronizado</span>
                  </div>
                  <div className="res-bento-status-box">
                    <StatusSelectCustom
                      size="md"
                      value={formData.status}
                      onChange={(val) => applyEventStatus(val)}
                      options={STATUS_META_LIST}
                    />
                    <div className="res-bento-status-desc">
                      {isMaintenanceStatus(formData.status)
                        ? 'En mantenimiento, los salones asignados se marcan como mantenimiento técnico.'
                        : 'Sincronizado con el calendario general, pipeline y cotizaciones activas.'}
                    </div>
                  </div>
                </div>

                {/* 3. Usuario Responsable */}
                <div className="res-bento-card">
                  <div className="res-bento-card-header">
                    <span className="res-bento-card-title">Usuario Responsable *</span>
                  </div>
                  <div className="res-bento-user-card">
                    <div className="res-bento-user-info-left">
                      <div className="res-bento-user-avatar">
                        {getUserInitials(assignedUser?.fullName || assignedUser?.name)}
                      </div>
                      <div className="res-bento-user-text">
                        <select
                          name="userId"
                          value={formData.userId || ''}
                          onChange={handleChange}
                          className="res-bento-user-select"
                        >
                          <option value="">-- Sin Encargado --</option>
                          {users?.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.fullName || u.name}
                            </option>
                          ))}
                        </select>
                        <div className="res-bento-user-role">
                          <span>{assignedUser?.role || 'Coordinador de Eventos'}</span>
                          <span>·</span>
                          <span className="res-bento-online-dot" />
                          <span style={{ color: '#059669' }}>En línea</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ color: '#059669', flexShrink: 0 }} title="Verificado y Asignado">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <polyline points="9 12 11 14 15 10" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 4. Notas y Requerimientos */}
                <div className="res-bento-card">
                  <div className="res-bento-card-header">
                    <div className="res-bento-card-title-group">
                      <span style={{ fontSize: '13px' }}>✍️</span>
                      <span className="res-bento-card-title">Notas y Requerimientos</span>
                    </div>
                    <span className="res-bento-badge">Autoguardado</span>
                  </div>
                  <textarea
                    name="notes"
                    value={formData.notes || ''}
                    onChange={handleChange}
                    placeholder="Protocolo especial, instrucciones del cliente, observaciones logísticas..."
                    className="res-bento-notes-textarea"
                    style={{ background: '#ffffff', color: '#0f172a' }}
                  />
                  <div className="res-bento-notes-footer">
                    <span>Campo opcional para observaciones internas</span>
                    <span>{(formData.notes || '').length} caracteres</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Footer Inferior de Acciones */}
          <div className="res-bento-footer">
            <div className="res-bento-footer-left">
              {formData.status === 'Mantenimiento' ? (
                <button
                  type="button"
                  onClick={handleReleaseMaintenance}
                  className="res-bento-btn-action mantenimiento"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                  </svg>
                  <span>Liberar Mantenimiento</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleMaintenance}
                  className="res-bento-btn-action mantenimiento"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                  </svg>
                  <span>Mantenimiento</span>
                </button>
              )}

              {id && (
                <button
                  type="button"
                  onClick={handleOpenAppointments}
                  className="res-bento-btn-action cita"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>+ Cita</span>
                </button>
              )}

              {id && (
                <button
                  type="button"
                  onClick={handleOpenQuote}
                  className="res-bento-btn-action cotizar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>Cotizar</span>
                </button>
              )}

              {id && (
                <button
                  type="button"
                  onClick={handleOpenHistory}
                  className="res-bento-btn-action historial"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Historial</span>
                </button>
              )}

              {id && (
                <button
                  type="button"
                  onClick={handleCancelEventClick}
                  className="res-bento-btn-action cancelar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>Cancelar</span>
                </button>
              )}
            </div>

            <div className="res-bento-footer-right">
              <button
                type="button"
                onClick={handleBack}
                className="res-bento-btn-descartar"
              >
                Descartar
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="res-bento-btn-guardar"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{id ? 'Guardar Cambios' : 'Crear Reserva'}</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {showAppointmentModal && id && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

      <InformeTransferModal
        isOpen={informeTransferModal.isOpen}
        conflicts={informeTransferModal.conflicts || informeTransferModal.affectedInformes}
        affectedInformes={informeTransferModal.affectedInformes}
        availableSlots={informeTransferModal.availableSlots}
        onConfirm={handleConfirmInformeTransfer}
        onProceedWithoutTransfer={handleProceedWithoutInformeTransfer}
        onCancel={() => setInformeTransferModal(prev => ({ ...prev, isOpen: false }))}
        isSubmitting={saving}
      />
    </div>
  );
}

