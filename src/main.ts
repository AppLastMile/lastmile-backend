import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const port = Number(process.env.PORT ?? 3000);

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3000, '0.0.0.0');

  // Show an easy-to-open local URL even when Nest binds to 0.0.0.0 or ::1.
  const appUrl = await app.getUrl();
  const localhostUrl = appUrl
    .replace('0.0.0.0', 'localhost')
    .replace('[::1]', 'localhost');

  logger.log(`Backend iniciado en: ${localhostUrl}`);
  logger.log(`Abre esta URL para verificar: ${localhostUrl}`);
}
bootstrap();
