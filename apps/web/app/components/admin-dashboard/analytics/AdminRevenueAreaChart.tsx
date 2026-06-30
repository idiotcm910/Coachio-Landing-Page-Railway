import type { RevenueDailyPoint } from '@coachio/api-client';

interface RevenueAreaPath {
  linePath: string;
  areaPath: string;
}

interface AdminRevenueAreaChartProps {
  points: RevenueDailyPoint[];
}

function formatCompactVnd(value: number): string {
  if (value >= 1000000) return `${Math.round(value / 1000000)}tr`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
}

export function buildRevenueAreaPath(points: RevenueDailyPoint[], width: number, height: number): RevenueAreaPath {
  if (points.length === 0) return { linePath: '', areaPath: '' };
  const maxRevenue = Math.max(...points.map((point) => point.revenue), 1);
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : index * step;
    const y = height - (point.revenue / maxRevenue) * height;
    return `${Math.round(x)} ${Math.round(y)}`;
  });
  const linePath = `M ${coordinates.join(' L ')}`;
  const [firstX] = coordinates[0].split(' ');
  const [lastX] = coordinates[coordinates.length - 1].split(' ');
  const areaPath = `${linePath} L ${lastX} ${height} L ${firstX} ${height} Z`;
  return { linePath, areaPath };
}

export function AdminRevenueAreaChart({ points }: AdminRevenueAreaChartProps) {
  const width = 720;
  const height = 260;
  const { linePath, areaPath } = buildRevenueAreaPath(points, width, height);
  const maxRevenue = Math.max(...points.map((point) => point.revenue), 0);
  const lastPoint = points[points.length - 1];

  return (
    <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-5 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--coachio-admin-dashboard-text)]">Daily revenue</h2>
          <p className="text-sm font-medium text-[var(--coachio-admin-dashboard-text-muted)]">
            {points.length} data points, peak {formatCompactVnd(maxRevenue)}
          </p>
        </div>
        {lastPoint ? (
          <div className="rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-3 py-2 text-right">
            <span className="block text-xs font-semibold uppercase text-[var(--coachio-admin-dashboard-accent)]">Last day</span>
            <strong className="text-sm text-[var(--coachio-admin-dashboard-text)]">{formatCompactVnd(lastPoint.revenue)}</strong>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-md)] bg-[var(--coachio-admin-dashboard-surface-muted)] p-4">
        {points.length > 0 ? (
          <svg viewBox={`0 0 ${width} ${height + 36}`} role="img" aria-label="Revenue area chart" className="h-72 w-full">
            <defs>
              <linearGradient id="revenue-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#f67d1c" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.04" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((line) => (
              <line
                key={line}
                x1="0"
                x2={width}
                y1={(height / 3) * line}
                y2={(height / 3) * line}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
            ))}
            <path d={areaPath} fill="url(#revenue-area)" />
            <path d={linePath} fill="none" stroke="#f67d1c" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
            {points.map((point, index) => {
              if (index !== 0 && index !== points.length - 1 && index % Math.max(Math.floor(points.length / 4), 1) !== 0) return null;
              const x = points.length === 1 ? width / 2 : (width / (points.length - 1)) * index;
              return (
                <text key={point.date} x={x} y={height + 28} textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">
                  {point.date.slice(5)}
                </text>
              );
            })}
          </svg>
        ) : (
          <div className="grid h-72 place-items-center text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
            No revenue data in this date range.
          </div>
        )}
      </div>
    </div>
  );
}
