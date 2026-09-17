import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { STATUS_META } from '../calendar/constants';
import MultiSelect from '../reports/components/MultiSelect';
import { getQuoteTotalGtq } from '../reports/components/eventSeriesUtils';
import './customers.css';
import '../../styles/tooltips.css';

/* ── Minimalist Vector SVG Icons (Feather / Lucide Style) ── */

function IconFunnel({ size = 22, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function IconSparkles({ size = 15, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4m-3.17-6.83l-2.83 2.83M6 18l2.83-2.83m0-8.34L6 6m12 12l-2.83-2.83" />
    </svg>
  );
}

function IconFileText({ size = 15, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconTrendingUp({ size = 15, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconClock({ size = 15, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconBookmark({ size = 15, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconCheckCircle({ size = 15, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconXCircle({ size = 15, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function IconUser({ size = 12, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconUsers({ size = 12, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconCalendar({ size = 12, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconMapPin({ size = 12, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconCoins({ size = 12, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1.5a1.5 1.5 0 0 1 0 3H7m0 0h2a1.5 1.5 0 0 1 0 3H7m0-6V5m0 7v1" />
    </svg>
  );
}

function IconSearch({ size = 15, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconTag({ size = 13, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function IconLayers({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconDollarSign({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconRotateCcw({ size = 13, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function IconInbox({ size = 26, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

/* ── Pipeline Stage Definitions with Minimalist SVG Icons ── */

const PIPELINE_STAGES = [
  { key: 'Reserva sin Cotizacion', label: 'Nuevo', Icon: IconSparkles, desc: 'Lead recién ingresado sin cotización' },
  { key: '1er Cotizacion', label: 'Cotizado', Icon: IconFileText, desc: 'Primera cotización enviada' },
  { key: 'Seguimiento', label: 'Seguimiento', Icon: IconTrendingUp, desc: 'En negociación activa con el cliente' },
  { key: 'Lista de Espera', label: 'Lista de Espera', Icon: IconClock, desc: 'Interesado en espera de fecha' },
  { key: 'Pre reserva', label: 'Pre-Reserva', Icon: IconBookmark, desc: 'Apartado provisional sin confirmación' },
  { key: 'Confirmado', label: 'Ganado', Icon: IconCheckCircle, desc: 'Reserva confirmada con anticipo' },
];

const EVENT_TYPES = [
  { value: 'Social', label: 'Social', color: '#db2777' },
  { value: 'Corporativo', label: 'Corporativo', color: '#2563eb' },
  { value: 'Individual', label: 'Individual', color: '#7c3aed' },
];

const EXCLUDED_STATUSES = new Set(['Cancelado', 'Perdido', 'Mantenimiento', 'Mantenimiento Realizado', 'Realizado']);

function IconColumns({ size = 13, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="18" rx="1" />
    </svg>
  );
}

const formatCurrency = (val) => {
  const num = Number(val || 0);
  return 'Q ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatKpiCurrency = (val) => {
  const num = Number(val || 0);
  if (Math.abs(num) >= 1000) {
    return 'Q ' + Math.round(num).toLocaleString('en-US');
  }
  return 'Q ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Clasifica con precisión el tipo de evento: Social, Corporativo o Individual
 */
const getEventType = (ev) => {
  // 1. Cotización explícita o tipo directo
  const rawType = ev?.quote?.eventType || ev?.quote?.tipoEvento || ev?.quote?.tipo_evento || ev?.eventType || ev?.type;
  if (rawType) {
    const s = String(rawType).trim().toLowerCase();
    if (s.includes('corp') || s.includes('empresa')) return 'Corporativo';
    if (s.includes('indiv') || s.includes('personal') || s.includes('cena')) return 'Individual';
    if (s.includes('soci') || s.includes('boda') || s.includes('15') || s.includes('xv')) return 'Social';
  }

  // 2. Presencia de razón social o empresa (salvo que sea claramente boda/15)
  if (ev?.quote?.companyName || ev?.quote?.businessName || ev?.companyName) {
    const nameLower = String(ev?.name || '').toLowerCase();
    if (nameLower.includes('boda') || nameLower.includes('15') || nameLower.includes('xv') || nameLower.includes('bautizo') || nameLower.includes('cumple')) {
      return 'Social';
    }
    return 'Corporativo';
  }

  // 3. Inferencia por nombre de evento
  const nameNorm = String(ev?.name || '').toLowerCase();
  if (
    nameNorm.includes('corporativ') ||
    nameNorm.includes('capacitac') ||
    nameNorm.includes('conferenc') ||
    nameNorm.includes('seminar') ||
    nameNorm.includes('taller') ||
    nameNorm.includes('asamblea') ||
    nameNorm.includes('reunion') ||
    nameNorm.includes('convenc') ||
    nameNorm.includes('congreso') ||
    nameNorm.includes('empresa') ||
    nameNorm.includes('instituto') ||
    nameNorm.includes('asociac') ||
    nameNorm.includes('fundac') ||
    nameNorm.includes('ministerio') ||
    nameNorm.includes('gobierno')
  ) {
    return 'Corporativo';
  }

  if (
    nameNorm.includes('cena romantica') ||
    nameNorm.includes('individual') ||
    nameNorm.includes('propuesta') ||
    nameNorm.includes('pedida') ||
    nameNorm.includes('aniversario') ||
    nameNorm.includes('almuerzo privado')
  ) {
    return 'Individual';
  }

  return 'Social';
};

export default function CustomersModule() {
  const navigate = useNavigate();
  const outlet = useOutletContext() || {};
  const events = useMemo(() => outlet?.events || [], [outlet?.events]);
  const users = useMemo(() => outlet?.users || [], [outlet?.users]);

  // Solo usuarios activos con rol de vendedor
  const sellerUsers = useMemo(() => {
    return (users || [])
      .filter(u => {
        const role = String(u.role || u.rol || '').trim().toLowerCase();
        return role === 'vendedor';
      })
      .sort((a, b) => (a.fullName || a.name || '').localeCompare(b.fullName || b.name || ''));
  }, [users]);

  // Filtros
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState(new Set()); // Set vacío = "Todos"
  const [typeFilter, setTypeFilter] = useState(new Set()); // Set vacío = "Todos"
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [datePreset, setDatePreset] = useState('all');

  // Responsividad móvil
  const [isMobileView, setIsMobileView] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [mobileStageKey, setMobileStageKey] = useState('Reserva sin Cotizacion');
  const [mobileViewAllStages, setMobileViewAllStages] = useState(false);

  const stageTabsRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobileView && stageTabsRef.current) {
      const activeBtn = stageTabsRef.current.querySelector('.mobile-stage-tab-btn.is-active');
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [mobileStageKey, mobileViewAllStages, isMobileView]);

  const ALL_STAGES = useMemo(() => [
    ...PIPELINE_STAGES,
    { key: 'lost', label: 'Perdido', Icon: IconXCircle, desc: 'Oportunidades cerradas sin éxito' },
  ], []);

  const currentStageIndex = useMemo(() => {
    const idx = ALL_STAGES.findIndex(s => s.key === mobileStageKey);
    return idx >= 0 ? idx : 0;
  }, [ALL_STAGES, mobileStageKey]);

  const handlePrevStage = () => {
    if (currentStageIndex > 0) {
      setMobileStageKey(ALL_STAGES[currentStageIndex - 1].key);
      setMobileViewAllStages(false);
    }
  };

  const handleNextStage = () => {
    if (currentStageIndex < ALL_STAGES.length - 1) {
      setMobileStageKey(ALL_STAGES[currentStageIndex + 1].key);
      setMobileViewAllStages(false);
    }
  };

  // Selector rápido de presets de fechas
  const handlePresetChange = (e) => {
    const preset = e.target.value;
    setDatePreset(preset);
    const now = new Date();
    const y = now.getFullYear();

    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'this_month') {
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      setDateFrom(`${y}-${m}-01`);
      setDateTo(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'next_3_months') {
      const end = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
      setDateFrom(now.toISOString().slice(0, 10));
      setDateTo(end.toISOString().slice(0, 10));
    } else if (preset === 'this_year') {
      setDateFrom(`${y}-01-01`);
      setDateTo(`${y}-12-31`);
    } else if (preset === 'next_year') {
      setDateFrom(`${y + 1}-01-01`);
      setDateTo(`${y + 1}-12-31`);
    }
  };

  const handleDateChange = (type, val) => {
    if (type === 'from') setDateFrom(val);
    else setDateTo(val);
    setDatePreset('custom');
  };

  const pipelineData = useMemo(() => {
    if (!events || events.length === 0) return {};

    const stageMap = {};
    PIPELINE_STAGES.forEach(s => { stageMap[s.key] = []; });

    for (const ev of events) {
      if (EXCLUDED_STATUSES.has(ev.status)) continue;
      const assignedUser = users?.find(u => u.id === ev.userId);
      const stage = stageMap[ev.status];
      if (!stage) continue;
      stage.push({
        ...ev,
        userName: assignedUser?.fullName || assignedUser?.name || 'Sin encargado',
      });
    }

    // Sort each stage by date descending
    PIPELINE_STAGES.forEach(s => {
      stageMap[s.key].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    });

    return stageMap;
  }, [events, users]);

  // Evaluador universal de filtros por evento
  const matchEvent = useCallback((ev, term) => {
    if (term) {
      const matchText = (
        (ev.name || '') + ' ' +
        (ev.clientName || '') + ' ' +
        (ev.salon || '') + ' ' +
        (ev.userName || '')
      ).toLowerCase();
      if (!matchText.includes(term)) return false;
    }

    if (userFilter.size > 0 && !userFilter.has(ev.userId)) {
      return false;
    }

    if (typeFilter.size > 0) {
      const evType = getEventType(ev);
      if (!typeFilter.has(evType)) return false;
    }

    if (dateFrom || dateTo) {
      const evStart = ev.date || ev.eventDateStart || '';
      const evEnd = ev.eventDateEnd || ev.eventDateStart || ev.date || '';
      if (!evStart && !evEnd) return false;
      if (dateFrom && evEnd && evEnd < dateFrom) return false;
      if (dateTo && evStart && evStart > dateTo) return false;
    }

    return true;
  }, [userFilter, typeFilter, dateFrom, dateTo]);

  const hasActiveFilters = Boolean(search || userFilter.size > 0 || typeFilter.size > 0 || dateFrom || dateTo);

  const filteredPipeline = useMemo(() => {
    if (!hasActiveFilters) return pipelineData;

    const term = search.trim().toLowerCase();
    const result = {};
    for (const stage of PIPELINE_STAGES) {
      const items = pipelineData[stage.key] || [];
      result[stage.key] = items.filter(ev => matchEvent(ev, term));
    }
    return result;
  }, [pipelineData, hasActiveFilters, search, matchEvent]);

  const totalLeads = useMemo(() => {
    return Object.values(filteredPipeline).reduce((sum, arr) => sum + arr.length, 0);
  }, [filteredPipeline]);

  const lostAll = useMemo(() => {
    return (events || [])
      .filter(ev => ev.status === 'Cancelado' || ev.status === 'Perdido')
      .map(ev => {
        const assignedUser = users?.find(u => u.id === ev.userId);
        return {
          ...ev,
          userName: assignedUser?.fullName || assignedUser?.name || 'Sin encargado',
        };
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [events, users]);

  const lostFiltered = useMemo(() => {
    if (!hasActiveFilters) return lostAll;
    const term = search.trim().toLowerCase();
    return lostAll.filter(ev => matchEvent(ev, term));
  }, [lostAll, hasActiveFilters, search, matchEvent]);

  const stageStats = useMemo(() => {
    const stats = {};
    for (const stage of PIPELINE_STAGES) {
      const items = filteredPipeline[stage.key] || [];
      let totalPax = 0, totalIncome = 0;
      for (const ev of items) {
        totalPax += Number(ev.pax || 0);
        totalIncome += getQuoteTotalGtq(ev.quote);
      }
      stats[stage.key] = { totalPax, totalIncome };
    }

    let lostPax = 0, lostIncome = 0;
    for (const ev of lostFiltered) {
      lostPax += Number(ev.pax || 0);
      lostIncome += getQuoteTotalGtq(ev.quote);
    }
    stats.lost = { totalPax: lostPax, totalIncome: lostIncome };
    return stats;
  }, [filteredPipeline, lostFiltered]);

  const { activePipelineIncome, totalActivePax, wonIncome } = useMemo(() => {
    let activeIncome = 0;
    let activePax = 0;
    const activeKeys = ['Reserva sin Cotizacion', '1er Cotizacion', 'Seguimiento', 'Lista de Espera', 'Pre reserva'];
    for (const key of activeKeys) {
      const s = stageStats[key];
      if (s) {
        activeIncome += s.totalIncome || 0;
        activePax += s.totalPax || 0;
      }
    }
    const wonInc = stageStats['Confirmado']?.totalIncome || 0;
    const wonPx = stageStats['Confirmado']?.totalPax || 0;
    return {
      activePipelineIncome: activeIncome,
      totalActivePax: activePax + wonPx,
      wonIncome: wonInc,
    };
  }, [stageStats]);

  const getStatusColor = (status) => {
    return STATUS_META[status]?.color || '#64748b';
  };

  const clearFilters = () => {
    setSearch('');
    setUserFilter(new Set());
    setTypeFilter(new Set());
    setDateFrom('');
    setDateTo('');
    setDatePreset('all');
  };

  return (
    <div className="customers-module-page">
      <div className="customers-container">
        {/* ── 1. Top Header ── */}
        <div className="customers-header">
          <div className="customers-header-left">
            <div className="customers-brand-icon">
              <IconFunnel size={22} />
            </div>
            <div className="customers-title-group">
              <h1 className="customers-main-title">Embudo de Ventas</h1>
              <p className="customers-subtitle">
                {totalLeads} {totalLeads === 1 ? 'oportunidad activa' : 'oportunidades activas en el embudo'}
                {hasActiveFilters ? ' (filtradas)' : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/calendar')}
            className="customers-btn-close"
            title="Cerrar embudo y volver al Calendario"
            data-tooltip="Cerrar"
          >
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
              <path d="M4 4l10 10M14 4l-10 10" />
            </svg>
          </button>
        </div>

        {/* ── 2. Executive KPI Summary Ribbon ── */}
        <div className="customers-kpi-bar">
          <div className="customers-kpi-card">
            <div className="customers-kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <IconLayers size={17} />
            </div>
            <div className="customers-kpi-info">
              <span className="customers-kpi-label">Oportunidades</span>
              <span className="customers-kpi-value">{Number(totalLeads || 0).toLocaleString('en-US')}</span>
            </div>
          </div>

          <div className="customers-kpi-card">
            <div className="customers-kpi-icon-wrap" style={{ background: '#fffbeb', color: '#d97706' }}>
              <IconDollarSign size={17} />
            </div>
            <div className="customers-kpi-info">
              <span className="customers-kpi-label">En Negociación</span>
              <span
                className="customers-kpi-value"
                style={{ color: '#d97706' }}
                title={formatCurrency(activePipelineIncome)}
              >
                {formatKpiCurrency(activePipelineIncome)}
              </span>
            </div>
          </div>

          <div className="customers-kpi-card">
            <div className="customers-kpi-icon-wrap" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <IconCheckCircle size={17} />
            </div>
            <div className="customers-kpi-info">
              <span className="customers-kpi-label">Confirmado / Ganado</span>
              <span
                className="customers-kpi-value"
                style={{ color: '#15803d' }}
                title={formatCurrency(wonIncome)}
              >
                {formatKpiCurrency(wonIncome)}
              </span>
            </div>
          </div>

          <div className="customers-kpi-card">
            <div className="customers-kpi-icon-wrap" style={{ background: '#eef2ff', color: '#4f46e5' }}>
              <IconUsers size={17} />
            </div>
            <div className="customers-kpi-info">
              <span className="customers-kpi-label">PAX Proyectado</span>
              <span className="customers-kpi-value">{Number(totalActivePax || 0).toLocaleString('en-US')} pax</span>
            </div>
          </div>
        </div>

        {/* ── 3. Filters Toolbar ── */}
        <div className={`customers-toolbar ${isMobileView && !showMobileFilters ? 'mobile-filters-collapsed' : ''}`}>
          {/* Search Box */}
          <div className="customers-search-box">
            <span className="customers-search-icon">
              <IconSearch size={15} />
            </span>
            <input
              type="text"
              className="customers-search-input"
              placeholder="Buscar por nombre, cliente, salón..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="customers-search-clear"
                onClick={() => setSearch('')}
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          {/* Botón para alternar filtros avanzados en móvil */}
          {isMobileView && (
            <div className="customers-mobile-filter-bar">
              <button
                type="button"
                className={`btn-toggle-mobile-filters ${showMobileFilters ? 'is-active' : ''} ${hasActiveFilters ? 'has-active' : ''}`}
                onClick={() => setShowMobileFilters(prev => !prev)}
              >
                <IconTag size={13} />
                <span>{showMobileFilters ? 'Ocultar filtros avanzados' : 'Filtros avanzados'}</span>
                {hasActiveFilters && (
                  <span className="mobile-filter-count-badge">Activos</span>
                )}
              </button>
            </div>
          )}

          {/* Rango de Fechas */}
          <div className="customers-date-range-group">
            <span className="customers-filter-label">
              <IconCalendar size={13} />
              Fechas:
            </span>
            <div className="customers-date-inputs-pair">
              <input
                type="date"
                value={dateFrom}
                onChange={e => handleDateChange('from', e.target.value)}
                className="customers-date-input"
                title="Fecha Desde"
              />
              <span className="customers-date-separator">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => handleDateChange('to', e.target.value)}
                className="customers-date-input"
                title="Fecha Hasta"
              />
            </div>
            <select
              className="customers-date-preset-select"
              value={datePreset}
              onChange={handlePresetChange}
              title="Filtro rápido de fechas"
            >
              <option value="all">Todas las fechas</option>
              <option value="this_month">Este mes</option>
              <option value="next_3_months">Próx. 3 meses</option>
              <option value="this_year">Este año</option>
              <option value="next_year">Año siguiente</option>
              {datePreset === 'custom' && <option value="custom">Personalizado</option>}
            </select>
          </div>

          {/* Tipo de Evento (Social, Corporativo, Individual) */}
          <div className="customers-filter-group">
            <span className="customers-filter-label">
              <IconTag size={13} />
              Tipo:
            </span>
            <MultiSelect
              selected={typeFilter}
              onChange={setTypeFilter}
              options={EVENT_TYPES}
              placeholder="Tipo de evento"
              emptyLabel="Todos los tipos"
              searchable={false}
              hideLabel
              width={170}
              minWidth={140}
            />
          </div>

          {/* Vendedor */}
          <div className="customers-filter-group">
            <span className="customers-filter-label">
              <IconUser size={13} />
              Vendedor:
            </span>
            <MultiSelect
              selected={userFilter}
              onChange={setUserFilter}
              options={sellerUsers.map(u => ({ value: u.id, label: u.fullName || u.name }))}
              placeholder="Vendedor"
              emptyLabel="Todos los vendedores"
              searchable
              hideLabel
              width={200}
              minWidth={160}
            />
          </div>

          {/* Botón Limpiar filtros */}
          {hasActiveFilters && (
            <button
              type="button"
              className="customers-btn-clear"
              onClick={clearFilters}
              title="Restablecer todos los filtros"
            >
              <IconRotateCcw size={13} />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>

        {/* ── Mobile Stage Navigation Bar ── */}
        {isMobileView && (
          <div className="customers-mobile-stage-nav-container">
            <div className="customers-mobile-stages-bar" ref={stageTabsRef}>
              {ALL_STAGES.map((st) => {
                const isSelected = mobileStageKey === st.key && !mobileViewAllStages;
                const count = st.key === 'lost' ? lostFiltered.length : (filteredPipeline[st.key]?.length || 0);
                const stageColor = st.key === 'lost' ? '#ef4444' : getStatusColor(st.key);
                const Icon = st.Icon;

                return (
                  <button
                    key={st.key}
                    type="button"
                    className={`mobile-stage-tab-btn ${isSelected ? 'is-active' : ''}`}
                    style={{
                      '--stage-accent': stageColor,
                    }}
                    onClick={() => {
                      setMobileStageKey(st.key);
                      setMobileViewAllStages(false);
                    }}
                  >
                    <span className="mobile-tab-icon" style={{ color: stageColor }}>
                      <Icon size={13} />
                    </span>
                    <span className="mobile-tab-label">{st.label}</span>
                    <span className="mobile-tab-badge">{count}</span>
                  </button>
                );
              })}

              <button
                type="button"
                className={`mobile-stage-tab-btn toggle-all-pill ${mobileViewAllStages ? 'is-active' : ''}`}
                onClick={() => setMobileViewAllStages(v => !v)}
                title={mobileViewAllStages ? 'Ver solo una etapa' : 'Ver todas las columnas'}
              >
                <span className="mobile-tab-icon">
                  <IconColumns size={13} />
                </span>
                <span className="mobile-tab-label">{mobileViewAllStages ? '1 etapa' : 'Ver todas'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── 4. Kanban Pipeline Board ── */}
        <div className={`customers-kanban-board ${mobileViewAllStages ? 'view-all-columns' : ''}`}>
          {PIPELINE_STAGES
            .filter(stage => !isMobileView || mobileViewAllStages || stage.key === mobileStageKey)
            .map(stage => {
            const items = filteredPipeline[stage.key] || [];
            const stageColor = getStatusColor(stage.key);
            const StageIcon = stage.Icon;
            const stats = stageStats[stage.key] || { totalPax: 0, totalIncome: 0 };

            return (
              <div
                key={stage.key}
                className="customers-kanban-column"
                style={{
                  '--stage-color': stageColor,
                  '--card-hover-border': `${stageColor}66`,
                }}
              >
                {/* Column Header */}
                <div className="customers-column-header">
                  <div className="customers-column-top-row">
                    <div className="customers-column-title-box">
                      <div
                        className="customers-stage-icon-badge"
                        style={{
                          background: `${stageColor}16`,
                          color: stageColor,
                        }}
                      >
                        <StageIcon size={15} />
                      </div>
                      <div>
                        <div className="customers-stage-name">{stage.label}</div>
                        <div className="customers-stage-desc" title={stage.desc}>
                          {stage.desc}
                        </div>
                      </div>
                    </div>
                    <div className="customers-column-nav-actions">
                      {isMobileView && !mobileViewAllStages && (
                        <button
                          type="button"
                          className="customers-col-arrow-btn"
                          onClick={(e) => { e.stopPropagation(); handlePrevStage(); }}
                          disabled={currentStageIndex === 0}
                          title="Etapa anterior"
                        >
                          ‹
                        </button>
                      )}
                      <div
                        className="customers-stage-count-pill"
                        style={{
                          background: `${stageColor}15`,
                          color: stageColor,
                          borderColor: `${stageColor}28`,
                        }}
                      >
                        {items.length}
                      </div>
                      {isMobileView && !mobileViewAllStages && (
                        <button
                          type="button"
                          className="customers-col-arrow-btn"
                          onClick={(e) => { e.stopPropagation(); handleNextStage(); }}
                          disabled={currentStageIndex === ALL_STAGES.length - 1}
                          title="Etapa siguiente"
                        >
                          ›
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Column Stats (PAX & Monto) */}
                  <div className="customers-column-stats-row">
                    <div className="customers-stat-chip">
                      <IconUsers size={11} />
                      <span><strong>{Number(stats.totalPax || 0).toLocaleString('en-US')}</strong> PAX</span>
                    </div>
                    <div className="customers-stat-chip revenue-chip" title={formatCurrency(stats.totalIncome)}>
                      <IconCoins size={11} />
                      <span><strong>{formatKpiCurrency(stats.totalIncome)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Column Body with Deal Cards */}
                <div className="customers-column-body">
                  {items.length === 0 ? (
                    <div className="customers-empty-column">
                      <div className="customers-empty-icon">
                        <IconInbox size={26} />
                      </div>
                      <div className="customers-empty-text">Sin oportunidades</div>
                    </div>
                  ) : (
                    items.map(ev => {
                      const dealAmount = getQuoteTotalGtq(ev.quote);
                      const evType = getEventType(ev);
                      const typeTagClass = evType === 'Social' ? 'is-social' : evType === 'Corporativo' ? 'is-corporativo' : 'is-individual';

                      return (
                        <div
                          key={ev.id}
                          className="customers-deal-card"
                          onClick={() => navigate(`/reserva/${ev.id}`)}
                        >
                          {/* Card Top: Tag + Amount */}
                          <div className="customers-card-top-row">
                            <span className={`customers-card-tag ${typeTagClass}`}>
                              {evType}
                            </span>
                            {dealAmount > 0 && (
                              <span className="customers-card-amount">
                                {formatCurrency(dealAmount)}
                              </span>
                            )}
                          </div>

                          {/* Event Title */}
                          <h4 className="customers-card-title">
                            {ev.name || 'Sin nombre'}
                          </h4>

                          {/* Client Name */}
                          {ev.clientName && (
                            <div className="customers-card-client-row">
                              <IconUser size={12} />
                              <span>{ev.clientName}</span>
                            </div>
                          )}

                          {/* Meta Chips */}
                          <div className="customers-card-meta-chips">
                            {ev.date && (
                              <span className="customers-card-chip">
                                <IconCalendar size={11} />
                                <span>{ev.date}</span>
                              </span>
                            )}
                            {ev.salon && (
                              <span className="customers-card-chip">
                                <IconMapPin size={11} />
                                <span>{ev.salon}</span>
                              </span>
                            )}
                            {ev.pax > 0 && (
                              <span className="customers-card-chip">
                                <IconUsers size={11} />
                                <span>{ev.pax} pax</span>
                              </span>
                            )}
                          </div>

                          {/* Footer: Seller + Stage Badge */}
                          <div className="customers-card-footer-row">
                            <div className="customers-card-seller" title={ev.userName}>
                              <IconUser size={11} />
                              <span>{ev.userName}</span>
                            </div>
                            <span
                              className="customers-card-status-pill"
                              style={{
                                background: `${stageColor}15`,
                                color: stageColor,
                                borderColor: `${stageColor}28`,
                              }}
                            >
                              {stage.label}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {isMobileView && <div style={{ height: 48, flexShrink: 0 }} />}
                </div>
              </div>
            );
          })}

          {/* ── Lost Column (Cancelado / Perdido) ── */}
          {(!isMobileView || mobileViewAllStages || mobileStageKey === 'lost') && (() => {
            const stats = stageStats.lost || { totalPax: 0, totalIncome: 0 };

            return (
              <div
                className="customers-kanban-column is-lost"
                style={{
                  '--stage-color': '#ef4444',
                  '--card-hover-border': '#fca5a5',
                }}
              >
                {/* Column Header */}
                <div className="customers-column-header">
                  <div className="customers-column-top-row">
                    <div className="customers-column-title-box">
                      <div
                        className="customers-stage-icon-badge"
                        style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: '#ef4444',
                        }}
                      >
                        <IconXCircle size={15} />
                      </div>
                      <div>
                        <div className="customers-stage-name" style={{ color: '#991b1b' }}>
                          Perdido
                        </div>
                        <div className="customers-stage-desc" title="Oportunidades cerradas sin éxito">
                          Cerradas sin éxito
                        </div>
                      </div>
                    </div>
                    <div className="customers-column-nav-actions">
                      {isMobileView && !mobileViewAllStages && (
                        <button
                          type="button"
                          className="customers-col-arrow-btn"
                          onClick={(e) => { e.stopPropagation(); handlePrevStage(); }}
                          disabled={currentStageIndex === 0}
                          title="Etapa anterior"
                        >
                          ‹
                        </button>
                      )}
                      <div
                        className="customers-stage-count-pill"
                        style={{
                          background: '#fef2f2',
                          color: '#dc2626',
                          borderColor: '#fecaca',
                        }}
                      >
                        {lostFiltered.length}
                      </div>
                      {isMobileView && !mobileViewAllStages && (
                        <button
                          type="button"
                          className="customers-col-arrow-btn"
                          onClick={(e) => { e.stopPropagation(); handleNextStage(); }}
                          disabled={currentStageIndex === ALL_STAGES.length - 1}
                          title="Etapa siguiente"
                        >
                          ›
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="customers-column-stats-row">
                    <div className="customers-stat-chip">
                      <IconUsers size={11} />
                      <span><strong>{Number(stats.totalPax || 0).toLocaleString('en-US')}</strong> PAX</span>
                    </div>
                    <div className="customers-stat-chip revenue-chip" title={formatCurrency(stats.totalIncome)}>
                      <IconCoins size={11} />
                      <span><strong>{formatKpiCurrency(stats.totalIncome)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Column Body */}
                <div className="customers-column-body">
                  {lostFiltered.length === 0 ? (
                    <div className="customers-empty-column">
                      <div className="customers-empty-icon">
                        <IconInbox size={26} />
                      </div>
                      <div className="customers-empty-text">Sin pérdidas</div>
                    </div>
                  ) : (
                    lostFiltered.map(ev => {
                      const dealAmount = getQuoteTotalGtq(ev.quote);
                      const evType = getEventType(ev);

                      return (
                        <div
                          key={ev.id}
                          className="customers-deal-card"
                          onClick={() => navigate(`/reserva/${ev.id}`)}
                        >
                          {/* Card Top: Tag + Amount */}
                          <div className="customers-card-top-row">
                            <span
                              className="customers-card-tag"
                              style={{
                                background: '#fef2f2',
                                color: '#dc2626',
                                borderColor: '#fecaca',
                              }}
                            >
                              {ev.status === 'Cancelado' ? 'CANCELADO' : 'PERDIDO'} • {evType}
                            </span>
                            {dealAmount > 0 && (
                              <span className="customers-card-amount" style={{ color: '#dc2626' }}>
                                {formatCurrency(dealAmount)}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h4 className="customers-card-title">
                            {ev.name || 'Sin nombre'}
                          </h4>

                          {/* Client */}
                          {ev.clientName && (
                            <div className="customers-card-client-row">
                              <IconUser size={12} />
                              <span>{ev.clientName}</span>
                            </div>
                          )}

                          {/* Meta Chips */}
                          <div className="customers-card-meta-chips">
                            {ev.date && (
                              <span className="customers-card-chip">
                                <IconCalendar size={11} />
                                <span>{ev.date}</span>
                              </span>
                            )}
                            {ev.salon && (
                              <span className="customers-card-chip">
                                <IconMapPin size={11} />
                                <span>{ev.salon}</span>
                              </span>
                            )}
                            {ev.pax > 0 && (
                              <span className="customers-card-chip">
                                <IconUsers size={11} />
                                <span>{ev.pax} pax</span>
                              </span>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="customers-card-footer-row">
                            <div className="customers-card-seller" title={ev.userName}>
                              <IconUser size={11} />
                              <span>{ev.userName}</span>
                            </div>
                            <span
                              className="customers-card-status-pill"
                              style={{
                                background: '#fef2f2',
                                color: '#dc2626',
                                borderColor: '#fecaca',
                              }}
                            >
                              {ev.status}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {isMobileView && <div style={{ height: 48, flexShrink: 0 }} />}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
