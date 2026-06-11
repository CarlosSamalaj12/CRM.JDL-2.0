import React, { useState, useEffect, useRef } from 'react';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';
import { toast, modernConfirm } from '../../utils/toast';

export default function SettingsSalones() {
  const backdropRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [salones, setSalones] = useState([]);
  const [disabledSalones, setDisabledSalones] = useState([]);
  const [salonCapacities, setSalonCapacities] = useState({});
  
  // Form State
  const [selectedSalon, setSelectedSalon] = useState(''); // Empty string for "Crear nuevo salon"
  const [salonNameInput, setSalonNameInput] = useState('');
  const [salonCapacityInput, setSalonCapacityInput] = useState('');
  const [salonActive, setSalonActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Monitor hidden attribute to check if modal is open
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (backdropRef.current) {
        setIsOpen(!backdropRef.current.hidden);
      }
    });

    if (backdropRef.current) {
      observer.observe(backdropRef.current, { attributes: true, attributeFilter: ['hidden'] });
      setIsOpen(!backdropRef.current.hidden);
    }

    return () => observer.disconnect();
  }, []);

  // Fetch state on modal open
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const state = await loadCrmState();
      
      const loadedSalones = Array.isArray(state.salones) ? state.salones : [];
      const loadedDisabled = Array.isArray(state.disabledSalones) ? state.disabledSalones : [];
      const loadedCapacities = (state.salonCapacities && typeof state.salonCapacities === 'object') ? state.salonCapacities : {};
      
      setSalones(loadedSalones);
      setDisabledSalones(loadedDisabled);
      setSalonCapacities(loadedCapacities);
      
      resetForm();
    } catch (err) {
      console.error('Error al cargar salones:', err);
      toast('Error al cargar salones');
    }
  };

  const handleClose = () => {
    if (backdropRef.current) {
      backdropRef.current.hidden = true;
      setIsOpen(false);
    }
  };

  const resetForm = () => {
    setSelectedSalon('');
    setSalonNameInput('');
    setSalonCapacityInput('');
    setSalonActive(true);
  };

  const handleSalonSelectChange = (e) => {
    const name = e.target.value;
    setSelectedSalon(name);
    if (name) {
      setSalonNameInput(name);
      setSalonCapacityInput(salonCapacities[name] || '');
      setSalonActive(!disabledSalones.includes(name));
    } else {
      resetForm();
    }
  };

  const loadSalonForEdit = (name) => {
    setSelectedSalon(name);
    setSalonNameInput(name);
    setSalonCapacityInput(salonCapacities[name] || '');
    setSalonActive(!disabledSalones.includes(name));
  };

  const handleSave = async () => {
    const nameTrimmed = salonNameInput.trim();
    if (!nameTrimmed) {
      toast('Nombre del salon es requerido');
      return;
    }

    const capacityNum = parseInt(salonCapacityInput, 10);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      toast('Capacidad maxima PAX debe ser mayor a 0');
      return;
    }

    // Check duplicate name
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

      if (isNew) {
        nextSalones.push(nameTrimmed);
      } else {
        nextSalones = nextSalones.map(s => s === selectedSalon ? nameTrimmed : s);
        // Rename key in capacities
        if (selectedSalon !== nameTrimmed) {
          nextCapacities[nameTrimmed] = nextCapacities[selectedSalon];
          delete nextCapacities[selectedSalon];
          
          // Rename in disabled list
          nextDisabledSalones = nextDisabledSalones.map(s => s === selectedSalon ? nameTrimmed : s);
        }
      }

      // Set capacity
      nextCapacities[nameTrimmed] = capacityNum;

      // Handle active switch
      if (salonActive) {
        nextDisabledSalones = nextDisabledSalones.filter(s => s !== nameTrimmed);
      } else {
        if (!nextDisabledSalones.includes(nameTrimmed)) {
          nextDisabledSalones.push(nameTrimmed);
        }
      }

      // Sort salones alphabetically
      nextSalones.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

      // Persist to server
      const currentState = await loadCrmState();
      await saveCrmState({
        ...currentState,
        salones: nextSalones,
        disabledSalones: nextDisabledSalones,
        salonCapacities: nextCapacities
      });

      setSalones(nextSalones);
      setDisabledSalones(nextDisabledSalones);
      setSalonCapacities(nextCapacities);
      
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
      message: `¿Desea ${confirmText} el salón "${name}"?`,
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
      
      // Update form fields if editing this salon
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

  return (
    <div 
      className="modalBackdrop" 
      id="salonesBackdrop" 
      ref={backdropRef}
      hidden 
      onClick={(e) => { if (e.target.id === 'salonesBackdrop') handleClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="salonesTitle">
        <div className="modalHeader">
          <div>
            <div className="modalTitle" id="salonesTitle">Salones</div>
            <div className="modalSubtitle">Agrega, edita e inhabilita salones</div>
          </div>
          <button 
            className="iconBtn" 
            id="btnSalonesClose" 
            type="button" 
            title="Cerrar" 
            onClick={handleClose}
          >
            &#10005;
          </button>
        </div>

        <div className="modalBody" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="row2" style={{ display: 'flex', gap: '16px' }}>
            <label className="field" style={{ flex: 1 }}>
              <span>Salon existente</span>
              <select 
                id="salonEditSelect" 
                value={selectedSalon} 
                onChange={handleSalonSelectChange}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="">-- Crear nuevo salon --</option>
                {salones.map(s => (
                  <option key={s} value={s}>
                    {s} {disabledSalones.includes(s) ? '(Inhabilitado)' : '(Activo)'}
                  </option>
                ))}
              </select>
            </label>
            
            <div className="field" style={{ width: '160px' }}>
              <span>Estado</span>
              <label 
                className="statusSwitchInline" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  marginTop: '8px', 
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  color: salonActive ? '#16a34a' : '#dc2626'
                }}
              >
                <input 
                  id="salonActive" 
                  type="checkbox" 
                  checked={salonActive} 
                  onChange={(e) => setSalonActive(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span>{salonActive ? 'Salon activo' : 'Salon inactivo'}</span>
              </label>
            </div>
          </div>

          <div className="row2" style={{ display: 'flex', gap: '16px' }}>
            <label className="field" style={{ flex: 2 }}>
              <span>Nombre del salon</span>
              <input 
                id="salonNameInput" 
                type="text" 
                placeholder="Ej: Salon Aurora" 
                value={salonNameInput}
                onChange={(e) => setSalonNameInput(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </label>

            <label className="field" style={{ flex: 1 }}>
              <span>Capacidad PAX *</span>
              <input 
                id="salonCapacityInput" 
                type="number" 
                placeholder="Ej: 500" 
                value={salonCapacityInput}
                onChange={(e) => setSalonCapacityInput(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </label>
          </div>

          <div className="field">
            <span>Salones registrados</span>
            <div className="quoteTableWrap" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', marginTop: '6px' }}>
              <table className="quoteTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid #cbd5e1' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Nombre</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Capacidad</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Estado</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#475569' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody id="salonesBody">
                  {salones.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                        No hay salones registrados
                      </td>
                    </tr>
                  ) : (
                    salones.map(s => {
                      const isDisabled = disabledSalones.includes(s);
                      const capacity = salonCapacities[s] || '2000 (Límite defecto)';
                      return (
                        <tr key={s} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a' }}>{s}</td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>{capacity} PAX</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              fontSize: '11px', 
                              fontWeight: '700',
                              background: isDisabled ? '#fee2e2' : '#dcfce7',
                              color: isDisabled ? '#991b1b' : '#15803d'
                            }}>
                              {isDisabled ? 'Inhabilitado' : 'Activo'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button 
                                type="button" 
                                title="Editar" 
                                onClick={() => loadSalonForEdit(s)}
                                style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                ✎
                              </button>
                              <button 
                                type="button" 
                                title={isDisabled ? 'Reactivar' : 'Inhabilitar'} 
                                onClick={() => handleToggleActive(s)}
                                style={{ 
                                  background: isDisabled ? '#f0fdf4' : '#fff1f2', 
                                  border: '1px solid', 
                                  borderColor: isDisabled ? '#bbf7d0' : '#fecdd3', 
                                  color: isDisabled ? '#16a34a' : '#e11d48', 
                                  padding: '4px 8px', 
                                  borderRadius: '4px', 
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
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
        </div>

        <div className="modalFooter" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
          <div className="leftActions">
            <button 
              className="btn-cancelar" 
              id="btnSalonDisable" 
              type="button" 
              disabled={!selectedSalon}
              onClick={handleDisableBtn}
              style={{
                opacity: selectedSalon ? 1 : 0.5,
                cursor: selectedSalon ? 'pointer' : 'not-allowed'
              }}
            >
              {selectedSalon && disabledSalones.includes(selectedSalon) ? 'Reactivar' : 'Inhabilitar'}
            </button>
          </div>
          <div className="rightActions" style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn-cancel" 
              id="btnSalonReset" 
              type="button" 
              onClick={resetForm}
              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
            >
              Nuevo salon
            </button>
            <button 
              className="btn-teal" 
              id="btnSalonSave" 
              type="button" 
              disabled={saving}
              onClick={handleSave}
              style={{ background: '#005954', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {saving ? 'Guardando...' : 'Guardar salon'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
