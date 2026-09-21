import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

// Requer Postgres e Mongo no ar: `docker compose up -d postgres mongo` e `npx prisma migrate deploy`.
describe('Todo API (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<typeof request>;

  const email = `aluno-${Date.now()}@example.com`;
  const password = 'senha-forte-123';
  let token = '';
  let projectId = '';
  let taskId = '';
  let shareToken = '';

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde ao health check dos dois bancos', async () => {
    const live = await http.get('/api/health').expect(200);
    expect(live.headers['cache-control']).toBe('no-store');
    const ready = await http.get('/api/health/ready').expect(200);
    expect(ready.body).toMatchObject({ postgres: 'up', mongo: 'up' });
  });

  it('cadastra, rejeita e-mail duplicado e faz login', async () => {
    const created = await http
      .post('/api/auth/register')
      .send({ name: 'Aluno Teste', email, password })
      .expect(201);
    expect(created.body.accessToken).toBeTruthy();

    await http.post('/api/auth/register').send({ name: 'Outro', email, password }).expect(409);
    await http.post('/api/auth/login').send({ email, password: 'errada-123' }).expect(401);

    const login = await http.post('/api/auth/login').send({ email, password }).expect(200);
    token = login.body.accessToken;
    await http.get('/api/auth/me').set(auth()).expect(200);
  });

  it('exige autenticacao nas rotas privadas', async () => {
    await http.get('/api/projects').expect(401);
  });

  it('cria projeto e tarefa', async () => {
    const project = await http
      .post('/api/projects')
      .set(auth())
      .send({ name: 'Aula de Cloud', description: 'Projeto de teste' })
      .expect(201);
    projectId = project.body.id;

    const task = await http
      .post(`/api/projects/${projectId}/tasks`)
      .set(auth())
      .send({ title: 'Publicar a API no Cloud Run' })
      .expect(201);
    taskId = task.body.id;
    expect(task.body.status).toBe('TODO');
  });

  it('envia um arquivo pelo fluxo de signed URL', async () => {
    const base = `/api/projects/${projectId}/tasks/${taskId}/attachments`;
    const content = Buffer.from('conteudo do anexo de teste');

    const slot = await http
      .post(base)
      .set(auth())
      .send({ fileName: 'notas.txt', contentType: 'text/plain', sizeBytes: content.length })
      .expect(201);
    const { url, headers } = slot.body.upload;

    // Antes do PUT, confirmar deve falhar
    await http.post(`${base}/${slot.body.attachmentId}/confirm`).set(auth()).expect(409);

    const path = new URL(url).pathname + new URL(url).search;
    await http.put(path).set(headers).send(content).expect(200);

    const confirmed = await http.post(`${base}/${slot.body.attachmentId}/confirm`).set(auth()).expect(200);
    expect(confirmed.body).toMatchObject({ fileName: 'notas.txt', sizeBytes: content.length });

    const download = await http.get(new URL(confirmed.body.downloadUrl).pathname + new URL(confirmed.body.downloadUrl).search);
    expect(download.status).toBe(200);
    expect(download.text).toBe('conteudo do anexo de teste');
  });

  it('rejeita tipo de arquivo nao permitido e arquivo grande demais', async () => {
    const base = `/api/projects/${projectId}/tasks/${taskId}/attachments`;
    await http
      .post(base)
      .set(auth())
      .send({ fileName: 'virus.exe', contentType: 'application/x-msdownload', sizeBytes: 10 })
      .expect(400);
    await http
      .post(base)
      .set(auth())
      .send({ fileName: 'enorme.pdf', contentType: 'application/pdf', sizeBytes: 999_999_999 })
      .expect(400);
  });

  it('compartilha o projeto por link anonimo (somente leitura)', async () => {
    const share = await http
      .post(`/api/projects/${projectId}/shares`)
      .set(auth())
      .send({ permission: 'READ', label: 'Turma A', expiresInDays: 7 })
      .expect(201);
    shareToken = share.body.token;
    expect(shareToken).toHaveLength(43);

    const view = await http.get(`/api/public/shares/${shareToken}`).expect(200);
    expect(view.body.permission).toBe('READ');
    expect(view.body.tasks[0].attachments).toHaveLength(1);
    expect(JSON.stringify(view.body)).not.toContain(email);

    await http
      .patch(`/api/public/shares/${shareToken}/tasks/${taskId}`)
      .send({ status: 'DONE' })
      .expect(403);
    await http.get(`/api/public/shares/${'a'.repeat(43)}`).expect(404);
  });

  it('link com permissao EDIT altera tarefas e a revogacao bloqueia o acesso', async () => {
    const share = await http
      .post(`/api/projects/${projectId}/shares`)
      .set(auth())
      .send({ permission: 'EDIT', label: 'Monitor' })
      .expect(201);
    const editToken = share.body.token;

    await http
      .patch(`/api/public/shares/${editToken}/tasks/${taskId}`)
      .send({ status: 'DOING' })
      .expect(200);

    await http.delete(`/api/projects/${projectId}/shares/${share.body.id}`).set(auth()).expect(204);
    await http.get(`/api/public/shares/${editToken}`).expect(404);
  });

  it('nao expoe projetos de outro usuario', async () => {
    const other = await http
      .post('/api/auth/register')
      .send({ name: 'Intruso', email: `intruso-${Date.now()}@example.com`, password })
      .expect(201);
    await http
      .get(`/api/projects/${projectId}`)
      .set({ Authorization: `Bearer ${other.body.accessToken}` })
      .expect(404);
  });

  it('registra o historico no MongoDB', async () => {
    const history = await http.get(`/api/projects/${projectId}/activity`).set(auth()).expect(200);
    const actions = history.body.map((item: { action: string }) => item.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'project.created',
        'task.created',
        'attachment.added',
        'share.created',
        'share.revoked',
        'task.updated',
      ]),
    );
    const anonymous = history.body.find((item: { actorType: string }) => item.actorType === 'anonymous');
    expect(anonymous.actorLabel).toBe('Monitor');
  });

  it('remove o projeto', async () => {
    await http.delete(`/api/projects/${projectId}`).set(auth()).expect(204);
    await http.get(`/api/projects/${projectId}`).set(auth()).expect(404);
  });
});
