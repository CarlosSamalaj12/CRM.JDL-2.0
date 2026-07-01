import React, { useState, useEffect, useRef } from 'react';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';
import { toast } from '../../utils/toast';

export default function SettingsTipoCambio({ inline, onBack }) {
  const tipoCambioModalRef = useRef(null);
  const [exchangeRate, setExchangeRate] = useState('7.75');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const state = await loadCrmState();
      const rate = Number(state.exchangeRate || 7.75);
      setExchangeRate(Number.isFinite(rate) && rate > 0 ? String(rate) : '7.75');
    } catch (err) {
      console.error('Error al cargar tipo de cambio:', err);
    }
  };

  const handleSave = async () => {
    const cleanVal = exchangeRate.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleanVal);
    if (!num || num <= 0 || !Number.isFinite(num)) {
      toast('Ingresa un valor numérico válido mayor a 0.');
      return;
    }
    setSaving(true);
    try {
      const currentState = await loadCrmState();
      await saveCrmState({ ...currentState, exchangeRate: num });
      toast('Tipo de cambio guardado ✓');
      window.dispatchEvent(new Event('stateUpdated'));
    } catch (err) {
      console.error('Error al guardar tipo de cambio:', err);
      toast('Error al guardar el tipo de cambio.');
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>💱 Tipo de Cambio USD → GTQ</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Define el tipo de cambio para convertir cotizaciones en Dólares a Quetzales en reportes y métricas
          </div>
        </div>
      </div>

      <div className="settings-field-group">
        <label className="settings-modern-field">
          <span>Tipo de Cambio (1 USD = ? GTQ)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>$ 1 USD =</span>
            <input
              type="text"
              placeholder="Ej: 7.75"
              value={exchangeRate}
              onChange={e => setExchangeRate(e.target.value)}
              style={{
                width: '140px', padding: '8px 12px', borderRadius: '8px',
                border: '1px solid #cbd5e1', fontSize: '16px', fontWeight: 700,
                textAlign: 'center', color: '#0f172a', background: '#fff',
              }}
            />
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#059669' }}>Q GTQ</span>
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
            Este valor se usará al guardar cotizaciones en USD para calcular el equivalente en Quetzales.
          </div>
        </label>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          className="settings-accent-btn"
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving ? '💾 Guardando...' : '💾 Guardar Tipo de Cambio'}
        </button>
      </div>

      <div style={{
        marginTop: '16px', padding: '12px 16px', background: '#f0fdf4',
        borderRadius: '10px', border: '1px solid #bbf7d0', fontSize: '11px', color: '#166534', lineHeight: 1.6
      }}>
        <strong>📌 ¿Cómo funciona?</strong><br />
        Cuando creas una cotización en <strong>Dólares (USD)</strong>, el sistema usará este tipo de cambio para calcular
        automáticamente el valor equivalente en <strong>Quetzales (GTQ)</strong> y lo almacenará para que
        los reportes, metas y métricas reflejen los montos correctos en moneda local.
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
    <div className="modalBackdrop" id="tipoCambioBackdrop" hidden onClick={(e) => { if (tipoCambioModalRef.current && !tipoCambioModalRef.current.contains(e.target)) onBack?.(); }}>
      <div ref={tipoCambioModalRef} className="modal" role="dialog" aria-modal="true">
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Tipo de Cambio USD → GTQ</div>
            <div className="modalSubtitle">Configura la tasa de conversión para cotizaciones en dólares</div>
          </div>
          <button className="btn-exit" type="button" title="Cerrar" onClick={onBack}>
            <svg className="crm-icon-x" viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l10 10M14 4l-10 10" /></svg>
          </button>
        </div>
        <div className="modalBody">{content}</div>
        <div className="modalFooter">
          <div></div>
          <div className="rightActions">
            <button className="btn-exit" type="button" onClick={onBack}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
