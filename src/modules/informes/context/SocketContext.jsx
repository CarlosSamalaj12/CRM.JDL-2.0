import { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL || window.location.origin;
const SOCKET_ENABLED = import.meta.env.VITE_REPORTS_SOCKET !== 'false';

let globalSocket = null;

function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showBrowserNotif(title, body) {
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

// ─── Web Push helper ───

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerWebPush(userId) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if ('Notification' in window && Notification.permission !== 'granted') return;

    const token = localStorage.getItem('token');
    if (!token) return;

    // Obtener VAPID public key del servidor
    const resp = await fetch(API_URL + '/api/push/vapid-public-key');
    if (!resp.ok) return;
    const { publicKey } = await resp.json();
    if (!publicKey || publicKey === 'MISSING_VAPID_PUBLIC_KEY') return;

    const registration = await navigator.serviceWorker.ready;
    const authHeader = { Authorization: 'Bearer ' + token };
    
    // Eliminar suscripción previa si existe
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      // Si ya existe una suscripción, asegurarnos que esté guardada en el backend
      try {
        await fetch(API_URL + '/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ subscription: existingSub.toJSON() }),
        });
      } catch { /* ignore */ }
      return;
    }

    // Crear nueva suscripción
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // Guardar en backend con JWT
    await fetch(API_URL + '/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    console.log('[SW] Web Push suscripción automática exitosa');
  } catch (err) {
    console.warn('[SW] Web Push auto-suscripción falló:', err.message);
  }
}

// ─── Context ───

export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const roomsRef = useRef(new Set());

  useEffect(() => {
    requestNotifPermission();
    // Detectar soporte de Web Push
    setPushSupported('serviceWorker' in navigator && 'PushManager' in window);
  }, []);

  // Intentar suscripción Web Push automática cuando el usuario inicia sesión
  useEffect(() => {
    if (user?.id && 'Notification' in window && Notification.permission === 'granted') {
      registerWebPush(user.id).then(() => {
        // Verificar si la suscripción está activa
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            reg.pushManager.getSubscription().then(sub => {
              setPushSubscribed(!!sub);
            });
          });
        }
      });
    }
  }, [user?.id]);

  // Función manual para activar notificaciones (desde el botón de PwaInstallBanner)
  const enablePushNotifications = useCallback(async () => {
    if (!user?.id) return;
    
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[SW] Permiso de notificaciones denegado');
        return;
      }
    }

    await registerWebPush(user.id);

    // Verificar estado
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushSubscribed(!!sub);
    } catch { /* ignore */ }
  }, [user?.id]);

  useEffect(() => {
    if (!user || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        globalSocket = null;
        setConnected(false);
      }
      return;
    }

    if (!SOCKET_ENABLED) {
      setConnected(false);
      return;
    }

    const socket = io(API_URL, {
      auth: { token, user },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      roomsRef.current.forEach((room) => socket.emit('join', room));
      // Unirse a la sala personal del usuario para recibir notificaciones
      if (user?.id) {
        socket.emit('join', `usuario:${user.id}`);
      }
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('nota:created', (data) => {
      showBrowserNotif('Nueva nota', data.contenido?.slice(0, 80) || 'Nueva nota agregada');
    });

    socket.on('comentario:created', (data) => {
      showBrowserNotif('Nuevo comentario', data.contenido?.slice(0, 80) || 'Nuevo comentario agregado');
    });

    socket.on('metadatos:updated', (data) => {
      showBrowserNotif('Des/Hab actualizados', `Des: ${data.desayunos} · Hab: ${data.habitaciones}`);
    });

    socket.on('notificacion:created', (data) => {
      showBrowserNotif(data.titulo || 'Nueva notificación', data.mensaje || 'Tienes una nueva notificación');
    });

    socket.on('entity:changed', (data) => {
      window.dispatchEvent(new CustomEvent('entity:changed', { detail: data }));
    });

    socketRef.current = socket;
    globalSocket = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      globalSocket = null;
      setConnected(false);
    };
  }, [user, token]);

  const joinRoom = useCallback((room) => {
    roomsRef.current.add(room);
    if (socketRef.current?.connected) {
      socketRef.current.emit('join', room);
    }
  }, []);

  const leaveRoom = useCallback((room) => {
    roomsRef.current.delete(room);
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave', room);
    }
  }, []);

  const onEvent = useCallback((event, handler) => {
    const sock = socketRef.current;
    if (!sock) return () => {};
    sock.on(event, handler);
    return () => sock.off(event, handler);
  }, []);

  return (
    <SocketContext.Provider value={{ connected, joinRoom, leaveRoom, onEvent, socket: socketRef, pushSupported, pushSubscribed, enablePushNotifications }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

export function getSocket() {
  return globalSocket;
}
