import clsx from "clsx";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Gauge,
  Info,
  PackageCheck,
  Send,
  Timer,
  XCircle,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useOverview } from "../api/hooks";
import type { AlertLevel, JobCounts, Overview } from "../api/types";
import { KpiCard } from "../components/ui/KpiCard";
import { Panel } from "../components/ui/Panel";
import { RunProgress } from "../components/ui/ProgressBar";
import { ScoreRing } from "../components/ui/ScoreRing";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { StatusBadge } from "../components/ui/StatusBadge";
import { axisProps, CHART, tooltipStyle } from "../lib/chart";
import {
  DASH,
  formatDateTime,
  formatInt,
  formatMs,
  formatPercent,
  formatRelative,
  runDurationMs,
  shortId,
} from "../lib/format";

export function OverviewPage() {
  const { data, isLoading, error } = useOverview();

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} />;

  const ackTarget = data.lastReport?.ackTargetMs ?? 600;
  const ackP95 = data.lastReport?.ackP95 ?? null;
  const callsPerItem =
    data.items.enriched + data.items.failed > 0
      ? data.items.enrichCalls / (data.items.enriched + data.items.failed)
      : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1700px]:grid-cols-6">
        <KpiCard
          label="Lotes"
          value={formatInt(data.runs.total)}
          hint={`${formatInt(data.runs.open)} em andamento · ${formatInt(data.runs.completed)} concluídos`}
          icon={<Boxes className="size-5" />}
          tone="brand"
        />
        <KpiCard
          label="Itens enriquecidos"
          value={formatInt(data.items.enriched)}
          hint={`${formatPercent(data.items.successRate)} de sucesso · ${formatInt(data.items.failed)} falhas`}
          icon={<PackageCheck className="size-5" />}
          tone="ok"
        />
        <KpiCard
          label="Melhor score"
          value={data.deliveries.bestScore ?? DASH}
          hint={`média ${data.deliveries.averageScore === null ? DASH : data.deliveries.averageScore.toFixed(1)}`}
          aside={<ScoreRing value={data.deliveries.bestScore} size={48} />}
        />
        <KpiCard
          label="ACK p95 (último)"
          value={formatMs(ackP95)}
          hint={`meta ${formatMs(ackTarget)} · p50 ${formatMs(data.lastReport?.ackP50)}`}
          icon={<Gauge className="size-5" />}
          tone={ackP95 !== null && ackP95 > ackTarget ? "bad" : "accent"}
        />
        <KpiCard
          label="Chamadas /enrich"
          value={formatInt(data.items.enrichCalls)}
          hint={callsPerItem === null ? DASH : `${callsPerItem.toFixed(2).replace(".", ",")} por item finalizado`}
          icon={<Zap className="size-5" />}
          tone="violet"
        />
        <KpiCard
          label="Entregas"
          value={formatInt(data.deliveries.total)}
          hint={data.deliveries.lastSentAt ? `última ${formatRelative(data.deliveries.lastSentAt)}` : "nenhuma ainda"}
          icon={<Send className="size-5" />}
          tone="warn"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel
          title="Processamento por lote"
          subtitle="Itens enriquecidos, com falha e pendentes nos últimos lotes"
          className="xl:col-span-6"
        >
          <RunsBarChart data={data} />
        </Panel>
        <Panel title="Fila de enriquecimento" subtitle="Jobs por estado no BullMQ" className="xl:col-span-3">
          <QueueDonut counts={data.queues.enrichment} />
        </Panel>
        <Panel title="Último relatório" subtitle="Pontos por critério" className="xl:col-span-3">
          <BreakdownBars data={data} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel
          title="Score e ACK por lote"
          subtitle="Score do relatório (barra) e ACK p95 em ms (linha)"
          className="xl:col-span-8"
        >
          <ScoreAckChart data={data} ackTarget={ackTarget} />
        </Panel>
        <Panel title="Alertas" subtitle="Estado da operação agora" className="xl:col-span-4" bodyClassName="p-3">
          <AlertList data={data} />
        </Panel>
      </div>

      <Panel
        title="Lotes recentes"
        actions={
          <Link to="/runs" className="text-xs font-medium text-brand hover:underline">
            Ver todos
          </Link>
        }
        bodyClassName="overflow-x-auto"
      >
        <RecentRuns data={data} />
      </Panel>
    </div>
  );
}

