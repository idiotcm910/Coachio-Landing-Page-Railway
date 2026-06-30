'use client';

import { useEffect, useRef, useState } from 'react';
import {
  adminGiftCampaignsApi,
  getApiErrorMessage,
  type Gift,
  type GiftVariable,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { BTN_SECONDARY, FIELD, INPUT, LABEL, TEXTAREA } from './gift-ui';

interface Props {
  gifts: Gift[]; // full list — selected ones are shown in the reference panel
  giftIds: string[];
  subject: string;
  html: string;
  onChange: (patch: { subject?: string; html?: string }) => void;
}

/**
 * 2-column delivery-email editor shared by gift campaigns + automations.
 * Left: subject + HTML + variable palette + live preview + test-send.
 * Right: read-only reference panel of the selected gifts' contents (so the admin
 * writes copy WITHOUT switching to the gift tab). No auto gift-summary block.
 */
export function GiftEmailEditor({ gifts, giftIds, subject, html, onChange }: Props) {
  const { success, error: toastError } = useToast();
  const [variables, setVariables] = useState<GiftVariable[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<number>(0);

  useEffect(() => {
    adminGiftCampaignsApi.emailVariables().then(setVariables).catch(() => {});
  }, []);

  const selected = gifts.filter((g) => giftIds.includes(g.id));

  const rememberCaret = () => {
    const el = htmlRef.current;
    if (el) caretRef.current = el.selectionStart ?? el.value.length;
  };

  const insertToken = (key: string) => {
    const token = `{{${key}}}`;
    const pos = Math.min(caretRef.current, html.length);
    onChange({ html: html.slice(0, pos) + token + html.slice(pos) });
    caretRef.current = pos + token.length;
  };

  // Preview is a toggle: opening (re)fetches the rendered email; clicking again hides it.
  const togglePreview = async () => {
    if (showPreview) {
      setShowPreview(false);
      return;
    }
    try {
      const r = await adminGiftCampaignsApi.previewEmail(giftIds, subject, html);
      setPreviewHtml(r.html);
      setShowPreview(true);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to preview email'));
    }
  };

  const handleTestSend = async () => {
    if (!testEmail.trim()) {
      toastError('Enter an email for the test send');
      return;
    }
    try {
      await adminGiftCampaignsApi.testSendEmail(giftIds, subject, html, testEmail.trim());
      success(`Test email sent to ${testEmail.trim()}`);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Test send failed'));
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Left — compose */}
      <div className="flex flex-col gap-3">
        <label className={FIELD}>
          <span className={LABEL}>Email subject</span>
          <input className={INPUT} value={subject} onChange={(e) => onChange({ subject: e.target.value })} />
        </label>

        <div>
          <span className={LABEL}>Insert variable</span>
          <div className="mt-1 flex flex-col gap-1.5">
            {variables.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertToken(v.key)}
                className="flex items-start justify-between gap-2.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 py-2 text-left transition hover:border-[var(--coachio-admin-dashboard-accent)] hover:bg-[var(--coachio-admin-dashboard-accent-soft,#fff7ed)]"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <code className="rounded border border-[var(--coachio-admin-dashboard-accent-border,#fed7aa)] bg-[var(--coachio-admin-dashboard-surface)] px-1.5 py-0.5 font-mono text-xs text-[var(--coachio-admin-dashboard-accent)]">
                      {`{{${v.key}}}`}
                    </code>
                    <span className="text-xs font-medium text-[var(--coachio-admin-dashboard-text)]">{v.label}</span>
                  </span>
                  {v.description && (
                    <span className="mt-1 block text-[11px] leading-snug text-[var(--coachio-admin-dashboard-text-soft)]">
                      {v.description}
                    </span>
                  )}
                </span>
                <span className="shrink-0 self-center text-[11px] font-semibold text-[var(--coachio-admin-dashboard-accent)]">
                  Insert
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className={FIELD}>
          <span className={LABEL}>HTML content</span>
          <textarea
            ref={htmlRef}
            className={TEXTAREA}
            rows={12}
            value={html}
            onChange={(e) => onChange({ html: e.target.value })}
            onSelect={rememberCaret}
            onClick={rememberCaret}
            onKeyUp={rememberCaret}
            onBlur={rememberCaret}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={
              showPreview
                ? `${BTN_SECONDARY} border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-accent-soft,#fff7ed)] text-[var(--coachio-admin-dashboard-accent)]`
                : BTN_SECONDARY
            }
            onClick={togglePreview}
          >
            {showPreview ? 'Hide preview' : 'Preview'}
          </button>
          <input className={`${INPUT} max-w-[14rem]`} placeholder="email@test.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          <button type="button" className={BTN_SECONDARY} onClick={handleTestSend}>Test send</button>
        </div>

        {showPreview && previewHtml !== null && (
          <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-accent-border,#fed7aa)]">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--coachio-admin-dashboard-accent-border,#fed7aa)] bg-[var(--coachio-admin-dashboard-accent-soft,#fff7ed)] px-3 py-2">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-accent)]">Gift email preview</span>
              <button
                type="button"
                className="text-[11px] font-semibold text-[var(--coachio-admin-dashboard-accent)] hover:underline"
                onClick={() => setShowPreview(false)}
              >
                Hide
              </button>
            </div>
            <iframe title="preview" className="h-72 w-full bg-white" srcDoc={previewHtml} sandbox="" />
          </div>
        )}
      </div>

      {/* Right — gift reference panel */}
      <div className="rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] p-3">
        <p className={LABEL}>Gifts in this campaign</p>
        <p className="mt-1 text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
          Review the gift contents to write a fitting email (no need to open the Gifts tab).
        </p>
        {selected.length === 0 && (
          <p className="mt-3 text-sm text-[var(--coachio-admin-dashboard-text-soft)]">No gifts selected yet.</p>
        )}
        <div className="mt-3 flex flex-col gap-3">
          {selected.map((g) => (
            <div key={g.id} className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-2 text-sm">
              <div className="font-semibold">{g.name}</div>
              <ul className="mt-1 list-disc pl-5 text-[var(--coachio-admin-dashboard-text-muted)]">
                {(g.external_items ?? []).map((it, i) => (
                  <li key={i}>
                    {it.label}: <a className="break-all text-[var(--coachio-admin-dashboard-accent)]" href={it.url} target="_blank" rel="noreferrer">{it.url}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
