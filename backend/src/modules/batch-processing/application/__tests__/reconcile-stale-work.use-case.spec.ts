import { ReceivedItem } from '../../domain/received-item';
import type { CloseBatchRunUseCase } from '../close-batch-run.use-case';
import type { BatchItemStore } from '../ports/batch-item.store';
import type { BatchRunStore } from '../ports/batch-run.store';
import type { CallbackJobPublisher } from '../ports/callback-job.publisher';
import type { EnrichmentJobPublisher } from '../ports/enrichment-job.publisher';
import {
  MAX_ITEM_ATTEMPTS,
  OPEN_RUN_WINDOW_MS,
  ReconcileStaleWorkUseCase,
  STALE_AFTER_MS,
  STALE_ITEMS_PER_PASS,
} from '../reconcile-stale-work.use-case';

describe('ReconcileStaleWorkUseCase', () => {
  const now = new Date('2026-10-05T12:00:00Z');
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS);

  let items: jest.Mocked<BatchItemStore>;
  let runs: jest.Mocked<BatchRunStore>;
  let enrichmentJobs: jest.Mocked<EnrichmentJobPublisher>;
  let callbackJobs: jest.Mocked<CallbackJobPublisher>;
  let closeBatchRun: { execute: jest.Mock };
  let useCase: ReconcileStaleWorkUseCase;

  beforeEach(() => {
    items = {
      markEnriched: jest.fn(),
      markFailed: jest.fn(),
      recordFailedAttempt: jest.fn(),
      listForCallback: jest.fn(),
      findStale: jest.fn().mockResolvedValue([]),
    };
    runs = {
      open: jest.fn(),
      find: jest.fn(),
      claimCompletion: jest.fn(),
      markCallbackSent: jest.fn(),
      findOpenRunIds: jest.fn().mockResolvedValue([]),
      findPendingCallbackRunIds: jest.fn().mockResolvedValue([]),
    };
    enrichmentJobs = { publish: jest.fn(), republish: jest.fn() };
    callbackJobs = { publish: jest.fn(), republish: jest.fn() };
    closeBatchRun = { execute: jest.fn() };
    useCase = new ReconcileStaleWorkUseCase(
      items,
      runs,
      enrichmentJobs,
      callbackJobs,
      closeBatchRun as unknown as CloseBatchRunUseCase,
    );
  });

  it('looks only at work that has been idle for longer than the stale threshold', async () => {
    await useCase.execute(now);

    expect(items.findStale).toHaveBeenCalledWith({
      updatedBefore: staleBefore,
      maxAttempts: MAX_ITEM_ATTEMPTS,
      limit: STALE_ITEMS_PER_PASS,
    });
    expect(runs.findOpenRunIds).toHaveBeenCalledWith(new Date(now.getTime() - OPEN_RUN_WINDOW_MS), staleBefore);
    expect(runs.findPendingCallbackRunIds).toHaveBeenCalledWith(staleBefore);
  });

  it('requeues stale items, counting only the ones that were not already in the queue', async () => {
    items.findStale.mockResolvedValue([
      { runId: 'r', seq: 0, sku: 'a' },
      { runId: 'r', seq: 1, sku: 'b' },
      { runId: 'r', seq: 2, sku: 'c' },
    ]);
    enrichmentJobs.republish
      .mockResolvedValueOnce('added')
      .mockResolvedValueOnce('retried')
      .mockResolvedValueOnce('already_queued');

    const output = await useCase.execute(now);

    expect(enrichmentJobs.republish).toHaveBeenCalledWith(ReceivedItem.from({ runId: 'r', seq: 0, sku: 'a' }));
    expect(output.requeuedItems).toBe(2);
  });

  it('tries to close open runs and counts the ones it closed', async () => {
    runs.findOpenRunIds.mockResolvedValue(['complete', 'incomplete']);
    closeBatchRun.execute.mockImplementation(async (runId: string) => runId === 'complete');

    const output = await useCase.execute(now);

    expect(closeBatchRun.execute).toHaveBeenCalledTimes(2);
    expect(output.closedRuns).toBe(1);
  });

  it('requeues callbacks of completed runs that were never sent', async () => {
    runs.findPendingCallbackRunIds.mockResolvedValue(['r1', 'r2']);
    callbackJobs.republish.mockResolvedValueOnce('retried').mockResolvedValueOnce('already_queued');

    const output = await useCase.execute(now);

    expect(callbackJobs.republish).toHaveBeenCalledWith('r1');
    expect(output.requeuedCallbacks).toBe(1);
  });
});
