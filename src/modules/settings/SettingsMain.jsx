import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Building2,
  DollarSign,
  Clock,
  ClipboardCheck,
  ShoppingBag,
  CreditCard,
  FileText,
  FileStack,
  ScrollText,
  Users,
  UserCheck,
  Calendar,
  CalendarClock,
  ShieldAlert,
  Download,
  Upload,
  Wrench,
  RefreshCw,
  Home,
  LayoutGrid,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Info,
  Lock
} from 'lucide-react';
import SettingsChecklist, { ChecklistTemplateEditor } from './SettingsChecklist';
import SettingsEmpresas from './SettingsEmpresas';
import SettingsSalones from './SettingsSalones';
import SettingsGlobalGoals from './SettingsGlobalGoals';
import SettingsServicios from './SettingsServicios';
import SettingsPlantillas from './SettingsPlantillas';
import SettingsFormasPago from './SettingsFormasPago';
import SettingsPlantillasContrato from './SettingsPlantillasContrato';
import SettingsTipoCambio from './SettingsTipoCambio';
import SettingsExport from './SettingsExport';
import SettingsImport from './SettingsImport';
import SettingsUsers from './SettingsUsers';
import SettingsEquipos from './SettingsEquipos';
import SettingsUsuariosManager from './SettingsUsuariosManager';
import SettingsCitas from './SettingsCitas';
import SettingsMantenimiento from './SettingsMantenimiento';
import SettingsUpdateCheck from './SettingsUpdateCheck';
import authService from '../../services/authService';
import '../reports/reports.css';
import './settings.css';

