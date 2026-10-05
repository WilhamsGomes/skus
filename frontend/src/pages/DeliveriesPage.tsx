import clsx from "clsx";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useDelivery, useDeliveries } from "../api/hooks";
import { JsonViewer } from "../components/ui/JsonViewer";
import { Pagination } from "../components/ui/Pagination";
import { Panel } from "../components/ui/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { PassBadge } from "../components/ui/StatusBadge";
import { DASH, formatDateTime, formatInt, formatMs, shortId } from "../lib/format";

const LIMIT = 20;

export function DeliveriesPage() {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const { data, isLoading, error } = useDeliveries(LIMIT, offset);
  const detail = useDelivery(selected);

  return (
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-12">
      <Panel
        title="Entregas (callbacks)"
        subtitle="Cada POST /callback aceito e o relatório devolvido pela plataforma"
        className="2xl:col-span-7"
        bodyClassName="p-0"
      >
        {isLoading && <LoadingState />}
        {error && (
          <div className="p-4">
            <ErrorState error={error} />
          </div>
        )}
        {data && data.data.length === 0 && <EmptyState title="Nenhuma entrega ainda" />}
        {data && data.data.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="table-base min-w-[900px]">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Lote</th>
                    <th>Enviado</th>
                    <th className="text-right">ACK p95</th>
                    <th className="text-right">Duração</th>
                    <th className="text-right">Corretos</th>
                    <th>Critérios</th>
                    <th className="text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((delivery) => (
                    <tr
                      key={delivery.id}
                      onClick={() => setSelected(delivery.id)}
                      className={clsx("cursor-pointer", selected === delivery.id && "bg-brand/10")}
                    >
                      <td className="tabular-nums text-ink-muted">{delivery.id}</td>
                      <td>
                        <Link
                          to={`/runs/${delivery.runId}`}
                          onClick={(event) => event.stopPropagation()}
                          className="font-mono text-xs text-brand hover:underline"
                        >
                          {shortId(delivery.runId, 12)}
                        </Link>
                      </td>
                      <td className="text-xs text-ink-muted">{formatDateTime(delivery.sentAt)}</td>
                      <td className="text-right text-xs tabular-nums">{formatMs(delivery.summary?.ackP95)}</td>
                      <td className="text-right text-xs tabular-nums">{formatMs(delivery.summary?.durationMs)}</td>
                      <td className="text-right text-xs tabular-nums">
                        {formatInt(delivery.summary?.matched)}/{formatInt(delivery.summary?.expected)}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <PassBadge pass={delivery.summary?.retryPass ?? null} label="retry" />
                          <PassBadge pass={delivery.summary?.concurrencyPass ?? null} label="conc." />
                          <PassBadge pass={delivery.summary?.idempotencyPass ?? null} label="idemp." />
                        </div>
                      </td>
                      <td className="text-right font-semibold tabular-nums">{delivery.summary?.score ?? DASH}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
          </>
        )}
      </Panel>

      <Panel
        title={selected === null ? "Relatório" : `Relatório da entrega #${selected}`}
        subtitle="Resposta completa do POST /callback"
        className="2xl:col-span-5"
      >
        {selected === null && <EmptyState title="Selecione uma entrega para ver o relatório" />}
        {selected !== null && detail.isLoading && <LoadingState />}
        {selected !== null && detail.error && <ErrorState error={detail.error} />}
        {selected !== null && detail.data && <JsonViewer value={detail.data.report} maxHeight="max-h-[640px]" />}
      </Panel>
    </div>
  );
}
