import { useState, useMemo, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { loadState } from '../../services/stateService';
import ReportInfo from './components/ReportInfo';

function getLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthName(m) {
  return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m] || '';
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function normalizeSalon(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const STATUS = { CONFIRMADO: 'Confirmado', PRERESERVA: 'Pre reserva' };
const ACTIVE_STATUSES = new Set([STATUS.CONFIRMADO, STATUS.PRERESERVA]);
const META_PCT = 0.11;

// ── Minimalist Vector Icons ──
function IconCalendar({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconUsers({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconTrendingUp({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconBuilding({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <line x1="9" y1="22" x2="9" y2="2" />
      <line x1="15" y1="22" x2="15" y2="2" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  );
}

function IconTarget({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconDownload({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconChevronLeft({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconFlame({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

function IconCheckCircle({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export default function ReportsOcupacionBarras({ onClose }) {
  const { events } = useOutletContext();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [fromDate, setFromDate] = useState(getLocalDateStr(firstOfMonth));
  const [toDate, setToDate] = useState(getLocalDateStr(lastOfMonth));
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredBarPos, setHoveredBarPos] = useState(null);
  const [exporting, setExporting] = useState(false);

  // ── Load capacity data ──
  const [salonCapacities, setSalonCapacities] = useState({});
  const [salonOccupancyEnabled, setSalonOccupancyEnabled] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const state = await loadState({ cacheBust: true });
        setSalonCapacities((state.salonCapacities && typeof state.salonCapacities === 'object') ? state.salonCapacities : {});
        setSalonOccupancyEnabled(Array.isArray(state.salonOccupancyEnabled) ? state.salonOccupancyEnabled : []);
      } catch (err) { console.error(err); }
    })();
  }, []);

  // ── Compute total capacity of marked salons ──
  const totalMarkedCapacity = useMemo(() => {
    return salonOccupancyEnabled.reduce((sum, name) => sum + Math.max(0, Number(salonCapacities[name] || 0)), 0);
  }, [salonCapacities, salonOccupancyEnabled]);

  // ── Get set of marked salon names for quick lookup ──
  const markedSalonSet = useMemo(
    () => new Set(salonOccupancyEnabled.map(normalizeSalon)),
    [salonOccupancyEnabled]
  );

  // ── Generate all months between fromDate and toDate ──
  const monthList = useMemo(() => {
    const months = [];
    const start = new Date(fromDate + 'T00:00:00');
    const end = new Date(toDate + 'T00:00:00');
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      months.push({
        key: `${y}-${String(m + 1).padStart(2, '0')}`,
        year: y,
        month: m,
        monthName: getMonthName(m),
        monthShort: getMonthName(m).substring(0, 3),
        daysInMonth: daysInMonth(y, m),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }, [fromDate, toDate]);

  // ── Compute occupancy per month ──
  const chartData = useMemo(() => {
    if (!events || !monthList.length) return [];
    if (totalMarkedCapacity <= 0) {
      return monthList.map(m => ({
        monthKey: m.key,
        monthName: m.monthName,
        monthShort: m.monthShort,
        year: m.year,
        daysInMonth: m.daysInMonth,
        count: 0,
        totalPax: 0,
        pct: 0,
        label: 'Sin capacidad',
      }));
    }

    const from = monthList[0].key + '-01';
    const to = monthList[monthList.length - 1].key + '-' + String(monthList[monthList.length - 1].daysInMonth).padStart(2, '0');

    const monthPax = {};
    const monthEventCounts = {};
    for (const ev of events) {
      const d = String(ev.date || '');
      if (!d || d < from || d > to) continue;
      if (!ACTIVE_STATUSES.has(String(ev.status || ''))) continue;
      const evSalon = normalizeSalon(ev.salon);
      if (!markedSalonSet.has(evSalon)) continue;
      const monthKey = d.substring(0, 7);
      const pax = Math.max(0, Number(ev.pax || 0));
      if (pax > 0) {
        monthPax[monthKey] = (monthPax[monthKey] || 0) + pax;
      }
      monthEventCounts[monthKey] = (monthEventCounts[monthKey] || 0) + 1;
    }

    return monthList.map(m => {
      const totalPax = monthPax[m.key] || 0;
      const count = monthEventCounts[m.key] || 0;
      const monthlyCapacity = totalMarkedCapacity * m.daysInMonth;
      const monthlyMeta = monthlyCapacity * META_PCT;
      const pct = monthlyMeta > 0 ? (totalPax / monthlyMeta) * 100 : 0;

      return {
        monthKey: m.key,
        monthName: m.monthName,
        monthShort: m.monthShort,
        year: m.year,
        daysInMonth: m.daysInMonth,
        count,
        totalPax,
        monthlyCapacity,
        monthlyMeta,
        pct,
        label: totalPax > 0
          ? `${totalPax.toLocaleString()} PAX (${count} evento${count !== 1 ? 's' : ''})`
          : count > 0 ? `Sin PAX (${count} evento${count !== 1 ? 's' : ''})` : 'Sin actividad',
      };
    });
  }, [events, monthList, totalMarkedCapacity, markedSalonSet]);

  const totalPax = useMemo(() => chartData.reduce((s, d) => s + d.totalPax, 0), [chartData]);
  const totalEvents = useMemo(() => chartData.reduce((s, d) => s + d.count, 0), [chartData]);
  const activeMonths = useMemo(() => chartData.filter(d => d.totalPax > 0).length, [chartData]);

  const avgMonthlyMeta = useMemo(() => {
    if (monthList.length === 0) return 0;
    const totalDays = monthList.reduce((s, m) => s + m.daysInMonth, 0);
    return Math.round(totalMarkedCapacity * (totalDays / monthList.length) * META_PCT);
  }, [monthList, totalMarkedCapacity]);

  const peakMonth = useMemo(() => {
    let max = { totalPax: 0, monthKey: '', monthName: '', pct: 0 };
    for (const d of chartData) {
      if (d.totalPax > max.totalPax) {
        max = { totalPax: d.totalPax, monthKey: d.monthKey, monthName: d.monthName, pct: d.pct };
      }
    }
    return max;
  }, [chartData]);

  const avgMonthly = monthList.length > 0 ? (totalPax / monthList.length) : 0;

  const totalMonthlyCapacity = useMemo(() => {
    return monthList.reduce((sum, m) => sum + totalMarkedCapacity * m.daysInMonth, 0);
  }, [monthList, totalMarkedCapacity]);

  const totalMeta = totalMonthlyCapacity * META_PCT;
  const paxUtilPct = totalMeta > 0 ? (totalPax / totalMeta) * 100 : 0;

  const hoveredData = useMemo(
    () => (hoveredBar !== null && chartData[hoveredBar]) ? chartData[hoveredBar] : null,
    [hoveredBar, chartData]
  );

  // ── Animation state ──
  const [animationPhase, setAnimationPhase] = useState('complete');
  const [visibleBars, setVisibleBars] = useState(9999);
  const animationKeyRef = useRef(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (chartData.length > 0) {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        setAnimationPhase('complete');
        setVisibleBars(chartData.length);
        return;
      }

      animationKeyRef.current += 1;
      const currentKey = animationKeyRef.current;
      setAnimationPhase('initial');
      setVisibleBars(0);

      let interval;
      const timer = setTimeout(() => {
        if (currentKey !== animationKeyRef.current) return;
        setAnimationPhase('animating');
        let i = 0;
        interval = setInterval(() => {
          i++;
          if (currentKey !== animationKeyRef.current) { clearInterval(interval); return; }
          setVisibleBars(i);
          if (i >= chartData.length) {
            clearInterval(interval);
            setAnimationPhase('complete');
          }
        }, 20);
      }, 80);
      return () => {
        clearTimeout(timer);
        if (interval) clearInterval(interval);
      };
    }
  }, [chartData]);

  const getBarColor = (pct, isHovered) => {
    if (pct >= 100) return isHovered ? '#047857' : '#10b981';
    if (pct >= 70) return isHovered ? '#1d4ed8' : '#3b82f6';
    if (pct >= 40) return isHovered ? '#4338ca' : '#6366f1';
    if (pct > 0) return isHovered ? '#6366f1' : '#a5b4fc';
    return '#e2e8f0';
  };

  // ── Quick Presets ──
  const setPreset = (type) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (type === 'currentMonth') {
      setFromDate(getLocalDateStr(new Date(y, m, 1)));
      setToDate(getLocalDateStr(new Date(y, m + 1, 0)));
    } else if (type === 'last3Months') {
      setFromDate(getLocalDateStr(new Date(y, m - 2, 1)));
      setToDate(getLocalDateStr(new Date(y, m + 1, 0)));
    } else if (type === 'last6Months') {
      setFromDate(getLocalDateStr(new Date(y, m - 5, 1)));
      setToDate(getLocalDateStr(new Date(y, m + 1, 0)));
    } else if (type === 'currentYear') {
      setFromDate(getLocalDateStr(new Date(y, 0, 1)));
      setToDate(getLocalDateStr(new Date(y, 11, 31)));
    }
  };

  // ── Export to Excel ──
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const resumenData = [
        ['REPORTE DE PORCENTAJE DE OCUPACIÓN DE EVENTOS'],
        ['JARDINES DEL LAGO - EMS RESERVAS'],
        [''],
        ['Métrica', 'Valor'],
        ['Período Analizado', `Del ${fromDate} al ${toDate}`],
        ['Meses en Rango', monthList.length],
        ['Meses con Actividad', activeMonths],
        ['Eventos Registrados', totalEvents],
        ['PAX Total Ocupados', totalPax],
        ['Promedio PAX / Mes', Math.round(avgMonthly)],
        ['Capacidad Diaria Configurada', totalMarkedCapacity],
        ['Meta Diaria Requerida (11%)', Math.round(totalMarkedCapacity * META_PCT)],
        ['Capacidad Total del Período', totalMonthlyCapacity],
        ['Meta Total del Período (11%)', Math.round(totalMeta)],
        ['% Cumplimiento Global', `${paxUtilPct.toFixed(1)}%`],
        ['Mes Pico', `${peakMonth.monthName} (${peakMonth.totalPax.toLocaleString()} PAX - ${peakMonth.pct.toFixed(1)}% meta)`],
      ];
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen General');

      const detalleData = [
        ['Mes', 'Año', 'Días', 'Eventos', 'PAX Ocupados', 'Capacidad Mensual', 'Meta (11%)', '% Cumplimiento', 'Estado'],
        ...chartData.map(d => [
          d.monthName,
          d.year,
          d.daysInMonth,
          d.count,
          d.totalPax,
          d.monthlyCapacity,
          Math.round(d.monthlyMeta),
          Number((d.pct).toFixed(1)),
          d.pct >= 100 ? 'Meta Alcanzada' : d.pct >= 70 ? 'Cerca de Meta' : d.pct >= 40 ? 'Moderado' : 'Bajo'
        ]),
        [''],
        [
          'TOTALES / PROMEDIO',
          '-',
          monthList.reduce((s, m) => s + m.daysInMonth, 0),
          totalEvents,
          totalPax,
          totalMonthlyCapacity,
          Math.round(totalMeta),
          Number(paxUtilPct.toFixed(1)),
          paxUtilPct >= 100 ? 'Meta Global Alcanzada' : 'Por Debajo de Meta'
        ]
      ];
      const wsDetalle = XLSX.utils.aoa_to_sheet(detalleData);
      XLSX.utils.book_append_sheet(wb, wsDetalle, 'Desglose Mensual');

      XLSX.writeFile(wb, `Reporte_Ocupacion_Eventos_${fromDate}_a_${toDate}.xlsx`);
    } catch (err) {
      console.error('Error exportando Excel:', err);
    } finally {
      setExporting(false);
    }
  };

  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="reports-page-container" style={{ background: '#f8fafc' }}>
      <style>{`
        @keyframes tooltipFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .occ-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.03);
          transition: all 0.2s ease;
        }
        .occ-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.06), 0 12px 24px -6px rgba(0,0,0,0.04);
        }
        .preset-btn {
          font-size: 11px;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .preset-btn:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #0f172a;
          transform: translateY(-1px);
        }
        .preset-btn.active {
          background: #0f172a;
          border-color: #0f172a;
          color: #ffffff;
        }
        .occ-table-row:hover {
          background: #f8fafc !important;
        }
      `}</style>

      {/* ── Header Principal ── */}
      <div className="reports-page-header" style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div className="reports-brand-header" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(59,130,246,0.1)'
          }}>
            <img src="/Oficial_JDL_acua.png" alt="Logo" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#3b82f6', marginBottom: '2px' }}>
              EMS Reservas · Jardines del Lago
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Porcentaje de Ocupación de Eventos
              <span style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '6px',
                background: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0',
                letterSpacing: '0.02em'
              }}>
                Meta: 11% Salones
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Cumplimiento mensual de asistencia PAX vs capacidad de salones configurados como determinantes
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '12px',
              fontWeight: 700,
              cursor: exporting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={e => { if (!exporting) e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { if (!exporting) e.currentTarget.style.background = '#ffffff'; }}
          >
            <IconDownload size={14} color="#059669" />
            {exporting ? 'Generando Excel...' : 'Descargar Excel'}
          </button>

          <ReportInfo reportKey="ocupacionBarras" />

          <button
            className="btn-exit"
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
            <IconChevronLeft size={14} />
            Volver
          </button>
        </div>
      </div>

      <div className="reports-page-body" style={{ padding: '24px 28px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Toolbar de Filtros y Presets Rápidos ── */}
        <section className="occ-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            {/* Fechas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Período:
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '8px' }}>
                  <IconCalendar size={13} color="#64748b" />
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Desde</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={e => setFromDate(e.target.value)}
                    style={{ border: 'none', background: 'transparent', fontSize: '12px', fontWeight: 700, color: '#0f172a', outline: 'none' }}
                  />
                </div>
                <span style={{ color: '#94a3b8', fontWeight: 700 }}>—</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '8px' }}>
                  <IconCalendar size={13} color="#64748b" />
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Hasta</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={e => setToDate(e.target.value)}
                    style={{ border: 'none', background: 'transparent', fontSize: '12px', fontWeight: 700, color: '#0f172a', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Botones de Presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px', flexWrap: 'wrap' }}>
                <button type="button" className="preset-btn" onClick={() => setPreset('currentMonth')}>
                  Este Mes
                </button>
                <button type="button" className="preset-btn" onClick={() => setPreset('last3Months')}>
                  Últimos 3M
                </button>
                <button type="button" className="preset-btn" onClick={() => setPreset('last6Months')}>
                  Últimos 6M
                </button>
                <button type="button" className="preset-btn" onClick={() => setPreset('currentYear')}>
                  Año {today.getFullYear()}
                </button>
              </div>
            </div>

            {/* Configuración Salones Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: totalMarkedCapacity > 0 ? '#eff6ff' : '#fffbeb',
                border: `1px solid ${totalMarkedCapacity > 0 ? '#bfdbfe' : '#fde68a'}`,
                padding: '6px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <IconBuilding size={14} color={totalMarkedCapacity > 0 ? '#2563eb' : '#d97706'} />
                <div style={{ fontSize: '11px', color: '#334155' }}>
                  Salones que influyen: <strong style={{ color: '#0f172a' }}>{salonOccupancyEnabled.length}</strong>
                  <span style={{ margin: '0 4px', color: '#94a3b8' }}>·</span>
                  Capacidad: <strong style={{ color: '#2563eb' }}>{totalMarkedCapacity.toLocaleString()} PAX/día</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5 Tarjetas KPI Ejecutivas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          {/* Card 1: Meses */}
          <div className="occ-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                Meses Analizados
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconCalendar size={16} color="#4f46e5" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                {monthList.length}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                <strong style={{ color: '#4f46e5' }}>{activeMonths}</strong> {activeMonths === 1 ? 'mes activo' : 'meses activos'}
              </div>
            </div>
          </div>

          {/* Card 2: PAX Total */}
          <div className="occ-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                PAX Ocupados Total
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconUsers size={16} color="#059669" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                {totalPax.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                En <strong style={{ color: '#059669' }}>{totalEvents}</strong> eventos confirmados
              </div>
            </div>
          </div>

          {/* Card 3: Promedio Mensual */}
          <div className="occ-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                Promedio Mensual
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconTrendingUp size={16} color="#d97706" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                {Math.round(avgMonthly).toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                PAX por mes evaluado
              </div>
            </div>
          </div>

          {/* Card 4: Capacidad */}
          <div className="occ-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                Capacidad Diaria
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconBuilding size={16} color="#0284c7" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                {totalMarkedCapacity.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                Meta 11%: <strong style={{ color: '#0284c7' }}>{Math.round(totalMarkedCapacity * META_PCT)} PAX/día</strong>
              </div>
            </div>
          </div>

          {/* Card 5: Cumplimiento */}
          <div className="occ-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                Cumplimiento Meta
              </span>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: paxUtilPct >= 100 ? '#dcfce7' : '#fce7f3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <IconTarget size={16} color={paxUtilPct >= 100 ? '#059669' : '#db2777'} />
              </div>
            </div>
            <div>
              <div style={{
                fontSize: '26px',
                fontWeight: 900,
                color: paxUtilPct >= 100 ? '#059669' : paxUtilPct >= 70 ? '#2563eb' : '#db2777',
                lineHeight: 1.1
              }}>
                {paxUtilPct.toFixed(1)}%
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                vs meta 11% global ({Math.round(totalMeta).toLocaleString()} PAX)
              </div>
            </div>
          </div>
        </div>

        {/* ── Resumen Ejecutivo & Insights (Storytelling) ── */}
        <section className="occ-card" style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 360px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#3b82f6' }}>
                  Análisis del Período
                </span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', lineHeight: 1.6 }}>
                Del <span style={{ color: '#0f172a', fontWeight: 900, background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>{fromDate}</span> al <span style={{ color: '#0f172a', fontWeight: 900, background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>{toDate}</span> se contabilizan <span style={{ color: '#2563eb', fontWeight: 900 }}>{totalPax.toLocaleString()} PAX</span> en <strong style={{ color: '#0f172a' }}>{totalEvents} eventos</strong>, con actividad en <strong style={{ color: '#059669' }}>{activeMonths} de {monthList.length}</strong> meses evaluados.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              {/* Bloque Mes Pico */}
              <div style={{
                background: '#0f172a',
                color: '#ffffff',
                borderRadius: '12px',
                padding: '12px 20px',
                minWidth: '150px',
                boxShadow: '0 4px 12px rgba(15,23,42,0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <IconFlame size={13} color="#f59e0b" />
                  Mes Pico
                </div>
                <div style={{ fontSize: '17px', fontWeight: 900, marginTop: '4px', letterSpacing: '-0.01em' }}>
                  {peakMonth.monthName || 'Sin datos'}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: peakMonth.pct >= 100 ? '#4ade80' : '#fbbf24', marginTop: '2px' }}>
                  {peakMonth.totalPax.toLocaleString()} PAX · {peakMonth.pct.toFixed(1)}% meta
                </div>
              </div>

              {/* Bloque Cumplimiento Meta */}
              <div style={{
                background: paxUtilPct >= 100
                  ? 'linear-gradient(135deg, #065f46 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                color: '#ffffff',
                borderRadius: '12px',
                padding: '12px 20px',
                minWidth: '170px',
                boxShadow: '0 4px 12px rgba(5,150,105,0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#bfdbfe', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <IconCheckCircle size={13} color="#6ee7b7" />
                  Cumplimiento Meta
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, marginTop: '2px', lineHeight: 1.1 }}>
                  {paxUtilPct.toFixed(1)}%
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#e0e7ff', marginTop: '2px' }}>
                  {Math.round(avgMonthly).toLocaleString()} PAX / mes prom.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Gráfico de Barras Mensual Rediseñado ── */}
        <section className="occ-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>
                Visualización Mensual
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '2px 0 0 0', letterSpacing: '-0.02em' }}>
                PAX Ocupados por Mes vs Meta del 11%
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                La línea fucsia representa el objetivo mensual (11% de la capacidad de salones activos). Las barras que tocan o superan la línea alcanzan la meta.
              </p>
            </div>

            {/* Leyenda Ejecutiva */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '11px', fontWeight: 700, color: '#475569' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981', display: 'inline-block' }} /> ≥ 100% Meta
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3b82f6', display: 'inline-block' }} /> 70% – 99%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#6366f1', display: 'inline-block' }} /> 40% – 69%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#a5b4fc', display: 'inline-block' }} /> 1% – 39%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#e2e8f0', display: 'inline-block' }} /> 0%
              </span>
            </div>
          </div>

          {/* Canvas / Chart Scroll Container */}
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #f1f5f9',
            padding: '24px 20px 20px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '12px', minHeight: '340px', minWidth: '520px' }}>
              {/* Y-axis labels */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: '60px',
                flexShrink: 0,
                paddingBottom: '32px'
              }}>
                {[200, 150, 100, 50, 0].map(frac => {
                  const isMeta = frac === 100;
                  const pctCap = (frac / 100) * (META_PCT * 100);
                  return (
                    <div key={frac} style={{
                      fontSize: '10px',
                      fontWeight: isMeta ? 900 : 700,
                      color: isMeta ? '#db2777' : '#94a3b8',
                      textAlign: 'right',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      lineHeight: 1.1
                    }}>
                      <span>{pctCap.toFixed(1)}%</span>
                      <span style={{ fontSize: '8px', color: isMeta ? '#db2777' : '#cbd5e1', fontWeight: 600 }}>
                        {isMeta ? 'META' : `${frac}%`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Bars Graphic Area */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '12px', position: 'relative', minHeight: '300px' }}>
                {/* Cuadrículas horizontales */}
                {[25, 50, 75].map(pctVal => (
                  <div key={pctVal} style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: `${pctVal}%`,
                    borderTop: '1px dashed #e2e8f0',
                    pointerEvents: 'none',
                    zIndex: 0
                  }} />
                ))}

                {/* Línea de META 100% (al 50% de altura del contenedor) */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: '50%',
                  height: '2px',
                  background: '#db2777',
                  boxShadow: '0 0 8px rgba(219,39,119,0.3)',
                  zIndex: 1,
                  pointerEvents: 'none'
                }}>
                  <span style={{
                    position: 'absolute',
                    right: '6px',
                    top: '-10px',
                    fontSize: '9px',
                    fontWeight: 900,
                    color: '#ffffff',
                    background: '#db2777',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    letterSpacing: '0.04em',
                    boxShadow: '0 2px 4px rgba(219,39,119,0.2)'
                  }}>
                    META 11% ({avgMonthlyMeta.toLocaleString()} PAX prom.)
                  </span>
                </div>

                {/* Columnas del gráfico */}
                {chartData.map((d, i) => {
                  const isHovered = hoveredBar === i;
                  const barColor = getBarColor(d.pct, isHovered);
                  const isCurrent = d.monthKey === currentMonthKey;
                  const barHeightPct = d.pct > 0 ? Math.max(3, Math.min(d.pct, 200) / 2) : 0;

                  return (
                    <div
                      key={d.monthKey}
                      style={{
                        flex: '1 1 0',
                        minWidth: '36px',
                        maxWidth: '72px',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        position: 'relative',
                        cursor: 'pointer',
                        zIndex: isHovered ? 10 : 2
                      }}
                      onMouseEnter={(e) => {
                        setHoveredBar(i);
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredBarPos({ x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onMouseLeave={() => { setHoveredBar(null); setHoveredBarPos(null); }}
                    >
                      {/* Valores flotantes arriba de la barra */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        marginBottom: '4px',
                        transition: 'transform 0.15s ease',
                        transform: isHovered ? 'scale(1.1)' : 'scale(1)'
                      }}>
                        {d.totalPax > 0 && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            color: '#0f172a',
                            lineHeight: 1,
                            whiteSpace: 'nowrap'
                          }}>
                            {d.totalPax.toLocaleString()}
                          </span>
                        )}

                        {d.pct > 0 && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 900,
                            color: d.pct >= 100 ? '#059669' : barColor,
                            background: d.pct >= 100 ? '#ecfdf5' : '#f8fafc',
                            border: `1px solid ${d.pct >= 100 ? '#a7f3d0' : '#e2e8f0'}`,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            lineHeight: 1.1
                          }}>
                            {Math.round(d.pct)}%
                          </span>
                        )}
                      </div>

                      {/* Barra Física */}
                      <div style={{
                        width: '100%',
                        height: `${barHeightPct}%`,
                        background: d.pct === 0
                          ? '#f1f5f9'
                          : `linear-gradient(180deg, ${barColor} 0%, ${barColor}dd 100%)`,
                        borderRadius: '6px 6px 0 0',
                        boxShadow: isHovered
                          ? `0 0 16px ${barColor}50, inset 0 1px 0 rgba(255,255,255,0.4)`
                          : 'inset 0 1px 0 rgba(255,255,255,0.2)',
                        transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        transform: isHovered && d.pct > 0 ? 'scaleX(1.1)' : 'scaleX(1)',
                        position: 'relative'
                      }}>
                        {d.pct > 200 && (
                          <span style={{
                            position: 'absolute',
                            top: '3px',
                            right: '3px',
                            fontSize: '7px',
                            fontWeight: 900,
                            color: '#ffffff',
                            background: 'rgba(15,23,42,0.8)',
                            padding: '1px 3px',
                            borderRadius: '3px'
                          }}>
                            +200%
                          </span>
                        )}
                      </div>

                      {/* Etiqueta del Mes en la base */}
                      <div style={{
                        marginTop: '8px',
                        textAlign: 'center',
                        position: 'absolute',
                        bottom: '-22px',
                        whiteSpace: 'nowrap'
                      }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: isCurrent ? 900 : 700,
                          color: isCurrent ? '#2563eb' : '#64748b',
                          background: isCurrent ? '#eff6ff' : 'transparent',
                          border: isCurrent ? '1px solid #bfdbfe' : 'none',
                          padding: isCurrent ? '2px 6px' : '0',
                          borderRadius: '4px'
                        }}>
                          {d.monthShort}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rango de Años al pie */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingLeft: '72px', fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>
              {chartData.length > 0 && <span>{chartData[0].monthName} {chartData[0].year}</span>}
              {chartData.length > 1 && <span>{chartData[chartData.length - 1].monthName} {chartData[chartData.length - 1].year}</span>}
            </div>
          </div>
        </section>

        {/* ── Tooltip Flotante Premium ── */}
        {hoveredData && hoveredBarPos && (() => {
          const d = hoveredData;
          const monthlyCap = totalMarkedCapacity * d.daysInMonth;
          const monthlyMeta = Math.round(monthlyCap * META_PCT);
          const metaHit = d.pct >= 100;
          return (
            <div style={{
              position: 'fixed',
              left: `${Math.min(hoveredBarPos.x, window.innerWidth - 270)}px`,
              top: `${Math.max(15, hoveredBarPos.y - 12)}px`,
              transform: 'translate(-50%, -100%)',
              zIndex: 99999,
              pointerEvents: 'none',
            }}>
              <div style={{
                background: '#0f172a',
                color: '#ffffff',
                padding: '14px 18px',
                borderRadius: '14px',
                fontSize: '11px',
                fontWeight: 600,
                boxShadow: '0 16px 36px rgba(0,0,0,0.35)',
                minWidth: '250px',
                maxWidth: '320px',
                animation: 'tooltipFadeIn 0.15s ease-out both',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 900, marginBottom: '8px', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{d.monthName} {d.year}</span>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: metaHit ? '#065f46' : '#1e293b',
                      color: metaHit ? '#6ee7b7' : '#94a3b8'
                    }}>
                      {d.daysInMonth} días
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 12px', fontSize: '11px', color: '#cbd5e1' }}>
                    <span style={{ color: '#94a3b8' }}>PAX Ocupados:</span>
                    <strong style={{ color: '#ffffff' }}>{d.totalPax.toLocaleString()}</strong>

                    <span style={{ color: '#94a3b8' }}>Eventos:</span>
                    <strong style={{ color: '#ffffff' }}>{d.count}</strong>

                    <span style={{ color: '#94a3b8' }}>Meta (11%):</span>
                    <strong style={{ color: '#f472b6' }}>{monthlyMeta.toLocaleString()} PAX</strong>

                    <span style={{ color: '#94a3b8' }}>% vs Meta:</span>
                    <strong style={{ color: metaHit ? '#4ade80' : '#fbbf24', fontSize: '12px' }}>
                      {Math.round(d.pct)}% {metaHit ? '✓ (Superada)' : ''}
                    </strong>

                    <span style={{ color: '#94a3b8' }}>Capacidad Mes:</span>
                    <span style={{ color: '#e2e8f0' }}>{monthlyCap.toLocaleString()} PAX</span>
                  </div>

                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '9px', color: '#64748b' }}>
                    Fórmula: {d.totalPax.toLocaleString()} ÷ ({totalMarkedCapacity.toLocaleString()} cap. × {d.daysInMonth} días × 11%)
                  </div>
                </div>

                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '6px solid #0f172a',
                }} />
              </div>
            </div>
          );
        })()}

        {/* ── Tabla de Desglose Mensual Rediseñada ── */}
        <section className="occ-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>
                Datos Tabulares
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '2px 0 0 0', letterSpacing: '-0.02em' }}>
                Desglose Detallado por Mes
              </h3>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              {chartData.length} registros mensuales en el rango
            </div>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Mes</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Año</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Eventos</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>PAX Ocupados</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Capacidad Mensual</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Meta (11%)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>% vs Meta</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em', textAlign: 'center' }}>Progreso Meta</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((d) => {
                  const hasActivity = d.totalPax > 0;
                  const monthlyCap = totalMarkedCapacity * d.daysInMonth;
                  const monthlyMeta = Math.round(monthlyCap * META_PCT);
                  const isCurrent = d.monthKey === currentMonthKey;
                  const metaHit = d.pct >= 100;

                  return (
                    <tr
                      key={d.monthKey}
                      className="occ-table-row"
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isCurrent ? '#f0f9ff' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {d.monthName}
                          {isCurrent && (
                            <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#0284c7', color: '#ffffff' }}>
                              Actual
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontWeight: 600 }}>
                        {d.year}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: hasActivity ? '#f1f5f9' : '#f8fafc',
                          color: hasActivity ? '#0f172a' : '#94a3b8',
                          fontWeight: 700,
                          fontSize: '11px'
                        }}>
                          {d.count} {d.count === 1 ? 'evento' : 'eventos'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <strong style={{ color: hasActivity ? '#0f172a' : '#94a3b8', fontSize: '13px' }}>
                          {d.totalPax.toLocaleString()}
                        </strong>
                        <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '4px' }}>
                          / {monthlyCap.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569', fontSize: '11px' }}>
                        {totalMarkedCapacity.toLocaleString()} × {d.daysInMonth}d = <strong style={{ color: '#0f172a' }}>{monthlyCap.toLocaleString()}</strong>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#db2777', fontWeight: 800 }}>
                        {monthlyMeta.toLocaleString()} PAX
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontWeight: 900,
                          fontSize: '11px',
                          background: metaHit ? '#ecfdf5' : d.pct >= 70 ? '#eff6ff' : d.pct >= 40 ? '#f5f3ff' : '#f8fafc',
                          color: metaHit ? '#059669' : d.pct >= 70 ? '#2563eb' : d.pct >= 40 ? '#4f46e5' : '#94a3b8',
                          border: `1px solid ${metaHit ? '#a7f3d0' : d.pct >= 70 ? '#bfdbfe' : d.pct >= 40 ? '#ddd6fe' : '#e2e8f0'}`
                        }}>
                          {Math.round(d.pct)}% {metaHit ? '✓' : ''}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{
                          height: '8px',
                          width: '90px',
                          borderRadius: '999px',
                          background: '#e2e8f0',
                          overflow: 'hidden',
                          margin: '0 auto',
                          position: 'relative'
                        }}>
                          {/* Marca del 100% de la meta */}
                          <div style={{
                            position: 'absolute',
                            left: '50%',
                            top: 0,
                            bottom: 0,
                            width: '2px',
                            background: '#db2777',
                            zIndex: 2
                          }} title="Línea de Meta (100%)" />
                          <div style={{
                            height: '100%',
                            borderRadius: '999px',
                            background: metaHit
                              ? 'linear-gradient(90deg, #10b981, #059669)'
                              : d.pct >= 70
                                ? 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                : 'linear-gradient(90deg, #6366f1, #4f46e5)',
                            width: `${d.pct > 0 ? Math.max(4, Math.min(d.pct, 200) / 2) : 0}%`,
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 900, color: '#0f172a' }}>
                  <td style={{ padding: '14px 16px' }} colSpan={2}>
                    TOTALES / PROMEDIO
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {totalEvents} eventos
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px' }}>
                    {totalPax.toLocaleString()} PAX
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {totalMonthlyCapacity.toLocaleString()} PAX
                  </td>
                  <td style={{ padding: '14px 16px', color: '#db2777' }}>
                    {Math.round(totalMeta).toLocaleString()} PAX
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 10px',
                      borderRadius: '6px',
                      fontWeight: 900,
                      background: paxUtilPct >= 100 ? '#ecfdf5' : '#eff6ff',
                      color: paxUtilPct >= 100 ? '#059669' : '#2563eb',
                      border: `1px solid ${paxUtilPct >= 100 ? '#a7f3d0' : '#bfdbfe'}`
                    }}>
                      {paxUtilPct.toFixed(1)}% global
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', color: '#64748b', fontSize: '11px' }}>
                    Meta Global
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
