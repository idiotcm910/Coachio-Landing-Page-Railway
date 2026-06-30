/**
 * Utilities for reading Meta click-attribution cookies (`_fbp`, `_fbc`).
 * Used in the funnel checkout flow to forward browser-side attribution signals
 * to the server so they can be included in the CAPI conversion event.
 *
 * SSR-safe: all `document`/`window` accesses are guarded by typeof checks.
 */

/** Reads a single cookie value by name. Returns null when absent or on SSR. */
function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Returns the Meta `_fbp` and `_fbc` cookies.
 *
 * If `_fbc` is absent but the current URL carries an `fbclid` query parameter,
 * a synthetic `_fbc` is derived in the standard format:
 *   `fb.1.<unix_ts_ms>.<fbclid>`
 *
 * Both values are `null` when not found.
 */
export function getFbCookies(): { fbp: string | null; fbc: string | null } {
  const fbp = getCookieValue('_fbp');
  let fbc = getCookieValue('_fbc');

  // Derive _fbc from the `fbclid` URL parameter when the cookie is absent.
  if (!fbc && typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const fbclid = urlParams.get('fbclid');
    if (fbclid) {
      fbc = `fb.1.${Date.now()}.${fbclid}`;
    }
  }

  return { fbp, fbc };
}
