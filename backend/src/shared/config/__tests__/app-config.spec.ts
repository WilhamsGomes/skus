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
    });
  });

  it('coerces PORT to a number', () => {
    expect(loadAppConfig({ ...valid, PORT: '8080' }).port).toBe(8080);
  });

  it('reports every invalid variable at once', () => {
    expect(() => loadAppConfig({ PORT: 'abc' })).toThrow(/PORT[\s\S]*DATABASE_URL[\s\S]*REDIS_URL/);
  });
});
