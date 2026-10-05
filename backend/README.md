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

Para expor publicamente e registrar o serviço (o app precisa estar no ar: a plataforma chama `/check` durante o registro):

```bash
ngrok http 4000
curl -X POST http://localhost:4000/registration   -H "content-type: application/json"   -d '{"name":"Seu Nome","webhook":"https://xxxx.ngrok.app"}'
curl -X POST http://localhost:4000/batches   # pede um lote; as mensagens chegam em /process
```

Documentação interativa (Swagger) em `http://localhost:4000/docs`.
Painel da fila de enriquecimento (Bull Board) em `http://localhost:4000/queues`: só responde para acesso direto em `localhost`; pelo túnel (header `x-forwarded-for` ou host externo) devolve 404.

## Endpoints implementados

| Endpoint | Comportamento |
|---|---|
| `GET /health` | 200 com `{status, checks: {database, redis}}`; 503 se alguma dependência estiver fora. |
| `POST /registration` | Chama `POST /register` da plataforma e salva `cid`/`token` em `registrations`. 422 `handshake_failed` repassa o motivo da plataforma; 502 para falha de rede/contrato. **Não devolve o token** (endpoint exposto pelo túnel). |
| `GET /registration` | Registro vigente (mais recente), sem o token; 404 se nunca registrado. |
| `POST /check` | Devolve `{token}` recebido com **200** (o padrão do Nest para POST seria 201). Não consulta credenciais: a plataforma chama `/check` *durante* o `/register`, antes de termos o token. |
| `POST /process` | Valida o payload, grava o item com `INSERT … ON CONFLICT DO NOTHING` em `(run_id, seq)` e responde `200 {ok: true}`, inclusive para duplicatas. Depois do insert publica o job `enrich` na fila BullMQ `enrichment` (`jobId = run_id-seq`), com teto de 200 ms; se a publicação falhar, responde 200 mesmo assim. O `EnrichmentWorker` (mesmo processo) consome a fila e chama `GET /enrich/:sku`. |
| `POST /batches` | Chama `POST /burst/:cid` da plataforma com `x-token` do registro vigente e devolve `{runId, total, startedAt}`. A plataforma passa a chamar `/process`. 409 se o serviço não foi registrado; 502 para falha de rede/contrato. Grava a execução em `batch_runs` (`run_id`, `cid`, `total`, `OPEN`) com upsert. |

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
    ├── registration/                # handshake /check, registro e credenciais (cid/token)
    │   ├── domain/                  # tipos Registration / PlatformCredentials
    │   ├── application/             # RegisterWebhookUseCase, erros e ports/
    │   ├── infra/                   # http/ (POST /register) e repositories/ (Prisma)
    │   ├── presentation/            # controllers + dto/ (request/response separados)
    │   └── registration.module.ts   # liga portas a adapters (useClass); exporta RegistrationRepository
    └── batch-processing/            # recebimento, enriquecimento, consolidação, callback
        ├── domain/                  # TypeScript puro
        ├── application/             # casos de uso + portas
        ├── infra/repositories/      # adapters (Prisma; depois HTTP e BullMQ em infra/)
        ├── presentation/            # controllers + dto/ (depois: workers)
        └── batch-processing.module.ts   # liga portas a adapters
```
Testes ficam em `__tests__/` ao lado do código testado.

**Direção das dependências:** `presentation → application → domain`. `infra` implementa as portas
declaradas em `application`. O domínio é TypeScript puro, sem Nest.

**Injeção de dependência:** cada porta é uma `abstract class` (e não `interface`, que some na compilação e não
pode ser token do Nest). O `*.module.ts` liga porta e implementação com `{ provide: Porta, useClass: Adapter }`,
e quem consome injeta só pelo tipo, sem `@Inject(TOKEN)`:

```ts
// registration.module.ts
{ provide: RegistrationRepository, useClass: PrismaRegistrationRepository }

