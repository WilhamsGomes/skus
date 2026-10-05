import clsx from "clsx";
import { ExternalLink, Pause, Play } from "lucide-react";
import { useQueues } from "../api/hooks";
import type { JobCounts, QueueSnapshot } from "../api/types";
import { Panel } from "../components/ui/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { StatusBadge } from "../components/ui/StatusBadge";
import { DASH, formatInt, formatMs, formatTime } from "../lib/format";

const QUEUE_INFO: Record<string, { title: string; description: string }> = {
  enrichment: {
    title: "Enriquecimento",
    description: "Um job por item: GET /enrich/:sku, até 3 em voo, retry com backoff",
  },
  callback: {
    title: "Callback",
    description: "Um job por lote concluído: POST /callback com o resultado consolidado",
  },
};

const COUNT_TILES: { key: keyof JobCounts; label: string; className: string }[] = [
  { key: "waiting", label: "Aguardando", className: "text-violet" },
  { key: "active", label: "Ativos", className: "text-accent" },
  { key: "delayed", label: "Nova tentativa", className: "text-warn" },
  { key: "completed", label: "Concluídos", className: "text-ok" },
  { key: "failed", label: "Falharam", className: "text-bad" },
];

export function QueuesPage() {
  const { data, isLoading, error } = useQueues();

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <p>Atualiza a cada 1 min. Concluídos ficam 1 h no Redis; falhas, 24 h.</p>
        <a
          href="http://localhost:4000/queues"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
        >
          Abrir Bull Board <ExternalLink className="size-3.5" />
        </a>
      </div>
      {data.map((queue) => (
        <QueuePanel key={queue.name} queue={queue} />
      ))}
    </div>
  );
}

function QueuePanel({ queue }: { queue: QueueSnapshot }) {
  const info = QUEUE_INFO[queue.name] ?? { title: queue.name, description: "" };
  return (
    <Panel
      title={`${info.title} · ${queue.name}`}
      subtitle={info.description}
      actions={
        <>
          {queue.globalConcurrency !== null && (
            <StatusBadge tone="info" label={`concorrência global ${queue.globalConcurrency}`} />
          )}
          <StatusBadge
            tone={queue.paused ? "warn" : "ok"}
            label={queue.paused ? "pausada" : "rodando"}
            pulse={!queue.paused && queue.counts.active > 0}
          />
        </>
      }
      bodyClassName="p-0"
    >
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-5">
        {COUNT_TILES.map((tile) => (
          <div key={tile.key} className="bg-surface px-4 py-3">
            <p className="panel-title">{tile.label}</p>
            <p className={clsx("mt-1 text-2xl font-semibold tabular-nums", tile.className)}>
              {formatInt(queue.counts[tile.key])}
            </p>
          </div>
        ))}
      </div>

      {queue.recentJobs.length === 0 ? (
        <EmptyState title="Nenhum job recente" />
      ) : (
        <div className="max-h-[420px] overflow-auto border-t border-line">
          <table className="table-base min-w-[960px]">
            <thead className="sticky top-0 bg-surface">
              <tr>
                <th>Job</th>
                <th>Estado</th>
                <th>Dados</th>
                <th className="text-right">Tentativas</th>
                <th>Criado</th>
                <th className="text-right">Espera</th>
                <th className="text-right">Execução</th>
                <th>Motivo da falha</th>
              </tr>
            </thead>
            <tbody>
              {queue.recentJobs.map((job) => (
                <tr key={`${job.id}-${job.createdAt}`}>
                  <td className="max-w-56 truncate font-mono text-xs" title={job.id ?? undefined}>
                    {job.id ?? DASH}
                  </td>
                  <td>
                    <StatusBadge status={job.state} pulse={job.state === "active"} />
                  </td>
                  <td className="max-w-72 truncate font-mono text-[11px] text-ink-muted">
                    {JSON.stringify(job.data)}
                  </td>
                  <td className="text-right tabular-nums">
                    {job.attemptsMade}
                    {job.maxAttempts ? `/${job.maxAttempts}` : ""}
                  </td>
                  <td className="text-xs text-ink-muted">{formatTime(job.createdAt)}</td>
                  <td className="text-right text-xs tabular-nums">
                    {job.processedOn ? formatMs(job.processedOn - job.createdAt) : DASH}
                  </td>
                  <td className="text-right text-xs tabular-nums">
                    {job.processedOn && job.finishedOn ? formatMs(job.finishedOn - job.processedOn) : DASH}
                  </td>
                  <td className="max-w-64 truncate text-xs text-bad" title={job.failedReason ?? undefined}>
                    {job.failedReason ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center gap-1.5 border-t border-line px-4 py-2 text-[11px] text-ink-faint">
        {queue.paused ? <Pause className="size-3" /> : <Play className="size-3" />}
        Mostrando os {formatInt(queue.recentJobs.length)} jobs mais recentes
      </div>
    </Panel>
  );
}
