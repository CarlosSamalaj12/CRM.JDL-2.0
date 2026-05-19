import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Importar los reportes que el usuario ya creó
import ReportsVentas from './ReportsVentas';
import ReportsContabilidad from './ReportsContabilidad';
import ReportsOcupacion from './ReportsOcupacion';
import ReportsInstitucion from './ReportsInstitucion';
import ReportsModuleLegacy from './ReportsModuleLegacy'; // Usaremos el Legacy para el Dashboard por ahora

export default function ReportsModule() {
  const navigate = useNavigate();
  const [selectedReport, setSelectedReport] = useState(null);

  const handleClose = () => setSelectedReport(null);

  const reportCards = [
    { 
      id: 'ventas',
      title: 'Reporte Ventas', 
      desc: 'Resumen comercial y montos', 
      icon: 'bar_chart',
      component: <ReportsVentas onClose={handleClose} />
    },
    { 
      id: 'contabilidad',
      title: 'Reporte Contabilidad', 
      desc: 'Ventas netas y control para Excel', 
      icon: 'credit_card',
      component: <ReportsContabilidad onClose={handleClose} />
    },
    { 
      id: 'ocupacion',
      title: 'Reporte Ocupacion', 
      desc: 'Uso de salones y disponibilidad', 
      icon: 'calendar_view_day',
      component: <ReportsOcupacion onClose={handleClose} />
    },
    { 
      id: 'dashboard',
      title: 'Reporte Dashboard', 
      desc: 'Indicadores y vista ejecutiva', 
      icon: 'dashboard',
      component: <ReportsModuleLegacy onClose={handleClose} />
    },
    { 
      id: 'institucion',
      title: 'Reporte por institucion', 
      desc: 'Dashboard y detalle por cliente', 
      icon: 'corporate_fare',
      component: <ReportsInstitucion onClose={handleClose} />
    }
  ];

  // Si hay un reporte seleccionado, renderizar el componente correspondiente
  if (selectedReport) {
    const activeReport = reportCards.find(r => r.id === selectedReport);
    return activeReport.component; // Quitamos el envoltorio extra para que el reporte use su propio diseño
  }

  return (
    <div style={{ 
      padding: '40px', 
      height: '100%', 
      background: '#fff', 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      
      {/* Header Estilo Screenshot */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '30px'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '48px', 
            fontWeight: '900', 
            color: '#1e293b', 
            margin: 0,
            letterSpacing: '-0.02em'
          }}>Reportes</h1>
          <p style={{ 
            color: '#64748b', 
            fontSize: '16px', 
            marginTop: '8px',
            fontWeight: '500'
          }}>Elige el reporte que deseas consultar</p>
        </div>
        <button 
          onClick={() => navigate('/hub')}
          style={{ 
            padding: '10px 24px', 
            borderRadius: '12px', 
            border: '1px solid #d3e4fe', 
            background: '#fff',
            color: '#1e293b',
            fontWeight: '700',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}
        >Volver</button>
      </div>

      {/* Grid de Tarjetas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '20px' 
      }}>
        {reportCards.map((card, i) => (
          <div key={i} 
            onClick={() => setSelectedReport(card.id)}
            style={{ 
              background: '#fff', 
              padding: '24px', 
              borderRadius: '16px', 
              border: '1px solid #eef2ff',
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ 
              width: '52px', 
              height: '52px', 
              borderRadius: '14px', 
              background: '#f0f7ff', 
              display: 'grid', 
              placeItems: 'center',
              color: '#3b82f6'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>{card.icon}</span>
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>{card.title}</div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{card.desc}</div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}