'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { funnelsApi, getApiErrorMessage, type PublicFunnelLanding } from '@coachio/api-client';
import { LandingSectionFrame } from '../landing-shared/LandingSectionFrame';
import { useFunnelPageView } from './use-funnel-page-view';
import { MetaPixel } from './MetaPixel';
import { trackViewContent } from './use-funnel-tracking';

interface FunnelLandingClientProps {
  slug: string;
}

/**
 * Public funnel landing — fetched CLIENT-SIDE (CSR), mirroring the admin landing
 * preview. With SSR the section iframes were rendered into the initial HTML and
 * finished loading BEFORE React hydrated, so the parent's height-message listener
 * missed their first height posts and tall sections (hero) got clipped. Fetching
 * client-side guarantees the listener is mounted before any iframe is created —
 * exactly how the admin preview already works.
 *
 * SEO note: page <meta>/OG tags still come from the server `generateMetadata`,
 * so social/share previews are unaffected; only the body renders on the client.
 */
export function FunnelLandingClient({ slug }: FunnelLandingClientProps) {
  const router = useRouter();
  const [funnel, setFunnel] = useState<PublicFunnelLanding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guard so ViewContent fires exactly once after the landing data loads.
  const viewContentFiredRef = useRef(false);
  useFunnelPageView(slug, 'landing');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    viewContentFiredRef.current = false;
    funnelsApi
      .getPublicFunnel(slug)
      .then((data) => {
        if (!active) return;
        setFunnel(data);
        // Fire ViewContent once after landing loads — per-session event id derived
        // from slug (no order exists yet on landing).
        // Persist pixel id in sessionStorage so the checkout page (separate
        // client component) can initialise the Pixel without an extra API call.
        if (data.tracking_enabled && data.meta_pixel_id) {
          try {
            sessionStorage.setItem(`funnel_pixel:${slug}`, data.meta_pixel_id);
          } catch {
            /* storage blocked — non-critical */
          }
        }
        if (!viewContentFiredRef.current) {
          viewContentFiredRef.current = true;
          const sessionEventId = `vc_${slug}_${Date.now()}`;
          trackViewContent(
            {
              content_name: data.title,
              value: data.final_price,
              currency: data.currency,
            },
            sessionEventId,
          );
        }
      })
      .catch((e) => { if (active) setError(getApiErrorMessage(e, 'Không tìm thấy trang.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const handleAction = useCallback(
    (action: string, payload: string | null) => {
      if (action === 'checkout') {
        router.push(`/funnels/${slug}/checkout`);
      } else if (action === 'scroll' && payload) {
        const el = document.getElementById(`landing-section-${payload}`);
        if (!el) return;
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      }
      // All other actions are ignored silently.
    },
    [slug, router],
  );

  if (loading) {
    return <main className="min-h-screen animate-pulse bg-slate-100" aria-busy="true" aria-label="Đang tải trang" />;
  }

  if (error || !funnel) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10 text-gray-600">
        Không tìm thấy trang. Vui lòng kiểm tra lại đường dẫn.
      </main>
    );
  }

  const sorted = [...funnel.sections].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <main>
      {/* Initialise Meta Pixel only when tracking is enabled and a pixel id is set.
          MetaPixel fires PageView on init; ViewContent is fired above after data loads. */}
      {funnel.tracking_enabled && funnel.meta_pixel_id && (
        <MetaPixel pixelId={funnel.meta_pixel_id} />
      )}
      {sorted.map((section) => (
        <div key={section.id} id={`landing-section-${section.anchor || section.id}`}>
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
  );
}
