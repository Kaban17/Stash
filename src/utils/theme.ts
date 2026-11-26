import type { ThemeMode } from './preferences.ts';

export type ResolvedTheme = 'light' | 'dark';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  return getSystemTheme();
}

export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
  }
  return resolved;
}

export function subscribeToSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia(DARK_MEDIA_QUERY);
  const handler = () => onChange();
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }
  mql.addListener(handler);
  return () => mql.removeListener(handler);
}
