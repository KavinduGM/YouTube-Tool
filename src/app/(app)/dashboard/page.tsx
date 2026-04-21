import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Users,
  Youtube,
  FileText,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Plug,
} from "lucide-react";
import Link from "next/link";
import { aggregatePeriod } from "@/lib/analytics/queries";
import { trailingMonths } from "@/lib/analytics/ranges";

export const dynamic = "force-dynamic";

function relativeTime(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

export default async function DashboardPage() {
  const session = await auth();
  const now = new Date();
  const last30 = trailingMonths(now, 1); // approx last month window
  const prev30Start = new Date(last30.start);
  prev30Start.setUTCDate(prev30Start.getUTCDate() - 30);

  const [
    clientCount,
    ytCount,
    connectedCount,
    totalReports,
    recentSyncs,
    recentReports,
    channels,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.channel.count({ where: { platform: "YOUTUBE" } }),
    prisma.channel.count({
      where: { platform: "YOUTUBE", connected: true },
    }),
    prisma.reportLog.count({ where: { status: "SENT" } }),
    prisma.syncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 6,
      include: {
        channel: { select: { displayName: true, id: true, clientId: true } },
      },
    }),
    prisma.reportLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { client: { select: { name: true, slug: true } } },
    }),
    prisma.channel.findMany({
      where: { platform: "YOUTUBE", connected: true },
      select: { id: true, displayName: true, clientId: true },
    }),
  ]);

  // Aggregate 30-day views across all connected channels, with a week-over-week
  // comparison for the headline "system pulse" card.
  let views30d = 0;
  for (const ch of channels) {
    const a = await aggregatePeriod(ch.id, last30.start, last30.end);
    views30d += a.views;
  }

  // Top channel by 30d views
  const perChannel = await Promise.all(
    channels.map(async (ch) => {
      const a = await aggregatePeriod(ch.id, last30.start, last30.end);
      return {
        id: ch.id,
        displayName: ch.displayName,
        clientId: ch.clientId,
        views: a.views,
        netSubs: a.netSubscribers,
      };
    })
  );
  perChannel.sort((a, b) => b.views - a.views);
  const topChannel = perChannel[0];

  const stats = [
    {
      label: "Clients",
      value: clientCount,
      icon: Users,
      href: "/clients",
    },
    {
      label: "YouTube channels",
      value: `${connectedCount}/${ytCount}`,
      icon: Youtube,
      href: "/channels",
      sub: `${connectedCount} connected`,
    },
    {
      label: "30-day views",
      value: fmt(views30d),
      icon: TrendingUp,
      href: "/compare",
      sub: "across all channels",
    },
    {
      label: "Reports delivered",
      value: totalReports,
      icon: FileText,
      href: "/reports",
    },
  ];

  const integrationsReady =
    !!process.env.GOOGLE_CLIENT_ID &&
    !!process.env.RESEND_API_KEY &&
    !!process.env.ANTHROPIC_API_KEY;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Daily snapshot across every client, channel, and scheduled report.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="group"
            >
              <Card className="h-full transition-colors group-hover:bg-card/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </CardTitle>
                  <Icon
                    className="h-4 w-4 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold tracking-tight">
                    {s.value}
                  </div>
                  {s.sub && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {s.sub}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">Recent syncs</CardTitle>
              <CardDescription>
                Last analytics pulls from each connected channel.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/channels">
                View channels
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentSyncs.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No syncs yet"
                description="Connect a YouTube channel and run an initial sync to see activity here."
              />
            ) : (
              <div className="divide-y divide-border/60">
                {recentSyncs.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {s.channel.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.kind} · {s.rowsWritten} rows
                        {s.errorMessage && (
                          <span className="ml-2 text-destructive">
                            · {s.errorMessage.slice(0, 80)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <SyncStatusBadge status={s.status} />
                      <span className="w-20 text-right text-xs text-muted-foreground">
                        {relativeTime(s.startedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">System status</CardTitle>
              <CardDescription>
                Core integrations powering this workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <IntegrationRow
                label="Google OAuth"
                ok={!!process.env.GOOGLE_CLIENT_ID}
              />
              <IntegrationRow
                label="Anthropic AI"
                ok={!!process.env.ANTHROPIC_API_KEY}
              />
              <IntegrationRow
                label="Resend email"
                ok={!!process.env.RESEND_API_KEY}
              />
              <IntegrationRow
                label="Redis / BullMQ"
                ok={!!process.env.REDIS_URL}
              />
              {!integrationsReady && (
                <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                  <Link href="/settings">
                    <Plug className="h-4 w-4" strokeWidth={1.75} />
                    Review settings
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {topChannel && topChannel.views > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Top performer (30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="truncate text-lg font-semibold">
                  {topChannel.displayName}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {fmt(topChannel.views)} views ·{" "}
                  <span
                    className={
                      topChannel.netSubs >= 0
                        ? "text-emerald-500"
                        : "text-destructive"
                    }
                  >
                    {topChannel.netSubs >= 0 ? "+" : ""}
                    {fmt(topChannel.netSubs)} subs
                  </span>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                >
                  <Link href={`/channels/${topChannel.id}`}>
                    Open dashboard
                    <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Recent reports</CardTitle>
            <CardDescription>
              Latest monthly reports generated across clients.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/reports">
              All reports
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentReports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No reports yet"
              description="Trigger the first monthly report from the Reports page or wait for the scheduled run."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/reports">Go to reports</Link>
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border/60">
              {recentReports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {r.client.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.reportMonth.toLocaleString("en-US", {
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      })}{" "}
                      · {r.channelCount} channel{r.channelCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <ReportStatusBadge status={r.status} />
                    <span className="w-20 text-right text-xs text-muted-foreground">
                      {relativeTime(r.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      {ok ? (
        <Badge variant="success">
          <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
          Ready
        </Badge>
      ) : (
        <Badge variant="muted">
          <XCircle className="h-3 w-3" strokeWidth={2} />
          Missing
        </Badge>
      )}
    </div>
  );
}

function SyncStatusBadge({
  status,
}: {
  status: "IDLE" | "SYNCING" | "SUCCESS" | "ERROR";
}) {
  if (status === "SUCCESS")
    return (
      <Badge variant="success">
        <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
        Synced
      </Badge>
    );
  if (status === "ERROR")
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3" strokeWidth={2} />
        Error
      </Badge>
    );
  if (status === "SYNCING")
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 animate-pulse" strokeWidth={2} />
        Syncing
      </Badge>
    );
  return (
    <Badge variant="muted">
      <Clock className="h-3 w-3" strokeWidth={2} />
      Idle
    </Badge>
  );
}

function ReportStatusBadge({
  status,
}: {
  status: "PENDING" | "SENT" | "FAILED";
}) {
  if (status === "SENT")
    return (
      <Badge variant="success">
        <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
        Sent
      </Badge>
    );
  if (status === "FAILED")
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3" strokeWidth={2} />
        Failed
      </Badge>
    );
  return (
    <Badge variant="muted">
      <Clock className="h-3 w-3" strokeWidth={2} />
      Pending
    </Badge>
  );
}