export default function SettingsMain() {
  const navigate = useNavigate();
  // Pestaña inicial: 'estructura' (Salones y Metas) como en la maqueta de referencia
  const [activeTab, setActiveTab] = useState('estructura');
  // Vista inline activa (pantalla completa con botón Volver)
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
              <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
              <div className="reports-title">Panel de Configuración</div>
              <div className="reports-subtitle">Solo accesible por administradores</div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={() => navigate('/calendar')}>
            <ArrowLeft size={16} />
            <span>Volver</span>
          </button>
        </div>
        <div className="settings-page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
          <div style={{ textAlign: 'center', color: '#94a3b8' }}>
            <Lock size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: '#475569' }}>Acceso restringido</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Solo los administradores pueden acceder a la configuración del sistema.</div>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      id: 'general',
      label: 'General y Datos',
      icon: <Database size={16} />,
      badge: activeTab === 'general' ? <span className="settings-nav-badge-active">Activo</span> : null
    },
    {
      id: 'estructura',
      label: 'Salones y Metas',
      icon: <Home size={16} />,
      badge: activeTab === 'estructura' ? <span className="settings-nav-badge-active">Activo</span> : null
    },
    {
      id: 'servicios',
      label: 'Servicios y Catálogos',
      icon: <ShoppingBag size={16} />,
      badge: activeTab === 'servicios' ? <span className="settings-nav-badge-active">Activo</span> : null
    },
    {
      id: 'plantillas',
      label: 'Plantillas',
      icon: <FileText size={16} />,
      badge: activeTab === 'plantillas' ? (
        <span className="settings-nav-badge-active">Activo</span>
      ) : (
        <span className="settings-nav-badge-count">6</span>
      )
    },
    {
      id: 'usuarios',
      label: 'Usuarios y Roles',
      icon: <Users size={16} />,
      badge: activeTab === 'usuarios' ? <span className="settings-nav-badge-active">Activo</span> : null
    },
    {
      id: 'citas',
      label: 'Citas y Alertas',
      icon: <Calendar size={16} />,
      badge: activeTab === 'citas' ? (
        <span className="settings-nav-badge-active">Activo</span>
      ) : (
        <span className="settings-nav-badge-dot" />
      )
    }
  ];

  const openView = (view) => setActiveInlineView(view);
  const closeView = () => setActiveInlineView(null);

  // Encabezado estandarizado para vistas inline de configuración
  const renderInlineHeader = (title, subtitle) => (
    <div className="reports-page-header" style={{ flexShrink: 0 }}>
      <div className="reports-brand-header">
        <div className="reports-brand-badge">
          <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
        </div>
        <div>
          <div className="reports-eyebrow">EMS Reservas | Jardines del Lago</div>
          <div className="reports-title">{title || 'Panel de Configuración'}</div>
          <div className="reports-subtitle">{subtitle || 'Ajustes del sistema'}</div>
        </div>
      </div>
      <button className="btn-exit" type="button" onClick={closeView}>
        <ArrowLeft size={16} />
        <span>Volver</span>
      </button>
    </div>
  );

  // ── RENDERIZADO DE VISTAS INLINE (PANTALLA COMPLETA CON RETORNO FLUIDO) ──
  if (activeInlineView === 'empresas') {
    return (
      <div className="settings-page" style={{ height: '100%', overflow: 'hidden' }}>
        <div className="settings-page-body" style={{ padding: '16px 28px 20px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <SettingsEmpresas inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'usuarios') {
    return (
      <div className="settings-page" style={{ height: '100%', overflow: 'hidden' }}>
        <div className="settings-page-body" style={{ padding: '16px 28px 20px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <SettingsUsuariosManager initialTab="usuarios" inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'equipos') {
    return (
      <div className="settings-page" style={{ height: '100%', overflow: 'hidden' }}>
        <div className="settings-page-body" style={{ padding: '16px 28px 20px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <SettingsUsuariosManager initialTab="equipos" inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'salones') {
    return (
      <div className="settings-page">
        {renderInlineHeader('Panel de Configuración', 'Administración de salones y áreas del recinto')}
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'auto' }}>
          <SettingsSalones inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'tipo-cambio') {
    return (
      <div className="settings-page">
        {renderInlineHeader('Panel de Configuración', 'Define el tipo de cambio USD a GTQ para conversión de cotizaciones')}
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'auto' }}>
          <SettingsTipoCambio inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'metas') {
    return (
      <div className="settings-page">
        {renderInlineHeader('Panel de Configuración', 'Metas globales mensuales de ventas')}
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'auto' }}>
          <SettingsGlobalGoals inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'checklist') {
    return (
      <div className="settings-page">
        {renderInlineHeader('Panel de Configuración', 'Plantillas de verificación y checklists para eventos')}
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

  if (activeInlineView === 'servicios') {
    return (
      <div className="settings-page">
        {renderInlineHeader('Panel de Configuración', 'Gestión de servicios, categorías y subcategorías')}
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <SettingsServicios inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'formas-pago') {
    return (
      <div className="settings-page">
        {renderInlineHeader('Panel de Configuración', 'Formas de pago autorizadas en cotizaciones y anticipos')}
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'auto' }}>
          <div className="settings-section-card" style={{ overflow: 'visible', maxWidth: '960px', margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>💳 Formas de Pago Autorizadas</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Crea, edita y habilita las formas de pago que aparecen en los selectores de cotización y anticipos.
                </div>
              </div>
            </div>
            <SettingsFormasPago />
          </div>
        </div>
      </div>
    );
  }

  if (activeInlineView === 'plantillas') {
    return (
      <div className="settings-page">
        {renderInlineHeader('Panel de Configuración', 'Plantillas rápidas de servicios para cotizaciones')}
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'auto' }}>
          <SettingsPlantillas inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'plantillas-contrato') {
    return (
      <div className="settings-page">
        {renderInlineHeader('Panel de Configuración', 'Configura qué plantilla HTML va con cada tipo de contrato')}
        <div className="settings-page-body" style={{ padding: '16px 28px 28px', overflowY: 'auto' }}>
          <SettingsPlantillasContrato inline onBack={closeView} />
        </div>
      </div>
    );
  }

  if (activeInlineView === 'export') {
    return (
      <div className="settings-page">
        {renderInlineHeader('Panel de Configuración', 'Exportación de datos de cotizaciones, eventos y clientes')}
        <div className="settings-page-body" style={{ padding: '20px 28px', overflowY: 'auto' }}>
          <div className="settings-section-card" style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
            <SettingsExport />
          </div>
        </div>
      </div>
    );
  }

  if (activeInlineView === 'import') {
    return (
      <div className="settings-page">
        {renderInlineHeader('Panel de Configuración', 'Importación masiva de datos desde archivos CSV o Excel')}
        <div className="settings-page-body" style={{ padding: '20px 28px', overflowY: 'auto' }}>
          <div className="settings-section-card" style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
            <SettingsImport />
          </div>
        </div>
      </div>
    );
  }

  if (activeInlineView === 'mantenimiento') {
    return (
      <div className="settings-page">
        {renderInlineHeader('Panel de Configuración', 'Herramientas de mantenimiento y diagnóstico de datos')}
        <div className="settings-page-body" style={{ padding: '20px 28px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
            <SettingsMantenimiento />
          </div>
        </div>
      </div>
    );
  }

  if (activeInlineView === 'actualizaciones') {
    return (
      <div className="settings-page">
        {renderInlineHeader('Panel de Configuración', 'Estado de la versión instalada y sincronización de Service Worker')}
        <div className="settings-page-body" style={{ padding: '20px 28px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
            <SettingsUpdateCheck />
          </div>
        </div>
      </div>
    );
  }

  if (activeInlineView === 'citas') {
    return (
      <div className="settings-page">
        {renderInlineHeader('Panel de Configuración', 'Parámetros de recordatorios de citas y control de eventos pasados')}
        <div className="settings-page-body" style={{ padding: '20px 28px', overflowY: 'auto' }}>
          <div className="settings-section-card" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <SettingsCitas inline onBack={closeView} />
          </div>
        </div>
      </div>
    );
  }

  // ── VISTA PRINCIPAL CON DISEÑO EJECUTIVO DE PESTAÑAS Y TARJETAS BENTO ──
  return (
    <div className="settings-page">
      {/* Header Institucional Superior */}
      <div className="settings-header-bar">
        <div className="settings-header-left">
          <div className="settings-brand-avatar">
            JL
          </div>
          <div className="settings-brand-info">
            <div className="settings-brand-eyebrow">
              <span>EMS RESERVAS</span>
              <span className="divider">/</span>
              <span className="highlight-brand">JARDINES DEL LAGO</span>
            </div>
            <h1 className="settings-header-title">Panel de Configuración</h1>
          </div>
        </div>

        <div className="settings-header-actions">
          <button
            type="button"
            className="settings-btn-audit"
            onClick={() => openView('mantenimiento')}
            title="Ver trazabilidad de cambios del sistema"
          >
            <Clock size={15} color="#64748b" />
            <span>Historial de Auditoría</span>
          </button>

          <button
            type="button"
            className="settings-btn-back"
            onClick={() => navigate('/calendar')}
          >
            <ArrowLeft size={15} />
            <span>Volver al Tablero</span>
          </button>
        </div>
      </div>

      {/* Cuerpo Principal: Sidebar de Cápsulas + Contenido */}
      <div className="settings-page-body">
        <div className="settings-layout-grid">
          {/* Columna Izquierda: Sidebar de Módulos */}
          <div className="settings-sidebar-col">
            <div className="settings-sidebar-eyebrow">Módulos del Sistema</div>
            <div className="settings-nav">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <div className="settings-nav-left">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge}
                </button>
              ))}
            </div>

            {/* Tarjeta Sincronización en vivo */}
            <div className="settings-sync-card">
              <div className="settings-sync-header">
                <Info size={14} color="#0284c7" />
                <span>Sincronización en vivo</span>
              </div>
              <p className="settings-sync-text">
                Los cambios se sincronizan en tiempo real con la app de cotizaciones y calendarios del personal.
              </p>
            </div>
          </div>

          {/* Columna Derecha: Tarjeta Blanca Principal */}
          <div className="settings-content-card">
            {/* ════════════ 1. GENERAL Y DATOS ════════════ */}
            {activeTab === 'general' && (
              <>
                <div className="settings-content-header">
                  <div>
                    <h2 className="settings-category-title">General y Datos</h2>
                    <p className="settings-category-subtitle">
                      Administra los datos generales de la organización corporativa y herramientas de migración.
                    </p>
                  </div>
                  <div className="settings-status-badge">
                    <span className="settings-status-dot" />
                    <span>Base de Datos Activa</span>
                  </div>
                </div>

                <div className="settings-storytelling-banner">
                  <div className="settings-storytelling-icon-solid">
                    <Database size={20} color="#ffffff" />
                  </div>
                  <div className="settings-storytelling-body">
                    <div className="settings-storytelling-eyebrow">ADMINISTRACIÓN GENERAL Y MIGRACIÓN</div>
                    <p className="settings-storytelling-text">
                      Gestiona la base de datos de <strong>clientes corporativos</strong>, la <strong>exportación e importación</strong> de información del CRM, el <strong>mantenimiento de base de datos</strong> y la verificación de <strong>actualizaciones del sistema</strong>.
                    </p>
                  </div>
                </div>

                <div className="settings-bento-grid">
                  {/* Tarjeta: Clientes y Empresas */}
                  <div className="settings-bento-card" onClick={() => openView('empresas')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-blue">
                        <Building2 size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Clientes y Empresas</h3>
                          <span className="settings-bento-badge badge-blue">Directorio Activo</span>
                        </div>
                        <p className="settings-bento-desc">
                          Registra y modifica los datos de instituciones corporativas, agencias y clientes recurrentes.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span className="settings-meta-pill-green"><span className="dot" /> Base corporativa sincronizada</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('empresas'); }}>
                      <span>Gestionar Empresas</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Tarjeta: Exportación de Datos */}
                  <div className="settings-bento-card" onClick={() => openView('export')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-green">
                        <Download size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Exportación de Datos</h3>
                          <span className="settings-bento-badge badge-green">Excel & JSON</span>
                        </div>
                        <p className="settings-bento-desc">
                          Descarga copias de seguridad de cotizaciones, eventos y clientes en planillas Excel y JSON.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span>Formatos compatibles con contabilidad y BI</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('export'); }}>
                      <span>Exportar Datos</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Tarjeta: Importación de Datos */}
                  <div className="settings-bento-card" onClick={() => openView('import')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-amber">
                        <Upload size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Importación de Datos</h3>
                          <span className="settings-bento-badge badge-amber">Carga Masiva</span>
                        </div>
                        <p className="settings-bento-desc">
                          Carga masiva de eventos, empresas y catálogos desde archivos CSV o planillas Excel compatibles.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span>Validación y prevención de duplicados</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('import'); }}>
                      <span>Importar Archivos</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Tarjeta: Mantenimiento y Diagnóstico */}
                  <div className="settings-bento-card" onClick={() => openView('mantenimiento')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-purple">
                        <Wrench size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Mantenimiento y Diagnóstico</h3>
                          <span className="settings-bento-badge badge-purple">MariaDB Health</span>
                        </div>
                        <p className="settings-bento-desc">
                          Auditoría y saneamiento de registros huérfanos, caché de sincronización e integridad de datos.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span className="settings-meta-pill-green"><span className="dot" /> Rendimiento de consultas optimizado</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('mantenimiento'); }}>
                      <span>Mantenimiento BD</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Tarjeta: Actualizaciones del Sistema */}
                  <div className="settings-bento-card" onClick={() => openView('actualizaciones')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-cyan">
                        <RefreshCw size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Actualizaciones del Sistema</h3>
                          <span className="settings-bento-badge badge-blue">Versión Activa</span>
                        </div>
                        <p className="settings-bento-desc">
                          Verifica la versión instalada de la aplicación, estado del Service Worker y cierre de sesión seguro.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span>Sincronización en caliente y purga de caché automática</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('actualizaciones'); }}>
                      <span>Verificar Versión</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ════════════ 2. SALONES Y METAS (ESTRUCTURA Y ESPACIOS) ════════════ */}
            {activeTab === 'estructura' && (
              <>
                <div className="settings-content-header">
                  <div>
                    <h2 className="settings-category-title">Estructura y Espacios</h2>
                    <p className="settings-category-subtitle">
                      Configura los salones de eventos, objetivos de facturación y flujos de trabajo operativos.
                    </p>
                  </div>
                  <div className="settings-status-badge">
                    <span className="settings-status-dot" />
                    <span>Sistema Operativo Activo</span>
                  </div>
                </div>

                <div className="settings-storytelling-banner">
                  <div className="settings-storytelling-icon-solid">
                    <Building2 size={20} color="#ffffff" />
                  </div>
                  <div className="settings-storytelling-body">
                    <div className="settings-storytelling-eyebrow">CONTROL DE INFRAESTRUCTURA</div>
                    <p className="settings-storytelling-text">
                      Administra los <strong>salones y áreas</strong> del recinto, establece las <strong>metas mensuales de ventas</strong> del equipo y configura las <strong>plantillas de checklists</strong> para estandarizar la operación de cada evento.
                    </p>
                  </div>
                </div>

                <div className="settings-bento-grid">
                  {/* Tarjeta 1: Salones y Áreas */}
                  <div className="settings-bento-card" onClick={() => openView('salones')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-blue">
                        <LayoutGrid size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Salones y Áreas</h3>
                          <span className="settings-bento-badge badge-gray">8 Salones Activos</span>
                        </div>
                        <p className="settings-bento-desc">
                          Define los nombres de los salones de eventos, capacidades operativas y estados de activación en calendario.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span className="settings-meta-pill-green">
                            <span className="dot" /> 100% disponibles
                          </span>
                          <span>· 2 Áreas exteriores de jardines</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('salones'); }}>
                      <span>Gestionar Áreas</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Tarjeta 2: Tipo de Cambio USD → GTQ */}
                  <div className="settings-bento-card" onClick={() => openView('tipo-cambio')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-green">
                        <span style={{ fontWeight: 800, fontSize: '15px', color: '#059669', letterSpacing: '-0.5px' }}>$/Q</span>
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Tipo de Cambio USD → GTQ</h3>
                          <span className="settings-bento-badge badge-green">1 USD = Q 7.82 GTQ</span>
                        </div>
                        <p className="settings-bento-desc">
                          Define el tipo de cambio para convertir cotizaciones en Dólares a Quetzales en reportes y métricas.
                        </p>
                        <div className="settings-bento-meta-row">
                          <Clock size={13} color="#64748b" />
                          <span>Actualizado automáticamente hoy a las 08:30 AM (Banco Central)</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('tipo-cambio'); }}>
                      <span>Ajustar Tasa</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Tarjeta 3: Meta Mensual de Ventas */}
                  <div className="settings-bento-card" onClick={() => openView('metas')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-amber">
                        <TrendingUp size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Meta Mensual de Ventas</h3>
                          <span className="settings-bento-badge badge-amber">Septiembre: Q 850,000.00</span>
                        </div>
                        <p className="settings-bento-desc">
                          Establece el objetivo de ventas global del mes para supervisar el rendimiento comercial.
                        </p>
                        <div className="settings-progress-wrap">
                          <div className="settings-progress-labels">
                            <span className="label-title">Avance actual</span>
                            <span className="label-val">84.5% (Q 718,250.00)</span>
                          </div>
                          <div className="settings-progress-track">
                            <div className="settings-progress-fill" style={{ width: '84.5%' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('metas'); }}>
                      <span>Definir Objetivos</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Tarjeta 4: Plantillas de Checklists */}
                  <div className="settings-bento-card" onClick={() => openView('checklist')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-purple">
                        <ClipboardCheck size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Plantillas de Checklists</h3>
                          <span className="settings-bento-badge badge-purple">6 Modelos</span>
                        </div>
                        <p className="settings-bento-desc">
                          Crea y edita las plantillas de verificación que se asignan a los eventos para asegurar la calidad de servicio.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span className="settings-meta-tag">Montaje de Salón</span>
                          <span className="settings-meta-tag">Banquete y Cocina</span>
                          <span className="settings-meta-tag">Audio / Luces</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('checklist'); }}>
                      <span>Configurar Plantillas</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ════════════ 3. SERVICIOS Y CATÁLOGOS ════════════ */}
            {activeTab === 'servicios' && (
              <>
                <div className="settings-content-header">
                  <div>
                    <h2 className="settings-category-title">Servicios y Catálogos</h2>
                    <p className="settings-category-subtitle">
                      Administra los servicios ofrecidos, categorías y subcategorías para las cotizaciones.
                    </p>
                  </div>
                  <div className="settings-status-badge">
                    <span className="settings-status-dot" />
                    <span>Catálogo Operativo Activo</span>
                  </div>
                </div>

                <div className="settings-storytelling-banner">
                  <div className="settings-storytelling-icon-solid">
                    <ShoppingBag size={20} color="#ffffff" />
                  </div>
                  <div className="settings-storytelling-body">
                    <div className="settings-storytelling-eyebrow">CATÁLOGO COMERCIAL Y OPERATIVO</div>
                    <p className="settings-storytelling-text">
                      Gestiona el <strong>catálogo de servicios</strong>, las <strong>categorías</strong> y <strong>subcategorías</strong> utilizadas en cotizaciones, así como las <strong>formas de pago autorizadas</strong> para cobros y anticipos.
                    </p>
                  </div>
                </div>

                <div className="settings-bento-grid">
                  {/* Tarjeta: Servicios, Categorías y Subcategorías */}
                  <div className="settings-bento-card" onClick={() => openView('servicios')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-blue">
                        <ShoppingBag size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Servicios, Categorías y Subcategorías</h3>
                          <span className="settings-bento-badge badge-blue">CRUD Completo</span>
                        </div>
                        <p className="settings-bento-desc">
                          Gestión completa de servicios con importación/exportación CSV, precios vigentes y estructura jerárquica.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span className="settings-meta-pill-green"><span className="dot" /> Precios y costos sincronizados</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('servicios'); }}>
                      <span>Gestionar Servicios</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Tarjeta: Formas de Pago Autorizadas */}
                  <div className="settings-bento-card" onClick={() => openView('formas-pago')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-green">
                        <CreditCard size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Formas de Pago Autorizadas</h3>
                          <span className="settings-bento-badge badge-green">Modalidades Activas</span>
                        </div>
                        <p className="settings-bento-desc">
                          Administra las modalidades de pago disponibles (Transferencia, Boleta, Tarjeta, Cheque, Efectivo) para cobros y anticipos.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span className="settings-meta-tag">Transferencia</span>
                          <span className="settings-meta-tag">Depósito</span>
                          <span className="settings-meta-tag">Cheque / Tarjeta</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('formas-pago'); }}>
                      <span>Configurar Pagos</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ════════════ 4. PLANTILLAS ════════════ */}
            {activeTab === 'plantillas' && (
              <>
                <div className="settings-content-header">
                  <div>
                    <h2 className="settings-category-title">Plantillas de Cotización y Contratos</h2>
                    <p className="settings-category-subtitle">
                      Estandariza paquetes de servicios y formatos legales para agilizar la venta.
                    </p>
                  </div>
                  <div className="settings-status-badge">
                    <span className="settings-status-dot" />
                    <span>Modelos Estandarizados</span>
                  </div>
                </div>

                <div className="settings-storytelling-banner">
                  <div className="settings-storytelling-icon-solid">
                    <FileStack size={20} color="#ffffff" />
                  </div>
                  <div className="settings-storytelling-body">
                    <div className="settings-storytelling-eyebrow">ESTANDARIZACIÓN DE DOCUMENTOS Y OFERTAS</div>
                    <p className="settings-storytelling-text">
                      Configura <strong>paquetes rápidos de servicios</strong> para agregarlos con un solo clic a las cotizaciones y administra las <strong>plantillas HTML de contratos</strong> según el tipo de evento.
                    </p>
                  </div>
                </div>

                <div className="settings-bento-grid">
                  {/* Tarjeta: Plantillas Rápidas de Servicios */}
                  <div className="settings-bento-card" onClick={() => openView('plantillas')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-blue">
                        <FileStack size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Plantillas Rápidas de Servicios</h3>
                          <span className="settings-bento-badge badge-blue">Paquetes Rápidos</span>
                        </div>
                        <p className="settings-bento-desc">
                          Combos preconfigurados de alimentos, bebidas, salones y mobiliario para cotizaciones inmediatas.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span className="settings-meta-tag">Paquetes de Bodas</span>
                          <span className="settings-meta-tag">Corporativos</span>
                          <span className="settings-meta-tag">Cumpleaños</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('plantillas'); }}>
                      <span>Gestionar Paquetes</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Tarjeta: Plantillas de Contratos Legales */}
                  <div className="settings-bento-card" onClick={() => openView('plantillas-contrato')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-purple">
                        <ScrollText size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Plantillas de Contratos Legales</h3>
                          <span className="settings-bento-badge badge-purple">Formatos HTML</span>
                        </div>
                        <p className="settings-bento-desc">
                          Vincula el diseño y cláusulas contractuales HTML para contratos corporativos, sociales y de hospedaje.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span className="settings-meta-pill-green"><span className="dot" /> Cláusulas legales vigentes</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('plantillas-contrato'); }}>
                      <span>Editar Contratos</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ════════════ 5. USUARIOS Y ROLES ════════════ */}
            {activeTab === 'usuarios' && (
              <>
                <div className="settings-content-header">
                  <div>
                    <h2 className="settings-category-title">Usuarios, Roles y Equipos</h2>
                    <p className="settings-category-subtitle">
                      Control de accesos, credenciales del personal y asignación de ejecutivos.
                    </p>
                  </div>
                  <div className="settings-status-badge">
                    <span className="settings-status-dot" />
                    <span>Control de Acceso Seguro</span>
                  </div>
                </div>

                <div className="settings-storytelling-banner">
                  <div className="settings-storytelling-icon-solid">
                    <Users size={20} color="#ffffff" />
                  </div>
                  <div className="settings-storytelling-body">
                    <div className="settings-storytelling-eyebrow">SEGURIDAD, ACCESOS Y EQUIPOS</div>
                    <p className="settings-storytelling-text">
                      Supervisa los <strong>usuarios activos</strong>, gestiona sus <strong>roles y contraseñas</strong>, y organiza los <strong>equipos comerciales</strong> para distribución de leads y metas.
                    </p>
                  </div>
                </div>

                <div className="settings-bento-grid">
                  {/* Tarjeta: Usuarios y Credenciales */}
                  <div className="settings-bento-card" onClick={() => openView('usuarios')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-blue">
                        <Users size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Usuarios y Credenciales</h3>
                          <span className="settings-bento-badge badge-blue">Cuentas y Roles</span>
                        </div>
                        <p className="settings-bento-desc">
                          Alta, edición y desactivación de cuentas de ejecutivos de venta, supervisores y administradores.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span className="settings-meta-pill-green"><span className="dot" /> Autenticación JWT y roles seguros</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('usuarios'); }}>
                      <span>Gestionar Cuentas</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Tarjeta: Equipos de Trabajo y Asesores */}
                  <div className="settings-bento-card" onClick={() => openView('equipos')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-green">
                        <UserCheck size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Equipos de Trabajo y Asesores</h3>
                          <span className="settings-bento-badge badge-green">Departamentos</span>
                        </div>
                        <p className="settings-bento-desc">
                          Agrupa ejecutivos por departamentos o unidades de negocio para asignación automática de eventos.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span className="settings-meta-tag">Ventas Corporativas</span>
                          <span className="settings-meta-tag">Bodas</span>
                          <span className="settings-meta-tag">Sociales</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('equipos'); }}>
                      <span>Asignar Equipos</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ════════════ 6. CITAS Y ALERTAS ════════════ */}
            {activeTab === 'citas' && (
              <>
                <div className="settings-content-header">
                  <div>
                    <h2 className="settings-category-title">Citas y Alertas del Sistema</h2>
                    <p className="settings-category-subtitle">
                      Parámetros de recordatorios para atención comercial y control de cierres.
                    </p>
                  </div>
                  <div className="settings-status-badge">
                    <span className="settings-status-dot" />
                    <span>Notificaciones Activas</span>
                  </div>
                </div>

                <div className="settings-storytelling-banner">
                  <div className="settings-storytelling-icon-solid">
                    <Calendar size={20} color="#ffffff" />
                  </div>
                  <div className="settings-storytelling-body">
                    <div className="settings-storytelling-eyebrow">SEGUIMIENTO COMERCIAL Y CONTROL OPERATIVO</div>
                    <p className="settings-storytelling-text">
                      Define el <strong>tiempo de anticipación de alertas</strong> para citas con clientes y establece el <strong>margen de días de gracia</strong> permitido para modificar eventos de fechas pasadas.
                    </p>
                  </div>
                </div>

                <div className="settings-bento-grid">
                  {/* Tarjeta: Recordatorios y Alertas de Citas */}
                  <div className="settings-bento-card" onClick={() => openView('citas')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-blue">
                        <CalendarClock size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Recordatorios y Alertas de Citas</h3>
                          <span className="settings-bento-badge badge-blue">Push & Campana</span>
                        </div>
                        <p className="settings-bento-desc">
                          Configura cuántas horas o días antes se notifican visualmente las citas y visitas comerciales pendientes.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span className="settings-meta-pill-green"><span className="dot" /> Alertas visuales y Web Push</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('citas'); }}>
                      <span>Ajustar Alertas</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Tarjeta: Bloqueo de Edición de Eventos Pasados */}
                  <div className="settings-bento-card" onClick={() => openView('citas')}>
                    <div className="settings-bento-left">
                      <div className="settings-bento-icon-box is-amber">
                        <ShieldAlert size={22} strokeWidth={2.2} />
                      </div>
                      <div className="settings-bento-info">
                        <div className="settings-bento-header-row">
                          <h3 className="settings-bento-title">Bloqueo y Margen de Edición de Eventos Pasados</h3>
                          <span className="settings-bento-badge badge-amber">Seguridad de Cierre</span>
                        </div>
                        <p className="settings-bento-desc">
                          Control de seguridad que bloquea la alteración de cotizaciones y detalles en eventos cuya fecha ya concluyó.
                        </p>
                        <div className="settings-bento-meta-row">
                          <span>Días de tolerancia configurables por administración</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="settings-action-btn" onClick={(e) => { e.stopPropagation(); openView('citas'); }}>
                      <span>Configurar Bloqueo</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Footer Institucional */}
            <div className="settings-footer">
              <div className="settings-footer-left">
                <ShieldCheck size={14} color="#64748b" />
                <span>Último respaldo de base de datos generado hoy a las 04:00 AM (Automático)</span>
              </div>
              <div className="settings-footer-right">
                <span>Jardines del Lago v4.8 Enterprise</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
