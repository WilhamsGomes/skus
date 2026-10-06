import { Test } from '@nestjs/testing';
import { ConfigModule } from '../../../shared/config/config.module';
import { PrismaModule } from '../../../shared/infra/prisma/prisma.module';
import { PlatformRegistrationGateway } from '../application/ports/platform-registration.gateway';
import { RegistrationRepository } from '../application/ports/registration.repository';
import { RegisterWebhookUseCase } from '../application/register-webhook.use-case';
import { PlatformRegistrationHttpGateway } from '../infra/http/platform-registration.http-gateway';
import { PrismaRegistrationRepository } from '../infra/repositories/prisma-registration.repository';
import { RegistrationModule } from '../registration.module';

/** Garante que a injeção resolve com os providers reais. `compile()` não conecta no banco (sem `init()`). */
describe('RegistrationModule wiring', () => {
  beforeAll(() => {
    process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/db';
    process.env.REDIS_URL ??= 'redis://localhost:6379';
    process.env.PLATFORM_BASE_URL ??= 'https://platform.test';
  });

  it('binds each port to its adapter and builds the use case', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule, RegistrationModule],
    }).compile();

    expect(moduleRef.get(PlatformRegistrationGateway)).toBeInstanceOf(PlatformRegistrationHttpGateway);
    expect(moduleRef.get(RegistrationRepository)).toBeInstanceOf(PrismaRegistrationRepository);
    expect(moduleRef.get(RegisterWebhookUseCase)).toBeInstanceOf(RegisterWebhookUseCase);
  });
});
