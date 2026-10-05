import { UnrecoverableError, Worker } from 'bullmq';
import type { AppConfig } from '../../../../shared/config/app-config';
import type { CloseBatchRunUseCase } from '../../application/close-batch-run.use-case';
import type { EnrichBatchItemUseCase } from '../../application/enrich-batch-item.use-case';
import {
  EnrichmentRateLimitedError,
  EnrichmentUnauthorizedError,
  EnrichmentUnavailableError,
  RunCredentialsNotFoundError,
} from '../../application/enrichment.errors';
import type { EnrichmentQueue } from '../queue/enrichment.queue';
import { EnrichmentWorker } from '../queue/enrichment.worker';

class TestableWorker extends EnrichmentWorker {
  pauses: number[] = [];
  protected override async pauseFor(ms: number): Promise<void> {
    this.pauses.push(ms);
  }
}

describe('EnrichmentWorker.handle', () => {
  const job = { id: 'clx-run-7', data: { runId: 'clx-run', seq: 7, sku: 'sku-001' }, attemptsMade: 0 };
  const useCase = { execute: jest.fn() };
  const closeBatchRun = { execute: jest.fn() };
  let worker: TestableWorker;

  beforeEach(() => {
    useCase.execute.mockReset();
    closeBatchRun.execute.mockReset().mockResolvedValue(false);
    worker = new TestableWorker(
      {} as AppConfig,
      {} as EnrichmentQueue,
      useCase as unknown as EnrichBatchItemUseCase,
      closeBatchRun as unknown as CloseBatchRunUseCase,
    );
  });

  it('runs the use case with the job data', async () => {
    useCase.execute.mockResolvedValue('enriched');

    await worker.handle(job);

    expect(useCase.execute).toHaveBeenCalledWith(job.data);
  });

  it('tries to close the run after every finished item, including already_final', async () => {
    useCase.execute.mockResolvedValue('already_final');

    await worker.handle(job);

    expect(closeBatchRun.execute).toHaveBeenCalledWith('clx-run');
  });

  it('does not try to close the run when the item failed transiently', async () => {
    useCase.execute.mockRejectedValue(new EnrichmentUnavailableError('GET /enrich responded 500'));

    await expect(worker.handle(job)).rejects.toThrow();
    expect(closeBatchRun.execute).not.toHaveBeenCalled();
  });

  it('pauses the queue for retry-after and signals a rate limit on 429', async () => {
    useCase.execute.mockRejectedValue(new EnrichmentRateLimitedError(1500));

    await expect(worker.handle(job)).rejects.toThrow(Worker.RateLimitError().message);
    expect(worker.pauses).toEqual([1500]);
  });

  it.each([new EnrichmentUnauthorizedError(), new RunCredentialsNotFoundError('cid')])(
    'does not retry credential problems (%p)',
    async (error) => {
      useCase.execute.mockRejectedValue(error);

      await expect(worker.handle(job)).rejects.toBeInstanceOf(UnrecoverableError);
    },
  );

  it('rethrows transient errors so BullMQ retries with backoff', async () => {
    const error = new EnrichmentUnavailableError('GET /enrich responded 500');
    useCase.execute.mockRejectedValue(error);

    await expect(worker.handle(job)).rejects.toBe(error);
  });
});
