interface AdminAnalyticsSkeletonProps {
  rows?: number;
}

export function AdminAnalyticsSkeleton({ rows = 4 }: AdminAnalyticsSkeletonProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)]"
          />
        ))}
      </div>
      <div className="rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-4">
        <div className="mb-4 h-5 w-48 animate-pulse rounded bg-[var(--coachio-admin-dashboard-surface-hover)]" />
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded bg-[var(--coachio-admin-dashboard-surface-hover)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
