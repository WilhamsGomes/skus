import type { Registration } from '../../domain/registration';
import type { PlatformRegistrationGateway } from '../ports/platform-registration.gateway';
import type { RegistrationRepository } from '../ports/registration.repository';
import { RegisterWebhookUseCase } from '../register-webhook.use-case';
import { HandshakeFailedError } from '../registration.errors';

describe('RegisterWebhookUseCase', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  let gateway: jest.Mocked<PlatformRegistrationGateway>;
  let repository: jest.Mocked<RegistrationRepository>;
  let useCase: RegisterWebhookUseCase;

  beforeAll(() => jest.useFakeTimers({ now }));
  afterAll(() => jest.useRealTimers());

  beforeEach(() => {
    gateway = { register: jest.fn().mockResolvedValue({ cid: 'clx-cid', token: 'tok' }) };
    repository = { save: jest.fn().mockResolvedValue(undefined), findCurrent: jest.fn() };
    useCase = new RegisterWebhookUseCase(gateway, repository);
  });

  it('registers on the platform and persists the credentials, token included', async () => {
    await useCase.execute({ name: 'Fulano', webhook: 'https://abc.ngrok.app' });

    const persisted: Registration = {
      cid: 'clx-cid',
      token: 'tok',
      name: 'Fulano',
      webhook: 'https://abc.ngrok.app',
      registeredAt: now,
    };
    expect(gateway.register).toHaveBeenCalledWith({ name: 'Fulano', webhook: 'https://abc.ngrok.app' });
    expect(repository.save).toHaveBeenCalledWith(persisted);
  });

  it('returns the registration without the token', async () => {
    const result = await useCase.execute({ name: 'Fulano', webhook: 'https://abc.ngrok.app' });

    expect(result).toEqual({ cid: 'clx-cid', name: 'Fulano', webhook: 'https://abc.ngrok.app', registeredAt: now });
  });

  it('strips trailing slashes so the platform calls <webhook>/check, not //check', async () => {
    await useCase.execute({ name: 'Fulano', webhook: 'https://abc.ngrok.app//' });

    expect(gateway.register).toHaveBeenCalledWith({ name: 'Fulano', webhook: 'https://abc.ngrok.app' });
  });

  it('does not persist anything when the handshake fails', async () => {
    gateway.register.mockRejectedValue(new HandshakeFailedError('token mismatch'));

    await expect(useCase.execute({ name: 'Fulano', webhook: 'https://abc.ngrok.app' })).rejects.toThrow(
      HandshakeFailedError,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });
});
