# 4. Cloud SQL: PostgreSQL 18 com IP privado

O Cloud SQL é o PostgreSQL **gerenciado** do Google: ele cuida de instalação, atualização de segurança, disco e (opcionalmente) backup e alta disponibilidade. Vamos criar a menor instância possível, **sem IP público**, dentro da VPC do capítulo 3.

[← Rede](03-rede-vpc-e-conexao-privada.md) · [README](../README.md) · [Próximo: MongoDB Atlas →](05-mongodb-atlas.md)

## Conceitos

| Termo | Explicação |
|---|---|
| **Edição Enterprise × Enterprise Plus** | A partir do PostgreSQL 16 a edição **padrão é a Enterprise Plus** (mais cara). As máquinas *shared-core* só existem na **Enterprise**, por isso passamos `--edition=enterprise` |
| **Shared-core (`db-f1-micro`)** | CPU compartilhada, 0,6 GiB de RAM. É a menor e mais barata. **Não tem SLA**: serve para estudo e testes |
| **Zonal × Regional** | Zonal = uma zona (barato). Regional = alta disponibilidade, com uma instância reserva (custa o dobro) |
| **IP privado** | O banco só é alcançável de dentro da VPC (via peering do capítulo 3). Não há porta aberta na internet |

## O que vamos criar

| Configuração | Valor | Observação |
|---|---|---|
| ID da instância | `todo-pg` | `$SQL_INSTANCE` |
| Versão | **PostgreSQL 18** (`POSTGRES_18`) | Versão padrão do Cloud SQL em 20/09/2026; **não pode ser alterada** depois de criada |
| Edição | Enterprise | Obrigatória para shared-core |
| Tipo de máquina | `db-f1-micro` (shared-core) | Sem SLA |
| Região | `us-central1` | |
| Disponibilidade | Zonal | Sem alta disponibilidade (lab) |
| Armazenamento | SSD, **10 GiB** (mínimo), sem aumento automático | Evita crescimento permanente e surpresa na fatura |
| Backups | Desativados | **Ative em produção** |
| Proteção contra exclusão | Desativada | **Ative em produção** |
| Conectividade | **Somente IP privado**, VPC `todo-vpc` | `--network` + `--no-assign-ip` |
| Banco | `todo` | `$DB_NAME` |
| Usuário da aplicação | `todo_app` | `$DB_USER`, senha aleatória |

## Passo 1 — Criar a instância

**Terminal** (leva de 5 a 10 minutos)

```bash
source ~/todo-aula.env

# Senha do usuario administrador "postgres" (nao sera usada no dia a dia)
export POSTGRES_ROOT_PASSWORD="$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")"

gcloud sql instances create "$SQL_INSTANCE" \
  --database-version=POSTGRES_18 \
  --edition=enterprise \
  --tier=db-f1-micro \
  --region="$REGION" \
  --availability-type=zonal \
  --storage-type=SSD \
  --storage-size=10 \
  --no-storage-auto-increase \
  --no-backup \
  --no-deletion-protection \
  --network="projects/$PROJECT_ID/global/networks/$VPC" \
  --no-assign-ip \
  --root-password="$POSTGRES_ROOT_PASSWORD" \
  --project="$PROJECT_ID"
```

| Flag | Por quê |
|---|---|
| `--database-version=POSTGRES_18` | Versão principal |
| `--edition=enterprise` | Sem isso o PostgreSQL 16+ assume Enterprise Plus |
| `--tier=db-f1-micro` | Máquina compartilhada, a mais barata |
| `--storage-size=10` / `--no-storage-auto-increase` | 10 GiB fixos; o disco só cresce e **nunca diminui**, então não deixamos crescer sozinho |
| `--no-backup` | Backups armazenados são cobrados (US$ 0,08/GiB-mês) |
| `--network` + `--no-assign-ip` | IP privado via peering e **sem IP público** |
| `--root-password` | Define a senha do usuário `postgres` |

