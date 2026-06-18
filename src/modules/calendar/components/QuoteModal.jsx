import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import authService from '../../../services/authService';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../../services/stateService';
import { generateQuotePrintDocument } from '../../../utils/printUtils';


const uid = () => `row_${Math.random().toString(36).substr(2, 8)}`;
const moneyGT = (amount, currency = 'GTQ') => {
  const val = Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === 'USD' ? `$ ${val}` : `Q ${val}`;
};
const quoteSnapshot = (quote) => JSON.stringify(quote || {});
const todayISO = () => new Date().toISOString().split('T')[0];
const calculateDueDate = (eventDateStr) => {
  if (!eventDateStr) return '';
  const d = new Date(eventDateStr + 'T00:00:00');
  d.setDate(d.getDate() - 30);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const normalizeAdvancePaymentType = (rawType) => {
  const value = String(rawType || '').trim().toLowerCase();
  if (value === 'credito') return 'Credito';
  if (value === 'deposito') return 'Deposito';
  if (value === 'efectivo') return 'Efectivo';
  if (value === 'tarjeta') return 'Tarjeta';
  return 'Efectivo';
};
const normalizeAdvance = (rawAdvance, index = 0) => {
  const amount = Number(rawAdvance?.amount || 0);
  return {
    id: String(rawAdvance?.id || `adv_${index + 1}`).trim() || `adv_${index + 1}`,
    amount: Number.isFinite(amount) ? Math.max(0, amount) : 0,
    paymentType: normalizeAdvancePaymentType(rawAdvance?.paymentType || rawAdvance?.method),
    date: String(rawAdvance?.date || '').trim(),
    voucherNumber: String(rawAdvance?.voucherNumber || rawAdvance?.boleta || '').trim(),
    description: String(rawAdvance?.description || rawAdvance?.notes || '').trim(),
    evidenceName: String(rawAdvance?.evidenceName || rawAdvance?.evidence?.name || '').trim(),
    evidenceType: String(rawAdvance?.evidenceType || rawAdvance?.evidence?.type || '').trim(),
    evidenceDataUrl: String(rawAdvance?.evidenceDataUrl || rawAdvance?.evidence?.dataUrl || '').trim(),
    createdAt: String(rawAdvance?.createdAt || '').trim(),
    createdByUserId: String(rawAdvance?.createdByUserId || '').trim(),
    createdByName: String(rawAdvance?.createdByName || '').trim()
  };
};
const formatAdvanceDetail = (advanceLike) => {
  const paymentType = String(advanceLike?.paymentType || 'Anticipo').trim() || 'Anticipo';
  const voucher = String(advanceLike?.voucherNumber || '').trim();
  const description = String(advanceLike?.description || '').trim();
  return [paymentType, voucher ? `Boleta ${voucher}` : '', description].filter(Boolean).join(' | ');
};
const readFileAsDataUrl = (file) => new Promise((resolve) => {
  if (!file) return resolve('');
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => resolve('');
  reader.readAsDataURL(file);
});
const emptyCompanyDraft = {
  name: '',
  owner: '',
  email: '',
  nit: '',
  businessName: '',
  eventType: '',
  address: '',
  phone: '',
  notes: ''
};
const emptyManagerDraft = { id: '', name: '', phone: '', email: '', address: '' };
const emptyServiceDraft = {
  id: '',
  name: '',
  price: '',
  category: '',
  subcategory: '',
  quantityMode: 'MANUAL',
  description: '',
  active: true
};

export default function QuoteModal({ event: eventProp, eventData, slots = [], onClose, onSave, openAdvancesOnMount, inlineMode }) {
  const event = useMemo(() => ({
    ...(eventData || {}),
    ...(eventProp || {}),
    slots: eventProp?.slots || slots || eventData?.slots || []
  }), [eventProp, eventData, slots]);
  const localSwal = (...args) => {
    const target = document.getElementById('companyCreateBackdrop')
      || document.getElementById('serviceCreateBackdrop')
      || document.getElementById('versionPanelBackdrop')
      || document.getElementById('quoteAdvanceBackdrop')
      || document.getElementById('menuMontajePosBackdrop')
      || document.getElementById('menuMontajeSelectableBackdrop')
      || document.getElementById('qp-root')
      || document.body;
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        let swalPromise;
        if (args.length === 1 && typeof args[0] === 'object') {
          swalPromise = Swal.fire({ ...args[0], target });
        } else {
          swalPromise = Swal.fire({ title: args[0], text: args[1], icon: args[2], target });
        }
        resolve(swalPromise);
      }, 0);
    });
  };

  const [companies, setCompanies] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);
  const [quickTemplates, setQuickTemplates] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedCatalogService, setSelectedCatalogService] = useState(null);
  const [selectedServiceDate, setSelectedServiceDate] = useState('');
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [showCompanyResults, setShowCompanyResults] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [showDocPanel, setShowDocPanel] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showCreateServiceModal, setShowCreateServiceModal] = useState(false);
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);
  const [companyDraftId, setCompanyDraftId] = useState('');
  const [companyDraft, setCompanyDraft] = useState(emptyCompanyDraft);
  const [companyDraftActive, setCompanyDraftActive] = useState(true);
  const [companyManagersDraft, setCompanyManagersDraft] = useState([]);
  const [managerDraft, setManagerDraft] = useState(emptyManagerDraft);
  const [editingManagerId, setEditingManagerId] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [serviceDraft, setServiceDraft] = useState(emptyServiceDraft);

  const [showAdvancesModal, setShowAdvancesModal] = useState(false);
  const [advanceEditingId, setAdvanceEditingId] = useState('');
  const [advanceEvidenceFile, setAdvanceEvidenceFile] = useState(null);
  const [advanceEvidenceInputKey, setAdvanceEvidenceInputKey] = useState(0);
  const [newAdvance, setNewAdvance] = useState({
    amount: '',
    date: todayISO(),
    paymentType: 'Efectivo',
    voucherNumber: '',
    description: '',
    evidenceName: ''
  });

  const [quote, setQuote] = useState({
    companyId: event?.quote?.companyId || '',
    companyName: event?.quote?.companyName || '',
    managerId: event?.quote?.managerId || '',
    managerName: event?.quote?.managerName || '',
    contact: event?.quote?.contact || '',
    email: event?.quote?.email || '',
    phone: event?.quote?.phone || '',
    nit: event?.quote?.nit || '',
    billTo: event?.quote?.billTo || '',
    address: event?.quote?.address || '',
    eventType: event?.quote?.eventType || event?.type || '',
    venue: event?.quote?.venue || event?.salon || '',
    schedule: event?.quote?.schedule || '',
    code: event?.quote?.code || '',
    docDate: event?.quote?.docDate || new Date().toISOString().split('T')[0],
    people: event?.quote?.people || event?.pax || '',
    eventDate: event?.quote?.eventDate || event?.date || '',
    endDate: event?.quote?.endDate || event?.endDate || event?.date || '',
    dueDate: event?.quote?.dueDate || '',
    discountType: event?.quote?.discountType || 'AMOUNT',
    discountValue: event?.quote?.discountValue || 0,
    items: event?.quote?.items || [],
    advances: event?.quote?.advances || [],
    templateId: event?.quote?.templateId || 'contrato_corp',
    currency: event?.quote?.currency || 'GTQ',
    internalNotes: event?.quote?.internalNotes || '',
    version: event?.quote?.version || 1,
    versions: event?.quote?.versions || [],
    paymentType: event?.quote?.paymentType || '',
    menuMontajeEntries: event?.quote?.menuMontajeEntries || [],
    menuMontajeVersion: event?.quote?.menuMontajeVersion || 1,
    menuMontajeVersions: event?.quote?.menuMontajeVersions || [],
    advanceLogs: event?.quote?.advanceLogs || []
  });
  const savedQuoteSnapshotRef = useRef(quoteSnapshot(quote));

  const [serviceQty, setServiceQty] = useState(1);

  const loadState = useCallback(async () => {
    try {
      const data = await loadCrmState();
      setCompanies(data?.companies || []);
      setCatalogServices(data?.services || []);
      setQuickTemplates(data?.quoteServiceTemplates || data?.quickTemplates || []);
      if (!quote.code) {
        const evs = data?.events || [];
        let maxCOT = 0;
        evs.forEach(ev => {
          if (ev.quote?.code) {
            const m = ev.quote.code.match(/^COT-(\d+)$/);
            if (m) maxCOT = Math.max(maxCOT, parseInt(m[1], 10));
          }

        });
        setQuote(prev => ({ ...prev, code: `COT-${String(maxCOT + 1).padStart(3, '0')}` }));
      }
    } catch (err) { console.error('Error:', err); }
  }, [quote.code, setQuote]);

  useEffect(() => {
    if (openAdvancesOnMount) {
      const timer = setTimeout(() => handleOpenAdvances(), 100);
      return () => { clearTimeout(timer); };
    }
  }, []);

  useEffect(() => {
    loadState();
    document.body.classList.add('quoteModeOpen');
    return () => document.body.classList.remove('quoteModeOpen');
  }, [loadState]);

  const availableServiceDates = useMemo(() => {
    const datesSet = new Set();

    const addRange = (startStr, endStr) => {
      if (!startStr) return;
      const s = new Date(startStr + 'T00:00:00');
      const e = new Date((endStr || startStr) + 'T00:00:00');
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
      const curr = new Date(s);
      let count = 0;
      while (curr <= e && count < 100) {
        datesSet.add(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
        count++;
      }
    };

    // 1. Add range from quote.eventDate & quote.endDate
    if (quote.eventDate) {
      addRange(quote.eventDate, quote.endDate || quote.eventDate);
    }

    // 2. Add range from event.date & event.endDate
    if (event?.date) {
      addRange(event.date, event.endDate || event.date);
    }

    // 3. Add ranges from event.slots
    if (Array.isArray(event?.slots)) {
      event.slots.forEach(slot => {
        if (slot.dateStart) {
          addRange(slot.dateStart, slot.dateEnd || slot.dateStart);
        }
      });
    }

    // Convert Set to sorted Array
    const sortedDates = Array.from(datesSet).sort((a, b) => a.localeCompare(b));

    return sortedDates.length ? sortedDates : [event?.date || new Date().toISOString().split('T')[0]];
  }, [quote.eventDate, quote.endDate, event?.date, event?.endDate, event?.slots]);


  useEffect(() => {
    if (availableServiceDates.length > 0 && !availableServiceDates.includes(selectedServiceDate))
      setSelectedServiceDate(availableServiceDates[0]);
  }, [availableServiceDates, selectedServiceDate]);

  const filteredServices = useMemo(() => {
    const term = serviceSearch.trim().toLowerCase();
    if (!term || (selectedCatalogService && selectedCatalogService.name === serviceSearch)) return [];
    return catalogServices.filter(s => s.active !== false && (s.name?.toLowerCase().includes(term) || s.category?.toLowerCase().includes(term))).slice(0, 10);
  }, [serviceSearch, catalogServices, selectedCatalogService]);
  const serviceCategories = useMemo(() => [...new Set(catalogServices.map(service => String(service.category || '').trim()).filter(Boolean))].sort(), [catalogServices]);
  const serviceSubcategories = useMemo(() => {
    const scoped = serviceDraft.category
      ? catalogServices.filter(service => String(service.category || '') === String(serviceDraft.category))
      : catalogServices;
    return [...new Set(scoped.map(service => String(service.subcategory || '').trim()).filter(Boolean))].sort();
  }, [catalogServices, serviceDraft.category]);

  const filteredCompanies = useMemo(() => {
    const term = companySearchQuery.trim().toLowerCase();
    if (!term) return [];
    return companies.filter(c => c.name?.toLowerCase().includes(term) || c.nit?.toLowerCase().includes(term)).slice(0, 8);
  }, [companySearchQuery, companies]);
  const selectedQuoteCompany = useMemo(
    () => companies.find(c => String(c.id || '') === String(quote.companyId || '')) || null,
    [companies, quote.companyId]
  );

  const applyCompanyManager = (company, managerId) => {
    if (!company) return;
    const managers = Array.isArray(company.managers) ? company.managers : [];
    const manager = managers.find(m => String(m.id || '') === String(managerId || '')) || managers[0] || null;
    setQuote(prev => ({
      ...prev,
      companyId: company.id || prev.companyId,
      companyName: company.name || prev.companyName,
      contact: manager?.name || company.owner || '',
      email: manager?.email || company.email || '',
      phone: manager?.phone || company.phone || '',
      nit: company.nit || '',
      billTo: company.businessName || company.billTo || company.name || '',
      address: company.address || '',
      eventType: company.eventType || prev.eventType,
      managerId: manager?.id || '',
      managerName: manager?.name || '',
      dueDate: prev.eventDate ? calculateDueDate(prev.eventDate) : prev.dueDate
    }));
  };

  const handleCompanySelect = (c) => {
    applyCompanyManager(c, c.managers?.[0]?.id || '');
    setCompanySearchQuery(c.name);
    setShowCompanyResults(false);
  };

  const openCreateCompanyModal = () => {
    const existing = quote.companyId ? companies.find(c => String(c.id || '') === String(quote.companyId || '')) : null;
    const initialManagers = existing?.managers?.length
      ? existing.managers
      : (quote.contact || quote.managerName ? [{
          id: quote.managerId || `mgr_${Date.now()}`,
          name: quote.contact || quote.managerName || '',
          phone: quote.phone || '',
          email: quote.email || '',
          address: quote.address || ''
        }] : []);
    setCompanyDraftId(existing?.id || '');
    setCompanyDraft({
      name: existing?.name || companySearchQuery || quote.companyName || '',
      owner: existing?.owner || quote.contact || quote.managerName || '',
      email: existing?.email || quote.email || '',
      nit: existing?.nit || quote.nit || '',
      businessName: existing?.businessName || existing?.billTo || quote.billTo || quote.companyName || companySearchQuery || '',
      eventType: existing?.eventType || quote.eventType || '',
      address: existing?.address || quote.address || '',
      phone: existing?.phone || quote.phone || '',
      notes: existing?.notes || ''
    });
    setCompanyDraftActive(true);
    setCompanyManagersDraft(initialManagers);
    setManagerDraft(emptyManagerDraft);
    setEditingManagerId('');
    setShowCreateCompanyModal(true);
  };

  const resetCreateCompanyModal = () => {
    setShowCreateCompanyModal(false);
    setCompanyDraftId('');
    setCompanyDraft(emptyCompanyDraft);
    setCompanyDraftActive(true);
    setCompanyManagersDraft([]);
    setManagerDraft(emptyManagerDraft);
    setEditingManagerId('');
  };

  const handleCompanyDraftSelect = (companyId) => {
    setCompanyDraftId(companyId);
    const selected = companies.find(c => String(c.id || '') === String(companyId || ''));
    if (!selected) {
      setCompanyDraft(emptyCompanyDraft);
      setCompanyManagersDraft([]);
      setManagerDraft(emptyManagerDraft);
      setEditingManagerId('');
      setCompanyDraftActive(true);
      return;
    }
    setCompanyDraft({
      name: selected.name || '',
      owner: selected.owner || '',
      email: selected.email || '',
      nit: selected.nit || '',
      businessName: selected.businessName || selected.billTo || selected.name || '',
      eventType: selected.eventType || '',
      address: selected.address || '',
      phone: selected.phone || '',
      notes: selected.notes || ''
    });
    setCompanyManagersDraft(Array.isArray(selected.managers) ? selected.managers : []);
    setManagerDraft(emptyManagerDraft);
    setEditingManagerId('');
    setCompanyDraftActive(true);
  };

  const handleAddOrUpdateManagerDraft = () => {
    const clean = {
      id: editingManagerId || `mgr_${Date.now()}`,
      name: managerDraft.name.trim(),
      phone: managerDraft.phone.trim(),
      email: managerDraft.email.trim(),
      address: managerDraft.address.trim()
    };
    if (!clean.name) {
      localSwal({ icon: 'warning', title: 'Falta encargado', text: 'Escriba el nombre del encargado.' });
      return;
    }
    setCompanyManagersDraft(prev => editingManagerId
      ? prev.map(item => String(item.id || '') === String(editingManagerId) ? clean : item)
      : [...prev, clean]);
    if (!companyDraft.owner) setCompanyDraft(prev => ({ ...prev, owner: clean.name }));
    setManagerDraft(emptyManagerDraft);
    setEditingManagerId('');
  };

  const handleEditManagerDraft = (manager) => {
    setEditingManagerId(String(manager.id || ''));
    setManagerDraft({
      id: manager.id || '',
      name: manager.name || '',
      phone: manager.phone || '',
      email: manager.email || '',
      address: manager.address || ''
    });
  };

  const handleRemoveManagerDraft = (managerId) => {
    setCompanyManagersDraft(prev => prev.filter(item => String(item.id || '') !== String(managerId || '')));
    if (String(editingManagerId) === String(managerId || '')) {
      setEditingManagerId('');
      setManagerDraft(emptyManagerDraft);
    }
  };

  const handleCreateCompany = async () => {
    if (creatingCompany) return;
    const clean = Object.fromEntries(Object.entries(companyDraft).map(([key, value]) => [key, String(value || '').trim()]));
    if (!clean.name) {
      localSwal({ icon: 'warning', title: 'Falta empresa', text: 'Escriba el nombre de la empresa.' });
      return;
    }
    if (!companyManagersDraft.length) {
      localSwal({ icon: 'warning', title: 'Falta encargado', text: 'Agregue al menos un encargado para la empresa.' });
      return;
    }

    setCreatingCompany(true);
    try {
      const currentState = await loadCrmState();
      const currentCompanies = Array.isArray(currentState.companies) ? currentState.companies : [];
      const existingIndex = currentCompanies.findIndex((item) => {
        const sameNit = clean.nit && String(item.nit || '').trim().toLowerCase() === clean.nit.toLowerCase();
        const sameName = String(item.name || '').trim().toLowerCase() === clean.name.toLowerCase();
        const sameId = companyDraftId && String(item.id || '') === String(companyDraftId);
        return sameId || sameNit || sameName;
      });
      const baseCompany = existingIndex >= 0 ? currentCompanies[existingIndex] : null;
      const savedCompany = {
        ...(baseCompany || {}),
        id: baseCompany?.id || companyDraftId || `cmp_${Date.now()}`,
        name: clean.name,
        owner: clean.owner || companyManagersDraft[0]?.name || '',
        email: clean.email,
        nit: clean.nit,
        businessName: clean.businessName || clean.name,
        billTo: clean.businessName || clean.name,
        eventType: clean.eventType,
        address: clean.address,
        phone: clean.phone,
        notes: clean.notes,
        managers: companyManagersDraft.map((manager, index) => ({
          id: manager.id || `mgr_${Date.now()}_${index}`,
          name: String(manager.name || '').trim(),
          phone: String(manager.phone || '').trim(),
          email: String(manager.email || '').trim(),
          address: String(manager.address || '').trim()
        })).filter(manager => manager.name)
      };
      const nextCompanies = existingIndex >= 0
        ? currentCompanies.map((item, idx) => idx === existingIndex ? savedCompany : item)
        : [...currentCompanies, savedCompany];
      const nextDisabledCompanies = new Set(Array.isArray(currentState.disabledCompanies) ? currentState.disabledCompanies.map(String) : []);
      if (companyDraftActive) nextDisabledCompanies.delete(String(savedCompany.id));
      else nextDisabledCompanies.add(String(savedCompany.id));

      await saveCrmState({ ...currentState, companies: nextCompanies, disabledCompanies: Array.from(nextDisabledCompanies) });

      setCompanies(nextCompanies);
      handleCompanySelect(savedCompany);
      resetCreateCompanyModal();
      localSwal({
        icon: 'success',
        title: existingIndex >= 0 ? 'Empresa actualizada' : 'Empresa agregada',
        text: 'La empresa quedó asociada al encargado seleccionado.',
        timer: 1800,
        showConfirmButton: false
      });
    } catch (err) {
      console.error('Error creando empresa:', err);
      localSwal({ icon: 'error', title: 'Error', text: 'No se pudo guardar la empresa.' });
    } finally {
      setCreatingCompany(false);
    }
  };

  const totals = useMemo(() => {
    const subtotal = quote.items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);
    const discountAmount = quote.discountType === 'PERCENT'
      ? Math.max(0, Math.min(subtotal, subtotal * Math.min(100, quote.discountValue) / 100))
      : Math.max(0, Math.min(subtotal, quote.discountValue));
    return { subtotal, discountAmount, total: Math.max(0, subtotal - discountAmount) };
  }, [quote.items, quote.discountType, quote.discountValue]);
  const menuMontajeSummary = useMemo(() => {
    const entries = Array.isArray(quote.menuMontajeEntries)
      ? quote.menuMontajeEntries.filter(entry => String(entry?.date || '').trim() || String(entry?.salon || '').trim())
      : [];
    const salons = [...new Set(entries.map(entry => String(entry?.salon || '').trim()).filter(Boolean))];
    const dates = [...new Set(entries.map(entry => String(entry?.date || '').trim()).filter(Boolean))];
    return {
      entries,
      count: entries.length,
      salonsLabel: salons.length ? salons.join(', ') : 'Sin salon',
      datesLabel: dates.length ? dates.join(', ') : (quote.eventDate || '-'),
      version: Number(quote.menuMontajeVersion || 1)
    };
  }, [quote.menuMontajeEntries, quote.menuMontajeVersion, quote.eventDate]);

  const abonosTotal = useMemo(() => quote.advances.reduce((sum, a) => sum + Number(a.amount || 0), 0), [quote.advances]);
  const saldoPendiente = Math.max(0, totals.total - abonosTotal);
  const advanceRows = useMemo(() => (quote.advances || [])
    .map((item, index) => normalizeAdvance(item, index))
    .sort((a, b) => {
      const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
      if (dateCompare !== 0) return dateCompare;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    }), [quote.advances]);
  const advanceLogRows = useMemo(() => {
    const storedLogs = Array.isArray(quote.advanceLogs) ? quote.advanceLogs : [];
    if (storedLogs.length) {
      return storedLogs.slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    }
    return advanceRows
      .slice()
      .sort((a, b) => {
        const createdCompare = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        if (createdCompare !== 0) return createdCompare;
        return String(b.date || '').localeCompare(String(a.date || ''));
      })
      .map((advance) => ({
        id: `${advance.id}-fallback-log`,
        at: advance.createdAt || advance.date || '',
        actorName: advance.createdByName || 'Sistema',
        tone: 'added',
        label: 'Agregado',
        change: [
          `Abono registrado: ${advance.date || 'sin fecha'}`,
          formatAdvanceDetail(advance),
          moneyGT(advance.amount || 0, quote.currency)
        ].filter(Boolean).join(' | ')
      }));
  }, [quote.advanceLogs, advanceRows]);
  const hasUnsavedQuoteChanges = useMemo(() => quoteSnapshot(quote) !== savedQuoteSnapshotRef.current, [quote]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!hasUnsavedQuoteChanges) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedQuoteChanges]);

  const handleRequestClose = async () => {
    if (!hasUnsavedQuoteChanges) {
      onClose();
      return;
    }

    const result = await localSwal({
      icon: 'warning',
      title: 'Cotizacion sin guardar',
      text: 'Hay cambios que no se han guardado. Si sales ahora, se perderan los cambios de esta cotizacion.',
      showCancelButton: true,
      confirmButtonText: 'Salir sin guardar',
      cancelButtonText: 'Continuar editando',
      confirmButtonColor: '#991b1b',
      cancelButtonColor: '#1267d8'
    });

    if (result.isConfirmed) {
      onClose();
    }
  };
  const addServiceItem = (serviceObj) => {
    if (!serviceObj) { localSwal('Error', 'Selecciona un servicio del catálogo', 'error'); return; }
    const paxVal = Math.max(0, Number(quote.people || 0));
    const newItem = {
      rowId: uid(), serviceId: serviceObj.id, name: serviceObj.name,
      qty: serviceObj.quantityMode === 'PAX' ? paxVal : serviceQty,
      price: serviceObj.quantityMode === 'PAX' ? Math.max(0, Number(serviceObj.price || 0) * paxVal) : Number(serviceObj.price || 0),
      quantityMode: serviceObj.quantityMode || 'MANUAL',
      serviceDate: selectedServiceDate || availableServiceDates[0]
    };
    setQuote(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setServiceSearch(''); setServiceQty(1);
    setSelectedCatalogService(null);
  };

  const removeServiceItem = (rowId) => setQuote(prev => ({ ...prev, items: prev.items.filter(i => i.rowId !== rowId) }));

  const handleSelectAllToggle = () => {
    const allSelected = quote.items.length > 0 && quote.items.every(i => selectedItemIds.has(i.rowId));
    setSelectedItemIds(allSelected ? new Set() : new Set(quote.items.map(i => i.rowId)));
  };

  const handleSelectAllDayToggle = (date) => {
    const dayItems = quote.items.filter(i => i.serviceDate === date);
    if (dayItems.length === 0) return;
    const allDaySelected = dayItems.every(i => selectedItemIds.has(i.rowId));
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      dayItems.forEach(i => {
        if (allDaySelected) next.delete(i.rowId);
        else next.add(i.rowId);
      });
      return next;
    });
  };

  const handleSelectRowToggle = (rowId) => {
    setSelectedItemIds(prev => { const n = new Set(prev); n.has(rowId) ? n.delete(rowId) : n.add(rowId); return n; });
  };

  const handleDuplicateSelected = () => {
    if (!selectedItemIds.size) return;
    setQuote(prev => {
      const next = []; const ns = new Set(selectedItemIds);
      for (const item of prev.items) {
        next.push(item);
        if (selectedItemIds.has(item.rowId)) { const id = uid(); next.push({ ...item, rowId: id }); ns.add(id); }
      }
      setTimeout(() => setSelectedItemIds(ns), 0);
      return { ...prev, items: next };
    });
  };

  const handleMoveSelected = (dir) => {
    if (!selectedItemIds.size) return;
    setQuote(prev => {
      const items = [...prev.items];
      if (dir === 'up') {
        for (let i = 1; i < items.length; i++)
          if (selectedItemIds.has(items[i].rowId) && !selectedItemIds.has(items[i-1].rowId)) [items[i-1], items[i]] = [items[i], items[i-1]];
      } else {
        for (let i = items.length - 2; i >= 0; i--)
          if (selectedItemIds.has(items[i].rowId) && !selectedItemIds.has(items[i+1].rowId)) [items[i], items[i+1]] = [items[i+1], items[i]];
      }
      return { ...prev, items };
    });
  };

  const handleSaveQuote = async () => {
    if (!quote.companyId) {
      localSwal({ icon: 'warning', title: 'Falta la institución', text: 'Busca y selecciona una institución del listado antes de guardar.' });
      setShowDocPanel(true);
      return;
    }
    if (!quote.contact) {
      localSwal({ icon: 'warning', title: 'Falta el contacto', text: 'El campo Contacto es obligatorio.' });
      setShowDocPanel(true);
      return;
    }
    if (!quote.items.length) {
      localSwal({ icon: 'warning', title: 'Sin servicios', text: 'Agrega al menos un servicio al carrito antes de guardar.' });
      return;
    }

    try {
      const finalQuote = {
        ...quote,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        total: totals.total,
        quotedAt: new Date().toISOString(),
      };

      if (typeof onSave === 'function') {
        await onSave(finalQuote, { keepOpen: true });
      }
      
      savedQuoteSnapshotRef.current = quoteSnapshot(finalQuote);

      const result = await localSwal({
        icon: 'success',
        title: '¡Cotización guardada!',
        text: `Código: ${finalQuote.code}\n¿Qué deseas hacer ahora?`,
        showConfirmButton: true,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '🖨️ Imprimir / PDF',
        denyButtonText: '💬 WhatsApp',
        cancelButtonText: '❌ Cerrar',
        confirmButtonColor: '#3085d6',
        denyButtonColor: '#25d366',
        cancelButtonColor: '#6e7881'
      });

      if (result.isConfirmed) {
        const user = authService.getCurrentUser();
        const { value: pf } = await localSwal({
          title: 'Formato de impresión',
          input: 'select',
          inputOptions: {
            standard: '📄 Estándar — Cotización + Contrato',
            completa: '📋 Completa — Cotización + Menú Montaje + Contrato',
            sin_precios: '🔒 Sin precios — Cotización (Q0) + Menú Montaje'
          },
          inputPlaceholder: 'Selecciona un formato',
          showCancelButton: true,
          confirmButtonText: 'Imprimir',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#1e3a5f',
          cancelButtonColor: '#6e7881'
        });
        if (pf) {
          await generateQuotePrintDocument(finalQuote, user, pf, event);
        }
      } else if (result.isDenied) {
        const showGuidedAlert = async () => {
          const waResult = await localSwal({
            icon: 'info',
            title: 'Enviar por WhatsApp',
            html: `
              <div style="text-align: left; font-size: 14px; line-height: 1.5; padding: 0 10px;">
                <p>Por políticas de WhatsApp, no es posible adjuntar archivos automáticamente mediante enlaces. Por favor realiza los siguientes pasos:</p>
                <ol>
                  <li style="margin-bottom: 8px;">Presiona <strong>"1. Generar PDF"</strong> para abrir y guardar la cotización en tu equipo.</li>
                  <li style="margin-bottom: 8px;">Presiona <strong>"2. Abrir WhatsApp"</strong> para iniciar el chat con el mensaje pre-cargado.</li>
                  <li><strong>Arrastra o adjunta</strong> el archivo PDF guardado en el chat.</li>
                </ol>
              </div>
            `,
            showConfirmButton: true,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '📄 1. Generar PDF',
            denyButtonText: '💬 2. Abrir WhatsApp',
            cancelButtonText: 'Listo',
            confirmButtonColor: '#3085d6',
            denyButtonColor: '#25d366',
            cancelButtonColor: '#6e7881',
            allowOutsideClick: false,
          });

          if (waResult.isConfirmed) {
            const user = authService.getCurrentUser();
            await generateQuotePrintDocument(finalQuote, user, "standard", event);
            // Mostrar la guía nuevamente para continuar con el paso 2
            await showGuidedAlert();
          } else if (waResult.isDenied) {
            const cleanPhone = (finalQuote.phone || '').replace(/\D/g, '');
            const formattedPhone = cleanPhone.length === 8 ? `502${cleanPhone}` : cleanPhone;
            const message = `*Jardines del Lago - Cotización ${finalQuote.code}*\n\n` +
              `¡Hola! Te compartimos los detalles de la cotización realizada:\n\n` +
              `• *Cliente:* ${finalQuote.contact || ''}\n` +
              (finalQuote.companyName ? `• *Institución:* ${finalQuote.companyName}\n` : '') +
              `• *Evento:* ${finalQuote.eventType || ''}\n` +
              `• *Fecha del evento:* ${finalQuote.eventDate || ''}\n` +
              `• *Total:* ${moneyGT(finalQuote.total || 0, quote.currency)}\n\n` +
              `Te he enviado el documento adjunto. Quedamos a las órdenes para cualquier duda o comentario.`;
            const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
            // Mostrar la guía nuevamente
            await showGuidedAlert();
          }
        };

        await showGuidedAlert();
      }

      onClose();

    } catch (err) {
      console.error('Error al guardar cotización:', err);
      localSwal({ icon: 'error', title: 'Error', text: 'Hubo un problema al aplicar la cotización.' });
    }
  };

  const handleLoadVersion = (versionData) => {
    if (!versionData?.items) { localSwal('Error', 'Versión sin items', 'error'); return; }
    const restoredItems = versionData.items.map(item => ({
      ...item,
      rowId: uid(),
      serviceDate: item.serviceDate || quote.eventDate || availableServiceDates[0]
    }));
    setQuote(prev => ({
      ...prev,
      items: restoredItems,
      version: versionData.version || prev.version,
      internalNotes: versionData.internalNotes || prev.internalNotes
    }));
    setShowVersionPanel(false);
    localSwal('Éxito', `Versión ${versionData.version} cargada`, 'success');
  };

  const resetServiceDraft = () => setServiceDraft(emptyServiceDraft);

  const handleEditServiceDraft = (service) => {
    setServiceDraft({
      id: service.id || '',
      name: service.name || '',
      price: service.price ?? '',
      category: service.category || '',
      subcategory: service.subcategory || '',
      quantityMode: service.quantityMode || 'MANUAL',
      description: service.description || '',
      active: service.active !== false
    });
  };

  const handleSaveServiceDraft = async () => {
    if (!serviceDraft.name.trim()) { localSwal('Error', 'Ingresa nombre del servicio', 'error'); return; }
    try {
      const currentState = await loadCrmState();
      const currentServices = currentState?.services || [];
      const nameTrimmed2 = serviceDraft.name.trim().toLowerCase();
      const nameExists2 = currentServices.some(s =>
        String(s.name || '').trim().toLowerCase() === nameTrimmed2 &&
        String(s.id || '') !== String(serviceDraft.id)
      );
      if (nameExists2) { localSwal('Error', 'Ya existe un servicio con ese nombre', 'error'); return; }
      const savedService = {
        id: serviceDraft.id || `svc_${Date.now()}`,
        name: serviceDraft.name.trim(),
        price: Number(serviceDraft.price) || 0,
        category: serviceDraft.category || 'General',
        subcategory: serviceDraft.subcategory || '',
        description: serviceDraft.description || '',
        active: serviceDraft.active !== false,
        quantityMode: serviceDraft.quantityMode || 'MANUAL'
      };
      const exists = currentServices.some(service => String(service.id || '') === String(savedService.id));
      const nextServices = exists
        ? currentServices.map(service => String(service.id || '') === String(savedService.id) ? savedService : service)
        : [...currentServices, savedService];
      await saveCrmState({ ...currentState, services: nextServices });
      setCatalogServices(nextServices);
      
      // Seleccionar automáticamente el servicio creado o editado
      setSelectedCatalogService(savedService);
      setServiceSearch(savedService.name);
      
      resetServiceDraft();
      setShowCreateServiceModal(false);
      localSwal('Éxito', exists ? 'Servicio actualizado' : 'Servicio creado y seleccionado automáticamente', 'success');
    } catch { localSwal('Error', 'No se pudo guardar el servicio', 'error'); }
  };

  const handleToggleServiceActive = async () => {
    if (!serviceDraft.id) return;
    const nextDraft = { ...serviceDraft, active: !serviceDraft.active };
    setServiceDraft(nextDraft);
    const currentState = await loadCrmState();
    const currentServices = currentState?.services || [];
    const nextServices = currentServices.map(service => String(service.id || '') === String(serviceDraft.id)
      ? { ...service, active: nextDraft.active }
      : service);
    await saveCrmState({ ...currentState, services: nextServices });
    setCatalogServices(nextServices);
  };

  const handleApplyTemplate = () => {
    const template = quickTemplates.find(t => String(t.id) === quote.templateId);
    if (!template?.items?.length) { localSwal('Info', 'Plantilla sin items', 'info'); return; }
    const templateItems = template.items.map(item => ({
      rowId: uid(),
      serviceId: item.serviceId || item.id || 'manual',
      name: item.name || 'Item de plantilla',
      qty: Number(item.qty) || 1,
      price: Number(item.price) || 0,
      quantityMode: item.quantityMode || 'MANUAL',
      serviceDate: item.serviceDate || availableServiceDates[0]
    }));
    setQuote(prev => ({ ...prev, items: [...prev.items, ...templateItems] }));
    localSwal('Éxito', `Plantilla "${template.name}" aplicada`, 'success');
  };

  const handleOpenMenuMontaje = () => {
    const eventId = event?.id || eventProp?.id || eventData?.id;
    const isSaved = eventId && !String(eventId).startsWith('evt_');
    if (isSaved) {
      window.open(`/informe/pos/${eventId}`, '_blank');
    } else {
      localSwal({
        icon: 'warning',
        title: 'Reserva no guardada',
        text: 'Por favor, guarde la reserva antes de configurar el Menú y Montaje en el nuevo sistema.',
      });
    }
  };

  const getCurrentActor = () => {
    const user = authService.getCurrentUser?.() || {};
    return {
      id: String(user.id || user.userId || '').trim(),
      name: String(user.fullName || user.name || user.username || 'Sistema').trim()
    };
  };

  const buildAdvanceLog = (tone, label, change, actor = getCurrentActor()) => ({
    id: `advlog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    actorName: actor.name || 'Sistema',
    actorId: actor.id || '',
    tone,
    label,
    change
  });

  const resetAdvanceForm = () => {
    setAdvanceEditingId('');
    setAdvanceEvidenceFile(null);
    setAdvanceEvidenceInputKey(key => key + 1);
    setNewAdvance({
      amount: '',
      date: quote.docDate || todayISO(),
      paymentType: 'Efectivo',
      voucherNumber: '',
      description: '',
      evidenceName: ''
    });
  };

  const handleOpenAdvances = (eventArg) => {
    eventArg?.preventDefault?.();
    eventArg?.stopPropagation?.();
    resetAdvanceForm();
    setShowAdvancesModal(true);
    window.setTimeout(() => document.getElementById('quoteAdvanceAmount')?.focus(), 40);
  };

  const handleStartEditAdvance = (advanceId) => {
    const item = advanceRows.find(advance => String(advance.id) === String(advanceId));
    if (!item) return;
    setAdvanceEditingId(item.id);
    setAdvanceEvidenceFile(null);
    setAdvanceEvidenceInputKey(key => key + 1);
    setNewAdvance({
      amount: item.amount ? String(Number(item.amount).toFixed(2)) : '',
      date: item.date || quote.docDate || todayISO(),
      paymentType: normalizeAdvancePaymentType(item.paymentType),
      voucherNumber: item.voucherNumber || '',
      description: item.description || '',
      evidenceName: item.evidenceName || ''
    });
  };

  const handleSaveAdvanceEntry = async () => {
    const amountRaw = String(newAdvance.amount || '').trim();
    const amount = Math.max(0, Number(amountRaw || 0));
    const paymentType = normalizeAdvancePaymentType(newAdvance.paymentType);
    const date = String(newAdvance.date || '').trim();
    const voucherNumber = String(newAdvance.voucherNumber || '').trim();
    const description = String(newAdvance.description || '').trim();
    if (!amountRaw || Number.isNaN(Number(amountRaw)) || amount <= 0) {
      localSwal('Error', 'Anticipo: el monto es obligatorio y debe ser mayor a 0.', 'error');
      return;
    }
    if (!String(newAdvance.paymentType || '').trim()) {
      localSwal('Error', 'Anticipo: la forma de pago es obligatoria.', 'error');
      return;
    }
    if (!date) {
      localSwal('Error', 'Anticipo: la fecha es obligatoria.', 'error');
      return;
    }
    if (!description) {
      localSwal('Error', 'Anticipo: la descripcion es obligatoria.', 'error');
      return;
    }
    if (paymentType !== 'Efectivo' && !voucherNumber) {
      localSwal('Error', 'Anticipo: el No. de boleta es obligatorio para este tipo de pago.', 'error');
      return;
    }

    let evidenceDataUrl = '';
    let evidenceName = '';
    let evidenceType = '';
    if (advanceEvidenceFile) {
      const maxBytes = 6 * 1024 * 1024;
      if (Number(advanceEvidenceFile.size || 0) > maxBytes) {
        localSwal('Error', 'Evidencia: el archivo supera 6 MB.', 'error');
        return;
      }
      evidenceDataUrl = await readFileAsDataUrl(advanceEvidenceFile);
      if (!evidenceDataUrl) {
        localSwal('Error', 'No se pudo leer el archivo de evidencia.', 'error');
        return;
      }
      evidenceName = String(advanceEvidenceFile.name || 'evidencia').trim();
      evidenceType = String(advanceEvidenceFile.type || '').trim();
    }

    const actor = getCurrentActor();
    setQuote(prev => {
      const currentAdvances = Array.isArray(prev.advances) ? prev.advances : [];
      if (advanceEditingId) {
        const previous = normalizeAdvance(currentAdvances.find(item => String(item?.id || '') === String(advanceEditingId)));
        const nextAdvances = currentAdvances.map(item => {
          if (String(item?.id || '') !== String(advanceEditingId)) return item;
          return {
            ...item,
            amount,
            paymentType,
            date,
            voucherNumber,
            description,
            evidenceDataUrl: evidenceDataUrl || previous.evidenceDataUrl || '',
            evidenceName: evidenceName || previous.evidenceName || '',
            evidenceType: evidenceType || previous.evidenceType || ''
          };
        });
        const change = `Anticipo editado: ${previous.date || ''} ${formatAdvanceDetail(previous)} ${moneyGT(previous.amount || 0, quote.currency)} -> ${date} ${formatAdvanceDetail({ paymentType, voucherNumber, description })} ${moneyGT(amount || 0, quote.currency)}`;
        return {
          ...prev,
          advances: nextAdvances,
          advanceLogs: [...(prev.advanceLogs || []), buildAdvanceLog('edited', 'Editado', change, actor)]
        };
      }

      const advanceEntry = {
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
        createdByUserId: actor.id,
        createdByName: actor.name
      };
      const change = `Anticipo agregado: ${date} ${formatAdvanceDetail(advanceEntry)} ${moneyGT(amount || 0, quote.currency)}`;
      return {
        ...prev,
        advances: [...currentAdvances, advanceEntry],
        advanceLogs: [...(prev.advanceLogs || []), buildAdvanceLog('added', 'Agregado', change, actor)]
      };
    });
    const wasEditing = Boolean(advanceEditingId);
    resetAdvanceForm();
    localSwal('Exito', wasEditing ? 'Anticipo actualizado.' : 'Anticipo agregado.', 'success');
  };

  const handleDeleteAdvanceEntry = async (advanceId) => {
    const item = advanceRows.find(advance => String(advance.id) === String(advanceId));
    if (!item) return;
    const result = await localSwal({
      icon: 'warning',
      title: 'Eliminar anticipo',
      text: 'Este movimiento se quitara de los saldos y quedara registrado en el log.',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#991b1b',
      cancelButtonColor: '#1267d8'
    });
    if (!result.isConfirmed) return;
    const actor = getCurrentActor();
    setQuote(prev => ({
      ...prev,
      advances: (prev.advances || []).filter(a => String(a.id || '') !== String(advanceId)),
      advanceLogs: [
        ...(prev.advanceLogs || []),
        buildAdvanceLog('deleted', 'Eliminado', `Anticipo eliminado: ${item.date || ''} ${formatAdvanceDetail(item)} ${moneyGT(item.amount || 0, quote.currency)}`, actor)
      ]
    }));
    if (String(advanceEditingId) === String(advanceId)) resetAdvanceForm();
    localSwal('Listo', 'Anticipo eliminado.', 'success');
  };

  const handleReimprimir = async () => {
    if (!quote.items?.length) {
      localSwal({ icon: 'warning', title: 'Cotización vacía', text: 'Agrega servicios antes de imprimir.' });
      return;
    }
    const user = authService.getCurrentUser();

    const { value: printOption } = await localSwal({
      title: 'Formato de impresión',
      input: 'select',
      inputOptions: {
        standard: '📄 Estándar — Cotización + Contrato',
        completa: '📋 Completa — Cotización + Menú Montaje + Contrato',
        sin_precios: '🔒 Sin precios — Cotización (Q0) + Menú Montaje'
      },
      inputPlaceholder: 'Selecciona un formato',
      showCancelButton: true,
      confirmButtonText: 'Imprimir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1e3a5f',
      cancelButtonColor: '#6e7881'
    });

    if (!printOption) return;

    const success = await generateQuotePrintDocument({ ...quote, subtotal: totals.subtotal, discountAmount: totals.discountAmount, total: totals.total }, user, printOption, event);
    
    if (!success) {
      localSwal({ icon: 'error', title: 'Error', text: 'No se pudo generar el documento.' });
    }
  };

  // ─── Estilos de campos reutilizables ───
  const fieldLabel = { display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.3px' };
  const fieldInput = { width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '6px 9px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#0f172a', outline: 'none' };
  const fieldSelect = { width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' };
  const card = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' };

  return inlineMode ? (
    <div style={{ padding: '20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Anticipos</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Registra pagos anticipados para restar saldo del evento</div>
        </div>
      </div>

      <div className="quoteAdvanceFormGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <label className="field quoteAdvanceField--amount" style={{ gridColumn: 'span 2' }}>
          <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#475569', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Monto</span>
          <input id="quoteAdvanceAmount" type="number" min="0" step="0.01" value={newAdvance.amount} onChange={e => setNewAdvance(p => ({ ...p, amount: e.target.value }))} placeholder="Ej: 1500.00" style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }} />
        </label>
        <label className="field quoteAdvanceField--type" style={{ gridColumn: 'span 2' }}>
          <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#475569', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Forma de pago</span>
          <select value={newAdvance.paymentType} onChange={e => setNewAdvance(p => ({ ...p, paymentType: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}>
            <option value="Credito">Credito</option>
            <option value="Deposito">Deposito</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Tarjeta">Tarjeta</option>
          </select>
        </label>
        <label className="field quoteAdvanceField--date" style={{ gridColumn: 'span 2' }}>
          <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#475569', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Fecha</span>
          <input type="date" value={newAdvance.date} onChange={e => setNewAdvance(p => ({ ...p, date: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }} />
        </label>
        <label className="field quoteAdvanceField--voucher" style={{ gridColumn: 'span 2' }}>
          <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#475569', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>No. boleta</span>
          <input type="text" value={newAdvance.voucherNumber} onChange={e => setNewAdvance(p => ({ ...p, voucherNumber: e.target.value }))} placeholder="Ej: BOL-000123" style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }} />
        </label>
        <label className="field quoteAdvanceDescriptionField" style={{ gridColumn: 'span 4' }}>
          <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#475569', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Descripcion</span>
          <input type="text" value={newAdvance.description} onChange={e => setNewAdvance(p => ({ ...p, description: e.target.value }))} placeholder="Detalle del anticipo" style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }} />
        </label>
        <label className="field quoteAdvanceField--evidence" style={{ gridColumn: 'span 4' }}>
          <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#475569', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Evidencia (archivo)</span>
          <input key={advanceEvidenceInputKey} type="file" accept="image/*,application/pdf" onChange={e => { const file = e.target.files?.[0] || null; setAdvanceEvidenceFile(file); setNewAdvance(p => ({ ...p, evidenceName: file?.name || p.evidenceName })); }} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }} />
          <small style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px', display: 'block' }}>
            {advanceEvidenceFile ? `Archivo seleccionado: ${advanceEvidenceFile.name}` : (newAdvance.evidenceName ? `Archivo actual: ${newAdvance.evidenceName}` : 'Sin archivo adjunto')}
          </small>
        </label>
        <div className="rightActions quoteAdvanceAddAction" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'flex-end', gap: '6px', paddingBottom: '2px' }}>
          <button className="btnPrimary" type="button" onClick={handleSaveAdvanceEntry} style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>{advanceEditingId ? 'Guardar cambios' : 'Agregar anticipo'}</button>
          <button className="btn" type="button" onClick={resetAdvanceForm} style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap' }}>Limpiar</button>
        </div>
      </div>

      <div className="quoteAdvanceSummary" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', borderLeft: '3px solid #0f172a' }}>
          <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total anticipos</span>
          <strong style={{ display: 'block', fontSize: '15px', fontWeight: 850, color: '#0f172a', marginTop: '3px' }}>{moneyGT(abonosTotal, quote.currency)}</strong>
        </div>
        <div style={{ background: saldoPendiente > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '8px', padding: '12px', borderLeft: `3px solid ${saldoPendiente > 0 ? '#dc2626' : '#16a34a'}` }}>
          <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Saldo pendiente</span>
          <strong style={{ display: 'block', fontSize: '15px', fontWeight: 850, color: saldoPendiente > 0 ? '#dc2626' : '#16a34a', marginTop: '3px' }}>{moneyGT(saldoPendiente, quote.currency)}</strong>
        </div>
        <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '12px', borderLeft: '3px solid #2563eb' }}>
          <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Saldo a favor</span>
          <strong style={{ display: 'block', fontSize: '15px', fontWeight: 850, color: '#2563eb', marginTop: '3px' }}>{moneyGT(Math.max(0, abonosTotal - totals.total), quote.currency)}</strong>
        </div>
      </div>

      <div className="quoteTableWrap quoteAdvanceTableWrap" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
        <div className="quoteAdvanceLedgerHead" style={{ display: 'grid', gridTemplateColumns: '110px 110px 130px 1fr 110px 118px 160px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
          <span style={{ padding: '8px 10px' }}>Fecha</span>
          <span style={{ padding: '8px 10px' }}>Tipo</span>
          <span style={{ padding: '8px 10px' }}>No. boleta</span>
          <span style={{ padding: '8px 10px' }}>Descripcion</span>
          <span style={{ padding: '8px 10px', textAlign: 'right' }}>Monto</span>
          <span style={{ padding: '8px 10px' }}>Evidencia</span>
          <span style={{ padding: '8px 10px' }}>Acciones</span>
        </div>
        <div className="quoteAdvanceLedgerBody">
          {advanceRows.length > 0 ? advanceRows.map(adv => (
            <div className={`quoteAdvanceLedgerRow${String(adv.id) === String(advanceEditingId) ? ' isEditing' : ''}`} key={adv.id} style={{ display: 'grid', gridTemplateColumns: '110px 110px 130px 1fr 110px 118px 160px', borderBottom: '1px solid #f1f5f9', fontSize: '11px', transition: 'background 0.12s' }}>
              <div style={{ padding: '7px 10px', color: '#334155' }}>{adv.date || '-'}</div>
              <div style={{ padding: '7px 10px', fontWeight: 600 }}>{adv.paymentType || '-'}</div>
              <div style={{ padding: '7px 10px' }}>{adv.voucherNumber || '-'}</div>
              <div style={{ padding: '7px 10px', color: '#475569', fontSize: '10px' }}>{adv.description || '-'}</div>
              <div style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{moneyGT(adv.amount, quote.currency)}</div>
              <div style={{ padding: '7px 10px' }}>
                {adv.evidenceDataUrl ? (
                  <a className="btn quoteAdvanceEvidenceLink" href={adv.evidenceDataUrl} download={adv.evidenceName || `evidencia_${adv.id}.pdf`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}>Ver</a>
                ) : (
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>{adv.evidenceName || '-'}</span>
                )}
              </div>
              <div style={{ padding: '7px 10px', display: 'flex', gap: '4px' }}>
                <button className="apptIconBtn apptEdit" type="button" onClick={() => handleStartEditAdvance(adv.id)} style={{ padding: '2px 6px', fontSize: '9px', fontWeight: 700, borderRadius: '4px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer' }}>Editar</button>
                <button className="apptIconBtn apptDelete" type="button" onClick={() => handleDeleteAdvanceEntry(adv.id)} style={{ padding: '2px 6px', fontSize: '9px', fontWeight: 700, borderRadius: '4px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>Eliminar</button>
              </div>
            </div>
          )) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>Sin anticipos registrados.</div>
          )}
        </div>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 800, color: '#1e293b' }}>Log de pagos y movimientos</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#fafbfc' }}>
              <th style={{ padding: '7px 10px', fontWeight: 700, color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px', borderBottom: '1px solid #e2e8f0' }}>Fecha/Hora</th>
              <th style={{ padding: '7px 10px', fontWeight: 700, color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px', borderBottom: '1px solid #e2e8f0' }}>Usuario</th>
              <th style={{ padding: '7px 10px', fontWeight: 700, color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px', borderBottom: '1px solid #e2e8f0' }}>Movimiento</th>
            </tr>
          </thead>
          <tbody>
            {advanceLogRows.length > 0 ? advanceLogRows.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '7px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{log.at ? new Date(log.at).toLocaleString('es-GT') : '-'}</td>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{log.actorName || 'Sistema'}</td>
                <td style={{ padding: '7px 10px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#475569' }}>
                    <span style={{
                      padding: '1px 6px', borderRadius: '3px', fontWeight: 700, fontSize: '9px',
                      background: log.tone === 'added' ? '#dcfce7' : log.tone === 'edited' ? '#dbeafe' : log.tone === 'deleted' ? '#fee2e2' : '#f1f5f9',
                      color: log.tone === 'added' ? '#16a34a' : log.tone === 'edited' ? '#2563eb' : log.tone === 'deleted' ? '#dc2626' : '#64748b'
                    }}>{log.label || 'Agregado'}</span>
                    <span>{log.change || '-'}</span>
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>Sin movimientos de pagos registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
        <button className="btn" type="button" onClick={() => { resetAdvanceForm(); onClose?.(); }} style={{ padding: '8px 18px', fontSize: '11px', fontWeight: 700, borderRadius: '7px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer' }}>Cancelar</button>
        <button className="btnPrimary" type="button" onClick={() => { onSave?.(quote); onClose?.(); }} style={{ padding: '8px 18px', fontSize: '11px', fontWeight: 800, borderRadius: '7px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>Guardar y salir</button>
      </div>
    </div>
  ) : (
    <>
      {/* ── CSS global ── */}
      <style>{`
        body.quoteModeOpen .reservation-modal-overlay { display: none !important; }
        body.quoteModeOpen #appShell,
        body.quoteModeOpen nav,
        body.quoteModeOpen header,
        body.quoteModeOpen .lum-topbar,
        body.quoteModeOpen .app-topbar,
        body.quoteModeOpen .status-filter-bar,
        body.quoteModeOpen [class*="topbar"],
        body.quoteModeOpen [class*="navbar"],
        body.quoteModeOpen [class*="header"]:not(#qp-root *) {}
        #qp-root * { box-sizing: border-box; }
        #qp-root input:focus, #qp-root select:focus, #qp-root textarea:focus {
          outline: 2px solid #3b82f6; outline-offset: 0; border-color: #3b82f6;
        }
        
        /* Asegurar que las alertas (Swal) siempre salgan enfrente del modal */
        .swal2-container {
          z-index: 9999999 !important;
        }

        .qp-btn {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 6px 13px; font-size: 11px; font-weight: 700;
          border: 1px solid #cbd5e1; border-radius: 6px;
          background: #f8fafc; color: #334155;
          cursor: pointer; white-space: nowrap; transition: background .12s, border-color .12s;
        }
        .qp-btn:hover { background: #e2e8f0; border-color: #94a3b8; }
        .qp-btn-primary {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 7px 18px; font-size: 12px; font-weight: 800;
          border: none; border-radius: 7px;
          background: #0f172a; color: #fff;
          cursor: pointer; white-space: nowrap; transition: background .12s;
        }
        .qp-btn-primary:hover { background: #1e293b; }
        .qp-tbl { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 540px; }
        .qp-tbl thead tr { background: #f1f5f9; }
        .qp-tbl th { padding: 9px 10px; text-align: left; font-size: 10px; font-weight: 800; color: #475569; border-bottom: 1px solid #e2e8f0; white-space: nowrap; text-transform: uppercase; letter-spacing: .3px; }
        .qp-tbl td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; background: #ffffff; }
        .qp-tbl tbody tr:last-child td { border-bottom: none; }
        .qp-tbl tbody tr.sel td { background: #f0fdf4; }
        .qp-tbl input[type="number"] { width: 72px; font-size: 12px; padding: 4px 6px; border: 1px solid #e2e8f0; border-radius: 5px; background: #f8fafc; color: #0f172a; }
        .qp-tbl input[type="text"]  { width: 100%; font-size: 12px; padding: 4px 6px; border: 1px solid transparent; border-radius: 5px; background: transparent; color: #0f172a; }
        .qp-tbl input[type="text"]:hover  { border-color: #e2e8f0; background: #f8fafc; }
        .qp-tbl select { font-size: 11px; padding: 4px 6px; border: 1px solid #e2e8f0; border-radius: 5px; background: #f8fafc; color: #0f172a; }
        .qp-company-drop { position: absolute; top: calc(100% + 2px); left: 0; right: 0; z-index: 300; background: #fff; border: 1px solid #cbd5e1; border-radius: 7px; max-height: 150px; overflow-y: auto; box-shadow: 0 6px 18px rgba(0,0,0,.1); }
        .qp-company-drop div { padding: 7px 11px; font-size: 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; color: #334155; }
        .qp-company-drop div:last-child { border-bottom: none; }
        .qp-company-drop div:hover { background: #eff6ff; }
        .eyebrow { font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 2px; }
        .section-title { font-size: 13px; font-weight: 800; color: #0f172a; margin: 0 0 10px; }
        #qp-body::-webkit-scrollbar { width: 6px; }
        #qp-body::-webkit-scrollbar-track { background: #f1f5f9; }
        #qp-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        #quoteAdvanceBackdrop .modal > .modalHeader + div[style] { display: none !important; }
        body:not(.informes-theme) #quoteAdvanceBackdrop,
        #quoteAdvanceBackdrop {
          z-index: 10000001 !important;
          display: flex !important;
        }
        #quoteAdvanceBackdrop .modal > div[style*="background: #f8fafc"] {
          margin: 14px 16px 12px !important;
          padding: 0 !important;
          background: transparent !important;
          border-radius: 0 !important;
        }
        #quoteAdvanceBackdrop .modal > div[style*="background: #f8fafc"] > div:first-child {
          display: none !important;
        }
        #quoteAdvanceBackdrop label span,
        #quoteAdvanceBackdrop .field span {
          color: var(--muted, rgba(255,255,255,.68)) !important;
          font-size: 12px !important;
          font-weight: 700 !important;
        }
        #quoteAdvanceBackdrop input,
        #quoteAdvanceBackdrop select {
          width: 100% !important;
          min-height: 34px !important;
          border-radius: 9px !important;
          border: 1px solid #bfd0e6 !important;
          background: #ffffff !important;
          color: #071125 !important;
          font-size: 12px !important;
          padding: 6px 10px !important;
        }
        #quoteAdvanceBackdrop .modalFooter {
          background: #ffffff !important;
          border-top: 1px solid #dbe3ef !important;
          padding: 14px 22px !important;
        }
        #quoteAdvanceBackdrop .iconBtn {
          width: auto !important;
          min-width: 74px !important;
          height: 40px !important;
          padding: 0 14px !important;
          border-radius: 10px !important;
          font-size: 12px !important;
          font-weight: 900 !important;
        }
        #quoteAdvanceBackdrop .apptIconBtn {
          width: auto !important;
          min-width: 74px !important;
          padding: 0 12px !important;
          font-size: 12px !important;
          font-weight: 900 !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceModal {
          width: min(1080px, calc(100vw - 32px)) !important;
          max-height: calc(100vh - 32px) !important;
          display: grid !important;
          grid-template-rows: auto minmax(0, 1fr) auto !important;
          overflow: hidden !important;
          border-radius: 16px !important;
          background: #f2f6fb !important;
          border: 1px solid #c7d7ec !important;
          box-shadow: 0 28px 70px rgba(15, 23, 42, .28) !important;
        }
        #quoteAdvanceBackdrop .modalHeader {
          background: #ffffff !important;
          border-bottom: 1px solid #dbe3ef !important;
          padding: 12px 18px !important;
        }
        #quoteAdvanceBackdrop .modalTitle {
          color: #071125 !important;
          font-size: 22px !important;
          font-weight: 900 !important;
        }
        #quoteAdvanceBackdrop .modalSubtitle {
          color: #415574 !important;
          font-size: 12px !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceBody {
          min-height: 0 !important;
          overflow: auto !important;
          padding: 12px 16px 16px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 10px !important;
          background: #f2f6fb !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceFormGrid {
          display: grid !important;
          grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
          gap: 8px 10px !important;
          align-items: end !important;
          padding: 12px !important;
          border: 1px solid #d7e2f1 !important;
          border-radius: 12px !important;
          background: #ffffff !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceFormGrid .field {
          min-width: 0 !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceField--amount,
        #quoteAdvanceBackdrop .quoteAdvanceField--type,
        #quoteAdvanceBackdrop .quoteAdvanceField--date,
        #quoteAdvanceBackdrop .quoteAdvanceField--voucher {
          grid-column: span 2 !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceDescriptionField {
          grid-column: span 6 !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceField--evidence {
          grid-column: span 6 !important;
        }
        #quoteAdvanceBackdrop input[type="file"] {
          padding: 5px 8px !important;
          color: #10213a !important;
        }
        #quoteAdvanceBackdrop .fieldHint {
          display: block !important;
          margin-top: 3px !important;
          color: #64748b !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceAddAction {
          grid-column: span 4 !important;
          display: flex !important;
          justify-content: flex-end !important;
          align-items: center !important;
          gap: 8px !important;
          padding-top: 0 !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceAddAction .btnPrimary,
        #quoteAdvanceBackdrop .quoteAdvanceAddAction .btn {
          min-height: 34px !important;
          border-radius: 9px !important;
          padding: 0 12px !important;
          font-size: 11px !important;
          font-weight: 900 !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceSummary {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 12px !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceMetric {
          min-height: 54px !important;
          padding: 10px 12px !important;
          border: 1px solid #d7e2f1 !important;
          border-radius: 12px !important;
          background: #ffffff !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceMetric span {
          display: block !important;
          color: #52637c !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          letter-spacing: .06em !important;
          text-transform: uppercase !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceMetric strong {
          display: block !important;
          margin-top: 0 !important;
          color: #071125 !important;
          font-size: 20px !important;
          font-weight: 900 !important;
          white-space: nowrap !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceMetric--credit strong {
          color: #0f766e !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceTableWrap,
        #quoteAdvanceBackdrop .quoteAdvanceLogWrap {
          border: 1px solid #d7e2f1 !important;
          border-radius: 12px !important;
          background: #ffffff !important;
          overflow: auto !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerHead,
        #quoteAdvanceBackdrop .quoteAdvanceLedgerRow {
          display: grid !important;
          grid-template-columns: 110px 110px 130px minmax(210px, 1fr) 110px 118px 160px !important;
          gap: 0 !important;
          align-items: stretch !important;
          min-width: 980px !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerHead {
          position: sticky !important;
          top: 0 !important;
          z-index: 1 !important;
          background: #e8f0fa !important;
          border-bottom: 1px solid #d7e2f1 !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerHead span {
          padding: 12px 10px !important;
          color: #10213a !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          letter-spacing: .06em !important;
          text-transform: uppercase !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerRow {
          border-bottom: 1px solid #eef3f8 !important;
          background: #ffffff !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerRow:nth-child(even) {
          background: #f8fbff !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerRow.isEditing {
          box-shadow: inset 4px 0 0 #1267d8 !important;
          background: #edf4ff !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerCell {
          min-width: 0 !important;
          padding: 12px 10px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          gap: 4px !important;
          color: #10213a !important;
          font-size: 12px !important;
          overflow-wrap: anywhere !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerCell strong {
          color: #071125 !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          white-space: nowrap !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerLabel {
          display: none !important;
          color: #64748b !important;
          font-size: 10px !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          letter-spacing: .04em !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerMuted {
          color: #64748b !important;
          font-weight: 700 !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceEvidenceLink {
          width: fit-content !important;
          min-height: 30px !important;
          padding: 6px 12px !important;
          border-radius: 8px !important;
          color: #075cca !important;
          text-decoration: none !important;
          font-weight: 900 !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerCell--actions .appointmentActions {
          display: flex !important;
          gap: 8px !important;
          justify-content: flex-start !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerCell--actions .apptIconBtn {
          min-height: 32px !important;
          border-radius: 8px !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerCell--actions .apptEdit {
          background: #edf4ff !important;
          color: #075cca !important;
          border-color: #bfd7fb !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerCell--actions .apptDelete {
          background: #fff1f2 !important;
          color: #b91c1c !important;
          border-color: #fecdd3 !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLedgerEmpty {
          min-width: 980px !important;
          padding: 24px 16px !important;
          color: #64748b !important;
          text-align: center !important;
          font-size: 13px !important;
          font-weight: 800 !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLogCard {
          border: 1px solid #d7e2f1 !important;
          border-radius: 12px !important;
          background: #ffffff !important;
          padding: 14px !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLogCard .quoteCardTitle {
          margin-bottom: 10px !important;
          color: #071125 !important;
          font-size: 14px !important;
          font-weight: 900 !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLogEntry {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          flex-wrap: wrap !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLogTag {
          display: inline-flex !important;
          align-items: center !important;
          min-height: 24px !important;
          padding: 4px 9px !important;
          border-radius: 999px !important;
          font-size: 10px !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          letter-spacing: .05em !important;
        }
        #quoteAdvanceBackdrop .quoteAdvanceLogTag--added { background: #dcfce7 !important; color: #166534 !important; }
        #quoteAdvanceBackdrop .quoteAdvanceLogTag--edited { background: #dbeafe !important; color: #1d4ed8 !important; }
        #quoteAdvanceBackdrop .quoteAdvanceLogTag--deleted { background: #fee2e2 !important; color: #991b1b !important; }
        #quoteAdvanceBackdrop .quoteAdvanceLogTag--credit { background: #ccfbf1 !important; color: #0f766e !important; }
        #quoteAdvanceBackdrop .quoteAdvanceLogEmptyRow td {
          text-align: center !important;
          padding: 18px !important;
          color: #64748b !important;
          font-weight: 800 !important;
        }
        @media (max-width: 900px) {
          #quoteAdvanceBackdrop .quoteAdvanceFormGrid,
          #quoteAdvanceBackdrop .quoteAdvanceSummary {
            grid-template-columns: 1fr !important;
          }
          #quoteAdvanceBackdrop .quoteAdvanceDescriptionField {
            grid-column: auto !important;
          }
          #quoteAdvanceBackdrop .quoteAdvanceField--amount,
          #quoteAdvanceBackdrop .quoteAdvanceField--type,
          #quoteAdvanceBackdrop .quoteAdvanceField--date,
          #quoteAdvanceBackdrop .quoteAdvanceField--voucher,
          #quoteAdvanceBackdrop .quoteAdvanceField--evidence,
          #quoteAdvanceBackdrop .quoteAdvanceAddAction {
            grid-column: auto !important;
          }
          #quoteAdvanceBackdrop .quoteAdvanceLedgerHead {
            display: none !important;
          }
          #quoteAdvanceBackdrop .quoteAdvanceLedgerRow {
            min-width: 0 !important;
            grid-template-columns: 1fr !important;
            padding: 8px !important;
          }
          #quoteAdvanceBackdrop .quoteAdvanceLedgerCell {
            padding: 8px !important;
          }
          #quoteAdvanceBackdrop .quoteAdvanceLedgerLabel {
            display: block !important;
          }
          #quoteAdvanceBackdrop .quoteAdvanceLedgerEmpty {
            min-width: 0 !important;
          }
        }

        #menuMontajeSelectableBackdrop {
          position: fixed !important;
          inset: 0 !important;
          z-index: 10000000 !important;
          padding: 0 !important;
          background: #f5f7fc !important;
          display: block !important;
          overflow: hidden !important;
        }
        #menuMontajeSelectableBackdrop .menuMontajeModal {
          width: 100vw !important;
          height: 100vh !important;
          max-width: none !important;
          max-height: none !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: #f5f7fc !important;
          box-shadow: none !important;
          display: grid !important;
          grid-template-rows: 64px minmax(0, 1fr) !important;
          overflow: hidden !important;
        }
        #menuMontajeSelectableBackdrop .modalHeader {
          min-height: 64px !important;
          padding: 0 28px !important;
          border-bottom: 1px solid #dbe3ef !important;
          background: #ffffff !important;
          box-shadow: 0 1px 4px rgba(15,23,42,.06) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
        }
        #menuMontajeSelectableBackdrop .modalHeader > div {
          display: flex !important;
          align-items: center !important;
          gap: 42px !important;
          min-width: 0 !important;
        }
        #menuMontajeSelectableBackdrop .modalTitle {
          color: #071125 !important;
          font-size: 25px !important;
          font-weight: 900 !important;
          letter-spacing: 0 !important;
          white-space: nowrap !important;
        }
        #menuMontajeSelectableBackdrop .modalSubtitle {
          color: #415574 !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          margin: 0 !important;
        }
        #menuMontajeSelectableBackdrop .iconBtn {
          width: auto !important;
          min-width: 74px !important;
          height: 40px !important;
          border-radius: 10px !important;
          border: 1px solid #cbd6e6 !important;
          background: #eef5ff !important;
          color: #17233a !important;
          box-shadow: none !important;
          padding: 0 14px !important;
          font-size: 12px !important;
          font-weight: 900 !important;
        }
        #menuMontajeSelectableBackdrop .menuMontajeBody {
          min-height: 0 !important;
          height: 100% !important;
          overflow: auto !important;
          padding: 0 !important;
          background: #f5f7fc !important;
          display: block !important;
        }
        #menuMontajeSelectableBackdrop .mmsReactPanel {
          min-height: 100% !important;
          display: grid !important;
          grid-template-columns: 296px minmax(0, 1fr) !important;
          grid-template-rows: auto auto minmax(0, auto) auto !important;
          column-gap: 24px !important;
          row-gap: 18px !important;
          padding: 24px 28px 84px 324px !important;
          background: #f5f7fc !important;
          color: #071125 !important;
          position: relative !important;
        }
        #menuMontajeSelectableBackdrop .mmsReactPanel::before {
          content: "Menú y Montaje\\A GESTION DE EVENTOS";
          white-space: pre-line;
          position: fixed;
          left: 0;
          top: 64px;
          bottom: 0;
          width: 296px;
          padding: 26px 28px;
          border-right: 1px solid #dbe3ef;
          background: #f8fbff;
          color: #071125;
          font-size: 24px;
          line-height: 1.12;
          font-weight: 900;
          letter-spacing: 0;
        }
        #menuMontajeSelectableBackdrop .mmsReactPanel::after {
          content: "Elige el modo y luego avanza por cada categoria.";
          position: fixed;
          left: 28px;
          bottom: 92px;
          width: 240px;
          padding-top: 18px;
          border-top: 1px solid #dbe3ef;
          color: #415574;
          font-size: 12px;
          line-height: 1.5;
        }
        #menuMontajeSelectableBackdrop .mmsReactPanel > * {
          grid-column: 1 / -1 !important;
          position: relative !important;
          z-index: 1 !important;
        }
        #menuMontajeSelectableBackdrop .mmsFlatSectionHead {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 18px !important;
          margin: 0 !important;
          padding: 0 0 14px !important;
          border-bottom: 1px solid #dbe3ef !important;
        }
        #menuMontajeSelectableBackdrop .mmsFlatSectionHead h3 {
          color: #071125 !important;
          font-size: 18px !important;
          font-weight: 900 !important;
          margin: 0 !important;
        }
        #menuMontajeSelectableBackdrop .mmsPrimaryTab {
          min-height: 40px !important;
          padding: 8px 18px !important;
          border-radius: 10px !important;
          border: 1px solid #cbd6e6 !important;
          background: #ffffff !important;
          color: #071125 !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          letter-spacing: 0 !important;
        }
        #menuMontajeSelectableBackdrop .mmsPrimaryTab.isActive {
          background: #071f63 !important;
          border-color: #0f4fc8 !important;
          color: #ffffff !important;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.18), 0 8px 18px rgba(15,23,42,.12) !important;
        }
        #menuMontajeSelectableBackdrop .mmCard,
        #menuMontajeSelectableBackdrop .quoteCard {
          border: 1px solid #d8e2f1 !important;
          border-radius: 12px !important;
          background: #ffffff !important;
          box-shadow: none !important;
          padding: 18px 20px !important;
        }
        #menuMontajeSelectableBackdrop .mmsFlatContextCard {
          display: grid !important;
          grid-template-columns: minmax(240px, 1fr) minmax(220px, .85fr) minmax(160px, .55fr) !important;
          gap: 16px !important;
        }
        #menuMontajeSelectableBackdrop .mmsFlatBuilderCard {
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
        }
        #menuMontajeSelectableBackdrop .mmsFlatPosLayout {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 405px) !important;
          gap: 16px !important;
        }
        #menuMontajeSelectableBackdrop .mmsStageTabs {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(118px, 1fr)) !important;
          gap: 8px !important;
          padding: 10px !important;
          border: 1px solid #d8e2f1 !important;
          border-radius: 12px !important;
          background: #eef4fc !important;
        }
        #menuMontajeSelectableBackdrop .mmsStageTab {
          min-height: 40px !important;
          border: 1px solid #cfe0f7 !important;
          border-radius: 10px !important;
          background: #f8fbff !important;
          color: #13213a !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          text-align: left !important;
          padding: 8px 10px !important;
        }
        #menuMontajeSelectableBackdrop .mmsStageTab.isActive {
          background: #0b63ce !important;
          border-color: #0b63ce !important;
          color: #ffffff !important;
        }
        #menuMontajeSelectableBackdrop .mmsStageTab:disabled {
          opacity: .55 !important;
          cursor: not-allowed !important;
        }
        #menuMontajeSelectableBackdrop input,
        #menuMontajeSelectableBackdrop select,
        #menuMontajeSelectableBackdrop textarea {
          width: 100% !important;
          border: 1px solid #bfd0e6 !important;
          border-radius: 10px !important;
          background: #ffffff !important;
          color: #071125 !important;
          font-size: 13px !important;
          outline: none !important;
        }
        #menuMontajeSelectableBackdrop label,
        #menuMontajeSelectableBackdrop .field span {
          color: #344866 !important;
          font-weight: 800 !important;
        }
        #menuMontajeSelectableBackdrop .mmsStageBoard,
        #menuMontajeSelectableBackdrop .mmsPosRight {
          border: 1px solid #d8e2f1 !important;
          border-radius: 12px !important;
          background: #f8fbff !important;
          padding: 16px !important;
        }
        #menuMontajeSelectableBackdrop .mmsStageTitle {
          color: #071125 !important;
          font-size: 20px !important;
          font-weight: 900 !important;
          margin: 0 0 12px !important;
          text-transform: uppercase !important;
        }
        #menuMontajeSelectableBackdrop .mmsQuickButtons {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)) !important;
          gap: 10px !important;
        }
        #menuMontajeSelectableBackdrop .mmsQuickBtn {
          min-height: 44px !important;
          border-radius: 9px !important;
          border: 1px solid #d8e2f1 !important;
          background: #ffffff !important;
          color: #071125 !important;
          font-weight: 800 !important;
          text-align: left !important;
          padding: 10px 12px !important;
        }
        #menuMontajeSelectableBackdrop .mmsQuickBtn.isSelected {
          border-color: #0b63ce !important;
          background: #eaf2ff !important;
          color: #075cca !important;
        }
        #menuMontajeSelectableBackdrop .modalFooter {
          position: fixed !important;
          left: 296px !important;
          right: 0 !important;
          bottom: 0 !important;
          min-height: 64px !important;
          padding: 12px 28px !important;
          border-top: 1px solid #dbe3ef !important;
          background: rgba(255,255,255,.96) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 10px !important;
          z-index: 5 !important;
        }
        @media (max-width: 980px) {
          #menuMontajeSelectableBackdrop .mmsReactPanel {
            display: flex !important;
            flex-direction: column !important;
            padding: 18px 16px 84px !important;
          }
          #menuMontajeSelectableBackdrop .mmsReactPanel::before,
          #menuMontajeSelectableBackdrop .mmsReactPanel::after {
            display: none !important;
          }
          #menuMontajeSelectableBackdrop .modalFooter {
            left: 0 !important;
          }
          #menuMontajeSelectableBackdrop .mmsFlatContextCard,
          #menuMontajeSelectableBackdrop .mmsFlatPosLayout {
            grid-template-columns: 1fr !important;
          }
          #menuMontajeSelectableBackdrop .mmsStageTabs {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        /* Menu y Montaje - layout profesional sin decoracion pesada */
        #menuMontajeSelectableBackdrop {
          background: rgba(2,6,23,0.72) !important;
        }
        #menuMontajeSelectableBackdrop .menuMontajeModal {
          background: #060d1f !important;
        }
        #menuMontajeSelectableBackdrop .modalHeader {
          background: linear-gradient(180deg, rgba(15,23,42,.96), rgba(9,14,28,.92)) !important;
          border-bottom: 1px solid rgba(148,163,184,.14) !important;
          box-shadow: none !important;
        }
        #menuMontajeSelectableBackdrop .modalTitle {
          color: #f8fafc !important;
        }
        #menuMontajeSelectableBackdrop .modalSubtitle {
          color: #94a3b8 !important;
        }
        #menuMontajeSelectableBackdrop .iconBtn {
          border-color: rgba(148,163,184,.22) !important;
          background: rgba(255,255,255,.05) !important;
          color: #e2e8f0 !important;
        }
        #menuMontajeSelectableBackdrop .menuMontajeBody {
          overflow: hidden !important;
          background: #060d1f !important;
        }
        #menuMontajeSelectableBackdrop .mmsReactPanel {
          height: 100% !important;
          min-height: 0 !important;
          display: block !important;
          padding: 0 !important;
          background: #060d1f !important;
        }
        #menuMontajeSelectableBackdrop .mmsReactPanel::before,
        #menuMontajeSelectableBackdrop .mmsReactPanel::after {
          display: none !important;
          content: none !important;
        }
        #menuMontajeSelectableBackdrop .mmsReactPanel > * {
          grid-column: auto !important;
        }
        #menuMontajeSelectableBackdrop .mmsShell {
          height: 100%;
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          background: #060d1f;
        }
        #menuMontajeSelectableBackdrop .mmsSidebar {
          display: none !important;
        }
        #menuMontajeSelectableBackdrop .mmsSidebarTitle {
          color: #071125;
          font-size: 20px;
          line-height: 1.08;
          font-weight: 900;
        }
        #menuMontajeSelectableBackdrop .mmsSidebarSubtitle {
          margin-top: 4px;
          color: #071125;
          font-size: 18px;
          line-height: 1.05;
          font-weight: 900;
        }
        #menuMontajeSelectableBackdrop .mmsSideGroup {
          margin-top: 26px;
        }
        #menuMontajeSelectableBackdrop .mmsSideLabel {
          margin-bottom: 10px;
          color: #52637b;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        #menuMontajeSelectableBackdrop .mmsModeBtn,
        #menuMontajeSelectableBackdrop .mmsStageItem {
          width: 100%;
          min-height: 42px;
          border: 1px solid #cfe0f7;
          border-radius: 10px;
          background: #edf4ff;
          color: #17233a;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          font-size: 13px;
          font-weight: 900;
          text-align: left;
          cursor: pointer;
        }
        #menuMontajeSelectableBackdrop .mmsModeBtn.isActive,
        #menuMontajeSelectableBackdrop .mmsStageItem.isActive {
          background: #1267d8;
          border-color: #1267d8;
          color: #ffffff;
        }
        #menuMontajeSelectableBackdrop .mmsStageItem span {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,.72);
          color: #1267d8 !important;
          font-weight: 900;
          flex: 0 0 auto;
        }
        #menuMontajeSelectableBackdrop .mmsStageItem.isActive span {
          background: #ffffff;
        }
        #menuMontajeSelectableBackdrop .mmsStageItem.isDisabled {
          opacity: .58;
          cursor: not-allowed;
        }
        #menuMontajeSelectableBackdrop .mmsSideHelp {
          margin-top: 26px;
          padding-top: 18px;
          border-top: 1px solid #d7e2f1;
          color: #415574;
          font-size: 12px;
          line-height: 1.5;
        }
        #menuMontajeSelectableBackdrop .mmsMain {
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: minmax(0, 1fr) auto;
        }
        #menuMontajeSelectableBackdrop .mmsMainScroll {
          min-height: 0;
          overflow: auto;
          padding: 18px 22px 18px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        #menuMontajeSelectableBackdrop .mmsCard {
          border: 1px solid #d7e2f1 !important;
          border-radius: 12px !important;
          background: #ffffff !important;
          padding: 20px !important;
          box-shadow: none !important;
        }
        #menuMontajeSelectableBackdrop .mmsSectionHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }
        #menuMontajeSelectableBackdrop .mmsSectionHead.compact {
          margin-bottom: 14px;
        }
        #menuMontajeSelectableBackdrop .mmsSectionHead h3 {
          margin: 0;
          color: #071125;
          font-size: 22px;
          line-height: 1.1;
          font-weight: 900;
        }
        #menuMontajeSelectableBackdrop .mmsSectionHead p {
          margin: 6px 0 0;
          color: #415574;
          font-size: 12px;
        }
        #menuMontajeSelectableBackdrop .mmsVersionBadge,
        #menuMontajeSelectableBackdrop .mmsCurrentStep {
          min-height: 30px;
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid #cfe0f7;
          background: #edf4ff;
          color: #075cca;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }
        #menuMontajeSelectableBackdrop .mmsTopActions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }
        #menuMontajeSelectableBackdrop .mmsStepNav {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        #menuMontajeSelectableBackdrop .mmsStepNav button {
          min-height: 30px;
          border: 1px solid #cfe0f7;
          border-radius: 8px;
          background: #f8fbff;
          color: #415574;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }
        #menuMontajeSelectableBackdrop .mmsStepNav button.isActive {
          background: #edf4ff;
          color: #075cca;
          border-color: #9dc2f3;
        }
        #menuMontajeSelectableBackdrop .mmsViewSwitch {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px;
          border: 1px solid #cfe0f7;
          border-radius: 10px;
          background: #f3f7fc;
        }
        #menuMontajeSelectableBackdrop .mmsViewSwitch button {
          min-height: 28px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: #415574;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }
        #menuMontajeSelectableBackdrop .mmsViewSwitch button.isActive {
          background: #1267d8;
          color: #ffffff;
        }
        #menuMontajeSelectableBackdrop .mmsNotice {
          position: absolute !important;
          left: 324px;
          top: 16px;
          z-index: 10 !important;
          width: min(360px, calc(100% - 352px));
          min-height: 74px;
          border: 1px solid #bdd3ef;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 14px 34px rgba(15, 23, 42, .14);
          color: #071125;
          padding: 14px 16px 16px 68px;
          overflow: hidden;
        }
        #menuMontajeSelectableBackdrop .mmsNoticeMark {
          position: absolute;
          left: 18px;
          top: 18px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 2px solid #2fbf71;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #16834a;
          font-size: 11px;
          font-weight: 900;
        }
        #menuMontajeSelectableBackdrop .mmsNoticeText {
          color: #071125;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.35;
        }
        #menuMontajeSelectableBackdrop .mmsNoticeBar {
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 0;
          height: 3px;
          background: #8298b6;
          transform-origin: left center;
          animation: mmsNoticeTimer 3.6s linear forwards;
        }
        @keyframes mmsNoticeTimer {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
        #menuMontajeSelectableBackdrop .mmsDataGrid,
        #menuMontajeSelectableBackdrop .mmsManualGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        #menuMontajeSelectableBackdrop .mmsManualGrid.twoCols {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-top: 16px;
        }
        #menuMontajeSelectableBackdrop .mmsBuilderGrid {
          display: grid;
          grid-template-columns: minmax(320px, .78fr) minmax(480px, 1.22fr);
          gap: 18px;
          align-items: start;
        }
        #menuMontajeSelectableBackdrop .mmsField {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }
        #menuMontajeSelectableBackdrop .mmsField > span,
        #menuMontajeSelectableBackdrop .mmsQtyField > span {
          color: #10213a !important;
          font-size: 11px;
          font-weight: 900 !important;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        #menuMontajeSelectableBackdrop .mmsInlineControl,
        #menuMontajeSelectableBackdrop .mmsToolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        #menuMontajeSelectableBackdrop .mmsToolbar {
          padding-bottom: 14px;
          border-bottom: 1px solid #e4ebf5;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        #menuMontajeSelectableBackdrop .mmsToolbar > input {
          flex: 1 1 auto;
          min-width: 160px;
        }
        #menuMontajeSelectableBackdrop .mmsQtyField {
          width: 96px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        #menuMontajeSelectableBackdrop .mmsBtn {
          min-height: 40px;
          border-radius: 9px;
          border: 1px solid #c8d7eb;
          padding: 8px 13px;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }
        #menuMontajeSelectableBackdrop .mmsBtn:disabled {
          opacity: .52;
          cursor: not-allowed;
        }
        #menuMontajeSelectableBackdrop .mmsBtnSecondary {
          background: #f3f7fc;
          color: #24364f;
        }
        #menuMontajeSelectableBackdrop .mmsBtnPrimary {
          background: #1267d8;
          border-color: #1267d8;
          color: #ffffff;
        }
        #menuMontajeSelectableBackdrop .mmsBtnDanger {
          background: #fff1f1;
          border-color: #ffc6c6;
          color: #991b1b;
        }
        #menuMontajeSelectableBackdrop .mmsPendingSelection {
          margin: -4px 0 14px;
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid #bdd3ef;
          border-radius: 10px;
          background: #edf4ff;
          padding: 9px 12px;
        }
        #menuMontajeSelectableBackdrop .mmsPendingSelection span {
          color: #415574;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        #menuMontajeSelectableBackdrop .mmsPendingSelection strong {
          color: #075cca;
          font-size: 13px;
          font-weight: 900;
          text-align: right;
          overflow-wrap: anywhere;
        }
        #menuMontajeSelectableBackdrop .mmsOptionBoard {
          border: 1px solid #d7e2f1;
          border-radius: 12px;
          background: #f8fbff;
          padding: 16px;
        }
        #menuMontajeSelectableBackdrop .mmsBoardTitle {
          margin-bottom: 12px;
          color: #071125;
          font-size: 15px;
          font-weight: 900;
          text-transform: uppercase;
        }
        #menuMontajeSelectableBackdrop .mmsOptionGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 10px;
        }
        #menuMontajeSelectableBackdrop .mmsOptionBtn {
          min-height: 52px;
          border: 1px solid #d7e2f1;
          border-radius: 10px;
          background: #ffffff;
          color: #071125;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 13px;
          font-weight: 800;
          text-align: left;
          cursor: pointer;
        }
        #menuMontajeSelectableBackdrop .mmsOptionBtn.isSelected {
          border-color: #1267d8;
          background: #edf4ff;
          color: #075cca;
        }
        #menuMontajeSelectableBackdrop .mmsOptionBtn small {
          font-size: 11px;
          color: #075cca;
          font-weight: 900;
        }
        #menuMontajeSelectableBackdrop .mmsConfiguredList {
          margin-top: 16px;
          border: 1px solid #cfe8d6;
          border-radius: 12px;
          background: #f4fbf6;
          padding: 14px;
        }
        #menuMontajeSelectableBackdrop .mmsConfiguredRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #ffffff;
          border: 1px solid #dbeee1;
        }
        #menuMontajeSelectableBackdrop .mmsConfiguredRow + .mmsConfiguredRow {
          margin-top: 8px;
        }
        #menuMontajeSelectableBackdrop .mmsConfiguredRow.isActive {
          border-color: #16834a;
        }
        #menuMontajeSelectableBackdrop .mmsConfiguredRow strong,
        #menuMontajeSelectableBackdrop .mmsConfiguredRow span {
          display: block;
        }
        #menuMontajeSelectableBackdrop .mmsConfiguredRow strong {
          color: #14532d;
          font-size: 12px;
          font-weight: 900;
        }
        #menuMontajeSelectableBackdrop .mmsConfiguredRow span {
          margin-top: 3px;
          color: #1f2937;
          font-size: 13px;
        }
        #menuMontajeSelectableBackdrop .mmsLiveComanda {
          margin-bottom: 16px;
          border: 1px solid #cfe0f7;
          border-radius: 12px;
          background: #f8fbff;
          padding: 14px;
        }
        #menuMontajeSelectableBackdrop .mmsActiveHint {
          min-height: 54px;
          display: flex;
          align-items: center;
          margin-bottom: 14px;
          border: 1px solid #bdd3ef;
          border-radius: 10px;
          background: #edf4ff;
          color: #071125;
          padding: 12px 14px;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
        }
        #menuMontajeSelectableBackdrop .mmsLiveCard {
          border: 1px solid #cfe0f7;
          border-radius: 10px;
          background: #ffffff;
          padding: 10px;
        }
        #menuMontajeSelectableBackdrop .mmsLiveCard + .mmsLiveCard {
          margin-top: 10px;
        }
        #menuMontajeSelectableBackdrop .mmsLiveCard.isActive {
          border-color: #1267d8;
          background: #edf4ff;
        }
        #menuMontajeSelectableBackdrop .mmsLiveHead {
          width: 100%;
          min-height: 36px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid #bdd3ef;
          border-radius: 9px;
          background: #eef4fb;
          color: #415574;
          padding: 8px 10px;
          text-align: left;
          cursor: pointer;
        }
        #menuMontajeSelectableBackdrop .mmsLiveHead span {
          color: #415574;
          font-size: 13px;
          font-weight: 900;
          min-width: 0;
          overflow-wrap: anywhere;
        }
        #menuMontajeSelectableBackdrop .mmsLiveHead strong {
          color: #075cca;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }
        #menuMontajeSelectableBackdrop .mmsLiveControls {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
          padding: 9px;
          border: 1px solid #bdd3ef;
          border-radius: 10px;
          background: #edf4ff;
        }
        #menuMontajeSelectableBackdrop .mmsPill,
        #menuMontajeSelectableBackdrop .mmsQtyControl {
          min-height: 34px;
          border: 1px solid #cfe0f7;
          border-radius: 999px;
          background: #ffffff;
          color: #10213a;
          padding: 7px 11px;
          font-size: 12px;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        #menuMontajeSelectableBackdrop .mmsQtyControl {
          min-width: 34px;
          cursor: pointer;
        }
        #menuMontajeSelectableBackdrop .mmsTimeControl {
          min-height: 34px;
          border: 1px solid #cfe0f7;
          border-radius: 999px;
          background: #ffffff;
          color: #10213a;
          padding: 4px 9px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        #menuMontajeSelectableBackdrop .mmsTimeControl span {
          color: #10213a;
          font-size: 12px;
          font-weight: 900;
        }
        #menuMontajeSelectableBackdrop .mmsTimeControl input {
          width: 92px !important;
          min-height: 26px !important;
          border: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          font-size: 12px !important;
          font-weight: 900 !important;
        }
        #menuMontajeSelectableBackdrop .mmsQtyControl.danger {
          border-color: #ffc6c6;
          background: #fff1f1;
          color: #991b1b;
          border-radius: 9px;
        }
        #menuMontajeSelectableBackdrop .mmsLiveDetails {
          margin-top: 10px;
          border: 1px solid #d7e2f1;
          border-radius: 9px;
          background: #ffffff;
          padding: 9px 10px;
          color: #10213a;
          font-size: 12px;
          line-height: 1.5;
        }
        #menuMontajeSelectableBackdrop .mmsCatalogLayer {
          position: fixed !important;
          inset: 0;
          z-index: 30 !important;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(15, 23, 42, .48);
        }
        #menuMontajeSelectableBackdrop .mmsCatalogModal {
          width: min(1120px, 96vw);
          max-height: 90vh;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          border: 1px solid #bdd3ef;
          border-radius: 14px;
          background: #f5f7fc;
          box-shadow: 0 24px 70px rgba(15, 23, 42, .28);
          overflow: hidden;
        }
        #menuMontajeSelectableBackdrop .mmsCatalogHeader,
        #menuMontajeSelectableBackdrop .mmsCatalogFooter {
          background: #ffffff;
          border-bottom: 1px solid #d7e2f1;
          padding: 16px 18px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }
        #menuMontajeSelectableBackdrop .mmsCatalogFooter {
          border-top: 1px solid #d7e2f1;
          border-bottom: 0;
          justify-content: flex-end;
        }
        #menuMontajeSelectableBackdrop .mmsCatalogHeader h3 {
          margin: 0;
          color: #071125;
          font-size: 20px;
          font-weight: 900;
        }
        #menuMontajeSelectableBackdrop .mmsCatalogHeader p {
          margin: 5px 0 0;
          color: #415574;
          font-size: 12px;
        }
        #menuMontajeSelectableBackdrop .mmsCatalogClose {
          min-height: 38px;
          border: 1px solid #c8d7eb;
          border-radius: 9px;
          background: #eef5ff;
          color: #17233a;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }
        #menuMontajeSelectableBackdrop .mmsCatalogBody {
          min-height: 0;
          overflow: auto;
          padding: 18px;
        }
        #menuMontajeSelectableBackdrop .mmsCatalogForm {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }
        #menuMontajeSelectableBackdrop .mmsCatalogActions {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }
        #menuMontajeSelectableBackdrop .mmsCatalogTableWrap {
          border: 1px solid #10213a;
          border-radius: 10px;
          background: #ffffff;
          overflow: auto;
        }
        #menuMontajeSelectableBackdrop .mmsCatalogTableWrap table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        #menuMontajeSelectableBackdrop .mmsCatalogTableWrap th,
        #menuMontajeSelectableBackdrop .mmsCatalogTableWrap td {
          padding: 12px 10px;
          border-bottom: 1px solid #e4ebf5;
          text-align: left;
        }
        #menuMontajeSelectableBackdrop .mmsCatalogTableWrap th {
          background: #e8f0fa;
          color: #071125;
          font-weight: 900;
          text-transform: uppercase;
        }
        #menuMontajeSelectableBackdrop .mmsCatalogRowActions {
          display: flex;
          align-items: center;
          gap: 10px;
          justify-content: flex-end;
        }
        #menuMontajeSelectableBackdrop .mmsPrintPreviewLayer {
          position: fixed !important;
          inset: 0;
          z-index: 35 !important;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(15, 23, 42, .56);
        }
        #menuMontajeSelectableBackdrop .mmsPrintPreviewModal {
          width: min(1120px, 96vw);
          height: min(860px, 92vh);
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          border: 1px solid #bdd3ef;
          border-radius: 14px;
          background: #eef3fb;
          box-shadow: 0 24px 70px rgba(15, 23, 42, .3);
          overflow: hidden;
        }
        #menuMontajeSelectableBackdrop .mmsPrintPreviewHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 16px;
          border-bottom: 1px solid #d7e2f1;
          background: #ffffff;
        }
        #menuMontajeSelectableBackdrop .mmsPrintPreviewHeader h3 {
          margin: 0;
          color: #071125;
          font-size: 20px;
          font-weight: 900;
        }
        #menuMontajeSelectableBackdrop .mmsPrintPreviewHeader p {
          margin: 5px 0 0;
          color: #415574;
          font-size: 12px;
        }
        #menuMontajeSelectableBackdrop .mmsPrintPreviewActions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }
        #menuMontajeSelectableBackdrop .mmsPrintButton {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        #menuMontajeSelectableBackdrop .mmsPrintGlyph {
          width: 16px;
          height: 13px;
          display: inline-block;
          position: relative;
          border: 2px solid currentColor;
          border-radius: 3px;
        }
        #menuMontajeSelectableBackdrop .mmsPrintGlyph::before {
          content: "";
          position: absolute;
          left: 2px;
          right: 2px;
          top: -7px;
          height: 6px;
          border: 2px solid currentColor;
          border-bottom: 0;
          border-radius: 2px 2px 0 0;
          background: currentColor;
          opacity: .28;
        }
        #menuMontajeSelectableBackdrop .mmsPrintGlyph::after {
          content: "";
          position: absolute;
          left: 3px;
          right: 3px;
          bottom: -6px;
          height: 7px;
          border: 2px solid currentColor;
          border-radius: 2px;
          background: #ffffff;
        }
        #menuMontajeSelectableBackdrop .mmsPrintPreviewFrame {
          width: 100%;
          height: 100%;
          border: 0;
          background: #eef3fb;
        }
        #menuMontajeSelectableBackdrop .mmsRowActions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        #menuMontajeSelectableBackdrop .mmsTextBtn {
          border: 0;
          background: transparent;
          color: #075cca;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          padding: 4px 0;
        }
        #menuMontajeSelectableBackdrop .mmsTextBtn.danger {
          color: #991b1b;
        }
        #menuMontajeSelectableBackdrop .mmsEmptyState {
          grid-column: 1 / -1;
          padding: 22px;
          text-align: center;
          color: #64748b;
          font-size: 13px;
        }
        #menuMontajeSelectableBackdrop textarea {
          min-height: 130px !important;
          resize: vertical;
          font-family: Consolas, "Courier New", monospace;
          line-height: 1.45;
        }
        #menuMontajeSelectableBackdrop .mmsActionFooter {
          min-height: 66px;
          padding: 12px 28px;
          border-top: 1px solid #d7e2f1;
          background: rgba(255,255,255,.98);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }
        #menuMontajeSelectableBackdrop .mmsTableWrap {
          overflow: auto;
          border: 1px solid #d7e2f1;
          border-radius: 10px;
        }
        #menuMontajeSelectableBackdrop .mmsTableWrap table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        #menuMontajeSelectableBackdrop .mmsTableWrap th,
        #menuMontajeSelectableBackdrop .mmsTableWrap td {
          padding: 10px 12px;
          border-bottom: 1px solid #e4ebf5;
          text-align: left;
        }
        #menuMontajeSelectableBackdrop .mmsTableWrap th {
          background: #f3f7fc;
          color: #415574;
          font-weight: 900;
        }
        @media (max-width: 1100px) {
          #menuMontajeSelectableBackdrop .mmsShell {
            grid-template-columns: 1fr;
          }
          #menuMontajeSelectableBackdrop .mmsSidebar {
            display: none;
          }
          #menuMontajeSelectableBackdrop .mmsBuilderGrid,
          #menuMontajeSelectableBackdrop .mmsDataGrid,
          #menuMontajeSelectableBackdrop .mmsManualGrid,
          #menuMontajeSelectableBackdrop .mmsManualGrid.twoCols {
            grid-template-columns: 1fr;
          }
          #menuMontajeSelectableBackdrop .mmsToolbar {
            flex-wrap: wrap;
          }
          #menuMontajeSelectableBackdrop .mmsActionFooter {
            justify-content: stretch;
            flex-wrap: wrap;
          }
          #menuMontajeSelectableBackdrop .mmsActionFooter .mmsBtn {
            flex: 1 1 180px;
          }
        }

        /* Ajuste final del modo POS oscuro para limpiar barras laterales residuales */
        #menuMontajeSelectableBackdrop,
        #menuMontajeSelectableBackdrop .menuMontajeModal,
        #menuMontajeSelectableBackdrop .menuMontajeBody,
        #menuMontajeSelectableBackdrop .mmsReactPanel,
        #menuMontajeSelectableBackdrop .mmsShell {
          background: #060d1f !important;
        }
        #menuMontajeSelectableBackdrop .mmsReactPanel {
          padding-left: 0 !important;
          padding-right: 0 !important;
          display: block !important;
        }
        #menuMontajeSelectableBackdrop .mmsReactPanel::before,
        #menuMontajeSelectableBackdrop .mmsReactPanel::after {
          display: none !important;
          content: none !important;
          width: 0 !important;
          height: 0 !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        #menuMontajeSelectableBackdrop .mmsShell {
          grid-template-columns: minmax(0, 1fr) !important;
        }
        #menuMontajeSelectableBackdrop .mmsSidebar,
        #menuMontajeSelectableBackdrop aside.mmsSidebar {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          min-width: 0 !important;
          max-width: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
          left: -9999px !important;
        }
        #menuMontajeSelectableBackdrop .modalHeader {
          background: linear-gradient(180deg, rgba(15,23,42,.96), rgba(9,14,28,.92)) !important;
          border-bottom-color: rgba(148,163,184,.14) !important;
        }
        #menuMontajeSelectableBackdrop .modalTitle {
          color: #f8fafc !important;
        }
        #menuMontajeSelectableBackdrop .modalSubtitle {
          color: #94a3b8 !important;
        }
        
        .qp-close-btn {
          width: 36px !important;
          height: 36px !important;
          border-radius: 50% !important;
          border: none !important;
          background: transparent !important;
          color: #64748b !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s ease !important;
          padding: 0 !important;
          box-shadow: none !important;
          outline: none !important;
        }
        .qp-close-btn:hover {
          background: rgba(239, 68, 68, 0.1) !important;
          color: #ef4444 !important;
        }
        .qp-close-btn:active {
          transform: scale(0.88) !important;
        }
        .qp-close-btn svg {
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
          flex-shrink: 0;
        }
        .qp-close-btn:hover svg {
          transform: rotate(90deg) scale(1.15) !important;
        }
        
        .qp-switch-inline {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          padding: 8px 12px !important;
          border-radius: 10px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          min-height: 40px !important;
          box-sizing: border-box !important;
          width: 100% !important;
        }
        .qp-switch-inline:hover {
          background: #f8fafc !important;
          border-color: #cbd5e1 !important;
        }
        .qp-switch-inline input[type="checkbox"] {
          appearance: none !important;
          -webkit-appearance: none !important;
          display: inline-block !important;
          width: 42px !important;
          height: 24px !important;
          min-width: 42px !important;
          max-width: 42px !important;
          min-height: 24px !important;
          max-height: 24px !important;
          border-radius: 999px !important;
          background: #cbd5e1 !important;
          position: relative !important;
          outline: none !important;
          cursor: pointer !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          margin: 0 !important;
          flex-shrink: 0 !important;
          border: 1px solid #cbd5e1 !important;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05) !important;
          box-sizing: border-box !important;
          padding: 0 !important;
        }
        .qp-switch-inline input[type="checkbox"]:checked {
          background: #10b981 !important;
          border-color: #059669 !important;
        }
        .qp-switch-inline input[type="checkbox"]::after {
          content: '' !important;
          position: absolute !important;
          width: 18px !important;
          height: 18px !important;
          border-radius: 50% !important;
          top: 2px !important;
          left: 2px !important;
          background: white !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.05) !important;
          border: 0.5px solid rgba(0, 0, 0, 0.04) !important;
          box-sizing: border-box !important;
        }
        .qp-switch-inline input[type="checkbox"]:checked::after {
          transform: translateX(20px) !important;
        }
        
        @media (max-width: 768px) {
          .qp-main-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .qp-header {
            align-items: center !important;
            padding: 10px 14px !important;
          }
          .qp-floating-footer {
            position: sticky !important;
            bottom: 0 !important;
            right: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            border-top: 1px solid #cbd5e1 !important;
            padding: 12px !important;
            pointer-events: auto !important;
            margin: 0 !important;
            box-shadow: 0 -4px 10px rgba(0,0,0,0.05) !important;
          }
          .qp-floating-footer-inner {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
            width: 100% !important;
          }
          .qp-floating-footer-inner button {
            width: 100% !important;
            justify-content: center !important;
            height: 40px !important;
            font-size: 11px !important;
            margin: 0 !important;
          }
          .qp-floating-footer-inner button:last-child {
            grid-column: span 2 !important;
            height: 44px !important;
            font-size: 13px !important;
          }
          #qp-body {
            padding-bottom: 60px !important;
          }
        }
      `}</style>

      {/* ══════════ CONTENEDOR RAÍZ ══════════ */}
      <div
        id="qp-root"
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          background: '#f1f5f9',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >

        {/* ── HEADER ── */}
        <div className="qp-header" style={{ flexShrink: 0, background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>
              CRM / Reservas / Cotización
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="/Oficial_JDL_acua.png" alt="Logo" style={{ height: 28, width: 'auto' }} />
              <span style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>Cotizar evento</span>
            </div>
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginTop: 2 }}>
              {event?.name || 'Nuevo Evento'} — {quote.venue || '(sin salón)'} — {quote.eventDate || '---'}{quote.schedule ? ` — ${quote.schedule}` : ''}
            </div>
          </div>
          <button className="qp-close-btn" onClick={handleRequestClose} aria-label="Cerrar">
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
              <path d="M4 4l10 10M14 4l-10 10" />
            </svg>
          </button>
        </div>

        {/* ── BODY SCROLLABLE ── */}
        <div id="qp-body" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '14px 18px 32px' }}>

          {/* ── Barra versión + plantilla ── */}
          <div style={{ ...card, marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label style={fieldLabel}>Versión de cotización</label>
              <select style={fieldSelect} value={quote.version} onChange={e => setQuote(p => ({ ...p, version: parseInt(e.target.value) || 1 }))}>
                <option value={1}>V1 (actual) — sin fecha — Q 0.00</option>
              </select>
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label style={fieldLabel}>Plantilla contrato</label>
              <select style={fieldSelect} value={quote.templateId} onChange={e => setQuote(p => ({ ...p, templateId: e.target.value }))}>
                <option value="">— Sin plantilla —</option>
                <option value="contrato_corp">Jardines (Corporativo)</option>
                <option value="contrato_hosp">Servicios de Hospitalidad</option>
                {quickTemplates.filter(t => t.id !== 'contrato_corp' && t.id !== 'tpl-contrato-corp').map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={fieldLabel}>Moneda</label>
              <select style={fieldSelect} value={quote.currency || 'GTQ'} onChange={e => setQuote(p => ({ ...p, currency: e.target.value }))}>
                <option value="GTQ">Quetzales (Q)</option>
                <option value="USD">Dólares ($)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="qp-btn" type="button" onClick={() => setShowVersionPanel(true)}>Cargar versión</button>
              <button className="qp-btn" type="button" onClick={() => setShowDocPanel(p => !p)}>
                {showDocPanel ? 'Ocultar datos' : 'Datos empresa'}
              </button>
            </div>
          </div>

          {/* ── Panel datos empresa (colapsable) ── */}
          {showDocPanel && (
            <div style={{ ...card, marginBottom: 12 }}>
              <div className="eyebrow">Datos de la cotización</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px 24px', marginTop: 10 }}>

                {/* col 1 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* ── Campo Institución con dropdown ── */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <label style={{ ...fieldLabel, marginBottom: 0 }}>Institución</label>
                      <button
                        type="button"
                        onClick={openCreateCompanyModal}
                        style={{ 
                          minHeight: 28, 
                          padding: '0 12px', 
                          fontSize: 11, 
                          fontWeight: 900, 
                          background: '#2563eb', 
                          color: '#ffffff', 
                          borderRadius: '6px', 
                          border: 'none', 
                          boxShadow: '0 2px 4px rgba(37,99,235,0.2)', 
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'background .12s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                        onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
                      >
                        + Agregar empresa
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        style={fieldInput}
                        value={companySearchQuery}
                        onChange={e => { setCompanySearchQuery(e.target.value); setShowCompanyResults(true); }}
                        onFocus={() => setShowCompanyResults(true)}
                        onBlur={() => setTimeout(() => setShowCompanyResults(false), 200)}
                        placeholder="Buscar institución..."
                      />
                      {showCompanyResults && filteredCompanies.length > 0 && (
                        <div className="qp-company-drop">
                          {filteredCompanies.map(c => (
                            <div key={c.id} onMouseDown={e => { e.preventDefault(); handleCompanySelect(c); }}>
                              {c.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedQuoteCompany && Array.isArray(selectedQuoteCompany.managers) && selectedQuoteCompany.managers.length > 0 && (
                    <div>
                      <label style={fieldLabel}>Encargado de la empresa</label>
                      <select
                        style={fieldSelect}
                        value={quote.managerId || selectedQuoteCompany.managers[0]?.id || ''}
                        onChange={e => applyCompanyManager(selectedQuoteCompany, e.target.value)}
                      >
                        {selectedQuoteCompany.managers.map(manager => (
                          <option key={manager.id || manager.name} value={manager.id || manager.name}>
                            {manager.name || 'Encargado'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {[
                    { label: 'Contacto (Encargado de la empresa)', key: 'contact', type: 'text' },
                    { label: 'Email', key: 'email', type: 'email' },
                    { label: 'Teléfono', key: 'phone', type: 'text' },
                    { label: 'NIT', key: 'nit', type: 'text' },
                    { label: 'Facturar a', key: 'billTo', type: 'text' },
                    { label: 'Dirección', key: 'address', type: 'text' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={fieldLabel}>{f.label}</label>
                      <input 
                        style={fieldInput} 
                        type={f.type} 
                        value={quote[f.key] || ''} 
                        onChange={e => {
                          let val = e.target.value;
                          if (f.key === 'phone') {
                            val = val.replace(/\D/g, '');
                          }
                          setQuote(p => ({ ...p, [f.key]: val }));
                        }} 
                      />
                    </div>
                  ))}
                </div>

                {/* col 2 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Tipo de evento', key: 'eventType', type: 'text' },
                    { label: 'Salón / Venue', key: 'venue', type: 'text' },
                    { label: 'Horario', key: 'schedule', type: 'text' },
                    { label: 'Código', key: 'code', type: 'text' },
                    { label: 'Fecha documento', key: 'docDate', type: 'date' },
                    { label: 'No. personas', key: 'people', type: 'number' },
                    { label: 'Fecha evento', key: 'eventDate', type: 'date' },
                    { label: 'Fecha fin', key: 'endDate', type: 'date' },
                    { label: 'Fecha límite pago', key: 'dueDate', type: 'date' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={fieldLabel}>{f.label}</label>
                      <input 
                        style={fieldInput} 
                        type={f.type} 
                        value={quote[f.key] || ''} 
                        onChange={e => {
                          let val = e.target.value;
                          if (f.key === 'people') {
                            val = val.replace(/\D/g, '');
                          }
                          setQuote(p => {
                            const next = { ...p, [f.key]: val };
                            if (f.key === 'eventDate' && (p.companyId || p.companyName)) {
                              next.dueDate = calculateDueDate(val);
                            }
                            return next;
                          });
                        }} 
                      />
                    </div>
                  ))}
                </div>

              </div>
            </div>
          )}

          {/* ── Grid principal: izquierda (agregar servicios) + derecha (tabla) ── */}
          <div className="qp-main-grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12, alignItems: 'start' }}>

            {/* ════ PANEL IZQUIERDO ════ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Buscar servicio */}
              <div style={card}>
                <div className="eyebrow">Catálogo</div>
                <div className="section-title">Agregar servicio</div>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <input
                    id="quoteServiceSearchInput"
                    style={{ ...fieldInput, paddingRight: selectedCatalogService ? '30px' : '9px' }}
                    value={serviceSearch}
                    onChange={e => {
                      setServiceSearch(e.target.value);
                      if (selectedCatalogService && selectedCatalogService.name !== e.target.value) {
                        setSelectedCatalogService(null);
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (selectedCatalogService) {
                          addServiceItem(selectedCatalogService);
                        }
                      }
                    }}
                    placeholder="Buscar servicio..."
                  />
                  {selectedCatalogService && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCatalogService(null);
                        setServiceSearch('');
                      }}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: 14,
                        padding: 0
                      }}
                    >
                      ✕
                    </button>
                  )}
                  {filteredServices.length > 0 && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 200, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 7, maxHeight: 180, overflowY: 'auto', boxShadow: '0 6px 18px rgba(0,0,0,.1)' }}>
                      {filteredServices.map(s => (
                        <div
                          key={s.id}
                          onMouseDown={e => {
                            e.preventDefault();
                            setSelectedCatalogService(s);
                            setServiceSearch(s.name);
                            setTimeout(() => {
                              document.getElementById('quoteServiceQtyInput')?.focus();
                            }, 50);
                          }}
                          style={{ padding: '7px 11px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: '#334155' }}
                        >
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.category} — {moneyGT(s.price, quote.currency)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={fieldLabel}>Cantidad</label>
                    <input
                      id="quoteServiceQtyInput"
                      style={{ ...fieldInput, width: 70 }}
                      type="number"
                      min="1"
                      value={serviceQty}
                      onChange={e => setServiceQty(parseInt(e.target.value) || 1)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (selectedCatalogService) {
                            addServiceItem(selectedCatalogService);
                          }
                        }
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={fieldLabel}>Fecha servicio</label>
                    <select style={fieldSelect} value={selectedServiceDate} onChange={e => setSelectedServiceDate(e.target.value)}>
                      {availableServiceDates.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button 
                    className="qp-btn" 
                    style={{ flex: 1, background: selectedCatalogService ? '#10b981' : '#cbd5e1', color: selectedCatalogService ? '#fff' : '#64748b', cursor: selectedCatalogService ? 'pointer' : 'not-allowed' }} 
                    type="button" 
                    disabled={!selectedCatalogService}
                    onClick={() => addServiceItem(selectedCatalogService)}
                  >
                    Agregar servicio
                  </button>
                  <button className="qp-btn" style={{ flex: 1 }} type="button" onClick={() => setShowCreateServiceModal(true)}>
                    + Crear nuevo servicio
                  </button>
                </div>
              </div>
              <div style={card}>
                <div className="eyebrow">Plantillas rápidas</div>
                <div className="section-title">Aplicar plantilla</div>
                <select style={{ ...fieldSelect, marginBottom: 8 }} value={quote.templateId} onChange={e => setQuote(p => ({ ...p, templateId: e.target.value }))}>
                  <option value="">— Seleccionar —</option>
                  {quickTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button className="qp-btn" style={{ width: '100%' }} type="button" onClick={handleApplyTemplate}>
                  Aplicar plantilla
                </button>
              </div>

              {/* Resumen rápido */}
              <div style={{ ...card, background: '#f8fafc' }}>
                <div className="eyebrow">Resumen</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { label: 'Subtotal', val: totals.subtotal },
                    { label: 'Descuento', val: totals.discountAmount },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
                      <span>{r.label}</span><strong>{moneyGT(r.val, quote.currency)}</strong>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 900, color: '#0f172a', paddingTop: 4, borderTop: '1px solid #e2e8f0', marginTop: 2 }}>
                    <span>Total</span><strong>{moneyGT(totals.total, quote.currency)}</strong>
                  </div>
                </div>
              </div>

            </div>
            {/* fin panel izquierdo */}

            {/* ════ ZONA TABLA ════ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Tabla de servicios */}
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <div>
                    <div className="eyebrow">Carrito operativo</div>
                    <div className="section-title" style={{ marginBottom: 0 }}>Servicios y productos agregados</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Cantidades, precio, fecha, servicio y total.</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="qp-btn" type="button" onClick={handleDuplicateSelected}>Duplicar selección</button>
                    <button className="qp-btn" type="button" onClick={() => handleMoveSelected('up')}>↑ Subir</button>
                    <button className="qp-btn" type="button" onClick={() => handleMoveSelected('down')}>↓ Bajar</button>
                  </div>
                </div>

                {menuMontajeSummary.count > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                    padding: '10px 12px',
                    borderRadius: 9,
                    border: '1px solid #bfdbfe',
                    background: '#eff6ff'
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#1d4ed8', marginBottom: 2 }}>
                        Menu & Montaje guardado
                      </div>
                      <div style={{ fontSize: 12, color: '#334155', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        V{menuMontajeSummary.version} - {menuMontajeSummary.count} registro(s) - {menuMontajeSummary.datesLabel} - {menuMontajeSummary.salonsLabel}
                      </div>
                    </div>

                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {quote.items.length === 0 ? (
                    <div style={{ ...card, padding: '36px 16px', textAlign: 'center', background: '#ffffff' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>Tu carrito aún está vacío</div>
                      <div style={{ fontSize: 11, color: '#cbd5e1' }}>Busca un servicio en el panel izquierdo</div>
                    </div>
                  ) : (
                    availableServiceDates.map(date => {
                      const dayItems = quote.items.filter(item => item.serviceDate === date);
                      const isAllDaySelected = dayItems.length > 0 && dayItems.every(i => selectedItemIds.has(i.rowId));
                      const daySubtotal = dayItems.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);

                      return (
                        <div key={date} style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#ffffff' }}>
                          <div style={{ 
                            background: '#f8fafc', 
                            padding: '10px 14px', 
                            borderBottom: '1px solid #e2e8f0', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>📅 {date}</span>
                              <span style={{ background: '#e2e8f0', color: '#334155', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
                                {dayItems.length} {dayItems.length === 1 ? 'servicio' : 'servicios'}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 800 }}>
                              Subtotal: <span style={{ color: '#0f172a' }}>{moneyGT(daySubtotal, quote.currency)}</span>
                            </div>
                          </div>
                          
                          {dayItems.length === 0 ? (
                            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12, fontStyle: 'italic', background: '#ffffff' }}>
                              Sin servicios asignados a este día.
                            </div>
                          ) : (
                            <div style={{ overflowX: 'auto' }}>
                              <table className="qp-tbl">
                                <thead>
                                  <tr>
                                    <th style={{ width: 36 }}>
                                      <input type="checkbox"
                                        checked={isAllDaySelected}
                                        onChange={() => handleSelectAllDayToggle(date)}
                                      />
                                    </th>
                                    <th>Fecha</th>
                                    <th>Cant.</th>
                                    <th>Servicio</th>
                                    <th>Precio</th>
                                    <th>Total</th>
                                    <th style={{ width: 36 }}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dayItems.map(item => {
                                    const lineTotal = Number(item.qty || 0) * Number(item.price || 0);
                                    return (
                                      <tr key={item.rowId} className={selectedItemIds.has(item.rowId) ? 'sel' : ''}>
                                        <td style={{ textAlign: 'center' }}>
                                          <input type="checkbox" checked={selectedItemIds.has(item.rowId)} onChange={() => handleSelectRowToggle(item.rowId)} />
                                        </td>
                                        <td>
                                          <select value={item.serviceDate} onChange={e => setQuote(p => ({ ...p, items: p.items.map(i => i.rowId === item.rowId ? { ...i, serviceDate: e.target.value } : i) }))}>
                                            {availableServiceDates.map(d => <option key={d} value={d}>{d}</option>)}
                                          </select>
                                        </td>
                                        <td>
                                          <input type="number" value={item.qty} onChange={e => setQuote(p => ({ ...p, items: p.items.map(i => i.rowId === item.rowId ? { ...i, qty: parseInt(e.target.value) || 1 } : i) }))} />
                                        </td>
                                        <td>
                                          <input type="text" value={item.name} onChange={e => setQuote(p => ({ ...p, items: p.items.map(i => i.rowId === item.rowId ? { ...i, name: e.target.value } : i) }))} />
                                        </td>
                                        <td>
                                          <input type="number" value={item.price} onChange={e => setQuote(p => ({ ...p, items: p.items.map(i => i.rowId === item.rowId ? { ...i, price: parseFloat(e.target.value) || 0 } : i) }))} />
                                        </td>
                                        <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{moneyGT(lineTotal, quote.currency)}</td>
                                        <td style={{ textAlign: 'center' }}>
                                          <button onClick={() => removeServiceItem(item.rowId)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 800, padding: '2px 4px', lineHeight: 1 }}>Eliminar</button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Totales / descuento */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <label style={fieldLabel}>Descuento</label>
                      <select style={{ ...fieldSelect, width: 120 }} value={quote.discountType} onChange={e => setQuote(p => ({ ...p, discountType: e.target.value }))}>
                        <option value="AMOUNT">Monto ({quote.currency === 'USD' ? '$' : 'Q'})</option>
                        <option value="PERCENT">Porcentaje (%)</option>
                      </select>
                    </div>
                    <div>
                      <label style={fieldLabel}>Valor descuento</label>
                      <input style={{ ...fieldInput, width: 110 }} type="number" value={quote.discountValue} onChange={e => setQuote(p => ({ ...p, discountValue: parseFloat(e.target.value) || 0 }))} min="0" step="0.01" />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                      Subtotal: <strong style={{ color: '#334155' }}>{moneyGT(totals.subtotal, quote.currency)}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                      Descuento: <strong style={{ color: '#334155' }}>{moneyGT(totals.discountAmount, quote.currency)}</strong>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                      Total cotización: <span style={{ color: '#0f172a' }}>{moneyGT(totals.total, quote.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado de cuenta */}
              <div style={{ ...card, background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div className="eyebrow">Control financiero</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', margin: 0 }}>Estado de cuenta</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: '#475569' }}>Total: <strong>{moneyGT(totals.total, quote.currency)}</strong></span>
                    <span style={{ color: '#475569' }}>Abonado: <strong>{moneyGT(abonosTotal, quote.currency)}</strong></span>
                    <span style={{ color: abonosTotal >= totals.total ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      Saldo: <strong>{moneyGT(saldoPendiente, quote.currency)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Notas internas */}
              <div style={card}>
                <label style={fieldLabel}>Notas internas</label>
                <textarea
                  value={quote.internalNotes}
                  onChange={e => setQuote(p => ({ ...p, internalNotes: e.target.value }))}
                  rows={2}
                  placeholder="Observaciones internas..."
                  style={{ ...fieldInput, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

            </div>
            {/* fin zona tabla */}

          </div>
          {/* fin grid principal */}

        </div>
        {/* fin body */}

        {/* ── FOOTER FLOTANTE FIJO ── */}
        <div className="qp-floating-footer" style={{
          position: 'absolute',
          right: 20,
          bottom: 14,
          background: 'transparent',
          borderTop: 'none',
          padding: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 12,
          boxShadow: 'none',
          zIndex: 30,
          pointerEvents: 'none'
        }}>
          <div className="qp-floating-footer-inner" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', pointerEvents: 'auto' }}>
            <button
              className="qp-btn"
              type="button"
              onClick={handleOpenAdvances}
              onMouseDown={e => e.stopPropagation()}
              style={{ background: '#ecfdf5', borderColor: '#8fd8b4', color: '#0f766e', boxShadow: '0 6px 14px rgba(15,118,110,.10)' }}
            >
              Anticipos
            </button>
            <button
              className="qp-btn"
              type="button"
              onClick={handleReimprimir}
              style={{ background: '#f8f3ff', borderColor: '#c8b6ea', color: '#5b3b91', boxShadow: '0 6px 14px rgba(91,59,145,.10)' }}
            >
              Imprimir
            </button>
            <button className="qp-btn-primary" type="button" onClick={handleSaveQuote} style={{ boxShadow: '0 8px 18px rgba(15,23,42,.18)' }}>Guardar cotización</button>
          </div>
        </div>

      </div>
      {/* fin qp-root */}



      {/* ── Modal: Cargar versión ── */}
      {showCreateCompanyModal && (
        <div id="companyCreateBackdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'auto' }}>
          <div style={{ background: '#f6f9fd', borderRadius: 16, border: '1px solid #bcd0e8', boxShadow: '0 24px 60px rgba(15,23,42,.28)', width: 'min(1180px, 98vw)', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #cbdced', background: '#ffffff', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>{companyDraftId ? 'Editar empresa' : 'Nueva empresa'}</div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>Se usara en cotizacion</div>
              </div>
              <button className="qp-close-btn" type="button" onClick={resetCreateCompanyModal} aria-label="Cerrar">
                <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                  <path d="M4 4l10 10M14 4l-10 10" />
                </svg>
              </button>
            </div>

            <div style={{ padding: 18, overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))', gap: '10px 24px' }}>
                <label style={fieldLabel}>Empresa existente
                  <select style={fieldSelect} value={companyDraftId} onChange={e => handleCompanyDraftSelect(e.target.value)}>
                    <option value="">Crear nueva empresa</option>
                    {companies.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es')).map(company => (
                      <option key={company.id} value={company.id}>{company.name || 'Empresa'}</option>
                    ))}
                  </select>
                </label>
                <div style={fieldLabel}>Estado
                  <label className="qp-switch-inline" style={{ color: '#334155', fontSize: 12, fontWeight: 800, textTransform: 'none', letterSpacing: 0 }}>
                    <input type="checkbox" checked={companyDraftActive} onChange={e => setCompanyDraftActive(e.target.checked)} />
                    <span>Empresa activa</span>
                  </label>
                </div>
                <label style={fieldLabel}>Nombre de la Organizacion<input style={fieldInput} value={companyDraft.name} onChange={e => setCompanyDraft(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Eventos del Lago" /></label>
                <label style={fieldLabel}>Encargado de la Organizacion<input style={fieldInput} value={companyDraft.owner} onChange={e => setCompanyDraft(p => ({ ...p, owner: e.target.value }))} placeholder="Nombre del encargado principal" /></label>
                <label style={fieldLabel}>Correo<input style={fieldInput} type="email" value={companyDraft.email} onChange={e => setCompanyDraft(p => ({ ...p, email: e.target.value }))} placeholder="correo@empresa.com" /></label>
                <label style={fieldLabel}>NIT<input style={fieldInput} value={companyDraft.nit} onChange={e => setCompanyDraft(p => ({ ...p, nit: e.target.value }))} placeholder="NIT" /></label>
                <label style={fieldLabel}>Facturar A<input style={fieldInput} value={companyDraft.businessName} onChange={e => setCompanyDraft(p => ({ ...p, businessName: e.target.value }))} placeholder="Nombre para facturacion" /></label>
                <label style={fieldLabel}>Tipo Evento
                  <select style={fieldSelect} value={companyDraft.eventType} onChange={e => setCompanyDraft(p => ({ ...p, eventType: e.target.value }))}>
                    <option value="">Selecciona tipo</option>
                    <option value="Social">Social</option>
                    <option value="Corporativo">Corporativo</option>
                    <option value="Individual">Individual</option>
                  </select>
                </label>
                <label style={fieldLabel}>Direccion<input style={fieldInput} value={companyDraft.address} onChange={e => setCompanyDraft(p => ({ ...p, address: e.target.value }))} placeholder="Direccion" /></label>
                <label style={fieldLabel}>Telefono<input style={fieldInput} value={companyDraft.phone} onChange={e => setCompanyDraft(p => ({ ...p, phone: e.target.value.replace(/\D/g, '') }))} placeholder="Telefono" /></label>
                <label style={{ ...fieldLabel, gridColumn: '1 / -1' }}>Observacion<textarea style={{ ...fieldInput, height: 58, paddingTop: 10, resize: 'vertical' }} value={companyDraft.notes} onChange={e => setCompanyDraft(p => ({ ...p, notes: e.target.value }))} placeholder="Alguna observacion" /></label>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={fieldLabel}>Record de la empresa</label>
                <div className="quoteTableWrap" style={{ maxHeight: 90 }}>
                  <table className="quoteTable">
                    <thead><tr><th>Codigo</th><th>Versiones</th><th>Fecha</th><th>Evento</th><th>Estado</th><th>Total</th></tr></thead>
                    <tbody><tr><td colSpan={6}>Sin movimientos registrados para esta empresa.</td></tr></tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={fieldLabel}>Encargados de la empresa</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: 8 }}>
                  <input style={fieldInput} value={managerDraft.name} onChange={e => setManagerDraft(p => ({ ...p, name: e.target.value }))} placeholder="Nombre del encargado" />
                  <input style={fieldInput} value={managerDraft.phone} onChange={e => setManagerDraft(p => ({ ...p, phone: e.target.value.replace(/\D/g, '') }))} placeholder="Telefono" />
                  <input style={fieldInput} type="email" value={managerDraft.email} onChange={e => setManagerDraft(p => ({ ...p, email: e.target.value }))} placeholder="Correo" />
                  <input style={fieldInput} value={managerDraft.address} onChange={e => setManagerDraft(p => ({ ...p, address: e.target.value }))} placeholder="Direccion (opcional)" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button className="qp-btn" type="button" onClick={handleAddOrUpdateManagerDraft}>{editingManagerId ? 'Actualizar encargado' : '+ Encargado'}</button>
                </div>
                <div className="quoteTableWrap" style={{ marginTop: 8, maxHeight: 180 }}>
                  <table className="quoteTable">
                    <thead><tr><th>Nombre</th><th>Telefono</th><th>Correo</th><th>Direccion</th><th></th></tr></thead>
                    <tbody>
                      {!companyManagersDraft.length && <tr><td colSpan={5}>Sin encargados agregados.</td></tr>}
                      {companyManagersDraft.map(manager => (
                        <tr key={manager.id || manager.name}>
                          <td>{manager.name}</td>
                          <td>{manager.phone}</td>
                          <td>{manager.email}</td>
                          <td>{manager.address}</td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                            <button className="qp-btn" type="button" style={{ minHeight: 28, padding: '0 8px', marginRight: 4 }} onClick={() => handleEditManagerDraft(manager)}>Editar</button>
                            <button className="qp-btn" type="button" style={{ minHeight: 28, padding: '0 8px', color: '#b91c1c', borderColor: '#fecaca', background: '#fff1f2' }} onClick={() => handleRemoveManagerDraft(manager.id)}>Quitar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 18px', borderTop: '1px solid #cbdced', background: '#f8fbff', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button className="qp-btn" type="button" disabled={!companyDraftId} onClick={() => setCompanyDraftActive(prev => !prev)}>{companyDraftActive ? 'Inhabilitar' : 'Reactivar'}</button>
              <button className="qp-btn-primary" type="button" disabled={creatingCompany} onClick={handleCreateCompany}>{creatingCompany ? 'Guardando...' : 'Guardar empresa'}</button>
            </div>
          </div>
        </div>
      )}

      {showVersionPanel && (
        <div id="versionPanelBackdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, width: '90%', maxWidth: 400, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: '#0f172a' }}>Cargar versión de cotización</div>
            {quote.versions?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {quote.versions.map((v, idx) => (
                  <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, cursor: 'pointer' }}
                    onClick={() => handleLoadVersion(v)}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Versión {v.version || idx + 1}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{v.savedAt || 'Sin fecha'} — {v.items?.length || 0} items</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>Total: {moneyGT(v.total || 0, v.currency || quote.currency)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', padding: 20 }}>No hay versiones guardadas</div>
            )}
            <button className="qp-btn" style={{ marginTop: 12, width: '100%' }} onClick={() => setShowVersionPanel(false)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* Modal: Crear servicio */}
      {showCreateServiceModal && (
        <div id="serviceCreateBackdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'auto' }}>
          <div style={{ background: '#f6f9fd', borderRadius: 16, border: '1px solid #bcd0e8', boxShadow: '0 24px 60px rgba(15,23,42,.28)', width: 'min(900px, 96vw)', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #cbdced', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div><div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>Nuevo servicio</div><div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>Se agregara al catalogo de cotizacion</div></div>
              <button className="qp-close-btn" type="button" onClick={() => { setShowCreateServiceModal(false); resetServiceDraft(); }} aria-label="Cerrar">
                <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                  <path d="M4 4l10 10M14 4l-10 10" />
                </svg>
              </button>
            </div>
            <div style={{ padding: 18, overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(240px, 1fr))', gap: '10px 14px' }}>
                <label style={fieldLabel}>Servicio existente<select style={fieldSelect} value={serviceDraft.id} onChange={e => { const service = catalogServices.find(item => String(item.id || '') === String(e.target.value || '')); if (service) handleEditServiceDraft(service); else resetServiceDraft(); }}><option value="">Crear nuevo servicio</option>{catalogServices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
                <div style={fieldLabel}>Estado<label className="qp-switch-inline" style={{ color: '#334155', fontSize: 12, fontWeight: 800, textTransform: 'none', letterSpacing: 0 }}><input type="checkbox" checked={serviceDraft.active} onChange={e => setServiceDraft(p => ({ ...p, active: e.target.checked }))} /><span>Servicio activo</span></label></div>
                <label style={fieldLabel}>Nombre del servicio<input style={fieldInput} value={serviceDraft.name} onChange={e => setServiceDraft(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Catering premium" /></label>
                <label style={fieldLabel}>Precio base<input style={fieldInput} type="number" min="0" step="0.01" value={serviceDraft.price} onChange={e => setServiceDraft(p => ({ ...p, price: e.target.value }))} placeholder="Ej: 150.00" /></label>
                <label style={fieldLabel}>Categoria<input list="quoteServiceCategories" style={fieldInput} value={serviceDraft.category} onChange={e => setServiceDraft(p => ({ ...p, category: e.target.value, subcategory: '' }))} placeholder="Ej: Alimentos & Bebidas" /><datalist id="quoteServiceCategories">{serviceCategories.map(category => <option key={category} value={category} />)}</datalist></label>
                <label style={fieldLabel}>Subcategoria<input list="quoteServiceSubcategories" style={fieldInput} value={serviceDraft.subcategory} onChange={e => setServiceDraft(p => ({ ...p, subcategory: e.target.value }))} placeholder="Seleccione subcategoria" /><datalist id="quoteServiceSubcategories">{serviceSubcategories.map(subcategory => <option key={subcategory} value={subcategory} />)}</datalist></label>
                <label style={{ ...fieldLabel, gridColumn: '1 / -1' }}>Modo de cantidad<select style={fieldSelect} value={serviceDraft.quantityMode} onChange={e => setServiceDraft(p => ({ ...p, quantityMode: e.target.value }))}><option value="MANUAL">MANUAL (cantidad editable)</option><option value="PAX">PAX (calculado por no. de personas)</option></select></label>
                <label style={{ ...fieldLabel, gridColumn: '1 / -1' }}>Descripcion<textarea style={{ ...fieldInput, height: 58, paddingTop: 10, resize: 'vertical' }} value={serviceDraft.description} onChange={e => setServiceDraft(p => ({ ...p, description: e.target.value }))} placeholder="Descripcion del servicio" /></label>
              </div>
              <div style={{ marginTop: 12 }}><label style={fieldLabel}>Servicios registrados</label><div className="quoteTableWrap" style={{ maxHeight: 260 }}><table className="quoteTable"><thead><tr><th>Servicio</th><th>Categoria</th><th>Subcategoria</th><th>Precio</th><th>Estado</th><th></th></tr></thead><tbody>{catalogServices.map(service => (<tr key={service.id}><td>{service.name}</td><td>{service.category || '-'}</td><td>{service.subcategory || '-'}</td><td>{Number(service.price || 0).toFixed(2)}</td><td>{service.active === false ? 'Inactivo' : 'Activo'}</td><td style={{ textAlign: 'right' }}><button className="qp-btn" type="button" style={{ minHeight: 28, padding: '0 10px' }} onClick={() => handleEditServiceDraft(service)}>Editar</button></td></tr>))}{!catalogServices.length && <tr><td colSpan={6}>Sin servicios registrados.</td></tr>}</tbody></table></div></div>
            </div>
            <div style={{ padding: '14px 18px', borderTop: '1px solid #cbdced', background: '#f8fbff', display: 'flex', justifyContent: 'space-between', gap: 8 }}><button className="qp-btn" type="button" disabled={!serviceDraft.id} onClick={handleToggleServiceActive}>{serviceDraft.active ? 'Inhabilitar' : 'Reactivar'}</button><div style={{ display: 'flex', gap: 8 }}><button className="qp-btn" type="button" onClick={() => { setShowCreateServiceModal(false); resetServiceDraft(); }}>Cancelar</button><button className="qp-btn-primary" type="button" onClick={handleSaveServiceDraft}>Guardar servicio</button></div></div>
          </div>
        </div>
      )}

      {/* ── Modal: Anticipos ── */}
      {showAdvancesModal && createPortal(
        <div
          className="modalBackdrop"
          id="quoteAdvanceBackdrop"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(2,6,23,0.72)',
            overflow: 'auto'
          }}
        >
          <div className="modal quoteAdvanceModal" role="dialog" aria-modal="true" aria-labelledby="quoteAdvanceTitle">
            <div className="modalHeader">
              <div>
                <div className="modalTitle" id="quoteAdvanceTitle">Anticipos</div>
                <div className="modalSubtitle">Registra pagos anticipados para restar saldo del evento</div>
              </div>
              <button className="qp-close-btn" type="button" title="Cerrar" onClick={() => { resetAdvanceForm(); setShowAdvancesModal(false); }}>
                <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                  <path d="M4 4l10 10M14 4l-10 10" />
                </svg>
              </button>
            </div>

            <div className="modalBody quoteAdvanceBody">
              <div className="quoteAdvanceFormGrid">
                <label className="field quoteAdvanceField--amount">
                  <span>Monto</span>
                  <input id="quoteAdvanceAmount" type="number" min="0" step="0.01" value={newAdvance.amount} onChange={e => setNewAdvance(p => ({ ...p, amount: e.target.value }))} placeholder="Ej: 1500.00" />
                </label>
                <label className="field quoteAdvanceField--type">
                  <span>Forma de pago</span>
                  <select value={newAdvance.paymentType} onChange={e => setNewAdvance(p => ({ ...p, paymentType: e.target.value }))}>
                    <option value="Credito">Credito</option>
                    <option value="Deposito">Deposito</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta</option>
                  </select>
                </label>
                <label className="field quoteAdvanceField--date">
                  <span>Fecha</span>
                  <input type="date" value={newAdvance.date} onChange={e => setNewAdvance(p => ({ ...p, date: e.target.value }))} />
                </label>
                <label className="field quoteAdvanceField--voucher">
                  <span>No. boleta</span>
                  <input type="text" value={newAdvance.voucherNumber} onChange={e => setNewAdvance(p => ({ ...p, voucherNumber: e.target.value }))} placeholder="Ej: BOL-000123" />
                </label>
                <label className="field quoteAdvanceDescriptionField">
                  <span>Descripcion</span>
                  <input type="text" value={newAdvance.description} onChange={e => setNewAdvance(p => ({ ...p, description: e.target.value }))} placeholder="Detalle del anticipo" />
                </label>
                <label className="field quoteAdvanceField--evidence">
                  <span>Evidencia (archivo)</span>
                  <input
                    key={advanceEvidenceInputKey}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => {
                      const file = e.target.files?.[0] || null;
                      setAdvanceEvidenceFile(file);
                      setNewAdvance(p => ({ ...p, evidenceName: file?.name || p.evidenceName }));
                    }}
                  />
                  <small id="quoteAdvanceEvidenceHint" className="fieldHint">
                    {advanceEvidenceFile ? `Archivo seleccionado: ${advanceEvidenceFile.name}` : (newAdvance.evidenceName ? `Archivo actual: ${newAdvance.evidenceName}` : 'Sin archivo adjunto')}
                  </small>
                </label>
                <div className="rightActions quoteAdvanceAddAction">
                  <button className="btnPrimary" type="button" onClick={handleSaveAdvanceEntry}>{advanceEditingId ? 'Guardar cambios' : 'Agregar anticipo'}</button>
                  <button className="btn" type="button" onClick={resetAdvanceForm}>Limpiar formulario</button>
                </div>
              </div>

              <div className="quoteAdvanceSummary">
                <div className="quoteAdvanceMetric quoteAdvanceMetric--total">
                  <span>Total anticipos</span>
                  <strong>{moneyGT(abonosTotal, quote.currency)}</strong>
                </div>
                <div className="quoteAdvanceMetric quoteAdvanceMetric--pending">
                  <span>Saldo pendiente</span>
                  <strong>{moneyGT(saldoPendiente, quote.currency)}</strong>
                </div>
                <div className="quoteAdvanceMetric quoteAdvanceMetric--credit">
                  <span>Saldo a favor</span>
                  <strong>{moneyGT(Math.max(0, abonosTotal - totals.total), quote.currency)}</strong>
                </div>
              </div>

              <div className="quoteTableWrap quoteAdvanceTableWrap">
                <div className="quoteAdvanceLedgerHead">
                  <span>Fecha</span>
                  <span>Tipo</span>
                  <span>No. boleta</span>
                  <span>Descripcion</span>
                  <span>Monto</span>
                  <span>Evidencia</span>
                  <span>Acciones</span>
                </div>
                <div className="quoteAdvanceLedgerBody">
                  {advanceRows.length > 0 ? advanceRows.map(adv => (
                    <div className={`quoteAdvanceLedgerRow${String(adv.id) === String(advanceEditingId) ? ' isEditing' : ''}`} key={adv.id}>
                      <div className="quoteAdvanceLedgerCell"><span className="quoteAdvanceLedgerLabel">Fecha</span><span>{adv.date || '-'}</span></div>
                      <div className="quoteAdvanceLedgerCell"><span className="quoteAdvanceLedgerLabel">Tipo</span><span>{adv.paymentType || '-'}</span></div>
                      <div className="quoteAdvanceLedgerCell"><span className="quoteAdvanceLedgerLabel">No. boleta</span><span>{adv.voucherNumber || '-'}</span></div>
                      <div className="quoteAdvanceLedgerCell"><span className="quoteAdvanceLedgerLabel">Descripcion</span><span>{adv.description || '-'}</span></div>
                      <div className="quoteAdvanceLedgerCell"><span className="quoteAdvanceLedgerLabel">Monto</span><strong>{moneyGT(adv.amount, quote.currency)}</strong></div>
                      <div className="quoteAdvanceLedgerCell quoteAdvanceLedgerCell--evidence">
                        <span className="quoteAdvanceLedgerLabel">Evidencia</span>
                        {adv.evidenceDataUrl ? (
                          <a className="btn quoteAdvanceEvidenceLink" href={adv.evidenceDataUrl} download={adv.evidenceName || `evidencia_${adv.id}.pdf`} target="_blank" rel="noopener noreferrer">Ver</a>
                        ) : (
                          <span className="quoteAdvanceLedgerMuted">{adv.evidenceName || '-'}</span>
                        )}
                      </div>
                      <div className="quoteAdvanceLedgerCell quoteAdvanceLedgerCell--actions">
                        <span className="quoteAdvanceLedgerLabel">Acciones</span>
                        <div className="appointmentActions">
                          <button className="apptIconBtn apptEdit" type="button" onClick={() => handleStartEditAdvance(adv.id)}>Editar</button>
                          <button className="apptIconBtn apptDelete" type="button" onClick={() => handleDeleteAdvanceEntry(adv.id)}>Eliminar</button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="quoteAdvanceLedgerEmpty">Sin anticipos registrados.</div>
                  )}
                </div>
              </div>

              <div className="quoteAdvanceLogCard">
                <div className="quoteCardTitle">Log de pagos y movimientos</div>
                <div className="quoteTableWrap quoteAdvanceLogWrap">
                  <table className="quoteTable">
                    <thead>
                      <tr>
                        <th>Fecha/Hora</th>
                        <th>Usuario</th>
                        <th>Movimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {advanceLogRows.length > 0 ? advanceLogRows.map(log => (
                        <tr className={`quoteAdvanceLogRow quoteAdvanceLogRow--${log.tone || 'added'}`} key={log.id}>
                          <td>{log.at ? new Date(log.at).toLocaleString('es-GT') : '-'}</td>
                          <td>{log.actorName || 'Sistema'}</td>
                          <td>
                            <span className="quoteAdvanceLogEntry">
                              <span className={`quoteAdvanceLogTag quoteAdvanceLogTag--${log.tone || 'added'}`}>{log.label || 'Agregado'}</span>
                              <span>{log.change || '-'}</span>
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr className="quoteAdvanceLogEmptyRow">
                          <td colSpan={3}>Sin movimientos de pagos registrados.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="modalFooter">
              <div></div>
              <div className="rightActions">
                <button className="btn" id="btnQuoteAdvanceDone" type="button" onClick={() => { resetAdvanceForm(); setShowAdvancesModal(false); }}>Listo</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </>
  );
}


