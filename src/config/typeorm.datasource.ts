import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

const databaseUrl = process.env.DATABASE_URL;
const dbPort = Number(process.env.DB_PORT ?? 5432);

const baseConfig = {
  type: 'postgres' as const,
  entities: ['src/modules/**/entities/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  migrationsTransactionMode: 'each' as const,
  extra: {
    family: 4,
  },
};

const options: DataSourceOptions =
  databaseUrl && databaseUrl.trim().length > 0
    ? {
        ...baseConfig,
        url: databaseUrl,
      }
    : {
        ...baseConfig,
        host: process.env.DB_HOST,
        port: dbPort,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      };

export default new DataSource(options);
