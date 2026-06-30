'use client';

import type { LuckyFormField } from '@coachio/api-client';
import { fieldInputClass } from '../shared/text-field';

export type FieldValue = string | string[];

interface LuckyDrawFieldProps {
  field: LuckyFormField;
  value: FieldValue;
  error?: string;
  onChange: (value: FieldValue) => void;
}

const inputTypeFor: Record<string, string> = {
  short_text: 'text',
  phone: 'tel',
  email: 'email',
};

/**
 * Render một trường form dựa trên schema (LuckyFormField). Mobile-first, vùng chạm ≥44px.
 * Quản lý value/onChange từ component cha — không tự giữ state.
 */
export function LuckyDrawField({ field, value, error, onChange }: LuckyDrawFieldProps) {
  const fieldId = `lucky-field-${field.key}`;
  const labelId = `${fieldId}-label`;

  // Khối hiển thị (không thu thập câu trả lời): render nội dung, không có label/required.
  if (field.type === 'rich_text') {
    if (!field.content) return null;
    return (
      // HTML đã được sanitize ở backend (nh3) trước khi trả về.
      <div
        className="lucky-rich-text text-base leading-relaxed text-gray-700 [&_a]:text-orange-600 [&_a]:underline [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-2"
        dangerouslySetInnerHTML={{ __html: field.content }}
      />
    );
  }

  if (field.type === 'image') {
    if (!field.image_url) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={field.image_url}
        alt={field.alt ?? ''}
        className="h-auto w-full rounded-xl object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <div>
      <label
        id={labelId}
        htmlFor={fieldId}
        className="mb-1.5 block text-base font-medium text-gray-800"
      >
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>

      {renderControl()}

      {error && <p className="mt-1.5 text-sm font-medium text-red-500">{error}</p>}
    </div>
  );

  function renderControl() {
    switch (field.type) {
      case 'paragraph':
        return (
          <textarea
            id={fieldId}
            rows={4}
            required={field.required}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            className={fieldInputClass(!!error)}
          />
        );

      case 'rating':
        return renderRating();

      case 'single_choice':
        return renderSingleChoice();

      case 'multi_choice':
        return renderMultiChoice();

      case 'short_text':
      case 'phone':
      case 'email':
      default:
        return (
          <input
            id={fieldId}
            type={inputTypeFor[field.type] ?? 'text'}
            inputMode={field.type === 'phone' ? 'tel' : undefined}
            required={field.required}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            className={fieldInputClass(!!error)}
          />
        );
    }
  }

  function renderRating() {
    const max = field.scale_max && field.scale_max > 0 ? field.scale_max : 5;
    const selected = typeof value === 'string' ? value : '';
    return (
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {Array.from({ length: max }, (_, i) => String(i + 1)).map((n) => {
          const active = selected === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(n)}
              className={[
                'flex h-12 w-12 items-center justify-center rounded-xl border text-base font-semibold transition-all',
                active
                  ? 'border-orange-400 bg-orange-500 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300',
              ].join(' ')}
            >
              {n}
            </button>
          );
        })}
      </div>
    );
  }

  function renderSingleChoice() {
    const options = field.options ?? [];
    const selected = typeof value === 'string' ? value : '';
    return (
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-2">
        {options.map((opt) => {
          const active = selected === opt;
          return (
            <label
              key={opt}
              className={[
                'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base transition-all',
                active
                  ? 'border-orange-400 bg-orange-50 text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300',
              ].join(' ')}
            >
              <input
                type="radio"
                name={fieldId}
                value={opt}
                checked={active}
                onChange={() => onChange(opt)}
                className="h-5 w-5 accent-orange-500"
              />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>
    );
  }

  function renderMultiChoice() {
    const options = field.options ?? [];
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-col gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <label
              key={opt}
              className={[
                'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base transition-all',
                active
                  ? 'border-orange-400 bg-orange-50 text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300',
              ].join(' ')}
            >
              <input
                type="checkbox"
                value={opt}
                checked={active}
                onChange={() =>
                  onChange(
                    active ? selected.filter((v) => v !== opt) : [...selected, opt],
                  )
                }
                className="h-5 w-5 accent-orange-500"
              />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>
    );
  }
}
