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
}
