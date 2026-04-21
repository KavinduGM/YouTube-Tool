/**
 * BullMQ queue definitions — shared between the web app (enqueues jobs) and
 * the worker process (consumes them).
 *
 * Two queues:
 *   - daily-sync: one job per connected channel, scheduled once per UTC hour
 *                 by the scheduler based on `sync_daily_hour_utc` setting.
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

export type MonthlyReportJob = {
  clientId: string;
  /** Target reference month. If omitted the worker picks previous month UTC. */
  year?: number;
  month?: number;
};

export const QUEUE_NAMES = {
  dailySync: "daily-sync",
  monthlyReport: "monthly-report",
} as const;

let _dailySync: Queue<DailySyncJob> | null = null;
let _monthlyReport: Queue<MonthlyReportJob> | null = null;

export function getDailySyncQueue(): Queue<DailySyncJob> {
  if (!_dailySync) {
    _dailySync = new Queue<DailySyncJob>(QUEUE_NAMES.dailySync, baseOpts);
  }
  return _dailySync;
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
  if (_monthlyReport) await _monthlyReport.close();
  _dailySync = null;
  _monthlyReport = null;
}
