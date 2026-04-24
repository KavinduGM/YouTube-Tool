/**
 * YouTube channel sync orchestration.
 *
 * Strategy:
 *   1. Refresh channel metadata + cumulative stats (Data API).
 *   2. Upsert video metadata for the uploads playlist.
 *   3. Pull daily per-channel analytics since last-synced day (or 12 months for first sync).
 *   4. Pull daily per-video analytics for the same window.
 *   5. Roll up 28-day aggregates for audience / geography / traffic / device.
 *
 * Every step records rows written and continues on partial failure — e.g. a
 * non-monetized channel gets empty revenue columns without aborting the sync.
 */

import { Prisma, SyncStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "./oauth";
import {
  getChannelById,
  getDailyChannelMetrics,
  getDailyVideoMetrics,
  getAgeGenderBreakdown,
  getGeographyBreakdown,
  getTrafficSourceBreakdown,
  getDeviceBreakdown,
  getMyChannel,
  getVideoDetails,
  listUploadVideoIds,
  parseIsoDuration,
  reportToObjects,
  type MonetaryTier,
  type YTAnalyticsReport,
} from "./client";

type SyncResult = {
  ok: boolean;
  error?: string;
  rowsWritten: number;
  detail: Record<string, number | string>;
};

function toDateOnlyUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgoUTC(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return toDateOnlyUTC(d);
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function bigInt(v: unknown): bigint | null {
  const n = num(v);
  if (n === null) return null;
  return BigInt(Math.round(n));
}

/**
 * Request daily channel analytics and cascade through monetary tiers on
 * failure. Returns the successful report plus records which tier actually
 * worked in `detail.monetary` so the sync log shows what happened.
 *
 * Why three tiers instead of all-or-nothing:
 *   - `full` includes estimatedRevenue + cpm. Only YPP-enrolled channels
 *     have these; non-YPP accounts get 400 "Unknown identifier (cpm)".
 *   - `impressions` drops revenue but keeps impressions + CTR. Most
 *     channels with real viewership have this data.
 *   - `core` drops monetary entirely. Brand-new or tiny channels that
 *     don't report impressions either still complete the sync.
 */
async function fetchDailyWithFallback(
  externalId: string,
  startDate: string,
  endDate: string,
  accessToken: string,
  detail: Record<string, number | string>
): Promise<YTAnalyticsReport> {
  const tiers: MonetaryTier[] = ["full", "impressions", "core"];
  let lastErr: unknown;
  for (const tier of tiers) {
    try {
      const report = await getDailyChannelMetrics(
        externalId,
        startDate,
        endDate,
        accessToken,
        tier
      );
      detail.monetary = tier;
      return report;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      // Only cascade on the recognizable "this column isn't available for this
      // channel" errors. Real network failures should still surface.
      const isColumnUnavailable =
        /Unknown identifier/i.test(msg) ||
        /monetary|403|402/i.test(msg) ||
        /impression|cpm|estimatedRevenue/i.test(msg);
      if (!isColumnUnavailable) throw e;
      // loop continues to next tier
    }
  }
  // Shouldn't happen — `core` has no monetary columns — but surface the last
  // error if every tier failed.
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Failed to fetch daily channel metrics");
}

export async function syncYouTubeChannel(channelId: string): Promise<SyncResult> {
  const startedAt = new Date();
  const log = await prisma.syncLog.create({
    data: { channelId, kind: "full", status: "SYNCING", startedAt },
  });

  await prisma.channel.update({
    where: { id: channelId },
    data: { syncStatus: "SYNCING", syncError: null },
  });

  const detail: Record<string, number | string> = {};
  let rowsWritten = 0;

  try {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new Error("Channel not found");
    if (channel.platform !== "YOUTUBE")
      throw new Error("Channel is not a YouTube channel");
    if (!channel.connected) throw new Error("Channel is not connected");

    const accessToken = await getValidAccessToken(channelId);

    // -------- 1. Channel metadata + cumulative stats --------
    const ytChannel = channel.externalId
      ? await getChannelById(channel.externalId, accessToken)
      : await getMyChannel(accessToken);
    if (!ytChannel) throw new Error("Could not fetch channel from YouTube");

    const externalId = ytChannel.id;
    const uploadsPlaylistId =
      ytChannel.contentDetails?.relatedPlaylists?.uploads ?? null;
    const avatarUrl =
      ytChannel.snippet?.thumbnails?.high?.url ??
      ytChannel.snippet?.thumbnails?.medium?.url ??
      ytChannel.snippet?.thumbnails?.default?.url ??
      null;

    await prisma.channel.update({
      where: { id: channelId },
      data: {
        externalId,
        avatarUrl,
        displayName: channel.displayName || ytChannel.snippet?.title || channel.displayName,
        handle: channel.handle ?? ytChannel.snippet?.customUrl ?? null,
        url: channel.url ?? `https://www.youtube.com/channel/${externalId}`,
      },
    });

    const today = toDateOnlyUTC(new Date());
    await prisma.youTubeChannelSnapshot.upsert({
      where: { channelId_date: { channelId, date: today } },
      create: {
        channelId,
        date: today,
        subscribers: bigInt(ytChannel.statistics?.subscriberCount),
        viewCount: bigInt(ytChannel.statistics?.viewCount),
        videoCount:
          num(ytChannel.statistics?.videoCount) !== null
            ? Math.round(num(ytChannel.statistics?.videoCount)!)
            : null,
      },
      update: {
        subscribers: bigInt(ytChannel.statistics?.subscriberCount),
        viewCount: bigInt(ytChannel.statistics?.viewCount),
        videoCount:
          num(ytChannel.statistics?.videoCount) !== null
            ? Math.round(num(ytChannel.statistics?.videoCount)!)
            : null,
      },
    });
    rowsWritten += 1;
    detail.channelMeta = "ok";

    // -------- 2. Video metadata --------
    let videoIds: string[] = [];
    if (uploadsPlaylistId) {
      videoIds = await listUploadVideoIds(uploadsPlaylistId, accessToken, 500);
    }
    detail.uploadIdsFound = videoIds.length;

    const videos = videoIds.length
      ? await getVideoDetails(videoIds, accessToken)
      : [];
    detail.videoDetailsFetched = videos.length;

    for (const v of videos) {
      if (!v.id || !v.snippet) continue;
      const durationSec = v.contentDetails?.duration
        ? parseIsoDuration(v.contentDetails.duration)
        : null;
      await prisma.youTubeVideo.upsert({
        where: { channelId_videoId: { channelId, videoId: v.id } },
        create: {
          channelId,
          videoId: v.id,
          title: v.snippet.title,
          description: v.snippet.description ?? null,
          publishedAt: new Date(v.snippet.publishedAt),
          duration: durationSec ?? null,
          thumbnailUrl:
            v.snippet.thumbnails?.high?.url ??
            v.snippet.thumbnails?.medium?.url ??
            v.snippet.thumbnails?.default?.url ??
            null,
          tags: v.snippet.tags ?? [],
          categoryId: v.snippet.categoryId ?? null,
          defaultLanguage: v.snippet.defaultLanguage ?? null,
          viewCount: bigInt(v.statistics?.viewCount),
          likeCount: bigInt(v.statistics?.likeCount),
          commentCount: bigInt(v.statistics?.commentCount),
          favoriteCount: bigInt(v.statistics?.favoriteCount),
          isShort: (durationSec ?? 999) <= 60,
          isLive: v.snippet.liveBroadcastContent === "live",
        },
        update: {
          title: v.snippet.title,
          description: v.snippet.description ?? null,
          thumbnailUrl:
            v.snippet.thumbnails?.high?.url ??
            v.snippet.thumbnails?.medium?.url ??
            v.snippet.thumbnails?.default?.url ??
            null,
          tags: v.snippet.tags ?? [],
          categoryId: v.snippet.categoryId ?? null,
          defaultLanguage: v.snippet.defaultLanguage ?? null,
          duration: durationSec ?? null,
          viewCount: bigInt(v.statistics?.viewCount),
          likeCount: bigInt(v.statistics?.likeCount),
          commentCount: bigInt(v.statistics?.commentCount),
          favoriteCount: bigInt(v.statistics?.favoriteCount),
          isShort: (durationSec ?? 999) <= 60,
          isLive: v.snippet.liveBroadcastContent === "live",
        },
      });
      rowsWritten += 1;
    }

    // -------- 3. Daily channel analytics --------
    const yesterday = daysAgoUTC(1);
    const lastSnap = await prisma.youTubeChannelSnapshot.findFirst({
      where: { channelId, views: { not: null } },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    // On first sync, pull 365 days. On subsequent, pull from last-synced-1 to handle revisions.
    const firstSync = !lastSnap;
    const start = firstSync
      ? daysAgoUTC(365)
      : new Date(lastSnap.date.getTime() - 24 * 60 * 60 * 1000);
    const end = yesterday;

    if (start <= end) {
      // Tiered fallback: try the richest metric set first, then drop revenue,
      // then drop impressions too. This way monetized channels get everything,
      // non-YPP channels still get impressions+CTR, and brand-new channels
      // that don't report any monetary columns at all still finish the sync.
      const channelDaily = await fetchDailyWithFallback(
        externalId,
        fmtDate(start),
        fmtDate(end),
        accessToken,
        detail
      );

      const rows = reportToObjects(channelDaily);
      detail.channelDailyRows = rows.length;

      for (const r of rows) {
        const day = typeof r.day === "string" ? new Date(r.day + "T00:00:00Z") : null;
        if (!day) continue;
        await prisma.youTubeChannelSnapshot.upsert({
          where: { channelId_date: { channelId, date: day } },
          create: {
            channelId,
            date: day,
            views: bigInt(r.views),
            watchTimeMinutes: num(r.estimatedMinutesWatched),
            averageViewDuration: num(r.averageViewDuration),
            averageViewPercentage: num(r.averageViewPercentage),
            likes: bigInt(r.likes),
            dislikes: bigInt(r.dislikes),
            comments: bigInt(r.comments),
            shares: bigInt(r.shares),
            subscribersGained: bigInt(r.subscribersGained),
            subscribersLost: bigInt(r.subscribersLost),
            estimatedRevenue: num(r.estimatedRevenue),
            impressions: bigInt(r.impressions),
            impressionsCtr: num(r.impressionClickThroughRate),
          },
          update: {
            views: bigInt(r.views),
            watchTimeMinutes: num(r.estimatedMinutesWatched),
            averageViewDuration: num(r.averageViewDuration),
            averageViewPercentage: num(r.averageViewPercentage),
            likes: bigInt(r.likes),
            dislikes: bigInt(r.dislikes),
            comments: bigInt(r.comments),
            shares: bigInt(r.shares),
            subscribersGained: bigInt(r.subscribersGained),
            subscribersLost: bigInt(r.subscribersLost),
            estimatedRevenue: num(r.estimatedRevenue),
            impressions: bigInt(r.impressions),
            impressionsCtr: num(r.impressionClickThroughRate),
          },
        });
        rowsWritten += 1;
      }
    }

    // -------- 4. Daily video analytics (last 90 days, top videos) --------
    const videoWindowStart = firstSync ? daysAgoUTC(365) : daysAgoUTC(90);
    try {
      const videoReport = await getDailyVideoMetrics(
        externalId,
        fmtDate(videoWindowStart),
        fmtDate(yesterday),
        accessToken,
        500
      );
      const rows = reportToObjects(videoReport);
      detail.videoDailyRows = rows.length;

      // Map from YouTube videoId -> local YouTubeVideo.id
      const localVideos = await prisma.youTubeVideo.findMany({
        where: { channelId },
        select: { id: true, videoId: true },
      });
      const videoIdMap = new Map(localVideos.map((v) => [v.videoId, v.id]));

      for (const r of rows) {
        const day = typeof r.day === "string" ? new Date(r.day + "T00:00:00Z") : null;
        const ytVideoId = typeof r.video === "string" ? r.video : null;
        if (!day || !ytVideoId) continue;
        const localId = videoIdMap.get(ytVideoId);
        if (!localId) continue;

        await prisma.youTubeVideoMetric.upsert({
          where: { videoId_date: { videoId: localId, date: day } },
          create: {
            videoId: localId,
            channelId,
            date: day,
            views: bigInt(r.views),
            watchTimeMinutes: num(r.estimatedMinutesWatched),
            averageViewDuration: num(r.averageViewDuration),
            averageViewPercentage: num(r.averageViewPercentage),
            likes: bigInt(r.likes),
            comments: bigInt(r.comments),
            shares: bigInt(r.shares),
            subscribersGained: bigInt(r.subscribersGained),
            subscribersLost: bigInt(r.subscribersLost),
          },
          update: {
            views: bigInt(r.views),
            watchTimeMinutes: num(r.estimatedMinutesWatched),
            averageViewDuration: num(r.averageViewDuration),
            averageViewPercentage: num(r.averageViewPercentage),
            likes: bigInt(r.likes),
            comments: bigInt(r.comments),
            shares: bigInt(r.shares),
            subscribersGained: bigInt(r.subscribersGained),
            subscribersLost: bigInt(r.subscribersLost),
          },
        });
        rowsWritten += 1;
      }
    } catch (e) {
      detail.videoDaily = e instanceof Error ? e.message : String(e);
    }

    // -------- 5. Aggregated breakdowns (last 28 days) --------
    const periodEnd = yesterday;
    const periodStart = daysAgoUTC(28);

    // Audience age/gender
    try {
      const rep = await getAgeGenderBreakdown(
        externalId,
        fmtDate(periodStart),
        fmtDate(periodEnd),
        accessToken
      );
      const rows = reportToObjects(rep);
      // Replace existing rows for this periodEnd
      await prisma.youTubeAudienceSnapshot.deleteMany({
        where: { channelId, periodEnd },
      });
      for (const r of rows) {
        if (typeof r.ageGroup !== "string" || typeof r.gender !== "string") continue;
        const pct = num(r.viewerPercentage);
        if (pct === null) continue;
        await prisma.youTubeAudienceSnapshot.create({
          data: {
            channelId,
            periodEnd,
            ageGroup: r.ageGroup,
            gender: r.gender,
            viewerPercentage: pct,
          },
        });
        rowsWritten += 1;
      }
      detail.audienceRows = rows.length;
    } catch (e) {
      detail.audience = e instanceof Error ? e.message : String(e);
    }

    // Geography
    try {
      const rep = await getGeographyBreakdown(
        externalId,
        fmtDate(periodStart),
        fmtDate(periodEnd),
        accessToken,
        100
      );
      const rows = reportToObjects(rep);
      await prisma.youTubeGeographySnapshot.deleteMany({
        where: { channelId, periodEnd },
      });
      for (const r of rows) {
        if (typeof r.country !== "string") continue;
        await prisma.youTubeGeographySnapshot.create({
          data: {
            channelId,
            periodEnd,
            country: r.country,
            views: bigInt(r.views) ?? BigInt(0),
            watchTimeMinutes: num(r.estimatedMinutesWatched),
            averageViewDuration: num(r.averageViewDuration),
          },
        });
        rowsWritten += 1;
      }
      detail.geographyRows = rows.length;
    } catch (e) {
      detail.geography = e instanceof Error ? e.message : String(e);
    }

    // Traffic sources
    try {
      const rep = await getTrafficSourceBreakdown(
        externalId,
        fmtDate(periodStart),
        fmtDate(periodEnd),
        accessToken
      );
      const rows = reportToObjects(rep);
      await prisma.youTubeTrafficSourceSnapshot.deleteMany({
        where: { channelId, periodEnd },
      });
      for (const r of rows) {
        if (typeof r.insightTrafficSourceType !== "string") continue;
        await prisma.youTubeTrafficSourceSnapshot.create({
          data: {
            channelId,
            periodEnd,
            insightTrafficSourceType: r.insightTrafficSourceType,
            views: bigInt(r.views) ?? BigInt(0),
            watchTimeMinutes: num(r.estimatedMinutesWatched),
          },
        });
        rowsWritten += 1;
      }
      detail.trafficRows = rows.length;
    } catch (e) {
      detail.traffic = e instanceof Error ? e.message : String(e);
    }

    // Devices
    try {
      const rep = await getDeviceBreakdown(
        externalId,
        fmtDate(periodStart),
        fmtDate(periodEnd),
        accessToken
      );
      const rows = reportToObjects(rep);
      await prisma.youTubeDeviceSnapshot.deleteMany({
        where: { channelId, periodEnd },
      });
      for (const r of rows) {
        if (typeof r.deviceType !== "string") continue;
        await prisma.youTubeDeviceSnapshot.create({
          data: {
            channelId,
            periodEnd,
            deviceType: r.deviceType,
            views: bigInt(r.views) ?? BigInt(0),
            watchTimeMinutes: num(r.estimatedMinutesWatched),
          },
        });
        rowsWritten += 1;
      }
      detail.deviceRows = rows.length;
    } catch (e) {
      detail.device = e instanceof Error ? e.message : String(e);
    }

    const finishedAt = new Date();
    await prisma.$transaction([
      prisma.channel.update({
        where: { id: channelId },
        data: {
          syncStatus: "SUCCESS",
          syncError: null,
          lastSyncedAt: finishedAt,
        },
      }),
      prisma.syncLog.update({
        where: { id: log.id },
        data: {
          status: "SUCCESS",
          finishedAt,
          rowsWritten,
          detail: detail as Prisma.InputJsonValue,
        },
      }),
    ]);

    return { ok: true, rowsWritten, detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.$transaction([
      prisma.channel.update({
        where: { id: channelId },
        data: { syncStatus: "ERROR", syncError: msg },
      }),
      prisma.syncLog.update({
        where: { id: log.id },
        data: {
          status: "ERROR" as SyncStatus,
          finishedAt: new Date(),
          rowsWritten,
          errorMessage: msg,
          detail: detail as Prisma.InputJsonValue,
        },
      }),
    ]);
    return { ok: false, error: msg, rowsWritten, detail };
  }
}

/**
 * Hourly lightweight sync — only refreshes cumulative channel stats from the
 * Data API (subscribers, total views, total videos). No per-day analytics,
 * no per-video fetches, no audience/geography rollups.
 *
 * Why: the Data API's cumulative counters update in near-real-time, so
 * hourly refreshes keep the dashboard's "Subscribers" / "Total views" cards
 * current. The Analytics API, on the other hand, only settles once a day —
 * calling it hourly would burn quota to receive the same numbers 24×.
 *
 * Runs in seconds per channel and uses 1 Data-API unit. Safe to fanout
 * across every connected channel on every cron tick.
 */
export async function syncYouTubeChannelLight(
  channelId: string
): Promise<SyncResult> {
  const startedAt = new Date();
  const log = await prisma.syncLog.create({
    data: { channelId, kind: "light", status: "SYNCING", startedAt },
  });

  const detail: Record<string, number | string> = {};
  let rowsWritten = 0;

  try {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new Error("Channel not found");
    if (channel.platform !== "YOUTUBE")
      throw new Error("Channel is not a YouTube channel");
    if (!channel.connected) throw new Error("Channel is not connected");

    const accessToken = await getValidAccessToken(channelId);

    const ytChannel = channel.externalId
      ? await getChannelById(channel.externalId, accessToken)
      : await getMyChannel(accessToken);
    if (!ytChannel) throw new Error("Could not fetch channel from YouTube");

    const today = toDateOnlyUTC(new Date());
    // Preserve any analytics rows that the deep sync already wrote for today —
    // we only touch the cumulative counters here.
    await prisma.youTubeChannelSnapshot.upsert({
      where: { channelId_date: { channelId, date: today } },
      create: {
        channelId,
        date: today,
        subscribers: bigInt(ytChannel.statistics?.subscriberCount),
        viewCount: bigInt(ytChannel.statistics?.viewCount),
        videoCount:
          num(ytChannel.statistics?.videoCount) !== null
            ? Math.round(num(ytChannel.statistics?.videoCount)!)
            : null,
      },
      update: {
        subscribers: bigInt(ytChannel.statistics?.subscriberCount),
        viewCount: bigInt(ytChannel.statistics?.viewCount),
        videoCount:
          num(ytChannel.statistics?.videoCount) !== null
            ? Math.round(num(ytChannel.statistics?.videoCount)!)
            : null,
      },
    });
    rowsWritten += 1;

    const avatarUrl =
      ytChannel.snippet?.thumbnails?.high?.url ??
      ytChannel.snippet?.thumbnails?.medium?.url ??
      ytChannel.snippet?.thumbnails?.default?.url ??
      null;

    const finishedAt = new Date();
    detail.subscribers = ytChannel.statistics?.subscriberCount ?? "—";
    detail.viewCount = ytChannel.statistics?.viewCount ?? "—";
    detail.videoCount = ytChannel.statistics?.videoCount ?? "—";

    await prisma.$transaction([
      prisma.channel.update({
        where: { id: channelId },
        data: {
          avatarUrl: avatarUrl ?? undefined,
          // We intentionally don't touch syncStatus/syncError here — the
          // heavy daily sync owns those. A light-sync failure is not a
          // user-facing "your channel is broken" event.
          lastLightSyncedAt: finishedAt,
        },
      }),
      prisma.syncLog.update({
        where: { id: log.id },
        data: {
          status: "SUCCESS",
          finishedAt,
          rowsWritten,
          detail: detail as Prisma.InputJsonValue,
        },
      }),
    ]);

    return { ok: true, rowsWritten, detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "ERROR" as SyncStatus,
        finishedAt: new Date(),
        rowsWritten,
        errorMessage: msg,
        detail: detail as Prisma.InputJsonValue,
      },
    });
    return { ok: false, error: msg, rowsWritten, detail };
  }
}
