import { Module } from "@nestjs/common";
import { GetCurrentRegistrationUseCase } from "./application/get-current-registration.use-case";
import { PlatformRegistrationGateway } from "./application/ports/platform-registration.gateway";
import { RegistrationRepository } from "./application/ports/registration.repository";
import { RegisterWebhookUseCase } from "./application/register-webhook.use-case";
import { PlatformRegistrationHttpGateway } from "./infra/http/platform-registration.http-gateway";
import { PrismaRegistrationRepository } from "./infra/repositories/prisma-registration.repository";
import { CheckController } from "./presentation/controllers/check.controller";
import { RegistrationController } from "./presentation/controllers/registration.controller";

@Module({
  controllers: [CheckController, RegistrationController],
  providers: [
    {
      provide: PlatformRegistrationGateway,
      useClass: PlatformRegistrationHttpGateway,
    },
    {
      provide: RegistrationRepository,
      useClass: PrismaRegistrationRepository,
    },
    RegisterWebhookUseCase,
    GetCurrentRegistrationUseCase,
  ],
  exports: [RegistrationRepository],
})
export class RegistrationModule {}
