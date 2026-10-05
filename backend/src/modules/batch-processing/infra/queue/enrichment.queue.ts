import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import Redis from "ioredis";
import {
  APP_CONFIG,
  type AppConfig,
} from "../../../../shared/config/app-config";
import { describeConnectionError } from "../../../../shared/utils/describe-connection-error";

export const ENRICHMENT_QUEUE = "enrichment";

export interface EnrichmentJobData {
  runId: string;
  seq: number;
  sku: string;
}

export const ENRICH_MAX_IN_FLIGHT = 3;
export const ENRICH_ATTEMPTS = 10;
const ONE_HOUR_S = 60 * 60;

@Injectable()
export class EnrichmentQueue
  extends Queue<EnrichmentJobData>
  implements OnModuleDestroy
{
  private readonly logger = new Logger(EnrichmentQueue.name);
  private readonly connection: Redis;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const connection = new Redis(config.redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      commandTimeout: 300,
    });
    super(ENRICHMENT_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: ENRICH_ATTEMPTS,
        backoff: { type: "exponential", delay: 500, jitter: 0.5 },
        removeOnComplete: { age: ONE_HOUR_S },
        removeOnFail: { age: 24 * ONE_HOUR_S },
      },
    });
    this.connection = connection;
    this.on("error", (error) =>
      this.logger.warn(
        `Fila de enriquecimento sem Redis: ${describeConnectionError(error)}`,
      ),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
    await this.connection.quit();
  }
}
