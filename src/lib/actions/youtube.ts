"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncYouTubeChannel } from "@/lib/youtube/sync";
import type { ActionResult } from "./clients";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export async function syncYouTubeChannelAction(
  channelId: string
): Promise<ActionResult<{ rowsWritten: number }>> {
  await requireAdmin();

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { client: true },
  });
  if (!channel) return { ok: false, error: "Channel not found" };
  if (channel.platform !== "YOUTUBE")
    return { ok: false, error: "Not a YouTube channel" };
  if (!channel.connected)
    return { ok: false, error: "Channel is not connected — connect it first" };

  const res = await syncYouTubeChannel(channelId);

  revalidatePath("/channels");
  revalidatePath(`/clients/${channel.client.slug}`);
  revalidatePath(`/channels/${channelId}`);

  if (!res.ok) {
    return { ok: false, error: res.error ?? "Sync failed" };
  }
  return { ok: true, data: { rowsWritten: res.rowsWritten } };
}

export async function disconnectYouTubeChannelAction(
  channelId: string
): Promise<ActionResult> {
  await requireAdmin();

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { client: true },
  });
  if (!channel) return { ok: false, error: "Channel not found" };

  await prisma.channel.update({
    where: { id: channelId },
    data: {
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      scope: null,
      connected: false,
      connectedAt: null,
      syncStatus: "IDLE",
      syncError: null,
    },
  });

  revalidatePath("/channels");
  revalidatePath(`/clients/${channel.client.slug}`);
  return { ok: true };
}
