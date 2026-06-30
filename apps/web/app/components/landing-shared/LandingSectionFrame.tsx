'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildLandingCustomHtmlFrameDocument,
  LANDING_CUSTOM_HTML_IFRAME_ACTION_MESSAGE,
  LANDING_CUSTOM_HTML_IFRAME_AUTH_MESSAGE,
  LANDING_CUSTOM_HTML_IFRAME_ERROR_MESSAGE,
  LANDING_CUSTOM_HTML_IFRAME_HEIGHT_MESSAGE,
} from './landingCustomHtml';

export type LandingFrameAction = (action: string, payload: string | null) => void;

interface LandingSectionFrameProps {
  /** Admin-authored raw section HTML (full document or fragment). Rendered as-is inside the iframe. */
  html: string;
  /** Stable id used to match postMessage events to this frame. */
  frameId: string;
  title?: string;
  /** Invoked when an in-iframe CTA bridges out (checkout / auth / scroll). */
  onAction?: LandingFrameAction;
  /** Pushed into the iframe so `[data-landing-guest-only]` CTAs hide once logged in. */
  isAuthenticated?: boolean;
}

/**
 * Renders one landing section's raw HTML inside an isolated <iframe srcdoc>.
 *
 * Isolation is the whole point: the section's <style>/<script> (h2dev templates ship
 * global resets like `html{font-size:62.5%}`, bare `input{}`/`label{}`, `.hidden{...!important}`)
 * stay inside the iframe document and can no longer leak onto the shared React chrome
 * (VibeHeader, AuthModal, ...). The iframe runtime (see buildLandingCustomHtmlFrameDocument)
 * reports its content height back so we can size the frame to fit (no inner scrollbar),
 * and bridges CTA clicks to `onAction`.
 */
export function LandingSectionFrame({ html, frameId, title, onAction, isAuthenticated = false }: LandingSectionFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);

  // Keep the latest onAction without re-subscribing the message listener every render.
  const onActionRef = useRef<LandingFrameAction | undefined>(onAction);
  onActionRef.current = onAction;

  // Latest auth value, read by postAuthState() without re-creating it.
  const isAuthRef = useRef(isAuthenticated);
  isAuthRef.current = isAuthenticated;
  const loadedRef = useRef(false);

  const srcDoc = useMemo(() => buildLandingCustomHtmlFrameDocument(html, frameId), [html, frameId]);

  // Push auth state into the iframe so it can hide [data-landing-guest-only] CTAs.
  const postAuthState = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: LANDING_CUSTOM_HTML_IFRAME_AUTH_MESSAGE, frameId, authenticated: !!isAuthRef.current }, '*');
  }, [frameId]);

  // Re-sync whenever auth changes (only once the frame has finished loading).
  useEffect(() => {
    if (loadedRef.current) postAuthState();
  }, [isAuthenticated, postAuthState]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const frame = iframeRef.current;
      // srcdoc iframes are same-origin; still verify the message came from this frame.
      if (!frame || event.source !== frame.contentWindow) return;
      const data = (event.data || {}) as { type?: string; frameId?: string; height?: number; action?: string; payload?: string | null };
      if (data.frameId !== frameId) return;

      if (data.type === LANDING_CUSTOM_HTML_IFRAME_HEIGHT_MESSAGE && typeof data.height === 'number') {
        setHeight(Math.max(0, Math.ceil(data.height)));
      } else if (data.type === LANDING_CUSTOM_HTML_IFRAME_ACTION_MESSAGE) {
        onActionRef.current?.(String(data.action || ''), data.payload ?? null);
      } else if (data.type === LANDING_CUSTOM_HTML_IFRAME_ERROR_MESSAGE) {
        console.warn('[LandingSectionFrame] iframe script error', data);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [frameId]);

  if (!html.trim()) return null;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      title={title || 'Landing section'}
      onLoad={() => { loadedRef.current = true; postAuthState(); }}
      // Frame is sized to its content, so it must never scroll internally — the page scrolls.
      scrolling="no"
      style={{
        display: 'block',
        width: '100%',
        border: 0,
        // Overlap the next frame by 1px to hide the sub-pixel hairline (white page
        // background bleeding through between stacked iframes from fractional height
        // rounding). Only the dead 1px at the bottom is covered — no content is lost.
        marginBottom: '-1px',
        // Min height avoids a 0px flash before the first height message arrives.
        height: height ? `${height}px` : '60vh',
      }}
    />
  );
}
