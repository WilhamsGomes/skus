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
import {
  CallbackRejectedError,
  RunNotFoundError,
} from "../../application/callback.errors";
import { RunCredentialsNotFoundError } from "../../application/enrichment.errors";
import { SendBatchCallbackUseCase } from "../../application/send-batch-callback.use-case";
import { CALLBACK_QUEUE, type CallbackJobData } from "./callback.queue";
import { createWorkerConnection } from "./queue-connections";

type CallbackJob = Pick<Job<CallbackJobData>, "id" | "data">;

@Injectable()
export class CallbackWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(CallbackWorker.name);
  private worker?: Worker<CallbackJobData>;
  private connection?: Redis;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly sendBatchCallback: SendBatchCallbackUseCase,
  ) {}

  onApplicationBootstrap(): void {
    this.connection = createWorkerConnection(this.config.redisUrl);
    this.worker = new Worker(CALLBACK_QUEUE, (job) => this.handle(job), {
      connection: this.connection,
      concurrency: 1,
    });

    this.worker.on("failed", (job, error) =>
      this.logger.warn(
        `Callback ${job?.data.runId} falhou (tentativa ${job?.attemptsMade}): ${error.message}`,
      ),
    );
    this.worker.on("error", (error) =>
      this.logger.warn(`Worker de callback sem Redis: ${describeConnectionError(error)}`),
    );
  }

  async handle(job: CallbackJob): Promise<void> {
    const { runId } = job.data;
    try {
      const { items, report } = await this.sendBatchCallback.execute(runId);
      this.logger.log(
        `Callback de ${runId} enviado (${items} itens). Relatório: ${JSON.stringify(report)}`,
      );
    } catch (error) {
      if (
        error instanceof CallbackRejectedError ||
        error instanceof RunNotFoundError ||
        error instanceof RunCredentialsNotFoundError
      ) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit();
  }
}
