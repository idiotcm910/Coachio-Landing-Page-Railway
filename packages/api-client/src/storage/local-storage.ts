import { LOCAL_STORAGE_KEYS, type LocalStorageKey } from './storage-keys';

export function getLocalStorageItem(key: LocalStorageKey): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

export function setLocalStorageItem(key: LocalStorageKey, value: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}

export function removeLocalStorageItem(key: LocalStorageKey): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
}

export function getAccessToken(): string | null {
  return getLocalStorageItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN);
}

export function setAuthTokens(accessToken: string, tokenType: string): void {
  setLocalStorageItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  setLocalStorageItem(LOCAL_STORAGE_KEYS.TOKEN_TYPE, tokenType);
}

export function clearAuthTokens(): void {
  removeLocalStorageItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN);
  removeLocalStorageItem(LOCAL_STORAGE_KEYS.TOKEN_TYPE);
  removeLocalStorageItem(LOCAL_STORAGE_KEYS.API_SERVICE_KEY);
}

export function getActiveApiKey(): string {
  return getLocalStorageItem(LOCAL_STORAGE_KEYS.API_SERVICE_KEY) || '';
}
