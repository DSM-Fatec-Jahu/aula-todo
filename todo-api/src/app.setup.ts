import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { EnvironmentVariables } from './config/env.validation.js';

export function configureApp(app: NestExpressApplication) {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Atras do Cloud Run (e do Firebase Hosting) o IP real do cliente vem em X-Forwarded-For.
  app.set('trust proxy', config.getOrThrow<number>('TRUST_PROXY_HOPS'));

  // As imagens sao carregadas por outra origem (front), entao a politica de recursos precisa ser cross-origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // O CDN do Firebase Hosting guarda respostas 404 por 10 min, salvo se a resposta trouxer Cache-Control.
  // Como a API e privada e dinamica, nada dela deve ser cacheado.
  app.use((_req: unknown, res: { setHeader(name: string, value: string): void }, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
}
