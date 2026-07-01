'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import type { RedirectCreateInput, RedirectMatchType, RedirectStatusCode } from '@coachio/api-client';

const inputCls =
  'rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]';
const labelCls = 'text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]';

/** Build a wildcard preview: '/blog/*' + '/tin-tuc/*' → '/blog/abc' ⇒ '/tin-tuc/abc'. */
function wildcardPreview(source: string, target: string): string | null {
  if (!source.endsWith('/*') || !target.endsWith('/*')) return null;
  const sample = `${source.slice(0, -1)}abc`;
  const result = `${target.slice(0, -1)}abc`;
  return `${sample}  ⇒  ${result}`;
}

/** A wildcard prefix shorter than 3 chars (e.g. '/*') would catch most of the site. */
function isRiskyPrefix(source: string, matchType: RedirectMatchType): boolean {
  return matchType === 'wildcard' && source.replace(/\/\*$/, '').replace(/^\//, '').length < 2;
}

interface RedirectRuleFormProps {
  form: RedirectCreateInput;
  editing: boolean;
  saving: boolean;
  formError: string;
  onChange: (patch: Partial<RedirectCreateInput>) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function RedirectRuleForm({ form, editing, saving, formError, onChange, onSave, onCancel }: RedirectRuleFormProps) {
  const preview = form.match_type === 'wildcard' ? wildcardPreview(form.source_path, form.target_url) : null;
  const risky = isRiskyPrefix(form.source_path, form.match_type);

  return (
    <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
      <h3 className="mb-4 text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">
        {editing ? 'Edit redirect' : 'Add redirect'}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Old path (source) *</span>
          <input
            className={inputCls}
            value={form.source_path}
            onChange={(e) => onChange({ source_path: e.target.value })}
            placeholder={form.match_type === 'wildcard' ? '/blog/*' : '/old-course'}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>New URL (target) *</span>
          <input
            className={inputCls}
            value={form.target_url}
            onChange={(e) => onChange({ target_url: e.target.value })}
            placeholder={form.match_type === 'wildcard' ? '/news/*' : '/new-course'}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Match type</span>
          <select
            className={inputCls}
            value={form.match_type}
            onChange={(e) => onChange({ match_type: e.target.value as RedirectMatchType })}
          >
            <option value="exact">Exact match</option>
            <option value="wildcard">Prefix match (wildcard /*)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Redirect type</span>
          <select
            className={inputCls}
            value={form.status_code}
            onChange={(e) => onChange({ status_code: Number(e.target.value) as RedirectStatusCode })}
          >
            <option value={301}>301 — Permanent</option>
            <option value={302}>302 — Temporary</option>
          </select>
        </label>
      </div>

      {preview && (
        <p className="mt-3 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 font-mono text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
          Example: {preview}
        </p>
      )}

      {risky && (
        <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          Prefix is too short — this rule may redirect most of the website. Please double-check.
        </p>
      )}

      {formError && <p className="mt-3 text-sm font-semibold text-red-600">{formError}</p>}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] transition hover:bg-[var(--coachio-admin-dashboard-accent-hover)] disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {editing ? 'Save' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
