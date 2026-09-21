# 1. Arquivos de configuração e teste local

Antes de tocar na nuvem, deixamos os dois projetos **prontos para serem empacotados** e provamos que funcionam na máquina. Se algo falhar aqui, falhará no GCP com mensagens bem piores.

[← Voltar ao README](../README.md) · [Próximo: projeto no GCP →](02-projeto-gcp-e-ferramentas.md)

## Visão geral

```text
aula/
├── README.md                  índice do roteiro (aponta para todo-aula/)
├── todo-api/                  NestJS 12 + Prisma 7 + Mongoose 9
│   ├── Dockerfile             ← 1.4  imagem da API e imagem das migrations
│   ├── .dockerignore          ← 1.5  o que NÃO entra na imagem
│   ├── .gcloudignore          ← 1.5  o que NÃO sobe para o Cloud Build
│   ├── cloudbuild.yaml        ← 1.6  build das duas imagens na nuvem
│   ├── docker-compose.yml     ← 1.7  Postgres e Mongo locais
│   ├── .env.example           ← 1.2  variáveis de ambiente
│   ├── prisma.config.ts       ← 1.3  configuração do Prisma
│   └── infra/gcs-cors.json    ← 1.8  CORS do bucket
├── todo-web/                  React 19 + Vite 8
│   ├── vite.config.ts         ← 1.9  proxy /api em desenvolvimento
│   ├── firebase.json          ← 1.10 hosting + rewrite para o Cloud Run
│   └── .env.example           ← 1.11 URL da API (opcional)
└── todo-aula/                 este material
```

## Pré-requisitos locais

| Ferramenta | Versão usada | Como conferir |
|---|---|---|
| Node.js | 24 (LTS) | `node -v` |
| npm | 11 | `npm -v` |
| Docker | 29 | `docker -v` |
| Git | qualquer recente | `git --version` |

> **Atenção às portas.** O `docker-compose.yml` publica o Postgres em **5433** e o Mongo em **27018** de propósito: muitas máquinas já têm um Postgres/Mongo local nas portas padrão (5432/27017) e o app acabaria conversando com o banco errado.

---

## 1.1 `todo-api/package.json` — scripts e versões

**O que é:** o manifesto de um projeto Node.js. Ele registra o nome do projeto, os **scripts** que rodamos com `npm run <nome>` e as **dependências** que o `npm ci` instala (com as versões exatas travadas no `package-lock.json`). É o primeiro arquivo que o Dockerfile copia (1.4).

O projeto foi criado com o Nest CLI mais recente (`npx @nestjs/cli@latest new todo-api`) e recebeu as dependências abaixo.

**Campos de identificação e ambiente**

| Campo | Valor | Significado |
|---|---|---|
| `name`, `version`, `description` | `todo-api`, `0.0.1`, texto livre | Identificam o projeto. Não são publicados em lugar nenhum |
| `author`, `license` | vazio, `UNLICENSED` | Sem autor e sem licença de uso: é material didático, não uma biblioteca |
| `private` | `true` | Impede um `npm publish` acidental |
| `type` | `module` | Os arquivos `.js` são tratados como **ESM** (`import`/`export`). Por isso o `package.json` também vai para a imagem final: o Node o consulta para saber o formato |
| `engines.node` | `>=24` | Versão mínima do Node. É a mesma da imagem `node:24-slim` |

**Scripts que importam para a hospedagem**

| Script | O que faz | Onde é usado |
|---|---|---|
| `build` | `prisma generate && nest build` — gera o cliente do Prisma e compila para `dist/` | Dockerfile, estágio `build` |
| `start:dev` | `prisma generate && nest start --watch` — o cliente do Prisma é **gerado** (não vem no repositório), então o script o gera antes de subir | Local |
| `start:prod` / `node dist/main.js` | Sobe a API compilada | `CMD` da imagem |
| `prisma:migrate:deploy` | Aplica as migrations já existentes (nunca cria) | Cloud Run Job |
| `test` / `test:e2e` | Testes unitários / ponta a ponta (o `pretest:e2e` gera o cliente do Prisma) | Local |

**Demais scripts** (uso local, no dia a dia de desenvolvimento)

| Script | O que faz |
|---|---|
| `start` | `nest start`: compila e sobe uma vez, sem observar mudanças |
| `start:debug` | `nest start --debug --watch`: como o `start:dev`, com o *inspector* do Node aberto para depurar |
| `format` | Formata `src/` e `test/` com o Prettier (regras em `.prettierrc`) |
| `lint` | Analisa `src/` e `test/` com o Oxlint, incluindo regras que usam os tipos do TypeScript (`--type-aware`; regras em `.oxlintrc.json`) |
| `test:watch` | Vitest em modo interativo: reexecuta os testes ao salvar |
| `test:cov` | Testes com relatório de cobertura (`coverage/`) |
| `test:debug` | Vitest com o *inspector* aberto, um arquivo de teste por vez |
| `prisma:generate` | Só gera o cliente do Prisma |
| `prisma:migrate:dev` | **Cria** uma nova migration a partir de mudanças no `schema.prisma` e a aplica no banco local. Nunca roda na nuvem |

**Dependências principais**

| Pacote | Versão | Observação |
|---|---|---|
| `@nestjs/*` | 12.0.x | ESM (`"type": "module"`), testes com Vitest |
| `prisma` e `@prisma/client` | **7.10.0** | Linha estável. O CLI `latest` do npm é a RC `8.0.0-rc.15`, por isso fixamos a 7.10.0 |
| `@prisma/adapter-pg` + `pg` | 7.10.0 / 8.23 | Prisma 7 fala com o Postgres por um *driver adapter* |
| `mongoose` + `@nestjs/mongoose` | 9.10 / 12.0 | Mongo continua sendo Mongo |
| `@google-cloud/storage` | 8.2.0 | Gera as signed URLs |

**Demais dependências** (`dependencies` vão para a imagem da API; `devDependencies` só existem na etapa de build e nos testes)