function RunsBarChart({ data }: { data: Overview }) {
  if (data.timeline.length === 0) return <EmptyState title="Nenhum lote ainda" />;
  const rows = data.timeline.map((run) => ({
    name: shortId(run.runId, 6),
    Enriquecidos: run.items.enriched,
    Falhas: run.items.failed,
    Pendentes: run.items.pending + Math.max(0, run.total - run.items.received),
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barSize={18}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} width={32} />
          <Tooltip {...tooltipStyle} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: CHART.axis }} />
          <Bar dataKey="Enriquecidos" stackId="items" fill={CHART.ok} />
          <Bar dataKey="Falhas" stackId="items" fill={CHART.bad} />
          <Bar dataKey="Pendentes" stackId="items" fill={CHART.warn} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const QUEUE_SLICES: { key: keyof JobCounts; label: string; color: string }[] = [
  { key: "completed", label: "Concluídos", color: CHART.ok },
  { key: "active", label: "Ativos", color: CHART.accent },
  { key: "waiting", label: "Aguardando", color: CHART.violet },
  { key: "delayed", label: "Nova tentativa", color: CHART.warn },
  { key: "failed", label: "Falharam", color: CHART.bad },
];

function QueueDonut({ counts }: { counts: JobCounts | undefined }) {
  if (!counts) return <EmptyState title="Fila indisponível" />;
  const slices = QUEUE_SLICES.map((slice) => ({ ...slice, value: counts[slice.key] }));
  const visible = slices.filter((slice) => slice.value > 0);
  const total = visible.reduce((sum, slice) => sum + slice.value, 0);
  const inFlight = counts.active + counts.waiting + counts.delayed;

  return (
    <div className="flex h-64 flex-col">
      <div className="relative flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total > 0 ? visible : [{ label: "vazio", value: 1, color: CHART.muted }]}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={visible.length > 1 ? 2 : 0}
              stroke="none"
            >
              {(total > 0 ? visible : [{ color: CHART.muted }]).map((slice, index) => (
                <Cell key={index} fill={slice.color} />
              ))}
            </Pie>
            {total > 0 && <Tooltip {...tooltipStyle} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-semibold tabular-nums text-ink">{formatInt(inFlight)}</p>
            <p className="text-[10px] tracking-wider text-ink-faint uppercase">em andamento</p>
          </div>
        </div>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center justify-between gap-2 text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: slice.color }} />
              {slice.label}
            </span>
            <span className="font-medium tabular-nums text-ink">{formatInt(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const CRITERIA_LABELS: Record<string, string> = {
  ack: "ACK",
  retry: "Retry",
  result: "Resultado",
  concurrency: "Concorrência",
  idempotency: "Idempotência",
};

function BreakdownBars({ data }: { data: Overview }) {
  const report = data.lastReport;
  if (!report || report.breakdown.length === 0) return <EmptyState title="Nenhum relatório ainda" />;
  return (
    <div className="flex h-64 flex-col justify-between">
      <div className="flex items-center gap-3">
        <ScoreRing value={report.score} size={64} stroke={7} />
        <div className="text-xs text-ink-muted">
          <p>
            Duração <span className="font-medium text-ink">{formatMs(report.durationMs)}</span>
          </p>
          <p>
            Resultado{" "}
            <span className="font-medium text-ink">
              {formatInt(report.matched)}/{formatInt(report.expected)}
            </span>
          </p>
        </div>
      </div>
      <ul className="space-y-2.5">
        {report.breakdown.map((entry) => {
          const ratio = entry.weight > 0 ? entry.earned / entry.weight : 0;
          return (
            <li key={entry.criterion}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-ink-muted">{CRITERIA_LABELS[entry.criterion] ?? entry.criterion}</span>
                <span className="font-medium tabular-nums text-ink">
                  {entry.earned}/{entry.weight}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className={clsx("h-full rounded-full", ratio >= 1 ? "bg-ok" : ratio > 0 ? "bg-brand" : "bg-bad")}
                  style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScoreAckChart({ data, ackTarget }: { data: Overview; ackTarget: number }) {
  const rows = data.timeline
    .filter((run) => run.report)
    .map((run) => ({
      name: shortId(run.runId, 6),
      Score: run.report?.score ?? null,
      "ACK p95": run.report?.ackP95 ?? null,
      Meta: ackTarget,
    }));
  if (rows.length === 0) return <EmptyState title="Os relatórios aparecem depois do primeiro callback" />;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows}>
          <defs>
            <linearGradient id="ackFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis yAxisId="score" domain={[0, 100]} {...axisProps} width={32} />
          <YAxis yAxisId="ack" orientation="right" {...axisProps} width={40} />
          <Tooltip {...tooltipStyle} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: CHART.axis }} />
          <Bar yAxisId="score" dataKey="Score" fill={CHART.brand} radius={[4, 4, 0, 0]} barSize={22} />
          <Area yAxisId="ack" dataKey="ACK p95" stroke={CHART.accent} fill="url(#ackFill)" strokeWidth={2} />
          <Line yAxisId="ack" dataKey="Meta" stroke={CHART.bad} strokeDasharray="4 4" dot={false} strokeWidth={1} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const ALERT_ICONS: Record<AlertLevel, ReactNode> = {
  success: <CheckCircle2 className="size-4 text-ok" />,
  info: <Info className="size-4 text-accent" />,
  warning: <AlertTriangle className="size-4 text-warn" />,
  error: <XCircle className="size-4 text-bad" />,
};

const ALERT_BORDERS: Record<AlertLevel, string> = {
  success: "border-ok/30 bg-ok/5",
  info: "border-accent/30 bg-accent/5",
  warning: "border-warn/30 bg-warn/5",
  error: "border-bad/30 bg-bad/5",
};

function AlertList({ data }: { data: Overview }) {
  return (
    <div className="flex h-64 flex-col gap-2 overflow-y-auto">
      {data.registration && (
        <div className="rounded-lg border border-line bg-surface-2 p-3 text-xs">
          <p className="panel-title">Registro vigente</p>
          <p className="mt-1 truncate font-medium text-ink">{data.registration.name}</p>
          <p className="truncate text-ink-muted">{data.registration.webhook}</p>
          <p className="mt-1 font-mono text-[11px] text-ink-faint">cid {data.registration.cid}</p>
        </div>
      )}
      {data.alerts.length === 0 && (
        <div className={clsx("flex items-start gap-2 rounded-lg border p-3", ALERT_BORDERS.success)}>
          {ALERT_ICONS.success}
          <p className="text-xs text-ink">Nenhum problema detectado.</p>
        </div>
      )}
      {data.alerts.map((alert) => (
        <div key={alert.title} className={clsx("flex items-start gap-2 rounded-lg border p-3", ALERT_BORDERS[alert.level])}>
          {ALERT_ICONS[alert.level]}
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink">{alert.title}</p>
            <p className="mt-0.5 text-[11px] text-ink-muted">{alert.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentRuns({ data }: { data: Overview }) {
  const runs = [...data.timeline].reverse().slice(0, 8);
  if (runs.length === 0) return <EmptyState title="Nenhum lote ainda">Use “Solicitar lote” no topo.</EmptyState>;
  return (
    <table className="table-base min-w-[860px]">
      <thead>
        <tr>
          <th>Lote</th>
          <th>Status</th>
          <th className="w-56">Progresso</th>
          <th>Iniciado</th>
          <th>Duração</th>
          <th>ACK p95</th>
          <th className="text-right">Score</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.runId}>
            <td>
              <Link to={`/runs/${run.runId}`} className="font-mono text-xs text-brand hover:underline">
                {run.runId}
              </Link>
            </td>
            <td>
              <StatusBadge status={run.status} pulse={run.status === "OPEN"} />
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
                  {run.items.enriched + run.items.failed}/{run.total}
                </span>
              </div>
            </td>
            <td className="text-xs text-ink-muted">{formatDateTime(run.startedAt)}</td>
            <td className="text-xs tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Timer className="size-3 text-ink-faint" />
                {formatMs(runDurationMs(run))}
              </span>
            </td>
            <td className="text-xs tabular-nums">{formatMs(run.report?.ackP95)}</td>
            <td className="text-right font-semibold tabular-nums">{run.report?.score ?? DASH}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