**Console**

1. **☰ → SQL** (Cloud SQL) → **Criar instância**.
2. Escolha **PostgreSQL**. Em *Escolha uma edição do Cloud SQL* selecione **Enterprise** e, em *Predefinição de edição*, **Sandbox** (ou ajuste manualmente abaixo).
3. **Versão do banco de dados:** *PostgreSQL 18*. **ID da instância:** `todo-pg`. **Senha do usuário postgres:** clique em *Gerar* e guarde-a.
4. **Região:** `us-central1`. **Disponibilidade por zona:** *Zona única*.
5. Expanda **Mostrar opções de configuração**:
   - **Tipo de máquina:** *Núcleo compartilhado* → **1 vCPU, 0,6 GB** (`db-f1-micro`).
   - **Armazenamento:** *SSD*, capacidade **10 GB**, **desmarque** *Ativar aumentos automáticos de armazenamento*.
   - **Conexões:** **desmarque** *IP público*; marque **IP privado**, marque **Acesso a serviços privados**, escolha a rede `todo-vpc` e, em *Intervalo de IP alocado*, **Automático** (ou `todo-psa-range`).
   - **Proteção de dados:** desmarque *Backups automáticos* e *Ativar proteção contra exclusão*.
6. Clique em **Criar instância**.

Se o Console disser que falta configurar a conexão privada, clique em **Configurar conexão**; ele repete os passos 2 e 3 do capítulo 3.

## Passo 2 — Banco de dados e usuário da aplicação

A API **não** usa o usuário `postgres` (administrador). Criamos um usuário próprio e um banco.

**Terminal**

```bash
export DB_PASSWORD="$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")"

gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE"
gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASSWORD"

gcloud sql databases list --instance="$SQL_INSTANCE"
gcloud sql users list --instance="$SQL_INSTANCE"
```

> `base64url` só gera letras, números, `-` e `_`, então a senha não precisa de escape quando entrar na URL de conexão.

**Console**

1. Abra a instância `todo-pg`.
2. Menu lateral **Bancos de dados → Criar banco de dados**: nome `todo` → **Criar**.
3. Menu lateral **Usuários → Adicionar conta de usuário**: *Autenticação integrada*, nome `todo_app`, senha (gere uma aleatória e anote) → **Adicionar**.

## Passo 3 — Guardar a senha (Secret Manager)

O terminal em que `DB_PASSWORD` existe pode ser fechado; a senha não pode ficar só na memória. Guardamos já no Secret Manager (detalhes no [capítulo 7](07-secret-manager.md)):

```bash
printf '%s' "$DB_PASSWORD" | gcloud secrets create todo-db-password \
  --replication-policy=automatic --data-file=- --project="$PROJECT_ID"

unset DB_PASSWORD POSTGRES_ROOT_PASSWORD    # tire as senhas da memoria do terminal
```

> A senha do `postgres` (administrador) foi só gerada e descartada: não precisamos dela. Se um dia precisar, redefina com `gcloud sql users set-password postgres --instance=$SQL_INSTANCE --password=...`.

## Passo 4 — Descobrir o IP privado

```bash
export DB_PRIVATE_IP="$(gcloud sql instances describe "$SQL_INSTANCE" --format='value(ipAddresses[0].ipAddress)')"
echo "$DB_PRIVATE_IP"        # algo como 10.x.x.x ou 172.x.x.x (dentro da faixa todo-psa-range)

gcloud sql instances describe "$SQL_INSTANCE" --format="table(ipAddresses.type,ipAddresses.ipAddress)"   # PRIVATE
```

No Console: instância → **Visão geral** → **Conectar a esta instância** → *Endereço IP privado*.

O **`DATABASE_URL`** que a API usará será:

```text
postgresql://todo_app:SENHA@IP_PRIVADO:5432/todo
```

Ele é montado e guardado como segredo no capítulo 7.

## Verificação

