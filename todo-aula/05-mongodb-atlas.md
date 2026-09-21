# 5. MongoDB Atlas (M0) rodando em Google Cloud

O histórico de atividades do app fica em **MongoDB** e **o banco não muda**: continua sendo Mongo, com o mesmo driver (Mongoose) e as mesmas consultas do ambiente local. O GCP não tem um Mongo nativo, então usamos o **MongoDB Atlas**, o serviço gerenciado da própria MongoDB Inc., escolhendo **Google Cloud** como provedor para ficar na mesma região da API.

[← Cloud SQL](04-cloud-sql-postgresql.md) · [README](../README.md) · [Próximo: Cloud Storage →](06-cloud-storage.md)

> O Atlas **não é um produto do GCP**: a conta, a fatura e o painel são da MongoDB. O cluster apenas roda em datacenters do Google.

## Opções para hospedar o Mongo

| Opção | Continua sendo MongoDB? | Custo | Rede privada com o Cloud Run | Quando usar |
|---|---|---|---|---|
| **Atlas M0 (gratuito)** ← usamos | Sim (8.0) | Gratuito | **Não** (sem peering nem PSC) | Estudo e protótipos |
| Atlas M10 ou superior | Sim | Pago (consulte a página de preços do Atlas) | Sim: Private Service Connect ou VPC peering | Produção |
| MongoDB em VM (Compute Engine) | Sim | VM + disco + sua operação | Sim (mesma VPC) | Quando é preciso controle total |
| Firestore com compatibilidade MongoDB | **Não** é o mesmo produto | Por uso | Sim | Fora do escopo: pediria testar todas as consultas |

## Limites do M0 (documentação oficial do Atlas)

| Limite | Valor |
|---|---|
| Versão do MongoDB | 8.0 |
| Armazenamento | 0,5 GB (512 MB) |
| Conexões simultâneas | 500 |
| Operações por segundo | 100 |
| Transferência | 10 GB de entrada e 10 GB de saída por período móvel de 7 dias |
| Rede privada | **Sem** peering e **sem** endpoints privados |
| Backups | Não disponíveis (use `mongodump`) |
| Clusters por projeto | 1 |
| Inatividade | O Atlas **pausa** o cluster após 30 dias sem conexões (dá para retomar) |
| Nome do banco | Até 38 bytes |

Por isso o app tem um índice **TTL** na coleção `activities`: o próprio Mongo apaga registros com mais de 90 dias e o cluster não enche.

## O que vamos criar

