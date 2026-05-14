import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const baseWithUrl = {
    PORT: '3000',
    DATABASE_URL: 'postgresql://user:pass@host/db',
    JWT_SECRET: 'secret',
    DB_PORT: '5432',
  };

  const baseWithVars = {
    PORT: '3000',
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_USERNAME: 'postgres',
    DB_PASSWORD: 'postgres',
    DB_NAME: 'lastmile',
    JWT_SECRET: 'secret',
  };

  it('accepts DATABASE_URL and returns correct config', () => {
    const result = validateEnv(baseWithUrl);
    expect(result.DATABASE_URL).toBe('postgresql://user:pass@host/db');
    expect(result.PORT).toBe(3000);
    expect(result.JWT_SECRET).toBe('secret');
  });

  it('accepts discrete DB variables when DATABASE_URL is absent', () => {
    const result = validateEnv(baseWithVars);
    expect(result.DB_HOST).toBe('localhost');
    expect(result.DB_USERNAME).toBe('postgres');
    expect(result.DB_NAME).toBe('lastmile');
  });

  it('uses default PORT 3000 when PORT is missing', () => {
    const { PORT: _p, ...rest } = baseWithUrl;
    const result = validateEnv(rest);
    expect(result.PORT).toBe(3000);
  });

  it('uses default DB_PORT 5432 when DB_PORT is missing', () => {
    const { DB_PORT: _dp, ...rest } = baseWithUrl;
    const result = validateEnv(rest);
    expect(result.DB_PORT).toBe(5432);
  });

  it('throws when JWT_SECRET is missing with DATABASE_URL', () => {
    const { JWT_SECRET: _j, ...rest } = baseWithUrl;
    expect(() => validateEnv(rest)).toThrow(
      'Missing required environment variable: JWT_SECRET',
    );
  });

  it('throws when JWT_SECRET is missing without DATABASE_URL', () => {
    const { JWT_SECRET: _j, ...rest } = baseWithVars;
    expect(() => validateEnv(rest)).toThrow(
      'Missing required environment variable: JWT_SECRET',
    );
  });

  it('throws when DB_HOST is missing and no DATABASE_URL', () => {
    const {
      DB_HOST: _h,
      DATABASE_URL: _u,
      ...rest
    } = { ...baseWithVars, DATABASE_URL: undefined };
    expect(() => validateEnv(rest)).toThrow(
      'Missing required environment variable: DB_HOST',
    );
  });

  it('throws when PORT is not a number', () => {
    expect(() => validateEnv({ ...baseWithUrl, PORT: 'notanumber' })).toThrow(
      'must be a valid number',
    );
  });

  it('treats empty DATABASE_URL as absent', () => {
    const config = { ...baseWithVars, DATABASE_URL: '   ' };
    const result = validateEnv(config);
    expect(result.DATABASE_URL).toBeUndefined();
    expect(result.DB_HOST).toBe('localhost');
  });

  it('treats whitespace-only JWT_SECRET as missing', () => {
    expect(() => validateEnv({ ...baseWithUrl, JWT_SECRET: '  ' })).toThrow(
      'Missing required environment variable: JWT_SECRET',
    );
  });

  it('includes optional DB fields when DATABASE_URL is set', () => {
    const config = {
      ...baseWithUrl,
      DB_HOST: 'myhost',
      DB_USERNAME: 'user',
      DB_PASSWORD: 'pw',
      DB_NAME: 'db',
    };
    const result = validateEnv(config);
    expect(result.DB_HOST).toBe('myhost');
    expect(result.DB_USERNAME).toBe('user');
  });
});
