import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { STATUS_META } from '../calendar/constants';

export default function ReportsVentas({ onClose }) {
  const { events, users, salones } = useOutletContext();
  
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salonFilter, setSalonFilter] = useState('all');

  // Series utilities modeled after original legacy app.js
  const getEventSeries = (ev, allEvents) => {
    if (!ev) return [];
    if (!ev.groupId) return [ev];
    return allEvents.filter(x => x.groupId === ev.groupId);
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

  const reportData = useMemo(() => {
    if (!events) return [];
    
    const rows = [];
    const seenReservations = new Set();
    
    for (const ev of events) {
      const reservationKey = ev.groupId || ev.id;
      if (reservationKey) {
        if (seenReservations.has(reservationKey)) continue;
        seenReservations.add(reservationKey);
      }
      
      const financialMeta = getEventSeriesFinancialMeta(ev, events);
      const primaryEvent = financialMeta.primaryEvent || ev;
      const quote = primaryEvent?.quote || ev?.quote || {};
      const assignedUser = users?.find(u => u.id === (primaryEvent?.userId || ev?.userId));
      
      rows.push({
        id: ev.id,
        refId: quote?.code || reservationKey || primaryEvent?.id || ev?.id || '',
        name: primaryEvent?.name || ev?.name || '',
        eventDate: financialMeta.startDate || primaryEvent?.date || ev?.date || '',
        endDate: financialMeta.endDate || financialMeta.startDate || ev?.date || '',
        startTime: financialMeta.startTime || primaryEvent?.startTime || ev?.startTime || '',
        endTime: financialMeta.endTime || primaryEvent?.endTime || ev?.endTime || '',
        salon: financialMeta.mainSalon || primaryEvent?.salon || ev?.salon || '',
        status: primaryEvent?.status || ev?.status || '',
        userId: primaryEvent?.userId || ev?.userId,
        userName: assignedUser?.fullName || assignedUser?.name || 'Sin asignar',
        clientName: ev.clientName || quote?.companyName || quote?.contact || '',
        pax: Number(primaryEvent?.pax || ev?.pax || quote?.people || 0),
        quote: quote,
        total: quote?.total || 0,
        subtotal: quote?.subtotal || 0,
        discount: quote?.discountValue || 0,
        salones: financialMeta.salones,
        eventType: quote?.eventType || primaryEvent?.name || ev?.name || '',
        statusColor: STATUS_META[primaryEvent?.status || ev?.status]?.color || '#64748b'
      });
    }

    let filtered = rows;

    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(r => 
        r.name?.toLowerCase().includes(term) ||
        r.clientName?.toLowerCase().includes(term) ||
        r.salon?.toLowerCase().includes(term) ||
        r.userName?.toLowerCase().includes(term) ||
        r.refId?.toLowerCase().includes(term) ||
        r.eventType?.toLowerCase().includes(term)
      );
    }

    if (dateFrom) {
      filtered = filtered.filter(r => r.eventDate >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(r => r.eventDate <= dateTo);
    }

    if (userFilter !== 'all') {
      filtered = filtered.filter(r => r.userId === userFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (salonFilter !== 'all') {
      filtered = filtered.filter(r => r.salon === salonFilter || r.salones?.includes(salonFilter));
    }

    return filtered.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }, [events, users, search, dateFrom, dateTo, userFilter, statusFilter, salonFilter]);

  const summary = useMemo(() => {
    const totalEvents = reportData.length;
    const totalPax = reportData.reduce((sum, r) => sum + (r.pax || 0), 0);
    const totalVentas = reportData.reduce((sum, r) => sum + (r.total || 0), 0);
    const confirmados = reportData.filter(r => r.status === 'Confirmado').length;
    const cotizaciones = reportData.filter(r => r.status === '1er Cotizacion' || r.quote?.items?.length > 0).length;
    
    return { totalEvents, totalPax, totalVentas, confirmados, cotizaciones };
  }, [reportData]);

  const pipelinePct = useMemo(() => {
    const totalUnfiltered = events ? new Set(events.map(ev => ev.groupId || ev.id)).size : 0;
    return totalUnfiltered ? Math.max(0, Math.round((reportData.length / totalUnfiltered) * 100)) : 0;
  }, [events, reportData]);

  const conversionPct = useMemo(() => {
    const confirmedCount = reportData.filter((r) => r.status === 'Confirmado').length;
    return reportData.length ? Math.max(0, Math.round((confirmedCount / reportData.length) * 100)) : 0;
  }, [reportData]);

  const avgTicket = useMemo(() => {
    const totalAmount = reportData.reduce((sum, r) => sum + (r.total || 0), 0);
    return reportData.length ? (totalAmount / reportData.length) : 0;
  }, [reportData]);

  const topSeller = useMemo(() => {
    const topSellerMap = new Map();
    for (const row of reportData) {
      const seller = String(row?.userName || "Sin vendedor").trim() || "Sin vendedor";
      topSellerMap.set(seller, Number(topSellerMap.get(seller) || 0) + Math.max(0, Number(row?.total || 0)));
    }
    const sorted = Array.from(topSellerMap.entries()).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));
    return sorted[0]?.[0] || null;
  }, [reportData]);

  const getInitials = (name) => {
    if (!name || name === 'Sin asignar') return 'SA';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return 'SA';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getFilterSummaryText = () => {
    const parts = [];
    if (dateFrom || dateTo) parts.push(`Rango: ${dateFrom || "..."} a ${dateTo || "..."}`);
    if (userFilter && userFilter !== 'all') {
      const u = users?.find(x => x.id === userFilter);
      parts.push(`Vendedor: ${u?.fullName || u?.name}`);
    }
    if (statusFilter && statusFilter !== 'all') parts.push(`Estado: ${statusFilter}`);
    if (salonFilter && salonFilter !== 'all') parts.push(`Salon: ${salonFilter}`);
    if (search) parts.push(`Buscar: ${search}`);
    return parts.length ? parts.join(" | ") : "Sin filtros";
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(amount || 0);
  };

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setUserFilter('all');
    setStatusFilter('all');
    setSalonFilter('all');
  };

  const handleExportExcel = () => {
    const headers = ['Estado', 'ID Cotización', 'Vendedor', 'Fecha', 'Evento', 'Horario', 'Salón', 'PAX', 'Monto'];
    const rows = reportData.map(r => [
      r.status,
      r.refId,
      r.userName,
      r.eventDate,
      r.eventType,
      `${r.startTime} - ${r.endTime}`,
      r.salon,
      r.pax,
      r.total
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_ventas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="modalBackdrop" id="salesReportBackdrop" onClick={(e) => { if (e.target.id === 'salesReportBackdrop') onClose(); }}>
      <style>{`
        #salesReportBackdrop .salesReportModal {
          width: min(1180px, calc(100vw - 32px)) !important;
          max-height: 96vh !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.4) !important;
        }
        #salesReportBackdrop .salesReportBody {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          padding: 16px 24px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 14px !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
        #salesReportBackdrop .salesReportHeroPanel {
          padding: 12px 18px !important;
          margin-bottom: 0 !important;
          border-radius: 16px !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
        }
        #salesReportBackdrop .reportSectionIntro {
          margin-bottom: 8px !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-start !important;
        }
        #salesReportBackdrop .reportSectionEyebrow {
          font-size: 9px !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          color: #64748b !important;
          letter-spacing: 0.05em !important;
        }
        #salesReportBackdrop .reportSectionTitle {
          font-size: 16px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          margin-top: 2px !important;
        }
        #salesReportBackdrop .reportSectionText {
          font-size: 11px !important;
          color: #64748b !important;
          margin-top: 2px !important;
        }
        #salesReportBackdrop .reportFilterMeta {
          font-size: 11px !important;
          font-weight: 700 !important;
          color: #1e3a5f !important;
          background: #e0f2fe !important;
          padding: 4px 10px !important;
          border-radius: 999px !important;
        }
        #salesReportBackdrop .salesReportSummary {
          display: grid !important;
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          gap: 10px !important;
        }
        #salesReportBackdrop .salesSummaryCard {
          min-width: 0 !important;
          min-height: 84px !important;
          padding: 8px 12px !important;
          gap: 2px !important;
          border-radius: 10px !important;
          border: 1px solid #cbd5e1 !important;
        }
        #salesReportBackdrop .salesSummaryCard strong {
          font-size: 1.4rem !important;
          font-weight: 800 !important;
        }
        #salesReportBackdrop .salesSummaryCard small {
          font-size: 10.5px !important;
          font-weight: 700 !important;
        }
        #salesReportBackdrop .salesSummaryEyebrow {
          font-size: 9px !important;
          font-weight: 800 !important;
        }
        #salesReportBackdrop .salesSummaryMeta {
          padding: 2px 8px !important;
          font-size: 9.5px !important;
          margin-top: 4px !important;
          font-weight: 700 !important;
        }
        #salesReportBackdrop .salesSummaryIcon {
          font-size: 18px !important;
        }
        #salesReportBackdrop .salesReportFiltersInline {
          grid-template-columns: repeat(6, 1fr) !important;
          gap: 8px !important;
          padding: 12px 16px !important;
          background: #f8fafc !important;
          border-radius: 12px !important;
          border: 1px solid #cbd5e1 !important;
          align-items: flex-end !important;
        }
        #salesReportBackdrop .salesReportFiltersInline .field {
          margin-bottom: 0 !important;
          display: flex !important;
          flex-direction: column !important;
        }
        #salesReportBackdrop .salesReportFiltersInline .field span {
          font-size: 10px !important;
          font-weight: 700 !important;
          color: #475569 !important;
          margin-bottom: 4px !important;
          text-transform: uppercase !important;
        }
        #salesReportBackdrop .salesReportFiltersInline input,
        #salesReportBackdrop .salesReportFiltersInline select {
          padding: 6px 8px !important;
          font-size: 12px !important;
          height: 32px !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-weight: 600 !important;
        }
        #salesReportBackdrop .salesReportActions {
          grid-column: span 6 !important;
          margin-top: 6px !important;
          display: flex !important;
          gap: 8px !important;
          justify-content: flex-end !important;
        }
        #salesReportBackdrop .salesReportActions button {
          height: 32px !important;
          padding: 0 16px !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          border-radius: 6px !important;
        }
        #salesReportBackdrop .salesReportTableWrap {
          flex: 1 1 auto !important;
          min-height: 260px !important;
          max-height: none !important;
          margin-top: 4px !important;
          border-radius: 12px !important;
          border: 1px solid #cbd5e1 !important;
          overflow: auto !important;
        }
        #salesReportBackdrop .salesReportTable {
          min-width: 980px !important;
          table-layout: fixed !important;
        }
        #salesReportBackdrop .salesReportTable th:nth-child(1),
        #salesReportBackdrop .salesReportTable td:nth-child(1) { width: 130px !important; }
        #salesReportBackdrop .salesReportTable th:nth-child(2),
        #salesReportBackdrop .salesReportTable td:nth-child(2) { width: 150px !important; }
        #salesReportBackdrop .salesReportTable th:nth-child(3),
        #salesReportBackdrop .salesReportTable td:nth-child(3) { width: 160px !important; }
        #salesReportBackdrop .salesReportTable th:nth-child(4),
        #salesReportBackdrop .salesReportTable td:nth-child(4) { width: 110px !important; }
        #salesReportBackdrop .salesReportTable th:nth-child(5),
        #salesReportBackdrop .salesReportTable td:nth-child(5) { width: 190px !important; }
        #salesReportBackdrop .salesReportTable th:nth-child(6),
        #salesReportBackdrop .salesReportTable td:nth-child(6) { width: 120px !important; }
        #salesReportBackdrop .salesReportTable th:nth-child(7),
        #salesReportBackdrop .salesReportTable td:nth-child(7) { width: 160px !important; }
        #salesReportBackdrop .salesReportTable th:nth-child(8),
        #salesReportBackdrop .salesReportTable td:nth-child(8) { width: 70px !important; }
        #salesReportBackdrop .salesReportTable th:nth-child(9),
        #salesReportBackdrop .salesReportTable td:nth-child(9) { width: 110px !important; }
        #salesReportBackdrop .salesReportTable thead th {
          padding: 8px 10px !important;
          font-size: 10.5px !important;
          font-weight: 800 !important;
        }
        #salesReportBackdrop .salesReportTable tbody td {
          padding: 8px 10px !important;
          font-size: 12px !important;
        }
        #salesReportBackdrop .salesSellerAvatar {
          width: 24px !important;
          height: 24px !important;
          font-size: 10px !important;
        }
        @media (max-width: 1180px) {
          #salesReportBackdrop .salesReportSummary {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
          #salesReportBackdrop .salesReportFiltersInline {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
          #salesReportBackdrop .salesReportActions {
            grid-column: span 3 !important;
          }
        }
        @media (max-width: 760px) {
          #salesReportBackdrop .salesReportSummary,
          #salesReportBackdrop .salesReportFiltersInline {
            grid-template-columns: 1fr !important;
          }
          #salesReportBackdrop .salesReportActions {
            grid-column: span 1 !important;
            justify-content: stretch !important;
          }
          #salesReportBackdrop .salesReportActions button {
            flex: 1 1 0;
          }
        }
      `}</style>

      <div className="modal salesReportModal" role="dialog" aria-modal="true" aria-labelledby="salesReportTitle" style={{ width: '100%', maxWidth: '1400px' }}>
        <div className="modalHeader">
          <div className="reportBrandHeader">
            <div className="reportBrandBadge salesReportBrandBadge">
              <img src="/Oficial_JDL_acua.png" alt="Logo Jardines del Lago" className="reportBrandLogo salesReportBrandLogo" />
            </div>
            <div className="reportBrandCopy">
              <div className="reportBrandEyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="modalTitle" id="salesReportTitle">Reporte de ventas</div>
              <div className="modalSubtitle" id="salesReportSubtitle">Listado de eventos y cotizaciones con lectura ejecutiva</div>
            </div>
          </div>
          <button className="iconBtn" id="btnSalesReportClose" type="button" title="Cerrar" onClick={onClose}>&#10005;</button>
        </div>

        <div className="modalBody salesReportBody">
          <section className="reportHeroPanel salesReportHeroPanel">
            <div className="reportSectionIntro">
              <div>
                <div className="reportSectionEyebrow">Vision comercial</div>
                <div className="reportSectionTitle">Seguimiento premium del pipeline y la facturacion</div>
                <div className="reportSectionText">Filtra rapido, detecta volumen, vendedores y estados clave sin perder contexto operativo.</div>
              </div>
              <div className="reportFilterMeta" id="salesReportFiltersMeta">{getFilterSummaryText()}</div>
            </div>
            
            {/* Sales Summary Cards */}
            <div className="salesReportSummary" id="salesReportSummary">
              <article className="salesSummaryCard salesSummaryCard--primary" title="Pipeline = cuantos registros u oportunidades tienes activas en el flujo">
                <div className="salesSummaryHead">
                  <span className="salesSummaryIcon material-symbols-outlined">inventory_2</span>
                  <span className="salesSummaryTrend">+{pipelinePct}%</span>
                </div>
                <span className="salesSummaryEyebrow">Pipeline</span>
                <small>Registros visibles</small>
                <strong>{summary.totalEvents}</strong>
                <div className="salesSummaryMeta">Registros visibles</div>
              </article>

              <article className="salesSummaryCard salesSummaryCard--success" title="Conversion = cuantas ya pasaron a confirmados">
                <div className="salesSummaryHead">
                  <span className="salesSummaryIcon material-symbols-outlined">check_circle</span>
                  <span className="salesSummaryTrend">{conversionPct}%</span>
                </div>
                <span className="salesSummaryEyebrow">Conversion</span>
                <small>Confirmado</small>
                <strong>{summary.confirmados}</strong>
                <div className="salesSummaryMeta">Confirmado</div>
              </article>

              <article className="salesSummaryCard salesSummaryCard--info" title="Capacidad = volumen o PAX asociado">
                <div className="salesSummaryHead">
                  <span className="salesSummaryIcon material-symbols-outlined">groups</span>
                </div>
                <span className="salesSummaryEyebrow">Capacidad</span>
                <small>PAX total</small>
                <strong>{summary.totalPax.toLocaleString()}</strong>
                <div className="salesSummaryMeta">PAX total</div>
              </article>

              <article className="salesSummaryCard salesSummaryCard--ticket" title="Ticket Promedio = Por evento">
                <div className="salesSummaryHead">
                  <span className="salesSummaryIcon material-symbols-outlined">payments</span>
                </div>
                <span className="salesSummaryEyebrow">Ticket Promedio</span>
                <small>Por evento</small>
                <strong>{formatMoney(avgTicket)}</strong>
                <div className="salesSummaryMeta">Por evento</div>
              </article>

              <article className="salesSummaryCard salesSummaryCard--accent" title="Facturacion = cuanto dinero representa ese pipeline o lo ya cerrado">
                <div className="salesSummaryHead">
                  <span className="salesSummaryIcon material-symbols-outlined">trending_up</span>
                  {topSeller && <span className="salesSummaryTrend">Top: {topSeller}</span>}
                </div>
                <span className="salesSummaryEyebrow">Facturacion</span>
                <small>Total cotizado</small>
                <strong>{formatMoney(summary.totalVentas)}</strong>
                <div className="salesSummaryMeta">{topSeller ? `Top vendedor ${topSeller}` : 'Total cotizado'}</div>
              </article>
            </div>
          </section>

          <section className="reportDataSection salesReportDataSection">
            <div className="salesReportFilters salesReportFiltersInline">
              <label className="field">
                <span>Buscar</span>
                <input 
                  id="salesReportSearch" 
                  type="text" 
                  placeholder="Buscar..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Desde</span>
                <input 
                  id="salesReportFrom" 
                  type="date" 
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input 
                  id="salesReportTo" 
                  type="date" 
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Vendedor</span>
                <select 
                  id="salesReportUser"
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                >
                  <option value="all">Todos</option>
                  {users?.map(u => (
                    <option key={u.id} value={u.id}>{u.fullName || u.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Estado</span>
                <select 
                  id="salesReportStatus"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="all">Todos</option>
                  {allStatuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Salón</span>
                <select 
                  id="salesReportSalon"
                  value={salonFilter}
                  onChange={e => setSalonFilter(e.target.value)}
                >
                  <option value="all">Todos</option>
                  {salones?.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <div className="rightActions salesReportActions">
                <button className="btn" id="btnSalesReportReset" type="button" onClick={clearFilters}>Limpiar</button>
                <button className="btnPrimary" id="btnSalesReportExportExcel" type="button" onClick={handleExportExcel} style={{ background: '#059669', color: 'white', fontWeight: '700' }}>Exportar Excel</button>
              </div>
            </div>

            <div className="salesReportTableWrap" style={{ overflowX: 'auto' }}>
              <table className="quoteTable salesReportTable">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>ID Cotización</th>
                    <th>Vendedor</th>
                    <th>Fecha</th>
                    <th>Evento</th>
                    <th>Horario</th>
                    <th>Salón</th>
                    <th>PAX</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                        Sin resultados para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    reportData.map(r => (
                      <tr key={r.id}>
                        <td>
                          <span className="salesStatusBadge" style={{
                            background: `${r.statusColor}25`,
                            borderColor: `${r.statusColor}60`,
                            color: '#0f172a',
                            border: '1px solid',
                            padding: '3px 8px',
                            borderRadius: '999px',
                            fontSize: '10.5px',
                            fontWeight: '700'
                          }}>
                            {r.status || "-"}
                          </span>
                        </td>
                        <td style={{ fontWeight: '700', color: '#1e293b' }}>{r.refId}</td>
                        <td className="salesSellerCell" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="salesSellerAvatar" style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#e2e8f0',
                            color: '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: '700'
                          }}>
                            {getInitials(r.userName)}
                          </span>
                          <span style={{ fontWeight: '500' }}>{r.userName || "-"}</span>
                        </td>
                        <td>{r.eventDate}</td>
                        <td style={{ fontWeight: '600', color: '#0f172a' }}>{r.eventType}</td>
                        <td>{r.startTime} - {r.endTime}</td>
                        <td>{r.salon}</td>
                        <td style={{ textAlign: 'center', fontWeight: '600' }}>{r.pax}</td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: '#059669' }}>{formatMoney(r.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
