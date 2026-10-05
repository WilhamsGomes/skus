import type { EnrichmentResult } from "../../domain/enrichment-result";

export interface BatchItemRef {
  readonly runId: string;
  readonly seq: number;
}

export abstract class BatchItemStore {
  abstract markEnriched(item: BatchItemRef, result: EnrichmentResult): Promise<boolean>;
  abstract markFailed(item: BatchItemRef, reason: string): Promise<boolean>;
  abstract recordFailedAttempt(item: BatchItemRef, reason: string): Promise<void>;
}
