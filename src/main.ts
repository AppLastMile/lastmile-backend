import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

const defaultCorsOrigins = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
  'https://chasmic-lavada-pneumatically.ngrok-free.dev',
];

const expoTunnelOriginPattern = /^https:\/\/[a-z0-9-]+-8081\.exp\.direct$/;

const corsOrigins =
  process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0) ?? defaultCorsOrigins;

const allowedCorsOrigins = new Set(corsOrigins);

const isAllowedCorsOrigin = (origin?: string): boolean => {
  // Allow server-to-server and tools like curl/Postman where Origin is absent.
  if (!origin) {
    return true;
  }

  return (
    allowedCorsOrigins.has(origin) || expoTunnelOriginPattern.test(origin)
  );
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const port = Number(process.env.PORT ?? 3000);

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'ngrok-skip-browser-warning',
    ],
    exposedHeaders: ['Authorization'],
    optionsSuccessStatus: 204,
  });
  // Support requests that are forwarded to unprefixed paths (e.g. ngrok -> /auth)
  // by adding CORS headers and rewriting the URL to include the global prefix
  // so Nest's controllers (which live under /api/v1) will be matched.
  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin as string | undefined;

    if (req.path && req.path.startsWith('/auth')) {
      // Add CORS headers for any request to /auth so the browser sees them.
      if (isAllowedCorsOrigin(origin)) {
        res.header('Access-Control-Allow-Origin', origin ?? '*');
        res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, ngrok-skip-browser-warning');
        res.header('Access-Control-Allow-Credentials', 'true');
      }

      // If the request is a preflight, respond immediately.
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }

      // Rewrite URL so Nest's global prefix routes are matched.
      // Example: /auth/login -> /api/v1/auth/login
      req.url = `/api/v1${req.url}`;
    }

    return next();
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
