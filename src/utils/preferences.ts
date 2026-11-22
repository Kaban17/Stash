import { normalizeCompanyKey } from './internshipFilters.ts';

/**
 * Persistent UI preferences stored in localStorage.
 */

export const PREFERENCES_STORAGE_KEY = 'stazhtrek_preferences_v1';

export interface UserPreferences {
  hideExpired: boolean;
  excludedCompanies: string[];
  pinNewFirst: boolean;
  recentNewIds: string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  hideExpired: false,
  excludedCompanies: [],
  pinNewFirst: true,
  recentNewIds: [],
};

function sanitizeExcludedCompanies(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    const key = normalizeCompanyKey(trimmed);
    if (!trimmed || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function sanitizeIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result.slice(0, 300);
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Storage access can throw in restricted iframe/privacy contexts
  }
  return null;
}

export function loadUserPreferences(storage: StorageLike | null = getDefaultStorage()): UserPreferences {
  if (!storage) {
    return { ...DEFAULT_PREFERENCES, excludedCompanies: [], recentNewIds: [] };
  }
  try {
    const raw = storage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_PREFERENCES, excludedCompanies: [], recentNewIds: [] };
    }
    const parsed = JSON.parse(raw) as Partial<UserPreferences> | null;
    return {
      hideExpired: Boolean(parsed?.hideExpired),
      excludedCompanies: sanitizeExcludedCompanies(parsed?.excludedCompanies),
      pinNewFirst: typeof parsed?.pinNewFirst === 'boolean' ? parsed.pinNewFirst : true,
      recentNewIds: sanitizeIdList(parsed?.recentNewIds),
    };
  } catch {
    return { ...DEFAULT_PREFERENCES, excludedCompanies: [], recentNewIds: [] };
  }
}

export function saveUserPreferences(
  prefs: Partial<UserPreferences> & { hideExpired: boolean },
  storage: StorageLike | null = getDefaultStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        hideExpired: Boolean(prefs.hideExpired),
        excludedCompanies: sanitizeExcludedCompanies(prefs.excludedCompanies),
        pinNewFirst: typeof prefs.pinNewFirst === 'boolean' ? prefs.pinNewFirst : true,
        recentNewIds: sanitizeIdList(prefs.recentNewIds),
      })
    );
  } catch {
    // Ignore quota or storage security errors
  }
}
