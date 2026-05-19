import React from 'react';

const handleClose = (modalId) => {
  document.getElementById(modalId).hidden = true;
};

export default function SettingsServices() {
  return (
    <>
      <div className="modalBackdrop" id="serviceBackdrop" hidden onClick={(e) => { if (e.target.id === 'serviceBackdrop') handleClose('serviceBackdrop'); }}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="serviceTitle">
          <div className="modalHeader">
            <div>
              <div className="modalTitle" id="serviceTitle">Nuevo servicio</div>
              <div className="modalSubtitle">Se agregara al catalogo de cotizacion</div>
            </div>
            <button className="iconBtn" id="btnServiceClose" type="button" title="Cerrar" onClick={() => handleClose('serviceBackdrop')}>&#10005;</button>
          </div>

          <form className="modalBody" id="serviceForm">
            <div className="row2">
              <label className="field">
                <span>Servicio existente</span>
                <select id="serviceEditSelect">
                  <option value="">Crear nuevo servicio</option>
                </select>
              </label>
              <div className="field">
                <span>Estado</span>
                <label className="statusSwitchInline">
                  <input id="serviceActive" type="checkbox" defaultChecked />
                  <span>Servicio activo</span>
                </label>
              </div>
            </div>

            <div className="row2">
              <label className="field">
                <span>Nombre del servicio</span>
                <input id="serviceName" type="text" placeholder="Ej: Catering premium" required />
              </label>
              <label className="field">
                <span>Precio base</span>
                <input id="servicePrice" type="number" min="0" step="0.01" placeholder="Ej: 150.00" required />
              </label>
            </div>

            <div className="row2">
              <label className="field">
                <span>Categoria</span>
                <select id="serviceCategory" required></select>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button className="btn" type="button" id="btnServiceCategoryManage">Gestionar categorias</button>
                </div>
              </label>
              <label className="field">
                <span>Subcategoria</span>
                <select id="serviceSubcategory" required></select>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button className="btn" type="button" id="btnServiceSubcategoryManage">Gestionar subcategorias</button>
                </div>
              </label>
            </div>

            <label className="field">
              <span>Modo de cantidad</span>
              <select id="serviceQuantityMode" required>
                <option value="MANUAL">MANUAL (cantidad editable)</option>
                <option value="PAX">PAX (calculado por no. de personas)</option>
              </select>
            </label>

            <label className="field">
              <span>Descripcion</span>
              <textarea id="serviceDescription" rows="2" placeholder="Descripcion del servicio"></textarea>
            </label>

            <div className="field">
              <span>Servicios registrados</span>
              <div className="quoteTableWrap">
                <table className="quoteTable">
                  <thead>
                    <tr>
                      <th>Servicio</th>
                      <th>Categoria</th>
                      <th>Subcategoria</th>
                      <th>Precio</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="servicesManagerBody"></tbody>
                </table>
              </div>
            </div>

            <div className="modalFooter">
              <div className="leftActions">
                <button className="btnDanger" type="button" id="btnServiceDisable">Inhabilitar</button>
              </div>
              <div className="rightActions">
                <button className="btn" type="button" id="btnServiceDiscard" onClick={() => handleClose('serviceBackdrop')}>Cancelar</button>
                <button className="btnPrimary" type="submit">Guardar servicio</button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="modalBackdrop" id="serviceCategoryBackdrop" hidden onClick={(e) => { if (e.target.id === 'serviceCategoryBackdrop') handleClose('serviceCategoryBackdrop'); }}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="serviceCategoryTitle">
          <div className="modalHeader">
            <div>
              <div className="modalTitle" id="serviceCategoryTitle">Categorias de servicio</div>
              <div className="modalSubtitle">Crea y edita categorias para tus servicios</div>
            </div>
            <button className="iconBtn" id="btnServiceCategoryClose" type="button" title="Cerrar" onClick={() => handleClose('serviceCategoryBackdrop')}>&#10005;</button>
          </div>

          <div className="modalBody">
            <label className="field">
              <span>Categoria existente</span>
              <select id="serviceCategoryEditSelect">
                <option value="">Crear nueva categoria</option>
              </select>
            </label>

            <label className="field">
              <span>Nombre de categoria</span>
              <input id="serviceCategoryNameInput" type="text" placeholder="Ej: Alimentos y bebidas" />
            </label>

            <div className="field">
              <span>Categorias registradas</span>
              <div className="quoteTableWrap">
                <table className="quoteTable">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="serviceCategoryBody"></tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="modalFooter">
            <div className="leftActions"></div>
            <div className="rightActions">
              <button className="btn" id="btnServiceCategoryReset" type="button">Nueva categoria</button>
              <button className="btnPrimary" id="btnServiceCategorySave" type="button">Guardar categoria</button>
            </div>
          </div>
        </div>
      </div>

      <div className="modalBackdrop" id="serviceSubcategoryBackdrop" hidden onClick={(e) => { if (e.target.id === 'serviceSubcategoryBackdrop') handleClose('serviceSubcategoryBackdrop'); }}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="serviceSubcategoryTitle">
          <div className="modalHeader">
            <div>
              <div className="modalTitle" id="serviceSubcategoryTitle">Subcategorias de servicio</div>
              <div className="modalSubtitle">Crea y edita subcategorias por categoria</div>
            </div>
            <button className="iconBtn" id="btnServiceSubcategoryClose" type="button" title="Cerrar" onClick={() => handleClose('serviceSubcategoryBackdrop')}>&#10005;</button>
          </div>

          <div className="modalBody">
            <div className="row2">
              <label className="field">
                <span>Categoria</span>
                <select id="serviceSubcategoryCategorySelect"></select>
              </label>
              <label className="field">
                <span>Subcategoria existente</span>
                <select id="serviceSubcategoryEditSelect">
                  <option value="">Crear nueva subcategoria</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>Nombre de subcategoria</span>
              <input id="serviceSubcategoryNameInput" type="text" placeholder="Ej: Cocteles" />
            </label>

            <div className="field">
              <span>Subcategorias registradas</span>
              <div className="quoteTableWrap">
                <table className="quoteTable">
                  <thead>
                    <tr>
                      <th>Subcategoria</th>
                      <th>Categoria</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="serviceSubcategoryBody"></tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="modalFooter">
            <div className="leftActions"></div>
            <div className="rightActions">
              <button className="btn" id="btnServiceSubcategoryReset" type="button">Nueva subcategoria</button>
              <button className="btnPrimary" id="btnServiceSubcategorySave" type="button">Guardar subcategoria</button>
            </div>
          </div>
        </div>
      </div>

      <div className="modalBackdrop" id="globalGoalsBackdrop" hidden onClick={(e) => { if (e.target.id === 'globalGoalsBackdrop') handleClose('globalGoalsBackdrop'); }}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="globalGoalsTitle">
          <div className="modalHeader">
            <div>
              <div className="modalTitle" id="globalGoalsTitle">Metas globales</div>
              <div className="modalSubtitle">Agrega, edita e inhabilita metas mensuales</div>
            </div>
            <button className="iconBtn" id="btnGlobalGoalsClose" type="button" title="Cerrar" onClick={() => handleClose('globalGoalsBackdrop')}>&#10005;</button>
          </div>

          <div className="modalBody">
            <div className="row2">
              <label className="field">
                <span>Meta existente</span>
                <select id="globalGoalsEditSelect">
                  <option value="">Crear nueva meta</option>
                </select>
              </label>
              <div className="field">
                <span>Estado</span>
                <label className="statusSwitchInline">
                  <input id="globalGoalActive" type="checkbox" defaultChecked />
                  <span>Meta activa</span>
                </label>
              </div>
            </div>

            <div className="row2">
              <label className="field">
                <span>Mes</span>
                <select id="globalGoalMonth"></select>
              </label>
              <label className="field">
                <span>Rol</span>
                <select id="globalGoalRole">
                  <option value="vendedor">Vendedor</option>
                  <option value="recepcionista">Recepcionista</option>
                </select>
              </label>
              <label className="field">
                <span>Monto meta</span>
                <input id="globalGoalAmount" type="number" min="0" step="0.01" placeholder="Ej: 250000" />
              </label>
            </div>

            <div className="field">
              <span>Metas registradas</span>
              <div className="quoteTableWrap">
                <table className="quoteTable">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th>Rol</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="globalGoalsBody"></tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="modalFooter">
            <div className="leftActions">
              <button className="btnDanger" id="btnGlobalGoalDisable" type="button">Inhabilitar</button>
            </div>
            <div className="rightActions">
              <button className="btn" id="btnGlobalGoalReset" type="button">Nueva meta</button>
              <button className="btnPrimary" id="btnGlobalGoalSave" type="button">Guardar meta</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}