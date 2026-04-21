import {
  subDays,
  subMonths,
  startOfDay,
  endOfDay,
  differenceInCalendarDays,
} from "date-fns";

export type RangeKey = "7d" | "28d" | "90d" | "180d" | "365d" | "all";

export const RANGE_LABEL: Record<RangeKey, string> = {
  "7d": "Last 7 days",
  "28d": "Last 28 days",
  "90d": "Last 90 days",
  "180d": "Last 6 months",
  "365d": "Last 12 months",
  all: "All time",
};

export const RANGE_ORDER: RangeKey[] = [
  "7d",
  "28d",
  "90d",
  "180d",
  "365d",
  "all",
];

/**
 * Resolve a range key into a concrete [start, end] window.
 * end is "now" (end of today UTC); start is floored to start-of-day.
 * For "all" we use a very old date so the caller can just filter >= start.
 */
export function resolveRange(range: RangeKey, now: Date = new Date()) {
  const end = endOfDay(now);
  let days: number;
  switch (range) {
    case "7d":
      days = 7;
      break;
    case "28d":
      days = 28;
      break;
    case "90d":
      days = 90;
      break;
    case "180d":
      days = 180;
      break;
    case "365d":
      days = 365;
      break;
    case "all":
      return {
        start: new Date("2005-01-01"),
        end,
        days: differenceInCalendarDays(end, new Date("2005-01-01")),
      };
  }
  const start = startOfDay(subDays(now, days - 1));
  return { start, end, days };
}

/**
 * Returns the previous-period window of the same length, ending right
 * before the current window starts. Used for period-over-period deltas.
 */
export function previousPeriod(range: RangeKey, now: Date = new Date()) {
  const { start, days } = resolveRange(range, now);
  const prevEnd = endOfDay(subDays(start, 1));
  const prevStart = startOfDay(subDays(start, days));
  return { start: prevStart, end: prevEnd, days };
}

/**
 * Month window (1st → last day). Used by monthly reports.
 */
export function monthRange(year: number, month: number) {
  // month is 1-12
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

/**
 * Returns the previous-N-month window ending at `endOfMonth`.
 */
export function trailingMonths(endOfMonth: Date, months: number) {
  const start = startOfDay(subMonths(endOfMonth, months - 1));
  return { start, end: endOfMonth };
}

export function isRangeKey(s: string | null | undefined): s is RangeKey {
  return !!s && RANGE_ORDER.includes(s as RangeKey);
}
