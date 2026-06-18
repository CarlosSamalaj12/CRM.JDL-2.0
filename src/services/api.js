const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.token = null;
    this.onUnauthorized = null;
    this.onError = null;
  }

  setToken(token) {
    this.token = token;
  }

  setOnUnauthorized(handler) {
    this.onUnauthorized = handler;
  }

  setOnError(handler) {
    this.onError = handler;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });

      if (response.status === 401) {
        if (this.onUnauthorized) this.onUnauthorized();
        const error = await response.json().catch(() => ({ message: 'Sesión expirada' }));
        throw new ApiError(error.message || 'Sesión expirada', 401, 'AUTH_ERROR');
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const err = new ApiError(
          body?.error?.message || body?.message || `Error del servidor`,
          response.status,
          body?.error?.code || 'API_ERROR',
          body?.error?.details || body?.errors
        );
        if (this.onError) this.onError(err);
        throw err;
      }

      const data = await response.json();
      if (data && typeof data === 'object' && 'success' in data && !data.success) {
        const err = new ApiError(
          data?.error?.message || 'Error del servidor',
          response.status,
          data?.error?.code || 'API_ERROR'
        );
        if (this.onError) this.onError(err);
        throw err;
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const err = new ApiError(error.message || 'Error de conexión', 0, 'NETWORK_ERROR');
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  post(endpoint, data) {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) });
  }

  put(endpoint, data) {
    return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) });
  }

  patch(endpoint, data) {
    return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(data) });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export class ApiError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const api = new ApiClient();
export default api;
