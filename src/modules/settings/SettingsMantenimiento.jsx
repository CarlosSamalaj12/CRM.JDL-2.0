import React, { useState, useEffect } from 'react';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';
import { toast, modernConfirm } from '../../utils/toast';

export default function SettingsMantenimiento({ onStatusChange }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const state = await loadCrmState();
      setMaintenanceMode(state.maintenanceMode === true);
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
        title: 'Activar modo mantenimiento',
        message: 'Al activar el modo mantenimiento, TODOS los usuarios serán redirigidos a una pantalla de mantenimiento y no podrán usar el sistema. Solo los administradores podrán acceder a la configuración para desactivarlo.\n\n¿Desea continuar?',
        confirmText: 'Sí, activar',
        cancelText: 'Cancelar'
      });
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      const currentState = await loadCrmState();
      await saveCrmState({ ...currentState, maintenanceMode: newValue });
      setMaintenanceMode(newValue);
      onStatusChange?.(newValue);
      toast(newValue ? 'Modo mantenimiento activado' : 'Modo mantenimiento desactivado');
      if (newValue) {
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (err) {
      console.error('Error al guardar modo mantenimiento:', err);
      toast('Error al guardar el modo mantenimiento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-section-card" style={{ border: maintenanceMode ? '2px solid #ef4444' : '2px solid transparent', transition: 'border-color 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>🔧 Modo Mantenimiento</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Activa una pantalla de mantenimiento para todos los usuarios del sistema
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
            color: maintenanceMode ? '#ef4444' : '#22c55e'
          }}>
            {loading ? 'Cargando...' : (maintenanceMode ? '🛑 Activo' : '✅ Inactivo')}
          </span>
        </label>
      </div>
      <div style={{
        padding: '12px 16px', background: maintenanceMode ? '#fef2f2' : '#f8fafc',
        borderRadius: '10px', border: `1px solid ${maintenanceMode ? '#fecaca' : '#e2e8f0'}`,
        fontSize: '11px', color: maintenanceMode ? '#991b1b' : '#64748b', lineHeight: 1.6
      }}>
        {maintenanceMode ? (
          <strong>⚠️ El sistema está en mantenimiento. Los usuarios verán una pantalla informativa y no podrán acceder a sus funciones.</strong>
        ) : (
          'Activa esta opción para mostrar una pantalla de mantenimiento a todos los usuarios. Útil durante actualizaciones o migraciones de datos.'
        )}
      </div>
    </div>
  );
}
