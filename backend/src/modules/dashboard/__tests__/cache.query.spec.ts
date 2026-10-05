import { parseInfo } from '../queries/cache.query';

describe('parseInfo', () => {
  it('parses INFO sections into a flat map, ignoring headers and blank lines', () => {
    const info = [
      '# Server',
      'redis_version:7.4.1',
      'uptime_in_seconds:3600',
      '',
      '# Stats',
      'keyspace_hits:90',
      'keyspace_misses:10',
    ].join('\r\n');

    expect(parseInfo(info)).toEqual({
      redis_version: '7.4.1',
      uptime_in_seconds: '3600',
      keyspace_hits: '90',
      keyspace_misses: '10',
    });
  });
});
