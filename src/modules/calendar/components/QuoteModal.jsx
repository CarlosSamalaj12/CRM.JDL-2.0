import { useState, useEffect } from 'react';

export default function QuoteModal({ event, onClose, onSave }) {
  const [companies, setCompanies] = useState([]);
  const [quote, setQuote] = useState({
    companyId: '',
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    eventType: '',
    place: '',
    eventDate: event?.date || '',
    pax: event?.pax || 0,
    notes: '',
    items: [],
    discountType: 'percent',
    discountValue: 0,
    subtotal: 0,
    total: 0
  });

  const loadCompanies = async () => {
    try {
      const response = await fetch('/api/state');
      const data = await response.json();
      setCompanies(data?.state?.companies || []);
    } catch {
      console.error('Error cargando empresas:');
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const calculateTotals = () => {
    const subtotal = quote.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = quote.discountType === 'percent' 
      ? subtotal * (quote.discountValue / 100) 
      : quote.discountValue;
    const total = subtotal - discount;
    setQuote(prev => ({ ...prev, subtotal, total }));
  };

  const handleCompanySelect = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    if (company) {
      setQuote(prev => ({
        ...prev,
        companyId,
        companyName: company.name,
        contactName: company.owner || '',
        contactEmail: company.email || '',
        contactPhone: company.phone || ''
      }));
    }
  };

  const headerStyle = {
    background: 'linear-gradient(135deg, #059669 0%, #18c5bc 100%)',
    color: 'white',
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const bodyStyle = {
    padding: '24px',
    maxHeight: '450px',
    overflowY: 'auto',
    background: '#f8fafc'
  };

  const footerStyle = {
    padding: '16px 24px',
    borderTop: '2px solid #f1f5f9',
    background: 'white',
    display: 'flex',
    gap: '12px'
  };

  const labelStyle = {
    fontSize: '11px',
    fontWeight: '800',
    color: '#64748b',
    marginBottom: '6px',
    textTransform: 'uppercase',
    display: 'block'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '2px solid #f1f5f9',
    fontSize: '14px',
    fontWeight: '600'
  };

  const btnPrimary = {
    flex: 1,
    padding: '14px 24px',
    borderRadius: '12px',
    fontWeight: '800',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
    background: '#059669',
    color: 'white',
    boxShadow: '0 4px 10px rgba(5, 150, 105, 0.15)'
  };

  const btnSecondary = {
    flex: 1,
    padding: '14px 24px',
    borderRadius: '12px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#64748b'
  };

  return (
    <div style={{
      width: '560px',
      background: 'white',
      borderRadius: '20px',
      boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>💰 Cotización del Evento</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>{event?.name}</p>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          fontSize: '20px',
          cursor: 'pointer',
          color: 'white'
        }}>×</button>
      </div>

      {/* Body */}
      <div style={bodyStyle}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
          {/* Selector de Empresa */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Empresa</label>
            <select 
              value={quote.companyId} 
              onChange={e => handleCompanySelect(e.target.value)}
              style={inputStyle}
            >
              <option value="">-- Seleccionar empresa --</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Datos del contacto */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Nombre contacto</label>
              <input 
                value={quote.contactName} 
                onChange={e => setQuote(prev => ({ ...prev, contactName: e.target.value }))}
                style={inputStyle} 
              />
            </div>
            <div>
              <label style={labelStyle}>Teléfono</label>
              <input 
                value={quote.contactPhone} 
                onChange={e => setQuote(prev => ({ ...prev, contactPhone: e.target.value }))}
                style={inputStyle} 
              />
            </div>
          </div>

          {/* Tipo de evento */}
          <div>
            <label style={labelStyle}>Tipo de evento</label>
            <select 
              value={quote.eventType} 
              onChange={e => setQuote(prev => ({ ...prev, eventType: e.target.value }))}
              style={inputStyle}
            >
              <option value="">-- Seleccionar --</option>
              <option value="boda">Boda</option>
              <option value="xv">XV Años</option>
              <option value="corporativo">Corporativo</option>
              <option value="social">Social</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>

        {/* Totales */}
        <div style={{ 
          background: '#f0fdf4', 
          padding: '20px', 
          borderRadius: '16px', 
          border: '2px solid #bbf7d0',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: '#64748b', fontWeight: '700', fontSize: '14px' }}>Subtotal:</span>
            <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '16px' }}>Q {quote.subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ color: '#64748b', fontWeight: '700', fontSize: '14px' }}>Descuento:</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="number" 
                value={quote.discountValue}
                onChange={e => {
                  setQuote(prev => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }));
                  calculateTotals();
                }}
                style={{ width: '70px', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: '700', textAlign: 'right' }}
              />
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>{quote.discountType === 'percent' ? '%' : 'Q'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid #bbf7d0' }}>
            <span style={{ color: '#059669', fontWeight: '800', fontSize: '18px' }}>TOTAL:</span>
            <span style={{ color: '#059669', fontWeight: '800', fontSize: '22px' }}>Q {quote.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Notas */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <label style={labelStyle}>Notas de la cotización</label>
          <textarea 
            value={quote.notes}
            onChange={e => setQuote(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Notas adicionales para la cotización..."
            style={{ ...inputStyle, minHeight: '80px', resize: 'none' }}
          />
        </div>
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <button onClick={onClose} style={btnSecondary}>
          Cancelar
        </button>
        <button onClick={() => onSave(quote)} style={btnPrimary}>
          Guardar Cotización
        </button>
      </div>
    </div>
  );
}