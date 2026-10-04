import { Module } from "@nestjs/common";
import { RegistrationModule } from "./modules/registration/registration.module";
import { ConfigModule } from "./shared/config/config.module";
import { PrismaModule } from "./shared/infra/prisma/prisma.module";
import { RedisModule } from "./shared/infra/redis/redis.module";

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, RegistrationModule],
})
export class AppModule {}
