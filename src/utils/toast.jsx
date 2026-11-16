import toastLib from 'react-hot-toast';

const DEFAULT_DURATION = 4000;

const esExito = /\b(agregado|agregada|guardado|guardada|creado|creada|cargado|cargada|movido|movida|eliminado|eliminada|ajustada|ajustado|extendida|extendido|cambiado|cambiada|actualizado|actualizada|listo|exitoso|exitosa|completado|completada|enviado|enviada|publicado|publicada|subido|subida)\b/i;
const esError = /\b(no se pudo|error|invalido|invalida|falta|faltan|completa|sin conexion|debe|obligatoria|obligatorio|imposible|fallo|fallida|denegado|denegada|rechazado|rechazada)\b/i;
const esWarning = /\b(atencion|cuidado|advertencia|precaucion|alerta|aviso)\b/i;

function detectarTipo(msg) {
  const text = String(msg || "").trim();
  if (esError.test(text)) return 'error';
  if (esWarning.test(text)) return 'warning';
  if (esExito.test(text)) return 'success';
  return 'info';
}

export function toast(msg, options = {}) {
  const text = String(msg || "").trim();
  if (!text) return;

  const tipo = options.type || detectarTipo(text);

  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }

  setTimeout(() => {
    if (tipo === 'success') toastLib.success(text, { duration: options.duration || DEFAULT_DURATION });
    else if (tipo === 'error') toastLib.error(text, { duration: options.duration || DEFAULT_DURATION });
    else if (tipo === 'warning') toastLib(text, { duration: options.duration || DEFAULT_DURATION, icon: '⚠️' });
    else toastLib(text, { duration: options.duration || DEFAULT_DURATION, icon: 'ℹ️' });
  }, 0);
}

toast.success = (msg, options = {}) => toast(msg, { ...options, type: 'success' });
toast.error = (msg, options = {}) => toast(msg, { ...options, type: 'error' });
toast.warning = (msg, options = {}) => toast(msg, { ...options, type: 'warning' });
toast.info = (msg, options = {}) => toast(msg, { ...options, type: 'info' });
toast.dismiss = (id) => toastLib.dismiss(id);

export default toast;


export function modernAlert({ icon = "info", title = "", text = "", html = "" }) {
  return new Promise((resolve) => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    setTimeout(() => {
      toastLib(title || text || html, { duration: 4000 });
      resolve({ isConfirmed: true });
    }, 0);
  });
}

function ConfirmToast({ t, title, message, html, confirmText, cancelText, resolve }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '260px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '14px' }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {title}
      </div>
      {message && <div style={{ fontSize: '13px', color: '#64748b' }}>{message}</div>}
      {html && <div dangerouslySetInnerHTML={{ __html: html }} />}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => { toastLib.dismiss(t.id); resolve(false); }}
          style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569' }}
        >
          {cancelText}
        </button>
        <button
          onClick={() => { toastLib.dismiss(t.id); resolve(true); }}
          style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
        >
          {confirmText}
        </button>
      </div>
    </div>
  );
}

export function modernConfirm({ title = "Confirmar", message = "", html = "", confirmText = "Confirmar", cancelText = "Cancelar" } = {}) {
  return new Promise((resolve) => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    setTimeout(() => {
      toastLib((t) => <ConfirmToast t={t} title={title} message={message} html={html} confirmText={confirmText} cancelText={cancelText} resolve={resolve} />, { duration: Infinity });
    }, 0);
  });
}

export function modernConfirmMaintenance() {
  return modernConfirm({
    title: "Confirmar mantenimiento",
    message: "\u00BFEst\u00E1 seguro de poner el sal\u00F3n en Mantenimiento?",
    confirmText: "S\u00ED, poner en mantenimiento",
    cancelText: "No, cancelar"
  });
}

export function modernConfirmReleaseMaintenance() {
  return modernConfirm({
    title: "Liberar mantenimiento",
    message: "\u00BFEst\u00E1 seguro de quitar el mantenimiento?",
    confirmText: "S\u00ED, liberar",
    cancelText: "No, cancelar"
  });
}

export function toastDiscountRequest({ eventName, clientName, amount, onAction }) {
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  toastLib(
    (t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '270px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Solicitud de Descuento</span>
        </div>
        <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
          <div><strong>{eventName}</strong> {clientName ? `• ${clientName}` : ''}</div>
          <div style={{ color: '#0284c7', fontWeight: '700', marginTop: '2px' }}>Descuento: {amount}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="button"
            onClick={() => toastLib.dismiss(t.id)}
            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontSize: '11.5px', fontWeight: '600', color: '#64748b' }}
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => {
              toastLib.dismiss(t.id);
              if (typeof onAction === 'function') onAction();
            }}
            style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: '#0284c7', color: 'white', cursor: 'pointer', fontSize: '11.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            Ver Solicitudes →
          </button>
        </div>
      </div>
    ),
    { duration: 9000, id: 'discount-request-toast' }
  );
}

export function toastDiscountResolution({ isApproved, eventName, clientName, amount, motivo, isAuthorizerCopy = false, solicitanteName = '' }) {
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  toastLib(
    (t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '290px', maxWidth: '350px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '13px', color: isApproved ? '#065f46' : '#991b1b' }}>
            {isApproved ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            <span>
              {isAuthorizerCopy ? 'Resolución Notificada' : (isApproved ? 'Descuento Autorizado' : 'Descuento No Autorizado')}
            </span>
          </div>
          <span style={{
            fontSize: '10px',
            fontWeight: '800',
            padding: '2px 8px',
            borderRadius: '999px',
            background: isApproved ? '#d1fae5' : '#fee2e2',
            color: isApproved ? '#065f46' : '#991b1b',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            {isApproved ? 'Aprobado' : 'Rechazado'}
          </span>
        </div>

        <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
          <div><strong>{eventName}</strong> {clientName ? `• ${clientName}` : ''}</div>
          <div style={{ color: isApproved ? '#047857' : '#b91c1c', fontWeight: '700', marginTop: '3px' }}>
            Descuento: {amount}
          </div>
          {motivo && (
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontStyle: 'italic', background: '#f8fafc', padding: '4px 6px', borderRadius: '4px' }}>
              Motivo: {motivo}
            </div>
          )}
          {isAuthorizerCopy ? (
            <div style={{ fontSize: '11px', color: '#0369a1', marginTop: '4px', fontWeight: '600' }}>
              Notificación enviada en tiempo real a: <strong>{solicitanteName || 'Vendedor'}</strong>
            </div>
          ) : (
            isApproved && (
              <div style={{ fontSize: '11px', color: '#047857', marginTop: '4px', fontWeight: '500' }}>
                El descuento ya está disponible para aplicarse en cotizaciones y contratos.
              </div>
            )
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="button"
            onClick={() => toastLib.dismiss(t.id)}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              border: isApproved ? '1px solid #10b981' : '1px solid #cbd5e1',
              background: isApproved ? '#10b981' : 'white',
              color: isApproved ? 'white' : '#64748b',
              cursor: 'pointer',
              fontSize: '11.5px',
              fontWeight: '700'
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    ),
    { duration: 10000, id: `discount-response-${Date.now()}` }
  );
}
