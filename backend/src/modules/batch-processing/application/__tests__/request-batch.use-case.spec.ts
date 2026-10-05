import type { RegistrationRepository } from '../../../registration/application/ports/registration.repository';
import { RegistrationNotFoundError } from '../../../registration/application/registration.errors';
import type { Registration } from '../../../registration/domain/registration';
import { PlatformUnavailableError } from '../../../registration/application/registration.errors';
import type { BatchPlatformClient, BurstTicket } from '../ports/batch-platform.client';
import type { BatchRunStore } from '../ports/batch-run.store';
import { RequestBatchUseCase } from '../request-batch.use-case';

describe('RequestBatchUseCase', () => {
  const registration: Registration = {
    cid: 'clx-cid',
    token: 'tok',
    name: 'Fulano',
    webhook: 'https://abc.ngrok.app',
    registeredAt: new Date('2026-10-03T12:00:00Z'),
  };
  const ticket: BurstTicket = { runId: 'clx-run', total: 20, startedAt: new Date('2026-10-05T12:00:00Z') };
  let registrations: jest.Mocked<RegistrationRepository>;
  let platform: jest.Mocked<BatchPlatformClient>;
  let runs: jest.Mocked<BatchRunStore>;
  let useCase: RequestBatchUseCase;

  beforeEach(() => {
    registrations = { save: jest.fn(), findCurrent: jest.fn().mockResolvedValue(registration), findByCid: jest.fn() };
    platform = { requestBurst: jest.fn().mockResolvedValue(ticket), sendResult: jest.fn() };
    runs = {
      open: jest.fn().mockResolvedValue(undefined),
      find: jest.fn(),
      claimCompletion: jest.fn(),
      markCallbackSent: jest.fn(),
      findOpenRunIds: jest.fn(),
      findPendingCallbackRunIds: jest.fn(),
    };
    useCase = new RequestBatchUseCase(registrations, platform, runs);
  });

  it('requests a burst with the current credentials and returns the ticket', async () => {
    await expect(useCase.execute()).resolves.toEqual(ticket);

    expect(platform.requestBurst).toHaveBeenCalledWith(expect.objectContaining({ cid: 'clx-cid', token: 'tok' }));
  });

  it('opens the run with the total from the platform and the cid used in the burst', async () => {
    await useCase.execute();

    expect(runs.open).toHaveBeenCalledWith({ ...ticket, cid: 'clx-cid', status: 'OPEN' });
  });

  it('does not open a run when the platform rejects the burst', async () => {
    platform.requestBurst.mockRejectedValue(new PlatformUnavailableError('POST /burst responded 401'));

    await expect(useCase.execute()).rejects.toThrow(PlatformUnavailableError);
    expect(runs.open).not.toHaveBeenCalled();
  });

  it('fails without calling the platform when the service is not registered', async () => {
    registrations.findCurrent.mockResolvedValue(null);

    await expect(useCase.execute()).rejects.toThrow(RegistrationNotFoundError);
    expect(platform.requestBurst).not.toHaveBeenCalled();
  });
});
