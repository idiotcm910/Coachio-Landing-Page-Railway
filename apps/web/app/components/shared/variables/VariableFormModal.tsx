'use client';

import { useEffect, useRef, useState } from 'react';
import type { VariableType, VariableMeta } from '@coachio/api-client';
import { AdminModal } from '../AdminModal';
import { DateTimeField } from './DateTimeField';

export interface VariableFormValues {
  key: string;
  name: string;
  description: string;
  type: VariableType;
  rawValue: string;
}

interface VariableFormModalProps {
  /** null = add mode; string = edit mode (key is read-only) */
  editingKey: string | null;
  initialValues?: Partial<VariableFormValues>;
  reservedKeys: string[];
  existingKeys: string[];
  onSave: (key: string, rawValue: string, meta: VariableMeta) => void;
  onClose: () => void;
}

const TYPE_OPTIONS: { value: VariableType; label: string }[] = [
  { value: 'text', label: 'text' },
  { value: 'number', label: 'number' },
  { value: 'date', label: 'date' },
  { value: 'time', label: 'time' },
  { value: 'datetime', label: 'datetime' },
];

export function VariableFormModal({
  editingKey,
  initialValues,
  reservedKeys,
  existingKeys,
  onSave,
  onClose,
}: VariableFormModalProps) {
  const isEdit = editingKey !== null;

  const [key, setKey] = useState(editingKey ?? initialValues?.key ?? '');
  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [type, setType] = useState<VariableType>(initialValues?.type ?? 'text');
  const [keyError, setKeyError] = useState('');

  // Per-type value fields
  const rawInit = initialValues?.rawValue ?? '';
  const [textVal, setTextVal] = useState(type === 'text' ? rawInit : '');
  const [numberVal, setNumberVal] = useState(type === 'number' ? rawInit : '');
  const [dateVal, setDateVal] = useState(type === 'date' ? rawInit : '');
  const [timeVal, setTimeVal] = useState(type === 'time' ? rawInit : '');
  const [datetimeVal, setDatetimeVal] = useState(type === 'datetime' ? rawInit : '');

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  function computeRaw(): string {
    switch (type) {
      case 'text': return textVal;
      case 'number': return numberVal;
      case 'date': return dateVal;
      case 'time': return timeVal;
      case 'datetime': return datetimeVal;
      default: return '';
    }
  }

  function normalizeKey(raw: string): string {
    return raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  }

  function handleTypeChange(next: VariableType) {
    setType(next);
  }

  function handleSubmit() {
    const normalizedKey = normalizeKey(isEdit ? (editingKey ?? '') : key);

    if (!normalizedKey) {
      setKeyError('Key is required.');
      return;
    }
    if (reservedKeys.includes(normalizedKey)) {
      setKeyError(`"${normalizedKey}" is a system variable and cannot be overridden.`);
      return;
    }
    if (!isEdit && existingKeys.includes(normalizedKey)) {
      setKeyError(`Key "${normalizedKey}" already exists.`);
      return;
    }

    setKeyError('');
    onSave(normalizedKey, computeRaw(), { name: name.trim() || undefined, description: description.trim() || undefined, type });
  }

  const displayKey = isEdit ? (editingKey ?? '') : normalizeKey(key) || 'key';
  const rawPreview = computeRaw() || '(empty)';

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-4 py-2 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        className="inline-flex items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 py-2 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] transition hover:brightness-105"
      >
        {isEdit ? 'Save changes' : '＋ Add variable'}
      </button>
    </>
  );

  return (
    <AdminModal
      title={isEdit ? 'Edit variable' : 'Add variable'}
      subtitle="Custom variable — set a label, data type and value."
      onClose={onClose}
      footer={footer}
      maxWidthClassName="max-w-[540px]"
    >
      <div className="grid grid-cols-[1fr_180px] gap-x-3 gap-y-4">
        {/* Key */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text)]">
                Key <span className="text-[var(--coachio-admin-dashboard-danger-text)]">*</span>
              </label>
              {isEdit ? (
                <input
                  readOnly
                  value={editingKey ?? ''}
                  className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text-muted)] opacity-70"
                />
              ) : (
                <input
                  ref={firstInputRef}
                  value={key}
                  onChange={(e) => { setKey(e.target.value); setKeyError(''); }}
                  placeholder="my_variable"
                  className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)] focus:bg-[var(--coachio-admin-dashboard-surface)]"
                />
              )}
              {keyError && <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">{keyError}</p>}
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text)]">Type</label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as VariableType)}
                className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
              >
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Name */}
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text)]">Name</label>
              <input
                ref={isEdit ? firstInputRef : undefined}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display label (optional)"
                className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)] focus:bg-[var(--coachio-admin-dashboard-surface)]"
              />
            </div>

            {/* Description */}
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text)]">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description (optional)"
                className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)] focus:bg-[var(--coachio-admin-dashboard-surface)]"
              />
            </div>

            {/* Value — type-aware widget */}
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text)]">
                Value <span className="text-[var(--coachio-admin-dashboard-danger-text)]">*</span>
              </label>

              {type === 'text' && (
                <input
                  type="text"
                  value={textVal}
                  onChange={(e) => setTextVal(e.target.value)}
                  placeholder="Enter value"
                  className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)] focus:bg-[var(--coachio-admin-dashboard-surface)]"
                />
              )}
              {type === 'number' && (
                <input
                  type="number"
                  value={numberVal}
                  onChange={(e) => setNumberVal(e.target.value)}
                  placeholder="0"
                  className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)] focus:bg-[var(--coachio-admin-dashboard-surface)]"
                />
              )}
              {type === 'date' && (
                <DateTimeField kind="date" value={dateVal} onChange={setDateVal} />
              )}
              {type === 'time' && (
                <DateTimeField kind="time" value={timeVal} onChange={setTimeVal} />
              )}
              {type === 'datetime' && (
                <DateTimeField kind="datetime" value={datetimeVal} onChange={setDatetimeVal} />
              )}

              {/* Raw value preview */}
              <div className="mt-1 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-dashed border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
                Raw value (substituted into{' '}
                <code className="font-mono text-[var(--coachio-admin-dashboard-accent)]">{`{{${displayKey}}}`}</code>
                ):{' '}
                <span className="font-mono font-semibold text-[var(--coachio-admin-dashboard-text)]">{rawPreview}</span>
              </div>
        </div>
      </div>
    </AdminModal>
  );
}
