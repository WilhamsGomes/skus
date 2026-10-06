# SKU Enrichment Integration

Serviço que se registra na plataforma, recebe lotes de SKUs em `POST /process`, confirma cada mensagem em milissegundos, enriquece os itens de forma assíncrona (`GET /enrich/:sku`) e devolve o lote consolidado em `POST /callback`.

O backend é a solução do desafio e funciona sozinho. O painel web e o simulador são ferramentas de apoio: um para visualizar os dados, outro para testar lotes grandes sem depender da plataforma real.

| Pasta | Conteúdo |
|---|---|
| [`backend/`](backend/README.md) | NestJS 11, PostgreSQL (Prisma 7), Redis + BullMQ |
| [`frontend/`](frontend/README.md) | React + Vite: painel opcional para visualizar os dados (lotes, itens, filas, Redis, entregas) |
| [`simulator/`](simulator/README.md) | Plataforma falsa local para testar lotes de qualquer tamanho (ex.: 20.000 SKUs) |
| [`docs/relatorio-melhor-execucao.json`](docs/relatorio-melhor-execucao.json) | Relatório da melhor execução (score 100) |

## Como executar

### Com Docker (um comando)

Pré-requisitos: Docker e uma URL HTTPS pública para o backend (ngrok), porque a plataforma chama `/check` e `/process`.

**1. Libere a porta 4000.** Se o backend estiver rodando em modo de desenvolvimento (`npm run start:dev`), pare-o: o container usa a mesma porta.

**2. Configure a plataforma.** Copie o arquivo de variáveis e preencha `PLATFORM_BASE_URL` com a Base URL informada na documentação do desafio (ela não fica no repositório):

```bash
cp .env.example .env
```

**3. Suba a stack** na raiz do repositório. A primeira vez leva alguns minutos (build das imagens):

```bash
docker compose up -d --build
```

Sobe Postgres, Redis, backend (aplica as migrations ao iniciar) e painel. Para conferir:

```bash
docker compose ps                # postgres e redis "healthy", backend e frontend "running"
docker compose logs -f backend   # deve aparecer "API rodando em http://localhost:4000"
```

| Serviço | Endereço |
|---|---|
| Painel | http://localhost:8080 (login `admin` / `admin`) |
| API e Swagger | http://localhost:4000 · http://localhost:4000/docs |
| Filas (Bull Board) | http://localhost:4000/queues |

**4. Exponha o backend.** Escolha uma opção:

- **ngrok instalado na máquina:** `ngrok http 4000`. A URL HTTPS aparece no terminal.
- **ngrok pelo compose:** defina `NGROK_AUTHTOKEN` (veja as variáveis abaixo) e rode `docker compose --profile tunnel up -d`. A URL aparece em http://localhost:4041. A conta gratuita permite um túnel por vez: pare o ngrok local antes.

**5. Abra o painel** em http://localhost:8080 e entre com `admin` / `admin`.

**6. Registre o webhook:** menu **Registro** → nome e URL HTTPS do ngrok → **Registrar**. A plataforma chama `<url>/check` nesse momento, então o túnel precisa estar ativo. Se a URL do ngrok não mudou desde o último registro, este passo pode ser pulado.

**7. Solicite um lote:** botão **Solicitar lote** na barra superior. O painel abre o lote e atualiza a cada 3 s; em poucos segundos os itens são enriquecidos, o callback é enviado e o relatório da plataforma aparece com o score.

**Para parar:** `docker compose down` mantém os dados; `docker compose down -v` apaga banco e Redis.

#### Variáveis de ambiente

Só `PLATFORM_BASE_URL` é obrigatória; `NGROK_AUTHTOKEN` só é necessária com o perfil `tunnel`, e as demais têm padrão. O compose lê o `.env` da raiz automaticamente (ele está no `.gitignore`). Sem `PLATFORM_BASE_URL`, o backend não sobe e o log (`docker compose logs backend`) indica a variável.

