import { describeConnectionError } from '../describe-connection-error';

describe('describeConnectionError', () => {
  it('explains a known code even when the message is empty (AggregateError on Windows)', () => {
    const error = Object.assign(new AggregateError([], ''), { code: 'ECONNREFUSED' });

    expect(describeConnectionError(error)).toBe('conexão recusada: o serviço está rodando? (npm run infra:up) [ECONNREFUSED]');
  });

  it('shows an unknown code as is', () => {
    expect(describeConnectionError(Object.assign(new Error('x'), { code: 'EWHATEVER' }))).toBe('EWHATEVER');
  });

  it('falls back to the message, then to the error type', () => {
    expect(describeConnectionError(new Error('  boom  '))).toBe('boom');
    expect(describeConnectionError(new TypeError(''))).toBe('TypeError');
  });
});
