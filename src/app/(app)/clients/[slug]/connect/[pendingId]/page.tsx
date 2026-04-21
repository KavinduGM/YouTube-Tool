import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ChannelPicker } from "./channel-picker";
import type { DiscoveredChannel } from "@/lib/actions/youtube-connect";

export const dynamic = "force-dynamic";

export default async function ConnectYouTubePage({
  params,
}: {
  params: Promise<{ slug: string; pendingId: string }>;
}) {
  const { slug, pendingId } = await params;

  const pending = await prisma.pendingYouTubeConnection.findUnique({
    where: { id: pendingId },
    include: { client: true },
  });

  if (!pending) notFound();
  if (pending.client.slug !== slug) notFound();

  if (pending.expiresAt.getTime() < Date.now()) {
    // Expired — clean up and bounce back to the client page with an error toast
    await prisma.pendingYouTubeConnection.delete({ where: { id: pendingId } });
    redirect(
      `/clients/${slug}?yt_error=${encodeURIComponent(
        "OAuth session expired. Please reconnect."
      )}`
    );
  }

  const discovered = pending.discoveredChannels as unknown as DiscoveredChannel[];

  return (
    <div className="space-y-8">
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
        >
          <Link href={`/clients/${slug}`}>
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            {pending.client.name}
          </Link>
        </Button>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pick channels to connect
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Your Google account manages {discovered.length} YouTube channel
          {discovered.length === 1 ? "" : "s"}. Select which ones to track for{" "}
          <strong>{pending.client.name}</strong>. You can connect more later.
        </p>
      </div>

      <ChannelPicker
        pendingId={pendingId}
        clientSlug={slug}
        channels={discovered}
      />
    </div>
  );
}
