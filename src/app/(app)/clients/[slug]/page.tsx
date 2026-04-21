import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Mail, Building2, ExternalLink, BarChart3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { PlatformBadge } from "@/components/platform-badge";
import { ClientActions } from "./client-actions";
import { ChannelList } from "./channel-list";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await prisma.client.findUnique({
    where: { slug },
    include: {
      channels: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!client) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
        >
          <Link href="/clients">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            All clients
          </Link>
        </Button>
      </div>

      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          {client.description && (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {client.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
            <span className="font-mono">{client.slug}</span>
            {client.industry && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" strokeWidth={1.75} />
                {client.industry}
              </span>
            )}
            {client.contactEmail && (
              <a
                href={`mailto:${client.contactEmail}`}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Mail className="h-3 w-3" strokeWidth={1.75} />
                {client.contactEmail}
              </a>
            )}
          </div>
        </div>
        <ClientActions
          client={{
            id: client.id,
            name: client.name,
            slug: client.slug,
            description: client.description,
            contactName: client.contactName,
            contactEmail: client.contactEmail,
            industry: client.industry,
            notes: client.notes,
          }}
        />
      </div>

      <Separator />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Channels</h2>
            <p className="text-sm text-muted-foreground">
              YouTube channels and LinkedIn accounts attached to this client.
            </p>
          </div>
        </div>

        {client.channels.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No channels attached"
            description="Add a YouTube channel or LinkedIn page to start collecting analytics."
          />
        ) : null}

        <ChannelList
          clientId={client.id}
          channels={client.channels.map((c) => ({
            id: c.id,
            platform: c.platform,
            displayName: c.displayName,
            handle: c.handle,
            externalId: c.externalId,
            url: c.url,
            connected: c.connected,
            lastSyncedAt: c.lastSyncedAt,
            syncStatus: c.syncStatus,
            syncError: c.syncError,
          }))}
        />
      </section>

      {client.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {client.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
