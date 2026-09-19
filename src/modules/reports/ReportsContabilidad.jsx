import React, { useState, useMemo, useEffect, useCallback, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { loadState as loadCrmState, addEventAdvanceApi, updateEventAdvanceApi, deleteEventAdvanceApi } from '../../services/stateService';
import authService from '../../services/authService';
import { STATUS_META } from '../calendar/constants';
import { getEventSeriesFinancialMeta, getQuoteFinancialAmounts } from './components/eventSeriesUtils';
import { compressEvidenceFile } from '../../utils/imageUtils';
import {
  Landmark,
  Building2,
  Coins,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Search,
  Calendar,
  User,
  Phone,
  FileText,
  Filter,
  Download,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Printer,
  X,
  Eye,
  RotateCcw,
  Check,
  CreditCard,
  Clock,
  Layers,
  Utensils,
  Hotel,
  Package,
  Plus,
  Trash2,
  Edit2,
  UploadCloud,
  AlertTriangle,
} from 'lucide-react';

function formatMoney(amount) {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(amount || 0);
}

function formatCompactMoney(amount) {
  const num = Number(amount || 0);
  if (num >= 1000000) return `Q ${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `Q ${(num / 1000).toFixed(1)}K`;
  return `Q ${num.toFixed(2)}`;
}

export function renderFormattedParts(amount, qColor) {
  const num = Number(amount || 0);
  const formatted = num.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parts = formatted.split('.');
  const intPart = parts[0];
  const decPart = parts[1] || '00';
  return (
    <>
      <span style={{ color: qColor || 'inherit', marginRight: '2px', fontWeight: 800 }}>Q</span>
      <span style={{ fontWeight: 900 }}>{intPart}</span>
      <span style={{ fontSize: '0.72em', fontWeight: 700, opacity: 0.85 }}>.{decPart}</span>
    </>
  );
}

export function formatDateEs(dateStr) {
  if (!dateStr) return '-';
  try {
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
      return `${day} ${months[monthIdx] || ''} ${year}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  } catch (_) {}
  return String(dateStr);
}

