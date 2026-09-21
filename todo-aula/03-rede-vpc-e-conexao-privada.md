# 3. Rede: VPC, peering e conexão privada

O banco PostgreSQL **não terá IP público**. Para a API (no Cloud Run) alcançá-lo, precisamos de uma rede privada entre os dois. Este capítulo monta essa rede e compara as duas formas oficiais de fazer isso: **peering (Private Services Access)** e **Private Service Connect (PSC)**.

[← Projeto no GCP](02-projeto-gcp-e-ferramentas.md) · [README](../README.md) · [Próximo: Cloud SQL →](04-cloud-sql-postgresql.md)

## Conceitos

| Termo | O que é |
|---|---|
| **VPC** (Virtual Private Cloud) | Rede privada e isolada dentro do seu projeto. Recursos dentro dela se falam por IP interno |
| **Sub-rede (subnet)** | Faixa de IPs da VPC em **uma região**. O Cloud Run vai pegar seus IPs daqui |
| **Private Services Access (PSA)** | Conexão de **VPC Network Peering** entre a sua VPC e uma rede que o Google gerencia (onde o Cloud SQL mora). Você reserva uma faixa de IPs e o Cloud SQL usa um IP dela |
| **Private Service Connect (PSC)** | Alternativa: em vez de juntar duas redes, você cria um **endpoint** (um IP interno seu) que aponta para o serviço |
| **Direct VPC egress** | Faz o Cloud Run enviar tráfego de saída **direto** para uma sub-rede da VPC, sem conector intermediário |
| **Cloud NAT** | Dá a recursos sem IP público uma saída para a internet com **IP fixo** (opcional, veja o final do capítulo) |

## Peering (PSA) × Private Service Connect

| | Private Services Access (peering) | Private Service Connect |
|---|---|---|
| Modelo | Duas redes conectadas (VPC Network Peering) | Um endpoint (IP interno) na **sua** VPC aponta para o serviço |
| Como o cliente chega ao banco | IP do Cloud SQL dentro da faixa reservada | IP do endpoint que você criou |
| Faixa de IPs | Você reserva uma faixa (ex.: `/16`) **exclusiva** para os serviços do Google | Consome só **1 IP** por endpoint, da sua sub-rede |
| Risco de conflito de IPs | Existe: a faixa reservada não pode se sobrepor à sua rede nem a redes conectadas | Não existe: as redes nunca se juntam |
| Acesso de outras redes (VPN, outras VPCs) | Precisa exportar rotas do peering | O endpoint é acessível conforme suas rotas normais |
| Custo extra | Nenhum | Endpoint: **US$ 0,01/h** (~US$ 7,30/mês) + processamento de dados |
| Configuração | Mais simples (é o assistente do Console) | Mais passos (instância PSC, endpoint, regra de encaminhamento) |
| Indicado para | A maioria dos projetos; **nossa aula** | Muitos clientes/projetos, redes com IPs sobrepostos, isolamento forte |

