import { useEffect } from 'react';
import type { ThemePreference } from '@/types';

const STORAGE_KEY = 'wat.theme';

export function readStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

function apply(theme: ThemePreference): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}

/**
 * Applies the theme preference. The database is the source of truth; local
 * storage only prevents a flash of the wrong theme before the profile loads.
 */
export function useTheme(theme: ThemePreference | undefined): void {
  useEffect(() => {
    const effective = theme ?? readStoredTheme();
    apply(effective);
    window.localStorage.setItem(STORAGE_KEY, effective);

    if (effective !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => apply('system');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [theme]);
}
