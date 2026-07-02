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
      zIndex: 10000,
      padding: '8px'
    }}>
      <div className="confirm-modal-card" style={{
        background: 'white',
        borderRadius: '16px',
        width: '400px',
        maxWidth: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        animation: 'scaleIn 0.2s ease-out'
      }}>
        <div className="confirm-modal-body" style={{ padding: '24px' }}>
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
          <p style={{ margin: 0, fontSize: '15px', color: '#475569', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
            {message}
          </p>
        </div>
        
        <div className="confirm-modal-actions" style={{ 
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
        @media (max-width: 540px) {
          .confirm-modal-card {
            border-radius: 12px !important;
            width: calc(100vw - 32px) !important;
          }
          .confirm-modal-body {
            padding: 18px !important;
          }
          .confirm-modal-body h2 {
            font-size: 17px !important;
          }
          .confirm-modal-body p {
            font-size: 13px !important;
          }
          .confirm-modal-actions {
            padding: 12px 18px !important;
            flex-direction: column !important;
            gap: 8px !important;
          }
          .confirm-modal-actions button {
            width: 100% !important;
            justify-content: center !important;
          }
        }
        @media (max-width: 380px) {
          .confirm-modal-card {
            width: calc(100vw - 16px) !important;
          }
          .confirm-modal-body {
            padding: 14px !important;
          }
          .confirm-modal-actions {
            padding: 10px 14px !important;
          }
        }
      `}</style>
    </div>
  );
}
