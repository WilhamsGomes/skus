import { Injectable } from "@nestjs/common";
import { RegistrationRepository } from "../../registration/application/ports/registration.repository";
import type { EnrichmentResult } from "../domain/enrichment-result";
import {
  EnrichmentRateLimitedError,
  RunCredentialsNotFoundError,
  RunNotOpenError,
  SkuNotFoundError,
} from "./enrichment.errors";
import { BatchItemStore } from "./ports/batch-item.store";
import { BatchRunStore } from "./ports/batch-run.store";
import { EnrichmentClient } from "./ports/enrichment.client";

export interface EnrichBatchItemInput {
  runId: string;
  seq: number;
  sku: string;
}

export type EnrichBatchItemOutcome = "enriched" | "failed" | "already_final";

@Injectable()
export class EnrichBatchItemUseCase {
  constructor(
    private readonly runs: BatchRunStore,
    private readonly registrations: RegistrationRepository,
    private readonly client: EnrichmentClient,
    private readonly items: BatchItemStore,
  ) {}

  async execute(input: EnrichBatchItemInput): Promise<EnrichBatchItemOutcome> {
    const { runId, seq, sku } = input;
    const ref = { runId, seq };

    const run = await this.runs.find(runId);
    if (!run) throw new RunNotOpenError(runId);

    const credentials = await this.registrations.findByCid(run.cid);
    if (!credentials) throw new RunCredentialsNotFoundError(run.cid);

    let result: EnrichmentResult;
    try {
      result = await this.client.enrich(sku, credentials);
    } catch (error) {
      if (error instanceof SkuNotFoundError) {
        const changed = await this.items.markFailed(ref, "sku_not_found");
        return changed ? "failed" : "already_final";
      }
      if (!(error instanceof EnrichmentRateLimitedError)) {
        await this.items.recordFailedAttempt(ref, describe(error));
      }
      throw error;
    }

    const changed = await this.items.markEnriched(ref, result);
    return changed ? "enriched" : "already_final";
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
