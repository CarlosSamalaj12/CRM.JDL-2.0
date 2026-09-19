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
      icon: <Database size={16} />
    },
    {
      id: 'estructura',
      label: 'Salones y Metas',
      icon: <Home size={16} />
    },
    {
      id: 'servicios',
      label: 'Servicios y Catálogos',
      icon: <ShoppingBag size={16} />
    },
    {
      id: 'plantillas',
      label: 'Plantillas',
      icon: <FileText size={16} />
    },
    {
      id: 'usuarios',
      label: 'Usuarios y Roles',
      icon: <Users size={16} />
    },
    {
      id: 'citas',
      label: 'Citas y Alertas',
      icon: <Calendar size={16} />
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
      {/* Header Institucional */}
      <div className="reports-page-header" style={{ flexShrink: 0 }}>
        <div className="reports-brand-header">
          <div className="reports-brand-badge">
            <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
          </div>
          <div>
            <div className="reports-eyebrow">EMS RESERVAS | JARDINES DEL LAGO</div>
            <div className="reports-title">Panel de Configuración</div>
            <div className="reports-subtitle">Ajustes generales, estructura de salones, catálogos y migración de datos</div>
          </div>
        </div>
        <button className="btn-exit" type="button" onClick={() => navigate('/calendar')}>
          <ArrowLeft size={16} />
          <span>Volver</span>
        </button>
      </div>

      {/* Cuerpo Principal: Sidebar de Cápsulas + Contenido */}
      <div className="settings-page-body">
        <div className="settings-layout-row">
          {/* Navegación Lateral Tipo Píldora / Cápsula */}
          <div className="settings-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`settings-nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Panel de Contenido de la Pestaña Activa */}
          <div className="settings-content">
            {/* ════════════ 1. GENERAL Y DATOS ════════════ */}
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
                    <div className="settings-storytelling-tag">Administración General y Migración</div>
                    <p className="settings-story-text">
                      Desde aquí gestionas la base de datos de <strong className="highlight-blue">clientes corporativos</strong>, la <strong className="highlight-blue">exportación e importación</strong> de información del CRM, el <strong className="highlight-blue">mantenimiento de base de datos</strong> y la verificación de <strong className="highlight-blue">actualizaciones del sistema</strong>.
                    </p>
                  </div>
                </div>

                {/* Tarjeta: Clientes y Empresas (Azul) */}
                <div className="settings-bento-card is-blue" onClick={() => openView('empresas')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <Building2 size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Clientes y Empresas</h3>
                      <p className="settings-bento-desc">
                        Registra y modifica los datos de instituciones corporativas, agencias y clientes recurrentes.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('empresas')}>
                    <span>Abrir →</span>
                  </button>
                </div>

                {/* Tarjeta: Exportación de Datos (Verde) */}
                <div className="settings-bento-card is-green" onClick={() => openView('export')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <Download size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Exportación de Datos</h3>
                      <p className="settings-bento-desc">
                        Descarga copias de seguridad de cotizaciones, eventos y clientes en planillas Excel y JSON.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('export')}>
                    <span>Abrir →</span>
                  </button>
                </div>

                {/* Tarjeta: Importación de Datos (Ámbar) */}
                <div className="settings-bento-card is-amber" onClick={() => openView('import')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <Upload size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Importación de Datos</h3>
                      <p className="settings-bento-desc">
                        Carga masiva de eventos, empresas y catálogos desde archivos CSV o planillas Excel compatibles.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('import')}>
                    <span>Abrir →</span>
                  </button>
                </div>

                {/* Tarjeta: Mantenimiento y Diagnóstico (Púrpura) */}
                <div className="settings-bento-card is-purple" onClick={() => openView('mantenimiento')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <Wrench size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Mantenimiento y Diagnóstico</h3>
                      <p className="settings-bento-desc">
                        Auditoría y saneamiento de registros huérfanos, caché de sincronización e integridad de datos.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('mantenimiento')}>
                    <span>Abrir →</span>
                  </button>
                </div>

                {/* Tarjeta: Actualizaciones del Sistema (Cian) */}
                <div className="settings-bento-card is-cyan" onClick={() => openView('actualizaciones')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <RefreshCw size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Actualizaciones del Sistema</h3>
                      <p className="settings-bento-desc">
                        Verifica la versión instalada de la aplicación, estado del Service Worker y cierre de sesión seguro.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('actualizaciones')}>
                    <span>Abrir →</span>
                  </button>
                </div>
              </>
            )}

            {/* ════════════ 2. SALONES Y METAS (EXACTO A IMAGEN DE REFERENCIA) ════════════ */}
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
                    <div className="settings-storytelling-tag">Control de Infraestructura</div>
                    <p className="settings-story-text">
                      Administra los <strong className="highlight-blue">salones y áreas</strong> del recinto, establece las <strong className="highlight-blue">metas mensuales de ventas</strong> del equipo y configura las <strong className="highlight-blue">plantillas de checklists</strong> para estandarizar la operación de cada evento.
                    </p>
                  </div>
                </div>

                {/* Tarjeta 1: Salones y Áreas (Azul) */}
                <div className="settings-bento-card is-blue" onClick={() => openView('salones')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <LayoutGrid size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Salones y Áreas</h3>
                      <p className="settings-bento-desc">
                        Define los nombres de los salones de eventos, capacidades operativas y estados de activación en calendario.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('salones')}>
                    <span>Abrir →</span>
                  </button>
                </div>

                {/* Tarjeta 2: Tipo de Cambio USD — GTQ (Verde) */}
                <div className="settings-bento-card is-green" onClick={() => openView('tipo-cambio')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <DollarSign size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Tipo de Cambio USD — GTQ</h3>
                      <p className="settings-bento-desc">
                        Define el tipo de cambio para convertir cotizaciones en Dólares a Quetzales en reportes y métricas.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('tipo-cambio')}>
                    <span>Abrir →</span>
                  </button>
                </div>

                {/* Tarjeta 3: Meta Mensual de Ventas (Ámbar) */}
                <div className="settings-bento-card is-amber" onClick={() => openView('metas')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <Clock size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Meta Mensual de Ventas</h3>
                      <p className="settings-bento-desc">
                        Establece el objetivo de ventas global del mes para supervisar el rendimiento comercial.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('metas')}>
                    <span>Abrir →</span>
                  </button>
                </div>

                {/* Tarjeta 4: Plantillas de Checklists (Púrpura) */}
                <div className="settings-bento-card is-purple" onClick={() => openView('checklist')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <ClipboardCheck size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Plantillas de Checklists</h3>
                      <p className="settings-bento-desc">
                        Crea y edita las plantillas de verificación que se asignan a los eventos.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('checklist')}>
                    <span>Abrir →</span>
                  </button>
                </div>
              </>
            )}

            {/* ════════════ 3. SERVICIOS Y CATÁLOGOS ════════════ */}
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
                    <div className="settings-storytelling-tag">Catálogo Comercial y Operativo</div>
                    <p className="settings-story-text">
                      Gestiona el <strong className="highlight-blue">catálogo de servicios</strong>, las <strong className="highlight-blue">categorías</strong> y <strong className="highlight-blue">subcategorías</strong> utilizadas en cotizaciones, así como las <strong className="highlight-blue">formas de pago autorizadas</strong> para cobros y anticipos.
                    </p>
                  </div>
                </div>

                {/* Tarjeta: Servicios, Categorías y Subcategorías (Azul) */}
                <div className="settings-bento-card is-blue" onClick={() => openView('servicios')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <ShoppingBag size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Servicios, Categorías y Subcategorías</h3>
                      <p className="settings-bento-desc">
                        CRUD completo de servicios con importación/exportación CSV, precios vigentes y estructura jerárquica.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('servicios')}>
                    <span>Abrir →</span>
                  </button>
                </div>

                {/* Tarjeta: Formas de Pago Autorizadas (Verde) */}
                <div className="settings-bento-card is-green" onClick={() => openView('formas-pago')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <CreditCard size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Formas de Pago Autorizadas</h3>
                      <p className="settings-bento-desc">
                        Administra las modalidades de pago disponibles (Transferencia, Boleta, Tarjeta, Cheque, Efectivo) para cobros y anticipos.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('formas-pago')}>
                    <span>Abrir →</span>
                  </button>
                </div>
              </>
            )}

            {/* ════════════ 4. PLANTILLAS ════════════ */}
            {activeTab === 'plantillas' && (
              <>
                <div className="settings-hero-section">
                  <div className="settings-category-header">
                    <h2 className="settings-category-title">Plantillas de Cotización y Contratos</h2>
                    <p className="settings-category-subtitle">
                      Estandariza paquetes de servicios y formatos legales para agilizar la venta
                    </p>
                  </div>
                  <div className="settings-storytelling-card">
                    <div className="settings-storytelling-tag">Estandarización de Documentos y Ofertas</div>
                    <p className="settings-story-text">
                      Configura <strong className="highlight-blue">paquetes rápidos de servicios</strong> para agregarlos con un solo clic a las cotizaciones y administra las <strong className="highlight-blue">plantillas HTML de contratos</strong> según el tipo de evento.
                    </p>
                  </div>
                </div>

                {/* Tarjeta: Plantillas Rápidas de Servicios (Azul) */}
                <div className="settings-bento-card is-blue" onClick={() => openView('plantillas')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <FileStack size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Plantillas Rápidas de Servicios</h3>
                      <p className="settings-bento-desc">
                        Combos preconfigurados de alimentos, bebidas, salones y mobiliario para cotizaciones inmediatas.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('plantillas')}>
                    <span>Abrir →</span>
                  </button>
                </div>

                {/* Tarjeta: Plantillas de Contratos Legales (Púrpura) */}
                <div className="settings-bento-card is-purple" onClick={() => openView('plantillas-contrato')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <ScrollText size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Plantillas de Contratos Legales</h3>
                      <p className="settings-bento-desc">
                        Vincula el diseño y cláusulas contractuales HTML para contratos corporativos, sociales y de hospedaje.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('plantillas-contrato')}>
                    <span>Abrir →</span>
                  </button>
                </div>
              </>
            )}

            {/* ════════════ 5. USUARIOS Y ROLES ════════════ */}
            {activeTab === 'usuarios' && (
              <>
                <div className="settings-hero-section">
                  <div className="settings-category-header">
                    <h2 className="settings-category-title">Usuarios, Roles y Equipos</h2>
                    <p className="settings-category-subtitle">
                      Control de accesos, credenciales del personal y asignación de ejecutivos
                    </p>
                  </div>
                  <div className="settings-storytelling-card">
                    <div className="settings-storytelling-tag">Seguridad, Accesos y Equipos</div>
                    <p className="settings-story-text">
                      Supervisa los <strong className="highlight-blue">usuarios activos</strong>, gestiona sus <strong className="highlight-blue">roles y contraseñas</strong>, y organiza los <strong className="highlight-blue">equipos comerciales</strong> para distribución de leads y metas.
                    </p>
                  </div>
                </div>

                {/* Tarjeta: Usuarios y Credenciales (Azul) */}
                <div className="settings-bento-card is-blue" onClick={() => openView('usuarios')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <Users size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Usuarios y Credenciales</h3>
                      <p className="settings-bento-desc">
                        Alta, edición y desactivación de cuentas de ejecutivos de venta, supervisores y administradores.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('usuarios')}>
                    <span>Abrir →</span>
                  </button>
                </div>

                {/* Tarjeta: Equipos de Trabajo y Asesores (Verde) */}
                <div className="settings-bento-card is-green" onClick={() => openView('equipos')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <UserCheck size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Equipos de Trabajo y Asesores</h3>
                      <p className="settings-bento-desc">
                        Agrupa ejecutivos por departamentos o unidades de negocio para asignación automática de eventos.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('equipos')}>
                    <span>Abrir →</span>
                  </button>
                </div>
              </>
            )}

            {/* ════════════ 6. CITAS Y ALERTAS ════════════ */}
            {activeTab === 'citas' && (
              <>
                <div className="settings-hero-section">
                  <div className="settings-category-header">
                    <h2 className="settings-category-title">Citas y Alertas del Sistema</h2>
                    <p className="settings-category-subtitle">
                      Parámetros de recordatorios para atención comercial y control de cierres
                    </p>
                  </div>
                  <div className="settings-storytelling-card">
                    <div className="settings-storytelling-tag">Seguimiento Comercial y Control Operativo</div>
                    <p className="settings-story-text">
                      Define el <strong className="highlight-blue">tiempo de anticipación de alertas</strong> para citas con clientes y establece el <strong className="highlight-blue">margen de días de gracia</strong> permitido para modificar eventos de fechas pasadas.
                    </p>
                  </div>
                </div>

                {/* Tarjeta: Recordatorios y Alertas de Citas (Azul) */}
                <div className="settings-bento-card is-blue" onClick={() => openView('citas')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <CalendarClock size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Recordatorios y Alertas de Citas</h3>
                      <p className="settings-bento-desc">
                        Configura cuántas horas o días antes se notifican visualmente las citas y visitas comerciales pendientes.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('citas')}>
                    <span>Abrir →</span>
                  </button>
                </div>

                {/* Tarjeta: Bloqueo de Edición de Eventos Pasados (Ámbar) */}
                <div className="settings-bento-card is-amber" onClick={() => openView('citas')}>
                  <div className="settings-bento-card-left">
                    <div className="settings-bento-icon">
                      <ShieldAlert size={20} />
                    </div>
                    <div className="settings-bento-info">
                      <h3 className="settings-bento-title">Bloqueo y Margen de Edición de Eventos Pasados</h3>
                      <p className="settings-bento-desc">
                        Control de seguridad que bloquea la alteración de cotizaciones y detalles en eventos cuya fecha ya concluyó.
                      </p>
                    </div>
                  </div>
                  <button type="button" className="settings-bento-btn" onClick={() => openView('citas')}>
                    <span>Abrir →</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
