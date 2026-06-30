'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { BTN_SECONDARY, INPUT } from '../gift-ui';

/**
 * List-item email input: type an email + Add (or Enter) to append a removable
 * row. Value is stored as string[] in the parent. Used for include/exclude lists.
 */
export function EmailListInput({
  emails,
  onChange,
  placeholder = 'email@example.com',
}: {
  emails: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim().toLowerCase();
    if (v && v.includes('@') && !emails.includes(v)) {
      onChange([...emails, v]);
      setDraft('');
    }
  };

  const remove = (i: number) => onChange(emails.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="email"
          className={`${INPUT} flex-1`}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className={BTN_SECONDARY} onClick={add}>
          Add
        </button>
      </div>
      {emails.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1.5">
          {emails.map((em, i) => (
            <div
              key={em}
              className="flex items-center justify-between gap-2.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-2.5 py-2 text-sm"
            >
              <span className="break-all">{em}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${em}`}
                className="shrink-0 text-[var(--coachio-admin-dashboard-text-soft)] transition hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-[var(--coachio-admin-dashboard-text-soft)]">No emails added.</p>
      )}
    </div>
  );
}
