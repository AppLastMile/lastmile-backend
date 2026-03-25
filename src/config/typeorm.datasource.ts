import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

// IMPORTAR ENTIDADES EXPLÍCITAMENTE (CLAVE)
import { Campaign } from '../modules/campaigns/entities/campaign.entity';
import { PickupPoint } from '../modules/pickup-points/entities/pickup-point.entity';

const databaseUrl = process.env.DATABASE_URL;
const dbPort = Number(process.env.DB_PORT ?? 5433);

const baseConfig: DataSourceOptions = {
  type: 'postgres',

  entities: [Campaign, PickupPoint],

  migrations: ['src/migrations/*.ts'],
  migrationsTransactionMode: 'each',

  synchronize: true,

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
        host: process.env.DB_HOST ?? 'localhost',
        port: dbPort,
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        database: process.env.DB_NAME ?? 'lastmile',
      };

export default new DataSource(options);
