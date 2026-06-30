'use client';

/**
 * AdminFunnelTrackingWorkspace — admin form for per-funnel Meta Pixel + CAPI config.
 *
 * Saves `tracking_config` via the existing admin funnel update endpoint (PATCH).
 * The CAPI token is treated as a secret: stored in a password-type input; the
 * existing value (if any) comes back from the server masked / as-is.
 *
 * Toasts: success → "Tracking configuration saved"; error → getApiErrorMessage.
 */

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Globe, Loader2, PenLine, Workflow } from 'lucide-react';
import {
  adminFunnelsApi,
  getApiErrorMessage,
  type Funnel,
  type FunnelTrackingConfig,
  type FunnelTrackingDefaults,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';

interface AdminFunnelTrackingWorkspaceProps {
  funnel: Funnel;
  onUpdated: (updated: Funnel) => void;
}

const inputClass =
  'w-full rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]';

// Event-flow mapping shown in the tracking workspace (source of truth:
// docs/business-requirements-meta-tracking.md). channel: 'browser' = client Pixel,
// 'server' = server-side Conversions API fired from complete_order().
const EVENT_FLOW_STEPS: ReadonlyArray<{
  step: string;
  events: string[];
  channel: 'browser' | 'server';
  rule: string;
}> = [
  {
    step: 'Landing page opens',
    events: ['PageView', 'ViewContent'],
    channel: 'browser',
    rule: 'Fires as soon as the landing page loads.',
  },
  {
    step: 'Checkout opens',
    events: ['InitiateCheckout'],
    channel: 'browser',
    rule: 'Fires when the checkout page is shown.',
  },
  {
    step: 'Order submitted',
    events: ['AddToCart'],
    channel: 'browser',
    rule: 'Fires when the order is created on submit.',
  },
  {
    step: 'Order succeeds',
    events: ['Purchase', 'Lead'],
    channel: 'server',
    rule: 'Purchase when the paid amount is ≥ 10,000₫, otherwise Lead (free or under 10,000₫).',
  },
];

const channelLabel: Record<'browser' | 'server', string> = {
  browser: 'Browser · Pixel',
  server: 'Server · CAPI',
};

export function AdminFunnelTrackingWorkspace({ funnel, onUpdated }: AdminFunnelTrackingWorkspaceProps) {
  const initial = funnel.tracking_config ?? {};
  const [enabled, setEnabled] = useState<boolean>(initial.enabled ?? false);
  const [pixelId, setPixelId] = useState(initial.meta_pixel_id ?? '');
  const [capiToken, setCapiToken] = useState(initial.meta_capi_token ?? '');
  const [testEventCode, setTestEventCode] = useState(initial.meta_test_event_code ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);

  const { success, error: toastError } = useToast();

  // Global env defaults (non-secret) — used only to show whether this funnel
  // reports to the global default dataset or a custom override.
  const [defaults, setDefaults] = useState<FunnelTrackingDefaults | null>(null);
  useEffect(() => {
    let active = true;
    adminFunnelsApi
      .getTrackingDefaults()
      .then((d) => active && setDefaults(d))
      .catch(() => active && setDefaults(null));
    return () => {
      active = false;
    };
  }, []);

  // Origin of this funnel's current (saved) config, for the status banner.
  const savedPixel = funnel.tracking_config?.meta_pixel_id ?? '';
  const origin: 'default' | 'custom' | 'unconfigured' = !savedPixel
    ? 'unconfigured'
    : defaults?.configured && savedPixel === defaults.meta_pixel_id
      ? 'default'
      : 'custom';

  // Tracking can only be enabled once Pixel ID + CAPI token are SAVED (from the
  // funnel prop = DB state), not merely typed. Without credentials the backend
  // would skip sending anyway, so we block the ON state to avoid a misleading toggle.
  const saved = funnel.tracking_config ?? {};
  const isConfigured = Boolean(saved.meta_pixel_id && saved.meta_capi_token);

  // Persist the full config. `enabledOverride` lets the toggle save immediately
  // with its new value (React state updates are async, so we pass it explicitly).
  async function persist(okMsg: string, enabledOverride?: boolean) {
    setSaving(true);
    setError('');
    try {
      const trackingConfig: FunnelTrackingConfig = {
        enabled: enabledOverride ?? enabled,
        meta_pixel_id: pixelId.trim() || null,
        meta_capi_token: capiToken.trim() || null,
        meta_test_event_code: testEventCode.trim() || null,
      };
      const updated = await adminFunnelsApi.update(funnel.id, {
        tracking_config: trackingConfig,
      });
      onUpdated(updated);
      success(okMsg);
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Could not save tracking configuration');
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  // Toggle auto-saves so the enabled state survives a reload without an extra click.
  // Turning ON is only allowed after the credentials are saved.
  async function handleToggle() {
    const next = !enabled;
    if (next && !isConfigured) {
      toastError('Enter and save the Pixel ID + Access Token before enabling tracking.');
      return;
    }
    setEnabled(next);
    await persist(next ? 'Tracking enabled' : 'Tracking disabled', next);
  }

  return (
    <div className="space-y-6">
      {/* Status banner — tells the admin where this funnel's events are sent */}
      <div
        className={`flex items-start gap-3 rounded-[var(--coachio-admin-dashboard-radius-lg)] border p-4 ${
          origin === 'default'
            ? 'border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-accent-soft)]'
            : 'border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)]'
        }`}
      >
        {origin === 'default' ? (
          <Globe className="mt-0.5 h-5 w-5 shrink-0 text-[var(--coachio-admin-dashboard-accent)]" />
        ) : origin === 'custom' ? (
          <PenLine className="mt-0.5 h-5 w-5 shrink-0 text-[var(--coachio-admin-dashboard-text-soft)]" />
        ) : (
          <Globe className="mt-0.5 h-5 w-5 shrink-0 text-[var(--coachio-admin-dashboard-text-muted)]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">
              {origin === 'default'
                ? 'Using the global default dataset'
                : origin === 'custom'
                  ? 'Custom dataset for this funnel'
                  : 'Tracking not configured'}
            </span>
            {origin === 'default' && (
              <span className="rounded-full bg-[var(--coachio-admin-dashboard-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-inverse)]">
                Default
              </span>
            )}
            {origin === 'custom' && (
              <span className="rounded-full border border-[var(--coachio-admin-dashboard-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">
                Custom
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--coachio-admin-dashboard-text-muted)]">
            {origin === 'default' ? (
              <>
                New funnels start with the global default Meta dataset
                {savedPixel ? <> (Pixel <span className="font-mono">{savedPixel}</span>)</> : null} and tracking enabled.
                Edit the fields below to send <span className="font-medium">this funnel only</span> to a different dataset.
              </>
            ) : origin === 'custom' ? (
              <>
                This funnel reports to a custom Meta dataset
                {savedPixel ? <> (Pixel <span className="font-mono">{savedPixel}</span>)</> : null}
                {defaults?.configured ? ', overriding the global default.' : '.'}
              </>
            ) : defaults?.configured ? (
              <>
                A global default dataset is available but isn’t applied to this funnel yet.
                Enter credentials below, or recreate the funnel to inherit the default automatically.
              </>
            ) : (
              <>
                Meta tracking isn’t set up. Enter a Pixel ID and Access Token below — or set global
                defaults on the server so new funnels start tracking automatically.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Enable / disable toggle */}
      <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">
              Meta Pixel &amp; Conversions API
            </h3>
            <p className="mt-0.5 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
              Enable to send conversion events to Meta (browser Pixel + server-side CAPI). Toggling saves immediately.
            </p>
            {!isConfigured && !enabled && (
              <p className="mt-1.5 text-[11px] font-medium text-[var(--coachio-admin-dashboard-text-muted)]">
                Enter and save the Pixel ID + Access Token before enabling.
              </p>
            )}
          </div>
          {/* Toggle switch — disabled until credentials are saved */}
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={handleToggle}
            disabled={saving || (!enabled && !isConfigured)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
              enabled
                ? 'bg-[var(--coachio-admin-dashboard-accent)]'
                : 'bg-[var(--coachio-admin-dashboard-border)]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Credential fields */}
      <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
        <h3 className="mb-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">
          Configuration
        </h3>

        <div className="space-y-4">
          {/* Pixel / Dataset ID */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">
              Pixel ID / Dataset ID
            </span>
            <input
              className={inputClass}
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value)}
              placeholder="123456789012345"
              autoComplete="off"
            />
            <span className="text-[11px] text-[var(--coachio-admin-dashboard-text-muted)]">
              15–16 digit numeric ID in Meta Events Manager → Data Sources.
            </span>
          </label>

          {/* CAPI access token — password field */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">
              Conversions API Access Token
            </span>
            <input
              type="password"
              className={inputClass}
              value={capiToken}
              onChange={(e) => setCapiToken(e.target.value)}
              placeholder="Secret token — stored server-side only, never exposed"
              autoComplete="new-password"
            />
            <span className="text-[11px] text-[var(--coachio-admin-dashboard-text-muted)]">
              Created in Events Manager → Settings → Conversions API → Generate access token.
              Stored server-side only and never appears in any public payload.
            </span>
          </label>

          {/* Test event code */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">
              Test Event Code{' '}
              <span className="font-normal text-[var(--coachio-admin-dashboard-text-muted)]">(optional)</span>
            </span>
            <input
              className={inputClass}
              value={testEventCode}
              onChange={(e) => setTestEventCode(e.target.value)}
              placeholder="TEST12345"
              autoComplete="off"
            />
            <span className="text-[11px] text-[var(--coachio-admin-dashboard-text-muted)]">
              Fill in to verify events in the "Test Events" tab of Meta Events Manager.
              Leave empty when ready for production.
            </span>
          </label>
        </div>

        {error && (
          <p className="mt-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => persist('Tracking configuration saved')}
          disabled={saving}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-5 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save configuration
        </button>
      </div>

      {/* Event-flow explanation — which Meta event fires at which funnel step and the rule */}
      <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
        <button
          type="button"
          onClick={() => setFlowOpen((v) => !v)}
          aria-expanded={flowOpen}
          className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">
            <Workflow className="h-4 w-4 shrink-0 text-[var(--coachio-admin-dashboard-accent)]" />
            How Meta events map to funnel steps
          </span>
          {flowOpen ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-[var(--coachio-admin-dashboard-text-muted)]" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--coachio-admin-dashboard-text-muted)]" />
          )}
        </button>

        {flowOpen && (
          <div className="border-t border-[var(--coachio-admin-dashboard-border-subtle)] px-6 pb-6 pt-4">
            <ol className="space-y-3">
              {EVENT_FLOW_STEPS.map((item, index) => (
                <li
                  key={item.step}
                  className="flex gap-3 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border-subtle)] bg-[var(--coachio-admin-dashboard-surface-muted)] p-3"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--coachio-admin-dashboard-accent)] text-xs font-semibold text-[var(--coachio-admin-dashboard-text-inverse)]"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">
                        {item.step}
                      </span>
                      <span className="rounded-full border border-[var(--coachio-admin-dashboard-border)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-muted)]">
                        {channelLabel[item.channel]}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.events.map((ev) => (
                        <span
                          key={ev}
                          className="rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--coachio-admin-dashboard-accent)]"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--coachio-admin-dashboard-text-muted)]">
                      {item.rule}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--coachio-admin-dashboard-text-muted)]">
              Browser and CAPI events share an <span className="font-mono">event_id</span> per order so Meta deduplicates them.
              The Purchase/Lead threshold is configured globally (default 10,000₫).
            </p>
          </div>
        )}
      </div>

      {/* Expandable setup guide */}
      <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
        >
          <span className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">
            How to get your Pixel ID &amp; Access Token
          </span>
          {guideOpen ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-[var(--coachio-admin-dashboard-text-muted)]" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--coachio-admin-dashboard-text-muted)]" />
          )}
        </button>

        {guideOpen && (
          <div className="border-t border-[var(--coachio-admin-dashboard-border-subtle)] px-6 pb-6 pt-4 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
            <ol className="space-y-3 pl-4">
              <li className="list-decimal">
                <span className="font-semibold text-[var(--coachio-admin-dashboard-text)]">Open Meta Events Manager</span>
                {' '}— go to{' '}
                <a
                  href="https://business.facebook.com/events_manager"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[var(--coachio-admin-dashboard-accent)] underline underline-offset-2"
                >
                  business.facebook.com/events_manager
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li className="list-decimal">
                <span className="font-semibold text-[var(--coachio-admin-dashboard-text)]">Get the Pixel ID</span>
                {' '}— select your Data Source (Pixel/Dataset) → the "Settings" tab. The numeric ID sits right under the dataset name.
              </li>
              <li className="list-decimal">
                <span className="font-semibold text-[var(--coachio-admin-dashboard-text)]">Generate a CAPI Access Token</span>
                {' '}— on the same Settings page → the "Conversions API" section → click "Generate access token".
                Copy and paste it into the field above. The token is shown only once.
              </li>
              <li className="list-decimal">
                <span className="font-semibold text-[var(--coachio-admin-dashboard-text)]">Test Event Code (optional)</span>
                {' '}— the "Test Events" tab in Events Manager → paste the code into the "Test Event Code" field above
                so CAPI events show up in the testing view instead of production.
              </li>
              <li className="list-decimal">
                When you finish testing, clear the Test Event Code and save to switch to production mode.
              </li>
            </ol>
            <div className="mt-4">
              <a
                href="https://developers.facebook.com/docs/marketing-api/conversions-api/get-started/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[var(--coachio-admin-dashboard-accent)] underline underline-offset-2"
              >
                Read Meta's official documentation
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
