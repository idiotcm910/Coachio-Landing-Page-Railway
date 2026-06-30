'use client';

import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Shared modern checkbox for the admin dashboard.
 *
 * Replaces native `<input type="checkbox">` (which renders as a dark, theme-clashing
 * square) with a custom box + animated check, themed via the admin CSS variables.
 * Accessible: keeps a real (visually-hidden) input so keyboard focus, space-toggle
 * and form semantics still work; the visible box reacts via Tailwind `peer-*`.
 */
export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Optional label rendered to the right of the box. */
  label?: ReactNode;
  /** Tri-state visual only (renders a dash); `checked` still drives toggling. */
  indeterminate?: boolean;
  disabled?: boolean;
  id?: string;
  /** Extra classes for the outer label wrapper (e.g. row padding/hover). */
  className?: string;
  'aria-label'?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  indeterminate = false,
  disabled = false,
  id,
  className = '',
  'aria-label': ariaLabel,
}: CheckboxProps) {
  return (
    <label
      className={[
        'group inline-flex items-center gap-2 select-none',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className,
      ].join(' ')}
    >
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className={[
            'flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border text-white',
            'transition-all duration-150 ease-out',
            'border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)]',
            'group-hover:border-[var(--coachio-admin-dashboard-accent)]',
            'peer-checked:border-[var(--coachio-admin-dashboard-accent)] peer-checked:bg-[var(--coachio-admin-dashboard-accent)]',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--coachio-admin-dashboard-accent-soft)] peer-focus-visible:ring-offset-1',
            checked || indeterminate
              ? 'border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-accent)]'
              : '',
          ].join(' ')}
        >
          {indeterminate ? (
            <Minus className="h-3 w-3" strokeWidth={3.5} />
          ) : (
            <Check
              className={[
                'h-3 w-3 transition-all duration-150',
                checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
              ].join(' ')}
              strokeWidth={3.5}
            />
          )}
        </span>
      </span>
      {label != null && (
        <span className="text-xs text-[var(--coachio-admin-dashboard-text)]">{label}</span>
      )}
    </label>
  );
}
