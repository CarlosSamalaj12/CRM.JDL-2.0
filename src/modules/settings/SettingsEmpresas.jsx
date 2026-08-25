import { useEffect, useMemo, useState } from 'react';
import { loadCrmState, normalizeCompanyRecord, saveCrmState, uid } from './settingsDataUtils';
import { toast, modernConfirm } from '../../utils/toast';

const emptyCompany = {
  id: '',
  name: '',
  owner: '',
  email: '',
  nit: '',
  businessName: '',
  billTo: '',
  eventType: '',
  address: '',
  phone: '',
  notes: '',
};

const emptyManager = { id: '', name: '', phone: '', email: '', address: '' };

const ITEMS_PER_PAGE = 100;

export default function SettingsEmpresas({ inline, onBack }) {
  const [stateSnapshot, setStateSnapshot] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [disabledCompanies, setDisabledCompanies] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'form'
  const [selectedId, setSelectedId] = useState('');
  const [company, setCompany] = useState(emptyCompany);
  const [companyActive, setCompanyActive] = useState(true);
  const [managers, setManagers] = useState([]);
  const [managerDraft, setManagerDraft] = useState(emptyManager);
  const [editingManagerId, setEditingManagerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const selectedCompany = useMemo(
    () => companies.find((item) => String(item.id || '') === String(selectedId || '')) || null,
    [companies, selectedId]
  );

  const reloadData = async () => {
    const crmState = await loadCrmState();
    setStateSnapshot(crmState);
    setCompanies(Array.isArray(crmState.companies) ? crmState.companies : []);
    setDisabledCompanies(Array.isArray(crmState.disabledCompanies) ? crmState.disabledCompanies.map(String) : []);
  };

  useEffect(() => {
    reloadData().catch((err) => console.error('No se pudieron cargar empresas:', err));
  }, []);

  useEffect(() => {
    if (!selectedCompany) {
      setCompany(emptyCompany);
      setCompanyActive(true);
      setManagers([]);
      setManagerDraft(emptyManager);
      setEditingManagerId('');
      return;
    }
    setCompany({
      id: selectedCompany.id || '',
      name: selectedCompany.name || '',
      owner: selectedCompany.owner || '',
      email: selectedCompany.email || '',
      nit: selectedCompany.nit || '',
      businessName: selectedCompany.billTo || selectedCompany.businessName || selectedCompany.name || '',
      billTo: selectedCompany.billTo || selectedCompany.businessName || selectedCompany.name || '',
      eventType: selectedCompany.eventType || '',
      address: selectedCompany.address || '',
      phone: selectedCompany.phone || '',
      notes: selectedCompany.notes || '',
    });
    setCompanyActive(!disabledCompanies.includes(String(selectedCompany.id || '')));
    setManagers(Array.isArray(selectedCompany.managers) ? selectedCompany.managers : []);
    setManagerDraft(emptyManager);
    setEditingManagerId('');
  }, [selectedCompany, disabledCompanies]);

  const handleCompanyChange = (field, value) => {
    setCompany((prev) => ({ ...prev, [field]: value }));
  };

  const handleManagerChange = (field, value) => {
    setManagerDraft((prev) => ({ ...prev, [field]: value }));
  };

  const addOrUpdateManager = () => {
    const clean = {
      id: editingManagerId || uid('mgr'),
      name: managerDraft.name.trim(),
      phone: managerDraft.phone.trim(),
      email: managerDraft.email.trim(),
      address: managerDraft.address.trim(),
    };

    if (!clean.name) {
      toast('Encargado requiere al menos un nombre.');
      return;
    }
    if (clean.email && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(clean.email)) {
      toast('Correo de encargado inválido.');
      return;
    }
    if (editingManagerId) {
      setManagers((prev) => prev.map((item) => String(item.id) === String(editingManagerId) ? clean : item));
    } else {
      setManagers((prev) => [...prev, clean]);
    }
    setManagerDraft(emptyManager);
    setEditingManagerId('');
  };

  const editManager = (manager) => {
    setEditingManagerId(String(manager.id || ''));
    setManagerDraft({
      id: manager.id || '',
      name: manager.name || '',
      phone: manager.phone || '',
      email: manager.email || '',
      address: manager.address || '',
    });
  };

  const removeManager = async (managerId) => {
    const ok = await modernConfirm({ title: 'Eliminar encargado', message: '¿Está seguro de eliminar este encargado?' });
    if (!ok) return;
    setManagers((prev) => prev.filter((item) => String(item.id || '') !== String(managerId || '')));
    if (String(editingManagerId) === String(managerId)) {
      setEditingManagerId('');
      setManagerDraft(emptyManager);
    }
  };

  const handleCreateNew = () => {
    setSelectedId('');
    setCompany(emptyCompany);
    setCompanyActive(true);
    setManagers([]);
    setManagerDraft(emptyManager);
    setEditingManagerId('');
    setViewMode('form');
  };

  const handleEditCompany = (comp) => {
    setSelectedId(comp.id);
    setViewMode('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToList = () => {
    setViewMode('list');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const effectiveManagers = (() => {
      if (managers.length) return managers;
      const owner = company.owner.trim();
      if (!owner) return managers;
      return [{
        id: uid('mgr'),
        name: owner,
        phone: company.phone.trim() || '',
        email: company.email.trim() || '',
        address: company.address.trim() || ''
      }];
    })();

    const payload = normalizeCompanyRecord({
      ...company,
      id: selectedId || uid('cmp'),
      name: company.name.trim(),
      owner: company.owner.trim(),
      email: company.email.trim(),
      nit: company.nit.trim(),
      businessName: company.businessName.trim(),
      billTo: company.businessName.trim(),
      eventType: company.eventType,
      address: company.address.trim(),
      phone: company.phone.trim(),
      notes: company.notes.trim(),
      managers: effectiveManagers,
    });

    if (!payload.name || !payload.owner || !payload.email || !payload.nit || !payload.businessName || !payload.eventType || !payload.address || !payload.phone) {
      toast('Completa todos los campos obligatorios de empresa.');
      return;
    }
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(payload.email)) {
      toast('Correo de empresa inválido.');
      return;
    }

    setSaving(true);
    try {
      const nextState = { ...(stateSnapshot || await loadCrmState()) };
      const currentCompanies = Array.isArray(nextState.companies) ? nextState.companies : [];
      const nameLower = (payload.name || '').trim().toLowerCase();
      const companyExists = selectedId
        ? currentCompanies.some(c => String(c.name || '').trim().toLowerCase() === nameLower && String(c.id || '') !== String(payload.id || ''))
        : currentCompanies.some(c => String(c.name || '').trim().toLowerCase() === nameLower);
      if (companyExists) { toast('Ya existe una empresa con ese nombre'); setSaving(false); return; }
      const idx = currentCompanies.findIndex((item) => String(item.id || '') === String(payload.id || ''));
      nextState.companies = idx >= 0
        ? currentCompanies.map((item, itemIdx) => itemIdx === idx ? payload : item)
        : [...currentCompanies, payload];

      const nextDisabledCompanies = new Set(Array.isArray(nextState.disabledCompanies) ? nextState.disabledCompanies.map(String) : []);
      if (companyActive) nextDisabledCompanies.delete(String(payload.id));
      else nextDisabledCompanies.add(String(payload.id));
      nextState.disabledCompanies = Array.from(nextDisabledCompanies);

      const nextDisabledManagers = new Set(Array.isArray(nextState.disabledManagers) ? nextState.disabledManagers.map(String) : []);
      payload.managers.forEach((manager) => nextDisabledManagers.delete(String(manager.id || '')));
      nextState.disabledManagers = Array.from(nextDisabledManagers);

      await saveCrmState(nextState);
      toast(selectedId ? 'Empresa actualizada ✓' : 'Empresa agregada ✓');
      await reloadData();
      setViewMode('list');
    } catch (err) {
      console.error('Error guardando empresa:', err);
      toast(err.message || 'No se pudo guardar la empresa.');
    } finally {
      setSaving(false);
    }
  };

  // Orden alfabético estricto A-Z respetando nombre válido
  const sortedCompanies = useMemo(() => {
    return companies.slice().sort((a, b) => {
      const nameA = String(a.name && a.name !== '0' ? a.name : (a.businessName || a.owner || '')).trim();
      const nameB = String(b.name && b.name !== '0' ? b.name : (b.businessName || b.owner || '')).trim();
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });
  }, [companies]);

  // Buscador filtrado reactivo
  const filteredCompanies = useMemo(() => {
    if (!searchFilter.trim()) return sortedCompanies;
    const q = searchFilter.toLowerCase().trim();
    return sortedCompanies.filter(c => {
      const nameMatch = (c.name || '').toLowerCase().includes(q);
      const ownerMatch = (c.owner || '').toLowerCase().includes(q);
      const emailMatch = (c.email || '').toLowerCase().includes(q);
      const phoneMatch = (c.phone || '').toLowerCase().includes(q);
      const nitMatch = (c.nit || '').toLowerCase().includes(q);
      const businessMatch = (c.businessName || '').toLowerCase().includes(q);
      const managerMatch = Array.isArray(c.managers) && c.managers.some(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q)
      );
      return nameMatch || ownerMatch || emailMatch || phoneMatch || nitMatch || businessMatch || managerMatch;
    });
  }, [sortedCompanies, searchFilter]);

  // Paginación 50 registros
  const totalPages = Math.ceil(filteredCompanies.length / ITEMS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedCompanies = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredCompanies.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCompanies, safeCurrentPage]);

  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(safeCurrentPage * ITEMS_PER_PAGE, filteredCompanies.length);

  return (
    <>
      {viewMode === 'list' ? (
        /* ============================================================
           1. VISTA DE CATÁLOGO MAESTRO CON SCROLL INTERNO EXCLUSIVO DE TABLA
           ============================================================ */
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '10px', width: '100%' }}>
          {/* Bloque Superior de Encabezado + Buscador (Fijo arriba, sin scroll) */}
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: '#ffffff',
              paddingBottom: '8px',
              borderBottom: '1.5px solid #e2e8f0'
            }}
          >
            {/* Fila 1: Título, Badge y Botón Principal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {onBack && (
                  <button
                    type="button"
                    className="settings-secondary-btn"
                    onClick={onBack}
                    style={{ padding: '4px 10px', fontSize: '11.5px', background: '#ffffff', borderColor: '#cbd5e1', color: '#334155' }}
                  >
                    ← Volver a Ajustes
                  </button>
                )}
                <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🏢 Catálogo General de Empresas y Encargados
                </h2>
                <span className="pill" style={{ background: '#e0f2fe', color: '#0284c7', fontWeight: 800, fontSize: '11.5px', padding: '3px 10px', borderRadius: '9999px' }}>
                  {companies.length} registros
                </span>
              </div>

              <button
                type="button"
                className="settings-primary-btn"
                onClick={handleCreateNew}
                style={{ padding: '7px 16px', fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>➕ Nueva Empresa</span>
              </button>
            </div>

            {/* Fila 2: Subtítulo */}
            <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0' }}>
              Listado ordenado alfabéticamente. Haz clic en "Editar" para modificar datos o gestionar encargados.
            </p>

            {/* Fila 3: Buscador Limpio */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginTop: '2px' }}>
              <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: '460px' }}>
                <input
                  type="text"
                  className="settings-search-bar-input"
                  placeholder="🔍 Buscar por empresa, nit, teléfono, correo o encargado..."
                  value={searchFilter}
                  onChange={(e) => {
                    setSearchFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                {filteredCompanies.length > 0 ? (
                  <span>Mostrando <strong>{startIndex} - {endIndex}</strong> de <strong>{filteredCompanies.length}</strong> empresas</span>
                ) : (
                  <span>Sin resultados</span>
                )}
              </div>
            </div>
          </div>

          {/* Tabla con SCROLL VERTICAL PROPIO (Único contenedor que se desplaza) */}
          <div
            className="settings-table-wrap"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbd5e1'
            }}
          >
            <table className="settings-table" style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>EMPRESA / ORGANIZACIÓN</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>ENCARGADO PRINCIPAL</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>ENCARGADOS REGISTRADOS</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>CONTACTO / DATOS</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>ESTADO</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {!paginatedCompanies.length && (
                  <tr>
                    <td colSpan="6" className="settings-td-center" style={{ padding: '24px 0', color: '#64748b' }}>
                      {searchFilter ? 'No se encontraron empresas coincidentes con tu búsqueda.' : 'No hay empresas registradas aún.'}
                    </td>
                  </tr>
                )}
                {paginatedCompanies.map((c) => {
                  const isDisabled = disabledCompanies.includes(String(c.id));
                  const mgrList = Array.isArray(c.managers) ? c.managers : [];

                  const rawName = String(c.name || '').trim();
                  const rawBusiness = String(c.businessName || '').trim();
                  const rawOwner = String(c.owner || '').trim();

                  const displayName = (rawName && rawName !== '0')
                    ? rawName
                    : ((rawBusiness && rawBusiness !== '0')
                      ? rawBusiness
                      : ((rawOwner && rawOwner !== '0') ? rawOwner : 'Empresa sin Nombre'));

                  const displaySub = (rawBusiness && rawBusiness !== displayName && rawBusiness !== '0')
                    ? rawBusiness
                    : (rawName && rawName !== displayName && rawName !== '0' ? rawName : '');

                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{displayName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                          NIT: {c.nit || 'CF'} {displaySub ? `• ${displaySub}` : ''}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '12.5px' }}>{c.owner || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{c.eventType || 'Social'}</div>
                      </td>
                      <td>
                        {mgrList.length > 0 ? (
                          <div>
                            <span className="pill" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: '10.5px' }}>
                              👥 {mgrList.length} encargado(s)
                            </span>
                            <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {mgrList.map(m => m.name).join(', ')}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Sin encargados adicionales</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: '#0f172a' }}>{c.email || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{c.phone || '—'}</div>
                      </td>
                      <td>
                        <span className={`pill ${isDisabled ? 'pill-inactive' : 'pill-active'}`}>
                          {isDisabled ? 'Inhabilitada' : 'Activa'}
                        </span>
                      </td>
                      <td className="settings-td-center">
                        <button
                          type="button"
                          className="settings-accent-btn"
                          style={{ padding: '5px 12px', fontSize: '11.5px', borderRadius: '6px' }}
                          onClick={() => handleEditCompany(c)}
                        >
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginador (Fijo abajo) */}
          {totalPages > 1 && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '8px 14px', background: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Página <strong>{safeCurrentPage}</strong> de <strong>{totalPages}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="settings-secondary-btn"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                >
                  « Primera
                </button>
                <button
                  type="button"
                  className="settings-secondary-btn"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                >
                  ‹ Anterior
                </button>
                <button
                  type="button"
                  className="settings-secondary-btn"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                >
                  Siguiente ›
                </button>
                <button
                  type="button"
                  className="settings-secondary-btn"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                >
                  Última »
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ============================================================
           2. VISTA DE FORMULARIO CREAR / EDITAR EMPRESA Y ENCARGADOS
           ============================================================ */
        <div className="settings-section-card" style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', overflowY: 'auto' }}>
          <form autoComplete="off" onSubmit={handleSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1.5px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="settings-secondary-btn"
                  onClick={handleBackToList}
                  style={{ padding: '6px 12px', fontSize: '12px', background: '#ffffff', borderColor: '#cbd5e1' }}
                >
                  ← Volver al Catálogo
                </button>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                    🏢 {selectedId ? `Editar: ${company.name || 'Empresa'}` : 'Nueva Empresa'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                    Completa la información corporativa y agrega a los encargados requeridos
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button type="button" className="settings-secondary-btn" onClick={handleBackToList} style={{ padding: '6px 12px', fontSize: '12px' }}>
                  Cancelar
                </button>
                <button className="settings-primary-btn" type="submit" disabled={saving} style={{ padding: '6px 16px', fontSize: '12px' }}>
                  {saving ? 'Guardando...' : (selectedId ? '💾 Guardar Cambios' : '✓ Crear Empresa')}
                </button>
              </div>
            </div>

            <div className="settings-field-group">
              <label className="settings-modern-field">
                <span>Empresa seleccionada</span>
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  <option value="">Crear nueva empresa</option>
                  {sortedCompanies.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name || 'Empresa'}{disabledCompanies.includes(String(item.id || '')) ? ' (Inhabilitada)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="settings-modern-field">
                <span>Estado</span>
                <label className="settings-switch-inline">
                  <input type="checkbox" checked={companyActive} onChange={(e) => setCompanyActive(e.target.checked)} />
                  <span>Empresa activa</span>
                </label>
              </div>
            </div>

            <div className="settings-field-group">
              <label className="settings-modern-field">
                <span>Nombre de la Organización</span>
                <input type="text" value={company.name} onChange={(e) => handleCompanyChange('name', e.target.value)} placeholder="Ej: Eventos del Lago" required />
              </label>
              <label className="settings-modern-field">
                <span>Encargado de la Organización</span>
                <input type="text" value={company.owner} onChange={(e) => handleCompanyChange('owner', e.target.value)} placeholder="Nombre del encargado principal" required />
              </label>
            </div>

            <div className="settings-field-group">
              <label className="settings-modern-field">
                <span>Correo</span>
                <input type="email" value={company.email} onChange={(e) => handleCompanyChange('email', e.target.value)} placeholder="correo@empresa.com" required autoComplete="off" />
              </label>
              <label className="settings-modern-field">
                <span>NIT</span>
                <input type="text" value={company.nit} onChange={(e) => handleCompanyChange('nit', e.target.value)} placeholder="NIT" required />
              </label>
            </div>

            <div className="settings-field-group">
              <label className="settings-modern-field">
                <span>Facturar A</span>
                <input type="text" value={company.businessName} onChange={(e) => handleCompanyChange('businessName', e.target.value)} placeholder="Nombre para facturación" required />
              </label>
              <label className="settings-modern-field">
                <span>Tipo Evento</span>
                <select value={company.eventType} onChange={(e) => handleCompanyChange('eventType', e.target.value)} required>
                  <option value="">Selecciona tipo</option>
                  <option value="Social">Social</option>
                  <option value="Corporativo">Corporativo</option>
                  <option value="Individual">Individual</option>
                </select>
              </label>
            </div>

            <div className="settings-field-group">
              <label className="settings-modern-field">
                <span>Dirección</span>
                <input type="text" value={company.address} onChange={(e) => handleCompanyChange('address', e.target.value)} placeholder="Dirección" required />
              </label>
              <label className="settings-modern-field">
                <span>Teléfono</span>
                <input type="text" value={company.phone} onChange={(e) => handleCompanyChange('phone', e.target.value)} placeholder="Teléfono" required />
              </label>
            </div>

            <label className="settings-modern-field">
              <span>Observación</span>
              <textarea rows="2" value={company.notes} onChange={(e) => handleCompanyChange('notes', e.target.value)} placeholder="Alguna observación" />
            </label>

            {selectedCompany && (
              <div className="settings-modern-field">
                <span>Record de la empresa</span>
                <div className="companyRecordSummary">
                  <span className="pill">Encargados: {managers.length}</span>
                  <span className="pill">Estado: {companyActive ? 'Activa' : 'Inhabilitada'}</span>
                </div>
              </div>
            )}

            {selectedCompany && managers.length === 0 && company.owner.trim() && (
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 12.5,
                color: '#92400e',
                marginTop: 10,
                lineHeight: 1.5
              }}>
                💡 <strong>Esta empresa no tiene encargados adicionales</strong> (el campo "Encargado de la Organización" dice <strong>{company.owner}</strong>).
                Al guardar se autogenerará un encargado con ese nombre. Si prefieres, agrégalos manualmente abajo.
              </div>
            )}

            {/* ── Managers ── */}
            <div className="settings-modern-field" style={{ marginTop: '16px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', marginBottom: '8px' }}>
                👥 Encargados de la empresa ({managers.length})
              </span>

              <div className="settings-field-group">
                <input type="text" className="settings-input-compact" value={managerDraft.name} onChange={(e) => handleManagerChange('name', e.target.value)} placeholder="Nombre del encargado *" />
                <input type="text" className="settings-input-compact" value={managerDraft.phone} onChange={(e) => handleManagerChange('phone', e.target.value)} placeholder="Teléfono" />
              </div>
              <div className="settings-field-group" style={{ marginTop: 0 }}>
                <input type="email" className="settings-input-compact" value={managerDraft.email} onChange={(e) => handleManagerChange('email', e.target.value)} placeholder="Correo" autoComplete="off" />
                <input type="text" className="settings-input-compact" value={managerDraft.address} onChange={(e) => handleManagerChange('address', e.target.value)} placeholder="Dirección (opcional)" />
              </div>
              <div className="rightActions" style={{ marginTop: '6px' }}>
                <button className="settings-accent-btn" type="button" onClick={addOrUpdateManager}>
                  {editingManagerId ? '✏️ Actualizar encargado' : '➕ Agregar encargado'}
                </button>
              </div>

              <div className="settings-table-wrap" style={{ marginTop: 10 }}>
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Teléfono</th>
                      <th>Correo</th>
                      <th>Dirección</th>
                      <th style={{ textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!managers.length && (
                      <tr>
                        <td colSpan="5" className="settings-td-center">Sin encargados agregados.</td>
                      </tr>
                    )}
                    {managers.map((manager) => (
                      <tr key={manager.id} className={String(editingManagerId) === String(manager.id) ? 'settings-usr-row-editing' : ''}>
                        <td><strong>{manager.name}</strong></td>
                        <td>{manager.phone || '—'}</td>
                        <td>{manager.email || '—'}</td>
                        <td>{manager.address || '—'}</td>
                        <td className="settings-td-center">
                          <div className="settings-table-actions">
                            <button type="button" title="Editar encargado" onClick={() => editManager(manager)}>&#9998;</button>
                            <button type="button" className="danger" title="Eliminar encargado" onClick={() => removeManager(manager.id)}>&#8854;</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
