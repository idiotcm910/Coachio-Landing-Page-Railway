'use client';

import { useEffect, useRef } from 'react';
import { funnelsApi, type FunnelPageType } from '@coachio/api-client';

const VISITOR_KEY = 'funnel_visitor_id';

/** Reuse a stable anonymous visitor id across funnel pages (no PII). */
function getOrCreateVisitorId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return undefined; // private mode / storage blocked → still track without visitor id
  }
}

/**
 * Fires a single best-effort page-view ping for funnel analytics on mount.
 * Keyed by (slug, page) so a stage change (checkout → payment) records a new view.
 */
export function useFunnelPageView(slug: string | undefined, page: FunnelPageType): void {
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const key = `${slug}:${page}`;
    if (firedRef.current === key) return; // guard double-fire (StrictMode / re-render)
    firedRef.current = key;
    void funnelsApi.trackPageView(slug, page, getOrCreateVisitorId());
  }, [slug, page]);
}
