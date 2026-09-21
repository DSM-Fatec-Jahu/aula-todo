import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageService } from './local-storage.service.js';

describe('LocalStorageService', () => {
  let dir: string;
  let storage: LocalStorageService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'todo-storage-'));
    storage = new LocalStorageService(dir, 'http://localhost:3000', 'segredo-de-teste-com-32-caracteres!!', 60);
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  const queryOf = (url: string) => Object.fromEntries(new URL(url).searchParams);

  it('aceita a URL assinada e rejeita quando qualquer campo e adulterado', async () => {
    const target = await storage.createUploadTarget({
      objectName: 'a/b.txt',
      contentType: 'text/plain',
      maxBytes: 100,
    });
    const query = queryOf(target.url);
    expect(storage.verify(query, 'upload')).not.toBeNull();
    expect(storage.verify({ ...query, object: 'a/outro.txt' }, 'upload')).toBeNull();
    expect(storage.verify({ ...query, max: '999999' }, 'upload')).toBeNull();
    expect(storage.verify(query, 'download')).toBeNull();
  });

  it('rejeita URL expirada', async () => {
    const short = new LocalStorageService(dir, 'http://localhost:3000', 'segredo-de-teste-com-32-caracteres!!', -1);
    const target = await short.createUploadTarget({ objectName: 'x.txt', contentType: 'text/plain', maxBytes: 1 });
    expect(short.verify(queryOf(target.url), 'upload')).toBeNull();
  });

  it('bloqueia path traversal', () => {
    expect(() => storage.pathFor('../fora.txt')).toThrow();
  });
});
