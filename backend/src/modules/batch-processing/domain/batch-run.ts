export type BatchRunStatus = "OPEN" | "COMPLETED";

export interface BatchRun {
  readonly runId: string;
  readonly cid: string;
  readonly total: number;
  readonly status: BatchRunStatus;
  readonly startedAt: Date;
}
