<div className="modalBackdrop" id="menuMontajeSelectableBackdrop" hidden>
      <div className="modal menuMontajeModal" role="dialog" aria-modal="true" aria-labelledby="menuMontajeSelectableTitle">
        <div className="modalHeader">
          <div>
            <div className="modalTitle" id="menuMontajeSelectableTitle">Men&uacute; y Montaje</div>
            <div className="modalSubtitle">Gesti&oacute;n intuitiva del men&uacute;, montaje y comanda por evento.</div>
          </div>
          <button className="iconBtn" id="btnMenuMontajeSelectableClose" type="button" title="Cerrar">&#10005;</button>
        </div>
        <div className="modalBody menuMontajeBody">
          <section className="quoteCard mmCard mmCardWide mmsFlatContextCard">
            <div className="mmsFlatSectionHead"><div><div className="quoteCardTitle">Datos del evento</div><div className="mmsSectionLead">Selecciona versi&oacute;n, fecha y sal&oacute;n antes de armar la comanda.</div></div><div className="mmsFlatFlowStrip"><span className="isActive">1 Datos</span><span>2 Men&uacute;</span><span>3 Montaje</span><span>4 Guardar</span></div></div>
            <div className="mmGrid mmsFlatContextGrid">
              <label className="field">
                <span>Version Menu &amp; Montaje</span>
                <div className="quoteServiceActions">
                  <select id="mmsVersionSelect"></select>
                  <button className="btn" id="btnMmsLoadVersion" type="button">Cargar</button>
                </div>
              </label>
              <label className="field">
                <span>Fecha + Salon</span>
                <select id="mmsDateSalonSelect"></select>
              </label>
              <label className="field">
                <span>No Doc</span>
                <input id="mmsDocNo" type="text" readonly />
              </label>
            </div>
          </section>

          <section className="quoteCard mmCard mmCardWide mmsFlatBuilderCard">
            <div className="mmsFlatSectionHead"><div><div className="quoteCardTitle">Armar men&uacute; y montaje</div><div className="mmsSectionLead">Trabaja de izquierda a derecha: modo, categor&iacute;a, opciones y resumen final.</div></div><div className="mmsFlatLegend"><span><b></b> Disponible</span><span><b></b> Seleccionado</span></div></div>
            <div className="mmsPosLayout mmsFlatPosLayout">
              <div className="mmsPosLeft">
                <div className="field">
                  <span>Paso 2: selecciona opciones</span>
                  <div className="mmsFlowHint">Primero elige si trabajar&aacute;s Men&uacute; o Montaje. Luego toca una categor&iacute;a y agrega opciones con un clic.</div>
                  <div className="mmsPrimaryTabs" id="mmsPrimaryTabs">
                    <button className="btn mmsPrimaryTab" id="btnMmsPrimaryMenu" type="button" data-mms-primary="menu">Men&uacute;</button>
                    <button className="btn mmsPrimaryTab" id="btnMmsPrimaryMontaje" type="button" data-mms-primary="montaje">Montaje</button>
                  </div>
                  <div className="mmsStageTabs" id="mmsStageTabs">
                    <button className="btn mmsStageTab" id="btnMmsStagePlato" type="button" data-mms-stage="plato">Plato fuerte</button>
                    <button className="btn mmsStageTab" id="btnMmsStagePrep" type="button" data-mms-stage="preparacion">Preparacion</button>
                    <button className="btn mmsStageTab" id="btnMmsStageSalsa" type="button" data-mms-stage="salsa">Salsas</button>
                    <button className="btn mmsStageTab" id="btnMmsStageGuarnicion" type="button" data-mms-stage="guarnicion">Guarniciones</button>
                    <button className="btn mmsStageTab" id="btnMmsStagePostre" type="button" data-mms-stage="postre">Postres</button>
                    <button className="btn mmsStageTab" id="btnMmsStageBebida" type="button" data-mms-stage="bebida">Bebidas</button>
                    <button className="btn mmsStageTab" id="btnMmsStageMontajeTipo" type="button" data-mms-stage="montaje_tipo">Montaje tipo</button>
                    <button className="btn mmsStageTab" id="btnMmsStageMontajeAdicional" type="button" data-mms-stage="montaje_adicional">Montaje adicional</button>
                  </div>
                  <div className="quoteServiceActions">
                    <input id="mmsStageFilter" type="text" placeholder="Filtrar opci&oacute;n..." />
                    <label className="mmsQuickQtyField" htmlFor="mmsMenuQtyVisible">
                      <span>Cantidad</span>
                      <input id="mmsMenuQtyVisible" type="number" min="1" step="1" value="1" />
                    </label>
                    <button className="btn" id="btnMmsStageMoreOptions" type="button">M&aacute;s opciones</button>
                    <button className="btnDanger" id="btnMmsStageCancelSelection" type="button">Anular</button>
                    <button className="btn btnCatalogAccent" id="btnMmsOpenCatalog" type="button">Gestionar cat&aacute;logo</button>
                  </div>
                  <div className="mmsStageBoard">
                    <div className="mmsStageTitle" id="mmsStageTitle">Elija una opci&oacute;n</div>
                    <div className="mmsQuickButtons mmsStageOptions" id="mmsStageOptions"></div>
                  </div>
                </div>
              </div>
              <div className="mmsPosRight">
                <div className="field">
                  <span className="mmsPosLiveTitle">Resumen de comanda</span>
                  <div className="mmsSummaryLead">Aqu&iacute; se confirma todo lo agregado antes de guardar.</div>
                  <div className="mmsActivePlateHint" id="mmsActivePlateHint">Toca un plato para editarlo.</div>
                  <div className="mmsComanda" id="mmsComandaPreview">
                    <div className="mmsComandaBlock"><div className="mmsComandaTitle">Plato fuerte</div><div className="mmsComandaItems" id="mmsComandaPlato"></div></div>
                    <div className="mmsComandaBlock"><div className="mmsComandaTitle">Salsas</div><div className="mmsComandaItems" id="mmsComandaSalsas"></div></div>
                    <div className="mmsComandaBlock"><div className="mmsComandaTitle">Guarniciones</div><div className="mmsComandaItems" id="mmsComandaGuarniciones"></div></div>
                    <div className="mmsComandaBlock"><div className="mmsComandaTitle">Postres</div><div className="mmsComandaItems" id="mmsComandaPostres"></div></div>
                    <div className="mmsComandaBlock"><div className="mmsComandaTitle">Bebidas</div><div className="mmsComandaItems" id="mmsComandaBebidas"></div></div>
                    <div className="mmsComandaBlock"><div className="mmsComandaTitle">Comentarios</div><div className="mmsComandaItems" id="mmsComandaComentarios"></div></div>
                    <div className="mmsComandaBlock"><div className="mmsComandaTitle">Montaje</div><div className="mmsComandaItems" id="mmsComandaMontaje"></div></div>
                  </div>
                  <small className="hint">Puedes quitar cualquier opci&oacute;n tocando la `x` en cada etiqueta.</small>
                </div>
                <label className="field">
                  <span>Descripci&oacute;n del plato (opcional)</span>
                  <textarea id="mmsPlatoDescripcion" rows="3" placeholder="Ej: sin cebolla, servir primero, alergias..."></textarea>
                </label>
              </div>
            </div>

            <div hidden>
              <select id="mmsProtein"></select>
              <select id="mmsPreparation"></select>
              <select id="mmsMenuSection"></select>
              <input id="mmsMenuSectionInput" type="text" />
              <button id="btnMmsMenuSectionAdd" type="button">x</button>
              <input id="mmsMenuTitle" type="text" />
              <input id="mmsMenuQty" type="number" />
              <input id="mmsGuarnicionFilter" type="text" />
              <button id="btnMmsToggleGuarnicionesGlobal" type="button">x</button>
              <div id="mmsGuarnicionesQuickSuggested"></div>
              <div id="mmsGuarnicionesQuickGlobal"></div>
              <div id="mmsGuarnicionesSuggested"></div>
              <div id="mmsGuarnicionesAll"></div>
              <input id="mmsPostreFilter" type="text" />
              <button id="btnMmsTogglePostresGlobal" type="button">x</button>
              <div id="mmsPostresQuickSuggested"></div>
              <div id="mmsPostresQuickGlobal"></div>
              <div id="mmsPostresSuggested"></div>
              <div id="mmsPostresAll"></div>
              <div id="mmsComentariosAll"></div>
              <textarea id="mmsComentarioLibre"></textarea>
              <textarea id="mmsMenuDescription"></textarea>
              <select id="mmsMontajeTipo"></select>
              <div id="mmsMontajeAdicionales"></div>
              <textarea id="mmsMontajeDescription"></textarea>
              <button id="btnMmsUseSuggested" type="button">x</button>
              <button id="btnMmsClearMenuSelection" type="button">x</button>
              <button id="btnMmsMenuAppend" type="button">x</button>
              <button id="btnMmsMenuReplace" type="button">x</button>
              <button id="btnMmsMontajeClear" type="button">x</button>
              <button id="btnMmsMontajeAppend" type="button">x</button>
              <button id="btnMmsMontajeReplace" type="button">x</button>
              <input id="mmsSummaryMenu" type="text" />
              <input id="mmsSummaryGuarniciones" type="text" />
              <input id="mmsSummaryPostres" type="text" />
              <input id="mmsSummaryComentarios" type="text" />
              <input id="mmsSummaryMontajeTipo" type="text" />
              <input id="mmsSummaryMontajeAdicionales" type="text" />
            </div>
          </section>

          <section className="quoteCard mmCard mmCardWide mmsFlatSavedCard">
            <div className="mmsFlatSectionHead"><div><div className="quoteCardTitle">Resumen guardado</div><div className="mmsSectionLead">Registros ya generados para esta cotizaci&oacute;n.</div></div></div>
            <div className="quoteTableWrap">
              <table className="quoteTable">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Salon</th>
                    <th>Menu</th>
                    <th>Cant.</th>
                    <th>Montaje</th>
                  </tr>
                </thead>
                <tbody id="mmsEntriesBody"></tbody>
              </table>
            </div>
          </section>
        </div>
        <div className="modalFooter">
          <div className="leftActions"></div>
          <div className="rightActions">
            <button className="btn" id="btnMmsPrintDay" type="button">Imprimir/PDF por dia</button>
            <button className="btn" id="btnMmsSaveCurrent" type="button">Actualizar version</button>
            <button className="btnPrimary" id="btnMmsSave" type="button">Guardar Menu &amp; Montaje</button>
          </div>
        </div>
      </div>
    </div>

    
