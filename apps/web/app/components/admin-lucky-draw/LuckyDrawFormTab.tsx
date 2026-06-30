'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Image as ImageIcon, Loader2, Plus, Star, Trash2, Type } from 'lucide-react';
import {
  adminLuckyEventsApi,
  getApiErrorMessage,
  type LuckyEvent,
  type LuckyFormField,
  type LuckyFormFieldType,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { cardClass, ghostButtonClass, inputClass, labelClass, primaryButtonClass } from './luckyDrawStyles';

const FIELD_TYPES: { value: LuckyFormFieldType; label: string }[] = [
  { value: 'short_text', label: 'Short text' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'rating', label: 'Rating (1–N)' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'single_choice', label: 'Single choice' },
  { value: 'multi_choice', label: 'Multi choice' },
];

const CHOICE_TYPES: LuckyFormFieldType[] = ['single_choice', 'multi_choice'];
const DISPLAY_TYPES: LuckyFormFieldType[] = ['rich_text', 'image'];

function isDisplayField(field: LuckyFormField): boolean {
  return DISPLAY_TYPES.includes(field.type);
}

function makeKey() {
  return `f_${Math.random().toString(36).slice(2, 8)}`;
}

function newField(type: LuckyFormFieldType): LuckyFormField {
  return {
    key: makeKey(),
    type,
    label: '',
    required: false,
    ...(CHOICE_TYPES.includes(type) ? { options: ['Option 1'] } : {}),
    ...(type === 'rating' ? { scale_max: 5 } : {}),
    ...(type === 'rich_text' ? { content: '' } : {}),
    ...(type === 'image' ? { image_url: '', alt: '' } : {}),
  };
}

interface LuckyDrawFormTabProps {
  event: LuckyEvent;
  onUpdated: (event: LuckyEvent) => void;
}

export function LuckyDrawFormTab({ event, onUpdated }: LuckyDrawFormTabProps) {
  const { success, error: toastError } = useToast();
  const [fields, setFields] = useState<LuckyFormField[]>(event.form_schema ?? []);
  const [nameKey, setNameKey] = useState(event.name_field_key ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function patchField(index: number, patch: Partial<LuckyFormField>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function changeType(index: number, type: LuckyFormFieldType) {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const next: LuckyFormField = { key: f.key, type, label: f.label, required: f.required };
        if (CHOICE_TYPES.includes(type)) next.options = f.options ?? ['Option 1'];
        if (type === 'rating') next.scale_max = f.scale_max ?? 5;
        return next;
      }),
    );
    // If a short_text field designated as name is changed to another type, clear designation.
    if (type !== 'short_text' && fields[index]?.key === nameKey) setNameKey('');
  }

  function addField() {
    setFields((prev) => [...prev, newField('short_text')]);
  }

  function addBlock(type: 'rich_text' | 'image') {
    setFields((prev) => [...prev, newField(type)]);
  }

  function removeField(index: number) {
    setFields((prev) => {
      const removed = prev[index];
      if (removed?.key === nameKey) setNameKey('');
      return prev.filter((_, i) => i !== index);
    });
  }

  function move(index: number, dir: -1 | 1) {
    setFields((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function setOption(fieldIndex: number, optIndex: number, value: string) {
    setFields((prev) =>
      prev.map((f, i) => (i === fieldIndex ? { ...f, options: (f.options ?? []).map((o, oi) => (oi === optIndex ? value : o)) } : f)),
    );
  }

  function addOption(fieldIndex: number) {
    setFields((prev) =>
      prev.map((f, i) => (i === fieldIndex ? { ...f, options: [...(f.options ?? []), `Option ${(f.options?.length ?? 0) + 1}`] } : f)),
    );
  }

  function removeOption(fieldIndex: number, optIndex: number) {
    setFields((prev) =>
      prev.map((f, i) => (i === fieldIndex ? { ...f, options: (f.options ?? []).filter((_, oi) => oi !== optIndex) } : f)),
    );
  }

  function validate(): string | null {
    if (fields.length === 0) return 'Add at least one field.';
    const inputs = fields.filter((f) => !isDisplayField(f));
    if (inputs.length === 0) return 'Add at least one input field.';
    for (const f of inputs) {
      if (!f.label.trim()) return 'Every input field needs a label.';
      if (CHOICE_TYPES.includes(f.type) && (f.options ?? []).filter((o) => o.trim()).length === 0)
        return 'Choice fields need at least one option.';
    }
    for (const f of fields) {
      if (f.type === 'image' && !(f.image_url ?? '').trim()) return 'Image blocks need an image URL.';
    }
    if (!nameKey) return 'Designate one short-text field as the wheel display name.';
    const nameField = inputs.find((f) => f.key === nameKey);
    if (!nameField || nameField.type !== 'short_text') return 'The display-name field must be a short-text field.';
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      toastError(validationError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const cleaned = fields.map((f) => {
        if (f.type === 'rich_text') {
          return { key: f.key, type: f.type, label: '', required: false, content: (f.content ?? '').trim() };
        }
        if (f.type === 'image') {
          return {
            key: f.key,
            type: f.type,
            label: '',
            required: false,
            image_url: (f.image_url ?? '').trim(),
            alt: (f.alt ?? '').trim(),
          };
        }
        return {
          ...f,
          label: f.label.trim(),
          ...(f.options ? { options: f.options.map((o) => o.trim()).filter(Boolean) } : {}),
        };
      });
      const updated = await adminLuckyEventsApi.update(event.id, { form_schema: cleaned, name_field_key: nameKey });
      onUpdated(updated);
      success('Registration form saved');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Không thể lưu biểu mẫu');
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <h3 className="text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">Registration form</h3>
        <p className="mt-1 text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
          Build the form attendees fill in. Mark one short-text field with the star to use it as the name shown on the wheel.
        </p>
      </div>

      {fields.map((field, index) => {
        const isName = field.key === nameKey;
        const canBeName = field.type === 'short_text';
        const displayBlock = isDisplayField(field);
        const blockLabel = displayBlock
          ? field.type === 'rich_text'
            ? 'Rich text block'
            : 'Image block'
          : `Field ${index + 1}`;
        return (
          <div key={field.key} className={cardClass}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">{blockLabel}</span>
              <div className="ml-auto flex items-center gap-1">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className={`${ghostButtonClass} !h-8 !px-2`} aria-label="Move up">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === fields.length - 1} className={`${ghostButtonClass} !h-8 !px-2`} aria-label="Move down">
                  <ArrowDown className="h-4 w-4" />
                </button>
                {!displayBlock && (
                  <button
                    type="button"
                    onClick={() => canBeName && setNameKey(isName ? '' : field.key)}
                    disabled={!canBeName}
                    title={canBeName ? 'Use as wheel display name' : 'Only short-text fields can be the display name'}
                    className={`grid h-8 w-8 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border transition ${
                      isName
                        ? 'border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-accent-soft)] text-[var(--coachio-admin-dashboard-accent)]'
                        : 'border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-soft)] disabled:opacity-40'
                    }`}
                    aria-label="Designate as display name"
                  >
                    <Star className="h-4 w-4" fill={isName ? 'currentColor' : 'none'} />
                  </button>
                )}
                <button type="button" onClick={() => removeField(index)} className={`grid h-8 w-8 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-danger-text)] transition hover:bg-[var(--coachio-admin-dashboard-danger-bg)]`} aria-label="Remove field">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {field.type === 'rich_text' && (
              <label className="mt-3 flex flex-col gap-1">
                <span className={labelClass}>Content (HTML)</span>
                <textarea
                  rows={5}
                  className={`${inputClass} resize-y font-mono text-xs`}
                  value={field.content ?? ''}
                  onChange={(e) => patchField(index, { content: e.target.value })}
                  placeholder="<h2>Welcome!</h2><p>Fill in the form below to join the draw.</p>"
                />
                <span className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">Rendered as sanitized HTML between the form fields. No answer is collected.</span>
              </label>
            )}

            {field.type === 'image' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className={labelClass}>Image URL</span>
                  <input className={inputClass} value={field.image_url ?? ''} onChange={(e) => patchField(index, { image_url: e.target.value })} placeholder="https://…/banner.png" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={labelClass}>Alt text (optional)</span>
                  <input className={inputClass} value={field.alt ?? ''} onChange={(e) => patchField(index, { alt: e.target.value })} placeholder="Event banner" />
                </label>
              </div>
            )}

            {!displayBlock && (
            <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Label</span>
                <input className={inputClass} value={field.label} onChange={(e) => patchField(index, { label: e.target.value })} placeholder="e.g. Full name" />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Type</span>
                <select className={inputClass} value={field.type} onChange={(e) => changeType(index, e.target.value as LuckyFormFieldType)}>
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {field.type === 'rating' && (
              <label className="mt-3 flex max-w-[12rem] flex-col gap-1">
                <span className={labelClass}>Max scale</span>
                <input
                  type="number"
                  min={2}
                  max={10}
                  className={inputClass}
                  value={field.scale_max ?? 5}
                  onChange={(e) => patchField(index, { scale_max: Math.max(2, Number(e.target.value) || 5) })}
                />
              </label>
            )}

            {CHOICE_TYPES.includes(field.type) && (
              <div className="mt-3 space-y-2">
                <span className={labelClass}>Options</span>
                {(field.options ?? []).map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input className={`${inputClass} flex-1`} value={opt} onChange={(e) => setOption(index, oi, e.target.value)} />
                    <button type="button" onClick={() => removeOption(index, oi)} className="grid h-9 w-9 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-danger-text)]" aria-label="Remove option">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addOption(index)} className={`${ghostButtonClass} !h-8`}>
                  <Plus className="h-4 w-4" />
                  Add option
                </button>
              </div>
            )}

            <label className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
              <input type="checkbox" checked={field.required} onChange={(e) => patchField(index, { required: e.target.checked })} />
              Required
            </label>
            </>
            )}
          </div>
        );
      })}

      <div className="grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={addField} className={`${ghostButtonClass} justify-center !h-11`}>
          <Plus className="h-4 w-4" />
          Add field
        </button>
        <button type="button" onClick={() => addBlock('rich_text')} className={`${ghostButtonClass} justify-center !h-11`}>
          <Type className="h-4 w-4" />
          Add rich text
        </button>
        <button type="button" onClick={() => addBlock('image')} className={`${ghostButtonClass} justify-center !h-11`}>
          <ImageIcon className="h-4 w-4" />
          Add image
        </button>
      </div>

      {error && <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">{error}</p>}

      <button type="button" onClick={handleSave} disabled={saving} className={primaryButtonClass}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save form
      </button>
    </div>
  );
}
