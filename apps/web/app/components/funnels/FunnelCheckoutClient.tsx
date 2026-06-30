'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { funnelsApi, getApiErrorMessage, type FunnelQuote, type FunnelCheckoutResult } from '@coachio/api-client';
import { addDiscountCode, removeDiscountCode } from './discount-codes-state';
import { FunnelBuyerForm } from './FunnelBuyerForm';
import { FunnelDiscountCodes } from './FunnelDiscountCodes';
import { FunnelOrderSummary } from './FunnelOrderSummary';
import { FunnelPaymentPanel } from './FunnelPaymentPanel';
import { useFunnelPageView } from './use-funnel-page-view';
import { CheckoutTemplateRenderer } from './checkout-templates/CheckoutTemplateRenderer';
import { resolveAccent } from './checkout-templates/checkout-template-types';
import { FunnelCheckoutSkeleton } from './funnel-skeletons';
import { MetaPixel } from './MetaPixel';
import { trackInitiateCheckout, trackAddToCart } from './use-funnel-tracking';
import { getFbCookies } from '../../_lib/meta-cookies';

interface FunnelCheckoutClientProps {
  slug: string;
}

export interface BuyerInfo {
  name: string;
  email: string;
  phone: string;
}

const VN_PHONE_RE = /^(0[3-9][0-9]{8}|(\+84)[3-9][0-9]{8})$/;

function validateBuyer(info: BuyerInfo): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!info.name.trim()) errors.name = 'Vui lòng nhập họ & tên';
  if (!info.email.trim()) {
    errors.email = 'Vui lòng nhập email';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email)) {
    errors.email = 'Email không hợp lệ';
  }
  if (!info.phone.trim()) {
    errors.phone = 'Vui lòng nhập số điện thoại';
  } else if (!VN_PHONE_RE.test(info.phone.replace(/\s/g, ''))) {
    errors.phone = 'Số điện thoại Việt Nam không hợp lệ (VD: 0912345678)';
  }
  return errors;
}

