import { prisma } from "@/lib/prisma";
import {
  getAudienceBreakdown,
  getDeviceBreakdown,
  getGeographyBreakdown,
  getTrafficSourceBreakdown,
  getTopVideosByRange,
  aggregatePeriod,
} from "@/lib/analytics/queries";
import { monthRange, trailingMonths } from "@/lib/analytics/ranges";
import { projectNextPeriod } from "@/lib/ai/analyze";
import { chatOnce } from "@/lib/ai/anthropic";

export type ChannelReportData = {
  channel: {
    id: string;
    displayName: string;
    handle: string | null;
    url: string | null;
    externalId: string | null;
    avatarUrl: string | null;
  };
  monthsCovered: { label: string; start: string; end: string }[]; // 6 rows
  monthly: Array<{
    label: string;
    views: number;
    watchTimeMinutes: number;
    netSubscribers: number;
    likes: number;
    comments: number;
    estimatedRevenue: number;
  }>;
  sixMonthTotals: {
    views: number;
    watchTimeMinutes: number;
    netSubscribers: number;
    likes: number;
    comments: number;
    estimatedRevenue: number;
  };
  predictionNextMonth: {
    views: number;
    netSubscribers: number;
    revenue: number;
    trendPct: number | null;
  };
  latestSnapshot: {
    subscribers: number | null;
    viewCount: number | null;
    videoCount: number | null;
  };
  topCountries: { country: string; views: number }[];
  topVideos: { title: string; views: number; likes: number; publishedAt: string }[];
  audience: { ageGroup: string; gender: string; pct: number }[];
  traffic: { source: string; views: number }[];
  devices: { device: string; views: number }[];
  /** Markdown narrative produced by Claude, or null if AI is not configured. */
  narrative: string | null;
};

export async function buildChannelReportData(
  channelId: string,
  reportMonth: Date
): Promise<ChannelReportData | null> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });
  if (!channel || channel.platform !== "YOUTUBE") return null;

  // Report covers the 6 months preceding and including the report's reference
  // month — e.g. if reportMonth is Dec 2025, covers Jul–Dec 2025.
  const monthsCovered: { label: string; start: string; end: string; startDate: Date; endDate: Date }[] = [];
  for (let offset = 5; offset >= 0; offset--) {
    const d = new Date(
      Date.UTC(reportMonth.getUTCFullYear(), reportMonth.getUTCMonth() - offset, 1)
    );
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const r = monthRange(y, m);
    monthsCovered.push({
      label: d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      start: r.start.toISOString().slice(0, 10),
      end: r.end.toISOString().slice(0, 10),
      startDate: r.start,
      endDate: r.end,
    });
  }

  const monthly = await Promise.all(
    monthsCovered.map(async (m) => {
      const a = await aggregatePeriod(channelId, m.startDate, m.endDate);
      return {
        label: m.label,
        views: a.views,
        watchTimeMinutes: Math.round(a.watchTimeMinutes),
        netSubscribers: a.netSubscribers,
        likes: a.likes,
        comments: a.comments,
        estimatedRevenue: Number(a.estimatedRevenue.toFixed(2)),
      };
    })
  );

  const sixMonthTotals = monthly.reduce(
    (acc, m) => ({
      views: acc.views + m.views,
      watchTimeMinutes: acc.watchTimeMinutes + m.watchTimeMinutes,
      netSubscribers: acc.netSubscribers + m.netSubscribers,
      likes: acc.likes + m.likes,
      comments: acc.comments + m.comments,
      estimatedRevenue: acc.estimatedRevenue + m.estimatedRevenue,
    }),
    {
      views: 0,
      watchTimeMinutes: 0,
      netSubscribers: 0,
      likes: 0,
      comments: 0,
      estimatedRevenue: 0,
    }
  );

  // Project next month using monthly series
  const viewProj = projectNextPeriod(
    monthly.map((m) => ({ date: m.label, value: m.views }))
  );
  const subProj = projectNextPeriod(
    monthly.map((m) => ({ date: m.label, value: m.netSubscribers }))
  );
  const revProj = projectNextPeriod(
    monthly.map((m) => ({ date: m.label, value: m.estimatedRevenue }))
  );

  // Latest snapshot (lifetime stats)
  const latest = await prisma.youTubeChannelSnapshot.findFirst({
    where: { channelId, date: { lte: monthsCovered[5].endDate } },
    orderBy: { date: "desc" },
  });

  // Breakdowns — use 6-month window
  const sixMonthWindow = trailingMonths(monthsCovered[5].endDate, 6);
  const [geography, traffic, devices, topVideos, audience] = await Promise.all(
    [
      getGeographyBreakdown(channelId, 5),
      getTrafficSourceBreakdown(channelId),
      getDeviceBreakdown(channelId),
      getTopVideosByRange(channelId, "180d", "views", 5),
      getAudienceBreakdown(channelId),
    ]
  );
  // Silence unused-warning on window computed just for intent
  void sixMonthWindow;

  // AI narrative — optional
  let narrative: string | null = null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const system = `You are writing the executive summary for a monthly YouTube
performance report. Be concise, direct, and data-grounded.
Output plain Markdown with these sections (no emojis, no tables, no code blocks):
## Executive summary
## 6-month trend highlights
## Next month outlook

Base every claim on the JSON. Mention specific months and numbers.
Target ~300 words total.`;
      const user = `Report data JSON:\n\`\`\`json\n${JSON.stringify({
        channel: { name: channel.displayName, handle: channel.handle },
        monthly,
        sixMonthTotals,
        projections: {
          viewsNextMonth: viewProj.total,
          netSubsNextMonth: subProj.total,
          revenueNextMonth: revProj.total,
          trendPct: viewProj.trendPct,
        },
        topVideos: topVideos.map((v) => ({
          title: v.title,
          views: v.viewCount,
          likes: v.likeCount,
        })),
      })}\n\`\`\``;
      const res = await chatOnce({ system, user, maxTokens: 900, cacheSystem: true });
      narrative = res.text;
    } catch {
      narrative = null;
    }
  }

  return {
    channel: {
      id: channel.id,
      displayName: channel.displayName,
      handle: channel.handle,
      url: channel.url,
      externalId: channel.externalId,
      avatarUrl: channel.avatarUrl,
    },
    monthsCovered: monthsCovered.map((m) => ({
      label: m.label,
      start: m.start,
      end: m.end,
    })),
    monthly,
    sixMonthTotals,
    predictionNextMonth: {
      views: viewProj.total,
      netSubscribers: subProj.total,
      revenue: Number(revProj.total.toFixed(2)),
      trendPct: viewProj.trendPct,
    },
    latestSnapshot: {
      subscribers: latest?.subscribers ? Number(latest.subscribers) : null,
      viewCount: latest?.viewCount ? Number(latest.viewCount) : null,
      videoCount: latest?.videoCount ?? null,
    },
    topCountries: geography.map((g) => ({
      country: g.country,
      views: g.views,
    })),
    topVideos: topVideos.map((v) => ({
      title: v.title,
      views: v.viewCount,
      likes: v.likeCount,
      publishedAt: v.publishedAt.toISOString().slice(0, 10),
    })),
    audience: audience.map((a) => ({
      ageGroup: a.ageGroup.replace(/^age/, ""),
      gender: a.gender,
      pct: Number(a.viewerPercentage.toFixed(1)),
    })),
    traffic: traffic.map((t) => ({ source: t.source, views: t.views })),
    devices: devices.map((d) => ({ device: d.device, views: d.views })),
    narrative,
  };
}
