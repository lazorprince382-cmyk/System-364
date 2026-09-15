import { createContext, useContext, useEffect, useState } from 'react';

export const THEMES = [
  {
    id: 'ocean',
    name: 'Ocean & Navy',
    description: 'School navy and red (default)',
    preview: ['#152a5e', '#c41e3a', '#f9fafb'],
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Easier on the eyes in low light',
    preview: ['#1e293b', '#3b82f6', '#0f172a'],
  },
];

const STORAGE_KEY = 'toks-sacco-theme';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => localStorage.getItem(STORAGE_KEY) || 'ocean');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem(STORAGE_KEY, themeId);
  }, [themeId]);

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
