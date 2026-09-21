export interface UploadTarget {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

export interface UploadRequest {
  objectName: string;
  contentType: string;
  maxBytes: number;
}

export interface DownloadRequest {
  objectName: string;
  fileName: string;
  contentType: string;
}

export abstract class StorageService {
  abstract readonly driver: 'gcs' | 'local';
  abstract createUploadTarget(input: UploadRequest): Promise<UploadTarget>;
  abstract createDownloadUrl(input: DownloadRequest): Promise<string>;
  abstract stat(objectName: string): Promise<{ sizeBytes: number } | null>;
  abstract remove(objectName: string): Promise<void>;
}
