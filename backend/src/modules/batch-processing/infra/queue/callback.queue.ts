import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import type Redis from "ioredis";
import {
  APP_CONFIG,
  type AppConfig,
} from "../../../../shared/config/app-config";
import { describeConnectionError } from "../../../../shared/utils/describe-connection-error";
import { createProducerConnection } from "./queue-connections";

export const CALLBACK_QUEUE = "callback";

export interface CallbackJobData {
  runId: string;
}

const ONE_HOUR_S = 60 * 60;

@Injectable()
export class CallbackQueue
  extends Queue<CallbackJobData>
  implements OnModuleDestroy
{
  private readonly logger = new Logger(CallbackQueue.name);
  private readonly connection: Redis;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const connection = createProducerConnection(config.redisUrl);
    super(CALLBACK_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 6,
        backoff: { type: "exponential", delay: 1_000, jitter: 0.5 },
        removeOnComplete: { age: ONE_HOUR_S },
        removeOnFail: { age: 24 * ONE_HOUR_S },
      },
    });
    this.connection = connection;
    this.on("error", (error) =>
      this.logger.warn(
        `Fila de callback sem Redis: ${describeConnectionError(error)}`,
      ),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
    await this.connection.quit();
  }
}
