# 2. Projeto no GCP, faturamento e ferramentas

Tudo no GCP vive dentro de um **projeto**: é a fronteira de permissões, de faturamento e de exclusão. Apagar o projeto apaga todos os recursos dentro dele, o que o torna o melhor botão de "desfazer" para um laboratório como este.

[← Arquivos de configuração](01-arquivos-de-configuracao.md) · [README](../README.md) · [Próximo: rede →](03-rede-vpc-e-conexao-privada.md)

## O que vamos criar

| Item | Valor |
|---|---|
| Nome de exibição do projeto | `Todo Aula` |
| **ID do projeto** | `todo-aula-SEU-SUFIXO` (6 a 30 caracteres, minúsculas, números e hífens; **único no mundo** e **não pode ser reutilizado** depois de apagado) |
| Região | `us-central1` (Iowa) |
| Conta de faturamento | A sua, vinculada ao projeto |
| Alerta de orçamento | US$ 10 (avisos em 50%, 90% e 100%) |

> Exemplo de ID: `todo-aula-rz-4821`. Use algo que só você usaria (iniciais + 4 números).

## Passo 1 — Ferramentas

| Opção | Quando usar | Como |
|---|---|---|
| **Cloud Shell** | Não quer instalar nada | No Console, clique em **Ativar o Cloud Shell** (ícone `>_` no topo). Já vem com `gcloud` e Firebase CLI. Os arquivos do projeto precisam ser enviados ou clonados |
| **gcloud local** | Trabalhar no seu computador | Instale o [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) (usamos a 581.0.0). Depois: `gcloud components update` |

```bash
gcloud version          # confira que a CLI responde
gcloud auth login       # abre o navegador para você entrar
```

## Passo 2 — Arquivo de variáveis

Vamos reutilizar os mesmos nomes em todos os capítulos. Crie o arquivo (**edite `PROJECT_ID`**):

```bash
cat > ~/todo-aula.env <<'EOF'
export PROJECT_ID="todo-aula-SEU-SUFIXO"
export REGION="us-central1"

# Rede (capitulo 3)
export VPC="todo-vpc"
export SUBNET="todo-subnet-run"
export SUBNET_RANGE="10.10.0.0/24"
export PSA_RANGE="todo-psa-range"

# Banco (capitulo 4)
export SQL_INSTANCE="todo-pg"
export DB_NAME="todo"
export DB_USER="todo_app"

# Arquivos (capitulo 6)
export BUCKET="${PROJECT_ID}-todo-files"

# Conta de servico da API (capitulo 7)
export SA_NAME="todo-api-sa"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Imagens (capitulo 8)
export REPO="todo"
export TAG="1.0.0"
export REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"

# Cloud Run (capitulo 9)
export SERVICE="todo-api"
export JOB="todo-api-migrate"
EOF
source ~/todo-aula.env
echo "$PROJECT_ID"
```

> Em um terminal novo, rode `source ~/todo-aula.env` antes de qualquer comando.

## Passo 3 — Criar o projeto

**Terminal**

```bash
gcloud projects create "$PROJECT_ID" --name="Todo Aula" --set-as-default
gcloud config set project "$PROJECT_ID"
gcloud config get-value project
```

**Console**

