import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { STATUS_META } from '../calendar/constants';

const OCCUPANCY_STATUSES = ['Pre reserva', 'Confirmado', 'Lista de Espera'];

export default function ReportsOcupacion({ onClose }) {
  const { events, salones } = useOutletContext();
  
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff)).toISOString().split('T')[0];
  });

  const weekDays = useMemo(() => {
    const start = new Date(currentWeekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [currentWeekStart]);

  const occupancyData = useMemo(() => {
    if (!events || !salones) return { bySalon: {}, totalEvents: 0, totalPax: 0, days: {} };
    
    const weekEvents = events.filter(ev => {
      const evDate = ev.date;
      return weekDays.includes(evDate) && OCCUPANCY_STATUSES.includes(ev.status);
    });

    const bySalon = {};
    const days = {};
    let totalEvents = 0;
    let totalPax = 0;

    salones.forEach(salon => {
      bySalon[salon] = { events: 0, pax: 0, confirmed: 0, pending: 0 };
    });

    weekDays.forEach(day => {
      days[day] = { total: 0, pax: 0 };
    });

    weekEvents.forEach(ev => {
      const salonList = ev.salon ? ev.salon.split(',').map(s => s.trim()) : [];
      const day = ev.date;
      
      if (!days[day]) days[day] = { total: 0, pax: 0 };
      days[day].total++;
      days[day].pax += ev.pax || 0;
      totalEvents++;
      totalPax += ev.pax || 0;

      salonList.forEach(salon => {
        if (bySalon[salon]) {
          bySalon[salon].events++;
          bySalon[salon].pax += ev.pax || 0;
          if (ev.status === 'Confirmado') {
            bySalon[salon].confirmed++;
          } else {
            bySalon[salon].pending++;
          }
        }
      });
    });

    return { bySalon, totalEvents, totalPax, days };
  }, [events, salones, weekDays]);

  const getOccupancyRate = (salon) => {
    const totalDays = 7;
    const events = occupancyData.bySalon[salon]?.events || 0;
    return Math.round((events / totalDays) * 100);
  };

  const getStatusColor = (status) => STATUS_META[status]?.color || '#64748b';

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
  };

  const handlePrevWeek = () => {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - 7);
    setCurrentWeekStart(start.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() + 7);
    setCurrentWeekStart(start.toISOString().split('T')[0]);
  };

  const handleGoToday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(today.setDate(diff));
    setCurrentWeekStart(start.toISOString().split('T')[0]);
  };

  return (
    <div style={{ 
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', 
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{ 
        width: '100%', maxWidth: '1200px', height: '90vh', background: '#fff', borderRadius: '24px',
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
              <span style={{ fontSize: '32px' }}>📅</span>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: 'white' }}>Reporte de Ocupación</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
               CRM Jardines del Lago | Uso de salones y disponibilidad
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ 
            background: 'rgba(255,255,255,0.1)', border: 'none', width: '40px', height: '40px', 
            borderRadius: '50%', color: 'white', fontSize: '20px', cursor: 'pointer'
          }}>×</button>
        </div>

        {/* Navegación de semana */}
        <div style={{ 
          padding: '20px 32px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={handlePrevWeek} style={{ 
              padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', 
              background: 'white', fontWeight: '700', cursor: 'pointer'
            }}>◀</button>
            <button onClick={handleGoToday} style={{ 
              padding: '10px 20px', borderRadius: '8px', border: '1px solid #2563eb', 
              background: '#2563eb', color: 'white', fontWeight: '700', cursor: 'pointer'
            }}>Hoy</button>
            <button onClick={handleNextWeek} style={{ 
              padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', 
              background: 'white', fontWeight: '700', cursor: 'pointer'
            }}>▶</button>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0b1c30' }}>
            Semana del {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
          </div>
        </div>

        {/* Resumen */}
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', padding: '24px 32px',
          background: '#f8fafc', borderBottom: '1px solid #e2e8f0'
        }}>
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Reservas</div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#0b1c30' }}>{occupancyData.totalEvents}</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Personas</div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#0b1c30' }}>{occupancyData.totalPax.toLocaleString()}</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Días Ocupados</div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#2563eb' }}>
              {Object.values(occupancyData.days).filter(d => d.total > 0).length}/7
            </div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Ocupación Prom.</div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#18c5bc' }}>
              {Math.round((occupancyData.totalEvents / 7) * 100)}%
            </div>
          </div>
        </div>

        {/* Grid de ocupación por salón */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
          <div style={{ marginBottom: '20px', fontSize: '18px', fontWeight: '800', color: '#0b1c30' }}>
            Ocupación por Salón
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {salones?.map(salon => {
              const data = occupancyData.bySalon[salon] || { events: 0, pax: 0, confirmed: 0, pending: 0 };
              const rate = getOccupancyRate(salon);
              
              return (
                <div key={salon} style={{ 
                  background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#0b1c30' }}>{salon}</div>
                    <div style={{ 
                      padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                      background: rate > 50 ? '#fef2f2' : '#f0fdf4',
                      color: rate > 50 ? '#dc2626' : '#16a34a'
                    }}>{rate}% ocupación</div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Reservas</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#0b1c30' }}>{data.events}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Personas</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#0b1c30' }}>{data.pax}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ 
                      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                      background: '#dcfce7', color: '#16a34a'
                    }}>✅ {data.confirmados} Confirmados</span>
                    <span style={{ 
                      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                      background: '#fef3c7', color: '#d97706'
                    }}>⏳ {data.pending} Pendientes</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grid de días */}
          <div style={{ marginTop: '32px', marginBottom: '20px', fontSize: '18px', fontWeight: '800', color: '#0b1c30' }}>
            Ocupación por Día
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px' }}>
            {weekDays.map(day => {
              const dayData = occupancyData.days[day] || { total: 0, pax: 0 };
              const isToday = day === new Date().toISOString().split('T')[0];
              
              return (
                <div key={day} style={{ 
                  background: isToday ? '#f0f7ff' : 'white',
                  padding: '16px', borderRadius: '12px', border: isToday ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px' }}>
                    {formatDate(day)}
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#0b1c30' }}>{dayData.total}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{dayData.pax} personas</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}