# 7. Secret Manager e a conta de serviço da API

Senhas e chaves **não** entram no código, na imagem Docker nem em variáveis digitadas à mão. Ficam no **Secret Manager**, e o Cloud Run as entrega ao container como variáveis de ambiente, **somente** para a identidade autorizada. Neste capítulo também criamos essa identidade: a **conta de serviço** da API, com o mínimo de permissões.

[← Cloud Storage](06-cloud-storage.md) · [README](../README.md) · [Próximo: Artifact Registry e Cloud Build →](08-artifact-registry-e-cloud-build.md)

## Conceitos

| Termo | Explicação |
|---|---|
| **Secret** | O "cofre" nomeado (`todo-jwt-secret`). Guarda metadados e permissões |
| **Versão** | O valor em si. **Imutável**: para trocar, adiciona-se uma nova versão (2, 3...). A `latest` aponta para a mais recente |
| **Replicação** | `automatic` = o Google escolhe onde replicar (mais simples) |
| **Conta de serviço** | Identidade de uma aplicação (não de uma pessoa). O Cloud Run executa o container **como** ela |
| **Papel (role)** | Conjunto de permissões. Concedemos o mínimo necessário |
| **ADC** (Application Default Credentials) | As bibliotecas do Google descobrem sozinhas as credenciais da conta de serviço em execução. **Nenhuma chave JSON** |

## Os segredos da aplicação

| Segredo | Conteúdo | Criado em | Variável no Cloud Run |
|---|---|---|---|
| `todo-db-password` | Senha do usuário `todo_app` do Cloud SQL | Capítulo 4 | *(não é lido pela API; é a fonte para montar a URL)* |
| `todo-mongodb-uri` | URI `mongodb+srv://...` do Atlas | Capítulo 5 | `MONGODB_URI` |
| `todo-jwt-secret` | Chave que assina os tokens de login (64 caracteres aleatórios) | **Este capítulo** | `JWT_SECRET` |
| `todo-database-url` | `postgresql://todo_app:SENHA@IP_PRIVADO:5432/todo?sslmode=require&uselibpqcompat=true` | **Este capítulo** | `DATABASE_URL` |

> `todo-db-password` e `todo-mongodb-uri` já existem desde os capítulos 4 e 5 (o comando `gcloud secrets create` e a opção pelo Console foram explicados lá, no momento em que a senha e a URI ainda estavam na memória do terminal). Aqui criamos os **2 segredos que faltam** e, principalmente, a identidade que tem permissão para ler os 3 usados pela API.

## O que vamos criar

| Recurso | Nome | Configuração |
|---|---|---|
| Segredo | `todo-jwt-secret` | Replicação automática, 1 versão |
| Segredo | `todo-database-url` | Replicação automática, 1 versão |
| Conta de serviço | `todo-api-sa` (`$SA_EMAIL`) | Nome de exibição *Todo API (Cloud Run)* |
| Permissão | `roles/secretmanager.secretAccessor` | Em **cada um dos 3 segredos** usados (não no projeto) |
| Permissão | `roles/storage.objectUser` | No **bucket** `$BUCKET` |
| Permissão | `roles/iam.serviceAccountTokenCreator` | Na **própria** conta `todo-api-sa` |

> **Por que uma conta própria?** Se não indicarmos nenhuma, o Cloud Run usa a conta padrão do Compute Engine, que em muitos projetos tem o papel amplo de **Editor**. Uma conta dedicada, com só o necessário, limita o estrago se a API for comprometida.

## Passo 1 — Criar o segredo do JWT

**Terminal**

```bash
source ~/todo-aula.env

node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" | tr -d '\n' | \
  gcloud secrets create todo-jwt-secret \
    --replication-policy=automatic --data-file=- --project="$PROJECT_ID"
```

**Console**

1. **☰ → Segurança → Secret Manager → Criar secret**.
2. **Nome:** `todo-jwt-secret`. **Valor do secret:** cole uma sequência aleatória (gere com `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`).
3. Mantenha a política de replicação padrão e clique em **Criar secret**.

## Passo 2 — Criar o segredo `todo-database-url`

Montamos a URL com o IP privado (capítulo 4) e a senha guardada. O valor **nunca é impresso na tela**.

**Terminal**

```bash
DB_PRIVATE_IP="$(gcloud sql instances describe "$SQL_INSTANCE" --format='value(ipAddresses[0].ipAddress)')"
DB_PASSWORD="$(gcloud secrets versions access latest --secret=todo-db-password)"

printf 'postgresql://%s:%s@%s:5432/%s?sslmode=require&uselibpqcompat=true' "$DB_USER" "$DB_PASSWORD" "$DB_PRIVATE_IP" "$DB_NAME" | \
  gcloud secrets create todo-database-url \
    --replication-policy=automatic --data-file=- --project="$PROJECT_ID"

unset DB_PASSWORD DB_PRIVATE_IP
```

**Console**

1. **Secret Manager → Criar secret**, nome `todo-database-url`.
2. Valor: `postgresql://todo_app:SENHA@IP_PRIVADO:5432/todo?sslmode=require&uselibpqcompat=true`, com a senha lida em `todo-db-password → Ações → Ver o valor do secret` e o IP em *Cloud SQL → Visão geral*.

## Passo 3 — Criar a conta de serviço

**Terminal**

```bash
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="Todo API (Cloud Run)" \
  --project="$PROJECT_ID"

gcloud iam service-accounts list --filter="email:$SA_EMAIL"
```

**Console**

1. **☰ → IAM e administrador → Contas de serviço → Criar conta de serviço**.
2. **Nome:** `Todo API (Cloud Run)`; **ID:** `todo-api-sa`.
3. **Criar e continuar** → **não** conceda papéis aqui (faremos por recurso) → **Concluído**.

