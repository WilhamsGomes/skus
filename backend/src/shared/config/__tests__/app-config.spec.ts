import { loadAppConfig } from '../app-config';

describe('loadAppConfig', () => {
  const valid = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
    REDIS_URL: 'redis://localhost:6379',
  };

  it('parses a valid environment and applies defaults', () => {
    expect(loadAppConfig(valid)).toEqual({
      port: 4000,
      databaseUrl: valid.DATABASE_URL,
      redisUrl: valid.REDIS_URL,
      platformBaseUrl: 'https://dev-wdu-ped-test-1014944555984.us-central1.run.app',
    });
  });

  it('coerces PORT to a number', () => {
    expect(loadAppConfig({ ...valid, PORT: '8080' }).port).toBe(8080);
  });

  it('strips the trailing slash from PLATFORM_BASE_URL', () => {
    expect(loadAppConfig({ ...valid, PLATFORM_BASE_URL: 'http://localhost:9000/' }).platformBaseUrl).toBe(
      'http://localhost:9000',
    );
  });

  it('reports every invalid variable at once', () => {
    expect(() => loadAppConfig({ PORT: 'abc' })).toThrow(/PORT[\s\S]*DATABASE_URL[\s\S]*REDIS_URL/);
  });
});
