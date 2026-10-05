import { summarizeReport } from '../queries/report-summary';

describe('summarizeReport', () => {
  const report = {
    score: 100,
    ack: { p50: 420, p95: 494, worst: { ms: 496, seq: 3 }, target_ms: 600 },
    duration_ms: 2274,
    result: { pass: true, matched: [0, 1, 2], missing: [], mismatched: [], expected: 3 },
    retry: { pass: true, forced_500: 1 },
    concurrency: { pass: true, got_429: 0 },
    idempotency: { pass: true },
    breakdown: { ack: { earned: 30, weight: 30 }, retry: { earned: 15, weight: 15 }, broken: { earned: 'x' } },
  };

  it('extracts the platform report indicators', () => {
    expect(summarizeReport(report)).toEqual({
      score: 100,
      ackP50: 420,
      ackP95: 494,
      ackWorstMs: 496,
      ackTargetMs: 600,
      durationMs: 2274,
      resultPass: true,
      matched: 3,
      expected: 3,
      missing: 0,
      mismatched: 0,
      retryPass: true,
      forced500: 1,
      concurrencyPass: true,
      got429: 0,
      idempotencyPass: true,
      breakdown: [
        { criterion: 'ack', earned: 30, weight: 30 },
        { criterion: 'retry', earned: 15, weight: 15 },
      ],
    });
  });

  it.each([null, 'texto', [1, 2]])('returns null for a report that is not an object (%p)', (value) => {
    expect(summarizeReport(value)).toBeNull();
  });

  it('tolerates missing fields', () => {
    expect(summarizeReport({ score: 80 })).toMatchObject({ score: 80, ackP95: null, matched: null, breakdown: [] });
  });
});
