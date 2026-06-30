'use client';

import { useState } from 'react';
import { DateTimeField } from '../shared/variables/DateTimeField';
import styles from './BroadcastScheduleField.module.scss';

interface BroadcastScheduleFieldProps {
  value: string | null;
  onChange(scheduledAt: string | null): void;
}

type Mode = 'now' | 'schedule';

const pad = (n: number) => String(n).padStart(2, '0');

/** Stored ISO (UTC) → canonical local "YYYY-MM-DDTHH:mm" for the picker (tz-correct). */
function isoToLocalCanonical(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Canonical local "YYYY-MM-DDTHH:mm" → ISO (UTC) for the API. */
function localCanonicalToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local); // a datetime-local string with no offset is parsed as local time
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function BroadcastScheduleField({ value, onChange }: BroadcastScheduleFieldProps) {
  const [mode, setMode] = useState<Mode>(value ? 'schedule' : 'now');
  const [localValue, setLocalValue] = useState(isoToLocalCanonical(value));
  const [error, setError] = useState('');

  function handleModeChange(next: Mode) {
    setMode(next);
    setError('');
    if (next === 'now') {
      onChange(null);
    } else {
      onChange(localValue ? localCanonicalToIso(localValue) : null);
    }
  }

  function handleDateChange(v: string) {
    setLocalValue(v);
    setError('');
    if (!v) {
      onChange(null);
      return;
    }
    const selected = new Date(v);
    if (selected <= new Date()) {
      setError('Scheduled time must be in the future');
      return;
    }
    onChange(localCanonicalToIso(v));
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>Send time</span>

      <div className={styles.radioGroup}>
        <label className={styles.radio}>
          <input
            type="radio"
            name="broadcast-schedule"
            value="now"
            checked={mode === 'now'}
            onChange={() => handleModeChange('now')}
          />
          <span>Send now</span>
        </label>
        <label className={styles.radio}>
          <input
            type="radio"
            name="broadcast-schedule"
            value="schedule"
            checked={mode === 'schedule'}
            onChange={() => handleModeChange('schedule')}
          />
          <span>Schedule</span>
        </label>
      </div>

      {mode === 'schedule' && (
        <div className={styles.dateRow}>
          <DateTimeField kind="datetime" value={localValue} onChange={handleDateChange} />
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}
    </div>
  );
}
