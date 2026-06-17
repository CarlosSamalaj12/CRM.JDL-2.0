import Swal from 'sweetalert2';

/**
 * Muestra una alerta rápida tipo toast al tope de la pantalla,
 * deduciendo el tipo (éxito, error, info) según expresiones regulares.
 * Temporizador de 2.4s y barra de progreso.
 * 
 * @param {string} msg Mensaje a mostrar
 */
export function toast(msg) {
  const text = String(msg || "").trim();
  if (!text) return;

  const successPattern = /\b(agregado|agregada|guardado|guardada|creado|creada|cargado|cargada|movido|movida|eliminado|eliminada|ajustada|ajustado|extendida|extendido|cambiado|cambiada|actualizado|actualizada|listo)\b/i;
  const errorPattern = /\b(no se pudo|error|invalido|invalida|falta|faltan|completa|sin conexion|debe|obligatoria|obligatorio)\b/i;
  
  const icon = errorPattern.test(text) ? "error" : (successPattern.test(text) ? "success" : "info");
  const iconHtml = icon === "success" ? "&#10003;" : (icon === "error" ? "&#215;" : "i");

  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  setTimeout(() => {
    Swal.fire({
      toast: true,
      position: "top",
      icon,
      iconHtml,
      title: text,
      showConfirmButton: false,
      timer: 2400,
      timerProgressBar: true,
      customClass: {
        popup: "swal-ios-toast"
      }
    });
  }, 0);
}

/**
 * Muestra una alerta modal estándar para avisar al usuario.
 */
export function modernAlert({ icon = "info", title = "", text = "", html = "", confirmText = "Aceptar" }) {
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        Swal.fire({
          icon,
          title,
          text: text || undefined,
          html: html || undefined,
          confirmButtonText: confirmText,
          background: "#f8fbff",
          color: "#10243b",
          confirmButtonColor: "#2563eb",
          allowOutsideClick: false,
        })
      );
    }, 0);
  });
}

/**
 * Muestra un diálogo de confirmación de acción.
 * Retorna true si el usuario presiona confirmar, false de lo contrario.
 */
export async function modernConfirm({ title = "Confirmar", message = "", confirmText = "Confirmar", cancelText = "Cancelar" } = {}) {
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  return new Promise((resolve) => {
    setTimeout(async () => {
      const result = await Swal.fire({
        icon: "warning",
        title,
        text: message || undefined,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        background: "#f8fbff",
        color: "#10243b",
        confirmButtonColor: "#2563eb",
        cancelButtonColor: "#94a3b8",
      });
      resolve(!!result?.isConfirmed);
    }, 0);
  });
}

/**
 * Diálogo específico para poner en mantenimiento.
 */
export function modernConfirmMaintenance() {
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        Swal.fire({
          icon: "warning",
          title: "Confirmar mantenimiento",
          text: "¿Está seguro de poner el salón en Mantenimiento?",
          showCancelButton: true,
          confirmButtonText: "Sí, poner en mantenimiento",
          cancelButtonText: "No, cancelar",
          background: "#f8fbff",
          color: "#10243b",
          confirmButtonColor: "#8b5cf6",
          cancelButtonColor: "#94a3b8",
        })
      );
    }, 0);
  });
}

/**
 * Diálogo específico para liberar mantenimiento.
 */
export function modernConfirmReleaseMaintenance() {
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        Swal.fire({
          icon: "warning",
          title: "Liberar mantenimiento",
          text: "¿Está seguro de quitar el mantenimiento?",
          showCancelButton: true,
          confirmButtonText: "Sí, liberar",
          cancelButtonText: "No, cancelar",
          background: "#f8fbff",
          color: "#10243b",
          confirmButtonColor: "#dc2626",
          cancelButtonColor: "#94a3b8",
        })
      );
    }, 0);
  });
}
