import type { RegistrationRepository } from '../../../registration/application/ports/registration.repository';
import type { Registration } from '../../../registration/domain/registration';
import type { BatchRun } from '../../domain/batch-run';
import { RunNotFoundError } from '../callback.errors';
import { RunCredentialsNotFoundError } from '../enrichment.errors';
import type { BatchItemStore, CallbackItem } from '../ports/batch-item.store';
import type { BatchPlatformClient } from '../ports/batch-platform.client';
import type { BatchRunStore } from '../ports/batch-run.store';
import { SendBatchCallbackUseCase } from '../send-batch-callback.use-case';

describe('SendBatchCallbackUseCase', () => {
  const run: BatchRun = { runId: 'clx-run', cid: 'cid-of-run', total: 2, status: 'COMPLETED', startedAt: new Date() };
  const registration: Registration = {
    cid: 'cid-of-run',
    token: 'tok',
    name: 'Fulano',
    webhook: 'https://abc.ngrok.app',
    registeredAt: new Date(),
  };
  const result: CallbackItem[] = [
    { seq: 0, sku: 'sku-0', price: 149.9, stock: 42 },
    { seq: 1, sku: 'sku-1', price: null, stock: null },
  ];
  const report = { divergences: 0 };

  let runs: jest.Mocked<BatchRunStore>;
  let registrations: jest.Mocked<RegistrationRepository>;
  let items: jest.Mocked<BatchItemStore>;
  let platform: jest.Mocked<BatchPlatformClient>;
  let useCase: SendBatchCallbackUseCase;

  beforeEach(() => {
    runs = {
      open: jest.fn(),
      find: jest.fn().mockResolvedValue(run),
      claimCompletion: jest.fn(),
      markCallbackSent: jest.fn().mockResolvedValue(undefined),
      findOpenRunIds: jest.fn(),
      findPendingCallbackRunIds: jest.fn(),
    };
    registrations = { save: jest.fn(), findCurrent: jest.fn(), findByCid: jest.fn().mockResolvedValue(registration) };
    items = {
      markEnriched: jest.fn(),
      markFailed: jest.fn(),
      recordFailedAttempt: jest.fn(),
      listForCallback: jest.fn().mockResolvedValue(result),
      findStale: jest.fn(),
    };
    platform = { requestBurst: jest.fn(), sendResult: jest.fn().mockResolvedValue(report) };
    useCase = new SendBatchCallbackUseCase(runs, registrations, items, platform);
  });

  it('sends the run result with the run credentials and stores the report', async () => {
    await expect(useCase.execute('clx-run')).resolves.toEqual({ items: 2, report });

    expect(registrations.findByCid).toHaveBeenCalledWith('cid-of-run');
    expect(platform.sendResult).toHaveBeenCalledWith(registration, 'clx-run', result);
    expect(runs.markCallbackSent).toHaveBeenCalledWith('clx-run', report);
  });

  it('does not mark the callback as sent when the platform call fails', async () => {
    platform.sendResult.mockRejectedValue(new Error('POST /callback responded 503'));

    await expect(useCase.execute('clx-run')).rejects.toThrow('503');
    expect(runs.markCallbackSent).not.toHaveBeenCalled();
  });

  it('fails when the run does not exist', async () => {
    runs.find.mockResolvedValue(null);

    await expect(useCase.execute('clx-run')).rejects.toThrow(RunNotFoundError);
  });

  it('fails when the run cid has no registration', async () => {
    registrations.findByCid.mockResolvedValue(null);

    await expect(useCase.execute('clx-run')).rejects.toThrow(RunCredentialsNotFoundError);
    expect(platform.sendResult).not.toHaveBeenCalled();
  });
});
