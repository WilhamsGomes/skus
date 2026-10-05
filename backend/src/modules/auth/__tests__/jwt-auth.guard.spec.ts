import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Public } from '../../../shared/auth/public.decorator';
import { JwtAuthGuard } from '../presentation/guards/jwt-auth.guard';

@Controller()
class ProbeController {
  @Get('private')
  privateRoute() {
    return { ok: true };
  }

  @Public()
  @Get('public')
  publicRoute() {
    return { ok: true };
  }
}

describe('JwtAuthGuard', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret-with-16+chars' })],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(() => app.close());

  it('lets public routes through without a token', async () => {
    await request(app.getHttpServer()).get('/public').expect(200);
  });

  it('rejects private routes without a token', async () => {
    await request(app.getHttpServer()).get('/private').expect(401);
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await new JwtService({ secret: 'another-secret-16-chars' }).signAsync({ sub: 'admin' });

    await request(app.getHttpServer()).get('/private').set('authorization', `Bearer ${forged}`).expect(401);
  });

  it('accepts a valid bearer token', async () => {
    const token = await jwt.signAsync({ sub: 'admin' });

    await request(app.getHttpServer()).get('/private').set('authorization', `Bearer ${token}`).expect(200);
  });
});
