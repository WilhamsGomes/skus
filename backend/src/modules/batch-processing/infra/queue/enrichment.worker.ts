import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { type Job, UnrecoverableError, Worker } from "bullmq";
import type Redis from "ioredis";
import {
  APP_CONFIG,
  type AppConfig,
} from "../../../../shared/config/app-config";
import { describeConnectionError } from "../../../../shared/utils/describe-connection-error";
import { CloseBatchRunUseCase } from "../../application/close-batch-run.use-case";
import { EnrichBatchItemUseCase } from "../../application/enrich-batch-item.use-case";
import {
  EnrichmentRateLimitedError,
  EnrichmentUnauthorizedError,
  RunCredentialsNotFoundError,
} from "../../application/enrichment.errors";
import {
  ENRICH_MAX_IN_FLIGHT,
  ENRICHMENT_QUEUE,
  EnrichmentQueue,
  type EnrichmentJobData,
} from "./enrichment.queue";
import { createWorkerConnection } from "./queue-connections";

type EnrichmentJob = Pick<Job<EnrichmentJobData>, "id" | "data" | "attemptsMade">;

@Injectable()
export class EnrichmentWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(EnrichmentWorker.name);
  private worker?: Worker<EnrichmentJobData>;
  private connection?: Redis;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly queue: EnrichmentQueue,
    private readonly enrichBatchItem: EnrichBatchItemUseCase,
    private readonly closeBatchRun: CloseBatchRunUseCase,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.setGlobalConcurrency(ENRICH_MAX_IN_FLIGHT);

    this.connection = createWorkerConnection(this.config.redisUrl);
    this.worker = new Worker(ENRICHMENT_QUEUE, (job) => this.handle(job), {
      connection: this.connection,
      concurrency: ENRICH_MAX_IN_FLIGHT,
    });

    this.worker.on("failed", (job, error) =>
      this.logger.warn(
        `Job ${job?.id} falhou (tentativa ${job?.attemptsMade}): ${error.message}`,
      ),
    );
    this.worker.on("error", (error) =>
      this.logger.warn(`Worker sem Redis: ${describeConnectionError(error)}`),
    );
    this.logger.log(
      `Worker de enriquecimento ativo (máx. ${ENRICH_MAX_IN_FLIGHT} em voo)`,
    );
  }

  async handle(job: EnrichmentJob): Promise<void> {
    try {
      const outcome = await this.enrichBatchItem.execute(job.data);
      this.logger.log(`Job ${job.id}: ${outcome}`);
      await this.closeBatchRun.execute(job.data.runId);
    } catch (error) {
      if (error instanceof EnrichmentRateLimitedError) {
        this.logger.warn(`429 no /enrich: fila pausada por ${error.retryAfterMs}ms`);
        await this.pauseFor(error.retryAfterMs);
        throw Worker.RateLimitError();
      }
      if (
        error instanceof EnrichmentUnauthorizedError ||
        error instanceof RunCredentialsNotFoundError
      ) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }

  protected async pauseFor(ms: number): Promise<void> {
    await this.worker?.rateLimit(ms);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit();
  }
}
