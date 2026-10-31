import React, { useState, useEffect } from 'react';
import { loadState as loadCrmState, saveSettingApi } from '../../services/stateService';
import { toast, modernConfirm } from '../../utils/toast';

export default function SettingsMantenimiento({ onStatusChange }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [startsAt, setStartsAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  // Sincronización en tiempo real de cambios de estado de mantenimiento
  useEffect(() => {
    const handleStatus = (e) => {
      if (e?.detail?.maintenanceMode !== undefined) {
        setMaintenanceMode(Boolean(e.detail.maintenanceMode));
        setStartsAt(e.detail.startsAt ? Number(e.detail.startsAt) : null);
      }
    };
    window.addEventListener('maintenanceStatusChanged', handleStatus);
    return () => window.removeEventListener('maintenanceStatusChanged', handleStatus);
  }, []);

  // Reloj de cuenta regresiva en vivo si está en período de gracia de 30 segundos
  useEffect(() => {
    if (!maintenanceMode || !startsAt) {
      setSecondsRemaining(0);
      return;
    }
    const update = () => {
      const left = Math.max(0, Math.ceil((startsAt - Date.now()) / 1000));
      setSecondsRemaining(left);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [maintenanceMode, startsAt]);

  const loadData = async () => {
    try {
      const res = await fetch('/api/maintenance-status').then(r => r.json()).catch(() => ({}));
      setMaintenanceMode(res.maintenanceMode === true);
      setStartsAt(res.startsAt ? Number(res.startsAt) : null);
    } catch (err) {
      console.error('Error al cargar estado de mantenimiento:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    const newValue = !maintenanceMode;

    if (newValue) {
      const confirmed = await modernConfirm({
        title: 'Iniciar modo mantenimiento con aviso',
        message: 'Se iniciará un conteo regresivo de 30 segundos visible para todos los usuarios conectados. Esto les dará tiempo de guardar cualquier cambio pendiente antes de bloquear el sistema.\n\n¿Desea iniciar el mantenimiento?',
        confirmText: 'Sí, iniciar conteo (30s)',
        cancelText: 'Cancelar'
      });
      if (!confirmed) return;

      setSaving(true);
      try {
        const startsAtVal = Date.now() + 30000;
        await saveSettingApi('maintenanceMode', { enabled: true, immediate: false, duration: 30 });
        setMaintenanceMode(true);
        setStartsAt(startsAtVal);
        onStatusChange?.(true);
        window.dispatchEvent(new CustomEvent('maintenanceStatusChanged', {
          detail: { maintenanceMode: true, startsAt: startsAtVal, duration: 30 }
        }));
        try {
          localStorage.setItem('crm_maintenance_sync', JSON.stringify({
            maintenanceMode: true,
            startsAt: startsAtVal,
            t: Date.now()
          }));
        } catch (_) {}
        toast('Modo mantenimiento activado — Conteo regresivo de 30s iniciado.');
      } catch (err) {
        console.error('Error al activar modo mantenimiento:', err);
        toast('Error al activar el modo mantenimiento');
      } finally {
        setSaving(false);
      }
    } else {
      setSaving(true);
      try {
        await saveSettingApi('maintenanceMode', false);
        setMaintenanceMode(false);
        setStartsAt(null);
        setSecondsRemaining(0);
        onStatusChange?.(false);
        window.dispatchEvent(new CustomEvent('maintenanceStatusChanged', {
          detail: { maintenanceMode: false, startsAt: null }
        }));
        try {
          localStorage.setItem('crm_maintenance_sync', JSON.stringify({
            maintenanceMode: false,
            startsAt: null,
            t: Date.now()
          }));
        } catch (_) {}
        toast('Modo mantenimiento desactivado ✓');
      } catch (err) {
        console.error('Error al desactivar modo mantenimiento:', err);
        toast('Error al desactivar el modo mantenimiento');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleImmediateLock = async () => {
    const confirmed = await modernConfirm({
      title: 'Forzar bloqueo inmediato',
      message: '¿Está seguro de forzar el bloqueo inmediato sin esperar los segundos restantes? Los usuarios serán redirigidos de inmediato a la pantalla de mantenimiento.',
      confirmText: 'Sí, bloquear ya',
      cancelText: 'Esperar conteo'
    });
    if (!confirmed) return;

    setSaving(true);
    try {
      const startsAtVal = Date.now();
      await saveSettingApi('maintenanceMode', { enabled: true, immediate: true });
      setStartsAt(startsAtVal);
      setSecondsRemaining(0);
      window.dispatchEvent(new CustomEvent('maintenanceStatusChanged', {
        detail: { maintenanceMode: true, startsAt: startsAtVal, immediate: true }
      }));
      try {
        localStorage.setItem('crm_maintenance_sync', JSON.stringify({
          maintenanceMode: true,
          startsAt: startsAtVal,
          t: Date.now()
        }));
      } catch (_) {}
      toast('Bloqueo inmediato ejecutado.');
    } catch (err) {
      console.error(err);
      toast('Error al ejecutar bloqueo');
    } finally {
      setSaving(false);
    }
  };

  const isCountingDown = maintenanceMode && secondsRemaining > 0;

  return (
    <div
      className="settings-section-card"
      style={{
        border: maintenanceMode ? (isCountingDown ? '2px solid #ea580c' : '2px solid #ef4444') : '2px solid transparent',
        transition: 'border-color 0.3s'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>🔧 Modo Mantenimiento</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Activa una pantalla de mantenimiento para todos los usuarios con conteo de cortesía de 30s
          </div>
        </div>
        <label className="settings-switch-inline" style={{ gap: '8px' }}>
          <input
            type="checkbox"
            checked={maintenanceMode}
            onChange={handleToggle}
            disabled={saving || loading}
          />
          <span style={{
            fontSize: '13px', fontWeight: 700,
            color: maintenanceMode ? (isCountingDown ? '#ea580c' : '#ef4444') : '#22c55e'
          }}>
            {loading ? 'Cargando...' : (isCountingDown ? `⏳ En cuenta regresiva (${secondsRemaining}s)` : (maintenanceMode ? '🛑 Bloqueo Activo' : '✅ Inactivo'))}
          </span>
        </label>
      </div>

      <div style={{
        padding: '12px 16px',
        background: maintenanceMode ? (isCountingDown ? '#fff7ed' : '#fef2f2') : '#f8fafc',
        borderRadius: '10px',
        border: `1px solid ${maintenanceMode ? (isCountingDown ? '#ffedd5' : '#fecaca') : '#e2e8f0'}`,
        fontSize: '11px',
        color: maintenanceMode ? (isCountingDown ? '#9a3412' : '#991b1b') : '#64748b',
        lineHeight: 1.6
      }}>
        {isCountingDown ? (
          <div>
            <strong>⏳ Conteo regresivo activo ({secondsRemaining}s restantes):</strong> Los usuarios están viendo una barra superior de advertencia para guardar sus datos antes de ser redirigidos.
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleImmediateLock}
                disabled={saving}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
                }}
              >
                ⚡ Forzar Bloqueo Inmediato
              </button>
              <button
                type="button"
                onClick={handleToggle}
                disabled={saving}
                style={{
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ✕ Cancelar Mantenimiento
              </button>
            </div>
          </div>
        ) : maintenanceMode ? (
          <strong>🛑 El sistema está bloqueado en mantenimiento. Los usuarios ven la pantalla de mantenimiento y no pueden usar el sistema. Solo administradores tienen acceso.</strong>
        ) : (
          'Al activar esta opción, se emitirá una alerta inmediata con 30 segundos de cortesía para que los usuarios guarden su trabajo antes del bloqueo total.'
        )}
      </div>
    </div>
  );
}
