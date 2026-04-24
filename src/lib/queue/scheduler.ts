/**
 * Repeatable job scheduler — called once at worker startup (and on each tick
 * of the tick-scheduler) to ensure the BullMQ repeatable jobs match current
 * AppSettings. If the admin changes the daily-sync hour or report day in the
 * UI, the next reconcile picks it up.
 */

import { prisma } from "@/lib/prisma";
import {
  getDailySyncQueue,
  getLightSyncQueue,
  getMonthlyReportQueue,
  QUEUE_NAMES,
} from "./queues";

const SYNC_SCHEDULER_KEY = "daily-sync-fanout";
const LIGHT_SYNC_SCHEDULER_KEY = "light-sync-fanout";
const REPORT_SCHEDULER_KEY = "monthly-report-fanout";

async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

/**
 * Read settings, drop existing repeatable schedules, and re-add the fanout
 * jobs with current cron expressions. This is safe to call repeatedly.
 *
 * Fanout strategy: we enqueue a single "tick" repeatable job per queue. The
 * worker, on receiving the tick, enumerates channels/clients and enqueues
 * per-entity jobs on the same queue. This avoids thousands of repeatables
 * and makes it easy to adjust at runtime.
 */
export async function reconcileSchedules() {
  const hour = clampHour(await getSetting("sync_daily_hour_utc", "3"));
  const day = clampDay(await getSetting("report_day_of_month", "1"));
  const tz = await getSetting("report_timezone", "UTC");

  // Daily deep sync — every day at {hour} UTC
  const syncCron = `0 ${hour} * * *`;
  // Hourly light sync — every hour at :05 UTC (offset so it doesn't collide
  // with the deep sync when `hour === <current hour>`).
  const lightSyncCron = `5 * * * *`;
  // Monthly report — 06:00 local on {day}; worker applies tz below
  const reportCron = `0 6 ${day} * *`;

  const syncQ = getDailySyncQueue();
  const lightSyncQ = getLightSyncQueue();
  const reportQ = getMonthlyReportQueue();

  // Remove any existing repeatables we own so we can replace them cleanly.
  const syncRepeatables = await syncQ.getRepeatableJobs();
  for (const r of syncRepeatables) {
    if (r.name === SYNC_SCHEDULER_KEY) {
      await syncQ.removeRepeatableByKey(r.key);
    }
  }
  const lightRepeatables = await lightSyncQ.getRepeatableJobs();
  for (const r of lightRepeatables) {
    if (r.name === LIGHT_SYNC_SCHEDULER_KEY) {
      await lightSyncQ.removeRepeatableByKey(r.key);
    }
  }
  const reportRepeatables = await reportQ.getRepeatableJobs();
  for (const r of reportRepeatables) {
    if (r.name === REPORT_SCHEDULER_KEY) {
      await reportQ.removeRepeatableByKey(r.key);
    }
  }

  // Re-add.
  await syncQ.add(
    SYNC_SCHEDULER_KEY,
    { channelId: "__fanout__" },
    {
      repeat: { pattern: syncCron, tz: "UTC" },
      jobId: SYNC_SCHEDULER_KEY,
    }
  );
  await lightSyncQ.add(
    LIGHT_SYNC_SCHEDULER_KEY,
    { channelId: "__fanout__" },
    {
      repeat: { pattern: lightSyncCron, tz: "UTC" },
      jobId: LIGHT_SYNC_SCHEDULER_KEY,
    }
  );
  await reportQ.add(
    REPORT_SCHEDULER_KEY,
    { clientId: "__fanout__" },
    {
      repeat: { pattern: reportCron, tz },
      jobId: REPORT_SCHEDULER_KEY,
    }
  );

  return {
    sync: { queue: QUEUE_NAMES.dailySync, cron: syncCron, tz: "UTC" },
    lightSync: { queue: QUEUE_NAMES.lightSync, cron: lightSyncCron, tz: "UTC" },
    report: { queue: QUEUE_NAMES.monthlyReport, cron: reportCron, tz },
  };
}

function clampHour(s: string): number {
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return 3;
  return Math.min(23, Math.max(0, n));
}

function clampDay(s: string): number {
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(28, Math.max(1, n));
}

export {
  SYNC_SCHEDULER_KEY,
  LIGHT_SYNC_SCHEDULER_KEY,
  REPORT_SCHEDULER_KEY,
};
