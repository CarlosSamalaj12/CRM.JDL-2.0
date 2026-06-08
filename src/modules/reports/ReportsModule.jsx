import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Importar los reportes que el usuario ya creó
import ReportsVentas from './ReportsVentas';
import ReportsContabilidad from './ReportsContabilidad';
import ReportsOcupacion from './ReportsOcupacion';
import ReportsInstitucion from './ReportsInstitucion';
import ReportsDashboard from './ReportsDashboard';


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
      component: <ReportsDashboard onClose={handleClose} />
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
          onClick={() => navigate('/calendar')}
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
        >&#10005;</button>
      </div>

      {/* Grid de Tarjetas */}
      <div className="reports-menu-grid">
        {reportCards.map((card, i) => (
          <div key={i} 
            onClick={() => setSelectedReport(card.id)}
            style={{ 
              background: '#fff', 
              padding: '24px', 
              borderRadius: '16px', 
              border: '1.5px solid #bfdbfe',
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.background = '#f0f7ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = '#bfdbfe';
              e.currentTarget.style.background = '#fff';
            }}
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