import type { Queue } from 'bullmq';
import { ensureJob } from '../queue/ensure-job';

describe('ensureJob', () => {
  const job = { getState: jest.fn(), retry: jest.fn(), remove: jest.fn() };
  const queue = { getJob: jest.fn(), add: jest.fn() };
  const run = () => ensureJob(queue as unknown as Queue<{ runId: string }>, 'send', { runId: 'r' }, 'r');

  afterEach(() => jest.resetAllMocks());

  it('adds the job when it does not exist', async () => {
    queue.getJob.mockResolvedValue(undefined);

    await expect(run()).resolves.toBe('added');
    expect(queue.add).toHaveBeenCalledWith('send', { runId: 'r' }, { jobId: 'r' });
  });

  it('retries a failed job instead of adding, since add would be ignored for the same jobId', async () => {
    queue.getJob.mockResolvedValue(job);
    job.getState.mockResolvedValue('failed');

    await expect(run()).resolves.toBe('retried');
    expect(job.retry).toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('replaces a completed job whose work was not persisted', async () => {
    queue.getJob.mockResolvedValue(job);
    job.getState.mockResolvedValue('completed');

    await expect(run()).resolves.toBe('added');
    expect(job.remove).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalled();
  });

  it.each(['waiting', 'active', 'delayed', 'prioritized'])('leaves a %s job alone', async (state) => {
    queue.getJob.mockResolvedValue(job);
    job.getState.mockResolvedValue(state);

    await expect(run()).resolves.toBe('already_queued');
    expect(queue.add).not.toHaveBeenCalled();
    expect(job.retry).not.toHaveBeenCalled();
  });
});
