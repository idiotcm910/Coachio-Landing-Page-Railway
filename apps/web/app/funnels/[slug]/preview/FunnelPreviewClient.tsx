'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFunnelsApi, getApiErrorMessage, useAuth, UserRole, type PublicFunnelLanding } from '@coachio/api-client';
import { LandingSectionFrame } from '../../../components/landing-shared/LandingSectionFrame';

interface FunnelPreviewClientProps {
  slug: string;
}

/**
 * Admin-gated preview of an unpublished funnel landing page.
 *
 * Slug → ID resolution: calls adminFunnelsApi.list() and matches by slug
 * client-side. This is the simplest approach given the admin endpoint is
 * id-based and no slug-based admin lookup exists.
 *
 * Auth: mirrors the /admin layout guard — checks useAuth() and redirects
 * non-admins to '/' (the root, which redirects to login). Draft content is
 * only rendered after the admin check passes.
 */
export function FunnelPreviewClient({ slug }: FunnelPreviewClientProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [funnel, setFunnel] = useState<PublicFunnelLanding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin auth guard — mirrors /admin/layout.tsx
  const isAdmin = isAuthenticated && user?.role === UserRole.ADMIN;

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      router.replace('/');
      return;
    }
  }, [isAuthenticated, isAuthLoading, router]);

  useEffect(() => {
    if (isAuthLoading || !isAdmin) return;

    let active = true;
    setLoading(true);
    setError(null);

    // Resolve slug → funnel id via admin list, then fetch the preview.
    adminFunnelsApi
      .list()
      .then((funnels) => {
        const match = funnels.find((f) => f.slug === slug);
        if (!match) throw new Error('Funnel không tìm thấy.');
        return adminFunnelsApi.getLandingPreview(match.id);
      })
      .then((data) => { if (active) setFunnel(data); })
      .catch((e) => { if (active) setError(getApiErrorMessage(e, 'Không thể tải trang xem trước.')); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [slug, isAdmin, isAuthLoading]);

  // Checkout/scroll actions are disabled in preview — CTAs still render but
  // clicking them is a no-op (or scrolls) so the visual preview is accurate.
  const handleAction = useCallback(
    (action: string, payload: string | null) => {
      if (action === 'scroll' && payload) {
        const el = document.getElementById(`preview-section-${payload}`);
        if (!el) return;
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      }
      // checkout and other actions are intentionally ignored in preview
    },
    [],
  );

  if (isAuthLoading || (!isAdmin && isAuthenticated)) {
    return (
      <main className="min-h-screen bg-[#f8f8f8] p-10 text-slate-900">
        {isAuthLoading ? 'Đang tải...' : 'Không có quyền truy cập.'}
      </main>
    );
  }

  if (!isAdmin) {
    // Redirect in progress
    return <main className="min-h-screen bg-[#f8f8f8] p-10 text-slate-900">Đang chuyển hướng...</main>;
  }

  if (loading) {
    return (
      <main className="min-h-screen animate-pulse bg-slate-100" aria-busy="true" aria-label="Đang tải trang xem trước" />
    );
  }

  if (error || !funnel) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10 text-gray-600">
        {error ?? 'Không tìm thấy trang. Vui lòng kiểm tra lại đường dẫn.'}
      </main>
    );
  }

  const sorted = [...funnel.sections].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      {/* Preview banner — non-intrusive top bar indicating this is a draft preview */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 9999,
          backgroundColor: '#f59e0b',
          color: '#1c1917',
          textAlign: 'center',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.01em',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }}
      >
        Bản xem trước — chưa publish
      </div>
      <main>
        {sorted.map((section) => (
          <div key={section.id} id={`preview-section-${section.anchor || section.id}`}>
            <LandingSectionFrame
              html={section.html}
              frameId={section.id}
              title={section.name}
              onAction={handleAction}
              isAuthenticated={false}
            />
          </div>
        ))}
      </main>
    </>
  );
}
