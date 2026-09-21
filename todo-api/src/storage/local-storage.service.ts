import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { contentDisposition } from '../common/attachments.js';
import {
  StorageService,
  type DownloadRequest,
  type UploadRequest,
  type UploadTarget,
} from './storage.service.js';

export type LocalOperation = 'upload' | 'download';

export interface LocalUrlClaims {
  op: LocalOperation;
  object: string;
  exp: number;
  ct: string;
  max: number;
  name: string;
}

/**
 * Driver apenas para desenvolvimento: imita as signed URLs do GCS gravando em disco.
 * Em producao (STORAGE_DRIVER=gcs) este codigo nao e usado.
 */
export class LocalStorageService extends StorageService {
  readonly driver = 'local' as const;
  private readonly baseDir: string;

  constructor(
    baseDir: string,
    private readonly publicApiUrl: string,
    private readonly secret: string,
    private readonly ttlSeconds: number,
  ) {
    super();
    this.baseDir = resolve(baseDir);
  }

  async createUploadTarget(input: UploadRequest): Promise<UploadTarget> {
    const exp = Date.now() + this.ttlSeconds * 1000;
    const url = this.buildUrl({
      op: 'upload',
      object: input.objectName,
      exp,
      ct: input.contentType,
      max: input.maxBytes,
      name: '',
    });
    return {
      url,
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresAt: new Date(exp).toISOString(),
    };
  }

  async createDownloadUrl(input: DownloadRequest) {
    return this.buildUrl({
      op: 'download',
      object: input.objectName,
      exp: Date.now() + this.ttlSeconds * 1000,
      ct: input.contentType,
      max: 0,
      name: input.fileName,
    });
  }

  async stat(objectName: string) {
    try {
      const info = await stat(this.pathFor(objectName));
      return { sizeBytes: info.size };
    } catch {
      return null;
    }
  }

  async remove(objectName: string) {
    await rm(this.pathFor(objectName), { force: true });
  }

  pathFor(objectName: string) {
    const target = resolve(this.baseDir, objectName);
    if (!target.startsWith(this.baseDir + sep)) {
      throw new Error('Caminho de objeto invalido');
    }
    return target;
  }

  async prepareFile(objectName: string) {
    const path = this.pathFor(objectName);
    await mkdir(dirname(path), { recursive: true });
    return path;
  }

  verify(query: Record<string, string | undefined>, expected: LocalOperation): LocalUrlClaims | null {
    const claims: LocalUrlClaims = {
      op: expected,
      object: query.object ?? '',
      exp: Number(query.exp ?? 0),
      ct: query.ct ?? '',
      max: Number(query.max ?? 0),
      name: query.name ?? '',
    };
    const given = Buffer.from(query.sig ?? '');
    const wanted = Buffer.from(this.sign(claims));
    if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;
    if (claims.exp < Date.now()) return null;
    return claims;
  }

  dispositionFor(claims: LocalUrlClaims) {
    return contentDisposition(claims.name || 'arquivo', claims.ct);
  }

  private buildUrl(claims: LocalUrlClaims) {
    const params = new URLSearchParams({
      object: claims.object,
      exp: String(claims.exp),
      ct: claims.ct,
      max: String(claims.max),
      name: claims.name,
      sig: this.sign(claims),
    });
    return `${this.publicApiUrl}/api/local-storage/${claims.op}?${params.toString()}`;
  }

  private sign(claims: LocalUrlClaims) {
    const payload = [claims.op, claims.object, claims.exp, claims.ct, claims.max, claims.name].join('\n');
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
}
