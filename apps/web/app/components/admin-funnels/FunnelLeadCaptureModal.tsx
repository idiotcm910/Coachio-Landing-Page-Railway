'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, RefreshCw } from 'lucide-react';
import { adminFunnelsApi, getApiErrorMessage } from '@coachio/api-client';
import { AdminModal } from '../shared/AdminModal';
import { useToast } from '../shared/toast';

interface FunnelLeadCaptureModalProps {
  funnelId: string;
  onClose: () => void;
}

/** Mask token: show first 6 and last 4 chars, rest as *** */
function maskToken(token: string): string {
  if (token.length <= 12) return token.slice(0, 3) + '•••' + token.slice(-3);
  return token.slice(0, 6) + '••••••••' + token.slice(-4);
}

function useCopyButton(textToCopy: string) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback: ignore
    }
  }
  return { copied, handleCopy };
}

interface CopyButtonProps {
  text: string;
  label?: string;
}

function CopyButton({ text, label = 'Copy' }: CopyButtonProps) {
  const { copied, handleCopy } = useCopyButton(text);
  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      className="inline-flex h-7 items-center gap-1 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-2 text-xs text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

/** Build the embed snippet with the provided endpoint + token. */
function buildSnippet(captureEndpoint: string, token: string): string {
  return `<!-- Lead Capture Form — replace GOOGLE_SCRIPT_URL with this endpoint -->
<form id="leadForm" onsubmit="submitLead(event)">
  <input type="text"   id="leadName"  placeholder="Full name *" required>
  <input type="email"  id="leadEmail" placeholder="Email *"     required>
  <input type="tel"    id="leadPhone" placeholder="Phone number">
  <button type="submit" id="btnSubmit">Sign up to watch</button>
</form>

<script>
(function () {
  var CAPTURE_URL = "${captureEndpoint}";
  var TOKEN      = "${token}"; // Security: this token can only write leads to this funnel

  var urlParams = new URLSearchParams(window.location.search);

  window.submitLead = async function (e) {
    e.preventDefault();
    var btn = document.getElementById("btnSubmit");
    btn.disabled = true;
    btn.innerText = "Processing...";

    var ip = "";
    try {
      var ipRes = await fetch("https://api.ipify.org?format=json");
      ip = (await ipRes.json()).ip || "";
    } catch (_) {}

    var fd = new FormData();
    fd.append("token",        TOKEN);
    fd.append("name",         document.getElementById("leadName").value.trim());
    fd.append("email",        document.getElementById("leadEmail").value.trim());
    fd.append("phone",        document.getElementById("leadPhone").value.trim());
    fd.append("ip",           ip);
    fd.append("userAgent",    navigator.userAgent);
    fd.append("platform",     navigator.platform);
    fd.append("screen",       screen.width + "x" + screen.height);
    fd.append("referrer",     document.referrer);
    fd.append("landing",      window.location.href);
    fd.append("utm_source",   urlParams.get("utm_source")   || "");
    fd.append("utm_medium",   urlParams.get("utm_medium")   || "");
    fd.append("utm_campaign", urlParams.get("utm_campaign") || "");

    try {
      await fetch(CAPTURE_URL, { method: "POST", body: fd });
    } catch (err) {
      console.warn("Lead capture error:", err);
    }

    // Unlock the video / content here
    btn.innerText = "Subscribed!";
  };
})();
<\/script>`;
}

export function FunnelLeadCaptureModal({ funnelId, onClose }: FunnelLeadCaptureModalProps) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [isRotating, setIsRotating] = useState(false);
  const { success, error: toastError } = useToast();

  // Derive the public capture endpoint from the app's API base URL.
  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? '').replace('/api/v1', '');
  const captureEndpoint = `${apiBase}/api/v1/public/funnels/leads/capture`;

  useEffect(() => {
    let mounted = true;
    adminFunnelsApi.getCaptureToken(funnelId)
      .then((data) => { if (mounted) setToken(data.capture_token); })
      .catch(() => { /* show no token yet */ })
      .finally(() => { if (mounted) setIsLoadingToken(false); });
    return () => { mounted = false; };
  }, [funnelId]);

  async function handleRotate() {
    setIsRotating(true);
    try {
      const data = await adminFunnelsApi.rotateCaptureToken(funnelId);
      setToken(data.capture_token);
      success(token ? 'Token rotated successfully' : 'Token created successfully');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to create token'));
    } finally {
      setIsRotating(false);
    }
  }

  const snippet = token ? buildSnippet(captureEndpoint, token) : '';

  return (
    <AdminModal
      title="Lead Capture API"
      subtitle="Embed a custom landing-page lead form into the system"
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
    >
      <div className="space-y-5 text-sm">

        {/* Endpoint URL */}
        <div className="space-y-1.5">
          <p className="font-semibold text-[var(--coachio-admin-dashboard-text)]">Endpoint URL</p>
          <div className="flex items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2">
            <code className="flex-1 truncate font-mono text-xs text-[var(--coachio-admin-dashboard-text)]">
              {captureEndpoint}
            </code>
            <CopyButton text={captureEndpoint} label="Copy URL" />
          </div>
          <p className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
            Accepts <code className="font-mono">multipart/form-data</code> or JSON. CORS is open for cross-origin requests.
          </p>
        </div>

        {/* Capture Token */}
        <div className="space-y-1.5">
          <p className="font-semibold text-[var(--coachio-admin-dashboard-text)]">Capture Token</p>
          {isLoadingToken ? (
            <div className="flex items-center gap-2 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2">
              <code className="flex-1 truncate font-mono text-xs text-[var(--coachio-admin-dashboard-text)]">
                {token ? maskToken(token) : <span className="text-[var(--coachio-admin-dashboard-text-muted)]">No token yet</span>}
              </code>
              {token && <CopyButton text={token} label="Copy token" />}
              <button
                type="button"
                onClick={handleRotate}
                disabled={isRotating}
                className="inline-flex h-7 items-center gap-1 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-accent)] px-2 text-xs font-semibold text-[var(--coachio-admin-dashboard-accent)] transition hover:bg-[var(--coachio-admin-dashboard-accent-soft)] disabled:opacity-50"
              >
                {isRotating
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                {token ? 'Rotate' : 'Create token'}
              </button>
            </div>
          )}
          <p className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
            The token authenticates lead submissions. Put it in the <code className="font-mono">token</code> field of the form/body.
            If it leaks, rotate to invalidate the old one.
          </p>
        </div>

        {/* Fields reference */}
        <div className="space-y-1.5">
          <p className="font-semibold text-[var(--coachio-admin-dashboard-text)]">Data fields</p>
          <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)]">
                  <th className="px-3 py-2 text-left font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Field</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Required</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--coachio-admin-dashboard-border-subtle)]">
                {[
                  { field: 'token', required: true, desc: "Funnel's capture token" },
                  { field: 'email', required: true, desc: "Subscriber's email" },
                  { field: 'name', required: false, desc: 'Full name' },
                  { field: 'phone', required: false, desc: 'Phone number' },
                  { field: 'utm_source / utm_medium / utm_campaign', required: false, desc: 'UTM tracking params' },
                  { field: 'ip / userAgent / referrer / landing', required: false, desc: 'Browser metadata' },
                ].map(({ field, required, desc }) => (
                  <tr key={field} className="text-[var(--coachio-admin-dashboard-text-muted)]">
                    <td className="px-3 py-2 font-mono text-[var(--coachio-admin-dashboard-text)]">{field}</td>
                    <td className="px-3 py-2">{required ? <span className="font-semibold text-red-500">Required</span> : 'Optional'}</td>
                    <td className="px-3 py-2">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* HTML/JS Snippet */}
        {token && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-[var(--coachio-admin-dashboard-text)]">HTML/JS embed snippet</p>
              <CopyButton text={snippet} label="Copy code" />
            </div>
            <pre className="max-h-64 overflow-auto rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] p-3 font-mono text-[11px] leading-relaxed text-[var(--coachio-admin-dashboard-text)]">
              {snippet}
            </pre>
            <p className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
              Replace the CSS and HTML content with your own design. Keep the script to capture leads.
            </p>
          </div>
        )}

        {!token && !isLoadingToken && (
          <p className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] p-3 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
            Create a token first to see the HTML/JS embed snippet.
          </p>
        )}

      </div>
    </AdminModal>
  );
}
