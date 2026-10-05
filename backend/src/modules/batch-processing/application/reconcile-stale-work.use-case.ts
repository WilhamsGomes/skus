import { Injectable } from "@nestjs/common";
import { ReceivedItem } from "../domain/received-item";
import { CloseBatchRunUseCase } from "./close-batch-run.use-case";
import { BatchItemStore } from "./ports/batch-item.store";
import { BatchRunStore } from "./ports/batch-run.store";
import { CallbackJobPublisher } from "./ports/callback-job.publisher";
import { EnrichmentJobPublisher } from "./ports/enrichment-job.publisher";

export const STALE_AFTER_MS = 60_000;
export const MAX_ITEM_ATTEMPTS = 30;
export const STALE_ITEMS_PER_PASS = 500;
export const OPEN_RUN_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ReconcileStaleWorkOutput {
  readonly requeuedItems: number;
  readonly closedRuns: number;
  readonly requeuedCallbacks: number;
}

@Injectable()
export class ReconcileStaleWorkUseCase {
  constructor(
    private readonly items: BatchItemStore,
    private readonly runs: BatchRunStore,
    private readonly enrichmentJobs: EnrichmentJobPublisher,
    private readonly callbackJobs: CallbackJobPublisher,
    private readonly closeBatchRun: CloseBatchRunUseCase,
  ) {}

  async execute(now = new Date()): Promise<ReconcileStaleWorkOutput> {
    const staleBefore = new Date(now.getTime() - STALE_AFTER_MS);

    let requeuedItems = 0;
    const staleItems = await this.items.findStale({
      updatedBefore: staleBefore,
      maxAttempts: MAX_ITEM_ATTEMPTS,
      limit: STALE_ITEMS_PER_PASS,
    });
    for (const item of staleItems) {
      const outcome = await this.enrichmentJobs.republish(ReceivedItem.from(item));
      if (outcome !== "already_queued") requeuedItems++;
    }

    let closedRuns = 0;
    const openRunIds = await this.runs.findOpenRunIds(
      new Date(now.getTime() - OPEN_RUN_WINDOW_MS),
      staleBefore,
    );
    for (const runId of openRunIds) {
      if (await this.closeBatchRun.execute(runId)) closedRuns++;
    }

    let requeuedCallbacks = 0;
    const pendingCallbackRunIds = await this.runs.findPendingCallbackRunIds(staleBefore);
    for (const runId of pendingCallbackRunIds) {
      const outcome = await this.callbackJobs.republish(runId);
      if (outcome !== "already_queued") requeuedCallbacks++;
    }

    return { requeuedItems, closedRuns, requeuedCallbacks };
  }
}
