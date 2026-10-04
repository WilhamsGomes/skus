import type { AppConfig } from '../../../../shared/config/app-config';
import { HandshakeFailedError, PlatformUnavailableError } from '../../application/registration.errors';
import { PlatformRegistrationHttpGateway } from '../http/platform-registration.http-gateway';

describe('PlatformRegistrationHttpGateway', () => {
  const gateway = new PlatformRegistrationHttpGateway({ platformBaseUrl: 'https://platform.test' } as AppConfig);
  const input = { name: 'Fulano', webhook: 'https://abc.ngrok.app' };
  const fetchMock = jest.spyOn(globalThis, 'fetch');

  afterEach(() => fetchMock.mockReset());
  afterAll(() => fetchMock.mockRestore());

  const respond = (status: number, body: unknown) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it('POSTs the contract payload to /register and returns the credentials', async () => {
    respond(200, { cid: 'clx-cid', token: 'tok' });

    await expect(gateway.register(input)).resolves.toEqual({ cid: 'clx-cid', token: 'tok' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://platform.test/register');
    expect(init).toMatchObject({ method: 'POST', headers: { 'content-type': 'application/json' } });
    expect(JSON.parse(init?.body as string)).toEqual(input);
  });

  it('maps 422 handshake_failed to HandshakeFailedError with the platform reason', async () => {
    respond(422, { error: 'handshake_failed', reason: 'token mismatch' });

    await expect(gateway.register(input)).rejects.toEqual(new HandshakeFailedError('token mismatch'));
  });

  it('maps other non-2xx responses to PlatformUnavailableError', async () => {
    respond(503, { error: 'unavailable' });

    await expect(gateway.register(input)).rejects.toThrow(PlatformUnavailableError);
  });

  it('rejects a 2xx response without cid or token', async () => {
    respond(200, { cid: 'clx-cid' });

    await expect(gateway.register(input)).rejects.toThrow(/missing cid or token/);
  });

  it('maps network errors to PlatformUnavailableError', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(gateway.register(input)).rejects.toThrow(PlatformUnavailableError);
  });
});
