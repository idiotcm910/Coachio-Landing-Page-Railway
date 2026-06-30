'use client';

import { forwardRef } from 'react';
import DatePicker from 'react-datepicker';
import { Calendar, Clock, CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';

type DateTimeKind = 'date' | 'time' | 'datetime';

interface DateTimeFieldProps {
  kind: DateTimeKind;
  /** Canonical raw value: date `YYYY-MM-DD`, time `HH:mm`, datetime `YYYY-MM-DDTHH:mm`. */
  value: string;
  onChange: (value: string) => void;
}

const ICON: Record<DateTimeKind, typeof Calendar> = {
  date: Calendar,
  time: Clock,
  datetime: CalendarClock,
};

const PLACEHOLDER: Record<DateTimeKind, string> = {
  date: 'Select date',
  time: 'Select time',
  datetime: 'Select date & time',
};

const DATE_FORMAT: Record<DateTimeKind, string> = {
  date: 'MMM d, yyyy',
  time: 'HH:mm',
  datetime: 'MMM d, yyyy HH:mm',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Compact human-readable label for a stored raw value, for read-only displays
 * (e.g. the variables table). date/datetime → `Jun 12, 2026 [• 14:35]`; time and
 * other types pass through unchanged. Pure string parsing — no timezone shift.
 */
export function formatRawForDisplay(type: string, raw: string): string {
  if (!raw) return '';
  if (type === 'date' || type === 'datetime') {
    const [datePart, timePart] = raw.includes('T') ? raw.split('T') : [raw, ''];
    const [y, mo, da] = datePart.split('-').map(Number);
    if (!y || !mo || !da) return raw;
    let out = `${MONTHS_SHORT[mo - 1] ?? mo} ${da}, ${y}`;
    if (type === 'datetime' && timePart) out += ` • ${timePart}`;
    return out;
  }
  return raw;
}

/** Parse a canonical raw string into a local Date (no timezone shift). */
function parseValue(kind: DateTimeKind, value: string): Date | null {
  if (!value) return null;
  if (kind === 'time') {
    const [h, m] = value.split(':').map(Number);
    if (Number.isNaN(h)) return null;
    const d = new Date();
    d.setHours(h, m || 0, 0, 0);
    return d;
  }
  const [datePart, timePart] = value.includes('T') ? value.split('T') : [value, ''];
  const [y, mo, da] = datePart.split('-').map(Number);
  if (!y || !mo || !da) return null;
  const d = new Date(y, mo - 1, da);
  if (timePart) {
    const [h, mi] = timePart.split(':').map(Number);
    d.setHours(h || 0, mi || 0, 0, 0);
  }
  return d;
}

/** Format a Date back into the canonical raw string for `kind`. */
function formatValue(kind: DateTimeKind, d: Date | null): string {
  if (!d) return '';
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (kind === 'date') return date;
  if (kind === 'time') return time;
  return `${date}T${time}`;
}

/** Human-readable confirmation of the picked value. */
function humanReadable(kind: DateTimeKind, d: Date | null): string {
  if (!d) return 'Not selected';
  const date = `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (kind === 'date') return date;
  if (kind === 'time') return time;
  return `${date} • ${time}`;
}

/** Styled trigger input (icon + value) cloned by react-datepicker. */
const TriggerInput = forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void; icon: typeof Calendar; placeholder: string }>(
  ({ value, onClick, icon: Icon, placeholder }, ref) => (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2.5 text-left text-sm text-[var(--coachio-admin-dashboard-text)] outline-none transition hover:border-[var(--coachio-admin-dashboard-accent)] focus:border-[var(--coachio-admin-dashboard-accent)] focus:bg-[var(--coachio-admin-dashboard-surface)]"
    >
      <Icon className="h-4 w-4 shrink-0 text-[var(--coachio-admin-dashboard-text-muted)]" />
      <span className={value ? '' : 'text-[var(--coachio-admin-dashboard-text-muted)]'}>
        {value || placeholder}
      </span>
    </button>
  ),
);
TriggerInput.displayName = 'TriggerInput';

/**
 * Modern, polished date/time/datetime picker built on `react-datepicker`
 * (already themed in globals.css with the admin-dashboard tokens). Replaces the
 * ugly native picker. Emits the canonical raw string and shows a VN-readable
 * confirmation line below.
 */
export function DateTimeField({ kind, value, onChange }: DateTimeFieldProps) {
  const selected = parseValue(kind, value);
  const isTime = kind === 'time';

  return (
    <div className="flex flex-col gap-1.5">
      <DatePicker
        selected={selected}
        onChange={(d) => onChange(formatValue(kind, d))}
        dateFormat={DATE_FORMAT[kind]}
        showTimeSelect={kind === 'datetime' || isTime}
        showTimeSelectOnly={isTime}
        timeIntervals={5}
        timeFormat="HH:mm"
        timeCaption="Time"
        showPopperArrow={false}
        popperPlacement="bottom-start"
        // Custom header → nav arrows always align (default ones mis-position when
        // a time column is present in datetime mode), with a VN month label.
        renderCustomHeader={({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
          <div className="flex items-center justify-between px-2 pb-1">
            <button
              type="button"
              onClick={decreaseMonth}
              disabled={prevMonthButtonDisabled}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)] disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-[var(--coachio-admin-dashboard-text)]">
              {MONTHS[date.getMonth()]} {date.getFullYear()}
            </span>
            <button
              type="button"
              onClick={increaseMonth}
              disabled={nextMonthButtonDisabled}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)] disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
        // Render the calendar in a body portal so it escapes the modal's
        // overflow:auto (otherwise it gets clipped/pushed to the top).
        portalId="rdp-portal"
        customInput={<TriggerInput icon={ICON[kind]} placeholder={PLACEHOLDER[kind]} />}
      />
      <p className="px-1 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
        <span className="font-medium text-[var(--coachio-admin-dashboard-text)]">{humanReadable(kind, selected)}</span>
      </p>
    </div>
  );
}
