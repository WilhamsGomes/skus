import type { EnrichmentResult } from "../../domain/enrichment-result";

export interface BatchItemRef {
  readonly runId: string;
  readonly seq: number;
}

export interface CallbackItem {
  readonly seq: number;
  readonly sku: string;
  readonly price: number | null;
  readonly stock: number | null;
}

export interface StaleItem {
  readonly runId: string;
  readonly seq: number;
  readonly sku: string;
}

export interface StaleItemQuery {
  readonly updatedBefore: Date;
  readonly maxAttempts: number;
  readonly limit: number;
}

export abstract class BatchItemStore {
  abstract markEnriched(item: BatchItemRef, result: EnrichmentResult): Promise<boolean>;
  abstract markFailed(item: BatchItemRef, reason: string): Promise<boolean>;
  abstract recordFailedAttempt(item: BatchItemRef, reason: string): Promise<void>;
  abstract listForCallback(runId: string): Promise<CallbackItem[]>;
  abstract findStale(query: StaleItemQuery): Promise<StaleItem[]>;
}
