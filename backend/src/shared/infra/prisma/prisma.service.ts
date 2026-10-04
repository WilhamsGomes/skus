import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { describeConnectionError } from '../../utils/describe-connection-error';
import { highlight } from '../../utils/highlight';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Database');
  private readonly target: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
    this.target = describeTarget(config.databaseUrl);
  }

  /** Falha rápido: sem banco a aplicação não sobe. O `SELECT 1` garante que a conexão é real, não só configurada. */
  async onModuleInit(): Promise<void> {
    this.logger.log(`Conectando ao PostgreSQL em ${highlight(this.target)}`);
    try {
      await this.$connect();
      await this.$queryRaw`SELECT 1`;
    } catch (error) {
      const cause = describeConnectionError(error);
      this.logger.error(`PostgreSQL inacessível (${cause}) em ${highlight(this.target)}`);
      throw new Error(`PostgreSQL inacessível em ${this.target}: ${cause}`, { cause: error });
    }
    this.logger.log(`PostgreSQL conectado em ${highlight(this.target)}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('PostgreSQL desconectado');
  }
}

/** host:porta/banco, sem credenciais. */
function describeTarget(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  return `${url.host}${url.pathname}`;
}

