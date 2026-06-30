import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.isConnected = false;
  }

  connect() {
    if (this.socket) return;

    // Conectar usando la misma base URL que la API
    // Si es relativa, asume la URL actual.
    const connectUrl = API_BASE_URL.startsWith('http') ? API_BASE_URL : window.location.origin;

    console.log(`[SocketService] Conectando a Socket.IO en: ${connectUrl}`);
    this.socket = io(connectUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
    });

    this.socket.on('connect', () => {
      console.log('[SocketService] Conectado exitosamente al servidor Socket.IO.');
      this.isConnected = true;
      
      // Re-registrar listeners si la conexión se cae y vuelve
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach(callback => {
          this.socket.off(event, callback);
          this.socket.on(event, callback);
        });
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.warn(`[SocketService] Desconectado de Socket.IO. Razón: ${reason}`);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('[SocketService] Error de conexión Socket.IO:', error.message);
      this.isConnected = false;
    });

    this.socket.on('entity:changed', (data) => {
      window.dispatchEvent(new CustomEvent('entity:changed', { detail: data }));
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }

    return () => this.off(event, callback);
  }

  off(event, callback) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  notifyListeners(event, data) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

export const socketService = new SocketService();
export default socketService;