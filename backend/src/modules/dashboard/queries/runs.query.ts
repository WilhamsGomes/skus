import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/infra/prisma/prisma.service";
import { type ReportSummary, summarizeReport } from "./report-summary";

export interface RunItemCounts {
  readonly received: number;
  readonly pending: number;
  readonly enriched: number;
  readonly failed: number;
  readonly enrichCalls: number;
}

export interface RunSummary {
  readonly runId: string;
  readonly cid: string;
  readonly total: number;
  readonly status: "OPEN" | "COMPLETED";
  readonly startedAt: Date;
  readonly callbackSentAt: Date | null;
  readonly deliveries: number;
  readonly items: RunItemCounts;
  readonly report: ReportSummary | null;
}

export interface RunItem {
  readonly seq: number;
  readonly sku: string;
  readonly status: "RECEIVED" | "ENRICHED" | "FAILED";
  readonly price: number | null;
  readonly stock: number | null;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly receivedAt: Date;
  readonly updatedAt: Date;
}

export interface RunDelivery {
  readonly id: number;
  readonly sentAt: Date;
  readonly summary: ReportSummary | null;
  readonly report: unknown;
}

export interface RunDetail extends RunSummary {
  readonly itemList: RunItem[];
  readonly deliveryList: RunDelivery[];
  readonly lastReport: unknown;
}

export interface Page<T> {
  readonly data: T[];
  readonly total: number;
}

const EMPTY_COUNTS: RunItemCounts = { received: 0, pending: 0, enriched: 0, failed: 0, enrichCalls: 0 };

@Injectable()
export class RunsQuery {
  constructor(private readonly prisma: PrismaService) {}

  async list(limit: number, offset: number): Promise<Page<RunSummary>> {
    const [rows, total] = await Promise.all([
      this.prisma.batchRun.findMany({
        orderBy: { startedAt: "desc" },
        take: limit,
        skip: offset,
        include: { _count: { select: { deliveries: true } } },
      }),
      this.prisma.batchRun.count(),
    ]);
    const counts = await this.itemCounts(rows.map((row) => row.runId));

    return {
      total,
      data: rows.map((row) => ({
        runId: row.runId,
        cid: row.cid,
        total: row.total,
        status: row.status,
        startedAt: row.startedAt,
        callbackSentAt: row.callbackSentAt,
        deliveries: row._count.deliveries,
        items: counts.get(row.runId) ?? EMPTY_COUNTS,
        report: summarizeReport(row.callbackReport),
      })),
    };
  }

  async detail(runId: string): Promise<RunDetail | null> {
    const row = await this.prisma.batchRun.findUnique({
      where: { runId },
      include: { deliveries: { orderBy: { sentAt: "desc" } } },
    });
    if (!row) return null;

    const [counts, items] = await Promise.all([
      this.itemCounts([runId]),
      this.prisma.batchItem.findMany({ where: { runId }, orderBy: { seq: "asc" }, take: 1000 }),
    ]);

    return {
      runId: row.runId,
      cid: row.cid,
      total: row.total,
      status: row.status,
      startedAt: row.startedAt,
      callbackSentAt: row.callbackSentAt,
      deliveries: row.deliveries.length,
      items: counts.get(runId) ?? EMPTY_COUNTS,
      report: summarizeReport(row.callbackReport),
      lastReport: row.callbackReport,
      itemList: items.map((item) => ({
        seq: item.seq,
        sku: item.sku,
        status: item.status,
        price: item.price,
        stock: item.stock,
        attempts: item.attempts,
        lastError: item.lastError,
        receivedAt: item.receivedAt,
        updatedAt: item.updatedAt,
      })),
      deliveryList: row.deliveries.map((delivery) => ({
        id: delivery.id,
        sentAt: delivery.sentAt,
        summary: summarizeReport(delivery.report),
        report: delivery.report,
      })),
    };
  }

  async itemCounts(runIds: string[]): Promise<Map<string, RunItemCounts>> {
    if (runIds.length === 0) return new Map();

    const groups = await this.prisma.batchItem.groupBy({
      by: ["runId", "status"],
      where: { runId: { in: runIds } },
      _count: { _all: true },
      _sum: { attempts: true },
    });

    const result = new Map<string, RunItemCounts>();
    for (const group of groups) {
      const current = result.get(group.runId) ?? EMPTY_COUNTS;
      const count = group._count._all;
      result.set(group.runId, {
        received: current.received + count,
        pending: current.pending + (group.status === "RECEIVED" ? count : 0),
        enriched: current.enriched + (group.status === "ENRICHED" ? count : 0),
        failed: current.failed + (group.status === "FAILED" ? count : 0),
        enrichCalls: current.enrichCalls + (group._sum.attempts ?? 0),
      });
    }
    return result;
  }
}
