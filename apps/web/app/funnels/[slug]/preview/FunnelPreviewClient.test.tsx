/**
 * Tests for FunnelPreviewClient — SSR-based, matching project test pattern.
 *
 * Because the component uses useEffect for data fetching, effects never fire
 * during renderToStaticMarkup (SSR). All assertions target the synchronous
 * render branches driven by the mocked useAuth() return value.
 *
 * Branches under test:
 *   1. isAuthLoading=true         → loading state "Đang tải..."
 *   2. not authenticated           → redirect state "Đang chuyển hướng..."
 *   3. authenticated, not admin    → access-denied "Không có quyền truy cập."
 *   4. admin (isAdmin=true)        → loading spinner (effects don't fire in SSR)
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// ── Mocks must be declared before the component import ─────────────────────

const mockRouterReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockRouterReplace, push: vi.fn() }),
}));

// Controlled useAuth — tests call setAuthState() before rendering.
let _authState = {
  user: null as { role: string } | null,
  isAuthenticated: false,
  isLoading: false,
};

vi.mock('@coachio/api-client', () => ({
  useAuth: () => _authState,
  UserRole: { ADMIN: 'admin', NORMAL_USER: 'normal_user' },
  adminFunnelsApi: {
    list: vi.fn().mockResolvedValue([]),
    getLandingPreview: vi.fn().mockResolvedValue({ sections: [] }),
  },
  getApiErrorMessage: vi.fn((_e: unknown, fallback: string) => fallback),
}));

// Stub LandingSectionFrame — exposes props as data-* for assertion.
vi.mock('../../../components/landing-shared/LandingSectionFrame', () => ({
  LandingSectionFrame: ({ html, frameId, title }: { html: string; frameId: string; title?: string }) =>
    createElement('div', {
      'data-testid': 'landing-section-frame',
      'data-frame-id': frameId,
      'data-title': title ?? '',
      dangerouslySetInnerHTML: { __html: html },
    }),
}));

// ── Import component after mocks ────────────────────────────────────────────

import { FunnelPreviewClient } from './FunnelPreviewClient';

// Helper to set auth state per test.
function setAuthState(state: typeof _authState) {
  _authState = state;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('FunnelPreviewClient', () => {
  it('shows loading text while auth is resolving (isLoading=true)', () => {
    setAuthState({ user: null, isAuthenticated: false, isLoading: true });
    const html = renderToStaticMarkup(
      createElement(FunnelPreviewClient, { slug: 'my-funnel' }),
    );
    expect(html).toContain('Đang tải...');
  });

  it('shows redirect state when not authenticated', () => {
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    const html = renderToStaticMarkup(
      createElement(FunnelPreviewClient, { slug: 'my-funnel' }),
    );
    // Component renders "Đang chuyển hướng..." — the useEffect redirect fires
    // async so in SSR we just see this placeholder.
    expect(html).toContain('Đang chuyển hướng...');
  });

  it('shows access-denied when authenticated but not admin', () => {
    setAuthState({
      user: { role: 'normal_user' },
      isAuthenticated: true,
      isLoading: false,
    });
    const html = renderToStaticMarkup(
      createElement(FunnelPreviewClient, { slug: 'my-funnel' }),
    );
    expect(html).toContain('Không có quyền truy cập.');
  });

  it('shows data-loading spinner when admin (effects fetch after SSR)', () => {
    setAuthState({
      user: { role: 'admin' },
      isAuthenticated: true,
      isLoading: false,
    });
    const html = renderToStaticMarkup(
      createElement(FunnelPreviewClient, { slug: 'my-funnel' }),
    );
    // Admin branch → loading=true (initial useState) → animate-pulse skeleton
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Đang tải trang xem trước"');
  });
});
