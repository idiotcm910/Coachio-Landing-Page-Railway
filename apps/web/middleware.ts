import { NextRequest, NextResponse } from 'next/server';

/**
 * Admin-configurable URL redirects (admin-url-redirects D1).
 *
 * Applies redirect rules fetched from the backend public config BEFORE the route
 * is rendered. 404 fallback is handled separately in `app/not-found.tsx` (the
 * middleware cannot know whether a route is a real 404).
 *
 * Config is cached in-module with a short TTL — middleware runs on the edge where
 * the Next Data Cache is unavailable, so we cache manually per runtime instance.
 */

type MatchType = 'exact' | 'wildcard';

interface RedirectRule {
  source_path: string;
  target_url: string;
  match_type: MatchType;
  status_code: number;
  is_active: boolean;
}

interface PublicConfig {
  rules: RedirectRule[];
  not_found: { enabled: boolean; target_url: string };
}

const CONFIG_TTL_MS = 60_000;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
const CONFIG_ENDPOINT = `${BACKEND_URL}/api/v1/public/url-redirects/config`;

let cache: { data: PublicConfig | null; expiresAt: number } = { data: null, expiresAt: 0 };

async function getConfig(now: number): Promise<PublicConfig | null> {
  if (cache.data && now < cache.expiresAt) return cache.data;
  try {
    const res = await fetch(CONFIG_ENDPOINT, { cache: 'no-store' });
    if (!res.ok) return cache.data;
    const json = await res.json();
    const data: PublicConfig = json?.data ?? json;
    if (!data || !Array.isArray(data.rules)) return cache.data;
    cache = { data, expiresAt: now + CONFIG_TTL_MS };
    return data;
  } catch {
    return cache.data;
  }
}

/** Mirror of backend resolve_redirect: exact wins, then wildcard prefix (suffix preserved). */
function resolveRedirect(path: string, rules: RedirectRule[]): { target: string; status: number } | null {
  const active = rules.filter((r) => r.is_active);

  for (const rule of active) {
    if (rule.match_type === 'exact' && rule.source_path === path && rule.target_url !== path) {
      return { target: rule.target_url, status: rule.status_code };
    }
  }

  for (const rule of active) {
    if (rule.match_type !== 'wildcard' || !rule.source_path.endsWith('/*')) continue;
    const prefix = rule.source_path.slice(0, -1); // '/blog/*' -> '/blog/'
    if (path === prefix.replace(/\/+$/, '') || path.startsWith(prefix)) {
      const suffix = path.startsWith(prefix) ? path.slice(prefix.length) : '';
      const targetPrefix = rule.target_url.endsWith('/*') ? rule.target_url.slice(0, -1) : rule.target_url;
      const target = `${targetPrefix}${suffix}`;
      if (target !== path) return { target, status: rule.status_code };
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const config = await getConfig(Date.now());
  if (!config) return NextResponse.next();

  const match = resolveRedirect(pathname, config.rules);
  if (!match) return NextResponse.next();

  const url = request.nextUrl.clone();
  // Internal target only (validated admin-side). Preserve query string.
  const [targetPath, targetQuery] = match.target.split('?');
  url.pathname = targetPath;
  url.search = targetQuery ? `?${targetQuery}` : search;
  return NextResponse.redirect(url, match.status);
}

export const config = {
  // Exclude Next internals, the API proxy, and static asset files from the matcher.
  matcher: ['/((?!_next/static|_next/image|api/|favicon.ico|.*\\.[\\w]+$).*)'],
};
