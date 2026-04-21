import { prisma } from "@/lib/prisma";
import {
  previousPeriod,
  resolveRange,
  type RangeKey,
} from "./ranges";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(v: bigint | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "bigint") return Number(v);
  return v;
}

function pctDelta(current: number, previous: number): number | null {
  if (!previous) {
    if (!current) return 0;
    return null; // infinite growth, show as "—"
  }
  return ((current - previous) / previous) * 100;
}

// ---------------------------------------------------------------------------
// Channel summary for a given range
// ---------------------------------------------------------------------------

export type PeriodAggregate = {
  views: number;
  watchTimeMinutes: number;
  likes: number;
  comments: number;
  shares: number;
  subscribersGained: number;
  subscribersLost: number;
  netSubscribers: number;
  estimatedRevenue: number;
  impressions: number;
  averageViewDuration: number | null; // avg across days, weighted by views
};

export async function aggregatePeriod(
  channelId: string,
  start: Date,
  end: Date
): Promise<PeriodAggregate> {
  const rows = await prisma.youTubeChannelSnapshot.findMany({
    where: {
      channelId,
      date: { gte: start, lte: end },
    },
    select: {
      views: true,
      watchTimeMinutes: true,
      likes: true,
      comments: true,
      shares: true,
      subscribersGained: true,
      subscribersLost: true,
      estimatedRevenue: true,
      impressions: true,
      averageViewDuration: true,
    },
  });

  const agg: PeriodAggregate = {
    views: 0,
    watchTimeMinutes: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    subscribersGained: 0,
    subscribersLost: 0,
    netSubscribers: 0,
    estimatedRevenue: 0,
    impressions: 0,
    averageViewDuration: null,
  };

  let avdViews = 0;
  let avdSum = 0;

  for (const r of rows) {
    const views = toNum(r.views);
    agg.views += views;
    agg.watchTimeMinutes += r.watchTimeMinutes ?? 0;
    agg.likes += toNum(r.likes);
    agg.comments += toNum(r.comments);
    agg.shares += toNum(r.shares);
    agg.subscribersGained += toNum(r.subscribersGained);
    agg.subscribersLost += toNum(r.subscribersLost);
    agg.estimatedRevenue += r.estimatedRevenue ?? 0;
    agg.impressions += toNum(r.impressions);
    if (r.averageViewDuration != null && views > 0) {
      avdSum += r.averageViewDuration * views;
      avdViews += views;
    }
  }

  agg.netSubscribers = agg.subscribersGained - agg.subscribersLost;
  agg.averageViewDuration = avdViews > 0 ? avdSum / avdViews : null;
  return agg;
}

// ---------------------------------------------------------------------------
// KPI card data — current + previous + delta
// ---------------------------------------------------------------------------

export type KpiData = {
  current: PeriodAggregate;
  previous: PeriodAggregate;
  deltas: {
    views: number | null;
    watchTimeMinutes: number | null;
    likes: number | null;
    comments: number | null;
    netSubscribers: number | null;
    estimatedRevenue: number | null;
    impressions: number | null;
    averageViewDuration: number | null;
  };
};

