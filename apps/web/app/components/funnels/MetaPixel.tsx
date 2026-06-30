'use client';

/**
 * MetaPixel — bootstraps the Meta Pixel for a given Pixel ID using Meta's
 * official base-code snippet.
 *
 * Render this component only when `tracking_enabled && meta_pixel_id` are truthy
 * (enforced by the parent; this component does not guard itself).
 *
 * Why the inline base code (not a bare <Script src=fbevents.js>):
 * fbevents.js expects the `fbq` stub (with its queue) to already exist so that
 * `fbq('init')` / `fbq('track')` calls made before the SDK finishes loading are
 * queued and replayed. Loading the SDK without the stub leaves `window.fbq`
 * undefined at call time, so events never fire. The snippet below is Meta's
 * canonical bootstrap: it defines the stub, async-loads the SDK, then inits the
 * pixel and fires PageView.
 *
 * Design rules (D5, D6):
 * - `next/script` dedupes by `id`, so the base code runs once per page session.
 * - Ad-blockers may block the SDK — funnel pages render and function regardless.
 */

import Script from 'next/script';

// Extend the global Window with the fbq function signature.
declare global {
  interface Window {
    fbq: (
      action: string,
      eventOrPixelId: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string },
    ) => void;
    _fbq: unknown;
  }
}

interface MetaPixelProps {
  /** The Meta Pixel / Dataset ID to initialise. */
  pixelId: string;
}

export function MetaPixel({ pixelId }: MetaPixelProps) {
  return (
    <>
      {/* Meta official base code: defines the fbq stub, loads fbevents.js, then
          inits the pixel and fires PageView. afterInteractive = non-blocking. */}
      <Script
        id="meta-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `,
        }}
      />
      {/* Noscript fallback for browsers without JS / when script is blocked */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
