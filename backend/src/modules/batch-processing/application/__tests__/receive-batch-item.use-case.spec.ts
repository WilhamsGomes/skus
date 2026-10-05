import { ReceivedItem } from '../../domain/received-item';
import type { BatchItemInbox } from '../ports/batch-item.inbox';
import { ReceiveBatchItemUseCase } from '../receive-batch-item.use-case';

describe('ReceiveBatchItemUseCase', () => {
  const input = { runId: 'clx-run', seq: 7, sku: 'sku-001' };
  let inbox: jest.Mocked<BatchItemInbox>;
  let useCase: ReceiveBatchItemUseCase;

  beforeEach(() => {
    inbox = { recordIfNew: jest.fn().mockResolvedValue(true) };
    useCase = new ReceiveBatchItemUseCase(inbox);
  });

  it('records the item and reports it as new', async () => {
    await expect(useCase.execute(input)).resolves.toEqual({ duplicate: false });

    expect(inbox.recordIfNew).toHaveBeenCalledWith(ReceivedItem.from(input));
  });

  it('reports a duplicate when the inbox already had run_id + seq', async () => {
    inbox.recordIfNew.mockResolvedValue(false);

    await expect(useCase.execute(input)).resolves.toEqual({ duplicate: true });
  });

  it('propagates storage failures so the message is not acknowledged', async () => {
    inbox.recordIfNew.mockRejectedValue(new Error('connection refused'));

    await expect(useCase.execute(input)).rejects.toThrow('connection refused');
  });
});
