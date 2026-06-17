import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { loadState as loadCrmState } from '../../services/stateService';
import { STATUS_META } from '../calendar/constants';

const API = '';

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
  const [catalogServices, setCatalogServices] = useState([]);
  const [menuRankings, setMenuRankings] = useState(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [companyToken, setCompanyToken] = useState('all');
  const [fromDate, setFromDate] = useState(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState(`${currentYear}-12-31`);

  useEffect(() => {
    let mounted = true;
    loadCrmState()
      .then((response) => {
        if (!mounted) return;
        setCompanies(Array.isArray(response?.companies) ? response.companies : []);
        setCatalogServices(Array.isArray(response?.services) ? response.services : []);
      })
      .catch(() => {
        if (mounted) { setCompanies([]); setCatalogServices([]); }
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

  const subcategoryRank = useMemo(() => {
    const map = new Map();
    filteredRows.forEach((row) => {
      row.items.forEach((item) => {
        const catalogItem = catalogServices.find((s) => String(s.id) === String(item.serviceId));
        const subcat = catalogItem?.subcategory || '';
        if (!subcat) return;
        const current = map.get(subcat) || { label: subcat, count: 0, amount: 0 };
        current.count += Number(item.qty || 1);
        current.amount += Number(item.qty || 1) * Number(item.price || 0);
        map.set(subcat, current);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || b.amount - a.amount);
  }, [filteredRows, catalogServices]);

  useEffect(() => {
    if (!filteredRows.length) { setMenuRankings(null); return; }
    const eventIds = filteredRows.map((r) => r.id).filter(Boolean);
    if (!eventIds.length) { setMenuRankings(null); return; }
    setMenuLoading(true);
    fetch(`${API}/api/reportes/menu-items?ids=${eventIds.join(',')}`)
      .then((r) => r.json())
      .then((data) => { setMenuRankings(data); setMenuLoading(false); })
      .catch(() => { setMenuRankings(null); setMenuLoading(false); });
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

  const NAV_SECTIONS = [
    ['institutionSectionOverview', 'Resumen'],
    ['institutionSectionCharts', 'Gráficas'],
    ['institutionSectionSalons', 'Salones'],
    ['institutionSectionDishes', 'Platillos'],
    ['institutionSectionSubcategories', 'Subcategorías'],
    ['institutionSectionMenu', 'Menú'],
    ['institutionSectionManagers', 'Encargados'],
    ['institutionSectionTimeline', 'Historial'],
    ['institutionSectionEvents', 'Eventos'],
  ];

  const kpiCards = [
    { label: 'Eventos', value: filteredRows.length, accent: '#10c972', meta: `${summary.confirmed} confirmados` },
    { label: 'Total Cotizado', value: money(summary.total), accent: '#2563eb', meta: `Abonado ${money(summary.advances)}` },
    { label: 'Saldo Pendiente', value: money(summary.pending), accent: summary.pending > 0 ? '#b91c1c' : '#15803d', meta: summary.pending > 0 ? 'por cobrar' : 'al día' },
    { label: 'PAX Totales', value: summary.pax.toLocaleString(), accent: '#10c972', meta: `Prom. ${filteredRows.length ? Math.round(summary.pax / filteredRows.length) : 0}` },
    { label: 'Última Visita', value: summary.lastVisit, accent: '#2563eb', meta: 'más reciente' },
  ];

  const overviewCards = [
    { label: 'Empresa / Grupo', value: selectedCompany?.name || 'Todas', meta: selectedCompany?.contact || 'Filtro general', accent: '#2563eb' },
    { label: 'Contacto Principal', value: filteredRows.find((row) => row.contact)?.contact || '-', meta: filteredRows.find((row) => row.contactPhone)?.contactPhone || 'Sin teléfono', accent: '#7c3aed' },
    { label: 'NIT', value: filteredRows.find((row) => row.nit)?.nit || '-', meta: 'Dato cotización', accent: '#0d9488' },
    { label: 'Vendedor Frecuente', value: rankBy((row) => row.userName)[0]?.label || '-', meta: 'Por eventos', accent: '#d97706' },
  ];

  const renderMetricList = (items, emptyText = 'Sin datos para el rango seleccionado.') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.length ? items.map((item) => (
        <div key={item.label} style={{
          display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', alignItems: 'center',
          padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff',
          transition: 'all 0.15s ease',
        }}>
          <strong style={{ color: '#0f172a', fontSize: '14px' }}>{item.label}</strong>
          <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.count} registro(s)</span>
          <span style={{ color: '#0f172a', fontWeight: 900, fontSize: '14px', whiteSpace: 'nowrap' }}>{money(item.amount)}</span>
        </div>
      )) : (
        <div style={{ padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b', background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>
          {emptyText}
        </div>
      )}
    </div>
  );

  return (
    <div className="reports-page-container">
      {/* ── Header ── */}
      <div className="reports-page-header">
        <div className="reports-brand-header">
          <div className="reports-brand-badge">
            <img src="/Oficial_JDL_acua.png" alt="Logo Jardines del Lago" className="reports-brand-logo" />
          </div>
          <div>
            <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
            <div className="reports-title">Reporte por Institución</div>
            <div className="reports-subtitle">Dashboard de clientes, consumo y comportamiento histórico</div>
          </div>
        </div>
        <button className="btn-exit" type="button" onClick={() => onClose?.()}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver
        </button>
      </div>

      <div className="reports-page-body">
        {/* ── Hero + Filters ── */}
        <section className="reports-hero-panel">
          <div className="reports-section-intro">
            <div>
              <span className="reports-eyebrow">Relación comercial</span>
              <h3 className="reports-section-title">Cliente, consumo e historial en una vista premium</h3>
              <p className="reports-section-text">Encuentra instituciones clave, revisa comportamiento y baja al detalle con datos reales del CRM.</p>
            </div>
          </div>

          {/* Bento KPI Grid */}
          <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {kpiCards.map((k, i) => (
              <div key={i} className="bento-tile reports-kpi-tile" style={{ borderTop: `4px solid ${k.accent}` }}>
                <span className="reports-eyebrow">{k.label}</span>
                <strong>{k.value}</strong>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{k.meta}</span>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="reports-toolbar">
            <label className="field institutionSearchField">
              <span>Buscar institución</span>
              <input type="text" placeholder="Escribe nombre, contacto o correo" value={search} onChange={(event) => setSearch(event.target.value)} />
              {!!search && (
                <div className="institutionSearchResults">
                  {visibleCompanyOptions.slice(0, 5).map((company) => (
                    <button key={company.token} type="button" className="btn" onClick={() => setCompanyToken(company.token)}>{company.name}</button>
                  ))}
                </div>
              )}
            </label>
            <label className="field">
              <span>Institución</span>
              <select value={companyToken} onChange={(event) => setCompanyToken(event.target.value)}>
                <option value="all">Todas las instituciones</option>
                {visibleCompanyOptions.map((company) => <option key={company.token} value={company.token}>{company.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Desde</span>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className="field">
              <span>Hasta</span>
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
            <div className="reports-actions">
              <button type="button" onClick={() => { setFromDate(`${currentYear}-01-01`); setToDate(`${currentYear}-12-31`); }}>Año actual</button>
              <button className="btnPrimary" type="button" onClick={resetFilters}>Limpiar filtros</button>
            </div>
          </div>
        </section>

        {/* ── Storytelling ── */}
        <div className="reports-storytelling-card">
          <span className="reports-eyebrow" style={{ display: 'block', marginBottom: '4px' }}>
            {selectedCompany ? 'Institución seleccionada' : 'Todas las instituciones'}
          </span>
          <p className="reports-story-text">
            <strong className="highlight-slate">{selectedCompany?.name || 'Cartera completa'}</strong>
            {' — '}Período <strong className="highlight-slate">{getDateRangeLabel(fromDate, toDate)}</strong>.
            Se registran <strong className="highlight-blue">{filteredRows.length}</strong> evento(s) con un valor cotizado total de <strong className="highlight-green">{money(summary.total)}</strong>,
            de los cuales <strong className="highlight-green">{summary.confirmed}</strong> están confirmados.
            El saldo pendiente asciende a <strong className={summary.pending > 0 ? 'highlight-orange' : 'highlight-green'}>{money(summary.pending)}</strong>.
          </p>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="reports-nav-tabs">
          {NAV_SECTIONS.map(([id, label]) => (
            <button key={id} className="reports-nav-tab-btn" type="button" onClick={() => scrollTo(id)}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Resumen Ejecutivo ── */}
        <section className="reports-detail-section" id="institutionSectionOverview">
          <div className="reports-detail-section-header">
            <div className="reports-detail-section-title">Resumen ejecutivo</div>
            <div className="reports-detail-section-subtitle">Lectura rápida de la relación comercial</div>
          </div>
          <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {overviewCards.map((c, i) => (
              <div key={i} className="bento-tile reports-kpi-tile" style={{ borderTop: `4px solid ${c.accent}`, gap: '4px' }}>
                <span className="reports-eyebrow">{c.label}</span>
                <strong style={{ fontSize: '14px', lineHeight: '1.3' }}>{c.value}</strong>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>{c.meta}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Gráficas ── */}
        <section className="reports-detail-section" id="institutionSectionCharts">
          <div className="reports-detail-section-header">
            <div className="reports-detail-section-title">Gráficas interactivas</div>
            <div className="reports-detail-section-subtitle">Montos y estados calculados con los filtros activos</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '12px', alignItems: 'stretch' }}>
            {/* Consumo por mes */}
            <div className="bento-tile" style={{ padding: '16px', gap: '12px' }}>
              <span className="reports-eyebrow">Consumo por mes</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                {monthlyRank.length ? monthlyRank.map((item) => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800, marginBottom: '4px' }}>
                      <span style={{ color: '#1e293b' }}>{item.label}</span>
                      <span style={{ color: '#2563eb' }}>{money(item.amount)}</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(4, (item.amount / maxMonthlyAmount) * 100)}%`, background: 'linear-gradient(90deg, #2563eb, #3b82f6)', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )) : (
                  <div style={{ padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b', background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>
                    Sin consumo para graficar.
                  </div>
                )}
              </div>
            </div>

            {/* Eventos por estado */}
            <div className="bento-tile" style={{ padding: '16px', gap: '12px' }}>
              <span className="reports-eyebrow">Eventos por estado</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {statusRank.length ? statusRank.map((item) => {
                  const color = STATUS_META[item.label]?.color || '#64748b';
                  return (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 900, whiteSpace: 'nowrap' }}>
                        {item.label}
                      </span>
                      <strong style={{ color: '#0f172a', fontSize: '16px' }}>{item.count}</strong>
                    </div>
                  );
                }) : (
                  <div style={{ padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b', background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>
                    Sin estados para mostrar.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Salones ── */}
        <section className="reports-detail-section" id="institutionSectionSalons">
          <div className="reports-detail-section-header">
            <div className="reports-detail-section-title">Salones más usados</div>
            <div className="reports-detail-section-subtitle">Ranking por frecuencia dentro del rango</div>
          </div>
          {renderMetricList(salonRank)}
        </section>

        {/* ── Platillos ── */}
        <section className="reports-detail-section" id="institutionSectionDishes">
          <div className="reports-detail-section-header">
            <div className="reports-detail-section-title">Platillos y servicios más pedidos</div>
            <div className="reports-detail-section-subtitle">Consolidado de cotizaciones por cantidad</div>
          </div>
          {renderMetricList(dishRank, 'Sin platillos o servicios cotizados en el rango.')}
        </section>

        {/* ── Subcategorías ── */}
        <section className="reports-detail-section" id="institutionSectionSubcategories">
          <div className="reports-detail-section-header">
            <div className="reports-detail-section-title">Servicios por subcategoría</div>
            <div className="reports-detail-section-subtitle">Desayunos, almuerzos, refacciones y más</div>
          </div>
          {renderMetricList(subcategoryRank, 'Sin servicios con subcategoría en el rango.')}
        </section>

        {/* ── Menú (proteinas, guarniciones, bebidas) ── */}
        <section className="reports-detail-section" id="institutionSectionMenu">
          <div className="reports-detail-section-header">
            <div className="reports-detail-section-title">Menú más pedido</div>
            <div className="reports-detail-section-subtitle">Proteinas, guarniciones, bebidas y postres</div>
          </div>
          {menuLoading ? (
            <div style={{ padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b', background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>
              Cargando...
            </div>
          ) : menuRankings && Object.keys(menuRankings).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {Object.entries(menuRankings).map(([tipo, items]) => (
                <div key={tipo} className="bento-tile" style={{ padding: '14px', gap: '8px' }}>
                  <span className="reports-eyebrow" style={{ textTransform: 'capitalize' }}>{tipo}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {items.slice(0, 6).map((item) => (
                      <div key={item.nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{item.nombre}</span>
                        <span style={{ fontWeight: 800, color: '#2563eb' }}>{item.total}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b', background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>
              Sin datos de menú para el rango seleccionado.
            </div>
          )}
        </section>

        {/* ── Encargados ── */}
        <section className="reports-detail-section" id="institutionSectionManagers">
          <div className="reports-detail-section-header">
            <div className="reports-detail-section-title">Encargados con más actividad</div>
            <div className="reports-detail-section-subtitle">Quién genera más eventos con nosotros</div>
          </div>
          {renderMetricList(managerRank)}
        </section>

        {/* ── Historial ── */}
        <section className="reports-detail-section" id="institutionSectionTimeline">
          <div className="reports-detail-section-header">
            <div className="reports-detail-section-title">Historial y comportamiento</div>
            <div className="reports-detail-section-subtitle">Meses fuertes y última visita</div>
          </div>
          {renderMetricList(monthlyRank, 'Sin historial para el rango seleccionado.')}
        </section>

        {/* ── Eventos ── */}
        <section className="reports-detail-section" id="institutionSectionEvents">
          <div className="reports-detail-section-header">
            <div className="reports-detail-section-title">Eventos del rango</div>
            <div className="reports-detail-section-subtitle">Detalle para bajar a un caso específico</div>
          </div>
          <div className="reports-table-wrap">
            <table className="reports-table" style={{ minWidth: '900px' }}>
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Reserva</th>
                  <th>Fecha</th>
                  <th>Evento</th>
                  <th>Salón</th>
                  <th>Encargado</th>
                  <th style={{ textAlign: 'right' }}>PAX</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length ? filteredRows.map((row) => {
                  const color = STATUS_META[row.status]?.color || '#64748b';
                  return (
                    <tr key={row.reservationKey || row.id}>
                      <td>
                        <span style={{ color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 900, whiteSpace: 'nowrap' }}>
                          {row.status || '-'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#475569' }}>{row.reservationKey || row.id}</td>
                      <td>{row.eventDate || '-'}</td>
                      <td style={{ fontWeight: 700 }}>{row.name || '-'}</td>
                      <td>{row.salon || '-'}</td>
                      <td style={{ color: '#475569' }}>{row.contact || row.userName || '-'}</td>
                      <td style={{ fontWeight: 700, textAlign: 'right' }}>{row.pax || 0}</td>
                      <td style={{ fontWeight: 700, textAlign: 'right', color: '#0f172a' }}>{money(row.total)}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      No hay eventos con los filtros actuales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}