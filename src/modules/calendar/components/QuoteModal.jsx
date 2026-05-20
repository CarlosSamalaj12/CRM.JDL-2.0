import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';

const uid = () => `row_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
const moneyGT = (amount) => {
  const val = Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `Q ${val}`;
};

export default function QuoteModal({ event, onClose, onSave }) {
  const [companies, setCompanies] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);
  const [quickTemplates, setQuickTemplates] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedServiceDate, setSelectedServiceDate] = useState('');
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [showCompanyResults, setShowCompanyResults] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [showDocPanel, setShowDocPanel] = useState(false);

  const [quote, setQuote] = useState({
    companyId: event?.quote?.companyId || '',
    companyName: event?.quote?.companyName || '',
    managerId: event?.quote?.managerId || '',
    managerName: event?.quote?.managerName || '',
    contact: event?.quote?.contact || '',
    email: event?.quote?.email || '',
    phone: event?.quote?.phone || '',
    nit: event?.quote?.nit || '',
    billTo: event?.quote?.billTo || '',
    address: event?.quote?.address || '',
    eventType: event?.quote?.eventType || event?.type || '',
    venue: event?.quote?.venue || event?.salon || '',
    schedule: event?.quote?.schedule || '',
    code: event?.quote?.code || '',
    docDate: event?.quote?.docDate || new Date().toISOString().split('T')[0],
    people: event?.quote?.people || event?.pax || '',
    eventDate: event?.quote?.eventDate || event?.date || '',
    endDate: event?.quote?.endDate || event?.endDate || event?.date || '',
    dueDate: event?.quote?.dueDate || '',
    discountType: event?.quote?.discountType || 'AMOUNT',
    discountValue: event?.quote?.discountValue || 0,
    items: event?.quote?.items || [],
    advances: event?.quote?.advances || [],
    templateId: event?.quote?.templateId || 'contrato_corp',
    currency: event?.quote?.currency || 'GTQ',
    internalNotes: event?.quote?.internalNotes || '',
    version: event?.quote?.version || 1,
    versions: event?.quote?.versions || [],
    paymentType: event?.quote?.paymentType || ''
  });

  const [serviceQty, setServiceQty] = useState(1);

  const loadState = async () => {
    try {
      const response = await fetch('/api/state');
      const data = await response.json();
      setCompanies(data?.state?.companies || []);
      setCatalogServices(data?.state?.services || []);
      setQuickTemplates(data?.state?.quickTemplates || []);
      if (!quote.code) {
        const evs = data?.state?.events || [];
        let maxCOT = 0;
        evs.forEach(ev => {
          if (ev.quote?.code) {
            const m = ev.quote.code.match(/^COT-(\d+)$/);
            if (m) maxCOT = Math.max(maxCOT, parseInt(m[1], 10));
          }
        });
        setQuote(prev => ({ ...prev, code: `COT-${String(maxCOT + 1).padStart(3, '0')}` }));
      }
      if (event?.date && !selectedServiceDate) setSelectedServiceDate(event.date);
    } catch (err) { console.error('Error:', err); }
  };

  useEffect(() => {
    loadState();
    document.body.classList.add('quoteModeOpen');
    return () => document.body.classList.remove('quoteModeOpen');
  }, []);

  const availableServiceDates = useMemo(() => {
    if (!quote.eventDate) return [event?.date || new Date().toISOString().split('T')[0]];
    const dates = [];
    const s = new Date(quote.eventDate + 'T00:00:00');
    const e = new Date((quote.endDate || quote.eventDate) + 'T00:00:00');
    const curr = new Date(s);
    while (curr <= e) { dates.push(curr.toISOString().split('T')[0]); curr.setDate(curr.getDate() + 1); }
    return dates.length ? dates : [event?.date || new Date().toISOString().split('T')[0]];
  }, [quote.eventDate, quote.endDate, event?.date]);

  useEffect(() => {
    if (availableServiceDates.length > 0 && !availableServiceDates.includes(selectedServiceDate))
      setSelectedServiceDate(availableServiceDates[0]);
  }, [availableServiceDates]);

  const filteredServices = useMemo(() => {
    const term = serviceSearch.trim().toLowerCase();
    if (!term) return [];
    return catalogServices.filter(s => s.active !== false && (s.name?.toLowerCase().includes(term) || s.category?.toLowerCase().includes(term))).slice(0, 10);
  }, [serviceSearch, catalogServices]);

  const filteredCompanies = useMemo(() => {
    const term = companySearchQuery.trim().toLowerCase();
    if (!term) return [];
    return companies.filter(c => c.name?.toLowerCase().includes(term) || c.nit?.toLowerCase().includes(term)).slice(0, 8);
  }, [companySearchQuery, companies]);

  const handleCompanySelect = (c) => {
    const m = c.managers?.[0] || null;
    setQuote(prev => ({ ...prev, companyId: c.id, companyName: c.name, contact: m?.name || c.owner || '', email: m?.email || c.email || '', phone: m?.phone || c.phone || '', nit: c.nit || '', billTo: c.businessName || c.name || '', address: c.address || '', managerId: m?.id || '', managerName: m?.name || '' }));
    setCompanySearchQuery(c.name);
    setShowCompanyResults(false);
  };

  const totals = useMemo(() => {
    const subtotal = quote.items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);
    const discountAmount = quote.discountType === 'PERCENT'
      ? Math.max(0, Math.min(subtotal, subtotal * Math.min(100, quote.discountValue) / 100))
      : Math.max(0, Math.min(subtotal, quote.discountValue));
    return { subtotal, discountAmount, total: Math.max(0, subtotal - discountAmount) };
  }, [quote.items, quote.discountType, quote.discountValue]);

  const abonosTotal = useMemo(() => quote.advances.reduce((sum, a) => sum + Number(a.amount || 0), 0), [quote.advances]);
  const saldoPendiente = Math.max(0, totals.total - abonosTotal);

  const addServiceItem = (serviceObj) => {
    if (!serviceObj) { Swal.fire('Error', 'Selecciona un servicio del catálogo', 'error'); return; }
    const paxVal = Math.max(0, Number(quote.people || 0));
    const newItem = {
      rowId: uid(), serviceId: serviceObj.id, name: serviceObj.name,
      qty: serviceObj.quantityMode === 'PAX' ? paxVal : serviceQty,
      price: serviceObj.quantityMode === 'PAX' ? Math.max(0, Number(serviceObj.price || 0) * paxVal) : Number(serviceObj.price || 0),
      quantityMode: serviceObj.quantityMode || 'MANUAL',
      serviceDate: selectedServiceDate || availableServiceDates[0]
    };
    setQuote(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setServiceSearch(''); setServiceQty(1);
  };

  const removeServiceItem = (rowId) => setQuote(prev => ({ ...prev, items: prev.items.filter(i => i.rowId !== rowId) }));

  const handleSelectAllToggle = () => {
    const allSelected = quote.items.length > 0 && quote.items.every(i => selectedItemIds.has(i.rowId));
    setSelectedItemIds(allSelected ? new Set() : new Set(quote.items.map(i => i.rowId)));
  };

  const handleSelectRowToggle = (rowId) => {
    setSelectedItemIds(prev => { const n = new Set(prev); n.has(rowId) ? n.delete(rowId) : n.add(rowId); return n; });
  };

  const handleDuplicateSelected = () => {
    if (!selectedItemIds.size) return;
    setQuote(prev => {
      const next = []; const ns = new Set(selectedItemIds);
      for (const item of prev.items) {
        next.push(item);
        if (selectedItemIds.has(item.rowId)) { const id = uid(); next.push({ ...item, rowId: id }); ns.add(id); }
      }
      setTimeout(() => setSelectedItemIds(ns), 0);
      return { ...prev, items: next };
    });
  };

  const handleMoveSelected = (dir) => {
    if (!selectedItemIds.size) return;
    setQuote(prev => {
      const items = [...prev.items];
      if (dir === 'up') {
        for (let i = 1; i < items.length; i++)
          if (selectedItemIds.has(items[i].rowId) && !selectedItemIds.has(items[i-1].rowId)) [items[i-1], items[i]] = [items[i], items[i-1]];
      } else {
        for (let i = items.length - 2; i >= 0; i--)
          if (selectedItemIds.has(items[i].rowId) && !selectedItemIds.has(items[i+1].rowId)) [items[i], items[i+1]] = [items[i+1], items[i]];
      }
      return { ...prev, items };
    });
  };

  const handleSaveQuote = async () => {
    if (!quote.companyId) { Swal.fire('Error', 'Selecciona la empresa', 'error'); return; }
    if (!quote.contact) { Swal.fire('Error', 'Completa el contacto', 'error'); return; }
    if (!quote.items.length) { Swal.fire('Error', 'Agrega al menos un servicio', 'error'); return; }
    onSave({ ...quote, subtotal: totals.subtotal, discountAmount: totals.discountAmount, total: totals.total, quotedAt: new Date().toISOString() });
  };

  // ─── Estilos de campos reutilizables ───
  const fieldLabel = { display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.3px' };
  const fieldInput = { width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '6px 9px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#0f172a', outline: 'none' };
  const fieldSelect = { ...fieldInput };
  const card = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' };

  return (
    <>
      {/* ── CSS global ── */}
      <style>{`
        body.quoteModeOpen .reservation-modal-overlay { display: none !important; }
        /* Ocultar todo lo que hay detrás: navbar, filtros, calendario */
        body.quoteModeOpen #appShell,
        body.quoteModeOpen nav,
        body.quoteModeOpen header,
        body.quoteModeOpen .lum-topbar,
        body.quoteModeOpen .app-topbar,
        body.quoteModeOpen .status-filter-bar,
        body.quoteModeOpen [class*="topbar"],
        body.quoteModeOpen [class*="navbar"],
        body.quoteModeOpen [class*="header"]:not(#qp-root *) {
          /* No ocultamos — en su lugar cubrimos con inset:0 */
        }
        #qp-root * { box-sizing: border-box; }
        #qp-root input:focus, #qp-root select:focus, #qp-root textarea:focus {
          outline: 2px solid #3b82f6; outline-offset: 0; border-color: #3b82f6;
        }
        .qp-btn {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 6px 13px; font-size: 11px; font-weight: 700;
          border: 1px solid #cbd5e1; border-radius: 6px;
          background: #f8fafc; color: #334155;
          cursor: pointer; white-space: nowrap; transition: background .12s, border-color .12s;
        }
        .qp-btn:hover { background: #e2e8f0; border-color: #94a3b8; }
        .qp-btn-primary {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 7px 18px; font-size: 12px; font-weight: 800;
          border: none; border-radius: 7px;
          background: #0f172a; color: #fff;
          cursor: pointer; white-space: nowrap; transition: background .12s;
        }
        .qp-btn-primary:hover { background: #1e293b; }
        /* tabla */
        .qp-tbl { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 540px; }
        .qp-tbl thead tr { background: #f1f5f9; }
        .qp-tbl th { padding: 9px 10px; text-align: left; font-size: 10px; font-weight: 800; color: #475569; border-bottom: 1px solid #e2e8f0; white-space: nowrap; text-transform: uppercase; letter-spacing: .3px; }
        .qp-tbl td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; background: #ffffff; }
        .qp-tbl tbody tr:last-child td { border-bottom: none; }
        .qp-tbl tbody tr.sel td { background: #f0fdf4; }
        .qp-tbl input[type="number"] { width: 72px; font-size: 12px; padding: 4px 6px; border: 1px solid #e2e8f0; border-radius: 5px; background: #f8fafc; color: #0f172a; }
        .qp-tbl input[type="text"]  { width: 100%; font-size: 12px; padding: 4px 6px; border: 1px solid transparent; border-radius: 5px; background: transparent; color: #0f172a; }
        .qp-tbl input[type="text"]:hover  { border-color: #e2e8f0; background: #f8fafc; }
        .qp-tbl select { font-size: 11px; padding: 4px 6px; border: 1px solid #e2e8f0; border-radius: 5px; background: #f8fafc; color: #0f172a; }
        /* company dropdown */
        .qp-company-drop { position: absolute; top: calc(100% + 2px); left: 0; right: 0; z-index: 300; background: #fff; border: 1px solid #cbd5e1; border-radius: 7px; max-height: 150px; overflow-y: auto; box-shadow: 0 6px 18px rgba(0,0,0,.1); }
        .qp-company-drop div { padding: 7px 11px; font-size: 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; color: #334155; }
        .qp-company-drop div:last-child { border-bottom: none; }
        .qp-company-drop div:hover { background: #eff6ff; }
        /* eyebrow */
        .eyebrow { font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 2px; }
        .section-title { font-size: 13px; font-weight: 800; color: #0f172a; margin: 0 0 10px; }
        /* scrollbar sutil */
        #qp-body::-webkit-scrollbar { width: 6px; }
        #qp-body::-webkit-scrollbar-track { background: #f1f5f9; }
        #qp-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      `}</style>

      {/* ══════════ CONTENEDOR RAÍZ ══════════ */}
      <div
        id="qp-root"
        style={{
          position: 'fixed',
          top: 0,
          left: 0, right: 0, bottom: 0,
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          background: '#f1f5f9',   /* fondo sólido — tapa TODO: navbar, filtros, calendario */
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >

        {/* ── HEADER ── */}
        <div style={{ flexShrink: 0, background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>
              CRM / Reservas / Cotización
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="/Oficial_JDL_acua.png" alt="Logo" style={{ height: 28, width: 'auto' }} />
              <span style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>Cotizar evento</span>
            </div>
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginTop: 2 }}>
              {event?.name || 'Nuevo Evento'} — {quote.venue || '(sin salón)'} — {quote.eventDate || '---'}{quote.schedule ? ` — ${quote.schedule}` : ''}
            </div>
          </div>
          <button className="qp-btn" onClick={onClose} style={{ marginTop: 4 }}>✕ Cerrar</button>
        </div>

        {/* ── BODY SCROLLABLE ── */}
        <div id="qp-body" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '14px 18px 32px' }}>

          {/* ── Barra versión + plantilla ── */}
          <div style={{ ...card, marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label style={fieldLabel}>Versión de cotización</label>
              <select style={fieldSelect} value={quote.version} onChange={e => setQuote(p => ({ ...p, version: parseInt(e.target.value) || 1 }))}>
                <option value={1}>V1 (actual) — sin fecha — Q 0.00</option>
              </select>
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label style={fieldLabel}>Plantilla contrato</label>
              <select style={fieldSelect} value={quote.templateId} onChange={e => setQuote(p => ({ ...p, templateId: e.target.value }))}>
                <option value="">— Sin Plantilla —</option>
                <option value="contrato_corp">Jardines (Corporativo)</option>
                {quickTemplates.filter(t => t.id !== 'contrato_corp' && t.id !== 'tpl-contrato-corp').map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="qp-btn" type="button">Cargar versión</button>
              <button className="qp-btn" type="button" onClick={() => setShowDocPanel(p => !p)}>
                {showDocPanel ? '▲ Ocultar datos' : '▼ Datos empresa'}
              </button>
            </div>
          </div>

          {/* ── Panel datos empresa (colapsable) ── */}
          {showDocPanel && (
            <div style={{ ...card, marginBottom: 12 }}>
              <div className="eyebrow">Datos de la cotización</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px 24px', marginTop: 10 }}>
                {/* col 1 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Contacto', key: 'contact', type: 'text' },
                    { label: 'Email', key: 'email', type: 'email' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={fieldLabel}>{f.label}</label>
                      <input style={fieldInput} type={f.type} value={quote[f.key]} onChange={e => setQuote(p => ({ ...p, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                  <div>
                    <label style={fieldLabel}>Institución</label>
                    <div style={{ position: 'relative' }}>
                      <input style={fieldInput} value={companySearchQuery}
                        onChange={e => { setCompanySearchQuery(e.target.value); setShowCompanyResults(true); }}
                        onFocus={() => setShowCompanyResults(true)}
                        onBlur={() => setTimeout(() => setShowCompanyResults(false), 200)}
                        placeholder="Buscar institución..." />
                      {showCompanyResults && filteredCompanies.length > 0 && (
                        <div className="qp-company-drop">
                          {filteredCompanies.map(c => <div key={c.id} onMouseDown={e => { e.preventDefault(); handleCompanySelect(c); }}>{c.name}</div>)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label style={fieldLabel}>Encargado Evento</label>
                    <select style={fieldSelect} value={quote.managerId}
                      onChange={e => setQuote(p => ({ ...p, managerId: e.target.value, managerName: companies.find(c => c.id === p.companyId)?.managers?.find(m => m.id === e.target.value)?.name || '' }))}>
                      <option value="">Seleccionar...</option>
                      {companies.find(c => c.id === quote.companyId)?.managers?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  {[
                    { label: 'Facturar A', key: 'billTo' },
                    { label: 'Dirección', key: 'address' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={fieldLabel}>{f.label}</label>
                      <input style={fieldInput} type="text" value={quote[f.key]} onChange={e => setQuote(p => ({ ...p, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                {/* col 2 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Tipo Evento', key: 'eventType' },
                    { label: 'Salón o Jardín', key: 'venue' },
                    { label: 'Horario y Evento', key: 'schedule' },
                    { label: 'Teléfono', key: 'phone' },
                    { label: 'NIT', key: 'nit' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={fieldLabel}>{f.label}</label>
                      <input style={fieldInput} type="text" value={quote[f.key]} onChange={e => setQuote(p => ({ ...p, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                  <div>
                    <label style={fieldLabel}>No. Personas</label>
                    <input style={fieldInput} type="number" value={quote.people} onChange={e => setQuote(p => ({ ...p, people: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── LAYOUT PRINCIPAL ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '256px 1fr',
            gap: 12,
            alignItems: 'start',
          }}>
            {/* ════ SIDEBAR ════ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Agregar servicio */}
              <div style={card}>
                <div className="eyebrow">Entrada directa</div>
                <div className="section-title">Agregar servicio</div>

                <div style={{ marginBottom: 8 }}>
                  <label style={fieldLabel}>Fecha del servicio</label>
                  <select style={fieldSelect} value={selectedServiceDate} onChange={e => setSelectedServiceDate(e.target.value)}>
                    {availableServiceDates.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={fieldLabel}>Servicio o descripción</label>
                  <input style={fieldInput} value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} list="qp-services-list" type="text" placeholder="Buscar servicio..." />
                  <datalist id="qp-services-list">{filteredServices.map(s => <option key={s.id} value={s.name} />)}</datalist>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={fieldLabel}>Cantidad previa</label>
                  <input style={fieldInput} type="number" value={serviceQty} onChange={e => setServiceQty(parseInt(e.target.value) || 1)} min="1" />
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>Obligatoria para servicios manuales.</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="qp-btn" type="button" style={{ flex: 1, justifyContent: 'center' }} onClick={() => {
                    const svc = catalogServices.find(s => s.name === serviceSearch);
                    addServiceItem(svc || { id: 'manual', name: serviceSearch || 'Servicio manual', price: 0, quantityMode: 'MANUAL' });
                  }}>+ Servicio</button>
                  <button className="qp-btn" type="button" style={{ flex: 1, justifyContent: 'center' }}>+ Crear</button>
                </div>
              </div>

              {/* Plantillas */}
              <div style={card}>
                <div className="eyebrow">Automatización</div>
                <div className="section-title">Plantillas</div>
                <div style={{ marginBottom: 8 }}>
                  <label style={fieldLabel}>Seleccionar plantilla</label>
                  <select style={fieldSelect}><option>No hay plantillas guardadas</option></select>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>Elige la plantilla que quieres cargar al carrito.</div>
                </div>
                <button className="qp-btn" type="button" style={{ width: '100%', justifyContent: 'center' }}>Aplicar plantilla</button>
              </div>

              {/* Resumen en vivo */}
              <div style={{ ...card, borderTop: '3px solid #0f172a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div className="eyebrow">Resumen en vivo</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', margin: 0 }}>Cotización actual</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#10b981', background: '#dcfce7', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: 20 }}>Activo</span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Documento</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{quote.code || 'SIN CÓDIGO'}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{quote.companyName || 'Selecciona una institución'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
                  {quote.items.length > 0
                    ? quote.items.slice(0, 4).map(item => (
                      <div key={item.rowId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{item.qty}× {item.name}</span>
                        <strong>{moneyGT(item.price * item.qty)}</strong>
                      </div>
                    ))
                    : <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '6px 0' }}>Sin servicios aún</div>
                  }
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { label: 'Subtotal', val: totals.subtotal },
                    { label: 'Descuento', val: totals.discountAmount },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
                      <span>{r.label}</span><strong>{moneyGT(r.val)}</strong>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 900, color: '#0f172a', paddingTop: 4, borderTop: '1px solid #e2e8f0', marginTop: 2 }}>
                    <span>Total</span><strong>{moneyGT(totals.total)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* ════ ZONA TABLA ════ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Tabla de servicios */}
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <div>
                    <div className="eyebrow">Carrito operativo</div>
                    <div className="section-title" style={{ marginBottom: 0 }}>Servicios y productos agregados</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Cantidades, precio, fecha, servicio y total.</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="qp-btn" type="button" onClick={handleDuplicateSelected}>Duplicar selección</button>
                    <button className="qp-btn" type="button" onClick={() => handleMoveSelected('up')}>↑ Subir</button>
                    <button className="qp-btn" type="button" onClick={() => handleMoveSelected('down')}>↓ Bajar</button>
                  </div>
                </div>

                {/* tabla con scroll horizontal propio */}
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, background: '#ffffff' }}>
                  <table className="qp-tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>
                          <input type="checkbox"
                            checked={quote.items.length > 0 && quote.items.every(i => selectedItemIds.has(i.rowId))}
                            onChange={handleSelectAllToggle} />
                        </th>
                        <th>Fecha</th>
                        <th>Cant.</th>
                        <th>Servicio</th>
                        <th>Precio</th>
                        <th>Total</th>
                        <th style={{ width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.items.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '36px 16px', textAlign: 'center', background: '#ffffff' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>Tu carrito aún está vacío</div>
                            <div style={{ fontSize: 11, color: '#cbd5e1' }}>Busca un servicio en el panel izquierdo</div>
                          </td>
                        </tr>
                      ) : (
                        quote.items.map(item => {
                          const lineTotal = Number(item.qty || 0) * Number(item.price || 0);
                          return (
                            <tr key={item.rowId} className={selectedItemIds.has(item.rowId) ? 'sel' : ''}>
                              <td style={{ textAlign: 'center' }}>
                                <input type="checkbox" checked={selectedItemIds.has(item.rowId)} onChange={() => handleSelectRowToggle(item.rowId)} />
                              </td>
                              <td>
                                <select value={item.serviceDate} onChange={e => setQuote(p => ({ ...p, items: p.items.map(i => i.rowId === item.rowId ? { ...i, serviceDate: e.target.value } : i) }))}>
                                  {availableServiceDates.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                              </td>
                              <td>
                                <input type="number" value={item.qty} onChange={e => setQuote(p => ({ ...p, items: p.items.map(i => i.rowId === item.rowId ? { ...i, qty: parseInt(e.target.value) || 1 } : i) }))} />
                              </td>
                              <td>
                                <input type="text" value={item.name} onChange={e => setQuote(p => ({ ...p, items: p.items.map(i => i.rowId === item.rowId ? { ...i, name: e.target.value } : i) }))} />
                              </td>
                              <td>
                                <input type="number" value={item.price} onChange={e => setQuote(p => ({ ...p, items: p.items.map(i => i.rowId === item.rowId ? { ...i, price: parseFloat(e.target.value) || 0 } : i) }))} />
                              </td>
                              <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{moneyGT(lineTotal)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button onClick={() => removeServiceItem(item.rowId)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 15, padding: '2px 4px', lineHeight: 1 }}>✕</button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Totales / descuento */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <label style={fieldLabel}>Descuento</label>
                      <select style={{ ...fieldSelect, width: 120 }} value={quote.discountType} onChange={e => setQuote(p => ({ ...p, discountType: e.target.value }))}>
                        <option value="AMOUNT">Monto (Q)</option>
                        <option value="PERCENT">Porcentaje (%)</option>
                      </select>
                    </div>
                    <div>
                      <label style={fieldLabel}>Valor descuento</label>
                      <input style={{ ...fieldInput, width: 110 }} type="number" value={quote.discountValue} onChange={e => setQuote(p => ({ ...p, discountValue: parseFloat(e.target.value) || 0 }))} min="0" step="0.01" />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                      Subtotal: <strong style={{ color: '#334155' }}>{moneyGT(totals.subtotal)}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                      Descuento: <strong style={{ color: '#334155' }}>{moneyGT(totals.discountAmount)}</strong>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                      Total cotización: <span style={{ color: '#0f172a' }}>{moneyGT(totals.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado de cuenta */}
              <div style={{ ...card, background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div className="eyebrow">Control financiero</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', margin: 0 }}>Estado de cuenta</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: '#475569' }}>Total: <strong>{moneyGT(totals.total)}</strong></span>
                    <span style={{ color: '#475569' }}>Abonado: <strong>{moneyGT(abonosTotal)}</strong></span>
                    <span style={{ color: abonosTotal >= totals.total ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      Saldo: <strong>{moneyGT(saldoPendiente)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Notas internas */}
              <div style={card}>
                <label style={fieldLabel}>Notas internas</label>
                <textarea
                  value={quote.internalNotes}
                  onChange={e => setQuote(p => ({ ...p, internalNotes: e.target.value }))}
                  rows={2}
                  placeholder="Observaciones internas..."
                  style={{ ...fieldInput, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>
          </div>
          {/* fin grid principal */}

        </div>
        {/* fin body */}

        {/* ── FOOTER FLOTANTE FIJO ── */}
        <div style={{
          flexShrink: 0,
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 -4px 12px rgba(0,0,0,0.05)',
          zIndex: 10
        }}>
          <div></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="qp-btn" type="button" onClick={() => window.openMenuMontajeSelectableModal?.()}>Menú y Montaje</button>
            <button className="qp-btn" type="button" onClick={() => window.openQuoteAdvanceModal?.()}>Anticipos</button>
            <button className="qp-btn" type="button" onClick={() => window.openQuoteDocument?.(event, quote)}>Reimprimir cotización</button>
            <button className="qp-btn-primary" type="button" onClick={handleSaveQuote}>Guardar cotización</button>
          </div>
        </div>

      </div>
      {/* fin root */}
    </>
  );
}