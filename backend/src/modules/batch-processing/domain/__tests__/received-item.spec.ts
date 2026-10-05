import { InvalidReceivedItemError, ReceivedItem } from '../received-item';

describe('ReceivedItem', () => {
  it('keeps the fields as received and exposes runId:seq as key', () => {
    const item = ReceivedItem.from({ runId: 'clx-run', seq: 0, sku: ' SKU-001 ' });

    expect(item).toMatchObject({ runId: 'clx-run', seq: 0, sku: ' SKU-001 ' });
    expect(item.key).toBe('clx-run:0');
  });

  it.each([
    ['empty run_id', { runId: ' ', seq: 1, sku: 'sku-1' }],
    ['negative seq', { runId: 'r', seq: -1, sku: 'sku-1' }],
    ['fractional seq', { runId: 'r', seq: 1.5, sku: 'sku-1' }],
    ['empty sku', { runId: 'r', seq: 1, sku: '' }],
  ])('rejects %s', (_, props) => {
    expect(() => ReceivedItem.from(props)).toThrow(InvalidReceivedItemError);
  });
});
