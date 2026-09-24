/**
 * Authentication Service Client
 * 
 * Communicates with the backend /api/auth endpoints and manages local session token.
 */

const TOKEN_KEY = 'nexusai_auth_token';

async function parseResponse(res, fallbackMessage) {
  let data = {};
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 504 || res.status === 502) {
      throw new Error('Backend server is unreachable. Please verify that the backend is running on port 5000.');
    }
    throw new Error(data.message || `${fallbackMessage} (${res.status})`);
  }

  return data;
}

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

    return await parseResponse(res, 'Registration failed.');
  },

  async login({ email, password }) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await parseResponse(res, 'Login failed.');

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

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        this.removeToken();
        return null;
      }

      const data = await parseResponse(res, 'Failed to fetch user.');
      return data.user;
    } catch (err) {
      console.warn('Failed to get current user:', err);
      return null;
    }
  },
};
