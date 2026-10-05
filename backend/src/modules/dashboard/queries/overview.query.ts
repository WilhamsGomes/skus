import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/infra/prisma/prisma.service";
import { STALE_AFTER_MS } from "../../batch-processing/application/reconcile-stale-work.use-case";
import { type JobCounts, QueuesQuery } from "./queues.query";
import { type ReportSummary, summarizeReport } from "./report-summary";
import { type RunSummary, RunsQuery } from "./runs.query";

const TIMELINE_RUNS = 15;
const SCORE_SAMPLE = 200;
const OPEN_RUN_ALERT_MS = 5 * 60 * 1000;

export type AlertLevel = "success" | "info" | "warning" | "error";

export interface Alert {
  readonly level: AlertLevel;
  readonly title: string;
  readonly detail: string;
}

export interface Overview {
  readonly generatedAt: Date;
  readonly registration: { cid: string; name: string; webhook: string; registeredAt: Date } | null;
  readonly runs: { total: number; open: number; completed: number; callbacksPending: number };
  readonly items: { total: number; pending: number; enriched: number; failed: number; enrichCalls: number; successRate: number | null };
  readonly deliveries: { total: number; bestScore: number | null; averageScore: number | null; lastSentAt: Date | null };
  readonly lastReport: ReportSummary | null;
  readonly queues: Record<string, JobCounts>;
  readonly timeline: RunSummary[];
  readonly alerts: Alert[];
}

@Injectable()
export class OverviewQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runsQuery: RunsQuery,
    private readonly queuesQuery: QueuesQuery,
  ) {}

  async get(now = new Date()): Promise<Overview> {
    const staleBefore = new Date(now.getTime() - STALE_AFTER_MS);
    const [
      registration,
      runGroups,
      callbacksPending,
      itemGroups,
      staleItems,
      oldOpenRuns,
      deliveries,
      deliveryTotal,
      timeline,
      queues,
    ] = await Promise.all([
      this.prisma.registration.findFirst({
        orderBy: { registeredAt: "desc" },
        select: { cid: true, name: true, webhook: true, registeredAt: true },
      }),
      this.prisma.batchRun.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.batchRun.count({ where: { status: "COMPLETED", callbackSentAt: null } }),
      this.prisma.batchItem.groupBy({ by: ["status"], _count: { _all: true }, _sum: { attempts: true } }),
      this.prisma.batchItem.count({ where: { status: "RECEIVED", updatedAt: { lt: staleBefore } } }),
      this.prisma.batchRun.count({
        where: { status: "OPEN", startedAt: { lt: new Date(now.getTime() - OPEN_RUN_ALERT_MS) } },
      }),
      this.prisma.callbackDelivery.findMany({
        orderBy: { sentAt: "desc" },
        take: SCORE_SAMPLE,
        select: { sentAt: true, report: true },
      }),
      this.prisma.callbackDelivery.count(),
      this.runsQuery.list(TIMELINE_RUNS, 0),
      this.queuesQuery.counts(),
    ]);

    const runCount = (status: "OPEN" | "COMPLETED") =>
      runGroups.find((group) => group.status === status)?._count._all ?? 0;
    const itemCount = (status: "RECEIVED" | "ENRICHED" | "FAILED") =>
      itemGroups.find((group) => group.status === status)?._count._all ?? 0;

    const enriched = itemCount("ENRICHED");
    const failed = itemCount("FAILED");
    const finished = enriched + failed;
    const scores = deliveries
      .map((delivery) => summarizeReport(delivery.report)?.score)
      .filter((score): score is number => typeof score === "number");
    const lastReport = deliveries.length > 0 ? summarizeReport(deliveries[0].report) : null;

    const overview: Omit<Overview, "alerts"> = {
      generatedAt: now,
      registration,
      runs: {
        total: runCount("OPEN") + runCount("COMPLETED"),
        open: runCount("OPEN"),
        completed: runCount("COMPLETED"),
        callbacksPending,
      },
      items: {
        total: itemCount("RECEIVED") + finished,
        pending: itemCount("RECEIVED"),
        enriched,
        failed,
        enrichCalls: itemGroups.reduce((sum, group) => sum + (group._sum.attempts ?? 0), 0),
        successRate: finished > 0 ? enriched / finished : null,
      },
      deliveries: {
        total: deliveryTotal,
        bestScore: scores.length > 0 ? Math.max(...scores) : null,
        averageScore: scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
        lastSentAt: deliveries[0]?.sentAt ?? null,
      },
      lastReport,
      queues,
      timeline: [...timeline.data].reverse(),
    };

    return { ...overview, alerts: buildAlerts(overview, staleItems, oldOpenRuns) };
  }
}

export function buildAlerts(
  overview: Omit<Overview, "alerts">,
  staleItems: number,
  oldOpenRuns: number,
): Alert[] {
  const alerts: Alert[] = [];

  if (!overview.registration) {
    alerts.push({ level: "error", title: "Serviço não registrado", detail: "Registre o webhook antes de solicitar um lote." });
  }

  const failedJobs = Object.entries(overview.queues).filter(([, counts]) => counts.failed > 0);
  for (const [queue, counts] of failedJobs) {
    alerts.push({
      level: "warning",
      title: `${counts.failed} job(s) com falha na fila ${queue}`,
      detail: "Tentativas esgotadas ou erro definitivo. A varredura reprocessa itens e callbacks pendentes.",
    });
  }

  if (staleItems > 0) {
    alerts.push({
      level: "warning",
      title: `${staleItems} item(ns) parado(s) em RECEIVED`,
      detail: "Sem progresso há mais de 60 s; serão republicados pela varredura.",
    });
  }

  if (overview.runs.callbacksPending > 0) {
    alerts.push({
      level: "warning",
      title: `${overview.runs.callbacksPending} lote(s) concluído(s) sem callback`,
      detail: "O callback será reenviado pela varredura.",
    });
  }

  if (oldOpenRuns > 0) {
    alerts.push({
      level: "info",
      title: `${oldOpenRuns} lote(s) aberto(s) há mais de 5 min`,
      detail: "Pode haver itens que a plataforma não entregou ou que falharam por credencial.",
    });
  }

  const score = overview.lastReport?.score;
  if (typeof score === "number") {
    alerts.push({
      level: score >= 100 ? "success" : "info",
      title: `Último relatório: score ${score}`,
      detail: `ACK p95 ${overview.lastReport?.ackP95 ?? "—"} ms · resultado ${overview.lastReport?.matched ?? "—"}/${overview.lastReport?.expected ?? "—"}`,
    });
  }

  return alerts;
}
