import React, { createContext, useContext, useEffect, useState } from 'react';
import type { DiarySettings } from '../types';

type AppTheme = DiarySettings['theme'];

interface ThemeContextValue {
  theme: AppTheme;
  reducedMotion: boolean;
  setTheme: (theme: AppTheme) => void;
  setReducedMotion: (reduced: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  reducedMotion: false,
  setTheme: () => {},
  setReducedMotion: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>('dark');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.dataset.theme = 'dark';
    } else {
      root.classList.remove('dark');
      root.dataset.theme = theme;
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
  }, [reducedMotion]);

  return (
    <ThemeContext.Provider value={{ theme, reducedMotion, setTheme, setReducedMotion }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
