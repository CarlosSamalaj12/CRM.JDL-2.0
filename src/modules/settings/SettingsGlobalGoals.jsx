import React, { useState, useEffect, useRef } from 'react';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';
import { toast, modernConfirm } from '../../utils/toast';

export default function SettingsGlobalGoals({ inline, onBack }) {
  const globalGoalsModalRef = useRef(null);
  const [goals, setGoals] = useState([]);
  const [goalMonth, setGoalMonth] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [editingMonth, setEditingMonth] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const state = await loadCrmState();
      setGoals(Array.isArray(state.globalMonthlyGoals) ? state.globalMonthlyGoals : []);
    } catch (err) {
      console.error('Error al cargar metas:', err);
      toast('Error al cargar metas');
    }
  };

  const handleClose = () => {
    if (onBack) onBack();
  };

  const formatNumberWithCommas = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const cleanVal = String(value).replace(/[^0-9.]/g, '');
    const parts = cleanVal.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (parts[1]) {
      parts[1] = parts[1].slice(0, 2);
    }
    return parts.join('.');
  };

  const resetForm = () => {
    setGoalMonth('');
    setGoalAmount('');
    setEditingMonth('');
  };

  const persistGoals = async (updatedGoals) => {
    try {
      const currentState = await loadCrmState();
      await saveCrmState({ ...currentState, globalMonthlyGoals: updatedGoals });
    } catch (err) {
      console.error('Error al persistir metas:', err);
      toast('Error al guardar la meta');
    }
  };

  const handleAddGoal = async () => {
    if (!goalMonth || !goalAmount) {
      toast('Selecciona un mes y escribe el monto de la meta.');
      return;
    }
    const cleanAmount = parseFloat(String(goalAmount).replace(/,/g, ''));
    if (isNaN(cleanAmount) || cleanAmount < 0) {
      toast('Escribe un monto válido.');
      return;
    }

    let updatedGoals;
    if (editingMonth) {
      if (editingMonth !== goalMonth && goals.some(g => g.month === goalMonth)) {
        toast('Ya existe una meta para este mes.');
        return;
      }
      updatedGoals = goals.map(g => g.month === editingMonth ? { month: goalMonth, amount: cleanAmount } : g);
      setEditingMonth('');
    } else {
      if (goals.some(g => g.month === goalMonth)) {
        toast('Ya existe una meta para este mes.');
        return;
      }
      updatedGoals = [
        ...goals,
        { month: goalMonth, amount: cleanAmount }
      ];
    }

    updatedGoals.sort((a, b) => b.month.localeCompare(a.month));
    setGoals(updatedGoals);
    resetForm();
    await persistGoals(updatedGoals);
    window.dispatchEvent(new Event('stateUpdated'));
    toast(editingMonth ? 'Meta actualizada y guardada ✓' : 'Meta agregada y guardada ✓');
  };

  const handleRemoveGoal = async (monthToRemove) => {
    const confirmed = await modernConfirm({
      title: 'Eliminar Meta',
      message: `¿Eliminar la meta del mes ${monthToRemove}?`
    });
    if (!confirmed) return;
    const updatedGoals = goals.filter(g => g.month !== monthToRemove);
    setGoals(updatedGoals);
    await persistGoals(updatedGoals);
    window.dispatchEvent(new Event('stateUpdated'));
    toast('Meta eliminada ✓');
  };

  const handleAmountChange = (e) => {
    const val = e.target.value;
    const clean = val.replace(/[^0-9.,]/g, '');
    setGoalAmount(formatNumberWithCommas(clean));
  };

  const handleEditGoal = (g) => {
    setEditingMonth(g.month);
    setGoalMonth(g.month);
    setGoalAmount(formatNumberWithCommas(g.amount));
  };

  const content = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>🎯 Metas Globales de Ventas</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Establece los objetivos de facturación mensual para la organización</div>
        </div>
      </div>

      {/* Input row */}
      <div className="settings-field-group">
        <label className="settings-modern-field">
          <span>Mes / Año</span>
          <input type="month" value={goalMonth} onChange={(e) => setGoalMonth(e.target.value)} disabled={!!editingMonth} />
        </label>
        <label className="settings-modern-field">
          <span>Monto de la Meta (Q.)</span>
          <input type="text" placeholder="Ej: 500,000" value={goalAmount} onChange={handleAmountChange} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <button className="settings-accent-btn" type="button" onClick={handleAddGoal}>
          {editingMonth ? '✏️ Actualizar Meta' : '➕ Agregar Meta'}
        </button>
        <button className="settings-cancel-btn" type="button" onClick={resetForm}>Limpiar</button>
      </div>

      {/* Goals table */}
      <div className="settings-modern-field">
        <span>Metas registradas</span>
        <div className="settings-table-wrap" style={{ maxHeight: '260px' }}>
          <table className="settings-table" style={{ minWidth: '400px' }}>
            <thead>
              <tr>
                <th>Mes / Año</th>
                <th>Monto</th>
                <th className="settings-td-center" style={{ width: '80px' }}></th>
              </tr>
            </thead>
            <tbody>
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
                      <div className="settings-table-actions" style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'inline-flex', alignItems: 'center' }} title="Editar meta" onClick={() => handleEditGoal(g)}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#0ea5e9' }}>edit</span>
                        </button>
                        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'inline-flex', alignItems: 'center' }} title="Eliminar meta" onClick={() => handleRemoveGoal(g.month)}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ef4444' }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  if (inline) {
    return (
      <div className="settings-section-card" style={{ overflow: 'visible' }}>
        {content}
      </div>
    );
  }

  return (
    <div className="modalBackdrop" id="globalGoalsBackdrop" hidden onClick={(e) => { if (globalGoalsModalRef.current && !globalGoalsModalRef.current.contains(e.target)) handleClose(); }}>
      <div ref={globalGoalsModalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="globalGoalsTitle">
        <div className="modalHeader">
          <div>
            <div className="modalTitle" id="globalGoalsTitle">Metas Globales de Ventas</div>
            <div className="modalSubtitle">Establece los objetivos de facturación mensual para la organización</div>
          </div>
          <button className="btn-exit" type="button" title="Cerrar" onClick={handleClose}>
            <svg className="crm-icon-x" viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l10 10M14 4l-10 10" /></svg>
          </button>
        </div>
        <div className="modalBody">{content}</div>
        <div className="modalFooter">
          <div></div>
          <div className="rightActions">
            <button className="btn-exit" type="button" onClick={handleClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
