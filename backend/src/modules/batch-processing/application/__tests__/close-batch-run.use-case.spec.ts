import { CloseBatchRunUseCase } from '../close-batch-run.use-case';
import type { BatchRunStore } from '../ports/batch-run.store';
import type { CallbackJobPublisher } from '../ports/callback-job.publisher';

describe('CloseBatchRunUseCase', () => {
  let runs: jest.Mocked<BatchRunStore>;
  let callbacks: jest.Mocked<CallbackJobPublisher>;
  let useCase: CloseBatchRunUseCase;

  beforeEach(() => {
    runs = {
      open: jest.fn(),
      find: jest.fn(),
      claimCompletion: jest.fn().mockResolvedValue(true),
      markCallbackSent: jest.fn(),
    };
    callbacks = { publish: jest.fn().mockResolvedValue(undefined) };
    useCase = new CloseBatchRunUseCase(runs, callbacks);
  });

  it('schedules the callback when it wins the completion claim', async () => {
    await expect(useCase.execute('clx-run')).resolves.toBe(true);

    expect(runs.claimCompletion).toHaveBeenCalledWith('clx-run');
    expect(callbacks.publish).toHaveBeenCalledWith('clx-run');
  });

  it('does nothing when the run is incomplete or was already claimed', async () => {
    runs.claimCompletion.mockResolvedValue(false);

    await expect(useCase.execute('clx-run')).resolves.toBe(false);
    expect(callbacks.publish).not.toHaveBeenCalled();
  });
});
