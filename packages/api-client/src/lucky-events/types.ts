/** Types for the Lucky Draw feature (admin + public). */

// ─── Enums / unions ────────────────────────────────────────────────────────

export type LuckyEventStatus = 'draft' | 'open' | 'locked' | 'completed';

export type LuckyFormFieldType =
  | 'short_text'
  | 'phone'
  | 'email'
  | 'rating'
  | 'paragraph'
  | 'single_choice'
  | 'multi_choice'
  // Display-only content blocks (no answer collected).
  | 'rich_text'
  | 'image';

// ─── Form schema ───────────────────────────────────────────────────────────

export interface LuckyFormField {
  key: string;
  type: LuckyFormFieldType;
  label: string;
  required: boolean;
  options?: string[];
  scale_max?: number;
  // Display fields (no answer): rich_text carries sanitized HTML `content`;
  // image carries `image_url` + optional `alt`.
  content?: string | null;
  image_url?: string | null;
  alt?: string | null;
}

export interface LuckySuccessConfig {
  headline?: string;
  message?: string;
  // Optional sanitized HTML; when set it replaces the headline+message block.
  custom_html?: string | null;
}

// ─── Entities ──────────────────────────────────────────────────────────────

export interface LuckyEvent {
  id: string;
  funnel_id: string;
  title: string;
  status: LuckyEventStatus;
  public_token?: string | null;
  /** Optional friendly slug for /draw/<slug>; falls back to public_token. */
  slug?: string | null;
  form_schema?: LuckyFormField[] | null;
  success_config?: LuckySuccessConfig | null;
  display_config?: Record<string, unknown> | null;
  name_field_key?: string | null;
  opened_at?: string | null;
  locked_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface LuckyEventListItem {
  id: string;
  funnel_id: string;
  title: string;
  status: LuckyEventStatus;
  participant_count: number;
  winner_count: number;
  created_at: string;
}

export interface LuckyPrize {
  id: string;
  event_id: string;
  name: string;
  quantity: number;
  sort_order: number;
  awarded_count: number;
}

export interface LuckyParticipant {
  id: string;
  event_id: string;
  display_name: string;
  phone?: string | null;
  answers?: Record<string, unknown> | null;
  source: string;
  created_at: string;
}

export interface LuckyWinner {
  id: string;
  event_id: string;
  prize_id: string;
  prize_name?: string | null;
  participant_id: string;
  display_name?: string | null;
  /** Contact/identity derived from the participant (empty when not collected). */
  phone?: string | null;
  email?: string | null;
  spin_order: number;
  won_at: string;
}

export interface LuckyEventTokenInfo {
  event_id: string;
  public_token: string;
  register_endpoint: string;
}

// ─── Input types ───────────────────────────────────────────────────────────

export interface LuckyEventCreateInput {
  funnel_id: string;
  title: string;
  slug?: string | null;
  form_schema?: LuckyFormField[];
  name_field_key?: string;
  success_config?: LuckySuccessConfig;
  display_config?: Record<string, unknown>;
}

/** Editable fields of a lucky event. */
export interface LuckyEventUpdateInput {
  title?: string;
  slug?: string | null;
  form_schema?: LuckyFormField[];
  name_field_key?: string;
  success_config?: LuckySuccessConfig;
  display_config?: Record<string, unknown>;
}

export interface LuckyPrizeInput {
  name: string;
  quantity: number;
  sort_order: number;
}

export type LuckyPrizeUpdateInput = Partial<LuckyPrizeInput>;

export interface LuckyParticipantInput {
  display_name: string;
  phone?: string;
  answers?: Record<string, unknown>;
}

// ─── Public ────────────────────────────────────────────────────────────────

export interface LuckyPublicEvent {
  title: string;
  status: LuckyEventStatus;
  form_schema: LuckyFormField[];
  name_field_key?: string | null;
  success_config?: LuckySuccessConfig | null;
}

export interface LuckyRegisterResult {
  ok: boolean;
  success_config?: LuckySuccessConfig;
}
