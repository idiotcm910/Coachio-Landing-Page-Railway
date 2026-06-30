/**
 * Tests for funnel-landing-lead-capture FE changes (task 5.3).
 * Uses renderToStaticMarkup (SSR, no DOM/hooks) — consistent with the project test pattern.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// ── Mock heavy async dependencies so SSR doesn't hang ──────────────────────

vi.mock('@coachio/api-client', () => ({
  adminFunnelsApi: {
    getCaptureToken: vi.fn().mockResolvedValue({ capture_token: null }),
    rotateCaptureToken: vi.fn().mockResolvedValue({ capture_token: 'tok_abc123' }),
  },
  getApiErrorMessage: vi.fn((e: unknown, fallback: string) => fallback),
}));

// AdminModal is used by FunnelLeadCaptureModal — keep its DOM structure intact.
vi.mock('../shared/AdminModal', () => ({
  AdminModal: ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) =>
    createElement('div', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      createElement('p', { 'data-testid': 'modal-title' }, title),
      subtitle ? createElement('p', { 'data-testid': 'modal-subtitle' }, subtitle) : null,
      children,
    ),
}));

vi.mock('../shared/toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

// ── Import components after mocks ───────────────────────────────────────────

import { FunnelLeadCaptureModal } from './FunnelLeadCaptureModal';
import { AdminFunnelLeadsWorkspace } from './AdminFunnelLeadsWorkspace';

// AdminLeadsManagement pulls in live API calls — stub it to a simple div.
vi.mock('./AdminLeadsManagement', () => ({
  AdminLeadsManagement: ({ funnelId }: { funnelId?: string }) =>
    createElement('div', { 'data-testid': 'leads-management', 'data-funnel-id': funnelId ?? '' }),
}));

vi.mock('./FunnelLeadCaptureModal', async (importOriginal) => {
  const real = await importOriginal<typeof import('./FunnelLeadCaptureModal')>();
  return real; // use real impl for modal tests; workspace tests mock it below
});

// ── FunnelLeadCaptureModal tests ────────────────────────────────────────────

describe('FunnelLeadCaptureModal', () => {
  it('renders modal dialog with correct title', () => {
    const html = renderToStaticMarkup(
      createElement(FunnelLeadCaptureModal, {
        funnelId: 'funnel-1',
        onClose: vi.fn(),
      }),
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Lead Capture API');
  });

  it('shows the capture endpoint URL derived from env', () => {
    // NEXT_PUBLIC_API_URL is undefined in test env; endpoint falls back to /api/v1/public/funnels/leads/capture
    const html = renderToStaticMarkup(
      createElement(FunnelLeadCaptureModal, {
        funnelId: 'funnel-1',
        onClose: vi.fn(),
      }),
    );
    expect(html).toContain('/api/v1/public/funnels/leads/capture');
  });

  it('renders loading spinner before token is resolved', () => {
    // Modal starts in loading state (useEffect hasn't fired in SSR)
    const html = renderToStaticMarkup(
      createElement(FunnelLeadCaptureModal, {
        funnelId: 'funnel-1',
        onClose: vi.fn(),
      }),
    );
    // Should show "Loading..." or spinner while loading
    expect(html).toContain('Loading');
  });

  it('shows required fields table with token and email rows', () => {
    const html = renderToStaticMarkup(
      createElement(FunnelLeadCaptureModal, {
        funnelId: 'funnel-1',
        onClose: vi.fn(),
      }),
    );
    expect(html).toContain('token');
    expect(html).toContain('email');
    expect(html).toContain('Required');
  });

  it('shows the copy button label on endpoint URL', () => {
    // The rotate button only renders after the async getCaptureToken resolves (post-SSR);
    // verify instead that the endpoint copy button is present with its label.
    const html = renderToStaticMarkup(
      createElement(FunnelLeadCaptureModal, {
        funnelId: 'funnel-1',
        onClose: vi.fn(),
      }),
    );
    expect(html).toContain('Copy URL');
  });
});

// ── AdminFunnelLeadsWorkspace tests ─────────────────────────────────────────

describe('AdminFunnelLeadsWorkspace', () => {
  it('renders the "Get embed code" button', () => {
    const html = renderToStaticMarkup(
      createElement(AdminFunnelLeadsWorkspace, { funnelId: 'funnel-abc' }),
    );
    expect(html).toContain('Get embed code');
  });

  it('renders AdminLeadsManagement with correct funnelId', () => {
    const html = renderToStaticMarkup(
      createElement(AdminFunnelLeadsWorkspace, { funnelId: 'funnel-abc' }),
    );
    expect(html).toContain('data-funnel-id="funnel-abc"');
  });

  it('does not render modal initially', () => {
    const html = renderToStaticMarkup(
      createElement(AdminFunnelLeadsWorkspace, { funnelId: 'funnel-abc' }),
    );
    // Modal has role="dialog" — should not be present before button click
    expect(html).not.toContain('role="dialog"');
  });
});