| Variável | Padrão | Uso |
|---|---|---|
| `NGROK_AUTHTOKEN` | — | Token da conta ngrok; obrigatório só com `--profile tunnel` |
| `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` | `admin` / `admin` | Login do painel |
| `AUTH_SECRET` | segredo de desenvolvimento | Assina o token do painel (mínimo 16 caracteres); troque fora do ambiente local |
| `PLATFORM_BASE_URL` | — | **Obrigatória.** Base URL da plataforma, informada na documentação do desafio |
| `BACKEND_PORT` | `4000` | Porta da API no host; se mudar, aponte o ngrok para a nova porta |
| `FRONTEND_PORT` | `8080` | Porta do painel no host |
| `POSTGRES_PORT` / `REDIS_PORT` | `5432` / `6379` | Portas do Postgres e do Redis no host |
| `NGROK_INSPECT_PORT` | `4041` | Painel do ngrok do compose (mostra a URL pública) |

A conexão do backend com Postgres e Redis é configurada pelo próprio compose; não é preciso informar `DATABASE_URL` nem `REDIS_URL`. Se a porta 4000 estiver ocupada, uma alternativa é `BACKEND_PORT=4002 docker compose up -d --build` com `ngrok http 4002`.

### Em modo de desenvolvimento

Pré-requisitos: Node.js ≥ 20.19, Docker e ngrok.

```bash
# 1. Backend: Postgres + Redis do compose, migrations e API em http://localhost:4000
cd backend
cp .env.example .env     # preencha PLATFORM_BASE_URL (Base URL da documentação do desafio)
npm install
npm run infra:up
npm run prisma:deploy
npm run start:dev

# 2. Túnel público (outro terminal)
ngrok http 4000

# 3. (Opcional) Painel em http://localhost:5173 (outro terminal) · login admin / admin
cd frontend
npm install
npm run dev
```

No painel: **Registro** → informe a URL do ngrok → **Solicitar lote**. O mesmo fluxo por `curl` está no [README do backend](backend/README.md).

