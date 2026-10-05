import { Module } from "@nestjs/common";
import { BatchProcessingModule } from "./modules/batch-processing/batch-processing.module";
import { RegistrationModule } from "./modules/registration/registration.module";
import { ConfigModule } from "./shared/config/config.module";
import { PrismaModule } from "./shared/infra/prisma/prisma.module";
import { RedisModule } from "./shared/infra/redis/redis.module";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    RegistrationModule,
    BatchProcessingModule,
  ],
})
export class AppModule {}
