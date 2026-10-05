import { Module } from "@nestjs/common";
import { RegistrationModule } from "../registration/registration.module";
import { BatchItemInbox } from "./application/ports/batch-item.inbox";
import { BatchPlatformClient } from "./application/ports/batch-platform.client";
import { BatchRunStore } from "./application/ports/batch-run.store";
import { ReceiveBatchItemUseCase } from "./application/receive-batch-item.use-case";
import { RequestBatchUseCase } from "./application/request-batch.use-case";
import { BatchPlatformHttpClient } from "./infra/http/batch-platform.http-client";
import { PrismaBatchItemInbox } from "./infra/repositories/prisma-batch-item.inbox";
import { PrismaBatchRunStore } from "./infra/repositories/prisma-batch-run.store";
import { BatchController } from "./presentation/controllers/batch.controller";
import { ProcessController } from "./presentation/controllers/process.controller";

@Module({
  imports: [RegistrationModule],
  controllers: [ProcessController, BatchController],
  providers: [
    {
      provide: BatchItemInbox,
      useClass: PrismaBatchItemInbox,
    },
    {
      provide: BatchPlatformClient,
      useClass: BatchPlatformHttpClient,
    },
    {
      provide: BatchRunStore,
      useClass: PrismaBatchRunStore,
    },
    ReceiveBatchItemUseCase,
    RequestBatchUseCase,
  ],
})
export class BatchProcessingModule {}
