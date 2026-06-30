import { AlertTriangle, RefreshCw } from 'lucide-react';

interface AdminAnalyticsErrorProps {
  message: string;
  onRetry?: () => void;
}

export function AdminAnalyticsError({ message, onRetry }: AdminAnalyticsErrorProps) {
  return (
    <div className="rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-danger-border)] bg-[var(--coachio-admin-dashboard-danger-bg)] p-5 text-[var(--coachio-admin-dashboard-danger-text)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold">Failed to load analytics data</h3>
            <p className="mt-1 text-sm font-medium">{message}</p>
          </div>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-danger-border)] bg-white px-3 py-2 text-sm font-semibold"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
