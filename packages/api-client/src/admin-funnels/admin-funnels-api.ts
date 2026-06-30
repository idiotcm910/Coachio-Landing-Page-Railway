import { apiClient } from '../http/api-client';
import { getApiErrorMessage } from '../http/error-message';
import type { ApiResponse } from '../http/types';
import type {
  Discount,
  DiscountDefaultActivationInput,
  DiscountDefaultOwner,
  DiscountInput,
  DiscountUpdateInput,
  Funnel,
  FunnelCaptureToken,
  FunnelCloneInput,
  FunnelCreateInput,
  FunnelEmailTemplate,
  FunnelEmailTemplateInput,
  FunnelLanding,
  FunnelSection,
  FunnelSectionInput,
  FunnelSectionUpdateInput,
  FunnelSeoInput,
  FunnelTrackingDefaults,
  FunnelUpdateInput,
  FunnelAnalyticsOverview,
  FunnelAnalyticsParams,
  Lead,
  LeadListFilter,
  LeadListPage,
  Product,
  ProductInput,
  PublicFunnelLanding,
} from '../funnels/types';

function asBody<T extends object>(input: T): Record<string, unknown> {
  return input as Record<string, unknown>;
}

function unwrap<T>(response: ApiResponse<T>, errorLabel: string): T {
  if (response.data === undefined || response.data === null) {
    throw new Error(getApiErrorMessage(response.error, errorLabel));
  }
  return response.data;
}

/** Admin Products — /api/v1/admin/products */
export const adminProductsApi = {
  async list(params: { type?: string; status?: string } = {}): Promise<Product[]> {
    const response = await apiClient.get<ApiResponse<{ items: Product[]; total: number }>>(
      '/api/v1/admin/products',
      { queryParams: params as Record<string, string> },
    );
    return unwrap(response, 'Load products failed').items;
  },

  async create(input: ProductInput): Promise<Product> {
    const response = await apiClient.post<ApiResponse<Product>>('/api/v1/admin/products', asBody(input));
    return unwrap(response, 'Create product failed');
  },

  async get(productId: string): Promise<Product> {
    const response = await apiClient.get<ApiResponse<Product>>(`/api/v1/admin/products/${productId}`);
    return unwrap(response, 'Load product failed');
  },

  async update(productId: string, input: Partial<ProductInput>): Promise<Product> {
    const response = await apiClient.patch<ApiResponse<Product>>(
      `/api/v1/admin/products/${productId}`,
      asBody(input),
    );
    return unwrap(response, 'Update product failed');
  },

  async remove(productId: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`/api/v1/admin/products/${productId}`);
  },
};

