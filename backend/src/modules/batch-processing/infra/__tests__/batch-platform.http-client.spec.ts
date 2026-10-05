import type { AppConfig } from '../../../../shared/config/app-config';
import { PlatformUnavailableError } from '../../../registration/application/registration.errors';
import { CallbackRejectedError } from '../../application/callback.errors';
import { BatchPlatformHttpClient } from '../http/batch-platform.http-client';

describe('BatchPlatformHttpClient', () => {
  const client = new BatchPlatformHttpClient({ platformBaseUrl: 'https://platform.test' } as AppConfig);
  const credentials = { cid: 'clx-cid', token: 'tok' };
  const fetchMock = jest.spyOn(globalThis, 'fetch');

  afterEach(() => fetchMock.mockReset());
  afterAll(() => fetchMock.mockRestore());

  const respond = (status: number, body: unknown) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it('POSTs to /burst/:cid with x-token and maps the ticket', async () => {
    respond(200, { run_id: 'clx-run', total: 20, started_at: '2026-08-03T12:00:00Z' });

    await expect(client.requestBurst(credentials)).resolves.toEqual({
      runId: 'clx-run',
      total: 20,
      startedAt: new Date('2026-08-03T12:00:00Z'),
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://platform.test/burst/clx-cid');
    expect(init).toMatchObject({ method: 'POST', headers: { 'x-token': 'tok' } });
  });

  it('maps non-2xx responses to PlatformUnavailableError with the status', async () => {
    respond(401, { error: 'unauthorized' });

    await expect(client.requestBurst(credentials)).rejects.toThrow(/responded 401/);
  });

  it('rejects a 2xx response outside the contract', async () => {
    respond(200, { run_id: 'clx-run', total: '20', started_at: '2026-08-03T12:00:00Z' });

    await expect(client.requestBurst(credentials)).rejects.toThrow(/missing run_id, total or started_at/);
  });

  it('maps network errors to PlatformUnavailableError', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(client.requestBurst(credentials)).rejects.toThrow(PlatformUnavailableError);
  });

  describe('sendResult', () => {
    const result = [
      { seq: 0, sku: 'sku-0', price: 149.9, stock: 42 },
      { seq: 1, sku: 'sku-1', price: null, stock: null },
    ];

    it('POSTs the contract payload to /callback with x-token and returns the report', async () => {
      respond(200, { report: { divergences: 0 } });

      await expect(client.sendResult(credentials, 'clx-run', result)).resolves.toEqual({ report: { divergences: 0 } });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://platform.test/callback');
      expect(init).toMatchObject({
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-token': 'tok' },
      });
      expect(JSON.parse(init?.body as string)).toEqual({ cid: 'clx-cid', run_id: 'clx-run', result });
    });

    it('returns a plain-text report as is', async () => {
      fetchMock.mockResolvedValue(new Response('relatório gerado', { status: 200 }));

      await expect(client.sendResult(credentials, 'clx-run', result)).resolves.toBe('relatório gerado');
    });

    it.each([429, 500, 503])('treats %i as transient', async (status) => {
      respond(status, {});

      await expect(client.sendResult(credentials, 'clx-run', result)).rejects.toThrow(PlatformUnavailableError);
    });

    it.each([400, 401, 422])('treats %i as a permanent rejection', async (status) => {
      respond(status, { error: 'invalid' });

      await expect(client.sendResult(credentials, 'clx-run', result)).rejects.toThrow(CallbackRejectedError);
    });
  });
});
