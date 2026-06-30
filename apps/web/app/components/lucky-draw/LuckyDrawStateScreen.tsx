'use client';

import { CheckCircle2, Lock, PartyPopper } from 'lucide-react';

type ScreenTone = 'closed' | 'success';

interface LuckyDrawStateScreenProps {
  tone: ScreenTone;
  headline: string;
  message: string;
  // Sanitized HTML (BE-cleaned). When set, replaces the headline+message block.
  customHtml?: string | null;
}

/**
 * Màn hình trạng thái toàn trang (đăng ký đã đóng / không tìm thấy / đăng ký thành công).
 * Dùng chung để giữ bố cục nhất quán, mobile-first.
 */
export function LuckyDrawStateScreen({ tone, headline, message, customHtml }: LuckyDrawStateScreenProps) {
  const Icon = tone === 'success' ? PartyPopper : Lock;
  const iconWrap =
    tone === 'success'
      ? 'bg-emerald-100 text-emerald-600'
      : 'bg-gray-100 text-gray-500';

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-orange-50 to-white px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${iconWrap}`}>
          <Icon className="h-8 w-8" />
        </div>
        {customHtml ? (
          // HTML đã được sanitize ở backend (nh3) trước khi trả về.
          <div
            className="lucky-rich-text text-left text-base leading-relaxed text-gray-700 [&_a]:text-orange-600 [&_a]:underline [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:my-3 [&_img]:rounded-xl [&_p]:mb-2"
            dangerouslySetInnerHTML={{ __html: customHtml }}
          />
        ) : (
          <>
            <h1 className="mb-2 text-2xl font-bold text-gray-900">{headline}</h1>
            <p className="text-base leading-relaxed text-gray-600">{message}</p>
          </>
        )}
        {tone === 'success' && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Bạn đã có mặt trong danh sách quay thưởng</span>
          </div>
        )}
      </div>
    </main>
  );
}
