import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ActivityModule } from './activity/activity.module.js';
import { AttachmentsModule } from './attachments/attachments.module.js';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv, type EnvironmentVariables } from './config/env.validation.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { PublicModule } from './public/public.module.js';
import { SharesModule } from './shares/shares.module.js';
import { StorageModule } from './storage/storage.module.js';
import { TasksModule } from './tasks/tasks.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        dbName: config.getOrThrow<string>('MONGODB_DB'),
        serverSelectionTimeoutMS: 8000,
      }),
    }),
    // Contadores em memoria: cada instancia do Cloud Run mantem o seu proprio limite.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }] }),
    PrismaModule,
    StorageModule,
    ActivityModule,
    AuthModule,
    ProjectsModule,
    TasksModule,
    AttachmentsModule,
    SharesModule,
    PublicModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
