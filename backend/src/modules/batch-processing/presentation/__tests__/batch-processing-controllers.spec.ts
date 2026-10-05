import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureHttp } from '../../../../shared/infra/http/http.config';
import {
  PlatformUnavailableError,
  RegistrationNotFoundError,
} from '../../../registration/application/registration.errors';
import { ReceiveBatchItemUseCase } from '../../application/receive-batch-item.use-case';
import { RequestBatchUseCase } from '../../application/request-batch.use-case';
import { BatchController } from '../controllers/batch.controller';
import { ProcessController } from '../controllers/process.controller';

describe('Batch processing controllers', () => {
  const receiveBatchItem = { execute: jest.fn() };
  const requestBatch = { execute: jest.fn() };
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProcessController, BatchController],
      providers: [
        { provide: ReceiveBatchItemUseCase, useValue: receiveBatchItem },
        { provide: RequestBatchUseCase, useValue: requestBatch },
      ],
    }).compile();
    app = configureHttp(moduleRef.createNestApplication());
    await app.init();
  });

  afterEach(() => jest.resetAllMocks());
  afterAll(() => app.close());

  describe('POST /process', () => {
    const body = { run_id: 'clx-run', seq: 7, sku: 'sku-001' };

    it('acks with 200 and maps the contract fields to the use case', async () => {
      receiveBatchItem.execute.mockResolvedValue({ duplicate: false });

      await request(app.getHttpServer()).post('/process').send(body).expect(200, { ok: true });

      expect(receiveBatchItem.execute).toHaveBeenCalledWith({ runId: 'clx-run', seq: 7, sku: 'sku-001' });
    });

    it('also acks duplicates with 200', async () => {
      receiveBatchItem.execute.mockResolvedValue({ duplicate: true });

      await request(app.getHttpServer()).post('/process').send(body).expect(200, { ok: true });
    });

    it.each([
      ['missing run_id', { seq: 7, sku: 'sku-001' }],
      ['negative seq', { ...body, seq: -1 }],
      ['seq as string', { ...body, seq: '7' }],
      ['empty sku', { ...body, sku: '' }],
    ])('rejects %s with 400', async (_, invalid) => {
      await request(app.getHttpServer()).post('/process').send(invalid).expect(400);
      expect(receiveBatchItem.execute).not.toHaveBeenCalled();
    });

    it('does not ack when the item could not be stored', async () => {
      receiveBatchItem.execute.mockRejectedValue(new Error('connection refused'));

      await request(app.getHttpServer()).post('/process').send(body).expect(500);
    });
  });

  describe('POST /batches', () => {
    it('returns the burst ticket', async () => {
      requestBatch.execute.mockResolvedValue({
        runId: 'clx-run',
        total: 20,
        startedAt: new Date('2026-10-05T12:00:00Z'),
      });

      await request(app.getHttpServer())
        .post('/batches')
        .expect(201, { runId: 'clx-run', total: 20, startedAt: '2026-10-05T12:00:00.000Z' });
    });

    it('maps RegistrationNotFoundError to 409', async () => {
      requestBatch.execute.mockRejectedValue(new RegistrationNotFoundError());

      await request(app.getHttpServer()).post('/batches').expect(409);
    });

    it('maps platform failures to 502', async () => {
      requestBatch.execute.mockRejectedValue(new PlatformUnavailableError('POST /burst responded 401'));

      await request(app.getHttpServer()).post('/batches').expect(502);
    });
  });
});
