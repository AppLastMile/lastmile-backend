type EnvConfig = {
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  JWT_SECRET: string;
};

function getRequiredString(
  config: Record<string, unknown>,
  key: string,
): string {
  const value = config[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function getNumber(
  config: Record<string, unknown>,
  key: string,
  fallback?: number,
): number {
  const raw = config[key];
  if (
    (raw === undefined || raw === null || raw === '') &&
    fallback !== undefined
  ) {
    return fallback;
  }

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }

  return parsed;
}

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  return {
    PORT: getNumber(config, 'PORT', 3000),
    DB_HOST: getRequiredString(config, 'DB_HOST'),
    DB_PORT: getNumber(config, 'DB_PORT', 5432),
    DB_USERNAME: getRequiredString(config, 'DB_USERNAME'),
    DB_PASSWORD: getRequiredString(config, 'DB_PASSWORD'),
    DB_NAME: getRequiredString(config, 'DB_NAME'),
    JWT_SECRET: getRequiredString(config, 'JWT_SECRET'),
  };
}
