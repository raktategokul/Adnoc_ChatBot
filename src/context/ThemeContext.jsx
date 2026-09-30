import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Theme can be 'dark' or 'light'. Defaults to 'dark' for the ADNOC OASIS industrial mission control theme
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('oasis_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
    } catch {
      // Ignore localStorage access issues if any
    }
    return 'dark';
  });

  useEffect(() => {
    // Apply data-theme attribute to both html and body for full CSS selector support
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    
    // Also toggle light-theme / dark-theme class on body for convenient CSS rules
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }

    try {
      localStorage.setItem('oasis_theme', theme);
    } catch {
      // Ignore localStorage access issues if any
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if accessed outside ThemeProvider to avoid runtime crash
    return {
      theme: 'dark',
      isDark: true,
      toggleTheme: () => {},
      setTheme: () => {},
    };
  }
  return context;
}
