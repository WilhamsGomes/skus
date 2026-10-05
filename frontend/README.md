# SKU Enrichment · Painel

Dashboard React (Vite + TypeScript) para acompanhar a integração: lotes, itens, filas, Redis, entregas de callback e registro do webhook.

## Como executar

Com o backend rodando em `http://localhost:4000`:

```bash
npm install
npm run dev        # http://localhost:5173
```

Login único: `admin` / `admin`. Para trocar, defina `DASHBOARD_USERNAME` e `DASHBOARD_PASSWORD` no `.env` do backend.

As chamadas vão para `/api/*`, que o Vite repassa ao backend, então não há CORS para configurar. Para apontar para outro backend, copie `.env.example` para `.env` e ajuste `VITE_API_TARGET`.

```bash
npm run build      # typecheck + build de produção em dist/
```

## Telas

| Tela | O que mostra |
|---|---|
| Visão geral | KPIs (lotes, itens, melhor score, ACK p95, chamadas ao `/enrich`, entregas), processamento por lote, fila em tempo real, pontos do último relatório, score × ACK por lote e alertas |
| Lotes | Histórico com progresso, falhas, chamadas, duração e score; botão para solicitar um lote |
| Detalhe do lote | Progresso do lote (atualiza a cada 3 s enquanto ele está em andamento), itens, relatório, entregas com o JSON da plataforma e reenvio do callback |
| Itens | Busca por SKU, filtro por lote e status, paginação |
| Filas | Contagem por estado e jobs recentes das filas `enrichment` e `callback` (com link para o Bull Board) |
| Cache (Redis) | Versão, memória, clientes, operações/s, hit rate e chaves por prefixo |
| Entregas | Todos os callbacks enviados, critérios aprovados e o relatório completo |
| Registro | Registro vigente, histórico e formulário para registrar um novo webhook |

## Estrutura

```
src/
├── api/          # cliente HTTP (token, 401 → login), tipos das respostas e hooks do TanStack Query
├── auth/         # contexto de login e rota protegida
├── components/
│   ├── layout/   # menu lateral, barra superior, ação "Solicitar lote"
│   └── ui/       # painel, KPI, badges, anel de score, paginação, toasts, visualizador de JSON
├── lib/          # formatação (pt-BR) e tema dos gráficos
└── pages/        # uma página por rota, carregada sob demanda
```

Os dados são atualizados por polling a cada 1 minuto (`REFRESH_INTERVAL_MS` em `src/api/hooks.ts`); o detalhe de um lote em andamento, a cada 3 s (`RUN_IN_PROGRESS_REFRESH_MS`), e logo após qualquer ação (solicitar lote, reenviar callback, registrar). O token fica no `localStorage` e expira em 8 h.
