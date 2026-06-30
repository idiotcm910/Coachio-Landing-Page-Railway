'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage } from '@coachio/api-client';
import type {
  AudienceConfig,
  AudiencePreview,
  BroadcastCampaign,
  BroadcastCampaignCreateInput,
  BroadcastCampaignUpdateInput,
  CampaignStats,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';

export interface BroadcastApiAdapter {
  list(): Promise<BroadcastCampaign[]>;
  create(input: BroadcastCampaignCreateInput): Promise<BroadcastCampaign>;
  update(id: string, input: BroadcastCampaignUpdateInput): Promise<BroadcastCampaign>;
  remove(id: string): Promise<void>;
  send(id: string, scheduledAt?: string | null): Promise<BroadcastCampaign>;
  cancel(id: string): Promise<BroadcastCampaign>;
  test(id: string, email: string): Promise<void>;
  retryFailed(id: string): Promise<BroadcastCampaign>;
  stats(id: string): Promise<CampaignStats>;
  audiencePreview(idOrConfig: string | AudienceConfig): Promise<AudiencePreview>;
}

export function useBroadcastCampaigns(adapter: BroadcastApiAdapter) {
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adapter.list();
      setCampaigns(data);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load campaigns'));
    } finally {
      setLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createCampaign = useCallback(
    async (input: BroadcastCampaignCreateInput): Promise<BroadcastCampaign> => {
      try {
        const created = await adapter.create(input);
        setCampaigns((prev) => [created, ...prev]);
        success('Campaign created successfully');
        return created;
      } catch (e) {
        toastError(getApiErrorMessage(e, 'Failed to create campaign'));
        throw e;
      }
    },
    [adapter, success, toastError],
  );

  const updateCampaign = useCallback(
    async (id: string, input: BroadcastCampaignUpdateInput): Promise<BroadcastCampaign> => {
      try {
        const updated = await adapter.update(id, input);
        setCampaigns((prev) => prev.map((c) => (c.id === id ? updated : c)));
        success('Campaign updated');
        return updated;
      } catch (e) {
        toastError(getApiErrorMessage(e, 'Failed to update campaign'));
        throw e;
      }
    },
    [adapter, success, toastError],
  );

  const removeCampaign = useCallback(
    async (id: string): Promise<void> => {
      try {
        await adapter.remove(id);
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
        success('Campaign deleted');
      } catch (e) {
        toastError(getApiErrorMessage(e, 'Failed to delete campaign'));
        throw e;
      }
    },
    [adapter, success, toastError],
  );

  const sendCampaign = useCallback(
    async (id: string, scheduledAt?: string | null): Promise<BroadcastCampaign> => {
      try {
        const updated = await adapter.send(id, scheduledAt);
        setCampaigns((prev) => prev.map((c) => (c.id === id ? updated : c)));
        success(scheduledAt ? 'Campaign scheduled' : 'Campaign send started');
        return updated;
      } catch (e) {
        toastError(getApiErrorMessage(e, 'Failed to send campaign'));
        throw e;
      }
    },
    [adapter, success, toastError],
  );

  const cancelCampaign = useCallback(
    async (id: string): Promise<BroadcastCampaign> => {
      try {
        const updated = await adapter.cancel(id);
        setCampaigns((prev) => prev.map((c) => (c.id === id ? updated : c)));
        success('Campaign cancelled');
        return updated;
      } catch (e) {
        toastError(getApiErrorMessage(e, 'Failed to cancel campaign'));
        throw e;
      }
    },
    [adapter, success, toastError],
  );

  const testCampaign = useCallback(
    async (id: string, email: string): Promise<void> => {
      try {
        await adapter.test(id, email);
        success(`Test email sent to ${email}`);
      } catch (e) {
        toastError(getApiErrorMessage(e, 'Failed to send test email'));
        throw e;
      }
    },
    [adapter, success, toastError],
  );

  const retryFailed = useCallback(
    async (id: string): Promise<BroadcastCampaign> => {
      try {
        const updated = await adapter.retryFailed(id);
        setCampaigns((prev) => prev.map((c) => (c.id === id ? updated : c)));
        success('Retrying failed emails');
        return updated;
      } catch (e) {
        toastError(getApiErrorMessage(e, 'Failed to resend failed emails'));
        throw e;
      }
    },
    [adapter, success, toastError],
  );

  return {
    campaigns,
    loading,
    error,
    reload,
    createCampaign,
    updateCampaign,
    removeCampaign,
    sendCampaign,
    cancelCampaign,
    testCampaign,
    retryFailed,
  };
}
