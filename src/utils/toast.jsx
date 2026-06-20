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
    else if (tipo === 'warning') toastLib(text, { duration: options.duration || DEFAULT_DURATION, icon: '\u26A0\uFE0F' });
    else toastLib(text, { duration: options.duration || DEFAULT_DURATION, icon: '\u2139\uFE0F' });
  }, 0);
}

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

function ConfirmToast({ t, title, message, confirmText, cancelText, resolve }) {
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

export function modernConfirm({ title = "Confirmar", message = "", confirmText = "Confirmar", cancelText = "Cancelar" } = {}) {
  return new Promise((resolve) => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    setTimeout(() => {
      toastLib((t) => <ConfirmToast t={t} title={title} message={message} confirmText={confirmText} cancelText={cancelText} resolve={resolve} />, { duration: Infinity });
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
