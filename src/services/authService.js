import api from './api';

api.setOnUnauthorized(() => {
  if (window.location.pathname === '/login') {
    console.warn('[Auth] Evitando redirección recursiva 401 en la página de Login.');
    return;
  }
  authService.clearSession();
  window.location.href = '/login';
});

export const authService = {
  // Fetch active users for the login screen dropdown selector
  async getLoginUsers() {
    try {
      const response = await api.get('/api/login-users');
      return response?.users || [];
    } catch (error) {
      console.error('Error fetching login users:', error);
      return [];
    }
  },

  // Authenticate local user with MariaDB credentials
  async loginLocal(userId, password) {
    try {
      const response = await api.post('/api/login', { userId, password });
      if (response && response.ok && response.user) {
        this.saveSession(response.user, response.token);
        return response.user;
      }
      throw new Error(response?.message || 'Credenciales inválidas');
    } catch (error) {
      console.error('Error during local login:', error);
      throw error;
    }
  },

  // Synchronize and authenticate Firebase user (Google or Email) with MariaDB
  async loginFirebase(firebaseUser) {
    try {
      const payload = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        photoURL: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || firebaseUser.email)}&background=0ea5e9&color=fff`
      };

      const response = await api.post('/api/auth/firebase', payload);
      if (response && response.ok && response.user) {
        // Garantizar que el email siempre está presente.
        // Prioridad: BD → correo de Firebase (siempre disponible)
        const userWithEmail = {
          ...response.user,
          email: response.user.email || response.user.correo || firebaseUser.email,
          avatarDataUrl: response.user.avatarDataUrl || firebaseUser.photoURL || '',
        };
        console.log('[Auth] Usuario autenticado desde BD:', userWithEmail);
        this.saveSession(userWithEmail, response.token);
        return userWithEmail;
      }
      throw new Error(response?.message || 'Error sincronizando con el servidor');
    } catch (error) {
      console.error('Error during Firebase login sync:', error);
      throw error;
    }
  },

  // Save session details to localStorage
  saveSession(user, token) {
    localStorage.setItem('user', JSON.stringify({
      id: user.id,
      name: user.name,
      fullName: user.fullName || user.name,
      username: user.username,
      email: user.email || user.correo,
      avatarDataUrl: user.avatarDataUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.name)}&background=0ea5e9&color=fff`,
      signatureDataUrl: user.signatureDataUrl,
      role: user.rol || user.role || 'vendedor',
      teamId: user.teamId || user.equipo_id || null,
      canAuthorizeDiscount: user.canAuthorizeDiscount === true,
    }));
    if (token) {
      localStorage.setItem('token', token);
    }
  },

  // Get current logged-in user from localStorage
  getCurrentUser() {
    const token = localStorage.getItem('token');
    const rawUser = localStorage.getItem('user');
    if (!rawUser || !token) {
      this.clearSession();
      return null;
    }
    try {
      return JSON.parse(rawUser);
    } catch {
      this.clearSession();
      return null;
    }
  },

  // Clear session on logout
  clearSession() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }
};

export default authService;
