# SKU Enrichment Integration

Backend que se registra na plataforma, recebe lotes de SKUs via `/process`, confirma rápido,
enriquece os itens de forma assíncrona (`GET /enrich/:sku`) e devolve o resultado em `/callback`.

> **Estado atual: estrutura inicial.** Implementados: `GET /health`, `POST /check` e o caminho de
> recebimento de `/process` (persistência idempotente). O restante do fluxo está desenhado abaixo, ainda não implementado.

## Como executar

Pré-requisitos: Node.js ≥ 20.19 e Docker.

```bash
cp .env.example .env
npm install              # também gera o Prisma Client
npm run infra:up         # Postgres + Redis, aguarda os healthchecks
npm run prisma:deploy    # aplica as migrations
npm run start:dev        # http://localhost:4000
```

```bash
npm test                 # testes unitários e de controller (não precisam de Docker)
npm run build
```

Para expor publicamente: `ngrok http 4000`. **O registro na plataforma não é feito automaticamente.**

## Endpoints implementados

| Endpoint | Comportamento |
|---|---|
| `GET /health` | 200 com `{status, checks: {database, redis}}`; 503 se alguma dependência estiver fora. |
| `POST /check` | Devolve `{token}` recebido com **200** (o padrão do Nest para POST seria 201). Não consulta credenciais: a plataforma chama `/check` *durante* o `/register`, antes de termos o token. |
| `POST /process` | Valida o payload, grava o item com `INSERT … ON CONFLICT DO NOTHING` em `(run_id, seq)` e responde `200 {ok: true}`, inclusive para duplicatas. **Ainda não enfileira o enriquecimento** (próxima etapa). |

## Arquitetura

Organização por **capacidade de negócio**, com camadas dentro de cada módulo:

```
src/
├── main.ts                          # bootstrap
├── app.module.ts                    # composition root
├── generated/prisma/                # Prisma Client gerado (fora do git)
├── shared/
│   ├── config/                      # único ponto que lê process.env; valida no startup
│   ├── infra/
│   │   ├── http/http.config.ts      # pipeline HTTP comum (ValidationPipe), usado também nos testes
│   │   └── prisma/                  # PrismaModule (global) + PrismaService
│   └── interceptors/                # log de requisições HTTP
└── modules/
    ├── health/                      # endpoint operacional (fala direto com a infra)
    ├── registration/                # handshake /check; depois: registro e credenciais
    │   └── presentation/            # controllers + dto/
    └── batch-processing/            # recebimento, enriquecimento, consolidação, callback
        ├── domain/                  # TypeScript puro
        ├── application/             # casos de uso + portas
        ├── infra/repositories/      # adapters (Prisma; depois HTTP e BullMQ em infra/)
        ├── presentation/            # controllers + dto/ (depois: workers)
        └── batch-processing.module.ts   # liga portas a adapters
```
Testes ficam em `__tests__/` ao lado do código testado.

**Direção das dependências:** `presentation → application → domain`. `infra` implementa as portas
declaradas em `application`. Domínio, casos de uso e adapters são classes sem decorators; o Nest aparece só em
controllers, DTOs e nos `*.module.ts`, que montam tudo via `useFactory` e tokens `Symbol`.

**Por que dois módulos e não mais:** recebimento, enriquecimento e consolidação compartilham o mesmo modelo
(o item do lote e sua execução) e a mesma regra de completude. Separá-los criaria contextos acoplados pelo mesmo dado.
Registro/credenciais é outra capacidade, com ciclo de vida próprio.

### Modelagem de domínio

| Conceito | Tipo | Justificativa | Estado |
|---|---|---|---|
| `ItemKey` (run_id + seq) | Value object | Identidade definida pelo contrato; chave de deduplicação e, depois, `jobId`. | ✅ |
| `ReceivedItem` | Value object | Invariantes da mensagem recebida (seq inteiro ≥ 0, SKU não vazio e preservado). | ✅ |
| `BatchItem` | Entidade (agregado próprio) | Ciclo de vida `RECEIVED → ENRICHED / FAILED`, com estados terminais imutáveis. | planejado |
| `EnrichmentResult` | Value object | price ≥ 0, stock inteiro ≥ 0. | planejado |
| `BatchRun` | Agregado | `total` esperado e status do callback. Decide completude por **contagem**, sem carregar itens. | planejado |
| Credenciais (cid, token) | Registro simples | Sem comportamento: não vira entidade. | planejado |

