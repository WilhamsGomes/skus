import { Module } from "@nestjs/common";
import { RegistrationModule } from "../registration/registration.module";
import { CloseBatchRunUseCase } from "./application/close-batch-run.use-case";
import { EnrichBatchItemUseCase } from "./application/enrich-batch-item.use-case";
import { BatchItemInbox } from "./application/ports/batch-item.inbox";
import { BatchItemStore } from "./application/ports/batch-item.store";
import { BatchPlatformClient } from "./application/ports/batch-platform.client";
import { BatchRunStore } from "./application/ports/batch-run.store";
import { CallbackJobPublisher } from "./application/ports/callback-job.publisher";
import { EnrichmentJobPublisher } from "./application/ports/enrichment-job.publisher";
import { EnrichmentClient } from "./application/ports/enrichment.client";
import { ReceiveBatchItemUseCase } from "./application/receive-batch-item.use-case";
import { ReconcileStaleWorkUseCase } from "./application/reconcile-stale-work.use-case";
import { RequestBatchUseCase } from "./application/request-batch.use-case";
import { ResendBatchCallbackUseCase } from "./application/resend-batch-callback.use-case";
import { SendBatchCallbackUseCase } from "./application/send-batch-callback.use-case";
import { BatchPlatformHttpClient } from "./infra/http/batch-platform.http-client";
import { EnrichmentHttpClient } from "./infra/http/enrichment.http-client";
import { BullMqCallbackJobPublisher } from "./infra/queue/bullmq-callback-job.publisher";
import { BullMqEnrichmentJobPublisher } from "./infra/queue/bullmq-enrichment-job.publisher";
import { CallbackQueue } from "./infra/queue/callback.queue";
import { CallbackWorker } from "./infra/queue/callback.worker";
import { EnrichmentQueue } from "./infra/queue/enrichment.queue";
import { EnrichmentWorker } from "./infra/queue/enrichment.worker";
import { PrismaBatchItemInbox } from "./infra/repositories/prisma-batch-item.inbox";
import { StaleWorkReconciler } from "./infra/scheduling/stale-work.reconciler";
import { PrismaBatchItemStore } from "./infra/repositories/prisma-batch-item.store";
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
    {
      provide: EnrichmentJobPublisher,
      useClass: BullMqEnrichmentJobPublisher,
    },
    {
      provide: BatchItemStore,
      useClass: PrismaBatchItemStore,
    },
    {
      provide: EnrichmentClient,
      useClass: EnrichmentHttpClient,
    },
    {
      provide: CallbackJobPublisher,
      useClass: BullMqCallbackJobPublisher,
    },
    EnrichmentQueue,
    EnrichmentWorker,
    CallbackQueue,
    CallbackWorker,
    ReceiveBatchItemUseCase,
    RequestBatchUseCase,
    EnrichBatchItemUseCase,
    CloseBatchRunUseCase,
    SendBatchCallbackUseCase,
    ReconcileStaleWorkUseCase,
    ResendBatchCallbackUseCase,
    StaleWorkReconciler,
  ],
  exports: [EnrichmentQueue, CallbackQueue],
})
export class BatchProcessingModule {}
