/**
 * Thin wrapper around YouTube Data API v3 + YouTube Analytics API.
 * Uses fetch directly to keep bundle small.
 */

const DATA_BASE = "https://www.googleapis.com/youtube/v3";
const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2";

async function ytFetch<T = unknown>(
  url: string,
  accessToken: string
): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

// -------- Types (partial — only fields we use) --------

export type YTChannelListItem = {
  id: string;
  snippet?: {
    title: string;
    description?: string;
    customUrl?: string;
    publishedAt?: string;
    thumbnails?: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
    country?: string;
  };
  statistics?: {
    viewCount?: string;
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
    videoCount?: string;
  };
  contentDetails?: {
    relatedPlaylists?: { uploads?: string };
  };
};

export type YTVideoListItem = {
  id: string;
  snippet?: {
    title: string;
    description?: string;
    publishedAt: string;
    thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
    tags?: string[];
    categoryId?: string;
    defaultLanguage?: string;
    channelId: string;
    liveBroadcastContent?: string;
  };
  contentDetails?: {
    duration: string; // ISO 8601 "PT4M20S"
    definition?: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
    favoriteCount?: string;
  };
};

export type YTPlaylistItem = {
  snippet?: {
    resourceId?: { videoId?: string };
    publishedAt?: string;
  };
  contentDetails?: {
    videoId?: string;
    videoPublishedAt?: string;
  };
};

export type YTAnalyticsReport = {
  columnHeaders: { name: string; columnType: string; dataType: string }[];
  rows?: (string | number)[][];
};

// -------- Data API --------

export async function getMyChannel(
  accessToken: string
): Promise<YTChannelListItem | null> {
  const body = await ytFetch<{ items: YTChannelListItem[] }>(
    `${DATA_BASE}/channels?part=snippet,statistics,contentDetails&mine=true`,
    accessToken
  );
  return body.items?.[0] ?? null;
}

/**
 * Lists every YouTube channel the authorized Google account can manage.
 * Used by the OAuth channel-picker flow (one Brand Account can own many
 * channels, and a Google user can manage many Brand Accounts).
 */
export async function listMyChannels(
  accessToken: string
): Promise<YTChannelListItem[]> {
  const body = await ytFetch<{ items?: YTChannelListItem[] }>(
    `${DATA_BASE}/channels?part=snippet,statistics,contentDetails&mine=true&maxResults=50`,
    accessToken
  );
  return body.items ?? [];
}

export async function getChannelById(
  channelId: string,
  accessToken: string
): Promise<YTChannelListItem | null> {
  const body = await ytFetch<{ items: YTChannelListItem[] }>(
    `${DATA_BASE}/channels?part=snippet,statistics,contentDetails&id=${channelId}`,
    accessToken
  );
  return body.items?.[0] ?? null;
}

/**
 * Walks the uploads playlist to get every video ID.
 * Returns IDs ordered newest-first.
 */
