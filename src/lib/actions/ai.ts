"use server";

import { auth } from "@/lib/auth";
import { analyzeChannel } from "@/lib/ai/analyze";
import type { RangeKey } from "@/lib/analytics/ranges";
import type { ActionResult } from "./clients";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export async function generateChannelInsightsAction(
  channelId: string,
  range: RangeKey
): Promise<
  ActionResult<{
    markdown: string;
    projection: {
      viewsNextPeriod: number;
      subscribersNextPeriod: number;
      revenueNextPeriod: number;
      confidenceTrend: number | null;
    };
    usage: { input: number; output: number };
  }>
> {
  await requireAdmin();
  try {
    const result = await analyzeChannel(channelId, range);
    return { ok: true, data: result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI analysis failed";
    return { ok: false, error: msg };
  }
}
