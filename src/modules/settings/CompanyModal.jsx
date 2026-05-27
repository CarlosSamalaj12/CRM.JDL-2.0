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

export default function CompanyModal({ onClose }) {
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

  const handleClose = () => {
    document.getElementById('companyBackdrop').hidden = true;
    if (onClose) onClose();
  };

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
    const ok = await modernConfirm({
      title: 'Eliminar encargado',
      message: '¿Está seguro de eliminar este encargado?'
    });
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
      toast(selectedId ? 'Empresa actualizada.' : 'Empresa agregada.');
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
    <div className="modalBackdrop" id="companyBackdrop" hidden onClick={(e) => { if (e.target.classList.contains('modalBackdrop')) handleClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="companyTitle">
        <div className="modalHeader">
          <div>
            <div className="modalTitle" id="companyTitle">{selectedId ? 'Editar empresa' : 'Nueva empresa'}</div>
            <div className="modalSubtitle">Se usara en cotizacion</div>
          </div>
          <button className="iconBtn" id="btnCompanyClose" type="button" title="Cerrar" onClick={handleClose}>&#10005;</button>
        </div>

        <form className="modalBody" id="companyForm" autoComplete="off" onSubmit={handleSubmit}>
          <div className="row2">
            <label className="field">
              <span>Empresa existente</span>
              <select id="companyEditSelect" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
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
            <div className="field">
              <span>Estado</span>
              <label className="statusSwitchInline">
                <input id="companyActive" type="checkbox" checked={companyActive} onChange={(e) => setCompanyActive(e.target.checked)} />
                <span>Empresa activa</span>
              </label>
            </div>
          </div>

          <div className="row2">
            <label className="field"><span>Nombre de la Organizacion</span><input id="companyName" type="text" value={company.name} onChange={(e) => handleCompanyChange('name', e.target.value)} placeholder="Ej: Eventos del Lago" required /></label>
            <label className="field"><span>Encargado de la Organizacion</span><input id="companyOwner" type="text" value={company.owner} onChange={(e) => handleCompanyChange('owner', e.target.value)} placeholder="Nombre del encargado principal" required /></label>
          </div>

          <div className="row2">
            <label className="field"><span>Correo</span><input id="companyEmail" type="email" value={company.email} onChange={(e) => handleCompanyChange('email', e.target.value)} placeholder="correo@empresa.com" required autoComplete="off" /></label>
            <label className="field"><span>NIT</span><input id="companyNIT" type="text" value={company.nit} onChange={(e) => handleCompanyChange('nit', e.target.value)} placeholder="NIT" required /></label>
          </div>

          <div className="row2">
            <label className="field"><span>Facturar A</span><input id="companyBusinessName" type="text" value={company.businessName} onChange={(e) => handleCompanyChange('businessName', e.target.value)} placeholder="Nombre para facturacion" required /></label>
            <label className="field">
              <span>Tipo Evento</span>
              <select id="companyEventType" value={company.eventType} onChange={(e) => handleCompanyChange('eventType', e.target.value)} required>
                <option value="">Selecciona tipo</option>
                <option value="Social">Social</option>
                <option value="Corporativo">Corporativo</option>
                <option value="Individual">Individual</option>
              </select>
            </label>
          </div>

          <div className="row2">
            <label className="field"><span>Direccion</span><input id="companyAddress" type="text" value={company.address} onChange={(e) => handleCompanyChange('address', e.target.value)} placeholder="Direccion" required /></label>
            <label className="field"><span>Telefono</span><input id="companyPhone" type="text" value={company.phone} onChange={(e) => handleCompanyChange('phone', e.target.value)} placeholder="Telefono" required /></label>
          </div>

          <label className="field"><span>Observacion</span><textarea id="companyNotes" rows="2" value={company.notes} onChange={(e) => handleCompanyChange('notes', e.target.value)} placeholder="Alguna observacion" /></label>

          {selectedCompany && (
            <div className="field" id="companyRecordSection">
              <span>Record de la empresa</span>
              <div className="companyRecordSummary" id="companyRecordSummary">
                <span className="pill">Encargados: {managers.length}</span>
                <span className="pill">Estado: {companyActive ? 'Activa' : 'Inhabilitada'}</span>
              </div>
            </div>
          )}

          <div className="field">
            <span>Encargados de la empresa</span>
            <div className="row2">
              <input id="managerName" type="text" value={managerDraft.name} onChange={(e) => handleManagerChange('name', e.target.value)} placeholder="Nombre del encargado" />
              <input id="managerPhone" type="text" value={managerDraft.phone} onChange={(e) => handleManagerChange('phone', e.target.value)} placeholder="Telefono" />
            </div>
            <div className="row2">
              <input id="managerEmail" type="email" value={managerDraft.email} onChange={(e) => handleManagerChange('email', e.target.value)} placeholder="Correo" autoComplete="off" />
              <input id="managerAddress" type="text" value={managerDraft.address} onChange={(e) => handleManagerChange('address', e.target.value)} placeholder="Direccion (opcional)" />
            </div>
            <div className="rightActions">
              <button className="btn-cotizar" type="button" id="btnAddManager" onClick={addOrUpdateManager}>{editingManagerId ? 'Actualizar encargado' : '+ Encargado'}</button>
            </div>
            <div className="quoteTableWrap">
              <table className="quoteTable">
                <thead><tr><th>Nombre</th><th>Telefono</th><th>Correo</th><th>Direccion</th><th></th></tr></thead>
                <tbody id="managersBody">
                  {!managers.length && <tr><td colSpan="5">Sin encargados agregados.</td></tr>}
                  {managers.map((manager) => (
                    <tr key={manager.id} className={String(editingManagerId) === String(manager.id) ? 'isEditingRow' : ''}>
                      <td>{manager.name}</td>
                      <td>{manager.phone}</td>
                      <td>{manager.email}</td>
                      <td>{manager.address || ''}</td>
                      <td className="tableActionsCell">
                        <button type="button" className="apptIconBtn apptEdit" title="Editar encargado" aria-label="Editar encargado" onClick={() => editManager(manager)}>&#9998;</button>
                        <button type="button" className="apptIconBtn apptDelete" title="Eliminar encargado" aria-label="Eliminar encargado" onClick={() => removeManager(manager.id)}>&#8854;</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="modalFooter">
            <div className="leftActions">
              <button className="btn-cancelar" id="btnCompanyDisable" type="button" disabled={!selectedId} onClick={toggleCompanyDisabled}>{companyActive ? 'Inhabilitar' : 'Reactivar'}</button>
            </div>
            <div className="rightActions">
              <button className="btn-teal" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar empresa'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
