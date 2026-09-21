# 11. Validação de ponta a ponta, custo total e limpeza

Tudo publicado. Falta **provar que funciona**, **fechar a conta** e **desligar o que gera custo**. Este é o capítulo em que o roteiro termina: o app só está "pronto" depois de validado, e a infraestrutura só está "encerrada" depois de apagada.

[← Firebase Hosting](10-firebase-hosting.md) · [README](../README.md)

## 1. Teste de ponta a ponta

### 1.1 Pelo terminal (script)

O script [`scripts/smoke-test.sh`](scripts/smoke-test.sh) percorre o mesmo caminho de um usuário e **apaga o que criou**. Ele já foi executado com sucesso contra a API local.

```bash
cd todo-aula/scripts
./smoke-test.sh "https://$PROJECT_ID.web.app"
```

Saída esperada (resumida):

```text
1) Saude dos servicos            OK PostgreSQL / OK MongoDB
2) Cadastro e login              OK
3) Projeto e tarefa              OK
4) Upload de arquivo (signed URL direto no storage)   OK PUT no storage / anexo confirmado / download
5) Compartilhamento anonimo      OK leitura / bloqueio de edicao / revogacao
6) Historico no MongoDB          OK 6 eventos registrados
7) Limpeza                       OK projeto removido
RESULTADO: tudo certo
```

> O cadastro tem limite de **5 por minuto por IP** (proteção contra abuso). Ao repetir o teste várias vezes seguidas, espere um minuto.

### 1.2 Pelo navegador

| # | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir `https://<PROJECT_ID>.web.app` | Redireciona para `/login` |
| 2 | Criar conta e entrar | Lista de projetos vazia |
| 3 | Criar projeto e uma tarefa | Tarefa na coluna **A fazer** |
| 4 | **Anexar** uma imagem | Miniatura aparece. Nas *Ferramentas do desenvolvedor → Rede*, o `PUT` vai para `storage.googleapis.com` |
| 5 | **Anexar** um PDF | Aparece na lista de arquivos, com o tamanho |
| 6 | Mudar a tarefa para **Em andamento** | Muda de coluna |
| 7 | **Compartilhar** → *Somente leitura* → **Gerar link** | Link exibido **uma única vez** |
| 8 | Abrir o link em **janela anônima** | Projeto visível, com a imagem, **sem** botões de edição |
| 9 | Gerar outro link com *Pode editar tarefas* | O visitante altera o status |
| 10 | **Revogar** o link e recarregar a janela anônima | "Este link é inválido, expirou ou foi revogado" |
| 11 | Abrir **Histórico** | Eventos do MongoDB (inclusive as ações do visitante) |
| 12 | Anexar arquivo `.exe` ou acima de 10 MB | Recusado |

### 1.3 Provas de segurança

```bash
# O bucket recusa acesso anonimo (esperado: 401 ou 403)
curl -s -o /dev/null -w "%{http_code}\n" "https://storage.googleapis.com/$BUCKET/qualquer"

# O Swagger fica desligado em producao (esperado: 404)
curl -s -o /dev/null -w "%{http_code}\n" "https://$PROJECT_ID.web.app/api/docs"

# O Cloud SQL nao tem IP publico (esperado: so PRIVATE)
gcloud sql instances describe "$SQL_INSTANCE" --format="value(ipAddresses.type)"

# Ninguem le os segredos alem da API (esperado: so a conta todo-api-sa)
gcloud secrets get-iam-policy todo-jwt-secret --format="yaml(bindings)"

# A conta de servico nao tem papeis amplos no projeto
gcloud projects get-iam-policy "$PROJECT_ID" \
  --flatten="bindings[].members" --filter="bindings.members:$SA_EMAIL" --format="table(bindings.role)"
# (resultado esperado: vazio; as permissoes estao nos recursos)
```

### 1.4 O que cada teste prova

| Teste | Prova que… |
|---|---|
| `/api/health/ready` com `postgres: up` | VPC, peering, IP privado, `DATABASE_URL` e o segredo funcionam |
| `mongo: up` | O Atlas aceita a conexão do Cloud Run e o `MONGODB_URI` está correto |
| Upload e download pela signed URL | O bucket, o CORS, o `signBlob` e o papel `objectUser` estão certos |
| `/api/...` no domínio `web.app` | O rewrite do Firebase Hosting alcança o Cloud Run |
| Link anônimo (leitura, edição, revogação) | A regra de negócio e a proteção por token funcionam |
| Histórico com eventos de visitante | O Mongo registra a atividade mesmo de quem não tem conta |

### 1.5 Onde olhar quando algo der errado

