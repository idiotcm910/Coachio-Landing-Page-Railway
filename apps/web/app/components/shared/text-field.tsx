'use client';

import { forwardRef } from 'react';

/**
 * Class input dùng chung cho các form public (checkout, funnel...).
 * Luôn có `bg-white` để input không bị nền tối mặc định của trình duyệt/theme đè vào.
 * Tách ra để các ô input không-label (vd: ô nhập mã giảm giá) tái sử dụng đồng nhất.
 */
export function fieldInputClass(hasError = false): string {
  return [
    'w-full rounded-xl border bg-white px-4 py-3 text-base text-gray-900',
    'placeholder-gray-400 shadow-sm outline-none transition-all duration-200',
    'hover:border-gray-300 focus:border-orange-400 focus:ring-4 focus:ring-orange-100',
    hasError ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-gray-200',
  ].join(' ');
}

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

/** Input đơn lẻ (không kèm label) — dùng style chung. */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ hasError, className, ...props }, ref) => (
    <input ref={ref} className={`${fieldInputClass(hasError)} ${className ?? ''}`} {...props} />
  ),
);
TextInput.displayName = 'TextInput';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  error?: string;
}

/** Trường form chuẩn: label (+ dấu bắt buộc) + input + thông báo lỗi. */
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, required, error, id, className, ...props }, ref) => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <TextInput ref={ref} id={id} hasError={!!error} className={className} {...props} />
      {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}
    </div>
  ),
);
FormField.displayName = 'FormField';
