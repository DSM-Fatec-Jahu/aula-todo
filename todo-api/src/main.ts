import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  configureApp(app);

  // A documentacao interativa fica desligada em producao.
  if (config.getOrThrow<string>('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Todo API').setVersion('1.0').addBearerAuth().build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API pronta na porta ${port}`);
}

await bootstrap();
