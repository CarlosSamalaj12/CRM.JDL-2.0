import { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL || window.location.origin;
const SOCKET_ENABLED = import.meta.env.VITE_REPORTS_SOCKET === 'true';

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

export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const roomsRef = useRef(new Set());

  useEffect(() => {
    requestNotifPermission();
  }, []);

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
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('nota:created', (data) => {
      showBrowserNotif('Nueva nota', data.contenido?.slice(0, 80) || 'Nueva nota agregada');
    });

    socket.on('metadatos:updated', (data) => {
      showBrowserNotif('Des/Hab actualizados', `Des: ${data.desayunos} · Hab: ${data.habitaciones}`);
    });

    socket.on('informe:created', (data) => {
      showBrowserNotif('Nuevo informe', `Versión ${data.version} creada`);
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
    <SocketContext.Provider value={{ connected, joinRoom, leaveRoom, onEvent, socket: socketRef }}>
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
