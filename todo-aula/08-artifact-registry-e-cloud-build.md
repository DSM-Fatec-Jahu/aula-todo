# 8. Artifact Registry e Cloud Build: as imagens na nuvem

O Cloud Run executa **imagens de container**, mas ele não as constrói: precisa que elas estejam em um **registro**. Usamos o **Artifact Registry** para guardá-las e o **Cloud Build** para construí-las **na nuvem** (a partir do `Dockerfile` do capítulo 1), sem precisar de Docker na sua máquina.

[← Secret Manager](07-secret-manager.md) · [README](../README.md) · [Próximo: Cloud Run →](09-cloud-run.md)

## Conceitos

| Termo | Explicação |
|---|---|
| **Artifact Registry** | Repositório privado de artefatos (Docker, npm, Maven...). Substitui o antigo Container Registry |
| **Repositório** | Agrupa imagens de um formato em uma localização. Nomes são únicos por local |
| **Imagem e tag** | `us-central1-docker.pkg.dev/PROJETO/todo/todo-api:1.0.0` = local / projeto / repositório / imagem : tag |
| **Cloud Build** | Serviço que executa passos de build em containers, na nuvem. Lê o `cloudbuild.yaml` |
| **Conta de serviço de build** | Identidade que o build usa. A documentação recomenda **criar uma própria** em vez de usar a padrão (que costuma ter permissões amplas) |

## O que vamos criar

| Recurso | Nome | Configuração |
|---|---|---|
| Repositório | `todo` (`$REPO`) | Formato **Docker**, modo **Standard**, região `us-central1`, criptografia gerenciada pelo Google |
| Imagem da API | `todo-api:1.0.0` | Alvo `runtime` do Dockerfile (~572 MB, ~118 MB compactada) |
| Imagem das migrations | `todo-api-migrate:1.0.0` | Alvo `migrate` do Dockerfile (~1 GB, ~220 MB compactada) |
| Conta de serviço de build | `todo-build-sa` | Papéis: `artifactregistry.writer`, `logging.logWriter`, `storage.bucketViewer`, `storage.objectUser` |

O endereço completo do registro está em `$REGISTRY` (`us-central1-docker.pkg.dev/<PROJECT_ID>/todo`).

## Passo 1 — Criar o repositório

**Terminal**

```bash
source ~/todo-aula.env

gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Imagens do app Todo Cloud" \
  --project="$PROJECT_ID"

gcloud artifacts repositories list --location="$REGION"
```

**Console**

1. **☰ → Artifact Registry → Repositórios → Criar repositório**.
2. **Nome:** `todo`. **Formato:** *Docker*. **Modo:** *Padrão*.
3. **Tipo de local:** *Região* → `us-central1`.
4. **Descrição:** `Imagens do app Todo Cloud`. **Criptografia:** *Chave de criptografia gerenciada pelo Google*.
5. Clique em **Criar**.

## Passo 2 — Criar a conta de serviço do build

**Terminal**

As variáveis `BUILD_SA_NAME` e `BUILD_SA` vêm do `~/todo-aula.env` (capítulo 2). Se o seu arquivo foi criado antes desta atualização e não as tem, acrescente-as:

```bash
grep -q BUILD_SA ~/todo-aula.env || cat >> ~/todo-aula.env <<'EOF'
export BUILD_SA_NAME="todo-build-sa"
export BUILD_SA="${BUILD_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
EOF
```

Depois crie a conta e conceda os papéis:

```bash
source ~/todo-aula.env

gcloud iam service-accounts create "$BUILD_SA_NAME" \
  --display-name="Todo Build (Cloud Build)" \
  --project="$PROJECT_ID"

for ROLE in roles/artifactregistry.writer roles/logging.logWriter roles/storage.bucketViewer roles/storage.objectUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$BUILD_SA" \
    --role="$ROLE" \
    --condition=None
done
```

**Console**

1. **IAM e administrador → Contas de serviço → Criar conta de serviço**: nome `Todo Build (Cloud Build)`, ID `todo-build-sa` → **Criar e continuar**.
2. Na seção **Permissões (opcional)**, clique em **Selecionar papel**, pesquise pelo nome e escolha o primeiro papel. Depois clique em **Adicionar outro papel** e repita até ter os 4 papéis: **Gravador do Artifact Registry**, **Gravador de registros**, **Leitor de buckets do Storage (Beta)** e **Usuário de objetos do Storage**. Clique em **Continuar**.
3. Em **Principais com acesso (opcional)**, não preencha nada → **Concluído**.

| Papel | Para quê |
|---|---|
| `artifactregistry.writer` | Enviar as imagens ao repositório. A página oficial do quickstart cita *Administrator*; o `writer` basta porque o repositório já existe |
| `logging.logWriter` | Gravar os logs do build (usamos `CLOUD_LOGGING_ONLY`) |
| `storage.bucketViewer` e `storage.objectUser` | Ler o código-fonte que o `gcloud builds submit` envia para um bucket temporário do projeto |

