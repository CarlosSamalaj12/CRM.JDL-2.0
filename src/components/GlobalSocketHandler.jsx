import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import authService from '../services/authService';
import { toastDiscountRequest, toastDiscountResolution } from '../utils/toast';

/**
 * Componente global que escucha eventos Socket.IO críticos para todo el CRM
 * (solicitudes y respuestas de descuento, cambios de conteo, etc.)
 * Se monta en App.jsx dentro de Router y ToastProvider para estar activo
 * en cualquier ruta del sistema (Calendar, Clientes, Habitaciones, Informes, Kanban, etc.)
 */
export default function GlobalSocketHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    socketService.connect();

    // 1. Escuchar solicitudes entrantes de descuento (para usuarios autorizadores)
    const unsubDiscountAuth = socketService.on('discount-auth-request', (data) => {
      const curUser = authService.getCurrentUser();
      if (!curUser || curUser.canAuthorizeDiscount !== true) return;
      if (data.autorizadorId && String(data.autorizadorId).trim() !== String(curUser.id).trim()) return;

      const eventName = data.eventoNombre || data.eventoId || 'Desconocido';
      const clientName = data.eventoCliente || '';
      const amount = `Q ${Number(data.montoDescuento || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;

      toastDiscountRequest({
        eventName,
        clientName,
        amount,
        onAction: () => navigate('/autorizaciones'),
      });

      window.dispatchEvent(new CustomEvent('discount-auth:count-updated'));
    });

    // 2. Escuchar respuestas de autorización (aprobado o rechazado)
    const unsubDiscountResponse = socketService.on('discount-auth-response', (data) => {
      window.dispatchEvent(new CustomEvent('discount-auth:count-updated'));
      window.dispatchEvent(new CustomEvent('discount-auth:status-updated', { detail: data }));

      const curUser = authService.getCurrentUser();
      if (!curUser) return;

      const curId = String(curUser.id || '').trim().toLowerCase();
      const curEmail = String(curUser.email || curUser.correo || '').trim().toLowerCase();
      const curUsername = String(curUser.username || '').trim().toLowerCase();
      const solId = String(data.solicitanteId || '').trim().toLowerCase();
      const solEmail = String(data.solicitanteCorreo || '').trim().toLowerCase();

      const isRequester = (curId && (curId === solId || curId === solEmail)) ||
                          (curEmail && (curEmail === solEmail || curEmail === solId)) ||
                          (curUsername && (curUsername === solId || curUsername === solEmail));

      // Solo notificar al vendedor solicitante (el autorizador ya ejecutó la acción en su modal)
      if (!isRequester) return;

      const eventName = data.eventoNombre || data.eventoId || 'Evento';
      const clientName = data.eventoCliente || '';
      const isApproved = data.estado === 'aprobado';
      const amount = String(data.tipoDescuento || '').toUpperCase() === 'PERCENT'
        ? `${Number(data.valorDescuento || 0)}% (Q ${Number(data.montoDescuento || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })})`
        : `Q ${Number(data.montoDescuento || data.valorDescuento || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;

      toastDiscountResolution({
        isApproved,
        eventName,
        clientName,
        amount,
        motivo: data.motivo,
        isAuthorizerCopy: false,
        solicitanteName: data.solicitanteNombre || '',
      });
    });

    // 3. Actualización de contador de pendientes
    const unsubDiscountCount = socketService.on('discount-auth:count-updated', () => {
      window.dispatchEvent(new CustomEvent('discount-auth:count-updated'));
    });

    // 4. Cancelación de solicitud por parte del vendedor
    const unsubDiscountCanceled = socketService.on('discount-auth-canceled', (data) => {
      window.dispatchEvent(new CustomEvent('discount-auth:count-updated'));
      window.dispatchEvent(new CustomEvent('discount-auth:status-updated', { detail: { ...data, estado: 'cancelado' } }));
    });

    return () => {
      unsubDiscountAuth();
      unsubDiscountResponse();
      unsubDiscountCount();
      unsubDiscountCanceled();
    };
  }, [navigate]);

  return null;
}
