import { EnrichmentResult, InvalidEnrichmentResultError } from '../enrichment-result';

describe('EnrichmentResult', () => {
  it('keeps price and stock as received', () => {
    expect(EnrichmentResult.from({ price: 149.9, stock: 0 })).toMatchObject({ price: 149.9, stock: 0 });
  });

  it.each([
    ['negative price', { price: -1, stock: 1 }],
    ['price as string', { price: '149.9', stock: 1 }],
    ['missing price', { price: undefined, stock: 1 }],
    ['fractional stock', { price: 1, stock: 1.5 }],
    ['negative stock', { price: 1, stock: -1 }],
  ])('rejects %s', (_, props) => {
    expect(() => EnrichmentResult.from(props)).toThrow(InvalidEnrichmentResultError);
  });
});
