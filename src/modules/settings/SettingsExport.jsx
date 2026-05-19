import React from 'react';

export default function SettingsExport() {
  const handleExport = (type) => {
    console.log(`Export clicked: ${type}`);
    alert(`Exportar ${type} - Funcionalidad en desarrollo`);
  };

  return (
    <>
      <div className="settingsExportPanel" aria-label="Exportar datos por Excel">
        <div className="settingsExportIntro">
          <strong>Migracion por Excel</strong>
          <span>Descarga eventos, empresas o encargados con las columnas sugeridas, una fila de ejemplo y los datos actuales del CRM.</span>
        </div>
        <div className="moduleActionGrid settingsActionGridEnhanced">
          <button className="moduleActionBtn settingsHubBtn" id="btnSettingsExportEventsExcel" type="button" onClick={() => handleExport('eventos')}>
            <span className="actionCardInner">
              <span className="actionCardIcon">
                <svg className="actionCardSvg" viewBox="0 0 64 64" aria-hidden="true">
                  <rect x="14" y="16" width="36" height="34" rx="8"></rect>
                  <path d="M22 12v10M42 12v10M14 26h36M23 36h8M35 36h6M23 44h18"></path>
                </svg>
              </span>
              <span className="actionCardText">
                <span className="actionCardLabel">Exportar eventos</span>
                <span className="actionCardMeta">Reservas, salones, empresa, encargado y cotizacion</span>
              </span>
            </span>
          </button>
          <button className="moduleActionBtn settingsHubBtn" id="btnSettingsExportCompaniesExcel" type="button" onClick={() => handleExport('empresas')}>
            <span className="actionCardInner">
              <span className="actionCardIcon">
                <svg className="actionCardSvg" viewBox="0 0 64 64" aria-hidden="true">
                  <path d="M18 48V24l14-8 14 8v24"></path>
                  <path d="M14 48h36M26 30h2M36 30h2M26 38h2M36 38h2"></path>
                </svg>
              </span>
              <span className="actionCardText">
                <span className="actionCardLabel">Exportar empresas</span>
                <span className="actionCardMeta">Catalogo de clientes, facturacion y contacto</span>
              </span>
            </span>
          </button>
          <button className="moduleActionBtn settingsHubBtn" id="btnSettingsExportManagersExcel" type="button" onClick={() => handleExport('encargados')}>
            <span className="actionCardInner">
              <span className="actionCardIcon">
                <svg className="actionCardSvg" viewBox="0 0 64 64" aria-hidden="true">
                  <circle cx="32" cy="22" r="7"></circle>
                  <path d="M24 34h16M22 46c2-6 7-9 10-9s8 3 10 9"></path>
                </svg>
              </span>
              <span className="actionCardText">
                <span className="actionCardLabel">Exportar encargado</span>
                <span className="actionCardMeta">Responsables relacionados a cada empresa</span>
              </span>
            </span>
          </button>
        </div>
        <div className="settingsExportExample">
          <strong>Ejemplo de columnas</strong>
          <span>Eventos: evento_id, nombre_evento, fecha_inicio_evento, fecha_fin_evento, salon_principal, empresa_id, encargado_id, vendedor, pax_total, total_cotizacion.</span>
          <span>Empresas: empresa_id, nombre_comercial, razon_social_facturar, nit, correo_empresa, telefono_empresa, direccion_empresa, tipo_evento_preferido.</span>
          <span>Encargados: encargado_id, empresa_id, empresa_nombre, nombre_encargado, telefono, correo, direccion.</span>
        </div>
      </div>
    </>
  );
}