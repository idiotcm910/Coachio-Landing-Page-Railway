'use client';

import { forwardRef } from 'react';

interface DateTimeFieldProps {
  /** Optional label rendered above the input. */
  label?: string;
  /** `datetime-local` value, format "YYYY-MM-DDTHH:mm". */
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  required?: boolean;
  /** `datetime-local` min / max bounds. */
  min?: string;
  max?: string;
  hint?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Shared datetime-local input for the admin funnel editor.
 * Styled with the admin-dashboard design tokens so every date/time field looks
 * consistent. Mirrors the VnDateTimeInput pattern (label + field + error/hint)
 * but uses the elearning admin tokens instead of the vibe-creators theme.
 */
export const DateTimeField = forwardRef<HTMLInputElement, DateTimeFieldProps>(
  ({ label, value, onChange, error, required, min, max, hint, disabled, id }, ref) => {
    return (
      <label className="flex flex-col gap-1" htmlFor={id}>
        {label && (
          <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">
            {label} {required && <span className="text-[var(--coachio-admin-dashboard-danger-text)]">*</span>}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          type="datetime-local"
          value={value}
          min={min}
          max={max}
          required={required}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`rounded-[var(--coachio-admin-dashboard-radius-sm)] border bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none transition focus:border-[var(--coachio-admin-dashboard-accent)] ${
            error
              ? 'border-[var(--coachio-admin-dashboard-danger-border)]'
              : 'border-[var(--coachio-admin-dashboard-border)]'
          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        />
        {error && <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">{error}</span>}
        {!error && hint && <span className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">{hint}</span>}
      </label>
    );
  },
);

DateTimeField.displayName = 'DateTimeField';
