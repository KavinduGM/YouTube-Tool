/**
 * BullMQ worker entrypoint — runs as a separate process (container) beside
 * the Next.js app, connected to the same Postgres + Redis.
 *
 * Responsibilities:
 *   - Consume daily-sync jobs: per-channel sync + fanout ticks.
 *   - Consume monthly-report jobs: per-client PDF+email + fanout ticks.
 *   - Maintain repeatable schedules based on AppSettings.
 *
 * Start via `tsx src/worker/index.ts` (dev) or via the Docker compose worker
 * service (prod). Logs are structured JSON on stdout.
 */

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { syncYouTubeChannel } from "@/lib/youtube/sync";
import { generateAndSendMonthlyReportAction } from "@/lib/actions/reports";
import {
  getDailySyncQueue,
  getMonthlyReportQueue,
  QUEUE_NAMES,
  type DailySyncJob,
  type MonthlyReportJob,
} from "@/lib/queue/queues";
import {
  reconcileSchedules,
  SYNC_SCHEDULER_KEY,
  REPORT_SCHEDULER_KEY,
} from "@/lib/queue/scheduler";

type LogLevel = "info" | "warn" | "error";
function log(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...extra,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else console.log(line);
}

// ---------------------------------------------------------------------------
// Fanout handlers — receive a "tick" job and enqueue one per-entity job.
// ---------------------------------------------------------------------------

async function fanoutDailySync() {
  const channels = await prisma.channel.findMany({
    where: { platform: "YOUTUBE", connected: true },
    select: { id: true, displayName: true },
  });
  if (channels.length === 0) {
    log("info", "daily-sync fanout: no connected channels");
    return;
  }
  const q = getDailySyncQueue();
  for (const c of channels) {
    await q.add(
      "sync-channel",
      { channelId: c.id },
      { jobId: `sync-${c.id}-${Date.now()}` }
    );
  }
  log("info", "daily-sync fanout: enqueued", { count: channels.length });
}

async function fanoutMonthlyReport() {
  const clients = await prisma.client.findMany({
    where: { channels: { some: { platform: "YOUTUBE", connected: true } } },
    select: { id: true, name: true },
  });
  if (clients.length === 0) {
    log("info", "monthly-report fanout: no clients with YouTube channels");
    return;
  }
  const q = getMonthlyReportQueue();
  for (const c of clients) {
    await q.add(
      "send-report",
      { clientId: c.id },
      { jobId: `report-${c.id}-${Date.now()}` }
    );
  }
  log("info", "monthly-report fanout: enqueued", { count: clients.length });
}

// ---------------------------------------------------------------------------
// Per-entity handlers
// ---------------------------------------------------------------------------

async function handleChannelSync(channelId: string) {
  log("info", "sync: starting", { channelId });
  const result = await syncYouTubeChannel(channelId);
  if (!result.ok) {
    log("error", "sync: failed", { channelId, error: result.error });
    throw new Error(result.error ?? "Sync failed");
  }
  log("info", "sync: ok", {
    channelId,
    rowsWritten: result.rowsWritten,
  });
}

async function handleClientReport(clientId: string, month?: number, year?: number) {
  log("info", "report: starting", { clientId, year, month });
  const res = await generateAndSendMonthlyReportAction(clientId, {
    triggeredBy: "scheduled",
    year,
    month,
  });
  if (!res.ok) {
    log("error", "report: failed", { clientId, error: res.error });
    throw new Error(res.error);
  }
  log("info", "report: ok", {
    clientId,
    reportId: res.data?.reportId,
    recipients: res.data?.recipients.length ?? 0,
    bytes: res.data?.pdfBytes ?? 0,
  });
}

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

function startWorkers() {
  const syncWorker = new Worker<DailySyncJob>(
    QUEUE_NAMES.dailySync,
    async (job) => {
      if (job.name === SYNC_SCHEDULER_KEY) {
        await fanoutDailySync();
        return;
      }
      await handleChannelSync(job.data.channelId);
    },
    { connection: redis, concurrency: 2 }
  );

  const reportWorker = new Worker<MonthlyReportJob>(
    QUEUE_NAMES.monthlyReport,
    async (job) => {
      if (job.name === REPORT_SCHEDULER_KEY) {
        await fanoutMonthlyReport();
        return;
      }
      await handleClientReport(
        job.data.clientId,
        job.data.month,
        job.data.year
      );
    },
    { connection: redis, concurrency: 1 }
  );

  syncWorker.on("failed", (job, err) => {
    log("error", "daily-sync job failed", {
      jobId: job?.id,
      name: job?.name,
      attemptsMade: job?.attemptsMade,
      error: err.message,
    });
  });
  reportWorker.on("failed", (job, err) => {
    log("error", "monthly-report job failed", {
      jobId: job?.id,
      name: job?.name,
      attemptsMade: job?.attemptsMade,
      error: err.message,
    });
  });

  return { syncWorker, reportWorker };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log("info", "worker: starting");

  try {
    const s = await reconcileSchedules();
    log("info", "worker: schedules reconciled", { schedules: s });
  } catch (err) {
    log("error", "worker: reconcile failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const { syncWorker, reportWorker } = startWorkers();

  // Re-reconcile every 15 minutes to pick up settings changes from the UI.
  const reconcileInterval = setInterval(async () => {
    try {
      await reconcileSchedules();
    } catch (err) {
      log("error", "worker: periodic reconcile failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, 15 * 60 * 1000);

  const shutdown = async (signal: string) => {
    log("info", "worker: shutting down", { signal });
    clearInterval(reconcileInterval);
    await Promise.allSettled([syncWorker.close(), reportWorker.close()]);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  log("info", "worker: ready");
}

main().catch((err) => {
  log("error", "worker: fatal", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
