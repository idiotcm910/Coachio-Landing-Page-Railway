'use client';

import { useEffect, useRef, useState } from 'react';
import { Braces, Loader2 } from 'lucide-react';
import {
  adminFunnelsApi,
  adminProductsApi,
  getApiErrorMessage,
  type Funnel,
  type FunnelCheckoutConfig,
  type FunnelCheckoutTemplate,
  type FunnelUpdateInput,
  type Product,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { FunnelConfigWithPreview } from './previews/FunnelConfigWithPreview';
import { FunnelCheckoutPreview } from './previews/FunnelCheckoutPreview';
import { FunnelPaymentPreview } from './previews/FunnelPaymentPreview';
import { FunnelPreviewModal } from './previews/FunnelPreviewModal';
import { InsertVariableModal } from '../shared/variables/insert-variable-modal';
import { buildCheckoutVariables } from './funnelVariableLabels';
import {
  DEFAULT_SECTION_MAX_WIDTH,
  DEFAULT_SPLIT_LEFT_RATIO,
  DEFAULT_SPLIT_RIGHT_RATIO,
  SECTION_MAX_WIDTH_MAX,
  SECTION_MAX_WIDTH_MIN,
  SPLIT_RATIO_MAX,
  SPLIT_RATIO_MIN,
} from '../funnels/checkout-templates/checkout-template-types';

interface AdminFunnelCheckoutWorkspaceProps {
  funnel: Funnel;
  onUpdated: (updated: Funnel) => void;
}

type PreviewView = 'checkout' | 'payment';

const PREVIEW_TABS = [
  { id: 'checkout', label: 'Checkout page' },
  { id: 'payment', label: 'QR page' },
];

const inputClass =
  'rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]';

const TEMPLATE_OPTIONS: { id: FunnelCheckoutTemplate; label: string; desc: string }[] = [
  { id: 'split-hero', label: 'Split hero', desc: '2 columns: sales panel + form' },
  { id: 'header-band', label: 'Header band', desc: '1 column, gradient header + steps' },
  { id: 'order-sidebar', label: 'Order sidebar', desc: 'Form + sticky order card on the right' },
];
const DEFAULT_ACCENT = '#f97316';

function readConfig(funnel: Funnel): FunnelCheckoutConfig {
  return (funnel.checkout_config as FunnelCheckoutConfig | null) ?? {};
}

export function AdminFunnelCheckoutWorkspace({ funnel, onUpdated }: AdminFunnelCheckoutWorkspaceProps) {
  // checkout_config: headline/message + template/accent/custom_html. Price comes from the product.
  const initialConfig = readConfig(funnel);
  const [headline, setHeadline] = useState(initialConfig.headline ?? '');
  const [message, setMessage] = useState(initialConfig.message ?? '');
  const [template, setTemplate] = useState<FunnelCheckoutTemplate>(initialConfig.template ?? 'split-hero');
  const [accentColor, setAccentColor] = useState(initialConfig.accent_color ?? DEFAULT_ACCENT);
  const [customHtml, setCustomHtml] = useState(initialConfig.custom_html ?? '');
  // Split-hero layout: overall section max width (px) + left/right column ratios (fr).
  const [sectionMaxWidth, setSectionMaxWidth] = useState(initialConfig.section_max_width ?? DEFAULT_SECTION_MAX_WIDTH);
  const [splitLeftRatio, setSplitLeftRatio] = useState(initialConfig.split_left_ratio ?? DEFAULT_SPLIT_LEFT_RATIO);
  const [splitRightRatio, setSplitRightRatio] = useState(initialConfig.split_right_ratio ?? DEFAULT_SPLIT_RIGHT_RATIO);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [view, setView] = useState<PreviewView>('checkout');
  const [showFull, setShowFull] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [showVariables, setShowVariables] = useState(false);
  const customHtmlRef = useRef<HTMLTextAreaElement>(null);
  // Last caret position in the custom-HTML textarea, captured before the variables
  // modal steals focus so inserts land where the user left off.
  const lastCaretRef = useRef<number>(0);
  const { success, error: toastError } = useToast();

  function rememberCaret() {
    const el = customHtmlRef.current;
    if (el) lastCaretRef.current = el.selectionStart ?? el.value.length;
  }

  // Insert a {{token}} at the remembered caret position in the custom HTML.
  function insertToken(token: string) {
    const pos = Math.min(lastCaretRef.current, customHtml.length);
    setCustomHtml(customHtml.slice(0, pos) + token + customHtml.slice(pos));
    lastCaretRef.current = pos + token.length;
  }

  // When custom HTML is provided it replaces the title/description block, so the
  // plain headline/message inputs are disabled to avoid confusion.
  const htmlActive = customHtml.trim().length > 0;

  useEffect(() => {
    let mounted = true;
    adminProductsApi
      .get(funnel.product_id)
      .then((p) => { if (mounted) setProduct(p); })
      .catch(() => { /* preview falls back to sample data */ });
    return () => { mounted = false; };
  }, [funnel.product_id]);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaveOk(false);
    try {
      const checkoutConfig: FunnelCheckoutConfig = {
        headline,
        message,
        template,
        accent_color: accentColor,
        custom_html: customHtml.trim() ? customHtml : null,
        section_max_width: sectionMaxWidth,
        split_left_ratio: splitLeftRatio,
        split_right_ratio: splitRightRatio,
      };
      const input: FunnelUpdateInput = { checkout_config: checkoutConfig as Record<string, unknown> };
      const updated = await adminFunnelsApi.update(funnel.id, input);
      onUpdated(updated);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
      success('Checkout settings saved');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to save checkout settings');
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  const previewNode =
    view === 'checkout' ? (
      <FunnelCheckoutPreview
        headline={headline}
        message={message}
        template={template}
        accentColor={accentColor}
        customHtml={customHtml}
        sectionMaxWidth={sectionMaxWidth}
        splitLeftRatio={splitLeftRatio}
        splitRightRatio={splitRightRatio}
        productName={product?.name}
        price={product?.base_price}
      />
    ) : (
      <FunnelPaymentPreview price={product?.base_price} />
    );

  const form = (
    <>
      {/* Template picker */}
      <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
        <h3 className="mb-4 text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">Checkout page layout</h3>
        <div className="space-y-2">
          {TEMPLATE_OPTIONS.map((opt) => {
            const active = template === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTemplate(opt.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-[var(--coachio-admin-dashboard-radius-sm)] border px-4 py-3 text-left transition ${
                  active
                    ? 'border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-accent-subtle,rgba(249,115,22,0.08))]'
                    : 'border-[var(--coachio-admin-dashboard-border)] hover:bg-[var(--coachio-admin-dashboard-surface-hover)]'
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">{opt.label}</span>
                  <span className="block text-xs text-[var(--coachio-admin-dashboard-text-soft)]">{opt.desc}</span>
                </span>
                <span className={`grid h-5 w-5 place-items-center rounded-full border ${active ? 'border-[var(--coachio-admin-dashboard-accent)]' : 'border-[var(--coachio-admin-dashboard-border)]'}`}>
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-[var(--coachio-admin-dashboard-accent)]" />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Accent color */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Accent color</span>
          <input
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded border border-[var(--coachio-admin-dashboard-border)] bg-transparent"
            aria-label="Pick accent color"
          />
          <input
            className={`${inputClass} w-28`}
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            placeholder="#f97316"
          />
        </div>
      </div>

      {/* Split-hero layout: overall section width + left/right column widths */}
      {template === 'split-hero' && (
        <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
          <h3 className="mb-1 text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">Split hero layout</h3>
          <p className="mb-4 text-xs text-[var(--coachio-admin-dashboard-text-soft)]">Adjust the overall section width and the left/right column proportions.</p>

          {/* Overall section width */}
          <div className="mb-5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Section width</span>
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text)]">{sectionMaxWidth}px</span>
            </div>
            <input
              type="range"
              min={SECTION_MAX_WIDTH_MIN}
              max={SECTION_MAX_WIDTH_MAX}
              step={20}
              value={sectionMaxWidth}
              onChange={(e) => setSectionMaxWidth(Number(e.target.value))}
              className="w-full accent-[var(--coachio-admin-dashboard-accent)]"
              aria-label="Section width"
            />
          </div>

          {/* Left column width */}
          <div className="mb-5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Left column (sales panel)</span>
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text)]">{splitLeftRatio.toFixed(1)}fr</span>
            </div>
            <input
              type="range"
              min={SPLIT_RATIO_MIN}
              max={SPLIT_RATIO_MAX}
              step={0.1}
              value={splitLeftRatio}
              onChange={(e) => setSplitLeftRatio(Number(e.target.value))}
              className="w-full accent-[var(--coachio-admin-dashboard-accent)]"
              aria-label="Left column width"
            />
          </div>

          {/* Right column width */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Right column (form)</span>
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text)]">{splitRightRatio.toFixed(1)}fr</span>
            </div>
            <input
              type="range"
              min={SPLIT_RATIO_MIN}
              max={SPLIT_RATIO_MAX}
              step={0.1}
              value={splitRightRatio}
              onChange={(e) => setSplitRightRatio(Number(e.target.value))}
              className="w-full accent-[var(--coachio-admin-dashboard-accent)]"
              aria-label="Right column width"
            />
          </div>
        </div>
      )}

      {/* Title / description content */}
      <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
        <h3 className="mb-4 text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">Title &amp; description</h3>
        {htmlActive && (
          <p className="mb-3 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
            Custom HTML is active — it replaces the title and description below. Clear the custom HTML to edit them again.
          </p>
        )}
        <div className="space-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Title (headline)</span>
            <input
              className={`${inputClass} ${htmlActive ? 'cursor-not-allowed opacity-60' : ''}`}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              disabled={htmlActive}
              placeholder="Complete your order"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Message</span>
            <textarea
              rows={3}
              className={`${inputClass} ${htmlActive ? 'cursor-not-allowed opacity-60' : ''}`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={htmlActive}
              placeholder="Fill in your details to complete..."
            />
          </label>
          <label className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">
                Custom HTML (replaces title/description — leave empty to use the text above)
              </span>
              <button
                type="button"
                onClick={() => { rememberCaret(); setShowVariables(true); }}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-[var(--coachio-admin-dashboard-accent)] hover:underline"
              >
                <Braces className="h-3.5 w-3.5 shrink-0" />
                Insert variable
              </button>
            </div>
            <textarea
              ref={customHtmlRef}
              rows={5}
              className={`${inputClass} font-mono text-xs`}
              value={customHtml}
              onChange={(e) => setCustomHtml(e.target.value)}
              onSelect={rememberCaret}
              onClick={rememberCaret}
              onKeyUp={rememberCaret}
              onBlur={rememberCaret}
              placeholder="<h1>...</h1><p>...</p>"
            />
          </label>
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">{error}</p>}
      {saveOk && <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-success-text)]">Saved!</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="inline-flex h-10 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-5 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save settings
      </button>
    </>
  );

  return (
    <>
      <FunnelConfigWithPreview
        form={form}
        preview={previewNode}
        tabs={PREVIEW_TABS}
        activeTab={view}
        onTabChange={(id) => setView(id as PreviewView)}
        onOpenFull={() => setShowFull(true)}
      />
      <FunnelPreviewModal
        isOpen={showFull}
        onClose={() => setShowFull(false)}
        title={view === 'checkout' ? 'Checkout page' : 'Payment QR page'}
      >
        {previewNode}
      </FunnelPreviewModal>
      <InsertVariableModal
        open={showVariables}
        onClose={() => setShowVariables(false)}
        variables={buildCheckoutVariables(funnel.variables, funnel.variables_meta)}
        onInsert={insertToken}
        subtitle="Click a variable to insert it into the custom HTML. It is replaced with real data when the checkout page renders."
      />
    </>
  );
}
