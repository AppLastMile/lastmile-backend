type EnvConfig = {
  PORT: number;
  DATABASE_URL?: string;
  DB_HOST?: string;
  DB_PORT: number;
  DB_USERNAME?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
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

  const dbHost =
    typeof config.DB_HOST === 'string' && config.DB_HOST.trim().length > 0
      ? config.DB_HOST
      : undefined;

  const dbUsername =
    typeof config.DB_USERNAME === 'string' &&
    config.DB_USERNAME.trim().length > 0
      ? config.DB_USERNAME
      : undefined;

  const dbPassword =
    typeof config.DB_PASSWORD === 'string' &&
    config.DB_PASSWORD.trim().length > 0
      ? config.DB_PASSWORD
      : undefined;

  const dbName =
    typeof config.DB_NAME === 'string' && config.DB_NAME.trim().length > 0
      ? config.DB_NAME
      : undefined;

  const googleClientId =
    typeof config.GOOGLE_CLIENT_ID === 'string' &&
    config.GOOGLE_CLIENT_ID.trim().length > 0
      ? config.GOOGLE_CLIENT_ID
      : undefined;

  // Allow either a full DATABASE_URL or the discrete DB_* variables.
  if (!databaseUrl) {
    return {
      PORT: getNumber(config, 'PORT', 3000),
      DATABASE_URL: databaseUrl,
      DB_HOST: getRequiredString(config, 'DB_HOST'),
      DB_PORT: getNumber(config, 'DB_PORT', 5432),
      DB_USERNAME: getRequiredString(config, 'DB_USERNAME'),
      DB_PASSWORD: getRequiredString(config, 'DB_PASSWORD'),
      DB_NAME: getRequiredString(config, 'DB_NAME'),
      JWT_SECRET: getRequiredString(config, 'JWT_SECRET'),
      GOOGLE_CLIENT_ID: googleClientId,
    };
  }

  return {
    PORT: getNumber(config, 'PORT', 3000),
    DATABASE_URL: databaseUrl,
    DB_HOST: dbHost,
    DB_PORT: getNumber(config, 'DB_PORT', 5432),
    DB_USERNAME: dbUsername,
    DB_PASSWORD: dbPassword,
    DB_NAME: dbName,
    JWT_SECRET: getRequiredString(config, 'JWT_SECRET'),
    GOOGLE_CLIENT_ID: googleClientId,
  };
}
