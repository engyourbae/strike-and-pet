import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { THEME_STORAGE_KEY, isThemePreference, resolveTheme, type ThemePreference } from '@/utils/theme';

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ preference: 'light', setPreference: () => {} });

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(v) ? v : 'light'; // terang adalah default
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readStored);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(preference, mq.matches);
    };
    apply();
    if (preference !== 'system') return;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, p);
    } catch {
      /* penyimpanan tidak tersedia: preferensi hanya berlaku di sesi ini */
    }
  }, []);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
