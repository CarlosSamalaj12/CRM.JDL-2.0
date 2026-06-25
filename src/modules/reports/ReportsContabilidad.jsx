import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { loadState as loadCrmState } from '../../services/stateService';
import authService from '../../services/authService';
import { STATUS_META } from '../calendar/constants';

export default function ReportsContabilidad({ onClose }) {
  const { events, users, handleAddEvent } = useOutletContext();
  const navigate = useNavigate();
  
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salonFilter, setSalonFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());
  const [activeStatementCompanyId, setActiveStatementCompanyId] = useState(null);

  // Fetch institutions on mount
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
    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const token = localStorage.getItem('token');
    fetch(`${apiUrl}/api/config/formas-pago`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.json())
      .then(data => { if (active) setFormasPago(Array.isArray(data) ? data.filter(fp => fp.activo !== 0) : []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(amount || 0);
  };

  // Utility functions preserved
  const getEventSeries = (ev, allEvents) => {
    if (!ev) return [];
    const groupId = ev.groupId || ev.id_grupo || ev.idGroup;
    if (!groupId) return [ev];
    return allEvents.filter(x => String(x.groupId || x.id_grupo || x.idGroup || '') === String(groupId));
  };

  const getEventSeriesFinancialMeta = (ev, allEvents) => {
    const series = getEventSeries(ev, allEvents)
      .slice()
      .sort((a, b) => {
        const byDate = String(a?.date || "").localeCompare(String(b?.date || ""));
        if (byDate !== 0) return byDate;
        const byStart = String(a?.startTime || "").localeCompare(String(b?.startTime || ""));
        if (byStart !== 0) return byStart;
        return String(a?.salon || "").localeCompare(String(b?.salon || ""));
      });
    
    const salonesList = [];
    for (const item of series) {
      const eventSalones = Array.isArray(item?.salones) ? item.salones : [];
      for (const salon of [...eventSalones, item?.salon]) {
        const label = String(salon || "").trim();
        if (label) salonesList.push(label);
      }
    }
    const uniqueSalones = Array.from(new Set(salonesList));
    const explicitMainSalon = series.map((item) => String(item?.mainSalon || "").trim()).find(Boolean) || "";
    const mainSalon = explicitMainSalon || uniqueSalones[0] || String(ev?.salon || "").trim();
    
    const primaryEvent = series.find((item) => String(item?.salon || "").trim() === mainSalon)
      || series.find((item) => String(item?.id || "").trim() === String(ev?.id || "").trim())
      || series[0]
      || ev
      || null;
      
    const firstEvent = series[0] || ev || null;
    const lastEvent = series[series.length - 1] || ev || null;
    
    return {
      series,
      salones: uniqueSalones,
      mainSalon,
      primaryEvent,
      startDate: String(firstEvent?.date || "").trim(),
      endDate: String(lastEvent?.date || "").trim(),
      startTime: String(primaryEvent?.startTime || firstEvent?.startTime || "").trim(),
      endTime: String(primaryEvent?.endTime || firstEvent?.endTime || "").trim(),
    };
  };

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
        createdByUserId: String(item?.createdByUserId || ''),
        createdByName: String(item?.createdByName || ''),
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
    return d.toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
  };

  const parseQuoteDate = (raw) => {
    if (!raw) return null;
    let d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return stripTime(d);
    d = new Date(`${raw}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : stripTime(d);
  };

  const summarizeAccountingCollectionState = (account) => {
    const pending = Math.max(0, Number(account?.pendingAmount || 0));
    const credit = Math.max(0, Number(account?.creditAmount || 0));
    const due = parseQuoteDate(String(account?.nextDueDate || "").trim());
    if (credit > 0 && pending <= 0) {
      return { label: "Saldo a favor", tone: "credit", eta: "Disponible para compensar en otro evento", dueLabel: "Sin cobro urgente", sortWeight: 4 };
    }
    if (pending <= 0) {
      return { label: "Saldado", tone: "ok", eta: "Sin gestion pendiente", dueLabel: "Cuenta al dia", sortWeight: 5 };
    }
    if (!due) {
      return { label: "Sin fecha limite", tone: "neutral", eta: "Definir fecha maxima de pago", dueLabel: "Cobro sin programar", sortWeight: 3 };
    }
    const today = stripTime(new Date());
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) {
      const days = Math.abs(diffDays);
      return { label: `Vencido ${days} ${days === 1 ? "dia" : "dias"}`, tone: "overdue", eta: "Solicitar pago hoy", dueLabel: fmtDateShort(due), sortWeight: 0 };
    }
    if (diffDays === 0) {
      return { label: "Cobro hoy", tone: "due", eta: "Solicitar pago hoy", dueLabel: fmtDateShort(due), sortWeight: 1 };
    }
    if (diffDays <= 3) {
      return { label: `Por vencer ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`, tone: "due", eta: `Solicitar en ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`, dueLabel: fmtDateShort(due), sortWeight: 2 };
    }
    return { label: "En tiempo", tone: "ok", eta: `Solicitar en ${diffDays} dias`, dueLabel: fmtDateShort(due), sortWeight: 3 };
  };

  const pickActionRow = (list) => {
    return list.slice().sort((a, b) => {
      const aPending = Number(a?.balancePending || 0) > 0 ? 0 : 1;
      const bPending = Number(b?.balancePending || 0) > 0 ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      const dueCmp = String(a?.dueDate || "9999-12-31").localeCompare(String(b?.dueDate || "9999-12-31"));
      if (dueCmp !== 0) return dueCmp;
      return String(b?.eventDate || "").localeCompare(String(a?.eventDate || ""));
    })[0] || null;
  };

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
      const quote = primaryEvent?.quote || ev?.quote || {};
      const assignedUser = users?.find(u => u.id === (primaryEvent?.userId || ev?.userId));
      const advances = normalizeQuoteAdvancesForSnapshot(quote?.advances);
      const advancesSorted = advances.slice().sort((a, b) => {
        const d = String(a.date || "").localeCompare(String(b.date || ""));
        if (d !== 0) return d;
        return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      });
      const lastAdvance = advancesSorted.length ? advancesSorted[advancesSorted.length - 1] : null;
      const advancesTotal = advancesSorted.reduce((acc, item) => acc + Math.max(0, Number(item.amount || 0)), 0);
      const total = Math.max(0, Number(quote?.total || 0));
      const delta = total - advancesTotal;
      const companyId = quote?.companyId || '';
      const matchedCompany = companies.find(c => c.id === companyId);
      const companyName = matchedCompany?.name || quote?.companyName || 'Sin institucion';
      rows.push({
        id: ev.id, actionEventId: primaryEvent?.id || ev?.id, companyId, companyName,
        refId: quote?.code || reservationKey || primaryEvent?.id || ev?.id || '',
        name: primaryEvent?.name || ev?.name || '',
        eventDate: financialMeta.startDate || primaryEvent?.date || ev?.date || '',
        endDate: financialMeta.endDate || financialMeta.startDate || ev?.date || '',
        startTime: financialMeta.startTime || primaryEvent?.startTime || ev?.startTime || '',
        endTime: financialMeta.endTime || primaryEvent?.endTime || ev?.endTime || '',
        salon: financialMeta.mainSalon || primaryEvent?.salon || ev?.salon || '',
        salones: financialMeta.salones, salonesLabel: financialMeta.salones.join(', '),
        status: primaryEvent?.status || ev?.status || '',
        userId: primaryEvent?.userId || ev?.userId,
        userName: assignedUser?.fullName || assignedUser?.name || 'Sin asignar',
        seller: assignedUser?.fullName || assignedUser?.name || 'Sin asignar',
        clientName: ev.clientName || quote?.companyName || quote?.contact || '',
        manager: quote?.contact || matchedCompany?.owner || '',
        managerPhone: quote?.phone || matchedCompany?.phone || '',
        pax: Number(primaryEvent?.pax || ev?.pax || quote?.people || 0),
        quote, dueDate: quote?.dueDate || '', docDate: quote?.docDate || '',
        paymentType: quote?.paymentType || '', subtotal: quote?.subtotal || 0, total,
        discount: quote?.discountValue || 0, advances: advancesSorted,
        advancesCount: advancesSorted.length, advancesTotal,
        balancePending: Math.max(0, delta), creditBalance: Math.max(0, -delta),
        lastAdvanceDate: lastAdvance?.date ? String(lastAdvance.date) : '',
        lastAdvancePaymentType: lastAdvance?.paymentType ? String(lastAdvance.paymentType) : '',
        lastAdvanceDescription: lastAdvance?.description ? String(lastAdvance.description) : '',
        catBuckets: quote?.catBuckets || { alimentosBebidas: { amount: 0 }, hospedajeJdl: { amount: 0 }, hospedajeTerceros: { amount: 0 }, miscelaneos: { amount: 0 } },
        statusColor: STATUS_META[primaryEvent?.status || ev?.status]?.color || '#64748b'
      });
    }
    return rows;
  }, [events, users, companies]);

  const filteredData = useMemo(() => {
    let filtered = reportData;
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(r => 
        r.name?.toLowerCase().includes(term) || r.clientName?.toLowerCase().includes(term) ||
        r.salon?.toLowerCase().includes(term) || r.userName?.toLowerCase().includes(term) ||
        r.refId?.toLowerCase().includes(term) || r.companyName?.toLowerCase().includes(term)
      );
    }
    if (dateFrom) filtered = filtered.filter(r => r.eventDate >= dateFrom);
    if (dateTo) filtered = filtered.filter(r => r.eventDate <= dateTo);
    if (userFilter !== 'all') filtered = filtered.filter(r => String(r.userId || '') === String(userFilter));
    if (statusFilter !== 'all') filtered = filtered.filter(r => r.status === statusFilter);
    if (salonFilter !== 'all') filtered = filtered.filter(r => r.salon === salonFilter || r.salones?.includes(salonFilter));
    if (companyFilter !== 'all') filtered = filtered.filter(r => String(r.companyId || '') === String(companyFilter));
    return filtered;
  }, [reportData, search, dateFrom, dateTo, userFilter, statusFilter, salonFilter, companyFilter]);

  const getAccountingCompanyAccounts = (rowsList = []) => {
    const sourceRows = Array.isArray(rowsList) ? rowsList : [];
    const groups = new Map();
    for (const row of sourceRows) {
      const key = String(row?.companyId || row?.companyName || row?.refId || row?.id || `sin_empresa_${groups.size + 1}`);
      const account = groups.get(key) || {
        key, companyId: String(row?.companyId || ""),
        companyName: String(row?.companyName || "Sin institucion").trim() || "Sin institucion",
        contactPhone: String(row?.managerPhone || "").trim(), rows: [],
        netAmount: 0, collectedAmount: 0, pendingAmount: 0, creditAmount: 0,
        eventsCount: 0, pendingEventsCount: 0, paidEventsCount: 0, advancesCount: 0,
        sellerMap: new Map(), lastAdvanceDate: "", nextDueDate: "",
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
      const actionRow = pickActionRow(account.rows);
      return {
        ...account, primarySeller: sellerEntry?.[0] || "",
        collectionLabel: collection.label, collectionTone: collection.tone,
        collectionEta: collection.eta, collectionDueLabel: collection.dueLabel,
        collectionSortWeight: collection.sortWeight,
        actionEventId: String(actionRow?.actionEventId || actionRow?.id || ""),
        actionHasCredit: Math.max(0, Number(account.creditAmount || 0)) > 0,
      };
    }).sort((a, b) => {
      if (a.collectionSortWeight !== b.collectionSortWeight) return a.collectionSortWeight - b.collectionSortWeight;
      if (Number(b.pendingAmount || 0) !== Number(a.pendingAmount || 0)) return Number(b.pendingAmount || 0) - Number(a.pendingAmount || 0);
      return String(a.companyName || "").localeCompare(String(b.companyName || ""));
    });
  };

  const accounts = useMemo(() => getAccountingCompanyAccounts(filteredData), [filteredData]);
  const activeStatementAccount = useMemo(() => {
    if (!activeStatementCompanyId) return null;
    return accounts.find(a => String(a.companyId) === String(activeStatementCompanyId)) || null;
  }, [accounts, activeStatementCompanyId]);

  const summary = useMemo(() => {
    const discountAmount = filteredData.reduce((acc, row) => acc + Math.max(0, Number(row?.discount || 0)), 0);
    const netAmount = filteredData.reduce((acc, row) => acc + Math.max(0, Number(row?.total || 0)), 0);
    const collectedAmount = filteredData.reduce((acc, row) => acc + Math.max(0, Number(row?.advancesTotal || 0)), 0);
    const pendingAmount = filteredData.reduce((acc, row) => acc + Math.max(0, Number(row?.balancePending || 0)), 0);
    const creditAmount = filteredData.reduce((acc, row) => acc + Math.max(0, Number(row?.creditBalance || 0)), 0);
    const overdueCount = accounts.filter((account) => account.collectionTone === "overdue").length;
    const nextCollection = accounts.find((account) => account.nextDueDate);
    return { discountAmount, netAmount, collectedAmount, pendingAmount, creditAmount, overdueCount, nextCollection };
  }, [filteredData, accounts]);

  /* ── Advance form helpers (inline in statement modal) ── */
  const normalizeAdvancePaymentType = (rawType) => {
    const value = String(rawType || '').trim().toLowerCase();
    if (value === 'credito') return 'Credito';
    if (value === 'deposito' || value === 'depósito') return 'Deposito';
    if (value === 'efectivo') return 'Efectivo';
    if (value === 'tarjeta') return 'Tarjeta';
    if (value === 'transferencia') return 'Transferencia';
    if (value === 'cheque') return 'Cheque';
    return rawType || 'Efectivo';
  };
  const readFileAsDataUrl = (file) => new Promise((resolve) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
  const getCurrentActor = () => {
    const user = authService.getCurrentUser?.() || {};
    return {
      id: String(user.id || user.userId || '').trim(),
      name: String(user.fullName || user.name || user.username || 'Sistema').trim()
    };
  };
  const todayISO = () => new Date().toISOString().split('T')[0];

  const [formasPago, setFormasPago] = useState([]);
  const [advanceForm, setAdvanceForm] = useState({ amount: '', date: todayISO(), paymentType: 'Efectivo', voucherNumber: '', description: '', evidenceName: '' });
  const [advanceEvidenceFile, setAdvanceEvidenceFile] = useState(null);
  const [advanceEditingId, setAdvanceEditingId] = useState('');
  const [advanceEvidenceInputKey, setAdvanceEvidenceInputKey] = useState(0);
  const [historial, setHistorial] = useState(null);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [hoveredTooltipPos, setHoveredTooltipPos] = useState(null);
  const [hoveredTooltipAccount, setHoveredTooltipAccount] = useState(null);
  const [hoveredEventPos, setHoveredEventPos] = useState(null);
  const [hoveredEventData, setHoveredEventData] = useState(null);
  const [hoveredLedgerPos, setHoveredLedgerPos] = useState(null);
  const [hoveredLedgerData, setHoveredLedgerData] = useState(null);

  const fetchHistorial = async (eventId) => {
    if (!eventId) return;
    setHistorialLoading(true);
    try {
      const res = await fetch(`/api/anticipos/historial/${eventId}`);
      if (res.ok) { const data = await res.json(); setHistorial(data); } else setHistorial([]);
    } catch { setHistorial([]); }
    setHistorialLoading(false);
  };

  const toggleHistorial = (eventId) => {
    if (!historialOpen) fetchHistorial(eventId);
    setHistorialOpen(!historialOpen);
  };

  const resetAdvanceFormInModal = () => {
    setAdvanceEditingId('');
    setAdvanceEvidenceFile(null);
    setAdvanceEvidenceInputKey(k => k + 1);
    setAdvanceForm({ amount: '', date: todayISO(), paymentType: 'Efectivo', voucherNumber: '', description: '', evidenceName: '' });
  };

  const handleSaveAdvanceInModal = async (eventId) => {
    const amount = Math.max(0, Number(advanceForm.amount || 0));
    const paymentType = normalizeAdvancePaymentType(advanceForm.paymentType);
    const date = String(advanceForm.date || '').trim();
    const voucherNumber = String(advanceForm.voucherNumber || '').trim();
    const description = String(advanceForm.description || '').trim();
    if (!advanceForm.amount || amount <= 0) { toast.error('El monto es obligatorio y debe ser mayor a 0.'); return; }
    if (!date) { toast.error('La fecha es obligatoria.'); return; }
    if (!description) { toast.error('La descripcion es obligatoria.'); return; }
    if (paymentType !== 'Efectivo' && !voucherNumber) { toast.error('El No. de boleta es obligatorio para este tipo de pago.'); return; }

    let evidenceDataUrl = '';
    let evidenceName = '';
    let evidenceType = '';
    if (advanceEvidenceFile) {
      if (Number(advanceEvidenceFile.size || 0) > 6 * 1024 * 1024) { toast.error('La evidencia supera 6 MB.'); return; }
      evidenceDataUrl = await readFileAsDataUrl(advanceEvidenceFile);
      evidenceName = String(advanceEvidenceFile.name || '').trim();
      evidenceType = String(advanceEvidenceFile.type || '').trim();
    }

    const actor = getCurrentActor();
    const event = events.find(ev => String(ev.id) === String(eventId));
    if (!event) { toast.error('No se encontró el evento.'); return; }
    const quote = { ...(event.quote || {}), advances: [...(event.quote?.advances || [])] };

    if (advanceEditingId) {
      const idx = quote.advances.findIndex(a => String(a.id) === String(advanceEditingId));
      if (idx >= 0) {
        const prev = quote.advances[idx];
        quote.advances[idx] = { ...prev, amount, paymentType, date, voucherNumber, description, evidenceDataUrl: evidenceDataUrl || prev.evidenceDataUrl || '', evidenceName: evidenceName || prev.evidenceName || '', evidenceType: evidenceType || prev.evidenceType || '' };
      }
    } else {
      quote.advances.push({
        id: `adv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        amount, paymentType, date, voucherNumber, description, evidenceDataUrl, evidenceName, evidenceType,
        createdAt: new Date().toISOString(), createdByUserId: actor.id, createdByName: actor.name
      });
    }
    quote.advanceLogs = [...(quote.advanceLogs || []), { id: `advlog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), actorName: actor.name, actorId: actor.id, tone: advanceEditingId ? 'edited' : 'added', label: advanceEditingId ? 'Editado' : 'Agregado', change: `${advanceEditingId ? 'Editado' : 'Agregado'} anticipo: Q ${amount.toFixed(2)} - ${description}` }];

    try {
      await handleAddEvent({ ...event, quote });
      toast.success(advanceEditingId ? 'Anticipo actualizado.' : 'Anticipo agregado.');
      resetAdvanceFormInModal();
    } catch { toast.error('No se pudo guardar el anticipo.'); }
  };

  const handleDeleteAdvanceInModal = async (eventId, advanceId) => {
    const result = await Swal.fire({ icon: 'warning', title: 'Eliminar anticipo', text: 'Este movimiento se quitara de los saldos.', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#991b1b', cancelButtonColor: '#1267d8' });
    if (!result.isConfirmed) return;
    const actor = getCurrentActor();
    const event = events.find(ev => String(ev.id) === String(eventId));
    if (!event) return;
    const quote = { ...(event.quote || {}), advances: (event.quote?.advances || []).filter(a => String(a.id) !== String(advanceId)), advanceLogs: [...(event.quote?.advanceLogs || []), { id: `advlog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), actorName: actor.name, actorId: actor.id, tone: 'deleted', label: 'Eliminado', change: `Anticipo eliminado` }] };
    try { await handleAddEvent({ ...event, quote }); toast.success('Anticipo eliminado.'); if (String(advanceEditingId) === String(advanceId)) resetAdvanceFormInModal(); } catch { toast.error('No se pudo eliminar el anticipo.'); }
  };

  const printStatement = (account) => {
    if (!account) return;
    const companyData = companies.find(c => String(c.id) === String(account.companyId));
    const entries = buildAccountingLedgerEntries(account);
    const advancesList = account.rows.reduce((acc, row) => {
      const eventAdvances = Array.isArray(row?.advances) ? row.advances.map(a => ({ ...a, eventId: row.id, refId: row.refId, eventDate: row.eventDate })) : [];
      return acc.concat(eventAdvances);
    }, []).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    const baseUrl = window.location.origin;
    const now = new Date().toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' });
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Estado de Cuenta</title>
<style>
  @page { margin: 20mm 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 20px; font-size: 12px; line-height: 1.5; }
  .header { text-align: center; padding-bottom: 16px; border-bottom: 2px solid #0f172a; margin-bottom: 20px; }
  .header .logo { height: 70px; margin-bottom: 8px; }
  .header h1 { font-size: 20px; color: #0f172a; letter-spacing: 1px; margin-bottom: 2px; }
  .header .sub { font-size: 11px; color: #64748b; }
  .company-section { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .company-section .left { font-size: 13px; }
  .company-section .left strong { font-size: 16px; }
  .company-section .right { text-align: right; font-size: 10px; color: #475569; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #f1f5f9; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; text-align: left; border-bottom: 2px solid #e2e8f0; }
  th.right { text-align: right; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  td.right { text-align: right; }
  tr.total-row td { font-weight: 800; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; font-size: 12px; }
  .summary { display: flex; gap: 20px; justify-content: flex-end; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .summary-item { text-align: right; }
  .summary-item .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-item .value { font-size: 16px; font-weight: 800; }
  .advances-table { margin-top: 24px; }
  .advances-table h3 { font-size: 13px; margin-bottom: 8px; color: #0f172a; }
  .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  @media print { body { padding: 0; } }
</style></head><body>
  <div class="header">
    <img class="logo" src="${baseUrl}/Oficial_JDL_acua.png" alt="JDL">
    <h1>JARDINES DEL LAGO</h1>
    <div class="sub">Departamento de Cobros y Contabilidad</div>
    <div class="sub" style="margin-top:4px;font-weight:700;font-size:13px;">ESTADO DE CUENTA</div>
  </div>
  <div class="company-section">
    <div class="left">
      <strong>${account.companyName || 'Sin institucion'}</strong><br>
      ${companyData?.nit ? `NIT: ${companyData.nit}` : ''}<br>
      ${companyData?.address || ''}
    </div>
    <div class="right">
      Fecha de emision: ${now}<br>
      Contacto: ${account.contactPhone || account.rows?.[0]?.quote?.contact || '-'}
    </div>
  </div>
  <table>
    <thead><tr><th>Fecha</th><th>Ref</th><th>Concepto</th><th class="right">Cargo</th><th class="right">Abono</th><th class="right">Saldo</th></tr></thead>
    <tbody>
      ${entries.map(e => `<tr>
        <td>${e.date || '-'}</td>
        <td style="font-weight:700">${e.refId || '-'}</td>
        <td>${e.concept || '-'}</td>
        <td class="right">${e.debit > 0 ? 'Q ' + Number(e.debit).toLocaleString('es-GT', {minimumFractionDigits:2,maximumFractionDigits:2}) : '-'}</td>
        <td class="right">${e.credit > 0 ? 'Q ' + Number(e.credit).toLocaleString('es-GT', {minimumFractionDigits:2,maximumFractionDigits:2}) : '-'}</td>
        <td class="right" style="font-weight:800;color:${e.runningBalance > 0 ? '#dc2626' : '#16a34a'}">Q ${Number(e.runningBalance).toLocaleString('es-GT', {minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="summary">
    <div class="summary-item"><div class="label">Total Neto</div><div class="value">Q ${Number(account.netAmount || 0).toLocaleString('es-GT', {minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
    <div class="summary-item"><div class="label" style="color:#16a34a">Total Pagado</div><div class="value" style="color:#16a34a">Q ${Number(account.collectedAmount || 0).toLocaleString('es-GT', {minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
    <div class="summary-item"><div class="label" style="color:${account.pendingAmount > 0 ? '#dc2626' : '#16a34a'}">Saldo Pendiente</div><div class="value" style="color:${account.pendingAmount > 0 ? '#dc2626' : '#16a34a'}">Q ${Number(account.pendingAmount || 0).toLocaleString('es-GT', {minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
    ${Number(account.creditAmount || 0) > 0 ? `<div class="summary-item"><div class="label" style="color:#2563eb">Saldo a Favor</div><div class="value" style="color:#2563eb">Q ${Number(account.creditAmount).toLocaleString('es-GT', {minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>` : ''}
  </div>
  ${advancesList.length > 0 ? `<div class="advances-table"><h3>Detalle de Pagos Aplicados</h3><table><thead><tr><th>Fecha</th><th>Ref</th><th>Monto</th><th>Forma de Pago</th><th>Descripcion</th><th>Registrado por</th></tr></thead><tbody>
    ${advancesList.map(a => `<tr>
      <td>${a.date || '-'}</td>
      <td>${a.refId || '-'}</td>
      <td class="right" style="font-weight:700;color:#16a34a">Q ${Number(a.amount || 0).toLocaleString('es-GT', {minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td>${a.paymentType || '-'}</td>
      <td>${a.description || ''}</td>
      <td>${a.createdByName || '-'}</td>
    </tr>`).join('')}
  </tbody></table></div>` : ''}
  <div class="footer">Documento generado el ${now} por ${(getCurrentActor()?.name) || 'Sistema'} · Jardines del Lago</div>
  <script>window.onload=function(){window.print();window.close();}<\/script>
</body></html>`);
    w.document.close();
  };

  const buildAccountingLedgerEntries = (account) => {
    const rows = Array.isArray(account?.rows) ? account.rows : [];
    const entries = [];
    for (const row of rows) {
      const eventId = String(row?.actionEventId || row?.id || "").trim();
      const ref = String(row?.refId || eventId || "-").trim() || "-";
      const company = String(account?.companyName || row?.companyName || "").trim();
      const eventDate = String(row?.eventDate || "").trim();
      const docDate = String(row?.docDate || "").trim();
      const baseDate = docDate || eventDate;
      const total = Math.max(0, Number(row?.total || 0));
      const mainSalon = String(row?.salon || "").trim();
      const salonesList = Array.isArray(row?.salones) ? row.salones.map((item) => String(item || "").trim()).filter(Boolean) : [];
      const otherSalones = salonesList.filter((item) => item !== mainSalon);
      const salonContext = [mainSalon ? `Salon principal: ${mainSalon}` : "", otherSalones.length ? `Salones del evento: ${otherSalones.join(", ")}` : ""].filter(Boolean).join(" | ");
      if (total > 0) {
        entries.push({ date: baseDate, type: "Cargo", eventId, refId: ref, concept: `Cotizacion ${ref}${company ? ` | ${company}` : ""}${salonContext ? ` | ${salonContext}` : ""}`, debit: total, credit: 0, sortBucket: 0 });
      }
      const advances = Array.isArray(row?.advances) ? row.advances : [];
      for (const adv of advances) {
        const amount = Math.max(0, Number(adv?.amount || 0));
        if (amount <= 0) continue;
        const advDate = String(adv?.date || baseDate || "").trim();
        const paymentType = String(adv?.paymentType || "").trim();
        const description = String(adv?.description || "").trim();
        const userName = String(adv?.createdByName || "").trim();
        const voucherNum = String(adv?.voucherNumber || "").trim();
        const hasEvidence = String(adv?.evidenceDataUrl || "").length > 0;
        const userPart = userName ? ` (${userName})` : "";
        const evidencePart = hasEvidence ? " 📎" : "";
        const voucherPart = voucherNum ? ` Boleta: ${voucherNum}` : "";
        const notes = [`${paymentType}${userPart}${evidencePart}`, description, voucherPart].filter(Boolean).join(" | ");
        entries.push({ date: advDate, type: "Abono", eventId, refId: ref, concept: `${notes || `Pago aplicado a ${ref}`}${salonContext ? ` | ${salonContext}` : ""}`, debit: 0, credit: amount, sortBucket: 1 });
      }
    }
    const normalized = entries.slice().sort((a, b) => {
      const d = String(a.date || "9999-12-31").localeCompare(String(b.date || "9999-12-31"));
      if (d !== 0) return d;
      if (a.sortBucket !== b.sortBucket) return a.sortBucket - b.sortBucket;
      return String(a.refId || "").localeCompare(String(b.refId || ""));
    });
    let runningBalance = 0;
    return normalized.map((entry) => {
      runningBalance += Math.max(0, Number(entry.debit || 0));
      runningBalance -= Math.max(0, Number(entry.credit || 0));
      return { ...entry, runningBalance };
    });
  };

  const pick = (obj, key) => obj?.[key] || { qty: 0, amount: 0 };

  const toggleAccountExpand = (key) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleActionClick = (_actionName, eventId) => {
    if (!eventId) {
      toast('No se encontró un evento para abrir esta cotización.', { icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> });
      return;
    }
    onClose?.();
    navigate(`/reserva/${eventId}`);
  };

  const handleExportExcel = () => {
    if (!accounts.length) {
      toast.error('No hay datos para exportar.');
      return;
    }
    const csvRows = [
      '\ufeff' + ['INDICADOR', 'INSTITUCION', 'TELEFONO', 'VENDEDOR PRINCIPAL', 'EVENTOS', 'PENDIENTES', 'VENTA NETA', 'COBRADO', 'SALDO PENDIENTE', 'SALDO A FAVOR', 'FECHA MAXIMA PAGO', 'TIEMPO SUGERIDO COBRO', 'ULTIMO DEPOSITO'].join(','),
      ...accounts.map(acc => [
        `"${acc.collectionLabel || ''}"`, `"${acc.companyName || ''}"`, `"${acc.contactPhone || ''}"`,
        `"${acc.primarySeller || ''}"`, acc.eventsCount || 0, acc.pendingEventsCount || 0,
        acc.netAmount || 0, acc.collectedAmount || 0, acc.pendingAmount || 0, acc.creditAmount || 0,
        `"${acc.collectionDueLabel || ''}"`, `"${acc.collectionEta || ''}"`, `"${acc.lastAdvanceDate || ''}"`
      ].join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `estado_cuenta_contable_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const clearFilters = () => {
    setSearch(''); setDateFrom(''); setDateTo(''); setUserFilter('all');
    setStatusFilter('all'); setSalonFilter('all'); setCompanyFilter('all');
  };

  const allSalones = useMemo(() => {
    if (!events) return [];
    return [...new Set(events.map(e => e.salon).filter(Boolean))].sort();
  }, [events]);

  const allStatuses = ['Pre reserva', 'Reserva sin Cotizacion', '1er Cotizacion', 'Seguimiento',
    'Lista de Espera', 'Confirmado', 'Cancelado', 'Mantenimiento', 'Perdido', 'Realizado'];

  // ── Bento KPI data ──
  const kpiSummary = [
    { label: 'Instituciones', value: accounts.length, accent: '#2563eb', meta: `${filteredData.length} evento(s)` },
    { label: 'Venta Neta', value: formatMoney(summary.netAmount), accent: '#16a34a', meta: `Total cotizado` },
    { label: 'Cobrado', value: formatMoney(summary.collectedAmount), accent: '#0d9488', meta: `${accounts.reduce((a, c) => a + c.advancesCount, 0)} pago(s)` },
    { label: 'Saldo Pendiente', value: formatMoney(summary.pendingAmount), accent: summary.pendingAmount > 0 ? '#dc2626' : '#16a34a', meta: `${summary.overdueCount} vencido(s)` },
    { label: 'Saldo a Favor', value: formatMoney(summary.creditAmount), accent: '#7c3aed', meta: `Disponible` },
  ];

  return (
    <div className="reports-page-container">
      <style>{`@keyframes tooltipFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {/* Header */}
      <div className="reports-page-header">
        <div className="reports-brand-header">
          <div className="reports-brand-badge">
            <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
          </div>
          <div>
            <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
            <div className="reports-title">Estado de Cuenta Contable</div>
            <div className="reports-subtitle">Cartera por institución para cobro y aplicación de pagos</div>
          </div>
        </div>
        <button className="btn-exit" type="button" onClick={onClose}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver
        </button>
      </div>

      <div className="reports-page-body">
        {/* ── Hero + Storytelling ── */}
        <section className="reports-hero-panel">
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Visión Contable</span>
              <h3 className="reports-section-title">Estado de cuenta por empresa con saldo pendiente, saldo a favor y tiempo sugerido de cobro</h3>
              <p className="reports-section-text">Ideal para cobrar por institución, identificar vencimientos, abrir el detalle por evento y aplicar pagos sin perder trazabilidad.</p>
            </div>
            <span className="reports-filter-meta">
              {users?.find(u => u.id === userFilter)?.fullName || 'Todos los vendedores'}
            </span>
          </div>

          {/* Bento KPI Summary premium */}
          <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            {kpiSummary.map((kpi, i) => (
              <div key={i} style={{
                background: `linear-gradient(135deg, ${kpi.accent}06, #ffffff)`,
                borderLeft: `4px solid ${kpi.accent}`,
                borderRadius: '14px', padding: '18px',
                boxShadow: `0 1px 3px ${kpi.accent}12, 0 4px 12px ${kpi.accent}06`,
                transition: 'all 0.25s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${kpi.accent}20, 0 8px 24px ${kpi.accent}10`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 1px 3px ${kpi.accent}12, 0 4px 12px ${kpi.accent}06`; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '3px', background: kpi.accent, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 0 2px ${kpi.accent}20` }} />
                  <span className="reports-eyebrow" style={{ fontSize: '10px' }}>{kpi.label}</span>
                </div>
                <strong style={{ fontSize: kpi.label === 'Instituciones' ? '2.2rem' : '1.3rem', display: 'block', marginBottom: '4px', color: '#0f172a', letterSpacing: '-0.02em' }}>{kpi.value}</strong>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>{kpi.meta}</span>
              </div>
            ))}
          </div>

          {/* Storytelling */}
          <div className="reports-storytelling-card">
            <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Narración de Cartera Contable</span>
            <p className="reports-story-text">
              La cartera contable activa registra un total de <strong className="highlight-blue">{accounts.length}</strong> instituciones con un volumen de negocio consolidado de <strong className="highlight-slate">{formatMoney(summary.netAmount)}</strong>. A la fecha, se han recaudado <strong className="highlight-green">{formatMoney(summary.collectedAmount)}</strong> en anticipos y pagos aplicados, quedando un saldo pendiente por cobrar de <strong className="highlight-orange">{formatMoney(summary.pendingAmount)}</strong> (con <strong className="highlight-blue">{formatMoney(summary.creditAmount)}</strong> registrados como saldos a favor). Actualmente, tenemos <strong className="highlight-orange">{summary.overdueCount}</strong> instituciones con cobros vencidos que requieren atención inmediata.
            </p>
          </div>
        </section>

        {/* ── Filters ── */}
        <div className="reports-toolbar">
          <label className="field">
            <span>Buscar</span>
            <input type="text" placeholder="No cotización, vendedor, inst..." value={search} onChange={e => setSearch(e.target.value)} />
          </label>
          <label className="field">
            <span>Desde</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </label>
          <label className="field">
            <span>Vendedor</span>
            <select value={userFilter} onChange={e => setUserFilter(e.target.value)}>
              <option value="all">Todos vendedores</option>
              {users?.filter(u => u.active !== false).map(u => <option key={u.id} value={u.id}>{u.fullName || u.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Estado</span>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Todos estados</option>
              {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Salón</span>
            <select value={salonFilter} onChange={e => setSalonFilter(e.target.value)}>
              <option value="all">Todos salones</option>
              {allSalones.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Institución</span>
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}>
              <option value="all">Todas instituciones</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="reports-actions">
            <button type="button" onClick={clearFilters}>Limpiar filtros</button>
            <button className="btnPrimary" type="button" onClick={handleExportExcel}>Exportar Excel</button>
          </div>
        </div>

        {/* ── Portfolio Table ── */}
        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Indicador</th>
                <th>Institución</th>
                <th style={{ width: '120px' }}>Contacto</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Eventos</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Venta Neta</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Cobrado</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Pendiente</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Saldo Favor</th>
                <th style={{ width: '110px' }}>Propuesta</th>
                <th style={{ minWidth: '200px' }}>Último Pago / Acciones</th>
              </tr>
            </thead>
            {accounts.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Sin resultados para los filtros seleccionados.
                  </td>
                </tr>
              </tbody>
            ) : accounts.map(acc => {
              const expanded = expandedAccounts.has(acc.key);
              const canApplyPayment = !!acc.actionEventId;
              return (
                <tbody key={acc.key}>
                  {/* Company Row premium */}
                  <tr style={{
                    borderBottom: '1px solid #e2e8f0',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                        setHoveredTooltipAccount(acc);
                      }}
                      onMouseLeave={() => {
                        setHoveredTooltipPos(null);
                        setHoveredTooltipAccount(null);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                          background: acc.collectionTone === 'overdue' ? '#dc2626' : acc.collectionTone === 'due' ? '#eab308' : acc.collectionTone === 'ok' ? '#22c55e' : acc.collectionTone === 'credit' ? '#0ea5e9' : '#94a3b8',
                          boxShadow: `0 0 0 2px ${acc.collectionTone === 'overdue' ? '#dc2626' : acc.collectionTone === 'due' ? '#eab308' : acc.collectionTone === 'ok' ? '#22c55e' : acc.collectionTone === 'credit' ? '#0ea5e9' : '#94a3b8'}20`,
                        }} />
                        <span className={`reports-collection-status reports-collection-status--${acc.collectionTone}`} style={{ fontSize: '10px', fontWeight: 700 }}>
                          {acc.collectionLabel}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <strong style={{ fontSize: '13px', color: '#0f172a', letterSpacing: '-0.01em' }}>{acc.companyName}</strong>
                        <small style={{ color: '#64748b', fontSize: '9px', fontWeight: 600 }}>
                          {acc.primarySeller ? `${acc.primarySeller}` : 'Sin vendedor'}
                        </small>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <strong style={{ fontSize: '12px', color: '#334155', fontWeight: 600 }}>{acc.contactPhone || '-'}</strong>
                        <small style={{ color: '#94a3b8', fontSize: '9px', fontWeight: 600 }}>
                          {acc.pendingEventsCount} pend. · {acc.paidEventsCount} al día
                        </small>
                      </div>
                    </td>
                    <td style={{ fontWeight: '800', textAlign: 'center', fontSize: '14px', color: '#0f172a' }}>{acc.eventsCount}</td>
                    <td style={{ fontWeight: '700', textAlign: 'right', fontSize: '12px', color: '#0f172a' }}>{formatMoney(acc.netAmount)}</td>
                    <td style={{ fontWeight: '600', textAlign: 'right', fontSize: '12px', color: '#16a34a' }}>{formatMoney(acc.collectedAmount)}</td>
                    <td style={{ fontWeight: '800', textAlign: 'right', fontSize: '12px', color: acc.pendingAmount > 0 ? '#dc2626' : '#16a34a' }}>{formatMoney(acc.pendingAmount)}</td>
                    <td style={{ fontWeight: '600', textAlign: 'right', fontSize: '12px', color: '#0d9488' }}>{formatMoney(acc.creditAmount)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <strong style={{ fontSize: '11px', color: '#334155', fontWeight: 700 }}>{acc.collectionDueLabel || '-'}</strong>
                        <small style={{ color: '#64748b', fontSize: '9px', fontWeight: 600 }}>{acc.collectionEta || 'Sin gestión'}</small>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#475569', fontWeight: 600 }}>
                          <span style={{ color: '#64748b' }}>📅</span>
                          <span>{acc.lastAdvanceDate || '-'}</span>
                          {acc.advancesCount > 0 && <span style={{ color: '#94a3b8', fontWeight: 600 }}>({acc.advancesCount})</span>}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          <button type="button" onClick={() => toggleAccountExpand(acc.key)}
                            style={{
                              padding: '2px 6px', fontSize: '9px', fontWeight: 700, borderRadius: '5px',
                              border: '1px solid #e2e8f0', background: expanded ? '#f1f5f9' : '#fff',
                              color: '#475569', cursor: 'pointer', transition: 'all 0.12s',
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                            }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={expanded ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} /></svg>
                            {expanded ? 'Ocultar' : 'Detalle'}
                          </button>
                          <button type="button" onClick={() => setActiveStatementCompanyId(acc.companyId)}
                            style={{
                              padding: '2px 6px', fontSize: '9px', fontWeight: 700, borderRadius: '5px',
                              border: '1px solid #e2e8f0', background: '#fff', color: '#475569',
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px',
                            }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            Estado
                          </button>
                          <button type="button" onClick={() => handleActionClick("ver cotizacion", acc.actionEventId)} disabled={!canApplyPayment}
                            style={{
                              padding: '2px 6px', fontSize: '9px', fontWeight: 700, borderRadius: '5px',
                              border: '1px solid #e2e8f0', background: '#fff',
                              color: !canApplyPayment ? '#cbd5e1' : '#475569',
                              cursor: canApplyPayment ? 'pointer' : 'not-allowed',
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                            }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            {canApplyPayment ? 'Ver' : '—'}
                          </button>
                          <button type="button" onClick={() => setActiveStatementCompanyId(acc.companyId)} disabled={!canApplyPayment}
                            style={{
                              padding: '2px 8px', fontSize: '9px', fontWeight: 800, borderRadius: '5px',
                              border: 'none', background: canApplyPayment ? '#2563eb' : '#e2e8f0',
                              color: canApplyPayment ? '#fff' : '#94a3b8',
                              cursor: canApplyPayment ? 'pointer' : 'not-allowed',
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                            }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                            {acc.actionHasCredit ? 'Ajustar' : 'Pago'}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Details premium */}
                  {expanded && (
                    <tr>
                      <td colSpan={10} style={{ padding: '16px 24px', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '18px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '2px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                              <strong style={{ fontSize: '14px', color: '#0f172a' }}>Estado de cuenta por evento</strong>
                            </div>
                            <span style={{ fontSize: '10px', color: '#475569', fontWeight: '700', background: '#f1f5f9', padding: '4px 14px', borderRadius: '999px' }}>
                              {acc.companyName} · {acc.eventsCount} evento(s) · {acc.advancesCount} pago(s)
                            </span>
                          </div>

                          {/* Detail Events Table */}
                          <div className="reports-table-wrap" style={{ boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                            <table className="reports-table" style={{ minWidth: '1000px' }}>
                              <thead>
                                <tr>
                                  <th><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>Estado</div></th>
                                  <th><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Cotización</div></th>
                                  <th>Fecha</th>
                                  <th>Vendedor</th>
                                  <th>Salón</th>
                                  <th style={{ textAlign: 'right' }}>Total</th>
                                  <th style={{ textAlign: 'right' }}>Cobrado</th>
                                  <th style={{ textAlign: 'right' }}>Pendiente</th>
                                  <th>Acción</th>
                                </tr>
                              </thead>
                              <tbody>
                                {acc.rows.map((r, idx) => (
                                  <tr key={idx} style={{ transition: 'background 0.12s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <td
                                      style={{ cursor: 'pointer' }}
                                      onMouseEnter={e => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoveredEventPos({ x: rect.left + rect.width / 2, y: rect.top });
                                        setHoveredEventData(r);
                                      }}
                                      onMouseLeave={() => {
                                        setHoveredEventPos(null);
                                        setHoveredEventData(null);
                                      }}
                                    >
                                      <span className="reports-table-status" style={{
                                        background: `${r.statusColor}18`, color: r.statusColor,
                                        border: `1px solid ${r.statusColor}30`, fontSize: '10px', fontWeight: 700,
                                      }}>
                                        {r.status || '-'}
                                      </span>
                                    </td>
                                    <td style={{ fontWeight: 700, fontSize: '12px' }}>{r.refId}</td>
                                    <td style={{ fontSize: '11px', color: '#475569' }}>{r.eventDate}</td>
                                    <td style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>{r.userName}</td>
                                    <td style={{ fontSize: '11px', color: '#334155' }}>{r.salon}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>{formatMoney(r.total)}</td>
                                    <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 700, fontSize: '12px' }}>{formatMoney(r.advancesTotal)}</td>
                                    <td style={{ textAlign: 'right', color: r.balancePending > 0 ? '#dc2626' : '#16a34a', fontWeight: 800, fontSize: '12px' }}>{formatMoney(r.balancePending)}</td>
                                    <td>
                                      <div style={{ display: 'flex', gap: '3px' }}>
                                        <button type="button" onClick={() => { onClose?.(); navigate(`/reserva/${r.actionEventId}`); }}
                                          style={{ padding: '2px 5px', fontSize: '8px', fontWeight: 700, borderRadius: '4px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        </button>
                                        <button type="button" onClick={() => setActiveStatementCompanyId(acc.companyId)}
                                          style={{ padding: '2px 6px', fontSize: '8px', fontWeight: 800, borderRadius: '4px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                          {r.creditBalance > 0 ? 'Ajustar' : 'Pago'}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Category Breakdown */}
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', background: '#f8fafc', padding: '10px 16px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', color: '#475569', border: '1px solid #e2e8f0' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                              A&B: {formatMoney(acc.rows.reduce((sum, row) => sum + Number(pick(row.catBuckets, "alimentosBebidas").amount || 0), 0))}
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} />
                              Hosp. JDL: {formatMoney(acc.rows.reduce((sum, row) => sum + Number(pick(row.catBuckets, "hospedajeJdl").amount || 0), 0))}
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                              Hosp. 3ros: {formatMoney(acc.rows.reduce((sum, row) => sum + Number(pick(row.catBuckets, "hospedajeTerceros").amount || 0), 0))}
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                              Misceláneos: {formatMoney(acc.rows.reduce((sum, row) => sum + Number(pick(row.catBuckets, "miscelaneos").amount || 0), 0))}
                            </span>
                          </div>

                          {/* Ledger Movements premium */}
                          <div className="reports-table-wrap" style={{ boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                            <table className="reports-table" style={{ minWidth: '750px' }}>
                              <thead>
                                <tr>
                                  <th><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>Fecha</div></th>
                                  <th>Tipo</th>
                                  <th>Ref</th>
                                  <th>Concepto</th>
                                  <th style={{ textAlign: 'right' }}>Cargo</th>
                                  <th style={{ textAlign: 'right' }}>Abono</th>
                                  <th style={{ textAlign: 'right' }}>Saldo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {buildAccountingLedgerEntries(acc).length === 0 ? (
                                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Sin movimientos para esta institución.</td></tr>
                                ) : buildAccountingLedgerEntries(acc).map((entry, eIdx) => (
                                  <tr key={eIdx} style={{ transition: 'background 0.12s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <td style={{ fontSize: '11px', color: '#475569', whiteSpace: 'nowrap' }}>{entry.date || '-'}</td>
                                    <td style={{ fontWeight: 700, fontSize: '11px' }}>{entry.type || '-'}</td>
                                    <td style={{ fontWeight: 700, fontSize: '11px', color: '#334155' }}>{entry.refId || '-'}</td>
                                    <td style={{ fontSize: '10px', color: '#475569', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.concept || '-'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: entry.debit > 0 ? 700 : 400, fontSize: '11px', color: entry.debit > 0 ? '#dc2626' : '#94a3b8' }}>{entry.debit > 0 ? formatMoney(entry.debit) : '-'}</td>
                                    <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: entry.credit > 0 ? 700 : 400, fontSize: '11px' }}>{entry.credit > 0 ? formatMoney(entry.credit) : '-'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '11px', color: entry.runningBalance > 0 ? '#dc2626' : '#16a34a' }}>{formatMoney(entry.runningBalance)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      </div>

      {/* ── Premium Tooltip (fixed) ── */}
      {hoveredTooltipPos && hoveredTooltipAccount && (() => {
        const tooltipWidth = 260;
        const left = Math.min(hoveredTooltipPos.x, window.innerWidth - tooltipWidth - 10);
        const top = Math.max(10, hoveredTooltipPos.y - 10);
        const colTone = hoveredTooltipAccount.collectionTone;
        const toneColors = {
          overdue: '#dc2626',
          due: '#eab308',
          ok: '#22c55e',
          credit: '#0ea5e9',
          neutral: '#94a3b8',
        };
        const toneColor = toneColors[colTone] || '#94a3b8';
        return (
          <div style={{
            position: 'fixed', left: `${left}px`, top: `${top}px`,
            transform: 'translate(-50%, -100%)', zIndex: 99999,
            pointerEvents: 'none',
          }}>
            <div style={{
              background: '#0f172a', color: '#fff',
              borderRadius: '10px', padding: '14px 16px',
              width: `${tooltipWidth}px`,
              boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.2)',
              animation: 'tooltipFadeIn 0.15s ease-out both',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{
                  width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                  background: toneColor,
                  boxShadow: `0 0 0 2px ${toneColor}40`,
                }} />
                <strong style={{ fontSize: '12px', fontWeight: 800 }}>{hoveredTooltipAccount.companyName}</strong>
              </div>

              {/* Status */}
              <div style={{ fontSize: '10px', color: toneColor, fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: toneColor, display: 'inline-block' }} />
                {hoveredTooltipAccount.collectionLabel}
              </div>

              {/* Data grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '11px' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Venta Neta</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{formatMoney(hoveredTooltipAccount.netAmount)}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Cobrado</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#4ade80' }}>{formatMoney(hoveredTooltipAccount.collectedAmount)}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Pendiente</span>
                <span style={{ fontWeight: 800, textAlign: 'right', color: hoveredTooltipAccount.pendingAmount > 0 ? '#f87171' : '#4ade80' }}>{formatMoney(hoveredTooltipAccount.pendingAmount)}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Sdo. Favor</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#60a5fa' }}>{formatMoney(hoveredTooltipAccount.creditAmount)}</span>
              </div>

              {/* Divider */}
              <div style={{ margin: '8px 0', height: '1px', background: 'rgba(255,255,255,0.08)' }} />

              {/* Eventos & Dueño */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '10px' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Eventos</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{hoveredTooltipAccount.eventsCount}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Pendientes</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: hoveredTooltipAccount.pendingEventsCount > 0 ? '#f87171' : '#4ade80' }}>{hoveredTooltipAccount.pendingEventsCount}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Vendedor</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hoveredTooltipAccount.primarySeller || 'Sin asignar'}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Vto.</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{hoveredTooltipAccount.collectionDueLabel || '-'}</span>
              </div>

              {/* Flecha triangular */}
              <div style={{
                position: 'absolute', bottom: '-6px', left: '50%',
                transform: 'translateX(-50%)',
                width: '0', height: '0',
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid #0f172a',
              }} />
            </div>
          </div>
        );
      })()}

      {/* ── Premium Tooltip Evento (fixed) ── */}
      {hoveredEventPos && hoveredEventData && (() => {
        const tooltipWidth = 280;
        const left = Math.min(hoveredEventPos.x, window.innerWidth - tooltipWidth - 10);
        const top = Math.max(10, hoveredEventPos.y - 10);
        const evData = hoveredEventData;
        const statusColor = evData.statusColor || '#64748b';
        return (
          <div style={{
            position: 'fixed', left: `${left}px`, top: `${top}px`,
            transform: 'translate(-50%, -100%)', zIndex: 99998,
            pointerEvents: 'none',
          }}>
            <div style={{
              background: '#0f172a', color: '#fff',
              borderRadius: '10px', padding: '14px 16px',
              width: `${tooltipWidth}px`,
              boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.2)',
              animation: 'tooltipFadeIn 0.15s ease-out both',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{
                  width: '10px', height: '10px', borderRadius: '3px', flexShrink: 0,
                  background: statusColor,
                  boxShadow: `0 0 0 2px ${statusColor}40`,
                }} />
                <strong style={{ fontSize: '12px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evData.name || evData.refId || 'Evento'}</strong>
              </div>

              {/* Status + Ref */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '10px', color: statusColor, fontWeight: 700, background: `${statusColor}20`, padding: '2px 8px', borderRadius: '4px' }}>{evData.status || '-'}</span>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{evData.refId || ''}</span>
              </div>

              {/* Data grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px', fontSize: '11px' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Total</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{formatMoney(evData.total)}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Cobrado</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#4ade80' }}>{formatMoney(evData.advancesTotal)}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Pendiente</span>
                <span style={{ fontWeight: 800, textAlign: 'right', color: evData.balancePending > 0 ? '#f87171' : '#4ade80' }}>{formatMoney(evData.balancePending)}</span>
              </div>

              {/* Divider */}
              <div style={{ margin: '8px 0', height: '1px', background: 'rgba(255,255,255,0.08)' }} />

              {/* Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '10px' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Salón</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evData.salon || '-'}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Fecha</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{evData.eventDate || '-'}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Vendedor</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evData.userName || 'Sin asignar'}</span>
              </div>

              {/* Flecha triangular */}
              <div style={{
                position: 'absolute', bottom: '-6px', left: '50%',
                transform: 'translateX(-50%)',
                width: '0', height: '0',
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid #0f172a',
              }} />
            </div>
          </div>
        );
      })()}

      {/* ── Premium Tooltip Ledger (fixed) ── */}
      {hoveredLedgerPos && hoveredLedgerData && (() => {
        const tooltipWidth = 340;
        const left = Math.min(hoveredLedgerPos.x, window.innerWidth - tooltipWidth - 10);
        const top = Math.max(10, hoveredLedgerPos.y - 10);
        const ed = hoveredLedgerData;
        const balanceType = ed.runningBalance > 0 ? 'Deudor' : ed.runningBalance < 0 ? 'Acreedor' : 'Saldado';
        const balanceColor = ed.runningBalance > 0 ? '#f87171' : ed.runningBalance < 0 ? '#60a5fa' : '#4ade80';
        return (
          <div style={{
            position: 'fixed', left: `${left}px`, top: `${top}px`,
            transform: 'translate(-50%, -100%)', zIndex: 99997,
            pointerEvents: 'none',
          }}>
            <div style={{
              background: '#0f172a', color: '#fff',
              borderRadius: '10px', padding: '14px 16px',
              width: `${tooltipWidth}px`,
              boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.2)',
              animation: 'tooltipFadeIn 0.15s ease-out both',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{
                  width: '10px', height: '10px', borderRadius: '3px', flexShrink: 0,
                  background: ed.debit > 0 ? '#dc2626' : '#16a34a',
                  boxShadow: ed.debit > 0 ? '0 0 0 2px rgba(220,38,38,0.4)' : '0 0 0 2px rgba(22,163,74,0.4)',
                }} />
                <strong style={{ fontSize: '12px', fontWeight: 800 }}>{ed.type || 'Movimiento'}</strong>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginLeft: 'auto' }}>{ed.refId || '-'}</span>
              </div>

              {/* Concepto completo (sin truncar) */}
              <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '8px', padding: '6px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                {ed.concept || 'Sin descripcion'}
              </div>

              {/* Data grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px', fontSize: '11px' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Fecha</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#fff' }}>{ed.date || '-'}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Cargo</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: ed.debit > 0 ? '#f87171' : '#94a3b8' }}>{ed.debit > 0 ? formatMoney(ed.debit) : '-'}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Abono</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: ed.credit > 0 ? '#4ade80' : '#94a3b8' }}>{ed.credit > 0 ? formatMoney(ed.credit) : '-'}</span>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Saldo</span>
                <span style={{ fontWeight: 800, textAlign: 'right', color: balanceColor }}>{formatMoney(ed.runningBalance)}</span>
              </div>

              {/* Balance type badge */}
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: balanceColor, background: `${balanceColor}15`, padding: '2px 8px', borderRadius: '999px', border: `1px solid ${balanceColor}30` }}>{balanceType}</span>
              </div>

              {/* Flecha triangular */}
              <div style={{
                position: 'absolute', bottom: '-6px', left: '50%',
                transform: 'translateX(-50%)',
                width: '0', height: '0',
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid #0f172a',
              }} />
            </div>
          </div>
        );
      })()}

      {/* ── Statement Modal premium ── */}
      {activeStatementAccount && createPortal(
        <div onClick={() => setActiveStatementCompanyId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '18px', display: 'flex', flexDirection: 'column',
            maxWidth: '960px', width: '100%', maxHeight: '90vh',
            boxShadow: '0 30px 80px rgba(0,0,0,0.3), 0 10px 30px rgba(0,0,0,0.1)',
          }}>
            {/* Header premium */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff',
              padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderRadius: '18px 18px 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.15)',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em' }}>Estado de Cuenta</div>
                  <div style={{ opacity: 0.7, fontSize: '11px', marginTop: '2px', fontWeight: 600 }}>
                    {activeStatementAccount.rows?.length} evento(s) · {buildAccountingLedgerEntries(activeStatementAccount).length} movimiento(s)
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={() => printStatement(activeStatementAccount)}
                  style={{
                    background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px', padding: '7px 12px', fontSize: '11px', fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                    transition: 'background 0.15s',
                  }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Imprimir
                </button>
                <button onClick={() => setActiveStatementCompanyId(null)}
                  title="Cerrar"
                  style={{
                    width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s, transform 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'scale(1)'; }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            </div>

            {/* Body premium */}
            <div style={{ background: '#f8fafc', padding: '28px', overflowY: 'auto', flex: 1, borderRadius: '0 0 18px 18px' }}>
              <div style={{ background: '#fff', padding: '36px 36px 32px', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)' }}>
                {/* Brand premium */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', paddingBottom: '20px', borderBottom: '2px solid #f1f5f9' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '8px',
                        background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 900, fontSize: '13px', letterSpacing: '1px',
                      }}>JDL</div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: '14px', color: '#0f172a', letterSpacing: '-0.01em' }}>JARDINES DEL LAGO</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>Departamento de Cobros y Contabilidad</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, fontSize: '16px', color: '#0f172a', letterSpacing: '-0.01em' }}>Estado de Cuenta</div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px', fontWeight: 600 }}>
                      Emitido: {new Date().toLocaleDateString('es-GT')} · {new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* Info Grid premium */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px',
                  marginBottom: '24px', borderRadius: '10px', overflow: 'hidden',
                  border: '1px solid #e2e8f0', fontSize: '11px',
                }}>
                  {[
                    { label: 'Institución', value: activeStatementAccount.companyName, icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
                    { label: 'NIT', value: companies.find(c => c.id === activeStatementAccount.companyId)?.nit || 'CF', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z' },
                    { label: 'Contacto', value: companies.find(c => c.id === activeStatementAccount.companyId)?.owner || activeStatementAccount.rows[0]?.quote?.contact || '-', icon: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z' },
                    { label: 'Teléfono', value: activeStatementAccount.contactPhone || '-', icon: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' },
                    { label: 'Dirección', value: companies.find(c => c.id === activeStatementAccount.companyId)?.address || activeStatementAccount.rows[0]?.quote?.address || '-', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', span: true },
                  ].map((info, i) => (
                    <div key={i} style={{
                      padding: '10px 14px', background: '#fafbfc',
                      gridColumn: info.span ? '1 / -1' : 'auto',
                      display: 'flex', alignItems: 'center', gap: '8px',
                      borderBottom: i < 4 ? '1px solid #e2e8f0' : 'none',
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d={info.icon} />
                      </svg>
                      <span style={{ color: '#94a3b8', fontWeight: 700, minWidth: '70px', textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.5px' }}>{info.label}</span>
                      <strong style={{ color: '#0f172a', fontWeight: 700, fontSize: '11px' }}>{info.value}</strong>
                    </div>
                  ))}
                </div>

                {/* KPI Strip premium */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px',
                }}>
                  {[
                    { label: 'Total neto', value: formatMoney(activeStatementAccount.netAmount), color: '#0f172a', bg: '#f8fafc' },
                    { label: 'Total pagado', value: formatMoney(activeStatementAccount.collectedAmount), color: '#16a34a', bg: '#f0fdf4' },
                    { label: 'Saldo pendiente', value: formatMoney(activeStatementAccount.pendingAmount), color: activeStatementAccount.pendingAmount > 0 ? '#dc2626' : '#16a34a', bg: activeStatementAccount.pendingAmount > 0 ? '#fef2f2' : '#f0fdf4' },
                    { label: 'Saldo a favor', value: formatMoney(activeStatementAccount.creditAmount), color: '#2563eb', bg: '#eff6ff' },
                  ].map((kpi, i) => (
                    <div key={i} style={{
                      background: kpi.bg,
                      borderRadius: '10px', padding: '14px 16px',
                      borderLeft: `3px solid ${kpi.color}`,
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: kpi.color, display: 'inline-block', boxShadow: `0 0 0 2px ${kpi.color}20` }} />
                        <small style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{kpi.label}</small>
                      </div>
                      <strong style={{ display: 'block', fontSize: '16px', fontWeight: 850, color: kpi.color, letterSpacing: '-0.02em' }}>{kpi.value}</strong>
                    </div>
                  ))}
                </div>

                {/* Última Cotización + Advance Form Inline */}
                {(() => {
                  const sortedRows = [...(activeStatementAccount.rows || [])].sort((a, b) => String(b.eventDate || '').localeCompare(String(a.eventDate || '')));
                  const lastRow = sortedRows[0];
                  if (!lastRow) return null;
                  const quote = lastRow.quote || {};
                  const services = Array.isArray(quote.services) ? quote.services : Array.isArray(quote.items) ? quote.items : [];
                  const eventId = lastRow.actionEventId || lastRow.id;
                  const hasPending = Number(lastRow.balancePending || 0) > 0;
                  const hasCredit = Number(lastRow.creditBalance || 0) > 0;
                  const event = events.find(ev => String(ev.id) === String(eventId));
                  const currentAdvances = event?.quote?.advances || [];
                  const abonosTotal = currentAdvances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
                  const pending = Math.max(0, Number(lastRow.total || 0) - abonosTotal);
                  return (
                    <>
                      {/* Quote Summary */}
                      <div style={{ marginBottom: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                          <strong style={{ fontSize: '12px', color: '#1e293b' }}>Cotización {lastRow.refId || ''}</strong>
                          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginLeft: 'auto' }}>{lastRow.eventDate} · {lastRow.salon || '-'}</span>
                        </div>
                        <div style={{ padding: '10px 14px', display: 'flex', gap: '16px', fontSize: '10px', fontWeight: 700 }}>
                          <span style={{ color: '#0f172a' }}>Total: <strong style={{ fontSize: '13px' }}>{formatMoney(Number(lastRow.total || 0))}</strong></span>
                          <span style={{ color: '#16a34a' }}>Pagado: {formatMoney(abonosTotal)}</span>
                          <span style={{ color: pending > 0 ? '#dc2626' : '#16a34a' }}>Pendiente: {formatMoney(pending)}</span>
                          {hasCredit > 0 && <span style={{ color: '#2563eb' }}>Saldo a favor: {formatMoney(Number(lastRow.creditBalance || 0))}</span>}
                        </div>
                      </div>

                      {/* Advance Form inline premium */}
                      <div style={{ marginBottom: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff' }}>
                        <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                          </div>
                          <strong style={{ fontSize: '13px', color: '#0f172a', letterSpacing: '-0.01em' }}>Registrar pago</strong>
                          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginLeft: 'auto' }}>{advanceEditingId ? 'Editando anticipo...' : 'Nuevo anticipo'}</span>
                        </div>
                        <div style={{ padding: '16px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Monto</label>
                              <input type="number" min="0" step="0.01" value={advanceForm.amount} onChange={e => setAdvanceForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', fontWeight: 600, color: '#0f172a' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Forma de pago</label>
                              <select value={advanceForm.paymentType} onChange={e => setAdvanceForm(p => ({ ...p, paymentType: e.target.value }))} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', fontWeight: 600, color: '#0f172a' }}>
                                {formasPago.map(fp => (
                                  <option key={fp.id} value={fp.nombre}>{fp.nombre}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Fecha</label>
                              <input type="date" value={advanceForm.date} onChange={e => setAdvanceForm(p => ({ ...p, date: e.target.value }))} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', fontWeight: 600, color: '#0f172a' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>No. boleta</label>
                              <input type="text" value={advanceForm.voucherNumber} onChange={e => setAdvanceForm(p => ({ ...p, voucherNumber: e.target.value }))} placeholder="BOL-000" style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', fontWeight: 600, color: '#0f172a' }} />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Descripción</label>
                              <input type="text" value={advanceForm.description} onChange={e => setAdvanceForm(p => ({ ...p, description: e.target.value }))} placeholder="Detalle del pago" style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', fontWeight: 600, color: '#0f172a' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Evidencia (archivo)</label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input key={advanceEvidenceInputKey} type="file" accept="image/*,application/pdf" onChange={e => { const f = e.target.files?.[0] || null; setAdvanceEvidenceFile(f); setAdvanceForm(p => ({ ...p, evidenceName: f?.name || p.evidenceName })); }} style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', background: '#fff', color: '#475569' }} />
                                {advanceEvidenceFile && <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700, whiteSpace: 'nowrap' }}>✓</span>}
                              </div>
                              <small style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px', display: 'block' }}>
                                {advanceEvidenceFile ? advanceEvidenceFile.name : (advanceForm.evidenceName || 'Sin archivo adjunto (máx 6 MB)')}
                              </small>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                            <button type="button" onClick={resetAdvanceFormInModal} style={{ padding: '7px 16px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>Limpiar</button>
                            <button type="button" onClick={() => handleSaveAdvanceInModal(eventId)} style={{ padding: '7px 18px', fontSize: '11px', fontWeight: 800, borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#1d4ed8'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.3)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.boxShadow = 'none'; }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                              {advanceEditingId ? 'Guardar cambios' : 'Agregar pago'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Existing Advances Table premium */}
                      {currentAdvances.length > 0 && (
                        <div style={{ marginBottom: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff' }}>
                          <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            Pagos registrados <span style={{ background: '#e2e8f0', color: '#475569', borderRadius: '999px', padding: '0 7px', fontSize: '9px', fontWeight: 800 }}>{currentAdvances.length}</span>
                          </div>
                          <div>
                            {currentAdvances.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).map((adv, ai) => (
                              <div key={adv.id || ai} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderBottom: ai < currentAdvances.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: '11px', transition: 'background 0.12s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <span style={{ color: '#334155', fontWeight: 700, minWidth: '80px', fontSize: '11px' }}>{adv.date || '-'}</span>
                                <span style={{ fontWeight: 600, color: '#475569', minWidth: '85px', fontSize: '10px' }}>{adv.paymentType || '-'}</span>
                                <span style={{ fontWeight: 700, color: '#0f172a', minWidth: '85px', textAlign: 'right', fontSize: '12px' }}>{formatMoney(adv.amount || 0)}</span>
                                <span style={{ color: '#64748b', fontSize: '10px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>{adv.description || '-'}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: '#94a3b8', fontWeight: 600, minWidth: '100px' }}>
                                  {adv.evidenceDataUrl ? (
                                    <a href={adv.evidenceDataUrl} download={adv.evidenceName || `evidencia_${adv.id}.pdf`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '9px', fontWeight: 700, color: '#2563eb', textDecoration: 'none', padding: '1px 6px', borderRadius: '4px', border: '1px solid #bfdbfe', background: '#eff6ff', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                      Ver
                                    </a>
                                  ) : adv.evidenceName ? <span style={{ color: '#94a3b8' }}>{adv.evidenceName}</span> : null}
                                </span>
                                <span style={{ color: '#94a3b8', fontSize: '9px', fontWeight: 600, minWidth: '90px', textAlign: 'right' }}>{adv.createdByName ? adv.createdByName : ''}</span>
                                <span style={{ display: 'flex', gap: '3px', minWidth: '75px', justifyContent: 'flex-end' }}>
                                  <button type="button" onClick={() => { const a = normalizeQuoteAdvancesForSnapshot([adv])[0]; setAdvanceEditingId(a.id); setAdvanceForm({ amount: a.amount ? String(Number(a.amount).toFixed(2)) : '', date: a.date || todayISO(), paymentType: normalizeAdvancePaymentType(a.paymentType), voucherNumber: a.voucherNumber || '', description: a.description || '', evidenceName: a.evidenceName || '' }); }} style={{ padding: '3px 7px', fontSize: '9px', fontWeight: 700, borderRadius: '4px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', transition: 'all 0.12s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>Editar</button>
                                  <button type="button" onClick={() => handleDeleteAdvanceInModal(eventId, adv.id)} style={{ padding: '3px 7px', fontSize: '9px', fontWeight: 700, borderRadius: '4px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', transition: 'all 0.12s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca'; }}>Eliminar</button>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bitacora de pagos premium */}
                      <div style={{ marginBottom: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff' }}>
                        <button type="button" onClick={() => toggleHistorial(eventId)} style={{ width: '100%', padding: '10px 16px', border: 'none', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 800, color: '#1e293b', textAlign: 'left', transition: 'background 0.12s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                          Bitacora de pagos
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', transform: historialOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {historialOpen && (
                          <div style={{ borderTop: '1px solid #e2e8f0' }}>
                            {historialLoading ? (
                              <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>Cargando...</div>
                            ) : historial && historial.length > 0 ? (
                              <div>
                                {historial.map((h, hi) => (
                                  <div key={h.id || hi} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderBottom: hi < historial.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: '10px', transition: 'background 0.12s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <span style={{ fontWeight: 700, color: h.action === 'deleted' ? '#dc2626' : h.action === 'edited' ? '#d97706' : '#16a34a', minWidth: '60px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{h.action === 'deleted' ? 'Elimino' : h.action === 'edited' ? 'Edito' : 'Agrego'}</span>
                                    <span style={{ color: '#334155', fontWeight: 600, minWidth: '140px', fontSize: '10px' }}>{h.actorName || 'Sistema'}</span>
                                    <span style={{ color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.detail || '-'}</span>
                                    <span style={{ color: '#94a3b8', fontSize: '9px', fontWeight: 600, minWidth: '120px', textAlign: 'right' }}>{h.createdAt ? new Date(h.createdAt).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                                  </div>
                                ))}
                              </div>
                            ) : <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>No hay movimientos registrados en la bitacora.</div>}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

                {/* Ledger Table premium */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>Resumen de Movimientos Contables</h4>
                  </div>
                  <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Fecha', 'Ref', 'Concepto', 'Cargo', 'Abono', 'Saldo'].map(h => (
                            <th key={h} style={{
                              textAlign: h === 'Cargo' || h === 'Abono' || h === 'Saldo' ? 'right' : 'left',
                              padding: '9px 12px', fontWeight: 800, color: '#64748b',
                              borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {buildAccountingLedgerEntries(activeStatementAccount).map((entry, idx) => (
                          <tr key={idx} style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background 0.12s',
                          }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '8px 12px', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>{entry.date}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0f172a' }}>{entry.refId}</td>
                            <td
                              style={{ padding: '8px 12px', color: '#475569', fontSize: '10px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                              onMouseEnter={e => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredLedgerPos({ x: rect.left + rect.width / 2, y: rect.top });
                                setHoveredLedgerData(entry);
                              }}
                              onMouseLeave={() => {
                                setHoveredLedgerPos(null);
                                setHoveredLedgerData(null);
                              }}
                            >{entry.concept}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: entry.debit > 0 ? 800 : 400, color: entry.debit > 0 ? '#dc2626' : '#cbd5e1' }}>{entry.debit > 0 ? formatMoney(entry.debit) : '-'}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#16a34a', fontWeight: entry.credit > 0 ? 800 : 400 }}>{entry.credit > 0 ? formatMoney(entry.credit) : '-'}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: entry.runningBalance > 0 ? '#dc2626' : '#16a34a', fontSize: '12px' }}>{formatMoney(entry.runningBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
