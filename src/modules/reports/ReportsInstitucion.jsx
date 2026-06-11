import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { loadState as loadCrmState } from '../../services/stateService';
import { STATUS_META } from '../calendar/constants';

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const money = (value) => `Q ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getSeries(event, events) {
  if (!event?.groupId) return [event];
  const series = (events || []).filter((item) => String(item.groupId || '') === String(event.groupId || ''));
  return series.length ? series : [event];
}

function getCompanyToken(quote = {}) {
  if (quote.companyId) return `id:${quote.companyId}`;
  const companyName = normalizeText(quote.companyName || quote.company || quote.billTo);
  return companyName ? `name:${companyName}` : 'none';
}

function getCompanyName(quote = {}, companies = []) {
  const company = quote.companyId ? companies.find((item) => String(item.id || '') === String(quote.companyId || '')) : null;
  return company?.name || quote.companyName || quote.company || quote.billTo || 'Sin institucion';
}

function getDateRangeLabel(fromDate, toDate) {
  if (fromDate && toDate) return `${fromDate} - ${toDate}`;
  if (fromDate) return `Desde ${fromDate}`;
  if (toDate) return `Hasta ${toDate}`;
  return 'Todos los registros';
}

export default function ReportsInstitucion({ onClose }) {
  const { events = [], users = [] } = useOutletContext();
  const currentYear = String(new Date().getFullYear());
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [companyToken, setCompanyToken] = useState('all');
  const [fromDate, setFromDate] = useState(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState(`${currentYear}-12-31`);

  useEffect(() => {
    let mounted = true;
    loadCrmState()
      .then((response) => {
        if (mounted) setCompanies(Array.isArray(response?.companies) ? response.companies : []);
      })
      .catch(() => {
        if (mounted) setCompanies([]);
      });
    return () => { mounted = false; };
  }, []);

  const rows = useMemo(() => {
    const seen = new Set();
    const output = [];

    for (const event of events || []) {
      const reservationKey = String(event.groupId || event.id || '');
      if (reservationKey && seen.has(reservationKey)) continue;
      if (reservationKey) seen.add(reservationKey);

      const series = getSeries(event, events).sort((a, b) => {
        const dateDiff = String(a.date || '').localeCompare(String(b.date || ''));
        if (dateDiff) return dateDiff;
        return String(a.startTime || '').localeCompare(String(b.startTime || ''));
      });
      const primary = series.find((item) => item.quote) || series[0] || event;
      const quote = primary?.quote || event?.quote || {};
      const startDate = series[0]?.date || primary?.date || event?.date || '';
      const endDate = series[series.length - 1]?.date || startDate;
      const salones = Array.from(new Set(series.map((item) => item.salon).filter(Boolean)));
      const seller = users.find((user) => String(user.id || '') === String(primary?.userId || event?.userId || ''));
      const company = quote.companyId ? companies.find((item) => String(item.id || '') === String(quote.companyId || '')) : null;
      const manager = company?.managers?.find((item) => String(item.id || '') === String(quote.managerId || ''));

      output.push({
        id: primary?.id || event?.id || reservationKey,
        reservationKey,
        companyToken: getCompanyToken(quote),
        companyId: quote.companyId || '',
        companyName: getCompanyName(quote, companies),
        nit: company?.nit || quote.nit || '',
        contact: manager?.name || quote.managerName || quote.contact || company?.owner || '',
        contactPhone: manager?.phone || quote.phone || company?.phone || '',
        contactEmail: manager?.email || quote.email || company?.email || '',
        status: primary?.status || event?.status || '',
        statusColor: STATUS_META[primary?.status || event?.status]?.color || '#64748b',
        name: primary?.name || event?.name || '',
        eventDate: startDate,
        endDate,
        schedule: `${primary?.startTime || event?.startTime || ''} - ${primary?.endTime || event?.endTime || ''}`.trim(),
        salon: salones.join(', ') || primary?.salon || event?.salon || '',
        userName: seller?.fullName || seller?.name || 'Sin asignar',
        pax: Number(primary?.pax || event?.pax || quote.people || 0),
        total: Number(quote.total || 0),
        subtotal: Number(quote.subtotal || 0),
        advances: Array.isArray(quote.advances) ? quote.advances : [],
        items: Array.isArray(quote.items) ? quote.items : [],
        lastVisit: endDate || startDate || '',
      });
    }

    return output.sort((a, b) => String(b.eventDate || '').localeCompare(String(a.eventDate || '')));
  }, [events, users, companies]);

  const companyOptions = useMemo(() => {
    const map = new Map();
    companies.forEach((company) => {
      map.set(`id:${company.id}`, {
        token: `id:${company.id}`,
        name: company.name || 'Sin nombre',
        contact: company.owner || company.managers?.[0]?.name || '',
        email: company.email || company.managers?.[0]?.email || '',
      });
    });
    rows.forEach((row) => {
      if (!map.has(row.companyToken)) {
        map.set(row.companyToken, {
          token: row.companyToken,
          name: row.companyName,
          contact: row.contact,
          email: row.contactEmail,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [companies, rows]);

  const visibleCompanyOptions = useMemo(() => {
    const term = normalizeText(search);
    if (!term) return companyOptions;
    return companyOptions.filter((company) => (
      normalizeText(company.name).includes(term)
      || normalizeText(company.contact).includes(term)
      || normalizeText(company.email).includes(term)
    ));
  }, [companyOptions, search]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (companyToken !== 'all' && row.companyToken !== companyToken) return false;
    if (fromDate && row.eventDate && row.eventDate < fromDate) return false;
    if (toDate && row.eventDate && row.eventDate > toDate) return false;
    if (search) {
      const term = normalizeText(search);
      const haystack = normalizeText(`${row.companyName} ${row.contact} ${row.contactEmail} ${row.name} ${row.salon}`);
      if (!haystack.includes(term)) return false;
    }
    return true;
  }), [rows, companyToken, fromDate, toDate, search]);

  const selectedCompany = useMemo(() => {
    if (companyToken === 'all') return null;
    return companyOptions.find((item) => item.token === companyToken) || null;
  }, [companyOptions, companyToken]);

  const summary = useMemo(() => {
    const total = filteredRows.reduce((acc, row) => acc + row.total, 0);
    const pax = filteredRows.reduce((acc, row) => acc + row.pax, 0);
    const confirmed = filteredRows.filter((row) => row.status === 'Confirmado').length;
    const advances = filteredRows.reduce((acc, row) => (
      acc + row.advances.reduce((sum, advance) => sum + Math.max(0, Number(advance.amount || 0)), 0)
    ), 0);
    const lastVisit = filteredRows.map((row) => row.lastVisit).filter(Boolean).sort().pop() || '-';
    return { total, pax, confirmed, advances, pending: Math.max(0, total - advances), lastVisit };
  }, [filteredRows]);

  const rankBy = (reader, valueReader = () => 1) => {
    const map = new Map();
    filteredRows.forEach((row) => {
      const values = reader(row);
      for (const value of Array.isArray(values) ? values : [values]) {
        const label = String(value || '').trim();
        if (!label) continue;
        const current = map.get(label) || { label, count: 0, amount: 0 };
        current.count += 1;
        current.amount += Number(valueReader(row, label) || 0);
        map.set(label, current);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || b.amount - a.amount).slice(0, 8);
  };

  const salonRank = useMemo(() => rankBy((row) => row.salon.split(',').map((item) => item.trim())), [filteredRows]);
  const managerRank = useMemo(() => rankBy((row) => row.contact || 'Sin encargado'), [filteredRows]);
  const dishRank = useMemo(() => {
    const map = new Map();
    filteredRows.forEach((row) => {
      row.items.forEach((item) => {
        const label = String(item.name || item.service || '').trim();
        if (!label) return;
        const current = map.get(label) || { label, count: 0, amount: 0 };
        current.count += Number(item.qty || 1);
        current.amount += Number(item.qty || 1) * Number(item.price || 0);
        map.set(label, current);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || b.amount - a.amount).slice(0, 8);
  }, [filteredRows]);

  const monthlyRank = useMemo(() => {
    const map = new Map();
    filteredRows.forEach((row) => {
      const key = row.eventDate ? row.eventDate.slice(0, 7) : 'Sin fecha';
      const current = map.get(key) || { label: key, count: 0, amount: 0 };
      current.count += 1;
      current.amount += row.total;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredRows]);

  const statusRank = useMemo(() => rankBy((row) => row.status || 'Sin estado'), [filteredRows]);
  const maxMonthlyAmount = Math.max(1, ...monthlyRank.map((item) => item.amount));

  const resetFilters = () => {
    setSearch('');
    setCompanyToken('all');
    setFromDate(`${currentYear}-01-01`);
    setToDate(`${currentYear}-12-31`);
  };

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const styles = {
    empty: { padding: '18px', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b', background: '#f8fafc', fontWeight: 700 },
    summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' },
    summaryCard: { padding: '14px', border: '1px solid #dbe7f5', borderRadius: '14px', background: '#ffffff' },
    summaryLabel: { display: 'block', fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em' },
    summaryValue: { display: 'block', marginTop: '8px', fontSize: '22px', fontWeight: 900, color: '#0f172a' },
    summaryMeta: { display: 'block', marginTop: '4px', fontSize: '12px', color: '#64748b' },
    metricRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '10px', alignItems: 'center', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#ffffff' },
    metricList: { display: 'grid', gap: '8px' },
    barTrack: { height: '10px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' },
    tableStatus: (color) => ({ color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: '999px', padding: '4px 8px', fontSize: '11px', fontWeight: 900, whiteSpace: 'nowrap' }),
  };

  const renderMetricList = (items, emptyText = 'Sin datos para el rango seleccionado.') => (
    <div style={styles.metricList}>
      {items.length ? items.map((item) => (
        <div key={item.label} style={styles.metricRow}>
          <strong style={{ color: '#0f172a' }}>{item.label}</strong>
          <span style={{ color: '#64748b', fontSize: 12 }}>{item.count} registro(s)</span>
          <span style={{ color: '#0f172a', fontWeight: 900 }}>{money(item.amount)}</span>
        </div>
      )) : <div style={styles.empty}>{emptyText}</div>}
    </div>
  );

  return (
    <div className="modalBackdrop" id="institutionReportBackdrop">
      <div className="modal dashboardReportModal institutionReportModal" role="dialog" aria-modal="true" aria-labelledby="institutionReportTitle">
        <div className="modalHeader">
          <div className="reportBrandHeader">
            <div className="reportBrandBadge" style={{ width: '56px', height: '56px', minWidth: '56px', minHeight: '56px', maxWidth: '56px', maxHeight: '56px', borderRadius: '14px', display: 'grid', placeItems: 'center', overflow: 'hidden', border: '1px solid #c7d8ec', background: '#f5faff', flex: '0 0 56px' }}>
              <img src="/Oficial_JDL_acua.png" alt="Logo Jardines del Lago" className="reportBrandLogo" style={{ width: '40px', height: '40px', minWidth: '40px', minHeight: '40px', maxWidth: '40px', maxHeight: '40px', objectFit: 'contain', display: 'block' }} />
            </div>
            <div className="reportBrandCopy">
              <div className="reportBrandEyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="modalTitle" id="institutionReportTitle">Reporte por institucion</div>
              <div className="modalSubtitle">Dashboard de clientes, consumo y comportamiento historico</div>
            </div>
          </div>
          <button className="iconBtn reportModalClose" id="btnInstitutionReportClose" type="button" title="Cerrar" onClick={() => onClose?.()}>&#10005;</button>
        </div>

        <div className="modalBody dashboardReportBody institutionReportBody">
          <section className="reportHeroPanel institutionReportHeroPanel">
            <div className="reportSectionIntro">
              <div>
                <div className="reportSectionEyebrow">Relacion comercial</div>
                <div className="reportSectionTitle">Cliente, consumo e historial en una vista premium</div>
                <div className="reportSectionText">Encuentra instituciones clave, revisa comportamiento y baja al detalle con datos reales del CRM.</div>
              </div>
            </div>
            <div className="dashboardReportFilters institutionReportFilters">
              <label className="field institutionSearchField">
                <span>Buscar institucion</span>
                <input id="institutionReportCompanySearch" type="text" placeholder="Escribe nombre, contacto o correo" value={search} onChange={(event) => setSearch(event.target.value)} />
                {!!search && (
                  <div className="institutionSearchResults" id="institutionReportCompanyResults">
                    {visibleCompanyOptions.slice(0, 5).map((company) => (
                      <button key={company.token} type="button" className="btn" onClick={() => setCompanyToken(company.token)}>{company.name}</button>
                    ))}
                  </div>
                )}
              </label>
              <label className="field">
                <span>Institucion</span>
                <select id="institutionReportCompany" value={companyToken} onChange={(event) => setCompanyToken(event.target.value)}>
                  <option value="all">Todas las instituciones</option>
                  {visibleCompanyOptions.map((company) => <option key={company.token} value={company.token}>{company.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Desde</span>
                <input id="institutionReportFrom" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input id="institutionReportTo" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </label>
              <div className="rightActions dashboardReportActions">
                <button className="btn" id="btnInstitutionReportCurrentYear" type="button" onClick={() => { setFromDate(`${currentYear}-01-01`); setToDate(`${currentYear}-12-31`); }}>Anio actual</button>
                <button className="btn" id="btnInstitutionReportReset" type="button" onClick={resetFilters}>Limpiar filtros</button>
              </div>
            </div>
          </section>

          <div className="dashboardCard institutionHeadlineCard" id="institutionReportHeadline">
            <div>
              <div className="reportSectionEyebrow">{selectedCompany ? 'Institucion seleccionada' : 'Todas las instituciones'}</div>
              <h3 style={{ margin: '8px 0 4px', color: '#0f172a', fontSize: 24 }}>{selectedCompany?.name || 'Cartera completa'}</h3>
              <p style={{ margin: 0, color: '#64748b' }}>{getDateRangeLabel(fromDate, toDate)} | {filteredRows.length} evento(s) encontrados.</p>
            </div>
          </div>

          <div className="institutionReportSummary" id="institutionReportSummary" style={styles.summaryGrid}>
            {[
              ['Eventos', filteredRows.length, `${summary.confirmed} confirmado(s)`],
              ['Total cotizado', money(summary.total), `Abonado ${money(summary.advances)}`],
              ['Saldo pendiente', money(summary.pending), 'Calculado desde anticipos registrados'],
              ['PAX total', summary.pax, `Promedio ${filteredRows.length ? Math.round(summary.pax / filteredRows.length) : 0}`],
              ['Ultima visita', summary.lastVisit, 'Segun eventos del rango'],
            ].map(([label, value, meta]) => (
              <article key={label} style={styles.summaryCard}>
                <span style={styles.summaryLabel}>{label}</span>
                <strong style={styles.summaryValue}>{value}</strong>
                <small style={styles.summaryMeta}>{meta}</small>
              </article>
            ))}
          </div>

          <div className="institutionReportNav" id="institutionReportNav">
            {[
              ['institutionSectionOverview', 'Resumen'],
              ['institutionSectionCharts', 'Graficas'],
              ['institutionSectionSalons', 'Salones'],
              ['institutionSectionDishes', 'Platillos'],
              ['institutionSectionManagers', 'Encargados'],
              ['institutionSectionTimeline', 'Historial'],
              ['institutionSectionEvents', 'Eventos'],
            ].map(([id, label]) => <button key={id} className="btn" type="button" onClick={() => scrollTo(id)}>{label}</button>)}
          </div>

          <div className="institutionReportContent" id="institutionReportContent">
            <section className="dashboardCard institutionDetailCard" id="institutionSectionOverview">
              <header className="dashboardCardHead">
                <strong>Resumen ejecutivo</strong>
                <small>Lectura rapida de la relacion comercial</small>
              </header>
              <div className="institutionOverviewGrid" id="institutionOverviewGrid" style={styles.summaryGrid}>
                {[
                  ['Empresa / grupo', selectedCompany?.name || 'Todas', selectedCompany?.contact || 'Filtro general'],
                  ['Contacto principal', filteredRows.find((row) => row.contact)?.contact || '-', filteredRows.find((row) => row.contactPhone)?.contactPhone || 'Sin telefono'],
                  ['NIT', filteredRows.find((row) => row.nit)?.nit || '-', 'Dato tomado del catalogo o cotizacion'],
                  ['Vendedor frecuente', rankBy((row) => row.userName)[0]?.label || '-', 'Por cantidad de eventos'],
                ].map(([label, value, meta]) => (
                  <article key={label} style={styles.summaryCard}>
                    <span style={styles.summaryLabel}>{label}</span>
                    <strong style={{ ...styles.summaryValue, fontSize: 18 }}>{value}</strong>
                    <small style={styles.summaryMeta}>{meta}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboardCard institutionDetailCard" id="institutionSectionCharts">
              <header className="dashboardCardHead">
                <strong>Graficas interactivas</strong>
                <small>Montos y estados calculados con los filtros activos</small>
              </header>
              <div className="institutionChartsGrid" id="institutionReportChartsBody" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Consumo por mes</span>
                  <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                    {monthlyRank.length ? monthlyRank.map((item) => (
                      <div key={item.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800 }}><span>{item.label}</span><span>{money(item.amount)}</span></div>
                        <div style={styles.barTrack}><div style={{ height: '100%', width: `${Math.max(4, (item.amount / maxMonthlyAmount) * 100)}%`, background: '#2563eb' }} /></div>
                      </div>
                    )) : <div style={styles.empty}>Sin consumo para graficar.</div>}
                  </div>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Eventos por estado</span>
                  <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                    {statusRank.length ? statusRank.map((item) => {
                      const color = STATUS_META[item.label]?.color || '#64748b';
                      return (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                          <span style={styles.tableStatus(color)}>{item.label}</span>
                          <strong>{item.count}</strong>
                        </div>
                      );
                    }) : <div style={styles.empty}>Sin estados para mostrar.</div>}
                  </div>
                </div>
              </div>
            </section>

            <section className="dashboardCard institutionDetailCard" id="institutionSectionSalons">
              <header className="dashboardCardHead">
                <strong>Salones mas usados</strong>
                <small>Ranking por frecuencia dentro del rango</small>
              </header>
              <div className="institutionMetricList" id="institutionReportSalonBody">{renderMetricList(salonRank)}</div>
            </section>

            <section className="dashboardCard institutionDetailCard" id="institutionSectionDishes">
              <header className="dashboardCardHead">
                <strong>Platillos y servicios mas pedidos</strong>
                <small>Consolidado de cotizaciones por cantidad</small>
              </header>
              <div className="institutionMetricList" id="institutionReportDishBody">{renderMetricList(dishRank, 'Sin platillos o servicios cotizados en el rango.')}</div>
            </section>

            <section className="dashboardCard institutionDetailCard" id="institutionSectionManagers">
              <header className="dashboardCardHead">
                <strong>Encargados con mas actividad</strong>
                <small>Quien genera mas eventos con nosotros</small>
              </header>
              <div className="institutionMetricList" id="institutionReportManagerBody">{renderMetricList(managerRank)}</div>
            </section>

            <section className="dashboardCard institutionDetailCard" id="institutionSectionTimeline">
              <header className="dashboardCardHead">
                <strong>Historial y comportamiento</strong>
                <small>Meses fuertes y ultima visita</small>
              </header>
              <div className="institutionTimelineGrid" id="institutionReportTimelineBody">{renderMetricList(monthlyRank, 'Sin historial para el rango seleccionado.')}</div>
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
                    {filteredRows.length ? filteredRows.map((row) => (
                      <tr key={row.reservationKey || row.id}>
                        <td><span style={styles.tableStatus(row.statusColor)}>{row.status || '-'}</span></td>
                        <td>{row.reservationKey || row.id}</td>
                        <td>{row.eventDate || '-'}</td>
                        <td>{row.name || '-'}</td>
                        <td>{row.salon || '-'}</td>
                        <td>{row.contact || row.userName || '-'}</td>
                        <td>{row.pax || 0}</td>
                        <td>{money(row.total)}</td>
                        <td>{row.lastVisit || '-'}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="9"><div style={styles.empty}>No hay eventos con los filtros actuales.</div></td></tr>
                    )}
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
