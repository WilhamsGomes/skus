import clsx from "clsx";
import { ArrowLeft, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useResendCallback, useRun } from "../api/hooks";
import type { ItemStatus, ReportSummary, RunDelivery } from "../api/types";
import { Button } from "../components/ui/Button";
import { JsonViewer } from "../components/ui/JsonViewer";
import { KpiCard } from "../components/ui/KpiCard";
import { Panel } from "../components/ui/Panel";
import { RunProgress } from "../components/ui/ProgressBar";
import { ScoreRing } from "../components/ui/ScoreRing";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { PassBadge, StatusBadge } from "../components/ui/StatusBadge";
import { useToast } from "../components/ui/Toaster";
import {
  DASH,
  formatDateTime,
  formatInt,
  formatMs,
  formatPrice,
  formatTime,
  runDurationMs,
} from "../lib/format";

const OUTCOME_MESSAGES = {
  added: "Callback agendado",
  retried: "Callback reenfileirado",
  already_queued: "Callback já estava na fila",
} as const;

export function RunDetailPage() {
  const { runId = "" } = useParams();
  const { data: run, isLoading, error } = useRun(runId);
  const resend = useResendCallback();
  const { notify } = useToast();
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "ALL">("ALL");

  const items = useMemo(
    () => (run?.itemList ?? []).filter((item) => statusFilter === "ALL" || item.status === statusFilter),
    [run?.itemList, statusFilter],
  );

  if (isLoading) return <LoadingState />;
  if (error || !run) return <ErrorState error={error} />;

  const finished = run.items.enriched + run.items.failed;
  const missing = Math.max(0, run.total - run.items.received);

  const onResend = () =>
    resend.mutate(run.runId, {
      onSuccess: ({ outcome }) =>
        notify("success", OUTCOME_MESSAGES[outcome], "Cada envio gera um novo relatório na plataforma."),
      onError: (failure) => notify("error", "Não foi possível reenviar", failure.message),
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link to="/runs" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
            <ArrowLeft className="size-3.5" /> Lotes
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-base break-all text-ink">{run.runId}</h2>
            <StatusBadge status={run.status} pulse={run.status === "OPEN"} />
            {run.callbackSentAt ? (
              <StatusBadge tone="ok" label={`callback ${formatTime(run.callbackSentAt)}`} />
            ) : run.status === "COMPLETED" ? (
              <StatusBadge tone="warn" label="callback pendente" pulse />
            ) : null}
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            cid <span className="font-mono">{run.cid}</span> · iniciado {formatDateTime(run.startedAt)}
          </p>
        </div>
        <Button
          icon={<RefreshCw className="size-4" />}
          onClick={onResend}
          loading={resend.isPending}
          disabled={run.status !== "COMPLETED"}
          title={run.status === "COMPLETED" ? "POST /callback de novo" : "Disponível quando o lote concluir"}
        >
          Reenviar callback
        </Button>
      </div>

      <Panel bodyClassName="p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
          <span>
            {formatInt(finished)} de {formatInt(run.total)} itens finalizados
            {missing > 0 && ` · ${formatInt(missing)} ainda não chegaram em /process`}
          </span>
          <span className="tabular-nums">{Math.round((finished / Math.max(run.total, 1)) * 100)}%</span>
        </div>
        <RunProgress total={run.total} enriched={run.items.enriched} failed={run.items.failed} pending={run.items.pending} />
      </Panel>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total" value={formatInt(run.total)} hint={`${formatInt(run.items.received)} recebidos`} />
        <KpiCard label="Enriquecidos" value={formatInt(run.items.enriched)} tone="ok" />
        <KpiCard label="Falharam" value={formatInt(run.items.failed)} hint="404 → price/stock nulos" tone="bad" />
        <KpiCard label="Pendentes" value={formatInt(run.items.pending)} tone="warn" />
        <KpiCard label="Chamadas /enrich" value={formatInt(run.items.enrichCalls)} tone="violet" />
        <KpiCard label="Burst → callback" value={formatMs(runDurationMs(run))} tone="accent" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Relatório mais recente" className="xl:col-span-5">
          <ReportCard summary={run.report} />
        </Panel>
        <Panel
          title="Entregas"
          subtitle="Cada POST /callback e a resposta da plataforma"
          className="xl:col-span-7"
          bodyClassName="p-0"
        >
          <DeliveryList deliveries={run.deliveryList} />
        </Panel>
      </div>

      <Panel
        title={`Itens (${formatInt(items.length)})`}
        actions={
          <select
            className="input w-auto py-1 text-xs"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ItemStatus | "ALL")}
            aria-label="Filtrar por status"
          >
            <option value="ALL">Todos</option>
            <option value="RECEIVED">Recebidos</option>
            <option value="ENRICHED">Enriquecidos</option>
            <option value="FAILED">Falharam</option>
          </select>
        }
        bodyClassName="max-h-[560px] overflow-auto p-0"
      >
        {items.length === 0 ? (
          <EmptyState title="Nenhum item com esse filtro" />
        ) : (
          <table className="table-base min-w-[900px]">
            <thead className="sticky top-0 bg-surface">
              <tr>
                <th className="w-14">seq</th>
                <th>SKU</th>
                <th>Status</th>
                <th className="text-right">Preço</th>
                <th className="text-right">Estoque</th>
                <th className="text-right">Tentativas</th>
                <th>Último erro</th>
                <th>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.seq}>
                  <td className="tabular-nums text-ink-muted">{item.seq}</td>
                  <td className="font-mono text-xs">{item.sku}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="text-right tabular-nums">{formatPrice(item.price)}</td>
                  <td className="text-right tabular-nums">{formatInt(item.stock)}</td>
                  <td className={clsx("text-right tabular-nums", item.attempts > 1 && "text-warn")}>
                    {item.attempts}
                  </td>
                  <td className="max-w-64 truncate text-xs text-ink-muted" title={item.lastError ?? undefined}>
                    {item.lastError ?? DASH}
                  </td>
                  <td className="text-xs text-ink-muted">{formatTime(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function ReportCard({ summary }: { summary: ReportSummary | null }) {
  if (!summary) return <EmptyState title="Sem relatório ainda">Aparece quando o callback é aceito.</EmptyState>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <ScoreRing value={summary.score} size={76} stroke={8} />
        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-ink-muted">ACK p50 / p95</dt>
          <dd className="text-right tabular-nums">
            {formatMs(summary.ackP50)} / {formatMs(summary.ackP95)}
          </dd>
          <dt className="text-ink-muted">Pior ACK</dt>
          <dd className="text-right tabular-nums">{formatMs(summary.ackWorstMs)}</dd>
          <dt className="text-ink-muted">Duração</dt>
          <dd className="text-right tabular-nums">{formatMs(summary.durationMs)}</dd>
          <dt className="text-ink-muted">Corretos</dt>
          <dd className="text-right tabular-nums">
            {formatInt(summary.matched)}/{formatInt(summary.expected)}
          </dd>
          <dt className="text-ink-muted">500 forçados / 429</dt>
          <dd className="text-right tabular-nums">
            {formatInt(summary.forced500)} / {formatInt(summary.got429)}
          </dd>
        </dl>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <PassBadge pass={summary.resultPass} label="resultado" />
        <PassBadge pass={summary.retryPass} label="retry" />
        <PassBadge pass={summary.concurrencyPass} label="concorrência" />
        <PassBadge pass={summary.idempotencyPass} label="idempotência" />
      </div>
    </div>
  );
}

function DeliveryList({ deliveries }: { deliveries: RunDelivery[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (deliveries.length === 0) return <EmptyState title="Nenhum callback enviado para este lote" />;
  return (
    <ul className="divide-y divide-line">
      {deliveries.map((delivery, index) => (
        <li key={delivery.id}>
          <button
            type="button"
            onClick={() => setOpen(open === delivery.id ? null : delivery.id)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60"
          >
            {open === delivery.id ? (
              <ChevronDown className="size-4 text-ink-faint" />
            ) : (
              <ChevronRight className="size-4 text-ink-faint" />
            )}
            <span className="text-xs text-ink-muted">#{deliveries.length - index}</span>
            <span className="text-xs">{formatDateTime(delivery.sentAt)}</span>
            <span className="ml-auto text-xs text-ink-muted tabular-nums">
              ACK p95 {formatMs(delivery.summary?.ackP95)}
            </span>
            <span className="w-12 text-right font-semibold tabular-nums">{delivery.summary?.score ?? DASH}</span>
          </button>
          {open === delivery.id && (
            <div className="px-4 pb-4">
              <JsonViewer value={delivery.report} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
