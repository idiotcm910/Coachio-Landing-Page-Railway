'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'coachio:landing-theme';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => undefined,
  toggleTheme: () => undefined,
});

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    setThemeState(getInitialTheme());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.courseTheme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme: setThemeState,
    toggleTheme: () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
