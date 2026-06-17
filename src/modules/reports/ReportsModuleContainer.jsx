import { useState } from 'react';
import ReportsModule from './ReportsModule';
import ReportsVentas from './ReportsVentas';
import ReportsContabilidad from './ReportsContabilidad';
import ReportsInstitucion from './ReportsInstitucion';

const REPORT_TYPES = {
  hub: 'hub', sales: 'sales', accounting: 'accounting',
  dashboard: 'dashboard', institution: 'institution',
};

const BENTO_BUTTONS = [
  { id: REPORT_TYPES.sales, label: 'Reporte Ventas', meta: 'Resumen comercial y montos del pipeline', badge: 'Ventas • Cotizaciones', icon: '📊', variant: 'blue' },
  { id: REPORT_TYPES.accounting, label: 'Reporte Contabilidad', meta: 'Ventas netas y control financiero', badge: 'Contabilidad • Cartera', icon: '💳', variant: 'green' },
  { id: REPORT_TYPES.dashboard, label: 'Dashboard', meta: 'Indicadores clave y vista ejecutiva', badge: 'KPIs • Metas • Rendimiento', icon: '📈', variant: 'amber' },
  { id: REPORT_TYPES.institution, label: 'Por Institución', meta: 'Dashboard detallado por cliente', badge: 'Clientes • Historial', icon: '🏢', variant: 'rose' },
];

const ICON_BG = { blue: '#2563eb', green: '#16a34a', amber: '#d97706', rose: '#e11d48' };

export default function ReportsModuleContainer() {
  const [activeReport, setActiveReport] = useState(REPORT_TYPES.hub);
  const [hoveredId, setHoveredId] = useState(null);

  if (activeReport === REPORT_TYPES.hub) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 32px', gap: '28px', overflow: 'auto' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: '4px' }}>
            CRM Reservas | Jardines del Lago
          </div>
          <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#0f172a', margin: 0, letterSpacing: '-0.03em', lineHeight: '1.1' }}>
            Reportes
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px', fontWeight: '500' }}>
            Elige el reporte que deseas consultar
          </p>
        </div>

        <div className="reports-bento">
          {BENTO_BUTTONS.map((btn) => {
            const isHovered = hoveredId === btn.id;
            return (
              <button
                key={btn.id}
                onClick={() => setActiveReport(btn.id)}
                className={`reports-bento-card reports-bento-card--${btn.variant}`}
                style={{ border: 'none', textAlign: 'left', cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}
                onMouseEnter={() => setHoveredId(btn.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="reports-bento-top">
                  <div className="reports-bento-icon" style={{ background: ICON_BG[btn.variant] }}>{btn.icon}</div>
                  <div className="reports-bento-arrow">→</div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="reports-bento-title">{btn.label}</div>
                  <div className="reports-bento-desc">{btn.meta}</div>
                </div>
                <div className="reports-bento-meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className={`reports-bento-badge reports-bento-badge--${btn.variant}`}>{btn.badge}</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', opacity: isHovered ? 1 : 0.5, transition: 'opacity 0.2s ease' }}>
                    Abrir →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ padding: '16px 20px 0' }}>
        <button onClick={() => setActiveReport(REPORT_TYPES.hub)} className="btn-exit" type="button">
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver
        </button>
      </div>
      {activeReport === REPORT_TYPES.dashboard && <ReportsModule />}
      {activeReport === REPORT_TYPES.sales && <ReportsVentas />}
      {activeReport === REPORT_TYPES.accounting && <ReportsContabilidad />}
      {activeReport === REPORT_TYPES.institution && <ReportsInstitucion />}
      {![REPORT_TYPES.dashboard, REPORT_TYPES.sales, REPORT_TYPES.accounting, REPORT_TYPES.institution].includes(activeReport) && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>
          Reporte en construcción...
        </div>
      )}
    </div>
  );
}
