export type RedirectMatchType = 'exact' | 'wildcard';
export type RedirectStatusCode = 301 | 302;

export interface RedirectRule {
  id: string;
  source_path: string;
  target_url: string;
  match_type: RedirectMatchType;
  status_code: RedirectStatusCode;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface RedirectListResponse {
  items: RedirectRule[];
  total: number;
}

export interface RedirectCreateInput {
  source_path: string;
  target_url: string;
  match_type: RedirectMatchType;
  status_code: RedirectStatusCode;
  is_active?: boolean;
}

export type RedirectUpdateInput = Partial<RedirectCreateInput>;

export interface NotFoundConfig {
  enabled: boolean;
  target_url: string;
}

/** Public payload consumed by the Next.js middleware / not-found page. */
export interface RedirectPublicConfig {
  rules: RedirectRule[];
  not_found: NotFoundConfig;
}
