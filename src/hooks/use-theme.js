import { useCallback, useEffect, useState } from 'react';
const STORAGE_KEY = 'simak-theme';
function getSystemPreference() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function getStoredTheme() {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return null;
}
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    return getStoredTheme() ?? getSystemPreference();
  });
  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyTheme(newTheme);
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);
  useEffect(() => {
    applyTheme(theme);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (!getStoredTheme()) {
        const newTheme = getSystemPreference();
        setThemeState(newTheme);
        applyTheme(newTheme);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);
  return { theme, setTheme, toggleTheme };
}