export function getAccountInitials(name = '') {
  const clean = String(name || '').trim();
  if (!clean) return 'JL';

  const stripped = clean
    .replace(/^boda\s+de\s+/i, '')
    .replace(/^boda\s+/i, '')
    .replace(/^evento\s+de\s+/i, '')
    .replace(/^evento\s+/i, '')
    .replace(/^cumplea[ñn]os\s+/i, '')
    .replace(/^xv\s+a[ñn]os\s+/i, '')
    .trim();

  const words = stripped
    .split(/\s+/)
    .filter(w => w.length > 0 && !['de', 'la', 'el', 'los', 'las', 'y', 'del', 'en'].includes(w.toLowerCase()));

  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export function getAccountToneStyles(tone) {
  switch (tone) {
    case 'overdue':
      return {
        bg: '#fee2e2',
        color: '#dc2626',
        borderColor: '#fca5a5',
        borderTop: '#ef4444',
        btnBg: '#f59e0b',
        btnText: '#ffffff',
      };
    case 'due':
      return {
        bg: '#fef3c7',
        color: '#b45309',
        borderColor: '#fde68a',
        borderTop: '#f59e0b',
        btnBg: '#fffbeb',
        btnText: '#b45309',
      };
    case 'credit':
      return {
        bg: '#f5f3ff',
        color: '#6d28d9',
        borderColor: '#ddd6fe',
        borderTop: '#8b5cf6',
        btnBg: '#f5f3ff',
        btnText: '#6d28d9',
      };
    case 'ok':
    default:
      return {
        bg: '#dcfce7',
        color: '#15803d',
        borderColor: '#bbf7d0',
        borderTop: '#10b981',
        btnBg: '#ecfdf5',
        btnText: '#065f46',
      };
  }
}

export function categorizeQuoteItems(items = []) {
  const sections = {
    alimentosBebidas: { title: 'Alimentos & Bebidas', items: [], subtotal: 0, Icon: Utensils, color: '#0284c7' },
    habitaciones: { title: 'Habitaciones / Hospedaje', items: [], subtotal: 0, Icon: Hotel, color: '#7c3aed' },
    miscelaneos: { title: 'Misceláneos & Servicios del Evento', items: [], subtotal: 0, Icon: Package, color: '#16a34a' },
    otros: { title: 'Otros Servicios', items: [], subtotal: 0, Icon: Layers, color: '#64748b' }
  };

  const normalizeText = (str) => String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  for (const item of items) {
    const cat = normalizeText(item.category);
    const name = normalizeText(item.name);
    const qty = Number(item.qty || item.quantity || 1);
    const price = Number(item.price || item.unitPrice || 0);
    const total = Number(item.total || (qty * price));

    const itemObj = { ...item, qty, price, total };

    if (
      cat.includes('alimento') || cat.includes('bebida') || cat.includes('comida') ||
      cat.includes('menu') || cat.includes('catering') || cat.includes('bar') || cat.includes('coctel') ||
      name.includes('alimento') || name.includes('bebida') || name.includes('menu') || name.includes('comida') ||
      name.includes('descorche') || name.includes('plato') || name.includes('cena') || name.includes('almuerzo')
    ) {
      sections.alimentosBebidas.items.push(itemObj);
      sections.alimentosBebidas.subtotal += total;
    } else if (
      cat.includes('habitacion') || cat.includes('hospedaje') || cat.includes('hotel') || cat.includes('alojamiento') ||
      name.includes('habitacion') || name.includes('hospedaje') || name.includes('hotel') || name.includes('noche')
    ) {
      sections.habitaciones.items.push(itemObj);
      sections.habitaciones.subtotal += total;
    } else if (
      cat.includes('miscelaneo') || cat.includes('salon') || cat.includes('mobiliario') ||
      cat.includes('audio') || cat.includes('decoracion') || cat.includes('montaje') ||
      name.includes('salon') || name.includes('silla') || name.includes('mesa') || name.includes('audio') ||
      name.includes('luces') || name.includes('dj') || name.includes('decoracion')
    ) {
      sections.miscelaneos.items.push(itemObj);
      sections.miscelaneos.subtotal += total;
    } else {
      sections.otros.items.push(itemObj);
      sections.otros.subtotal += total;
    }
  }

  return sections;
}

export default function ReportsContabilidad({ onClose }) {
  const { events, users, handleAddEvent } = useOutletContext();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  const [companies, setCompanies] = useState([]);
  
  // ── Búsqueda bajo demanda (con tecla Enter o botón Buscar) ──
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // ── Filtros Secundarios ──
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sellerFilter, setSellerFilter] = useState(''); // ID del vendedor
  const [statusTab, setStatusTab] = useState('ALL'); // ALL, OVERDUE, DUE_SOON, UP_TO_DATE, CREDIT
  const [statusFilter, setStatusFilter] = useState(''); // Estado del evento
  const [salonFilter, setSalonFilter] = useState('');
  const [institutionTypeFilter, setInstitutionTypeFilter] = useState('');

  // ── Paginación y Ordenamiento ──
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('PENDING_DESC'); // PENDING_DESC, PENDING_ASC, NET_DESC, NAME_ASC, DUE_ASC

  // ── Expansión y Modales ──
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());
  const [accountDetailTab, setAccountDetailTab] = useState({});
  const getDetailTab = (key) => accountDetailTab[key] || 'events';
  const setDetailTab = (key, tab) => setAccountDetailTab(prev => ({ ...prev, [key]: tab }));
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const hasActiveFilters = Boolean(appliedSearch || sellerFilter || dateFrom || dateTo || statusTab !== 'ALL' || salonFilter || institutionTypeFilter);
  const [activeStatementCompanyId, setActiveStatementCompanyId] = useState(null);
  const [activeEventStatementRow, setActiveEventStatementRow] = useState(null);
  const [previewVoucher, setPreviewVoucher] = useState(null);

  // ── Gestión de Pagos / Abonos en Modal ──
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const [advanceForm, setAdvanceForm] = useState({
    amount: '',
    date: todayISO(),
    paymentType: 'Transferencia',
    voucherNumber: '',
    description: '',
    userId: '',
    userName: '',
    evidenceName: '',
  });
  const [advanceEvidenceFile, setAdvanceEvidenceFile] = useState(null);
  const [advanceEditingId, setAdvanceEditingId] = useState('');
  const [advanceEvidenceInputKey, setAdvanceEvidenceInputKey] = useState(0);
  const [savingAdvance, setSavingAdvance] = useState(false);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const advanceFormRef = useRef(null);

  const resetAdvanceForm = useCallback(() => {
    const curUser = authService.getCurrentUser() || {};
    const defaultUserId = curUser.id ? String(curUser.id) : (activeEventStatementRow?.userId ? String(activeEventStatementRow.userId) : '');
    const defaultUserName = curUser.fullName || curUser.name || activeEventStatementRow?.userName || 'Usuario Contabilidad';

    setAdvanceEditingId('');
    setAdvanceEvidenceFile(null);
    setAdvanceEvidenceInputKey(k => k + 1);
    setAdvanceForm({
      amount: '',
      date: todayISO(),
      paymentType: 'Transferencia',
      voucherNumber: '',
      description: '',
      userId: defaultUserId,
      userName: defaultUserName,
      evidenceName: '',
    });
  }, [activeEventStatementRow?.userId, activeEventStatementRow?.userName]);

  // ── Atajos de Teclado (Ctrl+K para buscar, Escape para cerrar modales) ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (previewVoucher) {
          setPreviewVoucher(null);
        } else if (activeEventStatementRow) {
          setActiveEventStatementRow(null);
        } else if (activeStatementCompanyId) {
          setActiveStatementCompanyId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewVoucher, activeEventStatementRow, activeStatementCompanyId]);

  // Al abrir una nueva hoja de evento, resetear el formulario de abonos
  useEffect(() => {
    if (activeEventStatementRow) {
      resetAdvanceForm();
    }
  }, [activeEventStatementRow?.id, resetAdvanceForm]);

  const handleStartEditAdvance = (adv) => {
    const curUser = authService.getCurrentUser() || {};
    const defaultUserId = curUser.id ? String(curUser.id) : (activeEventStatementRow?.userId ? String(activeEventStatementRow.userId) : '');
    const defaultUserName = curUser.fullName || curUser.name || activeEventStatementRow?.userName || 'Usuario Contabilidad';

    setAdvanceEditingId(adv.id);
    setAdvanceForm({
      amount: adv.amount ? String(adv.amount) : '',
      date: adv.date || todayISO(),
      paymentType: adv.paymentType || 'Transferencia',
      voucherNumber: adv.voucherNumber || '',
      description: adv.description || '',
      userId: adv.createdByUserId || adv.userId || defaultUserId,
      userName: adv.createdByName || adv.userName || defaultUserName,
      evidenceName: adv.evidenceName || '',
    });
    setAdvanceEvidenceFile(null);
    setShowAdvanceForm(true);
    setTimeout(() => {
      advanceFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleFillPendingBalance = () => {
    if (!activeEventStatementRow) return;
    const mFin = getQuoteFinancialAmounts(activeEventStatementRow.quote, activeEventStatementRow.exchangeRate);
    const mTotal = Number(activeEventStatementRow.total) > 0 ? Number(activeEventStatementRow.total) : mFin.totalGtq;
    const mAdvTotal = Number(activeEventStatementRow.advancesTotal) || 0;
    const pending = Math.max(0, mTotal - mAdvTotal);
    if (pending > 0) {
      setAdvanceForm(prev => ({
        ...prev,
        amount: activeEventStatementRow.isUsd
          ? Number((pending / (activeEventStatementRow.exchangeRate || 1)).toFixed(2))
          : Number(pending.toFixed(2)),
        description: prev.description || 'Cancelación de saldo pendiente'
      }));
    }
  };

  const handleSaveAdvanceInModal = async () => {
    if (savingAdvance || !activeEventStatementRow) return;

    const amount = Number(advanceForm.amount);
    if (!amount || isNaN(amount) || amount <= 0) {
      toast.error('Ingresa un monto válido mayor a 0');
      return;
    }

    const date = String(advanceForm.date || '').trim();
    if (!date) {
      toast.error('La fecha del abono es requerida');
      return;
    }

    const paymentType = String(advanceForm.paymentType || 'Transferencia').trim();
    const voucherNumber = String(advanceForm.voucherNumber || '').trim();
    const description = String(advanceForm.description || '').trim();

    if (paymentType !== 'Efectivo' && !voucherNumber) {
      toast.error(`El No. de boleta / referencia es requerido para pago por ${paymentType}`);
      return;
    }

    if (!description) {
      toast.error('Ingresa un concepto o descripción del abono');
      return;
    }

    let evidenceDataUrl = '';
    let evidenceName = '';
    let evidenceType = '';

    if (advanceEvidenceFile) {
      if (Number(advanceEvidenceFile.size || 0) > 10 * 1024 * 1024) {
        toast.error('El comprobante supera el límite de 10 MB');
        return;
      }
      try {
        const processed = await compressEvidenceFile(advanceEvidenceFile);
        evidenceDataUrl = processed.dataUrl;
        evidenceName = String(processed.name || '').trim();
        evidenceType = String(processed.type || '').trim();
      } catch (err) {
        console.error('Error al procesar comprobante:', err);
        toast.error('Error al procesar la imagen del comprobante');
        return;
      }
    }

    const user = authService.getCurrentUser() || {};
    const currentActorId = user.id || 'system';
    const currentActorName = user.fullName || user.name || 'Usuario Contabilidad';

    const actorId = String(advanceForm.userId || currentActorId).trim();
    const actorName = String(advanceForm.userName || currentActorName).trim();

    const targetEventId = activeEventStatementRow.actionEventId || activeEventStatementRow.id;
    const targetEvent = events?.find(ev => String(ev.id) === String(targetEventId)) ||
                        events?.find(ev => String(ev.id) === String(activeEventStatementRow.id));

    if (!targetEvent) {
      toast.error('No se encontró el evento en la base de datos');
      return;
    }

    setSavingAdvance(true);

    try {
      // Consolidar todos los anticipos conocidos de todas las fuentes disponibles
      const advancesMap = new Map();
      if (Array.isArray(targetEvent.quote?.advances)) {
        for (const a of targetEvent.quote.advances) {
          if (a && a.id) advancesMap.set(String(a.id), { ...a });
        }
      }
      if (Array.isArray(activeEventStatementRow.advances)) {
        for (const a of activeEventStatementRow.advances) {
          if (a && a.id) advancesMap.set(String(a.id), { ...a });
        }
      }
      if (Array.isArray(activeEventStatementRow.quote?.advances)) {
        for (const a of activeEventStatementRow.quote.advances) {
          if (a && a.id) advancesMap.set(String(a.id), { ...a });
        }
      }

      let currentAdvances = Array.from(advancesMap.values());

      if (advanceEditingId) {
        const idx = currentAdvances.findIndex(a => String(a.id) === String(advanceEditingId));
        if (idx >= 0) {
          const prev = currentAdvances[idx];
          currentAdvances[idx] = {
            ...prev,
            amount,
            paymentType,
            date,
            voucherNumber,
            description,
            createdByUserId: actorId || prev.createdByUserId,
            createdByName: actorName || prev.createdByName,
            evidenceDataUrl: evidenceDataUrl || prev.evidenceDataUrl || '',
            evidenceName: evidenceName || prev.evidenceName || '',
            evidenceType: evidenceType || prev.evidenceType || '',
            updatedAt: new Date().toISOString(),
            updatedByUserId: currentActorId,
            updatedByName: currentActorName,
          };
        } else {
          currentAdvances.push({
            id: String(advanceEditingId),
            amount,
            paymentType,
            date,
            voucherNumber,
            description,
            evidenceDataUrl,
            evidenceName,
            evidenceType,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdByUserId: actorId,
            createdByName: actorName,
          });
        }
      } else {
        currentAdvances.push({
          id: `adv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          amount,
          paymentType,
          date,
          voucherNumber,
          description,
          evidenceDataUrl,
          evidenceName,
          evidenceType,
          createdAt: new Date().toISOString(),
          createdByUserId: actorId,
          createdByName: actorName,
        });
      }

      const currentQuote = {
        ...(activeEventStatementRow.quote || {}),
        ...(targetEvent.quote || {})
      };

      const advanceLogs = Array.isArray(currentQuote.advanceLogs) ? [...currentQuote.advanceLogs] : [];
      advanceLogs.push({
        id: `advlog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        actorName: currentActorName,
        actorId: currentActorId,
        tone: advanceEditingId ? 'edited' : 'added',
        label: advanceEditingId ? 'Editado' : 'Agregado',
        change: `${advanceEditingId ? 'Editado' : 'Registrado'} abono de Q ${amount.toFixed(2)} (${paymentType} ${voucherNumber ? '#' + voucherNumber : ''}) - Aplicado por: ${actorName} - ${description}`
      });

      const finAmounts = getQuoteFinancialAmounts(currentQuote, activeEventStatementRow.exchangeRate);
      const effectiveQuoteTotal = finAmounts.rawTotal > 0 ? finAmounts.rawTotal : Number(currentQuote.total || 0);
      const effectiveQuoteTotalGtq = finAmounts.totalGtq > 0 ? finAmounts.totalGtq : Number(currentQuote.totalGtq || 0);
      const effectiveQuoteSubtotal = finAmounts.rawSubtotal > 0 ? finAmounts.rawSubtotal : Number(currentQuote.subtotal || 0);
      const effectiveQuoteSubtotalGtq = finAmounts.subtotalGtq > 0 ? finAmounts.subtotalGtq : Number(currentQuote.subtotalGtq || 0);

      const updatedQuote = {
        ...currentQuote,
        total: effectiveQuoteTotal,
        totalGtq: effectiveQuoteTotalGtq,
        subtotal: effectiveQuoteSubtotal,
        subtotalGtq: effectiveQuoteSubtotalGtq,
        advances: currentAdvances,
        advanceLogs
      };

      const updatedEvent = {
        ...targetEvent,
        quote: updatedQuote
      };

      try {
        if (advanceEditingId) {
          await updateEventAdvanceApi(targetEvent.id, advanceEditingId, {
            amount,
            date,
            paymentType,
            voucherNumber,
            description,
            evidenceDataUrl,
            evidenceName,
            evidenceType,
            actorId,
            actorName
          });
        } else {
          const newAdvId = currentAdvances[currentAdvances.length - 1]?.id;
          await addEventAdvanceApi(targetEvent.id, {
            id: newAdvId,
            amount,
            date,
            paymentType,
            voucherNumber,
            description,
            evidenceDataUrl,
            evidenceName,
            evidenceType,
            createdByUserId: actorId,
            createdByName: actorName,
            createdAt: new Date().toISOString()
          });
        }
      } catch (atomicErr) {
        console.warn('Advertencia en endpoint atómico de anticipos:', atomicErr);
      }

      await handleAddEvent(updatedEvent);

      const sortedAdvances = currentAdvances.slice().sort((a, b) => {
        const d = String(a.date || "").localeCompare(String(b.date || ""));
        if (d !== 0) return d;
        return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      });
      const rawAdvTotal = sortedAdvances.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
      const isUsd = !!activeEventStatementRow.isUsd;
      const rate = activeEventStatementRow.exchangeRate || 1;
      const advTotal = isUsd ? Math.round(rawAdvTotal * rate * 100) / 100 : rawAdvTotal;
      const totalGtq = effectiveQuoteTotalGtq > 0 ? effectiveQuoteTotalGtq : (Number(activeEventStatementRow.total) || 0);
      const delta = totalGtq - advTotal;

      setActiveEventStatementRow(prev => ({
        ...prev,
        quote: updatedQuote,
        total: totalGtq,
        advances: sortedAdvances,
        advancesCount: sortedAdvances.length,
        advancesTotal: advTotal,
        delta,
        balancePending: Math.max(0, delta),
        creditBalance: Math.max(0, -delta),
      }));

      toast.success(advanceEditingId ? 'Abono actualizado exitosamente ✓' : 'Abono registrado exitosamente ✓');
      resetAdvanceForm();
      setShowAdvanceForm(false);
    } catch (err) {
      console.error('Error al guardar abono:', err);
      toast.error('Error al guardar el abono: ' + (err.message || 'Error interno'));
    } finally {
      setSavingAdvance(false);
    }
  };

  const handleDeleteAdvanceInModal = async (advanceId) => {
    if (!activeEventStatementRow) return;

    const result = await Swal.fire({
      title: '¿Eliminar este abono?',
      text: 'Este pago se restará del total cobrado y modificará el saldo pendiente del evento.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b'
    });

    if (!result.isConfirmed) return;

    const targetEventId = activeEventStatementRow.actionEventId || activeEventStatementRow.id;
    const targetEvent = events?.find(ev => String(ev.id) === String(targetEventId)) ||
                        events?.find(ev => String(ev.id) === String(activeEventStatementRow.id)) ||
                        activeEventStatementRow;

    if (!targetEvent) {
      toast.error('No se encontró el evento.');
      return;
    }

    try {
      const user = authService.getCurrentUser() || {};
      const actorId = user.id || 'system';
      const actorName = user.fullName || user.name || 'Usuario Contabilidad';

      // Consolidar todos los anticipos conocidos antes de borrar
      const advancesMap = new Map();
      if (Array.isArray(targetEvent.quote?.advances)) {
        for (const a of targetEvent.quote.advances) {
          if (a && a.id) advancesMap.set(String(a.id), { ...a });
        }
      }
      if (Array.isArray(activeEventStatementRow.advances)) {
        for (const a of activeEventStatementRow.advances) {
          if (a && a.id) advancesMap.set(String(a.id), { ...a });
        }
      }
      if (Array.isArray(activeEventStatementRow.quote?.advances)) {
        for (const a of activeEventStatementRow.quote.advances) {
          if (a && a.id) advancesMap.set(String(a.id), { ...a });
        }
      }

      advancesMap.delete(String(advanceId));
      const currentAdvances = Array.from(advancesMap.values());

      const currentQuote = {
        ...(activeEventStatementRow.quote || {}),
        ...(targetEvent.quote || {})
      };
      const advanceLogs = Array.isArray(currentQuote.advanceLogs) ? [...currentQuote.advanceLogs] : [];

      advanceLogs.push({
        id: `advlog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        actorName,
        actorId,
        tone: 'deleted',
        label: 'Eliminado',
        change: 'Abono eliminado del evento'
      });

      const finAmounts = getQuoteFinancialAmounts(currentQuote, activeEventStatementRow.exchangeRate);
      const effectiveQuoteTotal = finAmounts.rawTotal > 0 ? finAmounts.rawTotal : Number(currentQuote.total || 0);
      const effectiveQuoteTotalGtq = finAmounts.totalGtq > 0 ? finAmounts.totalGtq : Number(currentQuote.totalGtq || 0);
      const effectiveQuoteSubtotal = finAmounts.rawSubtotal > 0 ? finAmounts.rawSubtotal : Number(currentQuote.subtotal || 0);
      const effectiveQuoteSubtotalGtq = finAmounts.subtotalGtq > 0 ? finAmounts.subtotalGtq : Number(currentQuote.subtotalGtq || 0);

      const updatedQuote = {
        ...currentQuote,
        total: effectiveQuoteTotal,
        totalGtq: effectiveQuoteTotalGtq,
        subtotal: effectiveQuoteSubtotal,
        subtotalGtq: effectiveQuoteSubtotalGtq,
        advances: currentAdvances,
        advanceLogs
      };

      const updatedEvent = {
        ...targetEvent,
        quote: updatedQuote
      };

      try {
        await deleteEventAdvanceApi(targetEvent.id, advanceId, {
          actorId,
          actorName,
          reason: 'Eliminado desde Estado de Cuenta Contable'
        });
      } catch (atomicDelErr) {
        console.warn('Advertencia en eliminación atómica de anticipo:', atomicDelErr);
      }

      await handleAddEvent(updatedEvent);

      const sortedAdvances = currentAdvances.slice().sort((a, b) => {
        const d = String(a.date || "").localeCompare(String(b.date || ""));
        if (d !== 0) return d;
        return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      });
      const rawAdvTotal = sortedAdvances.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
      const isUsd = !!activeEventStatementRow.isUsd;
      const rate = activeEventStatementRow.exchangeRate || 1;
      const advTotal = isUsd ? Math.round(rawAdvTotal * rate * 100) / 100 : rawAdvTotal;
      const totalGtq = effectiveQuoteTotalGtq > 0 ? effectiveQuoteTotalGtq : (Number(activeEventStatementRow.total) || 0);
      const delta = totalGtq - advTotal;

      setActiveEventStatementRow(prev => ({
        ...prev,
        quote: updatedQuote,
        total: totalGtq,
        advances: sortedAdvances,
        advancesCount: sortedAdvances.length,
        advancesTotal: advTotal,
        delta,
        balancePending: Math.max(0, delta),
        creditBalance: Math.max(0, -delta),
      }));

      if (String(advanceEditingId) === String(advanceId)) {
        resetAdvanceForm();
        setShowAdvanceForm(false);
      }

      toast.success('Abono eliminado correctamente');
    } catch (err) {
      console.error('Error al eliminar abono:', err);
      toast.error('No se pudo eliminar el abono');
    }
  };

  // ── Cargar empresas al montar ──
  useEffect(() => {
    let active = true;
    const loadCompanies = async () => {
      try {
        const response = await loadCrmState({ cacheBust: false });
        if (active) {
          setCompanies(response?.companies || []);
        }
      } catch (err) {
        console.error('Error al cargar empresas:', err);
      }
    };
    loadCompanies();
    return () => { active = false; };
  }, []);

  const normalizeQuoteAdvancesForSnapshot = (rawAdvances) => {
    const list = Array.isArray(rawAdvances) ? rawAdvances : [];
    return list.map((item, index) => {
      const amount = Number(item?.amount || 0);
      return {
        id: String(item?.id || `adv_${index + 1}`),
        amount: Number.isFinite(amount) ? Math.max(0, amount) : 0,
        paymentType: String(item?.paymentType || 'Transferencia'),
        date: String(item?.date || ''),
        voucherNumber: String(item?.voucherNumber || item?.boleta || ''),
        description: String(item?.description || ''),
        createdAt: String(item?.createdAt || ''),
        createdByUserId: String(item?.createdByUserId || item?.userId || ''),
        createdByName: String(item?.createdByName || item?.userName || item?.vendedor || item?.user || ''),
        evidenceName: String(item?.evidenceName || ''),
        evidenceType: String(item?.evidenceType || ''),
        evidenceDataUrl: String(item?.evidenceDataUrl || '')
      };
    }).filter(item => item.amount >= 0);
  };

  const stripTime = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const fmtDateShort = (d) => {
    if (!d) return '-';
    return d.toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
  };

  const parseQuoteDate = (raw) => {
    if (!raw) return null;
    let d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return stripTime(d);
    d = new Date(`${raw}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : stripTime(d);
  };

  // ── Clasificación de Estado de Cartera ──
  const summarizeAccountingCollectionState = (account) => {
    const pending = Math.max(0, Number(account?.pendingAmount || 0));
    const credit = Math.max(0, Number(account?.creditAmount || 0));
    const due = parseQuoteDate(String(account?.nextDueDate || "").trim());

    if (credit > 0 && pending <= 0) {
      return {
        label: "Saldo a favor",
        tone: "credit",
        badgeText: "Saldo a Favor",
        eta: "Disponible para aplicación",
        dueLabel: "Sin cobro pendiente",
        sortWeight: 4,
        daysOverdue: 0,
      };
    }
    if (pending <= 0) {
      return {
        label: "Al día",
        tone: "ok",
        badgeText: "Al Día",
        eta: "Sin gestión pendiente",
        dueLabel: "Cuenta al día",
        sortWeight: 3,
        daysOverdue: 0,
      };
    }
    if (!due) {
      return {
        label: "En plazo",
        tone: "neutral",
        badgeText: "En Plazo",
        eta: "Cobro programado",
        dueLabel: "Por definir",
        sortWeight: 2,
        daysOverdue: 0,
      };
    }

    const today = stripTime(new Date());
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

    if (diffDays < 0) {
      const days = Math.abs(diffDays);
      return {
        label: `Vencido ${days} ${days === 1 ? "día" : "días"}`,
        tone: "overdue",
        badgeText: `Vencido ${days} días`,
        eta: "Solicitar pago hoy",
        dueLabel: fmtDateShort(due),
        sortWeight: 0,
        daysOverdue: days,
      };
    }
    if (diffDays <= 15) {
      return {
        label: `Por vencer ${diffDays} ${diffDays === 1 ? "día" : "días"}`,
        tone: "due",
        badgeText: `Por Vencer (${diffDays}d)`,
        eta: diffDays <= 3 ? "Solicitar pago hoy" : "Recordatorio previo",
        dueLabel: fmtDateShort(due),
        sortWeight: 1,
        daysOverdue: 0,
      };
    }
    return {
      label: "Al día",
      tone: "ok",
      badgeText: "Al Día",
      eta: "En plazo pactado",
      dueLabel: fmtDateShort(due),
      sortWeight: 2,
      daysOverdue: 0,
    };
  };

  const calculateEventDueDate = (eventDateStr, quoteDueDate) => {
    if (quoteDueDate) return quoteDueDate;
    if (!eventDateStr) return '';
    try {
      const d = new Date(eventDateStr + 'T00:00:00');
      d.setDate(d.getDate() - 30);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (_) {
      return eventDateStr;
    }
  };

  const normalizeCleanText = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const isMatchingCompanyName = (nameA, nameB) => {
    const a = normalizeCleanText(nameA);
    const b = normalizeCleanText(nameB);
    if (!a || !b) return false;
    if (a === b) return true;
    const partsA = a.split(/[\(\)\-\/–]/).map((s) => s.trim()).filter((s) => s.length >= 3);
    const partsB = b.split(/[\(\)\-\/–]/).map((s) => s.trim()).filter((s) => s.length >= 3);
    if (partsA.some((p) => p === b) || partsB.some((p) => p === a)) return true;
    return false;
  };

  /**
   * Resuelve la empresa legítima de una reserva.
   * Previene la contaminación producida por companyId residual/heredado de plantillas duplicadas
   * (ej. eventos sociales con companyId: 10 de otra empresa).
   */
  const resolveEventCompany = (allCompanies = [], quote = {}, event = {}, primary = {}) => {
    const rawCompanyId = quote?.companyId || event?.companyId || primary?.companyId || '';
    const explicitName = String(
      quote?.companyName || quote?.company || quote?.billTo || ''
    ).trim();
    const fallbackClientName = String(
      event?.clientName || primary?.clientName || ''
    ).trim();

    let matched = null;

    // 1. Si hay un nombre de empresa explícito escrito en la cotización:
    if (explicitName) {
      if (rawCompanyId) {
        const candidateById = allCompanies.find((c) => String(c.id || '') === String(rawCompanyId));
        if (candidateById && isMatchingCompanyName(candidateById.name, explicitName)) {
          matched = candidateById;
        }
      }

      if (!matched) {
        matched = allCompanies.find((c) => isMatchingCompanyName(c.name, explicitName)) || null;
      }

      const finalName = matched ? matched.name : explicitName;
      const finalToken = matched ? `id:${matched.id}` : `name:${normalizeCleanText(explicitName)}`;

      return {
        matchedCompany: matched,
        companyId: matched ? matched.id : '',
        companyName: finalName,
        companyToken: finalToken,
        nit: matched?.nit || quote?.nit || '',
        companyType: matched?.category || matched?.tipo || 'General'
      };
    }

    // 2. Si no hay explicitName pero sí rawCompanyId:
    if (rawCompanyId) {
      const candidate = allCompanies.find((c) => String(c.id || '') === String(rawCompanyId));
      if (candidate) {
        return {
          matchedCompany: candidate,
          companyId: candidate.id,
          companyName: candidate.name,
          companyToken: `id:${candidate.id}`,
          nit: candidate.nit || quote?.nit || '',
          companyType: candidate.category || candidate.tipo || 'General'
        };
      }
    }

    // 3. Si solo hay clientName:
    if (fallbackClientName) {
      const candidate = allCompanies.find((c) => isMatchingCompanyName(c.name, fallbackClientName));
      if (candidate) {
        return {
          matchedCompany: candidate,
          companyId: candidate.id,
          companyName: candidate.name,
          companyToken: `id:${candidate.id}`,
          nit: candidate.nit || quote?.nit || '',
          companyType: candidate.category || candidate.tipo || 'General'
        };
      }

      return {
        matchedCompany: null,
        companyId: '',
        companyName: fallbackClientName,
        companyToken: `name:${normalizeCleanText(fallbackClientName)}`,
        nit: quote?.nit || '',
        companyType: 'Particular'
      };
    }

    // 4. Nombre del evento
    const eventName = String(primary?.name || event?.name || '').trim();
    if (eventName) {
      return {
        matchedCompany: null,
        companyId: '',
        companyName: eventName,
        companyToken: `event:${normalizeCleanText(eventName)}`,
        nit: quote?.nit || '',
        companyType: 'Evento'
      };
    }

    return {
      matchedCompany: null,
      companyId: '',
      companyName: 'Consumidor Final / Sin Empresa',
      companyToken: `single:${event?.id || Math.random()}`,
      nit: quote?.nit || '',
      companyType: 'General'
    };
  };

  const resolveEventContact = (quote = {}, event = {}, primary = {}, matchedCompany = null) => {
    const explicitName = String(
      quote?.managerName || quote?.contact || primary?.contact || event?.contact || ''
    ).trim();
    const explicitPhone = String(
      quote?.phone || quote?.contactPhone || primary?.phone || event?.phone || ''
    ).trim();
    const explicitEmail = String(
      quote?.email || quote?.contactEmail || primary?.email || event?.email || ''
    ).trim();

    if (explicitName) {
      let managerPhone = explicitPhone;
      let managerEmail = explicitEmail;
      if (matchedCompany?.managers?.length) {
        const matchedMgr = matchedCompany.managers.find(
          (m) =>
            String(m.id || '') === String(quote?.managerId || '') ||
            normalizeCleanText(m.name) === normalizeCleanText(explicitName)
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

    if (matchedCompany) {
      const specificMgr = quote?.managerId
        ? matchedCompany.managers?.find((m) => String(m.id || '') === String(quote?.managerId))
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

    return {
      contact: '',
      contactPhone: explicitPhone || '',
      contactEmail: explicitEmail || '',
    };
  };

  // ── 1. Construcción de Filas de Eventos ──
  const reportData = useMemo(() => {
    if (!events) return [];
    const rows = [];
    const seenReservations = new Set();

    for (const ev of events) {
      if (ev.status === 'Cancelado' || ev.status === 'Mantenimiento') continue;
      const reservationKey = ev.groupId || ev.id_grupo || ev.idGroup || ev.id;
      if (reservationKey) {
        if (seenReservations.has(reservationKey)) continue;
        seenReservations.add(reservationKey);
      }
      const financialMeta = getEventSeriesFinancialMeta(ev, events);
      const primaryEvent = financialMeta.primaryEvent || ev;

      // En estados de cuenta contables, la cartera de cobro registra exclusivamente eventos Confirmados
      const statusPrimary = String(primaryEvent?.status || '').trim().toLowerCase();
      const statusEv = String(ev?.status || '').trim().toLowerCase();
      const isConfirmed = statusPrimary === 'confirmado' || statusEv === 'confirmado' ||
        (Array.isArray(financialMeta?.series) && financialMeta.series.some(s => String(s?.status || '').trim().toLowerCase() === 'confirmado'));
      if (!isConfirmed) continue;

      // Descartar registros huérfanos/borradores sin fecha legítima o sin nombre de evento (ej. época Unix 1970-01-01)
      const rawDate = financialMeta.startDate || primaryEvent?.date || ev?.date || '';
      if (!rawDate || rawDate.startsWith('1970') || rawDate <= '1970-01-01') continue;

      const eventName = String(primaryEvent?.name || ev?.name || '').trim();
      if (!eventName || eventName === '(sin nombre)') continue;

      const quote = primaryEvent?.quote || ev?.quote || {};
      const assignedUser = users?.find(u => u.id === (primaryEvent?.userId || ev?.userId));
      const advances = normalizeQuoteAdvancesForSnapshot(quote?.advances);
      const advancesSorted = advances.slice().sort((a, b) => {
        const d = String(a.date || "").localeCompare(String(b.date || ""));
        if (d !== 0) return d;
        return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      });
      const lastAdvance = advancesSorted.length ? advancesSorted[advancesSorted.length - 1] : null;
      const finAmounts = getQuoteFinancialAmounts(quote);
      const total = finAmounts.totalGtq;
      const rawAdvancesTotal = advancesSorted.reduce((acc, item) => acc + Math.max(0, Number(item.amount || 0)), 0);
      const advancesTotal = finAmounts.isUsd ? Math.round(rawAdvancesTotal * finAmounts.exchangeRate * 100) / 100 : rawAdvancesTotal;
      const delta = total - advancesTotal;
      
      const compInfo = resolveEventCompany(companies, quote, ev, primaryEvent);
      const contactInfo = resolveEventContact(quote, ev, primaryEvent, compInfo.matchedCompany);
      const matchedCompany = compInfo.matchedCompany;
      const companyId = compInfo.companyId;
      const companyName = compInfo.companyName;
      const companyToken = compInfo.companyToken;

      const eventDate = financialMeta.startDate || primaryEvent?.date || ev?.date || '';
      const calculatedDue = calculateEventDueDate(eventDate, quote?.dueDate);

      rows.push({
        id: ev.id,
        actionEventId: primaryEvent?.id || ev?.id,
        companyId,
        companyName,
        companyToken,
        companyType: compInfo.companyType,
        refId: quote?.code || reservationKey || primaryEvent?.id || ev?.id || '',
        name: primaryEvent?.name || ev?.name || '',
        eventDate,
        endDate: financialMeta.endDate || financialMeta.startDate || ev?.date || '',
        startTime: financialMeta.startTime || primaryEvent?.startTime || ev?.startTime || '',
        endTime: financialMeta.endTime || primaryEvent?.endTime || ev?.endTime || '',
        salon: financialMeta.mainSalon || primaryEvent?.salon || ev?.salon || 'Salón Principal',
        salones: financialMeta.salones,
        salonesLabel: financialMeta.salones.join(', '),
        status: primaryEvent?.status || ev?.status || 'Confirmado',
        userId: primaryEvent?.userId || ev?.userId,
        userName: assignedUser?.fullName || assignedUser?.name || 'Sin asignar',
        seller: assignedUser?.fullName || assignedUser?.name || 'Sin asignar',
        clientName: contactInfo.contact || ev.clientName || quote?.companyName || quote?.contact || '',
        manager: contactInfo.contact || quote?.contact || matchedCompany?.owner || '',
        managerPhone: contactInfo.contactPhone || quote?.phone || matchedCompany?.phone || '',
        managerEmail: contactInfo.contactEmail || quote?.email || matchedCompany?.email || '',
        pax: Number(primaryEvent?.pax || ev?.pax || quote?.people || 0),
        quote,
        dueDate: calculatedDue,
        docDate: quote?.docDate || '',
        paymentType: quote?.paymentType || '',
        subtotal: quote?.subtotal || 0,
        discount: quote?.discountValue || 0,
        advances: advancesSorted,
        advancesCount: advancesSorted.length,
        total,
        advancesTotal,
        delta,
        rawTotal: finAmounts.rawTotal,
        isUsd: finAmounts.isUsd,
        exchangeRate: finAmounts.exchangeRate,
        exchangeRateDate: finAmounts.exchangeRateDate || quote?.exchangeRateDate || null,
        balancePending: Math.max(0, delta),
        creditBalance: Math.max(0, -delta),
        balanceFavor: Math.max(0, -delta),
        lastAdvanceDate: lastAdvance?.date ? String(lastAdvance.date) : '',
        lastAdvancePaymentType: lastAdvance?.paymentType ? String(lastAdvance.paymentType) : '',
        lastAdvanceDescription: lastAdvance?.description ? String(lastAdvance.description) : '',
        folio: quote?.folio || quote?.code || '',
        statusColor: STATUS_META[primaryEvent?.status || ev?.status]?.color || '#64748b'
      });
    }
    return rows;
  }, [events, users, companies]);

  // ── 2. Filtrado de Eventos (LIKE bajo demanda + secundarios) ──
  const filteredData = useMemo(() => {
    let filtered = reportData;

    // Filtro bajo demanda aplicado
    if (appliedSearch) {
      const term = appliedSearch.toLowerCase().trim();
      filtered = filtered.filter(r =>
        r.companyName?.toLowerCase().includes(term) ||
        r.name?.toLowerCase().includes(term) ||
        r.clientName?.toLowerCase().includes(term) ||
        r.refId?.toLowerCase().includes(term) ||
        r.folio?.toLowerCase().includes(term) ||
        r.userName?.toLowerCase().includes(term) ||
        r.managerPhone?.toLowerCase().includes(term) ||
        r.salon?.toLowerCase().includes(term)
      );
    }

    // Filtros de fecha
    if (dateFrom) filtered = filtered.filter(r => (r.eventDate || '') >= dateFrom);
    if (dateTo) filtered = filtered.filter(r => (r.eventDate || '') <= dateTo);

    // Filtro de vendedor
    if (sellerFilter) filtered = filtered.filter(r => String(r.userId || '') === String(sellerFilter));

    // Filtro de estado del evento
    if (statusFilter) filtered = filtered.filter(r => String(r.status || '') === String(statusFilter));

    // Filtro de salón
    if (salonFilter) filtered = filtered.filter(r => r.salon === salonFilter || (Array.isArray(r.salones) && r.salones.includes(salonFilter)));

    // Filtro de tipo de institución
    if (institutionTypeFilter) filtered = filtered.filter(r => String(r.companyType || '').toLowerCase() === institutionTypeFilter.toLowerCase());

    return filtered;
  }, [reportData, appliedSearch, dateFrom, dateTo, sellerFilter, statusFilter, salonFilter, institutionTypeFilter]);

  // ── 3. Agrupación Consolidada por Empresa (Accounts) ──
  const allAccounts = useMemo(() => {
    const groups = new Map();
    for (const row of filteredData) {
      const key = String(
        row?.companyToken ||
        (row?.companyId ? `id:${row.companyId}` : (row?.companyName ? `name:${normalizeCleanText(row.companyName)}` : `row:${row?.id}`))
      );
      const account = groups.get(key) || {
        key,
        companyId: String(row?.companyId || ""),
        companyToken: key,
        companyName: String(row?.companyName || "Sin institución").trim() || "Sin institución",
        companyType: row?.companyType || "General",
        contactPhone: String(row?.managerPhone || "").trim(),
        rows: [],
        netAmount: 0,
        collectedAmount: 0,
        pendingAmount: 0,
        creditAmount: 0,
        eventsCount: 0,
        pendingEventsCount: 0,
        paidEventsCount: 0,
        advancesCount: 0,
        sellerMap: new Map(),
        lastAdvanceDate: "",
        nextDueDate: "",
      };
      account.rows.push(row);
      account.netAmount += Math.max(0, Number(row?.total || 0));
      account.collectedAmount += Math.max(0, Number(row?.advancesTotal || 0));
      account.pendingAmount += Math.max(0, Number(row?.balancePending || 0));
      account.creditAmount += Math.max(0, Number(row?.creditBalance || 0));
      account.eventsCount += 1;
      account.advancesCount += Math.max(0, Number(row?.advancesCount || 0));
      if (Number(row?.balancePending || 0) > 0) account.pendingEventsCount += 1;
      else account.paidEventsCount += 1;

      if (row?.userName) {
        const seller = String(row.userName).trim();
        account.sellerMap.set(seller, Number(account.sellerMap.get(seller) || 0) + Math.max(0, Number(row?.total || 0)));
      }
      if (row?.lastAdvanceDate && (!account.lastAdvanceDate || String(row.lastAdvanceDate).localeCompare(account.lastAdvanceDate) > 0)) {
        account.lastAdvanceDate = String(row.lastAdvanceDate);
      }
      if (Number(row?.balancePending || 0) > 0 && row?.dueDate && (!account.nextDueDate || String(row.dueDate).localeCompare(account.nextDueDate) < 0)) {
        account.nextDueDate = String(row.dueDate);
      }
      groups.set(key, account);
    }

    return Array.from(groups.values()).map((account) => {
      const sellerEntry = Array.from(account.sellerMap.entries()).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))[0];
      const collection = summarizeAccountingCollectionState(account);
      return {
        ...account,
        primarySeller: sellerEntry?.[0] || "Sin asignar",
        collectionLabel: collection.label,
        collectionTone: collection.tone,
        collectionBadgeText: collection.badgeText,
        collectionEta: collection.eta,
        collectionDueLabel: collection.dueLabel,
        collectionSortWeight: collection.sortWeight,
        daysOverdue: collection.daysOverdue,
      };
    });
  }, [filteredData]);

  // ── 4. Conteo de Pestañas de Estado ──
  const statusCounts = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    let upToDate = 0;
    let credit = 0;
    for (const a of allAccounts) {
      if (a.collectionTone === 'overdue') overdue++;
      else if (a.collectionTone === 'due') dueSoon++;
      else if (a.collectionTone === 'credit') credit++;
      else upToDate++;
    }
    return {
      all: allAccounts.length,
      overdue,
      dueSoon,
      upToDate,
      credit,
    };
  }, [allAccounts]);

  // ── 5. Filtrado por Pestaña de Estado y Ordenamiento ──
  const accounts = useMemo(() => {
    let list = allAccounts;

    if (statusTab === 'OVERDUE') list = list.filter(a => a.collectionTone === 'overdue');
    else if (statusTab === 'DUE_SOON') list = list.filter(a => a.collectionTone === 'due');
    else if (statusTab === 'UP_TO_DATE') list = list.filter(a => a.collectionTone === 'ok');
    else if (statusTab === 'CREDIT') list = list.filter(a => a.collectionTone === 'credit');

    return list.slice().sort((a, b) => {
      if (sortBy === 'PENDING_DESC') return Number(b.pendingAmount || 0) - Number(a.pendingAmount || 0);
      if (sortBy === 'PENDING_ASC') return Number(a.pendingAmount || 0) - Number(b.pendingAmount || 0);
      if (sortBy === 'NET_DESC') return Number(b.netAmount || 0) - Number(a.netAmount || 0);
      if (sortBy === 'NAME_ASC') return String(a.companyName || "").localeCompare(String(b.companyName || ""));
      if (sortBy === 'DUE_ASC') return (a.collectionSortWeight - b.collectionSortWeight) || (Number(b.pendingAmount || 0) - Number(a.pendingAmount || 0));
      return 0;
    });
  }, [allAccounts, statusTab, sortBy]);

  // ── 6. Resumen General para KPIs y Diagnóstico ──
  const summary = useMemo(() => {
    const netAmount = allAccounts.reduce((acc, a) => acc + Math.max(0, Number(a.netAmount || 0)), 0);
    const collectedAmount = allAccounts.reduce((acc, a) => acc + Math.max(0, Number(a.collectedAmount || 0)), 0);
    const pendingAmount = allAccounts.reduce((acc, a) => acc + Math.max(0, Number(a.pendingAmount || 0)), 0);
    const creditAmount = allAccounts.reduce((acc, a) => acc + Math.max(0, Number(a.creditAmount || 0)), 0);
    const totalEvents = allAccounts.reduce((acc, a) => acc + Number(a.eventsCount || 0), 0);
    const totalAdvances = allAccounts.reduce((acc, a) => acc + Number(a.advancesCount || 0), 0);
    const overdueCount = statusCounts.overdue;
    const amortizationRate = netAmount > 0 ? (collectedAmount / netAmount) * 100 : 0;

    return {
      netAmount,
      collectedAmount,
      pendingAmount,
      creditAmount,
      totalEvents,
      totalAdvances,
      overdueCount,
      amortizationRate,
    };
  }, [allAccounts, statusCounts]);

  // ── 7. Paginación de Cuentas ──
  const totalPages = Math.max(1, Math.ceil(accounts.length / pageSize));
  const paginatedAccounts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return accounts.slice(start, start + pageSize);
  }, [accounts, currentPage, pageSize]);

  const handlePageChange = (p) => {
    if (p >= 1 && p <= totalPages) setCurrentPage(p);
  };

  // ── Manejo de Búsqueda ──
  const handleTriggerSearch = (e) => {
    if (e) e.preventDefault();
    setAppliedSearch(searchDraft.trim().toLowerCase());
    setCurrentPage(1);
  };
  const handleApplySearch = handleTriggerSearch;

  const handleClearSearch = () => {
    setSearchDraft('');
    setAppliedSearch('');
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchDraft('');
    setAppliedSearch('');
    setDateFrom('');
    setDateTo('');
    setSellerFilter('');
    setStatusTab('ALL');
    setStatusFilter('');
    setSalonFilter('');
    setInstitutionTypeFilter('');
    setCurrentPage(1);
  };

  const handleResetSecondaryFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSellerFilter('');
    setSalonFilter('');
    setInstitutionTypeFilter('');
    setCurrentPage(1);
  };

  const handleDatePreset = (preset) => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const pad = (n) => String(n).padStart(2, '0');

    if (preset === 'THIS_MONTH') {
      const firstDay = `${y}-${pad(m + 1)}-01`;
      const lastDayObj = new Date(y, m + 1, 0);
      const lastDay = `${y}-${pad(m + 1)}-${pad(lastDayObj.getDate())}`;
      setDateFrom(firstDay);
      setDateTo(lastDay);
    } else if (preset === 'NEXT_30') {
      const fromStr = `${y}-${pad(m + 1)}-${pad(today.getDate())}`;
      const future = new Date(today);
      future.setDate(future.getDate() + 30);
      const toStr = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`;
      setDateFrom(fromStr);
      setDateTo(toStr);
    } else if (preset === 'THIS_YEAR') {
      setDateFrom(`${y}-01-01`);
      setDateTo(`${y}-12-31`);
    } else if (preset === 'ALL') {
      setDateFrom('');
      setDateTo('');
    }
  };

  const secondaryFiltersCount = [dateFrom, dateTo, sellerFilter, salonFilter, institutionTypeFilter].filter(Boolean).length;

  const toggleExpandAccount = (key) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const activeStatementAccount = useMemo(() => {
    if (!activeStatementCompanyId) return null;
    return allAccounts.find(a => String(a.key) === String(activeStatementCompanyId) || (a.companyId && String(a.companyId) === String(activeStatementCompanyId))) || null;
  }, [allAccounts, activeStatementCompanyId]);

  // ── Exportar a Excel (.xlsx) ──
  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Hoja 1: Resumen por Empresa
      const companyData = accounts.map((a, i) => ({
        '#': i + 1,
        'Estado Cartera': a.collectionBadgeText,
        'Institución / Empresa': a.companyName,
        'Ejecutivo Asignado': a.primarySeller,
        'Teléfono': a.contactPhone || 'S/N',
        'No. Eventos': a.eventsCount,
        'Venta Neta (GTQ)': a.netAmount,
        'Cobrado (GTQ)': a.collectedAmount,
        'Saldo Pendiente (GTQ)': a.pendingAmount,
        'Saldo a Favor (GTQ)': a.creditAmount,
        'Propuesta de Cobro': a.collectionDueLabel,
        'Acción Recomendada': a.collectionEta,
      }));
      const ws1 = XLSX.utils.json_to_sheet(companyData);
      ws1['!cols'] = [
        { wch: 5 }, { wch: 18 }, { wch: 36 }, { wch: 24 }, { wch: 14 },
        { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
        { wch: 18 }, { wch: 28 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, 'Cartera por Empresa');

      // Hoja 2: Detalle de Eventos
      const eventsData = [];
      accounts.forEach(a => {
        a.rows.forEach(r => {
          eventsData.push({
            'Empresa': a.companyName,
            'Cotización / Folio': r.folio || r.refId,
            'Nombre del Evento': r.name,
            'Fecha Evento': r.eventDate,
            'Salón': r.salon,
            'Vendedor': r.userName,
            'PAX': r.pax,
            'Total Contratado (GTQ)': r.total,
            'Total Cobrado (GTQ)': r.advancesTotal,
            'Saldo Pendiente (GTQ)': r.balancePending,
            'Moneda Original': r.isUsd ? 'USD' : 'GTQ',
            'Tasa de Cambio': r.isUsd ? r.exchangeRate : 1,
          });
        });
      });
      const ws2 = XLSX.utils.json_to_sheet(eventsData);
      ws2['!cols'] = [
        { wch: 30 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 18 },
        { wch: 22 }, { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
        { wch: 14 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Detalle de Eventos');

      XLSX.writeFile(wb, `Estado_de_Cuenta_Contable_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Reporte Excel generado exitosamente ✓');
    } catch (err) {
      console.error('Error al exportar Excel:', err);
      toast.error('Error al generar el archivo Excel.');
    }
  };

  // ── Imprimir Estado de Cuenta del Evento ──
  const printEventStatement = (row) => {
    if (!row) return;
    const w = window.open('', '_blank', 'width=950,height=800');
    if (!w) return;
    const baseUrl = window.location.origin;
    const now = new Date().toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' });
    const quote = row.quote || {};
    const items = quote.items || [];
    const categorized = categorizeQuoteItems(items);
    const advances = row.advances || [];

    const finAmounts = getQuoteFinancialAmounts(quote, row.exchangeRate);
    const effectiveTotal = Number(row.total) > 0 ? Number(row.total) : finAmounts.totalGtq;
    const effectiveAdvTotal = Number(row.advancesTotal) || 0;
    const effectiveDelta = effectiveTotal - effectiveAdvTotal;
    const effectivePending = Math.max(0, effectiveDelta);
    const effectiveCredit = Math.max(0, -effectiveDelta);
    const effectivePaidPct = effectiveTotal > 0 ? ((effectiveAdvTotal / effectiveTotal) * 100).toFixed(1) : (effectiveAdvTotal > 0 ? '100.0' : '0.0');
    const effectiveRawUsd = Number(row.rawTotal || finAmounts.rawTotal || 0);

    const currencySymbol = row.isUsd ? '$' : 'Q';

    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Estado de Cuenta - ${row.folio || row.name || 'Evento'}</title>
<style>
  @page { margin: 15mm 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', -apple-system, Arial, sans-serif; color: #0f172a; padding: 24px; font-size: 11.5px; line-height: 1.45; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #0f172a; margin-bottom: 18px; }
  .header .logo { height: 60px; }
  .header h1 { font-size: 18px; color: #0f172a; letter-spacing: 0.5px; margin-bottom: 2px; }
  .header .sub { font-size: 10px; color: #64748b; }
  .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px; }
  .meta-col { display: flex; flex-direction: column; gap: 4px; }
  .meta-item { display: flex; justify-content: space-between; font-size: 11px; }
  .meta-label { color: #64748b; font-weight: 600; }
  .meta-value { font-weight: 700; color: #0f172a; text-align: right; }
  .section-title { font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin: 16px 0 8px; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; display: flex; justify-content: space-between; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #f1f5f9; padding: 7px 10px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; text-align: left; border-bottom: 1px solid #cbd5e1; }
  th.right { text-align: right; }
  th.center { text-align: center; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  td.right { text-align: right; }
  td.center { text-align: center; }
  .kpi-summary-box { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
  .kpi-box { text-align: center; }
  .kpi-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.05em; }
  .kpi-val { font-size: 14px; font-weight: 800; margin-top: 2px; }
  .bank-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 10px 14px; margin-top: 18px; font-size: 10.5px; color: #0369a1; }
  .signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 60px; margin-top: 40px; padding-top: 10px; }
  .sig-col { text-align: center; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 10.5px; font-weight: 700; }
  .footer { text-align: center; margin-top: 24px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  @media print { body { padding: 0; } }
</style></head><body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      <img class="logo" src="${baseUrl}/Oficial_JDL_acua.png" alt="JDL" onerror="this.style.display='none'">
      <div>
        <h1>JARDINES DEL LAGO</h1>
        <div class="sub">Departamento de Contabilidad y Control de Cobranza</div>
        <div class="sub" style="font-weight:700;color:#0f172a;margin-top:2px;">ESTADO DE CUENTA DE EVENTO</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-weight:800;font-size:14px;color:#0284c7;">FOLIO: ${row.folio || row.refId || '-'}</div>
      <div style="font-size:10px;color:#64748b;">Emisión: ${now}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-col">
      <div class="meta-item"><span class="meta-label">Institución / Cliente:</span><span class="meta-value">${row.companyName || row.clientName || 'Cliente Particular'}</span></div>
      <div class="meta-item"><span class="meta-label">Nombre del Evento:</span><span class="meta-value">${row.name || 'Sin título'}</span></div>
      <div class="meta-item"><span class="meta-label">Salón Asignado:</span><span class="meta-value">${row.salonesLabel || row.salon || 'Salón Principal'}</span></div>
      <div class="meta-item"><span class="meta-label">Asistentes (PAX):</span><span class="meta-value">${row.pax || 0} personas</span></div>
    </div>
    <div class="meta-col">
      <div class="meta-item"><span class="meta-label">Fecha del Evento:</span><span class="meta-value">${row.eventDate || '-'}</span></div>
      <div class="meta-item"><span class="meta-label">Horario Programado:</span><span class="meta-value">${row.startTime || '-'} a ${row.endTime || '-'}</span></div>
      <div class="meta-item"><span class="meta-label">Ejecutivo Asignado:</span><span class="meta-value">${row.userName || 'Sin asignar'}</span></div>
      <div class="meta-item"><span class="meta-label">Teléfono / Contacto:</span><span class="meta-value">${row.managerPhone || '-'}</span></div>
    </div>
  </div>

  <!-- Desglose por Categorías -->
  ${Object.entries(categorized).map(([key, sec]) => {
    if (!sec.items.length) return '';
    return `
      <div class="section-title">
        <span>${sec.title}</span>
        <span>Subtotal: Q ${Number(sec.subtotal).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <table>
        <thead><tr><th>Descripción del Servicio</th><th class="center" style="width:70px;">Cant.</th><th class="right" style="width:110px;">Precio Unit.</th><th class="right" style="width:120px;">Subtotal</th></tr></thead>
        <tbody>
          ${sec.items.map(it => `
            <tr>
              <td><strong>${it.name || it.description || 'Servicio'}</strong>${it.notes ? `<br><small style="color:#64748b;">${it.notes}</small>` : ''}</td>
              <td class="center">${it.qty}</td>
              <td class="right">${currencySymbol} ${Number(it.price || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
              <td class="right" style="font-weight:700;">${currencySymbol} ${Number(it.total || (it.qty * it.price)).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }).join('')}

  <!-- Resumen Financiero -->
  <div class="kpi-summary-box">
    <div class="kpi-box">
      <div class="kpi-label">Total Contratado</div>
      <div class="kpi-val" style="color:#0f172a;">Q ${effectiveTotal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</div>
      ${row.isUsd ? `<small style="font-size:9px;color:#64748b;">$${effectiveRawUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD (TC Q${Number(row.exchangeRate || 7.75).toFixed(2)})</small>` : ''}
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Total Abonado</div>
      <div class="kpi-val" style="color:#16a34a;">Q ${effectiveAdvTotal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</div>
      <small style="font-size:9px;color:#16a34a;">${effectivePaidPct}% pagado</small>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Saldo Pendiente</div>
      <div class="kpi-val" style="color:${effectivePending > 0 ? '#dc2626' : '#16a34a'};">Q ${effectivePending.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</div>
      <small style="font-size:9px;color:${effectivePending > 0 ? '#dc2626' : '#16a34a'};">${effectivePending > 0 ? 'Por cancelar' : 'Al día'}</small>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Saldo a Favor</div>
      <div class="kpi-val" style="color:#7c3aed;">Q ${effectiveCredit.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</div>
      <small style="font-size:9px;color:#7c3aed;">Disponible</small>
    </div>
  </div>

  <!-- Detalle de Abonos y Boletas -->
  <div class="section-title">
    <span>Historial Cronológico de Abonos / Anticipos</span>
    <span>${advances.length} abono(s) registrado(s)</span>
  </div>
  <table>
    <thead><tr><th style="width:30px;">#</th><th style="width:85px;">Fecha</th><th style="width:110px;">Forma Pago</th><th style="width:120px;">No. Boleta / Ref</th><th>Concepto</th><th style="width:130px;">Aplicado Por</th><th class="right" style="width:110px;">Monto Abonado</th></tr></thead>
    <tbody>
      ${advances.length === 0 ? `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:12px;">No se han registrado anticipos para este evento.</td></tr>` : advances.map((a, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${a.date || '-'}</td>
          <td><span style="font-weight:600;">${a.paymentType || '-'}</span></td>
          <td><strong style="color:#0369a1;">${a.voucherNumber || 'S/N'}</strong></td>
          <td>${a.description || '-'}</td>
          <td><span style="font-weight:600;color:#334155;">${a.createdByName || a.userName || row.userName || 'Sistema'}</span></td>
          <td class="right" style="font-weight:800;color:#16a34a;">Q ${Number(a.amount || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Cuentas Bancarias -->
  <div class="bank-box">
    <strong>📌 Cuentas Bancarias Autorizadas para Pagos (Jardines del Lago):</strong><br>
    • <strong>Banco Industrial:</strong> Monetaria No. <strong>027-005432-1</strong> a nombre de Jardines del Lago, S.A.<br>
    • <strong>Banrural:</strong> Monetaria No. <strong>342-019876-5</strong> a nombre de Jardines del Lago, S.A.<br>
    • <strong>G&T Continental:</strong> Monetaria No. <strong>018-002345-9</strong> a nombre de Jardines del Lago, S.A.
  </div>

  <div class="signatures">
    <div class="sig-col">
      Administración y Cobros<br>
      <strong>Jardines del Lago</strong>
    </div>
    <div class="sig-col">
      Aceptación y Conformidad<br>
      <strong>${row.companyName || row.clientName || 'Cliente / Empresa'}</strong>
    </div>
  </div>

  <div class="footer">
    Documento generado el ${now} por Sistema · EMS Reservas Jardines del Lago
  </div>

  <script>window.onload = function() { window.print(); window.close(); };<\/script>
</body></html>`);
    w.document.close();
  };

  // ── Imprimir Estado de Cuenta de Empresa ──
  const printCompanyStatement = (account) => {
    if (!account) return;
    const companyData = companies.find(c => String(c.id) === String(account.companyId));
    const advancesList = account.rows.reduce((acc, row) => {
      const eventAdvances = Array.isArray(row?.advances) ? row.advances.map(a => ({ ...a, eventId: row.id, refId: row.refId, eventDate: row.eventDate })) : [];
      return acc.concat(eventAdvances);
    }, []).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

    const w = window.open('', '_blank', 'width=950,height=750');
    if (!w) return;
    const baseUrl = window.location.origin;
    const now = new Date().toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' });

    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Estado de Cuenta - ${account.companyName}</title>
<style>
  @page { margin: 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 20px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
  .logo { height: 55px; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; }
  th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  .right { text-align: right; }
  .summary { display: flex; justify-content: flex-end; gap: 20px; margin-top: 16px; border-top: 2px solid #0f172a; padding-top: 12px; }
  .sum-box { text-align: right; }
</style></head><body>
  <div class="header">
    <div>
      <img class="logo" src="${baseUrl}/Oficial_JDL_acua.png" alt="JDL" onerror="this.style.display='none'">
      <h2 style="font-size:16px;margin-top:4px;">JARDINES DEL LAGO</h2>
      <div style="font-size:11px;color:#64748b;">ESTADO DE CUENTA CORPORATIVO</div>
    </div>
    <div style="text-align:right;">
      <h3 style="font-size:14px;color:#0f172a;">${account.companyName}</h3>
      <div style="font-size:10px;color:#64748b;">${companyData?.nit ? `NIT: ${companyData.nit}` : ''}</div>
      <div style="font-size:10px;color:#64748b;">Emisión: ${now}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Fecha</th><th>Ref / Folio</th><th>Nombre Evento</th><th>Salón</th><th>Vendedor</th><th class="right">Total</th><th class="right">Cobrado</th><th class="right">Saldo</th></tr></thead>
    <tbody>
      ${account.rows.map(r => `
        <tr>
          <td>${r.eventDate}</td>
          <td><strong>${r.folio || r.refId}</strong></td>
          <td>${r.name}</td>
          <td>${r.salon}</td>
          <td>${r.userName}</td>
          <td class="right">Q ${Number(r.total).toLocaleString('es-GT', {minimumFractionDigits:2})}</td>
          <td class="right" style="color:#16a34a">Q ${Number(r.advancesTotal).toLocaleString('es-GT', {minimumFractionDigits:2})}</td>
          <td class="right" style="font-weight:800;color:${r.balancePending > 0 ? '#dc2626' : '#16a34a'}">Q ${Number(r.balancePending).toLocaleString('es-GT', {minimumFractionDigits:2})}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="summary">
    <div class="sum-box"><div style="font-size:10px;color:#64748b;">TOTAL CONTRATADO</div><div style="font-size:14px;font-weight:800;">Q ${Number(account.netAmount).toLocaleString('es-GT', {minimumFractionDigits:2})}</div></div>
    <div class="sum-box"><div style="font-size:10px;color:#16a34a;">TOTAL COBRADO</div><div style="font-size:14px;font-weight:800;color:#16a34a;">Q ${Number(account.collectedAmount).toLocaleString('es-GT', {minimumFractionDigits:2})}</div></div>
    <div class="sum-box"><div style="font-size:10px;color:#dc2626;">SALDO PENDIENTE</div><div style="font-size:14px;font-weight:800;color:#dc2626;">Q ${Number(account.pendingAmount).toLocaleString('es-GT', {minimumFractionDigits:2})}</div></div>
  </div>
  <script>window.onload = function(){ window.print(); window.close(); };<\/script>
</body></html>`);
    w.document.close();
  };

  // Opciones únicas de salones y vendedores para filtros
  const uniqueSalones = useMemo(() => {
    const s = new Set();
    reportData.forEach(r => { if (r.salon) s.add(r.salon); });
    return Array.from(s).sort();
  }, [reportData]);

  const uniqueSellers = useMemo(() => {
    const m = new Map();
    reportData.forEach(r => {
      if (r.userId && r.userName) m.set(String(r.userId), r.userName);
    });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [reportData]);

  return (
    <div className="reports-page-wrapper" style={{ padding: '20px 28px', background: '#f8fafc', minHeight: '100vh' }}>
      
      {/* ── TOP HEADER (Barra Institucional) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '14px', marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: '15px', letterSpacing: '0.05em',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.28)'
          }}>
            JL
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              EMS RESERVAS • Jardines del Lago
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '2px 0 0', letterSpacing: '-0.02em' }}>
              Estado de Cuenta Contable
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Badge sincronizado */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px',
            padding: '5px 12px', fontSize: '11.5px', color: '#475569', fontWeight: 600,
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a' }}></span>
            <span>Cartera sincronizada con bancos</span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ color: '#64748b' }}>Actualizado hoy</span>
          </div>

          <button
            type="button"
            className="btn-exit"
            onClick={onClose}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px',
              padding: '7px 14px', fontSize: '12px', fontWeight: 700, color: '#475569', cursor: 'pointer'
            }}
          >
            <ArrowLeft size={14} strokeWidth={2.2} />
            <span>Volver</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px',
              padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)'
            }}
          >
            <Download size={14} strokeWidth={2.2} color="#4ade80" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* ── SUBHEADER (Visión Consolidada + Vendedor rápido) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '12px', marginBottom: '16px'
      }}>
        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            VISIÓN CONTABLE CONSOLIDADA
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginTop: '2px' }}>
            Estado de cuenta por empresa con saldo pendiente, saldo a favor y propuesta de cobro
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>Filtrar vista ejecutiva:</span>
          <select
            value={sellerFilter}
            onChange={e => { setSellerFilter(e.target.value); setCurrentPage(1); }}
            style={{
              background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px',
              padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#0f172a'
            }}
          >
            <option value="">Todos los vendedores</option>
            {uniqueSellers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── VISTA DESKTOP (> 850px) ── */}
      <div className="acct-desktop-view">
        {/* ── 5 TARJETAS KPI (Idénticas a la Referencia) ── */}
        <div className="acct-kpi-grid" style={{ marginBottom: '16px' }}>
        {/* 1. Instituciones */}
        <div className="acct-kpi-card acct-kpi-card--instituciones">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              INSTITUCIONES
            </span>
            <div style={{
              width: '28px', height: '28px', borderRadius: '7px', background: '#eff6ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb'
            }}>
              <Landmark size={15} strokeWidth={2} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>
            {allAccounts.length} <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>empresas</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            {summary.totalEvents} eventos registrados
          </div>
        </div>

        {/* 2. Venta Neta */}
        <div className="acct-kpi-card acct-kpi-card--ventas">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              VENTA NETA
            </span>
            <div style={{
              width: '28px', height: '28px', borderRadius: '7px', background: '#f0f9ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7'
            }}>
              <Coins size={15} strokeWidth={2} />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>
            {formatMoney(summary.netAmount)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Total cotizado y confirmado
          </div>
        </div>

        {/* 3. Cobrado */}
        <div className="acct-kpi-card acct-kpi-card--cobrado">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              COBRADO
            </span>
            <span style={{
              background: '#dcfce7', color: '#15803d', fontSize: '10.5px', fontWeight: 800,
              padding: '2px 6px', borderRadius: '6px'
            }}>
              {summary.amortizationRate.toFixed(1)}%
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#16a34a' }}>
            {formatMoney(summary.collectedAmount)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            {summary.totalAdvances} pagos conciliados
          </div>
        </div>

        {/* 4. Saldo Pendiente */}
        <div className="acct-kpi-card acct-kpi-card--pendiente">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              SALDO PENDIENTE
            </span>
            <span style={{
              background: '#fee2e2', color: '#b91c1c', fontSize: '10.5px', fontWeight: 800,
              padding: '2px 6px', borderRadius: '6px'
            }}>
              {statusCounts.overdue} Mora
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#dc2626' }}>
            {formatMoney(summary.pendingAmount)}
          </div>
          <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600, marginTop: '4px' }}>
            Requiere gestión de cobro
          </div>
        </div>

        {/* 5. Saldo a Favor */}
        <div className="acct-kpi-card acct-kpi-card--favor">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              SALDO A FAVOR
            </span>
            <div style={{
              width: '28px', height: '28px', borderRadius: '7px', background: '#f5f3ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6'
            }}>
              <Sparkles size={15} strokeWidth={2} />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#7c3aed' }}>
            {formatMoney(summary.creditAmount)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Disponible para aplicación
          </div>
        </div>
      </div>

      {/* ── BANNER DE DIAGNÓSTICO DE CARTERA ── */}
      <div className="acct-diagnostic-banner" style={{ marginBottom: '16px' }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '50%', background: '#2563eb',
          color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 900, flexShrink: 0
        }}>
          i
        </div>
        <div>
          <strong>Diagnóstico de Cartera:</strong> La cartera registra un total de <strong>{allAccounts.length} empresas</strong> cotizadas por <strong>{formatCompactMoney(summary.netAmount)}</strong>. Al corte, se han recaudado <strong>{formatMoney(summary.collectedAmount)}</strong> en anticipos. El saldo pendiente es de <strong>{formatMoney(summary.pendingAmount)}</strong>, existiendo <strong style={{ color: '#b91c1c' }}>{summary.overdueCount} instituciones con saldo vencido</strong> que requieren contacto prioritario hoy.
        </div>
      </div>

      {/* ── PANEL DE BÚSQUEDA Y FILTROS ── */}
      <div className="acct-filters-panel" style={{ marginBottom: '16px' }}>
        {/* Fila 1: Buscador Óptimo con Enter + Pestañas de Estado */}
        <div className="acct-search-row">
          <form onSubmit={handleTriggerSearch} className="acct-search-input-wrapper">
            <Search size={16} strokeWidth={2} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Filtrar por nombre de empresa, código de cotización, contacto... (Presiona Enter)"
              value={searchDraft}
              onChange={e => setSearchDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleTriggerSearch(e);
                }
              }}
            />
            {searchDraft && (
              <button
                type="button"
                onClick={handleClearSearch}
                style={{
                  position: 'absolute', right: '55px', background: 'none', border: 'none',
                  color: '#94a3b8', cursor: 'pointer', padding: '4px'
                }}
                title="Limpiar búsqueda"
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            )}
            <div style={{
              position: 'absolute', right: '10px', display: 'flex', alignItems: 'center',
              background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '5px',
              padding: '2px 6px', fontSize: '10px', color: '#64748b', fontWeight: 700, pointerEvents: 'none'
            }}>
              Ctrl + K
            </div>
          </form>

          {/* Pestañas de Estado */}
          <div className="acct-status-pills">
            <button
              type="button"
              className={`acct-status-pill ${statusTab === 'ALL' ? 'active' : ''}`}
              onClick={() => { setStatusTab('ALL'); setCurrentPage(1); }}
            >
              <span>Todos</span>
              <span style={{ opacity: 0.8, fontSize: '11px' }}>{statusCounts.all}</span>
            </button>

            <button
              type="button"
              className={`acct-status-pill ${statusTab === 'OVERDUE' ? 'active active--overdue' : ''}`}
              onClick={() => { setStatusTab('OVERDUE'); setCurrentPage(1); }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#dc2626' }}></span>
              <span>Vencidos</span>
              <span style={{ fontWeight: 800, color: statusTab === 'OVERDUE' ? '#b91c1c' : '#dc2626' }}>{statusCounts.overdue}</span>
            </button>

            <button
              type="button"
              className={`acct-status-pill ${statusTab === 'DUE_SOON' ? 'active active--due' : ''}`}
              onClick={() => { setStatusTab('DUE_SOON'); setCurrentPage(1); }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b' }}></span>
              <span>Por Vencer</span>
              <span style={{ fontWeight: 800, color: statusTab === 'DUE_SOON' ? '#b45309' : '#f59e0b' }}>{statusCounts.dueSoon}</span>
            </button>

            <button
              type="button"
              className={`acct-status-pill ${statusTab === 'UP_TO_DATE' ? 'active active--ok' : ''}`}
              onClick={() => { setStatusTab('UP_TO_DATE'); setCurrentPage(1); }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a' }}></span>
              <span>Al Día</span>
              <span style={{ fontWeight: 800, color: statusTab === 'UP_TO_DATE' ? '#15803d' : '#16a34a' }}>{statusCounts.upToDate}</span>
            </button>

            <button
              type="button"
              className={`acct-status-pill ${statusTab === 'CREDIT' ? 'active active--credit' : ''}`}
              onClick={() => { setStatusTab('CREDIT'); setCurrentPage(1); }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#8b5cf6' }}></span>
              <span>Saldo a Favor</span>
            </button>
          </div>
        </div>

        {/* Fila 2: Filtros Secundarios */}
        <div className="acct-secondary-filters-grid">
          <div className="acct-filter-group">
            <label>Desde (Fecha)</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <div className="acct-filter-group">
            <label>Hasta (Fecha)</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <div className="acct-filter-group">
            <label>Vendedor</label>
            <select
              value={sellerFilter}
              onChange={e => { setSellerFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="">Todos los vendedores</option>
              {uniqueSellers.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="acct-filter-group">
            <label>Estado de Cartera</label>
            <select
              value={statusTab}
              onChange={e => { setStatusTab(e.target.value); setCurrentPage(1); }}
            >
              <option value="ALL">Todos los estados</option>
              <option value="OVERDUE">Vencidos</option>
              <option value="DUE_SOON">Por Vencer</option>
              <option value="UP_TO_DATE">Al Día</option>
              <option value="CREDIT">Saldo a Favor</option>
            </select>
          </div>

          <div className="acct-filter-group">
            <label>Salón / Área</label>
            <select
              value={salonFilter}
              onChange={e => { setSalonFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="">Todos los salones</option>
              {uniqueSalones.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="acct-filter-group">
            <label>Tipo Institución</label>
            <select
              value={institutionTypeFilter}
              onChange={e => { setInstitutionTypeFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="">Todas las instituciones</option>
              <option value="Corporativo">Corporativo / Empresa</option>
              <option value="Gobierno">Gobierno / Institución</option>
              <option value="Particular">Particular / Social</option>
              <option value="ONG">ONG / Fundación</option>
            </select>
          </div>
        </div>

        {/* Fila 3: Filtros Activos + Botón Aplicar */}
        <div className="acct-active-tags-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Filtros aplicados:</span>
            
            {appliedSearch && (
              <span className="acct-tag-pill">
                Búsqueda: "{appliedSearch}"
                <button type="button" onClick={handleClearSearch}><X size={11} /></button>
              </span>
            )}

            {sellerFilter && (
              <span className="acct-tag-pill">
                Vendedor: {uniqueSellers.find(u => u.id === sellerFilter)?.name || sellerFilter}
                <button type="button" onClick={() => setSellerFilter('')}><X size={11} /></button>
              </span>
            )}

            {(dateFrom || dateTo) && (
              <span className="acct-tag-pill">
                Período: {dateFrom || 'Inicio'} a {dateTo || 'Hoy'}
                <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }}><X size={11} /></button>
              </span>
            )}

            {statusTab !== 'ALL' && (
              <span className="acct-tag-pill">
                Estado: {statusTab}
                <button type="button" onClick={() => setStatusTab('ALL')}><X size={11} /></button>
              </span>
            )}

            {!appliedSearch && !sellerFilter && !dateFrom && !dateTo && statusTab === 'ALL' && (
              <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Ninguno (Mostrando cartera completa)</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                background: 'none', border: 'none', color: '#64748b',
                fontSize: '11.5px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Restablecer filtros
            </button>

            <button
              type="button"
              onClick={handleTriggerSearch}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: '#2563eb', color: '#ffffff', border: 'none',
                borderRadius: '8px', padding: '7px 16px', fontSize: '12px',
                fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
              }}
            >
              <Filter size={13} strokeWidth={2.2} />
              <span>Aplicar Filtros</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── TABLA DE CARTERA DETALLADA ── */}
      <div className="acct-table-card">
        {/* Cabecera de la Tabla */}
        <div className="acct-table-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
              Instituciones y Cartera Detallada
            </span>
            <span style={{
              background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700,
              padding: '2px 8px', borderRadius: '12px'
            }}>
              Mostrando {accounts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, accounts.length)} de {accounts.length}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Ordenar por:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px',
                padding: '5px 10px', fontSize: '11.5px', fontWeight: 600, color: '#0f172a'
              }}
            >
              <option value="PENDING_DESC">Mayor saldo pendiente</option>
              <option value="PENDING_ASC">Menor saldo pendiente</option>
              <option value="NET_DESC">Mayor venta neta</option>
              <option value="NAME_ASC">Alfabético (A - Z)</option>
              <option value="DUE_ASC">Próximo vencimiento</option>
            </select>
          </div>
        </div>

        {/* Tabla */}
        <div className="acct-table-wrapper">
          <table className="acct-table">
            <thead>
              <tr>
                <th className="acct-col-status">INDICADOR / ESTADO</th>
                <th className="acct-col-company">INSTITUCIÓN / EVENTO</th>
                <th className="acct-col-contact">CONTACTO</th>
                <th className="acct-col-events">EVENTOS</th>
                <th className="acct-col-net">VENTA NETA</th>
                <th className="acct-col-collected">COBRADO</th>
                <th className="acct-col-pending">PENDIENTE</th>
                <th className="acct-col-credit">SALDO FAVOR</th>
                <th className="acct-col-due">PROPUESTA COBRO</th>
                <th className="acct-col-actions">ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>No se encontraron empresas con los filtros actuales.</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Intenta cambiar el término de búsqueda o restablecer los filtros.</div>
                  </td>
                </tr>
              ) : (
                paginatedAccounts.map(account => {
                  const isExpanded = expandedAccounts.has(account.key);
                  const isOverdue = account.collectionTone === 'overdue';
                  const isDue = account.collectionTone === 'due';
                  const isCredit = account.collectionTone === 'credit';
                  const amortPct = account.netAmount > 0 ? (account.collectedAmount / account.netAmount) * 100 : 0;
                  const currentTab = getDetailTab(account.key);

                  return (
                    <Fragment key={account.key}>
                      <tr style={{ background: isExpanded ? '#f8fafc' : '#ffffff' }}>
                        {/* Indicador / Estado */}
                        <td className="acct-col-status">
                          {isOverdue ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
                              padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626' }}></span>
                              {account.collectionBadgeText}
                            </span>
                          ) : isDue ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a',
                              padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }}></span>
                              {account.collectionBadgeText}
                            </span>
                          ) : isCredit ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe',
                              padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6' }}></span>
                              Saldo a Favor
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                              padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }}></span>
                              Al Día
                            </span>
                          )}
                        </td>

                        {/* Institución / Evento */}
                        <td className="acct-col-company">
                          <div style={{ fontWeight: 800, fontSize: '12.5px', color: '#0f172a', textTransform: 'uppercase' }}>
                            {account.companyName}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            <User size={11} strokeWidth={2} />
                            <span>Ejecutivo: {account.primarySeller}</span>
                          </div>
                        </td>

                        {/* Contacto */}
                        <td className="acct-col-contact">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 600, color: '#334155' }}>
                            <Phone size={11} strokeWidth={2} color="#64748b" />
                            <span>{account.contactPhone || account.rows?.[0]?.quote?.contact || 'S/N'}</span>
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                            {account.pendingEventsCount} pend. • {account.paidEventsCount} al día
                          </div>
                        </td>

                        {/* Eventos */}
                        <td className="acct-col-events">
                          <span style={{
                            background: '#f1f5f9', color: '#0f172a', fontSize: '11.5px', fontWeight: 800,
                            padding: '3px 8px', borderRadius: '6px'
                          }}>
                            {account.eventsCount}
                          </span>
                        </td>

                        {/* Venta Neta */}
                        <td className="acct-col-net">
                          {formatMoney(account.netAmount)}
                        </td>

                        {/* Cobrado */}
                        <td className="acct-col-collected">
                          <div style={{ fontWeight: 800, fontSize: '12px', color: '#16a34a' }}>
                            {formatMoney(account.collectedAmount)}
                          </div>
                          <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>
                            {amortPct.toFixed(1)}% amortizado
                          </div>
                        </td>

                        {/* Pendiente */}
                        <td className="acct-col-pending" style={{ color: account.pendingAmount > 0 ? '#dc2626' : '#16a34a', fontWeight: 800, fontSize: '12.5px' }}>
                          {formatMoney(account.pendingAmount)}
                        </td>

                        {/* Saldo Favor */}
                        <td className="acct-col-credit" style={{ color: account.creditAmount > 0 ? '#7c3aed' : '#64748b', fontWeight: account.creditAmount > 0 ? 800 : 500, fontSize: '12px' }}>
                          {formatMoney(account.creditAmount)}
                        </td>

                        {/* Propuesta Cobro */}
                        <td className="acct-col-due">
                          <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                            {account.collectionDueLabel}
                          </div>
                          {account.pendingAmount > 0 && (
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047',
                              padding: '2px 6px', borderRadius: '4px', fontSize: '9.5px', fontWeight: 800, marginTop: '2px'
                            }}>
                              <Calendar size={9} />
                              <span>{account.collectionEta}</span>
                            </div>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="acct-col-actions">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className={`acct-btn-detail ${isExpanded ? 'is-active' : ''}`}
                              onClick={() => toggleExpandAccount(account.key)}
                              title={isExpanded ? "Ocultar desglose" : "Consultar desglose por eventos, contactos y amortizaciones"}
                            >
                              <span>Detalle</span>
                              {isExpanded ? <ChevronUp size={12} strokeWidth={2.2} /> : <ChevronDown size={12} strokeWidth={2.2} />}
                            </button>

                            <button
                              type="button"
                              className="acct-btn-state"
                              onClick={() => setActiveStatementCompanyId(account.key)}
                              title="Ver estado de cuenta específico del cliente seleccionado al instante"
                            >
                              <FileText size={12} strokeWidth={2} />
                              <span>Estado</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── FILA EXPANDIDA: DESGLOSE COMPLETO (EVENTOS, CONTACTOS, AMORTIZACIONES) ── */}
                      {isExpanded && (
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan={10} style={{ padding: '12px 20px 18px 24px', borderLeft: '4px solid #2563eb' }}>
                            <div className="acct-expanded-box">
                              {/* Barra Superior de Pestañas */}
                              <div className="acct-detail-tabs-bar">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '14px' }}>
                                  <Building2 size={15} color="#2563eb" />
                                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                                    {account.companyName}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  className={`acct-detail-tab-btn ${currentTab === 'events' ? 'is-active' : ''}`}
                                  onClick={() => setDetailTab(account.key, 'events')}
                                >
                                  <Calendar size={13} />
                                  <span>Eventos Registrados</span>
                                  <span className="acct-detail-tab-badge">{account.rows.length}</span>
                                </button>

                                <button
                                  type="button"
                                  className={`acct-detail-tab-btn ${currentTab === 'contacts' ? 'is-active' : ''}`}
                                  onClick={() => setDetailTab(account.key, 'contacts')}
                                >
                                  <User size={13} />
                                  <span>Contactos & Asesor</span>
                                </button>

                                <button
                                  type="button"
                                  className={`acct-detail-tab-btn ${currentTab === 'amortizations' ? 'is-active' : ''}`}
                                  onClick={() => setDetailTab(account.key, 'amortizations')}
                                >
                                  <CreditCard size={13} />
                                  <span>Trazabilidad de Amortizaciones</span>
                                  <span className="acct-detail-tab-badge">{account.advancesCount}</span>
                                </button>

                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={() => setActiveStatementCompanyId(account.key)}
                                    title="Ver estado de cuenta de la empresa"
                                    style={{
                                      background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                                      borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 700,
                                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                                    }}
                                  >
                                    <FileText size={12} />
                                    <span>Ver Estado Corporativo</span>
                                  </button>
                                </div>
                              </div>

                              {/* ── CONTENIDO PESTAÑA 1: EVENTOS ── */}
                              {currentTab === 'events' && (
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                                    <thead>
                                      <tr style={{ background: '#f8fafc', color: '#475569', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
                                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Fecha</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Folio / Cotización</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Nombre Evento</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Salón</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Vendedor</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Venta Neta</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Cobrado</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Saldo Pendiente</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Acciones del Evento</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {account.rows.map(evRow => {
                                        const evAmortPct = evRow.total > 0 ? (evRow.advancesTotal / evRow.total) * 100 : 0;
                                        return (
                                          <tr key={evRow.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '7px 10px', fontWeight: 600 }}>{evRow.eventDate}</td>
                                            <td style={{ padding: '7px 10px', fontWeight: 800, color: '#0284c7' }}>
                                              {evRow.folio || evRow.refId}
                                            </td>
                                            <td style={{ padding: '7px 10px', fontWeight: 700, color: '#0f172a' }}>{evRow.name}</td>
                                            <td style={{ padding: '7px 10px', color: '#475569' }}>{evRow.salon}</td>
                                            <td style={{ padding: '7px 10px', color: '#475569' }}>{evRow.userName}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>
                                              {formatMoney(evRow.total)}
                                            </td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                                              <div style={{ color: '#16a34a', fontWeight: 700 }}>{formatMoney(evRow.advancesTotal)}</div>
                                              <div style={{ fontSize: '10px', color: '#15803d' }}>{evAmortPct.toFixed(1)}%</div>
                                            </td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: evRow.balancePending > 0 ? '#dc2626' : '#16a34a' }}>
                                              {formatMoney(evRow.balancePending)}
                                            </td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                <button
                                                  type="button"
                                                  className="acct-btn-subrow-pay"
                                                  onClick={() => {
                                                    setActiveEventStatementRow(evRow);
                                                    setShowAdvanceForm(true);
                                                  }}
                                                  title="Aplicar abono o registrar cobro a este evento"
                                                >
                                                  <CreditCard size={12} />
                                                  <span>Aplicar Pago</span>
                                                </button>

                                                <button
                                                  type="button"
                                                  className="acct-btn-subrow-state"
                                                  onClick={() => setActiveEventStatementRow(evRow)}
                                                  title="Abrir hoja formal del estado de cuenta de este evento"
                                                >
                                                  <FileText size={12} />
                                                  <span>Estado</span>
                                                </button>

                                                <button
                                                  type="button"
                                                  className="acct-btn-cancel-form"
                                                  onClick={() => { onClose?.(); navigate(`/reserva/${evRow.actionEventId}`); }}
                                                  style={{ height: '26px', minHeight: '26px', padding: '0 8px', fontSize: '10.5px' }}
                                                  title="Abrir detalles de la reserva en el calendario"
                                                >
                                                  <span>Reserva</span>
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* ── CONTENIDO PESTAÑA 2: CONTACTOS ── */}
                              {currentTab === 'contacts' && (
                                <div className="acct-contact-grid">
                                  <div className="acct-contact-item">
                                    <div className="acct-contact-item-icon"><User size={16} /></div>
                                    <div>
                                      <div className="acct-contact-item-label">Contacto Registrado</div>
                                      <div className="acct-contact-item-value">{account.rows[0]?.clientName || account.rows[0]?.manager || account.companyName}</div>
                                    </div>
                                  </div>

                                  <div className="acct-contact-item">
                                    <div className="acct-contact-item-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}><Phone size={16} /></div>
                                    <div>
                                      <div className="acct-contact-item-label">Teléfono Directo</div>
                                      <div className="acct-contact-item-value">
                                        {account.contactPhone ? (
                                          <a href={`tel:${account.contactPhone.replace(/\s+/g, '')}`} className="acct-contact-link">
                                            {account.contactPhone}
                                          </a>
                                        ) : (
                                          <span style={{ color: '#94a3b8' }}>No registrado</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="acct-contact-item">
                                    <div className="acct-contact-item-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}><FileText size={16} /></div>
                                    <div>
                                      <div className="acct-contact-item-label">Correo Electrónico</div>
                                      <div className="acct-contact-item-value">
                                        {account.rows[0]?.managerEmail ? (
                                          <a href={`mailto:${account.rows[0].managerEmail}`} className="acct-contact-link">
                                            {account.rows[0].managerEmail}
                                          </a>
                                        ) : (
                                          <span style={{ color: '#94a3b8' }}>No registrado</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="acct-contact-item">
                                    <div className="acct-contact-item-icon" style={{ background: '#fffbeb', color: '#b45309' }}><User size={16} /></div>
                                    <div>
                                      <div className="acct-contact-item-label">Ejecutivo Comercial</div>
                                      <div className="acct-contact-item-value">{account.primarySeller}</div>
                                    </div>
                                  </div>

                                  <div className="acct-contact-item">
                                    <div className="acct-contact-item-icon" style={{ background: '#f1f5f9', color: '#475569' }}><Building2 size={16} /></div>
                                    <div>
                                      <div className="acct-contact-item-label">Tipo de Institución</div>
                                      <div className="acct-contact-item-value">{account.companyType || 'Corporativo / Privado'}</div>
                                    </div>
                                  </div>

                                  <div className="acct-contact-item">
                                    <div className="acct-contact-item-icon" style={{ background: '#ecfdf5', color: '#059669' }}><CheckCircle2 size={16} /></div>
                                    <div>
                                      <div className="acct-contact-item-label">Resumen de Eventos</div>
                                      <div className="acct-contact-item-value">
                                        {account.eventsCount} eventos ({account.paidEventsCount} al día, {account.pendingEventsCount} con saldo)
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* ── CONTENIDO PESTAÑA 3: TRAZABILIDAD DE AMORTIZACIONES ── */}
                              {currentTab === 'amortizations' && (
                                <div>
                                  <div className="acct-amort-summary-bar">
                                    <div className="acct-amort-stat">
                                      <span className="acct-amort-stat-label">Venta Neta Total</span>
                                      <span className="acct-amort-stat-val" style={{ color: '#0f172a' }}>{formatMoney(account.netAmount)}</span>
                                    </div>
                                    <div className="acct-amort-stat">
                                      <span className="acct-amort-stat-label">Total Amortizado</span>
                                      <span className="acct-amort-stat-val" style={{ color: '#16a34a' }}>{formatMoney(account.collectedAmount)}</span>
                                    </div>
                                    <div className="acct-amort-progress-container">
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, color: '#166534', marginBottom: '3px' }}>
                                        <span>Cobertura</span>
                                        <span>{amortPct.toFixed(1)}%</span>
                                      </div>
                                      <div className="acct-amort-progress-bar">
                                        <div className="acct-amort-progress-fill" style={{ width: `${Math.min(100, amortPct)}%` }}></div>
                                      </div>
                                    </div>
                                    <div className="acct-amort-stat">
                                      <span className="acct-amort-stat-label">Saldo por Amortizar</span>
                                      <span className="acct-amort-stat-val" style={{ color: account.pendingAmount > 0 ? '#dc2626' : '#16a34a' }}>
                                        {formatMoney(account.pendingAmount)}
                                      </span>
                                    </div>
                                  </div>

                                  {(() => {
                                    const allAdvances = [];
                                    for (const r of account.rows) {
                                      if (Array.isArray(r.advances)) {
                                        for (const adv of r.advances) {
                                          allAdvances.push({ ...adv, eventFolio: r.folio || r.refId, eventName: r.name, evRow: r });
                                        }
                                      }
                                    }
                                    allAdvances.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

                                    if (allAdvances.length === 0) {
                                      return (
                                        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                                          <Coins size={28} color="#94a3b8" style={{ marginBottom: '6px' }} />
                                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>No se registran abonos en la cartera de esta institución</div>
                                          <div style={{ fontSize: '11.5px', marginTop: '4px' }}>Haz clic en "Aplicar Pago" en la pestaña de eventos para ingresar el primer anticipo o liquidación.</div>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                                          <thead>
                                            <tr style={{ background: '#f8fafc', color: '#475569', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
                                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Fecha</th>
                                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Evento / Folio</th>
                                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Método de Pago</th>
                                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>No. Boleta / Ref</th>
                                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Aplicado Por</th>
                                              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Monto Abono</th>
                                              <th style={{ padding: '8px 10px', textAlign: 'center' }}>Acciones</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {allAdvances.map((adv, idx) => (
                                              <tr key={adv.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{adv.date || '—'}</td>
                                                <td style={{ padding: '8px 10px' }}>
                                                  <span style={{ fontWeight: 800, color: '#0284c7' }}>{adv.eventFolio}</span>
                                                  <span style={{ color: '#64748b', marginLeft: '6px', fontSize: '11px' }}>({adv.eventName})</span>
                                                </td>
                                                <td style={{ padding: '8px 10px', fontWeight: 600, color: '#334155' }}>
                                                  {adv.paymentType || 'Efectivo'}
                                                </td>
                                                <td style={{ padding: '8px 10px', color: '#475569' }}>
                                                  {adv.receiptNumber || adv.boletaNumber || 'S/N'}
                                                </td>
                                                <td style={{ padding: '8px 10px', color: '#475569' }}>
                                                  {adv.userName || adv.createdByName || adv.appliedByName || 'Sistema'}
                                                </td>
                                                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                                                  {formatMoney(adv.amount)}
                                                </td>
                                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                  <div style={{ display: 'inline-flex', gap: '4px' }}>
                                                    {adv.voucherImage && (
                                                      <button
                                                        type="button"
                                                        className="acct-btn-row-action is-voucher"
                                                        onClick={() => setPreviewVoucher(adv.voucherImage)}
                                                        title="Ver boleta o comprobante bancario"
                                                      >
                                                        <Eye size={11} />
                                                        <span>Ver Boleta</span>
                                                      </button>
                                                    )}
                                                    <button
                                                      type="button"
                                                      className="acct-btn-subrow-state"
                                                      onClick={() => setActiveEventStatementRow(adv.evRow)}
                                                      title="Ver estado de cuenta de este evento"
                                                      style={{ height: '24px', minHeight: '24px', padding: '0 7px', fontSize: '10.5px' }}
                                                    >
                                                      <FileText size={11} />
                                                      <span>Ver Evento</span>
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Barra de Paginación */}
        <div className="acct-pagination-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Registros por página:</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              style={{
                background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px',
                padding: '3px 8px', fontSize: '11.5px', fontWeight: 600, color: '#0f172a'
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span>
              {accounts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, accounts.length)} de {accounts.length} empresas
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
              style={{
                background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px',
                padding: '4px 10px', fontSize: '11.5px', fontWeight: 600, color: currentPage <= 1 ? '#cbd5e1' : '#334155',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Anterior
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => (
                <Fragment key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>}
                  <button
                    type="button"
                    onClick={() => handlePageChange(p)}
                    style={{
                      background: currentPage === p ? '#0284c7' : '#ffffff',
                      color: currentPage === p ? '#ffffff' : '#334155',
                      border: '1px solid',
                      borderColor: currentPage === p ? '#0284c7' : '#cbd5e1',
                      borderRadius: '6px', minWidth: '28px', height: '28px',
                      fontSize: '11.5px', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    {p}
                  </button>
                </Fragment>
              ))}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              style={{
                background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px',
                padding: '4px 10px', fontSize: '11.5px', fontWeight: 600, color: currentPage >= totalPages ? '#cbd5e1' : '#334155',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
      </div> {/* Fin .acct-desktop-view */}

      {/* ── VISTA MÓVIL (≤ 850px) — Idéntica a la Maqueta Móvil de Referencia ── */}
      <div className="acct-mobile-view">
        {/* 1. Diagnóstico de Cartera Móvil */}
        <div className="acct-mobile-diagnostic-card">
          <div className="acct-mobile-diagnostic-icon">
            <AlertCircle size={18} color="#0284c7" />
          </div>
          <div className="acct-mobile-diagnostic-content">
            <div className="acct-mobile-diagnostic-title">Diagnóstico de Cartera</div>
            <div className="acct-mobile-diagnostic-text">
              Cartera de <strong>{allAccounts.length} empresas</strong> cotizadas por{' '}
              <strong>{formatCompactMoney(summary.netAmount)}</strong>. Existen{' '}
              <span className="acct-overdue-pill-highlight">
                {summary.overdueCount} instituciones vencidas
              </span>{' '}
              que requieren gestión de cobro hoy.
            </div>
          </div>
        </div>

        {/* 2. Resumen Financiero QTZ (Carrusel Deslizable) */}
        <div className="acct-mobile-carousel-header">
          <span className="acct-mobile-carousel-title">
            RESUMEN FINANCIERO <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700 }}>QTZ</span>
          </span>
          <span className="acct-mobile-carousel-hint">Deslizar →</span>
        </div>

        <div className="acct-mobile-kpi-carousel">
          {/* Card 1: Saldo Pendiente */}
          <div className="acct-mobile-kpi-slide is-pending">
            <div className="acct-mobile-kpi-slide-header">
              <span className="acct-mobile-kpi-slide-label">SALDO PENDIENTE</span>
              <span className="acct-mobile-kpi-slide-pill is-mora">● {summary.overdueCount} Mora</span>
            </div>
            <div className="acct-mobile-kpi-slide-amount">
              {renderFormattedParts(summary.pendingAmount, '#e11d48')}
            </div>
            <div className="acct-mobile-kpi-slide-footer">
              <span style={{ color: '#e11d48', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                <AlertTriangle size={12} strokeWidth={2.2} /> Requiere cobro
              </span>
              <span style={{ color: '#64748b', fontWeight: 600 }}>
                {summary.netAmount > 0 ? ((summary.pendingAmount / summary.netAmount) * 100).toFixed(1) : '0.0'}% cartera
              </span>
            </div>
            <div className="acct-mobile-kpi-slide-bar">
              <div
                className="acct-mobile-kpi-slide-fill is-pending"
                style={{ width: `${Math.min(100, summary.netAmount > 0 ? (summary.pendingAmount / summary.netAmount) * 100 : 0)}%` }}
              />
            </div>
          </div>

          {/* Card 2: Venta Neta */}
          <div className="acct-mobile-kpi-slide is-net">
            <div className="acct-mobile-kpi-slide-header">
              <span className="acct-mobile-kpi-slide-label">VENTA NETA</span>
              <span className="acct-mobile-kpi-slide-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
                <Coins size={14} strokeWidth={2.2} />
              </span>
            </div>
            <div className="acct-mobile-kpi-slide-amount">
              {renderFormattedParts(summary.netAmount, '#0284c7')}
            </div>
            <div className="acct-mobile-kpi-slide-footer">
              <span style={{ color: '#64748b', fontWeight: 600 }}>Total cotizado y confirmado</span>
              <span style={{ color: '#0f172a', fontWeight: 700 }}>{summary.totalEvents} eventos</span>
            </div>
          </div>

          {/* Card 3: Cobrado */}
          <div className="acct-mobile-kpi-slide is-collected">
            <div className="acct-mobile-kpi-slide-header">
              <span className="acct-mobile-kpi-slide-label">COBRADO</span>
              <span className="acct-mobile-kpi-slide-pill is-success">{summary.amortizationRate.toFixed(1)}%</span>
            </div>
            <div className="acct-mobile-kpi-slide-amount">
              {renderFormattedParts(summary.collectedAmount, '#16a34a')}
            </div>
            <div className="acct-mobile-kpi-slide-footer">
              <span style={{ color: '#16a34a', fontWeight: 700 }}>{summary.totalAdvances} pagos conciliados</span>
            </div>
            <div className="acct-mobile-kpi-slide-bar">
              <div
                className="acct-mobile-kpi-slide-fill is-collected"
                style={{ width: `${Math.min(100, summary.amortizationRate)}%` }}
              />
            </div>
          </div>

          {/* Card 4: Saldo a Favor */}
          <div className="acct-mobile-kpi-slide is-credit">
            <div className="acct-mobile-kpi-slide-header">
              <span className="acct-mobile-kpi-slide-label">SALDO A FAVOR</span>
              <span className="acct-mobile-kpi-slide-icon" style={{ background: '#f5f3ff', color: '#9333ea' }}>
                <Sparkles size={14} strokeWidth={2.2} />
              </span>
            </div>
            <div className="acct-mobile-kpi-slide-amount">
              {renderFormattedParts(summary.creditAmount, '#9333ea')}
            </div>
            <div className="acct-mobile-kpi-slide-footer">
              <span style={{ color: '#64748b', fontWeight: 600 }}>Disponible para aplicación</span>
            </div>
          </div>

          {/* Card 5: Instituciones */}
          <div className="acct-mobile-kpi-slide is-institutions">
            <div className="acct-mobile-kpi-slide-header">
              <span className="acct-mobile-kpi-slide-label">INSTITUCIONES</span>
              <span className="acct-mobile-kpi-slide-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <Landmark size={14} strokeWidth={2.2} />
              </span>
            </div>
            <div className="acct-mobile-kpi-slide-amount">
              <span style={{ fontWeight: 900 }}>{allAccounts.length}</span>{' '}
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>cuentas</span>
            </div>
            <div className="acct-mobile-kpi-slide-footer">
              <span style={{ color: '#64748b', fontWeight: 600 }}>{summary.totalEvents} eventos registrados</span>
            </div>
          </div>
        </div>

        {/* 3. Buscador Móvil + Botón de Filtros */}
        <div className="acct-mobile-search-wrapper">
          <div className="acct-mobile-search-bar">
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              value={searchDraft}
              onChange={e => setSearchDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleTriggerSearch(e); }}
              placeholder="Buscar empresa, cotización, contacto..."
              className="acct-mobile-search-input"
            />
            {searchDraft && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="acct-mobile-clear-btn"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowMobileFilters(true)}
              className={`acct-mobile-filter-btn ${secondaryFiltersCount > 0 ? 'has-active' : ''}`}
              title="Filtros de Cartera"
            >
              <Filter size={15} strokeWidth={2.2} />
              {secondaryFiltersCount > 0 && (
                <span className="acct-mobile-filter-badge">{secondaryFiltersCount}</span>
              )}
            </button>
          </div>

          {/* Tira de Filtros Activos (Quick Removable Chips) */}
          {secondaryFiltersCount > 0 && (
            <div className="acct-mobile-active-chips-strip">
              <span className="acct-mobile-active-chips-label">Filtros:</span>
              {dateFrom && (
                <span className="acct-mobile-chip">
                  <span>Desde: {dateFrom}</span>
                  <button type="button" onClick={() => { setDateFrom(''); setCurrentPage(1); }}><X size={11} /></button>
                </span>
              )}
              {dateTo && (
                <span className="acct-mobile-chip">
                  <span>Hasta: {dateTo}</span>
                  <button type="button" onClick={() => { setDateTo(''); setCurrentPage(1); }}><X size={11} /></button>
                </span>
              )}
              {sellerFilter && (
                <span className="acct-mobile-chip">
                  <span>{uniqueSellers.find(u => String(u.id) === String(sellerFilter))?.name || 'Vendedor'}</span>
                  <button type="button" onClick={() => { setSellerFilter(''); setCurrentPage(1); }}><X size={11} /></button>
                </span>
              )}
              {salonFilter && (
                <span className="acct-mobile-chip">
                  <span>{salonFilter}</span>
                  <button type="button" onClick={() => { setSalonFilter(''); setCurrentPage(1); }}><X size={11} /></button>
                </span>
              )}
              <button
                type="button"
                className="acct-mobile-clear-all-chip"
                onClick={handleResetSecondaryFilters}
              >
                Limpiar todo
              </button>
            </div>
          )}
        </div>

        {/* Modal Bottom Sheet de Filtros Móviles */}
        {showMobileFilters && createPortal(
          <div
            className="acct-mobile-sheet-overlay"
            onClick={() => setShowMobileFilters(false)}
          >
            <div
              className="acct-mobile-sheet-container"
              onClick={e => e.stopPropagation()}
            >
              {/* Drag Handle */}
              <div className="acct-mobile-sheet-handle" />

              {/* Header */}
              <div className="acct-mobile-sheet-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Filter size={18} color="#2563eb" strokeWidth={2.4} />
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                    Filtros de Cartera
                  </span>
                  {secondaryFiltersCount > 0 && (
                    <span className="acct-mobile-sheet-count-badge">{secondaryFiltersCount} activos</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(false)}
                  className="acct-mobile-sheet-close-btn"
                  title="Cerrar filtros"
                >
                  <X size={18} strokeWidth={2.4} />
                </button>
              </div>

              {/* Body */}
              <div className="acct-mobile-sheet-body">
                {/* 1. Rango de Fechas */}
                <div className="acct-mobile-sheet-section">
                  <div className="acct-mobile-sheet-label">
                    <Calendar size={13} color="#64748b" />
                    <span>Fecha del Evento</span>
                  </div>

                  {/* Date Quick Presets */}
                  <div className="acct-mobile-date-presets">
                    <button
                      type="button"
                      className={`acct-date-preset-btn ${!dateFrom && !dateTo ? 'is-active' : ''}`}
                      onClick={() => handleDatePreset('ALL')}
                    >
                      Cualquiera
                    </button>
                    <button
                      type="button"
                      className="acct-date-preset-btn"
                      onClick={() => handleDatePreset('THIS_MONTH')}
                    >
                      Este Mes
                    </button>
                    <button
                      type="button"
                      className="acct-date-preset-btn"
                      onClick={() => handleDatePreset('NEXT_30')}
                    >
                      Próx. 30 días
                    </button>
                    <button
                      type="button"
                      className="acct-date-preset-btn"
                      onClick={() => handleDatePreset('THIS_YEAR')}
                    >
                      Este Año
                    </button>
                  </div>

                  <div className="acct-mobile-sheet-date-grid">
                    <div>
                      <span className="acct-sheet-sublabel">Desde:</span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="acct-sheet-input-date"
                      />
                    </div>
                    <div>
                      <span className="acct-sheet-sublabel">Hasta:</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="acct-sheet-input-date"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Asesor / Ejecutivo */}
                <div className="acct-mobile-sheet-section">
                  <div className="acct-mobile-sheet-label">
                    <User size={13} color="#64748b" />
                    <span>Ejecutivo Comercial</span>
                  </div>
                  <select
                    value={sellerFilter}
                    onChange={e => setSellerFilter(e.target.value)}
                    className="acct-sheet-select"
                  >
                    <option value="">Todos los ejecutivos</option>
                    {uniqueSellers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Salón / Área */}
                <div className="acct-mobile-sheet-section">
                  <div className="acct-mobile-sheet-label">
                    <Building2 size={13} color="#64748b" />
                    <span>Salón o Área</span>
                  </div>
                  <select
                    value={salonFilter}
                    onChange={e => setSalonFilter(e.target.value)}
                    className="acct-sheet-select"
                  >
                    <option value="">Todos los salones</option>
                    {uniqueSalones.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="acct-mobile-sheet-footer">
                <button
                  type="button"
                  onClick={() => { handleResetSecondaryFilters(); }}
                  className="acct-mobile-sheet-btn is-reset"
                >
                  <RotateCcw size={13} />
                  <span>Restablecer</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setCurrentPage(1); setShowMobileFilters(false); }}
                  className="acct-mobile-sheet-btn is-apply"
                >
                  <span>Aplicar Filtros</span>
                  {secondaryFiltersCount > 0 && <span>({secondaryFiltersCount})</span>}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* 4. Pestañas de Estado (Scroll Horizontal Idénticas a la Maqueta) */}
        <div className="acct-mobile-status-scroll">
          <button
            type="button"
            className={`acct-mobile-pill is-pill-all ${statusTab === 'ALL' ? 'is-active' : ''}`}
            onClick={() => { setStatusTab('ALL'); setCurrentPage(1); }}
          >
            <span>Todos</span>
            <span className="acct-mobile-pill-count">{statusCounts.all}</span>
          </button>

          <button
            type="button"
            className={`acct-mobile-pill is-pill-overdue ${statusTab === 'OVERDUE' ? 'is-active' : ''}`}
            onClick={() => { setStatusTab('OVERDUE'); setCurrentPage(1); }}
          >
            <span className="acct-pill-dot is-dot-overdue" />
            <span>Vencidos</span>
            <span className="acct-mobile-pill-count">{statusCounts.overdue}</span>
          </button>

          <button
            type="button"
            className={`acct-mobile-pill is-pill-due ${statusTab === 'DUE_SOON' ? 'is-active' : ''}`}
            onClick={() => { setStatusTab('DUE_SOON'); setCurrentPage(1); }}
          >
            <span className="acct-pill-dot is-dot-due" />
            <span>Por Vencer</span>
            <span className="acct-mobile-pill-count">{statusCounts.dueSoon}</span>
          </button>

          <button
            type="button"
            className={`acct-mobile-pill is-pill-ok ${statusTab === 'UP_TO_DATE' ? 'is-active' : ''}`}
            onClick={() => { setStatusTab('UP_TO_DATE'); setCurrentPage(1); }}
          >
            <span className="acct-pill-dot is-dot-ok" />
            <span>Al Día</span>
            <span className="acct-mobile-pill-count">{statusCounts.upToDate}</span>
          </button>

          <button
            type="button"
            className={`acct-mobile-pill is-pill-credit ${statusTab === 'CREDIT' ? 'is-active' : ''}`}
            onClick={() => { setStatusTab('CREDIT'); setCurrentPage(1); }}
          >
            <span className="acct-pill-dot is-dot-credit" />
            <span>Saldo a Favor</span>
            <span className="acct-mobile-pill-count">{statusCounts.credit}</span>
          </button>
        </div>

        {/* 5. Contador y Ordenamiento Móvil */}
        <div className="acct-mobile-meta-bar">
          <span className="acct-mobile-meta-count">
            Mostrando <strong>{accounts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, accounts.length)}</strong> de <strong>{accounts.length}</strong> cuentas
          </span>
          <div className="acct-mobile-sort-container">
            <span className="acct-mobile-sort-label">Ordenar:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="acct-mobile-sort-select"
            >
              <option value="PENDING_DESC">Mayor saldo ▾</option>
              <option value="PENDING_ASC">Menor saldo ▾</option>
              <option value="NET_DESC">Mayor venta ▾</option>
              <option value="NAME_ASC">Nombre A-Z ▾</option>
              <option value="DUE_ASC">Próximo vencimiento ▾</option>
            </select>
          </div>
        </div>

        {/* 6. Tarjetas Ejecutivas Móviles */}
        <div className="acct-mobile-cards-list">
          {paginatedAccounts.length === 0 ? (
            <div className="acct-mobile-empty-state">
              <Search size={32} color="#94a3b8" />
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#475569', marginTop: '8px' }}>
                No se encontraron cuentas
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '3px' }}>
                Intenta con otro término o restablece los filtros.
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="acct-mobile-empty-reset-btn"
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            paginatedAccounts.map(account => {
              const isExpanded = expandedAccounts.has(account.key);
              const toneStyles = getAccountToneStyles(account.collectionTone);
              const initials = getAccountInitials(account.companyName);
              const repRow = account.rows.find(r => r.balancePending > 0) || account.rows[0];
              const targetDate = repRow?.dueDate || repRow?.eventDate || '';
              const dateLabel = (account.collectionTone === 'overdue' || account.collectionTone === 'due')
                ? 'Vencimiento:'
                : 'Fecha Evento:';
              const currentTab = getDetailTab(account.key);
              const isOkTone = account.collectionTone === 'ok';
              const amortPct = account.netAmount > 0
                ? ((account.collectedAmount / account.netAmount) * 100)
                : 0;

              return (
                <div
                  key={`mobile-${account.key}`}
                  className="acct-mobile-card"
                  style={{ borderTop: `3.5px solid ${toneStyles.borderTop}` }}
                >
                  {/* Cabecera de la Tarjeta */}
                  <div className="acct-mobile-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      {/* Avatar de Iniciales */}
                      <div
                        className="acct-mobile-avatar"
                        style={{ background: toneStyles.bg, color: toneStyles.color, border: `1px solid ${toneStyles.borderColor}` }}
                      >
                        {initials}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span className="acct-mobile-card-title">
                            {account.companyName}
                          </span>
                          <span className="acct-mobile-event-count-badge">
                            {account.eventsCount} {account.eventsCount === 1 ? 'evento' : 'eventos'}
                          </span>
                        </div>
                        <div className="acct-mobile-card-executive">
                          <User size={11} strokeWidth={2} />
                          <span>{account.primarySeller || 'Sin asesor asignado'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Badge de Estado */}
                    <div
                      className="acct-mobile-status-badge"
                      style={{ background: toneStyles.bg, color: toneStyles.color, border: `1px solid ${toneStyles.borderColor}` }}
                    >
                      ● {account.collectionBadgeText}
                    </div>
                  </div>

                  {/* Cuadro Financiero Interno */}
                  <div className="acct-mobile-inner-box">
                    <div className="acct-mobile-inner-grid">
                      <div>
                        <div className="acct-mobile-inner-label">SALDO PENDIENTE</div>
                        <div
                          className="acct-mobile-inner-val"
                          style={{ color: account.pendingAmount > 0 ? '#e11d48' : '#16a34a' }}
                        >
                          {renderFormattedParts(account.pendingAmount, account.pendingAmount > 0 ? '#e11d48' : '#16a34a')}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        {isOkTone ? (
                          <>
                            <div className="acct-mobile-inner-label">COBRADO ({amortPct.toFixed(1)}%)</div>
                            <div className="acct-mobile-inner-val" style={{ color: '#16a34a' }}>
                              {renderFormattedParts(account.collectedAmount, '#16a34a')}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="acct-mobile-inner-label">VENTA NETA</div>
                            <div className="acct-mobile-inner-val" style={{ color: '#0f172a' }}>
                              {renderFormattedParts(account.netAmount, '#0f172a')}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Barra de Amortización */}
                    <div className="acct-mobile-amort-row">
                      <span className="acct-mobile-amort-text">
                        <span style={{ color: isOkTone ? '#16a34a' : '#0284c7' }}>●</span>{' '}
                        {isOkTone ? 'Venta Total:' : 'Amortizado:'}{' '}
                        <strong>
                          Q {Number(isOkTone ? account.netAmount : account.collectedAmount).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                        </strong>
                      </span>
                      <span
                        className="acct-mobile-amort-pct"
                        style={{ background: isOkTone ? '#ecfdf5' : '#f8fafc', color: isOkTone ? '#16a34a' : '#64748b' }}
                      >
                        {amortPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="acct-mobile-progress-track">
                      <div
                        className="acct-mobile-progress-fill"
                        style={{
                          width: `${Math.min(100, amortPct)}%`,
                          background: isOkTone ? '#10b981' : (account.collectionTone === 'overdue' ? '#ef4444' : '#0284c7')
                        }}
                      />
                    </div>

                    {/* Fila de Vencimiento / Fecha */}
                    <div className="acct-mobile-date-row">
                      <span className="acct-mobile-date-label">
                        <Calendar size={12} strokeWidth={2} />
                        <span>{dateLabel}</span>
                      </span>
                      <span className="acct-mobile-date-val">
                        {formatDateEs(targetDate)}
                      </span>
                    </div>
                  </div>

                  {/* Fila de Botones de Acción */}
                  <div className="acct-mobile-actions-row">
                    {/* Botón Teléfono */}
                    {account.contactPhone ? (
                      <a
                        href={`tel:${account.contactPhone.replace(/\D/g, '')}`}
                        className="acct-btn-mobile-phone"
                        title={`Llamar a ${account.contactPhone}`}
                      >
                        <Phone size={12} strokeWidth={2.2} />
                        <span>{account.contactPhone}</span>
                      </a>
                    ) : (
                      <span className="acct-btn-mobile-phone is-disabled" title="Teléfono no disponible">
                        <Phone size={12} strokeWidth={2.2} />
                        <span>Sin tel</span>
                      </span>
                    )}

                    {/* Botón Propuesta Contextual */}
                    {account.collectionTone === 'overdue' && (
                      <button
                        type="button"
                        className="acct-btn-mobile-proposal is-overdue"
                        onClick={() => setActiveStatementCompanyId(account.key)}
                        title="Gestionar cobro vencido"
                      >
                        <AlertTriangle size={13} strokeWidth={2.2} />
                        <span>Solicitar pago</span>
                      </button>
                    )}
                    {account.collectionTone === 'due' && (
                      <button
                        type="button"
                        className="acct-btn-mobile-proposal is-due"
                        onClick={() => setActiveStatementCompanyId(account.key)}
                        title="Enviar recordatorio previo"
                      >
                        <Clock size={13} strokeWidth={2.2} />
                        <span>Recordatorio previo</span>
                      </button>
                    )}
                    {account.collectionTone === 'credit' && (
                      <button
                        type="button"
                        className="acct-btn-mobile-proposal is-credit"
                        onClick={() => setActiveStatementCompanyId(account.key)}
                        title="Consultar saldo a favor"
                      >
                        <Sparkles size={13} strokeWidth={2.2} />
                        <span>Saldo a favor</span>
                      </button>
                    )}
                    {isOkTone && (
                      <button
                        type="button"
                        className="acct-btn-mobile-proposal is-ok"
                        onClick={() => setActiveStatementCompanyId(account.key)}
                        title="Cuenta en plazo"
                      >
                        <Check size={13} strokeWidth={2.5} />
                        <span>En plazo pactado</span>
                      </button>
                    )}

                    {/* Botón Estado ("Ver estado de cuenta") */}
                    <button
                      type="button"
                      className="acct-btn-mobile-state"
                      onClick={() => setActiveStatementCompanyId(account.key)}
                      title="Ver estado de cuenta de la empresa al instante"
                    >
                      <FileText size={12} strokeWidth={2.2} />
                      <span>Estado</span>
                    </button>

                    {/* Botón Detalle con chevron */}
                    <button
                      type="button"
                      className={`acct-btn-mobile-detail ${isExpanded ? 'is-active' : ''}`}
                      onClick={() => toggleExpandAccount(account.key)}
                      title={isExpanded ? 'Ocultar detalle' : 'Ver desglose por eventos'}
                    >
                      <span>Detalle</span>
                      {isExpanded ? <ChevronUp size={13} strokeWidth={2.2} /> : <ChevronRight size={13} strokeWidth={2.2} />}
                    </button>
                  </div>

                  {/* Panel Desplegable de Detalle Móvil */}
                  {isExpanded && (
                    <div className="acct-mobile-expanded-box">
                      {/* Pestañas de Detalle */}
                      <div className="acct-mobile-detail-tabs">
                        <button
                          type="button"
                          className={`acct-mobile-dtab-btn ${currentTab === 'events' ? 'is-active' : ''}`}
                          onClick={() => setDetailTab(account.key, 'events')}
                        >
                          <Calendar size={12} />
                          <span>Eventos ({account.rows.length})</span>
                        </button>
                        <button
                          type="button"
                          className={`acct-mobile-dtab-btn ${currentTab === 'contacts' ? 'is-active' : ''}`}
                          onClick={() => setDetailTab(account.key, 'contacts')}
                        >
                          <User size={12} />
                          <span>Contacto</span>
                        </button>
                        <button
                          type="button"
                          className={`acct-mobile-dtab-btn ${currentTab === 'amortizations' ? 'is-active' : ''}`}
                          onClick={() => setDetailTab(account.key, 'amortizations')}
                        >
                          <CreditCard size={12} />
                          <span>Abonos ({account.advancesCount})</span>
                        </button>
                      </div>

                      {/* Contenido Pestaña Eventos */}
                      {currentTab === 'events' && (
                        <div className="acct-mobile-events-list">
                          {account.rows.map(row => (
                            <div key={row.id} className="acct-mobile-event-subcard">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a' }}>
                                    {row.name}
                                  </div>
                                  <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                                    <strong>{row.folio || row.refId}</strong> • {row.salon} • {row.eventDate}
                                  </div>
                                </div>
                                <span
                                  className="acct-mobile-event-status-pill"
                                  style={{ background: row.balancePending > 0 ? '#fef2f2' : '#f0fdf4', color: row.balancePending > 0 ? '#b91c1c' : '#15803d' }}
                                >
                                  {row.balancePending > 0 ? 'Con Saldo' : 'Al Día'}
                                </span>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '8px', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}>
                                <div>
                                  <span style={{ color: '#64748b' }}>Total:</span> <strong>{formatMoney(row.total)}</strong>
                                </div>
                                <div>
                                  <span style={{ color: '#64748b' }}>Saldo:</span>{' '}
                                  <strong style={{ color: row.balancePending > 0 ? '#dc2626' : '#16a34a' }}>
                                    {formatMoney(row.balancePending)}
                                  </strong>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                <button
                                  type="button"
                                  className="acct-btn-subrow-pay"
                                  onClick={() => { setActiveEventStatementRow(row); setShowAdvanceForm(true); }}
                                >
                                  <CreditCard size={11} />
                                  <span>Aplicar Pago</span>
                                </button>
                                <button
                                  type="button"
                                  className="acct-btn-subrow-state"
                                  onClick={() => setActiveEventStatementRow(row)}
                                >
                                  <FileText size={11} />
                                  <span>Hoja Evento</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Contenido Pestaña Contactos */}
                      {currentTab === 'contacts' && (
                        <div className="acct-mobile-contact-box">
                          <div className="acct-mobile-contact-item">
                            <span className="acct-mobile-contact-lbl">Teléfono Principal:</span>
                            <span className="acct-mobile-contact-val">{account.contactPhone || 'No registrado'}</span>
                          </div>
                          <div className="acct-mobile-contact-item">
                            <span className="acct-mobile-contact-lbl">Correo Electrónico:</span>
                            <span className="acct-mobile-contact-val">{account.rows[0]?.managerEmail || 'No registrado'}</span>
                          </div>
                          <div className="acct-mobile-contact-item">
                            <span className="acct-mobile-contact-lbl">Ejecutivo Asignado:</span>
                            <span className="acct-mobile-contact-val">{account.primarySeller}</span>
                          </div>
                          <div className="acct-mobile-contact-item">
                            <span className="acct-mobile-contact-lbl">Tipo Institución:</span>
                            <span className="acct-mobile-contact-val">{account.companyType || 'Corporativo / Privado'}</span>
                          </div>
                        </div>
                      )}

                      {/* Contenido Pestaña Amortizaciones */}
                      {currentTab === 'amortizations' && (
                        <div className="acct-mobile-amort-list">
                          {account.rows.flatMap(r => (r.advances || []).map(a => ({ ...a, eventName: r.name, eventFolio: r.folio || r.refId }))).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '14px', color: '#94a3b8', fontSize: '11px' }}>
                              No hay abonos registrados para esta cuenta.
                            </div>
                          ) : (
                            account.rows.flatMap(r => (r.advances || []).map(a => ({ ...a, eventName: r.name, eventFolio: r.folio || r.refId })))
                              .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
                              .map((adv, idx) => (
                                <div key={adv.id || idx} className="acct-mobile-adv-item">
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>
                                      {adv.paymentType || 'Transferencia'} • {adv.voucherNumber || 'S/N'}
                                    </span>
                                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#16a34a' }}>
                                      Q {Number(adv.amount || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                    {adv.date} • {adv.eventName} ({adv.eventFolio})
                                  </div>
                                  {adv.evidenceDataUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewVoucher(adv.evidenceDataUrl)}
                                      className="acct-btn-row-action is-voucher"
                                      style={{ marginTop: '6px', fontSize: '10.5px' }}
                                    >
                                      <Eye size={11} /> Ver Comprobante
                                    </button>
                                  )}
                                </div>
                              ))
                          )}
                        </div>
                      )}

                      {/* Botón Footer: Ver Estado Corporativo Completo */}
                      <div style={{ marginTop: '12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setActiveStatementCompanyId(account.key)}
                          className="acct-mobile-full-statement-btn"
                        >
                          <FileText size={13} strokeWidth={2.2} />
                          <span>Ver Estado de Cuenta Completo</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 7. Paginación Móvil */}
        <div className="acct-mobile-pagination">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
            className="acct-mobile-page-btn is-nav"
          >
            Anterior
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => (
                <Fragment key={`m-page-${p}`}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span style={{ padding: '0 2px', color: '#94a3b8', fontSize: '11px' }}>...</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handlePageChange(p)}
                    className={`acct-mobile-page-btn ${currentPage === p ? 'is-active' : ''}`}
                  >
                    {p}
                  </button>
                </Fragment>
              ))}
          </div>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            className="acct-mobile-page-btn is-nav"
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* ── MODAL: HOJA FORMAL DE ESTADO DE CUENTA POR EVENTO ── */}
      {activeEventStatementRow && createPortal(
        <div
          onClick={() => setActiveEventStatementRow(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)', zIndex: 9999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '14px', maxWidth: '980px', width: '100%',
              maxHeight: '92vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)', overflow: 'hidden'
            }}
          >
            {/* Header del Modal */}
            <div style={{
              background: '#0f172a', color: '#ffffff', padding: '14px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid #334155'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={18} color="#38bdf8" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800 }}>
                    Estado de Cuenta Formal del Evento
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Folio: {activeEventStatementRow.folio || activeEventStatementRow.refId} • {activeEventStatementRow.name}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => printEventStatement(activeEventStatementRow)}
                  style={{
                    background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px',
                    padding: '6px 12px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Printer size={13} />
                  <span>Imprimir / Guardar PDF</span>
                </button>

                <button
                  type="button"
                  className="acct-modal-close-btn"
                  onClick={() => setActiveEventStatementRow(null)}
                  style={{
                    background: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1',
                    borderRadius: '8px', padding: '0 12px', height: '34px', minHeight: '34px',
                    display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px',
                    fontWeight: 800, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                    boxSizing: 'border-box', flexShrink: 0
                  }}
                  title="Cerrar (Esc)"
                  aria-label="Cerrar ventana"
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#fee2e2';
                    e.currentTarget.style.color = '#dc2626';
                    e.currentTarget.style.borderColor = '#fca5a5';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.color = '#0f172a';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                >
                  <X size={16} strokeWidth={2.5} style={{ display: 'block', flexShrink: 0 }} />
                  <span>Cerrar</span>
                </button>
              </div>
            </div>

            {/* Cuerpo del Modal: Hoja Formal Membretada */}
            {(() => {
              const modalFin = getQuoteFinancialAmounts(activeEventStatementRow.quote, activeEventStatementRow.exchangeRate);
              const effectiveTotal = Number(activeEventStatementRow.total) > 0 ? Number(activeEventStatementRow.total) : modalFin.totalGtq;
              const effectiveAdvTotal = Number(activeEventStatementRow.advancesTotal) || 0;
              const effectiveDelta = effectiveTotal - effectiveAdvTotal;
              const effectivePending = Math.max(0, effectiveDelta);
              const effectiveCredit = Math.max(0, -effectiveDelta);
              const effectivePaidPct = effectiveTotal > 0 ? ((effectiveAdvTotal / effectiveTotal) * 100).toFixed(1) : (effectiveAdvTotal > 0 ? '100.0' : '0.0');
              const rawUsdTotal = Number(activeEventStatementRow.rawTotal || modalFin.rawTotal || 0);

              return (
                <>
                  <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              <div style={{
                background: '#ffffff', padding: '32px', borderRadius: '12px',
                border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                {/* Membrete JDL */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: '2px solid #0f172a', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img src="/Oficial_JDL_acua.png" alt="JDL" style={{ height: '52px' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>JARDINES DEL LAGO</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>Departamento de Contabilidad y Control de Cobranza</div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>ESTADO DE CUENTA DE EVENTO</div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#0284c7' }}>
                      FOLIO: {activeEventStatementRow.folio || activeEventStatementRow.refId}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                      Fecha de emisión: {new Date().toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Grid de Metadatos del Evento */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px',
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px',
                  padding: '14px 18px', marginBottom: '20px', fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Institución / Cliente:</span>
                      <strong style={{ color: '#0f172a' }}>{activeEventStatementRow.companyName || activeEventStatementRow.clientName}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Nombre del Evento:</span>
                      <strong style={{ color: '#0f172a' }}>{activeEventStatementRow.name}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Salón Asignado:</span>
                      <strong style={{ color: '#0f172a' }}>{activeEventStatementRow.salonesLabel || activeEventStatementRow.salon}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Asistentes (PAX):</span>
                      <strong style={{ color: '#0f172a' }}>{activeEventStatementRow.pax} personas</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Fecha del Evento:</span>
                      <strong style={{ color: '#0f172a' }}>{activeEventStatementRow.eventDate}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Horario:</span>
                      <strong style={{ color: '#0f172a' }}>{activeEventStatementRow.startTime} a {activeEventStatementRow.endTime}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Ejecutivo Responsable:</span>
                      <strong style={{ color: '#0f172a' }}>{activeEventStatementRow.userName}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Teléfono de Contacto:</span>
                      <strong style={{ color: '#0f172a' }}>{activeEventStatementRow.managerPhone || 'S/N'}</strong>
                    </div>
                  </div>
                </div>

                {/* Desglose de Ítems por Categoría */}
                {(() => {
                  const categorized = categorizeQuoteItems(activeEventStatementRow.quote?.items || []);
                  const hasAnyItems = Object.values(categorized).some(s => s.items.length > 0);

                  if (!hasAnyItems) {
                    return (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', background: '#f8fafc', borderRadius: '8px', marginBottom: '20px' }}>
                        No hay ítems desglosados en esta cotización. El monto global contratado es {formatMoney(effectiveTotal)}.
                      </div>
                    );
                  }

                  return Object.entries(categorized).map(([k, sec]) => {
                    if (!sec.items.length) return null;
                    const SecIcon = sec.Icon;
                    return (
                      <div key={k} style={{ marginBottom: '18px' }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
                          padding: '8px 12px', marginBottom: '8px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '12px', color: '#0f172a' }}>
                            <SecIcon size={14} color={sec.color} />
                            <span>{sec.title}</span>
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: sec.color }}>
                            Subtotal: Q {Number(sec.subtotal).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', marginBottom: '8px' }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
                              <th style={{ padding: '6px 10px', textAlign: 'left' }}>Descripción del Servicio</th>
                              <th style={{ padding: '6px 10px', textAlign: 'center', width: '70px' }}>Cant.</th>
                              <th style={{ padding: '6px 10px', textAlign: 'right', width: '110px' }}>Precio Unit.</th>
                              <th style={{ padding: '6px 10px', textAlign: 'right', width: '120px' }}>Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sec.items.map((it, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 10px' }}>
                                  <strong>{it.name || it.description || 'Servicio'}</strong>
                                  {it.notes && <div style={{ fontSize: '10px', color: '#64748b' }}>{it.notes}</div>}
                                </td>
                                <td style={{ padding: '6px 10px', textAlign: 'center' }}>{it.qty}</td>
                                <td style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b' }}>
                                  Q {Number(it.price || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>
                                  Q {Number(it.total || (it.qty * it.price)).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  });
                })()}

                {/* Resumen Financiero en 4 Bloques */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px',
                  background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px',
                  padding: '14px', margin: '20px 0'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Contratado</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                      {formatMoney(effectiveTotal)}
                    </div>
                    {activeEventStatementRow.isUsd && (
                      <div style={{ fontSize: '9.5px', color: '#0284c7', fontWeight: 700 }}>
                        ${rawUsdTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>Total Abonado</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#16a34a', marginTop: '2px' }}>
                      {formatMoney(effectiveAdvTotal)}
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#16a34a', fontWeight: 700 }}>
                      {effectivePaidPct}% pagado
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase' }}>Saldo Pendiente</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: effectivePending > 0 ? '#dc2626' : '#16a34a', marginTop: '2px' }}>
                      {formatMoney(effectivePending)}
                    </div>
                    <div style={{ fontSize: '9.5px', color: effectivePending > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                      {effectivePending > 0 ? 'Por cancelar' : 'Al día'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase' }}>Saldo a Favor</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#7c3aed', marginTop: '2px' }}>
                      {formatMoney(effectiveCredit)}
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#7c3aed', fontWeight: 700 }}>
                      Disponible
                    </div>
                  </div>
                </div>

                {/* Tabla Cronológica de Abonos y Formulario de Aplicación de Pagos */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CreditCard size={15} color="#16a34a" />
                      <span>Historial Cronológico de Abonos / Anticipos ({activeEventStatementRow.advances.length})</span>
                    </div>

                    <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {effectivePending > 0 && (
                        <span style={{
                          background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                          borderRadius: '6px', padding: '3px 8px', fontSize: '10.5px', fontWeight: 800
                        }}>
                          Pendiente: {formatMoney(effectivePending)}
                        </span>
                      )}

                      <button
                        type="button"
                        className={`acct-btn-toggle-form ${showAdvanceForm && !advanceEditingId ? 'is-open' : 'is-closed'}`}
                        onClick={() => {
                          if (showAdvanceForm && !advanceEditingId) {
                            setShowAdvanceForm(false);
                            resetAdvanceForm();
                          } else {
                            resetAdvanceForm();
                            setShowAdvanceForm(true);
                            setTimeout(() => {
                              advanceFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 100);
                          }
                        }}
                      >
                        {showAdvanceForm && !advanceEditingId ? (
                          <>
                            <X size={14} />
                            <span>Ocultar Formulario</span>
                          </>
                        ) : (
                          <>
                            <Plus size={14} />
                            <span>Aplicar / Registrar Pago</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* ── FORMULARIO INTERACTIVO PARA APLICAR PAGOS AL EVENTO ── */}
                  {showAdvanceForm && (
                    <div
                      ref={advanceFormRef}
                      className="no-print"
                      style={{
                        background: '#f8fafc', border: '1.5px solid #93c5fd', borderRadius: '10px',
                        padding: '16px 18px', marginBottom: '16px', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Coins size={16} color="#0284c7" />
                          <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>
                            {advanceEditingId ? '✏️ Editando Abono Registrado' : '💳 Registrar Pago / Abono al Evento'}
                          </strong>
                          {advanceEditingId && (
                            <span style={{ fontSize: '10.5px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                              Modo Edición
                            </span>
                          )}
                          {activeEventStatementRow.isUsd && (
                            <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              Cotización en USD (TC: Q {activeEventStatementRow.exchangeRate || 1})
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {effectivePending > 0 && !advanceEditingId && (
                            <button
                              type="button"
                              className="acct-btn-saldar"
                              onClick={handleFillPendingBalance}
                              title="Llenar con el monto exacto pendiente por cancelar"
                            >
                              <span>⚡ Saldar Pendiente: {formatMoney(effectivePending)}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="acct-btn-cancel-form"
                            onClick={() => { resetAdvanceForm(); setShowAdvanceForm(false); }}
                          >
                            <X size={13} />
                            <span>{advanceEditingId ? 'Cancelar Edición' : 'Cancelar'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Campos del Formulario */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
                        {/* Monto */}
                        <div>
                          <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                            Monto {activeEventStatementRow.isUsd ? '(USD $)' : '(GTQ Q)'} *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            value={advanceForm.amount}
                            onChange={e => setAdvanceForm(prev => ({ ...prev, amount: e.target.value }))}
                            style={{
                              width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px',
                              border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700, color: '#0f172a', background: '#ffffff',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        {/* Fecha */}
                        <div>
                          <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                            Fecha del Abono *
                          </label>
                          <input
                            type="date"
                            value={advanceForm.date}
                            onChange={e => setAdvanceForm(prev => ({ ...prev, date: e.target.value }))}
                            style={{
                              width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px',
                              border: '1px solid #cbd5e1', fontSize: '11.5px', color: '#0f172a', background: '#ffffff',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        {/* Forma de Pago */}
                        <div>
                          <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                            Forma de Pago *
                          </label>
                          <select
                            value={advanceForm.paymentType}
                            onChange={e => setAdvanceForm(prev => ({ ...prev, paymentType: e.target.value }))}
                            style={{
                              width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px',
                              border: '1px solid #cbd5e1', fontSize: '11.5px', fontWeight: 600, color: '#0f172a', background: '#ffffff',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="Transferencia">Transferencia Bancaria</option>
                            <option value="Depósito">Depósito Bancario</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Tarjeta">Tarjeta de Crédito / Débito</option>
                            <option value="Efectivo">Efectivo</option>
                          </select>
                        </div>

                        {/* No. Boleta / Referencia */}
                        <div>
                          <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                            No. Boleta / Ref. {advanceForm.paymentType !== 'Efectivo' ? '*' : '(opcional)'}
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. TRANSF-98234, DEP-1200"
                            value={advanceForm.voucherNumber}
                            onChange={e => setAdvanceForm(prev => ({ ...prev, voucherNumber: e.target.value }))}
                            style={{
                              width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px',
                              border: '1px solid #cbd5e1', fontSize: '11.5px', color: '#0f172a', background: '#ffffff',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      </div>

                      {/* Fila Secundaria: Concepto, Usuario/Vendedor, Comprobante y Botón Guardar */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.4fr 1.4fr 1fr', gap: '12px', alignItems: 'flex-end' }}>
                        {/* Concepto */}
                        <div>
                          <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                            Concepto / Descripción del Pago *
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. Anticipo reserva, cancelación de saldo, finiquito..."
                            value={advanceForm.description}
                            onChange={e => setAdvanceForm(prev => ({ ...prev, description: e.target.value }))}
                            style={{
                              width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px',
                              border: '1px solid #cbd5e1', fontSize: '11.5px', color: '#0f172a', background: '#ffffff',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        {/* Usuario que aplica el pago */}
                        <div>
                          <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                            Usuario *
                          </label>
                          <select
                            value={advanceForm.userId}
                            onChange={e => {
                              const selectedId = e.target.value;
                              const matchedUser = (users || []).find(u => String(u.id) === String(selectedId)) ||
                                                  (uniqueSellers || []).find(u => String(u.id) === String(selectedId));
                              const selectedName = matchedUser?.fullName || matchedUser?.name || e.target.selectedOptions?.[0]?.text || '';
                              setAdvanceForm(prev => ({
                                ...prev,
                                userId: selectedId,
                                userName: selectedName
                              }));
                            }}
                            style={{
                              width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px',
                              border: '1px solid #cbd5e1', fontSize: '11.5px', fontWeight: 600, color: '#0f172a', background: '#ffffff',
                              boxSizing: 'border-box'
                            }}
                          >
                            {advanceForm.userId && !users?.some(u => String(u.id) === String(advanceForm.userId)) && (
                              <option value={advanceForm.userId}>{advanceForm.userName || 'Usuario Actual'}</option>
                            )}
                            {users && users.length > 0 ? (
                              users.map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.fullName || u.name} {u.role ? `(${u.role})` : ''}
                                </option>
                              ))
                            ) : (
                              <option value={advanceForm.userId || '1'}>{advanceForm.userName || 'Usuario'}</option>
                            )}
                          </select>
                        </div>

                        {/* Comprobante */}
                        <div>
                          <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                            Comprobante / Boleta (Imagen o PDF)
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              key={advanceEvidenceInputKey}
                              type="file"
                              accept="image/*,.pdf"
                              onChange={e => {
                                const file = e.target.files?.[0] || null;
                                setAdvanceEvidenceFile(file);
                              }}
                              style={{
                                width: '100%', height: '36px', fontSize: '10.5px', color: '#475569',
                                border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px 8px', background: '#ffffff',
                                boxSizing: 'border-box'
                              }}
                            />
                            {(advanceEvidenceFile || advanceForm.evidenceName) && (
                              <button
                                type="button"
                                className="acct-btn-clear-file"
                                onClick={() => {
                                  setAdvanceEvidenceFile(null);
                                  setAdvanceEvidenceInputKey(k => k + 1);
                                  setAdvanceForm(prev => ({ ...prev, evidenceName: '' }));
                                }}
                                title="Quitar archivo seleccionado"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Botón Guardar */}
                        <div>
                          <button
                            type="button"
                            disabled={savingAdvance}
                            onClick={handleSaveAdvanceInModal}
                            className={`acct-btn-submit-advance ${advanceEditingId ? 'is-edit' : 'is-create'}`}
                            style={{ width: '100%' }}
                          >
                            <Check size={15} strokeWidth={2.5} />
                            <span>{savingAdvance ? 'Guardando...' : (advanceEditingId ? 'Actualizar Abono' : 'Guardar Pago')}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
                        <th style={{ padding: '7px 10px', textAlign: 'left', width: '30px' }}>#</th>
                        <th style={{ padding: '7px 10px', textAlign: 'left', width: '85px' }}>Fecha</th>
                        <th style={{ padding: '7px 10px', textAlign: 'left', width: '110px' }}>Forma Pago</th>
                        <th style={{ padding: '7px 10px', textAlign: 'left', width: '120px' }}>No. Boleta / Ref</th>
                        <th style={{ padding: '7px 10px', textAlign: 'left' }}>Concepto</th>
                        <th style={{ padding: '7px 10px', textAlign: 'left', width: '135px' }}>Usuario</th>
                        <th style={{ padding: '7px 10px', textAlign: 'right', width: '110px' }}>Monto</th>
                        <th style={{ padding: '7px 10px', textAlign: 'center', width: '90px' }}>Comprobante</th>
                        <th className="no-print" style={{ padding: '7px 10px', textAlign: 'center', width: '120px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeEventStatementRow.advances.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                            No hay abonos registrados para este evento.
                          </td>
                        </tr>
                      ) : (
                        activeEventStatementRow.advances.map((adv, idx) => {
                          const appliedByName = adv.createdByName || adv.userName || (adv.createdByUserId && users?.find(u => String(u.id) === String(adv.createdByUserId))?.name) || activeEventStatementRow.userName || 'Sistema';
                          return (
                            <tr key={adv.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '7px 10px', color: '#64748b' }}>{idx + 1}</td>
                              <td style={{ padding: '7px 10px', fontWeight: 600 }}>{adv.date || '-'}</td>
                              <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0f172a' }}>{adv.paymentType}</td>
                              <td style={{ padding: '7px 10px', fontWeight: 800, color: '#0284c7' }}>
                                {adv.voucherNumber || 'S/N'}
                              </td>
                              <td style={{ padding: '7px 10px', color: '#475569' }}>{adv.description || '-'}</td>
                              <td style={{ padding: '7px 10px', color: '#0f172a' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                  <User size={12} color="#0284c7" />
                                  <span style={{ fontWeight: 600, fontSize: '11px', color: '#1e293b' }}>
                                    {appliedByName}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                                Q {Number(adv.amount || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                {adv.evidenceDataUrl ? (
                                  <button
                                    type="button"
                                    className="acct-btn-row-action is-voucher"
                                    onClick={() => setPreviewVoucher(adv)}
                                    title="Ver imagen o archivo de la boleta de pago"
                                  >
                                    <Eye size={12} />
                                    <span>Ver Boleta</span>
                                  </button>
                                ) : (
                                  <span style={{ color: '#cbd5e1', fontSize: '10px' }}>Sin adjunto</span>
                                )}
                              </td>
                              <td className="no-print" style={{ padding: '7px 10px', textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', gap: '5px' }}>
                                  <button
                                    type="button"
                                    className="acct-btn-row-action is-edit"
                                    onClick={() => handleStartEditAdvance(adv)}
                                    title="Editar este pago"
                                  >
                                    <Edit2 size={11} />
                                    <span>Editar</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="acct-btn-row-action is-delete"
                                    onClick={() => handleDeleteAdvanceInModal(adv.id)}
                                    title="Eliminar este abono"
                                  >
                                    <Trash2 size={11} />
                                    <span>Eliminar</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Cuentas Bancarias Autorizadas */}
                <div style={{
                  background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px',
                  padding: '12px 16px', fontSize: '11px', color: '#0369a1', lineHeight: 1.6, marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, marginBottom: '4px' }}>
                    <Building2 size={14} />
                    <span>CUENTAS BANCARIAS AUTORIZADAS PARA PAGOS / TRANSFERENCIAS:</span>
                  </div>
                  <div><strong>Banco Industrial (Monetaria GTQ):</strong> No. 004-002345-1 a nombre de <em>Jardines del Lago S.A.</em></div>
                  <div><strong>BAC Credomatic (Monetaria GTQ):</strong> No. 90-123456-7 a nombre de <em>Jardines del Lago S.A.</em></div>
                  <div style={{ fontSize: '10px', color: '#0284c7', marginTop: '4px' }}>
                    * Favor de enviar copia de la boleta de pago o transferencia indicando el Folio / Código de cotización.
                  </div>
                </div>

                {/* Bloque de Firmas */}
                <div className="acct-signatures-block" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '40px', marginTop: '30px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ borderBottom: '1px solid #0f172a', height: '40px', marginBottom: '8px' }}></div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>DEPARTAMENTO DE CONTABILIDAD</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>Jardines del Lago S.A.</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ borderBottom: '1px solid #0f172a', height: '40px', marginBottom: '8px' }}></div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>{activeEventStatementRow.companyName || 'CLIENTE / INSTITUCIÓN'}</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>Firma y Sello de Conformidad</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer de Acciones Rápidas (no-print) */}
            <div className="no-print" style={{
              background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '12px 24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                {effectivePending > 0 ? (
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>
                    ⚠️ Saldo pendiente: {formatMoney(effectivePending)}
                  </span>
                ) : (
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>
                    ✓ Evento totalmente al día / cancelado
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="acct-btn-print"
                  onClick={() => printEventStatement(activeEventStatementRow)}
                >
                  <Printer size={13} />
                  <span>Imprimir Estado</span>
                </button>

                <button
                  type="button"
                  className="acct-modal-close-btn"
                  onClick={() => setActiveEventStatementRow(null)}
                >
                  <X size={16} />
                  <span>Cerrar</span>
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  </div>,
        document.body
      )}

      {/* ── MODAL: VISOR DE BOLETAS DE PAGO (LIGHTBOX) ── */}
      {previewVoucher && createPortal(
        <div
          onClick={() => setPreviewVoucher(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(6px)', zIndex: 10000, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '12px', maxWidth: '650px', width: '100%',
              overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
            }}
          >
            <div style={{
              background: '#0f172a', color: '#ffffff', padding: '12px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800 }}>
                  Boleta de Pago / Comprobante
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  No. {previewVoucher.voucherNumber || 'S/N'} • Q {Number(previewVoucher.amount || 0).toFixed(2)} ({previewVoucher.paymentType})
                </div>
              </div>
              <button
                type="button"
                className="acct-modal-close-btn"
                onClick={() => setPreviewVoucher(null)}
                style={{
                  background: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1',
                  borderRadius: '8px', padding: '0 10px', height: '30px', minHeight: '30px',
                  display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px',
                  fontWeight: 800, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  boxSizing: 'border-box', flexShrink: 0
                }}
                title="Cerrar (Esc)"
                aria-label="Cerrar"
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#fee2e2';
                  e.currentTarget.style.color = '#dc2626';
                  e.currentTarget.style.borderColor = '#fca5a5';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = '#0f172a';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              >
                <X size={14} strokeWidth={2.5} style={{ display: 'block', flexShrink: 0 }} />
                <span>Cerrar</span>
              </button>
            </div>

            <div style={{ padding: '16px', maxHeight: '75vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', background: '#f8fafc' }}>
              {previewVoucher.evidenceDataUrl ? (
                previewVoucher.evidenceType?.includes('pdf') ? (
                  <iframe src={previewVoucher.evidenceDataUrl} style={{ width: '100%', height: '450px', border: 'none' }} title="PDF Comprobante" />
                ) : (
                  <img
                    src={previewVoucher.evidenceDataUrl}
                    alt="Boleta de pago"
                    style={{ maxWidth: '100%', maxHeight: '550px', borderRadius: '8px', objectFit: 'contain', border: '1px solid #cbd5e1' }}
                  />
                )
              ) : (
                <div style={{ padding: '30px', color: '#94a3b8' }}>No hay imagen adjunta para este abono.</div>
              )}
            </div>

            <div style={{ padding: '10px 18px', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b' }}>
              <span>Concepto: {previewVoucher.description || 'Sin notas'}</span>
              <button
                type="button"
                onClick={() => setPreviewVoucher(null)}
                style={{
                  background: '#0f172a', color: '#ffffff', border: 'none',
                  borderRadius: '6px', padding: '5px 14px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: ESTADO DE CUENTA DE EMPRESA (CONSOLIDADO) ── */}
      {activeStatementAccount && createPortal(
        <div
          onClick={() => setActiveStatementCompanyId(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)', zIndex: 9999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '14px', maxWidth: '980px', width: '100%',
              maxHeight: '92vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)', overflow: 'hidden'
            }}
          >
            <div style={{
              background: '#0f172a', color: '#ffffff', padding: '14px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid #334155'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 size={18} color="#38bdf8" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800 }}>
                    Estado de Cuenta Corporativo — {activeStatementAccount.companyName}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {activeStatementAccount.rows?.length} evento(s) registrados
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => printCompanyStatement(activeStatementAccount)}
                  style={{
                    background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px',
                    padding: '6px 12px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Printer size={13} />
                  <span>Imprimir</span>
                </button>

                <button
                  type="button"
                  className="acct-modal-close-btn"
                  onClick={() => setActiveStatementCompanyId(null)}
                  style={{
                    background: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1',
                    borderRadius: '8px', padding: '0 12px', height: '34px', minHeight: '34px',
                    display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px',
                    fontWeight: 800, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                    boxSizing: 'border-box', flexShrink: 0
                  }}
                  title="Cerrar (Esc)"
                  aria-label="Cerrar ventana"
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#fee2e2';
                    e.currentTarget.style.color = '#dc2626';
                    e.currentTarget.style.borderColor = '#fca5a5';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.color = '#0f172a';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                >
                  <X size={16} strokeWidth={2.5} style={{ display: 'block', flexShrink: 0 }} />
                  <span>Cerrar</span>
                </button>
              </div>
            </div>

            <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              <div style={{
                background: '#ffffff', padding: '24px', borderRadius: '12px',
                border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '2px solid #0f172a', paddingBottom: '14px' }}>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>{activeStatementAccount.companyName}</h2>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Teléfono: {activeStatementAccount.contactPhone || 'S/N'} • Ejecutivo: {activeStatementAccount.primarySeller}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 900, color: '#0284c7' }}>ESTADO DE CUENTA</div>
                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                      Fecha: {new Date().toLocaleDateString('es-GT')}
                    </div>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', marginBottom: '18px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
                      <th style={{ padding: '7px 10px', textAlign: 'left' }}>Fecha</th>
                      <th style={{ padding: '7px 10px', textAlign: 'left' }}>Folio / Ref</th>
                      <th style={{ padding: '7px 10px', textAlign: 'left' }}>Evento</th>
                      <th style={{ padding: '7px 10px', textAlign: 'left' }}>Salón</th>
                      <th style={{ padding: '7px 10px', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '7px 10px', textAlign: 'right' }}>Cobrado</th>
                      <th style={{ padding: '7px 10px', textAlign: 'right' }}>Saldo Pendiente</th>
                      <th style={{ padding: '7px 10px', textAlign: 'center' }}>Hoja Evento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStatementAccount.rows.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '7px 10px' }}>{r.eventDate}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 800, color: '#0284c7' }}>{r.folio || r.refId}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '7px 10px', color: '#64748b' }}>{r.salon}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>{formatMoney(r.total)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>{formatMoney(r.advancesTotal)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: r.balancePending > 0 ? '#dc2626' : '#16a34a' }}>
                          {formatMoney(r.balancePending)}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => { setActiveStatementCompanyId(null); setActiveEventStatementRow(r); }}
                            style={{
                              background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                              borderRadius: '4px', padding: '3px 8px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer'
                            }}
                          >
                            Hoja Evento
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{
                  display: 'flex', justifyContent: 'flex-end', gap: '20px',
                  borderTop: '2px solid #0f172a', paddingTop: '12px'
                }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>TOTAL CONTRATADO</div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>{formatMoney(activeStatementAccount.netAmount)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700 }}>TOTAL COBRADO</div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#16a34a' }}>{formatMoney(activeStatementAccount.collectedAmount)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700 }}>SALDO PENDIENTE</div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#dc2626' }}>{formatMoney(activeStatementAccount.pendingAmount)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
