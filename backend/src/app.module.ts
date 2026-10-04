import { Module } from "@nestjs/common";
import { RegistrationModule } from "./modules/registration/registration.module";
import { ConfigModule } from "./shared/config/config.module";
import { PrismaModule } from "./shared/infra/prisma/prisma.module";

@Module({
  imports: [ConfigModule, PrismaModule, RegistrationModule],
})
export class AppModule {}
