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
    'Pre reserva', 'Reserva sin Cotizacion', '1er Cotizacion', 'Seguimiento',
    'Lista de Espera', 'Confirmado', 'Cancelado', 'Mantenimiento', 'Perdido', 'Realizado'
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
    if (dateFrom) filtered = filtered.filter(r => r.eventDate >= dateFrom);
    if (dateTo) filtered = filtered.filter(r => r.eventDate <= dateTo);
    if (userFilter !== 'all') filtered = filtered.filter(r => r.userId === userFilter);
    if (statusFilter !== 'all') filtered = filtered.filter(r => r.status === statusFilter);
    if (salonFilter !== 'all') filtered = filtered.filter(r => r.salon === salonFilter || r.salones?.includes(salonFilter));

    return filtered.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }, [events, users, search, dateFrom, dateTo, userFilter, statusFilter, salonFilter]);

  const summary = useMemo(() => {
    const totalEvents = reportData.length;
    const totalPax = reportData.reduce((sum, r) => sum + (r.pax || 0), 0);
    const totalVentas = reportData.reduce((sum, r) => sum + (r.total || 0), 0);
    const confirmados = reportData.filter(r => r.status === 'Confirmado').length;
    return { totalEvents, totalPax, totalVentas, confirmados };
  }, [reportData]);

  const conversionPct = useMemo(() => {
    const confirmedCount = reportData.filter((r) => r.status === 'Confirmado').length;
    return reportData.length ? Math.round((confirmedCount / reportData.length) * 100) : 0;
  }, [reportData]);

  const avgTicket = useMemo(() => {
    const totalAmount = reportData.reduce((sum, r) => sum + (r.total || 0), 0);
    return reportData.length ? (totalAmount / reportData.length) : 0;
  }, [reportData]);

  const topSeller = useMemo(() => {
    const map = new Map();
    for (const row of reportData) {
      const seller = String(row?.userName || "Sin vendedor").trim() || "Sin vendedor";
      map.set(seller, Number(map.get(seller) || 0) + Math.max(0, Number(row?.total || 0)));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }, [reportData]);

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
    const rows = reportData.map(r => [r.status, r.refId, r.userName, r.eventDate, r.eventType, `${r.startTime} - ${r.endTime}`, r.salon, r.pax, r.total]);
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
    <div className="reports-page-container">
      {/* Header */}
      <div className="reports-page-header">
        <div className="reports-brand-header">
          <div className="reports-brand-badge">
            <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
          </div>
          <div>
            <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
            <div className="reports-title">Reporte de Ventas</div>
            <div className="reports-subtitle">Pipeline comercial, cotizaciones y facturación</div>
          </div>
        </div>
        <button className="btn-exit" type="button" onClick={onClose}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver
        </button>
      </div>

      {/* Body */}
      <div className="reports-page-body">
        {/* KPI Bento Grid */}
        <section className="reports-hero-panel">
          <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#2563eb' }}>
              <span className="reports-eyebrow">Eventos en cartera</span>
              <strong>{summary.totalEvents}</strong>
              <span style={{ fontSize: 12, color: '#64748b' }}>{summary.confirmados} confirmados</span>
            </div>
            <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#16a34a', gridColumn: 'span 2' }}>
              <span className="reports-eyebrow">Facturación</span>
              <strong>{formatMoney(summary.totalVentas)}</strong>
              <span style={{ fontSize: 12, color: '#64748b' }}>valor total</span>
            </div>
            <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#2563eb' }}>
              <span className="reports-eyebrow">PAX Totales</span>
              <strong>{summary.totalPax.toLocaleString()}</strong>
              <span style={{ fontSize: 12, color: '#64748b' }}>personas atendidas</span>
            </div>
            <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#f59e0b' }}>
              <span className="reports-eyebrow">Ticket Promedio</span>
              <strong>{formatMoney(avgTicket)}</strong>
              <span style={{ fontSize: 12, color: '#64748b' }}>por reserva</span>
            </div>
            <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#8b5cf6' }}>
              <span className="reports-eyebrow">Conversión</span>
              <strong>{conversionPct}%</strong>
              <span style={{ fontSize: 12, color: '#64748b' }}>confirmados</span>
            </div>
            {topSeller && (
              <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#06b6d4' }}>
                <span className="reports-eyebrow">Vendedor Top</span>
                <strong style={{ fontSize: 16 }}>{topSeller}</strong>
                <span style={{ fontSize: 12, color: '#64748b' }}>mayor ingreso</span>
              </div>
            )}
          </div>
        </section>

        {/* Filters + Table */}
        <section className="reports-hero-panel" style={{ gap: '12px' }}>
          <div className="reports-toolbar">
            <label className="field">
              <span>Buscar</span>
              <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
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
                <option value="all">Todos</option>
                {users?.map(u => <option key={u.id} value={u.id}>{u.fullName || u.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Estado</span>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">Todos</option>
                {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Salón</span>
              <select value={salonFilter} onChange={e => setSalonFilter(e.target.value)}>
                <option value="all">Todos</option>
                {salones?.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <div className="reports-actions">
              <button type="button" onClick={clearFilters}>Limpiar</button>
              <button className="btnPrimary" type="button" onClick={handleExportExcel}>Exportar Excel</button>
            </div>
          </div>

          {/* Event Table */}
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Cotización</th>
                  <th>Vendedor</th>
                  <th>Fecha</th>
                  <th>Evento</th>
                  <th>Horario</th>
                  <th>Salón</th>
                  <th>PAX</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {reportData.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      Sin eventos para los filtros seleccionados.
                    </td>
                  </tr>
                ) : reportData.map(r => (
                  <tr key={r.id}>
                    <td>
                      <span className="reports-table-status" style={{
                        background: `${r.statusColor}18`,
                        color: r.statusColor,
                        border: `1px solid ${r.statusColor}30`,
                      }}>
                        {r.status || '-'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>{r.refId}</td>
                    <td>{r.userName}</td>
                    <td>{r.eventDate}</td>
                    <td>{r.eventType || r.name}</td>
                    <td>{r.startTime} - {r.endTime}</td>
                    <td>{r.salon}</td>
                    <td style={{ fontWeight: 700, textAlign: 'center' }}>{r.pax}</td>
                    <td style={{ fontWeight: 700, textAlign: 'right', color: '#059669' }}>{formatMoney(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
