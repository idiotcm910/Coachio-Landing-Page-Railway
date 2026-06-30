'use client';

import { ExternalLink } from 'lucide-react';
import { LandingSectionFrame } from '../../landing-shared/LandingSectionFrame';

interface SuccessPreviewProps {
  /** success_config.html — custom HTML replacing the entire thank-you page (if set). */
  html: string;
  /** Zalo group link — shows a "Join Zalo" button in the default layout. */
  zaloLink: string;
  /** Stable id for matching postMessage from the iframe preview. */
  frameId?: string;
}

/**
 * Shared static preview of a success/thank-you page.
 * - Has custom HTML → renders full-page in an isolated iframe (same as landing sections).
 * - No HTML → default thank-you template (🎉 + optional Zalo button).
 *
 * Used by AdminFunnelSuccessWorkspace and AdminCourseSuccessWorkspace.
 */
export function SuccessPreview({ html, zaloLink, frameId = 'success-preview' }: SuccessPreviewProps) {
  if (html?.trim()) {
    return (
      <div className="min-h-full bg-white">
        <LandingSectionFrame html={html} frameId={frameId} title="Thank-you page" />
      </div>
    );
  }

  return (
    <div className="grid min-h-full place-items-center bg-gray-50 p-4 py-10">
      <div className="pointer-events-none w-full max-w-md select-none rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mb-4 text-6xl">🎉</div>
        <h2 className="mb-2 text-2xl font-bold text-gray-900">CHÚC MỪNG!</h2>
        <p className="mb-6 text-gray-600">Bạn đã đăng ký thành công!</p>

        {zaloLink?.trim() && (
          <div className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-4 text-lg font-bold text-white">
            <ExternalLink className="h-5 w-5" />
            TRUY CẬP NHÓM ZALO
          </div>
        )}

        <div className="flex w-full items-center justify-center rounded-xl bg-orange-500 py-4 text-lg font-bold text-white">
          VỀ TRANG SẢN PHẨM
        </div>
      </div>
    </div>
  );
}
