# Backend · SKU Enrichment Integration

API NestJS que se registra na plataforma, recebe lotes em `POST /process`, confirma cada mensagem em milissegundos, enriquece os itens numa fila (`GET /enrich/:sku`, até 3 em voo) e devolve o lote consolidado em `POST /callback`.

Visão geral, melhor execução, decisões, trade-offs e o cenário de 20.000 SKUs estão no [README da raiz](../README.md). Este arquivo cobre só o backend.

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
npm test                 # 148 testes (não precisam de Docker)
npm run typecheck
npm run build
```

Para registrar o serviço e pedir um lote sem o painel (o app precisa estar no ar: a plataforma chama `/check` durante o registro):

```bash
ngrok http 4000

TOKEN=$(curl -s -X POST http://localhost:4000/auth/login -H "content-type: application/json" \
  -d '{"username":"admin","password":"admin"}' | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

curl -X POST http://localhost:4000/registration -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" -d '{"name":"Seu Nome","webhook":"https://xxxx.ngrok-free.app"}'

curl -X POST http://localhost:4000/batches -H "authorization: Bearer $TOKEN"
```

| Ferramenta | Endereço |
|---|---|
| Swagger | `http://localhost:4000/docs` |
| Bull Board (filas) | `http://localhost:4000/queues`, só por acesso direto em `localhost`; pelo túnel devolve 404 |
| Painel | [`../frontend`](../frontend/README.md) (opcional) |

## Configuração

| Variável | Padrão | |
|---|---|---|
| `PORT` | `4000` | |
| `DATABASE_URL` | — | `postgresql://…` (obrigatória) |
| `REDIS_URL` | — | `redis://…` (obrigatória) |
| `PLATFORM_BASE_URL` | URL da plataforma do desafio | o simulador aponta para a plataforma falsa |
| `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` | `admin` / `admin` | login único |
| `AUTH_SECRET` | segredo de desenvolvimento | assina o JWT; mínimo 16 caracteres |

O ambiente é validado no startup: o app não sobe com variável inválida, nem sem Postgres ou Redis acessíveis.

## Endpoints

Todos exigem `Authorization: Bearer <token>`, exceto `/check`, `/process` (chamados pela plataforma) e `/auth/login`.

| Endpoint | Comportamento |
|---|---|
| `POST /check` | Devolve o `{token}` recebido com **200**. Não confere credenciais: a plataforma chama `/check` durante o `/register`, antes de termos o token. |
| `POST /process` | Valida, grava com `INSERT … ON CONFLICT DO NOTHING` em `(run_id, seq)`, publica o job (`jobId = run_id-seq`, teto de 200 ms) e responde `200 {ok: true}`, inclusive para duplicatas. Falha no insert → 500 (a plataforma reentrega); falha no publish → 200 (a varredura republica). |
| `POST /auth/login` | Usuário e senha fixos (comparação em tempo constante); devolve um JWT de 8 h. |
| `POST /registration` | Chama `POST /register` e salva `cid`/`token`. 422 `handshake_failed` repassa o motivo da plataforma; 502 para falha de rede ou contrato. Não devolve o token. |
| `GET /registration` | Registro vigente, sem o token; 404 se nunca registrado. |
| `POST /batches` | Chama `POST /burst/:cid` e grava a execução (`run_id`, `cid`, `total`). 409 se não registrado; 502 para falha da plataforma. |
| `POST /batches/:runId/callback` | Reenvia o callback de um lote concluído (202). Cada envio gera um novo relatório e uma linha em `callback_deliveries`. 404 lote inexistente; 409 lote aberto. |
| `GET /dashboard/*` | Leitura para o painel: `overview`, `runs`, `runs/:runId`, `items`, `queues`, `cache`, `deliveries`, `deliveries/:id`, `registrations`. |

## Estrutura

Módulos por capacidade, com camadas dentro de cada um. Testes em `__tests__/` ao lado do código.

```
src/
├── main.ts · app.module.ts
├── shared/
│   ├── auth/                 # decorator @Public
│   ├── config/               # único ponto que lê process.env; valida no startup
│   ├── infra/                # http (ValidationPipe, Swagger), prisma, redis
│   └── interceptors/         # log de requisições
└── modules/
    ├── registration/         # /check, registro e credenciais
    ├── batch-processing/     # recebimento, enriquecimento, fechamento, callback, varredura
    │   ├── domain/           # ReceivedItem, EnrichmentResult, BatchRun (TypeScript puro)
    │   ├── application/      # casos de uso, erros e ports/
    │   ├── infra/            # http/ (plataforma), queue/ (BullMQ, workers, Bull Board),
    │   │                     # repositories/ (Prisma), scheduling/ (varredura)
    │   └── presentation/     # controllers, dto/, filters/
    ├── auth/                 # login, JWT e guard global
    └── dashboard/            # consultas de leitura para o painel (queries/)
```

**Dependências:** `presentation → application → domain`; `infra` implementa as portas declaradas em `application`. Cada porta é uma `abstract class` (uma `interface` some na compilação e não serve de token do Nest), ligada ao adapter no módulo com `{ provide: Porta, useClass: Adapter }`. Testes de montagem compilam cada módulo real para pegar erros de injeção que só apareceriam em runtime.

**`dashboard` não tem casos de uso:** só lê e agrega dados (Prisma, BullMQ, Redis), sem regra de negócio.

### Modelagem

| Conceito | Tipo | Papel |
|---|---|---|
| `ReceivedItem` | Value object | Invariantes da mensagem (`seq` inteiro ≥ 0, `run_id` e SKU não vazios); `key` = `run_id:seq` |
| `EnrichmentResult` | Value object | `price` ≥ 0 e `stock` inteiro ≥ 0; resposta fora disso é tratada como erro transitório |
| `BatchRun` | Registro | `cid`, `total` e status `OPEN → COMPLETED`; a completude é decidida por um `UPDATE` atômico, sem carregar itens |
| Item do lote | Linha em `batch_items` | `RECEIVED → ENRICHED / FAILED`; toda transição é condicional (`WHERE status = 'RECEIVED'`), então estados finais não mudam |
| Credenciais | Registro | `cid` + `token`; sem comportamento |

Cada item muda só a própria linha, sem disputar lock com os outros itens do lote. Itens não têm FK para a execução: um `/process` pode chegar antes de gravarmos a resposta do `/burst`.

## Casos de uso

| Caso de uso | Disparado por | O que faz |
|---|---|---|
| `RegisterWebhook` | `POST /registration` | `POST /register` e persiste as credenciais |
| `RequestBatch` | `POST /batches` | `POST /burst/:cid` e grava a execução com o `total` recebido |
| `ReceiveBatchItem` | `POST /process` | Grava o item e publica o job, também na duplicata (o `jobId` igual evita um segundo job) |
| `EnrichBatchItem` | worker `enrichment` | Busca as credenciais do `cid` da execução, chama `/enrich` e finaliza o item |
| `CloseBatchRun` | após cada item finalizado | `UPDATE … WHERE status = 'OPEN' AND total <= finalizados`: só um job fecha o lote e publica o callback |
| `SendBatchCallback` | worker `callback` | Monta o resultado ordenado por `seq` e envia `POST /callback`; guarda o relatório |
| `ResendBatchCallback` | `POST /batches/:runId/callback` | Recoloca o callback na fila |
| `ReconcileStaleWork` | a cada 30 s | Republica itens parados há mais de 60 s, fecha lotes completos e reenvia callbacks não confirmados |

## Falhas e concorrência

| Situação | Tratamento |
|---|---|
| Mais de 3 chamadas ao `/enrich` | Impedido por `setGlobalConcurrency(3)`, guardado no Redis e válido para todos os workers |
| 429 | Pausa a fila pelo `retry-after`; o job volta sem gastar tentativa |
| 500, timeout (5 s), rede, resposta fora do contrato | Retry com backoff exponencial (500 ms, ×2, jitter 50%), até 10 tentativas |
| 404 | Item `FAILED`; vai no callback com `price` e `stock` nulos |
| 401 ou `cid` sem registro | Falha definitiva do job; o item fica `RECEIVED` com `last_error` |
| Callback com 429, 5xx ou rede | Fila própria, 6 tentativas com backoff a partir de 1 s; outros 4xx são definitivos |
| Redis fora no `/process` | Publish desiste em 200 ms (`queue.add` esperaria a conexão indefinidamente); o ACK sai e a varredura republica |
| Job com tentativas esgotadas | A varredura usa `job.retry()`, já que um `add` com o mesmo `jobId` seria ignorado |

`batch_items.attempts` conta as respostas tratadas do `/enrich` (429 não conta). Jobs concluídos ficam 1 h no Redis e falhos, 24 h.

## Escolhas técnicas

- **Nest 11, TypeScript 5.9 e `@nestjs/jwt` 11:** as versões 12 do Nest e do `@nestjs/jwt` são só ESM, o que quebra o Jest; o ts-jest ainda não suporta TS 7.
- **Jest** em vez de Vitest: o esbuild do Vitest não emite `emitDecoratorMetadata`, necessário para a injeção do Nest nos testes.
- **Prisma 7** com driver adapter `pg`; `class-validator` nos DTOs e na validação do ambiente.
- **BullMQ 6:** não aceita `:` em `jobId`, por isso o job usa `run_id-seq` e o domínio mantém `run_id:seq`.
