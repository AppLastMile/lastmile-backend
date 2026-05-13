import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function getTypeOrmConfig(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  const databaseUrl = configService.get<string>('DATABASE_URL');

  return {
    type: 'postgres',
    ...(databaseUrl
      ? { url: databaseUrl }
      : {
          host: configService.getOrThrow<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.getOrThrow<string>('DB_USERNAME'),
          password: configService.getOrThrow<string>('DB_PASSWORD'),
          database: configService.getOrThrow<string>('DB_NAME'),
        }),
    ssl: databaseUrl ? { rejectUnauthorized: false } : false,
    extra: { family: 4 },
    autoLoadEntities: true,
    synchronize: !isProduction,
    ...(isProduction && {
      migrations: ['dist/migrations/*.js'],
      migrationsRun: true,
    }),
  };
}
