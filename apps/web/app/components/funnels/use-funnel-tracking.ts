'use client';

/**
 * use-funnel-tracking — thin wrappers around Meta Pixel standard events.
 *
 * Design (D5, D6):
 * - Only fires UPPER-FUNNEL events: ViewContent, InitiateCheckout, AddToCart.
 * - Purchase / Lead are server-authoritative via CAPI — NEVER fired from here.
 * - Every fbq call is guarded: fires only when `window.fbq` is a function
 *   (i.e. MetaPixel script loaded and not blocked by an ad-blocker).
 * - eventID is optional; when provided it is passed as the Meta dedup `eventID`
 *   so the server CAPI can deduplicate the pair.
 */

/** Guard: returns true only when the Meta Pixel SDK is available on the page. */
function fbqReady(): boolean {
  return typeof window !== 'undefined' && typeof window.fbq === 'function';
}

export interface ViewContentParams {
  content_name?: string;
  /** Order value in the funnel's currency (e.g. VND). */
  value?: number;
  currency?: string;
  content_ids?: string[];
}

export interface InitiateCheckoutParams {
  value?: number;
  currency?: string;
  content_ids?: string[];
  num_items?: number;
}

export interface AddToCartParams {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_name?: string;
}

/**
 * Fires `ViewContent` — call after the landing payload loads successfully.
 * Pass `eventID` for server-side CAPI deduplication.
 */
export function trackViewContent(params: ViewContentParams, eventID?: string): void {
  if (!fbqReady()) return;
  window.fbq('track', 'ViewContent', params as Record<string, unknown>, eventID ? { eventID } : undefined);
}

/**
 * Fires `InitiateCheckout` — call when the checkout step opens.
 * Pass `eventID` for server-side CAPI deduplication.
 */
export function trackInitiateCheckout(params: InitiateCheckoutParams, eventID?: string): void {
  if (!fbqReady()) return;
  window.fbq('track', 'InitiateCheckout', params as Record<string, unknown>, eventID ? { eventID } : undefined);
}

/**
 * Fires `AddToCart` — called at checkout submit (order creation moment).
 * Pass `eventID` for server-side CAPI deduplication.
 */
export function trackAddToCart(params: AddToCartParams, eventID?: string): void {
  if (!fbqReady()) return;
  window.fbq('track', 'AddToCart', params as Record<string, unknown>, eventID ? { eventID } : undefined);
}
