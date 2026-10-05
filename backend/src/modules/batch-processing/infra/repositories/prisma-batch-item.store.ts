import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../shared/infra/prisma/prisma.service";
import type { EnrichmentResult } from "../../domain/enrichment-result";
import type {
  BatchItemRef,
  BatchItemStore,
} from "../../application/ports/batch-item.store";

@Injectable()
export class PrismaBatchItemStore implements BatchItemStore {
  constructor(private readonly prisma: PrismaService) {}

  async markEnriched(
    item: BatchItemRef,
    result: EnrichmentResult,
  ): Promise<boolean> {
    const { count } = await this.prisma.batchItem.updateMany({
      where: { ...item, status: "RECEIVED" },
      data: {
        status: "ENRICHED",
        price: result.price,
        stock: result.stock,
        lastError: null,
        attempts: { increment: 1 },
      },
    });
    return count === 1;
  }

  async markFailed(item: BatchItemRef, reason: string): Promise<boolean> {
    const { count } = await this.prisma.batchItem.updateMany({
      where: { ...item, status: "RECEIVED" },
      data: { status: "FAILED", lastError: reason, attempts: { increment: 1 } },
    });
    return count === 1;
  }

  async recordFailedAttempt(item: BatchItemRef, reason: string): Promise<void> {
    await this.prisma.batchItem.updateMany({
      where: { ...item, status: "RECEIVED" },
      data: { lastError: reason, attempts: { increment: 1 } },
    });
  }
}
