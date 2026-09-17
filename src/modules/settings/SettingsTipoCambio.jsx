import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeftRight,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Calendar,
  Save,
  Info,
  History,
  TrendingUp,
  Check,
  X,
} from 'lucide-react';
import {
  getExchangeRateApi,
  saveExchangeRateApi,
  getExchangeRateDataApi,
  addExchangeRateHistoryApi,
  updateExchangeRateHistoryApi,
  deleteExchangeRateHistoryApi,
  loadState as loadCrmState,
} from '../../services/stateService';
import { toast } from '../../utils/toast';

export default function SettingsTipoCambio({ inline, onBack }) {
  const tipoCambioModalRef = useRef(null);
  const [currentRate, setCurrentRate] = useState(7.75);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulario para nueva entrada o edición
  const [editingId, setEditingId] = useState(null);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formRate, setFormRate] = useState('7.75');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadData();

    const handleEntityChange = (e) => {
      if (e.detail?.entity === 'exchange_rate') {
        loadData();
      }
    };
    window.addEventListener('entity:changed', handleEntityChange);
    return () => window.removeEventListener('entity:changed', handleEntityChange);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getExchangeRateDataApi();
      setCurrentRate(Number(data.currentRate || 7.75));
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch (err) {
      console.error('Error al cargar datos de tipo de cambio:', err);
      try {
        const state = await loadCrmState();
        const fallbackRate = Number(state.exchangeRate || 7.75);
        setCurrentRate(fallbackRate);
        setHistory(Array.isArray(state.exchangeRateHistory) ? state.exchangeRateHistory : []);
      } catch (e) {
        console.error('Error en fallback de estado:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartAdd = () => {
    setEditingId(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormRate(String(currentRate || '7.75'));
    setFormNotes('');
    setShowAddForm(true);
  };

  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setFormDate(item.fecha_vigencia?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setFormRate(String(item.tasa || '7.75'));
    setFormNotes(item.notas || '');
    setShowAddForm(true);
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormNotes('');
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const cleanRate = String(formRate).replace(/[^0-9.]/g, '');
    const numRate = parseFloat(cleanRate);

    if (!numRate || numRate <= 0 || !Number.isFinite(numRate)) {
      toast('Ingresa una tasa de cambio válida mayor a 0.');
      return;
    }

    if (!formDate || !/^\d{4}-\d{2}-\d{2}$/.test(formDate)) {
      toast('Ingresa una fecha de vigencia válida (AAAA-MM-DD).');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateExchangeRateHistoryApi(editingId, {
          fechaVigencia: formDate,
          tasa: numRate,
          notas: formNotes.trim(),
        });
        toast('Registro histórico de tipo de cambio actualizado ✓');
      } else {
        await addExchangeRateHistoryApi({
          fechaVigencia: formDate,
          tasa: numRate,
          notas: formNotes.trim(),
        });
        toast('Nuevo tipo de cambio registrado exitosamente ✓');
      }
      setShowAddForm(false);
      setEditingId(null);
      await loadData();
    } catch (err) {
      console.error('Error al guardar tipo de cambio:', err);
      toast(err?.message || 'Error al guardar tipo de cambio.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (history.length <= 1) {
      toast('Debe existir al menos un tipo de cambio histórico en el sistema.');
      return;
    }
    const confirmDelete = window.confirm(
      `¿Deseas eliminar el tipo de cambio de Q ${Number(item.tasa).toFixed(4)} con vigencia desde ${item.fecha_vigencia?.slice(0, 10)}?`
    );
    if (!confirmDelete) return;

    try {
      await deleteExchangeRateHistoryApi(item.id);
      toast('Registro de tipo de cambio eliminado ✓');
      await loadData();
    } catch (err) {
      console.error('Error al eliminar registro:', err);
      toast(err?.message || 'No se pudo eliminar el registro.');
    }
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—';
    const clean = String(dateStr).slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return clean;
  };

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Info */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: '#f0f9ff', border: '1px solid #bae6fd',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#0284c7', flexShrink: 0, marginTop: '2px',
          }}>
            <ArrowLeftRight size={18} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Tipo de Cambio USD → GTQ Histórico</span>
              <span style={{
                background: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: 700,
                padding: '2px 8px', borderRadius: '12px'
              }}>
                Multimoneda
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', maxWidth: '650px', lineHeight: 1.5 }}>
              Gestiona la tasa de cambio vigente y su historial. Cada evento y cotización calculará sus montos en Quetzales según la tasa efectiva en la fecha del evento, preservando la integridad de eventos pasados.
            </div>
          </div>
        </div>

        <button
          type="button"
          className="settings-accent-btn"
          onClick={handleStartAdd}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 14px' }}
        >
          <Plus size={14} strokeWidth={2.2} />
          <span>Registrar Nuevo Tipo de Cambio</span>
        </button>
      </div>

      {/* KPI Tasa Vigente Actual */}
      <div style={{
        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
        color: '#ffffff',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.18)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.9, fontWeight: 700 }}>
            <TrendingUp size={13} strokeWidth={2.2} />
            <span>Tasa Activa Hoy para Nuevas Operaciones</span>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, marginTop: '4px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span>$ 1.00 USD</span>
            <span style={{ fontSize: '18px', opacity: 0.8 }}>=</span>
            <span style={{ color: '#fef08a' }}>Q {Number(currentRate).toFixed(4)} GTQ</span>
          </div>
          <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '4px' }}>
            Aplica a eventos programados desde su última fecha de vigencia registrada.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={loadData}
            title="Recargar datos del servidor"
            style={{
              background: 'rgba(255, 255, 255, 0.18)',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={13} strokeWidth={2} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Formulario de Registro / Edición */}
      {showAddForm && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '6px',
              background: editingId ? '#eff6ff' : '#f0fdf4',
              border: `1px solid ${editingId ? '#bfdbfe' : '#bbf7d0'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: editingId ? '#1d4ed8' : '#16a34a',
            }}>
              {editingId ? <Pencil size={13} strokeWidth={2} /> : <Plus size={14} strokeWidth={2.2} />}
            </div>
            <span>{editingId ? 'Modificar Registro de Tipo de Cambio' : 'Registrar Nueva Tasa de Cambio'}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                Fecha de Vigencia (Desde cuándo aplica)
              </label>
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              />
              <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px', display: 'block' }}>
                Eventos desde esta fecha tomarán esta tasa.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                Tasa de Conversión ($1 USD = ? GTQ)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Q</span>
                <input
                  type="text"
                  placeholder="Ej: 7.7500"
                  value={formRate}
                  onChange={e => setFormRate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                />
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px', display: 'block' }}>
                Ejemplo: 7.75 o 7.80
              </span>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                Notas / Referencia (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Ajuste BANTRAB / BANGUAT Octubre 2026"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              type="button"
              onClick={handleCancelForm}
              disabled={saving}
              style={{
                background: '#e2e8f0',
                border: 'none',
                color: '#475569',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="settings-accent-btn"
              onClick={handleSubmit}
              disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontSize: '12px' }}
            >
              <Save size={13} strokeWidth={2} />
              <span>{saving ? 'Guardando...' : (editingId ? 'Actualizar Tasa' : 'Guardar y Aplicar')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabla de Historial */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={15} strokeWidth={2} color="#475569" />
            <span>Historial Cronológico de Tipos de Cambio</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            {history.length} {history.length === 1 ? 'registro' : 'registros'}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            Cargando historial de tipo de cambio...
          </div>
        ) : history.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', background: '#f8fafc', borderRadius: '10px' }}>
            No hay registros históricos. El sistema usará la tasa por defecto (Q 7.7500).
          </div>
        ) : (
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '10px 14px' }}>Vigencia Desde</th>
                  <th style={{ padding: '10px 14px' }}>Tasa de Conversión</th>
                  <th style={{ padding: '10px 14px' }}>Equivalencia</th>
                  <th style={{ padding: '10px 14px' }}>Notas</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => {
                  const isLatest = idx === 0;
                  const itemRate = Number(item.tasa || 7.75);
                  return (
                    <tr
                      key={item.id || idx}
                      style={{
                        borderBottom: idx === history.length - 1 ? 'none' : '1px solid #f1f5f9',
                        background: isLatest ? '#f0fdf4' : '#ffffff',
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} strokeWidth={1.8} color="#64748b" />
                          <span>{formatDateDisplay(item.fecha_vigencia)}</span>
                          {isLatest && (
                            <span style={{
                              background: '#bbf7d0', color: '#166534', fontSize: '9px', fontWeight: 800,
                              padding: '2px 6px', borderRadius: '6px', textTransform: 'uppercase',
                              display: 'inline-flex', alignItems: 'center', gap: '3px'
                            }}>
                              <Check size={10} strokeWidth={2.5} />
                              Activo
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#059669', fontSize: '13px' }}>
                        Q {itemRate.toFixed(4)}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>
                        $1,000.00 USD = Q {(1000 * itemRate).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '10px 14px', color: item.notas ? '#334155' : '#94a3b8', fontStyle: item.notas ? 'normal' : 'italic' }}>
                        {item.notas || 'Sin notas registradas'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            title="Editar este registro"
                            style={{
                              background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8',
                              borderRadius: '6px', padding: '5px 9px', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                              display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            <Pencil size={11} strokeWidth={2} />
                            <span>Editar</span>
                          </button>
                          {history.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              title="Eliminar este registro"
                              style={{
                                background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
                                borderRadius: '6px', padding: '5px 9px', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                                display: 'inline-flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              <Trash2 size={11} strokeWidth={2} />
                              <span>Borrar</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cuadro de Explicación y Buenas Prácticas */}
      <div style={{
        padding: '14px 18px',
        background: '#eff6ff',
        borderRadius: '10px',
        border: '1px solid #bfdbfe',
        fontSize: '12px',
        color: '#1e40af',
        lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 800, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px' }}>
          <Info size={15} strokeWidth={2} color="#1d4ed8" />
          <span>¿Cómo funciona la resolución histórica de tipo de cambio?</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: '18px' }}>
          <li>
            <strong>Eventos pasados:</strong> Cada cotización y evento consulta automáticamente la fecha del evento. Si un evento se realizó en enero de 2024, utilizará la tasa vigente en esa fecha específica y no cambiará aunque hoy actualices la tasa.
          </li>
          <li>
            <strong>Eventos futuros / nuevos:</strong> Los eventos que ocurran a partir de la fecha de una nueva tasa tomarán automáticamente el nuevo valor.
          </li>
          <li>
            <strong>Reportes financieros:</strong> Los reportes de Ventas, Contabilidad, Comisiones y Metas siempre reflejan montos homogéneos en Quetzales (GTQ) respetando la tasa histórica de cada evento.
          </li>
        </ul>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="settings-section-card" style={{ overflow: 'visible' }}>
        {content}
      </div>
    );
  }

  return (
    <div
      className="modalBackdrop"
      id="tipoCambioBackdrop"
      hidden
      onClick={(e) => {
        if (tipoCambioModalRef.current && !tipoCambioModalRef.current.contains(e.target)) onBack?.();
      }}
    >
      <div ref={tipoCambioModalRef} className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '820px' }}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Historial de Tipo de Cambio USD → GTQ</div>
            <div className="modalSubtitle">Configuración de tasas de conversión por período para cotizaciones y eventos</div>
          </div>
          <button className="btn-exit" type="button" title="Cerrar" onClick={onBack}>
            <svg className="crm-icon-x" viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l10 10M14 4l-10 10" />
            </svg>
          </button>
        </div>
        <div className="modalBody" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          {content}
        </div>
        <div className="modalFooter">
          <div></div>
          <div className="rightActions">
            <button className="btn-exit" type="button" onClick={onBack}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

