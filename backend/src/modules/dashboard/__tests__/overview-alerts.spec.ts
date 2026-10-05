import { buildAlerts, type Overview } from '../queries/overview.query';

describe('buildAlerts', () => {
  const healthy: Omit<Overview, 'alerts'> = {
    generatedAt: new Date(),
    registration: { cid: 'cid', name: 'Fulano', webhook: 'https://abc.ngrok.app', registeredAt: new Date() },
    runs: { total: 1, open: 0, completed: 1, callbacksPending: 0 },
    items: { total: 20, pending: 0, enriched: 20, failed: 0, enrichCalls: 21, successRate: 1 },
    deliveries: { total: 1, bestScore: 100, averageScore: 100, lastSentAt: new Date() },
    lastReport: null,
    queues: {
      enrichment: { waiting: 0, active: 0, delayed: 0, completed: 20, failed: 0, prioritized: 0 },
      callback: { waiting: 0, active: 0, delayed: 0, completed: 1, failed: 0, prioritized: 0 },
    },
    timeline: [],
  };

  it('has no alerts when everything is healthy and there is no report yet', () => {
    expect(buildAlerts(healthy, 0, 0)).toEqual([]);
  });

  it('flags a missing registration as an error', () => {
    expect(buildAlerts({ ...healthy, registration: null }, 0, 0)[0]).toMatchObject({ level: 'error' });
  });

  it('warns about failed jobs, stale items, pending callbacks and old open runs', () => {
    const alerts = buildAlerts(
      {
        ...healthy,
        runs: { ...healthy.runs, callbacksPending: 1 },
        queues: { ...healthy.queues, enrichment: { ...healthy.queues.enrichment, failed: 2 } },
      },
      3,
      1,
    );

    expect(alerts.map((alert) => alert.title)).toEqual([
      '2 job(s) com falha na fila enrichment',
      '3 item(ns) parado(s) em RECEIVED',
      '1 lote(s) concluído(s) sem callback',
      '1 lote(s) aberto(s) há mais de 5 min',
    ]);
  });
});
