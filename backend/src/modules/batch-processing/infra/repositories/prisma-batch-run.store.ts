import { Injectable } from "@nestjs/common";
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
}
