import { UnrecoverableError } from 'bullmq';
import type { AppConfig } from '../../../../shared/config/app-config';
import { PlatformUnavailableError } from '../../../registration/application/registration.errors';
import { CallbackRejectedError, RunNotFoundError } from '../../application/callback.errors';
import { RunCredentialsNotFoundError } from '../../application/enrichment.errors';
import type { SendBatchCallbackUseCase } from '../../application/send-batch-callback.use-case';
import { CallbackWorker } from '../queue/callback.worker';

describe('CallbackWorker.handle', () => {
  const job = { id: 'clx-run', data: { runId: 'clx-run' } };
  const useCase = { execute: jest.fn() };
  const worker = new CallbackWorker({} as AppConfig, useCase as unknown as SendBatchCallbackUseCase);

  afterEach(() => useCase.execute.mockReset());

  it('sends the callback for the job run', async () => {
    useCase.execute.mockResolvedValue({ items: 20, report: {} });

    await worker.handle(job);

    expect(useCase.execute).toHaveBeenCalledWith('clx-run');
  });

  it.each([new CallbackRejectedError(400, 'bad payload'), new RunNotFoundError('clx-run'), new RunCredentialsNotFoundError('cid')])(
    'does not retry permanent errors (%p)',
    async (error) => {
      useCase.execute.mockRejectedValue(error);

      await expect(worker.handle(job)).rejects.toBeInstanceOf(UnrecoverableError);
    },
  );

  it('rethrows transient errors so BullMQ retries', async () => {
    const error = new PlatformUnavailableError('POST /callback responded 503');
    useCase.execute.mockRejectedValue(error);

    await expect(worker.handle(job)).rejects.toBe(error);
  });
});
