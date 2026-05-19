import React from 'react';

export default function SettingsImport() {
  const handleImport = (type) => {
    const fileInput = document.getElementById(type === 'eventos' ? 'settingsImportEventsFile' : 'settingsImportManagersFile');
    if (fileInput) fileInput.click();
  };

  return (
    <>
      <div className="settingsExportPanel" aria-label="Importar datos desde Excel">
        <div className="settingsExportIntro">
          <strong>Importacion de datos</strong>
          <span>Carga eventos, empresas o encargado desde un archivo Excel con el formato establecido.</span>
        </div>
        <div className="moduleActionGrid settingsActionGridEnhanced">
          <button className="moduleActionBtn settingsHubBtn" id="btnSettingsImportEventsCsv" type="button" onClick={() => handleImport('eventos')}>
            <span className="actionCardInner">
              <span className="actionCardIcon">
                <svg className="actionCardSvg" viewBox="0 0 64 64" aria-hidden="true">
                  <path d="M14 16h36v32H14z"></path>
                  <path d="M14 16l18 18 18-18"></path>
                </svg>
              </span>
              <span className="actionCardText">
                <span className="actionCardLabel">Importar eventos</span>
                <span className="actionCardMeta">Cargar reservas desde Excel</span>
              </span>
            </span>
          </button>
          <button className="moduleActionBtn settingsHubBtn" id="btnSettingsImportManagersCsv" type="button" onClick={() => handleImport('encargados')}>
            <span className="actionCardInner">
              <span className="actionCardIcon">
                <svg className="actionCardSvg" viewBox="0 0 64 64" aria-hidden="true">
                  <circle cx="32" cy="22" r="7"></circle>
                  <path d="M24 34h16M22 46c2-6 7-9 10-9s8 3 10 9"></path>
                </svg>
              </span>
              <span className="actionCardText">
                <span className="actionCardLabel">Importar encargado</span>
                <span className="actionCardMeta">Cargar contactos desde Excel</span>
              </span>
            </span>
          </button>
        </div>
        <input type="file" id="settingsImportEventsFile" accept=".csv,.xlsx" hidden />
        <input type="file" id="settingsImportManagersFile" accept=".csv,.xlsx" hidden />
      </div>
    </>
  );
}