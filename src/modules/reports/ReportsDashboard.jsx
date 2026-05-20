import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';

export default function ReportsDashboard({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState({
    events: [],
    users: [],
    globalMonthlyGoals: []
  });

  // Interactive filters
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [monthFilter, setMonthFilter] = useState('ALL'); // 'ALL' or '01'-'12'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' or 'Confirmado', etc.

  // Fetch full state on load
  const loadState = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setState({
          events: data.state?.events || [],
          users: data.state?.users || [],
          globalMonthlyGoals: data.state?.globalMonthlyGoals || []
        });
      }
    } catch (err) {
      console.error('Error al cargar datos del Dashboard:', err);
      Swal.fire('Error', 'No se pudieron recuperar los datos estadísticos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadState();
  }, []);

  // Compute years list based on events
  const years = useMemo(() => {
    const list = new Set([new Date().getFullYear().toString()]);
    state.events.forEach(ev => {
      if (ev.date) {
        const y = ev.date.substring(0, 4);
        if (/^\d{4}$/.test(y)) list.add(y);
      }
    });
    return Array.from(list).sort((a, b) => b.localeCompare(a));
  }, [state.events]);

  // Months name array for display
  const monthsNames = [
    { value: 'ALL', label: 'Todos los meses' },
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
  ];

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return state.events.filter(ev => {
      if (!ev.date) return false;
      const evYear = ev.date.substring(0, 4);
      const evMonth = ev.date.substring(5, 7);

      if (evYear !== yearFilter) return false;
      if (monthFilter !== 'ALL' && evMonth !== monthFilter) return false;
      if (statusFilter !== 'ALL' && ev.status !== statusFilter) return false;

      return true;
    });
  }, [state.events, yearFilter, monthFilter, statusFilter]);

  // Compute KPIs
  const kpis = useMemo(() => {
    let totalConfirmedValue = 0;
    let totalQuotedValue = 0;
    let confirmedCount = 0;
    let pendingCount = 0;
    let totalPax = 0;

    filteredEvents.forEach(ev => {
      const isConfirmed = ev.status === 'Confirmado';
      const quoteVal = Number(ev.quote?.total || 0);

      totalQuotedValue += quoteVal;
      if (isConfirmed) {
        totalConfirmedValue += quoteVal;
        confirmedCount++;
      } else if (ev.status !== 'Cancelado') {
        pendingCount++;
      }

      if (ev.status !== 'Cancelado' && ev.pax) {
        totalPax += Number(ev.pax);
      }
    });

    const conversionRate = filteredEvents.length > 0 
      ? Math.round((confirmedCount / filteredEvents.filter(x => x.status !== 'Cancelado').length) * 100) || 0 
      : 0;

    return {
      totalConfirmedValue,
      totalQuotedValue,
      confirmedCount,
      pendingCount,
      totalPax,
      conversionRate
    };
  }, [filteredEvents]);

  // Compute monthly sales trend for Year
  const monthlySalesTrend = useMemo(() => {
    const list = Array.from({ length: 12 }, (_, idx) => {
      const mStr = String(idx + 1).padStart(2, '0');
      return {
        month: mStr,
        label: monthsNames[idx + 1].label.substring(0, 3),
        sales: 0,
        goal: 0
      };
    });

    // Populate actual sales
    state.events.forEach(ev => {
      if (!ev.date || ev.status !== 'Confirmado') return;
      const evYear = ev.date.substring(0, 4);
      if (evYear !== yearFilter) return;
      const mIdx = Number(ev.date.substring(5, 7)) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        list[mIdx].sales += Number(ev.quote?.total || 0);
      }
    });

    // Populate goals (both individual metas sum & global goals kv)
    // Individual sellers monthly goal sum
    state.users.forEach(u => {
      if (!u.salesTargetEnabled || !u.monthlyGoals) return;
      u.monthlyGoals.forEach(g => {
        if (g.month && g.month.substring(0, 4) === yearFilter) {
          const mIdx = Number(g.month.substring(5, 7)) - 1;
          if (mIdx >= 0 && mIdx < 12) {
            list[mIdx].goal += Number(g.amount || 0);
          }
        }
      });
    });

    return list;
  }, [state.events, state.users, yearFilter]);

  // Compute salespeople metas achievements
  const salespeopleStats = useMemo(() => {
    const targetMonthKey = monthFilter !== 'ALL' ? `${yearFilter}-${monthFilter}` : null;
    
    return state.users
      .filter(u => u.salesTargetEnabled)
      .map(u => {
        // Calculate sales for this user
        let salesSum = 0;
        let goalSum = 0;

        // Sum sales
        state.events.forEach(ev => {
          if (ev.status !== 'Confirmado' || String(ev.userId || '') !== String(u.id)) return;
          const evYear = ev.date?.substring(0, 4);
          const evMonth = ev.date?.substring(5, 7);

          if (evYear !== yearFilter) return;
          if (monthFilter !== 'ALL' && evMonth !== monthFilter) return;

          salesSum += Number(ev.quote?.total || 0);
        });

        // Sum goals
        if (targetMonthKey) {
          const goal = u.monthlyGoals?.find(g => g.month === targetMonthKey);
          goalSum = goal ? Number(goal.amount || 0) : 0;
        } else {
          // Sum all goals for selected year
          u.monthlyGoals?.forEach(g => {
            if (g.month && g.month.substring(0, 4) === yearFilter) {
              goalSum += Number(g.amount || 0);
            }
          });
        }

        const pct = goalSum > 0 ? Math.min(100, Math.round((salesSum / goalSum) * 100)) : 0;

        return {
          ...u,
          sales: salesSum,
          goal: goalSum,
          percentage: pct
        };
      })
      .sort((a, b) => b.sales - a.sales);
  }, [state.users, state.events, yearFilter, monthFilter]);

  // Format currency in GTQ
  const formatGT = (val) => {
    return 'Q ' + Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Maximum value in chart for scaling
  const chartMax = useMemo(() => {
    const maxVal = Math.max(...monthlySalesTrend.map(x => Math.max(x.sales, x.goal)), 10000);
    return Math.ceil(maxVal / 10000) * 10000;
  }, [monthlySalesTrend]);

  return (
    <div style={{
      padding: '40px',
      background: '#f8fafc',
      height: '100vh',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      overflowY: 'auto',
      fontFamily: 'system-ui, sans-serif'
    }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.5px' }}>
            📊 Executive Business Dashboard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '14.5px', color: '#64748b', fontWeight: '500' }}>
            Rendimiento comercial, cumplimiento de metas de venta y KPIs en tiempo real
          </p>
        </div>
        <button 
          onClick={onClose}
          className="iconBtn"
          title="Cerrar"
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#64748b',
            padding: '4px 8px',
            lineHeight: '1'
          }}
        >
          &#10005;
        </button>
      </div>

      {/* Interactive Filters Panel */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '16px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        alignItems: 'center',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Ejercicio / Año</label>
          <select 
            value={yearFilter} 
            onChange={e => setYearFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Mes del Informe</label>
          <select 
            value={monthFilter} 
            onChange={e => setMonthFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}
          >
            {monthsNames.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Estado del Evento</label>
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}
          >
            <option value="ALL">Cualquier Estado (Activos)</option>
            <option value="Confirmado">Confirmados</option>
            <option value="Pre-reserva">Pre-reserva</option>
            <option value="Seguimiento">Seguimiento</option>
            <option value="Cancelado">Cancelados</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button 
            onClick={loadState}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#eff6ff',
              color: '#2563eb',
              fontWeight: '700',
              fontSize: '12.5px',
              cursor: 'pointer'
            }}
          >
            🔄 Actualizar Datos
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', fontSize: '15px', color: '#64748b' }}>
          Cargando indicadores comerciales en vivo...
        </div>
      ) : (
        <>
          {/* Dashboard KPIs Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
            
            {/* KPI 1: Ventas Confirmadas */}
            <div style={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
              color: 'white',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 10px 15px -3px rgba(30, 58, 138, 0.2)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <span style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', opacity: 0.8, letterSpacing: '0.5px' }}>📈 Facturación Confirmada</span>
              <h2 style={{ margin: '8px 0 0', fontSize: '26px', fontWeight: '900' }}>{formatGT(kpis.totalConfirmedValue)}</h2>
              <p style={{ margin: '6px 0 0', fontSize: '12.5px', opacity: 0.9 }}>
                Consolidado de {kpis.confirmedCount} evento(s) confirmados
              </p>
            </div>

            {/* KPI 2: Total Cotizado */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
            }}>
              <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>💰 Cartera Cotizada</span>
              <h2 style={{ margin: '8px 0 0', fontSize: '26px', fontWeight: '900', color: '#0f172a' }}>{formatGT(kpis.totalQuotedValue)}</h2>
              <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                Total estimado en preventa comercial
              </p>
            </div>

            {/* KPI 3: Tasa de Conversión */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
            }}>
              <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🎯 Efectividad de Cierre</span>
              <h2 style={{ margin: '8px 0 0', fontSize: '26px', fontWeight: '900', color: '#0d9488' }}>{kpis.conversionRate}%</h2>
              <div style={{ width: '100%', background: '#f1f5f9', height: '6px', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${kpis.conversionRate}%`, background: '#0d9488', height: '100%' }} />
              </div>
            </div>

            {/* KPI 4: PAX e Invitados */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
            }}>
              <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>👥 Capacidad / PAX Total</span>
              <h2 style={{ margin: '8px 0 0', fontSize: '26px', fontWeight: '900', color: '#0f172a' }}>{kpis.totalPax.toLocaleString()} PAX</h2>
              <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                Platos contratados y comensales
              </p>
            </div>

          </div>

          {/* Graphical Analysis & Metas Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr', gap: '20px' }}>
            
            {/* Sales Trend Monthly Chart */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>📈 Tendencia de Ventas vs Presupuesto</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>Ventas confirmadas (azul) frente a metas de venta (gris) del año {yearFilter}</p>
              </div>

              {/* Native CSS / SVG Chart container */}
              <div style={{ flex: 1, minHeight: '260px', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', flex: 1, alignItems: 'flex-end', justifyContent: 'space-between', padding: '10px 0', borderBottom: '2px solid #cbd5e1' }}>
                  {monthlySalesTrend.map((m, idx) => {
                    const salesHeight = `${(m.sales / chartMax) * 100}%`;
                    const goalHeight = `${(m.goal / chartMax) * 100}%`;
                    return (
                      <div key={idx} style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        height: '100%',
                        position: 'relative'
                      }}>
                        
                        {/* Bars Group */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80%', width: '100%', justifyContent: 'center' }}>
                          {/* Goal Bar */}
                          <div style={{
                            width: '8px',
                            height: goalHeight,
                            background: '#e2e8f0',
                            borderRadius: '4px 4px 0 0',
                            title: `Meta: ${formatGT(m.goal)}`
                          }} />
                          {/* Sales Bar */}
                          <div style={{
                            width: '12px',
                            height: salesHeight,
                            background: '#2563eb',
                            borderRadius: '6px 6px 0 0',
                            boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)',
                            title: `Real: ${formatGT(m.sales)}`
                          }} />
                        </div>

                        {/* Label */}
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>{m.label}</span>
                      </div>
                    );
                  })}
                </div>
                
                {/* Scale Legend */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                  <span>Min: Q 0.00</span>
                  <span>Escala Max: {formatGT(chartMax)}</span>
                </div>
              </div>
            </div>

            {/* Salespeople Metas Achievement Grid */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>🎯 Cumplimiento de Metas por Vendedor</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  {monthFilter === 'ALL' ? `Rendimiento acumulado de todo el año ${yearFilter}` : `Desempeño mensual de ${monthsNames.find(x => x.value === monthFilter)?.label}`}
                </p>
              </div>

              {/* Leaderboard list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', maxHeight: '300px' }}>
                {salespeopleStats.length > 0 ? (
                  salespeopleStats.map((seller, idx) => (
                    <div key={seller.id} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      background: '#f8fafc',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1.5px solid #e2e8f0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: idx === 0 ? '#fef08a' : '#e0f2fe',
                            color: idx === 0 ? '#854d0e' : '#0369a1',
                            fontWeight: '900',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {idx + 1}
                          </div>
                          <div>
                            <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#1e293b' }}>{seller.fullName}</span>
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'capitalize' }}>{seller.role}</span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: '900', color: '#2563eb' }}>{formatGT(seller.sales)}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Meta: {formatGT(seller.goal)}</span>
                        </div>
                      </div>

                      {/* Achievement Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                        <div style={{ flex: 1, background: '#e2e8f0', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${seller.percentage}%`,
                            background: seller.percentage >= 100 ? '#10b981' : (seller.percentage >= 50 ? '#f59e0b' : '#ef4444'),
                            height: '100%'
                          }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b', width: '36px', textAlign: 'right' }}>
                          {seller.percentage}%
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>
                    No hay asesores comerciales con metas de venta asignadas.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Confirmed list block for the current filter */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>
              📋 Eventos Considerados en este Criterio ({filteredEvents.length})
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '800' }}>
                    <th style={{ padding: '10px' }}>Fecha</th>
                    <th style={{ padding: '10px' }}>Evento</th>
                    <th style={{ padding: '10px' }}>Salón</th>
                    <th style={{ padding: '10px' }}>Asesor Comercial</th>
                    <th style={{ padding: '10px' }}>PAX</th>
                    <th style={{ padding: '10px' }}>Código Cotización</th>
                    <th style={{ padding: '10px' }}>Monto (Venta)</th>
                    <th style={{ padding: '10px' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.length > 0 ? (
                    filteredEvents.map(ev => {
                      const user = state.users.find(x => String(x.id) === String(ev.userId));
                      return (
                        <tr key={ev.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px', fontWeight: 'bold' }}>{ev.date}</td>
                          <td style={{ padding: '10px', fontWeight: '600', color: '#0f172a' }}>{ev.name}</td>
                          <td style={{ padding: '10px' }}>{ev.salon}</td>
                          <td style={{ padding: '10px' }}>{user?.fullName || 'N/A'}</td>
                          <td style={{ padding: '10px' }}>{ev.pax || 'N/A'}</td>
                          <td style={{ padding: '10px', fontWeight: '700' }}>{ev.quote?.code || 'Borrador'}</td>
                          <td style={{ padding: '10px', fontWeight: '800', color: '#1e40af' }}>{formatGT(ev.quote?.total || 0)}</td>
                          <td style={{ padding: '10px' }}>
                            <span style={{
                              background: ev.status === 'Confirmado' ? '#e0f2fe' : (ev.status === 'Cancelado' ? '#fef2f2' : '#fef3c7'),
                              color: ev.status === 'Confirmado' ? '#0369a1' : (ev.status === 'Cancelado' ? '#991b1b' : '#d97706'),
                              fontSize: '11px',
                              fontWeight: '900',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              textTransform: 'uppercase'
                            }}>
                              {ev.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                        No hay eventos registrados bajo el criterio de filtros seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
