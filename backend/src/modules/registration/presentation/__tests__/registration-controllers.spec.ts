import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureHttp } from '../../../../shared/infra/http/http.config';
import { GetCurrentRegistrationUseCase } from '../../application/get-current-registration.use-case';
import { RegisterWebhookUseCase } from '../../application/register-webhook.use-case';
import {
  HandshakeFailedError,
  PlatformUnavailableError,
  RegistrationNotFoundError,
} from '../../application/registration.errors';
import type { RegistrationOutput } from '../../application/registration.output';
import { CheckController } from '../controllers/check.controller';
import { RegistrationController } from '../controllers/registration.controller';

describe('Registration controllers', () => {
  const registration: RegistrationOutput = {
    cid: 'clx-cid',
    name: 'Fulano',
    webhook: 'https://abc.ngrok.app',
    registeredAt: new Date('2026-10-03T12:00:00Z'),
  };
  const registerWebhook = { execute: jest.fn() };
  const getCurrentRegistration = { execute: jest.fn() };
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CheckController, RegistrationController],
      providers: [
        { provide: RegisterWebhookUseCase, useValue: registerWebhook },
        { provide: GetCurrentRegistrationUseCase, useValue: getCurrentRegistration },
      ],
    }).compile();
    app = configureHttp(moduleRef.createNestApplication());
    await app.init();
  });

  afterEach(() => jest.resetAllMocks());
  afterAll(() => app.close());

  describe('POST /check', () => {
    it('echoes the token with 200', async () => {
      await request(app.getHttpServer())
        .post('/check')
        .send({ token: 'a3f9', extra: 'ignored' })
        .expect(200, { token: 'a3f9' });
    });

    it('rejects a body without token', async () => {
      await request(app.getHttpServer()).post('/check').send({}).expect(400);
    });
  });

  describe('POST /registration', () => {
    const body = { name: 'Fulano', webhook: 'https://abc.ngrok.app' };

    it('returns the use case output as the response body', async () => {
      registerWebhook.execute.mockResolvedValue(registration);

      const res = await request(app.getHttpServer()).post('/registration').send(body).expect(201);

      expect(registerWebhook.execute).toHaveBeenCalledWith(body);
      expect(res.body).toEqual({
        cid: 'clx-cid',
        name: 'Fulano',
        webhook: 'https://abc.ngrok.app',
        registeredAt: '2026-10-03T12:00:00.000Z',
      });
    });

    it('requires an https webhook', async () => {
      await request(app.getHttpServer())
        .post('/registration')
        .send({ ...body, webhook: 'http://abc.ngrok.app' })
        .expect(400);
      expect(registerWebhook.execute).not.toHaveBeenCalled();
    });

    it('maps a failed handshake to 422 handshake_failed', async () => {
      registerWebhook.execute.mockRejectedValue(new HandshakeFailedError('token mismatch'));

      await request(app.getHttpServer())
        .post('/registration')
        .send(body)
        .expect(422, { error: 'handshake_failed', reason: 'token mismatch' });
    });

    it('maps platform failures to 502', async () => {
      registerWebhook.execute.mockRejectedValue(new PlatformUnavailableError('POST /register responded 503'));

      await request(app.getHttpServer()).post('/registration').send(body).expect(502);
    });
  });

  describe('GET /registration', () => {
    it('returns the current registration', async () => {
      getCurrentRegistration.execute.mockResolvedValue(registration);

      const res = await request(app.getHttpServer()).get('/registration').expect(200);

      expect(res.body.cid).toBe('clx-cid');
    });

    it('maps RegistrationNotFoundError to 404', async () => {
      getCurrentRegistration.execute.mockRejectedValue(new RegistrationNotFoundError());

      await request(app.getHttpServer()).get('/registration').expect(404);
    });
  });
});
