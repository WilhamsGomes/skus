import { Module } from '@nestjs/common';
import { ConfigModule } from './shared/config/config.module';
import { PrismaModule } from './shared/infra/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { BatchProcessingModule } from './modules/batch-processing/batch-processing.module';
import { RegistrationModule } from './modules/registration/registration.module';

/** Composition root: reúne configuração, infraestrutura compartilhada e módulos. */
@Module({
  imports: [ConfigModule, PrismaModule, HealthModule, RegistrationModule, BatchProcessingModule],
})
export class AppModule {}
