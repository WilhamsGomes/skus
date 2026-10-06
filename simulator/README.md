# Simulador da plataforma

Plataforma falsa para testar o backend com lotes grandes (por padrão, 20.000 SKUs) sem depender da plataforma real. Implementa os mesmos contratos:

| Endpoint | Comportamento simulado |
|---|---|
| `POST /register` | Chama `<webhook>/check` e devolve `cid` + `token` |
| `POST /burst/:cid` | Gera N SKUs e envia N mensagens para `/process`, embaralhadas, com 50 em paralelo, ~1% duplicadas e ~5% de SKUs repetidos em `seq` diferentes; mede o ACK de cada uma incluindo a latência simulada do túnel (a primeira é aquecimento) |
| `GET /enrich/:sku` | 400–800 ms (× `--latency-scale`), 429 com `retry-after` acima de 3 em voo, ~10% de 500, 404 para ~0,5% de SKUs inválidos; preço e estoque são determinísticos por SKU |
| `POST /callback` | Confere o resultado (404 → `price`/`stock` nulos) e devolve um relatório no mesmo formato da plataforma real, com campos extras sobre o `/enrich` |

O score é uma aproximação dos critérios do relatório real, não o avaliador oficial.

## Como executar

Com Postgres e Redis no ar (`npm run infra:up` no backend) e `backend/.env` configurado. Não precisa de `npm install`: o simulador usa só Node e as dependências do backend.

```bash
cd simulator
npm run sim -- --skus 100          # lote de 100 com latência real (~25 s)
npm run sim:quick                  # 100 SKUs com /enrich 10x mais rápido (~5 s)
npm run sim:20k-fast               # 20.000 SKUs com /enrich 20x mais rápido (~6 min)
npm run sim:20k                    # 20.000 SKUs com latência real (~70 min)
```

O tamanho do lote é só `--skus N`; qualquer opção da tabela abaixo vai depois de `--` (por exemplo, `npm run sim -- --skus 500 --network-latency 0`). Sem npm: `node run.mjs --skus 100`.

O script compila o backend em `backend/.sim-dist`, sobe uma instância isolada em `:4001` apontando para a plataforma falsa em `:4100`, registra, solicita o lote, mostra o progresso a cada 5 s e salva o relatório em `simulator/reports/<run_id>.json`. `Ctrl+C` encerra os dois.

**Latência do túnel:** na plataforma real, o ACK é medido de ponta a ponta e passa pelo ngrok. O simulador soma 350 ms ±10% de ida e volta a cada `/process`, valor calibrado com as execuções reais (ACK p50 420 ms e p95 494 ms, com ~65 ms do nosso servidor). Com isso, 100 SKUs dão ACK p50 ~470 ms / p95 ~520 ms e ~4 itens/s, como na plataforma.

**Isolamento:** a simulação usa o banco `sku_simulation` e o Redis db `1`, que são limpos a cada execução. O backend principal (`:4000`, banco e Redis db `0`) não é tocado e pode continuar rodando. Para ver a simulação no painel, rode o frontend com `VITE_API_TARGET=http://localhost:4001`.

| Opção | Padrão | |
|---|---|---|
| `--skus` | `20000` | itens no lote |
| `--latency-scale` | `1` | multiplica a latência do `/enrich` |
| `--error-rate` | `0.1` | fração de 500 no `/enrich` |
| `--invalid-rate` | `0.005` | fração de SKUs inválidos (404) |
| `--sku-repeat-rate` | `0.05` | fração de `seq` com SKU já usado no lote |
| `--duplicate-rate` | `0.01` | fração de mensagens reenviadas para `/process` |
| `--send-concurrency` | `50` | mensagens `/process` em paralelo |
| `--network-latency` | `350` | ida e volta do túnel em ms, somada a cada `/process` (`0` desliga) |
| `--network-jitter` | `0.1` | variação da latência do túnel (±10%) |
| `--backend-port` / `--platform-port` | `4001` / `4100` | |
| `--database` / `--redis-db` | `sku_simulation` / `1` | não aceita o banco principal nem o db `0` |
| `--keep-data` | | não limpa os dados da simulação anterior |
| `--skip-build` | | reaproveita `backend/.sim-dist` |

Os logs do backend da simulação ficam em `simulator/logs/backend.log`.
