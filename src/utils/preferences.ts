/**
 * Persistent UI preferences stored in localStorage.
 */

export const PREFERENCES_STORAGE_KEY = 'stazhtrek_preferences_v1';

export interface UserPreferences {
  hideExpired: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  hideExpired: false,
};

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
  if (!storage) return { ...DEFAULT_PREFERENCES };
  try {
    const raw = storage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<UserPreferences> | null;
    return {
      hideExpired: Boolean(parsed?.hideExpired),
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function saveUserPreferences(
  prefs: UserPreferences,
  storage: StorageLike | null = getDefaultStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        hideExpired: Boolean(prefs.hideExpired),
      })
    );
  } catch {
    // Ignore quota or storage security errors
  }
}
