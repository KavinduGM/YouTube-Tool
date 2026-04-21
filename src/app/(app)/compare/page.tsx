import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendingUp } from "lucide-react";
import { CompareClient } from "./compare-client";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const channels = await prisma.channel.findMany({
    where: { platform: "YOUTUBE" },
    orderBy: [{ client: { name: "asc" } }, { displayName: "asc" }],
    include: { client: true },
  });

  if (channels.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
          <p className="text-sm text-muted-foreground">
            Plot analytics for multiple YouTube channels side-by-side over a
            chosen time period.
          </p>
        </div>
        <EmptyState
          icon={TrendingUp}
          title="No YouTube channels yet"
          description="Connect at least two channels to unlock comparison charts."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
        <p className="text-sm text-muted-foreground">
          Plot analytics for multiple YouTube channels side-by-side over a
          chosen time period.
        </p>
      </div>

      <CompareClient
        channels={channels.map((c) => ({
          id: c.id,
          displayName: c.displayName,
          clientName: c.client.name,
          connected: c.connected,
        }))}
      />
    </div>
  );
}