> **Nesta aula usamos o peering.** É o mais simples, gratuito e é a configuração que o próprio assistente de criação do Cloud SQL sugere. A seção [Alternativa: PSC](#alternativa-private-service-connect) mostra os comandos equivalentes para comparar.

## O que vamos criar

| Recurso | Nome | Configuração | Observação |
|---|---|---|---|
| Rede VPC | `todo-vpc` | Modo **personalizado** (custom), roteamento regional | Sem sub-redes automáticas |
| Sub-rede | `todo-subnet-run` | Região `us-central1`, IPv4 `10.10.0.0/24`, Acesso privado do Google **ativado** | Onde o Cloud Run pega IPs. A documentação exige **/26 ou maior** |
| Faixa alocada (PSA) | `todo-psa-range` | Finalidade `VPC_PEERING`, prefixo `/16`, automática | Reservada ao Cloud SQL. Não pode se sobrepor à `10.10.0.0/24` |
| Conexão privada | `servicenetworking-googleapis-com` (nome criado pelo Google) | VPC Network Peering com `servicenetworking.googleapis.com` | Une a `todo-vpc` à rede do Cloud SQL |

> Os nomes vêm de `~/todo-aula.env` (`VPC`, `SUBNET`, `SUBNET_RANGE`, `PSA_RANGE`). Rode `source ~/todo-aula.env`.

## Passo 1 — Criar a VPC e a sub-rede

**Terminal**

```bash
gcloud compute networks create "$VPC" \
  --subnet-mode=custom \
  --project="$PROJECT_ID"

gcloud compute networks subnets create "$SUBNET" \
  --network="$VPC" \
  --region="$REGION" \
  --range="$SUBNET_RANGE" \
  --enable-private-ip-google-access \
  --project="$PROJECT_ID"

gcloud compute networks subnets list --network="$VPC"
```

**Console**

1. **☰ → Rede VPC → Redes VPC → Criar rede VPC**.
2. **Nome:** `todo-vpc`. **Modo de criação de sub-rede:** *Personalizado*.
3. Em **Nova sub-rede**: nome `todo-subnet-run`, região `us-central1`, tipo de pilha IPv4, **Intervalo IPv4** `10.10.0.0/24`, **Acesso privado do Google:** *Ativado*. Clique em **Concluído**.
4. **Regras de firewall:** deixe sem selecionar (não precisamos de nenhuma). **Modo de roteamento dinâmico:** *Regional*.
5. Clique em **Criar**.

> **Por que "custom" e não "auto"?** A rede automática cria uma sub-rede em **cada região** com faixas fixas, e essas faixas costumam conflitar com VPNs e outras redes. No modo custom você decide.

> **Firewall:** não criamos regras. Regras de saída (egress) são permitidas por padrão, e o tráfego de entrada no Cloud SQL é controlado pelo próprio serviço gerenciado.

## Passo 2 — Reservar a faixa de IPs para o Cloud SQL

**Terminal**

```bash
gcloud compute addresses create "$PSA_RANGE" \
  --global \
  --purpose=VPC_PEERING \
  --prefix-length=16 \
  --network="projects/$PROJECT_ID/global/networks/$VPC" \
  --project="$PROJECT_ID"

gcloud compute addresses list --global --filter="purpose=VPC_PEERING"
```

**Console**

1. **☰ → Rede VPC → Redes VPC** e clique em `todo-vpc`.
2. Aba **Acesso privado a serviços** → sub-aba **Intervalos de IP alocados para serviços** → **Alocar intervalo de IP**.
3. **Nome:** `todo-psa-range`. Em *Intervalo de endereços IP* escolha **Automático** e **comprimento do prefixo** `16`.
4. Clique em **Alocar**.

## Passo 3 — Criar a conexão privada (o peering)

**Terminal**

```bash
gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges="$PSA_RANGE" \
  --network="$VPC" \
  --project="$PROJECT_ID"

gcloud services vpc-peerings list --network="$VPC" --project="$PROJECT_ID"
```

O comando devolve uma **operação de longa duração**; espere terminar (alguns segundos a poucos minutos).

**Console**

1. Em `todo-vpc`, aba **Acesso privado a serviços** → sub-aba **Conexões privadas com serviços** → **Criar conexão**.
2. Em *Alocação atribuída*, escolha `todo-psa-range`.
3. Clique em **Conectar**.

## Passo 4 — Direct VPC egress (só entendemos agora; configuramos no capítulo 9)

O Cloud Run, por padrão, sai para a internet e **não** enxerga IPs privados. Com o **Direct VPC egress**, cada instância do Cloud Run recebe um IP da `todo-subnet-run` e passa a alcançar o Cloud SQL como se estivesse dentro da VPC.

| Ponto | Detalhe (documentação oficial) |
|---|---|
| Sub-rede | Precisa ser **/26 ou maior**. Cada serviço reserva IPs em blocos de 16; usamos uma `/24` |
| Consumo de IPs | Em regime, o Cloud Run usa **2× o número de instâncias**; fica por até 20 min após reduzir |
| Egress `private-ranges-only` | Só tráfego para IPs privados vai pela VPC; o resto (Atlas, internet) sai normalmente. **É o que usamos** |
| Egress `all-traffic` | **Todo** o tráfego sai pela VPC. Exige Cloud NAT para alcançar a internet (endurecimento opcional, abaixo) |
| Permissões | O agente de serviço do Cloud Run já tem `roles/run.serviceAgent`. Só se ele não tiver, conceda `roles/compute.networkUser` |
| Limitação | Pode haver atraso de conexão na subida da instância (1 minuto ou mais); com Cloud NAT, 30 s ou mais. Por isso o serviço terá **startup probe** com folga |

## Verificação

```bash
gcloud compute networks describe "$VPC" --format="value(name,autoCreateSubnetworks)"     # todo-vpc  False
gcloud compute networks subnets describe "$SUBNET" --region="$REGION" --format="value(ipCidrRange,privateIpGoogleAccess)"
gcloud services vpc-peerings list --network="$VPC" --format="value(peering,state)"        # ... ACTIVE
```

| Verificação | Esperado |
|---|---|
| Sub-rede | `10.10.0.0/24` e `True` |
| Peering | Estado `ACTIVE` |
| Faixa `todo-psa-range` | Existe com finalidade `VPC_PEERING` |

## Alternativa: Private Service Connect

Comparativo apenas. **Não execute** na aula (cria custo extra). O fluxo oficial para o Cloud SQL é:

```bash
# 1) Instância com PSC (em vez de --network do peering)
gcloud sql instances create INSTANCIA_PSC \
  --database-version=POSTGRES_18 --edition=enterprise --tier=db-f1-micro --region="$REGION" \
  --enable-private-service-connect \
  --allowed-psc-projects="$PROJECT_ID" \
  --no-assign-ip

# 2) Descobrir o "service attachment" da instância
gcloud sql instances describe INSTANCIA_PSC --format="value(pscServiceAttachmentLink)"

# 3) Reservar um IP interno na sua sub-rede
gcloud compute addresses create psc-ip-sql \
  --region="$REGION" --subnet="$SUBNET"

# 4) Criar o endpoint (regra de encaminhamento) apontando para o service attachment
gcloud compute forwarding-rules create psc-endpoint-sql \
  --address=psc-ip-sql --region="$REGION" --network="$VPC" \
  --target-service-attachment=SERVICE_ATTACHMENT_URI
```

Depois disso, a API conectaria no **IP `psc-ip-sql`** em vez do IP alocado pelo peering. Em termos de código nada muda: só o host do `DATABASE_URL`.

## Endurecimento opcional: Cloud NAT com IP fixo

Este bloco só é necessário se você quiser **trocar o `0.0.0.0/0` do Atlas por um IP específico** ([capítulo 5](05-mongodb-atlas.md)). O Cloud Run não tem IP de saída fixo por padrão; com `all-traffic` + Cloud NAT, toda a saída passa por um IP estático que você cadastra no Atlas.

| Recurso | Nome | Configuração |
|---|---|---|
| Cloud Router | `todo-router` | VPC `todo-vpc`, região `us-central1` |
| IP externo estático | `todo-nat-ip` | Regional, `us-central1` |
| Gateway Cloud NAT | `todo-nat` | Público, todos os intervalos de sub-rede, IP manual `todo-nat-ip` |

**Terminal**

```bash
gcloud compute routers create todo-router \
  --network="$VPC" --region="$REGION"

gcloud compute addresses create todo-nat-ip --region="$REGION"

gcloud compute routers nats create todo-nat \
  --router=todo-router --region="$REGION" \
  --nat-external-ip-pool=todo-nat-ip \
  --nat-all-subnet-ip-ranges

gcloud compute addresses describe todo-nat-ip --region="$REGION" --format="value(address)"   # cadastre este IP no Atlas
```

Depois, redeploy o serviço com `--vpc-egress=all-traffic` (capítulo 9).

**Console**

1. **☰ → Serviços de rede → Cloud NAT → Criar gateway NAT do Cloud**.
2. **Nome:** `todo-nat`. **Tipo de NAT:** *Público*. **Rede:** `todo-vpc`. **Região:** `us-central1`.
3. **Cloud Router:** *Criar novo roteador* → nome `todo-router` → **Criar**.
4. **Origem:** *Todos os intervalos de IP de sub-rede*.
5. **Endereços IP NAT:** *Manual* → *Criar endereço IP* → nome `todo-nat-ip` → **Reservar**.
6. Clique em **Criar**.

> **Cuidado com o custo do IP.** Um IP externo estático **reservado e sem uso** custa **US$ 0,01/h** (~US$ 7,30/mês), mais que o IP em uso pelo NAT (US$ 0,005/h). Crie o IP junto com o NAT e apague os dois ao terminar.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `SERVICE_NETWORKING_NOT_ENABLED` ao criar o Cloud SQL | API `servicenetworking.googleapis.com` desligada | `gcloud services enable servicenetworking.googleapis.com` |
| `NETWORK_NOT_PEERED` | Passo 3 não foi feito ou ainda está em andamento | Refaça/aguarde; confira `gcloud services vpc-peerings list` |
| Faixa alocada conflita com a sub-rede | Sobreposição de IPs | Use `--addresses`/prefixo diferente, ou refaça a sub-rede em outro bloco |
| Serviço no Cloud Run não alcança o banco | Sub-rede/egress não configurados, ou peering inativo | Confira `gcloud run services describe` (bloco *VPC access*) e o estado do peering |
| Não consigo apagar a sub-rede | O Cloud Run ainda a usa | Apague/redeploy o serviço e o job e aguarde **1 a 2 horas** |

## Custos deste capítulo

Fontes: [preços de rede VPC](https://cloud.google.com/vpc/network-pricing), [Cloud NAT](https://cloud.google.com/nat/pricing) e [Cloud Run](https://cloud.google.com/run/pricing), consultadas em 20/09/2026 (`us-central1`).

| Recurso | Preço oficial | Estimativa mensal (uso da aula) |
|---|---|---|
| VPC e sub-rede | Sem cobrança | US$ 0,00 |
| IPs internos | Sem cobrança | US$ 0,00 |
| Peering PSA (conexão privada) | Não há item de cobrança para a conexão; o tráfego segue as regras de transferência de dados (linha abaixo) | US$ 0,00 |
| Tráfego Cloud Run → Cloud SQL | Mesma zona: sem cobrança. Entre zonas da região: US$ 0,01/GiB | ~US$ 0,00 (poucos MB) |
| Direct VPC egress | Sem cobrança adicional (o custo escala a zero com o serviço) | US$ 0,00 |
| **Total do caminho principal** | | **US$ 0,00** |
| *Opcional:* Cloud NAT, IP em uso | US$ 0,005/h | US$ 3,65 (730 h) |
| *Opcional:* Cloud NAT, gateway | US$ 0,0014/h por instância usando o gateway | até ~US$ 1,02 (1 instância 24 h); zero sem instâncias |
| *Opcional:* Cloud NAT, dados | US$ 0,045/GiB processado | ~US$ 0,00 (poucos MB) |
| *Opcional:* total do NAT | | **~US$ 3,65 a US$ 4,67 por mês; ~US$ 0,03 para uma aula de 6 h** |
| *Comparativo:* endpoint PSC | US$ 0,01/h + processamento de dados | ~US$ 7,30 |

---

[← Projeto no GCP](02-projeto-gcp-e-ferramentas.md) · [README](../README.md) · [Próximo: Cloud SQL →](04-cloud-sql-postgresql.md)
