import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsChecklist, { ChecklistTemplateEditor } from './SettingsChecklist';
import SettingsEmpresas from './SettingsEmpresas';
import SettingsSalones from './SettingsSalones';
import SettingsGlobalGoals from './SettingsGlobalGoals';
import UserModal from './UserModal';
import SettingsServicios from './SettingsServicios';
import SettingsPlantillas from './SettingsPlantillas';
import SettingsFormasPago from './SettingsFormasPago';
import SettingsPlantillasContrato from './SettingsPlantillasContrato';
import SettingsTipoCambio from './SettingsTipoCambio';
import SettingsExport from './SettingsExport';
import SettingsImport from './SettingsImport';
import SettingsUsers from './SettingsUsers';
import SettingsEquipos from './SettingsEquipos';
import SettingsCitas from './SettingsCitas';
import SettingsMantenimiento from './SettingsMantenimiento';
import authService from '../../services/authService';
import '../reports/reports.css';
import './settings.css';

export default function SettingsMain() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');
  // Inline view: null = show overview, otherwise show the specific inline panel
  const [activeInlineView, setActiveInlineView] = useState(null);

  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="settings-page">
        <div className="reports-page-header" style={{ flexShrink: 0 }}>
          <div className="reports-brand-header">
            <div className="reports-brand-badge">
              <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
            </div>
            <div>
              <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="reports-title">Panel de Configuración</div>
              <div className="reports-subtitle">Solo accessible por administradores</div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={() => navigate('/calendar')}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        </div>
        <div className="settings-page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <div style={{ textAlign: 'center', color: '#94a3b8' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 12 }}>lock</span>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#64748b' }}>Acceso restringido</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Solo los administradores pueden acceder a la configuración.</div>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      id: 'general',
      label: 'General y Datos',
      icon: (
        <svg viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
      ),
    },
    {
      id: 'estructura',
      label: 'Salones y Metas',
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      ),
    },
    {
      id: 'servicios',
      label: 'Servicios y Catálogos',
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
        </svg>
      ),
    },
    {
      id: 'plantillas',
      label: 'Plantillas',
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      ),
    },
    {
      id: 'usuarios',
      label: 'Usuarios y Roles',
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
    },
    {
      id: 'citas',
      label: 'Citas y Alertas',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      ),
    },
  ];

  const openView = (view) => setActiveInlineView(view);
  const closeView = () => setActiveInlineView(null);

  // ── If an inline view is active, render only that view ──
  if (activeInlineView === 'empresas') {
    return (
      <div className="settings-page">
        <div className="reports-page-header" style={{ flexShrink: 0 }}>
          <div className="reports-brand-header">
            <div className="reports-brand-badge">
              <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
            </div>
            <div>
              <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="reports-title">Panel de Configuración</div>
              <div className="reports-subtitle">Gestión de empresas y clientes corporativos</div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={closeView}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        </div>
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'auto' }}>
          <SettingsEmpresas inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'salones') {
    return (
      <div className="settings-page">
        <div className="reports-page-header" style={{ flexShrink: 0 }}>
          <div className="reports-brand-header">
            <div className="reports-brand-badge">
              <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
            </div>
            <div>
              <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="reports-title">Panel de Configuración</div>
              <div className="reports-subtitle">Administración de salones y áreas</div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={closeView}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        </div>
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'auto' }}>
          <SettingsSalones inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'metas') {
    return (
      <div className="settings-page">
        <div className="reports-page-header" style={{ flexShrink: 0 }}>
          <div className="reports-brand-header">
            <div className="reports-brand-badge">
              <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
            </div>
            <div>
              <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="reports-title">Panel de Configuración</div>
              <div className="reports-subtitle">Metas globales de ventas</div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={closeView}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        </div>
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'auto' }}>
          <SettingsGlobalGoals inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'servicios') {
    return (
      <div className="settings-page">
        <div className="reports-page-header" style={{ flexShrink: 0 }}>
          <div className="reports-brand-header">
            <div className="reports-brand-badge">
              <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
            </div>
            <div>
              <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="reports-title">Panel de Configuración</div>
              <div className="reports-subtitle">Gestión de servicios, categorías y subcategorías</div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={closeView}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        </div>
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <SettingsServicios inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'plantillas') {
    return (
      <div className="settings-page">
        <div className="reports-page-header" style={{ flexShrink: 0 }}>
          <div className="reports-brand-header">
            <div className="reports-brand-badge">
              <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
            </div>
            <div>
              <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="reports-title">Panel de Configuración</div>
              <div className="reports-subtitle">Plantillas rápidas de servicios para cotizaciones</div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={closeView}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        </div>
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'auto' }}>
          <SettingsPlantillas inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'plantillas-contrato') {
    return (
      <div className="settings-page">
        <div className="reports-page-header" style={{ flexShrink: 0 }}>
          <div className="reports-brand-header">
            <div className="reports-brand-badge">
              <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
            </div>
            <div>
              <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="reports-title">Panel de Configuración</div>
              <div className="reports-subtitle">Configura qué plantilla HTML va con cada tipo de contrato</div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={closeView}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        </div>
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'auto' }}>
          <SettingsPlantillasContrato inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'formas-pago') {
    return (
      <div className="settings-page">
        <div className="reports-page-header" style={{ flexShrink: 0 }}>
          <div className="reports-brand-header">
            <div className="reports-brand-badge">
              <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
            </div>
            <div>
              <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="reports-title">Panel de Configuración</div>
              <div className="reports-subtitle">Formas de pago disponibles en cotizaciones y anticipos</div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={closeView}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        </div>
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'auto' }}>
          <div className="settings-section-card" style={{ overflow: 'visible' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>💳 Formas de Pago</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Crea, edita y deshabilita las formas de pago que aparecen en los combos de cotización y anticipos.
                </div>
              </div>
            </div>
            <SettingsFormasPago />
          </div>
        </div>
      </div>
    );
  }

  if (activeInlineView === 'tipo-cambio') {
    return (
      <div className="settings-page">
        <div className="reports-page-header" style={{ flexShrink: 0 }}>
          <div className="reports-brand-header">
            <div className="reports-brand-badge">
              <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
            </div>
            <div>
              <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="reports-title">Panel de Configuración</div>
              <div className="reports-subtitle">Define el tipo de cambio USD a GTQ para conversión de cotizaciones</div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={closeView}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        </div>
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'auto' }}>
          <SettingsTipoCambio inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'checklist') {
    return (
      <div className="settings-page">
        <div className="reports-page-header" style={{ flexShrink: 0 }}>
          <div className="reports-brand-header">
            <div className="reports-brand-badge">
              <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
            </div>
            <div>
              <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="reports-title">Panel de Configuración</div>
              <div className="reports-subtitle">Plantillas de checklists para eventos</div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={closeView}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        </div>
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'auto' }}>
          <div className="settings-section-card" style={{ overflow: 'visible' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>📋 Plantillas de Checklists</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Crea y edita las plantillas de verificación que se asignan a los eventos.
                </div>
              </div>
            </div>
            <ChecklistTemplateEditor />
          </div>
        </div>
      </div>
    );
  }

  // ── Main overview page with tabs ──
  return (
    <div className="settings-page">
      {/* Header */}
      <div className="reports-page-header" style={{ flexShrink: 0 }}>
        <div className="reports-brand-header">
          <div className="reports-brand-badge">
            <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
          </div>
          <div>
            <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
            <div className="reports-title">Panel de Configuración</div>
            <div className="reports-subtitle">Ajustes generales, estructura de salones, catálogos y migración de datos</div>
          </div>
        </div>
        <button className="btn-exit" type="button" onClick={() => navigate('/calendar')}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver
        </button>
      </div>

      {/* Body */}
      <div className="settings-page-body">
        <div className="settings-layout-row">
          {/* Sidebar Navigation */}
          <div className="settings-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`settings-nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          {/* Content Panel */}
          <div className="settings-content">
            {/* ── TAB: General y Datos ── */}
            {activeTab === 'general' && (
              <>
                <div className="settings-hero-section">
                  <div className="settings-category-header">
                    <h2 className="settings-category-title">General y Datos</h2>
                    <p className="settings-category-subtitle">
                      Administra los datos generales de la organización corporativa y herramientas de migración
                    </p>
                  </div>
                  <div className="settings-storytelling-card">
                    <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Visión general</span>
                    <p className="settings-story-text">
                      Desde aquí gestionas la base de datos de <strong className="highlight-blue">clientes corporativos</strong>,
                      la <strong className="highlight-blue">exportación</strong> de información del CRM y la
                      <strong className="highlight-blue"> importación</strong> de datos desde archivos CSV o Excel.
                      Todo en un solo lugar con trazabilidad completa.
                    </p>
                  </div>
                </div>

                <div className="settings-bento-card" onClick={() => openView('empresas')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Clientes y Empresas</h3>
                      <p className="settings-bento-desc">
                        Registra y modifica los datos de instituciones corporativas, agencias y clientes recurrentes.
                      </p>
                    </div>
                  </div>
                  <span className="settings-bento-btn" style={{ pointerEvents: 'none' }}>Abrir →</span>
                </div>

                <div className="settings-section-card">
                  <h3 className="settings-section-card-title">Exportación de Datos</h3>
                  <SettingsExport />
                </div>

                <div className="settings-section-card">
                  <h3 className="settings-section-card-title">Importación de Datos</h3>
                  <SettingsImport />
                </div>

                <div style={{ marginTop: '24px' }}>
                  <SettingsMantenimiento />
                </div>
              </>
            )}

            {/* ── TAB: Estructura y Espacios ── */}
            {activeTab === 'estructura' && (
              <>
                <div className="settings-hero-section">
                  <div className="settings-category-header">
                    <h2 className="settings-category-title">Estructura y Espacios</h2>
                    <p className="settings-category-subtitle">
                      Configura los salones de eventos, objetivos de facturación y flujos de trabajo
                    </p>
                  </div>
                  <div className="settings-storytelling-card">
                    <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Control de infraestructura</span>
                    <p className="settings-story-text">
                      Administra los <strong className="highlight-blue">salones y áreas</strong> del recinto,
                      establece las <strong className="highlight-blue">metas mensuales de ventas</strong> del equipo
                      y configura las <strong className="highlight-blue">plantillas de checklists</strong>
                      para estandarizar la operación de cada evento.
                    </p>
                  </div>
                </div>

                <div className="settings-bento-card" onClick={() => openView('salones')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <svg viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <path d="M9 3v18M15 3v18M3 9h18M3 15h18"></path>
                      </svg>
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Salones y Áreas</h3>
                      <p className="settings-bento-desc">
                        Define los nombres de los salones de eventos, capacidades operativas y estados de activación en calendario.
                      </p>
                    </div>
                  </div>
                  <span className="settings-bento-btn" style={{ pointerEvents: 'none' }}>Abrir →</span>
                </div>

                <div className="settings-bento-card" onClick={() => openView('tipo-cambio')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                      </svg>
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Tipo de Cambio USD → GTQ</h3>
                      <p className="settings-bento-desc">
                        Define el tipo de cambio para convertir cotizaciones en Dólares a Quetzales en reportes y métricas.
                      </p>
                    </div>
                  </div>
                  <span className="settings-bento-btn" style={{ pointerEvents: 'none' }}>Abrir →</span>
                </div>

                <div className="settings-bento-card" onClick={() => openView('metas')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Meta Mensual de Ventas</h3>
                      <p className="settings-bento-desc">
                        Establece el objetivo de ventas global del mes para supervisar el rendimiento comercial.
                      </p>
                    </div>
                  </div>
                  <span className="settings-bento-btn" style={{ pointerEvents: 'none' }}>Abrir →</span>
                </div>

                <div className="settings-bento-card" onClick={() => openView('checklist')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path>
                        <rect x="9" y="3" width="6" height="4" rx="1"></rect>
                        <path d="M9 14l2 2 4-4"></path>
                      </svg>
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Plantillas de Checklists</h3>
                      <p className="settings-bento-desc">
                        Crea y edita las plantillas de verificación que se asignan a los eventos.
                      </p>
                    </div>
                  </div>
                  <span className="settings-bento-btn" style={{ pointerEvents: 'none' }}>Abrir →</span>
                </div>
              </>
            )}

            {/* ── TAB: Servicios y Catálogos ── */}
            {activeTab === 'servicios' && (
              <>
                <div className="settings-hero-section">
                  <div className="settings-category-header">
                    <h2 className="settings-category-title">Servicios y Catálogos</h2>
                    <p className="settings-category-subtitle">
                      Administra los servicios ofrecidos, categorías y subcategorías para las cotizaciones
                    </p>
                  </div>
                  <div className="settings-storytelling-card">
                    <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Catálogo de servicios</span>
                    <p className="settings-story-text">
                      Gestiona el <strong className="highlight-blue">catálogo de servicios</strong>, las
                      <strong className="highlight-blue"> categorías</strong> y
                      <strong className="highlight-blue"> subcategorías</strong> que se utilizan en las cotizaciones de eventos.
                      Puedes importar y exportar servicios desde archivos CSV.
                    </p>
                  </div>
                </div>

                <div className="settings-bento-card" onClick={() => openView('servicios')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                      </svg>
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Servicios, Categorías y Subcategorías</h3>
                      <p className="settings-bento-desc">
                        CRUD completo de servicios con importación/exportación CSV, más administración de categorías y subcategorías.
                      </p>
                    </div>
                  </div>
                  <span className="settings-bento-btn" style={{ pointerEvents: 'none' }}>Abrir →</span>
                </div>

                <div className="settings-bento-card" onClick={() => openView('formas-pago')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <svg viewBox="0 0 24 24">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                        <line x1="1" y1="10" x2="23" y2="10"></line>
                      </svg>
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Formas de Pago</h3>
                      <p className="settings-bento-desc">
                        Administra las formas de pago disponibles en cotizaciones y anticipos (Efectivo, Tarjeta, Transferencia, etc.).
                      </p>
                    </div>
                  </div>
                  <span className="settings-bento-btn" style={{ pointerEvents: 'none' }}>Abrir →</span>
                </div>
              </>
            )}

            {/* ── TAB: Plantillas de Cotización ── */}
            {activeTab === 'plantillas' && (
              <>
                <div className="settings-hero-section">
                  <div className="settings-category-header">
                    <h2 className="settings-category-title">Plantillas de Cotización</h2>
                    <p className="settings-category-subtitle">
                      Crea y administra plantillas rápidas con servicios predefinidos para agilizar las cotizaciones
                    </p>
                  </div>
                  <div className="settings-storytelling-card">
                    <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Productividad comercial</span>
                    <p className="settings-story-text">
                      Las <strong className="highlight-blue">plantillas rápidas</strong> te permiten precargar conjuntos de servicios
                      recurrentes (paquetes, banquetes, montajes) en una sola selección.
                      Crea una plantilla, asígnale un nombre y estará disponible al hacer una cotización.
                    </p>
                  </div>
                </div>

                <div className="settings-bento-card" onClick={() => openView('plantillas')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Plantillas de Cotización</h3>
                      <p className="settings-bento-desc">
                        Administra las plantillas de servicios rápidos que aparecen en la sección de cotizaciones.
                      </p>
                    </div>
                  </div>
                  <span className="settings-bento-btn" style={{ pointerEvents: 'none' }}>Abrir →</span>
                </div>

                <div className="settings-bento-card" onClick={() => openView('plantillas-contrato')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Plantillas de Contrato</h3>
                      <p className="settings-bento-desc">
                        Configura qué archivo HTML (Jardines.html, ServiHosp.html) se usa para cada tipo de contrato.
                      </p>
                    </div>
                  </div>
                  <span className="settings-bento-btn" style={{ pointerEvents: 'none' }}>Abrir →</span>
                </div>
              </>
            )}

            {/* ── TAB: Usuarios y Roles ── */}
            {activeTab === 'usuarios' && (
              <>
                <div className="settings-hero-section">
                  <div className="settings-category-header">
                    <h2 className="settings-category-title">Usuarios y Roles</h2>
                    <p className="settings-category-subtitle">
                      Control de accesos y cuentas del equipo comercial y administrativo
                    </p>
                  </div>
                  <div className="settings-storytelling-card">
                    <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Gestión de acceso</span>
                    <p className="settings-story-text">
                      Administra las cuentas del equipo. Define <strong className="highlight-blue">roles</strong>
                      (Vendedor, Recepcionista, Admin), asigna <strong className="highlight-blue">metas comerciales</strong>
                      y controla el <strong className="highlight-blue">acceso</strong> al sistema.
                      Los usuarios se autentican con Google Login de forma segura.
                    </p>
                  </div>
                </div>

                <div className="settings-section-card">
                  <SettingsEquipos />
                </div>

                <div className="settings-section-card" style={{ marginTop: '16px' }}>
                  <SettingsUsers />
                </div>
              </>
            )}
            {/* ── TAB: Citas y Alertas ── */}
            {activeTab === 'citas' && (
              <>
                <div className="settings-hero-section">
                  <div className="settings-category-header">
                    <h2 className="settings-category-title">Citas y Alertas</h2>
                    <p className="settings-category-subtitle">
                      Configuración de notificaciones y tiempos de recordatorio para citas de seguimiento
                    </p>
                  </div>
                  <div className="settings-storytelling-card">
                    <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>Gestión de alertas</span>
                    <p className="settings-story-text">
                      Configura el <strong className="highlight-blue">tiempo de anticipación</strong> con el que los
                      vendedores recibirán recordatorios visuales de sus citas.
                      Esto ayuda a optimizar las llamadas de seguimiento sin saturar de notificaciones el panel lateral.
                    </p>
                  </div>
                </div>

                <div className="settings-section-card" style={{ overflow: 'visible' }}>
                  <SettingsCitas inline />
                </div>
              </>
            )}
          </div>
        </div>

        {/* SettingsChecklist — Event checklist modal (still needed for calendar integration) */}
        <SettingsChecklist />
        <UserModal />
      </div>
    </div>
  );
}
