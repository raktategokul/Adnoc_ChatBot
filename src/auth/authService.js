/**
 * Authentication Service Client
 * 
 * Communicates with the backend /api/auth endpoints and manages local session token.
 */

const TOKEN_KEY = 'nexusai_auth_token';

export const authService = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  },

  removeToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  async register({ name, email, password }) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Registration failed.');
    }
    return data;
  },

  async login({ email, password }) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Login failed.');
    }

    if (data.token) {
      this.setToken(data.token);
    }

    return data;
  },

  async logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      this.removeToken();
    }
  },

  async getCurrentUser() {
    const token = this.getToken();
    if (!token) return null;

    const res = await fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      this.removeToken();
      return null;
    }

    const data = await res.json();
    return data.user;
  },
};