## Passo 3 — Construir e publicar as imagens

O comando envia a pasta `todo-api` (respeitando o `.gcloudignore`), executa o `cloudbuild.yaml` e publica as duas imagens.

> **Esta etapa só pode ser feita pelo Terminal.** O Console não envia o código-fonte local para o Cloud Build: nele só é possível **acompanhar** o build (veja abaixo) ou configurar gatilhos de um repositório Git. Quem criou a conta de serviço pelo Console no passo 2 também deve executar o bloco abaixo, **incluindo o `source`**, que carrega `BUILD_SA`, `REGISTRY`, `TAG` e as demais variáveis.

**Terminal**

```bash
source ~/todo-aula.env
cd todo-api

gcloud builds submit . \
  --config=cloudbuild.yaml \
  --region="$REGION" \
  --service-account="projects/$PROJECT_ID/serviceAccounts/$BUILD_SA" \
  --substitutions="_REGISTRY=$REGISTRY,_TAG=$TAG" \
  --project="$PROJECT_ID"
```

O comando acompanha o log até o fim (3 a 8 minutos). No final aparece `STATUS: SUCCESS`.

**Console**

O Console é o melhor lugar para **acompanhar** o build:

1. **☰ → Cloud Build → Histórico**, selecione a região `us-central1`.
2. Clique no build em andamento para ver os passos `build-api` e `build-migrate` e o log de cada um.

> Para construir automaticamente a cada `git push`, **Cloud Build → Gatilhos → Criar gatilho** conecta um repositório do GitHub. Não usaremos neste roteiro.

## Passo 4 — Conferir as imagens

**Terminal**

```bash
gcloud artifacts docker images list "$REGISTRY" --include-tags \
  --format="table(package,tags,createTime)"
```

**Console**

**Artifact Registry → Repositórios →** `todo` → deve haver duas imagens, `todo-api` e `todo-api-migrate`, com a tag `1.0.0`.

Para o Cloud Run usaremos:

| Uso | Imagem |
|---|---|
| Serviço da API | `$REGISTRY/todo-api:1.0.0` |
| Job de migrations | `$REGISTRY/todo-api-migrate:1.0.0` |

> **Tags de versão.** Usamos `1.0.0` e **não** `latest`: a mesma tag sempre aponta para a mesma imagem, o que torna o deploy reproduzível e o *rollback* trivial. Numa correção, gere `1.0.1`.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `PERMISSION_DENIED: ... artifactregistry.repositories.uploadArtifacts` | Conta de build sem `artifactregistry.writer` | Refaça o passo 2 |
| `serviceAccountUser` / `iam.serviceAccounts.actAs` negado | Seu usuário não pode usar `todo-build-sa` | Como proprietário do projeto isso já vale; caso contrário peça `roles/iam.serviceAccountUser` sobre a conta |
| Erro pedindo configuração de logs ao usar conta de serviço própria | Falta `options.logging` no `cloudbuild.yaml` | O arquivo já tem `logging: CLOUD_LOGGING_ONLY` |
| `failed to solve ... npm ci` | `package-lock.json` fora de sincronia | Rode `npm install` local e reenvie |
| O upload do código demora | `node_modules` sendo enviado | Confira o `.gcloudignore` |
| `repository ... not found` | Repositório criado em outra região | `gcloud artifacts repositories list` |

## Custos deste capítulo

Fontes: [Artifact Registry pricing](https://cloud.google.com/artifact-registry/pricing) e [Cloud Build pricing](https://cloud.google.com/build/pricing), consultadas em 20/09/2026.

| Item | Preço oficial | Cota gratuita | Estimativa mensal |
|---|---|---|---|
| Armazenamento no Artifact Registry | US$ 0,000136986/GiB-h (≈ US$ 0,10/GiB-mês) | 0,5 GiB **por conta de faturamento** | Uma versão ocupa ≈ 0,34 GiB (118 MB + 220 MB compactadas; a camada base é compartilhada): **US$ 0,00**. Duas ou três versões passam da cota em ~0,2 a 0,5 GiB: **US$ 0,02 a 0,05** |
| Tráfego do registro para o Cloud Run (mesma região) | Gratuito | — | US$ 0,00 |
| Minutos de build (máquina `e2-standard-2`) | US$ 0,006/min | 2.500 min/mês por conta de faturamento | 5 builds × ~6 min = 30 min → **US$ 0,00** |
| Armazenamento do código-fonte enviado (bucket do Cloud Build) | Preço do Cloud Storage | 5 GB-mês (`us-central1`) | US$ 0,00 |
| **Total** | | | **US$ 0,00 a ~US$ 0,05** |

> **Dica de custo:** apague versões antigas (`gcloud artifacts docker images delete $REGISTRY/todo-api:1.0.0 --delete-tags`) e, ao terminar o roteiro, o repositório inteiro.

---

[← Secret Manager](07-secret-manager.md) · [README](../README.md) · [Próximo: Cloud Run →](09-cloud-run.md)
