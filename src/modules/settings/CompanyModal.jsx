import React from 'react';

export default function CompanyModal({ onClose }) {
  const handleClose = () => {
    document.getElementById('companyBackdrop').hidden = true;
    if (onClose) onClose();
  };

  return (
    <div className="modalBackdrop" id="companyBackdrop" hidden onClick={(e) => { if (e.target.classList.contains('modalBackdrop')) handleClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="companyTitle">
        <div className="modalHeader">
          <div>
            <div className="modalTitle" id="companyTitle">Nueva empresa</div>
            <div className="modalSubtitle">Se usara en cotizacion</div>
          </div>
          <button className="iconBtn" id="btnCompanyClose" type="button" title="Cerrar" onClick={handleClose}>&#10005;</button>
        </div>

        <form className="modalBody" id="companyForm" autoComplete="off">
          <div className="row2">
            <label className="field">
              <span>Empresa existente</span>
              <select id="companyEditSelect">
                <option value="">Crear nueva empresa</option>
              </select>
            </label>
            <div className="field">
              <span>Estado</span>
              <label className="statusSwitchInline">
                <input id="companyActive" type="checkbox" defaultChecked />
                <span>Empresa activa</span>
              </label>
            </div>
          </div>

          <div className="row2">
            <label className="field">
              <span>Nombre de la Organizacion</span>
              <input id="companyName" type="text" placeholder="Ej: Eventos del Lago" required />
            </label>
            <label className="field">
              <span>Encargado de la Organizacion</span>
              <input id="companyOwner" type="text" placeholder="Nombre del encargado principal" required />
            </label>
          </div>

          <div className="row2">
            <label className="field">
              <span>Correo</span>
              <input id="companyEmail" type="email" placeholder="correo@empresa.com" required autoComplete="off" />
            </label>
            <label className="field">
              <span>NIT</span>
              <input id="companyNIT" type="text" placeholder="NIT" required />
            </label>
          </div>

          <div className="row2">
            <label className="field">
              <span>Facturar A</span>
              <input id="companyBusinessName" type="text" placeholder="Nombre para facturacion" required />
            </label>
            <label className="field">
              <span>Tipo Evento</span>
              <select id="companyEventType" required>
                <option value="">Selecciona tipo</option>
                <option value="Social">Social</option>
                <option value="Corporativo">Corporativo</option>
                <option value="Individual">Individual</option>
              </select>
            </label>
          </div>

          <div className="row2">
            <label className="field">
              <span>Direccion</span>
              <input id="companyAddress" type="text" placeholder="Direccion" required />
            </label>
            <label className="field">
              <span>Telefono</span>
              <input id="companyPhone" type="text" placeholder="Telefono" required />
            </label>
          </div>

          <label className="field">
            <span>Observacion</span>
            <textarea id="companyNotes" rows="2" placeholder="Alguna observacion"></textarea>
          </label>

          <div className="field" id="companyRecordSection" hidden>
            <span>Record de la empresa</span>
            <div className="companyRecordSummary" id="companyRecordSummary"></div>
            <div className="quoteTableWrap">
              <table className="quoteTable">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Versiones</th>
                    <th>Fecha</th>
                    <th>Evento</th>
                    <th>Estado</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody id="companyRecordBody">
                  {/* TODO: Lógica para record */}
                </tbody>
              </table>
            </div>
          </div>

          <div className="field">
            <span>Encargados de la empresa</span>
            <div className="row2">
              <input id="managerName" type="text" placeholder="Nombre del encargado" />
              <input id="managerPhone" type="text" placeholder="Telefono" />
            </div>
            <div className="row2">
              <input id="managerEmail" type="email" placeholder="Correo" autoComplete="off" />
              <input id="managerAddress" type="text" placeholder="Direccion (opcional)" />
            </div>
            <div className="rightActions">
              <button className="btn" type="button" id="btnAddManager">+ Encargado</button>
            </div>
            <div className="quoteTableWrap">
              <table className="quoteTable">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Telefono</th>
                    <th>Correo</th>
                    <th>Direccion</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="managersBody">
                  {/* TODO: Lógica para encargados */}
                </tbody>
              </table>
            </div>
          </div>

          <div className="modalFooter">
            <div className="leftActions">
              <button className="btnDanger" id="btnCompanyDisable" type="button">Inhabilitar</button>
            </div>
            <div className="rightActions">
              <button className="btnPrimary" type="submit">Guardar empresa</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}