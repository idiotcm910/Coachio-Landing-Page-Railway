'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Braces, ImageIcon, Layers, Loader2, RefreshCw, Send, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  adminFunnelsApi, adminProductsApi, getApiErrorMessage,
  type FunnelEmailTemplate, type FunnelEmailTemplateInput, type MediaAsset,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { MediaPicker, buildMediaSnippet } from '../shared/media-picker';
import { InsertVariableModal } from '../shared/variables/insert-variable-modal';
import { labelForFunnelVariable } from './funnelVariableLabels';
import { EmailPreviewModal } from '../landing-shared/email/EmailPreviewModal';
import { EmailKindPicker } from './email-kinds/EmailKindPicker';
import { EMAIL_KINDS } from './email-kinds/email-kind-catalog';
import { buildEmail } from './email-kinds/email-kind-types';
import type { EmailKind } from './email-kinds/email-kind-types';
import { useConfirm } from '../landing-shared/admin-confirm-modal';

/**
 * Keys covered by the email kind catalog — used to intersect with workspace types
 * so apply-all never touches email types the catalog doesn't define.
 */
const CATALOG_EMAIL_KEYS = new Set(
  EMAIL_KINDS.flatMap((k) => Object.keys(k.emails)),
);

/**
 * Course-only email template keys surfaced exclusively when the funnel's product
 * has type === 'course'. Labels in Vietnamese.
 */
const COURSE_EMAIL_KEYS: Record<string, string> = {
  course_credentials: 'Email cấp tài khoản',
  course_access: 'Email truy cập khoá học',
};

interface AdminFunnelEmailWorkspaceProps {
  funnelId: string;
  /** product_id from the parent Funnel — used to determine whether to show course-only email templates. */
  productId: string;
}

/**
 * 3-pane: email list (260px) | editor (flex) | preview (380px).
 */