| Onde | Como |
|---|---|
| Logs da API | `gcloud run services logs read "$SERVICE" --region="$REGION" --limit=100` ou **Cloud Run → todo-api → Registros** |
| Logs do job | **Cloud Run → Jobs → todo-api-migrate → Execuções → Registros** |
| Logs do build | **Cloud Build → Histórico** |
| Métricas | **Cloud Run → todo-api → Métricas** (requisições, latência, instâncias) |
| Banco | **Cloud SQL → todo-pg → Visão geral / Consultas** |
| Hosting | **Firebase → Hosting** (versões e reversão) |

---

## 2. Custo total

Todos os valores em **USD**, `us-central1`, preços oficiais consultados em 20/09/2026, 730 horas/mês. Cada linha detalha-se no capítulo indicado.

| Recurso | Capítulo | Uma sessão (~6 h ligado) | Mês inteiro ligado |
|---|---|---|---|
| Projeto, APIs, orçamento | [2](02-projeto-gcp-e-ferramentas.md) | 0,00 | 0,00 |
| VPC, sub-rede, peering, Direct VPC egress | [3](03-rede-vpc-e-conexao-privada.md) | 0,00 | 0,00 |
| **Cloud SQL** `db-f1-micro` + 10 GiB SSD | [4](04-cloud-sql-postgresql.md) | **0,08** | **9,37** |
| MongoDB Atlas M0 | [5](05-mongodb-atlas.md) | 0,00 | 0,00 |
| Cloud Storage | [6](06-cloud-storage.md) | 0,00 | 0,00 |
| Secret Manager | [7](07-secret-manager.md) | 0,00 | 0,00 |
| Artifact Registry + Cloud Build | [8](08-artifact-registry-e-cloud-build.md) | 0,00 | 0,00 a 0,05 |
| Cloud Run (serviço + job) | [9](09-cloud-run.md) | 0,00 | 0,00 |
| Firebase Hosting | [10](10-firebase-hosting.md) | 0,00 | 0,00 |
| **Total do caminho principal** | | **≈ US$ 0,08** | **≈ US$ 9,37 a 9,42** |

Opcionais (não fazem parte do caminho principal):

| Opcional | Onde | Uma sessão | Mês inteiro |
|---|---|---|---|
| Cloud NAT + IP estático (endurecer o Atlas) | [3](03-rede-vpc-e-conexao-privada.md) | ~0,03 | 3,65 a 4,67 |
| Serviço com 1 instância mínima (sem *cold start*) | [9](09-cloud-run.md) | ~0,08 | ~9,72 |
| Endpoint Private Service Connect (comparativo) | [3](03-rede-vpc-e-conexao-privada.md) | ~0,06 | ~7,30 |
| Instância Cloud SQL maior (`db-g1-small`) | [4](04-cloud-sql-postgresql.md) | ~0,21 | ~25,55 + disco |

> **Leitura correta da tabela:** tudo, exceto o **Cloud SQL**, cabe nas cotas gratuitas. O banco é o único item que cobra por hora, e é por isso que **a limpeza faz parte da atividade**. Se o Cloud SQL for esquecido por um mês: ≈ US$ 9,37.

Como o custo cresce com o uso (referência):

| Se o app tiver… | O que passa a cobrar |
|---|---|
| Mais de ~900 mil requisições/mês | Cloud Run (US$ 0,000024 por vCPU-s acima da cota) |
| Mais de 5 GB de arquivos | Cloud Storage (US$ 0,02/GiB-mês) |
| Mais de 6 segredos | Secret Manager (US$ 0,06/versão-mês) |
| Mais de 512 MB no Mongo | Precisa migrar para um cluster Atlas pago |
| Mais de 10 GB de front | Firebase Hosting (US$ 0,026/GB) |

---

## 3. Limpeza

> Sem alerta de orçamento, uma instância esquecida só é notada na fatura. **Só dê a atividade por encerrada depois de apagar tudo.**

### Opção A — apagar o projeto inteiro (mais simples e mais segura)

Apagar o projeto desliga **todos** os recursos do GCP de uma vez: Cloud SQL, Cloud Run, VPC, bucket, segredos, registro e Firebase. O projeto pode ser recuperado por até **30 dias** e o **ID nunca mais pode ser reutilizado**.

```bash
gcloud projects delete "$PROJECT_ID"
```

**Console:** **☰ → IAM e administrador → Configurações** → **Encerrar** (*Shut down*) → digite o ID do projeto e confirme.

### Opção B — recurso por recurso (projeto compartilhado ou que será reaproveitado)

A **ordem** importa: quem usa vem antes de quem é usado.

