import type { AppConfig } from '../../../../shared/config/app-config';
import {
  EnrichmentRateLimitedError,
  EnrichmentUnauthorizedError,
  EnrichmentUnavailableError,
  SkuNotFoundError,
} from '../../application/enrichment.errors';
import { DEFAULT_RETRY_AFTER_MS, EnrichmentHttpClient, parseRetryAfter } from '../http/enrichment.http-client';

describe('EnrichmentHttpClient', () => {
  const client = new EnrichmentHttpClient({ platformBaseUrl: 'https://platform.test' } as AppConfig);
  const credentials = { cid: 'clx-cid', token: 'tok' };
  const fetchMock = jest.spyOn(globalThis, 'fetch');

  afterEach(() => fetchMock.mockReset());
  afterAll(() => fetchMock.mockRestore());

  const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status, headers }));

  it('GETs /enrich/:sku with x-cid and x-token and returns price and stock', async () => {
    respond(200, { sku: 'sku-001', price: 149.9, stock: 42 });

    await expect(client.enrich('sku-001', credentials)).resolves.toMatchObject({ price: 149.9, stock: 42 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://platform.test/enrich/sku-001');
    expect(init).toMatchObject({ headers: { 'x-cid': 'clx-cid', 'x-token': 'tok' } });
  });

  it('maps 429 to EnrichmentRateLimitedError using retry-after', async () => {
    respond(429, {}, { 'retry-after': '2' });

    await expect(client.enrich('sku-001', credentials)).rejects.toEqual(new EnrichmentRateLimitedError(2000));
  });

  it.each([
    [404, SkuNotFoundError],
    [401, EnrichmentUnauthorizedError],
    [500, EnrichmentUnavailableError],
    [503, EnrichmentUnavailableError],
  ])('maps %i to %p', async (status, errorType) => {
    respond(status, {});

    await expect(client.enrich('sku-001', credentials)).rejects.toThrow(errorType);
  });

  it('treats a 200 outside the contract as transient', async () => {
    respond(200, { sku: 'sku-001', price: 'abc', stock: 42 });

    await expect(client.enrich('sku-001', credentials)).rejects.toThrow(/out of contract/);
  });

  it('maps network errors and timeouts to EnrichmentUnavailableError', async () => {
    fetchMock.mockRejectedValue(new DOMException('timeout', 'TimeoutError'));

    await expect(client.enrich('sku-001', credentials)).rejects.toThrow(EnrichmentUnavailableError);
  });
});

describe('parseRetryAfter', () => {
  it.each([
    ['2', 2000],
    ['0.5', 500],
    [null, DEFAULT_RETRY_AFTER_MS],
    ['garbage', DEFAULT_RETRY_AFTER_MS],
  ])('parses %p as %ims', (header, expected) => {
    expect(parseRetryAfter(header)).toBe(expected);
  });

  it('accepts an HTTP date', () => {
    const inTwoSeconds = new Date(Date.now() + 2000).toUTCString();

    expect(parseRetryAfter(inTwoSeconds)).toBeGreaterThan(0);
    expect(parseRetryAfter(inTwoSeconds)).toBeLessThanOrEqual(2000);
  });
});
