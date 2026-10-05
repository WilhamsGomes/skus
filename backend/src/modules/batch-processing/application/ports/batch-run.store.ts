import type { BatchRun } from '../../domain/batch-run';

export abstract class BatchRunStore {
  /** Grava a execução; se o run_id já existe, não altera nada (idempotente). */
  abstract open(run: BatchRun): Promise<void>;
  abstract find(runId: string): Promise<BatchRun | null>;
}