// register-webhook.use-case.ts — depende da abstração, não do Prisma
constructor(private readonly repository: RegistrationRepository) {}
```

Trade-off aceito: casos de uso e adapters levam `@Injectable()`, ou seja, `application/` conhece o Nest. Em troca,
o module fica enxuto e o padrão é o da documentação oficial. Um teste de wiring (`registration.module.spec.ts`)
compila o módulo real para pegar erros de DI. Por exemplo, `import type` de uma porta num construtor
decorado apaga o token e quebra a injeção só em runtime.

**Por que dois módulos e não mais:** recebimento, enriquecimento e consolidação compartilham o mesmo modelo
(o item do lote e sua execução) e a mesma regra de completude. Separá-los criaria contextos acoplados pelo mesmo dado.
Registro/credenciais é outra capacidade, com ciclo de vida próprio.

### Modelagem de domínio

| Conceito | Tipo | Justificativa | Estado |
|---|---|---|---|
| `ReceivedItem` | Value object | Invariantes da mensagem recebida (seq inteiro ≥ 0, SKU não vazio e preservado). `key` = `run_id:seq`: chave de deduplicação e, depois, `jobId`. | ✅ |
| `BatchItem` | Entidade (agregado próprio) | Ciclo de vida `RECEIVED → ENRICHED / FAILED`, com estados terminais imutáveis. | planejado |
| `EnrichmentResult` | Value object | price ≥ 0, stock inteiro ≥ 0. | planejado |
| `BatchRun` | Agregado | `total` esperado e status do callback (`OPEN → COMPLETED`). Decide completude por **contagem**, sem carregar itens. | dados ✅, regra de completude planejada |
| Credenciais (cid, token) | Registro simples | Sem comportamento: não vira entidade. | ✅ |

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
| `RegisterWebhook` ✅ (`POST /registration`) | `PlatformRegistrationGateway`, `RegistrationRepository` | `POST /register`; persiste `cid`/`token`. Trata 422 `handshake_failed`. |
| `RequestBatch` ✅ (`POST /batches`) | `BatchPlatformClient` ✅, `BatchRunStore.open` ✅ (upsert) | `POST /burst/:cid` com `x-token`; usa o `total` retornado, nunca 20 fixo. Guarda o `cid` do burst para o callback. |
| `ReceiveBatchItem` ✅ + publicação ✅ | `EnrichmentJobPublisher` ✅ | Após gravar, publica job com `jobId = run_id-seq` (o BullMQ não aceita `:`), também nas duplicatas. Publish limitado a 200 ms: `queue.add` espera a conexão e, com o Redis fora, ficaria pendurado. Se a publicação falhar, o ACK não falha: o reconciliador cobre. |
| `RepublishPendingItems` | `BatchItemStore.findStalePending`, `EnrichmentJobPublisher` | Varredura periódica de itens `RECEIVED` antigos. Banco e fila não são transacionais; isso fecha a janela de queda entre os dois. |
| `EnrichBatchItem` ✅ (worker) | `BatchRunStore.find`, `RegistrationRepository.findByCid`, `EnrichmentClient`, `BatchItemStore` | Credenciais do `cid` da execução. Update condicional (`WHERE status = 'RECEIVED'`), o que torna jobs repetidos inofensivos. Execução ainda não gravada (`/process` antes do `/burst` responder) vira retry. |
| `ConsolidateBatch` | `BatchRunStore.claimForCallback`, `BatchResultReader`, `CallbackClient` | Claim atômico: só se `concluídos == total` e status permitir. Assim nenhum callback sai de lote incompleto. |

Tolerância a falhas e concorrência no enriquecimento:

- **Limite de 3 em voo, global:** concorrência global da fila BullMQ (`setGlobalConcurrency(3)`), que vale para
  todos os workers conectados, e não só para o `concurrency` local de cada processo.
- **429 + `retry-after`:** pausa a fila pelo tempo indicado (rate limit do worker), em vez de dormir segurando o slot.
- **500, timeout (5 s), rede ou resposta fora do contrato:** retry com backoff exponencial (500 ms, ×2, jitter 50%), até 10 tentativas. **401** ou registro do `cid` ausente: `UnrecoverableError`, sem retry; o item fica `RECEIVED` com `last_error`. **404:** item `FAILED` (`sku_not_found`), sem retry.
- `attempts` em `batch_items` conta chamadas ao `/enrich` que tiveram resposta tratada (429 não conta: é controle de vazão, não falha).
- **Callback:** at-least-once. A plataforma aceita reenvios, então falhas são repetidas. Não prometemos exactly-once.
- Headers (`x-cid`, `x-token`) e payloads da plataforma ficam só nos adapters HTTP.

Questões em aberto (os PDFs não definem): como representar no callback um item com 404, e o formato do relatório.

### Se o lote tivesse 20.000 SKUs

O desenho já evita carregar o lote inteiro: a completude sai de contagem indexada ou de contador atômico, e os itens
são agregados independentes. Mudariam ainda: leitura do resultado em páginas/stream para montar o callback,
publicação de jobs em bulk, e monitoramento da vazão. Com 3 requisições simultâneas de ~600 ms, são cerca de 5 itens/s, ou ~1 h por lote.
