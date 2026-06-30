import { apiClient } from '../http/api-client';
import { getApiErrorMessage } from '../http/error-message';
import type { ApiResponse } from '../http/types';
import type {
  LuckyEvent,
  LuckyEventCreateInput,
  LuckyEventListItem,
  LuckyEventTokenInfo,
  LuckyEventUpdateInput,
  LuckyParticipant,
  LuckyParticipantInput,
  LuckyPrize,
  LuckyPrizeInput,
  LuckyPrizeUpdateInput,
  LuckyPublicEvent,
  LuckyRegisterResult,
  LuckyWinner,
} from './types';

function asBody<T extends object>(input: T): Record<string, unknown> {
  return input as Record<string, unknown>;
}

function unwrap<T>(response: ApiResponse<T>, errorLabel: string): T {
  if (response.data === undefined || response.data === null) {
    throw new Error(getApiErrorMessage(response.error, errorLabel));
  }
  return response.data;
}

/** Admin Lucky Draw — /api/v1/admin/lucky-events (events, prizes, participants, winners). */
export const adminLuckyEventsApi = {
  // ── Events ──
  async list(params: { funnel_id?: string } = {}): Promise<LuckyEventListItem[]> {
    const response = await apiClient.get<ApiResponse<{ items: LuckyEventListItem[]; total: number }>>(
      '/api/v1/admin/lucky-events',
      { queryParams: params as Record<string, string> },
    );
    return unwrap(response, 'Load lucky events failed').items;
  },

  async create(input: LuckyEventCreateInput): Promise<LuckyEvent> {
    const response = await apiClient.post<ApiResponse<LuckyEvent>>('/api/v1/admin/lucky-events', asBody(input));
    return unwrap(response, 'Create lucky event failed');
  },

  async get(eventId: string): Promise<LuckyEvent> {
    const response = await apiClient.get<ApiResponse<LuckyEvent>>(`/api/v1/admin/lucky-events/${eventId}`);
    return unwrap(response, 'Load lucky event failed');
  },

  async update(eventId: string, input: LuckyEventUpdateInput): Promise<LuckyEvent> {
    const response = await apiClient.patch<ApiResponse<LuckyEvent>>(
      `/api/v1/admin/lucky-events/${eventId}`,
      asBody(input),
    );
    return unwrap(response, 'Update lucky event failed');
  },

  async remove(eventId: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`/api/v1/admin/lucky-events/${eventId}`);
  },

  async setStatus(eventId: string, action: 'open' | 'lock'): Promise<LuckyEvent> {
    const response = await apiClient.patch<ApiResponse<LuckyEvent>>(
      `/api/v1/admin/lucky-events/${eventId}/status`,
      { action },
    );
    return unwrap(response, 'Update lucky event status failed');
  },

  // ── Public token ──
  async getToken(eventId: string): Promise<LuckyEventTokenInfo> {
    const response = await apiClient.get<ApiResponse<LuckyEventTokenInfo>>(
      `/api/v1/admin/lucky-events/${eventId}/token`,
    );
    return unwrap(response, 'Load lucky event token failed');
  },

  async rotateToken(eventId: string): Promise<LuckyEventTokenInfo> {
    const response = await apiClient.post<ApiResponse<LuckyEventTokenInfo>>(
      `/api/v1/admin/lucky-events/${eventId}/token/rotate`,
      {},
    );
    return unwrap(response, 'Rotate lucky event token failed');
  },

  // ── Prizes ──
  async listPrizes(eventId: string): Promise<LuckyPrize[]> {
    const response = await apiClient.get<ApiResponse<{ items: LuckyPrize[]; total: number }>>(
      `/api/v1/admin/lucky-events/${eventId}/prizes`,
    );
    return unwrap(response, 'Load prizes failed').items;
  },

  async createPrize(eventId: string, input: LuckyPrizeInput): Promise<LuckyPrize> {
    const response = await apiClient.post<ApiResponse<LuckyPrize>>(
      `/api/v1/admin/lucky-events/${eventId}/prizes`,
      asBody(input),
    );
    return unwrap(response, 'Create prize failed');
  },

  async updatePrize(eventId: string, prizeId: string, input: LuckyPrizeUpdateInput): Promise<LuckyPrize> {
    const response = await apiClient.patch<ApiResponse<LuckyPrize>>(
      `/api/v1/admin/lucky-events/${eventId}/prizes/${prizeId}`,
      asBody(input),
    );
    return unwrap(response, 'Update prize failed');
  },

  async removePrize(eventId: string, prizeId: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`/api/v1/admin/lucky-events/${eventId}/prizes/${prizeId}`);
  },

  // ── Participants ──
  async listParticipants(eventId: string): Promise<LuckyParticipant[]> {
    const response = await apiClient.get<ApiResponse<{ items: LuckyParticipant[]; total: number }>>(
      `/api/v1/admin/lucky-events/${eventId}/participants`,
    );
    return unwrap(response, 'Load participants failed').items;
  },

  async addParticipant(eventId: string, input: LuckyParticipantInput): Promise<LuckyParticipant> {
    const response = await apiClient.post<ApiResponse<LuckyParticipant>>(
      `/api/v1/admin/lucky-events/${eventId}/participants`,
      asBody(input),
    );
    return unwrap(response, 'Add participant failed');
  },

  async removeParticipant(eventId: string, participantId: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(
      `/api/v1/admin/lucky-events/${eventId}/participants/${participantId}`,
    );
  },

  // ── Draw ──
  async spin(eventId: string, prizeId: string): Promise<LuckyWinner> {
    const response = await apiClient.post<ApiResponse<{ winner: LuckyWinner }>>(
      `/api/v1/admin/lucky-events/${eventId}/spin`,
      { prize_id: prizeId },
    );
    return unwrap(response, 'Spin failed').winner;
  },

  async listWinners(eventId: string): Promise<LuckyWinner[]> {
    const response = await apiClient.get<ApiResponse<{ items: LuckyWinner[]; total: number }>>(
      `/api/v1/admin/lucky-events/${eventId}/winners`,
    );
    return unwrap(response, 'Load winners failed').items;
  },

  /** Discard a winner: deletes the winner + its participant so the prize can be redrawn. */
  async discardWinner(eventId: string, winnerId: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(
      `/api/v1/admin/lucky-events/${eventId}/winners/${winnerId}`,
    );
  },
};

/** Public (anonymous) Lucky Draw endpoints — token in path. */
export const luckyEventsApi = {
  async getPublic(token: string): Promise<LuckyPublicEvent> {
    const response = await apiClient.get<ApiResponse<LuckyPublicEvent>>(
      `/api/v1/public/lucky-events/${token}`,
      { isPublic: true },
    );
    return unwrap(response, 'Load lucky event failed');
  },

  async register(token: string, answers: Record<string, unknown>): Promise<LuckyRegisterResult> {
    const response = await apiClient.post<ApiResponse<LuckyRegisterResult>>(
      `/api/v1/public/lucky-events/${token}/register`,
      { answers },
      { isPublic: true },
    );
    return unwrap(response, 'Register failed');
  },
};