export async function getChannelKpis(
  channelId: string,
  range: RangeKey
): Promise<KpiData> {
  const cur = resolveRange(range);
  const prev = previousPeriod(range);
  const [current, previous] = await Promise.all([
    aggregatePeriod(channelId, cur.start, cur.end),
    aggregatePeriod(channelId, prev.start, prev.end),
  ]);

  return {
    current,
    previous,
    deltas: {
      views: pctDelta(current.views, previous.views),
      watchTimeMinutes: pctDelta(
        current.watchTimeMinutes,
        previous.watchTimeMinutes
      ),
      likes: pctDelta(current.likes, previous.likes),
      comments: pctDelta(current.comments, previous.comments),
      netSubscribers: pctDelta(
        current.netSubscribers,
        previous.netSubscribers
      ),
      estimatedRevenue: pctDelta(
        current.estimatedRevenue,
        previous.estimatedRevenue
      ),
      impressions: pctDelta(current.impressions, previous.impressions),
      averageViewDuration:
        current.averageViewDuration != null &&
        previous.averageViewDuration != null
          ? pctDelta(
              current.averageViewDuration,
              previous.averageViewDuration
            )
          : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Time-series data for charts
// ---------------------------------------------------------------------------

export type DailyPoint = {
  date: string; // ISO yyyy-MM-dd
  views: number;
  watchTimeMinutes: number;
  likes: number;
  comments: number;
  shares: number;
  subscribersGained: number;
  subscribersLost: number;
  netSubscribers: number;
  estimatedRevenue: number;
  impressions: number;
  subscribersTotal: number | null; // running cumulative if available
};

export async function getDailySeries(
  channelId: string,
  range: RangeKey
): Promise<DailyPoint[]> {
  const { start, end } = resolveRange(range);
  const rows = await prisma.youTubeChannelSnapshot.findMany({
    where: { channelId, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });

  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    views: toNum(r.views),
    watchTimeMinutes: r.watchTimeMinutes ?? 0,
    likes: toNum(r.likes),
    comments: toNum(r.comments),
    shares: toNum(r.shares),
    subscribersGained: toNum(r.subscribersGained),
    subscribersLost: toNum(r.subscribersLost),
    netSubscribers: toNum(r.subscribersGained) - toNum(r.subscribersLost),
    estimatedRevenue: r.estimatedRevenue ?? 0,
    impressions: toNum(r.impressions),
    subscribersTotal: r.subscribers != null ? Number(r.subscribers) : null,
  }));
}

// ---------------------------------------------------------------------------
// Breakdown data
// ---------------------------------------------------------------------------

export async function getAudienceBreakdown(channelId: string) {
  // Latest periodEnd
  const latest = await prisma.youTubeAudienceSnapshot.findFirst({
    where: { channelId },
    orderBy: { periodEnd: "desc" },
    select: { periodEnd: true },
  });
  if (!latest) return [];

  return prisma.youTubeAudienceSnapshot.findMany({
    where: { channelId, periodEnd: latest.periodEnd },
    orderBy: [{ ageGroup: "asc" }, { gender: "asc" }],
  });
}

export async function getGeographyBreakdown(channelId: string, limit = 10) {
  const latest = await prisma.youTubeGeographySnapshot.findFirst({
    where: { channelId },
    orderBy: { periodEnd: "desc" },
    select: { periodEnd: true },
  });
  if (!latest) return [];

  const rows = await prisma.youTubeGeographySnapshot.findMany({
    where: { channelId, periodEnd: latest.periodEnd },
    orderBy: { views: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    country: r.country,
    views: toNum(r.views),
    watchTimeMinutes: r.watchTimeMinutes ?? 0,
  }));
}

export async function getTrafficSourceBreakdown(channelId: string) {
  const latest = await prisma.youTubeTrafficSourceSnapshot.findFirst({
    where: { channelId },
    orderBy: { periodEnd: "desc" },
    select: { periodEnd: true },
  });
  if (!latest) return [];

  const rows = await prisma.youTubeTrafficSourceSnapshot.findMany({
    where: { channelId, periodEnd: latest.periodEnd },
    orderBy: { views: "desc" },
  });
  return rows.map((r) => ({
    source: r.insightTrafficSourceType,
    views: toNum(r.views),
    watchTimeMinutes: r.watchTimeMinutes ?? 0,
  }));
}

export async function getDeviceBreakdown(channelId: string) {
  const latest = await prisma.youTubeDeviceSnapshot.findFirst({
    where: { channelId },
    orderBy: { periodEnd: "desc" },
    select: { periodEnd: true },
  });
  if (!latest) return [];

  const rows = await prisma.youTubeDeviceSnapshot.findMany({
    where: { channelId, periodEnd: latest.periodEnd },
    orderBy: { views: "desc" },
  });
  return rows.map((r) => ({
    device: r.deviceType,
    views: toNum(r.views),
    watchTimeMinutes: r.watchTimeMinutes ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Top videos in range
// ---------------------------------------------------------------------------

export type TopVideo = {
  id: string;
  videoId: string;
  title: string;
  publishedAt: Date;
  thumbnailUrl: string | null;
  isShort: boolean;
  viewCount: number;
  likeCount: number;
  commentCount: number;
};

export async function getTopVideosByRange(
  channelId: string,
  range: RangeKey,
  sortBy: "views" | "likes" | "comments" | "published" = "views",
  limit = 20
): Promise<TopVideo[]> {
  const { start, end } = resolveRange(range);

  if (sortBy === "published") {
    // Just list by publishedAt desc
    const rows = await prisma.youTubeVideo.findMany({
      where: { channelId, publishedAt: { gte: start, lte: end } },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      videoId: r.videoId,
      title: r.title,
      publishedAt: r.publishedAt,
      thumbnailUrl: r.thumbnailUrl,
      isShort: r.isShort,
      viewCount: toNum(r.viewCount),
      likeCount: toNum(r.likeCount),
      commentCount: toNum(r.commentCount),
    }));
  }

  // Aggregate per-video metrics over the window
  const grouped = await prisma.youTubeVideoMetric.groupBy({
    by: ["videoId"],
    where: { channelId, date: { gte: start, lte: end } },
    _sum: { views: true, likes: true, comments: true },
  });

  if (grouped.length === 0) {
    // No per-video daily metrics yet — fall back to lifetime stats
    const rows = await prisma.youTubeVideo.findMany({
      where: { channelId },
      orderBy:
        sortBy === "likes"
          ? { likeCount: "desc" }
          : sortBy === "comments"
            ? { commentCount: "desc" }
            : { viewCount: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      videoId: r.videoId,
      title: r.title,
      publishedAt: r.publishedAt,
      thumbnailUrl: r.thumbnailUrl,
      isShort: r.isShort,
      viewCount: toNum(r.viewCount),
      likeCount: toNum(r.likeCount),
      commentCount: toNum(r.commentCount),
    }));
  }

  const sortKey =
    sortBy === "likes" ? "likes" : sortBy === "comments" ? "comments" : "views";
  const sorted = grouped
    .map((g) => ({
      videoId: g.videoId,
      views: toNum(g._sum.views),
      likes: toNum(g._sum.likes),
      comments: toNum(g._sum.comments),
    }))
    .sort((a, b) => b[sortKey] - a[sortKey])
    .slice(0, limit);

  const videoIds = sorted.map((s) => s.videoId);
  const videos = await prisma.youTubeVideo.findMany({
    where: { id: { in: videoIds } },
  });
  const map = new Map(videos.map((v) => [v.id, v]));

  return sorted
    .map((s) => {
      const v = map.get(s.videoId);
      if (!v) return null;
      return {
        id: v.id,
        videoId: v.videoId,
        title: v.title,
        publishedAt: v.publishedAt,
        thumbnailUrl: v.thumbnailUrl,
        isShort: v.isShort,
        viewCount: s.views,
        likeCount: s.likes,
        commentCount: s.comments,
      };
    })
    .filter((x): x is TopVideo => x !== null);
}

// ---------------------------------------------------------------------------
// Cross-channel comparison (multi-channel dashboard)
// ---------------------------------------------------------------------------

export type CompareSeriesPoint = {
  date: string;
  [channelId: string]: number | string;
};

export async function getCompareSeries(
  channelIds: string[],
  range: RangeKey,
  metric: "views" | "watchTimeMinutes" | "subscribersGained" | "estimatedRevenue"
): Promise<CompareSeriesPoint[]> {
  const { start, end } = resolveRange(range);
  const rows = await prisma.youTubeChannelSnapshot.findMany({
    where: { channelId: { in: channelIds }, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });

  const byDate = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, { date: key });
    const bucket = byDate.get(key)!;
    let v: number;
    if (metric === "views") v = toNum(r.views);
    else if (metric === "watchTimeMinutes") v = r.watchTimeMinutes ?? 0;
    else if (metric === "estimatedRevenue") v = r.estimatedRevenue ?? 0;
    else v = toNum(r.subscribersGained);
    bucket[r.channelId] = ((bucket[r.channelId] as number) ?? 0) + v;
  }
  return Array.from(byDate.values()).sort((a, b) =>
    (a.date as string).localeCompare(b.date as string)
  ) as CompareSeriesPoint[];
}

// ---------------------------------------------------------------------------
// "Latest snapshot" helper — lifetime counts
// ---------------------------------------------------------------------------

export async function getLatestSnapshot(channelId: string) {
  return prisma.youTubeChannelSnapshot.findFirst({
    where: { channelId },
    orderBy: { date: "desc" },
  });
}