/** Admin Funnels — /api/v1/admin/funnels (CRUD + clone + landing + sections + emails) */
export const adminFunnelsApi = {
  async list(params: { product_id?: string; status?: string } = {}): Promise<Funnel[]> {
    const response = await apiClient.get<ApiResponse<{ items: Funnel[]; total: number }>>(
      '/api/v1/admin/funnels',
      { queryParams: params as Record<string, string> },
    );
    return unwrap(response, 'Load funnels failed').items;
  },

  async create(input: FunnelCreateInput): Promise<Funnel> {
    const response = await apiClient.post<ApiResponse<Funnel>>('/api/v1/admin/funnels', asBody(input));
    return unwrap(response, 'Create funnel failed');
  },

  /** Global Meta tracking defaults (non-secret) — used to show default vs custom in the tracking UI. */
  async getTrackingDefaults(): Promise<FunnelTrackingDefaults> {
    const response = await apiClient.get<ApiResponse<FunnelTrackingDefaults>>(
      '/api/v1/admin/funnels/tracking-defaults',
    );
    return unwrap(response, 'Load tracking defaults failed');
  },

  async get(funnelId: string): Promise<Funnel> {
    const response = await apiClient.get<ApiResponse<Funnel>>(`/api/v1/admin/funnels/${funnelId}`);
    return unwrap(response, 'Load funnel failed');
  },

  async update(funnelId: string, input: FunnelUpdateInput): Promise<Funnel> {
    const response = await apiClient.patch<ApiResponse<Funnel>>(
      `/api/v1/admin/funnels/${funnelId}`,
      asBody(input),
    );
    return unwrap(response, 'Update funnel failed');
  },

  async remove(funnelId: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`/api/v1/admin/funnels/${funnelId}`);
  },

  async clone(funnelId: string, input: FunnelCloneInput): Promise<Funnel> {
    const response = await apiClient.post<ApiResponse<Funnel>>(
      `/api/v1/admin/funnels/${funnelId}/clone`,
      asBody(input),
    );
    return unwrap(response, 'Clone funnel failed');
  },

  // ── Landing (full SEO) ──
  async getLanding(funnelId: string): Promise<FunnelLanding> {
    const response = await apiClient.get<ApiResponse<FunnelLanding>>(`/api/v1/admin/funnels/${funnelId}/landing`);
    return unwrap(response, 'Load landing failed');
  },

  async updateLandingSeo(funnelId: string, input: FunnelSeoInput): Promise<FunnelLanding> {
    const response = await apiClient.patch<ApiResponse<FunnelLanding>>(
      `/api/v1/admin/funnels/${funnelId}/landing`,
      asBody(input),
    );
    return unwrap(response, 'Update SEO failed');
  },

  // ── Sections (mirror course landing builder operations) ──
  async listSections(funnelId: string): Promise<FunnelSection[]> {
    const response = await apiClient.get<ApiResponse<FunnelSection[]>>(
      `/api/v1/admin/funnels/${funnelId}/landing/sections`,
    );
    return unwrap(response, 'Load sections failed');
  },

  async createSection(funnelId: string, input: FunnelSectionInput): Promise<FunnelSection> {
    const response = await apiClient.post<ApiResponse<FunnelSection>>(
      `/api/v1/admin/funnels/${funnelId}/landing/sections`,
      asBody(input),
    );
    return unwrap(response, 'Create section failed');
  },

  async updateSection(funnelId: string, sectionId: string, input: FunnelSectionUpdateInput): Promise<FunnelSection> {
    const response = await apiClient.patch<ApiResponse<FunnelSection>>(
      `/api/v1/admin/funnels/${funnelId}/landing/sections/${sectionId}`,
      asBody(input),
    );
    return unwrap(response, 'Update section failed');
  },

  async deleteSection(funnelId: string, sectionId: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`/api/v1/admin/funnels/${funnelId}/landing/sections/${sectionId}`);
  },

  async reorderSections(funnelId: string, sectionIds: string[]): Promise<FunnelSection[]> {
    const response = await apiClient.put<ApiResponse<FunnelSection[]>>(
      `/api/v1/admin/funnels/${funnelId}/landing/sections/reorder`,
      { section_ids: sectionIds },
    );
    return unwrap(response, 'Reorder sections failed');
  },

  // ── Email templates (scope='funnel', course-edit parity) ──
  async listEmailTemplates(funnelId: string): Promise<FunnelEmailTemplate[]> {
    const response = await apiClient.get<ApiResponse<FunnelEmailTemplate[]>>(
      `/api/v1/admin/funnels/${funnelId}/email-templates`,
    );
    return unwrap(response, 'Load email templates failed');
  },

  async upsertEmailTemplate(funnelId: string, templateKey: string, input: FunnelEmailTemplateInput): Promise<void> {
    await apiClient.put<ApiResponse<unknown>>(
      `/api/v1/admin/funnels/${funnelId}/email-templates/${templateKey}`,
      asBody(input),
    );
  },

  async previewEmailTemplate(
    funnelId: string,
    templateKey: string,
    input: FunnelEmailTemplateInput,
  ): Promise<{ subject: string; html: string }> {
    const response = await apiClient.post<ApiResponse<{ subject: string; html: string }>>(
      `/api/v1/admin/funnels/${funnelId}/email-templates/${templateKey}/preview`,
      asBody(input),
    );
    return unwrap(response, 'Preview email failed');
  },

  async testSendEmailTemplate(
    funnelId: string,
    templateKey: string,
    input: FunnelEmailTemplateInput & { to_email: string },
  ): Promise<void> {
    await apiClient.post<ApiResponse<unknown>>(
      `/api/v1/admin/funnels/${funnelId}/email-templates/${templateKey}/test-send`,
      asBody(input),
    );
  },

  // ── Lead capture token ──
  /** GET /api/v1/admin/funnels/{funnelId}/capture-token — returns the current capture token (null if never generated). */
  async getCaptureToken(funnelId: string): Promise<FunnelCaptureToken> {
    const response = await apiClient.get<ApiResponse<FunnelCaptureToken>>(
      `/api/v1/admin/funnels/${funnelId}/capture-token`,
    );
    return unwrap(response, 'Load capture token failed');
  },

  /** POST /api/v1/admin/funnels/{funnelId}/capture-token/rotate — generate or rotate the capture token. */
  async rotateCaptureToken(funnelId: string): Promise<FunnelCaptureToken> {
    const response = await apiClient.post<ApiResponse<FunnelCaptureToken>>(
      `/api/v1/admin/funnels/${funnelId}/capture-token/rotate`,
      {},
    );
    return unwrap(response, 'Rotate capture token failed');
  },

  /**
   * GET /api/v1/admin/funnels/{funnelId}/preview — admin-only landing preview.
   * Returns the same PublicFunnelLanding shape as the public endpoint but works
   * for any status (draft/unpublished) and bypasses the public cache.
   */
  async getLandingPreview(funnelId: string): Promise<PublicFunnelLanding> {
    const response = await apiClient.get<ApiResponse<PublicFunnelLanding>>(
      `/api/v1/admin/funnels/${funnelId}/preview`,
    );
    return unwrap(response, 'Load landing preview failed');
  },
};

