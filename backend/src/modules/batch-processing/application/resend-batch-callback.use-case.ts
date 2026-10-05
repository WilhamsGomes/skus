import { Injectable } from "@nestjs/common";
import { RunNotCompletedError, RunNotFoundError } from "./callback.errors";
import { BatchRunStore } from "./ports/batch-run.store";
import { CallbackJobPublisher } from "./ports/callback-job.publisher";
import type { RepublishOutcome } from "./ports/enrichment-job.publisher";

@Injectable()
export class ResendBatchCallbackUseCase {
  constructor(
    private readonly runs: BatchRunStore,
    private readonly callbacks: CallbackJobPublisher,
  ) {}

  async execute(runId: string): Promise<RepublishOutcome> {
    const run = await this.runs.find(runId);
    if (!run) throw new RunNotFoundError(runId);
    if (run.status !== "COMPLETED") throw new RunNotCompletedError(runId);

    return this.callbacks.republish(runId);
  }
}
