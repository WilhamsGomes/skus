import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../../generated/prisma/client";
import { PrismaService } from "../../../../shared/infra/prisma/prisma.service";
import type { BatchRun } from "../../domain/batch-run";
import type { BatchRunStore } from "../../application/ports/batch-run.store";

@Injectable()
export class PrismaBatchRunStore implements BatchRunStore {
  constructor(private readonly prisma: PrismaService) {}

  async open(run: BatchRun): Promise<void> {
    const { runId, cid, total, status, startedAt } = run;
    await this.prisma.batchRun.upsert({
      where: { runId },
      create: { runId, cid, total, status, startedAt },
      update: {},
    });
  }

  async find(runId: string): Promise<BatchRun | null> {
    const row = await this.prisma.batchRun.findUnique({ where: { runId } });
    if (!row) return null;
    const { cid, total, status, startedAt } = row;
    return { runId, cid, total, status, startedAt };
  }

  async claimCompletion(runId: string): Promise<boolean> {
    const updated = await this.prisma.$executeRaw`
      UPDATE batch_runs
      SET status = 'COMPLETED', updated_at = now()
      WHERE run_id = ${runId}
        AND status = 'OPEN'
        AND total <= (
          SELECT count(*) FROM batch_items
          WHERE run_id = ${runId} AND status IN ('ENRICHED', 'FAILED')
        )`;
    return updated === 1;
  }

  async findOpenRunIds(createdAfter: Date, createdBefore: Date): Promise<string[]> {
    const rows = await this.prisma.batchRun.findMany({
      where: { status: "OPEN", createdAt: { gt: createdAfter, lt: createdBefore } },
      select: { runId: true },
    });
    return rows.map((row) => row.runId);
  }

  async findPendingCallbackRunIds(updatedBefore: Date): Promise<string[]> {
    const rows = await this.prisma.batchRun.findMany({
      where: {
        status: "COMPLETED",
        callbackSentAt: null,
        updatedAt: { lt: updatedBefore },
      },
      select: { runId: true },
    });
    return rows.map((row) => row.runId);
  }

  async markCallbackSent(runId: string, report: unknown): Promise<void> {
    const json =
      report === null || report === undefined
        ? Prisma.JsonNull
        : (report as Prisma.InputJsonValue);
    const sentAt = new Date();
    await this.prisma.$transaction([
      this.prisma.batchRun.update({
        where: { runId },
        data: { callbackSentAt: sentAt, callbackReport: json },
      }),
      this.prisma.callbackDelivery.create({
        data: { runId, sentAt, report: json },
      }),
    ]);
  }
}