/** Admin Discounts — /api/v1/admin/discounts (global; not tied to any funnel) */
export const adminDiscountsApi = {
  /**
   * List all discounts. When `ownerType` + `ownerId` are provided the backend
   * attaches `is_default_for_owner` to each item.
   */
  async list(params?: { ownerType?: string; ownerId?: string }): Promise<Discount[]> {
    const queryParams: Record<string, string> = {};
    if (params?.ownerType) queryParams.owner_type = params.ownerType;
    if (params?.ownerId) queryParams.owner_id = params.ownerId;
    const response = await apiClient.get<ApiResponse<{ items: Discount[]; total: number }>>(
      '/api/v1/admin/discounts',
      { queryParams },
    );
    return unwrap(response, 'Load discounts failed').items;
  },

  async create(input: DiscountInput): Promise<Discount> {
    const response = await apiClient.post<ApiResponse<Discount>>('/api/v1/admin/discounts', asBody(input));
    return unwrap(response, 'Create discount failed');
  },

  async update(discountId: string, input: DiscountUpdateInput): Promise<Discount> {
    const response = await apiClient.patch<ApiResponse<Discount>>(
      `/api/v1/admin/discounts/${discountId}`,
      asBody(input),
    );
    return unwrap(response, 'Update discount failed');
  },

  async remove(discountId: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`/api/v1/admin/discounts/${discountId}`);
  },

  /** Mark a discount as the default for a given owner (funnel or course). */
  async setDefault(discountId: string, owner: { ownerType: string; ownerId: string }): Promise<void> {
    const body: DiscountDefaultActivationInput = {
      owner_type: owner.ownerType as 'funnel' | 'course',
      owner_id: owner.ownerId,
    };
    await apiClient.post<ApiResponse<unknown>>(
      `/api/v1/admin/discounts/${discountId}/default`,
      asBody(body),
    );
  },

  /** Unmark a discount as default for a given owner. */
  async unsetDefault(discountId: string, owner: { ownerType: string; ownerId: string }): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(
      `/api/v1/admin/discounts/${discountId}/default`,
      { queryParams: { owner_type: owner.ownerType, owner_id: owner.ownerId } },
    );
  },

  /**
   * Restrict a discount to a given owner (add it to the applicable scope).
   * Adding the first scope entry flips the code from global → restricted.
   */
  async addScope(discountId: string, owner: { ownerType: string; ownerId: string }): Promise<void> {
    const body: DiscountDefaultActivationInput = {
      owner_type: owner.ownerType as 'funnel' | 'course',
      owner_id: owner.ownerId,
    };
    await apiClient.post<ApiResponse<unknown>>(
      `/api/v1/admin/discounts/${discountId}/scope`,
      asBody(body),
    );
  },

  /** Remove a given owner from a discount's applicable scope (empty scope = global). */
  async removeScope(discountId: string, owner: { ownerType: string; ownerId: string }): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(
      `/api/v1/admin/discounts/${discountId}/scope`,
      { queryParams: { owner_type: owner.ownerType, owner_id: owner.ownerId } },
    );
  },

  /** List the owners (funnels/courses) a discount is currently a default for. */
  async listDefaults(discountId: string): Promise<DiscountDefaultOwner[]> {
    const response = await apiClient.get<ApiResponse<DiscountDefaultOwner[]>>(
      `/api/v1/admin/discounts/${discountId}/defaults`,
    );
    return unwrap(response, 'Load discount defaults failed');
  },
};

/** Admin Leads — /api/v1/admin/leads (list/filter + CSV export) */
export const adminLeadsApi = {
  async list(filter: LeadListFilter = {}): Promise<LeadListPage> {
    const response = await apiClient.get<ApiResponse<LeadListPage>>('/api/v1/admin/leads', {
      queryParams: filter as Record<string, unknown> as Record<string, string>,
    });
    return unwrap(response, 'Load leads failed');
  },

  /** Returns the export URL — caller opens/downloads it with the auth token. */
  exportCsvPath(filter: Omit<LeadListFilter, 'page' | 'page_size'> = {}): string {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null) params.set(key, String(value));
    });
    const query = params.toString();
    return `/api/v1/admin/leads/export${query ? `?${query}` : ''}`;
  },
};

/** Admin Funnel Analytics — /api/v1/admin/funnels/{funnelId}/analytics */
export const adminFunnelAnalyticsApi = {
  async getOverview(funnelId: string, params: FunnelAnalyticsParams = {}): Promise<FunnelAnalyticsOverview> {
    const response = await apiClient.get<ApiResponse<FunnelAnalyticsOverview>>(
      `/api/v1/admin/funnels/${funnelId}/analytics`,
      {
        queryParams: {
          ...(params.startDate ? { start_date: params.startDate } : {}),
          ...(params.endDate ? { end_date: params.endDate } : {}),
        },
      },
    );
    return unwrap(response, 'Load funnel analytics failed');
  },
};

// Re-export under module-style names for discoverability
export type { Lead };
