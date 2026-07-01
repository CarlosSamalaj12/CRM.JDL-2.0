import React, { useState, useEffect, useRef } from 'react';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';
import { toast, modernConfirm } from '../../utils/toast';

export default function SettingsSalones({ inline, onBack }) {
  const salonesModalRef = useRef(null);
  const [salones, setSalones] = useState([]);
  const [disabledSalones, setDisabledSalones] = useState([]);
  const [salonCapacities, setSalonCapacities] = useState({});
  const [salonOccupancyEnabled, setSalonOccupancyEnabled] = useState([]);
  
  // Form State
  const [selectedSalon, setSelectedSalon] = useState('');
  const [salonNameInput, setSalonNameInput] = useState('');
  const [salonCapacityInput, setSalonCapacityInput] = useState('');
  const [salonActive, setSalonActive] = useState(true);
  const [salonOccupancyCheck, setSalonOccupancyCheck] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const state = await loadCrmState();
      const loadedSalones = Array.isArray(state.salones) ? state.salones : [];
      const loadedDisabled = Array.isArray(state.disabledSalones) ? state.disabledSalones : [];
      const loadedCapacities = (state.salonCapacities && typeof state.salonCapacities === 'object') ? state.salonCapacities : {};
      const loadedOccupancy = Array.isArray(state.salonOccupancyEnabled) ? state.salonOccupancyEnabled : [];
      setSalones(loadedSalones);
      setDisabledSalones(loadedDisabled);
      setSalonCapacities(loadedCapacities);
      setSalonOccupancyEnabled(loadedOccupancy);
      resetForm();
    } catch (err) {
      console.error('Error al cargar salones:', err);
      toast('Error al cargar salones');
    }
  };

  const handleClose = () => {
    if (onBack) onBack();
  };

  const resetForm = () => {
    setSelectedSalon('');
    setSalonNameInput('');
    setSalonCapacityInput('');
    setSalonActive(true);
    setSalonOccupancyCheck(true);
  };

  const handleSalonSelectChange = (e) => {
    const name = e.target.value;
    setSelectedSalon(name);
    if (name) {
      setSalonNameInput(name);
      setSalonCapacityInput(salonCapacities[name] || '');
      setSalonActive(!disabledSalones.includes(name));
      setSalonOccupancyCheck(salonOccupancyEnabled.includes(name));
    } else {
      resetForm();
    }
  };

  const loadSalonForEdit = (name) => {
    setSelectedSalon(name);
    setSalonNameInput(name);
    setSalonCapacityInput(salonCapacities[name] || '');
    setSalonActive(!disabledSalones.includes(name));
    setSalonOccupancyCheck(salonOccupancyEnabled.includes(name));
  };

  const handleSave = async () => {
    const nameTrimmed = salonNameInput.trim();
    if (!nameTrimmed) {
      toast('Nombre del salon es requerido');
      return;
    }

    const capacityNum = parseInt(salonCapacityInput, 10);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      toast('Cantidad Max PAX debe ser mayor a 0');
      return;
    }

    const isNew = !selectedSalon;
    const exists = salones.some(s => s.toLowerCase() === nameTrimmed.toLowerCase() && (!selectedSalon || s.toLowerCase() !== selectedSalon.toLowerCase()));
    if (exists) {
      toast('Ya existe un salon con ese nombre');
      return;
    }

    setSaving(true);
    try {
      let nextSalones = [...salones];
      let nextDisabledSalones = [...disabledSalones];
      let nextCapacities = { ...salonCapacities };
      let nextOccupancyEnabled = [...salonOccupancyEnabled];

      if (isNew) {
        nextSalones.push(nameTrimmed);
      } else {
        const prevName = selectedSalon;
        nextSalones = nextSalones.map(s => s === prevName ? nameTrimmed : s);
        if (prevName !== nameTrimmed) {
          nextCapacities[nameTrimmed] = nextCapacities[prevName];
          delete nextCapacities[prevName];
          nextDisabledSalones = nextDisabledSalones.map(s => s === prevName ? nameTrimmed : s);
          nextOccupancyEnabled = nextOccupancyEnabled.map(s => s === prevName ? nameTrimmed : s);
        }
      }

      nextCapacities[nameTrimmed] = capacityNum;

      if (salonOccupancyCheck) {
        if (!nextOccupancyEnabled.includes(nameTrimmed)) {
          nextOccupancyEnabled.push(nameTrimmed);
        }
      } else {
        nextOccupancyEnabled = nextOccupancyEnabled.filter(s => s !== nameTrimmed);
      }

      if (salonActive) {
        nextDisabledSalones = nextDisabledSalones.filter(s => s !== nameTrimmed);
      } else {
        if (!nextDisabledSalones.includes(nameTrimmed)) {
          nextDisabledSalones.push(nameTrimmed);
        }
      }

      nextSalones.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

      const currentState = await loadCrmState();
      await saveCrmState({
        ...currentState,
        salones: nextSalones,
        disabledSalones: nextDisabledSalones,
        salonCapacities: nextCapacities,
        salonOccupancyEnabled: nextOccupancyEnabled
      });

      setSalones(nextSalones);
      setDisabledSalones(nextDisabledSalones);
      setSalonCapacities(nextCapacities);
      setSalonOccupancyEnabled(nextOccupancyEnabled);
      toast(isNew ? 'Salon agregado' : 'Salon actualizado');
      resetForm();
    } catch (err) {
      console.error('Error al guardar salon:', err);
      toast('Error al guardar el salon');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (name) => {
    const isCurrentlyActive = !disabledSalones.includes(name);
    const confirmText = isCurrentlyActive ? 'inhabilitar' : 'reactivar';
    const isConfirmed = await modernConfirm({
      title: `${isCurrentlyActive ? 'Inhabilitar' : 'Reactivar'} Salón`,
      message: `¿Desea ${confirmText} el salón \"${name}\"?`,
      confirmText: isCurrentlyActive ? 'Inhabilitar' : 'Reactivar',
      cancelText: 'Cancelar'
    });

    if (!isConfirmed) return;

    try {
      let nextDisabled = [...disabledSalones];
      if (isCurrentlyActive) {
        nextDisabled.push(name);
      } else {
        nextDisabled = nextDisabled.filter(s => s !== name);
      }

      const currentState = await loadCrmState();
      await saveCrmState({ ...currentState, disabledSalones: nextDisabled });
      setDisabledSalones(nextDisabled);
      toast(isCurrentlyActive ? 'Salon inhabilitado' : 'Salon reactivado');
      if (selectedSalon === name) {
        setSalonActive(!isCurrentlyActive);
      }
    } catch (err) {
      console.error('Error toggling salon status:', err);
      toast('Error al cambiar estado del salon');
    }
  };

  const handleDisableBtn = () => {
    if (selectedSalon) {
      handleToggleActive(selectedSalon);
    }
  };

  const content = (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>🏢 Gestión de Salones</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Agrega, edita e inhabilita salones del recinto</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="settings-danger-btn" type="button" disabled={!selectedSalon} onClick={handleDisableBtn}>
            {selectedSalon && disabledSalones.includes(selectedSalon) ? 'Reactivar' : 'Inhabilitar'}
          </button>
          <button className="settings-primary-btn" type="button" disabled={saving} onClick={handleSave}>
            {saving ? 'Guardando...' : (selectedSalon ? 'Guardar' : 'Agregar salón')}
          </button>
        </div>
      </div>

      {/* Row 1: Select existing + Status */}
      <div className="settings-field-group">
        <label className="settings-modern-field">
          <span>Salon existente</span>
          <select value={selectedSalon} onChange={handleSalonSelectChange}>
            <option value="">-- Crear nuevo salon --</option>
            {salones.map(s => (
              <option key={s} value={s}>
                {s} {disabledSalones.includes(s) ? '(Inhabilitado)' : '(Activo)'}
              </option>
            ))}
          </select>
        </label>
        <div className="settings-modern-field">
          <span>Estado</span>
          <label className="settings-switch-inline">
            <input type="checkbox" checked={salonActive} onChange={(e) => setSalonActive(e.target.checked)} />
            <span>{salonActive ? 'Salon activo' : 'Salon inactivo'}</span>
          </label>
        </div>
      </div>

      {/* Row 2: Name + Capacity */}
      <div className="settings-field-group">
        <label className="settings-modern-field">
          <span>Nombre del salon</span>
          <input type="text" placeholder="Ej: Salon Aurora" value={salonNameInput} onChange={(e) => setSalonNameInput(e.target.value)} />
        </label>
        <label className="settings-modern-field">
          <span>Cantidad Max PAX *</span>
          <input type="number" placeholder="Ej: 500" value={salonCapacityInput} onChange={(e) => setSalonCapacityInput(e.target.value)} />
        </label>
      </div>

      {/* Row 3: Affects occupancy checkbox */}
      <div className="settings-field-group">
        <label className="settings-modern-field">
          <span>Diagrama de ocupación</span>
          <label className="settings-switch-inline">
            <input type="checkbox" checked={salonOccupancyCheck} onChange={(e) => setSalonOccupancyCheck(e.target.checked)} />
            <span>{salonOccupancyCheck ? 'Influye en el diagrama de ocupación 📊' : 'No influye en el diagrama'}</span>
          </label>
        </label>
        <div className="settings-modern-field" style={{ justifyContent: 'center' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
            Al marcar este salón, su cantidad Max PAX se suma al total disponible para el cálculo de % de ocupación en el reporte de Ocupación en Barras.
          </span>
        </div>
      </div>

      {/* Salones table */}
      <div className="settings-modern-field">
        <span>Salones registrados</span>
        <div className="settings-table-wrap" style={{ maxHeight: '260px' }}>
          <table className="settings-table" style={{ minWidth: '0' }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Max PAX</th>
                <th>Ocupación</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {salones.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                    No hay salones registrados
                  </td>
                </tr>
              ) : (
                salones.map(s => {
                  const isDisabled = disabledSalones.includes(s);
                  const capacity = salonCapacities[s] || '2000';
                  const affectsOccupancy = salonOccupancyEnabled.includes(s);
                  return (
                    <tr key={s}>
                      <td style={{ fontWeight: '600' }}>{s}</td>
                      <td>{capacity} Max PAX</td>
                      <td>
                        <span className="settings-role-badge" style={{
                          background: affectsOccupancy ? '#ede9fe' : '#f1f5f9',
                          color: affectsOccupancy ? '#5b21b6' : '#64748b',
                          borderColor: affectsOccupancy ? '#c4b5fd' : '#e2e8f0',
                        }}>
                          {affectsOccupancy ? '📊 Sí influye' : '—'}
                        </span>
                      </td>
                      <td>
                        <span className="settings-role-badge" style={{
                          background: isDisabled ? '#fee2e2' : '#dcfce7',
                          color: isDisabled ? '#991b1b' : '#15803d',
                          borderColor: isDisabled ? '#fecaca' : '#bbf7d0',
                        }}>
                          {isDisabled ? 'Inhabilitado' : 'Activo'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="settings-table-actions">
                          <button type="button" title="Editar" onClick={() => loadSalonForEdit(s)}>✎</button>
                          <button type="button" title={isDisabled ? 'Reactivar' : 'Inhabilitar'} onClick={() => handleToggleActive(s)}>
                            {isDisabled ? '↻' : '🚫'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  /* ── INLINE MODE ── */
  if (inline) {
    return (
      <div className="settings-section-card" style={{ overflow: 'visible' }}>
        {content}
      </div>
    );
  }

  /* ── MODAL MODE (legacy) ── */
  return (
    <>
      <style>{`#salonesBackdrop{display:none;}`}</style>
      <div className="modalBackdrop" id="salonesBackdrop" hidden onClick={(e) => { if (salonesModalRef.current && !salonesModalRef.current.contains(e.target)) handleClose(); }}>
        <div ref={salonesModalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="salonesTitle">
          <div className="modalHeader">
            <div>
              <div className="modalTitle" id="salonesTitle">Salones</div>
              <div className="modalSubtitle">Agrega, edita e inhabilita salones</div>
            </div>
            <button className="btn-exit" type="button" title="Cerrar" onClick={handleClose}>
              <svg className="crm-icon-x" viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l10 10M14 4l-10 10" /></svg>
            </button>
          </div>
          <div className="modalBody">
            {content}
          </div>
          <div className="modalFooter">
            <div className="leftActions">
              <button className="settings-danger-btn" type="button" disabled={!selectedSalon} onClick={handleDisableBtn}>
                {selectedSalon && disabledSalones.includes(selectedSalon) ? 'Reactivar' : 'Inhabilitar'}
              </button>
            </div>
            <div className="rightActions">
              <button className="settings-cancel-btn" type="button" onClick={resetForm}>Nuevo salon</button>
              <button className="settings-primary-btn" type="button" disabled={saving} onClick={handleSave}>
                {saving ? 'Guardando...' : 'Guardar salon'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
