import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserModal from './UserModal';
import CompanyModal from './CompanyModal';
import SettingsServices from './SettingsServices';
import SettingsSalones from './SettingsSalones';
import SettingsChecklist from './SettingsChecklist';
import SettingsExport from './SettingsExport';
import SettingsImport from './SettingsImport';
import SettingsMenuMontaje from './SettingsMenuMontaje';
import SettingsQuoteTemplates from './SettingsQuoteTemplates';

const MODAL_IDS = [
  'userBackdrop', 'companyBackdrop', 'serviceBackdrop', 
  'serviceCategoryBackdrop', 'serviceSubcategoryBackdrop',
  'globalGoalsBackdrop', 'salonesBackdrop', 
  'checklistTemplateBackdrop', 'eventChecklistBackdrop',
  'menuSuggestionsBackdrop', 'quoteServiceTemplateBackdrop'
];

export default function SettingsMain() {
  const navigate = useNavigate();
  const [openModal, setOpenModal] = useState(null);

  const openModalById = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.hidden = false;
      setOpenModal(modalId);
    }
  };

  const closeAllModals = () => {
    MODAL_IDS.forEach(id => {
      const modal = document.getElementById(id);
      if (modal) modal.hidden = true;
    });
    setOpenModal(null);
  };

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains('modalBackdrop')) {
      e.target.hidden = true;
      setOpenModal(null);
    }
  };

  return (
    <div className="moduleScreen" id="settingsScreen">
      <div className="moduleHub moduleHubWide">
        <div className="moduleHubHeaderRow">
          <div>
            <div className="moduleHubTitle">Configuraciones</div>
            <div className="moduleHubSub">Opciones generales y accesos rapidos</div>
          </div>
          <button 
            className="iconBtn" 
            id="btnBackFromSettings" 
            type="button" 
            onClick={() => navigate('/calendar')}
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

        <div className="settingsPanelScreen" id="settingsPanel">
          <div className="settingsSectionTitle">Exportar al nuevo sistema</div>
          <SettingsExport />
          <div className="settingsDivider"></div>
          <div className="settingsSectionTitle">Importar al CRM</div>
          <SettingsImport />
          <div className="settingsDivider"></div>
          <div className="settingsSectionTitle">Accesos directos</div>
          <div className="moduleActionGrid">
            <button className="moduleActionBtn" id="btnQuickAddUser" type="button" onClick={() => openModalById('userBackdrop')}>
              <span className="actionCardInner">
                <span className="actionCardIcon">
                  <svg className="actionCardSvg" viewBox="0 0 64 64" aria-hidden="true">
                    <circle cx="32" cy="22" r="7"></circle>
                    <path d="M24 34h16M22 46c2-6 7-9 10-9s8 3 10 9"></path>
                  </svg>
                </span>
                <span className="actionCardText">
                  <span className="actionCardLabel">Agregar usuario</span>
                  <span className="actionCardMeta">Crear cuenta de vendedor o recepcionista</span>
                </span>
              </span>
            </button>
            <button className="moduleActionBtn" id="btnQuickAddInstitution" type="button" onClick={() => openModalById('companyBackdrop')}>
              <span className="actionCardInner">
                <span className="actionCardIcon">
                  <svg className="actionCardSvg" viewBox="0 0 64 64" aria-hidden="true">
                    <path d="M18 48V24l14-8 14 8v24"></path>
                    <path d="M14 48h36M26 30h2M36 30h2M26 38h2M36 38h2"></path>
                  </svg>
                </span>
                <span className="actionCardText">
                  <span className="actionCardLabel">Agregar empresa</span>
                  <span className="actionCardMeta">Registrar nueva institucion o cliente</span>
                </span>
              </span>
            </button>
            <button className="moduleActionBtn" id="btnQuickAddManager" type="button" onClick={() => openModalById('companyBackdrop')}>
              <span className="actionCardInner">
                <span className="actionCardIcon">
                  <svg className="actionCardSvg" viewBox="0 0 64 64" aria-hidden="true">
                    <circle cx="20" cy="18" r="6"></circle>
                    <path d="M8 42c0-6 6-10 12-10s12 4 12 10"></path>
                    <circle cx="44" cy="18" r="6"></circle>
                    <path d="M32 42c0-6 6-10 12-10s12 4 12 10"></path>
                  </svg>
                </span>
                <span className="actionCardText">
                  <span className="actionCardLabel">Agregar encargado</span>
                  <span className="actionCardMeta">Crear contacto de empresa</span>
                </span>
              </span>
            </button>
            <button className="moduleActionBtn" id="btnQuickAddService" type="button" onClick={() => openModalById('serviceBackdrop')}>
              <span className="actionCardInner">
                <span className="actionCardIcon">
                  <svg className="actionCardSvg" viewBox="0 0 64 64" aria-hidden="true">
                    <rect x="16" y="8" width="32" height="48" rx="4"></rect>
                    <path d="M24 20h16M24 32h16M24 44h8"></path>
                  </svg>
                </span>
                <span className="actionCardText">
                  <span className="actionCardLabel">Agregar servicio</span>
                  <span className="actionCardMeta">Nuevo item para cotizacion</span>
                </span>
              </span>
            </button>
            <button className="moduleActionBtn" id="btnQuickAddSalon" type="button" onClick={() => openModalById('salonesBackdrop')}>
              <span className="actionCardInner">
                <span className="actionCardIcon">
                  <svg className="actionCardSvg" viewBox="0 0 64 64" aria-hidden="true">
                    <rect x="14" y="20" width="36" height="24" rx="4"></rect>
                    <path d="M14 20V14a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v6"></path>
                  </svg>
                </span>
                <span className="actionCardText">
                  <span className="actionCardLabel">Agregar salon</span>
                  <span className="actionCardMeta">Crear nuevo espacio o area</span>
                </span>
              </span>
            </button>
            <button className="moduleActionBtn" id="btnQuickAddGlobalGoal" type="button" onClick={() => openModalById('globalGoalsBackdrop')}>
              <span className="actionCardInner">
                <span className="actionCardIcon">
                  <svg className="actionCardSvg" viewBox="0 0 64 64" aria-hidden="true">
                    <circle cx="32" cy="32" r="20"></circle>
                    <path d="M32 16v16l12 8"></path>
                  </svg>
                </span>
                <span className="actionCardText">
                  <span className="actionCardLabel">Agregar meta global</span>
                  <span className="actionCardMeta">Definir objetivo de venta mensual</span>
                </span>
              </span>
            </button>
            <button className="moduleActionBtn" id="btnQuickAddChecklist" type="button" onClick={() => openModalById('checklistTemplateBackdrop')}>
              <span className="actionCardInner">
                <span className="actionCardIcon">
                  <svg className="actionCardSvg" viewBox="0 0 64 64" aria-hidden="true">
                    <rect x="14" y="12" width="36" height="40" rx="4"></rect>
                    <path d="M22 24l4 4 8-8M22 34l4 4 8-8"></path>
                  </svg>
                </span>
                <span className="actionCardText">
                  <span className="actionCardLabel">Agregar checklist</span>
                  <span className="actionCardMeta">Crear plantilla de tareas</span>
                </span>
              </span>
            </button>
            <button className="moduleActionBtn" id="btnManageMenuMontaje" type="button" onClick={() => openModalById('menuSuggestionsBackdrop')}>
              <span className="actionCardInner">
                <span className="actionCardIcon">
                  <svg className="actionCardSvg" viewBox="0 0 64 64" aria-hidden="true">
                    <path d="M12 20h40M12 32h40M12 44h40M20 12v40M44 12v40"></path>
                    <circle cx="32" cy="32" r="6"></circle>
                  </svg>
                </span>
                <span className="actionCardText">
                  <span className="actionCardLabel">Menu y montaje</span>
                  <span className="actionCardMeta">Proteinas, preparaciones, guarniciones, postres y bebidas</span>
                </span>
              </span>
            </button>
            <button className="moduleActionBtn" id="btnManageQuoteServiceTemplates" type="button" onClick={() => openModalById('quoteServiceTemplateBackdrop')}>
              <span className="actionCardInner">
                <span className="actionCardIcon">
                  <svg className="actionCardSvg" viewBox="0 0 64 64" aria-hidden="true">
                    <rect x="10" y="16" width="44" height="32" rx="4"></rect>
                    <path d="M18 24h28M18 32h18M18 40h8"></path>
                  </svg>
                </span>
                <span className="actionCardText">
                  <span className="actionCardLabel">Plantillas de cotizacion</span>
                  <span className="actionCardMeta">Combos de servicios para cargar en cotizaciones</span>
                </span>
              </span>
            </button>
          </div>
        </div>

        <UserModal onClose={() => setOpenModal(null)} />
        <CompanyModal onClose={() => setOpenModal(null)} />
        <SettingsServices />
        <SettingsSalones />
        <SettingsChecklist />
        <SettingsMenuMontaje />
        <SettingsQuoteTemplates />
      </div>
    </div>
  );
}