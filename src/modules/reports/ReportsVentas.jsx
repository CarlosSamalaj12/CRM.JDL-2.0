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

  const allStatuses = useMemo(() => {
    if (!events) return [];
    return [...new Set(events.map(e => e.status).filter(Boolean))].sort();
  }, [events]);

  const reportData = useMemo(() => {
    if (!events) return [];
    
    const rows = events.map(ev => {
      const assignedUser = users?.find(u => u.id === ev.userId);
      const quote = ev.quote || {};
      
      return {
        id: ev.id,
        name: ev.name,
        date: ev.date,
        endDate: ev.endDate || ev.date,
        startTime: ev.startTime,
        endTime: ev.endTime,
        salon: ev.salon,
        status: ev.status,
        userId: ev.userId,
        userName: assignedUser?.fullName || assignedUser?.name || 'Sin asignar',
        clientName: ev.clientName || '',
        clientPhone: ev.clientPhone || '',
        pax: ev.pax || 0,
        notes: ev.notes || '',
        quote: quote,
        total: quote?.total || 0,
        subtotal: quote?.subtotal || 0,
        discount: quote?.discountValue || 0
      };
    });

    let filtered = rows;

    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(r => 
        r.name?.toLowerCase().includes(term) ||
        r.clientName?.toLowerCase().includes(term) ||
        r.salon?.toLowerCase().includes(term) ||
        r.userName?.toLowerCase().includes(term) ||
        r.id?.toLowerCase().includes(term)
      );
    }

    if (dateFrom) {
      filtered = filtered.filter(r => r.date >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(r => r.date <= dateTo);
    }

    if (userFilter !== 'all') {
      filtered = filtered.filter(r => r.userId === userFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (salonFilter !== 'all') {
      filtered = filtered.filter(r => r.salon?.includes(salonFilter));
    }

    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  }, [events, users, search, dateFrom, dateTo, userFilter, statusFilter, salonFilter]);

  const summary = useMemo(() => {
    const totalEvents = reportData.length;
    const totalPax = reportData.reduce((sum, r) => sum + (r.pax || 0), 0);
    const totalVentas = reportData.reduce((sum, r) => sum + (r.total || 0), 0);
    const confirmados = reportData.filter(r => r.status === 'Confirmado').length;
    const cotizaciones = reportData.filter(r => r.status === '1er Cotizacion' || r.quote).length;
    
    return { totalEvents, totalPax, totalVentas, confirmados, cotizaciones };
  }, [reportData]);

  const getStatusColor = (status) => STATUS_META[status]?.color || '#64748b';

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
    const csvContent = [
      ['Fecha', 'Evento', 'Cliente', 'Salón', 'PAX', 'Estado', 'Vendedor', 'Total'].join(','),
      ...reportData.map(r => [
        r.date,
        `"${r.name}"`,
        `"${r.clientName}"`,
        r.salon,
        r.pax,
        r.status,
        `"${r.userName}"`,
        r.total
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_ventas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div style={{ 
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', 
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{ 
        width: '100%', maxWidth: '1400px', height: '90vh', background: '#fff', borderRadius: '24px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ 
          background: 'linear-gradient(135deg, #0b1c30 0%, #1e3a5f 100%)', padding: '24px 32px', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ 
              width: '60px', height: '60px', background: 'white', borderRadius: '16px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ fontSize: '32px' }}>📊</span>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: 'white' }}>Reporte de Ventas</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                CRM Jardines del Lago | Seguimiento comercial y cotizaciones
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ 
            background: 'rgba(255,255,255,0.1)', border: 'none', width: '40px', height: '40px', 
            borderRadius: '50%', color: 'white', fontSize: '20px', cursor: 'pointer'
          }}>×</button>
        </div>

        {/* Resumen */}
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', padding: '24px 32px',
          background: '#f8fafc', borderBottom: '1px solid #e2e8f0'
        }}>
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Eventos</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#0b1c30' }}>{summary.totalEvents}</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total PAX</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#0b1c30' }}>{summary.totalPax.toLocaleString()}</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Confirmados</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#059669' }}>{summary.confirmados}</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Cotizaciones</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#2563eb' }}>{summary.cotizaciones}</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Ventas</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#18c5bc' }}>{formatMoney(summary.totalVentas)}</div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ padding: '20px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input 
              type="text" 
              placeholder="Buscar evento, cliente, vendedor..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600' }}
            />
          </div>
          <div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600' }} />
          </div>
          <div>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600' }} />
          </div>
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600', minWidth: '150px' }}>
            <option value="all">Todos vendedores</option>
            {users?.map(u => <option key={u.id} value={u.id}>{u.fullName || u.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600', minWidth: '150px' }}>
            <option value="all">Todos estados</option>
            {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={salonFilter} onChange={e => setSalonFilter(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600', minWidth: '150px' }}>
            <option value="all">Todos salones</option>
            {salones?.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={clearFilters} style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', fontWeight: '600', cursor: 'pointer' }}>Limpiar</button>
          <button onClick={handleExportExcel} style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: '#059669', color: 'white', fontWeight: '700', cursor: 'pointer' }}>📥 Exportar Excel</button>
        </div>

        {/* Tabla */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 32px 32px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>FECHA</th>
                <th style={{ textAlign: 'left', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>EVENTO</th>
                <th style={{ textAlign: 'left', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>CLIENTE</th>
                <th style={{ textAlign: 'left', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>SALÓN</th>
                <th style={{ textAlign: 'center', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>PAX</th>
                <th style={{ textAlign: 'left', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>ESTADO</th>
                <th style={{ textAlign: 'left', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>VENDEDOR</th>
                <th style={{ textAlign: 'right', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: '14px' }}>
                    No hay datos para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                reportData.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 12px', fontSize: '13px', fontWeight: '600', color: '#64748b' }}>
                      {r.date}<br/>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{r.startTime} - {r.endTime}</span>
                    </td>
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13px' }}>{r.name}</div>
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '13px' }}>
                      <div style={{ color: '#334155' }}>{r.clientName || '-'}</div>
                      {r.clientPhone && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{r.clientPhone}</div>}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '13px', color: '#475569' }}>{r.salon}</td>
                    <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#475569' }}>{r.pax}</td>
                    <td style={{ padding: '14px 12px' }}>
                      <span style={{ 
                        display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700',
                        background: `${getStatusColor(r.status)}15`, color: getStatusColor(r.status),
                        border: `1px solid ${getStatusColor(r.status)}30`
                      }}>{r.status}</span>
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '13px', color: '#475569' }}>{r.userName}</td>
                    <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: '13px', fontWeight: '700', color: '#059669' }}>{formatMoney(r.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}