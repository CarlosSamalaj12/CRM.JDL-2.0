import React, { useState, useEffect, useCallback, useRef } from 'react';
import stateService from '../../services/stateService';

function uid() {
  return 'tpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

const emptyItem = { serviceId: '', name: '', qty: 1, price: 0, quantityMode: 'MANUAL' };

export default function SettingsPlantillas({ inline, onBack }) {
  const [templates, setTemplates] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [draftItems, setDraftItems] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const searchRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const data = await stateService.loadState();
      setServices(data?.services || []);
      setTemplates(data?.quoteServiceTemplates || data?.quickTemplates || []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowServiceDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const saveTemplates = async (nextTemplates) => {
    try {
      const currentState = await stateService.loadState();
      await stateService.saveState({
        ...currentState,
        quickTemplates: nextTemplates,
        quoteServiceTemplates: nextTemplates,
      });
      setTemplates(nextTemplates);
    } catch { }
  };

  const availableServices = services.filter(s => s.active !== false);
  const filteredServices = availableServices.filter(s =>
    (s.name || '').toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const startCreate = () => {
    setEditingId('new');
    setDraftName('');
    setDraftItems([]);
    setServiceSearch('');
  };

  const startEdit = (tpl) => {
    setEditingId(tpl.id);
    setDraftName(tpl.name);
    setDraftItems((tpl.items || []).map(item => ({ ...item })));
    setServiceSearch('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftName('');
    setDraftItems([]);
  };

  const addItem = (service) => {
    setDraftItems(prev => [...prev, {
      serviceId: String(service.id || ''),
      name: service.name || '',
      qty: 1,
      price: Number(service.price) || 0,
      quantityMode: service.quantityMode || 'MANUAL',
    }]);
    setServiceSearch('');
    setShowServiceDropdown(false);
  };

  const removeItem = (idx) => {
    setDraftItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, value) => {
    setDraftItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    ));
  };

  const handleSave = async () => {
    if (!draftName.trim()) return;
    if (!draftItems.length) return;

    const now = Date.now();
    let nextTemplates;

    if (editingId === 'new') {
      const newTpl = {
        id: `tpl_${now}_${Math.random().toString(36).slice(2, 5)}`,
        name: draftName.trim(),
        items: draftItems.map(item => ({
          serviceId: item.serviceId,
          name: item.name,
          qty: Number(item.qty) || 1,
          price: Number(item.price) || 0,
          quantityMode: item.quantityMode || 'MANUAL',
        })),
      };
      nextTemplates = [...templates, newTpl];
    } else {
      nextTemplates = templates.map(t =>
        t.id === editingId
          ? {
              ...t,
              name: draftName.trim(),
              items: draftItems.map(item => ({
                serviceId: item.serviceId,
                name: item.name,
                qty: Number(item.qty) || 1,
                price: Number(item.price) || 0,
                quantityMode: item.quantityMode || 'MANUAL',
              })),
            }
          : t
      );
    }

    await saveTemplates(nextTemplates);
    cancelEdit();
  };

  const handleDelete = async (tplId) => {
    const next = templates.filter(t => t.id !== tplId);
    await saveTemplates(next);
  };

  const cartSubtotal = draftItems.reduce((sum, item) => sum + (Number(item.qty) * Number(item.price)), 0);

  if (loading) {
    return (
      <div className="settings-page" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        Cargando...
      </div>
    );
  }

  const content = (
    <>
      {editingId ? (
        <div className="settings-section-card" style={{ overflow: 'visible' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                {editingId === 'new' ? 'Nueva plantilla' : 'Editar plantilla'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {editingId === 'new'
                  ? 'Selecciona los servicios y asigna cantidades para crear la plantilla.'
                  : 'Modifica los servicios y cantidades de la plantilla.'}
              </div>
            </div>
            <button className="settings-cancel-btn" type="button" onClick={cancelEdit}>
              Cancelar
            </button>
          </div>

          <div className="settings-modern-field" style={{ marginBottom: 14 }}>
            <span>Nombre de la plantilla</span>
            <input
              type="text"
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              placeholder="Ej: Banquete corporativo básico"
            />
          </div>

          <div style={{ marginBottom: 12 }} ref={searchRef}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Agregar servicio
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="settings-input-compact"
                style={{ width: '100%' }}
                placeholder="Buscar servicio..."
                value={serviceSearch}
                onChange={e => { setServiceSearch(e.target.value); setShowServiceDropdown(true); }}
                onFocus={() => setShowServiceDropdown(true)}
              />
              {showServiceDropdown && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                  {filteredServices.length > 0 ? (
                    filteredServices.map(s => {
                      const alreadyAdded = draftItems.some(item => String(item.serviceId) === String(s.id));
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={alreadyAdded}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: alreadyAdded ? 'not-allowed' : 'pointer', fontSize: 12, color: alreadyAdded ? '#94a3b8' : '#334155', background: 'transparent' }}
                          onClick={() => { if (!alreadyAdded) addItem(s); }}
                          onMouseEnter={e => { if (!alreadyAdded) e.currentTarget.style.background = '#f8fafc'; }}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <strong>{s.name}</strong>
                          <span style={{ color: '#64748b', marginLeft: 8 }}>Q{Number(s.price || 0).toFixed(2)}</span>
                          <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 10 }}>{s.quantityMode}</span>
                          {alreadyAdded && <span style={{ float: 'right', color: '#10b981', fontSize: 10, fontWeight: 700 }}>AGREGADO</span>}
                        </button>
                      );
                    })
                  ) : (
                    <div style={{ padding: '12px 14px', color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>
                      {services.length === 0
                        ? 'No hay servicios creados. Ve a Servicios y Catálogos para crear uno.'
                        : 'Ningún servicio coincide con la búsqueda.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="settings-table-wrap" style={{ marginBottom: 12 }}>
            <table className="settings-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Servicio</th>
                  <th style={{ width: '15%' }}>Cantidad</th>
                  <th style={{ width: '18%' }}>Precio unitario</th>
                  <th style={{ width: '17%' }}>Total</th>
                  <th style={{ width: '10%' }}></th>
                </tr>
              </thead>
              <tbody>
                {draftItems.map((item, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td>
                      <input
                        type="number"
                        className="settings-input-compact"
                        style={{ width: 80 }}
                        min="1"
                        value={item.qty}
                        onChange={e => updateItem(i, 'qty', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="settings-input-compact"
                        style={{ width: 100 }}
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={e => updateItem(i, 'price', e.target.value)}
                      />
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      Q{(Number(item.qty) * Number(item.price)).toFixed(2)}
                    </td>
                    <td>
                      <div className="settings-table-actions">
                          <button type="button" onClick={() => removeItem(i)} title="Eliminar servicio">
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ef4444' }}>delete</span>
                          </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!draftItems.length && (
                  <tr>
                    <td colSpan={5} className="settings-empty-row">
                      No hay servicios agregados. Busca un servicio arriba para agregarlo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {draftItems.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '8px 14px', background: '#f8fafc', borderRadius: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                {draftItems.length} servicio(s) · Subtotal estimado:
              </span>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                Q{cartSubtotal.toFixed(2)}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              className="settings-primary-btn"
              type="button"
              disabled={!draftName.trim() || !draftItems.length}
              onClick={handleSave}
            >
              {editingId === 'new' ? 'Crear plantilla' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Plantillas de Cotización</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Crea plantillas con servicios predefinidos para agilizar la creación de cotizaciones.
              </div>
            </div>
            <button className="settings-accent-btn" type="button" onClick={startCreate}>
              + Nueva plantilla
            </button>
          </div>

          <div className="settings-table-wrap">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Servicios</th>
                  <th>Subtotal estimado</th>
                  <th className="settings-td-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {templates.map(tpl => {
                  const subtotal = (tpl.items || []).reduce((s, item) => s + (Number(item.qty) * Number(item.price)), 0);
                  return (
                    <tr key={tpl.id}>
                      <td style={{ fontWeight: 700 }}>{tpl.name}</td>
                      <td>{(tpl.items || []).length} servicio(s)</td>
                      <td style={{ fontWeight: 600 }}>Q{subtotal.toFixed(2)}</td>
                      <td className="settings-td-center">
                        <div className="settings-table-actions">
                          <button type="button" onClick={() => startEdit(tpl)} title="Editar plantilla">
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#0ea5e9' }}>edit</span>
                          </button>
                          <button type="button" onClick={() => handleDelete(tpl.id)} title="Eliminar plantilla">
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ef4444' }}>delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!templates.length && (
                  <tr>
                    <td colSpan={4} className="settings-empty-row">
                      No hay plantillas creadas. Presiona "+ Nueva plantilla" para crear una.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="settings-page">
      <div className="reports-page-header" style={{ flexShrink: 0 }}>
        <div className="reports-brand-header">
          <div className="reports-brand-badge">
            <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
          </div>
          <div>
            <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
            <div className="reports-title">Panel de Configuración</div>
            <div className="reports-subtitle">Gestión de plantillas de cotización</div>
          </div>
        </div>
        {onBack && (
          <button className="btn-exit" type="button" onClick={onBack}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        )}
      </div>
      <div className="settings-page-body" style={{ overflowY: 'auto' }}>
        {content}
      </div>
    </div>
  );
}