O item é um agregado separado da execução: cada mensagem altera só o próprio item, sem disputar
lock com as outras. Isso também evita carregar 20.000 itens para decidir algo.

### Decisões

- **ACK durável e idempotente:** `/process` só faz um insert (~ms) e responde. A porta `BatchItemInbox.recordIfNew`
  explicita a atomicidade no contrato, então não existe "consultar e depois inserir". Duplicatas respondem 2xx para a plataforma não reenviar.
- **Sem FK de item para execução:** mensagens podem chegar antes de persistirmos a resposta do `/burst`.
- **Jest** (em vez de Vitest): integra com Nest/ts-jest sem plugins. Vitest usa esbuild, que não emite
  `emitDecoratorMetadata`; os testes de controller com DI do Nest exigiriam SWC.
- **Nest 11 / TypeScript 5.9:** Nest 12 é ESM-only (atrito com Jest), e o ts-jest ainda não suporta TS 7.
  **Prisma 7** com driver adapter `pg`.
- **Validação:** `class-validator` nos DTOs HTTP e no ambiente (uma única biblioteca). O domínio revalida as próprias invariantes.

## Próximos passos (desenhados, não implementados)

Casos de uso e portas previstos:

| Caso de uso | Portas | Notas |
|---|---|---|
| `RegisterWebhook` (comando manual) | `PlatformRegistrationClient`, `CredentialsStore` | `POST /register`; persiste `cid`/`token`. Trata 422 `handshake_failed`. |
| `RequestBatch` | `BatchPlatformClient`, `BatchRunStore.open` (upsert) | `POST /burst/:cid` com `x-token`; usa o `total` retornado, nunca 20 fixo. |
| `ReceiveBatchItem` ✅ + publicação | `EnrichmentJobPublisher` | Após gravar, publica job com `jobId = run_id:seq`. Se a publicação falhar, o ACK não falha: o reconciliador cobre. |
| `RepublishPendingItems` | `BatchItemStore.findStalePending`, `EnrichmentJobPublisher` | Varredura periódica de itens `RECEIVED` antigos. Banco e fila não são transacionais; isso fecha a janela de queda entre os dois. |
| `EnrichBatchItem` (worker) | `EnrichmentClient`, `BatchItemStore.recordEnrichment` | Update condicional (só se ainda não terminal), o que torna jobs repetidos inofensivos. |
| `ConsolidateBatch` | `BatchRunStore.claimForCallback`, `BatchResultReader`, `CallbackClient` | Claim atômico: só se `concluídos == total` e status permitir. Assim nenhum callback sai de lote incompleto. |

Tolerância a falhas e concorrência no enriquecimento:

- **Limite de 3 em voo, global:** concorrência global da fila BullMQ (`setGlobalConcurrency(3)`), que vale para
  todos os workers conectados, e não só para o `concurrency` local de cada processo.
- **429 + `retry-after`:** pausa a fila pelo tempo indicado (rate limit do worker), em vez de dormir segurando o slot.
- **500:** retry com backoff exponencial e jitter. **401:** falha imediata (credencial). **404:** falha permanente do item.
- **Callback:** at-least-once. A plataforma aceita reenvios, então falhas são repetidas. Não prometemos exactly-once.
- Headers (`x-cid`, `x-token`) e payloads da plataforma ficam só nos adapters HTTP.

Questões em aberto (os PDFs não definem): como representar no callback um item com 404, e o formato do relatório.

### Se o lote tivesse 20.000 SKUs

O desenho já evita carregar o lote inteiro: a completude sai de contagem indexada ou de contador atômico, e os itens
são agregados independentes. Mudariam ainda: leitura do resultado em páginas/stream para montar o callback,
publicação de jobs em bulk, e monitoramento da vazão. Com 3 requisições simultâneas de ~600 ms, são cerca de 5 itens/s, ou ~1 h por lote.