1. Abra o [Console do Google Cloud](https://console.cloud.google.com/) e clique no **seletor de projetos** (topo da página).
2. Clique em **Novo projeto**.
3. **Nome do projeto:** `Todo Aula`. Clique em **Editar** ao lado do ID e informe o seu `PROJECT_ID`.
4. **Local:** deixe *Sem organização* (conta pessoal) ou a pasta indicada pelo seu professor.
5. Clique em **Criar** e selecione o projeto criado no seletor.

## Passo 4 — Vincular o faturamento

Cloud SQL, Cloud Run e Cloud Build exigem faturamento ativo, mesmo que o uso fique dentro da cota gratuita.

**Terminal**

```bash
gcloud billing accounts list                       # anote o ACCOUNT_ID (formato 0X0X0X-0X0X0X-0X0X0X)
export BILLING_ACCOUNT="0X0X0X-0X0X0X-0X0X0X"      # troque pelo seu
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
gcloud billing projects describe "$PROJECT_ID" --format="value(billingEnabled)"   # True
```

**Console**

1. Menu **☰ → Faturamento**.
2. Se o projeto não tiver conta vinculada, clique em **Vincular uma conta de faturamento** e escolha a sua.
3. Em contas novas, crie a conta com cartão de crédito; você recebe créditos de teste.

## Passo 5 — Alerta de orçamento

O orçamento **avisa, não bloqueia**: ele envia e-mail quando o gasto chega aos limites, mas não desliga nada. Por isso a limpeza do [capítulo 11](11-validacao-custos-e-limpeza.md) é obrigatória.

**Terminal**

```bash
gcloud services enable billingbudgets.googleapis.com --project="$PROJECT_ID"

# O valor usa a MOEDA DA SUA CONTA DE FATURAMENTO (contas brasileiras costumam ser BRL: use 50BRL)
gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT" \
  --display-name="todo-aula" \
  --filter-projects="projects/$PROJECT_ID" \
  --budget-amount=10USD \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0
```

**Console**
1. *☰ → Faturamento → Orçamentos e alertas (Budgets & caps) → Criar orçamento*.
2. *Definir:*
   - Selecione **Somente alertas**.
   - *Nome:* `todo-aula`.
   - Clique em **Avançar**.
3. *Escopo:*
   - *Intervalo de tempo:* **Mensalmente**.
   - *Projetos:* desmarque "Todos os projetos" e selecione **apenas o seu projeto** (`$PROJECT_ID`).
   - *Serviços:* **Todos os serviços**.
   - *Labels e Economia:* mantenha as opções padrão e clique em **Avançar**.
4. *Valor:*
   - *Tipo de orçamento:* **Valor especificado**.
   - *Valor:* `10` (ou `50` caso a moeda da sua conta de faturamento seja BRL).
   - Clique em **Avançar**.
5. *Ações:*
   - Configure os limites em **50%**, **90%** e **100%** do gasto real.
   - Mantenha habilitada a notificação por e-mail para administradores/usuários de faturamento.
6. Clique em **Concluir**.

## Passo 6 — Ativar as APIs

Cada serviço do GCP é uma API que precisa ser ativada por projeto. Ativar não custa nada; o custo vem do uso.

| API | Nome do serviço | Para quê | Capítulo |
|---|---|---|---|
| Compute Engine | `compute.googleapis.com` | VPC, sub-rede, Cloud NAT e Direct VPC egress | 3 |
| Service Networking | `servicenetworking.googleapis.com` | Peering com o Cloud SQL (Private Services Access) | 3 |
| Cloud SQL Admin | `sqladmin.googleapis.com` | Criar e administrar o PostgreSQL | 4 |
| Cloud Storage | `storage.googleapis.com` | Bucket de arquivos | 6 |
| IAM Service Account Credentials | `iamcredentials.googleapis.com` | Assinar signed URLs sem chave JSON | 6 |
| Secret Manager | `secretmanager.googleapis.com` | Guardar senhas | 7 |
| Cloud Resource Manager | `cloudresourcemanager.googleapis.com` | Permissões (IAM) no projeto | 7 |
| Artifact Registry | `artifactregistry.googleapis.com` | Repositório de imagens | 8 |
| Cloud Build | `cloudbuild.googleapis.com` | Construir as imagens | 8 |
| Cloud Run Admin | `run.googleapis.com` | Serviço e job | 9 |

**Terminal** (leva alguns minutos)

```bash
gcloud services enable \
  compute.googleapis.com \
  servicenetworking.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  iamcredentials.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  --project="$PROJECT_ID"

gcloud services list --enabled --project="$PROJECT_ID" --format="value(config.name)" | sort
```

**Console**

1. **☰ → APIs e serviços → Biblioteca**.
2. Busque cada nome da tabela e clique em **Ativar**.
3. Confira em **APIs e serviços → APIs e serviços ativados**.

> As APIs do Firebase (`firebase.googleapis.com`, `firebasehosting.googleapis.com`) são ativadas pelo próprio comando de criação do Firebase no [capítulo 10](10-firebase-hosting.md).

## Verificação

```bash
gcloud projects describe "$PROJECT_ID" --format="value(projectId,lifecycleState)"   # todo-aula-...  ACTIVE
gcloud billing projects describe "$PROJECT_ID" --format="value(billingEnabled)"    # True
```

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `The project ID you specified is already in use` | ID é único globalmente | Troque o sufixo e ajuste `~/todo-aula.env` |
| `Billing account ... is not open` ou `billing must be enabled` | Projeto sem faturamento | Refaça o Passo 4 |
| `Permission denied` ao ativar API | Sem papel de proprietário/editor no projeto | Peça `roles/serviceusage.serviceUsageAdmin` ou use um projeto seu |
| Erro de moeda ao criar o orçamento | A moeda do `--budget-amount` difere da conta | Use `50BRL` (ou a moeda da conta) |
| Conta institucional bloqueia a criação | Política de organização | Use conta pessoal |

## Custos deste capítulo

| Item | Preço (fonte: páginas oficiais de preços do GCP, 20/09/2026) | Estimativa mensal |
|---|---|---|
| Criar projeto | Sem cobrança | US$ 0,00 |
| Ativar APIs | Sem cobrança (paga-se o uso de cada serviço) | US$ 0,00 |
| Orçamentos e alertas | Sem cobrança | US$ 0,00 |
| Cloud Shell | Sem cobrança (confira os limites de uso na página do produto) | US$ 0,00 |
| **Total do capítulo** | | **US$ 0,00** |

---

[← Arquivos de configuração](01-arquivos-de-configuracao.md) · [README](../README.md) · [Próximo: rede →](03-rede-vpc-e-conexao-privada.md)
