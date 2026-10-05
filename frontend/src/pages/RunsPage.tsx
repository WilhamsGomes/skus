import { Rocket } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useRuns } from "../api/hooks";
import { useRequestBatchAction } from "../components/layout/useRequestBatchAction";
import { Button } from "../components/ui/Button";
import { Pagination } from "../components/ui/Pagination";
import { Panel } from "../components/ui/Panel";
import { RunProgress } from "../components/ui/ProgressBar";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { StatusBadge } from "../components/ui/StatusBadge";
import { DASH, formatDateTime, formatInt, formatMs, runDurationMs, shortId } from "../lib/format";

const LIMIT = 20;

export function RunsPage() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error } = useRuns(LIMIT, offset);
  const { requestBatch, isPending } = useRequestBatchAction();

  return (
    <Panel
      title="Histórico de lotes"
      subtitle="Cada lote é um POST /burst/:cid; os itens chegam em /process"
      actions={
        <Button variant="primary" size="sm" icon={<Rocket className="size-4" />} loading={isPending} onClick={requestBatch}>
          Solicitar lote
        </Button>
      }
      bodyClassName="p-0"
    >
      {isLoading && <LoadingState />}
      {error && (
        <div className="p-4">
          <ErrorState error={error} />
        </div>
      )}
      {data && data.data.length === 0 && <EmptyState title="Nenhum lote solicitado ainda" />}
      {data && data.data.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="table-base min-w-[1100px]">
              <thead>
                <tr>
                  <th>run_id</th>
                  <th>Status</th>
                  <th className="w-56">Itens</th>
                  <th className="text-right">Enriq.</th>
                  <th className="text-right">Falhas</th>
                  <th className="text-right">Chamadas</th>
                  <th>Iniciado</th>
                  <th>Duração</th>
                  <th className="text-right">Entregas</th>
                  <th className="text-right">ACK p95</th>
                  <th className="text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((run) => (
                  <tr key={run.runId}>
                    <td>
                      <Link to={`/runs/${run.runId}`} className="font-mono text-xs text-brand hover:underline">
                        {run.runId}
                      </Link>
                      <p className="font-mono text-[10px] text-ink-faint">cid {shortId(run.cid, 10)}</p>
                    </td>
                    <td>
                      <StatusBadge status={run.status} pulse={run.status === "OPEN"} />
                      {run.status === "COMPLETED" && !run.callbackSentAt && (
                        <StatusBadge tone="warn" label="callback pendente" className="ml-1" />
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <RunProgress
                          total={run.total}
                          enriched={run.items.enriched}
                          failed={run.items.failed}
                          pending={run.items.pending}
                        />
                        <span className="w-12 text-right text-xs tabular-nums text-ink-muted">
                          {run.items.received}/{run.total}
                        </span>
                      </div>
                    </td>
                    <td className="text-right tabular-nums text-ok">{formatInt(run.items.enriched)}</td>
                    <td className="text-right tabular-nums text-bad">{formatInt(run.items.failed)}</td>
                    <td className="text-right tabular-nums">{formatInt(run.items.enrichCalls)}</td>
                    <td className="text-xs text-ink-muted">{formatDateTime(run.startedAt)}</td>
                    <td className="text-xs tabular-nums">{formatMs(runDurationMs(run))}</td>
                    <td className="text-right tabular-nums">{formatInt(run.deliveries)}</td>
                    <td className="text-right text-xs tabular-nums">{formatMs(run.report?.ackP95)}</td>
                    <td className="text-right font-semibold tabular-nums">{run.report?.score ?? DASH}</td>
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
