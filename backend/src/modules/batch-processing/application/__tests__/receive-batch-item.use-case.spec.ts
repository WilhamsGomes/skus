import { ReceivedItem } from '../../domain/received-item';
import type { BatchItemInbox } from '../ports/batch-item.inbox';
import type { EnrichmentJobPublisher } from '../ports/enrichment-job.publisher';
import { ReceiveBatchItemUseCase } from '../receive-batch-item.use-case';

describe('ReceiveBatchItemUseCase', () => {
  const input = { runId: 'clx-run', seq: 7, sku: 'sku-001' };
  let inbox: jest.Mocked<BatchItemInbox>;
  let publisher: jest.Mocked<EnrichmentJobPublisher>;
  let useCase: ReceiveBatchItemUseCase;

  beforeEach(() => {
    inbox = { recordIfNew: jest.fn().mockResolvedValue(true) };
    publisher = { publish: jest.fn().mockResolvedValue(undefined) };
    useCase = new ReceiveBatchItemUseCase(inbox, publisher);
  });

  it('records the item, publishes the enrichment job and reports it as new', async () => {
    await expect(useCase.execute(input)).resolves.toEqual({ duplicate: false });

    expect(inbox.recordIfNew).toHaveBeenCalledWith(ReceivedItem.from(input));
    expect(publisher.publish).toHaveBeenCalledWith(ReceivedItem.from(input));
  });

  it('reports a duplicate and still publishes, relying on the idempotent job id', async () => {
    inbox.recordIfNew.mockResolvedValue(false);

    await expect(useCase.execute(input)).resolves.toEqual({ duplicate: true });
    expect(publisher.publish).toHaveBeenCalledTimes(1);
  });

  it('still acknowledges when publishing fails, since the item is already stored', async () => {
    publisher.publish.mockRejectedValue(new Error('Stream isn\'t writeable'));

    await expect(useCase.execute(input)).resolves.toEqual({ duplicate: false });
  });

  it('propagates storage failures without publishing, so the message is not acknowledged', async () => {
    inbox.recordIfNew.mockRejectedValue(new Error('connection refused'));

    await expect(useCase.execute(input)).rejects.toThrow('connection refused');
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
