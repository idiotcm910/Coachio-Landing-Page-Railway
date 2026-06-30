import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendRequest } from './send-request';
import { LOCAL_STORAGE_KEYS } from '../storage/storage-keys';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function installBrowserMock() {
  const localStorage = new MemoryStorage();
  const listeners = new Map<string, Array<(event: Event) => void>>();

  vi.stubGlobal('window', {
    localStorage,
    addEventListener: (name: string, listener: (event: Event) => void) => {
      listeners.set(name, [...(listeners.get(name) ?? []), listener]);
    },
    dispatchEvent: (event: Event) => {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
  });

  return localStorage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendRequest', () => {
  it('clears auth tokens and emits session-expired when an authenticated request returns 401', async () => {
    const localStorage = installBrowserMock();
    localStorage.setItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN, 'expired-token');
    localStorage.setItem(LOCAL_STORAGE_KEYS.TOKEN_TYPE, 'bearer');
    localStorage.setItem(LOCAL_STORAGE_KEYS.API_SERVICE_KEY, 'api-key');

    const sessionExpired = vi.fn();
    window.addEventListener('coachio:session-expired', sessionExpired);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: 'Invalid authentication credentials' }),
    }));

    await sendRequest({
      url: '/api/v1/admin/courses/course-id/landing',
      method: 'GET',
    });

    expect(localStorage.getItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem(LOCAL_STORAGE_KEYS.TOKEN_TYPE)).toBeNull();
    expect(localStorage.getItem(LOCAL_STORAGE_KEYS.API_SERVICE_KEY)).toBeNull();
    expect(sessionExpired).toHaveBeenCalledTimes(1);
  });
});
