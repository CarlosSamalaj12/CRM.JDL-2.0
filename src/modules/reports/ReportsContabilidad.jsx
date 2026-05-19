import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { STATUS_META } from '../calendar/constants';

const ACCOUNTING_STATUSES = ['Confirmado', '1er Cotizacion', 'Lista de Espera', 'Pre reserva'];

export default function ReportsContabilidad({ onClose }) {
  const { events, users } = useOutletContext();
  
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const accountingData = useMemo(() => {
    if (!events) return { rows: [], summary: {} };
    
    let filtered = events.filter(ev => {
      return ACCOUNTING_STATUSES.includes(ev.status) && ev.status !== 'Cancelado';
    });

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

    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(r => 
        r.name?.toLowerCase().includes(term) ||
        r.clientName?.toLowerCase().includes(term) ||
        (r.quote?.companyName || '')?.toLowerCase().includes(term)
      );
    }

    const totalEvents = filtered.length;
    const totalPax = filtered.reduce((sum, r) => sum + (r.pax || 0), 0);
    const confirmedCount = filtered.filter(r => r.status === 'Confirmado').length;
    const pendingCount = filtered.filter(r => r.status === '1er Cotizacion' || r.status === 'Lista de Espera').length;
    
    const totalVentas = filtered.reduce((sum, r) => sum + (r.quote?.total || 0), 0);
    const promedio = totalEvents > 0 ? totalVentas / totalEvents : 0;

    return {
      rows: filtered.sort((a, b) => a.date.localeCompare(b.date)),
      summary: { totalEvents, totalPax, confirmedCount, pendingCount, totalVentas, promedio }
    };
  }, [events, dateFrom, dateTo, userFilter, statusFilter, search]);

  const getStatusColor = (status) => STATUS_META[status]?.color || '#64748b';

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(amount || 0);
  };

  const handleExportExcel = () => {
    const csvContent = [
      ['Fecha', 'Evento', 'Cliente', 'Salón', 'PAX', 'Estado', 'Vendedor', 'Total'].join(','),
      ...accountingData.rows.map(r => [
        r.date,
        `"${r.name}"`,
        `"${r.clientName || ''}"`,
        r.salon,
        r.pax,
        r.status,
        `"${users?.find(u => u.id === r.userId)?.fullName || 'Sin asignar'}"`,
        r.quote?.total || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_contabilidad_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setUserFilter('all');
    setStatusFilter('all');
    setSearch('');
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
          background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)', padding: '24px 32px', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ 
              width: '60px', height: '60px', background: 'white', borderRadius: '16px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ fontSize: '32px' }}>💰</span>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: 'white' }}>Reporte de Contabilidad</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                Control de ventas netas y flujo de efectivo
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ 
            background: 'rgba(255,255,255,0.1)', border: 'none', width: '40px', height: '40px', 
            borderRadius: '50%', color: 'white', fontSize: '20px', cursor: 'pointer'
          }}>×</button>
        </div>

        {/* Resumen financiero */}
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', padding: '24px 32px',
          background: '#f0fdf4', borderBottom: '1px solid #bbf7d0'
        }}>
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '2px solid #bbf7d0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Eventos</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{accountingData.summary.totalEvents}</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '2px solid #bbf7d0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Confirmados</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#059669' }}>{accountingData.summary.confirmedCount}</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '2px solid #bbf7d0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Pendientes</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#d97706' }}>{accountingData.summary.pendingCount}</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '2px solid #bbf7d0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Ventas</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#059669' }}>{formatMoney(accountingData.summary.totalVentas)}</div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ padding: '20px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input 
              type="text" 
              placeholder="Buscar evento, cliente..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600' }}
            />
          </div>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600' }} />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600' }} />
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600', minWidth: '150px' }}>
            <option value="all">Todos vendedores</option>
            {users?.map(u => <option key={u.id} value={u.id}>{u.fullName || u.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600', minWidth: '150px' }}>
            <option value="all">Todos estados</option>
            {ACCOUNTING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={clearFilters} style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', fontWeight: '600', cursor: 'pointer' }}>Limpiar</button>
          <button onClick={handleExportExcel} style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: '#059669', color: 'white', fontWeight: '700', cursor: 'pointer' }}>📥 Exportar</button>
        </div>

        {/* Tabla */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 32px 32px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>FECHA</th>
                <th style={{ textAlign: 'left', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>EVENTO</th>
                <th style={{ textAlign: 'left', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>CLIENTE</th>
                <th style={{ textAlign: 'center', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>PAX</th>
                <th style={{ textAlign: 'left', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>ESTADO</th>
                <th style={{ textAlign: 'left', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>VENDEDOR</th>
                <th style={{ textAlign: 'right', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>SUBTOTAL</th>
                <th style={{ textAlign: 'right', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>DESCUENTO</th>
                <th style={{ textAlign: 'right', padding: '14px 12px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {accountingData.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: '14px' }}>
                    No hay datos para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                accountingData.rows.map(r => {
                  const quote = r.quote || {};
                  const user = users?.find(u => u.id === r.userId);
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 12px', fontSize: '13px', fontWeight: '600', color: '#64748b' }}>{r.date}</td>
                      <td style={{ padding: '14px 12px', fontWeight: '700', color: '#0f172a', fontSize: '13px' }}>{r.name}</td>
                      <td style={{ padding: '14px 12px', fontSize: '13px', color: '#334155' }}>{r.clientName || '-'}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#475569' }}>{r.pax}</td>
                      <td style={{ padding: '14px 12px' }}>
                        <span style={{ 
                          display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700',
                          background: `${getStatusColor(r.status)}15`, color: getStatusColor(r.status),
                          border: `1px solid ${getStatusColor(r.status)}30`
                        }}>{r.status}</span>
                      </td>
                      <td style={{ padding: '14px 12px', fontSize: '13px', color: '#475569' }}>{user?.fullName || user?.name || '-'}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: '13px', color: '#475569' }}>{formatMoney(quote.subtotal)}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: '13px', color: '#dc2626' }}>-{formatMoney(quote.discountValue || 0)}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#059669' }}>{formatMoney(quote.total)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer con totales */}
        <div style={{ 
          padding: '16px 32px', background: '#f8fafc', borderTop: '2px solid #e2e8f0',
          display: 'flex', justifyContent: 'flex-end', gap: '32px'
        }}>
          <div>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Total general: </span>
            <span style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }}>{formatMoney(accountingData.summary.totalVentas)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}