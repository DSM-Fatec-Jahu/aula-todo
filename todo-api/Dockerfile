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