```bash
gcloud sql instances describe "$SQL_INSTANCE" \
  --format="value(state,databaseVersion,settings.tier,settings.edition,settings.availabilityType)"
# RUNNABLE  POSTGRES_18  db-f1-micro  ENTERPRISE  ZONAL
```

| Verificação | Esperado |
|---|---|
| Estado | `RUNNABLE` |
| Versão / tipo | `POSTGRES_18` / `db-f1-micro` |
| IP | Um único IP do tipo `PRIVATE` |
| Banco e usuário | `todo` e `todo_app` listados |

> **Não dá para "conectar" da sua máquina.** O banco é privado por projeto: o teste real de conectividade acontece no [capítulo 9](09-cloud-run.md), quando o Job de migrations (que está dentro da VPC) o alcançar.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `SERVICE_NETWORKING_NOT_ENABLED` / `NETWORK_NOT_PEERED` | Peering não configurado | Volte ao [capítulo 3](03-rede-vpc-e-conexao-privada.md), passos 2 e 3 |
| Criou sem `--edition` e veio **Enterprise Plus** | Padrão do PostgreSQL 16+ | Apague e recrie com `--edition=enterprise` (a edição só pode ser trocada com upgrade) |
| `Invalid tier [db-f1-micro] for (ENTERPRISE_PLUS)` | Mesma causa | Idem |
| Migration falha com `permission denied for schema public` | O usuário da aplicação não pode criar objetos no schema `public` | Console → instância → **Cloud SQL Studio**, entre como `postgres` e rode `GRANT ALL ON SCHEMA public TO todo_app;` |
| `too many connections` | `db-f1-micro` tem poucas conexões | Mantenha `DB_POOL_MAX=3` e no máximo 2 instâncias no Cloud Run |

## Custos deste capítulo

Fonte: [Cloud SQL pricing](https://cloud.google.com/sql/pricing), `us-central1`, consultada em 20/09/2026. Considera 730 horas/mês.

| Item | Preço oficial | Cálculo | Estimativa mensal |
|---|---|---|---|
| Instância `db-f1-micro` (zonal) | US$ 0,0105/h | 0,0105 × 730 | US$ 7,67 |
| Armazenamento SSD | US$ 0,000232877/GiB-h (≈ US$ 0,17/GiB-mês) | 10 GiB × 0,000232877 × 730 | US$ 1,70 |
| Backups | US$ 0,08/GiB-mês | desativados | US$ 0,00 |
| IPv4 público | US$ 0,01/h (quando ocioso) | sem IP público | US$ 0,00 |
| Tráfego dentro da região | Gratuito para clientes na mesma região | poucos MB | US$ 0,00 |
| **Total ligado o mês inteiro** | | | **≈ US$ 9,37** |
| **Total de uma aula de 6 h** | | (0,0105 + 0,00233) × 6 | **≈ US$ 0,08** |

Para comparar:

| Alternativa | Custo mensal (mesma região) |
|---|---|
| `db-g1-small` (1,7 GiB) | US$ 0,035/h → US$ 25,55 + disco |
| `db-f1-micro` **regional** (alta disponibilidade) | US$ 0,021/h → US$ 15,33 + disco |
| Disco HDD em vez de SSD | US$ 0,000123288/GiB-h → US$ 0,90 por 10 GiB |
| **Instância de teste gratuita** (Console → Cloud SQL → *Começar*) | US$ 0 por 30 dias em projeto novo; é uma Enterprise Plus grande (8 vCPU/64 GB), criada por um assistente próprio do Console, e não segue este roteiro. Só vale em **projeto novo** (uma por projeto) |

> **Apague a instância ao terminar** ([capítulo 11](11-validacao-custos-e-limpeza.md)). Esquecida por um mês, é o único item da aula que gera fatura relevante.

---

[← Rede](03-rede-vpc-e-conexao-privada.md) · [README](../README.md) · [Próximo: MongoDB Atlas →](05-mongodb-atlas.md)