```bash
source ~/todo-aula.env

# 1) Hosting (front-end)
npx --yes firebase-tools@latest hosting:disable --project "$PROJECT_ID" --force

# 2) Cloud Run (serviço e job)
gcloud run services delete "$SERVICE" --region="$REGION" --quiet
gcloud run jobs delete "$JOB" --region="$REGION" --quiet

# 3) Cloud SQL (o item que cobra por hora)
gcloud sql instances delete "$SQL_INSTANCE" --quiet

# 4) Bucket (apaga os arquivos junto)
gcloud storage rm --recursive "gs://$BUCKET"

# 5) Imagens
gcloud artifacts repositories delete "$REPO" --location="$REGION" --quiet

# 6) Segredos
for S in todo-db-password todo-mongodb-uri todo-jwt-secret todo-database-url; do
  gcloud secrets delete "$S" --quiet
done

# 7) Contas de servico
gcloud iam service-accounts delete "$SA_EMAIL" --quiet
gcloud iam service-accounts delete "todo-build-sa@${PROJECT_ID}.iam.gserviceaccount.com" --quiet

# 8) Cloud NAT e IP (somente se voce fez o endurecimento)
gcloud compute routers nats delete todo-nat --router=todo-router --region="$REGION" --quiet
gcloud compute routers delete todo-router --region="$REGION" --quiet
gcloud compute addresses delete todo-nat-ip --region="$REGION" --quiet

# 9) Rede (so depois de apagar o Cloud SQL; a sub-rede so libera 1 a 2 h depois do Cloud Run)
gcloud services vpc-peerings delete --network="$VPC" --quiet
gcloud compute addresses delete "$PSA_RANGE" --global --quiet
gcloud compute networks subnets delete "$SUBNET" --region="$REGION" --quiet
gcloud compute networks delete "$VPC" --quiet
```

**Console** (mesma ordem): **Firebase → Hosting → ⋮ → Desativar site**; **Cloud Run** (serviço e job → *Excluir*); **Cloud SQL → todo-pg → Excluir**; **Cloud Storage → bucket → Excluir**; **Artifact Registry → todo → Excluir**; **Secret Manager → cada segredo → Excluir**; **IAM → Contas de serviço → Excluir**; **Rede VPC** (peering em *Acesso privado a serviços*, intervalo alocado, sub-rede e rede).

### MongoDB Atlas

O Atlas **não é apagado** pela exclusão do projeto do GCP.

1. **Database → Clusters →** `todo` → **⋯ → Terminate**.
2. **Security → Network Access:** remova a entrada `0.0.0.0/0` (se ainda existir) e qualquer IP do NAT.
3. **Security → Database Access:** remova o usuário `todo_app`.
4. Se a senha do Atlas foi exposta em algum momento (chat, e-mail, arquivo `atlas-credentials.env`), o passo 3 já a invalida.

### Máquina local

```bash
cd todo-api && docker compose down -v        # containers e volumes com dados de teste
rm -f ~/todo-aula.env /tmp/todo-api-env.yaml /tmp/gcs-cors.json
unset PROJECT_ID BILLING_ACCOUNT BUILD_SA API_URL SITE_URL
```

### Conferir que nada ficou ligado

```bash
gcloud sql instances list
gcloud run services list
gcloud compute addresses list
gcloud compute networks list
```

No Console, **Faturamento → Relatórios** mostra o custo por serviço; confira no dia seguinte.

---

## 4. Problemas comuns (visão geral)

| Situação | O que costuma ser |
|---|---|
| Tudo funciona menos o upload | CORS do bucket ([cap. 6](06-cloud-storage.md)) ou `serviceAccountTokenCreator` ([cap. 7](07-secret-manager.md)) |
| API sobe mas `mongo: down` | *IP Access List* do Atlas ([cap. 5](05-mongodb-atlas.md)) |
| API não sobe (`failed to start and listen on the port`) | Variável/segredo errado ou banco inacessível: leia os logs ([cap. 9](09-cloud-run.md)) |
| `/api` devolve HTML | Ordem das regras do `firebase.json` ([cap. 10](10-firebase-hosting.md)) |
| Limite de conexões no Postgres | `DB_POOL_MAX` e `--max-instances` ([cap. 4](04-cloud-sql-postgresql.md)) |
| Conta institucional (escola/empresa) bloqueia recursos | **Políticas de organização** (por exemplo, restrição de domínios no IAM ou de IPs públicos). Use conta pessoal ou peça a exceção ao administrador |

---

[← Firebase Hosting](10-firebase-hosting.md) · [README](../README.md)
