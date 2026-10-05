import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useItems } from "../api/hooks";
import type { ItemStatus } from "../api/types";
import { Pagination } from "../components/ui/Pagination";
import { Panel } from "../components/ui/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { StatusBadge } from "../components/ui/StatusBadge";
import { DASH, formatDateTime, formatInt, formatPrice, shortId } from "../lib/format";

const LIMIT = 50;

export function ItemsPage() {
  const [params] = useSearchParams();
  const [runId, setRunId] = useState(params.get("runId") ?? "");
  const [status, setStatus] = useState<ItemStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => setOffset(0), [runId, status, search]);

  const { data, isLoading, error } = useItems({
    runId: runId.trim() || undefined,
    status: status || undefined,
    search: search || undefined,
    limit: LIMIT,
    offset,
  });

  return (
    <Panel
      title="Itens"
      subtitle="Mensagens recebidas em /process e o resultado do enriquecimento"
      bodyClassName="p-0"
    >
      <div className="flex flex-wrap gap-2 border-b border-line p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            className="input pl-9"
            placeholder="Buscar SKU"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <input
          className="input w-full font-mono text-xs sm:w-72"
          placeholder="run_id"
          value={runId}
          onChange={(event) => setRunId(event.target.value)}
        />
        <select
          className="input w-full sm:w-44"
          value={status}
          onChange={(event) => setStatus(event.target.value as ItemStatus | "")}
          aria-label="Status"
        >
          <option value="">Todos os status</option>
          <option value="RECEIVED">Recebidos</option>
          <option value="ENRICHED">Enriquecidos</option>
          <option value="FAILED">Falharam</option>
        </select>
      </div>

      {isLoading && <LoadingState />}
      {error && (
        <div className="p-4">
          <ErrorState error={error} />
        </div>
      )}
      {data && data.data.length === 0 && <EmptyState title="Nenhum item encontrado" />}
      {data && data.data.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="table-base min-w-[1000px]">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th className="w-14">seq</th>
                  <th>SKU</th>
                  <th>Status</th>
                  <th className="text-right">Preço</th>
                  <th className="text-right">Estoque</th>
                  <th className="text-right">Tentativas</th>
                  <th>Último erro</th>
                  <th>Recebido</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((item) => (
                  <tr key={`${item.runId}-${item.seq}`}>
                    <td>
                      <Link to={`/runs/${item.runId}`} className="font-mono text-xs text-brand hover:underline">
                        {shortId(item.runId, 10)}
                      </Link>
                    </td>
                    <td className="tabular-nums text-ink-muted">{item.seq}</td>
                    <td className="font-mono text-xs">{item.sku}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="text-right tabular-nums">{formatPrice(item.price)}</td>
                    <td className="text-right tabular-nums">{formatInt(item.stock)}</td>
                    <td className="text-right tabular-nums">{item.attempts}</td>
                    <td className="max-w-56 truncate text-xs text-ink-muted" title={item.lastError ?? undefined}>
                      {item.lastError ?? DASH}
                    </td>
                    <td className="text-xs text-ink-muted">{formatDateTime(item.receivedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </>
      )}
    </Panel>
  );
}
