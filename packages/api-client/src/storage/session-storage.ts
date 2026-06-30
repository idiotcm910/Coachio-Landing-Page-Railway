import type { SessionStorageKey } from './storage-keys';

export function getSessionItem(key: SessionStorageKey): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(key);
}

export function setSessionItem(key: SessionStorageKey, value: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(key, value);
}

export function removeSessionItem(key: SessionStorageKey): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(key);
}
