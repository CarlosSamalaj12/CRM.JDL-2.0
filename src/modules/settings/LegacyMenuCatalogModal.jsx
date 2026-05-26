import React from 'react';

export default function LegacyMenuCatalogModal() {
  return (
    <>
    <div className="modalBackdrop" id="menuSuggestionsBackdrop" hidden>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="menuSuggestionsTitle">
        <div className="modalHeader">
          <div>
            <div className="modalTitle" id="menuSuggestionsTitle">Combinaciones de platillo</div>
            <div className="modalSubtitle">Primero crea el catalogo base y luego define que puede llevar cada combinacion de plato base + preparacion.</div>
          </div>
          <button className="iconBtn" id="btnMenuSuggestionsClose" type="button" title="Cerrar">&#10005;</button>
        </div>

        <div className="modalBody menuSuggestBody">
          <section className="menuSuggestIntroCard">
            <div className="menuSuggestIntroEyebrow">Flujo recomendado</div>
            <div className="menuSuggestIntroText">1. Crea primero tu catalogo base: proteinas, preparaciones, guarniciones, postres, bebidas y montaje. 2. Luego entra aqui y arma las combinaciones posibles para cada plato base. Ejemplo: Lomito + Al oregano puede llevar ciertas guarniciones, bebidas, postres y montaje.</div>
          </section>

          <section className="menuSuggestContextCard">
            <div className="menuSuggestSectionHead">
              <div>
                <div className="menuSuggestSectionTitle">1. Plato base y preparacion</div>
                <div className="menuSuggestSectionText">Estas reglas se guardan para una combinacion exacta de plato base + preparacion.</div>
              </div>
            </div>
            <div className="row2 menuSuggestContextGrid">
              <label className="field menuSuggestField">
                <span>Plato base / Proteina</span>
                <select id="menuSuggestionsProtein"></select>
              </label>
              <label className="field menuSuggestField">
                <span>Preparacion</span>
                <select id="menuSuggestionsPreparation"></select>
              </label>
            </div>
          </section>

          <section className="menuSuggestSelectionCard">
            <div className="menuSuggestSectionHead">
              <div>
                <div className="menuSuggestSectionTitle">2. Posibles combinaciones</div>
                <div className="menuSuggestSectionText">Marca y ordena lo que si puede acompanar a esta combinacion. Asi construyes los platillos posibles sin duplicar productos.</div>
              </div>
            </div>

            <div className="row2 menuSuggestCols">
              <div className="field menuSuggestField menuSuggestFieldCard">
                <span>Salsas / Aderezos sugeridos</span>
                <small className="menuSuggestFieldHint">Aplican a este plato base con esta preparacion.</small>
                <div className="menuSuggestList" id="menuSuggestionsSalsas"></div>
              </div>
              <div className="field menuSuggestField menuSuggestFieldCard">
                <span>Guarniciones sugeridas</span>
                <small className="menuSuggestFieldHint">Estas son las guarniciones que combinan con esta version del plato.</small>
                <div className="menuSuggestList" id="menuSuggestionsGuarniciones"></div>
              </div>
            </div>

            <div className="row2 menuSuggestCols">
              <div className="field menuSuggestField menuSuggestFieldCard">
                <span>Postres sugeridos</span>
                <small className="menuSuggestFieldHint">Postres que combinan con esta combinacion de plato.</small>
                <div className="menuSuggestList" id="menuSuggestionsPostres"></div>
              </div>
              <div className="field menuSuggestField menuSuggestFieldCard">
                <span>Bebidas sugeridas</span>
                <small className="menuSuggestFieldHint">Refrescos o bebidas recomendadas para esta combinacion.</small>
                <div className="menuSuggestList" id="menuSuggestionsBebidas"></div>
              </div>
            </div>

            <div className="row2 menuSuggestCols">
              <div className="field menuSuggestField menuSuggestFieldCard">
                <span>Tipos de montaje sugeridos</span>
                <small className="menuSuggestFieldHint">Montajes que si aplican a esta combinacion.</small>
                <div className="menuSuggestList" id="menuSuggestionsMontajeTipos"></div>
              </div>
              <div className="field menuSuggestField menuSuggestFieldCard">
                <span>Extras de montaje sugeridos</span>
                <small className="menuSuggestFieldHint">Extras opcionales permitidos para este plato.</small>
                <div className="menuSuggestList" id="menuSuggestionsMontajeAdicionales"></div>
              </div>
            </div>
          </section>
        </div>

        <div className="modalFooter">
          <div className="leftActions">
            <button className="btn" id="btnMenuSuggestionsManageCatalog" type="button">Gestionar catalogo base</button>
          </div>
          <div className="rightActions">
            <button className="btn" id="btnMenuSuggestionsDiscard" type="button">Cancelar</button>
            <button className="btnPrimary" id="btnMenuSuggestionsSave" type="button">Guardar combinacion</button>
          </div>
        </div>
      </div>
    </div>


    <div className="modalBackdrop" id="menuCatalogBackdrop" hidden>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="menuCatalogTitle">
        <div className="modalHeader">
          <div>
            <div className="modalTitle" id="menuCatalogTitle">Gestionar catalogo Menu &amp; Montaje</div>
            <div className="modalSubtitle">Crea, edita e inhabilita proteinas, preparaciones, salsas, guarniciones, postres y mas.</div>
          </div>
          <button className="iconBtn" id="btnMenuCatalogClose" type="button" title="Cerrar">&#10005;</button>
        </div>

        <div className="modalBody">
          <div className="row2">
            <label className="field">
              <span>Catalogo</span>
              <select id="menuCatalogKind">
                <option value="plato_fuerte">Proteina / Plato base</option>
                <option value="preparacion">Preparacion</option>
                <option value="salsa">Salsa / Aderezo</option>
                <option value="guarnicion">Guarnicion</option>
                <option value="postre">Postre</option>
                <option value="bebida">Bebida</option>
                <option value="comentario">Comentario adicional</option>
                <option value="montaje_tipo">Tipo de montaje</option>
                <option value="montaje_adicional">Adicional de montaje</option>
              </select>
            </label>
            <label className="field" id="menuCatalogProteinWrap" hidden>
              <span>Proteina base (para preparacion)</span>
              <select id="menuCatalogProtein"></select>
            </label>
          </div>

          <div className="row2">
            <label className="field">
              <span>Nombre</span>
              <input id="menuCatalogName" type="text" placeholder="Escribe el nombre" />
            </label>
            <label className="field" id="menuCatalogDishTypeWrap" hidden>
              <span>Tipo de plato</span>
              <select id="menuCatalogDishType">
                <option value="NORMAL">Normal</option>
                <option value="VEGETARIANO">Vegetariano</option>
                <option value="VEGANO">Vegano</option>
              </select>
            </label>
          </div>

          <div className="row2">
            <div className="field" id="menuCatalogNoProteinWrap" hidden>
              <span>Aplicacion</span>
              <label className="statusSwitchInline menuCatalogSwitchInline">
                <input id="menuCatalogNoProtein" type="checkbox" />
                <span>Este plato puede ser sin proteina</span>
              </label>
            </div>
            <div className="field">
              <span>Acciones</span>
              <div className="rightActions">
                <button className="btn" id="btnMenuCatalogReset" type="button">Limpiar formulario</button>
                <button className="btnPrimary" id="btnMenuCatalogSave" type="button">Guardar registro</button>
              </div>
            </div>
          </div>

          <div className="quoteTableWrap">
            <table className="quoteTable">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Detalle</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="menuCatalogBody"></tbody>
            </table>
          </div>
        </div>

        <div className="modalFooter">
          <div className="leftActions">
            <button className="btn" id="btnMenuCatalogOpenSuggestions" type="button">Reglas sugeridas</button>
          </div>
          <div className="rightActions">
            <button className="btn" id="btnMenuCatalogDiscard" type="button">Cerrar</button>
          </div>
        </div>
      </div>
    </div>

    </>
  );
}
