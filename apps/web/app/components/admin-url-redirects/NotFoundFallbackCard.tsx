'use client';

import { useState } from 'react';
import { Loader2, Compass } from 'lucide-react';
import { adminUrlRedirectsApi, getApiErrorMessage, type NotFoundConfig } from '@coachio/api-client';
import { useToast } from '../shared/toast';

const inputCls =
  'rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]';

interface NotFoundFallbackCardProps {
  initialConfig: NotFoundConfig;
}

export function NotFoundFallbackCard({ initialConfig }: NotFoundFallbackCardProps) {
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [targetUrl, setTargetUrl] = useState(initialConfig.target_url || '/');
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await adminUrlRedirectsApi.updateNotFoundConfig({ enabled, target_url: targetUrl });
      setEnabled(saved.enabled);
      setTargetUrl(saved.target_url);
      success('404 page settings saved');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to save 404 settings'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
      <div className="mb-2 inline-flex items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-accent-soft)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-3 py-1 text-xs font-semibold uppercase text-[var(--coachio-admin-dashboard-accent)]">
        <Compass className="h-4 w-4" />
        404 Page
      </div>
      <p className="mb-4 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
        When enabled, visitors hitting a non-existent route are redirected to the target page instead of seeing the 404 screen.
      </p>

      <label className="flex items-center gap-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
        Enable 404 redirect
      </label>

      <label className="mt-4 flex max-w-md flex-col gap-1">
        <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Target page</span>
        <input
          className={inputCls}
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="/"
          disabled={!enabled}
        />
      </label>

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] transition hover:bg-[var(--coachio-admin-dashboard-accent-hover)] disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save settings
      </button>
    </div>
  );
}
