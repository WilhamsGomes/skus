import { ReceivedItem } from '../../domain/received-item';
import { BullMqEnrichmentJobPublisher, PUBLISH_TIMEOUT_MS } from '../queue/bullmq-enrichment-job.publisher';
import type { EnrichmentQueue } from '../queue/enrichment.queue';

describe('BullMqEnrichmentJobPublisher', () => {
  const item = ReceivedItem.from({ runId: 'clx-run', seq: 7, sku: 'sku-001' });
  const queue = { add: jest.fn() };
  const publisher = new BullMqEnrichmentJobPublisher(queue as unknown as EnrichmentQueue);

  afterEach(() => {
    jest.useRealTimers();
    queue.add.mockReset();
  });

  it('adds an enrich job with a deterministic jobId without ":"', async () => {
    queue.add.mockResolvedValue({});

    await publisher.publish(item);

    expect(queue.add).toHaveBeenCalledWith(
      'enrich',
      { runId: 'clx-run', seq: 7, sku: 'sku-001' },
      { jobId: 'clx-run-7' },
    );
  });

  it('gives up after the timeout when the queue never answers (Redis down)', async () => {
    jest.useFakeTimers();
    queue.add.mockReturnValue(new Promise(() => {}));

    const published = publisher.publish(item);
    jest.advanceTimersByTime(PUBLISH_TIMEOUT_MS);

    await expect(published).rejects.toThrow(/timed out after 200ms/);
  });
});