## Passo 4 — Conceder as permissões (menor privilégio)

**Terminal**

```bash
# 4.1 Ler apenas os 3 segredos usados pela API
for SECRET in todo-database-url todo-mongodb-uri todo-jwt-secret; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID"
done

# 4.2 Gravar/ler/apagar objetos somente neste bucket
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectUser"

# 4.3 Assinar signed URLs: a conta precisa "se representar" para chamar signBlob
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project="$PROJECT_ID"
```

**Console**

| Onde | Caminho | Principal e papel |
|---|---|---|
| 4.1 Cada segredo | **Secret Manager →** clique no segredo → aba **Permissões → Conceder acesso** | Novo principal `todo-api-sa@...` · papel **Acessador de secrets do Secret Manager** |
| 4.2 Bucket | **Cloud Storage → Buckets →** o bucket → aba **Permissões → Conceder acesso** | Novo principal `todo-api-sa@...` · papel **Usuário de objetos do Storage** |
| 4.3 A própria conta | **IAM e administrador → Contas de serviço →** `todo-api-sa` → aba **Permissões** (ou *Principais com acesso*) → **Conceder acesso** | Novo principal **ela mesma** · papel **Criador de token da conta de serviço** |

| Permissão | Por que é necessária |
|---|---|
| `secretmanager.secretAccessor` em 3 segredos | Sem ele o Cloud Run **recusa o deploy** ("permission denied on secret") |
| `storage.objectUser` no bucket | Criar, ler e apagar objetos e ler metadados (`exists`, `getMetadata`) |
| `iam.serviceAccountTokenCreator` na própria conta | A assinatura de signed URLs sem chave JSON usa `iam.serviceAccounts.signBlob`. A documentação do Cloud Storage cita esse papel concedido à conta de serviço sobre si mesma |

> A documentação do Cloud Storage descreve esse papel concedido "no projeto que contém a conta". Concedê-lo **somente sobre a própria conta**, como fizemos, é equivalente para este caso e mais restrito.

## Passo 5 — Boas práticas ao usar os segredos no Cloud Run

| Prática | Detalhe |
|---|---|
| **Fixe a versão** no deploy | Variáveis de ambiente são resolvidas **na subida da instância**. A documentação do Cloud Run recomenda apontar para uma versão (`todo-jwt-secret:1`) em vez de `latest`, para que ninguém troque o valor sem um novo deploy |
| **Rotação** | Adicione uma versão (`gcloud secrets versions add ...`), faça um novo deploy apontando para ela e, depois de confirmar, **desative** a antiga (`gcloud secrets versions disable`) |
| **Nunca imprima** | Evite `echo $SEGREDO`; use `printf ... | gcloud secrets ... --data-file=-` para não deixar rastros no histórico do shell |
| **Auditoria** | Acessos a segredos aparecem em **Logs de auditoria** (Cloud Audit Logs) |
| **Trocar o JWT invalida todos os logins** | É esperado: os tokens antigos deixam de validar |

## Verificação

```bash
gcloud secrets list --project="$PROJECT_ID" --format="table(name,createTime)"
gcloud secrets versions list todo-jwt-secret

# Quem pode ler o segredo? (deve aparecer so a conta de servico da API)
gcloud secrets get-iam-policy todo-database-url

gcloud storage buckets get-iam-policy "gs://$BUCKET" --format="yaml(bindings)"
gcloud iam service-accounts get-iam-policy "$SA_EMAIL"
```

| Verificação | Esperado |
|---|---|
| `secrets list` | 4 segredos: `todo-db-password`, `todo-mongodb-uri`, `todo-jwt-secret`, `todo-database-url` |
| Política de cada segredo usado pela API | `secretAccessor` para `todo-api-sa` |
| Política do bucket | `objectUser` para `todo-api-sa` |
| Política da conta de serviço | `serviceAccountTokenCreator` para ela mesma |

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `Permission denied on secret ... for Revision service account` no deploy | Falta `secretAccessor` na conta usada pelo serviço | Refaça o passo 4.1 (para o segredo que falhou) |
| `Secret ... not found` | Nome digitado diferente | `gcloud secrets list` |
| URL com caracteres estranhos | Senha com símbolos sem escape | Use senhas `base64url` (o roteiro já faz isso) |
| Domínio institucional impede papéis | Política de organização | Use um projeto em conta pessoal |

## Custos deste capítulo

Fonte: [Secret Manager pricing](https://cloud.google.com/secret-manager/pricing), consultada em 20/09/2026.

| Item | Preço oficial | Cota gratuita | Estimativa mensal (4 versões, ~100 acessos) |
|---|---|---|---|
| Versões ativas de segredo | US$ 0,000082192/h por versão (≈ US$ 0,06/mês) acima de 6 | 6 versões | US$ 0,00 |
| Operações de acesso | US$ 0,03 por 10.000 acima de 10.000 | 10.000 por mês | US$ 0,00 (cada instância nova do Cloud Run lê 3 segredos) |
| Operações de gerenciamento | Gratuitas | — | US$ 0,00 |
| Versões destruídas | Gratuitas | — | US$ 0,00 |
| Contas de serviço e IAM | Sem cobrança | — | US$ 0,00 |
| **Total** | | | **US$ 0,00** |

> A cota gratuita é **por conta de faturamento** e reinicia todo mês. O 7º segredo já custaria US$ 0,06/mês.

---

[← Cloud Storage](06-cloud-storage.md) · [README](../README.md) · [Próximo: Artifact Registry e Cloud Build →](08-artifact-registry-e-cloud-build.md)
