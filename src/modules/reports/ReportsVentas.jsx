import { useState, useMemo, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { STATUS_META } from '../calendar/constants';
import ReportInfo from './components/ReportInfo';
import { getEventSeriesFinancialMeta } from './components/eventSeriesUtils';

export default function ReportsVentas({ onClose }) {
  const { events, users, salones } = useOutletContext();
  const sellerUsers = useMemo(() => (users || []).filter(u => {
    const r = String(u.role || '').toLowerCase();
    return r === 'vendedor' || r === 'admin';
  }).sort((a, b) => (a.fullName || a.name || '').localeCompare(b.fullName || b.name || '')), [users]);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(new Set(['Confirmado', 'Pre reserva']));
  const [salonFilter, setSalonFilter] = useState('all');
  const [statusDropOpen, setStatusDropOpen] = useState(false);
  const statusDropRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (statusDropRef.current && !statusDropRef.current.contains(e.target)) {
        setStatusDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
        folio: quote?.folio || '',
        institucion: quote?.companyName || ev.clientName || quote?.contact || '',
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
        total: quote?.totalGtq || quote?.total || 0,
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
        r.eventType?.toLowerCase().includes(term) ||
        r.folio?.toLowerCase().includes(term) ||
        r.institucion?.toLowerCase().includes(term)
      );
    }
    if (dateFrom) filtered = filtered.filter(r => r.eventDate >= dateFrom);
    if (dateTo) filtered = filtered.filter(r => r.eventDate <= dateTo);
    if (userFilter !== 'all') filtered = filtered.filter(r => r.userId === userFilter);
    if (statusFilter.size > 0) filtered = filtered.filter(r => statusFilter.has(r.status));
    if (salonFilter !== 'all') filtered = filtered.filter(r => r.salon === salonFilter || r.salones?.includes(salonFilter));

    return filtered.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }, [events, users, search, dateFrom, dateTo, userFilter, statusFilter, salonFilter]);

  const toggleStatus = (status) => {
    setStatusFilter(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  };

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

  const handleExportExcel = () => {
    const fmtDate = (d) => {
      if (!d) return '';
      return new Date(d + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
    };
    const fmtNum = (n) => {
      return new Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
    };
    const now = new Date();
    const dateLabel = now.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeLabel = now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
    const fromLabel = dateFrom ? fmtDate(dateFrom) : '—';
    const toLabel = dateTo ? fmtDate(dateTo) : '—';
    const userLabel = userFilter !== 'all' ? (users?.find(u => u.id === userFilter)?.fullName || 'Todos') : 'Todos';
    const statusLabel = statusFilter.size > 0 ? `${statusFilter.size} estado(s)` : 'Todos';
    const salonLabel = salonFilter !== 'all' ? salonFilter : 'Todos';

    const totalAmount = reportData.reduce((s, r) => s + (r.total || 0), 0);

    const rowsHtml = reportData.map((r, i) => `
      <tr${i % 2 === 1 ? ' style="background:#f8fafc"' : ''}>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;color:#334155">${r.status || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:700;color:#0f172a">${r.refId || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;color:#334155">${r.folio || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:600;color:#0f172a">${r.institucion || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;color:#475569">${r.userName}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;color:#475569">${r.eventDate}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;color:#334155">${r.eventType || r.name || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;color:#475569;text-align:center">${r.startTime} - ${r.endTime}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;color:#334155">${r.salon}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:700;text-align:center;color:#0f172a">${r.pax}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:700;text-align:right;color:#059669">Q ${fmtNum(r.total)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="ProgId" content="Excel.Sheet">
<style>
  table { border-collapse: collapse; font-family: 'Segoe UI', Arial, sans-serif; width: 100%; }
  th { background: #0f172a; color: #fff; padding: 8px 10px; border: 1px solid #0f172a; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  th.right { text-align: right; }
</style>
</head>
<body>
<table>
  <!-- Title rows -->
  <tr><td colspan="11" style="padding:14px 10px 4px;font-size:9px;color:#64748b;font-weight:700;border:none">EMS RESERVAS · JARDINES DEL LAGO</td></tr>
  <tr><td colspan="11" style="padding:0 10px 2px;font-size:16px;font-weight:900;color:#0f172a;border:none;letter-spacing:-0.02em">Reporte de Ventas</td></tr>
  <tr><td colspan="11" style="padding:0 10px 14px;font-size:11px;color:#475569;border:none">Generado: ${dateLabel} · ${timeLabel}</td></tr>

  <!-- Filter Summary -->
  <tr><td colspan="11" style="padding:4px 10px 10px;border:none">
    <table style="border:1px solid #e2e8f0;border-radius:6px;width:auto;font-size:10px">
      <tr>
        <td style="padding:6px 14px;border:1px solid #e2e8f0;font-weight:700;color:#475569;background:#f8fafc">Periodo</td>
        <td style="padding:6px 14px;border:1px solid #e2e8f0;color:#0f172a;font-weight:600">${fromLabel} → ${toLabel}</td>
        <td style="padding:6px 14px;border:1px solid #e2e8f0;font-weight:700;color:#475569;background:#f8fafc">Vendedor</td>
        <td style="padding:6px 14px;border:1px solid #e2e8f0;color:#0f172a;font-weight:600">${userLabel}</td>
        <td style="padding:6px 14px;border:1px solid #e2e8f0;font-weight:700;color:#475569;background:#f8fafc">Estado</td>
        <td style="padding:6px 14px;border:1px solid #e2e8f0;color:#0f172a;font-weight:600">${statusLabel}</td>
        <td style="padding:6px 14px;border:1px solid #e2e8f0;font-weight:700;color:#475569;background:#f8fafc">Salón</td>
        <td style="padding:6px 14px;border:1px solid #e2e8f0;color:#0f172a;font-weight:600">${salonLabel}</td>
      </tr>
    </table>
  </td></tr>

  <!-- Separator -->
  <tr><td colspan="11" style="padding:0;border:none;height:4px"></td></tr>

  <!-- Column headers -->
  <tr>
    <th>Estado</th>
    <th>Cotización</th>
    <th>No. Folio</th>
    <th>Institución</th>
    <th>Vendedor</th>
    <th>Fecha</th>
    <th>Evento</th>
    <th>Horario</th>
    <th>Salón</th>
    <th>PAX</th>
    <th class="right">Monto</th>
  </tr>

  <!-- Data rows -->
  ${rowsHtml || '<tr><td colspan="11" style="padding:20px;text-align:center;border:1px solid #d1d5db;color:#94a3b8;font-size:12px">Sin datos para los filtros seleccionados.</td></tr>'}

  <!-- Summary row -->
  <tr>
    <td colspan="9" style="padding:8px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:800;color:#0f172a;background:#f1f5f9;text-align:right">Total general · ${reportData.length} evento(s)</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:800;text-align:center;color:#0f172a;background:#f1f5f9">${reportData.reduce((s, r) => s + (r.pax || 0), 0)}</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:12px;font-weight:900;text-align:right;color:#059669;background:#f1f5f9">Q ${fmtNum(totalAmount)}</td>
  </tr>

  <!-- Footer -->
  <tr><td colspan="11" style="padding:12px 10px 4px;font-size:8px;color:#94a3b8;border:none;text-align:center">Jardines del Lago · EMS Reservas · Reporte generado el ${dateLabel} a las ${timeLabel}</td></tr>
</table>
</body>
</html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Ventas_${now.toISOString().split('T')[0]}.xls`;
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
        <ReportInfo reportKey="ventas" />
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
                {sellerUsers.map(u => <option key={u.id} value={u.id}>{u.fullName || u.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Salón</span>
              <select value={salonFilter} onChange={e => setSalonFilter(e.target.value)}>
                <option value="all">Todos</option>
                {salones?.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <div className="field" style={{ minWidth: 220, position: 'relative' }} ref={statusDropRef}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>Estado</span>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 10px 5px 10px',
                border: `1px solid ${statusDropOpen ? '#2563eb' : '#e2e8f0'}`,
                borderRadius: '20px', background: '#ffffff',
                boxShadow: statusDropOpen ? '0 0 0 2px #2563eb30' : '0 1px 3px #00000008',
                transition: 'box-shadow 0.15s, border-color 0.15s',
                minHeight: 36, cursor: 'pointer',
              }}
                onClick={() => setStatusDropOpen(o => !o)}
              >
                {/* Colored dots only */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flex: 1, overflow: 'hidden' }}>
                  {[...statusFilter].map(s => {
                    const color = STATUS_META[s]?.color || '#64748b';
                    return (
                      <span key={s} title={s} style={{
                        width: 10, height: 10, borderRadius: '50%', background: color,
                        flexShrink: 0, boxShadow: `0 0 0 2px ${color}25`,
                      }} />
                    );
                  })}
                  {statusFilter.size === 0 && (
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>Seleccionar...</span>
                  )}
                  {statusFilter.size > 6 && (
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginLeft: '2px' }}>+{statusFilter.size - 6}</span>
                  )}
                </div>
                {/* Arrow */}
                <svg viewBox="0 0 12 12" width="14" height="14" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0, transform: statusDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  <path d="M2 4l4 4 4-4" />
                </svg>
              </div>
              {statusDropOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                  background: '#ffffff', borderRadius: '16px',
                  boxShadow: '0 8px 32px #00000020', zIndex: 999,
                  overflow: 'hidden', padding: '6px',
                }}>
                  {allStatuses.map(s => {
                    const active = statusFilter.has(s);
                    const color = STATUS_META[s]?.color || '#64748b';
                    return (
                      <label key={s} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 10px', cursor: 'pointer',
                        borderRadius: '10px', marginBottom: '2px',
                        transition: 'background 0.1s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = active ? `${color}12` : '#f1f5f9'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* Custom checkbox */}
                        <div style={{
                          width: 18, height: 18, borderRadius: '5px', flexShrink: 0,
                          background: active ? '#2563eb' : '#f1f5f9',
                          border: active ? 'none' : '1.5px solid #cbd5e1',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {active && (
                            <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleStatus(s)}
                          style={{ display: 'none' }}
                        />
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569', flex: 1 }}>{s}</span>
                      </label>
                    );
                  })}
                  {/* Done button */}
                  <div style={{ padding: '8px 10px 4px', borderTop: '1px solid #f1f5f9', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setStatusDropOpen(false)}
                      style={{
                        width: '100%', padding: '8px', borderRadius: '14px',
                        background: '#2563eb', color: '#ffffff',
                        border: 'none', fontSize: '13px', fontWeight: 700,
                        cursor: 'pointer', boxShadow: '0 2px 8px #2563eb40',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#1d4ed8'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#2563eb'; }}
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="reports-actions">
              <button className="btnPrimary" type="button" onClick={handleExportExcel}>Exportar Excel</button>
            </div>
          </div>

          {/* Totales por estado */}
          {(() => {
            const statusCounts = {};
            const statusAmounts = {};
            for (const row of reportData) {
              const s = row.status || 'Sin estado';
              statusCounts[s] = (statusCounts[s] || 0) + 1;
              statusAmounts[s] = (statusAmounts[s] || 0) + row.total;
            }
            const entries = Object.entries(statusCounts);
            if (!entries.length) return null;
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {entries.map(([status, count]) => {
                  const firstRow = reportData.find(r => r.status === status);
                  const c = firstRow?.statusColor || '#64748b';
                  const amount = statusAmounts[status] || 0;
                  return (
                    <div key={status} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: `${c}10`, border: `1px solid ${c}30`,
                      borderRadius: '10px', padding: '8px 14px',
                    }}>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: c, display: 'inline-block', flexShrink: 0,
                      }} />
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: c }}>{status}</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                          {count} eventos · {formatMoney(amount)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Event Table */}
          <div className="reports-table-wrap" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Cotización</th>
                  <th>No. Folio</th>
                  <th>Institución</th>
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
                    <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
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
                    <td style={{ fontWeight: 600, color: '#334155' }}>{r.folio || '-'}</td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{r.institucion || '-'}</td>
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
