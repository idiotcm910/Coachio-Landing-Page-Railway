import type { ReactNode } from 'react';
import type { FunnelCheckoutConfig, FunnelCheckoutTemplate, FunnelQuote } from '@coachio/api-client';

/** Màu nhấn mặc định (cam CTA) khi admin chưa cấu hình. */
export const DEFAULT_ACCENT = '#f97316';
export const DEFAULT_TEMPLATE: FunnelCheckoutTemplate = 'split-hero';

/** Split-hero layout defaults + bounds (overall section width + column ratios). */
export const DEFAULT_SECTION_MAX_WIDTH = 1024;
export const SECTION_MAX_WIDTH_MIN = 720;
export const SECTION_MAX_WIDTH_MAX = 1440;
export const DEFAULT_SPLIT_LEFT_RATIO = 1;
export const DEFAULT_SPLIT_RIGHT_RATIO = 1.1;
export const SPLIT_RATIO_MIN = 0.5;
export const SPLIT_RATIO_MAX = 2;

/** Chuẩn hóa accent color: chỉ chấp nhận hex hợp lệ, nếu không dùng mặc định. */
export function resolveAccent(color?: string | null): string {
  if (color && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim())) return color.trim();
  return DEFAULT_ACCENT;
}

/** Clamp a finite number into [min,max], falling back when invalid. */
function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Overall checkout section max width (px), clamped to a sane range. */
export function resolveSectionMaxWidth(width?: number): number {
  return clampNumber(width, SECTION_MAX_WIDTH_MIN, SECTION_MAX_WIDTH_MAX, DEFAULT_SECTION_MAX_WIDTH);
}

/** A split-hero column ratio (fr), clamped to a sane range. */
export function resolveSplitRatio(ratio: number | undefined, fallback: number): number {
  return clampNumber(ratio, SPLIT_RATIO_MIN, SPLIT_RATIO_MAX, fallback);
}

/**
 * Props chung cho mọi template checkout. Client dựng sẵn các khối dùng chung
 * (form người mua, mã giảm, tóm tắt, nút CTA) rồi truyền vào template để bố cục.
 */
export interface CheckoutTemplateProps {
  slug: string;
  config: FunnelCheckoutConfig;
  /** Accent đã chuẩn hóa (luôn là hex hợp lệ). */
  accent: string;
  quote: FunnelQuote | null;
  /** Các khối dùng chung — template chỉ sắp xếp vị trí. */
  buyerForm: ReactNode;
  discountCodes: ReactNode;
  orderSummary: ReactNode;
  submitButton: ReactNode;
}
