import React from 'react';

const handleClose = (modalId) => {
  document.getElementById(modalId).hidden = true;
};

export default function SettingsSalones() {
  return (
    <div className="modalBackdrop" id="salonesBackdrop" hidden onClick={(e) => { if (e.target.id === 'salonesBackdrop') handleClose('salonesBackdrop'); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="salonesTitle">
        <div className="modalHeader">
          <div>
            <div className="modalTitle" id="salonesTitle">Salones</div>
            <div className="modalSubtitle">Agrega, edita e inhabilita salones</div>
          </div>
          <button className="iconBtn" id="btnSalonesClose" type="button" title="Cerrar" onClick={() => handleClose('salonesBackdrop')}>&#10005;</button>
        </div>

        <div className="modalBody">
          <div className="row2">
            <label className="field">
              <span>Salon existente</span>
              <select id="salonEditSelect">
                <option value="">Crear nuevo salon</option>
              </select>
            </label>
            <div className="field">
              <span>Estado</span>
              <label className="statusSwitchInline">
                <input id="salonActive" type="checkbox" defaultChecked />
                <span>Salon activo</span>
              </label>
            </div>
          </div>

          <label className="field">
            <span>Nombre del salon</span>
            <input id="salonNameInput" type="text" placeholder="Ej: Salon Aurora" />
          </label>

          <div className="field">
            <span>Salones registrados</span>
            <div className="quoteTableWrap">
              <table className="quoteTable">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="salonesBody"></tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="modalFooter">
          <div className="leftActions">
            <button className="btnDanger" id="btnSalonDisable" type="button">Inhabilitar</button>
          </div>
          <div className="rightActions">
            <button className="btn" id="btnSalonReset" type="button">Nuevo salon</button>
            <button className="btnPrimary" id="btnSalonSave" type="button">Guardar salon</button>
          </div>
        </div>
      </div>
    </div>
  );
}