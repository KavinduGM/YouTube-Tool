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

const ALLOWED_KEYS = new Set([
  "report_day_of_month", // 1-28
  "report_recipients", // comma separated emails
  "report_timezone", // IANA TZ, e.g. "America/New_York"
  "sync_daily_hour_utc", // 0-23
]);

export async function getAppSettings(): Promise<Record<string, string>> {
  const rows = await prisma.appSetting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function updateAppSettings(
  values: Record<string, string>
): Promise<ActionResult> {
  await requireAdmin();

  const entries = Object.entries(values).filter(([k]) => ALLOWED_KEYS.has(k));
  for (const [key, value] of entries) {
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
  revalidatePath("/settings");
  return { ok: true };
}