| Pacote | Grupo | Para que serve |
|---|---|---|
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` | dependencies | Núcleo do Nest e o adaptador HTTP (Express) |
| `@nestjs/config` | dependencies | Lê as variáveis de ambiente e as valida (1.2) |
| `@nestjs/jwt` | dependencies | Cria e verifica os tokens de login (JWT) |
| `@nestjs/throttler` | dependencies | Limita as requisições por IP (120 por minuto) |
| `@nestjs/swagger` | dependencies | Documentação interativa da API em `/api/docs` (desligada quando `NODE_ENV=production`) |
| `bcryptjs` | dependencies | Gera e confere o *hash* das senhas |
| `class-validator`, `class-transformer` | dependencies | Validam e convertem os dados recebidos (corpo das requisições e variáveis de ambiente) |
| `helmet` | dependencies | Acrescenta cabeçalhos HTTP de segurança |
| `dotenv` | dependencies | Carrega o `.env` no desenvolvimento (usado no `prisma.config.ts`, 1.3) |
| `reflect-metadata`, `rxjs` | dependencies | Bibliotecas exigidas pelo Nest (decorators e fluxos assíncronos) |
| `@nestjs/cli`, `@nestjs/schematics` | devDependencies | Comando `nest` (compilar, gerar código) |
| `typescript` | devDependencies | Compilador |
| `prisma` | devDependencies | CLI: `generate` e `migrate` |
| `vitest`, `@vitest/coverage-v8`, `supertest`, `@nestjs/testing` | devDependencies | Executor de testes, cobertura e ferramentas para testar a API |
| `oxlint`, `oxlint-tsgolint`, `prettier` | devDependencies | Análise estática e formatação |
| `@types/*`, `source-map-support` | devDependencies | Tipos do TypeScript e mapas de erro legíveis |

> **Por que dois clientes de banco?** Um `schema.prisma` aceita um único `datasource`. O suporte a MongoDB no Prisma 7 não é estável, então o Postgres usa Prisma e o Mongo usa Mongoose. Na prática é o que muitos times fazem quando misturam bancos.

O `prisma` fica em `devDependencies` (só é preciso para gerar o cliente e rodar migrations). A imagem da API **não** o inclui; a imagem de migrations sim (veja 1.4).

## 1.2 `todo-api/.env.example` — variáveis de ambiente

Crie o arquivo e copie para `.env` (que **não** é versionado):

```bash
# Copie para .env (nao versionado) e ajuste. Em producao estes valores vem do
# Cloud Run (variaveis) e do Secret Manager (segredos) - nunca de um arquivo.

NODE_ENV=development
PORT=3000

# --- Postgres (Prisma) --- em producao: IP privado do Cloud SQL
DATABASE_URL=postgresql://todo:todo@localhost:5433/todo
DB_POOL_MAX=5

# --- MongoDB (Mongoose) --- em producao: string mongodb+srv:// do Atlas
MONGODB_URI=mongodb://localhost:27018
MONGODB_DB=todo

# --- Autenticacao --- gere com: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_SECRET=troque-por-um-segredo-aleatorio-com-pelo-menos-32-caracteres
JWT_EXPIRES_IN=1d

# --- HTTP ---
CORS_ORIGINS=http://localhost:5173
TRUST_PROXY_HOPS=1

# --- Arquivos ---
# local = grava em disco (so desenvolvimento) | gcs = Cloud Storage com signed URLs
STORAGE_DRIVER=local
LOCAL_STORAGE_DIR=./.storage
PUBLIC_API_URL=http://localhost:3000
# GCS_BUCKET=nome-do-bucket
SIGNED_URL_TTL_SECONDS=600
MAX_UPLOAD_BYTES=10485760
```

**O que é:** um **modelo** das variáveis de ambiente que a API lê. Ele é versionado para mostrar quais variáveis existem; o `.env` real (com os seus valores) **nunca** vai para o Git. No arquivo, linhas iniciadas por `#` são comentários e cada variável é escrita como `NOME=valor`, sem espaços em volta do `=`.

**Para que serve cada variável** (a coluna "Regra" vem da validação em `src/config/env.validation.ts`)

| Variável | Para que serve | Regra (padrão) |
|---|---|---|
| `NODE_ENV` | Modo de execução. Em `production` a documentação interativa (`/api/docs`) fica desligada | `development`, `production` ou `test` (`development`) |
| `PORT` | Porta HTTP em que a API escuta | Inteiro de 1 a 65535 (`3000`) |
| `DATABASE_URL` | Endereço do PostgreSQL no formato `postgresql://usuario:senha@host:porta/banco`. Lida pela API e pelo `prisma.config.ts` | Obrigatória |
| `DB_POOL_MAX` | Máximo de conexões abertas ao Postgres por instância da API (o *pool*). No Cloud Run, o total é instâncias × este valor | 1 a 50 (`5`) |
| `MONGODB_URI` | Endereço do MongoDB: `mongodb://…` no compose, `mongodb+srv://…` no Atlas | Obrigatória |
| `MONGODB_DB` | Nome do banco dentro do Mongo (assim a URI não precisa carregar o nome) | Texto não vazio (`todo`) |
| `JWT_SECRET` | Chave que **assina** os tokens de login. Quem a conhece consegue forjar um login. No modo `local`, também assina as URLs de upload e download | Mínimo de 32 caracteres, obrigatória |
| `JWT_EXPIRES_IN` | Validade do token de login (`15m`, `1d`, `7d`...). Depois disso o usuário precisa entrar de novo | Texto não vazio (`1d`) |
| `CORS_ORIGINS` | Sites autorizados a chamar a API pelo navegador, separados por vírgula | Texto (`http://localhost:5173`) |
| `TRUST_PROXY_HOPS` | Quantos *proxies* confiáveis existem entre o cliente e a API. A API usa isso para descobrir o **IP real** do cliente (cabeçalho `X-Forwarded-For`), base do limite de requisições por IP. Pouco demais: todos parecem vir do mesmo IP. Demais: o cliente consegue forjar o IP | 0 a 5 (`1`) |
| `STORAGE_DRIVER` | Onde os anexos são guardados: `local` (disco, só desenvolvimento) ou `gcs` (Cloud Storage com signed URLs) | `local` ou `gcs` (`local`) |
| `GCS_BUCKET` | Nome do bucket que recebe os anexos | Obrigatória **somente** se `STORAGE_DRIVER=gcs` |
| `LOCAL_STORAGE_DIR` | Pasta onde o driver `local` grava os arquivos (`.storage` fica fora do Git e da imagem) | Texto (`./.storage`) |
| `PUBLIC_API_URL` | Endereço pelo qual o **navegador** alcança a API. Só o driver `local` usa, para montar as URLs de upload e download. Sem ela, vale `http://localhost:<PORT>` | Opcional |
| `SIGNED_URL_TTL_SECONDS` | Validade, em segundos, das URLs assinadas de upload e download. Uma URL vazada expira sozinha | 60 a 3600 (`600`, ou seja, 10 min) |
| `MAX_UPLOAD_BYTES` | Tamanho máximo de um anexo, em bytes. A API recusa arquivos maiores e, no GCS, o próprio bucket também recusa (cabeçalho `x-goog-content-length-range`) | Inteiro ≥ 1024 (`10485760`, ou seja, 10 MiB) |

**Como cada variável muda entre os ambientes**

| Variável | Local | Produção (GCP) | De onde vem em produção |
|---|---|---|---|
| `NODE_ENV` | `development` | `production` | Variável do Cloud Run |
| `PORT` | `3000` | `8080` | Injetada pelo Cloud Run |
| `DATABASE_URL` | Postgres do compose | `postgresql://…@IP_PRIVADO:5432/todo` | **Secret Manager** |
| `DB_POOL_MAX` | `5` | `3` | Variável do Cloud Run |
| `MONGODB_URI` | Mongo do compose | `mongodb+srv://…` (Atlas) | **Secret Manager** |
| `MONGODB_DB` | `todo` | `todo` | Variável do Cloud Run |
| `JWT_SECRET` | qualquer com 32+ caracteres | valor aleatório de 64 caracteres | **Secret Manager** |
| `JWT_EXPIRES_IN` | `1d` | `1d` (o padrão) | Não definida: vale o padrão |
| `CORS_ORIGINS` | `http://localhost:5173` | URLs do Firebase Hosting | Variável do Cloud Run |
| `TRUST_PROXY_HOPS` | `1` | `1` | Variável do Cloud Run |
| `STORAGE_DRIVER` | `local` | `gcs` | Variável do Cloud Run |
| `GCS_BUCKET` | — | nome do bucket | Variável do Cloud Run |
| `LOCAL_STORAGE_DIR` | `./.storage` | — (não usada com `gcs`) | — |
| `PUBLIC_API_URL` | `http://localhost:3000` | — (não usada com `gcs`) | — |
| `SIGNED_URL_TTL_SECONDS` | `600` | `600` (o padrão) | Não definida: vale o padrão |
| `MAX_UPLOAD_BYTES` | `10485760` | `10485760` (o padrão) | Não definida: vale o padrão |

O comando do comentário do `JWT_SECRET` (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`) sorteia 48 bytes aleatórios e os escreve em base64: resulta em 64 caracteres.

A API **valida** essas variáveis na inicialização (`src/config/env.validation.ts`): se `JWT_SECRET` for curto ou `GCS_BUCKET` faltar com `STORAGE_DRIVER=gcs`, ela nem sobe. Falhar cedo é melhor do que falhar em produção.

## 1.3 `todo-api/prisma.config.ts`

**O que é:** o arquivo de configuração do **Prisma CLI** (`prisma generate`, `prisma migrate deploy`...). Ele diz ao CLI onde estão o esquema do banco e as migrations e **qual banco usar**. A API em execução não o lê: quem lê é a linha de comando, no build (`prisma generate`) e no Job de migrations. Por isso o Dockerfile o copia para a imagem `migrate` (1.4).

O Prisma 7 não lê a URL do banco no `schema.prisma`; ela fica neste arquivo:

```ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
```

| Item | Significado |
|---|---|
| `import 'dotenv/config'` | Carrega o arquivo `.env` para `process.env` **antes** de o resto rodar. Só serve para o desenvolvimento local; em produção a variável já vem do ambiente do Cloud Run e não existe `.env` |
| `defineConfig` | Função do Prisma que só devolve o objeto que recebe, mas faz o editor completar e checar os campos |
| `export default` | O Prisma CLI procura este arquivo na raiz do projeto e usa o que ele exporta |
| `schema` | Caminho do `schema.prisma`: modelos (tabelas) e o gerador do cliente |
| `migrations.path` | Pasta das migrations: SQL versionado (`20260920045132_init/migration.sql`) e o `migration_lock.toml`, que registra o banco usado (`postgresql`) e deve ir para o Git |
| `datasource.url` | Endereço do banco, lido de `DATABASE_URL`. É por ele que o `migrate deploy` sabe **onde** aplicar as migrations |

## 1.4 `todo-api/Dockerfile` — duas imagens em um arquivo

**O que é:** a receita que o Docker segue para montar uma **imagem**: um pacote com o sistema de arquivos e o comando de partida da aplicação. O Cloud Run não executa o seu código diretamente; ele executa containers criados a partir dessa imagem.

Um **build em vários estágios** compila com todas as ferramentas, mas a imagem final leva só o necessário. Criamos **dois alvos**: `runtime` (a API) e `migrate` (o Job que aplica as migrations).

```dockerfile
# syntax=docker/dockerfile:1
# Build em varios estagios. Dois alvos finais:
#   migrate -> imagem do Job que aplica as migrations (leva o Prisma CLI)
#   runtime -> imagem da API (enxuta; e o alvo padrao, o ultimo do arquivo)
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app

# 1) Todas as dependencias (inclui as de desenvolvimento, necessarias para compilar)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 2) Compila: gera o Prisma Client e transpila o TypeScript para dist/
FROM deps AS build
COPY . .
RUN npm run build

# 3) Somente dependencias de producao
FROM base AS prod-deps
COPY package.json package-lock.json ./
# --omit=peer/optional evitam instalar o Prisma CLI (peer opcional do @prisma/client) na imagem da API
RUN npm ci --omit=dev --omit=peer --omit=optional && npm cache clean --force

# 4) Alvo "migrate": roda "prisma migrate deploy" (executado como Cloud Run Job)
FROM base AS migrate
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# 5) Alvo "runtime": a API
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# O Cloud Run injeta PORT (padrao 8080). A aplicacao le essa variavel.
ENV PORT=8080
EXPOSE 8080

# Nao roda como root
USER node
CMD ["node", "dist/main.js"]
```

| Estágio | Base | Para quê | Vai para a imagem final? |
|---|---|---|---|
| `base` | `node:24-slim` | Ponto de partida comum (Node 24 LTS, Debian enxuto) | Sim |
| `deps` | `base` | `npm ci` com tudo (compilador, Prisma CLI, Nest CLI) | Só no alvo `migrate` |
| `build` | `deps` | Gera o Prisma Client e compila para `dist/` | Só a pasta `dist/` |
| `prod-deps` | `base` | `npm ci` sem `devDependencies`, sem peers e sem opcionais | Sim, na API |
| `migrate` | `base` | Prisma CLI + `prisma/` + `prisma.config.ts` | **Alvo 1** |
| `runtime` | `base` | `dist/` + dependências de produção | **Alvo 2 (padrão)** |

**As instruções, uma a uma**

| Instrução | Significado | Onde aparece |
|---|---|---|
| `# syntax=docker/dockerfile:1` | Comentário especial que escolhe a versão da linguagem do Dockerfile (a mais recente da linha 1) | 1ª linha |
| `ARG NODE_VERSION=24` | Variável **só do build**, com valor padrão. Fica antes do primeiro `FROM` para poder ser usada nele; pode ser trocada com `--build-arg` | Topo |
| `FROM imagem AS nome` | Começa um estágio novo a partir de uma imagem (ou de outro estágio). O `AS` dá nome ao estágio, para o `--target` e o `COPY --from` o encontrarem | Cada estágio |
| `WORKDIR /app` | Define (e cria) a pasta de trabalho; os comandos seguintes rodam nela | `base` |
| `COPY origem destino` | Copia arquivos do contexto de build (a pasta `todo-api`, menos o que o `.dockerignore` exclui) para a imagem | Vários |
| `COPY --from=estágio` | Copia de **outro estágio**, não do contexto. É assim que só `dist/` e `node_modules` de produção chegam à imagem final | `migrate`, `runtime` |
| `RUN comando` | Executa um comando durante o **build** e guarda o resultado como uma camada da imagem | `deps`, `build`, `prod-deps` |
| `npm ci` | Instala **exatamente** o que está no `package-lock.json` (e falha se ele divergir do `package.json`). É o comando certo para builds reproduzíveis; `npm install` pode alterar versões | `deps`, `prod-deps` |
| `--omit=dev --omit=peer --omit=optional` | Não instala `devDependencies`, dependências *peer* nem opcionais. É o que mantém o Prisma CLI fora da API | `prod-deps` |
| `npm cache clean --force` | Apaga o cache do npm na mesma camada, para o lixo da instalação não ficar na imagem | `prod-deps` |
| `ENV NOME=valor` | Variável de ambiente que existe **em tempo de execução** do container | `NODE_ENV`, `PORT` |
| `EXPOSE 8080` | Apenas **documenta** a porta em que a aplicação escuta. Não a publica; quem publica é o `ports` do compose (1.7) ou a configuração do Cloud Run | `runtime` |
| `USER node` | A partir daqui o processo roda como o usuário `node` (já existe na imagem oficial), sem privilégios de administrador | `migrate`, `runtime` |
| `CMD [...]` | Comando executado quando o container **inicia**. A forma em lista (sem shell) faz o sinal de encerramento chegar direto ao Node | `migrate`, `runtime` |

Um detalhe do `runtime`: ele copia o `package.json` apenas para o Node saber que o projeto é ESM (`"type": "module"`, 1.1). Já o `migrate` traz o `prisma.config.ts` e a pasta `prisma/` porque é isso que o `prisma migrate deploy` lê.

Decisões que vale a pena você entender:

- **Cache de camadas:** `COPY package*.json` + `npm ci` vêm **antes** de `COPY . .`. Enquanto o `package-lock.json` não mudar, o Docker reaproveita as dependências.
- **Tamanho:** sem `--omit=peer --omit=optional`, o `prisma` entrava na API como *peer opcional* do `@prisma/client` e a imagem passava de 945 MB. Com as flags, a API ficou com **572 MB** (medido no Docker local).
- **Usuário sem privilégios:** `USER node` — se alguém invadir o processo, não é root.
- **`PORT`:** o Cloud Run injeta `PORT=8080`; a aplicação lê a variável, então funciona igual no compose (mapeado para 3000) e na nuvem.
- **Migration separada:** rodar `migrate deploy` ao subir a API faria *cada instância* tentar migrar o banco ao mesmo tempo. Um **Job** roda uma vez, antes do deploy.

Construa e teste cada alvo:

```bash
cd todo-api
docker build --target runtime -t todo-api:runtime .
docker build --target migrate -t todo-api-migrate:local .
docker images | grep todo-api
```

| Parte do comando | Significado |
|---|---|
| `docker build` | Executa o Dockerfile e cria a imagem |
| `--target runtime` / `--target migrate` | Para no estágio indicado e o usa como imagem final |
| `-t todo-api:runtime` | Dá à imagem o nome `todo-api` e a *tag* `runtime` |
| `.` | O **contexto de build**: a pasta atual, filtrada pelo `.dockerignore` (1.5) |
| `docker images \| grep todo-api` | Lista as imagens locais e filtra as nossas, para conferir o tamanho |

## 1.5 `.dockerignore` e `.gcloudignore`

Existem **duas etapas de filtro**, uma para cada momento em que arquivos são copiados:

| Arquivo | Quando age | O que controla |
|---|---|---|
| `.gcloudignore` | No `gcloud builds submit`, ao **enviar** a pasta para o Cloud Build | O que sobe pela rede |
| `.dockerignore` | No `docker build` (local e dentro do Cloud Build), ao montar o **contexto** | O que o `COPY` consegue enxergar |

Ambos usam padrões estilo `.gitignore`: um nome por linha, `*` como curinga, `#` para comentário e `!` para abrir uma **exceção** ao que foi excluído antes.

### `.dockerignore`

Mantém fora do contexto de build o que não deve entrar na imagem (e acelera o build):

```text
node_modules
dist
.git
.gitignore
.env
.env.*
!.env.example
.storage
coverage
test
infra
docker-compose.yml
Dockerfile
cloudbuild.yaml
.dockerignore
.gcloudignore
README.md
*.log
*.tsbuildinfo
```

| Linha | O que exclui | Por quê |
|---|---|---|
| `node_modules` | Dependências instaladas na sua máquina | A imagem instala as suas com `npm ci`. As da sua máquina podem ser de outro sistema (Windows, macOS) e são centenas de MB |
| `dist` | Código já compilado localmente | A imagem compila do zero no estágio `build` |
| `.git`, `.gitignore` | Histórico e regras do Git | Não fazem parte da aplicação (o histórico pode ser enorme) |
| `.env`, `.env.*` | Arquivos de variáveis de ambiente | **Contêm segredos**. Em produção as variáveis vêm do Cloud Run e do Secret Manager |
| `!.env.example` | (exceção) mantém o `.env.example` | É só o modelo, sem segredos. A regra `!` reabre esse arquivo dentro do padrão `.env.*` |
| `.storage` | Anexos gravados pelo driver `local` | Dados de teste da sua máquina |
| `coverage` | Relatórios de cobertura de testes | Gerados sob demanda |
| `test` | Testes ponta a ponta | Não rodam na imagem final |
| `infra` | `gcs-cors.json` (1.8) | É aplicado com `gcloud`, não pela aplicação |
| `docker-compose.yml`, `Dockerfile`, `cloudbuild.yaml`, `.dockerignore`, `.gcloudignore` | Arquivos que descrevem o build | A imagem não precisa deles. E assim mudar um deles não invalida o cache do `COPY . .` |
| `README.md` | Documentação | Não é usada em execução |
| `*.log` | Arquivos de log | Lixo local, pode conter dados sensíveis |
| `*.tsbuildinfo` | Cache incremental do compilador TypeScript (ex.: `tsconfig.build.tsbuildinfo`) | É produzido na sua máquina; a imagem sempre compila do zero |

### `.gcloudignore`

Controla o que o `gcloud builds submit` **envia** ao Cloud Build. Ele precisa do código, do `Dockerfile` e do `.dockerignore`, mas nunca de `node_modules` (centenas de MB) ou `.env` (segredos):

```text
# Arquivos que NAO sobem para o Cloud Build (gcloud builds submit)
.git
.gitignore
node_modules
dist
.env
.env.*
!.env.example
.storage
coverage
```

| Linha | Por quê |
|---|---|
| `# ...` | Comentário: não é padrão nenhum |
| `.git`, `.gitignore` | O histórico do Git não é necessário para construir a imagem |
| `node_modules` | Seria enviado inteiro pela rede sem necessidade: o Docker reinstala tudo |
| `dist` | O build gera a sua própria `dist` |
| `.env`, `.env.*`, `!.env.example` | Segredos não podem sair da sua máquina; o `.env.example` é só o modelo |
| `.storage`, `coverage` | Dados locais e relatórios que não interessam ao build |

Repare que o `.gcloudignore` **não** lista `Dockerfile`, `cloudbuild.yaml` nem `.dockerignore`: o Cloud Build precisa deles. Se o `.gcloudignore` não existisse, o `gcloud` usaria o `.gitignore`.

> **Segurança:** se `.env` subir para o build, ele pode acabar dentro da imagem. Os dois arquivos existem para evitar isso.

## 1.6 `todo-api/cloudbuild.yaml`

**O que é:** a receita do **Cloud Build**, o serviço do GCP que executa builds em máquinas do Google. Em vez de construir as imagens no seu computador, o `gcloud builds submit` envia o código e o Cloud Build executa os passos deste arquivo. Ele constrói as duas imagens na nuvem e as publica no Artifact Registry (capítulo 8):

```yaml
# Cloud Build: constroi as duas imagens (API e migrations) e as envia ao Artifact Registry.
# Uso: gcloud builds submit --config=cloudbuild.yaml --substitutions=_REGISTRY=...,_TAG=...
steps:
  - id: build-api
    name: gcr.io/cloud-builders/docker
    args: ['build', '--target', 'runtime', '-t', '${_REGISTRY}/todo-api:${_TAG}', '.']

  - id: build-migrate
    name: gcr.io/cloud-builders/docker
    args: ['build', '--target', 'migrate', '-t', '${_REGISTRY}/todo-api-migrate:${_TAG}', '.']

images:
  - '${_REGISTRY}/todo-api:${_TAG}'
  - '${_REGISTRY}/todo-api-migrate:${_TAG}'

substitutions:
  _REGISTRY: us-central1-docker.pkg.dev/SEU_PROJETO/todo
  _TAG: latest

options:
  logging: CLOUD_LOGGING_ONLY
```

| Campo | Significado |
|---|---|
| `steps` | Lista de passos. Cada passo roda em um container e, sem `waitFor`, os passos rodam **em sequência** |
| `id` | Nome do passo (`build-api`, `build-migrate`), que aparece nos logs e permite referenciá-lo |
| `name` | Imagem do container que executa o passo. `gcr.io/cloud-builders/docker` é o construtor oficial que traz o comando `docker` |
| `args` | Argumentos passados ao `docker`. Aqui equivalem a `docker build --target <alvo> -t <imagem> .` (as partes estão explicadas na tabela de comandos da 1.4) |
| `${_REGISTRY}`, `${_TAG}` | Pontos onde o Cloud Build **troca** a variável pelo valor da `substitution` correspondente |
| `images` | Após os passos, o Cloud Build envia estas imagens ao registro. Sem isso, a imagem construída seria descartada junto com a máquina do build |
| `substitutions` | Variáveis com valor padrão. O nome precisa começar com `_` e o valor pode ser trocado na linha de comando com `--substitutions=` |
| `_REGISTRY` | Endereço do repositório de imagens: `<região>-docker.pkg.dev/<projeto>/<repositório>`. O `SEU_PROJETO` é um marcador para você trocar (capítulo 8) |
| `_TAG` | Versão da imagem (`latest` por padrão) |
| `options` | Ajustes do build como um todo |
| `logging: CLOUD_LOGGING_ONLY` | Grava os logs no Cloud Logging (evita exigir um bucket próprio de logs) |

Os dois passos usam o mesmo Docker da máquina de build, então o segundo reaproveita do primeiro as camadas em comum (`base` e `deps`, o `npm ci` completo) em vez de reinstalar tudo.

## 1.7 `todo-api/docker-compose.yml`

**O que é:** o arquivo do **Docker Compose**, que descreve vários containers de uma vez (imagem, portas, variáveis, ordem de partida) para subi-los com um só comando. Ele **só existe para a sua máquina**: na nuvem, cada peça é um serviço gerenciado. Reproduz a arquitetura localmente: `postgres` faz o papel do Cloud SQL, `mongo` o do Atlas e o disco local o do Cloud Storage.

```yaml
# Ambiente local que espelha a arquitetura da nuvem:
#   postgres -> Cloud SQL | mongo -> MongoDB Atlas | storage local -> Cloud Storage
#
# Modo 1 (desenvolvimento, portas 5433 e 27018 no host): sobe so os bancos e roda a API com `npm run start:dev`
#   docker compose up -d postgres mongo
#
# Modo 2 (teste da imagem de producao): sobe tudo, incluindo a migration e a API em container
#   docker compose --profile app up --build

name: todo

services:
  postgres:
    image: postgres:18
    environment:
      POSTGRES_USER: todo
      POSTGRES_PASSWORD: todo
      POSTGRES_DB: todo
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U todo -d todo"]
      interval: 5s
      timeout: 3s
      retries: 10

  mongo:
    image: mongo:8
    ports:
      - "27018:27017"
    volumes:
      - mongodata:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 5s
      timeout: 5s
      retries: 10

  migrate:
    profiles: ["app"]
    build:
      context: .
      target: migrate
    environment:
      DATABASE_URL: postgresql://todo:todo@postgres:5432/todo
    depends_on:
      postgres:
        condition: service_healthy

  api:
    profiles: ["app"]
    build: .
    ports:
      - "3000:8080"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://todo:todo@postgres:5432/todo
      MONGODB_URI: mongodb://mongo:27017
      MONGODB_DB: todo
      JWT_SECRET: segredo-somente-para-desenvolvimento-local-0123456789
      CORS_ORIGINS: http://localhost:5173
      STORAGE_DRIVER: local
      LOCAL_STORAGE_DIR: /tmp/storage
      PUBLIC_API_URL: http://localhost:3000
    depends_on:
      migrate:
        condition: service_completed_successfully
      mongo:
        condition: service_healthy

volumes:
  pgdata:
  mongodata:
```

| Serviço | Imagem / alvo | Porta no host | Equivalente na nuvem |
|---|---|---|---|
| `postgres` | `postgres:18` | 5433 | Cloud SQL (PostgreSQL 18) |
| `mongo` | `mongo:8` | 27018 | MongoDB Atlas (8.0) |
| `migrate` (perfil `app`) | alvo `migrate` | — | Cloud Run Job |
| `api` (perfil `app`) | alvo `runtime` | 3000 → 8080 | Cloud Run Service |

**As chaves, uma a uma**

| Chave | Significado |
|---|---|
| `name: todo` | Nome do projeto Compose. Prefixa containers, rede e volumes (`todo-postgres-1`, `todo_pgdata`...), separando-os de outros projetos |
| `services` | Os containers. Cada chave filha (`postgres`, `mongo`, `migrate`, `api`) é um serviço |
| `image` | Imagem pronta do Docker Hub (`postgres:18`, `mongo:8`) |
| `build` | Em vez de baixar uma imagem, **constrói** a partir do Dockerfile. `context: .` é a pasta de origem e `target: migrate` o estágio. Sem `target` (serviço `api`), usa o último estágio: `runtime` |
| `environment` | Variáveis de ambiente do container |
| `ports: "5433:5432"` | Formato `porta-no-seu-computador:porta-no-container`. O Postgres escuta na 5432 **dentro** do container, e você o alcança em `localhost:5433` |
| `volumes` (no serviço) | Liga uma pasta do container a um volume nomeado. Os dados do banco sobrevivem a um `docker compose down` (só somem com `down -v`) |
| `volumes` (raiz) | Declara os volumes nomeados `pgdata` e `mongodata`, gerenciados pelo Docker |
| `healthcheck` | Comando que o Docker roda de tempos em tempos para saber se o serviço está **pronto** (não apenas iniciado) |
| `test` | O comando do teste. `pg_isready` pergunta ao Postgres se aceita conexões; `mongosh ... ping` pinga o Mongo. `CMD-SHELL` roda a linha em um shell |
| `interval`, `timeout`, `retries` | De quanto em quanto tempo testar (5 s), quanto esperar pela resposta (3 s ou 5 s) e quantas falhas seguidas até marcar como `unhealthy` (10) |
| `profiles: ["app"]` | Serviço **opcional**: só sobe com `--profile app`. Por isso `docker compose up -d postgres mongo` não inicia a API |
| `depends_on` | Ordem de partida. `condition` diz o que esperar: `service_healthy` (passou no `healthcheck`) ou `service_completed_successfully` (terminou com código 0) |

Detalhes em que você pode tropeçar:

- **`/var/lib/postgresql`:** desde a versão 18, a imagem oficial guarda os dados em uma subpasta desse diretório (por versão), por isso o volume é montado nele e não em `/var/lib/postgresql/data`.
- **Portas dentro × fora:** o container `api` fala com `postgres:5432` e `mongo:27017` (nome do serviço e porta **interna**), não com `localhost:5433`. As portas 5433 e 27018 só valem para quem está **fora** dos containers, como o `npm run start:dev`.
- **`PUBLIC_API_URL`:** dentro do container a API escuta na 8080, mas você a acessa em `localhost:3000`. Como o driver `local` monta URLs para o **navegador**, precisamos informar `http://localhost:3000` (1.2).
- **`LOCAL_STORAGE_DIR: /tmp/storage`:** o usuário `node` não consegue gravar em `/app` (a pasta pertence ao root), mas consegue em `/tmp`. Os anexos somem quando o container é apagado.
- **`JWT_SECRET`:** o valor do compose é só para desenvolvimento, um segredo público no Git. Nunca o reutilize na nuvem.

Repare em `depends_on` com `service_completed_successfully`: a API só sobe **depois** que a migration termina, a mesma ordem que seguiremos no Cloud Run.

## 1.8 `todo-api/infra/gcs-cors.json` — CORS do bucket

**O que é:** a configuração de **CORS** (*Cross-Origin Resource Sharing*) do bucket. O navegador só deixa um site chamar **outro domínio** se esse domínio disser que permite. Este arquivo é a lista de permissões do bucket. Ele não é lido pela aplicação: é aplicado uma vez ao bucket com `gcloud storage buckets update --cors-file` (capítulo 6).

O navegador envia o arquivo direto ao Cloud Storage (`PUT`). Como a origem (`web.app`) é diferente da do bucket (`storage.googleapis.com`), o bucket precisa autorizar isso. O arquivo é uma **lista de regras** (um bucket pode ter várias); aqui há uma só:

```json
[
  {
    "origin": ["https://SEU-PROJETO.web.app", "https://SEU-PROJETO.firebaseapp.com", "http://localhost:5173"],
    "method": ["PUT", "GET", "HEAD"],
    "responseHeader": ["Content-Type", "x-goog-content-length-range"],
    "maxAgeSeconds": 3600
  }
]
```

| Campo | Significado |
|---|---|
| `origin` | Sites autorizados a chamar o bucket pelo navegador: os dois endereços do Firebase Hosting (`web.app` e `firebaseapp.com`) e `localhost:5173` (o front em desenvolvimento). Troque `SEU-PROJETO` pelo seu `PROJECT_ID` (capítulo 6) |
| `method` | `PUT` para upload, `GET`/`HEAD` para exibir imagens |
| `responseHeader` | Cabeçalhos que o navegador pode enviar/ler. `Content-Type` acompanha o `PUT` do arquivo; `x-goog-content-length-range` limita o tamanho do upload (é o `MAX_UPLOAD_BYTES`, 1.2) |
| `maxAgeSeconds` | Tempo que o navegador guarda a resposta do *preflight*: a "pergunta prévia" (`OPTIONS`) que ele faz antes do `PUT`. `3600` = 1 hora, então ele não pergunta a cada upload |

## 1.9 `todo-web/vite.config.ts`

**O que é:** a configuração do **Vite**, a ferramenta que serve o front em desenvolvimento (`npm run dev`) e o empacota para produção (`npm run build`, que gera `dist/`).

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Em desenvolvimento, /api vai para a API local. Em producao quem faz isso e o Firebase Hosting.
    proxy: { '/api': 'http://localhost:3000' },
  },
})
```

| Item | Significado |
|---|---|
| `import react from '@vitejs/plugin-react'` | Traz o plugin que ensina o Vite a processar React (JSX) e atualiza a página no navegador ao salvar um arquivo |
| `defineConfig` | Só devolve o objeto recebido, mas faz o editor completar e checar as opções |
| `plugins: [react()]` | Liga o plugin do React |
| `server` | Opções do **servidor de desenvolvimento**. Não afetam o build de produção |
| `server.port: 5173` | Porta do `npm run dev`. É a origem que a API libera em `CORS_ORIGINS` e o bucket em `gcs-cors.json` |
| `server.proxy` | Encaminha as chamadas que começam com `/api` para `http://localhost:3000` (a API local). Para o navegador, front e API estão na mesma origem, sem CORS |
| Comentário `// https://vite.dev/config/` | Só o link para a documentação das opções |

O front **sempre chama `/api`**. Localmente o proxy do Vite encaminha para `localhost:3000`; na nuvem, o Firebase Hosting encaminha para o Cloud Run (1.10). O código do front é o mesmo nos dois ambientes.

## 1.10 `todo-web/firebase.json`

**O que é:** o arquivo de configuração do **Firebase CLI**. Ele diz ao comando `firebase deploy` **o que publicar** e **como o Firebase Hosting deve se comportar** ao servir o site: qual pasta sobe para a CDN, para onde cada rota é encaminhada (inclusive para o Cloud Run) e quais cabeçalhos HTTP acompanham cada resposta.

**O que ele faz neste projeto:**

1. Publica a pasta `dist` (o build do React).
2. Encaminha `/api/**` para o serviço `todo-api` do Cloud Run, o que coloca front e API na **mesma origem** (sem CORS e sem cookies entre domínios).
3. Devolve `index.html` para as demais rotas, para o React Router funcionar ao recarregar a página.
4. Define o cache: arquivos com hash por 1 ano e `index.html` sempre revalidado.

**Onde fica e quando é lido:** na raiz de `todo-web/`, versionado no Git. O Firebase CLI o lê a cada `firebase deploy` (capítulo 10). O arquivo pode configurar vários serviços do Firebase; aqui só existe a seção `hosting`. Como é JSON, **não aceita comentários**: a explicação de cada item está nas tabelas depois do código.

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "todo-api",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "/assets/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      },
      {
        "source": "/index.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
      }
    ]
  }
}
```

> No repositório o arquivo já vem pronto, com `us-central1`. Se você trocar a região do Cloud Run, troque aqui também. **Não rode `firebase init hosting` de novo:** o comando sobrescreve a seção `hosting` e apaga os rewrites e cabeçalhos acima.

### Item por item

**Chaves de primeiro nível**

| Chave | Significado | Neste projeto |
|---|---|---|
| `hosting` | Seção que configura o Firebase Hosting (a CDN que serve o site) | Única seção do arquivo |
| `public` | Pasta cujo conteúdo é publicado. **Obrigatória** (o padrão do `firebase init` é `public`) | `dist`, a saída de `npm run build` |
| `ignore` | Lista de padrões *glob* de arquivos que **não** sobem no deploy | Os três padrões da tabela seguinte |
| `rewrites` | Regras que decidem **o que responder** a uma URL sem alterar o endereço no navegador | Duas regras: `/api/**` e `**` |
| `headers` | Regras que **adicionam cabeçalhos HTTP** às respostas de certas URLs | Duas regras de cache |

**`ignore`: o que fica de fora do deploy** (são os valores que o `firebase init` gera por padrão)

| Padrão | O que exclui | Por quê |
|---|---|---|
| `firebase.json` | O próprio arquivo de configuração | Serve ao CLI, não ao visitante do site |
| `**/.*` | Qualquer arquivo ou pasta cujo nome comece com ponto (`.env`, `.git`...), em qualquer nível | Evita publicar segredos e arquivos internos por engano |
| `**/node_modules/**` | A pasta `node_modules` e tudo dentro dela, em qualquer nível | São dependências de desenvolvimento, já embutidas no build |

Sobre a sintaxe: `*` casa qualquer trecho dentro de **um** nível de pasta e `**` casa **qualquer profundidade**. Assim, `/api/**` cobre `/api/health`, `/api/projects/1/tasks` e assim por diante.

**`rewrites`: cada regra**

| Campo | Significado | Regra 1 (API) | Regra 2 (front) |
|---|---|---|---|
| `source` | Padrão glob da URL que aciona a regra | `/api/**` | `**` (qualquer URL) |
| `run` | Em vez de servir um arquivo, **encaminha a requisição a um serviço do Cloud Run** | Presente | — |
| `run.serviceId` | Nome do serviço Cloud Run que recebe a requisição. Deve ser **igual** ao nome do serviço publicado (capítulo 9) | `todo-api` | — |
| `run.region` | Região desse serviço. Se omitida, o Firebase tenta detectá-la; deixamos explícita para não haver ambiguidade | `us-central1` | — |
| `destination` | Arquivo local (dentro de `public`) devolvido no lugar da URL pedida. Ele precisa existir | — | `/index.html` |

Na prática: a regra 1 faz o navegador chamar `https://SEU-PROJETO.web.app/api/...` e o Hosting repassar ao Cloud Run. A regra 2 faz `/projects/42` ou `/s/abc123` devolverem o `index.html`; o JavaScript do React lê a URL e desenha a página certa (esses caminhos não existem como arquivos em `dist`).

**`headers`: cada regra**

| Campo | Significado | Regra 1 | Regra 2 |
|---|---|---|---|
| `source` | Padrão glob das URLs que recebem os cabeçalhos | `/assets/**` | `/index.html` |
| `headers` | Lista de cabeçalhos HTTP a acrescentar | 1 cabeçalho | 1 cabeçalho |
| `key` | Nome do cabeçalho | `Cache-Control` | `Cache-Control` |
| `value` | Valor do cabeçalho | `public, max-age=31536000, immutable` | `no-cache` |

O `Cache-Control` diz a navegadores e à CDN por quanto tempo podem reutilizar uma resposta:

| Diretiva | Significado |
|---|---|
| `public` | Qualquer cache, inclusive a CDN do Hosting, pode guardar a resposta |
| `max-age=31536000` | A cópia vale por 31.536.000 segundos (**365 dias**) sem nova consulta ao servidor |
| `immutable` | O conteúdo daquela URL nunca muda, então o navegador nem revalida ao recarregar a página |
| `no-cache` | Pode guardar, mas **precisa perguntar ao servidor** se a cópia ainda vale antes de reutilizá-la. Não significa "não guardar" |

Por que dois tratamentos diferentes? O Vite grava os arquivos de `dist/assets/` com um **hash no nome** (`index-3fA9k.js`): se o conteúdo muda, o nome muda, então é seguro cacheá-los por um ano. O `index.html` mantém sempre o mesmo nome e é quem aponta para esses arquivos; se ficasse em cache, o usuário continuaria vendo a versão antiga após um deploy. Sem estas regras, o Hosting aplicaria o padrão `max-age=3600` (1 hora) a tudo.

**Ordem em que o Hosting responde a uma requisição** (a primeira etapa que se aplicar vence):

1. Namespaces reservados do Firebase (`/__/*`)
2. `redirects` configurados (não usamos)
3. **Arquivo estático** com exatamente aquele caminho em `public`
4. **`rewrites`**, na ordem em que aparecem no arquivo
5. Página 404 personalizada, se existir
6. Página 404 padrão

> Duas consequências. Primeiro, um arquivo real (como `/assets/index-3fA9k.js`) sempre é servido antes de qualquer rewrite. Segundo, entre os rewrites a **ordem** importa: a primeira regra que casar vence. Se `**` viesse antes de `/api/**`, toda chamada à API devolveria o `index.html` do React em vez de chegar ao Cloud Run.

## 1.11 `todo-web/.env.example`

```bash
# Opcional. Por padrao o front chama /api (mesma origem) - o proxy do Vite em dev e o
# rewrite do Firebase Hosting em producao. Defina somente se a API estiver em outra URL.
# VITE_API_URL=https://todo-api-xxxxx-rj.a.run.app/api
```

**O que é:** o modelo das variáveis de ambiente do **front**. Aqui existe uma só, `VITE_API_URL`, e ela está **comentada** (o `#` no início), ou seja, não vale nada por padrão.

| Item | Significado |
|---|---|
| `VITE_API_URL` | Endereço base da API que o front chama. É lida em `src/api/client.ts`; sem ela, o front usa `/api` (mesma origem) |
| Prefixo `VITE_` | Só variáveis com esse prefixo chegam ao código do navegador. O prefixo evita expor por engano outras variáveis da sua máquina |
| Por que está comentada | Usamos `/api` e o proxy (1.9) ou o rewrite (1.10) faz o resto. Só a defina se a API estiver em **outra URL** |

Variáveis `VITE_*` são **embutidas no JavaScript no momento do build** (não em tempo de execução): mudar o valor exige um novo `npm run build` e um novo deploy. E, como o JavaScript vai para o navegador de todo mundo, **nunca coloque segredos** em variáveis `VITE_`. Como usamos o rewrite, não precisamos definir nenhuma.

---

## 1.12 Teste local completo

### A) Bancos e API em modo desenvolvimento

```bash
cd todo-api
docker compose up -d postgres mongo
cp .env.example .env
npm ci
npx prisma migrate deploy
npm run start:dev
```

| Comando | O que faz |
|---|---|
| `docker compose up -d postgres mongo` | Sobe **só** os dois bancos, em segundo plano (`-d`). A API e a migration têm o perfil `app` e não entram |
| `cp .env.example .env` | Cria o seu `.env` a partir do modelo (1.2). O `.env` não é versionado |
| `npm ci` | Instala as dependências exatas do `package-lock.json` |
| `npx prisma migrate deploy` | Aplica as migrations no Postgres local (cria as tabelas). Lê a `DATABASE_URL` pelo `prisma.config.ts` (1.3) |
| `npm run start:dev` | Gera o cliente do Prisma e sobe a API na porta 3000, reiniciando ao salvar um arquivo |

Em outro terminal:

```bash
curl -s localhost:3000/api/health/ready
# {"status":"ok","postgres":"up","mongo":"up"}
```

O `curl -s` (silencioso, sem barra de progresso) chama o *health check* de prontidão, que testa a conexão da API com o Postgres e o Mongo. Se um deles estiver fora do ar, o campo correspondente mostra `down`, o `status` vira `degraded` e a API responde **503**. (A rota `/api/health`, sem `/ready`, só confirma que o processo está de pé e não consulta os bancos.)

### B) Front-end

```bash
cd todo-web
npm ci
npm run dev        # http://localhost:5173
```

`npm run dev` inicia o servidor do Vite (1.9), com o proxy de `/api` para a API local.

Cadastre um usuário, crie um projeto, uma tarefa, anexe uma imagem e gere um link de compartilhamento. Abra o link em uma janela anônima.

### C) Testes automatizados

```bash
cd todo-api
npm test           # unitários (5 testes)
npm run test:e2e   # fluxo completo contra os bancos do compose (11 testes)
```

`npm test` roda os testes unitários, que não precisam de banco. O `test:e2e` sobe a API de verdade e a exercita por HTTP, por isso exige os bancos do compose no ar.

### D) A imagem de produção

```bash
cd todo-api
docker compose --profile app up --build
curl -s localhost:3000/api/health/ready
docker compose --profile app down
```

| Comando | O que faz |
|---|---|
| `docker compose --profile app up --build` | Inclui os serviços do perfil `app` (`migrate` e `api`), **reconstrói** as imagens (`--build`) e mostra os logs. Ordem: Postgres e Mongo prontos, migration, API |
| `curl -s localhost:3000/api/health/ready` | Mesmo teste de antes, agora contra a API **em container** (porta 3000 do seu computador → 8080 do container) |
| `docker compose --profile app down` | Para e remove os containers (inclui os do perfil `app`). Os volumes com os dados são mantidos |

Esse é o teste mais importante do capítulo: **é exatamente a imagem que iremos publicar**. Se ela sobe aqui, o Cloud Run só precisa de rede, segredos e banco.

### Checklist antes de seguir

| Item | OK? |
|---|---|
| `docker build --target runtime` e `--target migrate` terminam sem erro | ☐ |
| `curl localhost:3000/api/health/ready` mostra `postgres` e `mongo` como `up` | ☐ |
| `npm test` e `npm run test:e2e` passam | ☐ |
| O front cria projeto, anexa imagem e o link anônimo abre em janela anônima | ☐ |
| Nenhum arquivo `.env` foi adicionado ao Git | ☐ |

> Para encerrar e limpar o ambiente local: `docker compose down -v` (o `-v` apaga os volumes com os dados de teste).

---

[← Voltar ao README](../README.md) · [Próximo: projeto no GCP →](02-projeto-gcp-e-ferramentas.md)
