import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function HubModule() {
  const navigate = useNavigate();

  const options = [
    { 
      title: 'CALENDARIO Y OPERACIONES', 
      desc: 'Gestiona la agenda, salones y reservas diarias.', 
      icon: 'calendar_month', 
      path: '/calendar',
      color: '#102744'
    },
    { 
      title: 'CLIENTES Y VENTAS', 
      desc: 'Seguimiento de prospectos y nuevos clientes potenciales.', 
      icon: 'group', 
      path: '/customers',
      color: '#14b8a6'
    },
    { 
      title: 'REPORTES Y ESTADÍSTICAS', 
      desc: 'Análisis de ocupación, ingresos y rendimiento.', 
      icon: 'analytics', 
      path: '/reports',
      color: '#f59e0b'
    }
  ];

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '40px',
      background: '#f0f3fa'
    }}>
      
      <div style={{ textAlign: 'center', marginBottom: '50px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#0b1c30', marginBottom: '10px' }}>PANEL DE CONTROL PRINCIPAL</h1>
        <p style={{ color: '#64748b', fontSize: '16px' }}>Bienvenido de nuevo. ¿Qué área deseas gestionar hoy?</p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '24px', 
        width: '100%', 
        maxWidth: '1100px' 
      }}>
        {options.map((opt, i) => (
          <div 
            key={i} 
            onClick={() => navigate(opt.path)}
            style={{ 
              background: '#fff', 
              padding: '40px 30px', 
              borderRadius: '20px', 
              border: '1px solid #d3e4fe',
              boxShadow: '0 10px 30px rgba(11, 28, 48, 0.05)',
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(11, 28, 48, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(11, 28, 48, 0.05)';
            }}
          >
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '20px', background: `${opt.color}15`,
              display: 'grid', placeItems: 'center', color: opt.color, marginBottom: '24px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '40px' }}>{opt.icon}</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#1e293b', marginBottom: '12px', letterSpacing: '0.02em' }}>{opt.title}</h3>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>{opt.desc}</p>
            
            <div style={{ 
              marginTop: 'auto', paddingTop: '20px', color: opt.color, fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' 
            }}>
              ACCEDER <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
