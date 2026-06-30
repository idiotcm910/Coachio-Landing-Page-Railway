import { describe, expect, it } from 'vitest';
import {
  buildAnalyticsQueryRange,
  clampAnalyticsDateRange,
  getDefaultAnalyticsDateRange,
  getQuickAnalyticsRanges,
} from './dateRange';

describe('analytics date ranges', () => {
  it('defaults to the latest month ending today', () => {
    expect(getDefaultAnalyticsDateRange(new Date(2026, 4, 16))).toEqual({
      startDate: '2026-04-16',
      endDate: '2026-05-16',
    });
  });

  it('clamps selected ranges to a maximum of one month', () => {
    expect(clampAnalyticsDateRange({ startDate: '2026-01-01', endDate: '2026-05-16' })).toEqual({
      startDate: '2026-04-16',
      endDate: '2026-05-16',
    });
  });

  it('builds backend query params only from present dates', () => {
    expect(buildAnalyticsQueryRange({ startDate: '2026-04-16' })).toEqual({ startDate: '2026-04-16' });
  });

  it('provides quick range actions for common admin filters', () => {
    const ranges = getQuickAnalyticsRanges(new Date(2026, 4, 16));

    expect(ranges.map((range) => range.id)).toEqual(['7d', '14d', '30d', 'month']);
    expect(ranges[0].range).toEqual({ startDate: '2026-05-10', endDate: '2026-05-16' });
    expect(ranges[3].range).toEqual({ startDate: '2026-05-01', endDate: '2026-05-16' });
  });
});
