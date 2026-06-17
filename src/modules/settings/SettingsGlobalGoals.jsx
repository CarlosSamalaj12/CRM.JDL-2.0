import React, { useState, useEffect, useRef } from 'react';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';
import { toast, modernConfirm } from '../../utils/toast';

export default function SettingsGlobalGoals() {
  const backdropRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [goals, setGoals] = useState([]);
  const [goalMonth, setGoalMonth] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen]);

  const loadData = async () => {
    try {
      const state = await loadCrmState();
      setGoals(Array.isArray(state.globalGoals) ? state.globalGoals : []);
    } catch (err) {
      console.error('Error al cargar metas:', err);
      toast('Error al cargar metas');
    }
  };

  const handleClose = () => {
    if (backdropRef.current) {
      backdropRef.current.hidden = true;
      setIsOpen(false);
    }
  };

  const resetForm = () => {
    setGoalMonth('');
    setGoalAmount('');
  };

  const handleAddGoal = () => {
    if (!goalMonth || !goalAmount) {
      toast('Selecciona un mes y escribe el monto de la meta.');
      return;
    }
    if (goals.some(g => g.month === goalMonth)) {
      toast('Ya existe una meta para este mes.');
      return;
    }
    setGoals(prev => [
      ...prev,
      { month: goalMonth, amount: parseFloat(goalAmount) }
    ].sort((a, b) => b.month.localeCompare(a.month)));
    resetForm();
  };

  const handleRemoveGoal = async (monthToRemove) => {
    const confirmed = await modernConfirm({
      title: 'Eliminar Meta',
      message: `¿Eliminar la meta del mes ${monthToRemove}?`
    });
    if (!confirmed) return;
    setGoals(prev => prev.filter(g => g.month !== monthToRemove));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const currentState = await loadCrmState();
      await saveCrmState({ ...currentState, globalGoals: goals });
      toast('Metas guardadas');
      window.dispatchEvent(new Event('stateUpdated'));
      handleClose();
    } catch (err) {
      console.error('Error al guardar metas:', err);
      toast('Error al guardar metas');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modalBackdrop"
      id="globalGoalsBackdrop"
      ref={backdropRef}
      hidden
      onClick={(e) => { if (e.target.id === 'globalGoalsBackdrop') handleClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="globalGoalsTitle">
        <div className="modalHeader">
          <div>
            <div className="modalTitle" id="globalGoalsTitle">Metas Globales de Ventas</div>
            <div className="modalSubtitle">Establece los objetivos de facturación mensual para la organización</div>
          </div>
          <button className="btn-exit" type="button" title="Cerrar" onClick={handleClose}>
            <svg className="crm-icon-x" viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l10 10M14 4l-10 10" /></svg>
          </button>
        </div>

        <div className="modalBody">
          {/* Input row */}
          <div className="settings-field-group">
            <label className="settings-modern-field">
              <span>Mes / Año</span>
              <input
                id="goalMonth"
                type="month"
                value={goalMonth}
                onChange={(e) => setGoalMonth(e.target.value)}
              />
            </label>
            <label className="settings-modern-field">
              <span>Monto de la Meta (Q.)</span>
              <input
                id="goalAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej: 500000"
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
              />
            </label>
          </div>

          <div className="rightActions" style={{ marginBottom: '16px' }}>
            <button className="settings-accent-btn" type="button" onClick={handleAddGoal}>
              Agregar Meta
            </button>
            <button className="settings-cancel-btn" type="button" onClick={resetForm}>
              Limpiar
            </button>
          </div>

          {/* Goals table */}
          <div className="settings-modern-field">
            <span>Metas registradas</span>
            <div className="settings-table-wrap" style={{ maxHeight: '300px' }}>
              <table className="settings-table" style={{ minWidth: '400px' }}>
                <thead>
                  <tr>
                    <th>Mes / Año</th>
                    <th>Monto</th>
                    <th className="settings-td-center"></th>
                  </tr>
                </thead>
                <tbody id="globalGoalsBody">
                  {goals.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="settings-td-center settings-empty-row">
                        No hay metas registradas. Agrega una nueva usando el formulario de arriba.
                      </td>
                    </tr>
                  ) : (
                    goals.map(g => (
                      <tr key={g.month}>
                        <td style={{ fontWeight: '600' }}>{g.month}</td>
                        <td style={{ fontWeight: '700', color: '#059669' }}>
                          Q {parseFloat(g.amount).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="settings-td-center">
                          <div className="settings-table-actions">
                            <button
                              type="button"
                              className="danger"
                              title="Eliminar meta"
                              onClick={() => handleRemoveGoal(g.month)}
                            >✕</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="modalFooter">
          <div></div>
          <div className="rightActions">
            <button className="btn-exit" type="button" onClick={handleClose}>
              Cancelar
            </button>
            <button className="settings-primary-btn" type="button" disabled={saving} onClick={handleSaveAll}>
              {saving ? 'Guardando...' : 'Guardar Metas'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
