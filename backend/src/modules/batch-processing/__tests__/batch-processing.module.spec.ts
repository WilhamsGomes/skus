import { Test } from '@nestjs/testing';
import { ConfigModule } from '../../../shared/config/config.module';
import { PrismaModule } from '../../../shared/infra/prisma/prisma.module';
import { BatchItemInbox } from '../application/ports/batch-item.inbox';
import { BatchPlatformClient } from '../application/ports/batch-platform.client';
import { BatchRunStore } from '../application/ports/batch-run.store';
import { ReceiveBatchItemUseCase } from '../application/receive-batch-item.use-case';
import { RequestBatchUseCase } from '../application/request-batch.use-case';
import { BatchProcessingModule } from '../batch-processing.module';
import { BatchPlatformHttpClient } from '../infra/http/batch-platform.http-client';
import { PrismaBatchItemInbox } from '../infra/repositories/prisma-batch-item.inbox';
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
    }).compile();

    expect(moduleRef.get(BatchItemInbox)).toBeInstanceOf(PrismaBatchItemInbox);
    expect(moduleRef.get(BatchPlatformClient)).toBeInstanceOf(BatchPlatformHttpClient);
    expect(moduleRef.get(BatchRunStore)).toBeInstanceOf(PrismaBatchRunStore);
    expect(moduleRef.get(ReceiveBatchItemUseCase)).toBeInstanceOf(ReceiveBatchItemUseCase);
    expect(moduleRef.get(RequestBatchUseCase)).toBeInstanceOf(RequestBatchUseCase);
  });
});
