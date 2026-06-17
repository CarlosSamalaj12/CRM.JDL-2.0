import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserModal from './UserModal';
import CompanyModal from './CompanyModal';
import SettingsSalones from './SettingsSalones';
import SettingsChecklist from './SettingsChecklist';
import SettingsExport from './SettingsExport';
import SettingsGlobalGoals from './SettingsGlobalGoals';
import SettingsImport from './SettingsImport';
import SettingsUsers from './SettingsUsers';
import authService from '../../services/authService';
import '../reports/reports.css';
import './settings.css';

export default function SettingsMain() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');

  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  const handleModalClose = () => {};

  const openModalById = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.hidden = false;
    }
  };

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
  ];

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
        <button
          className="btn-exit"
          type="button"
          onClick={() => navigate('/calendar')}
        >
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

                <div className="settings-bento-card">
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
                  <button
                    type="button"
                    className="settings-bento-btn"
                    onClick={() => openModalById('companyBackdrop')}
                  >
                    Administrar Empresas
                  </button>
                </div>

                <div className="settings-section-card">
                  <h3 className="settings-section-card-title">Exportación de Datos</h3>
                  <SettingsExport />
                </div>

                <div className="settings-section-card">
                  <h3 className="settings-section-card-title">Importación de Datos</h3>
                  <SettingsImport />
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

                <div className="settings-bento-card">
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
                  <button
                    type="button"
                    className="settings-bento-btn"
                    onClick={() => openModalById('salonesBackdrop')}
                  >
                    Administrar Salones
                  </button>
                </div>

                <div className="settings-bento-card">
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
                  <button
                    type="button"
                    className="settings-bento-btn"
                    onClick={() => openModalById('globalGoalsBackdrop')}
                  >
                    Configurar Metas
                  </button>
                </div>

                <div className="settings-bento-card">
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <svg viewBox="0 0 24 24">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                      </svg>
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Plantillas de Checklists</h3>
                      <p className="settings-bento-desc">
                        Crea listas de tareas automatizadas que se asignan a los eventos según sus requerimientos.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="settings-bento-btn"
                    onClick={() => openModalById('checklistTemplateBackdrop')}
                  >
                    Configurar Checklists
                  </button>
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

                <div className="settings-bento-card">
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Gestión de Usuarios</h3>
                      <p className="settings-bento-desc">
                        Crea cuentas de acceso, asigna contraseñas y define roles (Vendedor, Recepcionista, Admin).
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="settings-bento-btn"
                    disabled={!isAdmin}
                    onClick={() => openModalById('userBackdrop')}
                  >
                    {isAdmin ? 'Administrar Usuarios' : 'Solo Administrador'}
                  </button>
                </div>

                <div className="settings-section-card">
                  <SettingsUsers />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Modals */}
        {isAdmin && <UserModal onClose={handleModalClose} />}
        <CompanyModal onClose={handleModalClose} />
        <SettingsSalones />
        <SettingsChecklist />
        <SettingsGlobalGoals />
      </div>
    </div>
  );
}
