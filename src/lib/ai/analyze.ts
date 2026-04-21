import { prisma } from "@/lib/prisma";
import {
  getAudienceBreakdown,
  getChannelKpis,
  getDailySeries,
  getDeviceBreakdown,
  getGeographyBreakdown,
  getTopVideosByRange,
  getTrafficSourceBreakdown,
} from "@/lib/analytics/queries";
import { resolveRange, type RangeKey } from "@/lib/analytics/ranges";
import { chatOnce } from "./anthropic";

// Linear regression on a time-series; returns slope (units/day) + intercept.
// Used both to project next-period views and as a stable trend input for Claude.
function linreg(data: { date: string; value: number }[]) {
  if (data.length < 2) return { slope: 0, intercept: data[0]?.value ?? 0 };
  const xs = data.map((_, i) => i);
  const ys = data.map((d) => d.value);
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * Mathematically-grounded forecast the AI can reason on top of.
 * Projects totals for the next period of the same length using a simple
 * linear fit. This gives Claude a sane baseline; its job is to interpret
 * and flag risks, not invent numbers.
 */
export function projectNextPeriod(daily: { date: string; value: number }[]) {
  const { slope, intercept } = linreg(daily);
  const n = daily.length;
  let total = 0;
  for (let i = n; i < n * 2; i++) {
    total += Math.max(0, slope * i + intercept);
  }
  // Also return overall trend
  const firstHalf = daily.slice(0, Math.floor(n / 2)).reduce((a, b) => a + b.value, 0);
  const secondHalf = daily
    .slice(Math.floor(n / 2))
    .reduce((a, b) => a + b.value, 0);
  const trendPct =
    firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : null;
  return { total: Math.round(total), slopePerDay: slope, trendPct };
}

/**
 * Builds a compact JSON summary of the channel's performance over the
 * chosen range and asks Claude for insights + a next-period forecast.
 */
export async function analyzeChannel(
  channelId: string,
  range: RangeKey
): Promise<{
  markdown: string;
  projection: {
    viewsNextPeriod: number;
    subscribersNextPeriod: number;
    revenueNextPeriod: number;
    confidenceTrend: number | null; // recent trend %
  };
  usage: { input: number; output: number };
}> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { client: true },
  });
  if (!channel) throw new Error("Channel not found");

  const [kpis, daily, audience, geography, traffic, devices, topVideos] =
    await Promise.all([
      getChannelKpis(channelId, range),
      getDailySeries(channelId, range),
      getAudienceBreakdown(channelId),
      getGeographyBreakdown(channelId, 5),
      getTrafficSourceBreakdown(channelId),
      getDeviceBreakdown(channelId),
      getTopVideosByRange(channelId, range, "views", 10),
    ]);

  const { start, end, days } = resolveRange(range);

  // Local projections — Claude can comment, not invent.
  const viewProj = projectNextPeriod(
    daily.map((d) => ({ date: d.date, value: d.views }))
  );
  const subProj = projectNextPeriod(
    daily.map((d) => ({
      date: d.date,
      value: d.subscribersGained - d.subscribersLost,
    }))
  );
  const revProj = projectNextPeriod(
    daily.map((d) => ({ date: d.date, value: d.estimatedRevenue }))
  );

  // Build a compact JSON payload — one of the big tricks for Claude is
  // a tight schema rather than raw markdown.
  const payload = {
    channel: {
      name: channel.displayName,
      client: channel.client.name,
      handle: channel.handle,
      url: channel.url,
    },
    windowDays: days,
    windowStart: start.toISOString().slice(0, 10),
    windowEnd: end.toISOString().slice(0, 10),
    current: round(kpis.current),
    previous: round(kpis.previous),
    deltasPct: kpis.deltas,
    projections: {
      viewsNextPeriod: viewProj.total,
      viewsTrendPct: viewProj.trendPct,
      netSubsNextPeriod: subProj.total,
      netSubsTrendPct: subProj.trendPct,
      revenueNextPeriod: Number(revProj.total.toFixed(2)),
      revenueTrendPct: revProj.trendPct,
    },
    daily: daily.map((d) => ({
      date: d.date,
      views: d.views,
      watchMin: Math.round(d.watchTimeMinutes),
      netSubs: d.subscribersGained - d.subscribersLost,
      rev: Number(d.estimatedRevenue.toFixed(2)),
    })),
    audienceTop: audience
      .sort((a, b) => b.viewerPercentage - a.viewerPercentage)
      .slice(0, 8)
      .map((a) => ({
        age: a.ageGroup.replace(/^age/, ""),
        gender: a.gender,
        pct: Number(a.viewerPercentage.toFixed(1)),
      })),
    topCountries: geography.map((g) => ({
      country: g.country,
      views: g.views,
    })),
    trafficSources: traffic.map((t) => ({
      source: t.source,
      views: t.views,
    })),
    devices: devices.map((d) => ({ device: d.device, views: d.views })),
    topVideos: topVideos.map((v) => ({
      title: v.title,
      views: v.viewCount,
      likes: v.likeCount,
      comments: v.commentCount,
      isShort: v.isShort,
      published: v.publishedAt.toISOString().slice(0, 10),
    })),
  };

  const system = `You are an expert YouTube analytics consultant writing a concise, actionable
briefing for a creator and their manager. Base EVERY claim on the provided JSON.
Do not invent numbers. If data is missing say so.

Output strict Markdown with these sections and no other preamble:

## Summary
A 2–3 sentence plain-English verdict on the period.

## What's working
3–5 bullets. Cite specific metrics or videos.

## What's slipping
2–4 bullets. Be direct. Cite specific metrics.

## Recommendations
4–6 bullets of concrete next steps prioritized by impact. Reference the
audience, traffic sources, or top videos where relevant.

## Next period forecast
A short paragraph interpreting the linear projections already computed
(projections.viewsNextPeriod, netSubsNextPeriod, revenueNextPeriod).
Explicitly state the trend direction, magnitude, and key risks that
could invalidate the projection.

Rules:
- Use plain numbers (e.g. "12.4K views" or "$83.20"), not raw integers.
- No emojis. No code fences. No tables.
- Keep total length under 500 words.`;

  const user = `Channel analytics JSON:\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``;

  const { text, usage } = await chatOnce({
    system,
    user,
    maxTokens: 1200,
    cacheSystem: true,
  });

  return {
    markdown: text,
    projection: {
      viewsNextPeriod: viewProj.total,
      subscribersNextPeriod: subProj.total,
      revenueNextPeriod: Number(revProj.total.toFixed(2)),
      confidenceTrend: viewProj.trendPct,
    },
    usage,
  };
}

function round<T extends Record<string, number | null>>(obj: T): T {
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) out[k] = null;
    else if (typeof v === "number") out[k] = Math.round(v * 100) / 100;
    else out[k] = v;
  }
  return out as T;
}