| Item | Valor | Observação |
|---|---|---|
| Projeto no Atlas | `todo-aula` | |
| Cluster | `todo` (**Free / M0**) | |
| Provedor | **Google Cloud** | |
| Região | **Iowa (`us-central1`)** | Se a região não estiver disponível para o plano Free, escolha a mais próxima disponível (o console mostra as opções) |
| Usuário do banco | `todo_app` | Senha aleatória. Papel `readWrite` **somente** no banco `todo` |
| Acesso de rede | `0.0.0.0/0`, **temporário** | Laboratório; veja o [aviso de segurança](#aviso-de-segurança-o-acesso-00000-é-uma-falha-conhecida) |
| Banco | `todo` | Criado automaticamente pelo app na primeira gravação |

## Passo 1 — Criar a conta, o projeto e o cluster

**Console (Atlas)**

1. Acesse [cloud.mongodb.com](https://cloud.mongodb.com/) e crie a conta (o plano Free não pede cartão).
2. Crie uma **Organização** e um **Projeto** chamado `todo-aula`.
3. Clique em **Create** (Create a deployment) e escolha **Free**.
4. **Name:** `todo`. **Provider:** *Google Cloud*. **Region:** *Iowa (us-central1)*.
5. Clique em **Create Deployment**. O assistente seguinte oferece criar um usuário e liberar um IP; pode pular, faremos manualmente nos passos 2 e 3.

**Terminal (Atlas CLI)** — opcional

```bash
# Instale a CLI: https://www.mongodb.com/docs/atlas/cli/current/install-atlas-cli/
atlas auth login
atlas projects create todo-aula                       # anote o projectId
export ATLAS_PROJECT_ID="<projectId>"

atlas clusters create todo \
  --projectId "$ATLAS_PROJECT_ID" \
  --provider GCP --region CENTRAL_US --tier M0 --watch
```

## Passo 2 — Criar o usuário do banco (menor privilégio)

A aplicação **não** precisa ser administradora. Damos apenas `readWrite` no banco `todo`.

```bash
export MONGO_PASSWORD="$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")"
```

**Console (Atlas)**

1. Menu **Security → Database Access → Add New Database User**.
2. **Authentication Method:** *Password*. **Username:** `todo_app`. **Password:** cole o valor de `$MONGO_PASSWORD` (`echo "$MONGO_PASSWORD"`).
3. Em **Database User Privileges**, escolha **Specific Privileges** → *Add Specific Privilege*: role `readWrite`, database `todo`. **Remova** o papel `Atlas admin` padrão.
4. Clique em **Add User**.

**Terminal (Atlas CLI)**

```bash
atlas dbusers create --projectId "$ATLAS_PROJECT_ID" \
  --username todo_app --password "$MONGO_PASSWORD" \
  --role readWrite@todo
```

> Se a senha de um usuário aparecer em chat, e-mail, print ou repositório, **considere-a comprometida**: em *Database Access → Edit → Edit Password* defina outra. O Atlas oferece um arquivo `atlas-credentials.env` no assistente de criação; **não o versione**.

## Passo 3 — Liberar o acesso de rede

O Atlas só aceita conexões de IPs cadastrados na **IP Access List**. O Cloud Run não tem IP de saída fixo, e o M0 não tem rede privada. Para a aula usamos `0.0.0.0/0` **com prazo de validade**.

**Console (Atlas)**

1. **Security → Network Access → Add IP Address**.
2. Clique em **Allow Access from Anywhere** (preenche `0.0.0.0/0`).
3. Marque **Save as temporary access list** e escolha **1 day** (as opções são 6 horas, 1 dia ou 1 semana).
4. Confirme. O Atlas envia um e-mail de alerta a quem participa do projeto: é esperado.

**Terminal (Atlas CLI)**

```bash
atlas accessLists create 0.0.0.0/0 --type cidrBlock \
  --comment "laboratorio - remover ao final da aula" \
  --deleteAfter "$(date -u -d '+1 day' +%Y-%m-%dT%H:%M:%SZ)" \
  --projectId "$ATLAS_PROJECT_ID"
```

> No macOS use `date -u -v+1d +%Y-%m-%dT%H:%M:%SZ`.

## Passo 4 — Pegar a string de conexão

**Console (Atlas)**

1. **Database → Clusters →** botão **Connect** do cluster `todo`.
2. Escolha **Drivers** (Node.js) e copie a URI:

```text
mongodb+srv://todo_app:<password>@todo.xxxxxxx.mongodb.net/?retryWrites=true&w=majority&appName=todo
```

**Terminal (Atlas CLI)**

```bash
atlas clusters connectionStrings describe todo --projectId "$ATLAS_PROJECT_ID"
```

Monte a URI final trocando `<password>` pela senha real:

```bash
export MONGODB_URI="mongodb+srv://todo_app:${MONGO_PASSWORD}@todo.xxxxxxx.mongodb.net/?retryWrites=true&w=majority&appName=todo"
```

| Parte da URI | Significado |
|---|---|
| `mongodb+srv://` | Usa DNS SRV: o driver descobre os 3 nós do cluster e usa **TLS por padrão** |
| `todo_app:senha` | Usuário e senha. A senha `base64url` não precisa de escape |
| `todo.xxxxxxx.mongodb.net` | Nome do cluster (fornecido pelo Atlas) |
| `retryWrites=true&w=majority` | Boas práticas de escrita em réplica |

A URI **não leva o nome do banco**: a API o recebe em `MONGODB_DB=todo` (variável do Cloud Run).

**Guarde a URI agora no Secret Manager** (detalhes no [capítulo 7](07-secret-manager.md)) e limpe a memória do terminal. **Não a salve em arquivos.**

```bash
source ~/todo-aula.env
printf '%s' "$MONGODB_URI" | gcloud secrets create todo-mongodb-uri \
  --replication-policy=automatic --data-file=- --project="$PROJECT_ID"

unset MONGO_PASSWORD MONGODB_URI
```

## Passo 5 — Testar de fora (opcional, para a discussão de segurança)

```bash
npx --yes mongosh "$(gcloud secrets versions access latest --secret=todo-mongodb-uri)" \
  --eval "db.runCommand({ ping: 1 })"
# { ok: 1 }
```

Com `0.0.0.0/0` **qualquer computador com a senha** conecta, inclusive o seu. Guarde este resultado para a discussão abaixo.

---

## Aviso de segurança: o acesso `0.0.0.0/0` é uma falha conhecida

Abrir o banco para **qualquer IP** deixa a defesa apenas na senha. A documentação do Atlas alerta que isso pode expor o deployment a acesso não autorizado, exfiltração de dados e outras atividades maliciosas (tradução livre), e o Atlas envia e-mail de aviso sempre que uma entrada `/0` é criada. Aceitamos na aula porque:

| Mitigação aplicada | Efeito |
|---|---|
| Usuário com `readWrite` **só** no banco `todo` | Um vazamento não dá acesso administrativo |
| Senha aleatória de 32 caracteres | Inviabiliza força bruta |
| TLS (`mongodb+srv`) | Tráfego criptografado |
| Dados fictícios | Nada sensível a vazar |
| Entrada **temporária** (6 h, 1 dia ou 1 semana) | O buraco fecha sozinho |
| Senha no **Secret Manager** | Nunca em arquivo ou código |
| Cluster apagado após a aula | Superfície de ataque zerada |

### Como corrigir (demonstração em aula)

| Nível | Como | Custo adicional | Resultado |
|---|---|---|---|
| **Bom** | **IP fixo**: `--vpc-egress=all-traffic` + Cloud NAT com IP estático ([capítulo 3](03-rede-vpc-e-conexao-privada.md#endurecimento-opcional-cloud-nat-com-ip-fixo)). Substitua `0.0.0.0/0` pelo IP do NAT na *IP Access List* | ~US$ 3,65 a 4,67/mês | Só a sua API conecta; a senha sozinha não basta |
| **Melhor** | Atlas **M10+** com **Private Service Connect** ou peering | Plano pago do Atlas | Sem exposição à internet |

Roteiro da demonstração:

1. Rode o teste do Passo 5 no seu computador → funciona (falha demonstrada).
2. Crie o NAT, faça o deploy com `all-traffic` e cadastre o IP do NAT no Atlas.
3. **Remova** a entrada `0.0.0.0/0`.
4. Repita o teste do Passo 5 → agora **falha** (`connection timed out` / `MongoServerSelectionError`), e a API no Cloud Run continua funcionando.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `MongoServerSelectionError` / `connection timed out` | IP não está na *IP Access List* (ou a entrada temporária expirou) | Recrie a entrada; confira o IP do NAT se estiver no modo "IP fixo" |
| `bad auth : Authentication failed` | Senha errada ou usuário sem o banco certo | Redefina a senha; confira o papel `readWrite@todo` |
| `querySrv ENOTFOUND` | Sem DNS/sem internet | Teste outra rede |
| Aplicação lenta na primeira consulta | Cluster M0 "acordando" ou 100 ops/s excedidos | Aguarde; o M0 limita a taxa |
| Cluster pausado | 30 dias sem conexões | Clique em **Resume** no painel |

## Custos deste capítulo

Fontes: [limites do plano Free do Atlas](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) e [preços do Cloud Run](https://cloud.google.com/run/pricing) (tráfego de saída), consultadas em 20/09/2026.

| Item | Preço | Estimativa mensal |
|---|---|---|
| Cluster Atlas M0 (Free) | Gratuito, sem cartão | US$ 0,00 |
| Tráfego de saída do Cloud Run para o Atlas | 1 GiB/mês gratuito na América do Norte; acima disso, tarifa de saída para a internet (Premium) | US$ 0,00 (poucos MB) |
| Cloud NAT + IP fixo (só se fizer o endurecimento) | Veja o [capítulo 3](03-rede-vpc-e-conexao-privada.md#custos-deste-capítulo) | +US$ 3,65 a 4,67 |
| **Total do caminho principal** | | **US$ 0,00** |

---

[← Cloud SQL](04-cloud-sql-postgresql.md) · [README](../README.md) · [Próximo: Cloud Storage →](06-cloud-storage.md)
