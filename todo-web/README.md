# todo-web

Front-end do app de tarefas usado na atividade de computação em nuvem (GCP).

**Stack:** React 19.3 · Vite 8 · TypeScript 7 · React Router 8 · CSS puro (claro/escuro automático)

## Telas

| Rota | Quem acessa | O que faz |
|---|---|---|
| `/login` | Todos | Entrar ou criar conta |
| `/` | Logado | Lista e cria projetos |
| `/projects/:id` | Dono | Quadro (A fazer / Em andamento / Concluída), anexos, compartilhamento e histórico |
| `/s/:token` | Qualquer pessoa com o link | Visão anônima do projeto (leitura ou edição de tarefas, conforme o link) |

## Como rodar localmente

Com a API rodando em `http://localhost:3000` (veja `../todo-api`):

```bash
npm ci
npm run dev          # http://localhost:5173
npm run build        # gera dist/
npm run lint
```

O Vite encaminha `/api` para `http://localhost:3000` (ver `vite.config.ts`). Em produção quem faz isso é o **Firebase Hosting** (ver `firebase.json`), então o código do front não muda entre os ambientes: ele sempre chama `/api`.

## Upload de arquivos

O navegador **não** envia o arquivo para a API. O fluxo é:

1. `POST /api/projects/:id/tasks/:taskId/attachments` → a API devolve uma *signed URL*;
2. o navegador faz `PUT` do arquivo direto no Cloud Storage;
3. `POST .../attachments/:id/confirm` → a API confere o objeto e libera o anexo.

## Deploy

```bash
npm run build
npx firebase-tools@latest deploy --only hosting --project SEU_PROJETO
```

Passo a passo completo em [`../README.md`](../README.md).