export function AdminFunnelEmailWorkspace({ funnelId, productId }: AdminFunnelEmailWorkspaceProps) {
  const [templates, setTemplates] = useState<FunnelEmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Track whether the linked product is a course so we can show course-only email templates
  const [isCourseProduct, setIsCourseProduct] = useState(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftHtml, setDraftHtml] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [sendTestOk, setSendTestOk] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showKindPicker, setShowKindPicker] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Last known caret position in the HTML body — captured before a modal steals
  // focus so variable inserts land where the user left off.
  const lastCaretRef = useRef<number>(0);
  const { success, error: toastError } = useToast();
  const { confirm, modal: confirmModal } = useConfirm();

  // Insert a media snippet (img for images, else the URL) at the cursor in the HTML body.
  function insertMedia(asset: MediaAsset) {
    const snippet = buildMediaSnippet(asset);
    const el = htmlTextareaRef.current;
    const start = el?.selectionStart ?? draftHtml.length;
    const end = el?.selectionEnd ?? draftHtml.length;
    setDraftHtml(draftHtml.slice(0, start) + snippet + draftHtml.slice(end));
  }

  // Remember the caret position whenever the user interacts with the HTML body,
  // so a variable inserted from the modal lands at the right spot.
  function rememberCaret() {
    const el = htmlTextareaRef.current;
    if (el) lastCaretRef.current = el.selectionStart ?? el.value.length;
  }

  // Insert a {{token}} at the remembered caret position (the modal has focus, so
  // the textarea selection is stale). Advance the stored caret past the token.
  function insertToken(token: string) {
    const pos = Math.min(lastCaretRef.current, draftHtml.length);
    setDraftHtml(draftHtml.slice(0, pos) + token + draftHtml.slice(pos));
    lastCaretRef.current = pos + token.length;
  }

  function load() {
    setIsLoading(true);
    setError('');
    // Fetch product type to gate course-only templates, in parallel with template list
    adminProductsApi.get(productId).then((p) => setIsCourseProduct(p.type === 'course')).catch(() => {});
    adminFunnelsApi
      .listEmailTemplates(funnelId)
      .then((data) => {
        setTemplates(data);
        if (!selectedKey && data.length > 0) {
          const first = data[0];
          setSelectedKey(first.template_key);
          setDraftSubject(first.subject);
          setDraftHtml(first.html_body);
        }
      })
      .catch((e) => setError(getApiErrorMessage(e, 'Failed to load email templates')))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { load(); }, [funnelId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(key: string) {
    const item = templates.find((t) => t.template_key === key);
    if (!item) return;
    setSelectedKey(key);
    setDraftSubject(item.subject);
    setDraftHtml(item.html_body);
    setSaveError('');
    setSaveOk(false);
    setPreviewHtml('');
  }

  const selectedTemplate = templates.find((t) => t.template_key === selectedKey) ?? null;

  async function handleToggleEnabled(template: FunnelEmailTemplate) {
    setSaveError('');
    try {
      await adminFunnelsApi.upsertEmailTemplate(funnelId, template.template_key, {
        subject: template.subject,
        html_body: template.html_body,
        enabled: !template.enabled,
      });
      setTemplates((prev) =>
        prev.map((t) => (t.template_key === template.template_key ? { ...t, enabled: !t.enabled } : t)),
      );
      success(!template.enabled ? 'Email enabled' : 'Email disabled');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to update status');
      setSaveError(msg);
      toastError(msg);
    }
  }

  async function handleSave() {
    if (!selectedKey || !selectedTemplate) return;
    setIsSaving(true);
    setSaveError('');
    setSaveOk(false);
    try {
      await adminFunnelsApi.upsertEmailTemplate(funnelId, selectedKey, {
        subject: draftSubject,
        html_body: draftHtml,
        enabled: selectedTemplate.enabled,
      });
      setTemplates((prev) =>
        prev.map((t) =>
          t.template_key === selectedKey ? { ...t, subject: draftSubject, html_body: draftHtml } : t,
        ),
      );
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
      success('Email saved');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to save email');
      setSaveError(msg);
      toastError(msg);
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Derive the list of email types currently visible in the workspace.
   * Standard templates from API + course-only keys when isCourseProduct.
   * Intersect with CATALOG_EMAIL_KEYS so apply-all only touches supported types.
   */
  function getVisibleEmailTypes(): { key: string; label: string }[] {
    const fromTemplates = templates
      .filter((t) => !COURSE_EMAIL_KEYS[t.template_key] || isCourseProduct)
      .map((t) => ({ key: t.template_key, label: t.label }));

    // Course-only entries not yet returned by API
    const courseOnlyExtra = isCourseProduct
      ? Object.entries(COURSE_EMAIL_KEYS)
          .filter(([key]) => !templates.some((t) => t.template_key === key))
          .map(([key, label]) => ({ key, label }))
      : [];

    return [...fromTemplates, ...courseOnlyExtra].filter((e) => CATALOG_EMAIL_KEYS.has(e.key));
  }

  /**
   * Apply-all: for each visible email type, build subject+html from the chosen kind+color
   * and upsert. Counts success/fail; shows a summary toast in Vietnamese.
   */
  async function handleApplyKind({ kind, color }: { kind: EmailKind; color: string }) {
    const kindTemplate = EMAIL_KINDS.find((k) => k.kind === kind);
    if (!kindTemplate) return;

    const emailTypes = getVisibleEmailTypes();
    if (!emailTypes.length) return;

    const confirmed = await confirm({
      title: `Apply "${kindTemplate.label}" to ${emailTypes.length} emails?`,
      message:
        'This will overwrite the current subject and HTML content of all emails. You can still edit each email after applying.',
      confirmLabel: 'Apply',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;

    setShowKindPicker(false);

    let successCount = 0;
    let failCount = 0;

    for (const emailType of emailTypes) {
      const { subject, html } = buildEmail(kindTemplate, emailType.key, color);
      try {
        await adminFunnelsApi.upsertEmailTemplate(funnelId, emailType.key, {
          subject,
          html_body: html,
          enabled: true,
        });
        successCount++;
      } catch (e) {
        failCount++;
        // Log error but continue applying remaining types
        console.error(`Failed to apply kind template to ${emailType.key}:`, e);
      }
    }

    // Reload list to reflect updated templates
    load();

    // Summary toast
    const total = emailTypes.length;
    if (failCount === 0) {
      success(`Đã áp mẫu ${kindTemplate.label} cho ${successCount}/${total} email`);
    } else {
      toastError(
        `Áp mẫu ${kindTemplate.label}: ${successCount} thành công, ${failCount} thất bại`,
      );
    }
  }

  async function handlePreview() {
    if (!selectedKey) return;
    setIsPreviewing(true);
    try {
      const result = await adminFunnelsApi.previewEmailTemplate(funnelId, selectedKey, {
        subject: draftSubject,
        html_body: draftHtml,
        enabled: selectedTemplate?.enabled ?? true,
      });
      setPreviewHtml(result.html);
      setPreviewSubject(result.subject ?? draftSubject);
      setIsPreviewOpen(true);
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Preview failed');
      setSaveError(msg);
      toastError(msg);
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleTestSend() {
    if (!selectedKey || !testEmail.trim()) return;
    setIsSendingTest(true);
    setSendTestOk(false);
    try {
      await adminFunnelsApi.testSendEmailTemplate(funnelId, selectedKey, {
        subject: draftSubject,
        html_body: draftHtml,
        enabled: selectedTemplate?.enabled ?? true,
        to_email: testEmail.trim(),
      });
      setSendTestOk(true);
      setTimeout(() => setSendTestOk(false), 4000);
      success(`Test email sent to ${testEmail.trim()}`);
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to send test email');
      setSaveError(msg);
      toastError(msg);
    } finally {
      setIsSendingTest(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--coachio-admin-dashboard-accent)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-danger-border)] bg-[var(--coachio-admin-dashboard-danger-bg)] px-4 py-3 text-sm text-[var(--coachio-admin-dashboard-danger-text)]">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span>{error}</span>
        <button type="button" onClick={load} className="ml-auto">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[500px] overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
      {/* Template list */}
      <div className="w-64 shrink-0 border-r border-[var(--coachio-admin-dashboard-border)] overflow-y-auto">
        <div className="border-b border-[var(--coachio-admin-dashboard-border)] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">
            Email Templates
          </p>
          <button
            type="button"
            onClick={() => setShowKindPicker(true)}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-accent)] px-2 py-1.5 text-xs font-semibold text-[var(--coachio-admin-dashboard-accent)] hover:bg-[var(--coachio-admin-dashboard-accent-soft)] transition-colors"
          >
            <Layers className="h-3.5 w-3.5" />
            Choose email template set
          </button>
        </div>
        <div className="p-2 space-y-1">
          {/* Standard templates returned from the API */}
          {templates
            // Hide course-only keys from non-course funnels — they won't be in this list anyway
            // but if they are returned, gate their visibility by product type.
            .filter((t) => !COURSE_EMAIL_KEYS[t.template_key] || isCourseProduct)
            .map((t) => (
              <div key={t.template_key} className={`flex items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] px-3 py-2 ${selectedKey === t.template_key ? 'bg-[var(--coachio-admin-dashboard-accent-soft)]' : 'hover:bg-[var(--coachio-admin-dashboard-surface-hover)]'}`}>
                <button
                  type="button"
                  onClick={() => handleSelect(t.template_key)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="truncate text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">{t.label}</p>
                  <p className="truncate text-xs text-[var(--coachio-admin-dashboard-text-muted)]">{t.template_key}</p>
                </button>
                <button
                  type="button"
                  title={t.enabled ? 'Disable' : 'Enable'}
                  onClick={() => handleToggleEnabled(t)}
                  className="shrink-0 text-[var(--coachio-admin-dashboard-text-muted)]"
                >
                  {t.enabled
                    ? <ToggleRight className="h-5 w-5 text-[var(--coachio-admin-dashboard-accent)]" />
                    : <ToggleLeft className="h-5 w-5" />}
                </button>
              </div>
            ))}
          {/* Course-only email templates — only rendered when product type === 'course'. */}
          {isCourseProduct && Object.entries(COURSE_EMAIL_KEYS)
            // Don't duplicate if the API already returned these keys
            .filter(([key]) => !templates.some((t) => t.template_key === key))
            .map(([key, label]) => (
              <div key={key} className={`flex items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] px-3 py-2 ${selectedKey === key ? 'bg-[var(--coachio-admin-dashboard-accent-soft)]' : 'hover:bg-[var(--coachio-admin-dashboard-surface-hover)]'}`}>
                <button
                  type="button"
                  onClick={() => handleSelect(key)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="truncate text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">{label}</p>
                  <p className="truncate text-xs text-[var(--coachio-admin-dashboard-text-muted)]">{key}</p>
                </button>
              </div>
            ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex flex-1 min-w-0 flex-col">
        {selectedTemplate ? (
          <>
            <div className="flex items-center justify-between border-b border-[var(--coachio-admin-dashboard-border)] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">{selectedTemplate.label}</p>
                {!selectedTemplate.enabled && (
                  <p className="text-xs text-[var(--coachio-admin-dashboard-warning-text)]">This email is disabled</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isPreviewing}
                  className="inline-flex h-8 items-center gap-1 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-text-muted)]"
                >
                  {isPreviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Preview
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex h-8 items-center gap-1 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {saveError && <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">{saveError}</p>}
              {saveOk && <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-success-text)]">Saved!</p>}
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Email subject</span>
                <input
                  className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">HTML body</span>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => { rememberCaret(); setShowVariables(true); }} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--coachio-admin-dashboard-accent)] hover:underline">
                      <Braces className="h-3.5 w-3.5" />
                      Insert variable
                    </button>
                    <button type="button" onClick={() => setShowMediaPicker(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--coachio-admin-dashboard-accent)] hover:underline">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Insert media
                    </button>
                  </div>
                </div>
                <textarea
                  ref={htmlTextareaRef}
                  rows={14}
                  className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 font-mono text-xs text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
                  value={draftHtml}
                  onChange={(e) => setDraftHtml(e.target.value)}
                  onSelect={rememberCaret}
                  onClick={rememberCaret}
                  onKeyUp={rememberCaret}
                  onBlur={rememberCaret}
                />
              </label>
              {/* Test send */}
              <div className="flex gap-2 pt-2">
                <input
                  type="email"
                  className="flex-1 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="email@test.com"
                />
                <button
                  type="button"
                  onClick={handleTestSend}
                  disabled={isSendingTest || !testEmail.trim()}
                  className="inline-flex h-10 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)] disabled:opacity-50"
                >
                  {isSendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send test
                </button>
              </div>
              {sendTestOk && <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-success-text)]">Test email sent!</p>}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
            Select an email to edit.
          </div>
        )}
      </div>

      {/* Preview modal */}
      <EmailPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        previewHtml={previewHtml}
        previewSubject={previewSubject}
      />
      <MediaPicker
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        selectLabel="Insert into email"
        onSelect={insertMedia}
      />
      <EmailKindPicker
        open={showKindPicker}
        onClose={() => setShowKindPicker(false)}
        emailTypes={getVisibleEmailTypes()}
        onApply={handleApplyKind}
      />
      <InsertVariableModal
        open={showVariables}
        onClose={() => setShowVariables(false)}
        variables={(selectedTemplate?.variables ?? []).map((v) => ({
          key: v.key,
          group: v.group,
          label: labelForFunnelVariable(v.key, v.label),
          description: v.description,
        }))}
        onInsert={insertToken}
      />
      {confirmModal}
    </div>
  );
}
