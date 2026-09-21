# todo-api

API do app de tarefas usado na atividade de computação em nuvem (GCP). O foco da atividade é a hospedagem; o app é só o veículo: o que importa é onde e como ele roda.

**Stack:** NestJS 12 · Prisma 7.10 + PostgreSQL 18 · Mongoose 9 + MongoDB 8 · Cloud Storage (signed URLs) · Node 24

## O que a API faz

| Área | Rotas (prefixo `/api`) | Banco / serviço |
|---|---|---|
| Autenticação (JWT) | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | PostgreSQL |
| Projetos | `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id` | PostgreSQL |
| Tarefas | `POST /projects/:id/tasks`, `PATCH/DELETE .../tasks/:taskId` | PostgreSQL |
| Anexos (imagens e arquivos) | `POST .../attachments` → PUT na signed URL → `POST .../attachments/:id/confirm` | PostgreSQL + Cloud Storage |
| Compartilhamento anônimo | `POST/GET/DELETE /projects/:id/shares` (dono) e `GET/POST/PATCH /public/shares/:token/...` (visitante) | PostgreSQL |
| Histórico de atividades | `GET /projects/:id/activity` | MongoDB (TTL de 90 dias) |
| Saúde | `GET /health` (liveness) e `GET /health/ready` (checa os dois bancos) | PostgreSQL + MongoDB |

Documentação interativa (Swagger) em `/api/docs`, **somente fora de produção**.

## Como rodar localmente

```bash
docker compose up -d postgres mongo      # Postgres em :5433 e Mongo em :27018 (portas alternativas de propósito)
cp .env.example .env
npm ci
npx prisma migrate deploy                # cria as tabelas
npm run start:dev                        # http://localhost:3000/api/health/ready
```

Testes:

```bash
npm test                                 # unitários (não precisam de banco)
npm run test:e2e                         # fluxo completo; precisa dos bancos acima e da migration aplicada
```

Testar a imagem de produção (migration + API em containers):

```bash
docker compose --profile app up --build  # API em http://localhost:3000
docker compose --profile app down
```

## Arquivos de infraestrutura

| Arquivo | Para quê |
|---|---|
| `Dockerfile` | Dois alvos: `runtime` (API) e `migrate` (Job de migrations) |
| `cloudbuild.yaml` | Constrói e publica as duas imagens no Artifact Registry |
| `docker-compose.yml` | Postgres + Mongo locais (e a API em container, no perfil `app`) |
| `infra/gcs-cors.json` | CORS do bucket, necessário para o upload direto pelo navegador |
| `.env.example` | Lista de variáveis de ambiente |

O passo a passo de publicação no GCP está em [`../README.md`](../README.md).
