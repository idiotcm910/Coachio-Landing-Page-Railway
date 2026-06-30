import type { PaginatedModel } from '../http/types';

export interface FunnelRevenueAnalyticsParams {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface LeadStatusBreakdown {
  subscribed: number;
  lead: number;
  purchased: number;
  total: number;
}

export interface RevenueScopeSummary {
  total_revenue: number;
  paid_orders: number;
}

export interface FunnelRevenueRow {
  funnel_id: string;
  funnel_title: string;
  funnel_slug: string;
  revenue: number;
  paid_orders: number;
  leads: LeadStatusBreakdown;
  /** Purchased ÷ total leads, 0–1 ratio (0 when no leads). */
  conversion_rate: number;
}

export interface ProductRevenueRow {
  product_id: string;
  product_name: string;
  revenue: number;
  paid_orders: number;
  leads: LeadStatusBreakdown;
  /** Purchased ÷ total leads, 0–1 ratio (0 when no leads). */
  conversion_rate: number;
}

export interface RevenueDailyPoint {
  date: string;
  revenue: number;
  paid_orders: number;
}

export interface ProductRevenueDetailSummary {
  total_revenue: number;
  paid_orders: number;
  leads: LeadStatusBreakdown;
  conversion_rate: number;
}

export interface ProductRevenueDetail {
  product_id: string;
  product_name: string;
  summary: ProductRevenueDetailSummary;
  funnels: FunnelRevenueRow[];
  daily: RevenueDailyPoint[];
}

export interface FunnelRevenuePage extends PaginatedModel<FunnelRevenueRow> {
  summary: RevenueScopeSummary;
}

export interface ProductRevenuePage extends PaginatedModel<ProductRevenueRow> {
  summary: RevenueScopeSummary;
}
