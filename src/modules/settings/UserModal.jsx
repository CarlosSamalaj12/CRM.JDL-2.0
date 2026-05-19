import React from 'react';

export default function UserModal({ onClose }) {
  const handleClose = () => {
    document.getElementById('userBackdrop').hidden = true;
    if (onClose) onClose();
  };

  return (
    <div className="modalBackdrop" id="userBackdrop" hidden onClick={(e) => { if (e.target.classList.contains('modalBackdrop')) handleClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="userTitle">
        <div className="modalHeader">
          <div>
            <div className="modalTitle" id="userTitle">Nuevo usuario</div>
            <div className="modalSubtitle">Datos de acceso y firma</div>
          </div>
          <button className="iconBtn" id="btnUserClose" type="button" title="Cerrar" onClick={handleClose}>&#10005;</button>
        </div>

        <form className="modalBody" id="userForm">
          <div className="row2">
            <label className="field">
              <span>Usuario existente</span>
              <select id="userEditSelect">
                <option value="">Crear nuevo usuario</option>
              </select>
            </label>
            <div className="field">
              <span>Estado</span>
              <label className="statusSwitchInline">
                <input id="userActive" type="checkbox" defaultChecked />
                <span>Usuario activo</span>
              </label>
            </div>
          </div>

          <div className="row2">
            <label className="field">
              <span>Nombre completo</span>
              <input id="userFullName" type="text" placeholder="Ej: Carlos Perez" required />
            </label>
            <label className="field">
              <span>Nombre de usuario</span>
              <input id="userUsername" type="text" placeholder="Ej: cperez" required />
            </label>
          </div>

          <div className="row2">
            <label className="field">
              <span>Correo</span>
              <input id="userEmail" type="email" placeholder="correo@dominio.com" required />
            </label>
            <label className="field">
              <span>Telefono</span>
              <input id="userPhone" type="text" placeholder="Ej: 5555-1212" required />
            </label>
          </div>

          <div className="row2">
            <label className="field">
              <span>Contrasena</span>
              <input id="userPassword" type="password" placeholder="Contrasena" required />
            </label>
            <label className="field">
              <span>Firma (JPG/PNG)</span>
              <input id="userSignature" type="file" accept="image/png,image/jpeg" />
              <div className="signaturePreviewCard" id="userSignaturePreviewCard" hidden>
                <div className="signaturePreviewViewport">
                  <img id="userSignaturePreview" alt="Vista previa firma" />
                </div>
                <div className="signaturePreviewMeta" id="userSignatureMeta">Sin firma cargada.</div>
                <div className="signaturePreviewWarn" id="userSignatureWarn" hidden></div>
              </div>
            </label>
          </div>

          <div className="row2">
            <label className="field">
              <span>Avatar (JPG/PNG)</span>
              <input id="userAvatar" type="file" accept="image/png,image/jpeg" />
            </label>
            <label className="field">
              <span>Rol</span>
              <select id="userRole">
                <option value="vendedor">Vendedor</option>
                <option value="recepcionista">Recepcionista</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
          </div>

          <div className="row2">
            <div className="field">
              <span>Meta de ventas</span>
              <label className="statusSwitchInline salesTargetSwitchInline">
                <input id="userSalesTargetEnabled" type="checkbox" />
                <span>Este usuario influye en meta mensual segun su rol</span>
              </label>
            </div>
            <div className="field">
              <span>Agregar o editar meta mensual</span>
              <div className="userPick">
                <input id="userGoalMonth" type="month" />
                <input id="userGoalAmount" type="number" min="0" step="0.01" placeholder="Monto meta mensual" />
                <button className="btn" id="btnUserGoalAdd" type="button">Agregar meta</button>
              </div>
            </div>
          </div>

          <div className="field">
            <span>Metas mensuales del usuario</span>
            <div className="quoteTableWrap">
              <table className="quoteTable">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Monto meta</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="userGoalsBody">
                  {/* TODO: Lógica para metas */}
                </tbody>
              </table>
            </div>
          </div>

          <div className="modalFooter">
            <div className="leftActions">
              <button className="btnDanger" id="btnUserDisable" type="button">Inhabilitar</button>
            </div>
            <div className="rightActions">
              <button className="btnPrimary" id="btnUserSubmit" type="submit">Guardar</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}