Neste modo as variáveis ficam em `backend/.env` (criado a partir de `backend/.env.example`; só `PLATFORM_BASE_URL` precisa ser preenchida), descritas no [README do backend](backend/README.md#configuração). Os dois modos usam o mesmo Postgres e o mesmo Redis (porta 5432 e 6379). Não rode o backend dos dois ao mesmo tempo: ambos usam a porta 4000.

**Sobre o painel:** o frontend não faz parte do fluxo de integração; a plataforma conversa só com o backend. Ele é uma forma de ver os dados de maneira mais ampla e detalhada do que logs e consultas no banco: histórico de lotes, cada item com tentativas e erros, estado das filas, memória do Redis e o relatório completo de cada entrega. As duas ações que ele oferece (registrar e solicitar lote) chamam os mesmos endpoints do backend que o `curl`.

## Fluxo

```
POST /registration ──► plataforma POST /register ──► chama nosso /check ──► cid + token salvos
POST /batches ───────► plataforma POST /burst/:cid ─► run_id + total salvos (batch_runs)
plataforma ──► POST /process (×total) ──► INSERT idempotente + job na fila ──► 200 em ms
worker (até 3 em voo) ──► GET /enrich/:sku ──► item ENRICHED / FAILED
último item finalizado ──► fecha o lote (UPDATE atômico) ──► fila callback ──► POST /callback
varredura a cada 30 s ──► republica itens parados, fecha lotes, reenvia callbacks pendentes
```

## Melhor execução

[`docs/relatorio-melhor-execucao.json`](docs/relatorio-melhor-execucao.json) · lote `commu6tbvctfzki8is577s90`

| Critério | Resultado |
|---|---|
| Score | **100** (ACK 30/30 · retry 15/15 · resultado 30/30 · concorrência 10/10 · idempotência 15/15) |
| ACK | p50 420 ms · p95 494 ms · pior 496 ms (meta 600 ms, medido de ponta a ponta com o túnel) |
| Resultado | 20/20 itens corretos, nenhum faltando ou divergente |
| Falhas | 500 forçado recuperado com retry · 0 respostas 429 · duplicata processada uma única vez |

Todas as execuções registradas tiveram score 100, inclusive uma em que os jobs foram apagados da fila de propósito e a varredura recuperou o lote.

## Simulador (lotes grandes)

A plataforma real envia lotes de 20. Para testar 20.000 SKUs, [`simulator/`](simulator/README.md) traz uma plataforma falsa que implementa os mesmos contratos (`/register`, `/burst`, `/enrich`, `/callback`), com os comportamentos da documentação: 400–800 ms no `/enrich`, 429 acima de 3 em voo, ~10% de 500, 404 para SKU inválido, mensagens fora de ordem e duplicadas, e ~350 ms de túnel somados a cada ACK.

```bash
cd simulator
npm run sim -- --skus 100      # lote de 100 com latência real (~25 s)
npm run sim -- --skus 20000    # 20.000 com latência real (~70 min); sim:20k-fast reduz para ~6 min
```

**Tudo roda localmente e o backend testado é o código real**, não um mock. O script:

1. compila `backend/src` em `backend/.sim-dist`;
2. prepara um banco (`sku_simulation`) e um Redis db (`1`) próprios, limpos a cada execução;
3. sobe a plataforma falsa em `:4100` e uma **cópia do backend** em `:4001`, configurada para tratar a falsa como a plataforma;
4. faz o papel do operador (login, registro, solicitar lote) e, daí em diante, backend e plataforma falsa conversam sozinhos por HTTP;
5. imprime o relatório (no mesmo formato do real) e salva em `simulator/reports/`.

O backend principal (`:4000`, banco e Redis db `0`, ligado à plataforma real) não é usado nem alterado e pode continuar rodando. O score do simulador é uma aproximação dos critérios, não o avaliador oficial.

| Execução simulada | Resultado |
|---|---|
| 100 SKUs, latência real + túnel | score 100 · ACK p50 470 ms / p95 522 ms · 4,2 itens/s (a plataforma real deu 469/506 ms e ~4 itens/s) |
| 20.000 SKUs, `/enrich` 20× mais rápido, sem túnel | score 100 · 20.000/20.000 corretos · 2.275 erros 500 recuperados · 0 respostas 429 · 200 duplicatas sem chamada extra · ~58 itens/s |
| 20.000 SKUs, latência real + túnel | **não executada** (ver abaixo) |

**A simulação de 20.000 SKUs com latência real não foi executada para esta entrega.** Ela leva cerca de 70 minutos, porque o limite do `/enrich` (3 chamadas de 400–800 ms) dá ~5 itens/s, e esse é justamente o tempo que a seção [E se o lote tivesse 20.000 SKUs?](#e-se-o-lote-tivesse-20000-skus) estima. As duas execuções acima cobrem o que ela verificaria, por partes:

- **Comportamento com latência real** (ACK, vazão, retries, 429): validado com 100 SKUs, com números próximos aos da plataforma real.
- **Correção em escala** (20.000 itens corretos, duplicatas, 500, fechamento do lote e callback grande): validada com 20.000 SKUs e o `/enrich` acelerado.

A duração de ~70 min para 20.000 SKUs é, portanto, uma estimativa a partir da vazão medida, não uma medição. Para obtê-la:

```bash
cd simulator
npm run sim:20k        # ~70 min; o relatório fica em simulator/reports/<run_id>.json
```

## Decisões de arquitetura

**Receber e processar são coisas separadas.** O `/process` só grava o item no Postgres e publica um job no BullMQ; quem chama o `/enrich` é um worker. O ACK fica em milissegundos, independente da latência do `/enrich` (400–800 ms) e dos erros dele. Com o enriquecimento dentro da requisição, a latência sozinha estouraria os 600 ms e 20 mensagens simultâneas contra um limite de 3 gerariam 429.

**Idempotência pela identidade do contrato.** `run_id + seq` é a chave primária de `batch_items`, e o insert é `ON CONFLICT DO NOTHING`: entregas duplicadas, inclusive simultâneas, nunca criam dois itens, e quem resolve a corrida é o banco. O job usa a mesma identidade como `jobId`, então a fila também descarta a duplicata. Duplicatas recebem 200; se o insert falhar, o 500 é intencional e a plataforma reentrega.

**Concorrência controlada na fila, não no código.** `setGlobalConcurrency(3)` fica no Redis e vale para todos os workers. Um 429 pausa a fila pelo `retry-after` sem gastar tentativa; 500 e timeouts têm retry com backoff exponencial e jitter (até 10 vezes); 404 marca o item como falho (vai no callback com `price`/`stock` nulos); 401 falha sem retry.

**O lote fecha uma única vez.** Após cada item, um `UPDATE … WHERE status = 'OPEN' AND total <= finalizados` decide quem fecha o lote: com vários jobs terminando juntos, só um vence. O vencedor publica o callback numa fila própria (6 tentativas), para que uma falha no envio não se perca com o job do item. O `total` vem do `/burst`, nunca 20 fixo.

**Banco e fila não são transacionais, e uma varredura cobre a diferença.** O item é gravado antes do job ser publicado, então uma queda entre os dois deixaria o item sem job. A cada 30 s, a varredura republica itens parados (com `retry()` quando o job já esgotou as tentativas), fecha lotes que ficaram completos e reenvia callbacks não confirmados.

**Organização.** Módulos por capacidade (`registration`, `batch-processing`, `auth`, `dashboard`), com camadas `domain → application → infra/presentation` e portas como classes abstratas injetadas pelo Nest. O painel tem um módulo só de leitura, sem casos de uso, porque não há regra de negócio nas consultas. 148 testes cobrem casos de uso, adapters HTTP, workers, controllers e a montagem dos módulos.

## Trade-offs aceitos

- **Redis como peça extra.** Em troca de filas duráveis (AOF ligado), retry com backoff, limite global e pausa por 429 prontos. Uma fila no Postgres (`SKIP LOCKED`) evitaria a peça, mas exigiria escrever tudo isso à mão.
- **Worker no mesmo processo da API.** Mais simples de rodar e não afeta o ACK, porque o worker só espera rede. Separar é só criar outro ponto de entrada, já que o limite é global.
- **At-least-once, não exactly-once.** Um job pode rodar duas vezes (por exemplo, depois de um crash); o update condicional (`WHERE status = 'RECEIVED'`) torna isso inofensivo, mas pode gerar uma chamada extra ao `/enrich`. O callback também pode ser reenviado; a plataforma aceita reenvios.
- **Deduplicação da fila com prazo.** Jobs concluídos ficam 1 h no Redis; uma reentrega depois disso cria outro job, que encontra o item já finalizado e não altera nada.
- **Varredura com `setInterval`.** Com várias instâncias, cada uma roda a sua; republicar e fechar podem acontecer várias vezes sem efeito, então o custo é só consulta repetida.
- **Painel por polling (1 min; 3 s no lote em andamento)** em vez de WebSocket, e login único com usuário e senha fixos por variável de ambiente, conforme pedido.

## E se o lote tivesse 20.000 SKUs?

O limite está no `/enrich`: 3 chamadas em paralelo de ~600 ms dão **~5 itens/s**, ou seja, **~67 min por lote** (~73 min com os retries de 500). Nada no nosso lado deixa isso mais rápido, a não ser fazer menos chamadas; a pergunta passa de "quão rápido" para "aguenta uma hora sem perder nada". O [simulador](#simulador-lotes-grandes) confirmou, com o `/enrich` acelerado, que ACK, idempotência, limite global, retries e fechamento do lote funcionam com 20.000 itens; a duração de ~70 min é estimada a partir da vazão medida com latência real, não medida num lote de 20.000. Ele também mostrou que, enquanto as 20.000 mensagens chegam, o enriquecimento cai de ~58 para ~10 itens/s, porque API e worker dividem o mesmo processo e o mesmo pool do banco (o ACK não sofre). Mudaria:

1. **Contador de finalizados em vez de contagem.** Hoje cada item finalizado conta os itens do lote para decidir se ele fechou: 20.000 contagens de até 20.000 linhas. Um contador em `batch_runs`, incrementado na mesma transação que finaliza o item, reduz a verificação a comparar dois números.
2. **Cache por SKU dentro do lote.** SKUs repetidos não precisam de outra chamada ao `/enrich`; é a única alavanca de tempo disponível (desde que preço e estoque não mudem durante o lote).
3. **Callback montado em páginas.** Ler os itens do banco por cursor e enviar um payload de ~1,5 MB com timeout maior, confirmando o limite de tamanho com a plataforma.
4. **Workers separados da API e escalados à parte**, para um deploy não pausar uma hora de processamento; publicação e republicação em lote (`addBulk`).
5. **Visibilidade e justiça.** Vazão e previsão de término no painel, paginação no detalhe do lote, e prioridade ou intercalação por lote, para que um lote pequeno não espere uma hora atrás de um grande na mesma fila.
