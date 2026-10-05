import type { BatchRun } from '../../domain/batch-run';

export abstract class BatchRunStore {
  /** Grava a execução; se o run_id já existe, não altera nada (idempotente). */
  abstract open(run: BatchRun): Promise<void>;
  abstract find(runId: string): Promise<BatchRun | null>;
  abstract claimCompletion(runId: string): Promise<boolean>;
  abstract markCallbackSent(runId: string, report: unknown): Promise<void>;
  abstract findOpenRunIds(createdAfter: Date, createdBefore: Date): Promise<string[]>;
  abstract findPendingCallbackRunIds(updatedBefore: Date): Promise<string[]>;
}
