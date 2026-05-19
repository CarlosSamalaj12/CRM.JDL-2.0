import React, { useState } from 'react';
import ReportsModule from './ReportsModule';
import ReportsVentas from './ReportsVentas';
import ReportsContabilidad from './ReportsContabilidad';
import ReportsOcupacion from './ReportsOcupacion';
import ReportsInstitucion from './ReportsInstitucion';

const REPORT_TYPES = {
  hub: 'hub',
  sales: 'sales',
  accounting: 'accounting',
  occupancy: 'occupancy',
  dashboard: 'dashboard',
  institution: 'institution',
};

export default function ReportsModuleContainer() {
  const [activeReport, setActiveReport] = useState(REPORT_TYPES.hub);

  const reportButtons = [
    {
      id: REPORT_TYPES.sales,
      label: 'Reporte Ventas',
      meta: 'Resumen comercial y montos',
      icon: (
        <svg viewBox="0 0 64 64" style={{ width: 32, height: 32 }}>
          <path d="M14 50h36" stroke="currentColor" strokeWidth="4" fill="none" />
          <path d="M20 44V30" stroke="currentColor" strokeWidth="4" fill="none" />
          <path d="M32 44V18" stroke="currentColor" strokeWidth="4" fill="none" />
          <path d="M44 44V24" stroke="currentColor" strokeWidth="4" fill="none" />
        </svg>
      ),
    },
    {
      id: REPORT_TYPES.accounting,
      label: 'Reporte Contabilidad',
      meta: 'Ventas netas y control para Excel',
      icon: (
        <svg viewBox="0 0 64 64" style={{ width: 32, height: 32 }}>
          <rect x="18" y="18" width="28" height="28" rx="4" stroke="currentColor" strokeWidth="3" fill="none" />
          <path d="M20 30h24" stroke="currentColor" strokeWidth="3" />
          <path d="M24 38h8M40 38h4" stroke="currentColor" strokeWidth="3" />
        </svg>
      ),
    },
    {
      id: REPORT_TYPES.occupancy,
      label: 'Reporte Ocupacion',
      meta: 'Uso de salones y disponibilidad',
      icon: (
        <svg viewBox="0 0 64 64" style={{ width: 32, height: 32 }}>
          <rect x="14" y="16" width="36" height="30" rx="8" stroke="currentColor" strokeWidth="3" fill="none" />
          <path d="M24 24h16M24 32h8M38 32h2" stroke="currentColor" strokeWidth="3" />
        </svg>
      ),
    },
    {
      id: REPORT_TYPES.dashboard,
      label: 'Reporte Dashboard',
      meta: 'Indicadores y vista ejecutiva',
      icon: (
        <svg viewBox="0 0 64 64" style={{ width: 32, height: 32 }}>
          <rect x="16" y="40" width="10" height="16" fill="#0ea5e9" />
          <rect x="30" y="40" width="10" height="22" fill="#0ea5e9" />
          <rect x="44" y="40" width="4" height="10" fill="#0ea5e9" />
        </svg>
      ),
    },
    {
      id: REPORT_TYPES.institution,
      label: 'Reporte por institucion',
      meta: 'Dashboard y detalle por cliente',
      icon: (
        <svg viewBox="0 0 64 64" style={{ width: 32, height: 32 }}>
          <path d="M14 48h36" stroke="currentColor" strokeWidth="3" fill="none" />
          <path d="M18 48V24l14-8 14 8v24" stroke="currentColor" strokeWidth="3" fill="none" />
          <path d="M26 30h2M36 30h2M26 38h2M36 38h2" stroke="currentColor" strokeWidth="3" />
        </svg>
      ),
    },
  ];

  if (activeReport === REPORT_TYPES.hub) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        padding: '20px',
        gap: '20px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fff',
          padding: '20px 24px',
          borderRadius: '16px',
          border: '1px solid #dbe7f5',
          boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
        }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>Reportes</div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>Elige el reporte que deseas consultar</div>
          </div>
        </div>

        {/* Action Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          {reportButtons.map((btn, i) => (
            <button
              key={i}
              onClick={() => setActiveReport(btn.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '20px',
                background: '#fff',
                border: '1px solid #dbe7f5',
                borderRadius: '16px',
                boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(15,23,42,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 10px 24px rgba(15,23,42,0.05)';
              }}
            >
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
              }}>
                {btn.icon}
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>
                  {btn.label}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {btn.meta}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Botón Volver */}
      <div style={{ padding: '0 4px' }}>
        <button
          onClick={() => setActiveReport(REPORT_TYPES.hub)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: '#fff',
            border: '1px solid #dbe7f5',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '700',
            color: '#475569',
            cursor: 'pointer',
          }}
        >
          ← Volver
        </button>
      </div>
      
      {/* Reportes */}
      {activeReport === REPORT_TYPES.dashboard && <ReportsModule />}
      {activeReport === REPORT_TYPES.sales && <ReportsVentas />}
      {activeReport === REPORT_TYPES.accounting && <ReportsContabilidad />}
      {activeReport === REPORT_TYPES.occupancy && <ReportsOcupacion />}
      {activeReport === REPORT_TYPES.institution && <ReportsInstitucion />}
      
      {/* Placeholder para otros reportes */}
      {activeReport !== REPORT_TYPES.dashboard && activeReport !== REPORT_TYPES.sales && activeReport !== REPORT_TYPES.accounting && activeReport !== REPORT_TYPES.occupancy && activeReport !== REPORT_TYPES.institution && (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#64748b',
          fontSize: '14px'
        }}>
          Reporte "{reportButtons.find(b => b.id === activeReport)?.label}" en construcción...
        </div>
      )}
    </div>
  );
}