"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { channelSchema, type ChannelInput } from "@/lib/validators";
import type { ActionResult } from "./clients";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export async function createChannel(
  raw: ChannelInput
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = channelSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
  });
  if (!client) return { ok: false, error: "Client not found" };

  const channel = await prisma.channel.create({
    data: {
      clientId: parsed.data.clientId,
      platform: parsed.data.platform,
      displayName: parsed.data.displayName,
      externalId: parsed.data.externalId || null,
      handle: parsed.data.handle || null,
      url: parsed.data.url || null,
    },
  });

  revalidatePath("/channels");
  revalidatePath(`/clients/${client.slug}`);
  revalidatePath("/dashboard");
  return { ok: true, data: { id: channel.id } };
}

export async function updateChannel(
  id: string,
  raw: ChannelInput
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = channelSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const current = await prisma.channel.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!current) return { ok: false, error: "Channel not found" };

  await prisma.channel.update({
    where: { id },
    data: {
      displayName: parsed.data.displayName,
      externalId: parsed.data.externalId || null,
      handle: parsed.data.handle || null,
      url: parsed.data.url || null,
      // platform and clientId are immutable after creation
    },
  });

  revalidatePath("/channels");
  revalidatePath(`/clients/${current.client.slug}`);
  return { ok: true, data: { id } };
}

export async function deleteChannel(id: string): Promise<ActionResult> {
  await requireAdmin();

  const channel = await prisma.channel.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!channel) return { ok: false, error: "Channel not found" };

  await prisma.channel.delete({ where: { id } });

  revalidatePath("/channels");
  revalidatePath(`/clients/${channel.client.slug}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
