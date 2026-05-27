import React, { useState, useEffect } from 'react';
import { toast, modernConfirm } from '../../utils/toast';

const handleClose = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) modal.hidden = true;
};

export default function SettingsQuoteTemplates() {
  const [templates, setTemplates] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  
  // Current services in the chosen template
  const [templateItems, setTemplateItems] = useState([]);

  // Search autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredServices, setFilteredServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [quantity, setQuantity] = useState(1);

  // Load app state
  useEffect(() => {
    loadState();
  }, []);

  const loadState = () => {
    fetch('/api/state')
      .then(r => r.json())
      .then(data => {
        const stateObj = data.state || data;
        setTemplates(stateObj.quoteServiceTemplates || []);
        setServices(stateObj.services || []);
      })
      .catch(err => console.error('Error loading state:', err));
  };

  // Handle template dropdown selection
  useEffect(() => {
    if (selectedTemplateId) {
      const found = templates.find(t => String(t.id) === String(selectedTemplateId));
      if (found) {
        setTemplateName(found.name || '');
        setTemplateItems(found.items || []);
      }
    } else {
      setTemplateName('');
      setTemplateItems([]);
    }
  }, [selectedTemplateId, templates]);

  // Handle service autocomplete filtering
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      const filtered = services.filter(s => 
        s.name.toLowerCase().includes(query) || 
        (s.category && s.category.toLowerCase().includes(query))
      );
      setFilteredServices(filtered.slice(0, 10)); // Limit to top 10 results
    } else {
      setFilteredServices([]);
    }
  }, [searchQuery, services]);

  const handleSelectService = (service) => {
    setSelectedService(service);
    setSearchQuery(service.name);
    setFilteredServices([]);
  };

  const handleAddService = () => {
    if (!selectedService) {
      toast('Debe buscar y seleccionar un servicio del catálogo');
      return;
    }
    if (quantity <= 0) {
      toast('La cantidad debe ser mayor que 0');
      return;
    }

    const newItem = {
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      qty: Number(quantity),
      basePrice: Number(selectedService.price || 0),
    };

    // Prevent duplicates in the same template
    if (templateItems.some(item => String(item.serviceId) === String(selectedService.id))) {
      toast('Este servicio ya está agregado en la plantilla. Modifique su cantidad o elimínelo para re-agregar.');
      return;
    }

    setTemplateItems([...templateItems, newItem]);
    setSelectedService(null);
    setSearchQuery('');
    setQuantity(1);
  };

  const handleRemoveItem = (serviceId) => {
    setTemplateItems(templateItems.filter(item => String(item.serviceId) !== String(serviceId)));
  };

  const handleNewTemplate = () => {
    setSelectedTemplateId('');
    setTemplateName('');
    setTemplateItems([]);
    setSelectedService(null);
    setSearchQuery('');
    setQuantity(1);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast('Debe especificar un nombre para la plantilla');
      return;
    }

    let updatedTemplates = [...templates];
    const isEditing = !!selectedTemplateId;

    const templateData = {
      id: isEditing ? selectedTemplateId : 'tpl_' + Date.now(),
      name: templateName.trim(),
      items: templateItems,
    };

    if (isEditing) {
      updatedTemplates = updatedTemplates.map(t => String(t.id) === String(selectedTemplateId) ? templateData : t);
    } else {
      updatedTemplates.push(templateData);
    }

    await saveGlobalState(updatedTemplates, 'Plantilla guardada con éxito');
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;
    const ok = await modernConfirm({
      title: '¿Está seguro?',
      message: '¿Está seguro de que desea eliminar esta plantilla?'
    });
    if (!ok) return;

    const updatedTemplates = templates.filter(t => String(t.id) !== String(selectedTemplateId));
    await saveGlobalState(updatedTemplates, 'Plantilla eliminada con éxito');
    handleNewTemplate();
  };

  const saveGlobalState = async (updatedTemplatesList, successMessage) => {
    try {
      // Fetch full state first to merge and update only the quoteServiceTemplates list
      const resState = await fetch('/api/state');
      const dataState = await resState.json();
      const currentState = dataState.state || dataState;

      currentState.quoteServiceTemplates = updatedTemplatesList;

      const resSave = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: currentState }),
      });
      
      const dataSave = await resSave.json();
      if (dataSave.ok) {
        toast(successMessage);
        loadState();
      } else {
        toast('Error al guardar el estado global: ' + dataSave.message);
      }
    } catch (err) {
      console.error(err);
      toast('Error de red al actualizar las plantillas.');
    }
  };

  const calculateTotal = () => {
    return templateItems.reduce((acc, item) => acc + (item.qty * item.basePrice), 0);
  };

  return (
    <div className="modalBackdrop" id="quoteServiceTemplateBackdrop" hidden onClick={(e) => { if (e.target.id === 'quoteServiceTemplateBackdrop') handleClose('quoteServiceTemplateBackdrop'); }}>
      <div className="modal glass-modal" role="dialog" aria-modal="true" aria-labelledby="quoteServiceTemplateTitle" style={{ maxWidth: '920px' }}>
        <div className="modalHeader" style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '16px' }}>
          <div>
            <div className="modalTitle" id="quoteServiceTemplateTitle" style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: '#0f766e' }}>layers</span>
              Plantillas de Cotización (Combos)
            </div>
            <div className="modalSubtitle" style={{ color: '#475569' }}>
              Crea y administra combos y paquetes de servicios reutilizables para cargarlos rápidamente al cotizar
            </div>
          </div>
          <button className="iconBtn" id="btnQuoteServiceTemplateClose" type="button" title="Cerrar" onClick={() => handleClose('quoteServiceTemplateBackdrop')} style={{ color: '#64748b' }}>&#10005;</button>
        </div>

        <div className="modalBody" style={{ padding: '24px 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px', marginBottom: '24px' }}>
            <label className="field">
              <span style={{ fontWeight: '600', color: '#334155' }}>Plantilla existente (para editar)</span>
              <select 
                value={selectedTemplateId} 
                onChange={e => setSelectedTemplateId(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px' }}
              >
                <option value="">-- Crear Nueva Plantilla (Combo) --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span style={{ fontWeight: '600', color: '#334155' }}>Nombre de plantilla / combo</span>
              <input 
                type="text" 
                placeholder="Ej: Boda Todo Incluido Premium (150 pax)"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px' }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px dashed #cbd5e1' }}>
            <button className="btn-cancel" type="button" onClick={handleNewTemplate}>Nueva Plantilla</button>
            <button className="btn-teal" type="button" onClick={handleSaveTemplate}>
              {selectedTemplateId ? 'Actualizar Plantilla' : 'Guardar Como Nueva'}
            </button>
            {selectedTemplateId && (
              <button className="btn-cancelar" type="button" onClick={handleDeleteTemplate}>
                Eliminar Plantilla
              </button>
            )}
          </div>

          {/* Setup panel to add services */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a', marginBottom: '12px' }}>Agregar servicios a la plantilla</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', alignItems: 'end', position: 'relative' }}>
              <label className="field" style={{ position: 'relative' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Buscar servicio</span>
                <input 
                  type="text" 
                  placeholder="Escribe para buscar..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSelectedService(null); }}
                  style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px' }}
                />
                {filteredServices.length > 0 && (
                  <div style={{ 
                    position: 'absolute', 
                    top: '64px', 
                    left: 0, 
                    right: 0, 
                    background: '#ffffff', 
                    border: '1px solid #cbd5e1', 
                    borderRadius: '8px', 
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', 
                    zIndex: 100, 
                    maxHeight: '200px', 
                    overflowY: 'auto' 
                  }}>
                    {filteredServices.map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => handleSelectService(s)}
                        style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}
                        onMouseEnter={e => e.target.style.background = '#f8fafc'}
                        onMouseLeave={e => e.target.style.background = 'transparent'}
                      >
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Categoría: {s.category || 'Sin categoría'} - Q{s.price}</div>
                      </div>
                    ))}
                  </div>
                )}
              </label>

              <label className="field">
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Cantidad</span>
                <input 
                  type="number" 
                  min="1" 
                  step="1"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px' }}
                />
              </label>

              <button className="btn-teal" type="button" onClick={handleAddService} style={{ height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>playlist_add</span>
                Agregar servicio
              </button>
            </div>
          </div>

          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Servicios de la plantilla ({templateItems.length})</span>
            <span style={{ fontSize: '15px', color: '#0f766e', fontWeight: '800' }}>Total base: Q{calculateTotal().toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="quoteTableWrap">
            <table className="quoteTable">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Cantidad</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Precio Unitario</th>
                  <th style={{ width: '160px', textAlign: 'right' }}>Total Base</th>
                  <th style={{ width: '80px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {templateItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                      No hay servicios agregados a esta plantilla. Busca y agrega servicios arriba.
                    </td>
                  </tr>
                ) : (
                  templateItems.map(item => (
                    <tr key={item.serviceId}>
                      <td style={{ fontWeight: '600', color: '#1e293b' }}>{item.serviceName}</td>
                      <td style={{ textAlign: 'center', fontWeight: '500' }}>{item.qty}</td>
                      <td style={{ textAlign: 'right' }}>Q{item.basePrice.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: '#0f766e' }}>Q{(item.qty * item.basePrice).toFixed(2)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="iconBtn" 
                          type="button" 
                          onClick={() => handleRemoveItem(item.serviceId)}
                          style={{ color: '#ef4444' }}
                          title="Eliminar servicio"
                        >
                          &#10005;
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
