// Socket.IO desactivado: el servidor principal (puerto 3000) no usa Socket.IO.
// Se mantiene la clase con la misma interfaz para no romper el resto del código.

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.isConnected = false;
  }

  connect() {
    // Socket.IO no disponible en el servidor actual. Sin conexión.
  }

  disconnect() {
    this.socket = null;
    this.isConnected = false;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
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