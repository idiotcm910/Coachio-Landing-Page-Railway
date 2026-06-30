'use client';

import { useState } from 'react';
import { Loader2, LayoutTemplate, Variable } from 'lucide-react';
import { adminFunnelsApi, getApiErrorMessage, type Funnel, type FunnelUpdateInput } from '@coachio/api-client';
import { FunnelConfigWithPreview } from './previews/FunnelConfigWithPreview';
import { SuccessPreview } from '../shared/success/SuccessPreview';
import { FunnelPreviewModal } from './previews/FunnelPreviewModal';
import { VariablesModal } from '../shared/variables/VariablesModal';
import { FUNNEL_SUCCESS_SYSTEM_VARIABLE_TOKENS, FUNNEL_CTA_ATTRIBUTE_TOKENS } from './funnelVariableTokens';
import { useToast } from '../shared/toast';
import { ThankYouTemplatePicker } from './thank-you-templates/ThankYouTemplatePicker';

interface AdminFunnelSuccessWorkspaceProps {
  funnel: Funnel;
  onUpdated: (updated: Funnel) => void;
}

const inputClass =
  'rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]';

export function AdminFunnelSuccessWorkspace({ funnel, onUpdated }: AdminFunnelSuccessWorkspaceProps) {
  const successCfg = (funnel.success_config as Record<string, string> | null) ?? {};
  const [zaloLink, setZaloLink] = useState(funnel.zalo_link ?? '');
  const [html, setHtml] = useState(successCfg.html ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const { success, error: toastError } = useToast();

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaveOk(false);
    try {
      const input: FunnelUpdateInput = {
        zalo_link: zaloLink || null,
        // HTML tùy chỉnh thay toàn bộ trang cảm ơn; rỗng → dùng template mặc định.
        success_config: { html: html.trim() },
      };
      const updated = await adminFunnelsApi.update(funnel.id, input);
      onUpdated(updated);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
      success('Thank-you page settings saved');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to save thank-you page settings');
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Auto-save handler called by ThankYouTemplatePicker on apply.
   * Merges scaffold variables into existing funnel variables (no existing vars lost).
   * Sends a single update: success_config.html + merged variables + zalo_link.
   */
  async function handleApplyTemplate(payload: {
    html: string;
    variables: Record<string, string>;
    zaloLink?: string;
  }) {
    setSaving(true);
    setError('');
    setSaveOk(false);
    try {
      const mergedVariables: Record<string, string> = {
        ...(funnel.variables ?? {}),
        ...payload.variables,
      };
      const newZaloLink = payload.zaloLink !== undefined ? payload.zaloLink : zaloLink;
      const input: FunnelUpdateInput = {
        success_config: { html: payload.html },
        zalo_link: newZaloLink || null,
        variables: mergedVariables,
      };
      const updated = await adminFunnelsApi.update(funnel.id, input);
      onUpdated(updated);
      // Sync local state with what was saved
      setHtml(payload.html);
      if (payload.zaloLink !== undefined) setZaloLink(payload.zaloLink);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
      success('Đã áp dụng mẫu và lưu trang cảm ơn thành công!');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Không thể lưu mẫu trang cảm ơn');
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  // Resolve {{tokens}} for the live preview so template HTML (which uses
  // {{primary_color}} inside style attributes) renders correctly instead of
  // leaving invalid CSS. Known keys (custom variables incl. primary_color +
  // a few system tokens) are substituted; unknown tokens stay literal so the
  // admin still sees them as placeholders — matching the server resolver intent.
  const previewVariables: Record<string, string> = {
    funnel_title: funnel.title ?? '',
    product_name: funnel.title ?? '',
    zalo_link: zaloLink ?? '',
    ...((funnel.variables as Record<string, string> | null) ?? {}),
  };
  const previewHtml = html.replace(
    /\{\{\s*([\w.]+)\s*\}\}/g,
    (match, key: string) => (key in previewVariables ? previewVariables[key] : match),
  );

  const previewNode = <SuccessPreview html={previewHtml} zaloLink={zaloLink} />;

  const form = (
    <>
      <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
        <h3 className="mb-1 text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">Thank-you page</h3>
        <p className="mb-4 text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
          Enter HTML to replace the <strong>entire</strong> thank-you page. Leave empty to use the default layout (🎉 + Zalo button).
        </p>
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Custom HTML</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker(true)}
                  className="inline-flex items-center gap-1.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-2.5 py-1 text-xs font-semibold text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]"
                >
                  <LayoutTemplate className="h-3.5 w-3.5" />
                  Start from template
                </button>
                <button
                  type="button"
                  onClick={() => setShowVariables(true)}
                  className="inline-flex items-center gap-1.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-2.5 py-1 text-xs font-semibold text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]"
                >
                  <Variable className="h-3.5 w-3.5" />
                  Variables
                </button>
              </div>
            </div>
            <textarea
              rows={18}
              className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder={'<section style="...">\n  <h1>Cảm ơn {{product_name}}!</h1>\n</section>'}
            />
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Zalo OA link</span>
            <input type="url" className={inputClass} value={zaloLink} onChange={(e) => setZaloLink(e.target.value)} placeholder="https://zalo.me/..." />
            <p className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
              Shows a &quot;Follow on Zalo&quot; button in the default layout, and available via the <code className="font-mono">{'{{zalo_link}}'}</code> variable in HTML.
            </p>
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
      <FunnelConfigWithPreview form={form} preview={previewNode} onOpenFull={() => setShowFull(true)} />
      <FunnelPreviewModal isOpen={showFull} onClose={() => setShowFull(false)} title="Thank-you page">
        {previewNode}
      </FunnelPreviewModal>
      <VariablesModal
        isOpen={showVariables}
        onClose={() => setShowVariables(false)}
        systemVariables={FUNNEL_SUCCESS_SYSTEM_VARIABLE_TOKENS}
        customVariables={funnel.variables}
        ctaAttributes={FUNNEL_CTA_ATTRIBUTE_TOKENS}
      />
      <ThankYouTemplatePicker
        open={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        currentHasHtml={!!html.trim()}
        onApply={handleApplyTemplate}
      />
    </>
  );
}
