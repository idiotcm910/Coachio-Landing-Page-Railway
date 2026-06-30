export interface AnalyticsDateRange {
  startDate?: string;
  endDate?: string;
}

export interface QuickAnalyticsRange {
  id: '7d' | '14d' | '30d' | 'month';
  label: string;
  range: Required<AnalyticsDateRange>;
}

const MAX_ANALYTICS_DAYS = 31;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateInput(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getDefaultAnalyticsDateRange(now = new Date()): Required<AnalyticsDateRange> {
  return {
    startDate: toDateInputValue(addDays(now, -30)),
    endDate: toDateInputValue(now),
  };
}

export function clampAnalyticsDateRange(range: AnalyticsDateRange): Required<AnalyticsDateRange> {
  const fallback = getDefaultAnalyticsDateRange();
  const endDate = range.endDate || fallback.endDate;
  const startDate = range.startDate || fallback.startDate;
  const end = parseDateInput(endDate);
  const start = parseDateInput(startDate);
  const maxStart = addDays(end, -(MAX_ANALYTICS_DAYS - 1));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return fallback;
  if (start > end) return { startDate: endDate, endDate };
  if (start < maxStart) return { startDate: toDateInputValue(maxStart), endDate };
  return { startDate, endDate };
}

export function buildAnalyticsQueryRange(range: AnalyticsDateRange): AnalyticsDateRange {
  return {
    ...(range.startDate ? { startDate: range.startDate } : {}),
    ...(range.endDate ? { endDate: range.endDate } : {}),
  };
}

export function getQuickAnalyticsRanges(now = new Date()): QuickAnalyticsRange[] {
  const endDate = toDateInputValue(now);
  return [
    { id: '7d', label: '7 days', range: { startDate: toDateInputValue(addDays(now, -6)), endDate } },
    { id: '14d', label: '14 days', range: { startDate: toDateInputValue(addDays(now, -13)), endDate } },
    { id: '30d', label: '30 days', range: { startDate: toDateInputValue(addDays(now, -30)), endDate } },
    {
      id: 'month',
      label: 'This month',
      range: { startDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)), endDate },
    },
  ];
}
