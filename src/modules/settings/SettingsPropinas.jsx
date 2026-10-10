import React, { useState, useEffect } from 'react';
import { Percent, Check, Sparkles, Info, Save } from 'lucide-react';
import { getTipConfigApi, saveTipConfigApi } from '../../services/stateService';
import { toast } from '../../utils/toast';

export default function SettingsPropinas({ inline, onBack }) {
  const [defaultPercent, setDefaultPercent] = useState(10);
  const [enabled, setEnabled] = useState(true);
  const [note, setNote] = useState('Propina sugerida para el personal de servicio');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const config = await getTipConfigApi();
      if (config) {
        setDefaultPercent(Number(config.defaultPercent ?? 10));
        setEnabled(config.enabled !== false);
        setNote(String(config.note || 'Propina sugerida para el personal de servicio'));
      }
    } catch (err) {
      console.error('Error al cargar la configuración de propinas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await saveTipConfigApi({
        defaultPercent: Number(defaultPercent),
        enabled: Boolean(enabled),
        note: String(note).trim()
      });
      toast.success('Política de propinas guardada correctamente ✓');
    } catch (err) {
      console.error('Error al guardar configuración de propinas:', err);
      toast.error('Error al guardar la configuración de propinas.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        padding: '24px 28px',
        boxShadow: '0 4px 20px -2px rgba(15,23,42,0.06)'
      }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, paddingBottom: 18, borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(2,132,199,0.15)'
            }}>
              <Percent size={22} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Política y Porcentaje de Propinas
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Establece los parámetros sugeridos de propinas para el personal de servicio en cotizaciones y contratos
              </div>
            </div>
          </div>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: 999,
            background: enabled ? '#ecfdf5' : '#f1f5f9',
            color: enabled ? '#059669' : '#64748b',
            border: `1px solid ${enabled ? '#a7f3d0' : '#e2e8f0'}`
          }}>
            {enabled ? 'Habilitado' : 'Desactivado'}
          </span>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 22 }}>
          {/* Activar sugerencia */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            background: '#f8fafc',
            borderRadius: 12,
            border: '1px solid #e2e8f0'
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                Habilitar sugerencia de propinas
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                Muestra el botón de aplicación rápida en la cotización para agregar el porcentaje sugerido con un solo clic
              </div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: enabled ? '#0284c7' : '#cbd5e1',
                borderRadius: 24,
                transition: '0.2s'
              }}>
                <span style={{
                  position: 'absolute',
                  content: '',
                  height: 18,
                  width: 18,
                  left: enabled ? 22 : 3,
                  bottom: 3,
                  backgroundColor: '#ffffff',
                  borderRadius: '50%',
                  transition: '0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </span>
            </label>
          </div>

          {/* Porcentaje sugerido */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: '#334155', display: 'block', marginBottom: 6 }}>
              Porcentaje sugerido por defecto (%)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', width: 140 }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={defaultPercent}
                  onChange={e => setDefaultPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  style={{
                    width: '100%',
                    height: 42,
                    padding: '0 30px 0 14px',
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#0f172a',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: 8,
                    outline: 'none',
                    background: '#ffffff'
                  }}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#64748b' }}>
                  %
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[5, 10, 15].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setDefaultPercent(pct)}
                    style={{
                      height: 40,
                      padding: '0 14px',
                      fontSize: 12,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: defaultPercent === pct ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                      background: defaultPercent === pct ? '#e0f2fe' : '#f8fafc',
                      color: defaultPercent === pct ? '#0284c7' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Info size={13} color="#0284c7" />
              <span>Este porcentaje se cargará como valor recomendado cuando el asesor presione el botón sugerido en la cotización.</span>
            </div>
          </div>

          {/* Nota descriptiva */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: '#334155', display: 'block', marginBottom: 6 }}>
              Observación o Nota para Contratos
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ej. Propina sugerida para el personal de servicio"
              style={{
                width: '100%',
                height: 42,
                padding: '0 14px',
                fontSize: 13,
                fontWeight: 600,
                color: '#0f172a',
                border: '1.5px solid #cbd5e1',
                borderRadius: 8,
                outline: 'none',
                background: '#ffffff'
              }}
            />
          </div>

          {/* Caja explicativa sobre reportería */}
          <div style={{
            display: 'flex',
            gap: 12,
            padding: '14px 16px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 12
          }}>
            <Sparkles size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 11.5, color: '#166534', lineHeight: 1.5 }}>
              <strong>Control Financiero de Empleados:</strong> Las propinas recaudadas se desglosan en la cotización formal y contrato del cliente, pero se excluyen contablemente de las metas y ventas de la empresa para ser destinadas directamente a los colaboradores.
            </div>
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            {inline && onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  height: 42,
                  padding: '0 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#475569',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              style={{
                height: 42,
                padding: '0 24px',
                fontSize: 13,
                fontWeight: 800,
                color: '#ffffff',
                background: saving ? '#94a3b8' : '#0284c7',
                border: 'none',
                borderRadius: 8,
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 2px 8px rgba(2,132,199,0.25)'
              }}
            >
              <Save size={16} />
              <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
