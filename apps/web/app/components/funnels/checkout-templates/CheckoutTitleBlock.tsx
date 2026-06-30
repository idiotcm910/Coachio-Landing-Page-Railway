'use client';

import type { FunnelCheckoutConfig } from '@coachio/api-client';

interface CheckoutTitleBlockProps {
  config: FunnelCheckoutConfig;
  /** Class cho headline khi render dạng văn bản (mỗi template tự truyền kích thước/màu). */
  headlineClassName: string;
  messageClassName: string;
  fallbackHeadline?: string;
}

/**
 * Khối tiêu đề + mô tả của trang checkout.
 * - Nếu admin cấu hình `custom_html` → render HTML đó (admin-authored, role-gated).
 * - Nếu không → render `headline`/`message` dạng văn bản với class do template quyết định.
 */
export function CheckoutTitleBlock({
  config,
  headlineClassName,
  messageClassName,
  fallbackHeadline = 'Thông tin đăng ký',
}: CheckoutTitleBlockProps) {
  const customHtml = config.custom_html?.trim();
  if (customHtml) {
    return (
      // eslint-disable-next-line react/no-danger -- nội dung do admin (role-gated) soạn
      <div className="funnel-checkout-custom-html" dangerouslySetInnerHTML={{ __html: customHtml }} />
    );
  }

  const headline = config.headline?.trim() || fallbackHeadline;
  const message = config.message?.trim();
  return (
    <>
      <h1 className={headlineClassName}>{headline}</h1>
      {message && <p className={messageClassName}>{message}</p>}
    </>
  );
}
