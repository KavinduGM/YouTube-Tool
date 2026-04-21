import Link from "next/link";
import { BarChart3, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlatformBadge } from "@/components/platform-badge";
import { ChannelsFilter } from "./channels-filter";

export const dynamic = "force-dynamic";
export const metadata = { title: "Channels · Social Analytics" };

type SearchParams = Promise<{ platform?: string; q?: string }>;

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const platformFilter =
    sp.platform === "YOUTUBE" || sp.platform === "LINKEDIN" ? sp.platform : undefined;
  const q = sp.q?.trim();

  const channels = await prisma.channel.findMany({
    where: {
      platform: platformFilter,
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { handle: { contains: q, mode: "insensitive" } },
              { client: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { client: true },
  });

  const total = await prisma.channel.count();
  const ytCount = await prisma.channel.count({ where: { platform: "YOUTUBE" } });
  const liCount = await prisma.channel.count({ where: { platform: "LINKEDIN" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Channels</h1>
        <p className="text-sm text-muted-foreground">
          All YouTube channels and LinkedIn accounts across your clients.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total channels" value={total} />
        <StatCard label="YouTube" value={ytCount} />
        <StatCard label="LinkedIn" value={liCount} />
      </div>

      <ChannelsFilter
        initialPlatform={platformFilter}
        initialQuery={q ?? ""}
      />

      {channels.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={q || platformFilter ? "No channels match" : "No channels yet"}
          description={
            q || platformFilter
              ? "Try a different search or clear the filter."
              : "Add channels from a client's detail page."
          }
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/clients">Go to clients</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sync</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-medium">{c.displayName}</div>
                        {c.handle && (
                          <div className="text-xs text-muted-foreground">
                            {c.handle}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <PlatformBadge platform={c.platform} />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/clients/${c.client.slug}`}
                        className="text-sm hover:underline"
                      >
                        {c.client.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {c.connected ? (
                        <Badge variant="success">Connected</Badge>
                      ) : (
                        <Badge variant="muted">Not connected</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.lastSyncedAt
                        ? formatDistanceToNow(c.lastSyncedAt, { addSuffix: true })
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.url && (
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label="Open external URL"
                          >
                            <ExternalLink
                              className="h-4 w-4"
                              strokeWidth={1.75}
                            />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-2xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  );
}
