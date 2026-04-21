"use server";

import { auth } from "@/lib/auth";
import {
  aggregatePeriod,
  getCompareSeries,
  type CompareSeriesPoint,
} from "@/lib/analytics/queries";
import { resolveRange, type RangeKey } from "@/lib/analytics/ranges";
import type { ActionResult } from "./clients";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export type CompareMetric =
  | "views"
  | "watchTimeMinutes"
  | "subscribersGained"
  | "estimatedRevenue";

export async function getCompareDataAction(
  channelIds: string[],
  range: RangeKey,
  metric: CompareMetric
): Promise<
  ActionResult<{
    series: CompareSeriesPoint[];
    totals: Record<string, number>;
  }>
> {
  await requireAdmin();

  if (channelIds.length === 0) {
    return { ok: true, data: { series: [], totals: {} } };
  }

  const { start, end } = resolveRange(range);
  const [series, ...aggregates] = await Promise.all([
    getCompareSeries(channelIds, range, metric),
    ...channelIds.map((id) => aggregatePeriod(id, start, end)),
  ]);

  const totals: Record<string, number> = {};
  channelIds.forEach((id, i) => {
    const a = aggregates[i];
    switch (metric) {
      case "views":
        totals[id] = a.views;
        break;
      case "watchTimeMinutes":
        totals[id] = Math.round(a.watchTimeMinutes);
        break;
      case "subscribersGained":
        totals[id] = a.subscribersGained;
        break;
      case "estimatedRevenue":
        totals[id] = Number(a.estimatedRevenue.toFixed(2));
        break;
    }
  });

  return { ok: true, data: { series, totals } };
}
