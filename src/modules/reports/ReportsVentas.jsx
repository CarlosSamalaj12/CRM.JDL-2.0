import { useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { STATUS_META } from '../calendar/constants';
import ReportInfo from './components/ReportInfo';
import MultiSelect from './components/MultiSelect';
import { getEventSeries, getEventSeriesFinancialMeta } from './components/eventSeriesUtils';

// PAX correcto de una reserva, respetando paxCompartido:
// - true  → todos los slots comparten el mismo PAX (toma el del primer slot con valor)
// - false → cada slot tiene su propio PAX (se suman)
function getReservationPax(reservation, allEvents) {
  const series = getEventSeries(reservation, allEvents);
  if (!series.length) return Number(reservation?.pax || 0) || 0;
  const first = series[0];
  const isShared =
    first?.paxCompartido === true || first?.PaxCompartido === true ||
    first?.paxCompartido === 1    || first?.PaxCompartido === 1;
  if (isShared) {
    const anyWithPax = series.find(s => Number(s.pax) > 0) || first;
    return Number(anyWithPax?.pax || anyWithPax?.quote?.people || 0) || 0;
  }
  return series.reduce((acc, s) => acc + (Math.max(0, Number(s?.pax)) || 0), 0);
}

export default function ReportsVentas({ onClose }) {
  const { events, users, salones } = useOutletContext();
  const navigate = useNavigate();
  const sellerUsers = useMemo(() => (users || []).filter(u => {
    const r = String(u.role || '').toLowerCase();
    return r === 'vendedor' || r === 'admin';
  }).sort((a, b) => (a.fullName || a.name || '').localeCompare(b.fullName || b.name || '')), [users]);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState(new Set()); // Set vacío = "Todos"
  const [statusFilter, setStatusFilter] = useState(new Set(['Confirmado', 'Pre reserva']));
  const [salonFilter, setSalonFilter] = useState(new Set()); // Set vacío = "Todos"

  const allStatuses = [
    'Pre reserva', 'Reserva sin Cotizacion', '1er Cotizacion', 'Seguimiento',
    'Lista de Espera', 'Confirmado', 'Cancelado', 'Perdido'
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

      // Fecha I = fecha inicial de la serie de la reserva (viene de "FECHA INICIAL" del formulario)
      // Fecha F = fecha final de la serie de la reserva (viene de "FECHA FINAL" del formulario)
      const slotStartDate = String(financialMeta.startDate || primaryEvent?.eventDateStart || primaryEvent?.date || ev?.eventDateStart || ev?.date || '').trim();
      const slotEndDate = String(financialMeta.endDate || primaryEvent?.eventDateEnd || primaryEvent?.endDate || ev?.eventDateEnd || ev?.endDate || slotStartDate).trim();

      rows.push({
        id: ev.id,
        refId: quote?.code || reservationKey || primaryEvent?.id || ev?.id || '',
        folio: quote?.folio || '',
        institucion: quote?.companyName || ev.clientName || quote?.contact || '',
        name: primaryEvent?.name || ev?.name || '',
        eventDate: slotStartDate,
        endDate: slotEndDate,
        startTime: financialMeta.startTime || primaryEvent?.startTime || ev?.startTime || '',
        endTime: financialMeta.endTime || primaryEvent?.endTime || ev?.endTime || '',
        salon: financialMeta.mainSalon || primaryEvent?.salon || ev?.salon || '',
        status: primaryEvent?.status || ev?.status || '',
        userId: primaryEvent?.userId || ev?.userId,
        userName: assignedUser?.fullName || assignedUser?.name || 'Sin asignar',
        clientName: ev.clientName || quote?.companyName || quote?.contact || '',
        pax: getReservationPax(ev, events),
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
    if (userFilter.size > 0) filtered = filtered.filter(r => userFilter.has(r.userId));
    if (statusFilter.size > 0) filtered = filtered.filter(r => statusFilter.has(r.status));
    if (salonFilter.size > 0) {
      filtered = filtered.filter(r => {
        const list = Array.isArray(r.salones) ? r.salones : [];
        return salonFilter.has(r.salon) || list.some(s => salonFilter.has(s));
      });
    }

    return filtered.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }, [events, users, search, dateFrom, dateTo, userFilter, statusFilter, salonFilter]);

  // Los KPIs se calculan sobre reportData, que ya respeta TODOS los filtros
  // (búsqueda + fechas + vendedor + dropdown de estado + salón + dedupe por groupId).
  // Si el usuario cambia los estados seleccionados abajo, los KPIs cambian en consecuencia.
  const summary = useMemo(() => {
    const totalEvents = reportData.length;
    const totalPax = reportData.reduce((sum, r) => sum + (r.pax || 0), 0);
    const totalVentas = reportData.reduce((sum, r) => sum + (r.total || 0), 0);
    const confirmados = reportData.filter(r => r.status === 'Confirmado').length;
    return { totalEvents, totalPax, totalVentas, confirmados };
  }, [reportData]);

  // Conversión = Confirmados / total de reservas en estados de pipeline activo.
  // Estados de pipeline activo: Pre reserva, 1er Cotizacion, Seguimiento, Lista de Espera, Confirmado.
  // Se calcula sobre los eventos que pasan los filtros "fuertes" (búsqueda, fechas, vendedor, salón),
  // ignorando el dropdown de estado para que el KPI no se anule al cambiarlo.
  const conversionPct = useMemo(() => {
    if (!events) return 0;
    const PIPELINE_STATUSES = new Set(['Pre reserva', '1er Cotizacion', 'Seguimiento', 'Lista de Espera', 'Confirmado']);

    const term = search.trim().toLowerCase();
    const inDateRange = (d) => {
      if (!d) return true;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    };
    const userMatches = (ev) => userFilter.size === 0 || userFilter.has(ev.userId);
    const salonMatches = (ev) => {
      if (salonFilter.size === 0) return true;
      const mainSalon = ev.salon || '';
      const list = Array.isArray(ev.salones) ? ev.salones : [];
      return salonFilter.has(mainSalon) || list.some(s => salonFilter.has(s));
    };
    const textMatches = (ev, primaryEvent) => {
      if (!term) return true;
      const assignedUser = users?.find(u => u.id === (primaryEvent?.userId || ev?.userId));
      const userName = assignedUser?.fullName || assignedUser?.name || '';
      const quote = primaryEvent?.quote || ev?.quote || {};
      const haystack = [
        primaryEvent?.name || ev?.name,
        ev.clientName || quote.companyName || quote.contact,
        primaryEvent?.salon || ev?.salon,
        userName,
        quote.code,
        quote.eventType,
        quote.folio,
        quote.companyName,
      ].map(v => String(v || '').toLowerCase());
      return haystack.some(v => v.includes(term));
    };

    // Dedupe por groupId|id sobre el set de eventos en pipeline
    const seen = new Set();
    const reservations = [];
    for (const ev of events) {
      if (!PIPELINE_STATUSES.has(ev.status)) continue;
      const key = ev.groupId || ev.id;
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      reservations.push(ev);
    }

    let pipelineCount = 0;
    let confirmedCount = 0;
    for (const ev of reservations) {
      const financialMeta = getEventSeriesFinancialMeta(ev, events);
      const primaryEvent = financialMeta.primaryEvent || ev;
      const eventDate = financialMeta.startDate || primaryEvent?.date || ev?.date || '';
      if (!inDateRange(eventDate)) continue;
      if (!userMatches(primaryEvent)) continue;
      if (!salonMatches(primaryEvent)) continue;
      if (!textMatches(ev, primaryEvent)) continue;

      pipelineCount += 1;
      if (primaryEvent.status === 'Confirmado') confirmedCount += 1;
    }

    return pipelineCount > 0 ? Math.round((confirmedCount / pipelineCount) * 100) : 0;
  }, [events, users, search, dateFrom, dateTo, userFilter, salonFilter]);

  // Ticket Promedio PAX = Total Venta / Total PAX (precio por persona)
  const avgTicket = useMemo(() => {
    const totalAmount = reportData.reduce((sum, r) => sum + (r.total || 0), 0);
    const totalPaxSum = reportData.reduce((sum, r) => sum + (r.pax || 0), 0);
    return totalPaxSum > 0 ? (totalAmount / totalPaxSum) : 0;
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

  // Formato corto dd-mm-yy para mostrar en la tabla y el Excel.
  // Acepta: 'YYYY-MM-DD', ISO con hora ('YYYY-MM-DDTHH:mm:ss'),
  // timestamps numéricos (epoch ms o s), u objetos Date via .toString().
  // Si la fecha es inválida o es epoch 0 (1970-01-01), devuelve '' para no mostrar 01-01-70.
  const formatDateShort = (dateStr) => {
    if (dateStr === null || dateStr === undefined || dateStr === '') return '';

    // 1) Si es timestamp numérico o numérico-en-string (epoch)
    const asNum = typeof dateStr === 'number' ? dateStr : Number(dateStr);
    if (!Number.isNaN(asNum) && /^\d{9,}$/.test(String(asNum))) {
      // 9+ dígitos = epoch en ms (10-13 dígitos). Si tiene 10, es epoch en s.
      const ms = asNum < 1e12 ? asNum * 1000 : asNum;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime()) && d.getFullYear() > 1970) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        return `${dd}-${mm}-${yy}`;
      }
      return '';
    }

    // 2) Si matchea el patrón YYYY-MM-DD al inicio (con o sin hora)
    const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const year = Number(m[1]);
      // Si es 1970 o anterior, probablemente es epoch 0 → no mostrarlo
      if (year <= 1970) return '';
      return `${m[3]}-${m[2]}-${m[1].slice(2)}`;
    }

    // 3) Último intento: pasar por Date
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() > 1970) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      return `${dd}-${mm}-${yy}`;
    }
    return '';
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
    const userLabel = userFilter.size > 0
      ? `${userFilter.size} vendedor(es)`
      : 'Todos';
    const statusLabel = statusFilter.size > 0 ? `${statusFilter.size} estado(s)` : 'Todos';
    const salonLabel = salonFilter.size > 0
      ? `${salonFilter.size} salón(es)`
      : 'Todos';

    const totalAmount = reportData.reduce((s, r) => s + (r.total || 0), 0);

    const rowsHtml = reportData.map((r, i) => `
      <tr${i % 2 === 1 ? ' style="background:#f8fafc"' : ''}>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;color:#334155">${r.status || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:700;color:#0f172a">${r.refId || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;color:#334155">${r.folio || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;font-weight:600;color:#0f172a">${r.institucion || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;color:#475569">${r.userName}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;color:#475569">${formatDateShort(r.eventDate)}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;color:#475569">${formatDateShort(r.endDate || r.eventDate)}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;color:#334155">${r.eventType || r.name || '-'}</td>
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
    <th>Fecha I</th>
    <th>Fecha F</th>
    <th>Evento</th>
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
              <span style={{ fontSize: 12, color: '#64748b' }}>en estados seleccionados</span>
            </div>
            <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#16a34a', gridColumn: 'span 2' }}>
              <span className="reports-eyebrow">Total Venta</span>
              <strong>{formatMoney(summary.totalVentas)}</strong>
              <span style={{ fontSize: 12, color: '#64748b' }}>valor cotizado en selección</span>
            </div>
            <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#2563eb' }}>
              <span className="reports-eyebrow">PAX Totales</span>
              <strong>{summary.totalPax.toLocaleString()}</strong>
              <span style={{ fontSize: 12, color: '#64748b' }}>personas atendidas</span>
            </div>
            <div className="bento-tile reports-kpi-tile" style={{ borderTopColor: '#f59e0b' }}>
              <span className="reports-eyebrow">Ticket Promedio PAX</span>
              <strong>{formatMoney(avgTicket)}</strong>
              <span style={{ fontSize: 12, color: '#64748b' }}>por persona</span>
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
            <div className="field">
              <MultiSelect
                selected={userFilter}
                onChange={setUserFilter}
                options={sellerUsers.map(u => ({ value: u.id, label: u.fullName || u.name }))}
                placeholder="Vendedor"
                emptyLabel="Todos los vendedores"
                searchable
              />
            </div>
            <div className="field">
              <MultiSelect
                selected={salonFilter}
                onChange={setSalonFilter}
                options={(salones || []).map(s => ({ value: s, label: s }))}
                placeholder="Salón"
                emptyLabel="Todos los salones"
                searchable
              />
            </div>
            <div className="field">
              <MultiSelect
                selected={statusFilter}
                onChange={setStatusFilter}
                options={allStatuses.map(s => ({ value: s, label: s, color: STATUS_META[s]?.color || '#64748b' }))}
                placeholder="Estado"
                emptyLabel="Todos los estados"
              />
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
                  <th>Fecha I</th>
                  <th>Fecha F</th>
                  <th>Evento</th>
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
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/reserva/${r.id}`)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                    title="Click para abrir el editor de reserva"
                  >
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
                    <td>{formatDateShort(r.eventDate)}</td>
                    <td>{formatDateShort(r.endDate || r.eventDate)}</td>
                    <td>{r.eventType || r.name}</td>
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
