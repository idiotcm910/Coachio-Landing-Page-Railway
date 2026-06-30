/**
 * Dữ liệu mẫu dùng cho preview tĩnh của các trang funnel trong trình sửa (admin).
 * Preview chỉ minh hoạ bố cục/nội dung; không gọi API, không tương tác thật.
 */

export interface FunnelPreviewSample {
  productName: string;
  price: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  bankName: string;
  accountNumber: string;
  orderCode: string;
}

export const FUNNEL_PREVIEW_SAMPLE: FunnelPreviewSample = {
  productName: 'Khoá học mẫu',
  price: 1_000_000,
  buyerName: 'Nguyễn Văn A',
  buyerEmail: 'nguyenvana@example.com',
  buyerPhone: '0912345678',
  bankName: 'MBBank',
  accountNumber: '0901234567',
  orderCode: 'LB-DEMO-2026',
};

/** Định dạng tiền VND giống trang public (Intl vi-VN + hậu tố VND). */
export function formatPreviewVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VND';
}
