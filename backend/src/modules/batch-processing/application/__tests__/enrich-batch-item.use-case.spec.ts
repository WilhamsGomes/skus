import type { RegistrationRepository } from '../../../registration/application/ports/registration.repository';
import type { Registration } from '../../../registration/domain/registration';
import type { BatchRun } from '../../domain/batch-run';
import { EnrichmentResult } from '../../domain/enrichment-result';
import { EnrichBatchItemUseCase } from '../enrich-batch-item.use-case';
import {
  EnrichmentRateLimitedError,
  EnrichmentUnavailableError,
  RunCredentialsNotFoundError,
  RunNotOpenError,
  SkuNotFoundError,
} from '../enrichment.errors';
import type { BatchItemStore } from '../ports/batch-item.store';
import type { BatchRunStore } from '../ports/batch-run.store';
import type { EnrichmentClient } from '../ports/enrichment.client';

describe('EnrichBatchItemUseCase', () => {
  const input = { runId: 'clx-run', seq: 7, sku: 'sku-001' };
  const ref = { runId: 'clx-run', seq: 7 };
  const run: BatchRun = { runId: 'clx-run', cid: 'cid-of-run', total: 20, status: 'OPEN', startedAt: new Date() };
  const registration: Registration = {
    cid: 'cid-of-run',
    token: 'tok',
    name: 'Fulano',
    webhook: 'https://abc.ngrok.app',
    registeredAt: new Date(),
  };
  const result = EnrichmentResult.from({ price: 149.9, stock: 42 });

  let runs: jest.Mocked<BatchRunStore>;
  let registrations: jest.Mocked<RegistrationRepository>;
  let client: jest.Mocked<EnrichmentClient>;
  let items: jest.Mocked<BatchItemStore>;
  let useCase: EnrichBatchItemUseCase;

  beforeEach(() => {
    runs = {
      open: jest.fn(),
      find: jest.fn().mockResolvedValue(run),
      claimCompletion: jest.fn(),
      markCallbackSent: jest.fn(),
    };
    registrations = { save: jest.fn(), findCurrent: jest.fn(), findByCid: jest.fn().mockResolvedValue(registration) };
    client = { enrich: jest.fn().mockResolvedValue(result) };
    items = {
      markEnriched: jest.fn().mockResolvedValue(true),
      markFailed: jest.fn().mockResolvedValue(true),
      recordFailedAttempt: jest.fn().mockResolvedValue(undefined),
      listForCallback: jest.fn(),
    };
    useCase = new EnrichBatchItemUseCase(runs, registrations, client, items);
  });

  it('enriches with the credentials of the run cid and stores the result', async () => {
    await expect(useCase.execute(input)).resolves.toBe('enriched');

    expect(registrations.findByCid).toHaveBeenCalledWith('cid-of-run');
    expect(client.enrich).toHaveBeenCalledWith('sku-001', registration);
    expect(items.markEnriched).toHaveBeenCalledWith(ref, result);
  });

  it('reports already_final when the item was finished by another job', async () => {
    items.markEnriched.mockResolvedValue(false);

    await expect(useCase.execute(input)).resolves.toBe('already_final');
  });

  it('marks the item as failed on 404 without retrying', async () => {
    client.enrich.mockRejectedValue(new SkuNotFoundError('sku-001'));

    await expect(useCase.execute(input)).resolves.toBe('failed');
    expect(items.markFailed).toHaveBeenCalledWith(ref, 'sku_not_found');
  });

  it('records the attempt and rethrows transient failures so the job is retried', async () => {
    client.enrich.mockRejectedValue(new EnrichmentUnavailableError('GET /enrich responded 500'));

    await expect(useCase.execute(input)).rejects.toThrow(EnrichmentUnavailableError);
    expect(items.recordFailedAttempt).toHaveBeenCalledWith(ref, 'GET /enrich responded 500');
    expect(items.markEnriched).not.toHaveBeenCalled();
  });

  it('rethrows 429 without counting it as a failed attempt', async () => {
    client.enrich.mockRejectedValue(new EnrichmentRateLimitedError(1000));

    await expect(useCase.execute(input)).rejects.toThrow(EnrichmentRateLimitedError);
    expect(items.recordFailedAttempt).not.toHaveBeenCalled();
  });

  it('fails without calling /enrich when the run was not opened yet', async () => {
    runs.find.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toThrow(RunNotOpenError);
    expect(client.enrich).not.toHaveBeenCalled();
  });

  it('fails without calling /enrich when the run cid has no registration', async () => {
    registrations.findByCid.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toThrow(RunCredentialsNotFoundError);
    expect(client.enrich).not.toHaveBeenCalled();
  });
});
