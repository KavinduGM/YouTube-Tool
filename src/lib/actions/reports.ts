"use server";

import React from "react";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildChannelReportData } from "@/lib/reports/monthly-data";
import { MonthlyReportDocument, renderReportPdf } from "@/lib/reports/pdf";
import {
  buildMonthlyReportEmailHtml,
  sendEmailWithPdf,
} from "@/lib/email/resend";
import { getAppSettings } from "@/lib/actions/settings";
import type { ActionResult } from "./clients";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export type GenerateReportOptions = {
  /** Reference month (1–12). Defaults to previous calendar month UTC. */
  month?: number;
  year?: number;
  /** "manual" (default, from UI) or "scheduled" (BullMQ worker). */
  triggeredBy?: "manual" | "scheduled";
  /** Override recipients; falls back to AppSettings.report_recipients. */
  recipients?: string[];
};

export type GeneratedReportSummary = {
  reportId: string;
  clientId: string;
  clientName: string;
  reportMonthLabel: string;
  channelCount: number;
  recipients: string[];
  pdfBytes: number;
  status: "SENT" | "FAILED";
  errorMessage: string | null;
};

function previousMonthUtc(d: Date = new Date()): { year: number; month: number } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0-indexed current, -1 gives prev month index; convert to 1-12
  const prev = new Date(Date.UTC(y, m - 1, 1));
  return { year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 };
}

function parseRecipients(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes("@"));
}

/**
 * Generate the 6-month monthly report for a client and email the PDF to the
 * configured recipients. Called both from the UI ("Generate now") and the
 * BullMQ scheduled worker.
 *
 * Returns a structured summary; all delivery outcomes (success or failure)
 * also write a ReportLog row so the /reports page can show history.
 */
export async function generateAndSendMonthlyReportAction(
  clientId: string,
  opts: GenerateReportOptions = {}
): Promise<ActionResult<GeneratedReportSummary>> {
  if (opts.triggeredBy !== "scheduled") {
    await requireAdmin();
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { ok: false, error: "Client not found" };

  const channels = await prisma.channel.findMany({
    where: { clientId, platform: "YOUTUBE" },
    orderBy: { createdAt: "asc" },
  });
  if (channels.length === 0) {
    return {
      ok: false,
      error: "No YouTube channels connected for this client.",
    };
  }

  const { year, month } =
    opts.year && opts.month
      ? { year: opts.year, month: opts.month }
      : previousMonthUtc();
  const reportMonth = new Date(Date.UTC(year, month - 1, 1));
  const reportMonthLabel = reportMonth.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  // Resolve recipients
  const settings = await getAppSettings();
  const recipients =
    opts.recipients && opts.recipients.length > 0
      ? opts.recipients
      : parseRecipients(settings.report_recipients);

  // We still create a ReportLog even on recipient-missing failure so the
  // /reports page surfaces the mis-configuration.
  if (recipients.length === 0) {
    const log = await prisma.reportLog.create({
      data: {
        clientId,
        reportMonth,
        channelCount: channels.length,
        recipients: "",
        status: "FAILED",
        errorMessage:
          "No recipients configured. Set report_recipients in Settings.",
        triggeredBy: opts.triggeredBy ?? "manual",
      },
    });
    return {
      ok: false,
      error: log.errorMessage ?? "No recipients configured.",
    };
  }

  // 1. Build data for every channel (may call Claude if ANTHROPIC_API_KEY set).
  const channelDatas = [];
  for (const ch of channels) {
    const data = await buildChannelReportData(ch.id, reportMonth);
    if (data) channelDatas.push(data);
  }
  if (channelDatas.length === 0) {
    const log = await prisma.reportLog.create({
      data: {
        clientId,
        reportMonth,
        channelCount: 0,
        recipients: recipients.join(", "),
        status: "FAILED",
        errorMessage:
          "Failed to build report data — no YouTube analytics available yet.",
        triggeredBy: opts.triggeredBy ?? "manual",
      },
    });
    return {
      ok: false,
      error: log.errorMessage ?? "Failed to build report data.",
    };
  }

  // 2. Render PDF.
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderReportPdf(
      React.createElement(MonthlyReportDocument, {
        clientName: client.name,
        reportMonthLabel,
        channels: channelDatas,
        generatedAt: new Date(),
      })
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF rendering failed";
    const log = await prisma.reportLog.create({
      data: {
        clientId,
        reportMonth,
        channelCount: channelDatas.length,
        recipients: recipients.join(", "),
        status: "FAILED",
        errorMessage: msg,
        triggeredBy: opts.triggeredBy ?? "manual",
      },
    });
    return { ok: false, error: log.errorMessage ?? msg };
  }

  // 3. Send via Resend.
  const subject = `${client.name} — ${reportMonthLabel} analytics report`;
  const html = buildMonthlyReportEmailHtml({
    clientName: client.name,
    reportMonthLabel,
    channelCount: channelDatas.length,
  });
  const filename = `${client.slug}-${year}-${String(month).padStart(2, "0")}-report.pdf`;

  try {
    const messageId = await sendEmailWithPdf({
      to: recipients,
      subject,
      html,
      pdfBuffer,
      filename,
    });
    const log = await prisma.reportLog.create({
      data: {
        clientId,
        reportMonth,
        channelCount: channelDatas.length,
        recipients: recipients.join(", "),
        status: "SENT",
        deliveredAt: new Date(),
        messageId,
        triggeredBy: opts.triggeredBy ?? "manual",
        pdfBytes: pdfBuffer.byteLength,
      },
    });
    revalidatePath("/reports");
    return {
      ok: true,
      data: {
        reportId: log.id,
        clientId,
        clientName: client.name,
        reportMonthLabel,
        channelCount: channelDatas.length,
        recipients,
        pdfBytes: pdfBuffer.byteLength,
        status: "SENT",
        errorMessage: null,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email delivery failed";
    const log = await prisma.reportLog.create({
      data: {
        clientId,
        reportMonth,
        channelCount: channelDatas.length,
        recipients: recipients.join(", "),
        status: "FAILED",
        errorMessage: msg,
        triggeredBy: opts.triggeredBy ?? "manual",
        pdfBytes: pdfBuffer.byteLength,
      },
    });
    revalidatePath("/reports");
    return { ok: false, error: log.errorMessage ?? msg };
  }
}

/** Listing for the /reports page — recent runs + channel counts per client. */
export async function listReports(limit = 50) {
  const logs = await prisma.reportLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { client: { select: { id: true, name: true, slug: true } } },
  });
  return logs.map((l) => ({
    id: l.id,
    clientId: l.clientId,
    clientName: l.client.name,
    clientSlug: l.client.slug,
    reportMonth: l.reportMonth.toISOString().slice(0, 10),
    reportMonthLabel: l.reportMonth.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    channelCount: l.channelCount,
    recipients: l.recipients,
    status: l.status,
    deliveredAt: l.deliveredAt?.toISOString() ?? null,
    errorMessage: l.errorMessage,
    triggeredBy: l.triggeredBy,
    pdfBytes: l.pdfBytes,
    createdAt: l.createdAt.toISOString(),
  }));
}

/** Clients eligible for manual report generation (have ≥1 YouTube channel). */
export async function listReportableClients() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          channels: { where: { platform: "YOUTUBE" } },
        },
      },
    },
  });
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    youtubeChannelCount: c._count.channels,
  }));
}
