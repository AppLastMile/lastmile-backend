import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

const defaultCorsOrigins = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
];

const corsOrigins =
  process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0) ?? defaultCorsOrigins;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const port = Number(process.env.PORT ?? 3000);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'ngrok-skip-browser-warning',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('LastMile API')
    .setDescription(
      'API for LastMile platform - Real-time auctions and logistics',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(port);

  // Show an easy-to-open local URL even when Nest binds to 0.0.0.0 or ::1.
  const appUrl = await app.getUrl();
  const localhostUrl = appUrl
    .replace('0.0.0.0', 'localhost')
    .replace('[::1]', 'localhost');
  const swaggerUrl = `${localhostUrl}/api`;

  logger.log(`Backend iniciado en: ${localhostUrl}`);
  logger.log(`Abre esta URL para verificar: ${localhostUrl}`);
  logger.log(`Swagger disponible en: ${swaggerUrl}`);
}
bootstrap();
