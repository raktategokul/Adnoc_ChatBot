import React, { createContext, useContext } from 'react';

const defaultUser = {
  id: 1,
  name: 'Gokul',
  email: 'user@company.com',
};

const AuthContext = createContext({
  user: defaultUser,
  isAuthenticated: true,
  loading: false,
  login: async () => ({ success: true, user: defaultUser }),
  register: async () => ({ success: true, user: defaultUser }),
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const value = {
    user: defaultUser,
    isAuthenticated: true,
    loading: false,
    login: async () => ({ success: true, user: defaultUser }),
    register: async () => ({ success: true, user: defaultUser }),
    logout: async () => {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  return context || {
    user: defaultUser,
    isAuthenticated: true,
    loading: false,
  };
}