export function FunnelCheckoutClient({ slug }: FunnelCheckoutClientProps) {
  const router = useRouter();

  const [buyer, setBuyer] = useState<BuyerInfo>({ name: '', email: '', phone: '' });
  const [buyerErrors, setBuyerErrors] = useState<Record<string, string>>({});

  const [discountCodes, setDiscountCodes] = useState<string[]>([]);
  const [quote, setQuote] = useState<FunnelQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<FunnelCheckoutResult | null>(null);

  // Pixel id read from sessionStorage (written by FunnelLandingClient when landing loads).
  // The pixel SDK (window.fbq) persists across CSR navigation so this only drives
  // rendering the <MetaPixel> component when the visitor arrived directly at checkout.
  const [pixelId, setPixelId] = useState<string | null>(null);

  // Guard so InitiateCheckout fires exactly once when the checkout form is first shown.
  const initiateCheckoutFiredRef = useRef(false);

  // Track checkout-form vs payment-QR as distinct page views (keyed by stage).
  useFunnelPageView(slug, checkoutResult ? 'payment' : 'checkout');

  // Fetch initial quote (no codes) on mount
  useEffect(() => {
    fetchQuote([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read pixel id from sessionStorage (set by FunnelLandingClient) on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = sessionStorage.getItem(`funnel_pixel:${slug}`);
      if (stored) setPixelId(stored);
    } catch {
      /* storage blocked — non-critical */
    }
  }, [slug]);

  // Fire InitiateCheckout once when the checkout form is first shown and quote is ready.
  useEffect(() => {
    if (initiateCheckoutFiredRef.current) return;
    if (!quote) return; // wait for price to be available
    initiateCheckoutFiredRef.current = true;
    // Per-session event id for pre-order events (no order exists yet).
    const sessionEventId = `ic_${slug}_${Date.now()}`;
    trackInitiateCheckout(
      { value: quote.final_amount, currency: quote.currency },
      sessionEventId,
    );
  }, [quote, slug]);

  const fetchQuote = useCallback(
    async (codes: string[]) => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const q = await funnelsApi.quoteFunnelOrder(slug, codes);
        setQuote(q);
      } catch (err) {
        setQuoteError(getApiErrorMessage(err, 'Không thể tải thông tin đơn hàng'));
      } finally {
        setQuoteLoading(false);
      }
    },
    [slug],
  );

  const handleAddCode = useCallback(
    (raw: string) => {
      const next = addDiscountCode(discountCodes, raw);
      if (next === discountCodes) return; // no change (dup or empty)
      setDiscountCodes(next);
      fetchQuote(next);
    },
    [discountCodes, fetchQuote],
  );

  const handleRemoveCode = useCallback(
    (code: string) => {
      const next = removeDiscountCode(discountCodes, code);
      setDiscountCodes(next);
      fetchQuote(next);
    },
    [discountCodes, fetchQuote],
  );

  const handleSubmit = async () => {
    const errors = validateBuyer(buyer);
    if (Object.keys(errors).length > 0) {
      setBuyerErrors(errors);
      return;
    }
    setBuyerErrors({});
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Read Meta click-attribution cookies for CAPI Advanced Matching.
      // The same `clientEventId` is sent as the browser Pixel `eventID` (AddToCart)
      // AND as `event_id` in the API payload so the server CAPI can deduplicate the
      // pair. We generate it here — before the order exists — because we need it for
      // both the browser event and the API call simultaneously.
      const { fbp, fbc } = getFbCookies();
      const clientEventId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `atc_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // Fire AddToCart at submit time (order creation intent).
      trackAddToCart(
        { value: quote?.final_amount, currency: quote?.currency },
        clientEventId,
      );

      const result = await funnelsApi.checkoutFunnel(slug, {
        buyer_name: buyer.name,
        buyer_email: buyer.email,
        buyer_phone: buyer.phone,
        discount_codes: discountCodes,
        fbp: fbp ?? undefined,
        fbc: fbc ?? undefined,
        // Shared dedup id: browser Pixel AddToCart eventID == server CAPI event_id.
        event_id: clientEventId,
      });
      if (result.is_free || result.status === 'SUCCESS') {
        router.push(`/funnels/${slug}/success?order_id=${result.order_id}`);
        return;
      }
      setCheckoutResult(result);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Không thể tạo đơn hàng. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = useCallback(() => {
    if (checkoutResult) {
      router.push(`/funnels/${slug}/success?order_id=${checkoutResult.order_id}`);
    }
  }, [checkoutResult, router, slug]);

  // If payment panel is shown, render it full-screen style (mirrors PaymentModal layout as a page section)
  if (checkoutResult) {
    return (
      <>
        {/* Re-render MetaPixel in case visitor arrived directly at checkout URL. */}
        {pixelId && <MetaPixel pixelId={pixelId} />}
        <FunnelPaymentPanel
          result={checkoutResult}
          onSuccess={handlePaymentSuccess}
          onBack={() => setCheckoutResult(null)}
        />
      </>
    );
  }

  // Initial load: no quote yet → show a skeleton instead of the default-config
  // template (avoids a flash of the wrong template/accent before checkout_config
  // arrives). Gate on `!quoteError` (not `quoteLoading`) so the skeleton shows on
  // the very first render too — `quoteLoading` is still false until the mount
  // effect runs, which otherwise caused a flash of the default template first.
  // Re-fetches after a discount code keep `quote` set, so no skeleton then.
  if (!quote && !quoteError) {
    return <FunnelCheckoutSkeleton />;
  }

  const isFree = quote?.is_free ?? false;
  const config = quote?.checkout_config ?? {};
  const accent = resolveAccent(config.accent_color);

  // Các khối dùng chung — template chỉ sắp xếp vị trí. CTA tô theo accent admin chọn.
  const buyerForm = <FunnelBuyerForm buyer={buyer} errors={buyerErrors} onChange={setBuyer} />;
  const discountCodesNode = (
    <FunnelDiscountCodes
      codes={discountCodes}
      appliedDiscounts={quote?.discounts ?? []}
      onAdd={handleAddCode}
      onRemove={handleRemoveCode}
      loading={quoteLoading}
    />
  );
  const orderSummaryNode = <FunnelOrderSummary quote={quote} loading={quoteLoading} error={quoteError} />;
  const submitButton = (
    <div className="space-y-3">
      {submitError && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{submitError}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || quoteLoading}
        style={{ backgroundColor: accent }}
        className="w-full rounded-xl py-4 text-lg font-bold text-white shadow-lg transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? 'Đang xử lý...'
          : isFree
          ? 'Miễn phí — Xác nhận đăng ký'
          : 'Tiến hành thanh toán'}
      </button>
    </div>
  );

  return (
    <>
      {/* Initialise Pixel for direct checkout-page visitors (pixel id from sessionStorage). */}
      {pixelId && <MetaPixel pixelId={pixelId} />}
      <CheckoutTemplateRenderer
        slug={slug}
        config={config}
        accent={accent}
        quote={quote}
        buyerForm={buyerForm}
        discountCodes={discountCodesNode}
        orderSummary={orderSummaryNode}
        submitButton={submitButton}
      />
    </>
  );
}
