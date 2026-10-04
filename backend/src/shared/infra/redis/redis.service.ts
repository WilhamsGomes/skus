import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { describeConnectionError } from '../../utils/describe-connection-error';
import { highlight } from '../../utils/highlight';

const CONNECT_TIMEOUT_MS = 3_000;

@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Redis');
  private readonly target: string;
  private lastError: Error | undefined;
  private wasReady = false;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super(config.redisUrl, { lazyConnect: true, connectTimeout: CONNECT_TIMEOUT_MS });
    this.target = new URL(config.redisUrl).host;

    this.on('error', (error: Error) => {
      this.lastError = error;
      if (this.wasReady) this.logger.warn(`Conexão com o Redis perdida (${describeConnectionError(error)}) em ${highlight(this.target)}`);
    });
    this.on('ready', () => {
      if (this.wasReady) this.logger.log(`Redis reconectado em ${highlight(this.target)}`);
      this.wasReady = true;
    });
  }

  /** Falha rápido, como o banco: a fila de enriquecimento depende do Redis. */
  async onModuleInit(): Promise<void> {
    this.logger.log(`Conectando ao Redis em ${highlight(this.target)}`);
    try {
      await this.connect();
      await this.ping();
    } catch (error) {
      this.disconnect();
      // connect() rejeita com um genérico "Connection is closed"; a causa real veio pelo evento 'error'.
      const cause = describeConnectionError(this.lastError ?? error);
      this.logger.error(`Redis inacessível (${cause}) em ${highlight(this.target)}`);
      throw new Error(`Redis inacessível em ${this.target}: ${cause}`, { cause: error });
    }
    this.logger.log(`Redis conectado em ${highlight(this.target)}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
    this.logger.log('Redis desconectado');
  }
}
