import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { GcsStorageService } from './gcs-storage.service.js';
import { LocalStorageController } from './local-storage.controller.js';
import { LocalStorageService } from './local-storage.service.js';
import { StorageService } from './storage.service.js';

@Global()
@Module({
  controllers: [LocalStorageController],
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => {
        const ttl = config.getOrThrow<number>('SIGNED_URL_TTL_SECONDS');
        if (config.getOrThrow('STORAGE_DRIVER') === 'gcs') {
          return new GcsStorageService(config.getOrThrow<string>('GCS_BUCKET'), ttl);
        }
        const port = config.getOrThrow<number>('PORT');
        return new LocalStorageService(
          config.getOrThrow<string>('LOCAL_STORAGE_DIR'),
          config.get<string>('PUBLIC_API_URL') ?? `http://localhost:${port}`,
          config.getOrThrow<string>('JWT_SECRET'),
          ttl,
        );
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
