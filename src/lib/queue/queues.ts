/**
 * BullMQ queue definitions — shared between the web app (enqueues jobs) and
 * the worker process (consumes them).
 *
 * Three queues:
 *   - daily-sync: full deep sync, one job per connected channel, scheduled
 *                 once per UTC hour by the scheduler based on
 *                 `sync_daily_hour_utc` setting.
 *   - light-sync: hourly cumulative-counter refresh (subs / total views /
 *                 video count). One job per connected channel per hour.
 *   - monthly-report: one job per client, fired on `report_day_of_month`
 *                     in the configured `report_timezone`.
 *
 * Queue names are stable so the worker in a separate container picks up jobs
 * enqueued by the web tier.
 */

import { Queue, QueueOptions } from "bullmq";
import { redis } from "@/lib/redis";

const baseOpts: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
};

export type DailySyncJob = {
  channelId: string;
};

export type LightSyncJob = {
  channelId: string;
};

export type MonthlyReportJob = {
  clientId: string;
  /** Target reference month. If omitted the worker picks previous month UTC. */
  year?: number;
  month?: number;
};

export const QUEUE_NAMES = {
  dailySync: "daily-sync",
  lightSync: "light-sync",
  monthlyReport: "monthly-report",
} as const;

let _dailySync: Queue<DailySyncJob> | null = null;
let _lightSync: Queue<LightSyncJob> | null = null;
let _monthlyReport: Queue<MonthlyReportJob> | null = null;

export function getDailySyncQueue(): Queue<DailySyncJob> {
  if (!_dailySync) {
    _dailySync = new Queue<DailySyncJob>(QUEUE_NAMES.dailySync, baseOpts);
  }
  return _dailySync;
}

export function getLightSyncQueue(): Queue<LightSyncJob> {
  if (!_lightSync) {
    // Light-sync jobs are cheap and disposable: drop the attempt count to 1
    // (no retries) so a transient Google 5xx doesn't block the next hour's
    // tick, and keep history small.
    _lightSync = new Queue<LightSyncJob>(QUEUE_NAMES.lightSync, {
      ...baseOpts,
      defaultJobOptions: {
        ...baseOpts.defaultJobOptions,
        attempts: 1,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    });
  }
  return _lightSync;
}

export function getMonthlyReportQueue(): Queue<MonthlyReportJob> {
  if (!_monthlyReport) {
    _monthlyReport = new Queue<MonthlyReportJob>(
      QUEUE_NAMES.monthlyReport,
      baseOpts
    );
  }
  return _monthlyReport;
}

/** Disconnect queues — only needed for one-off scripts / tests. */
export async function closeQueues() {
  if (_dailySync) await _dailySync.close();
  if (_lightSync) await _lightSync.close();
  if (_monthlyReport) await _monthlyReport.close();
  _dailySync = null;
  _lightSync = null;
  _monthlyReport = null;
}
