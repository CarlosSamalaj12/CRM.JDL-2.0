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
        createdAt: String(item?.createdAt || '')
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
        const notes = [paymentType, description].filter(Boolean).join(" | ");
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
      Swal.fire('Sin evento relacionado', 'No se encontro un evento para abrir esta cotizacion.', 'info');
      return;
    }
    onClose?.();
    navigate(`/reserva/${eventId}`);
  };

  const handleExportExcel = () => {
    if (!accounts.length) {
      Swal.fire('Error', 'No hay datos para exportar.', 'error');
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

          {/* Bento KPI Summary */}
          <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {kpiSummary.map((kpi, i) => (
              <div key={i} className="bento-tile reports-kpi-tile" style={{ borderTop: `4px solid ${kpi.accent}` }}>
                <span className="reports-eyebrow">{kpi.label}</span>
                <strong style={{ fontSize: kpi.label === 'Instituciones' ? '2.2rem' : '1.3rem' }}>{kpi.value}</strong>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{kpi.meta}</span>
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
                  {/* Company Row */}
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td>
                      <span className={`reports-collection-status reports-collection-status--${acc.collectionTone}`}>
                        {acc.collectionLabel}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong style={{ fontSize: '12px', color: '#0f172a' }}>{acc.companyName}</strong>
                        <small style={{ color: '#94a3b8', fontSize: '10px' }}>
                          {acc.primarySeller ? `Vendedor: ${acc.primarySeller}` : 'Sin vendedor asignado'}
                        </small>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong style={{ fontSize: '12px', color: '#334155' }}>{acc.contactPhone || '-'}</strong>
                        <small style={{ color: '#94a3b8', fontSize: '10px' }}>
                          {acc.pendingEventsCount} pendiente(s) · {acc.paidEventsCount} al día
                        </small>
                      </div>
                    </td>
                    <td style={{ fontWeight: '700', textAlign: 'center', fontSize: '13px' }}>{acc.eventsCount}</td>
                    <td style={{ fontWeight: '700', textAlign: 'right', color: '#0f172a', fontSize: '12px' }}>{formatMoney(acc.netAmount)}</td>
                    <td style={{ fontWeight: '600', textAlign: 'right', color: '#16a34a', fontSize: '12px' }}>{formatMoney(acc.collectedAmount)}</td>
                    <td style={{ fontWeight: '700', textAlign: 'right', color: acc.pendingAmount > 0 ? '#dc2626' : '#16a34a', fontSize: '12px' }}>{formatMoney(acc.pendingAmount)}</td>
                    <td style={{ fontWeight: '600', textAlign: 'right', color: '#0d9488', fontSize: '12px' }}>{formatMoney(acc.creditAmount)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong style={{ fontSize: '11px', color: '#334155' }}>{acc.collectionDueLabel || '-'}</strong>
                        <small style={{ color: '#94a3b8', fontSize: '10px' }}>{acc.collectionEta || 'Sin gestión'}</small>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#475569' }}>
                          <strong>{acc.lastAdvanceDate || '-'}</strong>
                          <small style={{ color: '#94a3b8' }}>{acc.advancesCount ? `(${acc.advancesCount} pago(s))` : ''}</small>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          <button type="button" onClick={() => toggleAccountExpand(acc.key)}
                            style={{ padding: '3px 8px', fontSize: '9px', fontWeight: '700', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer' }}>
                            {expanded ? 'Ocultar' : 'Detalle'}
                          </button>
                          <button type="button" onClick={() => setActiveStatementAccount(acc)}
                            style={{ padding: '3px 8px', fontSize: '9px', fontWeight: '700', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer' }}>
                            Estado
                          </button>
                          <button type="button" onClick={() => handleActionClick("ver cotizacion", acc.actionEventId)} disabled={!canApplyPayment}
                            style={{ padding: '3px 8px', fontSize: '9px', fontWeight: '700', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: !canApplyPayment ? '#cbd5e1' : '#475569', cursor: canApplyPayment ? 'pointer' : 'not-allowed' }}>
                            Cotización
                          </button>
                          <button type="button" onClick={() => handleActionClick(acc.actionHasCredit ? "ajustar saldo" : "aplicar pago", acc.actionEventId)} disabled={!canApplyPayment}
                            style={{ padding: '3px 8px', fontSize: '9px', fontWeight: '700', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', cursor: canApplyPayment ? 'pointer' : 'not-allowed', opacity: canApplyPayment ? 1 : 0.4 }}>
                            {acc.actionHasCredit ? 'Ajustar' : 'Pago'}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Details */}
                  {expanded && (
                    <tr>
                      <td colSpan={10} style={{ padding: '16px 24px', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '18px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '2px solid #e2e8f0' }}>
                            <strong style={{ fontSize: '14px', color: '#0f172a' }}>Estado de cuenta por evento</strong>
                            <span style={{ fontSize: '11px', color: '#475569', fontWeight: '600', background: '#f1f5f9', padding: '4px 12px', borderRadius: '999px' }}>
                              {acc.companyName} · {acc.eventsCount} evento(s) · {acc.advancesCount} pago(s)
                            </span>
                          </div>

                          {/* Detail Events Table */}
                          <div className="reports-table-wrap" style={{ boxShadow: 'none', border: '1px solid #e2e8f0' }}>
                            <table className="reports-table" style={{ minWidth: '1000px' }}>
                              <thead>
                                <tr>
                                  <th>Estado</th>
                                  <th>Cotización</th>
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
                                  <tr key={idx}>
                                    <td>
                                      <span className="reports-table-status" style={{
                                        background: `${r.statusColor}18`, color: r.statusColor,
                                        border: `1px solid ${r.statusColor}30`,
                                      }}>
                                        {r.status || '-'}
                                      </span>
                                    </td>
                                    <td style={{ fontWeight: 700 }}>{r.refId}</td>
                                    <td>{r.eventDate}</td>
                                    <td>{r.userName}</td>
                                    <td>{r.salon}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(r.total)}</td>
                                    <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{formatMoney(r.advancesTotal)}</td>
                                    <td style={{ textAlign: 'right', color: r.balancePending > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{formatMoney(r.balancePending)}</td>
                                    <td>
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button type="button" onClick={() => handleActionClick("ver cotización", r.actionEventId)}
                                          style={{ padding: '2px 6px', fontSize: '9px', fontWeight: '700', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
                                          Ver
                                        </button>
                                        <button type="button" onClick={() => handleActionClick(r.creditBalance > 0 ? "ajustar crédito" : "aplicar pago", r.actionEventId)}
                                          style={{ padding: '2px 6px', fontSize: '9px', fontWeight: '700', borderRadius: '4px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>
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
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', background: '#f8fafc', padding: '8px 14px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', color: '#475569' }}>
                            <span>A&B: {formatMoney(acc.rows.reduce((sum, row) => sum + Number(pick(row.catBuckets, "alimentosBebidas").amount || 0), 0))}</span>
                            <span>Hosp. JDL: {formatMoney(acc.rows.reduce((sum, row) => sum + Number(pick(row.catBuckets, "hospedajeJdl").amount || 0), 0))}</span>
                            <span>Hosp. 3ros: {formatMoney(acc.rows.reduce((sum, row) => sum + Number(pick(row.catBuckets, "hospedajeTerceros").amount || 0), 0))}</span>
                            <span>Misceláneos: {formatMoney(acc.rows.reduce((sum, row) => sum + Number(pick(row.catBuckets, "miscelaneos").amount || 0), 0))}</span>
                          </div>

                          {/* Ledger Movements */}
                          <div className="reports-table-wrap" style={{ boxShadow: 'none', border: '1px solid #e2e8f0' }}>
                            <table className="reports-table" style={{ minWidth: '700px' }}>
                              <thead>
                                <tr>
                                  <th>Fecha</th>
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
                                  <tr key={eIdx}>
                                    <td>{entry.date || '-'}</td>
                                    <td style={{ fontWeight: 700 }}>{entry.type || '-'}</td>
                                    <td style={{ fontWeight: 700 }}>{entry.refId || '-'}</td>
                                    <td style={{ fontSize: '10px', color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.concept || '-'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: entry.debit > 0 ? 700 : 400 }}>{entry.debit > 0 ? formatMoney(entry.debit) : '-'}</td>
                                    <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: entry.credit > 0 ? 700 : 400 }}>{entry.credit > 0 ? formatMoney(entry.credit) : '-'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: entry.runningBalance > 0 ? '#dc2626' : '#16a34a' }}>{formatMoney(entry.runningBalance)}</td>
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

      {/* ── Statement Modal ── */}
      {activeStatementAccount && createPortal(
        <div onClick={() => setActiveStatementAccount(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '16px', display: 'flex', flexDirection: 'column',
            maxWidth: '920px', width: '100%', maxHeight: '90vh', boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff',
              padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderRadius: '16px 16px 0 0',
            }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 800 }}>Estado de Cuenta</div>
                <div style={{ opacity: 0.85, fontSize: '12px', marginTop: '4px' }}>
                  {activeStatementAccount.rows?.length} evento(s) · {buildAccountingLedgerEntries(activeStatementAccount).length} movimiento(s)
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.print()}
                  style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🖨️ Imprimir
                </button>
                <button onClick={() => setActiveStatementAccount(null)} className="btn-exit" style={{ color: '#fff !important' }}>
                  <svg className="crm-icon-x" viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l10 10M14 4l-10 10" /></svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ background: '#f1f5f9', padding: '24px', overflowY: 'auto', flex: 1, borderRadius: '0 0 16px 16px' }}>
              <div style={{ background: '#fff', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                {/* Brand */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <img src="/Oficial_JDL_blanco.png" alt="JDL" style={{ height: '32px', filter: 'brightness(0)', marginBottom: '8px' }} />
                    <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>JARDINES DEL LAGO</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Departamento de Cobros y Contabilidad</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a' }}>Estado de Cuenta</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                      {new Date().toLocaleDateString('es-GT')} · {new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}>
                  <div><span style={{ color: '#94a3b8' }}>Institución:</span> <strong>{activeStatementAccount.companyName}</strong></div>
                  <div><span style={{ color: '#94a3b8' }}>NIT:</span> <strong>{companies.find(c => c.id === activeStatementAccount.companyId)?.nit || 'CF'}</strong></div>
                  <div><span style={{ color: '#94a3b8' }}>Contacto:</span> <strong>{companies.find(c => c.id === activeStatementAccount.companyId)?.owner || activeStatementAccount.rows[0]?.quote?.contact || '-'}</strong></div>
                  <div><span style={{ color: '#94a3b8' }}>Teléfono:</span> <strong>{activeStatementAccount.contactPhone || '-'}</strong></div>
                  <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#94a3b8' }}>Dirección:</span> <strong>{companies.find(c => c.id === activeStatementAccount.companyId)?.address || activeStatementAccount.rows[0]?.quote?.address || '-'}</strong></div>
                </div>

                {/* KPI Strip */}
                <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
                  {[
                    { label: 'Total neto', value: formatMoney(activeStatementAccount.netAmount), color: '#10c972' },
                    { label: 'Total pagado', value: formatMoney(activeStatementAccount.collectedAmount), color: '#2563eb' },
                    { label: 'Saldo pendiente', value: formatMoney(activeStatementAccount.pendingAmount), color: activeStatementAccount.pendingAmount > 0 ? '#b91c1c' : '#15803d' },
                    { label: 'Saldo a favor', value: formatMoney(activeStatementAccount.creditAmount), color: '#10c972' },
                  ].map((kpi, i) => (
                    <div key={i} className="bento-tile" style={{ borderTop: `3px solid ${kpi.color}`, padding: '12px', borderRadius: '8px' }}>
                      <small style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8' }}>{kpi.label}</small>
                      <strong style={{ display: 'block', fontSize: '14px', fontWeight: 850, color: kpi.color }}>{kpi.value}</strong>
                    </div>
                  ))}
                </div>

                {/* Ledger Table */}
                <div>
                  <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>Resumen de Movimientos Contables</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Fecha', 'Ref', 'Concepto', 'Cargo', 'Abono', 'Saldo'].map(h => (
                          <th key={h} style={{ textAlign: h === 'Cargo' || h === 'Abono' || h === 'Saldo' ? 'right' : 'left', padding: '8px 10px', fontWeight: 700, color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {buildAccountingLedgerEntries(activeStatementAccount).map((entry, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '7px 10px' }}>{entry.date}</td>
                          <td style={{ padding: '7px 10px', fontWeight: 700 }}>{entry.refId}</td>
                          <td style={{ padding: '7px 10px', color: '#475569', fontSize: '10px' }}>{entry.concept}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: entry.debit > 0 ? 700 : 400 }}>{entry.debit > 0 ? formatMoney(entry.debit) : '-'}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#16a34a', fontWeight: entry.credit > 0 ? 700 : 400 }}>{entry.credit > 0 ? formatMoney(entry.credit) : '-'}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: entry.runningBalance > 0 ? '#b91c1c' : '#16a34a' }}>{formatMoney(entry.runningBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Signatures */}
                <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-around', fontSize: '11px', color: '#64748b' }}>
                  <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #94a3b8', width: '180px', paddingTop: '6px' }}>Firma Autorizada</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #94a3b8', width: '180px', paddingTop: '6px' }}>Recibido por Cliente</div></div>
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
