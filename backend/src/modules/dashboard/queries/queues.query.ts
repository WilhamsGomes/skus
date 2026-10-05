import { Injectable } from "@nestjs/common";
import type { Job, JobType, Queue } from "bullmq";
import { CallbackQueue } from "../../batch-processing/infra/queue/callback.queue";
import { EnrichmentQueue } from "../../batch-processing/infra/queue/enrichment.queue";

const COUNTED_STATES = ["waiting", "active", "delayed", "completed", "failed", "prioritized"] as const;
const RECENT_STATES: JobType[] = ["active", "waiting", "delayed", "failed", "completed"];
const RECENT_JOBS = 25;

export type JobCounts = Record<(typeof COUNTED_STATES)[number], number>;

export interface QueueJob {
  readonly id: string | undefined;
  readonly name: string;
  readonly state: string;
  readonly data: unknown;
  readonly attemptsMade: number;
  readonly maxAttempts: number | undefined;
  readonly failedReason: string | null;
  readonly createdAt: number;
  readonly processedOn: number | null;
  readonly finishedOn: number | null;
}

export interface QueueSnapshot {
  readonly name: string;
  readonly paused: boolean;
  readonly globalConcurrency: number | null;
  readonly counts: JobCounts;
  readonly recentJobs: QueueJob[];
}

@Injectable()
export class QueuesQuery {
  constructor(
    private readonly enrichment: EnrichmentQueue,
    private readonly callback: CallbackQueue,
  ) {}

  async snapshot(): Promise<QueueSnapshot[]> {
    return Promise.all([this.describe(this.enrichment), this.describe(this.callback)]);
  }

  async counts(): Promise<Record<string, JobCounts>> {
    const [enrichment, callback] = await Promise.all([
      this.countsOf(this.enrichment),
      this.countsOf(this.callback),
    ]);
    return { [this.enrichment.name]: enrichment, [this.callback.name]: callback };
  }

  private async describe(queue: Queue): Promise<QueueSnapshot> {
    const [paused, globalConcurrency, counts, recent] = await Promise.all([
      queue.isPaused(),
      queue.getGlobalConcurrency(),
      this.countsOf(queue),
      this.recentJobs(queue),
    ]);
    return { name: queue.name, paused, globalConcurrency, counts, recentJobs: recent };
  }

  private async countsOf(queue: Queue): Promise<JobCounts> {
    const counts = await queue.getJobCounts(...COUNTED_STATES);
    return Object.fromEntries(COUNTED_STATES.map((state) => [state, counts[state] ?? 0])) as JobCounts;
  }

  private async recentJobs(queue: Queue): Promise<QueueJob[]> {
    const jobs = (await queue.getJobs(RECENT_STATES, 0, RECENT_JOBS - 1, false)).filter(
      (job): job is Job => Boolean(job),
    );
    const sorted = jobs.sort((a, b) => b.timestamp - a.timestamp).slice(0, RECENT_JOBS);
    return Promise.all(sorted.map(async (job) => toQueueJob(job, await job.getState())));
  }
}

function toQueueJob(job: Job, state: string): QueueJob {
  return {
    id: job.id,
    name: job.name,
    state,
    data: job.data,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts,
    failedReason: job.failedReason || null,
    createdAt: job.timestamp,
    processedOn: job.processedOn ?? null,
    finishedOn: job.finishedOn ?? null,
  };
}
