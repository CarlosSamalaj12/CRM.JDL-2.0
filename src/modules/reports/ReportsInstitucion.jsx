import React from 'react';

export default function ReportsInstitucion({ onClose }) {
  return (
    <div className="modalBackdrop" id="institutionReportBackdrop">
      <div className="modal dashboardReportModal institutionReportModal" role="dialog" aria-modal="true" aria-labelledby="institutionReportTitle">
        <div className="modalHeader">
          <div className="reportBrandHeader">
            <div className="reportBrandBadge">
              <img src="/Oficial_JDL_acua.png" alt="Logo Jardines del Lago" className="reportBrandLogo" />
            </div>
            <div className="reportBrandCopy">
              <div className="reportBrandEyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="modalTitle" id="institutionReportTitle">Reporte por institucion</div>
              <div className="modalSubtitle">Dashboard de clientes, consumo y comportamiento historico</div>
            </div>
          </div>
          <button className="iconBtn reportModalClose" id="btnInstitutionReportClose" type="button" title="Cerrar" onClick={onClose}>&#10005;</button>
        </div>

        <div className="modalBody dashboardReportBody institutionReportBody">
          <section className="reportHeroPanel institutionReportHeroPanel">
            <div className="reportSectionIntro">
              <div>
                <div className="reportSectionEyebrow">Relacion comercial</div>
                <div className="reportSectionTitle">Cliente, consumo e historial en una vista premium</div>
                <div className="reportSectionText">Encuentra rapidamente instituciones clave, entiende su comportamiento y baja al detalle sin perder legibilidad.</div>
              </div>
            </div>
            <div className="dashboardReportFilters institutionReportFilters">
              <label className="field institutionSearchField">
                <span>Buscar institucion</span>
                <input id="institutionReportCompanySearch" type="text" placeholder="Escribe nombre, contacto o correo" />
                <div className="institutionSearchResults" id="institutionReportCompanyResults"></div>
              </label>
              <label className="field">
                <span>Institucion</span>
                <select id="institutionReportCompany"></select>
              </label>
              <label className="field">
                <span>Desde</span>
                <input id="institutionReportFrom" type="date" />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input id="institutionReportTo" type="date" />
              </label>
              <div className="rightActions dashboardReportActions">
                <button className="btn" id="btnInstitutionReportCurrentYear" type="button">Anio actual</button>
                <button className="btn" id="btnInstitutionReportReset" type="button">Limpiar filtros</button>
              </div>
            </div>
          </section>

          <div className="dashboardCard institutionHeadlineCard" id="institutionReportHeadline">
            {/* TODO: Lógica para mostrar info de la institución */}
          </div>

          <div className="institutionReportSummary" id="institutionReportSummary">
            {/* TODO: Lógica para summary cards */}
          </div>

          <div className="institutionReportNav" id="institutionReportNav">
            <button className="btn" type="button" data-target-section="institutionSectionOverview">Resumen</button>
            <button className="btn" type="button" data-target-section="institutionSectionCharts">Graficas</button>
            <button className="btn" type="button" data-target-section="institutionSectionSalons">Salones</button>
            <button className="btn" type="button" data-target-section="institutionSectionDishes">Platillos</button>
            <button className="btn" type="button" data-target-section="institutionSectionManagers">Encargados</button>
            <button className="btn" type="button" data-target-section="institutionSectionTimeline">Historial</button>
            <button className="btn" type="button" data-target-section="institutionSectionEvents">Eventos</button>
          </div>

          <div className="institutionReportContent" id="institutionReportContent">
            <section className="dashboardCard institutionDetailCard" id="institutionSectionOverview">
              <header className="dashboardCardHead">
                <strong>Resumen ejecutivo</strong>
                <small>Lectura rapida de la relacion comercial</small>
              </header>
              <div className="institutionOverviewGrid" id="institutionOverviewGrid"></div>
            </section>

            <section className="dashboardCard institutionDetailCard" id="institutionSectionCharts">
              <header className="dashboardCardHead">
                <strong>Graficas interactivas</strong>
                <small>Pasa el mouse sobre barras o segmentos para ver detalle</small>
              </header>
              <div className="institutionChartsGrid" id="institutionReportChartsBody" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:'16px', alignItems:'stretch'}}></div>
            </section>

            <section className="dashboardCard institutionDetailCard" id="institutionSectionSalons">
              <header className="dashboardCardHead">
                <strong>Salones mas usados</strong>
                <small>Ranking por frecuencia dentro del rango</small>
              </header>
              <div className="institutionMetricList" id="institutionReportSalonBody"></div>
            </section>

            <section className="dashboardCard institutionDetailCard" id="institutionSectionDishes">
              <header className="dashboardCardHead">
                <strong>Platillos y servicios mas pedidos</strong>
                <small>Consolidado de cotizaciones por cantidad</small>
              </header>
              <div className="institutionMetricList" id="institutionReportDishBody"></div>
            </section>

            <section className="dashboardCard institutionDetailCard" id="institutionSectionManagers">
              <header className="dashboardCardHead">
                <strong>Encargados con mas actividad</strong>
                <small>Quien genera mas eventos con nosotros</small>
              </header>
              <div className="institutionMetricList" id="institutionReportManagerBody"></div>
            </section>

            <section className="dashboardCard institutionDetailCard" id="institutionSectionTimeline">
              <header className="dashboardCardHead">
                <strong>Historial y comportamiento</strong>
                <small>Meses fuertes y ultima visita</small>
              </header>
              <div className="institutionTimelineGrid" id="institutionReportTimelineBody"></div>
            </section>

            <section className="dashboardCard institutionDetailCard" id="institutionSectionEvents">
              <header className="dashboardCardHead">
                <strong>Eventos del rango</strong>
                <small>Detalle para bajar a un caso especifico</small>
              </header>
              <div className="salesReportTableWrap institutionEventsWrap">
                <table className="quoteTable institutionEventsTable">
                  <thead>
                    <tr>
                      <th>Estado</th>
                      <th>Reserva</th>
                      <th>Fecha</th>
                      <th>Evento</th>
                      <th>Salon</th>
                      <th>Encargado</th>
                      <th>PAX</th>
                      <th>Total</th>
                      <th>Ultima visita</th>
                    </tr>
                  </thead>
                  <tbody id="institutionReportEventsBody">
                    {/* TODO: Lógica para eventos */}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}