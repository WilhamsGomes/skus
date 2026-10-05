import type { AppConfig } from '../../../../shared/config/app-config';
import { PlatformUnavailableError } from '../../../registration/application/registration.errors';
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
});
