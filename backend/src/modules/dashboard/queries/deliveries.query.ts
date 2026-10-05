import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/infra/prisma/prisma.service";
import { type ReportSummary, summarizeReport } from "./report-summary";
import type { Page } from "./runs.query";

export interface DeliveryRow {
  readonly id: number;
  readonly runId: string;
  readonly sentAt: Date;
  readonly runStartedAt: Date;
  readonly summary: ReportSummary | null;
}

@Injectable()
export class DeliveriesQuery {
  constructor(private readonly prisma: PrismaService) {}

  async list(limit: number, offset: number): Promise<Page<DeliveryRow>> {
    const [rows, total] = await Promise.all([
      this.prisma.callbackDelivery.findMany({
        orderBy: { sentAt: "desc" },
        take: limit,
        skip: offset,
        include: { run: { select: { startedAt: true } } },
      }),
      this.prisma.callbackDelivery.count(),
    ]);

    return {
      total,
      data: rows.map((row) => ({
        id: row.id,
        runId: row.runId,
        sentAt: row.sentAt,
        runStartedAt: row.run.startedAt,
        summary: summarizeReport(row.report),
      })),
    };
  }

  async find(id: number): Promise<{ id: number; runId: string; sentAt: Date; report: unknown } | null> {
    const row = await this.prisma.callbackDelivery.findUnique({ where: { id } });
    return row ? { id: row.id, runId: row.runId, sentAt: row.sentAt, report: row.report } : null;
  }
}
