import { loadAppConfig } from '../app-config';

describe('loadAppConfig', () => {
  const valid = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
    REDIS_URL: 'redis://localhost:6379',
    PLATFORM_BASE_URL: 'https://platform.test',
  };

  it('parses a valid environment and applies defaults', () => {
    expect(loadAppConfig(valid)).toEqual({
      port: 4000,
      databaseUrl: valid.DATABASE_URL,
      redisUrl: valid.REDIS_URL,
      platformBaseUrl: 'https://platform.test',
      dashboardUsername: 'admin',
      dashboardPassword: 'admin',
      authSecret: 'dev-only-secret-change-me',
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

  it('requires PLATFORM_BASE_URL', () => {
    const { PLATFORM_BASE_URL: _, ...withoutPlatform } = valid;

    expect(() => loadAppConfig(withoutPlatform)).toThrow(/PLATFORM_BASE_URL must be the platform Base URL/);
  });

  it('rejects a short AUTH_SECRET', () => {
    expect(() => loadAppConfig({ ...valid, AUTH_SECRET: 'short' })).toThrow(/AUTH_SECRET/);
  });

  it('reports every invalid variable at once', () => {
    expect(() => loadAppConfig({ PORT: 'abc' })).toThrow(/PORT[\s\S]*DATABASE_URL[\s\S]*REDIS_URL/);
  });
});
