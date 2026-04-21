import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PlatformBadge } from "@/components/platform-badge";
import { KpiCard } from "@/components/kpi-card";
import { RangeSelector } from "@/components/range-selector";
import { TimeSeriesChart } from "@/components/charts/line-chart";
import { HorizontalBarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { AudienceChart } from "@/components/charts/audience-chart";
import { TopVideosTable } from "./top-videos-table";
import { InsightsCard } from "./insights-card";
import { isRangeKey, RANGE_LABEL, type RangeKey } from "@/lib/analytics/ranges";
import {
  getChannelKpis,
  getDailySeries,
  getAudienceBreakdown,
  getGeographyBreakdown,
  getTrafficSourceBreakdown,
  getDeviceBreakdown,
  getLatestSnapshot,
} from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

const TRAFFIC_LABELS: Record<string, string> = {
  YT_SEARCH: "YouTube search",
  EXT_URL: "External",
  SUBSCRIBER: "Subscriptions",
  RELATED_VIDEO: "Suggested videos",
  YT_CHANNEL: "Channel pages",
  NO_LINK_OTHER: "Direct",
  YT_OTHER_PAGE: "Other YT pages",
  PLAYLIST: "Playlists",
  SHORTS: "Shorts feed",
  NOTIFICATION: "Notifications",
  ADVERTISING: "Ads",
  CAMPAIGN_CARD: "Campaign cards",
  END_SCREEN: "End screens",
  ANNOTATION: "Cards",
  HASHTAGS: "Hashtags",
};

const DEVICE_LABELS: Record<string, string> = {
  MOBILE: "Mobile",
  DESKTOP: "Desktop",
  TABLET: "Tablet",
  TV: "TV",
  GAME_CONSOLE: "Console",
  UNKNOWN_PLATFORM: "Other",
};

export default async function ChannelDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; sort?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const range: RangeKey = isRangeKey(sp.range) ? sp.range : "28d";

  const channel = await prisma.channel.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!channel) notFound();
  if (channel.platform !== "YOUTUBE") notFound();

  const [
    kpis,
    daily,
    audience,
    geography,
    traffic,
    devices,
    latest,
  ] = await Promise.all([
    getChannelKpis(id, range),
    getDailySeries(id, range),
    getAudienceBreakdown(id),
    getGeographyBreakdown(id, 10),
    getTrafficSourceBreakdown(id),
    getDeviceBreakdown(id),
    getLatestSnapshot(id),
  ]);

  const hasAnyData = daily.length > 0 || !!latest;

  return (
    <div className="space-y-6">
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
        >
          <Link href={`/clients/${channel.client.slug}`}>
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            {channel.client.name}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <PlatformBadge platform={channel.platform} size="md" />
            {channel.connected ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge variant="muted">Not connected</Badge>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {channel.displayName}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {channel.handle && <span>{channel.handle}</span>}
            {channel.externalId && (
              <span className="font-mono">{channel.externalId}</span>
            )}
            {channel.lastSyncedAt && (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" strokeWidth={1.75} />
                Last sync{" "}
                {formatDistanceToNow(channel.lastSyncedAt, {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {channel.url && (
            <Button asChild variant="outline" size="sm">
              <a href={channel.url} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                Open on YouTube
              </a>
            </Button>
          )}
        </div>
      </div>

      {channel.syncError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>{channel.syncError}</span>
        </div>
      )}

      {!hasAnyData && (
        <EmptyState
          icon={Sparkles}
          title="No analytics data yet"
          description={
            channel.connected
              ? "Click 'Sync now' on the client page to pull in the first batch of data from the YouTube Analytics API."
              : "Connect this channel with Google OAuth first, then sync."
          }
        />
      )}

      {hasAnyData && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Showing{" "}
              <strong className="text-foreground">{RANGE_LABEL[range]}</strong>
              {" "}· compared with previous period
            </div>
            <RangeSelector current={range} />
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Views"
              value={kpis.current.views}
              delta={kpis.deltas.views}
            />
            <KpiCard
              label="Watch time"
              value={kpis.current.watchTimeMinutes * 60}
              delta={kpis.deltas.watchTimeMinutes}
              kind="duration"
            />
            <KpiCard
              label="Net subscribers"
              value={kpis.current.netSubscribers}
              delta={kpis.deltas.netSubscribers}
            />
            <KpiCard
              label="Revenue"
              value={kpis.current.estimatedRevenue}
              delta={kpis.deltas.estimatedRevenue}
              kind="currency"
            />
            <KpiCard
              label="Likes"
              value={kpis.current.likes}
              delta={kpis.deltas.likes}
            />
            <KpiCard
              label="Comments"
              value={kpis.current.comments}
              delta={kpis.deltas.comments}
            />
            <KpiCard
              label="Impressions"
              value={kpis.current.impressions}
              delta={kpis.deltas.impressions}
            />
            <KpiCard
              label="Avg view duration"
              value={kpis.current.averageViewDuration}
              delta={kpis.deltas.averageViewDuration}
              kind="duration"
            />
          </div>

          {/* Headline chart — views over time */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Views over time</CardTitle>
            </CardHeader>
            <CardContent>
              {daily.length > 0 ? (
                <TimeSeriesChart
                  data={daily}
                  series={[{ key: "views", label: "Views", area: true }]}
                />
              ) : (
                <EmptyChart label="No daily view data in this range" />
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Subscribers gained / lost
                </CardTitle>
              </CardHeader>
              <CardContent>
                {daily.length > 0 ? (
                  <TimeSeriesChart
                    data={daily}
                    series={[
                      {
                        key: "subscribersGained",
                        label: "Gained",
                        color: "#10b981",
                      },
                      {
                        key: "subscribersLost",
                        label: "Lost",
                        color: "#ef4444",
                      },
                    ]}
                  />
                ) : (
                  <EmptyChart label="No subscriber data" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Watch time (minutes)</CardTitle>
              </CardHeader>
              <CardContent>
                {daily.length > 0 ? (
                  <TimeSeriesChart
                    data={daily}
                    series={[
                      {
                        key: "watchTimeMinutes",
                        label: "Watch minutes",
                        area: true,
                        color: "#06b6d4",
                      },
                    ]}
                  />
                ) : (
                  <EmptyChart label="No watch time data" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Engagement (likes + comments)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {daily.length > 0 ? (
                  <TimeSeriesChart
                    data={daily}
                    series={[
                      { key: "likes", label: "Likes", color: "#a855f7" },
                      { key: "comments", label: "Comments", color: "#f59e0b" },
                    ]}
                  />
                ) : (
                  <EmptyChart label="No engagement data" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Estimated revenue</CardTitle>
              </CardHeader>
              <CardContent>
                {daily.some((d) => d.estimatedRevenue > 0) ? (
                  <TimeSeriesChart
                    data={daily}
                    series={[
                      {
                        key: "estimatedRevenue",
                        label: "Revenue",
                        area: true,
                        color: "#f59e0b",
                        format: (v) =>
                          `$${v.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}`,
                      },
                    ]}
                    yTickFormatter={(v) => `$${v.toFixed(0)}`}
                  />
                ) : (
                  <EmptyChart label="No revenue data (not monetized or not reported)" />
                )}
              </CardContent>
            </Card>
          </div>

          <InsightsCard channelId={id} range={range} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Audience (age × gender)</CardTitle>
              </CardHeader>
              <CardContent>
                {audience.length > 0 ? (
                  <AudienceChart rows={audience} />
                ) : (
                  <EmptyChart label="No audience data — requires enough watch time over 28 days" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top countries</CardTitle>
              </CardHeader>
              <CardContent>
                {geography.length > 0 ? (
                  <HorizontalBarChart
                    data={geography}
                    nameKey="country"
                    valueKey="views"
                    valueLabel="Views"
                  />
                ) : (
                  <EmptyChart label="No geography data" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Traffic sources</CardTitle>
              </CardHeader>
              <CardContent>
                {traffic.length > 0 ? (
                  <DonutChart
                    data={traffic.map((t) => ({
                      source: TRAFFIC_LABELS[t.source] ?? t.source,
                      views: t.views,
                    }))}
                    nameKey="source"
                    valueKey="views"
                  />
                ) : (
                  <EmptyChart label="No traffic source data" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Devices</CardTitle>
              </CardHeader>
              <CardContent>
                {devices.length > 0 ? (
                  <DonutChart
                    data={devices.map((d) => ({
                      device: DEVICE_LABELS[d.device] ?? d.device,
                      views: d.views,
                    }))}
                    nameKey="device"
                    valueKey="views"
                  />
                ) : (
                  <EmptyChart label="No device data" />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top videos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TopVideosTable
                channelId={id}
                range={range}
                defaultSort={
                  sp.sort === "likes" ||
                  sp.sort === "comments" ||
                  sp.sort === "published"
                    ? sp.sort
                    : "views"
                }
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}
