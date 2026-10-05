export type RunStatus = "OPEN" | "COMPLETED";
export type ItemStatus = "RECEIVED" | "ENRICHED" | "FAILED";
export type AlertLevel = "success" | "info" | "warning" | "error";
export type RepublishOutcome = "added" | "retried" | "already_queued";

export interface Page<T> {
  data: T[];
  total: number;
}

export interface ScoreBreakdownEntry {
  criterion: string;
  earned: number;
  weight: number;
}

export interface ReportSummary {
  score: number | null;
  ackP50: number | null;
  ackP95: number | null;
  ackWorstMs: number | null;
  ackTargetMs: number | null;
  durationMs: number | null;
  resultPass: boolean | null;
  matched: number | null;
  expected: number | null;
  missing: number | null;
  mismatched: number | null;
  retryPass: boolean | null;
  forced500: number | null;
  concurrencyPass: boolean | null;
  got429: number | null;
  idempotencyPass: boolean | null;
  breakdown: ScoreBreakdownEntry[];
}

export interface RunItemCounts {
  received: number;
  pending: number;
  enriched: number;
  failed: number;
  enrichCalls: number;
}

export interface RunSummary {
  runId: string;
  cid: string;
  total: number;
  status: RunStatus;
  startedAt: string;
  callbackSentAt: string | null;
  deliveries: number;
  items: RunItemCounts;
  report: ReportSummary | null;
}

export interface RunItem {
  seq: number;
  sku: string;
  status: ItemStatus;
  price: number | null;
  stock: number | null;
  attempts: number;
  lastError: string | null;
  receivedAt: string;
  updatedAt: string;
}

export interface RunDelivery {
  id: number;
  sentAt: string;
  summary: ReportSummary | null;
  report: unknown;
}

export interface RunDetail extends RunSummary {
  itemList: RunItem[];
  deliveryList: RunDelivery[];
  lastReport: unknown;
}

export interface ItemRow extends RunItem {
  runId: string;
}

export interface JobCounts {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  prioritized: number;
}

export interface QueueJob {
  id: string | null;
  name: string;
  state: string;
  data: unknown;
  attemptsMade: number;
  maxAttempts: number | null;
  failedReason: string | null;
  createdAt: number;
  processedOn: number | null;
  finishedOn: number | null;
}

export interface QueueSnapshot {
  name: string;
  paused: boolean;
  globalConcurrency: number | null;
  counts: JobCounts;
  recentJobs: QueueJob[];
}

export interface KeyGroup {
  prefix: string;
  keys: number;
}

export interface CacheSnapshot {
  version: string | null;
  mode: string | null;
  uptimeSeconds: number | null;
  connectedClients: number | null;
  usedMemoryBytes: number | null;
  usedMemoryHuman: string | null;
  peakMemoryHuman: string | null;
  maxMemoryBytes: number | null;
  opsPerSecond: number | null;
  totalCommands: number | null;
  keyspaceHits: number | null;
  keyspaceMisses: number | null;
  hitRate: number | null;
  totalKeys: number;
  keysScanned: number;
  keyGroups: KeyGroup[];
}

export interface DeliveryRow {
  id: number;
  runId: string;
  sentAt: string;
  runStartedAt: string;
  summary: ReportSummary | null;
}

export interface DeliveryDetail {
  id: number;
  runId: string;
  sentAt: string;
  report: unknown;
}

export interface RegistrationRow {
  cid: string;
  name: string;
  webhook: string;
  registeredAt: string;
  current: boolean;
  runs: number;
}

export interface Alert {
  level: AlertLevel;
  title: string;
  detail: string;
}

export interface Overview {
  generatedAt: string;
  registration: { cid: string; name: string; webhook: string; registeredAt: string } | null;
  runs: { total: number; open: number; completed: number; callbacksPending: number };
  items: {
    total: number;
    pending: number;
    enriched: number;
    failed: number;
    enrichCalls: number;
    successRate: number | null;
  };
  deliveries: {
    total: number;
    bestScore: number | null;
    averageScore: number | null;
    lastSentAt: string | null;
  };
  lastReport: ReportSummary | null;
  queues: Record<string, JobCounts>;
  timeline: RunSummary[];
  alerts: Alert[];
}

export interface BurstTicket {
  runId: string;
  total: number;
  startedAt: string;
}

export interface Registration {
  cid: string;
  name: string;
  webhook: string;
  registeredAt: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  username: string;
}
