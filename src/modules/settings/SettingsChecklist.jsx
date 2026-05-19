import React from 'react';

const handleClose = (modalId) => {
  document.getElementById(modalId).hidden = true;
};

export default function SettingsChecklist() {
  return (
    <>
      <div className="modalBackdrop" id="checklistTemplateBackdrop" hidden onClick={(e) => { if (e.target.id === 'checklistTemplateBackdrop') handleClose('checklistTemplateBackdrop'); }}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="checklistTemplateTitle">
          <div className="modalHeader">
            <div>
              <div className="modalTitle" id="checklistTemplateTitle">Configurar Check List</div>
              <div className="modalSubtitle">Define plantillas, secciones y puntos para eventos</div>
            </div>
            <button className="iconBtn" id="btnChecklistTemplateClose" type="button" title="Cerrar" onClick={() => handleClose('checklistTemplateBackdrop')}>&#10005;</button>
          </div>
          <div className="modalBody">
            <div className="row2">
              <label className="field">
                <span>Plantilla existente</span>
                <select id="checklistTemplateSelect" className="uniformFieldControl"></select>
              </label>
              <label className="field">
                <span>Nombre de plantilla</span>
                <input id="checklistTemplateName" className="uniformFieldControl" type="text" placeholder="Ej: Checklist corporativo" />
              </label>
            </div>
            <div className="row2">
              <div className="field">
                <span>Estado plantilla</span>
                <label className="statusSwitchInline uniformFieldControl">
                  <input id="checklistTemplateActive" type="checkbox" defaultChecked />
                  <span>Plantilla activa</span>
                </label>
              </div>
              <div className="field">
                <span>Acciones plantilla</span>
                <div className="rightActions">
                  <button className="btn" id="btnChecklistTemplateNew" type="button">Nueva plantilla</button>
                  <button className="btnDanger" id="btnChecklistTemplateDisable" type="button">Inhabilitar</button>
                </div>
              </div>
            </div>
            <div className="row2">
              <label className="field">
                <span>Punto a chequear</span>
                <input id="checklistTemplateInput" className="uniformFieldControl" type="text" placeholder="Ej: Montaje de mesas completo" />
              </label>
              <label className="field">
                <span>Seccion</span>
                <select id="checklistTemplateSectionSelect" className="uniformFieldControl"></select>
              </label>
            </div>
            <div className="row2">
              <label className="field">
                <span>Seccion a editar</span>
                <select id="checklistTemplateSectionEditSelect" className="uniformFieldControl"></select>
              </label>
              <label className="field">
                <span>Nueva o editar seccion</span>
                <input id="checklistTemplateSectionInput" className="uniformFieldControl" type="text" placeholder="Ej: Salon" />
              </label>
            </div>
            <div className="row2">
              <div className="field">
                <span>Acciones seccion</span>
                <div className="rightActions">
                  <button className="btn" id="btnChecklistTemplateAddSection" type="button">Guardar seccion</button>
                  <button className="btn" id="btnChecklistTemplateResetSection" type="button">Nueva seccion</button>
                </div>
              </div>
              <div className="field">
                <span>Acciones punto</span>
                <div className="rightActions">
                  <button className="btn" id="btnChecklistTemplateAdd" type="button">Agregar punto</button>
                </div>
              </div>
            </div>
            <div className="quoteTableWrap">
              <table className="quoteTable">
                <thead>
                  <tr>
                    <th>Seccion</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="checklistTemplateSectionsBody"></tbody>
              </table>
            </div>
            <div className="quoteTableWrap">
              <table className="quoteTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Seccion</th>
                    <th>Punto</th>
                    <th>Orden</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="checklistTemplateBody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="modalBackdrop" id="eventChecklistBackdrop" hidden onClick={(e) => { if (e.target.id === 'eventChecklistBackdrop') handleClose('eventChecklistBackdrop'); }}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="eventChecklistTitle">
          <div className="modalHeader">
            <div>
              <div className="modalTitle" id="eventChecklistTitle">Hotel Jardines del Lago - Check List</div>
              <div className="modalSubtitle" id="eventChecklistSubtitle">-</div>
            </div>
            <button className="iconBtn" id="btnEventChecklistClose" type="button" title="Cerrar" onClick={() => handleClose('eventChecklistBackdrop')}>&#10005;</button>
          </div>
          <div className="modalBody">
            <div className="row1">
              <label className="field">
                <span>Plantilla</span>
                <select id="eventChecklistTemplateSelect"></select>
              </label>
            </div>
            <div className="row2">
              <label className="field">
                <span>Fecha</span>
                <input id="eventChecklistDate" type="text" readOnly />
              </label>
              <label className="field">
                <span>Evento</span>
                <input id="eventChecklistEventName" type="text" readOnly />
              </label>
            </div>
            <label className="field">
              <span>Sugerencias / comentarios</span>
              <textarea id="eventChecklistNotes" rows="2" placeholder="Observaciones generales del check list"></textarea>
            </label>
            <div className="checklistProgressCard">
              <div className="checklistProgressHead">
                <strong id="eventChecklistProgressLabel">Avance 0%</strong>
                <span id="eventChecklistSatisfactionLabel">Satisfaccion 0%</span>
              </div>
              <div className="checklistProgressTrack" aria-hidden="true">
                <div className="checklistProgressFill" id="eventChecklistProgressFill"></div>
              </div>
            </div>
            <div className="quoteTableWrap">
              <table className="quoteTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Punto a chequear</th>
                    <th>Estado</th>
                    <th>Comentario</th>
                  </tr>
                </thead>
                <tbody id="eventChecklistBody"></tbody>
              </table>
            </div>
          </div>
          <div className="modalFooter">
            <div></div>
            <div className="rightActions">
              <button className="btn" id="btnEventChecklistDiscard" type="button" onClick={() => handleClose('eventChecklistBackdrop')}>Cerrar</button>
              <button className="btnPrimary" id="btnEventChecklistSave" type="button">Guardar check list</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}