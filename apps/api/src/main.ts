import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { log, requestIdMiddleware } from './platform/request-context.js';
import { ErrorFilter } from './platform/error.filter.js';
import { mountMediaFiles } from './files/media-static.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv(); // ARC-072: fail fast before anything starts.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn'], bodyParser: false });
  app.use(requestIdMiddleware);
  mountMediaFiles(app); // MED-016, MED-022: public media space, read-only, outside /api/v1.
  app.use(json({ limit: '1mb' })); // API-060
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ErrorFilter());
  app.disable('x-powered-by');
  app.set('trust proxy', false); // SEC-028: the forwarded address is handled by ClientIp.
  app.enableShutdownHooks();
  await app.listen(env.PORT);
  log('info', 'api.started', { port: env.PORT, env: env.APP_ENV, role: env.APP_ROLE });
}

void bootstrap();
