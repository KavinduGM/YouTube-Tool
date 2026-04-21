"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "./clients";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export type DiscoveredChannel = {
  id: string;
  title: string;
  customUrl: string | null;
  description: string | null;
  country: string | null;
  thumbnailUrl: string | null;
  subscriberCount: string | null;
  videoCount: string | null;
  viewCount: string | null;
  uploadsPlaylistId: string | null;
};

/**
 * Given a PendingYouTubeConnection and a set of externalIds the admin picked,
 * create real Channel records for each (sharing the pending's encrypted tokens)
 * and delete the pending row. Returns the IDs of the newly created channels.
 */
export async function linkYouTubeChannelsFromPending(
  pendingId: string,
  selectedExternalIds: string[]
): Promise<ActionResult<{ channelIds: string[] }>> {
  await requireAdmin();

  if (selectedExternalIds.length === 0) {
    return { ok: false, error: "Select at least one channel to connect" };
  }

  const pending = await prisma.pendingYouTubeConnection.findUnique({
    where: { id: pendingId },
    include: { client: true },
  });
  if (!pending) return { ok: false, error: "Pending connection not found" };
  if (pending.expiresAt.getTime() < Date.now()) {
    // Clean it up so the admin doesn't see it again
    await prisma.pendingYouTubeConnection.delete({ where: { id: pendingId } });
    return {
      ok: false,
      error: "This OAuth session expired. Please reconnect to YouTube.",
    };
  }

  const discovered = pending.discoveredChannels as unknown as DiscoveredChannel[];
  const picked = discovered.filter((c) => selectedExternalIds.includes(c.id));
  if (picked.length === 0) {
    return { ok: false, error: "No matching channels in this session" };
  }

  // Skip any that are already attached to this client
  const existing = await prisma.channel.findMany({
    where: {
      clientId: pending.clientId,
      platform: "YOUTUBE",
      externalId: { in: picked.map((c) => c.id) },
    },
    select: { externalId: true },
  });
  const existingIds = new Set(
    existing.map((c) => c.externalId).filter(Boolean) as string[]
  );

  const toCreate = picked.filter((c) => !existingIds.has(c.id));

  const createdIds: string[] = [];
  for (const ch of toCreate) {
    const channel = await prisma.channel.create({
      data: {
        clientId: pending.clientId,
        platform: "YOUTUBE",
        displayName: ch.title,
        externalId: ch.id,
        handle: ch.customUrl,
        url: ch.customUrl
          ? `https://youtube.com/${ch.customUrl.startsWith("@") ? ch.customUrl : `@${ch.customUrl}`}`
          : `https://youtube.com/channel/${ch.id}`,
        avatarUrl: ch.thumbnailUrl,
        accessToken: pending.accessToken,
        refreshToken: pending.refreshToken,
        tokenExpiresAt: pending.tokenExpiresAt,
        scope: pending.scope,
        connected: true,
        connectedAt: new Date(),
        syncStatus: "IDLE",
      },
    });
    createdIds.push(channel.id);
  }

  // Clean up the pending row in all cases — one-shot use
  await prisma.pendingYouTubeConnection.delete({ where: { id: pendingId } });

  revalidatePath("/channels");
  revalidatePath(`/clients/${pending.client.slug}`);
  revalidatePath("/dashboard");

  return { ok: true, data: { channelIds: createdIds } };
}

export async function cancelPendingYouTubeConnection(
  pendingId: string
): Promise<ActionResult> {
  await requireAdmin();

  const pending = await prisma.pendingYouTubeConnection.findUnique({
    where: { id: pendingId },
    include: { client: true },
  });
  if (!pending) return { ok: true }; // idempotent

  await prisma.pendingYouTubeConnection.delete({ where: { id: pendingId } });

  revalidatePath(`/clients/${pending.client.slug}`);
  return { ok: true };
}
