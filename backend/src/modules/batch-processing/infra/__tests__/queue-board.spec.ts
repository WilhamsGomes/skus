import express from 'express';
import request from 'supertest';
import { localOnly } from '../queue/queue-board';

describe('localOnly', () => {
  const app = express().use('/queues', localOnly, (_req, res) => {
    res.status(200).send('board');
  });

  it.each(['localhost:4000', '127.0.0.1:4000', '[::1]:4000'])('allows direct local access via %s', async (host) => {
    await request(app).get('/queues').set('host', host).expect(200, 'board');
  });

  it('hides the board when the request comes through the tunnel', async () => {
    await request(app)
      .get('/queues')
      .set('host', 'abc.ngrok-free.app')
      .set('x-forwarded-for', '203.0.113.7')
      .expect(404);
  });

  it('hides the board when a proxy keeps the local host header', async () => {
    await request(app)
      .get('/queues')
      .set('host', 'localhost:4000')
      .set('x-forwarded-for', '203.0.113.7')
      .expect(404);
  });
});
