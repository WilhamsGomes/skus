export interface ScoreBreakdownEntry {
  readonly criterion: string;
  readonly earned: number;
  readonly weight: number;
}

export interface ReportSummary {
  readonly score: number | null;
  readonly ackP50: number | null;
  readonly ackP95: number | null;
  readonly ackWorstMs: number | null;
  readonly ackTargetMs: number | null;
  readonly durationMs: number | null;
  readonly resultPass: boolean | null;
  readonly matched: number | null;
  readonly expected: number | null;
  readonly missing: number | null;
  readonly mismatched: number | null;
  readonly retryPass: boolean | null;
  readonly forced500: number | null;
  readonly concurrencyPass: boolean | null;
  readonly got429: number | null;
  readonly idempotencyPass: boolean | null;
  readonly breakdown: ScoreBreakdownEntry[];
}

export function summarizeReport(report: unknown): ReportSummary | null {
  if (!isRecord(report)) return null;

  const breakdown = isRecord(report.breakdown)
    ? Object.entries(report.breakdown).flatMap(([criterion, value]) => {
        const earned = numberAt(value, "earned");
        const weight = numberAt(value, "weight");
        return earned === null || weight === null ? [] : [{ criterion, earned, weight }];
      })
    : [];

  return {
    score: numberAt(report, "score"),
    ackP50: numberAt(report, "ack", "p50"),
    ackP95: numberAt(report, "ack", "p95"),
    ackWorstMs: numberAt(report, "ack", "worst", "ms"),
    ackTargetMs: numberAt(report, "ack", "target_ms"),
    durationMs: numberAt(report, "duration_ms"),
    resultPass: booleanAt(report, "result", "pass"),
    matched: lengthAt(report, "result", "matched"),
    expected: numberAt(report, "result", "expected"),
    missing: lengthAt(report, "result", "missing"),
    mismatched: lengthAt(report, "result", "mismatched"),
    retryPass: booleanAt(report, "retry", "pass"),
    forced500: numberAt(report, "retry", "forced_500"),
    concurrencyPass: booleanAt(report, "concurrency", "pass"),
    got429: numberAt(report, "concurrency", "got_429"),
    idempotencyPass: booleanAt(report, "idempotency", "pass"),
    breakdown,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function at(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function numberAt(value: unknown, ...path: string[]): number | null {
  const found = at(value, path);
  return typeof found === "number" && Number.isFinite(found) ? found : null;
}

function booleanAt(value: unknown, ...path: string[]): boolean | null {
  const found = at(value, path);
  return typeof found === "boolean" ? found : null;
}

function lengthAt(value: unknown, ...path: string[]): number | null {
  const found = at(value, path);
  return Array.isArray(found) ? found.length : null;
}
