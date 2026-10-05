import { Test } from '@nestjs/testing';
import { ConfigModule } from '../../../shared/config/config.module';
import { PrismaModule } from '../../../shared/infra/prisma/prisma.module';
import { EnrichBatchItemUseCase } from '../application/enrich-batch-item.use-case';
import { BatchItemInbox } from '../application/ports/batch-item.inbox';
import { BatchItemStore } from '../application/ports/batch-item.store';
import { BatchPlatformClient } from '../application/ports/batch-platform.client';
import { BatchRunStore } from '../application/ports/batch-run.store';
import { EnrichmentJobPublisher } from '../application/ports/enrichment-job.publisher';
import { EnrichmentClient } from '../application/ports/enrichment.client';
import { ReceiveBatchItemUseCase } from '../application/receive-batch-item.use-case';
import { RequestBatchUseCase } from '../application/request-batch.use-case';
import { BatchProcessingModule } from '../batch-processing.module';
import { BatchPlatformHttpClient } from '../infra/http/batch-platform.http-client';
import { EnrichmentHttpClient } from '../infra/http/enrichment.http-client';
import { BullMqEnrichmentJobPublisher } from '../infra/queue/bullmq-enrichment-job.publisher';
import { EnrichmentQueue } from '../infra/queue/enrichment.queue';
import { EnrichmentWorker } from '../infra/queue/enrichment.worker';
import { PrismaBatchItemInbox } from '../infra/repositories/prisma-batch-item.inbox';
import { PrismaBatchItemStore } from '../infra/repositories/prisma-batch-item.store';
import { PrismaBatchRunStore } from '../infra/repositories/prisma-batch-run.store';

/** Garante que a injeção resolve com os providers reais. `compile()` não conecta no banco (sem `init()`). */
describe('BatchProcessingModule wiring', () => {
  beforeAll(() => {
    process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/db';
    process.env.REDIS_URL ??= 'redis://localhost:6379';
  });

  it('binds each port to its adapter and builds the use cases', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule, BatchProcessingModule],
    })
      .overrideProvider(EnrichmentQueue)
      .useValue({})
      .compile();

    expect(moduleRef.get(BatchItemInbox)).toBeInstanceOf(PrismaBatchItemInbox);
    expect(moduleRef.get(BatchPlatformClient)).toBeInstanceOf(BatchPlatformHttpClient);
    expect(moduleRef.get(BatchRunStore)).toBeInstanceOf(PrismaBatchRunStore);
    expect(moduleRef.get(EnrichmentJobPublisher)).toBeInstanceOf(BullMqEnrichmentJobPublisher);
    expect(moduleRef.get(ReceiveBatchItemUseCase)).toBeInstanceOf(ReceiveBatchItemUseCase);
    expect(moduleRef.get(RequestBatchUseCase)).toBeInstanceOf(RequestBatchUseCase);
    expect(moduleRef.get(BatchItemStore)).toBeInstanceOf(PrismaBatchItemStore);
    expect(moduleRef.get(EnrichmentClient)).toBeInstanceOf(EnrichmentHttpClient);
    expect(moduleRef.get(EnrichBatchItemUseCase)).toBeInstanceOf(EnrichBatchItemUseCase);
    expect(moduleRef.get(EnrichmentWorker)).toBeInstanceOf(EnrichmentWorker);
  });
});
