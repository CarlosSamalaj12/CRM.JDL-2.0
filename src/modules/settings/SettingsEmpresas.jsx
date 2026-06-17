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

export default function SettingsEmpresas({ inline, onBack }) {
  const [stateSnapshot, setStateSnapshot] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [disabledCompanies, setDisabledCompanies] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [company, setCompany] = useState(emptyCompany);
  const [companyActive, setCompanyActive] = useState(true);
  const [managers, setManagers] = useState([]);
  const [managerDraft, setManagerDraft] = useState(emptyManager);
  const [editingManagerId, setEditingManagerId] = useState('');
  const [saving, setSaving] = useState(false);

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
    if (!clean.name || !clean.phone || !clean.email) {
      toast('Encargado requiere nombre, telefono y correo.');
      return;
    }
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(clean.email)) {
      toast('Correo de encargado invalido.');
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

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
      managers,
    });

    if (!payload.name || !payload.owner || !payload.email || !payload.nit || !payload.businessName || !payload.eventType || !payload.address || !payload.phone) {
      toast('Completa todos los campos obligatorios de empresa.');
      return;
    }
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(payload.email)) {
      toast('Correo de empresa invalido.');
      return;
    }
    if (!payload.managers.length) {
      toast('Agrega al menos un encargado para la empresa.');
      return;
    }

    setSaving(true);
    try {
      const nextState = { ...(stateSnapshot || await loadCrmState()) };
      const currentCompanies = Array.isArray(nextState.companies) ? nextState.companies : [];
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
      setSelectedId(payload.id);
    } catch (err) {
      console.error('Error guardando empresa:', err);
      toast(err.message || 'No se pudo guardar la empresa.');
    } finally {
      setSaving(false);
    }
  };

  const toggleCompanyDisabled = async () => {
    if (!selectedId) return;
    setCompanyActive((prev) => !prev);
  };

  return (
    <>
      {inline && (
        <button type="button" onClick={onBack} className="btn-exit" style={{ marginBottom: '12px' }}>
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
          Volver a Configuración
        </button>
      )}

      <div className="settings-section-card" style={{ overflow: inline ? 'visible' : undefined }}>
        <form autoComplete="off" onSubmit={handleSubmit}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>🏢 {selectedId ? 'Editar empresa' : 'Nueva empresa'}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Se usará en cotización — completa todos los campos obligatorios</div>
            </div>
            <button className="settings-primary-btn" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : (selectedId ? '💾 Guardar Cambios' : '✓ Crear Empresa')}
            </button>
          </div>

          <div className="settings-field-group">
            <label className="settings-modern-field">
              <span>Empresa existente</span>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                <option value="">Crear nueva empresa</option>
                {companies
                  .slice()
                  .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }))
                  .map((item) => (
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
            <label className="settings-modern-field"><span>Nombre de la Organización</span><input type="text" value={company.name} onChange={(e) => handleCompanyChange('name', e.target.value)} placeholder="Ej: Eventos del Lago" required /></label>
            <label className="settings-modern-field"><span>Encargado de la Organización</span><input type="text" value={company.owner} onChange={(e) => handleCompanyChange('owner', e.target.value)} placeholder="Nombre del encargado principal" required /></label>
          </div>

          <div className="settings-field-group">
            <label className="settings-modern-field"><span>Correo</span><input type="email" value={company.email} onChange={(e) => handleCompanyChange('email', e.target.value)} placeholder="correo@empresa.com" required autoComplete="off" /></label>
            <label className="settings-modern-field"><span>NIT</span><input type="text" value={company.nit} onChange={(e) => handleCompanyChange('nit', e.target.value)} placeholder="NIT" required /></label>
          </div>

          <div className="settings-field-group">
            <label className="settings-modern-field"><span>Facturar A</span><input type="text" value={company.businessName} onChange={(e) => handleCompanyChange('businessName', e.target.value)} placeholder="Nombre para facturación" required /></label>
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
            <label className="settings-modern-field"><span>Dirección</span><input type="text" value={company.address} onChange={(e) => handleCompanyChange('address', e.target.value)} placeholder="Dirección" required /></label>
            <label className="settings-modern-field"><span>Teléfono</span><input type="text" value={company.phone} onChange={(e) => handleCompanyChange('phone', e.target.value)} placeholder="Teléfono" required /></label>
          </div>

          <label className="settings-modern-field"><span>Observación</span><textarea rows="2" value={company.notes} onChange={(e) => handleCompanyChange('notes', e.target.value)} placeholder="Alguna observación" /></label>

          {selectedCompany && (
            <div className="settings-modern-field">
              <span>Record de la empresa</span>
              <div className="companyRecordSummary">
                <span className="pill">Encargados: {managers.length}</span>
                <span className="pill">Estado: {companyActive ? 'Activa' : 'Inhabilitada'}</span>
              </div>
            </div>
          )}

          {/* ── Managers ── */}
          <div className="settings-modern-field" style={{ marginTop: '14px' }}>
            <span>Encargados de la empresa</span>
            <div className="settings-field-group">
              <input type="text" className="settings-input-compact" value={managerDraft.name} onChange={(e) => handleManagerChange('name', e.target.value)} placeholder="Nombre del encargado" />
              <input type="text" className="settings-input-compact" value={managerDraft.phone} onChange={(e) => handleManagerChange('phone', e.target.value)} placeholder="Teléfono" />
            </div>
            <div className="settings-field-group" style={{ marginTop: 0 }}>
              <input type="email" className="settings-input-compact" value={managerDraft.email} onChange={(e) => handleManagerChange('email', e.target.value)} placeholder="Correo" autoComplete="off" />
              <input type="text" className="settings-input-compact" value={managerDraft.address} onChange={(e) => handleManagerChange('address', e.target.value)} placeholder="Dirección (opcional)" />
            </div>
            <div className="rightActions">
              <button className="settings-accent-btn" type="button" onClick={addOrUpdateManager}>{editingManagerId ? 'Actualizar encargado' : '+ Encargado'}</button>
            </div>
            <div className="settings-table-wrap" style={{ marginTop: 10 }}>
              <table className="settings-table">
                <thead><tr><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Dirección</th><th></th></tr></thead>
                <tbody>
                  {!managers.length && <tr><td colSpan="5" className="settings-td-center">Sin encargados agregados.</td></tr>}
                  {managers.map((manager) => (
                    <tr key={manager.id} className={String(editingManagerId) === String(manager.id) ? 'settings-usr-row-editing' : ''}>
                      <td>{manager.name}</td>
                      <td>{manager.phone}</td>
                      <td>{manager.email}</td>
                      <td>{manager.address || ''}</td>
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
    </>
  );
}
