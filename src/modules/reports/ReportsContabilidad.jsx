import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Swal from 'sweetalert2';
import { loadState as loadCrmState } from '../../services/stateService';
import { STATUS_META } from '../calendar/constants';

export default function ReportsContabilidad({ onClose }) {
  const { events, users } = useOutletContext();
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
  const [activeStatementAccount, setActiveStatementAccount] = useState(null);

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
    return () => { active = false; };
  }, []);

  // Utility to format money in GTQ
  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(amount || 0);
  };

  // 1. Utilidades para agrupar series de eventos y consolidar metadatos
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

  // 2. Payments & advances normalization
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
        createdAt: String(item?.createdAt || '')
      };
    }).filter(item => item.amount >= 0);
  };

  // 3. Collection state evaluation helpers
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

  // 4. Build deduplicated financial events list
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
        id: ev.id,
        actionEventId: primaryEvent?.id || ev?.id,
        companyId,
        companyName,
        refId: quote?.code || reservationKey || primaryEvent?.id || ev?.id || '',
        name: primaryEvent?.name || ev?.name || '',
        eventDate: financialMeta.startDate || primaryEvent?.date || ev?.date || '',
        endDate: financialMeta.endDate || financialMeta.startDate || ev?.date || '',
        startTime: financialMeta.startTime || primaryEvent?.startTime || ev?.startTime || '',
        endTime: financialMeta.endTime || primaryEvent?.endTime || ev?.endTime || '',
        salon: financialMeta.mainSalon || primaryEvent?.salon || ev?.salon || '',
        salones: financialMeta.salones,
        salonesLabel: financialMeta.salones.join(', '),
        status: primaryEvent?.status || ev?.status || '',
        userId: primaryEvent?.userId || ev?.userId,
        userName: assignedUser?.fullName || assignedUser?.name || 'Sin asignar',
        seller: assignedUser?.fullName || assignedUser?.name || 'Sin asignar',
        clientName: ev.clientName || quote?.companyName || quote?.contact || '',
        manager: quote?.contact || matchedCompany?.owner || '',
        managerPhone: quote?.phone || matchedCompany?.phone || '',
        pax: Number(primaryEvent?.pax || ev?.pax || quote?.people || 0),
        quote: quote,
        dueDate: quote?.dueDate || '',
        docDate: quote?.docDate || '',
        paymentType: quote?.paymentType || '',
        subtotal: quote?.subtotal || 0,
        total: total,
        discount: quote?.discountValue || 0,
        advances: advancesSorted,
        advancesCount: advancesSorted.length,
        advancesTotal,
        balancePending: Math.max(0, delta),
        creditBalance: Math.max(0, -delta),
        lastAdvanceDate: lastAdvance?.date ? String(lastAdvance.date) : '',
        lastAdvancePaymentType: lastAdvance?.paymentType ? String(lastAdvance.paymentType) : '',
        lastAdvanceDescription: lastAdvance?.description ? String(lastAdvance.description) : '',
        catBuckets: quote?.catBuckets || { alimentosBebidas: { amount: 0 }, hospedajeJdl: { amount: 0 }, hospedajeTerceros: { amount: 0 }, miscelaneos: { amount: 0 } },
        statusColor: STATUS_META[primaryEvent?.status || ev?.status]?.color || '#64748b'
      });
    }

    return rows;
  }, [events, users, companies]);

  // 5. Apply filters reactively
  const filteredData = useMemo(() => {
    let filtered = reportData;

    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(r => 
        r.name?.toLowerCase().includes(term) ||
        r.clientName?.toLowerCase().includes(term) ||
        r.salon?.toLowerCase().includes(term) ||
        r.userName?.toLowerCase().includes(term) ||
        r.refId?.toLowerCase().includes(term) ||
        r.companyName?.toLowerCase().includes(term)
      );
    }

    if (dateFrom) {
      filtered = filtered.filter(r => r.eventDate >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(r => r.eventDate <= dateTo);
    }

    if (userFilter !== 'all') {
      filtered = filtered.filter(r => String(r.userId || '') === String(userFilter));
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (salonFilter !== 'all') {
      filtered = filtered.filter(r => r.salon === salonFilter || r.salones?.includes(salonFilter));
    }

    if (companyFilter !== 'all') {
      filtered = filtered.filter(r => String(r.companyId || '') === String(companyFilter));
    }

    return filtered;
  }, [reportData, search, dateFrom, dateTo, userFilter, statusFilter, salonFilter, companyFilter]);

  // 6. Group filtered events into company portfolio accounts
  const getAccountingCompanyAccounts = (rowsList = []) => {
    const sourceRows = Array.isArray(rowsList) ? rowsList : [];
    const groups = new Map();
    
    for (const row of sourceRows) {
      const key = String(row?.companyId || row?.companyName || row?.refId || row?.id || `sin_empresa_${groups.size + 1}`);
      const account = groups.get(key) || {
        key,
        companyId: String(row?.companyId || ""),
        companyName: String(row?.companyName || "Sin institucion").trim() || "Sin institucion",
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
      const actionRow = pickActionRow(account.rows);
      return {
        ...account,
        primarySeller: sellerEntry?.[0] || "",
        collectionLabel: collection.label,
        collectionTone: collection.tone,
        collectionEta: collection.eta,
        collectionDueLabel: collection.dueLabel,
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

  const accounts = useMemo(() => {
    return getAccountingCompanyAccounts(filteredData);
  }, [filteredData]);

  // 7. Calculate overall financial metrics reactively
  const summary = useMemo(() => {
    const discountAmount = filteredData.reduce((acc, row) => acc + Math.max(0, Number(row?.discount || 0)), 0);
    const netAmount = filteredData.reduce((acc, row) => acc + Math.max(0, Number(row?.total || 0)), 0);
    const collectedAmount = filteredData.reduce((acc, row) => acc + Math.max(0, Number(row?.advancesTotal || 0)), 0);
    const pendingAmount = filteredData.reduce((acc, row) => acc + Math.max(0, Number(row?.balancePending || 0)), 0);
    const creditAmount = filteredData.reduce((acc, row) => acc + Math.max(0, Number(row?.creditBalance || 0)), 0);
    const overdueCount = accounts.filter((account) => account.collectionTone === "overdue").length;
    const nextCollection = accounts.find((account) => account.nextDueDate);
    
    return {
      discountAmount,
      netAmount,
      collectedAmount,
      pendingAmount,
      creditAmount,
      overdueCount,
      nextCollection
    };
  }, [filteredData, accounts]);

  // 8. Build detailed ledger entries for details dropdown and printable statement
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
      const salonContext = [
        mainSalon ? `Salon principal: ${mainSalon}` : "",
        otherSalones.length ? `Salones del evento: ${otherSalones.join(", ")}` : "",
      ].filter(Boolean).join(" | ");
      if (total > 0) {
        entries.push({
          date: baseDate,
          type: "Cargo",
          eventId,
          refId: ref,
          concept: `Cotizacion ${ref}${company ? ` | ${company}` : ""}${salonContext ? ` | ${salonContext}` : ""}`,
          debit: total,
          credit: 0,
          sortBucket: 0,
        });
      }
      const advances = Array.isArray(row?.advances) ? row.advances : [];
      for (const adv of advances) {
        const amount = Math.max(0, Number(adv?.amount || 0));
        if (amount <= 0) continue;
        const advDate = String(adv?.date || baseDate || "").trim();
        const paymentType = String(adv?.paymentType || "").trim();
        const description = String(adv?.description || "").trim();
        const notes = [paymentType, description].filter(Boolean).join(" | ");
        entries.push({
          date: advDate,
          type: "Abono",
          eventId,
          refId: ref,
          concept: `${notes || `Pago aplicado a ${ref}`}${salonContext ? ` | ${salonContext}` : ""}`,
          debit: 0,
          credit: amount,
          sortBucket: 1,
        });
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
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 9. Alert for quote/payment action on other views
  const handleActionClick = (_actionName, eventId) => {
    if (!eventId) {
      Swal.fire('Sin evento relacionado', 'No se encontro un evento para abrir esta cotizacion.', 'info');
      return;
    }
    onClose?.();
    navigate(`/reserva/${eventId}`);
    return;
  };

  // 10. Excel download matching institutional accounts
  const handleExportExcel = () => {
    if (!accounts.length) {
      Swal.fire('Error', 'No hay datos para exportar.', 'error');
      return;
    }
    
    const csvRows = [
      '\ufeff' + [
        'INDICADOR',
        'INSTITUCION',
        'TELEFONO',
        'VENDEDOR PRINCIPAL',
        'EVENTOS',
        'PENDIENTES',
        'VENTA NETA',
        'COBRADO',
        'SALDO PENDIENTE',
        'SALDO A FAVOR',
        'FECHA MAXIMA PAGO',
        'TIEMPO SUGERIDO COBRO',
        'ULTIMO DEPOSITO'
      ].join(','),
      ...accounts.map(acc => [
        `"${acc.collectionLabel || ''}"`,
        `"${acc.companyName || ''}"`,
        `"${acc.contactPhone || ''}"`,
        `"${acc.primarySeller || ''}"`,
        acc.eventsCount || 0,
        acc.pendingEventsCount || 0,
        acc.netAmount || 0,
        acc.collectedAmount || 0,
        acc.pendingAmount || 0,
        acc.creditAmount || 0,
        `"${acc.collectionDueLabel || ''}"`,
        `"${acc.collectionEta || ''}"`,
        `"${acc.lastAdvanceDate || ''}"`
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `estado_cuenta_contable_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setUserFilter('all');
    setStatusFilter('all');
    setSalonFilter('all');
    setCompanyFilter('all');
  };

  // 11. Extract unique salon filters
  const allSalones = useMemo(() => {
    if (!events) return [];
    return [...new Set(events.map(e => e.salon).filter(Boolean))].sort();
  }, [events]);

  const allStatuses = [
    'Pre reserva',
    'Reserva sin Cotizacion',
    '1er Cotizacion',
    'Seguimiento',
    'Lista de Espera',
    'Confirmado',
    'Cancelado',
    'Mantenimiento',
    'Perdido',
    'Realizado'
  ];

  return (
    <div className="modalBackdrop" id="accountingReportBackdrop" onClick={(e) => { if (e.target.id === 'accountingReportBackdrop') onClose(); }}>
      <style>{`
        #accountingReportBackdrop .salesReportModal {
          width: min(1280px, calc(100vw - 32px)) !important;
          height: 92vh !important;
          max-height: 92vh !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.4) !important;
          border-radius: 16px !important;
        }
        #accountingReportBackdrop .salesReportHeader {
          min-height: 86px !important;
          padding: 14px 20px !important;
          align-items: center !important;
        }
        #accountingReportBackdrop .reportBrandHeader {
          gap: 12px !important;
          align-items: center !important;
        }
        #accountingReportBackdrop .salesReportBrandBadge {
          width: 52px !important;
          height: 52px !important;
          border-radius: 14px !important;
        }
        #accountingReportBackdrop .salesReportBrandLogo {
          width: 38px !important;
          height: 38px !important;
        }
        #accountingReportBackdrop #accountingReportTitle {
          font-size: 27px !important;
          line-height: 1.04 !important;
          letter-spacing: -0.02em !important;
        }
        #accountingReportBackdrop #accountingReportSubtitle,
        #accountingReportBackdrop .reportBrandEyebrow {
          font-size: 12px !important;
        }
        #accountingReportBackdrop .salesReportBody {
          flex: 1 !important;
          padding: 14px 24px 16px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 14px !important;
          overflow-y: auto !important;
        }
        #accountingReportBackdrop .salesReportHeroPanel {
          padding: 12px 18px !important;
          margin-bottom: 0 !important;
          border-radius: 16px !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
        }
        #accountingReportBackdrop .reportSectionIntro {
          margin-bottom: 10px !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-start !important;
        }
        #accountingReportBackdrop .reportSectionEyebrow {
          font-size: 9px !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          color: #64748b !important;
          letter-spacing: 0.05em !important;
        }
        #accountingReportBackdrop .reportSectionTitle {
          font-size: 15px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          margin-top: 2px !important;
        }
        #accountingReportBackdrop .reportSectionText {
          font-size: 11px !important;
          color: #64748b !important;
          margin-top: 2px !important;
        }
        #accountingReportBackdrop .reportFilterMeta {
          font-size: 11px !important;
          font-weight: 700 !important;
          color: #1e3a5f !important;
          background: #e0f2fe !important;
          padding: 4px 10px !important;
          border-radius: 999px !important;
        }
        #accountingReportBackdrop .salesReportSummary {
          display: grid !important;
          grid-template-columns: repeat(4, 1fr) !important;
          gap: 10px !important;
        }
        #accountingReportBackdrop .salesSummaryCard {
          min-height: 74px !important;
          padding: 8px 12px !important;
          gap: 2px !important;
          border-radius: 10px !important;
          border: 1px solid #cbd5e1 !important;
        }
        #accountingReportBackdrop .salesSummaryCard strong {
          font-size: 1.4rem !important;
          font-weight: 800 !important;
        }
        #accountingReportBackdrop .salesSummaryCard small {
          font-size: 10.5px !important;
          font-weight: 700 !important;
        }
        #accountingReportBackdrop .salesSummaryEyebrow {
          font-size: 9px !important;
          font-weight: 800 !important;
        }
        #accountingReportBackdrop .salesSummaryMeta {
          padding: 2px 8px !important;
          font-size: 9.5px !important;
          margin-top: 4px !important;
          font-weight: 700 !important;
        }
        #accountingReportBackdrop .salesReportFiltersInline {
          grid-template-columns: repeat(7, 1fr) !important;
          gap: 8px !important;
          padding: 12px 16px !important;
          background: #f8fafc !important;
          border-radius: 12px !important;
          border: 1px solid #cbd5e1 !important;
          align-items: flex-end !important;
        }
        #accountingReportBackdrop .salesReportFiltersInline .field {
          margin-bottom: 0 !important;
          display: flex !important;
          flex-direction: column !important;
        }
        #accountingReportBackdrop .salesReportFiltersInline .field span {
          font-size: 10px !important;
          font-weight: 700 !important;
          color: #475569 !important;
          margin-bottom: 4px !important;
          text-transform: uppercase !important;
        }
        #accountingReportBackdrop .salesReportFiltersInline input,
        #accountingReportBackdrop .salesReportFiltersInline select {
          padding: 6px 8px !important;
          font-size: 12px !important;
          height: 32px !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-weight: 600 !important;
        }
        #accountingReportBackdrop .salesReportActions {
          grid-column: span 7 !important;
          margin-top: 6px !important;
          display: flex !important;
          gap: 8px !important;
          justify-content: flex-end !important;
        }
        #accountingReportBackdrop .salesReportActions button {
          height: 32px !important;
          padding: 0 16px !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          border-radius: 6px !important;
        }
        #accountingReportBackdrop .salesReportTableWrap {
          margin-top: 4px !important;
          border-radius: 12px !important;
          border: 1px solid #cbd5e1 !important;
        }
        #accountingReportBackdrop .quoteTable thead th {
          padding: 8px 10px !important;
          font-size: 10.5px !important;
          font-weight: 800 !important;
        }
        #accountingReportBackdrop .quoteTable tbody td {
          padding: 8px 10px !important;
          font-size: 12px !important;
        }
        #accountingReportBackdrop .salesReportModal {
          width: min(1280px, calc(100vw - 32px)) !important;
        }
        #accountingReportBackdrop .salesReportBody {
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
        #accountingReportBackdrop .salesReportSummary {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          align-items: stretch !important;
        }
        #accountingReportBackdrop .salesSummaryCard {
          min-width: 0 !important;
        }
        #accountingReportBackdrop .accountingPortfolioTable {
          min-width: 1040px !important;
          table-layout: fixed !important;
        }
        #accountingReportBackdrop .accountingPortfolioTable th:nth-child(1),
        #accountingReportBackdrop .accountingPortfolioTable td:nth-child(1) { width: 120px !important; }
        #accountingReportBackdrop .accountingPortfolioTable th:nth-child(2),
        #accountingReportBackdrop .accountingPortfolioTable td:nth-child(2) { width: 190px !important; }
        #accountingReportBackdrop .accountingPortfolioTable th:nth-child(3),
        #accountingReportBackdrop .accountingPortfolioTable td:nth-child(3) { width: 150px !important; }
        #accountingReportBackdrop .accountingPortfolioTable th:nth-child(4),
        #accountingReportBackdrop .accountingPortfolioTable td:nth-child(4) { width: 76px !important; }
        #accountingReportBackdrop .accountingPortfolioTable th:nth-child(5),
        #accountingReportBackdrop .accountingPortfolioTable td:nth-child(5),
        #accountingReportBackdrop .accountingPortfolioTable th:nth-child(6),
        #accountingReportBackdrop .accountingPortfolioTable td:nth-child(6),
        #accountingReportBackdrop .accountingPortfolioTable th:nth-child(7),
        #accountingReportBackdrop .accountingPortfolioTable td:nth-child(7),
        #accountingReportBackdrop .accountingPortfolioTable th:nth-child(8),
        #accountingReportBackdrop .accountingPortfolioTable td:nth-child(8) { width: 112px !important; }
        #accountingReportBackdrop .accountingPortfolioTable th:nth-child(9),
        #accountingReportBackdrop .accountingPortfolioTable td:nth-child(9) { width: 142px !important; }
        #accountingReportBackdrop .accountingPortfolioTable th:nth-child(10),
        #accountingReportBackdrop .accountingPortfolioTable td:nth-child(10) { width: 176px !important; }
        #accountingReportBackdrop .accountingInlineActions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: flex-start;
          margin-top: 7px;
        }
        #accountingReportBackdrop .accountingInlineActions .accountingActionBtn {
          min-height: 28px !important;
          padding: 0 9px !important;
          font-size: 10.5px !important;
          border-radius: 8px !important;
          box-shadow: none !important;
        }
        #accountingReportBackdrop .accountingLastPayCell {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        #accountingReportBackdrop .accountingDetailCard {
          gap: 18px !important;
        }
        #accountingReportBackdrop .accountingDetailHead {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 8px;
          padding: 12px 14px;
          border: 1px solid #dbeafe;
          border-radius: 12px;
          background: #eff6ff;
        }
        #accountingReportBackdrop .accountingDetailTable {
          min-width: 1320px;
        }
        #accountingReportBackdrop .accountingDetailTableWrap {
          max-height: 42vh;
          overflow: auto !important;
        }
        #accountingReportBackdrop .accountingDetailMetrics {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px !important;
        }
        #accountStatementBackdrop {
          position: fixed !important;
          inset: 0 !important;
          z-index: 42000 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 18px !important;
          background: rgba(15, 23, 42, 0.55) !important;
          backdrop-filter: blur(10px) !important;
          -webkit-backdrop-filter: blur(10px) !important;
        }
        #accountStatementBackdrop .accountStatementModal {
          width: min(1180px, calc(100vw - 36px)) !important;
          height: min(92vh, 940px) !important;
        }
        @media (max-width: 980px) {
          #accountingReportBackdrop .salesReportSummary {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          #accountingReportBackdrop .accountingDetailMetrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 760px) {
          #accountingReportBackdrop .salesReportSummary {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          #accountingReportBackdrop .salesReportFiltersInline {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
          }
          #accountingReportBackdrop .salesReportFiltersInline .field:nth-child(1) {
            grid-column: span 2 !important;
          }
          #accountingReportBackdrop .salesReportFiltersInline .field:nth-child(7) {
            grid-column: span 2 !important;
          }
          #accountingReportBackdrop .salesReportActions {
            grid-column: span 2 !important;
            justify-content: stretch !important;
            display: flex !important;
            flex-direction: row !important;
            gap: 8px !important;
            width: 100% !important;
            margin-top: 8px !important;
          }
          #accountingReportBackdrop .salesReportActions button {
            flex: 1 1 0 !important;
            width: 100% !important;
            height: 32px !important;
          }
        }
      `}</style>
      <div className="modal salesReportModal">
        {/* Header */}
        <div className="modalHeader salesReportHeader">
          <div className="reportBrandHeader">
            <div className="reportBrandBadge salesReportBrandBadge" style={{ width: '56px', height: '56px', minWidth: '56px', minHeight: '56px', maxWidth: '56px', maxHeight: '56px', borderRadius: '14px', display: 'grid', placeItems: 'center', overflow: 'hidden', border: '1px solid #c7d8ec', background: '#f5faff', flex: '0 0 56px' }}>
              <img src="/Oficial_JDL_acua.png" alt="Logo Jardines del Lago" className="reportBrandLogo salesReportBrandLogo" style={{ width: '40px', height: '40px', minWidth: '40px', minHeight: '40px', maxWidth: '40px', maxHeight: '40px', objectFit: 'contain', display: 'block' }} />
            </div>
            <div className="reportBrandCopy">
              <div className="reportBrandEyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="modalTitle" id="accountingReportTitle">Estado de cuenta contable</div>
              <div className="modalSubtitle" id="accountingReportSubtitle">Cartera por institución para cobro y aplicación de pagos</div>
            </div>
          </div>
          <button className="iconBtn reportModalClose" id="btnAccountingReportClose" type="button" title="Cerrar" onClick={onClose}>&#10005;</button>
        </div>
        
        <div className="modalBody salesReportBody">
          {/* Hero Panel */}
          <div className="salesReportHeroPanel">
            <div className="reportSectionIntro">
              <div>
                <span className="reportSectionEyebrow">Visión Contable</span>
                <h3 className="reportSectionTitle">Estado de cuenta por empresa con saldo pendiente, saldo a favor y tiempo sugerido de cobro</h3>
                <p className="reportSectionText">Ideal para cobrar por institución, identificar vencimientos, abrir el detalle por evento y aplicar pagos sin perder trazabilidad.</p>
              </div>
              <span className="reportFilterMeta">
                Vendedor: {users?.find(u => u.id === userFilter)?.fullName || 'Todos'}
              </span>
            </div>
            
            {/* KPI Metrics Strip */}
            <div className="salesReportSummary">
              <article className="salesSummaryCard salesSummaryCard--primary">
                <span className="salesSummaryEyebrow">CARTERA</span>
                <small>Empresas visibles</small>
                <strong>{accounts.length}</strong>
                <div className="salesSummaryMeta">
                  {filteredData.length} eventos | Venta neta {formatMoney(summary.netAmount)}
                </div>
              </article>
              
              <article className="salesSummaryCard salesSummaryCard--info">
                <span className="salesSummaryEyebrow">COBRADO</span>
                <small>Anticipos cobrados</small>
                <strong>{formatMoney(summary.collectedAmount)}</strong>
                <div className="salesSummaryMeta">
                  {filteredData.reduce((acc, row) => acc + (row.advancesCount || 0), 0)} pago(s) registrados
                </div>
              </article>
              
              <article className="salesSummaryCard salesSummaryCard--accent">
                <span className="salesSummaryEyebrow">PENDIENTE</span>
                <small>Saldo por cobrar</small>
                <strong>{formatMoney(summary.pendingAmount)}</strong>
                <div className="salesSummaryMeta">
                  Saldo a favor {formatMoney(summary.creditAmount)} | Descuentos {formatMoney(summary.discountAmount)}
                </div>
              </article>
              
              <article className={`salesSummaryCard ${summary.overdueCount > 0 ? 'salesSummaryCard--accent' : 'salesSummaryCard--success'}`}>
                <span className="salesSummaryEyebrow">GESTION</span>
                <small>Cobro sugerido</small>
                <strong>{summary.overdueCount > 0 ? `${summary.overdueCount} vencida(s)` : 'Al día'}</strong>
                <div className="salesSummaryMeta">
                  {summary.nextCollection ? `${summary.nextCollection.companyName}: ${summary.nextCollection.collectionEta}` : 'Sin cobros pendientes programados'}
                </div>
              </article>
            </div>
          </div>
          
          {/* Filters Bar */}
          <div className="salesReportFiltersInline">
            <label className="field">
              <span>Buscar</span>
              <input 
                type="text" 
                placeholder="No cotizacion, vendedor, inst..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </label>
            
            <label className="field">
              <span>Desde</span>
              <input 
                type="date" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)}
              />
            </label>
            
            <label className="field">
              <span>Hasta</span>
              <input 
                type="date" 
                value={dateTo} 
                onChange={e => setDateTo(e.target.value)}
              />
            </label>
            
            <label className="field">
              <span>Vendedor</span>
              <select 
                value={userFilter} 
                onChange={e => setUserFilter(e.target.value)}
              >
                <option value="all">Todos vendedores</option>
                {users?.filter(u => u.active !== false).map(u => (
                  <option key={u.id} value={u.id}>{u.fullName || u.name}</option>
                ))}
              </select>
            </label>
            
            <label className="field">
              <span>Estado</span>
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos estados</option>
                {allStatuses.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            
            <label className="field">
              <span>Salón</span>
              <select 
                value={salonFilter} 
                onChange={e => setSalonFilter(e.target.value)}
              >
                <option value="all">Todos salones</option>
                {allSalones.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            
            <label className="field">
              <span>Institución</span>
              <select 
                value={companyFilter} 
                onChange={e => setCompanyFilter(e.target.value)}
              >
                <option value="all">Todas instituciones</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            
            <div className="salesReportActions">
              <button className="accountingActionBtn accountingActionBtn--secondary" style={{ border: '1px solid #cbd5e1' }} onClick={clearFilters}>Limpiar filtros</button>
              <button className="accountingActionBtn" onClick={handleExportExcel}>Exportar Excel</button>
            </div>
          </div>
          
          {/* Main Portfolio Table */}
          <div className="salesReportTableWrap" style={{ flex: 1, overflow: 'auto' }}>
            <table className="quoteTable salesReportTable accountingPortfolioTable" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th>INDICADOR</th>
                  <th>INSTITUCION</th>
                  <th>CONTACTO COBRO</th>
                  <th>EVENTOS</th>
                  <th>VENTA NETA</th>
                  <th>COBRADO</th>
                  <th>SALDO PENDIENTE</th>
                  <th>SALDO A FAVOR</th>
                  <th>PROPUESTA</th>
                  <th>ULTIMO PAGO / ACCIONES</th>
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
                ) : (
                  accounts.map(acc => {
                    const expanded = expandedAccounts.has(acc.key);
                    const canApplyPayment = !!acc.actionEventId;
                    
                    return (
                      <tbody key={acc.key}>
                        {/* Summary Company Row */}
                        <tr className="accountingCompanyRow" style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td>
                            <span className={`accountingIndicator accountingIndicator--${acc.collectionTone}`}>
                              {acc.collectionLabel}
                            </span>
                          </td>
                          <td>
                            <div className="accountingCompanyCell">
                              <strong>{acc.companyName}</strong>
                              <small style={{ color: '#64748b', fontSize: '11px' }}>
                                {acc.primarySeller ? `Principal: ${acc.primarySeller}` : "Sin vendedor asignado"}
                              </small>
                            </div>
                          </td>
                          <td>
                            <div className="accountingMetaCell">
                              <strong>{acc.contactPhone || "-"}</strong>
                              <small style={{ color: '#64748b', fontSize: '11px' }}>
                                {`${acc.pendingEventsCount} pendiente(s) | ${acc.paidEventsCount} al día`}
                              </small>
                            </div>
                          </td>
                          <td style={{ fontWeight: '600', textAlign: 'center' }}>{acc.eventsCount || 0}</td>
                          <td style={{ fontWeight: '700', color: '#0f172a' }}>{formatMoney(acc.netAmount)}</td>
                          <td style={{ fontWeight: '600', color: '#16a34a' }}>{formatMoney(acc.collectedAmount)}</td>
                          <td style={{ fontWeight: '700', color: acc.pendingAmount > 0 ? '#dc2626' : '#16a34a' }}>
                            {formatMoney(acc.pendingAmount)}
                          </td>
                          <td style={{ fontWeight: '600', color: '#0d9488' }}>{formatMoney(acc.creditAmount)}</td>
                          <td>
                            <div className="accountingMetaCell">
                              <strong>{acc.collectionDueLabel || "-"}</strong>
                              <small style={{ color: '#64748b', fontSize: '11px' }}>{acc.collectionEta || "Sin gestión pendiente"}</small>
                            </div>
                          </td>
                          <td>
                            <div className="accountingLastPayCell">
                              <strong style={{ color: '#475569', fontWeight: '700' }}>{acc.lastAdvanceDate || "-"}</strong>
                              <small style={{ color: '#64748b', fontSize: '10.5px' }}>
                                {acc.advancesCount ? `${acc.advancesCount} pago(s)` : 'Sin pagos'}
                              </small>
                            </div>
                            <div className="accountingInlineActions">
                              <button
                                className="accountingActionBtn accountingActionBtn--secondary"
                                type="button"
                                onClick={() => toggleAccountExpand(acc.key)}
                              >
                                {expanded ? "Ocultar detalle" : "Ver detalle"}
                              </button>
                              <button
                                className="accountingActionBtn accountingActionBtn--secondary"
                                type="button"
                                onClick={() => setActiveStatementAccount(acc)}
                              >
                                Estado de cuenta
                              </button>
                              <button
                                className="accountingActionBtn accountingActionBtn--secondary"
                                type="button"
                                onClick={() => handleActionClick("ver cotizacion", acc.actionEventId)}
                                disabled={!canApplyPayment}
                              >
                                Ver cotizacion
                              </button>
                              <button
                                className="accountingActionBtn"
                                type="button"
                                onClick={() => handleActionClick(acc.actionHasCredit ? "ajustar saldo" : "aplicar pago", acc.actionEventId)}
                                disabled={!canApplyPayment}
                              >
                                {acc.actionHasCredit ? "Ajustar saldo" : "Aplicar pago"}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Collapsible Expanded Details Section */}
                        {expanded && (
                          <tr className="accountingCompanyDetailRow">
                            <td colSpan={10} style={{ padding: '16px 24px', background: '#f8fafc' }}>
                              <div className="accountingDetailCard" style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '18px', background: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                                <div className="accountingDetailHead" style={{ paddingBottom: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', borderBottom: '2px solid #e2e8f0', borderRadius: '0' }}>
                                  <strong style={{ fontSize: '16px', color: '#0f172a' }}>Estado de cuenta por evento</strong>
                                  <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600', background: '#f1f5f9', padding: '6px 14px', borderRadius: '999px', border: '1px solid #cbd5e1' }}>
                                    {`${acc.companyName} | ${acc.eventsCount} evento(s) | ${acc.advancesCount} pago(s)`}
                                  </span>
                                </div>
                                
                                {/* 1. Detailed Events Table */}
                                <div className="accountingDetailTableWrap" style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff' }}>
                                  <table className="quoteTable accountingDetailTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ background: '#f1f5f9' }}>
                                        <th>Estado</th>
                                        <th>No cotizacion</th>
                                        <th>Fecha evento</th>
                                        <th>Fecha max pago</th>
                                        <th>Salon principal</th>
                                        <th>Salones del evento</th>
                                        <th>Vendedor</th>
                                        <th>Forma pago</th>
                                        <th style={{ textAlign: 'right' }}>Total neto</th>
                                        <th style={{ textAlign: 'right' }}>Cobrado</th>
                                        <th style={{ textAlign: 'right' }}>Pendiente</th>
                                        <th style={{ textAlign: 'right' }}>Saldo a favor</th>
                                        <th>Último depósito</th>
                                        <th>Detalle</th>
                                        <th>Acción</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {acc.rows.map((r, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                          <td>
                                            <span className="salesStatusBadge" style={{
                                              background: `${r.statusColor}22`,
                                              borderColor: `${r.statusColor}99`,
                                              color: r.statusColor,
                                              padding: '3px 8px',
                                              borderRadius: '999px',
                                              fontSize: '10px',
                                              fontWeight: '800'
                                            }}>
                                              {r.status || "-"}
                                            </span>
                                          </td>
                                          <td style={{ fontWeight: '700' }}>{r.refId}</td>
                                          <td>{r.eventDate}</td>
                                          <td>{r.dueDate || "-"}</td>
                                          <td>{r.salon}</td>
                                          <td style={{ fontSize: '11px', color: '#475569' }}>{r.salonesLabel}</td>
                                          <td>{r.userName}</td>
                                          <td>{r.paymentType || "-"}</td>
                                          <td style={{ textAlign: 'right', fontWeight: '700' }}>{formatMoney(r.total)}</td>
                                          <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: '600' }}>{formatMoney(r.advancesTotal)}</td>
                                          <td style={{ textAlign: 'right', color: r.balancePending > 0 ? '#dc2626' : '#16a34a', fontWeight: '700' }}>
                                            {formatMoney(r.balancePending)}
                                          </td>
                                          <td style={{ textAlign: 'right', color: '#0d9488', fontWeight: '600' }}>{formatMoney(r.creditBalance)}</td>
                                          <td>{r.lastAdvanceDate || "-"}</td>
                                          <td>
                                            <div className="accountingMetaCell">
                                              <strong>{r.lastAdvancePaymentType || "-"}</strong>
                                              <small style={{ fontSize: '10.5px', color: '#64748b' }}>{r.lastAdvanceDescription || "Sin anticipo registrado"}</small>
                                            </div>
                                          </td>
                                          <td>
                                            <div className="accountingActionGroup">
                                              <button 
                                                className="accountingActionBtn accountingActionBtn--secondary" 
                                                type="button" 
                                                onClick={() => handleActionClick("ver cotización", r.actionEventId)}
                                              >
                                                Ver cotización
                                              </button>
                                              <button 
                                                className="accountingActionBtn" 
                                                type="button" 
                                                onClick={() => handleActionClick(r.creditBalance > 0 ? "ajustar crédito" : "aplicar pago", r.actionEventId)}
                                              >
                                                {r.creditBalance > 0 ? "Ajustar saldo" : "Aplicar pago"}
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                {/* 2. Category totals breakdown strip */}
                                <div className="accountingDetailMetrics" style={{ display: 'flex', gap: '20px', background: '#e2e8f0', padding: '8px 16px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '800', color: '#334155' }}>
                                  <span>Total A&B: {formatMoney(acc.rows.reduce((sum, row) => sum + Number(pick(row.catBuckets, "alimentosBebidas").amount || 0), 0))}</span>
                                  <span>Hospedaje JDL: {formatMoney(acc.rows.reduce((sum, row) => sum + Number(pick(row.catBuckets, "hospedajeJdl").amount || 0), 0))}</span>
                                  <span>Hospedaje Terceros: {formatMoney(acc.rows.reduce((sum, row) => sum + Number(pick(row.catBuckets, "hospedajeTerceros").amount || 0), 0))}</span>
                                  <span>Misceláneos: {formatMoney(acc.rows.reduce((sum, row) => sum + Number(pick(row.catBuckets, "miscelaneos").amount || 0), 0))}</span>
                                </div>

                                {/* 3. Chronological Movements Ledger Table */}
                                <div className="accountingDetailTableWrap" style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff' }}>
                                  <table className="quoteTable accountingDetailTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ background: '#f1f5f9' }}>
                                        <th>Fecha</th>
                                        <th>Tipo</th>
                                        <th>No cotizacion</th>
                                        <th>Concepto</th>
                                        <th style={{ textAlign: 'right' }}>Cargo (Débito)</th>
                                        <th style={{ textAlign: 'right' }}>Abono (Crédito)</th>
                                        <th style={{ textAlign: 'right' }}>Saldo acumulado</th>
                                        <th>Acción</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {buildAccountingLedgerEntries(acc).length === 0 ? (
                                        <tr>
                                          <td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                                            Sin movimientos para esta institución.
                                          </td>
                                        </tr>
                                      ) : (
                                        buildAccountingLedgerEntries(acc).map((entry, eIdx) => (
                                          <tr key={eIdx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td>{entry.date || "-"}</td>
                                            <td style={{ fontWeight: '700' }}>{entry.type || "-"}</td>
                                            <td style={{ fontWeight: '700' }}>{entry.refId || "-"}</td>
                                            <td style={{ fontSize: '11px', color: '#475569' }}>{entry.concept || "-"}</td>
                                            <td style={{ textAlign: 'right', fontWeight: entry.debit > 0 ? '700' : 'normal' }}>
                                              {entry.debit > 0 ? formatMoney(entry.debit) : "-"}
                                            </td>
                                            <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: entry.credit > 0 ? '700' : 'normal' }}>
                                              {entry.credit > 0 ? formatMoney(entry.credit) : "-"}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: '700', color: entry.runningBalance > 0 ? '#dc2626' : '#16a34a' }}>
                                              {formatMoney(entry.runningBalance)}
                                            </td>
                                            <td>
                                              <div className="accountingActionGroup">
                                                <button 
                                                  className="accountingActionBtn accountingActionBtn--secondary" 
                                                  type="button" 
                                                  onClick={() => handleActionClick("ver cotización", entry.eventId)}
                                                >
                                                  Ver cotización
                                                </button>
                                                <button 
                                                  className="accountingActionBtn" 
                                                  type="button" 
                                                  onClick={() => handleActionClick(entry.runningBalance > 0 ? "aplicar pago" : "ajustar crédito", entry.eventId)}
                                                >
                                                  {entry.runningBalance > 0 ? "Aplicar pago" : "Ajustar"}
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                       </tbody>
                    );
                  })
                )}
            </table>
          </div>
        </div>
      </div>

      {/* Printable Institutional "Estado de Cuenta" Modal Overlay */}
      {activeStatementAccount && createPortal(
        <div id="accountStatementBackdrop" onClick={() => setActiveStatementAccount(null)}>
          <div className="accountStatementModal" onClick={(event) => event.stopPropagation()} style={{
            background: '#ffffff',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Header bar */}
            <div className="accountStatementHeaderBar" style={{
              background: '#0284c7', // Azul más claro y agradable (Tailwind sky-600)
              color: 'white',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px'
            }}>
              <div>
                <div className="modalTitle" style={{ color: 'white', fontSize: '20px', margin: 0 }}>Estado de Cuenta</div>
                <div className="modalSubtitle" style={{ opacity: 0.9, color: '#e0f2fe', marginTop: '4px' }}>
                  {activeStatementAccount.rows?.length} evento(s) financiero(s) | {buildAccountingLedgerEntries(activeStatementAccount).length} movimiento(s)
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="iconBtn" 
                  style={{ 
                    background: 'rgba(255,255,255,0.2)', 
                    color: '#fff', 
                    border: '1px solid rgba(255,255,255,0.3)', 
                    borderRadius: '6px', 
                    padding: '8px 16px', 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    transition: 'background 0.2s'
                  }} 
                  onClick={() => window.print()} 
                  title="Imprimir estado de cuenta"
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>print</span> Imprimir
                </button>
                <button 
                  className="iconBtn" 
                  style={{ 
                    background: '#ef4444', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '6px', 
                    width: '36px', 
                    height: '36px', 
                    fontSize: '20px', 
                    fontWeight: '700', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    transition: 'background 0.2s'
                  }} 
                  onClick={() => setActiveStatementAccount(null)} 
                  title="Cerrar"
                  onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#ef4444'}
                >
                  &times;
                </button>
              </div>
            </div>
            
            {/* Body shell */}
            <div className="accountStatementBodyShell" style={{ background: '#f1f5f9', padding: '24px', overflowY: 'auto', flex: 1, borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
              <div className="accountStatementPaper" style={{ background: '#fff', maxWidth: '900px', margin: '0 auto', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                {/* Brand header */}
                <div className="accountStatementDocHead">
                  <div className="accountStatementBrandBlock">
                    <img className="accountStatementLogo" src="/Oficial_JDL_blanco.png" alt="Logo" style={{ filter: 'brightness(0)' }} />
                    <div>
                      <div className="accountStatementOrg">JARDINES DEL LAGO</div>
                      <div className="accountStatementDept">Departamento de Cobros y Contabilidad</div>
                    </div>
                  </div>
                  <div className="accountStatementFolioBox">
                    <div className="accountStatementDocName" style={{ fontSize: '18px', fontWeight: '800' }}>Estado de Cuenta</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', textAlign: 'right' }}>
                      <div>Generado: {new Date().toLocaleDateString('es-GT')}</div>
                      <div>Hora: {new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                </div>
                
                {/* Info grid */}
                <div className="accountStatementInfoGrid" style={{ marginTop: '20px' }}>
                  <div>
                    <span>Institución:</span>
                    <b>{activeStatementAccount.companyName}</b>
                  </div>
                  <div>
                    <span>NIT:</span>
                    <b>{companies.find(c => c.id === activeStatementAccount.companyId)?.nit || 'CF'}</b>
                  </div>
                  <div>
                    <span>Contacto:</span>
                    <b>{companies.find(c => c.id === activeStatementAccount.companyId)?.owner || activeStatementAccount.rows[0]?.quote?.contact || '-'}</b>
                  </div>
                  <div>
                    <span>Teléfono:</span>
                    <b>{activeStatementAccount.contactPhone || '-'}</b>
                  </div>
                  <div className="accountStatementInfoWide">
                    <span>Dirección:</span>
                    <b>{companies.find(c => c.id === activeStatementAccount.companyId)?.address || activeStatementAccount.rows[0]?.quote?.address || '-'}</b>
                  </div>
                </div>
                
                {/* Kpis strip */}
                <div className="accountStatementTotalsStrip" style={{ marginTop: '25px' }}>
                  <article className="accountStatementKpi">
                    <small>Total neto</small>
                    <strong>{formatMoney(activeStatementAccount.netAmount)}</strong>
                  </article>
                  <article className="accountStatementKpi">
                    <small>Total pagado</small>
                    <strong>{formatMoney(activeStatementAccount.collectedAmount)}</strong>
                  </article>
                  <article className="accountStatementKpi">
                    <small>Saldo pendiente</small>
                    <strong style={{ color: activeStatementAccount.pendingAmount > 0 ? '#b91c1c' : '#15803d' }}>
                      {formatMoney(activeStatementAccount.pendingAmount)}
                    </strong>
                  </article>
                  <article className="accountStatementKpi">
                    <small>Saldo a favor</small>
                    <strong>{formatMoney(activeStatementAccount.creditAmount)}</strong>
                  </article>
                </div>
                
                {/* Ledger Table */}
                <div className="accountStatementTableSection" style={{ marginTop: '30px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: '#1e293b' }}>Resumen de Movimientos Contables</h4>
                  <table className="accountStatementTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '11px', background: '#f1f5f9' }}>Fecha</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '11px', background: '#f1f5f9' }}>Ref</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '11px', background: '#f1f5f9' }}>Concepto</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '11px', background: '#f1f5f9' }}>Cargo</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '11px', background: '#f1f5f9' }}>Abono</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '11px', background: '#f1f5f9' }}>Saldo Acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildAccountingLedgerEntries(activeStatementAccount).map((entry, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 10px' }}>{entry.date}</td>
                          <td style={{ padding: '8px 10px', fontWeight: '700' }}>{entry.refId}</td>
                          <td style={{ padding: '8px 10px', fontSize: '11px', color: '#475569' }}>{entry.concept}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: entry.debit > 0 ? '700' : 'normal' }}>
                            {entry.debit > 0 ? formatMoney(entry.debit) : '-'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#16a34a', fontWeight: entry.credit > 0 ? '700' : 'normal' }}>
                            {entry.credit > 0 ? formatMoney(entry.credit) : '-'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: entry.runningBalance > 0 ? '#b91c1c' : '#16a34a' }}>
                            {formatMoney(entry.runningBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Signatures */}
                <div className="accountStatementFoot" style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-around' }}>
                  <div className="accountStatementSignLine">
                    <div style={{ borderTop: '1px solid #94a3b8', width: '200px', margin: '0 auto', textAlign: 'center', paddingTop: '6px', fontSize: '11px', color: '#64748b' }}>
                      Firma Autorizada
                    </div>
                  </div>
                  <div className="accountStatementSignLine">
                    <div style={{ borderTop: '1px solid #94a3b8', width: '200px', margin: '0 auto', textAlign: 'center', paddingTop: '6px', fontSize: '11px', color: '#64748b' }}>
                      Recibido por Cliente
                    </div>
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
