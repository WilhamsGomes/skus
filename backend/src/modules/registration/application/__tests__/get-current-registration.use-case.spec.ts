import type { Registration } from '../../domain/registration';
import { GetCurrentRegistrationUseCase } from '../get-current-registration.use-case';
import type { RegistrationRepository } from '../ports/registration.repository';
import { RegistrationNotFoundError } from '../registration.errors';

describe('GetCurrentRegistrationUseCase', () => {
  const repository: jest.Mocked<RegistrationRepository> = { save: jest.fn(), findCurrent: jest.fn(), findByCid: jest.fn() };
  const useCase = new GetCurrentRegistrationUseCase(repository);

  it('returns the most recent registration without the token', async () => {
    const registration: Registration = {
      cid: 'clx-cid',
      token: 'tok',
      name: 'Fulano',
      webhook: 'https://abc.ngrok.app',
      registeredAt: new Date(),
    };
    repository.findCurrent.mockResolvedValue(registration);

    const { token: _token, ...expected } = registration;
    await expect(useCase.execute()).resolves.toEqual(expected);
  });

  it('throws RegistrationNotFoundError before the first registration', async () => {
    repository.findCurrent.mockResolvedValue(null);

    await expect(useCase.execute()).rejects.toThrow(RegistrationNotFoundError);
  });
});
