import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    delete timersRef.current[id];
  }, []);

  const addToast = useCallback((message, options = {}) => {
    const id = ++toastId;
    const { type = 'success', duration = 4000, action } = options;
    const toast = { id, message, type, duration, action };

    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, [removeToast]);

  const success = useCallback((msg, opts) => addToast(msg, { ...opts, type: 'success' }), [addToast]);
  const error = useCallback((msg, opts) => addToast(msg, { ...opts, type: 'error', duration: 6000 }), [addToast]);
  const info = useCallback((msg, opts) => addToast(msg, { ...opts, type: 'info' }), [addToast]);
  const warning = useCallback((msg, opts) => addToast(msg, { ...opts, type: 'warning', duration: 5000 }), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, info, warning }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}

// ─── Componente visual del contenedor de toasts ──────────────
function ToastContainer({ toasts, removeToast }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

const TYPE_STYLES = {
  success: { icon: '✓', className: 'toast-success' },
  error:   { icon: '✕', className: 'toast-error' },
  info:    { icon: 'ℹ', className: 'toast-info' },
  warning: { icon: '⚠', className: 'toast-warning' },
};

function ToastItem({ toast, onDismiss }) {
  const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info;

  return (
    <div className={`toast-item ${style.className}`} role="alert">
      <span className="toast-icon">{style.icon}</span>
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button className="toast-action" onClick={toast.action.onClick}>
          {toast.action.label}
        </button>
      )}
      <button className="toast-close" onClick={onDismiss} aria-label="Cerrar">✕</button>
    </div>
  );
}