export async function listUploadVideoIds(
  uploadsPlaylistId: string,
  accessToken: string,
  limit = 500
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${DATA_BASE}/playlistItems`);
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("playlistId", uploadsPlaylistId);
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const body = await ytFetch<{
      items: YTPlaylistItem[];
      nextPageToken?: string;
    }>(url.toString(), accessToken);

    for (const it of body.items ?? []) {
      const id = it.contentDetails?.videoId;
      if (id) ids.push(id);
    }
    pageToken = body.nextPageToken;
    if (ids.length >= limit) break;
  } while (pageToken);

  return ids.slice(0, limit);
}

/**
 * Look up full video details in chunks of 50 (max per call).
 */
export async function getVideoDetails(
  ids: string[],
  accessToken: string
): Promise<YTVideoListItem[]> {
  const out: YTVideoListItem[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url = new URL(`${DATA_BASE}/videos`);
    url.searchParams.set("part", "snippet,contentDetails,statistics");
    url.searchParams.set("id", chunk.join(","));
    const body = await ytFetch<{ items: YTVideoListItem[] }>(
      url.toString(),
      accessToken
    );
    out.push(...(body.items ?? []));
  }
  return out;
}

// -------- Analytics API --------

type AnalyticsParams = {
  channelId: string; // MUST be the YouTube channel ID (UC...)
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  metrics: string[];
  dimensions?: string[];
  filters?: string;
  sort?: string;
  maxResults?: number;
};

async function runReport(
  params: AnalyticsParams,
  accessToken: string
): Promise<YTAnalyticsReport> {
  const url = new URL(`${ANALYTICS_BASE}/reports`);
  url.searchParams.set("ids", `channel==${params.channelId}`);
  url.searchParams.set("startDate", params.startDate);
  url.searchParams.set("endDate", params.endDate);
  url.searchParams.set("metrics", params.metrics.join(","));
  if (params.dimensions?.length)
    url.searchParams.set("dimensions", params.dimensions.join(","));
  if (params.filters) url.searchParams.set("filters", params.filters);
  if (params.sort) url.searchParams.set("sort", params.sort);
  if (params.maxResults) url.searchParams.set("maxResults", String(params.maxResults));

  return ytFetch<YTAnalyticsReport>(url.toString(), accessToken);
}

// Metrics we pull daily at the channel level.
// NB: some metrics (estimatedRevenue, impressions*) require yt-analytics-monetary scope
// AND a monetized channel — we handle missing columns gracefully.
export const DAILY_CHANNEL_METRICS = [
  "views",
  "estimatedMinutesWatched",
  "averageViewDuration",
  "averageViewPercentage",
  "likes",
  "dislikes",
  "comments",
  "shares",
  "subscribersGained",
  "subscribersLost",
] as const;

export const DAILY_CHANNEL_MONETARY_METRICS = [
  "estimatedRevenue",
  "impressions",
  "cpm",
  "impressionClickThroughRate",
] as const;

export async function getDailyChannelMetrics(
  channelExternalId: string,
  startDate: string,
  endDate: string,
  accessToken: string,
  includeMonetary = true
): Promise<YTAnalyticsReport> {
  const metrics = includeMonetary
    ? [...DAILY_CHANNEL_METRICS, ...DAILY_CHANNEL_MONETARY_METRICS]
    : [...DAILY_CHANNEL_METRICS];

  return runReport(
    {
      channelId: channelExternalId,
      startDate,
      endDate,
      metrics,
      dimensions: ["day"],
      sort: "day",
    },
    accessToken
  );
}

export async function getDailyVideoMetrics(
  channelExternalId: string,
  startDate: string,
  endDate: string,
  accessToken: string,
  maxResults = 200
): Promise<YTAnalyticsReport> {
  return runReport(
    {
      channelId: channelExternalId,
      startDate,
      endDate,
      metrics: [...DAILY_CHANNEL_METRICS],
      dimensions: ["day", "video"],
      sort: "-views",
      maxResults,
    },
    accessToken
  );
}

export async function getAgeGenderBreakdown(
  channelExternalId: string,
  startDate: string,
  endDate: string,
  accessToken: string
): Promise<YTAnalyticsReport> {
  return runReport(
    {
      channelId: channelExternalId,
      startDate,
      endDate,
      metrics: ["viewerPercentage"],
      dimensions: ["ageGroup", "gender"],
    },
    accessToken
  );
}

export async function getGeographyBreakdown(
  channelExternalId: string,
  startDate: string,
  endDate: string,
  accessToken: string,
  maxResults = 50
): Promise<YTAnalyticsReport> {
  return runReport(
    {
      channelId: channelExternalId,
      startDate,
      endDate,
      metrics: ["views", "estimatedMinutesWatched", "averageViewDuration"],
      dimensions: ["country"],
      sort: "-views",
      maxResults,
    },
    accessToken
  );
}

export async function getTrafficSourceBreakdown(
  channelExternalId: string,
  startDate: string,
  endDate: string,
  accessToken: string
): Promise<YTAnalyticsReport> {
  return runReport(
    {
      channelId: channelExternalId,
      startDate,
      endDate,
      metrics: ["views", "estimatedMinutesWatched"],
      dimensions: ["insightTrafficSourceType"],
      sort: "-views",
    },
    accessToken
  );
}

export async function getDeviceBreakdown(
  channelExternalId: string,
  startDate: string,
  endDate: string,
  accessToken: string
): Promise<YTAnalyticsReport> {
  return runReport(
    {
      channelId: channelExternalId,
      startDate,
      endDate,
      metrics: ["views", "estimatedMinutesWatched"],
      dimensions: ["deviceType"],
      sort: "-views",
    },
    accessToken
  );
}

// -------- Helpers --------

/**
 * Parse ISO 8601 duration (e.g. "PT4M20S") to seconds. Returns null on malformed input.
 */
export function parseIsoDuration(iso: string): number | null {
  const m = iso.match(/^P(?:([\d.]+)D)?T?(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?$/);
  if (!m) return null;
  const days = parseFloat(m[1] ?? "0");
  const hours = parseFloat(m[2] ?? "0");
  const mins = parseFloat(m[3] ?? "0");
  const secs = parseFloat(m[4] ?? "0");
  return Math.round(days * 86400 + hours * 3600 + mins * 60 + secs);
}

/**
 * Convert a column-header-based Analytics report into an array of typed rows.
 */
export function reportToObjects(
  report: YTAnalyticsReport
): Record<string, string | number>[] {
  if (!report.rows) return [];
  const headers = report.columnHeaders.map((h) => h.name);
  return report.rows.map((row) => {
    const obj: Record<string, string | number> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}
