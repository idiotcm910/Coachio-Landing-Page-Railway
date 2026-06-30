'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { adminLuckyEventsApi, getApiErrorMessage, type LuckyEvent } from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { cardClass, inputClass, labelClass, primaryButtonClass } from './luckyDrawStyles';

interface LuckyDrawSuccessTabProps {
  event: LuckyEvent;
  onUpdated: (event: LuckyEvent) => void;
}

export function LuckyDrawSuccessTab({ event, onUpdated }: LuckyDrawSuccessTabProps) {
  const { success, error: toastError } = useToast();
  const cfg = event.success_config ?? {};
  const [headline, setHeadline] = useState(cfg.headline ?? '');
  const [message, setMessage] = useState(cfg.message ?? '');
  const [customHtml, setCustomHtml] = useState(cfg.custom_html ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const updated = await adminLuckyEventsApi.update(event.id, {
        success_config: {
          headline: headline.trim(),
          message: message.trim(),
          custom_html: customHtml.trim() || null,
        },
      });
      onUpdated(updated);
      success('Success page saved');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Không thể lưu trang cảm ơn');
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <h3 className="mb-1 text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">Success page</h3>
        <p className="mb-4 text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
          Shown to the attendee right after they register. Keep it short and reassuring.
        </p>
        <div className="space-y-3">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Headline</span>
            <input className={inputClass} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Thanks for registering!" />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Message</span>
            <textarea rows={5} className={`${inputClass} resize-y`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="We'll draw the winners live at the end of the workshop. Good luck!" />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Custom HTML (optional)</span>
            <textarea
              rows={6}
              className={`${inputClass} resize-y font-mono text-xs`}
              value={customHtml}
              onChange={(e) => setCustomHtml(e.target.value)}
              placeholder="<h2>You're in!</h2><p>Stay tuned for the live draw.</p>"
            />
            <span className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
              When set, this HTML replaces the headline + message on the attendee success screen. Sanitized on render.
            </span>
          </label>
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">{error}</p>}

      <button type="button" onClick={handleSave} disabled={saving} className={primaryButtonClass}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save success page
      </button>
    </div>
  );
}
