'use client';

import { useRef, useState } from 'react';
import { ImageIcon, Loader2, Send } from 'lucide-react';
import { getApiErrorMessage } from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { MediaPicker, buildMediaSnippet } from '../shared/media-picker';
import { VariablesModal, type VariableRow } from '../shared/variables/VariablesModal';
import { EmailPreviewModal } from '../landing-shared/email/EmailPreviewModal';
import type { MediaAsset } from '@coachio/api-client';
import styles from './BroadcastComposer.module.scss';

export interface BroadcastComposerValue {
  title: string;
  subject: string;
  html_body: string;
}

interface BroadcastComposerProps {
  value: BroadcastComposerValue;
  onChange(next: BroadcastComposerValue): void;
  variables: { key: string; label: string }[];
  onTestSend(email: string): Promise<void>;
}

export function BroadcastComposer({ value, onChange, variables, onTestSend }: BroadcastComposerProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const htmlRef = useRef<HTMLTextAreaElement>(null);

  const [showMedia, setShowMedia] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  function insertMedia(asset: MediaAsset) {
    const snippet = buildMediaSnippet(asset);
    const el = htmlRef.current;
    const start = el?.selectionStart ?? value.html_body.length;
    const end = el?.selectionEnd ?? value.html_body.length;
    onChange({ ...value, html_body: value.html_body.slice(0, start) + snippet + value.html_body.slice(end) });
  }

  function insertVariable(token: string) {
    const el = htmlRef.current;
    const start = el?.selectionStart ?? value.html_body.length;
    const end = el?.selectionEnd ?? value.html_body.length;
    onChange({ ...value, html_body: value.html_body.slice(0, start) + token + value.html_body.slice(end) });
  }

  function openPreview() {
    setPreviewHtml(value.html_body);
    setIsPreviewOpen(true);
  }

  async function handleTestSend() {
    if (!testEmail.trim()) return;
    setIsSendingTest(true);
    try {
      await onTestSend(testEmail.trim());
      toastSuccess(`Test email sent to ${testEmail.trim()}`);
      setTestEmail('');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to send test email'));
    } finally {
      setIsSendingTest(false);
    }
  }

  const systemVars: VariableRow[] = variables.map((v) => ({
    token: `{{${v.key}}}`,
    label: v.label,
  }));

  return (
    <div className={styles.composer}>
      {/* Title */}
      <label className={styles.field}>
        <span className={styles.label}>Internal title</span>
        <input
          className={styles.input}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="Campaign name (admin only)"
        />
      </label>

      {/* Subject */}
      <label className={styles.field}>
        <span className={styles.label}>Email subject</span>
        <input
          className={styles.input}
          value={value.subject}
          onChange={(e) => onChange({ ...value, subject: e.target.value })}
          placeholder="E.g. Hi {{name}}, you have new updates!"
        />
      </label>

      {/* HTML body */}
      <div className={styles.field}>
        <div className={styles.bodyHeader}>
          <span className={styles.label}>HTML body</span>
          <div className={styles.toolbar}>
            <button type="button" className={styles.toolbarBtn} onClick={() => setShowMedia(true)}>
              <ImageIcon className={styles.icon} />
              Insert image
            </button>
            <button type="button" className={styles.toolbarBtn} onClick={() => setShowVars(true)}>
              {'{ }'}
              Variables
            </button>
            <button type="button" className={styles.toolbarBtnAccent} onClick={openPreview}>
              Preview
            </button>
          </div>
        </div>
        <textarea
          ref={htmlRef}
          rows={16}
          className={styles.textarea}
          value={value.html_body}
          onChange={(e) => onChange({ ...value, html_body: e.target.value })}
          placeholder="<p>Email HTML content...</p>"
        />
      </div>

      {/* Test send */}
      <div className={styles.testRow}>
        <input
          type="email"
          className={styles.input}
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="email@test.com"
        />
        <button
          type="button"
          className={styles.testBtn}
          onClick={handleTestSend}
          disabled={isSendingTest || !testEmail.trim()}
        >
          {isSendingTest ? <Loader2 className={styles.spin} /> : <Send className={styles.icon} />}
          Send test
        </button>
      </div>

      <MediaPicker
        isOpen={showMedia}
        onClose={() => setShowMedia(false)}
        selectLabel="Insert into email"
        onSelect={insertMedia}
      />

      <VariablesModal
        isOpen={showVars}
        onClose={() => setShowVars(false)}
        systemVariables={systemVars}
        customVariables={null}
        ctaAttributes={[]}
      />

      <EmailPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        previewHtml={previewHtml}
        previewSubject={value.subject}
      />
    </div>
  );
}
