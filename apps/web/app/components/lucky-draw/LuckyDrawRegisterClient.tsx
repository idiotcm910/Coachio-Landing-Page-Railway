'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  getApiErrorMessage,
  luckyEventsApi,
  type LuckyFormField,
  type LuckyPublicEvent,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { LuckyDrawField, type FieldValue } from './LuckyDrawField';
import { LuckyDrawStateScreen } from './LuckyDrawStateScreen';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; event: LuckyPublicEvent }
  | { phase: 'done'; headline: string; message: string; customHtml?: string | null };

/** Display-only field types collect no answer and skip required validation. */
const DISPLAY_TYPES: ReadonlyArray<LuckyFormField['type']> = ['rich_text', 'image'];

function isInputField(field: LuckyFormField): boolean {
  return !DISPLAY_TYPES.includes(field.type);
}

const DEFAULT_SUCCESS = {
  headline: 'Đăng ký thành công!',
  message: 'Cảm ơn bạn đã tham gia. Hãy chú ý theo dõi màn hình để biết kết quả quay thưởng nhé!',
};

const CLOSED = {
  headline: 'Đăng ký đã đóng',
  message: 'Rất tiếc, sự kiện này hiện không mở đăng ký. Vui lòng liên hệ ban tổ chức để được hỗ trợ.',
};

const NOT_FOUND = {
  headline: 'Không tìm thấy sự kiện',
  message: 'Đường dẫn không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại mã QR / liên kết từ ban tổ chức.',
};

function emptyValue(field: LuckyFormField): FieldValue {
  return field.type === 'multi_choice' ? [] : '';
}

function isEmpty(value: FieldValue): boolean {
  return Array.isArray(value) ? value.length === 0 : value.trim() === '';
}

export function LuckyDrawRegisterClient({ token }: { token: string }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const event = await luckyEventsApi.getPublic(token);
        if (!active) return;
        if (event.status !== 'open') {
          setState({ phase: 'done', ...CLOSED });
          return;
        }
        const schema = (event.form_schema ?? []).filter(isInputField);
        setValues(Object.fromEntries(schema.map((f) => [f.key, emptyValue(f)])));
        setState({ phase: 'ready', event });
      } catch (e) {
        if (!active) return;
        // Token không hợp lệ / đã xoay vòng -> 401/404. Hiện màn hình thân thiện thay vì lỗi thô.
        setState({ phase: 'done', ...NOT_FOUND });
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const setFieldValue = useCallback((key: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
  }, []);

  const schema = state.phase === 'ready' ? state.event.form_schema ?? [] : [];
  const inputFields = useMemo(() => schema.filter(isInputField), [schema]);

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {};
    // SĐT Việt Nam: 10 chữ số, bắt đầu bằng 0. Email: định dạng chuẩn có @ và tên miền.
    const phoneRe = /^0\d{9}$/;
    const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    for (const field of inputFields) {
      const raw = values[field.key] ?? emptyValue(field);
      const empty = isEmpty(raw);
      if (field.required && empty) {
        next[field.key] = 'Vui lòng điền thông tin này';
        continue;
      }
      if (empty) continue;
      const text = Array.isArray(raw) ? '' : raw.trim();
      if (field.type === 'phone' && !phoneRe.test(text)) {
        next[field.key] = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0';
      } else if (field.type === 'email' && !emailRe.test(text)) {
        next[field.key] = 'Email không đúng định dạng (ví dụ: ten@gmail.com)';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [inputFields, values]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      if (!validate()) {
        toastError('Vui lòng kiểm tra lại thông tin đã nhập');
        return;
      }
      setSubmitting(true);
      try {
        // answers được khóa theo field.key — chỉ gồm các trường nhập liệu (bỏ qua khối hiển thị).
        const answers: Record<string, unknown> = {};
        for (const field of inputFields) answers[field.key] = values[field.key] ?? emptyValue(field);

        const result = await luckyEventsApi.register(token, answers);
        const cfg = result.success_config;
        toastSuccess('Đăng ký thành công!');
        setState({
          phase: 'done',
          headline: cfg?.headline || DEFAULT_SUCCESS.headline,
          message: cfg?.message || DEFAULT_SUCCESS.message,
          customHtml: cfg?.custom_html ?? null,
        });
      } catch (err) {
        const message = getApiErrorMessage(err, 'Đăng ký không thành công. Vui lòng thử lại.');
        toastError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, validate, inputFields, values, token, toastSuccess, toastError],
  );

  const successTone = useMemo(
    () => state.phase === 'done' && state.headline !== CLOSED.headline && state.headline !== NOT_FOUND.headline,
    [state],
  );

  if (state.phase === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </main>
    );
  }

  if (state.phase === 'done') {
    return (
      <LuckyDrawStateScreen
        tone={successTone ? 'success' : 'closed'}
        headline={state.headline}
        message={state.message}
        customHtml={successTone ? state.customHtml : null}
      />
    );
  }

  if (state.phase === 'error') {
    return <LuckyDrawStateScreen tone="closed" headline={NOT_FOUND.headline} message={state.message} />;
  }

  const { event } = state;

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white px-4 py-8">
      <div className="mx-auto w-full md:w-[60%]">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-bold leading-tight text-gray-900">{event.title}</h1>
          <p className="mt-1.5 text-sm text-gray-500">Điền thông tin bên dưới để tham gia quay thưởng</p>
        </header>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
        >
          {schema.map((field) => (
            <LuckyDrawField
              key={field.key}
              field={field}
              value={values[field.key] ?? emptyValue(field)}
              error={errors[field.key]}
              onChange={(value) => setFieldValue(field.key, value)}
            />
          ))}

          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 text-lg font-semibold text-white shadow-sm transition-all hover:bg-orange-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
            Tham gia quay thưởng
          </button>
        </form>
      </div>
    </main>
  );
}
