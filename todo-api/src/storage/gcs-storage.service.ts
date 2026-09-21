import { Logger } from '@nestjs/common';
import { Bucket, Storage } from '@google-cloud/storage';
import { contentDisposition } from '../common/attachments.js';
import {
  StorageService,
  type DownloadRequest,
  type UploadRequest,
  type UploadTarget,
} from './storage.service.js';

export class GcsStorageService extends StorageService {
  readonly driver = 'gcs' as const;
  private readonly logger = new Logger(GcsStorageService.name);
  private readonly bucket: Bucket;

  constructor(
    bucketName: string,
    private readonly ttlSeconds: number,
  ) {
    super();
    // Sem chave JSON: usa as Application Default Credentials (a service account do Cloud Run).
    this.bucket = new Storage().bucket(bucketName);
  }

  async createUploadTarget(input: UploadRequest): Promise<UploadTarget> {
    const expires = Date.now() + this.ttlSeconds * 1000;
    const sizeRange = `0,${input.maxBytes}`;
    const [url] = await this.bucket.file(input.objectName).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires,
      contentType: input.contentType,
      extensionHeaders: { 'x-goog-content-length-range': sizeRange },
    });
    return {
      url,
      method: 'PUT',
      headers: {
        'Content-Type': input.contentType,
        'x-goog-content-length-range': sizeRange,
      },
      expiresAt: new Date(expires).toISOString(),
    };
  }

  async createDownloadUrl(input: DownloadRequest): Promise<string> {
    const [url] = await this.bucket.file(input.objectName).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + this.ttlSeconds * 1000,
      responseDisposition: contentDisposition(input.fileName, input.contentType),
    });
    return url;
  }

  async stat(objectName: string) {
    const file = this.bucket.file(objectName);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [metadata] = await file.getMetadata();
    return { sizeBytes: Number(metadata.size ?? 0) };
  }

  async remove(objectName: string) {
    try {
      await this.bucket.file(objectName).delete({ ignoreNotFound: true });
    } catch (error) {
      this.logger.warn(`Falha ao remover ${objectName}: ${String(error)}`);
    }
  }
}
