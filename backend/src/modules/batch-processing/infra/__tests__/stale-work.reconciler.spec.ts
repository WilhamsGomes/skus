import type { ReconcileStaleWorkUseCase } from '../../application/reconcile-stale-work.use-case';
import { StaleWorkReconciler } from '../scheduling/stale-work.reconciler';

describe('StaleWorkReconciler.tick', () => {
  const reconcile = { execute: jest.fn() };
  const reconciler = new StaleWorkReconciler(reconcile as unknown as ReconcileStaleWorkUseCase);

  afterEach(() => reconcile.execute.mockReset());

  it('does not start a new pass while the previous one is still running', async () => {
    let finish!: () => void;
    reconcile.execute.mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({ requeuedItems: 0, closedRuns: 0, requeuedCallbacks: 0 });
      }),
    );

    const first = reconciler.tick();
    await reconciler.tick();
    finish();
    await first;

    expect(reconcile.execute).toHaveBeenCalledTimes(1);
  });

  it('keeps running after a failed pass', async () => {
    reconcile.execute.mockRejectedValueOnce(new Error('db down'));
    reconcile.execute.mockResolvedValueOnce({ requeuedItems: 1, closedRuns: 0, requeuedCallbacks: 0 });

    await expect(reconciler.tick()).resolves.toBeUndefined();
    await reconciler.tick();

    expect(reconcile.execute).toHaveBeenCalledTimes(2);
  });
});
