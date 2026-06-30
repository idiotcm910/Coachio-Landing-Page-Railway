export type AdminFunnelOrderStatus = 'SUCCESS' | 'PENDING' | 'ALL';

export interface AdminFunnelOrderListItem {
  id: string;
  order_code: string;
  buyer_email: string;
  buyer_full_name?: string | null;
  buyer_phone?: string | null;
  funnel_title: string;
  product_name: string;
  amount: number;
  status: string;
  payment_provider: string;
  paid_at?: string | null;
  created_at: string;
}

export interface AdminFunnelOrderListResponse {
  items: AdminFunnelOrderListItem[];
  next_cursor: string | null;
  has_next: boolean;
}

export interface AdminFunnelOrderSummary {
  success_count: number;
  revenue: number;
  aov: number;
}

export interface AdminFunnelOrderDetail extends AdminFunnelOrderListItem {
  subtotal_amount: number;
  discount_amount: number;
  funnel_slug: string;
  funnel_id: string;
  lead_id: string | null;
  updated_at: string | null;
  manual_activated_by?: string | null;
  manual_activated_at?: string | null;
}

/** Shared filter params for list + summary (pagination lives only on list). */
export interface AdminFunnelOrderFilterParams {
  status?: AdminFunnelOrderStatus;
  q?: string;
  funnel_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface AdminFunnelOrderListParams extends AdminFunnelOrderFilterParams {
  cursor?: string;
  per_page?: number;
  sort_by?: 'paid_at' | 'created_at';
  sort_order?: 'asc' | 'desc';
}
