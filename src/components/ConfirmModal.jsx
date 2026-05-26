export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar", isDanger = false }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '400px',
        maxWidth: '90%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        animation: 'scaleIn 0.2s ease-out'
      }}>
        <div style={{ padding: '24px' }}>
          <h2 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '20px', 
            fontWeight: '800', 
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {isDanger ? '⚠️ ' : '❓ '} {title}
          </h2>
          <p style={{ margin: 0, fontSize: '15px', color: '#475569', lineHeight: '1.5' }}>
            {message}
          </p>
        </div>
        
        <div style={{ 
          padding: '16px 24px', 
          background: '#f8fafc', 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '12px',
          borderTop: '1px solid #e2e8f0'
        }}>
          <button 
            onClick={onCancel}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: 'white',
              color: '#475569',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: isDanger ? '#dc2626' : '#2563eb',
              color: 'white',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '14px',
              boxShadow: isDanger ? '0 4px 12px rgba(220, 38, 38, 0.2)' : '0 4px 12px rgba(37, 99, 235, 0.2)',
              transition: 'all 0.2s'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
