type EnvConfig = {
  PORT: number;
  DATABASE_URL?: string;
  DB_HOST?: string;
  DB_PORT: number;
  DB_USERNAME?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
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
  const databaseUrl =
    typeof config.DATABASE_URL === 'string' &&
    config.DATABASE_URL.trim().length > 0
      ? config.DATABASE_URL
      : undefined;

  // Allow either a full DATABASE_URL or the discrete DB_* variables.
  if (!databaseUrl) {
    getRequiredString(config, 'DB_HOST');
    getRequiredString(config, 'DB_USERNAME');
    getRequiredString(config, 'DB_PASSWORD');
    getRequiredString(config, 'DB_NAME');
  }

  return {
    PORT: getNumber(config, 'PORT', 3000),
    DATABASE_URL: databaseUrl,
    DB_HOST:
      typeof config.DB_HOST === 'string' ? config.DB_HOST : undefined,
    DB_PORT: getNumber(config, 'DB_PORT', 5432),
    DB_USERNAME:
      typeof config.DB_USERNAME === 'string' ? config.DB_USERNAME : undefined,
    DB_PASSWORD:
      typeof config.DB_PASSWORD === 'string' ? config.DB_PASSWORD : undefined,
    DB_NAME:
      typeof config.DB_NAME === 'string' ? config.DB_NAME : undefined,
  };
}
